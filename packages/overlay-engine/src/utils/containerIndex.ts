// @ts-ignore
import Flatbush from "flatbush";
import segIntersect from "robust-segment-intersect";
import turfBbox from "@turf/bbox";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";

import type {
  Feature,
  Polygon,
  MultiPolygon,
  Position,
  BBox,
  Geometry,
} from "geojson";
import bboxPolygon from "@turf/bbox-polygon";

type Pt = Position; // [x, y]
type LinearRing = Pt[];
type Rings = LinearRing[];

export type ContainerFeature = Feature<Polygon | MultiPolygon>;
export type CandidateFeature = Feature<Polygon | MultiPolygon>;
export type Classification = "inside" | "outside" | "mixed";

/**
 * ContainerIndex
 *  - Preprocesses the container polygon (or multipolygon)
 *  - Builds a Flatbush index of its boundary segments
 *  - Classifies candidate polygons in streaming fashion
 */
export class ContainerIndex {
  private container: ContainerFeature;
  private containerBBox: BBox; // [minX, minY, maxX, maxY]
  private rings: Rings; // all rings (outer + holes), closed
  private segsA: Pt[] = []; // segment endpoints A
  private segsB: Pt[] = []; // segment endpoints B
  private index: Flatbush;

  constructor(container: ContainerFeature) {
    this.container = container;
    this.rings = extractRings(container.geometry);
    this.containerBBox = turfBbox(container);

    // Build segment list & Flatbush index
    const boxes: number[] = [];
    const boxFeatures: Feature<Polygon>[] = [];
    for (const ring of this.rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i];
        const b = ring[i + 1];
        this.segsA.push(a);
        this.segsB.push(b);
        const minx = Math.min(a[0], b[0]);
        const miny = Math.min(a[1], b[1]);
        const maxx = Math.max(a[0], b[0]);
        const maxy = Math.max(a[1], b[1]);
        boxes.push(minx, miny, maxx, maxy);
        boxFeatures.push(bboxPolygon([minx, miny, maxx, maxy]));
      }
    }
    this.index = new Flatbush(this.segsA.length);
    for (let i = 0; i < this.segsA.length; i++) {
      this.index.add(
        boxes[4 * i],
        boxes[4 * i + 1],
        boxes[4 * i + 2],
        boxes[4 * i + 3]
      );
    }
    this.index.finish();
  }

  /**
   * Classify a candidate polygon:
   *  - 'outside': bbox disjoint OR vertex outside and no boundary crossings
   *  - 'inside':  no boundary crossings & vertex inside
   *  - 'mixed':   any edge crosses/touches container boundary OR vertex on boundary
   */
  classify(candidate: CandidateFeature): Classification {
    const candBBox = turfBbox(candidate);
    if (!bboxesOverlap(candBBox, this.containerBBox)) {
      return "outside";
    }

    // Edge-crossing check (exact, robust). Any hit => 'mixed'
    for (const [a, b] of iterateSegments(candidate.geometry)) {
      const minx = Math.min(a[0], b[0]);
      const miny = Math.min(a[1], b[1]);
      const maxx = Math.max(a[0], b[0]);
      const maxy = Math.max(a[1], b[1]);
      const hits = this.index.search(minx, miny, maxx, maxy);
      for (const h of hits) {
        const sa = this.segsA[h];
        const sb = this.segsB[h];
        // robust-segment-intersect treats touching as true
        // Convert Position to Coord (only x,y coordinates)
        if (
          segIntersect(
            [a[0], a[1]],
            [b[0], b[1]],
            [sa[0], sa[1]],
            [sb[0], sb[1]]
          )
        ) {
          return "mixed";
        }
      }
    }

    // No boundary crossings: one vertex test decides
    const v = firstVertex(candidate.geometry);
    // Treat boundary as mixed: ignoreBoundary=false (the default)
    const onOrIn = booleanPointInPolygon(turfPoint(v), this.container);
    if (!onOrIn) return "outside";

    // booleanPointInPolygon doesn't directly tell on-boundary vs strictly inside.
    // If you need to distinguish, run a precise point-on-segment test here.
    // For most workflows, counting boundary as 'mixed' is safer:
    if (pointOnAnyRingBoundary(v, this.rings)) return "mixed";

    return "inside";
  }
}

function bboxesOverlap(a: BBox, b: BBox): boolean {
  // axis-aligned bbox overlap test
  return !(a[0] > b[2] || a[2] < b[0] || a[1] > b[3] || a[3] < b[1]);
}

function extractRings(geom: Geometry): Rings {
  if (geom.type === "Polygon") {
    return geom.coordinates.map(ensureClosed);
  } else if (geom.type === "MultiPolygon") {
    const rings: Rings = [];
    for (const poly of geom.coordinates) {
      for (const ring of poly) rings.push(ensureClosed(ring));
    }
    return rings;
  }
  throw new Error(`Unsupported geometry type: ${geom.type}`);
}

function ensureClosed(ring: LinearRing): LinearRing {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  const closed = ring.slice();
  closed.push([first[0], first[1]]);
  return closed;
}

function* iterateSegments(geom: Geometry): Generator<[Pt, Pt]> {
  if (geom.type === "Polygon") {
    for (const ring of geom.coordinates) {
      const r = ensureClosed(ring);
      for (let i = 0; i < r.length - 1; i++) yield [r[i], r[i + 1]];
    }
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) {
      for (const ring of poly) {
        const r = ensureClosed(ring);
        for (let i = 0; i < r.length - 1; i++) yield [r[i], r[i + 1]];
      }
    }
  } else {
    throw new Error(`Unsupported geometry type: ${geom.type}`);
  }
}

function firstVertex(geom: Geometry): Pt {
  if (geom.type === "Polygon") {
    const ring = ensureClosed(geom.coordinates[0]);
    return ring[0];
  } else if (geom.type === "MultiPolygon") {
    const ring = ensureClosed(geom.coordinates[0][0]);
    return ring[0];
  }
  throw new Error(`Unsupported geometry type: ${geom.type}`);
}

// Optional: boundary check to treat vertex exactly on container edge as 'mixed'
function pointOnAnyRingBoundary(p: Pt, rings: Rings): boolean {
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      if (pointOnSegment(p, ring[i], ring[i + 1])) return true;
    }
  }
  return false;
}

// Simple collinearity + bounding-box check; for higher robustness,
// replace with an EPS-tolerant or exact orientation predicate.
function pointOnSegment(p: Pt, a: Pt, b: Pt, eps = 1e-12): boolean {
  const [px, py] = p,
    [ax, ay] = a,
    [bx, by] = b;
  const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  if (Math.abs(cross) > eps) return false;
  const dot = (px - ax) * (bx - ax) + (py - ay) * (by - ay);
  if (dot < -eps) return false;
  const len2 = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
  if (dot - len2 > eps) return false;
  return true;
}
