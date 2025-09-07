import { Feature, MultiPolygon, Polygon } from "geojson";
import { PreparedSketch } from "../utils/prepareSketch";
import { Cql2Query } from "../cql2";
import { FragmentResult, GeographySettings, SketchFragment } from "../fragments";
import { SourceCache } from "fgb-source";
import { GuaranteedOverlayWorkerHelpers } from "../utils/helpers";
export type ClippingOperation = "INTERSECT" | "DIFFERENCE";
/**
 * The result of a single clipping operation, as returned by a ClippingSource
 * clip method.
 */
export type PolygonClipResult = {
    /**
     * Whether the sketch was changed by this operation. This is particularly
     * useful to know when running multiple interesect and difference operations,
     * as an unchanged diff output can be ignored.
     */
    changed: boolean;
    /**
     * The operation that was performed.
     */
    op: ClippingOperation;
    /**
     * The output of the clipping operation. This will be null if the sketch is
     * completely outside the clipping geometry for intersect, or completely
     * inside the clipping geometry for difference.
     */
    output: Feature<MultiPolygon> | null;
};
export type ClippingFn = (preparedSketch: PreparedSketch, source: string, op: ClippingOperation, cql2Query?: Cql2Query) => Promise<PolygonClipResult>;
/**
 * Options for configuring a clipping layer operation. A Geography consists of
 * one or more clipping layers, at least one of which must be an INTERSECT
 * operation.
 */
export interface ClippingLayerOption {
    source: string;
    /**
     * The clipping operation to perform:
     * - INTERSECT: Keep only the parts of the sketch that overlap with
     *   features from this layer
     * - DIFFERENCE: Remove the parts of the sketch that overlap with
     *   features from this layer
     */
    op: ClippingOperation;
    /**
     * Optional CQL2 query to filter which features from the source are used
     * for clipping. The query follows OGC CQL2 specification and supports
     * comparison and logical operators. If not provided, all features from
     * the source will be used.
     * @see evaluateCql2JSONQuery for supported query syntax
     */
    cql2Query?: Cql2Query;
    /**
     * Optional hint for the size of the header of the source file. This is used
     * to optimize the query plan by avoiding fetching the entire header.
     */
    headerSizeHint?: number;
}
/**
 * Clips a sketch to a geography defined by one or more clipping layers.
 *
 * This function is designed to be flexible in how it handles the CPU and
 * memory-intensive polygon clipping operations. The actual clipping work is
 * delegated to the provided `clippingFn`, allowing different deployment
 * strategies:
 *
 * 1. If you just want to do clipping in the same process, use an inline
 *    function paired with SourceCache and clipSketchToPolygons() as in the
 *    example below.
 * 2. On node.js, you may want to use worker threads to offload the clipping
 *    work to a separate process.
 * 3. On Cloudflare Workers, you can use a DurableObject to handle the
 *    clipping work and communicate over RPC.
 * 4. In a browser client, it probably makes sense to use a Web Worker to
 *    offload the clipping work to a separate process.
 *
 * If the sketch is completely outside all INTERSECT layers, it returns null.
 * Otherwise, it combines the results of all clipping operations to produce the
 * final geometry.
 *
 * @param preparedSketch - The sketch to clip, wrapped in a PreparedSketch
 *                        object that includes both the feature and its bounding
 *                        envelopes. Use prepareSketch() to create this.
 * @param clippingLayers - Array of clipping layer configurations. Must include
 *                        at least one INTERSECT operation
 * @param clippingFn - Function that performs the actual clipping operation.
 *                    This function is responsible for fetching geometries and
 *                    performing the clipping, allowing for different deployment
 *                    strategies
 * @returns The clipped sketch feature, or null if the sketch is completely
 *          outside the geography
 * @throws Error if no INTERSECT layers are provided
 *
 * @example
 *
 * // Simple example without multi-threading or DurableObjects
 *
 * const sourceCache = new SourceCache("50mb");
 * const preparedSketch = prepareSketch(sketch);
 *
 * const offshoreZoneGeography = [
 *   {
 *     source: "https://uploads.seasketch.org/eez-land-joined.fgb",
 *     op: "INTERSECT",
 *     cql2Query: { op: "=", args: [{ property: "name" }, "US"] }
 *   },
 *   {
 *     source: "https://uploads.seasketch.org/territorial-sea-land-joined.fgb",
 *     op: "DIFFERENCE",
 *   }
 * ];
 *
 * const result = await clipToGeography(
 *   preparedSketch,
 *   offshoreZoneGeography,
 *   async (sketch, source, op, query) => {
 *     const fgbSource = await sourceCache.get(source);
 *     return clipSketchToPolygons(
 *       sketch,
 *       op,
 *       query,
 *       fgbSource.getFeaturesAsync(sketch.envelopes)
 *     );
 *   }
 * );
 */
export declare function clipToGeography(preparedSketch: PreparedSketch, clippingLayers: ClippingLayerOption[], clippingFn: ClippingFn): Promise<PreparedSketch["feature"] | null>;
/**
 * Performs a single clipping operation between a sketch and a set of polygons.
 *
 * This is a lower-level function that is typically used by the clippingFn
 * passed to clipToGeography(). It handles the actual polygon clipping operation
 * using the polygon-clipping library, which is CPU and memory intensive.
 *
 * The function first collects all polygons from the provided source that
 * intersect with the sketch's envelopes and match the optional CQL2 query. It
 * then performs either an INTERSECT or DIFFERENCE operation between the sketch
 * and the collected polygons.
 *
 * For INTERSECT operations:
 * - If no polygons are found, returns { changed: true, output: null }
 * - If the sketch is completely within the polygons, returns { changed: false, output: sketch }
 * - If polygons are found, returns the intersection of the sketch with all
 *   polygons
 *
 * For DIFFERENCE operations:
 * - If no polygons intersect, returns { changed: false, output: sketch }
 * - If the sketch is completely outside the layer, returns { changed: true, output: null }
 * - If polygons are found, returns the difference of the sketch minus all
 *   polygons
 *
 * @param preparedSketch - The sketch to clip, wrapped in a PreparedSketch
 * object
 * @param op - The clipping operation to perform: "INTERSECT" or "DIFFERENCE"
 * @param cql2Query - Optional CQL2 query to filter which polygons are used for
 * clipping
 * @param polygonSource - Async iterable that yields polygon features. Typically
 *                       this would be the result of
 *                       fgbSource.getFeaturesAsync()
 * @returns A PolygonClipResult object containing: - changed: whether the sketch
 *          was modified by the operation - output: the resulting geometry, or
 *          null if the operation eliminated the sketch entirely - op: the
 *          operation that was performed
 *
 * @example
 * // Using with fgb-source
 * const source = await createSource("https://example.com/polygons.fgb");
 * const result = await clipSketchToPolygons(
 *   preparedSketch,
 *   "INTERSECT",
 *   { op: "=", args: [{ property: "type" }, "marine"] },
 *   source.getFeaturesAsync(preparedSketch.envelopes)
 * );
 */
export declare function clipSketchToPolygons(preparedSketch: PreparedSketch, op: ClippingOperation, cql2Query: Cql2Query | undefined, polygonSource: AsyncIterable<Feature<MultiPolygon | Polygon>>): Promise<PolygonClipResult>;
/**
 * Clips a prepared sketch to a set of geographies, and returns the clipped
 * sketch and the fragments that were generated.
 *
 * @param preparedSketch - The sketch to clip, wrapped in a PreparedSketch
 * object that includes both the feature and its bounding envelopes. Use
 * prepareSketch() to create this.
 * @param geographies - All the geographies that will be used for clipping and
 * fragment generation.
 * @param geographiesForClipping - The IDs of the geographies that will be
 * used for clipping. Throws an error if no geographies are specified. If more
 * that one geography is specified, the geography with the most overlap will be
 * the one clipped to.
 * @param existingSketchFragments - Any sketch fragments from sketches in the
 * same collection. For performance reasons, it's best to pass only the
 * fragments which overlap the sketch of interest, using psql's spatial index.
 * @param existingSketchId - The ID of the sketch, if it already exists. This
 * will be compared with existingSketchFragments, to filter out old fragments
 * and consolidate existing fragmentation with it's neighbors.
 * @param clippingFn - The function to use for clipping.
 * @returns
 */
export declare function clipToGeographies(preparedSketch: PreparedSketch, geographies: GeographySettings[], geographiesForClipping: number[], existingSketchFragments: SketchFragment[], existingSketchId: number | null, clippingFn: ClippingFn): Promise<{
    clipped: PreparedSketch["feature"] | null;
    fragments: FragmentResult[];
}>;
export { calculateGeographyOverlap } from "./calculateOverlap";
/**
 * Initializes sources in a sourceCache for all clipping layers in a given
 * geography, and calculates the intersection feature.
 *
 * @param geography - The geography to initialize sources for
 * @param sourceCache - The source cache to use
 */
export declare function initializeGeographySources(geography: ClippingLayerOption[], sourceCache: SourceCache, helpers: GuaranteedOverlayWorkerHelpers): Promise<{
    intersectionFeature: Feature<MultiPolygon, import("geojson").GeoJsonProperties>;
    intersectionLayers: ClippingLayerOption[];
    differenceLayers: ClippingLayerOption[];
}>;
//# sourceMappingURL=geographies.d.ts.map