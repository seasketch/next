import { Feature, MultiLineString, MultiPolygon, Point } from "geojson";
import { FlatGeobufSource } from "fgb-source";

export interface ClipToGeographyOptions {
  createFragments?: boolean;
}

export interface ClippingLayerOption {
  source: FlatGeobufSource;
  op: "INTERSECT" | "DIFFERENCE";
  cql2Query?: any;
}

export interface GeographyOption {
  clippingLayers: ClippingLayerOption[];
}

/**
 * Clips the given sketch to a geography. If there is no overlap, returns null.
 *
 * @param sketch
 * @param geography
 * @param options
 * @returns
 */
export async function clipToGeography<
  T extends Feature<MultiPolygon | MultiLineString | Point>
>(
  sketch: T,
  geography: GeographyOption,
  options: ClipToGeographyOptions
): Promise<{
  sketch: T;
  fragments: T[];
} | null> {
  return null;
}
