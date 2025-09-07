import { MetricTypeMap, ClippingLayerOption, MetricSubjectFragment, MetricSubjectGeography, SourceType } from "overlay-engine";
export type OverlayWorkerMessageType = "result" | "error" | "progress" | "begin";
export type OverlayEngineWorkerBaseMessage = {
    type: OverlayWorkerMessageType;
    jobKey: string;
};
export type OverlayEngineWorkerResultMessage = OverlayEngineWorkerBaseMessage & {
    type: "result";
    result: any;
};
export type OverlayEngineWorkerErrorMessage = OverlayEngineWorkerBaseMessage & {
    type: "error";
    error: string;
};
export type OverlayEngineWorkerProgressMessage = OverlayEngineWorkerBaseMessage & {
    type: "progress";
    progress: number;
    message?: string;
};
export type OverlayEngineWorkerBeginMessage = OverlayEngineWorkerBaseMessage & {
    type: "begin";
    logfileUrl?: string;
    logsExpiresAt?: string;
};
export type OverlayEngineWorkerMessage = OverlayEngineWorkerResultMessage | OverlayEngineWorkerErrorMessage | OverlayEngineWorkerProgressMessage | OverlayEngineWorkerBeginMessage;
export type GeographySubjectPayload = {
    /**
     * The clipping layers to use for the geography.
     */
    clippingLayers: ClippingLayerOption[];
};
export type FragmentSubjectPayload = {
    /**
     * The fragment's hash identifier.
     */
    fragmentHash: string;
    /**
     * If a geobuf can be provided directly, it will be provided here. This is the
     * preferred method, but it may not be possible to provide a geobuf due to
     * lambda request size limits.
     */
    geobuf?: string;
    /**
     * If a geobuf can't be provided directly due to 200KB size limit,
     * a URL to a geobuf can be provided instead. This will likely be a temporary
     * URL with a short-lived token embedded.
     */
    geometryUrl?: string;
};
type EnhanceSubject<S> = S extends MetricSubjectFragment ? MetricSubjectFragment & FragmentSubjectPayload : S extends MetricSubjectGeography ? MetricSubjectGeography & GeographySubjectPayload : S;
type ReplaceStableId<T> = T extends {
    stableId: any;
} ? Omit<T, "value" | "count" | "stableId"> & {
    sourceUrl: string;
    sourceType: SourceType;
} : Omit<T, "value" | "count">;
export type OverlayWorkerPayload = {
    [K in keyof MetricTypeMap]: ReplaceStableId<MetricTypeMap[K]> extends infer R ? R extends {
        subject: infer S;
    } ? Omit<R, "subject"> & {
        jobKey: string;
        subject: Omit<EnhanceSubject<S>, "geographies" | "sketches">;
    } : never : never;
}[keyof MetricTypeMap];
export type OverlayWorkerResponse = {
    /**
     * Identifier for the job. Referenced in OverlayWorkerMessage notifications
     */
    jobKey: string;
    /**
     * The URL to the logs for the job.
     */
    logsUrl: string;
    /**
     * The date and time the logs will expire, as a string parseable by Date.parse().
     */
    logsExpiresAt: string;
};
export {};
//# sourceMappingURL=types.d.ts.map