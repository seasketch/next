/**
 * Shift every point into one continuous longitude window covering the shortest
 * arc. The window may extend past ±180.
 *
 * Each route is unwrapped on its own, so one Fiji line can sit near 179° while
 * the next sits near -181°. A bounds built from both is the long way around
 * the world. On the globe projection, fitting that bounds flies the camera to
 * the pole. Corners kept on the short arc (even if one of them is past ±180)
 * fit the dateline instead.
 */
export function shiftLongitudesToShortArc(
  points: Array<[number, number]>
): Array<[number, number]> {
  if (points.length === 0) return points;
  const wrapped = points.map(
    ([lng, lat]) => [wrapLongitude(lng), lat] as [number, number]
  );
  const unique = Array.from(new Set(wrapped.map((point) => point[0]))).sort(
    (a, b) => a - b
  );
  if (unique.length < 2) return wrapped;
  let maxGap = -1;
  let clusterStart = unique[0]!;
  for (let i = 0; i < unique.length; i++) {
    const current = unique[i]!;
    const next = i === unique.length - 1 ? unique[0]! : unique[i + 1]!;
    const gap =
      i === unique.length - 1 ? next + 360 - current : next - current;
    if (gap > maxGap) {
      maxGap = gap;
      clusterStart = next;
    }
  }
  return wrapped.map(([lng, lat]) => [
    lng < clusterStart ? lng + 360 : lng,
    lat,
  ]);
}

/** Longitude in (-180, 180]. 180 and -180 are the same meridian. */
function wrapLongitude(lng: number): number {
  const turns = ((lng % 360) + 360) % 360;
  return turns > 180 ? turns - 360 : turns;
}

const KM_PER_DEGREE_LATITUDE = 110.574;
const KM_PER_DEGREE_LONGITUDE_AT_EQUATOR = 111.32;

function isPosition(value: unknown): value is [number, number, ...number[]] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

function collectPositions(value: unknown, out: Array<[number, number]>) {
  if (isPosition(value)) {
    out.push([value[0], value[1]]);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPositions(item, out);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as { [key: string]: unknown };
  if ("features" in record) collectPositions(record.features, out);
  if ("geometries" in record) collectPositions(record.geometries, out);
  if ("geometry" in record) collectPositions(record.geometry, out);
  if ("coordinates" in record) collectPositions(record.coordinates, out);
}

/** Positions from a GeoJSON geometry, feature, or collection. Other values yield none. */
export function positionsInGeojson(value: unknown): Array<[number, number]> {
  const positions: Array<[number, number]> = [];
  collectPositions(value, positions);
  return positions;
}

/**
 * Southwest and northeast corners of `points`, grown by `km` on every side.
 * Longitudes stay on the short arc, so a sketch on the dateline does not
 * frame the whole world. Returns null when there is nothing to frame.
 */
export function boundsExpandedByKm(
  points: Array<[number, number]>,
  km: number
): [[number, number], [number, number]] | null {
  const finite = points.filter(
    (point) => Number.isFinite(point[0]) && Number.isFinite(point[1])
  );
  if (finite.length === 0 || !Number.isFinite(km) || km < 0) return null;
  const shifted = shiftLongitudesToShortArc(finite);
  let west = shifted[0]![0];
  let east = west;
  let south = shifted[0]![1];
  let north = south;
  for (const [lng, lat] of shifted) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  const midLat = (south + north) / 2;
  const latDelta = km / KM_PER_DEGREE_LATITUDE;
  const cos = Math.cos((midLat * Math.PI) / 180);
  const lngDelta =
    km /
    (KM_PER_DEGREE_LONGITUDE_AT_EQUATOR * Math.max(Math.abs(cos), 0.2));
  south = Math.max(-85, south - latDelta);
  north = Math.min(85, north + latDelta);
  west -= lngDelta;
  east += lngDelta;
  if (east - west >= 360) {
    const mid = (west + east) / 2;
    west = mid - 180;
    east = mid + 180;
  }
  return [
    [west, south],
    [east, north],
  ];
}
