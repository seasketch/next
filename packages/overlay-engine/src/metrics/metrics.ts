export type MetricType =
  | "total_area"
  | "overlay_area"
  | "count"
  | "presence"
  | "presence_table"
  | "contextualized_mean";

type MetricBase = {
  type: MetricType;
  subject: MetricSubjectFragment | MetricSubjectGeography;
};

type OverlayMetricBase = MetricBase & {
  stableId: string;
  groupBy: string;
};

export type MetricSubjectFragment = {
  hash: string;
  geographies: number[];
  sketches: number[];
};

export type MetricSubjectGeography = {
  type: "geography";
  id: number;
};

export type TotalAreaMetric = MetricBase & {
  type: "total_area";
  value: number;
};

export type OverlayAreaMetric = OverlayMetricBase & {
  type: "overlay_area";
  value:
    | number
    | {
        [groupBy: string]: number;
      };
};

export type CountMetric = OverlayMetricBase & {
  type: "count";
  value:
    | number
    | {
        [groupBy: string]: number;
      };
};

export type PresenceMetric = OverlayMetricBase & {
  type: "presence";
  value:
    | boolean
    | {
        [groupBy: string]: boolean;
      };
};

export type PresenceTableValue = {
  id: string;
  [attribute: string]: any;
};

export type PresenceTableMetric = OverlayMetricBase & {
  type: "presence_table";
  value: PresenceTableValue[];
  count: number;
};

export type Metric =
  | TotalAreaMetric
  | OverlayAreaMetric
  | CountMetric
  | PresenceMetric
  | PresenceTableMetric;

export type MetricTypeMap = {
  total_area: TotalAreaMetric;
  overlay_area: OverlayAreaMetric;
  count: CountMetric;
  presence: PresenceMetric;
  presence_table: PresenceTableMetric;
};

export function subjectIsFragment(
  subject: any | MetricSubjectFragment | MetricSubjectGeography
): subject is MetricSubjectFragment {
  return "hash" in subject;
}

export function subjectIsGeography(
  subject: any | MetricSubjectFragment | MetricSubjectGeography
): subject is MetricSubjectGeography {
  return "id" in subject;
}

export type SourceType = "FlatGeobuf" | "GeoJSON" | "GeoTIFF";
