import {
  combineMetricsForFragments,
  Metric,
  PresenceTableMetric,
  subjectIsFragment,
} from "overlay-engine";
import { CompatibleSpatialMetricDetailsFragment } from "../../generated/graphql";

export type PresenceTableValue = {
  __id: number;
  [attribute: string]: any;
};

export type PresenceTableData = {
  values: PresenceTableValue[];
  exceededLimit: boolean;
  maxResults: number;
  combineError?: string;
};

export const DEFAULT_PRESENCE_TABLE_MAX_RESULTS = 25;

const EMPTY_PRESENCE_TABLE_DATA: PresenceTableData = {
  values: [],
  exceededLimit: false,
  maxResults: DEFAULT_PRESENCE_TABLE_MAX_RESULTS,
};

export function combinePresenceTableMetrics(
  metrics: CompatibleSpatialMetricDetailsFragment[],
  loading: boolean
): PresenceTableData {
  if (loading) {
    return EMPTY_PRESENCE_TABLE_DATA;
  }

  const fragmentMetrics = metrics.filter(
    (m) => subjectIsFragment(m.subject) && m.type === "presence_table"
  );

  if (fragmentMetrics.length === 0) {
    return EMPTY_PRESENCE_TABLE_DATA;
  }

  const maxResults =
    fragmentMetrics[0]?.parameters?.maxResults ??
    DEFAULT_PRESENCE_TABLE_MAX_RESULTS;

  const validMetrics = fragmentMetrics
    .filter((m) => {
      const value = m.value;
      return (
        value !== null &&
        value !== undefined &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        "values" in value
      );
    })
    .map((m) => ({
      type: m.type,
      value: m.value,
    })) as Pick<Metric, "type" | "value">[];

  if (validMetrics.length === 0) {
    return { ...EMPTY_PRESENCE_TABLE_DATA, maxResults };
  }

  try {
    const combined = combineMetricsForFragments(validMetrics) as PresenceTableMetric;
    return {
      values: combined.value.values,
      exceededLimit: combined.value.exceededLimit,
      maxResults,
    };
  } catch (error) {
    return {
      values: [],
      exceededLimit: false,
      maxResults,
      combineError:
        error instanceof Error
          ? error.message
          : "Failed to combine intersecting feature metrics.",
    };
  }
}
