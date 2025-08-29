import { Metric, MetricTypeMap, subjectIsFragment } from "overlay-engine";
import { useReportContext } from "../ReportContext";
import { useState, useEffect, useRef, useMemo } from "react";
import { SpatialMetricState } from "../../generated/graphql";
import { useErrorBoundary } from "react-error-boundary";

let idCounter = 0;

function createStableId() {
  if (idCounter === Number.MAX_SAFE_INTEGER) {
    idCounter = 0;
  }
  return idCounter++;
}

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
>(options: { type: T; geographyIds?: number[]; includeSiblings?: boolean }) {
  const [loading, setLoading] = useState(true);
  const reportContext = useReportContext();
  const { showBoundary, resetBoundary } = useErrorBoundary();

  // Create a stable numeric ID that never changes for this hook instance
  const stableId = useRef(createStableId()).current;

  useEffect(() => {
    if (!reportContext.sketch?.id) {
      return;
    }

    // Create a dependency object that matches SpatialMetricDependency
    const dependency = {
      type: options.type,
      sketchId: reportContext.sketch?.id,
      geographyIds: options.geographyIds || [],
      includeSiblings: options.includeSiblings || false,
    };

    reportContext.addMetricDependency(stableId, dependency);

    // Cleanup function to remove the dependency when the component unmounts
    return () => {
      reportContext.removeMetricDependency(stableId, dependency);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    options.type,
    options.geographyIds,
    options.includeSiblings,
    stableId,
    reportContext.sketch?.id,
  ]);

  const fragmentIds = useMemo(() => {
    return reportContext.relatedFragments.map((f) => f.hash);
  }, [reportContext.relatedFragments]);

  const data = useMemo(() => {
    return reportContext.metrics.filter((m) => {
      if (m.type !== options.type) {
        return false;
      }
      if (subjectIsFragment(m.subject)) {
        if (!fragmentIds.includes(m.subject.hash)) {
          return false;
        }
      } else {
        if (!(options.geographyIds || []).includes(m.subject.id)) {
          return false;
        }
      }
      // TODO: check for matching stableId, groupBy, etc.
      return true;
    });
  }, [reportContext.metrics, fragmentIds, options]);

  const errors = useMemo(() => {
    const errors = data
      .filter((m) => m.state === SpatialMetricState.Error)
      .map((m) => m.errorMessage || "Unknown error");
    return errors;
  }, [data]);

  if (errors.length > 0) {
    const e = new Error(`Error fetching ${options.type} metrics`);
    // @ts-ignore
    e.errorMessages = errors;
    // @ts-ignore
    e.failedMetrics = data
      .filter((m) => m.state === SpatialMetricState.Error)
      .map((m) => m.id);
    // This trick hides the create-react-app error overlay in development mode
    // https://github.com/facebook/create-react-app/issues/6530#issuecomment-768517453
    delete e.stack;
    showBoundary(e);
  }

  return {
    data: data as unknown as MetricTypeMap[T][],
    loading:
      data.length === 0 ||
      data.filter((m) => m.state !== SpatialMetricState.Complete).length > 0,
    errors,
  };
}
