import { Trans, useTranslation } from "react-i18next";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  CompatibleSpatialMetricDetailsFragment,
  DataSourceTypes,
  DraftReportDependenciesDocument,
  Geography,
  ReportDependenciesDocument,
  ReportOverlaySourcesDocument,
  SketchGeometryType,
  SpatialMetricState,
  useRecalculateSpatialMetricsMutation,
  useProjectReportingLayersQuery,
  useReportMetricProgressFieldsLazyQuery,
} from "../generated/graphql";
import { subjectIsFragment } from "overlay-engine";
import ReportTaskLineItem from "./components/ReportTaskLineItem";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ReportCardConfiguration } from "./cards/cards";
import { DraftReportContext } from "./DraftReportContext";
import { useCardDependenciesContext } from "./context/CardDependenciesContext";
import { useBaseReportContext } from "./context/BaseReportContext";
import { useSubjectReportContext } from "./context/SubjectReportContext";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import {
  evictReportDependenciesForReportAndSketch,
  evictReportOverlaySourcesForReport,
} from "./utils/evictReportDependenciesCache";
import { useAuth0 } from "@auth0/auth0-react";
import getSlug from "../getSlug";
import ProfilePhoto from "../admin/users/ProfilePhoto";
import type {
  AuthorProfileFragment,
  CompatibleSpatialMetricProgressFieldsFragment,
} from "../generated/graphql";
import { nameForProfile } from "../projects/Forums/TopicListItem";

export default function ReportMetricsProgressDetails({
  config,
  isAdmin,
}: {
  config: ReportCardConfiguration<any>;
  isAdmin?: boolean;
}) {
  const { t } = useTranslation("sketching");
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const context = useCardDependenciesContext();
  const draftReportContext = useContext(DraftReportContext);
  const baseReportContext = useBaseReportContext();
  const subjectReportContext = useSubjectReportContext();
  const onError = useGlobalErrorHandler();

  const isCollectionSketchClass =
    baseReportContext.sketchClass.geometryType ===
    SketchGeometryType.Collection;

  const sketchNameById = useMemo(() => {
    const m = new Map<number, string>();
    const data = subjectReportContext.data;
    if (!data) return m;
    if (data.sketch?.id != null && data.sketch.name) {
      m.set(data.sketch.id, data.sketch.name);
    }
    for (const ch of data.childSketches ?? []) {
      m.set(ch.id, ch.name);
    }
    for (const sb of data.siblingSketches ?? []) {
      if (!m.has(sb.id)) {
        m.set(sb.id, sb.name);
      }
    }
    return m;
  }, [subjectReportContext.data]);

  const [fetchProgressFields, { data: progressFieldsData }] =
    useReportMetricProgressFieldsLazyQuery();

  const [progressFieldsByMetricId, setProgressFieldsByMetricId] = useState<
    Map<
      string,
      {
        updatedAt?: CompatibleSpatialMetricDetailsFragment["updatedAt"];
        sourceProcessingJobDependency?: CompatibleSpatialMetricDetailsFragment["sourceProcessingJobDependency"];
      }
    >
  >(new Map());

  useEffect(() => {
    const sketchId = subjectReportContext.data?.sketch?.id;
    const reportId = baseReportContext.report.id;
    if (sketchId == null || !reportId) return;
    void fetchProgressFields({
      variables: { reportId, sketchId },
    });
  }, [
    fetchProgressFields,
    subjectReportContext.data?.sketch?.id,
    baseReportContext.report.id,
  ]);

  useEffect(() => {
    const rows = progressFieldsData?.report?.dependencies?.metrics;
    if (!rows?.length) return;
    const next = new Map(
      rows.map((m: CompatibleSpatialMetricProgressFieldsFragment) => [
        String(m.id),
        {
          updatedAt: m.updatedAt ?? undefined,
          sourceProcessingJobDependency:
            m.sourceProcessingJobDependency ?? undefined,
        },
      ]),
    );
    setProgressFieldsByMetricId((prev) => {
      if (prev.size !== next.size) {
        return next;
      }
      for (const [id, v] of next) {
        const p = prev.get(id);
        if (
          !p ||
          p.updatedAt !== v.updatedAt ||
          p.sourceProcessingJobDependency !== v.sourceProcessingJobDependency
        ) {
          return next;
        }
      }
      return prev;
    });
  }, [progressFieldsData?.report?.dependencies?.metrics]);

  const [recalculate, recalculateState] = useRecalculateSpatialMetricsMutation({
    onError,
    update(cache) {
      const sketchId = subjectReportContext.data?.sketch?.id;
      if (sketchId != null) {
        evictReportDependenciesForReportAndSketch(
          cache,
          baseReportContext.report.id,
          sketchId
        );
        evictReportOverlaySourcesForReport(cache, baseReportContext.report.id);
      }
    },
  });
  const allMetrics = useMemo(() => {
    const seenIds = new Set<number>();
    const all = [] as CompatibleSpatialMetricDetailsFragment[];
    for (const metric of [
      ...draftReportContext.draftMetrics,
      ...context.metrics,
    ]) {
      if (metric.id && seenIds.has(metric.id)) continue;
      if (metric.id) seenIds.add(metric.id);
      const extra = metric.id
        ? progressFieldsByMetricId.get(String(metric.id))
        : undefined;
      all.push(
        extra
          ? ({
              ...metric,
              ...extra,
            } as CompatibleSpatialMetricDetailsFragment)
          : metric,
      );
    }
    return all;
  }, [
    draftReportContext.draftMetrics,
    context.metrics,
    progressFieldsByMetricId,
  ]);

  const handleReprocessSource = useCallback(
    async (jobKey: string, repairInvalid: boolean) => {
      const metricIds = allMetrics
        .filter((m) => m.sourceProcessingJobDependency === jobKey)
        .map((m) => m.id);
      if (metricIds.length === 0) return;
      await recalculate({
        variables: {
          metricIds,
          preprocessSources: true,
          repairInvalid,
        },
        refetchQueries: [
          ReportDependenciesDocument,
          ReportOverlaySourcesDocument,
          DraftReportDependenciesDocument,
        ],
        awaitRefetchQueries: true,
      });
    },
    [allMetrics, recalculate]
  );

  const state = useMemo(() => {
    const failedMetrics = [] as number[];
    const metrics = allMetrics; // already deduped above
    const overlaySourcesRaw = [
      ...draftReportContext.draftOverlaySources,
      ...context.sources,
    ];
    const overlaySources = overlaySourcesRaw.filter((s, i, arr) =>
      s.stableId ? arr.findIndex((x) => x.stableId === s.stableId) === i : true
    );

    return {
      geographyMetrics: metrics.filter((m) => !subjectIsFragment(m.subject)),
      fragmentMetrics: metrics.filter((m) => subjectIsFragment(m.subject)),
      relatedOverlaySources: Array.from(overlaySources),
      failedMetrics,
    };
  }, [allMetrics, draftReportContext.draftOverlaySources, context.sources]);

  const groupedGeographyMetrics = useMemo(
    () =>
      groupMetricsBySourceAndOperation(
        state.geographyMetrics,
        state.relatedOverlaySources,
        t
      ),
    [state.geographyMetrics, state.relatedOverlaySources, t]
  );

  const groupedFragmentMetrics = useMemo(
    () =>
      groupMetricsBySourceAndOperation(
        state.fragmentMetrics,
        state.relatedOverlaySources,
        t
      ),
    [state.fragmentMetrics, state.relatedOverlaySources, t]
  );

  const uniqueFragmentHashes = useMemo(
    () =>
      new Set(
        state.fragmentMetrics.map((m) => (m.subject as { hash: string }).hash)
      ).size,
    [state.fragmentMetrics]
  );

  const geographyDurationSummary = useMemo(() => {
    const settled =
      state.geographyMetrics.length > 0 &&
      state.geographyMetrics.every(
        (m) =>
          m.state === SpatialMetricState.Complete ||
          m.state === SpatialMetricState.Error
      );
    if (!settled) return null;
    const total = state.geographyMetrics.reduce(
      (sum, m) => sum + (m.durationSeconds ?? 0),
      0
    );
    return total > 0 ? { totalSeconds: total } : null;
  }, [state.geographyMetrics]);

  const fragmentDurationSummary = useMemo(() => {
    const settled =
      state.fragmentMetrics.length > 0 &&
      state.fragmentMetrics.every(
        (m) =>
          m.state === SpatialMetricState.Complete ||
          m.state === SpatialMetricState.Error
      );
    if (!settled) return null;
    const total = state.fragmentMetrics.reduce(
      (sum, m) => sum + (m.durationSeconds ?? 0),
      0
    );
    return total > 0 ? { totalSeconds: total } : null;
  }, [state.fragmentMetrics]);

  const { data: reportingLayersData } = useProjectReportingLayersQuery({
    variables: { slug: getSlug() },
    fetchPolicy: "cache-only",
  });

  const overlayAttributionByTocId = useMemo(() => {
    const items =
      reportingLayersData?.projectBySlug?.draftTableOfContentsItems ?? [];
    const map = new Map<
      number,
      {
        profile: AuthorProfileFragment | null;
        createdAt: string | null;
        sourceTypeLabel: string;
      }
    >();
    for (const item of items) {
      const ds = item.dataLayer?.dataSource;
      if (!ds || !item.id) continue;
      map.set(item.id, {
        profile: ds.authorProfile ?? null,
        createdAt: ds.createdAt ?? null,
        sourceTypeLabel: sourceTypeLabel(ds.type, t),
      });
    }
    return map;
  }, [reportingLayersData?.projectBySlug?.draftTableOfContentsItems, t]);

  return (
    <Tooltip.Provider>
      <div className="space-y-2 bg-white">
        {state.relatedOverlaySources.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">
              {t("Optimized Overlay Layers")}
            </h3>
            <p className="text-sm text-gray-500">
              <Trans ns="sketching">
                SeaSketch creates optimized layers for fast processing. These
                only need to be generated once, or whenever a source layer is
                updated.
              </Trans>
            </p>
            <ul className="space-y-2 py-2">
              {state.relatedOverlaySources.map((layer) => {
                const jobState = layer.sourceProcessingJob?.state;
                const jobIsRunning =
                  jobState === SpatialMetricState.Queued ||
                  jobState === SpatialMetricState.Processing;
                // Do not treat stale `output` as complete while a job is queued/processing
                // (reprocessing keeps previous output until the new run finishes).
                const isComplete =
                  !jobIsRunning &&
                  (jobState === SpatialMetricState.Complete ||
                    Boolean(layer.output));
                const tocId = layer.tableOfContentsItemId;
                const attribution =
                  tocId != null
                    ? overlayAttributionByTocId.get(tocId)
                    : undefined;
                const displayDate =
                  layer.output?.createdAt ?? attribution?.createdAt ?? null;
                const layerTitle =
                  layer.tableOfContentsItem?.title || t("Untitled");
                return (
                  <li
                    key={"rtli-layer-" + tocId}
                    className="rounded-md border border-gray-100 bg-gray-50/50 px-2 py-1.5 flex items-center gap-2 min-w-0"
                  >
                    <span className="flex-1 flex items-center space-x-2">
                      {attribution?.profile && (
                        <span className="flex-shrink-0 flex items-center text-xs">
                          <AuthorAvatarWithTooltip
                            profile={attribution.profile}
                          />
                        </span>
                      )}
                      <span
                        className="text-sm font-medium min-w-0 truncate"
                        title={layerTitle}
                      >
                        {layerTitle}
                      </span>
                      {attribution && (
                        <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                          {attribution.sourceTypeLabel}
                        </span>
                      )}
                      {layer.output?.epsg && (
                        // eslint-disable-next-line i18next/no-literal-string
                        <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                          EPSG:{layer.output.epsg}
                        </span>
                      )}
                    </span>
                    <span className="flex-shrink-0 ml-auto flex items-center">
                      <ReportTaskLineItem
                        onlyStatus
                        title=""
                        state={
                          isComplete
                            ? SpatialMetricState.Complete
                            : layer.sourceProcessingJob?.state ||
                              SpatialMetricState.Queued
                        }
                        progress={
                          isComplete
                            ? 100
                            : layer.sourceProcessingJob?.progressPercentage
                        }
                        startedAt={layer.sourceProcessingJob?.startedAt}
                        progressPercent={
                          isComplete
                            ? 100
                            : layer.sourceProcessingJob?.progressPercentage
                        }
                        completedAt={
                          jobIsRunning ? undefined : layer.output?.createdAt
                        }
                        durationSeconds={
                          jobIsRunning
                            ? undefined
                            : layer.sourceProcessingJob?.durationSeconds
                        }
                        errorMessage={layer.sourceProcessingJob?.errorMessage}
                        outputSize={
                          jobIsRunning ? undefined : layer.output?.size
                        }
                        outputUrl={jobIsRunning ? undefined : layer.output?.url}
                        outputType={
                          jobIsRunning
                            ? undefined
                            : layer.output?.url &&
                              layer.output?.url.endsWith(".fgb")
                            ? "FlatGeobuf"
                            : layer.output?.url &&
                              layer.output?.url.endsWith(".tif")
                            ? "GeoTIFF"
                            : undefined
                        }
                        isAdmin={isAdmin}
                        estimatedCompletionTime={layer.sourceProcessingJob?.eta}
                        numInvalidFeatures={
                          jobIsRunning
                            ? undefined
                            : layer.output?.numInvalidFeatures
                        }
                        numFeatures={
                          jobIsRunning ? undefined : layer.output?.numFeatures
                        }
                        numRepairedFeatures={
                          jobIsRunning
                            ? undefined
                            : layer.output?.numRepairedFeatures
                        }
                        wasRepaired={
                          jobIsRunning ? undefined : layer.output?.wasRepaired
                        }
                        containsOverlappingFeatures={
                          layer.containsOverlappingFeatures
                        }
                        onReprocessSource={
                          isAdmin && layer.sourceProcessingJob?.jobKey
                            ? (repairInvalid) =>
                                handleReprocessSource(
                                  layer.sourceProcessingJob!.jobKey,
                                  repairInvalid
                                )
                            : undefined
                        }
                        reprocessLoading={recalculateState.loading}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {state.geographyMetrics.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">{t("Geography Metrics")}</h3>
            <p className="text-sm text-gray-500">
              <Trans ns="sketching">
                These metrics are calculated in order to provide useful stats
                such as percent coverage. Like optimized layers, they are only
                recalculated if a source layer is updated.
              </Trans>
            </p>
            {geographyDurationSummary && (
              <p className="text-xs text-gray-500 mt-1">
                {t("Total compute duration")}:{" "}
                {geographyDurationSummary.totalSeconds.toFixed(1)}{" "}
                {t("seconds")}
              </p>
            )}
            <div className="space-y-3 py-2">
              {groupedGeographyMetrics.map((group) => (
                <div
                  key={group.key}
                  className="rounded-md border border-gray-100 bg-gray-50/50 p-2"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="min-w-0 inline-flex items-center gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                        {group.overlayName}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-500 text-xs font-medium">
                        {group.operationLabel}
                      </span>
                    </div>
                    {/* <span className="text-xs text-gray-500">
                      {group.metrics.length} {t("metrics")}
                    </span> */}
                  </div>
                  <ul className="space-y-1">
                    {group.metrics.map((metric) => (
                      <ReportTaskLineItem
                        key={"rtli-" + metric.id}
                        title={nameForGeography(
                          metric.subject as unknown as {
                            type: "geography";
                            id: number;
                          },
                          baseReportContext.geographies
                        )}
                        state={metric.state}
                        progress={metric.progress || null}
                        startedAt={metric.startedAt}
                        progressPercent={metric.progress || null}
                        completedAt={metric.updatedAt}
                        durationSeconds={metric.durationSeconds}
                        errorMessage={metric.errorMessage}
                        estimatedCompletionTime={metric.eta}
                        isAdmin={isAdmin}
                        value={metric.value}
                        metricType={metric.type}
                        parameters={metric.parameters}
                        sourcesReady={state.relatedOverlaySources.every(
                          (layer) =>
                            layer.output ||
                            layer.sourceProcessingJob?.state ===
                              SpatialMetricState.Complete
                        )}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
        {state.fragmentMetrics.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">{t("Sketch Metrics")}</h3>
            <p className="text-sm text-gray-500">
              <Trans ns="sketching">
                Results are calculated when a sketch is created or updated.
                Polygons may be split in order to account for antimeridian
                crossings or overlap with other sketches in a collection.
              </Trans>
              {isAuthenticated && (
                <>
                  {" "}
                  <div
                    role="button"
                    className="underline bg-transparent border-0 p-0 cursor-pointer font-inherit text-inherit"
                    onClick={async () => {
                      try {
                        const token = await getAccessTokenSilently();
                        const hashes = state.fragmentMetrics
                          .map((m) => (m.subject as { hash: string }).hash)
                          .join(",");
                        const url =
                          process.env.REACT_APP_GRAPHQL_ENDPOINT!.replace(
                            "/graphql",
                            `/fragments/geojson?hashes=${encodeURIComponent(
                              hashes
                            )}&token=${token}`
                          );
                        window.open(url, "_blank");
                      } catch (err) {
                        console.error("Failed to get access token", err);
                      }
                    }}
                  >
                    {t("Download fragments as GeoJSON")}
                  </div>
                </>
              )}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {uniqueFragmentHashes} {t("unique fragments")} {t("and")}{" "}
              {groupedFragmentMetrics.length} {t("operation groups")}
            </p>
            {fragmentDurationSummary && (
              <p className="text-xs text-gray-500 mt-1">
                {t("Total compute duration")}:{" "}
                {fragmentDurationSummary.totalSeconds.toFixed(1)} {t("seconds")}
              </p>
            )}
            <div className="space-y-3 py-2">
              {groupedFragmentMetrics.map((group) => (
                <div
                  key={group.key}
                  className="rounded-md border border-gray-100 bg-gray-50/50 p-2"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="min-w-0 inline-flex items-center gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                        {group.overlayName}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-500 text-xs font-medium">
                        {group.operationLabel}
                      </span>
                    </div>
                    {/* <span className="text-xs text-gray-500">
                      {group.metrics.length} {t("metrics")}
                    </span> */}
                  </div>
                  <ul className="space-y-1">
                    {group.metrics.map((metric) => (
                      <ReportTaskLineItem
                        key={"rmtli-" + metric.id}
                        metricType={metric.type}
                        parameters={metric.parameters}
                        title={fragmentMetricLineTitle(metric, {
                          isCollection: isCollectionSketchClass,
                          sketchNameById,
                          t,
                        })}
                        state={metric.state}
                        progress={metric.progress || null}
                        startedAt={metric.startedAt}
                        progressPercent={metric.progress || null}
                        completedAt={metric.updatedAt}
                        durationSeconds={metric.durationSeconds}
                        errorMessage={metric.errorMessage}
                        estimatedCompletionTime={metric.eta}
                        isAdmin={isAdmin}
                        value={metric.value}
                        sourcesReady={state.relatedOverlaySources.every(
                          (layer) =>
                            layer.output ||
                            layer.sourceProcessingJob?.state ===
                              SpatialMetricState.Complete
                        )}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Tooltip.Provider>
  );
}

function fragmentMetricLineTitle(
  metric: CompatibleSpatialMetricDetailsFragment,
  options: {
    isCollection: boolean;
    sketchNameById: Map<number, string>;
    t: (key: string) => string;
  }
): ReactNode {
  const { isCollection, sketchNameById, t } = options;
  if (!subjectIsFragment(metric.subject)) {
    // eslint-disable-next-line i18next/no-literal-string
    return <span className="text-sm text-slate-500">—</span>;
  }
  const hash = metric.subject.hash;
  const sketchIds = metric.subject.sketches ?? [];
  const showSketchNames = isCollection && sketchIds.length > 0;
  const resolvedNames = showSketchNames
    ? sketchIds.map(
        (id) =>
          sketchNameById.get(id) ??
          // eslint-disable-next-line i18next/no-literal-string
          `#${id}`
      )
    : [];
  const middleDot = String.fromCharCode(0x00b7);
  const namesTitle = resolvedNames.join(` ${middleDot} `);

  return (
    <div className="flex items-center gap-2 min-w-0 w-full">
      <span className="flex-shrink-0 whitespace-nowrap text-sm">
        {t("Polygon")}
      </span>
      {showSketchNames && (
        <>
          <span
            className="text-slate-300 flex-shrink-0 select-none"
            aria-hidden
          >
            {middleDot}
          </span>
          <span
            className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700"
            title={namesTitle}
          >
            {resolvedNames.join(` ${middleDot} `)}
          </span>
        </>
      )}
      <span className="text-slate-300 flex-shrink-0 select-none" aria-hidden>
        {middleDot}
      </span>
      <span
        className="min-w-0 max-w-[38%] shrink font-mono text-xs text-slate-500 truncate sm:max-w-[42%]"
        title={hash}
      >
        {hash.substring(0, 36)}
      </span>
    </div>
  );
}

function nameForGeography(
  subject: {
    type: "geography";
    id: number;
  },
  geographies: Pick<Geography, "id" | "name">[]
) {
  if (subjectIsFragment(subject)) {
    return subject.hash;
  }
  return geographies.find((g) => g.id === subject.id)?.name;
}

function sourceTypeLabel(
  type: DataSourceTypes,
  t: (key: string) => string
): string {
  const rasterTypes = [
    DataSourceTypes.Raster,
    DataSourceTypes.RasterDem,
    DataSourceTypes.SeasketchRaster,
    DataSourceTypes.ArcgisRasterTiles,
    DataSourceTypes.Image,
    DataSourceTypes.ArcgisDynamicMapserver,
    DataSourceTypes.ArcgisDynamicMapserverRasterSublayer,
  ];
  if (rasterTypes.includes(type)) return t("Raster");
  return t("Vector");
}

function AuthorAvatarWithTooltip({
  profile,
}: {
  profile: AuthorProfileFragment;
}) {
  const { t } = useTranslation("sketching");
  const name = nameForProfile(profile);
  return (
    <Tooltip.Root delayDuration={200}>
      <Tooltip.Trigger asChild>
        <span className="inline-flex items-center gap-1.5 cursor-default">
          <span className="w-5 h-5 flex-shrink-0 rounded-full overflow-hidden inline-block">
            <ProfilePhoto
              className="opacity-50 hover:opacity-100 grayscale hover:grayscale-0 transition-all duration-200"
              fullname={profile.fullname ?? undefined}
              email={profile.email ?? undefined}
              canonicalEmail={profile.email ?? ""}
              picture={profile.picture ?? undefined}
            />
          </span>
          {/* <span className="truncate">{name || t("Unknown")}</span> */}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="bg-gray-900 text-white text-xs rounded px-2 py-1.5 z-50 max-w-xs"
          sideOffset={4}
          side="top"
        >
          <div className="space-y-0.5">
            {profile.fullname && (
              <div className="font-medium">
                {t("Uploaded by ")}
                {profile.fullname}
              </div>
            )}
            {profile.email && (
              <div className="text-gray-300 truncate">{profile.email}</div>
            )}
            {profile.affiliations && (
              <div className="text-gray-400 text-[11px]">
                {profile.affiliations}
              </div>
            )}
          </div>
          <Tooltip.Arrow className="fill-gray-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function groupMetricsBySourceAndOperation(
  metrics: CompatibleSpatialMetricDetailsFragment[],
  overlaySources: Array<{
    tableOfContentsItem?: { title?: string | null } | null;
    output?: { url?: string | null } | null;
  }>,
  t: (key: string) => string
) {
  const sourceNameByUrl = new Map<string, string>();
  for (const source of overlaySources) {
    if (!source.output?.url) continue;
    sourceNameByUrl.set(
      source.output.url,
      source.tableOfContentsItem?.title || t("Untitled overlay")
    );
  }

  const groups = new Map<
    string,
    {
      key: string;
      overlayName: string;
      operationLabel: string;
      metrics: CompatibleSpatialMetricDetailsFragment[];
    }
  >();

  for (const metric of metrics) {
    const operationLabel = metricTypeLabel(metric.type, t);
    const overlayName = sourceLabelForMetric(metric, sourceNameByUrl, t);
    const key = `${overlayName}::${operationLabel}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        overlayName,
        operationLabel,
        metrics: [],
      });
    }
    groups.get(key)!.metrics.push(metric);
  }

  return Array.from(groups.values()).sort((a, b) => {
    const overlayCmp = a.overlayName.localeCompare(b.overlayName);
    if (overlayCmp !== 0) return overlayCmp;
    return a.operationLabel.localeCompare(b.operationLabel);
  });
}

function sourceLabelForMetric(
  metric: CompatibleSpatialMetricDetailsFragment,
  sourceNameByUrl: Map<string, string>,
  t: (key: string) => string
) {
  if (metric.type === "total_area") {
    return t("Sketch geometry");
  }
  if (!metric.sourceUrl) {
    return t("Unknown source");
  }
  const direct = sourceNameByUrl.get(metric.sourceUrl);
  if (direct) return direct;

  for (const [url, name] of sourceNameByUrl.entries()) {
    if (url.includes(metric.sourceUrl) || metric.sourceUrl.includes(url)) {
      return name;
    }
  }

  try {
    const parsed = new URL(metric.sourceUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    return decodeURIComponent(lastSegment || metric.sourceUrl);
  } catch {
    return metric.sourceUrl;
  }
}

function metricTypeLabel(type: string, t: (key: string) => string) {
  switch (type) {
    case "overlay_area":
      return t("Overlay area");
    case "count":
      return t("Count");
    case "presence":
      return t("Presence");
    case "presence_table":
      return t("Presence table");
    case "column_values":
      return t("Column values");
    case "raster_stats":
      return t("Raster statistics");
    case "distance_to_shore":
      return t("Distance to shore");
    case "total_area":
      return t("Total area");
    default:
      return type;
  }
}
