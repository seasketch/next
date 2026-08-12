import { BBox, Feature, MultiPolygon, Polygon } from "geojson";
/**
 * geoblaze.stats materializes every intersecting pixel into a JS array before
 * calc-stats. Above ~10^8 values V8 throws RangeError: Invalid array length
 * (and well before that it can OOM). Keep the stock path for typical sketch
 * fragments; stream pixels into O(unique-values) histograms for large windows.
 *
 * 32M packed doubles ≈ 256 MB — comfortable on the 10 GB overlay worker, and
 * above the Fiji EEZ bathy geography test (~8.1M pixels).
 */
export declare const MAX_COLLECTED_PIXELS = 32000000;
export type GeoblazeHistogram = Record<string, {
    n: number;
    ct: number;
}>;
export type GeoblazeBandStat = {
    count: number;
    valid: number;
    invalid: number;
    min: number;
    max: number;
    mean: number;
    median: number;
    range: number;
    sum: number;
    histogram: GeoblazeHistogram;
};
export type GeoblazeStatsExtra = {
    vrm: [number, number];
    rescale: true;
};
type GeorasterLike = {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    width: number;
    height: number;
    pixelWidth: number;
    pixelHeight: number;
    noDataValue?: number;
    values?: number[][][];
    getValues?: (opts: {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
        resampleMethod?: string;
    }) => Promise<unknown>;
};
/**
 * Pixel columns/rows in the overlap of a feature bbox and the raster extent.
 * Clamped so a continent-scale geography over a small COG does not report
 * billions of pixels.
 */
export declare function intersectingWindowPixelCounts(featureBBox: BBox, raster: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    width: number;
    height: number;
    pixelWidth: number;
    pixelHeight: number;
}): [number, number];
export declare function estimatedCollectedPixels(window: [number, number], vrm: [number, number] | null): number;
export declare function shouldStreamGeoblazeStats(window: [number, number], vrm: [number, number] | null): boolean;
/**
 * Median from a value→count histogram. Matches calc-stats / mediana so
 * streaming results stay aligned with geoblaze.stats.
 */
export declare function medianFromHistogram(histogram: GeoblazeHistogram, valid: number): number;
/**
 * Run geoblaze.stats, or stream pixels when the window would exceed
 * {@link MAX_COLLECTED_PIXELS}.
 */
export declare function computeGeoblazeBandStats(geoblaze: {
    stats: (raster: unknown, feature: unknown, calcStatsOptions: unknown, test: undefined, extra?: GeoblazeStatsExtra) => Promise<Array<Record<string, unknown>>>;
}, raster: GeorasterLike, feature: Feature<Polygon | MultiPolygon>, calcStatsOptions: {
    stats: string[];
}, statsExtra: GeoblazeStatsExtra | undefined, windowPixels: [number, number], options?: {
    forceStream?: boolean;
    forceCollect?: boolean;
}): Promise<GeoblazeBandStat[]>;
export {};
//# sourceMappingURL=geoblazeBandStats.d.ts.map