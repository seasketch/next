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
