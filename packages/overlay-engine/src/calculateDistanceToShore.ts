import {
  Feature,
  Geometry,
  LineString,
  MultiLineString,
  MultiPolygon,
  Point,
  Polygon,
  Position,
} from "geojson";
import { guaranteeHelpers, OverlayWorkerHelpers } from "./utils/helpers";
import { FlatGeobufSource } from "fgb-source";
import {
  cellToBoundary,
  gridDisk,
  H3Index,
  latLngToCell,
  polygonToCells,
} from "h3-js";
import booleanIntersects from "@turf/boolean-intersects";
import bbox from "@turf/bbox";
import {
  bboxToEnvelope,
  cleanBBox,
  splitBBoxAntimeridian,
} from "./utils/bboxUtils";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import distance from "@turf/distance";

/**
 * Fixed Earth radius used for rough degree <-> meter conversions.
 * This is only used to build small search bboxes; all final distances
 * are computed geodesically by Turf in meters.
 */
const EARTH_RADIUS_METERS = 6_371_008.8;

/**
 * Default H3 resolution used for the progressive search.
 *
 * - 6 is a compromise for "distance to shore":
 *   somewhat larger cells than 7, reducing the number of cells
 *   in each search ring while still providing coastal detail.
 */
const DEFAULT_H3_RESOLUTION = 6;

/**
 * Maximum number of H3 "rings" (graph distance) to search outward
 * from the origin before giving up.
 */
const MAX_H3_RING = 50;

/**
 * Minimum initial point buffer used for the small bbox search
 * (before falling back to H3). This is combined with the user
 * provided `miminumDistanceMeters`.
 */
const MIN_POINT_BUFFER_METERS = 50;

/**
 * Utility to convert a radial distance in meters into an
 * approximate angular distance in degrees. We use this only to
 * slightly expand bboxes; final distances are done via Turf.
 */
function metersToDegrees(distanceMeters: number) {
  // Small-angle approximation: arc length s = r * theta
  // => theta (radians) = s / r; convert to degrees.
  const radians = distanceMeters / EARTH_RADIUS_METERS;
  return (radians * 180) / Math.PI;
}

/**
 * Extract a flat list of point positions from an input geometry.
 * These positions are used as "sample points" when measuring the
 * distance from a non-point geometry (line / polygon) to land
 * polygons using point-to-polygon distance.
 */
function samplePositionsFromGeometry(geometry: Geometry): Position[] {
  switch (geometry.type) {
    case "Point":
      return [geometry.coordinates];
    case "MultiPoint":
      return geometry.coordinates;
    case "LineString":
      return geometry.coordinates;
    case "MultiLineString":
      return (geometry as MultiLineString).coordinates.flat();
    case "Polygon":
      // Flatten all rings of the polygon
      return (geometry as Polygon).coordinates.flat();
    case "MultiPolygon":
      return (geometry as MultiPolygon).coordinates.flat(2);
    default:
      throw new Error(`Unsupported geometry type: ${geometry.type}`);
  }
}

/**
 * Build a small, antimeridian-safe envelope around a point. Used
 * for the initial "cheap" search for nearby land using the fgb
 * index without fetching any features.
 */
function envelopeAroundPoint(
  point: Point,
  bufferMeters: number
): ReturnType<typeof bboxToEnvelope>[] {
  const [lng, lat] = point.coordinates;
  const delta = metersToDegrees(bufferMeters);
  const raw: [number, number, number, number] = [
    lng - delta,
    lat - delta,
    lng + delta,
    lat + delta,
  ];
  const cleaned = cleanBBox(raw);
  const split = splitBBoxAntimeridian(
    cleaned as [number, number, number, number]
  );
  return split.map(bboxToEnvelope);
}

/**
 * Build an H3 index set that "covers" the origin geometry.
 *
 * - Point: a single H3 cell at the chosen resolution
 * - LineString: one cell per vertex
 * - Polygon: use polygonToCells with GeoJSON-style [lng,lat] loops
 *
 * Multi* variants are supported by flattening into underlying
 * primitive geometries.
 */
function initialH3CellsForGeometry(
  geometry: Geometry,
  resolution: number
): H3Index[] {
  const cells = new Set<H3Index>();

  const addPoint = (lng: number, lat: number) => {
    const cell = latLngToCell(lat, lng, resolution);
    cells.add(cell);
  };

  switch (geometry.type) {
    case "Point": {
      const [lng, lat] = (geometry as Point).coordinates;
      addPoint(lng, lat);
      break;
    }
    case "MultiPoint": {
      for (const [lng, lat] of (geometry as any).coordinates) {
        addPoint(lng, lat);
      }
      break;
    }
    case "LineString": {
      for (const [lng, lat] of (geometry as LineString).coordinates) {
        addPoint(lng, lat);
      }
      break;
    }
    case "MultiLineString": {
      for (const line of (geometry as MultiLineString).coordinates) {
        for (const [lng, lat] of line) {
          addPoint(lng, lat);
        }
      }
      break;
    }
    case "Polygon": {
      const coords = (geometry as Polygon).coordinates;
      // H3 expects [lat,lng] unless using GeoJSON flag; here we pass [lng,lat]
      // loops and set `isGeoJson=true`.
      for (const cell of polygonToCells(coords as any, resolution, true)) {
        cells.add(cell);
      }
      break;
    }
    case "MultiPolygon": {
      for (const poly of (geometry as MultiPolygon).coordinates) {
        for (const cell of polygonToCells(poly as any, resolution, true)) {
          cells.add(cell);
        }
      }
      break;
    }
    default:
      throw new Error(
        `Unsupported geometry type for H3 coverage: ${geometry.type}`
      );
  }

  return Array.from(cells);
}

/**
 * Convert a single H3 cell into a [minX, minY, maxX, maxY] bbox using the
 * GeoJSON-style [lng,lat] boundary returned by H3.
 *
 * Special handling is included for cells that cross the antimeridian:
 * rather than returning a nearly world-spanning bbox like [-179, 179],
 * we emit a bbox where minX > maxX (e.g. [170, -170]). This allows
 * downstream helpers like `splitBBoxAntimeridian` to correctly split
 * the box into two non-wrapping segments.
 */
function bboxForCell(cell: H3Index): [number, number, number, number] {
  const boundary = cellToBoundary(cell, true); // [lng,lat] pairs

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of boundary as [number, number][]) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const crossesAntimeridian = minLng < -160 && maxLng > 160;

  // If the cell crosses the antimeridian, construct a bbox where minX > maxX
  // so that downstream code can detect and split it.
  if (crossesAntimeridian) {
    let minPositiveLng = Infinity;
    let maxNegativeLng = -Infinity;

    for (const [lng] of boundary as [number, number][]) {
      if (lng >= 0 && lng < minPositiveLng) {
        minPositiveLng = lng;
      } else if (lng < 0 && lng > maxNegativeLng) {
        maxNegativeLng = lng;
      }
    }

    // Fallback to the simple bbox if for some reason we didn't classify
    // any positive/negative longitudes (shouldn't happen in practice).
    if (!Number.isFinite(minPositiveLng) || !Number.isFinite(maxNegativeLng)) {
      return [minLng, minLat, maxLng, maxLat];
    }

    return [minPositiveLng, minLat, maxNegativeLng, maxLat];
  }

  // Normal, non-antimeridian-crossing cell.
  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Result describing the closest path from the origin geometry to a single
 * land polygon: the origin point, the snapped shoreline point, and distance
 * in meters.
 */
type ClosestPath = {
  meters: number;
  origin: Position | null;
  shoreline: Position | null;
};

/**
 * A simple line segment in lon/lat space.
 */
type Segment = {
  a: Position;
  b: Position;
};

/**
 * Normalize longitudes of a single position into a window centered around
 * `referenceLng`, so that the delta in degrees is always within [-180, 180].
 * This is useful near the antimeridian where raw [lng,lat] differences can
 * otherwise appear almost 360° apart.
 */
function normalizePositionLongitude(
  pos: Position,
  referenceLng: number
): Position {
  const [lng, lat] = pos;

  if (!Number.isFinite(referenceLng)) {
    return pos;
  }

  let adj = lng;
  while (adj - referenceLng > 180) adj -= 360;
  while (adj - referenceLng < -180) adj += 360;

  return [adj, lat];
}

/**
 * Normalize all longitudes in a geometry into a band centered around
 * `referenceLng`. This keeps subject and shoreline geometries in a
 * consistent local coordinate space for planar segment distance
 * calculations, especially when they lie on opposite sides of the
 * antimeridian.
 */
function normalizeGeometryLongitudes(
  geometry: Geometry,
  referenceLng: number
): Geometry {
  switch (geometry.type) {
    case "Point":
      return {
        type: "Point",
        coordinates: normalizePositionLongitude(
          geometry.coordinates,
          referenceLng
        ),
      };
    case "MultiPoint":
      return {
        type: "MultiPoint",
        coordinates: geometry.coordinates.map((p) =>
          normalizePositionLongitude(p, referenceLng)
        ),
      };
    case "LineString":
      return {
        type: "LineString",
        coordinates: geometry.coordinates.map((p) =>
          normalizePositionLongitude(p, referenceLng)
        ),
      };
    case "MultiLineString":
      return {
        type: "MultiLineString",
        coordinates: geometry.coordinates.map((line) =>
          line.map((p) => normalizePositionLongitude(p, referenceLng))
        ),
      };
    case "Polygon":
      return {
        type: "Polygon",
        coordinates: geometry.coordinates.map((ring) =>
          ring.map((p) => normalizePositionLongitude(p, referenceLng))
        ),
      };
    case "MultiPolygon":
      return {
        type: "MultiPolygon",
        coordinates: geometry.coordinates.map((poly) =>
          poly.map((ring) =>
            ring.map((p) => normalizePositionLongitude(p, referenceLng))
          )
        ),
      };
    default:
      // Fallback: return geometry unchanged for unsupported types.
      return geometry;
  }
}

/**
 * Add segments for a single ring or line (sequence of coordinates).
 */
function addRingSegments(ring: Position[], target: Segment[]) {
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    target.push({ a, b });
  }
}

/**
 * Extract boundary segments from a geometry. For polygons this includes all
 * rings; for lines, all line segments. Points are ignored (handled separately).
 */
function segmentsFromGeometryEdges(geometry: Geometry): Segment[] {
  const segments: Segment[] = [];

  switch (geometry.type) {
    case "LineString": {
      addRingSegments((geometry as LineString).coordinates, segments);
      break;
    }
    case "MultiLineString": {
      for (const line of (geometry as MultiLineString).coordinates) {
        addRingSegments(line, segments);
      }
      break;
    }
    case "Polygon": {
      for (const ring of (geometry as Polygon).coordinates) {
        addRingSegments(ring, segments);
      }
      break;
    }
    case "MultiPolygon": {
      for (const poly of (geometry as MultiPolygon).coordinates) {
        for (const ring of poly) {
          addRingSegments(ring, segments);
        }
      }
      break;
    }
    default:
      // Point / MultiPoint are handled via nearestPointOnLine and do not
      // contribute segments here.
      break;
  }

  return segments;
}

/**
 * Compute closest points between two line segments in lon/lat degrees space.
 * Returns both points and the squared distance in that planar approximation.
 * This is used only to *rank* candidate pairs; final meters are computed using
 * a geodesic distance.
 */
function closestPointsOnSegments(
  segA: Segment,
  segB: Segment
): { origin: Position; shoreline: Position; dist2: number } {
  const [x1, y1] = segA.a;
  const [x2, y2] = segA.b;
  const [x3, y3] = segB.a;
  const [x4, y4] = segB.b;

  const ux = x2 - x1;
  const uy = y2 - y1;
  const vx = x4 - x3;
  const vy = y4 - y3;
  const wx = x1 - x3;
  const wy = y1 - y3;

  const a = ux * ux + uy * uy;
  const b = ux * vx + uy * vy;
  const c = vx * vx + vy * vy;
  const d = ux * wx + uy * wy;
  const e = vx * wx + vy * wy;
  const D = a * c - b * b;
  const EPS = 1e-12;

  let sc: number;
  let sN: number;
  let sD = D;

  let tc: number;
  let tN: number;
  let tD = D;

  if (D < EPS) {
    // Almost parallel
    sN = 0.0;
    sD = 1.0;
    tN = e;
    tD = c;
  } else {
    sN = b * e - c * d;
    tN = a * e - b * d;

    if (sN < 0.0) {
      sN = 0.0;
      tN = e;
      tD = c;
    } else if (sN > sD) {
      sN = sD;
      tN = e + b;
      tD = c;
    }
  }

  if (tN < 0.0) {
    tN = 0.0;
    if (-d < 0.0) {
      sN = 0.0;
    } else if (-d > a) {
      sN = sD;
    } else {
      sN = -d;
      sD = a;
    }
  } else if (tN > tD) {
    tN = tD;
    if (-d + b < 0.0) {
      sN = 0;
    } else if (-d + b > a) {
      sN = sD;
    } else {
      sN = -d + b;
      sD = a;
    }
  }

  sc = Math.abs(sN) < EPS ? 0.0 : sN / sD;
  tc = Math.abs(tN) < EPS ? 0.0 : tN / tD;

  const cx = wx + sc * ux - tc * vx;
  const cy = wy + sc * uy - tc * vy;
  const dist2 = cx * cx + cy * cy;

  const origin: Position = [x1 + sc * ux, y1 + sc * uy];
  const shoreline: Position = [x3 + tc * vx, y3 + tc * vy];

  return { origin, shoreline, dist2 };
}

/**
 * Compute the true closest points (origin point on the subject geometry and
 * shoreline point on the land polygon) and their distance in meters.
 *
 * - For Point / MultiPoint: uses nearestPointOnLine against all shoreline
 *   rings.
 * - For LineString / Polygon (and Multi*): computes closest points between
 *   all segment pairs of the subject and shoreline boundaries.
 */
function nearestPointsBetweenGeometryAndPolygon(
  subjectGeom: Geometry,
  landFeature: Feature<Polygon | MultiPolygon>
): ClosestPath {
  const landGeom = landFeature.geometry;
  if (!landGeom) {
    return { meters: Infinity, origin: null, shoreline: null };
  }

  // Special case: point / multipoint subject. Use nearestPointOnLine directly.
  if (subjectGeom.type === "Point" || subjectGeom.type === "MultiPoint") {
    const samples = samplePositionsFromGeometry(subjectGeom);

    const rings: Position[][] = [];
    if (landGeom.type === "Polygon") {
      for (const ring of landGeom.coordinates) {
        if (ring.length >= 2) {
          rings.push(ring);
        }
      }
    } else if (landGeom.type === "MultiPolygon") {
      for (const poly of landGeom.coordinates) {
        for (const ring of poly) {
          if (ring.length >= 2) {
            rings.push(ring);
          }
        }
      }
    }

    let bestMeters = Infinity;
    let bestOrigin: Position | null = null;
    let bestShoreline: Position | null = null;

    for (const [lng, lat] of samples) {
      const originPoint: Feature<Point> = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {},
      };

      for (const ring of rings) {
        if (ring.length < 2) continue;

        const line: Feature<LineString> = {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: ring,
          },
          properties: {},
        };

        const snapped = nearestPointOnLine(line as any, originPoint as any, {
          units: "meters",
        }) as Feature<Point> & { properties: { dist: number } };

        const meters =
          snapped.properties && typeof snapped.properties.dist === "number"
            ? snapped.properties.dist
            : Infinity;

        if (meters < bestMeters) {
          bestMeters = meters;
          bestOrigin = originPoint.geometry.coordinates;
          bestShoreline = snapped.geometry.coordinates as Position;

          if (bestMeters === 0) {
            break;
          }
        }
      }

      if (bestMeters === 0) {
        break;
      }
    }

    return {
      meters: bestMeters,
      origin: bestOrigin,
      shoreline: bestShoreline,
    };
  }

  // General case: subject is a line or polygon (possibly Multi*).
  // To avoid antimeridian artifacts when ranking candidate segment pairs,
  // normalize both geometries into a local longitude band centered on one of
  // the subject's sample points.
  const subjectSamples = samplePositionsFromGeometry(subjectGeom);
  const referenceLng = subjectSamples.length > 0 ? subjectSamples[0][0] : 0;

  const normalizedSubject = normalizeGeometryLongitudes(
    subjectGeom,
    referenceLng
  );
  const normalizedLand = normalizeGeometryLongitudes(
    landGeom as Geometry,
    referenceLng
  );

  const subjectSegments = segmentsFromGeometryEdges(normalizedSubject);
  const shorelineSegments = segmentsFromGeometryEdges(normalizedLand);

  if (subjectSegments.length === 0 || shorelineSegments.length === 0) {
    return { meters: Infinity, origin: null, shoreline: null };
  }

  let bestDist2 = Infinity;
  let bestOrigin: Position | null = null;
  let bestShoreline: Position | null = null;

  for (const segA of subjectSegments) {
    for (const segB of shorelineSegments) {
      const { origin, shoreline, dist2 } = closestPointsOnSegments(segA, segB);
      if (dist2 < bestDist2) {
        bestDist2 = dist2;
        bestOrigin = origin;
        bestShoreline = shoreline;
      }
    }
  }

  if (bestOrigin && bestShoreline) {
    // Wrap longitudes from the normalized space back into the standard
    // [-180, 180] range before computing a geodesic distance.
    const wrapLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;

    const denormalizedOrigin: Position = [
      wrapLng(bestOrigin[0]),
      bestOrigin[1],
    ];
    const denormalizedShoreline: Position = [
      wrapLng(bestShoreline[0]),
      bestShoreline[1],
    ];

    const meters = distance(
      denormalizedOrigin as any,
      denormalizedShoreline as any,
      {
        units: "meters",
      }
    );
    return {
      meters,
      origin: denormalizedOrigin,
      shoreline: denormalizedShoreline,
    };
  }

  return { meters: Infinity, origin: null, shoreline: null };
}

/**
 * Result from the H3-based search: best distance and the corresponding
 * origin/shoreline points (if any).
 */
type H3SearchResult = {
  meters: number;
  origin: Position | null;
  shoreline: Position | null;
  /**
   * H3 cells searched, grouped by "ring" distance from the origin.
   * - rings[0] is the initial set of origin cells
   * - rings[1] is the first expanded ring, etc.
   */
  rings: H3Index[][];
};

/**
 * Progressive H3-based search for the nearest land feature, returning both
 * distance and the specific points that define the path.
 *
 * Starting from a set of origin cells that cover the input geometry,
 * we expand outwards ring-by-ring (graph distance in the H3 grid).
 *
 * For each ring:
 *   1. Use fgb-source.search() on each cell bbox to find which cells
 *      actually contain land features (cheap, index-only).
 *   2. For all cells in the *first* ring that contains any land,
 *      fetch the underlying features and compute exact distances
 *      from the origin geometry (fine-scale using Turf).
 *
 * We stop after we fully evaluate the first ring that intersects land,
 * ensuring we don't prematurely return a suboptimal distance while still
 * capping the search radius.
 */
async function searchNearestLandWithH3(
  feature: Feature,
  land: FlatGeobufSource<Feature<Polygon>>,
  minimumDistanceMeters: number
): Promise<H3SearchResult> {
  if (!feature.geometry) {
    throw new Error("Feature geometry is required");
  }

  const originCells = initialH3CellsForGeometry(
    feature.geometry,
    DEFAULT_H3_RESOLUTION
  );

  if (originCells.length === 0) {
    return { meters: Infinity, origin: null, shoreline: null, rings: [] };
  }

  const visited = new Set<string>();
  let frontier: H3Index[] = [];
  const rings: H3Index[][] = [];

  for (const cell of originCells) {
    if (!visited.has(cell)) {
      visited.add(cell);
      frontier.push(cell);
    }
  }

  let ring = 0;

  while (frontier.length > 0 && ring <= MAX_H3_RING) {
    // Track the current ring of cells being searched.
    rings.push([...frontier]);

    // 1. Identify which cells in this ring potentially contain land.
    const cellsWithLand: H3Index[] = [];

    for (const cell of frontier) {
      const cellBBox = bboxForCell(cell);
      const cleaned = cleanBBox(cellBBox);
      const split = splitBBoxAntimeridian(
        cleaned as [number, number, number, number]
      );

      let hasLand = false;
      for (const part of split) {
        const env = bboxToEnvelope(part);
        const estimate = land.search(env as any);
        if (estimate.features > 0) {
          hasLand = true;
          break;
        }
      }

      if (hasLand) {
        cellsWithLand.push(cell);
      }
    }

    // 2. If this ring has any land, compute exact distances from the
    //    origin geometry to all land features in these cells.
    if (cellsWithLand.length > 0) {
      let bestMeters = Infinity;
      let bestOrigin: Position | null = null;
      let bestShoreline: Position | null = null;
      const seenOffsets = new Set<number>();

      for (const cell of cellsWithLand) {
        const cellBBox = bboxForCell(cell);
        const cleaned = cleanBBox(cellBBox);
        const split = splitBBoxAntimeridian(
          cleaned as [number, number, number, number]
        );

        for (const part of split) {
          const env = bboxToEnvelope(part);
          const queryPlan = land.createPlan(env as any);

          for await (const landFeature of land.getFeaturesAsync(env as any, {
            queryPlan,
          })) {
            const offset =
              (landFeature as any).properties &&
              (landFeature as any).properties.__offset;

            if (typeof offset === "number") {
              if (seenOffsets.has(offset)) {
                continue;
              }
              seenOffsets.add(offset);
            }

            // If the geometries actually intersect (feature on land or
            // touching shoreline), distance is zero.
            if (booleanIntersects(feature as any, landFeature as any)) {
              return { meters: 0, origin: null, shoreline: null, rings };
            }

            const path = nearestPointsBetweenGeometryAndPolygon(
              feature.geometry as Geometry,
              landFeature as any
            );

            if (path.meters < bestMeters) {
              bestMeters = path.meters;
              bestOrigin = path.origin;
              bestShoreline = path.shoreline;

              if (bestMeters <= minimumDistanceMeters) {
                // Within the "minimum distance" threshold, treat as zero.
                return {
                  meters: 0,
                  origin: bestOrigin,
                  shoreline: bestShoreline,
                  rings,
                };
              }
            }
          }
        }
      }

      return {
        meters: bestMeters,
        origin: bestOrigin,
        shoreline: bestShoreline,
        rings,
      };
    }

    // 3. No land in this ring; expand to the next ring via grid neighbors.
    const nextFrontier: H3Index[] = [];

    for (const cell of frontier) {
      const neighbors = gridDisk(cell, 1);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          nextFrontier.push(neighbor);
        }
      }
    }

    frontier = nextFrontier;
    ring += 1;
  }

  // No land found within the configured H3 radius.
  return { meters: Infinity, origin: null, shoreline: null, rings };
}

/**
 * Calculates the distance from a given feature in the ocean to the nearest
 * point on land. Only supports Points, Polygons, and Lines (Multi* variants
 * are handled by flattening to their constituent geometries).
 *
 * There are 3 main cases to consider:
 *
 *   1. The feature is on land. If that is the case, the distance is 0.
 *   2. The feature is in the ocean but touches land, or is within
 *      options.miminumDistanceMeters. In this case the distance will again be
 *      0.
 *   3. The feature is in the ocean and is not touching land. In this case, the
 *      returned distance will be from the closest point along the polygon or
 *      line (or just the input point) to the closest point along the shoreline
 *      of nearby land features.
 *
 *
 * @param feature GeoJSON feature to calculate distance to shore for. Supports
 * Points, Polygons, and Lines (including Multi* variants)
 * @param land FlatGeobuf source containing the land geometry. Features should
 * be subdivided to reasonable sizes, otherwise performance will be poor.
 * @param helpers Optional helpers object for logging and progress reporting.
 * @returns Object containing:
 *   - meters: Distance to shore in meters
 *   - geojsonLine: LineString from closest point on the subject feature to the
 *     closest point along the shoreline (or null when distance is 0 or
 *     unbounded).
 *   - rings: H3 cell indexes searched during the H3-based phase, grouped by
 *     ring distance from the origin (empty array when H3 search is not used).
 */
export async function calculateDistanceToShore(
  feature: GeoJSON.Feature,
  land: FlatGeobufSource<Feature<Polygon>>,
  options?: {
    helpers?: OverlayWorkerHelpers;
    miminumDistanceMeters?: number;
  }
) {
  const helpers = guaranteeHelpers(options?.helpers);

  if (!feature.geometry) {
    throw new Error("calculateDistanceToShore: feature.geometry is required");
  }

  const minimumDistanceMeters = options?.miminumDistanceMeters ?? 0;

  // ---------------------------------------------------------------------------
  // 1) Cheap initial proximity check using the FlatGeobuf spatial index
  // ---------------------------------------------------------------------------
  //
  // We first search for obviously overlapping or adjacent land using only the
  // R-tree index via land.search(). This is effectively an A* / graph-search
  // heuristic step: if we already know there is land within a very tight bbox
  // around the feature, there's no need to progressively expand via H3 cells.

  let envelopes: ReturnType<typeof bboxToEnvelope>[];

  if (feature.geometry.type === "Point") {
    // For points, expand the bbox slightly (in meters) so that we can
    // detect nearby shoreline segments as well as direct overlaps.
    const point = feature.geometry as Point;
    const pointBufferMeters = Math.max(
      MIN_POINT_BUFFER_METERS,
      minimumDistanceMeters
    );
    envelopes = envelopeAroundPoint(point, pointBufferMeters);
  } else {
    // For non-point geometries, use the feature bbox and make it
    // antimeridian-safe before querying the index.
    const rawBBox = bbox(feature.geometry as any);
    const cleaned = cleanBBox(rawBBox);
    const split = splitBBoxAntimeridian(
      cleaned as [number, number, number, number]
    );
    envelopes = split.map(bboxToEnvelope);
  }

  const estimate = land.search(
    envelopes.length === 1 ? (envelopes[0] as any) : (envelopes as any)
  );

  let bestMeters = Infinity;
  let bestOrigin: Position | null = null;
  let bestShoreline: Position | null = null;

  if (estimate.features > 0) {
    // There are candidate land features in the immediate vicinity.
    // Fetch them and compute exact distances.
    const seenOffsets = new Set<number>();

    const queryPlan = land.createPlan(
      envelopes.length === 1 ? (envelopes[0] as any) : (envelopes as any)
    );

    for await (const landFeature of land.getFeaturesAsync(
      envelopes.length === 1 ? (envelopes[0] as any) : (envelopes as any),
      { queryPlan }
    )) {
      const offset =
        (landFeature as any).properties &&
        (landFeature as any).properties.__offset;

      if (typeof offset === "number") {
        if (seenOffsets.has(offset)) {
          continue;
        }
        seenOffsets.add(offset);
      }

      // Exact "on land" / touching check.
      if (booleanIntersects(feature as any, landFeature as any)) {
        return {
          meters: 0,
          geojsonLine: null,
          rings: [] as H3Index[][],
        };
      }

      const path = nearestPointsBetweenGeometryAndPolygon(
        feature.geometry as Geometry,
        landFeature as any
      );

      if (path.meters < bestMeters) {
        bestMeters = path.meters;
        bestOrigin = path.origin;
        bestShoreline = path.shoreline;

        if (bestMeters <= minimumDistanceMeters) {
          return {
            meters: 0,
            geojsonLine:
              bestOrigin && bestShoreline
                ? {
                    type: "Feature",
                    geometry: {
                      type: "LineString",
                      coordinates: [bestOrigin, bestShoreline],
                    },
                    properties: {},
                  }
                : null,
            rings: [] as H3Index[][],
          };
        }
      }
    }

    if (bestMeters < Infinity && bestOrigin && bestShoreline) {
      return {
        meters: bestMeters,
        geojsonLine: {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [bestOrigin, bestShoreline],
          },
          properties: {},
        },
        rings: [] as H3Index[][],
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 2) Progressive H3-based graph search
  // ---------------------------------------------------------------------------
  //
  // If we didn't find land in the immediate bbox around the feature, we fall
  // back to a graph-search over the H3 grid. Conceptually:
  //
  //   - Nodes are H3 cells at a fixed resolution.
  //   - Edges connect neighboring cells (gridDisk with ring size 1).
  //   - The "origin" node(s) are the cells that cover the feature.
  //   - We expand outward ring by ring until we hit any cells whose bboxes
  //     intersect land features in the FlatGeobuf index.
  //
  // For the first ring that intersects land, we:
  //   - Fetch all land features in every such cell.
  //   - Run exact point / polygon distance via Turf.
  //   - Return the minimum of those distances.

  const h3Result = await searchNearestLandWithH3(
    feature as Feature,
    land,
    minimumDistanceMeters
  );

  if (h3Result.meters === Infinity) {
    // No land found within search radius. For now we return Infinity to signal
    // "unbounded distance"; callers can decide how to handle this.
    // If you'd prefer an explicit error instead, we can switch this to:
    //   throw new Error("No shoreline found within H3 search radius");
    helpers.log(
      "calculateDistanceToShore: no land found within H3 search radius"
    );
    return {
      meters: Infinity,
      geojsonLine: null,
      rings: h3Result.rings,
    };
  }

  const finalMeters =
    h3Result.meters <= minimumDistanceMeters ? 0 : h3Result.meters;

  return {
    meters: finalMeters,
    geojsonLine:
      h3Result.origin && h3Result.shoreline
        ? {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [h3Result.origin, h3Result.shoreline],
            },
            properties: {},
          }
        : null,
    // rings: h3Result.rings,
  };
}
