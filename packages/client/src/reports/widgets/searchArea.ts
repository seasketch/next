import {
  Feature,
  FeatureCollection,
  Geometry,
  GeometryCollection,
  Polygon,
} from "geojson";
import { shiftLongitudesToShortArc } from "./distancePathBounds";

const EARTH_RADIUS_KM = 6371.0088;
const STEPS_PER_QUARTER = 8;

type Position = [number, number];

/**
 * Search-limit outline: simplify the sketch, then buffer that shape by
 * `radiusKm`. Returns null when the geometry or radius cannot be drawn.
 */
export function searchArea(
  value: unknown,
  radiusKm: number
): FeatureCollection<Polygon> | null {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) return null;
  const features = cloneFeatures(value);
  if (features.length === 0) return null;
  shiftFeaturesToShortArc(features);
  const tolerance = simplifyTolerance(features, radiusKm);
  const buffered: Feature<Polygon>[] = [];
  for (const feature of features) {
    const geometry = feature.geometry;
    if (!geometry || typeof geometry !== "object" || !("type" in geometry)) {
      continue;
    }
    if (geometry.type === "Polygon") {
      pushBufferedPolygon(buffered, geometry.coordinates, radiusKm, tolerance);
    } else if (geometry.type === "MultiPolygon") {
      for (const coordinates of geometry.coordinates) {
        pushBufferedPolygon(buffered, coordinates, radiusKm, tolerance);
      }
    } else if (geometry.type === "LineString") {
      pushRing(
        buffered,
        bufferPolyline(simplifyLine(geometry.coordinates, tolerance), radiusKm)
      );
    } else if (geometry.type === "MultiLineString") {
      for (const line of geometry.coordinates) {
        pushRing(buffered, bufferPolyline(simplifyLine(line, tolerance), radiusKm));
      }
    } else if (geometry.type === "Point") {
      const center = asPosition(geometry.coordinates);
      if (center) pushRing(buffered, circle(center, radiusKm));
    } else if (geometry.type === "MultiPoint") {
      for (const point of geometry.coordinates) {
        const center = asPosition(point);
        if (center) pushRing(buffered, circle(center, radiusKm));
      }
    }
  }
  if (buffered.length === 0) return null;
  return { type: "FeatureCollection", features: buffered };
}

/** How many corners a ring keeps before buffering. Useful to test simplification. */
export function simplifiedRingLength(
  ring: Position[],
  radiusKm: number,
  spanDegrees: number
): number {
  const tolerance = Math.min(spanDegrees / 8, radiusKm / 111 / 12);
  const simplified = simplifyClosedRing(ring, tolerance);
  const unique = simplified.length > 1 ? simplified.length - 1 : simplified.length;
  return unique;
}

function pushBufferedPolygon(
  out: Feature<Polygon>[],
  coordinates: Polygon["coordinates"],
  radiusKm: number,
  tolerance: number
) {
  const outer = coordinates[0];
  if (!outer) return;
  pushRing(
    out,
    bufferRing(simplifyClosedRing(uniqueLine(outer), tolerance), radiusKm)
  );
}

function pushRing(out: Feature<Polygon>[], ring: Position[] | null) {
  if (!ring || ring.length < 4) return;
  out.push({
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  });
}

function simplifyTolerance(
  features: Feature[],
  radiusKm: number
): number {
  const positions: Position[] = [];
  for (const feature of features) {
    visitPositions(feature.geometry, (position) => {
      positions.push([position[0], position[1]]);
    });
  }
  if (positions.length === 0) return 0;
  let west = positions[0][0];
  let east = west;
  let south = positions[0][1];
  let north = south;
  for (const [lng, lat] of positions) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  const span = Math.max(east - west, north - south);
  return Math.min(span / 8, radiusKm / 111 / 12);
}

function simplifyClosedRing(ring: Position[], tolerance: number): Position[] {
  const open = uniqueOpenRing(ring);
  if (open.length < 3 || tolerance <= 0) return closeRing(open);
  const kept = douglasPeucker(open, tolerance);
  if (kept.length < 3) return closeRing(open);
  return closeRing(kept);
}

function simplifyLine(line: readonly unknown[], tolerance: number): Position[] {
  const open = uniqueLine(line);
  if (open.length < 3 || tolerance <= 0) return open;
  const kept = douglasPeucker(open, tolerance);
  return kept.length >= 2 ? kept : open;
}

function uniqueOpenRing(ring: Position[]): Position[] {
  const open =
    ring.length > 1 && samePosition(ring[0], ring[ring.length - 1])
      ? ring.slice(0, -1)
      : ring.slice();
  return uniqueLine(open);
}

function uniqueLine(line: readonly unknown[]): Position[] {
  const out: Position[] = [];
  for (const position of line) {
    const point = asPosition(position);
    if (!point) continue;
    const previous = out[out.length - 1];
    if (previous && samePosition(previous, point)) continue;
    out.push(point);
  }
  return out;
}

function closeRing(open: Position[]): Position[] {
  if (open.length === 0) return open;
  const closed = open.slice();
  const first = closed[0];
  const last = closed[closed.length - 1];
  if (!samePosition(first, last)) closed.push([first[0], first[1]]);
  return closed;
}

function samePosition(a: Position, b: Position): boolean {
  return Math.abs(a[0] - b[0]) < 1e-12 && Math.abs(a[1] - b[1]) < 1e-12;
}

function douglasPeucker(points: Position[], tolerance: number): Position[] {
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  mark(0, points.length - 1);
  const kept: Position[] = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) kept.push(points[i]);
  }
  return kept;

  function mark(start: number, end: number) {
    let max = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const distance = perpendicularDegrees(points[i], points[start], points[end]);
      if (distance > max) {
        max = distance;
        index = i;
      }
    }
    if (index !== -1 && max > tolerance) {
      keep[index] = true;
      mark(start, index);
      mark(index, end);
    }
  }
}

function perpendicularDegrees(point: Position, start: Position, end: Position): number {
  const cos = Math.cos((((start[1] + end[1]) / 2) * Math.PI) / 180);
  const ax = start[0] * cos;
  const ay = start[1];
  const bx = end[0] * cos;
  const by = end[1];
  const px = point[0] * cos;
  const py = point[1];
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(px - ax, py - ay);
  return Math.abs((px - ax) * dy - (py - ay) * dx) / length;
}

function bufferRing(ring: Position[], radiusKm: number): Position[] | null {
  const open = uniqueOpenRing(ring);
  if (open.length === 0) return null;
  if (open.length === 1) return circle(open[0], radiusKm);
  if (open.length === 2) return bufferPolyline(open, radiusKm);
  const oriented = signedArea(open) < 0 ? open.slice().reverse() : open;
  const result: Position[] = [];
  const count = oriented.length;
  for (let i = 0; i < count; i++) {
    const previous = oriented[(i - 1 + count) % count];
    const current = oriented[i];
    const next = oriented[(i + 1) % count];
    const incoming = bearing(previous, current);
    const outgoing = bearing(current, next);
    const start = normalizeAngle(incoming + 90);
    const end = normalizeAngle(outgoing + 90);
    const leftTurn = normalizeAngle(outgoing - incoming);
    if (leftTurn > 180) {
      appendArc(result, current, start, end, radiusKm, true);
    } else {
      const miter = offsetIntersection(
        previous,
        current,
        next,
        start,
        end,
        radiusKm
      );
      if (miter) result.push(miter);
      else {
        result.push(destination(current, radiusKm, start));
        result.push(destination(current, radiusKm, end));
      }
    }
  }
  return closeRing(result);
}

function bufferPolyline(points: Position[], radiusKm: number): Position[] | null {
  if (points.length === 0) return null;
  if (points.length === 1) return circle(points[0], radiusKm);
  const left: Position[] = [];
  const right: Position[] = [];
  for (let i = 0; i < points.length; i++) {
    const incoming =
      i === 0 ? bearing(points[0], points[1]) : bearing(points[i - 1], points[i]);
    const outgoing =
      i === points.length - 1
        ? incoming
        : bearing(points[i], points[i + 1]);
    const leftStart = normalizeAngle(incoming - 90);
    const leftEnd = normalizeAngle(outgoing - 90);
    const rightStart = normalizeAngle(incoming + 90);
    const rightEnd = normalizeAngle(outgoing + 90);
    if (i === 0) {
      left.push(destination(points[i], radiusKm, leftEnd));
      right.push(destination(points[i], radiusKm, rightEnd));
    } else if (i === points.length - 1) {
      left.push(destination(points[i], radiusKm, leftStart));
      right.push(destination(points[i], radiusKm, rightStart));
    } else {
      appendSide(left, points[i], leftStart, leftEnd, radiusKm);
      appendSide(right, points[i], rightStart, rightEnd, radiusKm);
    }
  }
  const endBearing = bearing(points[points.length - 2], points[points.length - 1]);
  const startBearing = bearing(points[0], points[1]);
  const ring: Position[] = [];
  appendArc(
    ring,
    points[0],
    normalizeAngle(startBearing + 90),
    normalizeAngle(startBearing - 90),
    radiusKm,
    false
  );
  ring.push(...left.slice(1));
  appendArc(
    ring,
    points[points.length - 1],
    normalizeAngle(endBearing - 90),
    normalizeAngle(endBearing + 90),
    radiusKm,
    false
  );
  for (let i = right.length - 2; i >= 0; i--) ring.push(right[i]);
  return closeRing(ring);
}

function appendSide(
  out: Position[],
  vertex: Position,
  start: number,
  end: number,
  radiusKm: number
) {
  const turn = normalizeAngle(end - start);
  if (turn <= 180) {
    appendArc(out, vertex, start, end, radiusKm, false);
    return;
  }
  const miter = destination(vertex, radiusKm, normalizeAngle(start + turn / 2));
  const limit = localDistance(vertex, miter);
  if (limit > radiusKm * 1.5) {
    out.push(destination(vertex, radiusKm, start));
    out.push(destination(vertex, radiusKm, end));
  } else {
    out.push(miter);
  }
}

function circle(center: Position, radiusKm: number): Position[] {
  const ring: Position[] = [];
  const steps = STEPS_PER_QUARTER * 4;
  for (let i = 0; i <= steps; i++) {
    ring.push(destination(center, radiusKm, (i / steps) * 360));
  }
  return ring;
}

function appendArc(
  out: Position[],
  center: Position,
  start: number,
  end: number,
  radiusKm: number,
  clockwise: boolean
) {
  const sweep = clockwise
    ? normalizeAngle(start - end)
    : normalizeAngle(end - start);
  const steps = Math.max(1, Math.round((STEPS_PER_QUARTER * sweep) / 90));
  for (let i = 0; i <= steps; i++) {
    const angle = clockwise
      ? normalizeAngle(start - (sweep * i) / steps)
      : normalizeAngle(start + (sweep * i) / steps);
    const next = destination(center, radiusKm, angle);
    const previous = out[out.length - 1];
    if (!previous || !samePosition(previous, next)) out.push(next);
  }
}

function offsetIntersection(
  previous: Position,
  current: Position,
  next: Position,
  startAngle: number,
  endAngle: number,
  radiusKm: number
): Position | null {
  const a1 = localMeters(current, destination(previous, radiusKm, startAngle));
  const a2 = localMeters(current, destination(current, radiusKm, startAngle));
  const b1 = localMeters(current, destination(current, radiusKm, endAngle));
  const b2 = localMeters(current, destination(next, radiusKm, endAngle));
  const hit = intersectMeters(a1, a2, b1, b2);
  if (!hit) return null;
  if (Math.hypot(hit[0], hit[1]) > radiusKm * 2) return null;
  return fromLocalMeters(current, hit);
}

function intersectMeters(
  a1: Position,
  a2: Position,
  b1: Position,
  b2: Position
): Position | null {
  const dax = a2[0] - a1[0];
  const day = a2[1] - a1[1];
  const dbx = b2[0] - b1[0];
  const dby = b2[1] - b1[1];
  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < 1e-6) return null;
  const t = ((b1[0] - a1[0]) * dby - (b1[1] - a1[1]) * dbx) / denom;
  return [a1[0] + t * dax, a1[1] + t * day];
}

function localMeters(origin: Position, point: Position): Position {
  const cos = Math.cos((origin[1] * Math.PI) / 180);
  return [
    (point[0] - origin[0]) * 111.32 * Math.max(Math.abs(cos), 0.2),
    (point[1] - origin[1]) * 110.574,
  ];
}

function fromLocalMeters(origin: Position, point: Position): Position {
  const cos = Math.cos((origin[1] * Math.PI) / 180);
  return [
    origin[0] + point[0] / (111.32 * Math.max(Math.abs(cos), 0.2)),
    origin[1] + point[1] / 110.574,
  ];
}

function localDistance(a: Position, b: Position): number {
  const delta = localMeters(a, b);
  return Math.hypot(delta[0], delta[1]);
}

function signedArea(ring: Position[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const next = ring[(i + 1) % ring.length];
    sum += ring[i][0] * next[1] - next[0] * ring[i][1];
  }
  return sum / 2;
}

function bearing(start: Position, end: Position): number {
  const lat1 = (start[1] * Math.PI) / 180;
  const lat2 = (end[1] * Math.PI) / 180;
  const dLng = ((end[0] - start[0]) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return normalizeAngle((Math.atan2(y, x) * 180) / Math.PI);
}

function destination(start: Position, distanceKm: number, bearingDegrees: number): Position {
  const angular = distanceKm / EARTH_RADIUS_KM;
  const bearingRadians = (bearingDegrees * Math.PI) / 180;
  const lat1 = (start[1] * Math.PI) / 180;
  const lng1 = (start[0] * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearingRadians)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearingRadians) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
    );
  return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

function normalizeAngle(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function asPosition(value: unknown): Position | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  if (typeof value[0] !== "number" || typeof value[1] !== "number") return null;
  if (!Number.isFinite(value[0]) || !Number.isFinite(value[1])) return null;
  return [value[0], value[1]];
}

function visitPositions(value: unknown, visit: (position: number[]) => void) {
  if (Array.isArray(value)) {
    if (
      value.length >= 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number"
    ) {
      visit(value);
      return;
    }
    for (const item of value) visitPositions(item, visit);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const key of ["features", "geometries", "geometry", "coordinates"]) {
    if (key in value) {
      visitPositions(Object.getOwnPropertyDescriptor(value, key)?.value, visit);
    }
  }
}

function shiftFeaturesToShortArc(features: Feature[]) {
  const positions: number[][] = [];
  for (const feature of features) {
    visitPositions(feature.geometry, (position) => positions.push(position));
  }
  const shifted = shiftLongitudesToShortArc(
    positions.map((position) => [position[0], position[1]])
  );
  for (let i = 0; i < positions.length; i++) {
    positions[i][0] = shifted[i][0];
  }
}

const GEOMETRY_TYPES = new Set([
  "Point",
  "MultiPoint",
  "LineString",
  "MultiLineString",
  "Polygon",
  "MultiPolygon",
]);

function isSimpleGeometry(
  value: object
): value is Exclude<Geometry, GeometryCollection> {
  return (
    "type" in value &&
    typeof value.type === "string" &&
    GEOMETRY_TYPES.has(value.type) &&
    "coordinates" in value
  );
}

function cloneFeatures(value: unknown): Feature[] {
  const found: Feature[] = [];
  collectFeatures(value, found);
  if (found.length === 0) return [];
  const cloned: unknown = JSON.parse(JSON.stringify(found));
  if (!Array.isArray(cloned)) return [];
  const features: Feature[] = [];
  for (const item of cloned) {
    if (isClonedFeature(item)) features.push(item);
  }
  return features;
}

function isClonedFeature(value: unknown): value is Feature {
  if (!value || typeof value !== "object") return false;
  if (!("type" in value) || value.type !== "Feature") return false;
  if (!("geometry" in value) || !value.geometry || typeof value.geometry !== "object") {
    return false;
  }
  return "type" in value.geometry && typeof value.geometry.type === "string";
}

function collectFeatures(value: unknown, out: Feature[]) {
  if (!value || typeof value !== "object") return;
  if (!("type" in value) || typeof value.type !== "string") return;
  if (value.type === "FeatureCollection" && "features" in value) {
    if (Array.isArray(value.features)) {
      for (const feature of value.features) collectFeatures(feature, out);
    }
    return;
  }
  if (value.type === "Feature" && "geometry" in value) {
    collectFeatures(value.geometry, out);
    return;
  }
  if (isSimpleGeometry(value)) {
    out.push({
      type: "Feature",
      properties: {},
      geometry: value,
    });
  }
}
