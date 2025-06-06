import { Feature, MultiLineString, MultiPolygon, Point } from "geojson";
import { FlatGeobufSource } from "fgb-source";

export type Cql2Query = {
  op: string;
  args: (string | number | boolean | { property: string })[];
};

export interface ClipToGeographyOptions {
  createFragments?: boolean;
}

/**
 * Options for configuring a clipping layer operation. A Geography consists of
 * one or more clipping layers, at least one of which must be an INTERSECT
 * operation.
 */
export interface ClippingLayerOption {
  /**
   * The FlatGeobuf data source containing the clipping geometries
   */
  source: FlatGeobufSource;

  /**
   * The clipping operation to perform:
   * - INTERSECT: Keep only the parts of the sketch that overlap with
   *   features from this layer
   * - DIFFERENCE: Remove the parts of the sketch that overlap with
   *   features from this layer
   */
  op: "INTERSECT" | "DIFFERENCE";

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
 * Clips a sketch to a geography, returning the clipped sketch and any
 * fragments that were created during the clipping process. The sketch is
 * clipped against each layer in the geography in sequence, with INTERSECT
 * operations keeping overlapping areas and DIFFERENCE operations removing
 * overlapping areas.
 *
 * @param sketch The sketch to clip
 * @param clippingLayers The layers to clip against, in order of application
 * @param options Additional options for the clipping operation
 * @returns The clipped sketch and any fragments, or null if the sketch is
 *          completely outside the geography
 */
export async function clipToGeography<
  T extends Feature<MultiPolygon> | Feature<MultiLineString> | Feature<Point>
>(
  sketch: T,
  clippingLayers: ClippingLayerOption[],
  options: ClipToGeographyOptions
): Promise<{
  sketch: T;
  fragments: T[];
} | null> {
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

  return null;
}
