export type MetricType = "total_area" | "overlay_area" | "count" | "presence" | "presence_table" | "number_stats";
export type MetricSubjectFragment = {
    hash: string;
    geographies: number[];
    sketches: number[];
};
export type MetricSubjectGeography = {
    id: number;
};
export type TotalAreaMetric = {
    type: "total_area";
    subject: MetricSubjectFragment | MetricSubjectGeography;
    value: number;
};
export type OverlayAreaMetric = {
    type: "overlay_area";
    subject: MetricSubjectFragment | MetricSubjectGeography;
    layerStableId: string;
    groupBy: string;
    value: number | {
        [groupBy: string]: number;
    };
};
export type CountMetric = {
    type: "count";
    subject: MetricSubjectFragment | MetricSubjectGeography;
    layerStableId: string;
    groupBy: string;
    value: number | {
        [groupBy: string]: number;
    };
};
export type PresenceMetric = {
    type: "presence";
    subject: MetricSubjectFragment | MetricSubjectGeography;
    layerStableId: string;
    groupBy: string;
    value: boolean | {
        [groupBy: string]: boolean;
    };
};
export type PresenceTableValue = {
    id: string;
    [attribute: string]: any;
};
export type PresenceTableMetric = {
    type: "presence_table";
    subject: MetricSubjectFragment | MetricSubjectGeography;
    layerStableId: string;
    value: PresenceTableValue[];
    count: number;
};
export type Metric = TotalAreaMetric | OverlayAreaMetric | CountMetric | PresenceMetric | PresenceTableMetric;
export type MetricTypeMap = {
    total_area: TotalAreaMetric;
    overlay_area: OverlayAreaMetric;
    count: CountMetric;
    presence: PresenceMetric;
    presence_table: PresenceTableMetric;
};
//# sourceMappingURL=metrics.d.ts.map