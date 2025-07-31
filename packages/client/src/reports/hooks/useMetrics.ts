import { Metric, MetricType, MetricTypeMap } from "overlay-engine";
import { useReportContext } from "../ReportContext";
import { useState } from "react";

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
