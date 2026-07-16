import type { Feature, Geometry } from "geojson";

export function bboxForFeature(feature: Feature<Geometry>): number[] {
  const positions: number[][] = [];
  collectGeometry(feature.geometry, positions);
  if (!positions.length) return [0, 0, 0, 0];

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of positions) {
    minLng = Math.min(minLng, x);
    maxLng = Math.max(maxLng, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const crosses = minLng < -160 && maxLng > 160;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const [x] of positions) {
    const adjusted = crosses && x > 0 ? x - 360 : x;
    minX = Math.min(minX, adjusted);
    maxX = Math.max(maxX, adjusted);
  }
  if (!crosses && maxX - minX > 359) {
    minX = -180;
    maxX = 180;
  }
  return [minX, minY, maxX, maxY];
}

function collectGeometry(geometry: Geometry, output: number[][]): void {
  if (geometry.type === "GeometryCollection") {
    for (const child of geometry.geometries) collectGeometry(child, output);
  } else {
    collectPositions(geometry.coordinates, output);
  }
}

function collectPositions(value: unknown, output: number[][]): void {
  if (!Array.isArray(value)) return;
  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    output.push(value as number[]);
    return;
  }
  for (const child of value) collectPositions(child, output);
}
