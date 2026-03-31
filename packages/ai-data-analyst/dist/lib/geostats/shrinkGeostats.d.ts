type GeostatsLike = {
    layer?: string;
    count?: number;
    geometry?: string;
    hasZ?: boolean;
    attributeCount?: number;
    attributes?: Array<Record<string, unknown>>;
    bounds?: number[];
    metadata?: Record<string, unknown>;
};
type RasterLike = {
    bands?: Array<Record<string, unknown>>;
    presentation?: unknown;
    representativeColorsForRGB?: unknown[];
    metadata?: Record<string, unknown>;
    byteEncoding?: boolean;
};
/**
 * Reduce geostats payload size while preserving fields needed for
 * column-intelligence decisions.
 */
export declare function pruneGeostats(geostats: GeostatsLike | RasterLike | unknown): Record<string, unknown> | unknown;
export {};
//# sourceMappingURL=shrinkGeostats.d.ts.map