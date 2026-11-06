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
/** Creek beds are drawn 0–1.8 m. A band reaching deeper is the shelf along the shore. */
const FINGER_DEPTH = 2;
/**
 * A creek bed sits in a notch, so much of its edge is shore. A shoal that only
 * grazes the land, or a strip that runs along it, is water.
 */
const FINGER_SHORE_SHARE = 0.3;

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
  const deepest = feature.properties.DRVAL2;
  if (typeof depth !== "number" || depth < 0 || depth >= FINGER_DEPTH) return false;
  if (typeof deepest !== "number" || deepest > FINGER_DEPTH) return false;
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

/** Slack for a coastline that lies on the edge of the filled water. About 10 cm. */
const ON_EDGE = 1e-6;

function unionOf(geometries: Geometry[]): Geometry | null {
  let united: Geometry | null = null;
  for (const geom of geometries) {
    try {
      const next: Geometry = united ? united.union(geom) : geom;
      united = next.isValid() ? next : next.makeValid();
    } catch {
      // Keep the union built so far. A broken islet should not skip the rest.
    }
  }
  return united;
}

function linesOf(geom: Geometry): GeoJsonGeometry | null {
  const object = geom.toObject() as GeoJsonGeometry;
  if (object.type === "LineString" || object.type === "MultiLineString") return object;
  if (object.type !== "GeometryCollection" || !object.geometries) return null;
  const coordinates: unknown[] = [];
  for (const piece of object.geometries) {
    if (piece.type === "LineString") coordinates.push(piece.coordinates);
    else if (piece.type === "MultiLineString" && Array.isArray(piece.coordinates)) {
      coordinates.push(...piece.coordinates);
    }
  }
  if (coordinates.length === 0) return null;
  return { type: "MultiLineString", coordinates };
}

function lineLength(geom: Geometry): number {
  const lines = linesOf(geom);
  if (!lines || !Array.isArray(lines.coordinates)) return 0;
  const parts = (lines.type === "LineString" ? [lines.coordinates] : lines.coordinates) as number[][][];
  let length = 0;
  for (const part of parts) {
    for (let index = 0; index < part.length - 1; index += 1) {
      length += Math.hypot(part[index + 1][0] - part[index][0], part[index + 1][1] - part[index][1]);
    }
  }
  return length;
}

function polygonParts(geom: Geometry): Geometry[] {
  const object = geom.toObject() as GeoJsonGeometry;
  if (object.type === "Polygon") return [geom];
  const polygons: GeoJsonGeometry[] =
    object.type === "MultiPolygon" && Array.isArray(object.coordinates)
      ? (object.coordinates as unknown[]).map((coordinates) => ({ type: "Polygon", coordinates }))
      : (object.geometries || []).filter((part) => part.type === "Polygon");
  return polygons.map((polygon) => prepared(polygon)).filter((part): part is Geometry => part != null);
}

function isLine(geometry: GeoJsonGeometry | undefined): boolean {
  return geometry?.type === "LineString" || geometry?.type === "MultiLineString";
}

/** Lines that stop at the water's edge, and so end where the filled water begins. */
const SHORE_LINES = new Set(["COALNE", "DEPCNT"]);

/** The land piece, grown by the filled water that touches it. Records which parts it took. */
function joinFilled(piece: ChartFeature, original: Geometry, parts: Geometry[], joined: Set<number>): ChartFeature {
  try {
    const touching = parts.filter((part, index) => {
      if (original.distance(part) > ON_EDGE) return false;
      joined.add(index);
      return true;
    });
    const united = touching.length ? unionOf([original, ...touching]) : original;
    const geometry = united && polygonsOf(united);
    return geometry ? { ...piece, geometry } : piece;
  } catch {
    return piece;
  }
}

/** Coastline across each closed mouth: the edge of the filled water that was not already shore. */
function mouthCoastline(features: ChartFeature[], filled: Geometry, originalLand: Geometry): ChartFeature[] {
  const template = features.find((feature) => feature.properties.obj === "COALNE");
  if (!template) return [];
  try {
    const mouths = filled.boundary().difference(originalLand.boundary().buffer(ON_EDGE * 10, 2));
    if (!mouths || mouths.isEmpty()) return [];
    const geometry = linesOf(mouths);
    if (!geometry) return [];
    const properties = { ...template.properties };
    delete properties.OBJNAM;
    delete properties.CATCOA;
    return [{ ...template, properties, geometry }];
  } catch {
    return [];
  }
}

/**
 * Generalize one cell's shoreline without breaking its topology. Narrow creek
 * notches are closed and small shallow fingers joined onto the land. The water
 * those take is one region: the land gains exactly it, the depth areas lose
 * exactly it, coastline and contours inside it are dropped, and a coastline
 * is drawn across each closed mouth. Depth areas are also cut where they
 * overlap the land.
 */
export function clipDepthCoveredByLand(features: ChartFeature[]): ChartFeature[] {
  const originals = new Map<ChartFeature, Geometry>();
  for (const feature of features) {
    if (feature.properties.obj !== "LNDARE" || !isPolygon(feature.geometry)) continue;
    const geom = prepared(feature.geometry);
    if (geom) originals.set(feature, geom);
  }
  const originalLand = unionOf([...originals.values()]);
  if (!originalLand) return features;

  const gained: Geometry[] = [];
  for (const piece of originals.keys()) {
    if (isHarbour(piece)) continue;
    const closed = prepared(closeSpurs(piece.geometry));
    if (closed) gained.push(closed);
  }
  const fingers = new Set<ChartFeature>();
  let shore: Geometry | null = null;
  for (const feature of features) {
    if (!isShallowFinger(feature)) continue;
    const geom = prepared(feature.geometry);
    if (!geom) continue;
    // A finger that does not touch the shore is a pond. Leave it as water.
    try {
      if (originalLand.distance(geom) > ON_EDGE) continue;
      shore = shore || originalLand.boundary().buffer(ON_EDGE * 10, 2);
      const edge = geom.boundary();
      if (lineLength(edge.intersection(shore)) < FINGER_SHORE_SHARE * lineLength(edge)) continue;
    } catch {
      continue;
    }
    fingers.add(feature);
    gained.push(geom);
  }
  let filled: Geometry | null = null;
  const grown = unionOf(gained);
  if (grown) {
    try {
      const outside = grown.difference(originalLand);
      if (!outside.isEmpty()) filled = outside.isValid() ? outside : outside.makeValid();
    } catch {
      filled = null;
    }
  }
  const land = (filled && unionOf([originalLand, filled])) || originalLand;
  const edge = filled ? filled.buffer(ON_EDGE, 2) : null;
  const filledParts = filled ? polygonParts(filled) : [];

  const kept: ChartFeature[] = [];
  const joined = new Set<number>();
  for (const feature of features) {
    if (fingers.has(feature)) continue;
    const objectClass = feature.properties.obj;
    const original = originals.get(feature);
    if (original) {
      kept.push(joinFilled(feature, original, filledParts, joined));
      continue;
    }
    if (typeof objectClass !== "string") {
      kept.push(feature);
      continue;
    }
    if (COVERED_BY_LAND.has(objectClass) && isPolygon(feature.geometry)) {
      const geom = prepared(feature.geometry);
      if (!geom) continue;
      try {
        const outside = geom.difference(land);
        if (!outside || outside.isEmpty()) continue;
        const geometry = polygonsOf(outside.isValid() ? outside : outside.makeValid());
        if (geometry) kept.push({ ...feature, geometry });
      } catch {
        kept.push(feature);
      }
      continue;
    }
    if (edge && SHORE_LINES.has(objectClass) && isLine(feature.geometry)) {
      const geom = prepared(feature.geometry);
      if (!geom) continue;
      try {
        const outside = geom.difference(edge);
        if (!outside || outside.isEmpty()) continue;
        const geometry = linesOf(outside);
        if (geometry) kept.push({ ...feature, geometry });
      } catch {
        kept.push(feature);
      }
      continue;
    }
    if (filled && objectClass === "SOUNDG" && feature.geometry?.type === "Point") {
      const geom = prepared(feature.geometry);
      if (geom && filled.contains(geom)) continue;
    }
    kept.push(feature);
  }
  // Filled water that meets no land piece (a closed loop whose banks are two
  // pieces' corners) still becomes land, or it would be a hole in the chart.
  const template = originals.keys().next().value as ChartFeature;
  filledParts.forEach((part, index) => {
    if (joined.has(index)) return;
    const geometry = polygonsOf(part);
    if (!geometry) return;
    const properties = { ...template.properties };
    delete properties.OBJNAM;
    kept.push({ ...template, properties, geometry });
  });
  if (filled) kept.push(...mouthCoastline(features, filled, originalLand));
  return kept;
}
