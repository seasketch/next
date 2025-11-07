import { Metric, MetricTypeMap, subjectIsFragment } from "overlay-engine";
import { useReportContext } from "../ReportContext";
import { useMemo } from "react";
import {
  CompatibleSpatialMetricDetailsFragment,
  OverlaySourceDetailsFragment,
  ReportingLayerDetailsFragment,
  SpatialMetricState,
} from "../../generated/graphql";

/**
 * useMetrics provides an interface for Report Cards to request the data they
 * need in order to render and visualize results. useMetrics will register these
 * metric dependencies with the ReportContext, which will take responsibility
 * for retrieving those metrics from the SeaSketch app server (or using web
 * workers someday when we support offline reports).
 *
 * @param options
 * @returns
 */
export function useMetrics<
  T extends keyof MetricTypeMap | Metric["type"]
>(options: {
  type: T;
  geographyIds?: number[];
  includeSiblings?: boolean;
  layers?: ReportingLayerDetailsFragment[];
}) {
  const reportContext = useReportContext();

  const state = useMemo(() => {
    const sources = new Set<OverlaySourceDetailsFragment>();
    const metrics: CompatibleSpatialMetricDetailsFragment[] = [];
    let loading = false;
    let errors: string[] = [];
    const fragmentIds = reportContext.relatedFragments.map((f) => f.hash);
    for (const metric of reportContext.metrics) {
      if (metric.type !== options.type) {
        continue;
      }
      if (subjectIsFragment(metric.subject)) {
        if (!fragmentIds.includes(metric.subject.hash)) {
          continue;
        }
      } else {
        if (!(options.geographyIds || []).includes(metric.subject.id)) {
          continue;
        }
      }
      let relatedSource: OverlaySourceDetailsFragment | null = null;

      if (metric.sourceUrl) {
        relatedSource =
          reportContext.overlaySources.find(
            (s) => s.sourceUrl === metric.sourceUrl
          ) || null;
      } else if (metric.sourceProcessingJobDependency) {
        relatedSource =
          reportContext.overlaySources.find(
            (s) =>
              (s.sourceUrl && s.sourceUrl === metric.sourceUrl) ||
              s.sourceProcessingJob?.jobKey ===
                metric.sourceProcessingJobDependency
          ) || null;
      }
      if (relatedSource && options.layers) {
        // check that the source is related to one of the layers
        const matchingLayer = options.layers.find(
          (l) =>
            l.tableOfContentsItemId === relatedSource.tableOfContentsItemId &&
            (l.groupBy || "") === (metric.groupBy || "")
        );
        if (!matchingLayer) {
          continue;
        }
      }
      // It's a match! Add it to the list.
      metrics.push(metric);
      if (relatedSource) {
        sources.add(relatedSource);
      }
      if (
        metric.state === SpatialMetricState.Queued ||
        metric.state === SpatialMetricState.Processing
      ) {
        loading = true;
      }
      if (metric.state === SpatialMetricState.Error) {
        errors.push(metric.errorMessage || "Unknown error");
      }
    }
    return {
      data: metrics,
      sources: reportContext.overlaySources.filter((o) =>
        options.layers?.some(
          (l) => l.tableOfContentsItemId === o.tableOfContentsItemId
        )
      ),
      loading,
      errors,
    };
  }, [
    reportContext.metrics,
    reportContext.overlaySources,
    options.type,
    options.geographyIds,
    options.layers,
    reportContext.relatedFragments,
  ]);

  return state;
}
