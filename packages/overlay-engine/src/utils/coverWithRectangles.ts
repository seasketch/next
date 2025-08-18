import * as pc from "polygon-clipping";
import * as turf from "@turf/area";
import RBush from "rbush";
import { Polygon, MultiPolygon, BBox, Position } from "geojson";

// Type definitions
type Rect = [number, number, number, number]; // [minX, minY, maxX, maxY]
type Ring = [number, number][];
type Rings = Ring[];
type MultiRings = Rings[];

// Helper function to extract 2D coordinates from Position
function to2D(pos: Position): [number, number] {
  return [pos[0], pos[1]];
}

// GeoJSON MultiPolygon/Polygon -> ring arrays in polygon-clipping format
function toPC(geojson: Polygon | MultiPolygon): MultiRings {
  if (geojson.type === "Polygon") {
    return [geojson.coordinates.map((ring) => ring.map(to2D))];
  }
  if (geojson.type === "MultiPolygon") {
    return geojson.coordinates.map((poly) =>
      poly.map((ring) => ring.map(to2D))
    );
  }
  throw new Error("Polygon or MultiPolygon only");
}

function rectToPoly(rect: Rect): Rings {
  const [minX, minY, maxX, maxY] = rect;
  return [
    [
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
      [minX, minY],
    ],
  ];
}

function rectArea(rect: Rect): number {
  const [minX, minY, maxX, maxY] = rect;
  return (maxX - minX) * (maxY - minY);
}

// Classify a rectangle against the polygon using polygon-clipping
function classifyRect(
  rect: Rect,
  poly: MultiRings,
  eps: number = 1e-12
): "inside" | "outside" | "mixed" {
  const rectPoly = rectToPoly(rect);
  const I = pc.intersection(poly, rectPoly);

  if (!I || I.length === 0) return "outside";

  // Convert intersection result to GeoJSON and use turf to calculate area
  const intersectionGeoJSON = {
    type: "MultiPolygon" as const,
    coordinates: I,
  };

  const areaI = turf.default(intersectionGeoJSON);
  console.log(`Intersection area (turf): ${areaI}`);

  const aR = rectArea(rect);
  console.log(
    `Rect [${rect.join(
      ", "
    )}]: intersection area=${areaI}, rect area=${aR}, diff=${Math.abs(
      areaI - aR
    )}`
  );

  // Check if the intersection area is very close to the rectangle area (within 1%)
  const areaRatio = areaI / aR;
  if (areaRatio > 0.99) return "inside";

  // Check if the intersection area is very small compared to rectangle area (outside)
  if (areaRatio < 0.01) return "outside";

  return "mixed";
}

// Split a rect at midpoint along 'x' or 'y'
function splitRect(rect: Rect, axis: "x" | "y" = "x"): [Rect, Rect] {
  const [minX, minY, maxX, maxY] = rect;
  if (axis === "x") {
    const midX = (minX + maxX) / 2;
    return [
      [minX, minY, midX, maxY],
      [midX, minY, maxX, maxY],
    ];
  } else {
    const midY = (minY + maxY) / 2;
    return [
      [minX, minY, maxX, midY],
      [minX, midY, maxX, maxY],
    ];
  }
}

// Helper function to convert BBox to Rect (2D only)
function bboxToRect(bbox: BBox): Rect {
  // BBox is [minX, minY, maxX, maxY] for 2D
  // Ensure we have valid numbers
  const minX = bbox[0] ?? 0;
  const minY = bbox[1] ?? 0;
  const maxX = bbox[2] ?? 0;
  const maxY = bbox[3] ?? 0;
  return [minX, minY, maxX, maxY];
}

// Build cover
export function coverWithRectangles(
  geojson: Polygon | MultiPolygon,
  {
    target = 100,
    minWidth = 1e-4, // degrees
    minHeight = 1e-4,
    bbox = null,
  }: {
    target?: number;
    minWidth?: number;
    minHeight?: number;
    bbox?: BBox | null;
  } = {}
): { inside: Rect[]; outside: Rect[] } {
  const poly = toPC(geojson);
  console.log(
    `Polygon has ${poly.length} parts, first part has ${
      poly[0]?.length || 0
    } rings`
  );

  // start from overall bbox (or given)
  const B: Rect = bbox
    ? bboxToRect(bbox)
    : geojson.bbox
    ? bboxToRect(geojson.bbox)
    : (() => {
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (const c of geojson.type === "Polygon"
          ? [geojson.coordinates]
          : geojson.coordinates)
          for (const ring of c)
            for (const pos of ring) {
              const [x, y] = to2D(pos);
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
        return [minX, minY, maxX, maxY];
      })();

  const inside: Rect[] = [],
    outside: Rect[] = [],
    queue: Rect[] = [];
  // Seed
  console.log(`Initial bounding box: [${B.join(", ")}], area: ${rectArea(B)}`);
  queue.push(B);

  while (queue.length && inside.length < target) {
    console.log("queue", queue.length, inside.length, outside.length);
    // Pick the largest rect left to work on (simple heuristic)
    queue.sort((a, b) => rectArea(b) - rectArea(a));
    const R = queue.shift()!;
    const [minX, minY, maxX, maxY] = R;
    console.log(
      `Processing rect: [${minX}, ${minY}, ${maxX}, ${maxY}], area: ${rectArea(
        R
      )}`
    );

    if (maxX - minX < minWidth || maxY - minY < minHeight) {
      console.log(`Rect too small, skipping`);
      continue;
    }

    const cls = classifyRect(R, poly);
    console.log(`Classification: ${cls}`);

    if (cls === "inside") {
      inside.push(R);
      console.log(`Added to inside, total: ${inside.length}`);
      continue;
    }
    if (cls === "outside") {
      outside.push(R);
      console.log(`Added to outside, total: ${outside.length}`);
      continue;
    }

    // Try both split directions; pick the one that seems to yield more "inside"
    const [r1x, r2x] = splitRect(R, "x");
    const [r1y, r2y] = splitRect(R, "y");
    const gainX = scoreSplit(r1x, r2x, poly);
    const gainY = scoreSplit(r1y, r2y, poly);

    const chosen = gainX >= gainY ? [r1x, r2x] : [r1y, r2y];
    console.log(`Splitting rect, adding 2 new rects to queue`);
    queue.push(chosen[0], chosen[1]);
  }

  return { inside, outside };
}

function scoreSplit(a: Rect, b: Rect, poly: MultiRings): number {
  // Quick optimistic score: count how many children are fully inside,
  // breaking ties by preferring larger intersection areas.
  const ca = classifyRect(a, poly);
  const cb = classifyRect(b, poly);
  let s = 0;
  if (ca === "inside") s += rectArea(a);
  if (cb === "inside") s += rectArea(b);
  return s;
}

// Build R-trees for later queries
export function buildIndexes(
  inside: Rect[],
  outside: Rect[]
): { inTree: RBush<any>; outTree: RBush<any> } {
  const mkItem = (r: Rect) => ({
    minX: r[0],
    minY: r[1],
    maxX: r[2],
    maxY: r[3],
    r,
  });
  const inTree = new RBush().load(inside.map(mkItem));
  const outTree = new RBush().load(outside.map(mkItem));
  return { inTree, outTree };
}

// Classify a candidate polygon by its bbox using the precomputed rectangles
export function classifyCandidate(
  candidateGeoJSON: Polygon | MultiPolygon,
  indexes: { inTree: RBush<any>; outTree: RBush<any> }
): "inside_fast" | "outside_fast" | "uncertain" {
  const [minX, minY, maxX, maxY]: Rect = candidateGeoJSON.bbox
    ? bboxToRect(candidateGeoJSON.bbox)
    : (() => {
        let miX = Infinity,
          miY = Infinity,
          maX = -Infinity,
          maY = -Infinity;
        // Handle both Polygon and MultiPolygon coordinates
        const coords =
          candidateGeoJSON.type === "Polygon"
            ? [candidateGeoJSON.coordinates]
            : candidateGeoJSON.coordinates;

        for (const poly of coords) {
          for (const ring of poly) {
            for (const pos of ring) {
              const [x, y] = to2D(pos);
              miX = Math.min(miX, x);
              miY = Math.min(miY, y);
              maX = Math.max(maX, x);
              maY = Math.max(maY, y);
            }
          }
        }
        return [miX, miY, maX, maY];
      })();

  // "Definitely inside" if candidate bbox is contained in any inside rect
  const hits = indexes.inTree.search({ minX, minY, maxX, maxY });
  for (const h of hits) {
    if (minX >= h.minX && maxX <= h.maxX && minY >= h.minY && maxY <= h.maxY)
      return "inside_fast";
  }
  // "Definitely outside" if bbox is contained in any outside rect
  const outs = indexes.outTree.search({ minX, minY, maxX, maxY });
  for (const h of outs) {
    if (minX >= h.minX && maxX <= h.maxX && minY >= h.minY && maxY <= h.maxY)
      return "outside_fast";
  }
  return "uncertain"; // fall back to exact polygon clip check only for these
}
