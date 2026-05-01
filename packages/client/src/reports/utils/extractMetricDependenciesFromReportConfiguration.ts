import {
  extractMetricDependenciesFromReportBody,
  type MetricDependency,
} from "overlay-engine";
import type { ReportConfiguration } from "../cards/cards";

/**
 * Walk published report configuration and collect all widget metric dependencies.
 */
export function extractMetricDependenciesFromReportConfiguration(
  report: ReportConfiguration
): MetricDependency[] {
  const out: MetricDependency[] = [];
  for (const tab of report.tabs || []) {
    for (const card of tab.cards || []) {
      if (card.body) {
        extractMetricDependenciesFromReportBody(card.body, out);
      }
    }
  }
  return out;
}

/**
 * Stable fingerprint for memoization when report card bodies change (admin edits).
 */
export function fingerprintReportMetricDependencies(
  report: ReportConfiguration
): string {
  const parts: string[] = [];
  for (const tab of report.tabs || []) {
    for (const card of tab.cards || []) {
      // eslint-disable-next-line i18next/no-literal-string
      parts.push(`${card.id}\n${JSON.stringify(card.body)}`);
    }
  }
  return parts.join("\n\f\n");
}
