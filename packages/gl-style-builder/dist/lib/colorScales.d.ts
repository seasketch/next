import type { RasterValueSteps } from "ai-data-analyst";
import type { GeostatsAttribute, RasterBandInfo, RasterBucket } from "@seasketch/geostats-types";
import { Expression } from "mapbox-gl";
/** Resolved d3-scale-chromatic scale as a callable; `name` is the export key (e.g. `interpolatePlasma`). */
export type ColorScaleFn = ((value: number) => string) & {
    name: string;
};
/**
 * Build a categorical {@link ColorScaleFn} from LLM/user palette input.
 * Invalid entries are omitted. Arrays keep valid colors in order. Objects are
 * sorted by key (numeric-aware) and treated as an ordered list for bucket indices.
 *
 * @returns A named scale, or `null` if no valid colors remain (use a named d3 scale instead).
 */
export declare function buildCustomColorScale(customPalette: string[] | Record<string, string>): ColorScaleFn | null;
export declare const colorScales: {
    categorical: string[];
    continuous: {
        diverging: string[];
        sequential: string[];
        cyclical: string[];
    };
};
/**
 * Given a type of color scale and a name, find and return an instance of
 * d3-scale-chromatic that is the best match. If no match is found, return a
 * default (appropriate for the type).
 * @param type 'categorical' | 'continuous'
 * @param name - The name of the color scale to get. This name may be coming
 * from our llm-based "ai cartographer", so it could be mismatched in case or
 * incomplete.
 * @param customPalette - A custom palette to use instead of the default or the named scale. Only valid for categorical scales. This
 * could also be coming from an llm, so it could have all sorts of invalid
 * values or issues. It will need strict validation. It could be in the form of:
 *   * an array of colors (e.g. ["#000000", "#FFFFFF", "green", "rgb(0, 0, 0)",
 *     rgba(0, 0, 0, 0.5), "inva-lid", null])
 *   * an object keyed by category value, with each value set to a hex color
 *     string (e.g. { "1": "#000000", "2": "#FFFFFF", "3": "green", "4":
 *     "invalid", "5": null })
 *   * null or undefined to use the default palette
 *   * an empty object to use the default palette
 * @returns A callable scale; invoke with a normalized value in [0, 1] for
 * continuous scales, or a bucket index for categorical. `fn.name` is the
 * resolved d3-scale-chromatic export name (e.g. `interpolatePlasma`).
 */
export declare function getColorScale(type: "categorical" | "continuous", name: string, customPalette?: string[] | Record<string, string> | null): ColorScaleFn;
/**
 * Builds a mapbox-gl-style interpolate expression that can be used for raster
 * or vector layers
 */
export declare function buildContinuousColorExpression(colorScale: ColorScaleFn, reverse: boolean, range: [number, number], arg: Expression): Expression;
/** Raster stats keys that expose {@link RasterBandInfo["stats"]} bucket maps by class count. */
export type RasterStepMethod = "equalInterval" | "geometricInterval" | "naturalBreaks" | "quantiles" | "standardDeviations";
export declare function isRasterStepMethod(value: string): value is RasterStepMethod;
/** Postgres / GraphQL `value_steps` → geostats `stats` bucket map key. */
export declare function rasterValueStepsToRasterStepMethod(steps: RasterValueSteps): RasterStepMethod | null;
/**
 * Sample `n` colors along a continuous scale (same fractions as the admin style
 * editor uses for function palettes in `getColorStops`).
 */
export declare function getColorStopsFromScale(colorScale: ColorScaleFn, n: number, reverse: boolean): string[];
/**
 * Mapbox `step` paint expression for raster values, aligned with
 * `buildStepExpression` in the client style editor (continuous palette sampled
 * at each class).
 */
export declare function buildRasterStepColorExpression(buckets: RasterBucket[], colorScale: ColorScaleFn, reverse: boolean, arg: Expression): Expression;
/**
 * Resolve precomputed break buckets for a histogram method and requested class
 * count.
 *
 * - If the stats map for `method` is missing or empty, or no entry has enough
 *   breaks to build a step expression, returns `null` (caller should use a
 *   continuous ramp).
 * - Otherwise picks the **numeric key** whose bucket list is valid
 *   (`length >= 2`) and is **closest** to `n` (ties → smaller key).
 */
export declare function resolveRasterStepBuckets(stats: RasterBandInfo["stats"], method: RasterStepMethod, n: number): {
    n: number;
    buckets: RasterBucket[];
} | null;
/**
 * Inspects a custom palette and returns a single color if it is valid. Performs
 * extensive validation and normalization of the palette.
 * @param customPalette - LLM-generated custom palette
 */
export declare function getSingleColorFromCustomPalette(customPalette?: null | string | string[] | Record<string, string>): string | null;
export declare function autoStrokeColorForFillColor(fillColor: string): string;
export declare function getDefaultFillColor(): string;
/**
 * Build mapbox-gl-style match expression for a categorical attribute, matching
 * colors in the scale to attribute values.
 * @param attribute
 * @param colorScale
 * @param reverse
 */
export declare function buildMatchExpressionForAttribute(attribute: GeostatsAttribute, colorScale: ColorScaleFn, reverse: boolean): Expression;
//# sourceMappingURL=colorScales.d.ts.map