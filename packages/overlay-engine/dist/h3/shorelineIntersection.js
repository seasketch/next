"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shorelineInsideSubject = shorelineInsideSubject;
const boolean_point_in_polygon_1 = __importDefault(require("@turf/boolean-point-in-polygon"));
const simplify_1 = __importDefault(require("@turf/simplify"));
const ON_SEGMENT = 1e-9;
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
 * The result is simplified so a coastal overlap is a short line, not the
 * full land ring.
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
    return (0, simplify_1.default)(feature, {
        tolerance: 0.00015,
        highQuality: true,
        mutate: false,
    });
}
//# sourceMappingURL=shorelineIntersection.js.map