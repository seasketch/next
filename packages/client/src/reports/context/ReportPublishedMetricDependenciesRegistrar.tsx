import { useContext, useLayoutEffect, useMemo } from "react";
import type { MetricDependency } from "overlay-engine";
import { BaseReportContext } from "./BaseReportContext";
import {
  extractMetricDependenciesFromReportConfiguration,
  fingerprintReportMetricDependencies,
} from "../utils/extractMetricDependenciesFromReportConfiguration";
import { ReportMetricDependencyRegistrarContext } from "./ReportMetricDependencyRegistrarContext";

/**
 * Registers extracted MetricDependency[] from the published report configuration
 * into ReportDependenciesContext (via ReportMetricDependencyRegistrarContext).
 * Mount once under ReportDependenciesContextProvider + BaseReportContextProvider.
 * Waits until BaseReportContext has finished loading (same contract as SketchReportWindow).
 */
export default function ReportPublishedMetricDependenciesRegistrar() {
  const { data, loading } = useContext(BaseReportContext);
  const register = useContext(ReportMetricDependencyRegistrarContext);

  const report = data?.report;

  const { dependencies, fingerprint } = useMemo(() => {
    if (!report) {
      return {
        dependencies: [] as MetricDependency[],
        fingerprint: "",
      };
    }
    return {
      dependencies: extractMetricDependenciesFromReportConfiguration(report),
      fingerprint: fingerprintReportMetricDependencies(report),
    };
  }, [report]);

  useLayoutEffect(() => {
    if (loading || !report) {
      return;
    }
    register(dependencies, fingerprint);
  }, [register, dependencies, fingerprint, loading, report]);

  return null;
}
