import { Trans, useTranslation } from "react-i18next";
import { LocalMetric, useReportContext } from "./ReportContext";
import { useMemo } from "react";
import {
  Geography,
  SourceProcessingJobDetailsFragment,
  SpatialMetricState,
} from "../generated/graphql";
import { subjectIsFragment, subjectIsGeography } from "overlay-engine";

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
    };
  }, [metricIds, reportContext.metrics, reportContext.sourceProcessingJobs]);

  if (state.displayState === DisplayState.FRAGMENTS) {
    return <>{skeleton}</>;
  }

  return (
    <div className="space-y-2 p-4 my-5 border">
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
              <li className="flex" key={job.jobKey}>
                <span className="flex-1">{job.jobKey}</span>
                <span>{job.progressMessage}</span>
                <span>{labelForState(job.state)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {state.geographyMetrics.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">{t("Geography Metrics")}</h3>
          <p className="text-sm text-gray-500">
            <Trans ns="sketching">
              Each metric included in reports are calculated for related project
              geographies in order to provide useful stats such as percent
              coverage. These calculations may be slow, but will only need to be
              recalculated if source layers or geographies are updated.
            </Trans>
          </p>
          <ul className="space-y-0.5 py-2">
            {state.geographyMetrics.map((metric) => (
              <li className="flex" key={metric.id}>
                <span className="flex-1">
                  {nameForGeography(
                    metric.subject as { type: "geography"; id: number },
                    reportContext.geographies
                  )}
                </span>
                <span>{labelForState(metric.state)}</span>
              </li>
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
              created or updated. Polygons may be split into fragments in order
              to account for antimeridian crossings or overlap with other
              sketches in a collection.
            </Trans>
          </p>
          <ul className="space-y-0.5 py-2">
            {state.fragmentMetrics.map((metric) => (
              <li className="flex" key={metric.id}>
                <span className="flex-1 truncate">
                  {t("Fragment ")}
                  <span className="text-gray-700 font-mono">
                    {
                      // @ts-ignore
                      metric.subject.hash
                    }
                  </span>
                </span>
                <span>{labelForState(metric.state)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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

function labelForState(state: SpatialMetricState) {
  switch (state) {
    case SpatialMetricState.Processing:
      return "Processing";
    case SpatialMetricState.Queued:
      return "Queued";
    case SpatialMetricState.Complete:
      return "Complete";
    case SpatialMetricState.Error:
      return "Error";
    case SpatialMetricState.DependencyNotReady:
      return "Awaiting Dependency";
  }
}
