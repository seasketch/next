/**
 * Reduce a long histogram to at most maxBins buckets by uniform index sampling.
 */
export declare function compressHistogram(histogram: unknown, maxBins?: number): [number, number | null][] | undefined;
export type TrimmedGeostatsKind = "vector" | "raster" | "unknown";
export interface TrimGeostatsResult {
    kind: TrimmedGeostatsKind;
    /** Geometry of the first vector layer, when kind is vector */
    primaryGeometry?: string;
    trimmed: Record<string, unknown> | null;
}
/**
 * Produce a small JSON-safe summary of geostats for LLM context.
 */
export declare function trimGeostatsForLlm(geostats: unknown): TrimGeostatsResult;
//# sourceMappingURL=trimGeostats.d.ts.map