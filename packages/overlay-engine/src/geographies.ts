import {
  Feature,
  MultiLineString,
  MultiPolygon,
  Point,
  Polygon,
} from "geojson";
import { FlatGeobufSource } from "fgb-source";
import { PreparedSketch, prepareSketch } from "./utils/prepareSketch";
import {
  Cql2Query,
  consolidateCql2Queries,
  evaluateCql2JSONQuery,
} from "./cql2";
import * as polygonClipping from "polygon-clipping";

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

export type ClippingFn = (
  preparedSketch: PreparedSketch,
  source: string,
  op: ClippingOperation,
  cql2Query?: Cql2Query
) => Promise<PolygonClipResult>;

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
export async function clipToGeography(
  preparedSketch: PreparedSketch,
  clippingLayers: ClippingLayerOption[],
  clippingFn: ClippingFn
): Promise<PreparedSketch["feature"] | null> {
  clippingLayers = consolidateClippingLayers(clippingLayers);
  // ensure there's at least one INTERSECT layer
  const intersectLayers = clippingLayers.filter(
    (layer) => layer.op === "INTERSECT"
  );
  if (intersectLayers.length === 0) {
    throw new Error("At least one INTERSECT layer is required");
  }
  const differenceLayers = clippingLayers.filter(
    (layer) => layer.op === "DIFFERENCE"
  );

  // Kick off the clipping operations in parallel, starting with the INTERSECT
  // layers.
  const intersectResults = Promise.all(
    intersectLayers.map((layer) =>
      clippingFn(preparedSketch, layer.source, "INTERSECT", layer.cql2Query)
    )
  );
  const differenceResults = Promise.all(
    differenceLayers.map((layer) =>
      clippingFn(preparedSketch, layer.source, "DIFFERENCE", layer.cql2Query)
    )
  );

  let results = await intersectResults;
  // if all intersect results are null, the sketch is completely outside
  // the geography
  if (!results.find((r) => r.output !== null)) {
    return null;
  }

  results.push(...(await differenceResults));

  const features: Feature<MultiPolygon>[] = [];
  let anyChanges = false;

  for (const result of results) {
    if (result.changed) {
      anyChanges = true;
      if (result.output !== null) {
        // We've already checked to make sure the sketch is within at least one
        // intersect layer, so we can safely ignore null outputs.
        features.push(result.output);
      }
    }
  }

  if (anyChanges === false) {
    return preparedSketch.feature;
  } else if (features.length === 0) {
    return null;
  } else {
    const intersection = polygonClipping.intersection(
      features[0].geometry.coordinates as polygonClipping.Geom,
      ...features
        .slice(1)
        .map((f) => f.geometry.coordinates as polygonClipping.Geom)
    );
    return {
      ...preparedSketch.feature,
      geometry: {
        ...preparedSketch.feature.geometry,
        coordinates: intersection,
      },
    };
  }
}

/**
 * Consolidates clipping layers that share the same source and operation by
 * combining their CQL2 queries. This optimization reduces the number of
 * clipping operations needed by merging compatible layers.
 *
 * For example, if two layers both intersect with the same source but have
 * different CQL2 filters, they will be combined into a single layer with a
 * merged CQL2 query using an OR operator.
 *
 * @example
 * // These layers:
 * [
 *   { source: "eez", op: "INTERSECT", cql2Query: { op: "=", args: [{ property: "name" }, "US"] } },
 *   { source: "eez", op: "INTERSECT", cql2Query: { op: "=", args: [{ property: "name" }, "Mexico"] } }
 * ]
 * // Will be consolidated to:
 * [
 *   {
 *     source: "eez",
 *     op: "INTERSECT",
 *     cql2Query: {
 *       or: [
 *         { op: "=", args: [{ property: "name" }, "US"] },
 *         { op: "=", args: [{ property: "name" }, "Mexico"] }
 *       ]
 *     }
 *   }
 * ]
 */
function consolidateClippingLayers(
  clippingLayers: ClippingLayerOption[]
): ClippingLayerOption[] {
  let unconsolidated = [...clippingLayers];
  let consolidated: ClippingLayerOption[] = [];

  while (unconsolidated.length > 0) {
    const layer = unconsolidated.shift();
    if (layer) {
      // look through consolidated layers for a match. If there is a match,
      // combine the cql2Query's and remove the layer from unconsolidated.
      // If there is no match, add the layer to consolidated.
      const match = consolidated.find(
        (l) => l.source === layer.source && l.op === layer.op
      );
      if (match) {
        match.cql2Query = consolidateCql2Queries(
          match.cql2Query,
          layer.cql2Query
        );
      } else {
        consolidated.push(layer);
      }
    }
  }
  return consolidated;
}

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
export async function clipSketchToPolygons(
  preparedSketch: PreparedSketch,
  op: ClippingOperation,
  cql2Query: Cql2Query | undefined,
  polygonSource: AsyncIterable<Feature<MultiPolygon | Polygon>>
): Promise<PolygonClipResult> {
  const polygons = [] as polygonClipping.Geom[];
  for (const envelope of preparedSketch.envelopes) {
    for await (const feature of polygonSource) {
      if (cql2Query && !evaluateCql2JSONQuery(cql2Query, feature.properties)) {
        continue;
      }
      polygons.push(feature.geometry.coordinates as any);
    }
  }
  if (polygons.length === 0 && op === "INTERSECT") {
    return { changed: true, output: null, op };
  } else if (polygons.length === 0 && op === "DIFFERENCE") {
    return { changed: false, output: preparedSketch.feature, op };
  }

  let output: typeof preparedSketch.feature.geometry.coordinates;
  if (op === "INTERSECT") {
    output = polygonClipping.intersection(
      preparedSketch.feature.geometry.coordinates as polygonClipping.Geom,
      ...polygons
    );
  } else if (op === "DIFFERENCE") {
    output = polygonClipping.difference(
      preparedSketch.feature.geometry.coordinates as polygonClipping.Geom,
      ...polygons
    );
  } else {
    throw new Error(`Unknown operation: ${op}`);
  }

  if (output.length === 0) {
    return { changed: true, output: null, op };
  }

  return {
    changed:
      JSON.stringify(output) !==
      JSON.stringify(preparedSketch.feature.geometry.coordinates),
    output: {
      ...preparedSketch.feature,
      geometry: { ...preparedSketch.feature.geometry, coordinates: output },
    },
    op,
  };
}
