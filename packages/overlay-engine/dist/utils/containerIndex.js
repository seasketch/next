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
        this.holeRings = extractHoleRings(container.geometry);
        this.containerBBox = (0, bbox_1.default)(container);
        // Precompute bboxes for holes (for cheap filtering)
        this.holeBBoxes = this.holeRings.map((ring) => {
            let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
            for (const pt of ring) {
                minx = Math.min(minx, pt[0]);
                miny = Math.min(miny, pt[1]);
                maxx = Math.max(maxx, pt[0]);
                maxy = Math.max(maxy, pt[1]);
            }
            return [minx, miny, maxx, maxy];
        });
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
        if (candidate.geometry.type === "Point" ||
            candidate.geometry.type === "MultiPoint") {
            const inside = this.pointInPolygon(candidate);
            if (inside) {
                return "inside";
            }
            else {
                return "outside";
            }
        }
        const candBBox = (0, bbox_1.default)(candidate);
        if (!bboxesOverlap(candBBox, this.containerBBox)) {
            return "outside";
        }
        const polygonCandidate = candidate;
        // Edge-crossing check (exact, robust). Any hit => 'mixed'
        for (const seg of iterateSegments(candidate.geometry)) {
            const [a, b] = seg;
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
        // If all vertices are outside, check if container is inside candidate
        // (cheap test: if candidate bbox contains container bbox, sample container points)
        if (outsideCount > 0) {
            if (bboxContains(candBBox, this.containerBBox)) {
                // Sample a few representative points from container to check if it's inside candidate
                const containerPoints = sampleRepresentativeVertices(this.container.geometry, 5);
                let containerInsideCount = 0;
                for (const pt of containerPoints) {
                    if ((0, boolean_point_in_polygon_1.default)((0, helpers_1.point)(pt), polygonCandidate)) {
                        containerInsideCount++;
                    }
                }
                // If at least one container point is inside candidate, it's mixed
                if (containerInsideCount > 0) {
                    return "mixed";
                }
            }
            return "outside";
        }
        // If all vertices are inside, check if candidate overlaps any holes
        if (insideCount > 0 && this.holeRings.length > 0) {
            // Check if candidate bbox overlaps any hole bboxes
            let hasHoleOverlap = false;
            for (let i = 0; i < this.holeRings.length; i++) {
                const holeBBox = this.holeBBoxes[i];
                if (bboxesOverlap(candBBox, holeBBox)) {
                    hasHoleOverlap = true;
                    break;
                }
            }
            if (hasHoleOverlap) {
                // Strategy 1: Sample points from candidate and check if any are inside holes
                const candidatePoints = sampleRepresentativeVertices(candidate.geometry, 5);
                for (const pt of candidatePoints) {
                    // Check if this point is inside any hole (which means it's "outside" the container)
                    // First filter by bbox overlap for efficiency
                    for (let i = 0; i < this.holeRings.length; i++) {
                        const holeBBox = this.holeBBoxes[i];
                        // Quick bbox check: if point is outside hole bbox, skip expensive test
                        if (pt[0] < holeBBox[0] ||
                            pt[0] > holeBBox[2] ||
                            pt[1] < holeBBox[1] ||
                            pt[1] > holeBBox[3]) {
                            continue;
                        }
                        // Point is within hole bbox, do precise point-in-polygon test
                        const holeRing = this.holeRings[i];
                        const holePoly = {
                            type: "Polygon",
                            coordinates: [holeRing],
                        };
                        const holeFeature = {
                            type: "Feature",
                            geometry: holePoly,
                            properties: {},
                        };
                        // If point is inside a hole, the candidate overlaps the hole
                        if ((0, boolean_point_in_polygon_1.default)((0, helpers_1.point)(pt), holeFeature)) {
                            return "mixed";
                        }
                    }
                }
                // Strategy 2: If candidate bbox contains a hole bbox, check if hole points are inside candidate
                // (catches case where candidate completely contains a hole)
                for (let i = 0; i < this.holeRings.length; i++) {
                    const holeBBox = this.holeBBoxes[i];
                    if (bboxContains(candBBox, holeBBox)) {
                        // Sample a few points from the hole and check if they're inside the candidate
                        const holeRing = this.holeRings[i];
                        const holePoints = sampleRepresentativeVertices({
                            type: "Polygon",
                            coordinates: [holeRing],
                        }, 3);
                        for (const holePt of holePoints) {
                            if ((0, boolean_point_in_polygon_1.default)((0, helpers_1.point)(holePt), polygonCandidate)) {
                                return "mixed";
                            }
                        }
                    }
                }
            }
        }
        // If all vertices are inside and no hole overlap detected, classify as inside
        return "inside";
    }
    /**
     * Test whether a point (or multipoint) feature is within the container polygon.
     * Uses the container bbox and hole bboxes for efficient filtering.
     *
     * @param pointFeature - A Point or MultiPoint feature to test
     * @returns For Point: true if the point is inside the container (and not in any holes).
     *          For MultiPoint: true if ANY point is inside the container (and not in any holes).
     */
    pointInPolygon(pointFeature) {
        const geom = pointFeature.geometry;
        if (geom.type === "Point") {
            return this.pointInPolygonSingle(geom.coordinates);
        }
        else if (geom.type === "MultiPoint") {
            // For MultiPoint, return true if ANY point is inside
            for (const coord of geom.coordinates) {
                if (this.pointInPolygonSingle(coord)) {
                    return true;
                }
            }
            return false;
        }
        else {
            throw new Error(`Unsupported geometry type: ${geom["type"]}. Expected Point or MultiPoint.`);
        }
    }
    /**
     * Test whether a single point coordinate is within the container polygon.
     * Uses bbox filtering and hole bboxes for efficiency.
     */
    pointInPolygonSingle(coord) {
        const [x, y] = coord;
        // Quick bbox rejection: if point is outside container bbox, it's definitely outside
        if (x < this.containerBBox[0] ||
            x > this.containerBBox[2] ||
            y < this.containerBBox[1] ||
            y > this.containerBBox[3]) {
            return false;
        }
        // Check if point is inside the container polygon
        const point = (0, helpers_1.point)(coord);
        if (!(0, boolean_point_in_polygon_1.default)(point, this.container)) {
            return false;
        }
        // If there are holes, check if the point is inside any hole
        // (if so, it's outside the container)
        if (this.holeRings.length > 0) {
            // Use hole bboxes for efficient filtering
            for (let i = 0; i < this.holeRings.length; i++) {
                const holeBBox = this.holeBBoxes[i];
                // Quick bbox check: if point is outside hole bbox, skip expensive test
                if (x < holeBBox[0] ||
                    x > holeBBox[2] ||
                    y < holeBBox[1] ||
                    y > holeBBox[3]) {
                    continue;
                }
                // Point is within hole bbox, do precise point-in-polygon test
                const holeRing = this.holeRings[i];
                const holePoly = {
                    type: "Polygon",
                    coordinates: [holeRing],
                };
                const holeFeature = {
                    type: "Feature",
                    geometry: holePoly,
                    properties: {},
                };
                // If point is inside a hole, it's outside the container
                if ((0, boolean_point_in_polygon_1.default)(point, holeFeature)) {
                    return false;
                }
            }
        }
        return true;
    }
    getBBoxPolygons() {
        const result = {
            type: "FeatureCollection",
            features: [...this.bboxPolygons.features],
        };
        // Add hole bboxes
        for (const holeBBox of this.holeBBoxes) {
            result.features.push((0, bbox_polygon_1.default)(holeBBox));
        }
        return result;
    }
}
exports.ContainerIndex = ContainerIndex;
function bboxesOverlap(a, b) {
    // axis-aligned bbox overlap test
    return !(a[0] > b[2] || a[2] < b[0] || a[1] > b[3] || a[3] < b[1]);
}
function bboxContains(outer, inner) {
    // Check if outer bbox completely contains inner bbox
    return (outer[0] <= inner[0] &&
        outer[1] <= inner[1] &&
        outer[2] >= inner[2] &&
        outer[3] >= inner[3]);
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
function extractHoleRings(geom) {
    const holes = [];
    if (geom.type === "Polygon") {
        // Skip first ring (outer), collect rest (holes)
        for (let i = 1; i < geom.coordinates.length; i++) {
            holes.push(ensureClosed(geom.coordinates[i]));
        }
    }
    else if (geom.type === "MultiPolygon") {
        for (const poly of geom.coordinates) {
            // Skip first ring (outer), collect rest (holes)
            for (let i = 1; i < poly.length; i++) {
                holes.push(ensureClosed(poly[i]));
            }
        }
    }
    else {
        throw new Error(`Unsupported geometry type: ${geom.type}`);
    }
    return holes;
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