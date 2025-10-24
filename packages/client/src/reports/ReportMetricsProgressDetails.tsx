import { Trans, useTranslation } from "react-i18next";
import { useReportContext } from "./ReportContext";
import { useMemo } from "react";
import {
  CompatibleSpatialMetric,
  Geography,
  OverlaySourceDetailsFragment,
  SpatialMetricState,
} from "../generated/graphql";
import {
  MetricSubjectFragment,
  MetricSubjectGeography,
  subjectIsFragment,
  subjectIsGeography,
} from "overlay-engine";
import ReportTaskLineItem from "./components/ReportTaskLineItem";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ReportCardConfiguration } from "./cards/cards";

export default function ReportMetricsProgressDetails({
  metricIds,
  skeleton,
  config,
  isAdmin,
}: {
  metricIds: number[];
  skeleton: React.ReactNode;
  config: ReportCardConfiguration<any>;
  isAdmin?: boolean;
}) {
  const { t } = useTranslation("sketching");
  const reportContext = useReportContext();

  const state = useMemo(() => {
    const geographyMetrics: CompatibleSpatialMetric[] = [];
    const fragmentMetrics: CompatibleSpatialMetric[] = [];
    const relatedOverlaySources = new Set<OverlaySourceDetailsFragment>();
    const failedMetrics = [] as number[];

    for (const metric of reportContext.metrics) {
      if (metricIds.includes(metric.id)) {
        if (
          subjectIsGeography(
            metric.subject as MetricSubjectFragment | MetricSubjectGeography
          )
        ) {
          geographyMetrics.push(metric);
        } else {
          fragmentMetrics.push(metric);
        }
        if (metric.sourceProcessingJobDependency) {
          const relatedOverlaySource = reportContext.overlaySources.find(
            (s) =>
              s.sourceProcessingJob.jobKey ===
              metric.sourceProcessingJobDependency
          );
          if (relatedOverlaySource) {
            relatedOverlaySources.add(relatedOverlaySource);
          }
          // const sourceProcessingJob = reportContext.sourceProcessingJobs.find(
          //   (j) => j.jobKey === metric.sourceProcessingJobDependency
          // );
          // if (sourceProcessingJob) {
          //   relatedSourceProcessingJobs.add(sourceProcessingJob.jobKey);
          // }
        }
        if (metric.state === SpatialMetricState.Error) {
          failedMetrics.push(metric.id);
        }
      }
    }

    return {
      geographyMetrics,
      fragmentMetrics,
      relatedOverlaySources: Array.from(relatedOverlaySources),
      failedMetrics,
    };
  }, [metricIds, reportContext.metrics, reportContext.overlaySources]);

  // if (state.displayState === DisplayState.FRAGMENTS) {
  //   return <>{skeleton}</>;
  // }

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
                return (
                  <ReportTaskLineItem
                    key={layer.tableOfContentsItemId}
                    title={layer.tableOfContentsItem?.title || "Untitled"}
                    state={layer.sourceProcessingJob.state}
                    progress={
                      layer.sourceProcessingJob.state ===
                      SpatialMetricState.Complete
                        ? 100
                        : layer.sourceProcessingJob.progressPercentage
                    }
                    startedAt={layer.sourceProcessingJob.startedAt}
                    progressPercent={
                      layer.sourceProcessingJob.state ===
                      SpatialMetricState.Complete
                        ? 100
                        : layer.sourceProcessingJob.progressPercentage
                    }
                    completedAt={layer.sourceProcessingJob.startedAt}
                    durationSeconds={layer.sourceProcessingJob.durationSeconds}
                    errorMessage={layer.sourceProcessingJob.errorMessage}
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
                    estimatedCompletionTime={layer.sourceProcessingJob.eta}
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
            <ul className="space-y-1 py-2">
              {state.geographyMetrics.map((metric) => (
                <ReportTaskLineItem
                  key={metric.id}
                  title={nameForGeography(
                    metric.subject as { type: "geography"; id: number },
                    reportContext.geographies
                  )}
                  state={metric.state}
                  progress={metric.progress || null}
                  startedAt={metric.startedAt}
                  progressPercent={metric.progress || null}
                  completedAt={metric.updatedAt}
                  durationSeconds={metric.durationSeconds}
                  errorMessage={metric.errorMessage}
                  estimatedCompletionTime={metric.eta}
                />
              ))}
            </ul>
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
            </p>
            <ul className="space-y-1 py-2">
              {state.fragmentMetrics.map((metric) => (
                <ReportTaskLineItem
                  key={metric.id}
                  title={
                    <span className="truncate">
                      <span
                        title={(metric.subject as { hash: string }).hash}
                        className=" font-mono"
                      >
                        {t("Polygon ")}
                        <span className="text-slate-500">
                          {(metric.subject as { hash: string }).hash.substring(
                            0,
                            36
                          )}
                        </span>
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
                />
              ))}
            </ul>
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

// removed local labelForState in favor of ReportTaskLineItem implementation
