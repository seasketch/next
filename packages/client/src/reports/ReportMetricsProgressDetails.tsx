import { Trans, useTranslation } from "react-i18next";
import { LocalMetric, useReportContext } from "./ReportContext";
import { useMemo } from "react";
import {
  Geography,
  SpatialMetricState,
  useRetryFailedSpatialMetricsMutation,
} from "../generated/graphql";
import { subjectIsFragment, subjectIsGeography } from "overlay-engine";
import ReportTaskLineItem from "./components/ReportTaskLineItem";
import Button from "../components/Button";
import * as Tooltip from "@radix-ui/react-tooltip";

enum DisplayState {
  FRAGMENTS,
  PREPROCESSING,
}

export default function ReportMetricsProgressDetails({
  metricIds,
  skeleton,
}: {
  metricIds: number[];
  skeleton: React.ReactNode;
}) {
  const { t } = useTranslation("sketching");
  const reportContext = useReportContext();

  const state = useMemo(() => {
    const geographyMetrics: LocalMetric[] = [];
    const fragmentMetrics: LocalMetric[] = [];
    const relatedSourceProcessingJobs = new Set<string>();
    const failedMetrics = [] as number[];

    for (const metric of reportContext.metrics) {
      if (metricIds.includes(metric.id)) {
        if (subjectIsGeography(metric.subject)) {
          geographyMetrics.push(metric);
        } else {
          fragmentMetrics.push(metric);
        }
        if (metric.sourceProcessingJobDependency) {
          const sourceProcessingJob = reportContext.sourceProcessingJobs.find(
            (j) => j.jobKey === metric.sourceProcessingJobDependency
          );
          if (sourceProcessingJob) {
            relatedSourceProcessingJobs.add(sourceProcessingJob.jobKey);
          }
        }
        if (metric.state === SpatialMetricState.Error) {
          failedMetrics.push(metric.id);
        }
      }
    }

    return {
      displayState:
        geographyMetrics.length > 0 || relatedSourceProcessingJobs.size > 0
          ? DisplayState.PREPROCESSING
          : DisplayState.FRAGMENTS,
      geographyMetrics,
      fragmentMetrics,
      sourceProcessingJobs: Array.from(relatedSourceProcessingJobs)
        .map((jobKey) =>
          reportContext.sourceProcessingJobs.find((j) => j.jobKey === jobKey)
        )
        .filter((j) => j !== undefined),
      failedMetrics,
    };
  }, [metricIds, reportContext.metrics, reportContext.sourceProcessingJobs]);

  const [retry, retryState] = useRetryFailedSpatialMetricsMutation({
    variables: {
      metricIds: state.failedMetrics,
    },
  });

  if (state.displayState === DisplayState.FRAGMENTS) {
    return <>{skeleton}</>;
  }

  return (
    <Tooltip.Provider>
      <div className="space-y-2 p-4 my-5 border bg-white">
        {state.sourceProcessingJobs.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">{t("Data Preprocessing")}</h3>
            <p className="text-sm text-gray-500">
              <Trans ns="sketching">
                SeaSketch optimizes data for fast analysis when creating plans.
                These calculations will only need to be run once.
              </Trans>
            </p>
            <ul className="space-y-0.5 py-2">
              {state.sourceProcessingJobs.map((job) => (
                <ReportTaskLineItem
                  key={job.jobKey}
                  title={job.layerTitle || job.jobKey}
                  state={job.state}
                  progress={job.progressPercentage}
                  tooltip={job.errorMessage}
                  // tooltip={job.progressMessage || undefined}
                />
              ))}
            </ul>
          </div>
        )}
        {state.geographyMetrics.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">{t("Geography Metrics")}</h3>
            <p className="text-sm text-gray-500">
              <Trans ns="sketching">
                Each metric included in reports are calculated for related
                project geographies in order to provide useful stats such as
                percent coverage. These calculations may be slow, but will only
                need to be recalculated if source layers or geographies are
                updated.
              </Trans>
            </p>
            <ul className="space-y-0.5 py-2">
              {state.geographyMetrics.map((metric) => (
                <ReportTaskLineItem
                  key={metric.id}
                  title={nameForGeography(
                    metric.subject as { type: "geography"; id: number },
                    reportContext.geographies
                  )}
                  state={metric.state}
                  progress={metric.progress || null}
                  tooltip={metric.errorMessage}
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
                Metrics are calculated for sketch geometry whenever they are
                created or updated. Polygons may be split into multiple
                fragments in order to account for antimeridian crossings or
                overlap with other sketches in a collection.
              </Trans>
            </p>
            <ul className="space-y-0.5 py-2">
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
                        {(metric.subject as { hash: string }).hash.substring(
                          0,
                          8
                        )}
                        ...
                      </span>
                    </span>
                  }
                  state={metric.state}
                  progress={metric.progress || null}
                  tooltip={metric.errorMessage}
                />
              ))}
            </ul>
            {state.failedMetrics.length > 0 && (
              <div className="mt-2">
                <Button
                  onClick={() => {
                    retry();
                  }}
                  label={t("Retry calculations")}
                  small
                  disabled={retryState.loading}
                  loading={retryState.loading}
                />
              </div>
            )}
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
