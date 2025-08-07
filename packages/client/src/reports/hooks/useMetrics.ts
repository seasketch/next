import { Metric, MetricTypeMap } from "overlay-engine";
import { useReportContext } from "../ReportContext";
import { useState, useEffect, useRef } from "react";

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
>(options: { type: T; geographyIds?: number[]; excludeSiblings?: boolean }) {
  const [loading, setLoading] = useState(true);
  const reportContext = useReportContext();

  // Create a stable numeric ID that never changes for this hook instance
  const stableId = useRef(createStableId()).current;

  useEffect(() => {
    // Create a dependency object that matches SpatialMetricDependency
    const dependency = {
      type: options.type,
      geographyIds: options.geographyIds || [],
    };

    reportContext.addMetricDependency(stableId, dependency);

    // Cleanup function to remove the dependency when the component unmounts
    return () => {
      reportContext.removeMetricDependency(stableId, dependency);
    };
  }, [options.type, options.geographyIds, stableId]);

  return {
    data: [] as MetricTypeMap[T][],
    loading,
  };
}
