import gdal from "gdal-async";

/**
 * NOAA draws a creek as a very shallow depth area tucked into the shoreline.
 * The area is outside the land polygon, so the land fill never covers it, and
 * it draws as a bright blue wedge. Narrow bites in the shoreline are closed,
 * and a small shallow finger is joined onto the land. A lake that is a hole
 * in the land is not a finger, so it stays water.
 */

type Geometry = InstanceType<typeof gdal.Geometry>;

type GeoJsonGeometry = {
  type?: string;
  coordinates?: unknown;
  geometries?: GeoJsonGeometry[];
};

export type ChartFeature = {
  type: string;
  properties: Record<string, unknown>;
  geometry: GeoJsonGeometry;
};

const COVERED_BY_LAND = new Set(["DEPARE", "DRGARE", "UNSARE"]);

/** A creek mouth narrower than this is closed. About 200 m. */
const MOUTH = 0.0022;
const MIN_TRAVEL = 0.003;
const MAX_TRAVEL = 0.08;
/** The loop between the two banks has to be a channel, not a headland. */
const MAX_MEAN_WIDTH = 0.0018;

/** A shallow finger smaller than this is a creek, not the coastal shelf. About 0.3 km². */
const FINGER_AREA = 0.00003;
const FINGER_WIDTH = 0.002;

function signedArea(ring: number[][]): number {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    area += ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
  }
  return area / 2;
}

function ringArea(ring: number[][]): number {
  return Math.abs(signedArea(ring));
}

function meanWidth(ring: number[][]): number {
  let perimeter = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    perimeter += Math.hypot(ring[index + 1][0] - ring[index][0], ring[index + 1][1] - ring[index][1]);
  }
  if (perimeter === 0) return Infinity;
  return (2 * ringArea(ring)) / perimeter;
}

type Spur = { index: number; end: number; travel: number };

/** The longest out-and-back along a ring that is still a narrow channel. */
function longestSpur(ring: number[][]): Spur | null {
  const count = ring.length - 1;
  if (count < 6) return null;
  const parentArea = signedArea(ring);
  if (parentArea === 0) return null;
  const travelAt = [0];
  for (let index = 0; index < count; index += 1) {
    travelAt.push(
      travelAt[index] + Math.hypot(ring[index + 1][0] - ring[index][0], ring[index + 1][1] - ring[index][1])
    );
  }
  const buckets = new Map<string, number[]>();
  const key = (point: number[]) => `${Math.floor(point[0] / MOUTH)},${Math.floor(point[1] / MOUTH)}`;
  for (let index = 0; index < count; index += 1) {
    const bucket = key(ring[index]);
    const list = buckets.get(bucket);
    if (list) list.push(index);
    else buckets.set(bucket, [index]);
  }
  let best: Spur | null = null;
  for (let end = 0; end < count; end += 1) {
    const point = ring[end];
    const cellX = Math.floor(point[0] / MOUTH);
    const cellY = Math.floor(point[1] / MOUTH);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const list = buckets.get(`${cellX + dx},${cellY + dy}`);
        if (!list) continue;
        for (const index of list) {
          if (end - index < 3) continue;
          const travel = travelAt[end] - travelAt[index];
          if (travel < MIN_TRAVEL || travel > MAX_TRAVEL) continue;
          const gap = Math.hypot(ring[end][0] - ring[index][0], ring[end][1] - ring[index][1]);
          if (gap > MOUTH) continue;
          const loop = ring.slice(index, end + 1);
          loop.push(ring[index]);
          // A creek is a bite out of the land. A spit has the same winding as the shore.
          const loopArea = signedArea(loop);
          if (loopArea === 0 || Math.sign(loopArea) === Math.sign(parentArea)) continue;
          if (meanWidth(loop) > MAX_MEAN_WIDTH) continue;
          if (!best || travel > best.travel) best = { index, end, travel };
        }
      }
    }
  }
  return best;
}

function closeSpursOnRing(ring: number[][]): number[][] {
  let current = ring.map((point) => [point[0], point[1]]);
  if (current.length > 1) {
    const first = current[0];
    const last = current[current.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) current.push([first[0], first[1]]);
  }
  for (let pass = 0; pass < 40; pass += 1) {
    const spur = longestSpur(current);
    if (!spur) break;
    current = current.slice(0, spur.index + 1).concat(current.slice(spur.end));
    if (current.length < 4) break;
  }
  return current;
}

function closeSpurs(geometry: GeoJsonGeometry): GeoJsonGeometry {
  if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
    const rings = geometry.coordinates as number[][][];
    return { type: "Polygon", coordinates: rings.map((ring) => closeSpursOnRing(ring)) };
  }
  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    const polygons = geometry.coordinates as number[][][][];
    return {
      type: "MultiPolygon",
      coordinates: polygons.map((polygon) => polygon.map((ring) => closeSpursOnRing(ring))),
    };
  }
  return geometry;
}

function isPolygon(geometry: GeoJsonGeometry | undefined): boolean {
  return geometry?.type === "Polygon" || geometry?.type === "MultiPolygon";
}

function prepared(geometry: GeoJsonGeometry): Geometry | null {
  try {
    const geom = gdal.Geometry.fromGeoJson(geometry);
    if (!geom || geom.isEmpty()) return null;
    return geom.isValid() ? geom : geom.makeValid();
  } catch {
    return null;
  }
}

function polygonsOf(geom: Geometry): GeoJsonGeometry | null {
  const object = geom.toObject() as GeoJsonGeometry;
  if (object.type === "Polygon" || object.type === "MultiPolygon") return object;
  if (object.type !== "GeometryCollection" || !object.geometries) return null;
  const coordinates: unknown[] = [];
  for (const piece of object.geometries) {
    if (piece.type === "Polygon") coordinates.push(piece.coordinates);
    else if (piece.type === "MultiPolygon" && Array.isArray(piece.coordinates)) {
      coordinates.push(...piece.coordinates);
    }
  }
  if (coordinates.length === 0) return null;
  if (coordinates.length === 1) return { type: "Polygon", coordinates: coordinates[0] };
  return { type: "MultiPolygon", coordinates };
}

function polygonMetrics(geometry: GeoJsonGeometry): { area: number; meanW: number; long: number; short: number } | null {
  if (geometry.type !== "Polygon" || !Array.isArray(geometry.coordinates)) return null;
  const ring = (geometry.coordinates as number[][][])[0];
  if (!ring || ring.length < 4) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let perimeter = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const point = ring[index];
    const next = ring[index + 1];
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
    perimeter += Math.hypot(next[0] - point[0], next[1] - point[1]);
  }
  const area = ringArea(ring);
  const width = maxX - minX;
  const height = maxY - minY;
  return {
    area,
    meanW: perimeter === 0 ? Infinity : (2 * area) / perimeter,
    long: Math.max(width, height),
    short: Math.min(width, height),
  };
}

/** Harbour charts keep slips and basins. The wedges show up on the approach charts. */
function isHarbour(feature: ChartFeature): boolean {
  const band = feature.properties.band;
  return typeof band === "number" && band >= 5;
}

/**
 * A bright wedge on the approach charts: very shallow, small, and long.
 * Harbour cells keep these, because at that scale they are slips and basins.
 */
function isShallowFinger(feature: ChartFeature): boolean {
  if (feature.properties.obj !== "DEPARE") return false;
  if (isHarbour(feature)) return false;
  const depth = feature.properties.DRVAL1;
  if (typeof depth !== "number" || depth < 0 || depth >= 2) return false;
  const metrics = polygonMetrics(feature.geometry);
  if (!metrics) return false;
  return (
    metrics.area > 1e-9 &&
    metrics.area < FINGER_AREA &&
    metrics.meanW < FINGER_WIDTH &&
    metrics.long > 0.003 &&
    metrics.long > metrics.short * 2
  );
}

function landMask(features: ChartFeature[]): Geometry | null {
  let mask: Geometry | null = null;
  for (const feature of features) {
    if (feature.properties.obj !== "LNDARE" || !isPolygon(feature.geometry)) continue;
    const geom = prepared(feature.geometry);
    if (!geom) continue;
    if (!mask) {
      mask = geom;
      continue;
    }
    try {
      const united = mask.union(geom);
      mask = united.isValid() ? united : united.makeValid();
    } catch {
      // Keep the mask built so far. A broken islet should not skip the clip.
    }
  }
  return mask;
}

function absorbFinger(land: ChartFeature[], finger: ChartFeature): boolean {
  const geom = prepared(finger.geometry);
  if (!geom) return false;
  let nearest: ChartFeature | null = null;
  let nearestGeom: Geometry | null = null;
  let nearestDistance = Infinity;
  for (const piece of land) {
    const pieceGeom = prepared(piece.geometry);
    if (!pieceGeom) continue;
    let distance = Infinity;
    try {
      distance = pieceGeom.distance(geom);
    } catch {
      continue;
    }
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = piece;
      nearestGeom = pieceGeom;
    }
  }
  // A finger that does not touch the shore is a pond. Leave it as water.
  if (!nearest || !nearestGeom || nearestDistance > 0.002) return false;
  try {
    const united = nearestGeom.union(geom);
    const geometry = polygonsOf(united.isValid() ? united : united.makeValid());
    if (!geometry) return false;
    nearest.geometry = geometry;
    return true;
  } catch {
    return false;
  }
}

/**
 * Drop the parts of depth areas that sit inside the same cell's land.
 * Narrow creek notches in the shoreline are closed first, and a small
 * shallow finger that still sticks inland is joined onto the land.
 */
export function clipDepthCoveredByLand(features: ChartFeature[]): ChartFeature[] {
  const covered = features.map((feature) => {
    if (feature.properties.obj !== "LNDARE" || !isPolygon(feature.geometry) || isHarbour(feature)) return feature;
    return { ...feature, geometry: closeSpurs(feature.geometry) };
  });
  const land = covered.filter((feature) => feature.properties.obj === "LNDARE" && isPolygon(feature.geometry));
  const pending: ChartFeature[] = [];
  for (const feature of covered) {
    if (feature.properties.obj === "LNDARE" && isPolygon(feature.geometry)) continue;
    if (isShallowFinger(feature) && absorbFinger(land, feature)) continue;
    pending.push(feature);
  }
  const mask = landMask(land);
  if (!mask) return features;
  const kept: ChartFeature[] = [...land];
  for (const feature of pending) {
    const objectClass = feature.properties.obj;
    if (typeof objectClass !== "string" || !COVERED_BY_LAND.has(objectClass) || !isPolygon(feature.geometry)) {
      kept.push(feature);
      continue;
    }
    const geom = prepared(feature.geometry);
    if (!geom) continue;
    try {
      const outside = geom.difference(mask);
      if (!outside || outside.isEmpty()) continue;
      const geometry = polygonsOf(outside.isValid() ? outside : outside.makeValid());
      if (!geometry) continue;
      kept.push({ ...feature, geometry });
    } catch {
      kept.push(feature);
    }
  }
  return kept;
}
