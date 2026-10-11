import { Position } from "geojson";
import distance from "@turf/distance";
import { routeWaterPath } from "../../src/h3/waterPathTangent";

function km(points: Array<[number, number]>): Position[] {
  return points.map(([east, north]) => [east / 111.32, north / 111.32]);
}

function samples(coords: Position[], stepKm: number): Position[] {
  const out: Position[] = [];
  for (let i = 1; i < coords.length; i++) {
    const span = distance(coords[i - 1]!, coords[i]!, { units: "kilometers" });
    const steps = Math.max(1, Math.ceil(span / stepKm));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      out.push([
        coords[i - 1]![0] + (coords[i]![0] - coords[i - 1]![0]) * t,
        coords[i - 1]![1] + (coords[i]![1] - coords[i - 1]![1]) * t,
      ]);
    }
  }
  return out;
}

function insideRing(point: Position, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceToRingKm(point: Position, ring: Position[]): number {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const start = ring[i]!;
    const end = ring[(i + 1) % ring.length]!;
    const steps = 20;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const sample: Position = [
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t,
      ];
      const span = distance(point, sample, { units: "kilometers" });
      if (span < best) best = span;
    }
  }
  return best;
}

describe("tangent water path", () => {
  const island = km([
    [6, -3],
    [12, -3],
    [12, 3],
    [6, 3],
    [6, -3],
  ]);

  it("keeps a clear line when nothing is in the way", () => {
    const aside = km([
      [6, 12],
      [12, 12],
      [12, 16],
      [6, 16],
      [6, 12],
    ]);
    const path = routeWaterPath(km([[0, 0]])[0]!, km([[20, 0]])[0]!, [aside], [], 80_000);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(2);
  });

  it("bends offshore around an island instead of crossing it", () => {
    const origin = km([[0, 0]])[0]!;
    const port = km([[18, 0]])[0]!;
    const path = routeWaterPath(origin, port, [island], [], 80_000);
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(2);
    const crossed = samples(path!, 0.05).filter((point) => insideRing(point, island));
    expect(crossed).toEqual([]);
    const bends = path!.slice(1, -1);
    for (const bend of bends) {
      expect(distanceToRingKm(bend, island)).toBeGreaterThan(0.15);
    }
  });

  it("leaves a bay through its mouth to reach a port on the far side", () => {
    const wall = km([
      [2, -4],
      [8, -4],
      [8, -1.2],
      [4, -1.2],
      [4, 1.2],
      [8, 1.2],
      [8, 4],
      [2, 4],
      [2, -4],
    ]);
    const origin = km([[6, 0]])[0]!;
    const port = km([[3, 9]])[0]!;
    const path = routeWaterPath(origin, port, [wall], [], 40_000);
    expect(path).not.toBeNull();
    const crossed = samples(path!, 0.05).filter((point) => insideRing(point, wall));
    expect(crossed).toEqual([]);
    const leftTheBay = path!.some((point) => {
      const east = point[0] * 111.32;
      const north = point[1] * 111.32;
      return east > 7.5 && Math.abs(north) < 2;
    });
    expect(leftTheBay).toBe(true);
  });
});
