import gdal from "gdal-async";
import { ChartFeature } from "./landCover.js";

/**
 * A traffic lane (TSSLPT) is one-way water. Charts leave it unfilled and draw
 * an open arrow along it, turned by ORIENT (degrees clockwise from north).
 * One arrow per lane would sit in the middle of a lane that runs for miles,
 * so each zoom range gets its own spacing: far apart when the whole scheme is
 * on screen, closer when it is zoomed in.
 */

type Geometry = InstanceType<typeof gdal.Geometry>;

type ArrowRing = { spacing: number; minzoom: number; maxzoom: number };

const RINGS: ArrowRing[] = [
  { spacing: 0.22, minzoom: 8, maxzoom: 10 },
  { spacing: 0.08, minzoom: 11, maxzoom: 16 },
];

/** A scan that crosses less lane than this is a corner, not a place for an arrow. About 0.5 km. */
const MIN_WIDTH = 0.006;

function direction(orient: number): { dx: number; dy: number; px: number; py: number } {
  const rad = (orient * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = Math.cos(rad);
  return { dx, dy, px: -dy, py: dx };
}

function lineParts(geom: Geometry): Array<InstanceType<typeof gdal.LineString>> {
  const parts: Array<InstanceType<typeof gdal.LineString>> = [];
  const visit = (part: Geometry) => {
    if (part instanceof gdal.LineString) parts.push(part);
    else if (part instanceof gdal.GeometryCollection) {
      for (let index = 0; index < part.children.count(); index += 1) visit(part.children.get(index));
    }
  };
  visit(geom);
  return parts;
}

/** Stations along the lane. A lane shorter than the spacing gets its middle. */
function stations(minAlong: number, maxAlong: number, spacing: number): number[] {
  const span = maxAlong - minAlong;
  if (span <= 0) return [];
  if (span < spacing) return [(minAlong + maxAlong) / 2];
  const placed: number[] = [];
  for (let along = minAlong + spacing / 2; along <= maxAlong - spacing / 4; along += spacing) {
    placed.push(along);
  }
  return placed.length ? placed : [(minAlong + maxAlong) / 2];
}

function arrowsIn(
  feature: ChartFeature,
  ring: ArrowRing
): ChartFeature[] {
  const orient = feature.properties.ORIENT;
  if (typeof orient !== "number" || !Number.isFinite(orient)) return [];
  const type = feature.geometry?.type;
  if (type !== "Polygon" && type !== "MultiPolygon") return [];
  let geom: Geometry;
  try {
    geom = gdal.Geometry.fromGeoJson(feature.geometry as object);
    if (!geom.isValid()) geom = geom.makeValid();
  } catch {
    return [];
  }
  if (!geom || geom.isEmpty()) return [];
  const { dx, dy, px, py } = direction(orient);
  const envelope = geom.getEnvelope();
  const corners = [
    [envelope.minX, envelope.minY],
    [envelope.minX, envelope.maxY],
    [envelope.maxX, envelope.minY],
    [envelope.maxX, envelope.maxY],
  ];
  let minAlong = Infinity;
  let maxAlong = -Infinity;
  let minCross = Infinity;
  let maxCross = -Infinity;
  for (const [x, y] of corners) {
    minAlong = Math.min(minAlong, x * dx + y * dy);
    maxAlong = Math.max(maxAlong, x * dx + y * dy);
    minCross = Math.min(minCross, x * px + y * py);
    maxCross = Math.max(maxCross, x * px + y * py);
  }
  const tip = (feature as { tippecanoe?: { layer?: string; minzoom?: number; maxzoom?: number } }).tippecanoe;
  const minzoom = Math.max(ring.minzoom, tip?.minzoom ?? ring.minzoom);
  const maxzoom = Math.min(ring.maxzoom, tip?.maxzoom ?? ring.maxzoom);
  if (minzoom > maxzoom) return [];

  const arrows: ChartFeature[] = [];
  for (const along of stations(minAlong, maxAlong, ring.spacing)) {
    const scan = new gdal.LineString();
    scan.points.add(new gdal.Point(along * dx + minCross * px, along * dy + minCross * py));
    scan.points.add(new gdal.Point(along * dx + maxCross * px, along * dy + maxCross * py));
    let hit: Geometry;
    try {
      hit = geom.intersection(scan);
    } catch {
      continue;
    }
    if (!hit || hit.isEmpty()) continue;
    for (const part of lineParts(hit)) {
      if (part.getLength() < MIN_WIDTH) continue;
      const middle = part.centroid();
      if (geom.distance(middle) > 1e-8) continue;
      arrows.push({
        ...feature,
        properties: { ...feature.properties, flow: 1 },
        geometry: { type: "Point", coordinates: [middle.x, middle.y] },
        // Keep the lane's source-layer. Without it tippecanoe names the layer after the file.
        tippecanoe: { layer: tip?.layer ?? "separation", minzoom, maxzoom },
      } as ChartFeature);
    }
  }
  return arrows;
}

/** Open-arrow points for each traffic lane. The lane polygon itself is unchanged. */
export function trafficArrows(features: ChartFeature[]): ChartFeature[] {
  const arrows: ChartFeature[] = [];
  for (const feature of features) {
    if (feature.properties?.obj !== "TSSLPT") continue;
    for (const ring of RINGS) arrows.push(...arrowsIn(feature, ring));
  }
  return arrows;
}

/**
 * A recommended track is a complex line of arrows (S-52 LC(RECTRC)), not a
 * plain dash. Arrows follow the line. When ORIENT disagrees with the way the
 * line was digitized, they are turned to match ORIENT.
 */
const TRACK_RINGS: ArrowRing[] = [
  { spacing: 0.12, minzoom: 11, maxzoom: 13 },
  { spacing: 0.04, minzoom: 14, maxzoom: 16 },
];

function linePaths(geometry: ChartFeature["geometry"]): number[][][] {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  if (geometry.type === "LineString") return [geometry.coordinates as number[][]];
  if (geometry.type === "MultiLineString") return geometry.coordinates as number[][][];
  return [];
}

function segmentBearing(x0: number, y0: number, x1: number, y1: number): number {
  return (Math.atan2(x1 - x0, y1 - y0) * 180) / Math.PI;
}

/** True when the two bearings are more than a right angle apart. */
function turnedAway(bearing: number, orient: number): boolean {
  const delta = Math.abs((((bearing - orient) % 360) + 540) % 360 - 180);
  return delta > 90;
}

function arrowsAlong(
  feature: ChartFeature,
  path: number[][],
  ring: ArrowRing,
  flip: boolean
): ChartFeature[] {
  const tip = (feature as { tippecanoe?: { layer?: string; minzoom?: number; maxzoom?: number } }).tippecanoe;
  const minzoom = Math.max(ring.minzoom, tip?.minzoom ?? ring.minzoom);
  const maxzoom = Math.min(ring.maxzoom, tip?.maxzoom ?? ring.maxzoom);
  if (minzoom > maxzoom) return [];
  const spans: Array<{ x0: number; y0: number; x1: number; y1: number; length: number }> = [];
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    const [x0, y0] = path[index - 1];
    const [x1, y1] = path[index];
    if (![x0, y0, x1, y1].every((value) => typeof value === "number" && Number.isFinite(value))) continue;
    const length = Math.hypot(x1 - x0, y1 - y0);
    if (length <= 0) continue;
    spans.push({ x0, y0, x1, y1, length });
    total += length;
  }
  if (spans.length === 0 || total <= 0) return [];
  const at = total < ring.spacing ? [total / 2] : stations(0, total, ring.spacing);
  const arrows: ChartFeature[] = [];
  for (const distance of at) {
    let walked = 0;
    for (const span of spans) {
      if (walked + span.length < distance) {
        walked += span.length;
        continue;
      }
      const t = (distance - walked) / span.length;
      let orient = segmentBearing(span.x0, span.y0, span.x1, span.y1);
      if (flip) orient += 180;
      arrows.push({
        ...feature,
        properties: { ...feature.properties, flow: 1, ORIENT: (orient + 360) % 360 },
        geometry: {
          type: "Point",
          coordinates: [span.x0 + (span.x1 - span.x0) * t, span.y0 + (span.y1 - span.y0) * t],
        },
        tippecanoe: { layer: tip?.layer ?? "route", minzoom, maxzoom },
      } as ChartFeature);
      break;
    }
  }
  return arrows;
}

/** Arrow points along each recommended track. The line itself is unchanged. */
export function trackArrows(features: ChartFeature[]): ChartFeature[] {
  const arrows: ChartFeature[] = [];
  for (const feature of features) {
    if (!feature || feature.properties?.obj !== "RECTRC") continue;
    const orient = feature.properties.ORIENT;
    for (const path of linePaths(feature.geometry)) {
      if (path.length < 2) continue;
      const [x0, y0] = path[0];
      const [x1, y1] = path[path.length - 1];
      const flip =
        typeof orient === "number" &&
        Number.isFinite(orient) &&
        typeof x0 === "number" &&
        typeof y0 === "number" &&
        typeof x1 === "number" &&
        typeof y1 === "number" &&
        turnedAway(segmentBearing(x0, y0, x1, y1), orient);
      for (const ring of TRACK_RINGS) arrows.push(...arrowsAlong(feature, path, ring, flip));
    }
  }
  return arrows;
}
