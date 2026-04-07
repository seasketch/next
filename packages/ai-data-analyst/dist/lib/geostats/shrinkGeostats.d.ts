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
 * Attributes with piiRisk at or above this threshold have their values
 * stripped from the LLM payload and replaced with a piiRedacted marker.
 * The threshold can be lowered (e.g. 0.4) for more conservative deployments.
 */
export declare const PII_REDACTION_THRESHOLD = 0.35;
/**
 * Attribute names whose `values` map was omitted from the LLM payload because
 * `piiRisk` met {@link PII_REDACTION_THRESHOLD} (same logic as {@link pruneGeostats}).
 * Rasters and unknown shapes yield an empty list.
 */
export declare function getPiiRedactedColumnNames(geostats: unknown): string[];
/**
 * Reduce geostats payload size while preserving fields needed for
 * column-intelligence decisions.
 */
export declare function pruneGeostats(geostats: GeostatsLike | RasterLike | unknown): Record<string, unknown> | unknown;
export {};
//# sourceMappingURL=shrinkGeostats.d.ts.map