import { Metric, MetricTypeMap } from "overlay-engine";
import { useReportContext } from "../ReportContext";
import { useState } from "react";

/**
 * useMetrics provides an interface for Report Cards to request the data they
 * need in order to render and visualize results. It is useMetrics
 * responsibility to fetch or calculate those metrics and provide them to the
 * client Card in an interface matching the types defined in overlay-engine.
 *
 * The first and most obvious method by which useMetrics will satisfy these
 * requests is by making a request to the SeaSketch app server, which may
 * delegate clipping operations to lambda or other serverless functions. In the
 * future, we may also support offline reports by having browser clients cache
 * data and perform clipping operations in a web worker. (TBD on that...)
 *
 * useMetrics will fetch metrics which apply to any fragments belonging directly
 * to the sketch being reported on, or any fragments belonging to child sketches
 * the case of collections.
 *
 * @param options
 * @returns
 */
export function useMetrics<
  T extends keyof MetricTypeMap | Metric["type"]
>(options: { type: T }) {
  const [loading, setLoading] = useState(true);
  const reportContext = useReportContext();

  return {
    data: [] as MetricTypeMap[T][],
    loading,
  };
}
