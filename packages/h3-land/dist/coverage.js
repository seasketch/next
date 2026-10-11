"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DESCENDANT_REACH = void 0;
exports.ringArea = ringArea;
exports.clipToConvex = clipToConvex;
exports.clipRingsToCell = clipRingsToCell;
exports.cellReachBbox = cellReachBbox;
exports.ringsBbox = ringsBbox;
exports.bboxesOverlap = bboxesOverlap;
exports.hexAreaM2 = hexAreaM2;
exports.intersectionAreaM2 = intersectionAreaM2;
const h3_js_1 = require("h3-js");
const h3int_1 = require("./h3int");
/** Same radius the overlay engine uses for rough meter conversions. */
const EARTH_RADIUS_M = 6_371_008.8;
const METERS_PER_DEGREE = (EARTH_RADIUS_M * Math.PI) / 180;
function ringArea(ring) {
    let sum = 0;
    for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        const a = ring[i];
        const b = ring[j];
        sum += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(sum) / 2;
}
function signedArea(ring) {
    let sum = 0;
    for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        const a = ring[i];
        const b = ring[j];
        sum += a[0] * b[1] - b[0] * a[1];
    }
    return sum / 2;
}
function cross(a, b, p) {
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}
function lineIntersect(s, e, a, b) {
    const sx = e[0] - s[0];
    const sy = e[1] - s[1];
    const lx = b[0] - a[0];
    const ly = b[1] - a[1];
    const denom = sx * ly - sy * lx;
    if (Math.abs(denom) < 1e-12)
        return e;
    const t = ((a[0] - s[0]) * ly - (a[1] - s[1]) * lx) / denom;
    return [s[0] + sx * t, s[1] + sy * t];
}
/**
 * Sutherland–Hodgman clip of `subject` to a convex window.
 * The window is oriented counterclockwise. Area is in the same units as the points.
 */
function clipToConvex(subject, window) {
    if (subject.length < 3 || window.length < 3)
        return [];
    const clip = window.slice();
    if (signedArea(clip) < 0)
        clip.reverse();
    let output = subject.slice();
    const insideLimit = -1e-6;
    for (let i = 0; i < clip.length; i++) {
        const a = clip[i];
        const b = clip[(i + 1) % clip.length];
        const next = [];
        const inside = (p) => cross(a, b, p) >= insideLimit;
        for (let j = 0; j < output.length; j++) {
            const s = output[j];
            const e = output[(j + 1) % output.length];
            if (s[0] === e[0] && s[1] === e[1])
                continue;
            const sIn = inside(s);
            const eIn = inside(e);
            if (eIn) {
                if (!sIn)
                    next.push(lineIntersect(s, e, a, b));
                next.push(e);
            }
            else if (sIn) {
                next.push(lineIntersect(s, e, a, b));
            }
        }
        output = next;
        if (output.length < 3)
            return [];
    }
    return output;
}
function unwrapLng(lng, origin) {
    let x = lng;
    while (x - origin > 180)
        x -= 360;
    while (x - origin < -180)
        x += 360;
    return x;
}
function project(lng, lat, lng0, lat0) {
    const cos = Math.cos((lat0 * Math.PI) / 180);
    return [(lng - lng0) * METERS_PER_DEGREE * cos, (lat - lat0) * METERS_PER_DEGREE];
}
function dedupedOpen(ring) {
    const out = [];
    for (const point of ring) {
        const prev = out[out.length - 1];
        if (!prev || prev[0] !== point[0] || prev[1] !== point[1])
            out.push(point);
    }
    if (out.length > 1) {
        const first = out[0];
        const last = out[out.length - 1];
        if (first[0] === last[0] && first[1] === last[1])
            out.pop();
    }
    return out;
}
/**
 * Unwrap a ring around `lng0` and project it. When `window` (unwrapped
 * longitude/latitude box) is given, the ring is first clipped to that box.
 * The projection is affine in longitude and latitude, so clipping before
 * projecting is exact, and a continental ring shrinks to a few vertices
 * before the trigonometry runs.
 */
function prepareRing(ring, lng0, lat0, window) {
    if (ring.length < 3)
        return null;
    let unwrapped = [];
    let prevLng = unwrapLng(ring[0][0], lng0);
    unwrapped.push([prevLng, ring[0][1]]);
    for (let i = 1; i < ring.length; i++) {
        let lng = ring[i][0];
        while (lng - prevLng > 180)
            lng -= 360;
        while (lng - prevLng < -180)
            lng += 360;
        prevLng = lng;
        unwrapped.push([lng, ring[i][1]]);
    }
    if (window) {
        unwrapped = clipToConvex(unwrapped, window);
        if (unwrapped.length < 3)
            return null;
    }
    const projected = unwrapped.map((point) => project(point[0], point[1], lng0, lat0));
    const open = dedupedOpen(projected);
    return open.length >= 3 ? open : null;
}
/** Longitude/latitude box around a projected convex window, with a small margin. */
function windowBox(hex, lng0, lat0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of hex) {
        const [lng, lat] = unproject(point, lng0, lat0);
        if (lng < minX)
            minX = lng;
        if (lng > maxX)
            maxX = lng;
        if (lat < minY)
            minY = lat;
        if (lat > maxY)
            maxY = lat;
    }
    const padX = (maxX - minX) * 0.01;
    const padY = (maxY - minY) * 0.01;
    return [
        [minX - padX, minY - padY],
        [maxX + padX, minY - padY],
        [maxX + padX, maxY + padY],
        [minX - padX, maxY + padY],
    ];
}
function cellOrigin(h3) {
    const [lat, lng] = (0, h3_js_1.cellToLatLng)((0, h3int_1.intToCell)(h3));
    return [lng, lat];
}
/** Counterclockwise convex hull (Andrew's monotone chain). */
function convexHull(points) {
    if (points.length < 4)
        return points.slice();
    const sorted = points
        .slice()
        .sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
    const lower = [];
    for (const p of sorted) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
            lower.pop();
        }
        lower.push(p);
    }
    const upper = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
        const p = sorted[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
            upper.pop();
        }
        upper.push(p);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
}
/**
 * The cell outline as a convex clipping window. Cells next to a pentagon have
 * a distortion vertex that makes them slightly concave, which would break
 * Sutherland-Hodgman, so the hull is used. The sliver it adds is negligible.
 */
function hexRing(h3, lng0, lat0) {
    const boundary = (0, h3_js_1.cellToBoundary)((0, h3int_1.intToCell)(h3), true);
    const projected = boundary.map(([lng, lat]) => project(unwrapLng(lng, lng0), lat, lng0, lat0));
    const open = convexHull(dedupedOpen(projected));
    if (signedArea(open) < 0)
        open.reverse();
    return open;
}
function unproject(point, lng0, lat0) {
    const cos = Math.cos((lat0 * Math.PI) / 180);
    return [lng0 + point[0] / (METERS_PER_DEGREE * cos), lat0 + point[1] / METERS_PER_DEGREE];
}
/**
 * H3 children are not inside their parent's outline. Two levels down, the six
 * corner children sit half outside it. Scaling the parent hexagon about its
 * center by this factor covers every descendant two levels down, with margin.
 */
exports.DESCENDANT_REACH = 1.3;
/**
 * Polygon pieces of `rings` that lie inside the cell. The result is small even
 * when the source polygon is a continent, so finer cells can be measured
 * against it instead of against the original rings. `expand` scales the
 * clipping hexagon about the cell center; pass `DESCENDANT_REACH` when the
 * clipped polygon will be measured against descendants.
 */
function clipRingsToCell(rings, h3, expand = 1) {
    const [lng0, lat0] = cellOrigin(h3);
    const hex = hexRing(h3, lng0, lat0).map((point) => [point[0] * expand, point[1] * expand]);
    if (hex.length < 3)
        return null;
    const box = windowBox(hex, lng0, lat0);
    const outer = prepareRing(rings[0] ?? [], lng0, lat0, box);
    if (!outer)
        return null;
    const clippedOuter = clipToConvex(outer, hex);
    if (clippedOuter.length < 3)
        return null;
    const clipped = [clippedOuter.map((point) => unproject(point, lng0, lat0))];
    for (let i = 1; i < rings.length; i++) {
        const hole = prepareRing(rings[i] ?? [], lng0, lat0, box);
        if (!hole)
            continue;
        const clippedHole = clipToConvex(hole, hex);
        if (clippedHole.length >= 3) {
            clipped.push(clippedHole.map((point) => unproject(point, lng0, lat0)));
        }
    }
    return clipped;
}
/**
 * Longitude/latitude box around the cell scaled by `expand`, for a cheap
 * rejection before projecting a large ring.
 */
function cellReachBbox(h3, expand) {
    const [lng0, lat0] = cellOrigin(h3);
    let dLng = 0;
    let dLat = 0;
    for (const [lng, lat] of (0, h3_js_1.cellToBoundary)((0, h3int_1.intToCell)(h3), true)) {
        dLng = Math.max(dLng, Math.abs(unwrapLng(lng, lng0) - lng0));
        dLat = Math.max(dLat, Math.abs(lat - lat0));
    }
    return [lng0 - dLng * expand, lat0 - dLat * expand, lng0 + dLng * expand, lat0 + dLat * expand];
}
function ringsBbox(rings) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of rings[0] ?? []) {
        if (x < minX)
            minX = x;
        if (x > maxX)
            maxX = x;
        if (y < minY)
            minY = y;
        if (y > maxY)
            maxY = y;
    }
    return [minX, minY, maxX, maxY];
}
function bboxesOverlap(a, b) {
    return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}
/** Planar area of the cell in the same frame used for intersection. */
function hexAreaM2(h3) {
    const [lng0, lat0] = cellOrigin(h3);
    return ringArea(hexRing(h3, lng0, lat0));
}
/**
 * Area of `rings` (GeoJSON polygon coordinates, outer ring first) that lies
 * inside the cell. Holes are subtracted. The fraction of `hexAreaM2` is the
 * coverage used to tell partial from entire.
 */
function intersectionAreaM2(h3, rings) {
    const [lng0, lat0] = cellOrigin(h3);
    const hex = hexRing(h3, lng0, lat0);
    if (hex.length < 3)
        return 0;
    const box = windowBox(hex, lng0, lat0);
    const outer = prepareRing(rings[0] ?? [], lng0, lat0, box);
    if (!outer)
        return 0;
    let area = ringArea(clipToConvex(outer, hex));
    for (let i = 1; i < rings.length; i++) {
        const hole = prepareRing(rings[i] ?? [], lng0, lat0, box);
        if (!hole)
            continue;
        area -= ringArea(clipToConvex(hole, hex));
    }
    return area > 0 ? area : 0;
}
//# sourceMappingURL=coverage.js.map