import gdal from "gdal-async";
import { ChartFeature } from "./landCover.js";

type Geometry = InstanceType<typeof gdal.Geometry>;

/**
 * Tile layers whose areas the chart strokes. Each area is cut at its cell's
 * edge, so stroking the polygon itself draws the cell boundary across the
 * chart wherever a restricted area, fairway or cable area runs off the cell.
 */
export const OUTLINED_LAYERS = new Set([
  "regulated",
  "separation",
  "cable",
  "route",
  "hazard",
  "depth_area",
  "seabed",
  "limit",
  "land_detail",
]);

/** Classes in `depth_area` that are stroked. Depth areas themselves are only filled. */
const OUTLINED_DEPTH_AREAS = new Set(["DRGARE"]);

/** Seabed areas S-52 outlines. A sand or rock area is a letter, not a limit. */
const OUTLINED_SEABED = new Set(["WEDKLP", "SNDWAV", "WATTUR"]);

/** Land detail S-52 outlines. Buildings are filled, not stroked as limits. */
const OUTLINED_LAND_DETAIL = new Set(["PRDARE"]);

/**
 * A traffic lane is not stroked. Its outer edge is the TSSBND line and its
 * inner edge is the separation zone, so the lane's own ring would draw every
 * boundary a second time.
 */
const NOT_OUTLINED = new Set(["TSSLPT"]);

/** Slack for coordinates GDAL writes on the cell edge. About 10 cm. */
const ON_EDGE = 1e-6;

/**
 * Where a stroke would only repeat another line: the cell's coverage boundary,
 * and the shoreline of each land list given. A sanctuary that excludes the
 * islands has their coastline as inner rings, and charts do not draw a
 * magenta limit along the shore. Widened to swallow segments that lie on it.
 */
export function cellEdge(
  coverage: Array<{ geometry?: unknown }>,
  ...lands: Array<Array<{ properties: Record<string, unknown>; geometry?: unknown }>>
): Geometry | null {
  const lines: Geometry[] = [];
  for (const features of lands) {
    for (const feature of features) {
      const type = (feature.geometry as { type?: string } | undefined)?.type;
      if (feature.properties.obj !== "LNDARE" || (type !== "Polygon" && type !== "MultiPolygon")) continue;
      try {
        lines.push(gdal.Geometry.fromGeoJson(feature.geometry as object).boundary());
      } catch {
        continue;
      }
    }
  }
  let covered: Geometry | null = null;
  for (const feature of coverage) {
    if (!feature.geometry) continue;
    let geom: Geometry;
    try {
      geom = gdal.Geometry.fromGeoJson(feature.geometry as object);
    } catch {
      continue;
    }
    if (!geom || geom.isEmpty()) continue;
    if (!geom.isValid()) geom = geom.makeValid();
    covered = covered ? covered.union(geom) : geom;
  }
  if (covered) lines.push(covered.boundary());
  if (lines.length === 0) return null;
  // One buffer of all the lines: a buffer per islet, unioned, is slow on a cell of rocks.
  const all = new gdal.MultiLineString();
  const addLines = (geom: Geometry) => {
    if (geom instanceof gdal.LineString) all.children.add(geom);
    else if (geom instanceof gdal.GeometryCollection) {
      for (let index = 0; index < geom.children.count(); index += 1) addLines(geom.children.get(index));
    }
  };
  for (const line of lines) addLines(line);
  return all.buffer(ON_EDGE, 2);
}

function isOutlined(properties: Record<string, unknown>): boolean {
  const layer = properties.cls;
  if (typeof layer !== "string" || !OUTLINED_LAYERS.has(layer)) return false;
  const objectClass = String(properties.obj);
  if (layer === "depth_area") return OUTLINED_DEPTH_AREAS.has(objectClass);
  if (layer === "seabed") return OUTLINED_SEABED.has(objectClass);
  if (layer === "land_detail") return OUTLINED_LAND_DETAIL.has(objectClass);
  return !NOT_OUTLINED.has(objectClass);
}

/**
 * The stroke of each outlined area, less the parts that lie on the cell edge.
 * The polygons stay in the tiles for labels and handover; the style strokes
 * these lines instead of the polygon rings.
 */
export function outlineFeatures(
  features: ChartFeature[],
  edge: Geometry | null
): ChartFeature[] {
  const outlines: ChartFeature[] = [];
  for (const feature of features) {
    const type = feature.geometry?.type;
    if (type !== "Polygon" && type !== "MultiPolygon") continue;
    if (!isOutlined(feature.properties)) continue;
    let line: Geometry;
    try {
      const polygon = gdal.Geometry.fromGeoJson(feature.geometry as object);
      line = polygon.boundary();
      if (edge) line = line.difference(edge);
    } catch {
      continue;
    }
    if (!line || line.isEmpty()) continue;
    const geometry = line.toObject() as ChartFeature["geometry"];
    if (geometry.type !== "LineString" && geometry.type !== "MultiLineString") {
      if (geometry.type !== "GeometryCollection" || !geometry.geometries)
        continue;
      const parts = geometry.geometries.flatMap((part) => {
        if (part.type === "LineString") return [part.coordinates];
        if (part.type === "MultiLineString" && Array.isArray(part.coordinates))
          return part.coordinates;
        return [];
      });
      if (parts.length === 0) continue;
      outlines.push({
        ...feature,
        geometry: { type: "MultiLineString", coordinates: parts },
      });
      continue;
    }
    outlines.push({ ...feature, geometry });
  }
  return outlines;
}
