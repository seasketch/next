"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shorelineInsideSubject = shorelineInsideSubject;
const boolean_point_in_polygon_1 = __importDefault(require("@turf/boolean-point-in-polygon"));
const simplify_1 = __importDefault(require("@turf/simplify"));
const truncate_1 = __importDefault(require("@turf/truncate"));
const ON_SEGMENT = 1e-9;
/** Detail kept for a short overlap, in degrees. About 17 m. */
const SHORT_COAST_TOLERANCE = 0.00015;
/**
 * Past this many vertices the shore is a cloud of clipped land edges.
 * Simplify cannot shorten a two-point edge, so long results are rounded
 * to 0.01° (about 1 km) for the map.
 */
const COARSE_VERTEX_LIMIT = 400;
function ringsOf(geometry) {
    if (geometry.type === "Polygon")
        return geometry.coordinates;
    return geometry.coordinates.flat();
}
function isPolygonal(geometry) {
    return geometry?.type === "Polygon" || geometry?.type === "MultiPolygon";
}
function pointAt(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function samePoint(a, b) {
    return Math.abs(a[0] - b[0]) < 1e-10 && Math.abs(a[1] - b[1]) < 1e-10;
}
/** Intersection of segments ab and cd, as a parameter along ab. */
function crossParameter(a, b, c, d) {
    const rx = b[0] - a[0];
    const ry = b[1] - a[1];
    const sx = d[0] - c[0];
    const sy = d[1] - c[1];
    const denom = rx * sy - ry * sx;
    if (Math.abs(denom) < 1e-14)
        return null;
    const qpx = c[0] - a[0];
    const qpy = c[1] - a[1];
    const t = (qpx * sy - qpy * sx) / denom;
    const u = (qpx * ry - qpy * rx) / denom;
    if (t < -ON_SEGMENT || t > 1 + ON_SEGMENT)
        return null;
    if (u < -ON_SEGMENT || u > 1 + ON_SEGMENT)
        return null;
    return Math.min(1, Math.max(0, t));
}
/**
 * Portion of cd that lies on ab, as parameters along ab. Null when the
 * segments are not collinear or do not overlap.
 */
function overlapParameters(a, b, c, d) {
    const rx = b[0] - a[0];
    const ry = b[1] - a[1];
    const len2 = rx * rx + ry * ry;
    if (len2 === 0)
        return null;
    const sx = d[0] - c[0];
    const sy = d[1] - c[1];
    const cross = rx * sy - ry * sx;
    const qpx = c[0] - a[0];
    const qpy = c[1] - a[1];
    if (Math.abs(cross) > 1e-12 || Math.abs(qpx * ry - qpy * rx) > 1e-12) {
        return null;
    }
    const project = (p) => ((p[0] - a[0]) * rx + (p[1] - a[1]) * ry) / len2;
    const t0 = project(c);
    const t1 = project(d);
    const lo = Math.max(0, Math.min(t0, t1));
    const hi = Math.min(1, Math.max(t0, t1));
    if (hi - lo < 1e-12)
        return null;
    return [lo, hi];
}
function insideSubject(point, subject) {
    return (0, boolean_point_in_polygon_1.default)(point, subject, { ignoreBoundary: false });
}
/**
 * Shoreline of `landFeatures` that lies inside or on `subject`.
 * A short overlap keeps fine detail. A long one is thousands of separate
 * land edges; those are rounded to about a kilometer so the highlight
 * stays drawable and under the queue size limit.
 */
function shorelineInsideSubject(subject, landFeatures) {
    const subjectGeometry = subject.geometry;
    if (!isPolygonal(subjectGeometry))
        return null;
    const subjectFeature = subject;
    const sketchRings = ringsOf(subjectGeometry);
    const lines = [];
    for (const land of landFeatures) {
        if (!isPolygonal(land.geometry))
            continue;
        let current = null;
        const flush = () => {
            if (current && current.length >= 2)
                lines.push(current);
            current = null;
        };
        for (const ring of ringsOf(land.geometry)) {
            for (let i = 0; i < ring.length - 1; i++) {
                const a = ring[i];
                const b = ring[i + 1];
                const marks = new Set();
                if (insideSubject(a, subjectFeature))
                    marks.add(0);
                if (insideSubject(b, subjectFeature))
                    marks.add(1);
                for (const sketchRing of sketchRings) {
                    for (let j = 0; j < sketchRing.length - 1; j++) {
                        const c = sketchRing[j];
                        const d = sketchRing[j + 1];
                        const cross = crossParameter(a, b, c, d);
                        if (cross != null)
                            marks.add(cross);
                        const overlap = overlapParameters(a, b, c, d);
                        if (overlap) {
                            marks.add(overlap[0]);
                            marks.add(overlap[1]);
                        }
                    }
                }
                const ordered = Array.from(marks).sort((left, right) => left - right);
                for (let k = 0; k < ordered.length - 1; k++) {
                    const t0 = ordered[k];
                    const t1 = ordered[k + 1];
                    if (t1 - t0 < 1e-12)
                        continue;
                    const mid = pointAt(a, b, (t0 + t1) / 2);
                    if (!insideSubject(mid, subjectFeature)) {
                        flush();
                        continue;
                    }
                    const start = pointAt(a, b, t0);
                    const end = pointAt(a, b, t1);
                    if (current && samePoint(current[current.length - 1], start)) {
                        current.push(end);
                    }
                    else {
                        flush();
                        current = [start, end];
                    }
                }
                if (!insideSubject(b, subjectFeature))
                    flush();
            }
            flush();
        }
    }
    if (lines.length === 0)
        return null;
    const geometry = lines.length === 1
        ? { type: "LineString", coordinates: lines[0] }
        : { type: "MultiLineString", coordinates: lines };
    const feature = {
        type: "Feature",
        properties: {},
        geometry,
    };
    return coastlineForDisplay(feature);
}
function vertexCount(geometry) {
    if (geometry.type === "LineString")
        return geometry.coordinates.length;
    return geometry.coordinates.reduce((sum, line) => sum + line.length, 0);
}
function lineParts(geometry) {
    return geometry.type === "LineString"
        ? [geometry.coordinates]
        : geometry.coordinates;
}
function withoutDuplicateEdges(lines) {
    const seen = new Set();
    const kept = [];
    for (const line of lines) {
        const cleaned = [];
        for (const point of line) {
            const previous = cleaned[cleaned.length - 1];
            if (previous && previous[0] === point[0] && previous[1] === point[1]) {
                continue;
            }
            cleaned.push(point);
        }
        if (cleaned.length < 2)
            continue;
        if (cleaned.length === 2) {
            const start = cleaned[0];
            const end = cleaned[1];
            const forward = start[0] < end[0] || (start[0] === end[0] && start[1] <= end[1]);
            const key = forward
                ? `${start[0]},${start[1]},${end[0]},${end[1]}`
                : `${end[0]},${end[1]},${start[0]},${start[1]}`;
            if (seen.has(key))
                continue;
            seen.add(key);
        }
        kept.push(cleaned);
    }
    return kept;
}
function featureFromLines(lines) {
    if (lines.length === 0)
        return null;
    if (lines.length === 1) {
        return {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: lines[0] },
        };
    }
    return {
        type: "Feature",
        properties: {},
        geometry: { type: "MultiLineString", coordinates: lines },
    };
}
function coastlineForDisplay(feature) {
    if (vertexCount(feature.geometry) <= COARSE_VERTEX_LIMIT) {
        return featureFromLines(withoutDuplicateEdges(lineParts((0, simplify_1.default)(feature, {
            tolerance: SHORT_COAST_TOLERANCE,
            highQuality: true,
            mutate: false,
        }).geometry)));
    }
    const truncated = (0, truncate_1.default)(feature, {
        precision: 2,
        coordinates: 2,
        mutate: false,
    });
    const stripped = featureFromLines(withoutDuplicateEdges(lineParts(truncated.geometry)));
    if (!stripped)
        return null;
    try {
        return featureFromLines(withoutDuplicateEdges(lineParts((0, simplify_1.default)(stripped, {
            tolerance: 0.01,
            highQuality: false,
            mutate: false,
        }).geometry)));
    }
    catch {
        return stripped;
    }
}
//# sourceMappingURL=shorelineIntersection.js.map