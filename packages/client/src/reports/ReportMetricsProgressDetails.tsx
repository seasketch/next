import { Trans, useTranslation } from "react-i18next";
import { useCallback, useContext, useMemo } from "react";
import {
  CompatibleSpatialMetricDetailsFragment,
  DraftReportDependenciesDocument,
  Geography,
  ReportDependenciesDocument,
  SpatialMetricState,
  useRecalculateSpatialMetricsMutation,
} from "../generated/graphql";
import { subjectIsFragment } from "overlay-engine";
import ReportTaskLineItem from "./components/ReportTaskLineItem";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ReportCardConfiguration } from "./cards/cards";
import { DraftReportContext } from "./DraftReportContext";
import { useCardDependenciesContext } from "./context/CardDependenciesContext";
import { useBaseReportContext } from "./context/BaseReportContext";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import { useAuth0 } from "@auth0/auth0-react";

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
  const onError = useGlobalErrorHandler();

  const [recalculate, recalculateState] = useRecalculateSpatialMetricsMutation({
    onError,
  });

  const allMetrics = useMemo(
    () => [...draftReportContext.draftMetrics, ...context.metrics],
    [draftReportContext.draftMetrics, context.metrics]
  );

  const handleRepairSource = useCallback(
    async (jobKey: string) => {
      const metricIds = allMetrics
        .filter((m) => m.sourceProcessingJobDependency === jobKey)
        .map((m) => m.id);
      if (metricIds.length === 0) return;
      await recalculate({
        variables: {
          metricIds,
          preprocessSources: true,
          repairInvalid: true,
        },
        refetchQueries: [
          ReportDependenciesDocument,
          DraftReportDependenciesDocument,
        ],
        awaitRefetchQueries: true,
      });
    },
    [allMetrics, recalculate]
  );

  const state = useMemo(() => {
    const failedMetrics = [] as number[];
    const metrics = [...draftReportContext.draftMetrics, ...context.metrics];
    const overlaySources = [
      ...draftReportContext.draftOverlaySources,
      ...context.sources,
    ];

    return {
      geographyMetrics: metrics.filter((m) => !subjectIsFragment(m.subject)),
      fragmentMetrics: metrics.filter((m) => subjectIsFragment(m.subject)),
      relatedOverlaySources: Array.from(overlaySources),
      failedMetrics,
    };
  }, [
    draftReportContext.draftMetrics,
    draftReportContext.draftOverlaySources,
    context.metrics,
    context.sources,
  ]);

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
            <ul className="space-y-1 py-2">
              {state.relatedOverlaySources.map((layer) => {
                const isComplete =
                  layer.sourceProcessingJob?.state ===
                    SpatialMetricState.Complete || Boolean(layer.output);
                return (
                  <ReportTaskLineItem
                    key={"rtli-layer-" + layer.tableOfContentsItemId}
                    title={layer.tableOfContentsItem?.title || "Untitled"}
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
                    completedAt={layer.output?.createdAt}
                    durationSeconds={layer.sourceProcessingJob?.durationSeconds}
                    errorMessage={layer.sourceProcessingJob?.errorMessage}
                    outputSize={layer.output?.size}
                    outputUrl={layer.output?.url}
                    outputType={
                      layer.output?.url && layer.output?.url.endsWith(".fgb")
                        ? "FlatGeobuf"
                        : layer.output?.url &&
                          layer.output?.url.endsWith(".tif")
                        ? "GeoTIFF"
                        : undefined
                    }
                    isAdmin={isAdmin}
                    estimatedCompletionTime={layer.sourceProcessingJob?.eta}
                    numInvalidFeatures={layer.output?.numInvalidFeatures}
                    numFeatures={layer.output?.numFeatures}
                    numRepairedFeatures={layer.output?.numRepairedFeatures}
                    wasRepaired={layer.output?.wasRepaired}
                    containsOverlappingFeatures={
                      layer.containsOverlappingFeatures
                    }
                    onRepairClick={
                      isAdmin && layer.sourceProcessingJob?.jobKey
                        ? () =>
                            handleRepairSource(
                              layer.sourceProcessingJob!.jobKey
                            )
                        : undefined
                    }
                    repairLoading={recalculateState.loading}
                  />
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
                  <button
                    type="button"
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
                  </button>
                </>
              )}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {uniqueFragmentHashes} {t("unique fragments")} {t("and")}{" "}
              {groupedFragmentMetrics.length} {t("operation groups")}
            </p>
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
                        title={
                          <span className="font-mono truncate">
                            {t("Polygon ")}
                            <span className="text-slate-500">
                              {(
                                metric.subject as { hash: string }
                              ).hash.substring(0, 36)}
                            </span>
                          </span>
                        }
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
