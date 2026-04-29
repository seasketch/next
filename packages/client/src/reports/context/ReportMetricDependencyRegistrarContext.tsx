import { createContext } from "react";
import type { MetricDependency } from "overlay-engine";

export type RegisterReportMetricDependencies = (
  dependencies: MetricDependency[],
  fingerprint: string,
) => void;

export const ReportMetricDependencyRegistrarContext =
  createContext<RegisterReportMetricDependencies>(() => {});
