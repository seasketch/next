"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContainerIndex = void 0;
// @ts-ignore
const flatbush_1 = __importDefault(require("flatbush"));
const robust_segment_intersect_1 = __importDefault(require("robust-segment-intersect"));
const bbox_1 = __importDefault(require("@turf/bbox"));
const boolean_point_in_polygon_1 = __importDefault(require("@turf/boolean-point-in-polygon"));
const helpers_1 = require("@turf/helpers");
const bbox_polygon_1 = __importDefault(require("@turf/bbox-polygon"));
/**
 * ContainerIndex
 *  - Preprocesses the container polygon (or multipolygon)
 *  - Builds a Flatbush index of its boundary segments
 *  - Classifies candidate polygons in streaming fashion
 */
class ContainerIndex {
    constructor(container) {
        this.segsA = []; // segment endpoints A
        this.segsB = []; // segment endpoints B
        this.bboxPolygons = {
            type: "FeatureCollection",
            features: [],
        };
        this.container = container;
        this.rings = extractRings(container.geometry);
        this.containerBBox = (0, bbox_1.default)(container);
        // Build segment list & Flatbush index
        const boxes = [];
        const boxFeatures = [];
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
                boxFeatures.push((0, bbox_polygon_1.default)([minx, miny, maxx, maxy]));
            }
        }
        this.index = new flatbush_1.default(this.segsA.length);
        for (let i = 0; i < this.segsA.length; i++) {
            this.bboxPolygons.features.push((0, bbox_polygon_1.default)([
                boxes[4 * i],
                boxes[4 * i + 1],
                boxes[4 * i + 2],
                boxes[4 * i + 3],
            ]));
            this.index.add(boxes[4 * i], boxes[4 * i + 1], boxes[4 * i + 2], boxes[4 * i + 3]);
        }
        this.index.finish();
    }
    /**
     * Classify a candidate polygon:
     *  - 'outside': bbox disjoint OR all sampled vertices outside and no boundary crossings
     *  - 'inside':  no boundary crossings & all sampled vertices inside
     *  - 'mixed':   any edge crosses/touches container boundary OR vertex on boundary OR mixed inside/outside vertices
     */
    classify(candidate) {
        const candBBox = (0, bbox_1.default)(candidate);
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
                if ((0, robust_segment_intersect_1.default)([a[0], a[1]], [b[0], b[1]], [sa[0], sa[1]], [sb[0], sb[1]])) {
                    return "mixed";
                }
            }
        }
        // No boundary crossings: test multiple representative vertices
        // const vertices = sampleRepresentativeVertices(candidate.geometry, 1);
        const vertices = [firstVertex(candidate.geometry)];
        // console.log("vertices", vertices);
        let insideCount = 0;
        let outsideCount = 0;
        let boundaryCount = 0;
        for (const v of vertices) {
            // Treat boundary as mixed: ignoreBoundary=false (the default)
            const onOrIn = (0, boolean_point_in_polygon_1.default)((0, helpers_1.point)(v), this.container);
            if (onOrIn) {
                // Check if vertex is exactly on boundary
                if (pointOnAnyRingBoundary(v, this.rings)) {
                    boundaryCount++;
                }
                else {
                    insideCount++;
                }
            }
            else {
                outsideCount++;
            }
        }
        // If any vertex is on boundary, classify as mixed
        if (boundaryCount > 0)
            return "mixed";
        // If we have both inside and outside vertices, classify as mixed
        if (insideCount > 0 && outsideCount > 0)
            return "mixed";
        // If all vertices are outside, classify as outside
        if (outsideCount > 0)
            return "outside";
        // If all vertices are inside, classify as inside
        return "inside";
    }
    getBBoxPolygons() {
        return this.bboxPolygons;
    }
}
exports.ContainerIndex = ContainerIndex;
function bboxesOverlap(a, b) {
    // axis-aligned bbox overlap test
    return !(a[0] > b[2] || a[2] < b[0] || a[1] > b[3] || a[3] < b[1]);
}
function extractRings(geom) {
    if (geom.type === "Polygon") {
        return geom.coordinates.map(ensureClosed);
    }
    else if (geom.type === "MultiPolygon") {
        const rings = [];
        for (const poly of geom.coordinates) {
            for (const ring of poly)
                rings.push(ensureClosed(ring));
        }
        return rings;
    }
    throw new Error(`Unsupported geometry type: ${geom.type}`);
}
function ensureClosed(ring) {
    if (ring.length === 0)
        return ring;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] === last[0] && first[1] === last[1])
        return ring;
    const closed = ring.slice();
    closed.push([first[0], first[1]]);
    return closed;
}
function* iterateSegments(geom) {
    if (geom.type === "Polygon") {
        for (const ring of geom.coordinates) {
            const r = ensureClosed(ring);
            for (let i = 0; i < r.length - 1; i++)
                yield [r[i], r[i + 1]];
        }
    }
    else if (geom.type === "MultiPolygon") {
        for (const poly of geom.coordinates) {
            for (const ring of poly) {
                const r = ensureClosed(ring);
                for (let i = 0; i < r.length - 1; i++)
                    yield [r[i], r[i + 1]];
            }
        }
    }
    else {
        throw new Error(`Unsupported geometry type: ${geom.type}`);
    }
}
function firstVertex(geom) {
    if (geom.type === "Polygon") {
        const ring = ensureClosed(geom.coordinates[0]);
        return ring[0];
    }
    else if (geom.type === "MultiPolygon") {
        const ring = ensureClosed(geom.coordinates[0][0]);
        return ring[0];
    }
    throw new Error(`Unsupported geometry type: ${geom.type}`);
}
/**
 * Sample multiple representative vertices from a geometry to better determine
 * if it's inside, outside, or mixed relative to a container.
 *
 * Strategy: sample vertices from different parts of the polygon to avoid
 * misclassification due to complex shapes or unrepresentative first vertices.
 */
function sampleRepresentativeVertices(geom, maxSamples = 5) {
    const vertices = [];
    if (geom.type === "Polygon") {
        const ring = ensureClosed(geom.coordinates[0]);
        if (ring.length <= maxSamples) {
            // If polygon has few vertices, use them all
            for (let i = 0; i < ring.length - 1; i++) {
                vertices.push(ring[i]);
            }
        }
        else {
            // Sample vertices at regular intervals across the polygon
            for (let i = 0; i < maxSamples; i++) {
                const idx = Math.floor((i * (ring.length - 2)) / (maxSamples - 1));
                vertices.push(ring[idx]);
            }
        }
    }
    else if (geom.type === "MultiPolygon") {
        // For multipolygons, sample from each polygon
        let totalSamples = 0;
        for (const poly of geom.coordinates) {
            const ring = ensureClosed(poly[0]);
            if (ring.length <= 2)
                continue; // Skip degenerate polygons
            const samplesPerPoly = Math.max(1, Math.floor(maxSamples / geom.coordinates.length));
            if (ring.length <= samplesPerPoly) {
                // Use all vertices from this polygon
                for (let i = 0; i < ring.length - 1; i++) {
                    vertices.push(ring[i]);
                    totalSamples++;
                }
            }
            else {
                // Use the same robust sampling strategy
                const totalVertices = ring.length - 1; // Exclude closing vertex
                const samples = Math.min(samplesPerPoly, totalVertices);
                // Always include the first vertex
                vertices.push(ring[0]);
                totalSamples++;
                if (samples > 1) {
                    // Sample vertices at regular intervals across the polygon
                    for (let i = 1; i < samples && totalSamples < maxSamples; i++) {
                        const idx = Math.floor((i * totalVertices) / samples);
                        const clampedIdx = Math.min(idx, totalVertices - 1);
                        vertices.push(ring[clampedIdx]);
                        totalSamples++;
                    }
                }
            }
            if (totalSamples >= maxSamples)
                break;
        }
    }
    else {
        throw new Error(`Unsupported geometry type: ${geom.type}`);
    }
    return vertices;
}
// Optional: boundary check to treat vertex exactly on container edge as 'mixed'
function pointOnAnyRingBoundary(p, rings) {
    for (const ring of rings) {
        for (let i = 0; i < ring.length - 1; i++) {
            if (pointOnSegment(p, ring[i], ring[i + 1]))
                return true;
        }
    }
    return false;
}
// Simple collinearity + bounding-box check; for higher robustness,
// replace with an EPS-tolerant or exact orientation predicate.
function pointOnSegment(p, a, b, eps = 1e-12) {
    const [px, py] = p, [ax, ay] = a, [bx, by] = b;
    const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    if (Math.abs(cross) > eps)
        return false;
    const dot = (px - ax) * (bx - ax) + (py - ay) * (by - ay);
    if (dot < -eps)
        return false;
    const len2 = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
    if (dot - len2 > eps)
        return false;
    return true;
}
//# sourceMappingURL=containerIndex.js.map