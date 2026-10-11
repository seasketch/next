"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.portalBetween = portalBetween;
exports.pullString = pullString;
exports.departurePoint = departurePoint;
exports.straightenWaterPath = straightenWaterPath;
const distance_1 = __importDefault(require("@turf/distance"));
const h3_js_1 = require("h3-js");
const adaptiveGrid_1 = require("./adaptiveGrid");
const WATER_PATH_FINE_RESOLUTION = 8;
const METERS_PER_DEG_LAT = 111320;
function wrapLng(lng) {
    return ((((lng + 180) % 360) + 360) % 360) - 180;
}
function toLocal(pos, refLat, refLng) {
    let lng = pos[0];
    while (lng - refLng > 180)
        lng -= 360;
    while (lng - refLng < -180)
        lng += 360;
    const scale = Math.cos((refLat * Math.PI) / 180);
    return {
        x: (lng - refLng) * METERS_PER_DEG_LAT * (scale || 1),
        y: (pos[1] - refLat) * METERS_PER_DEG_LAT,
    };
}
function fromLocal(point, refLat, refLng) {
    const scale = Math.cos((refLat * Math.PI) / 180) || 1;
    const lng = refLng + point.x / (METERS_PER_DEG_LAT * scale);
    const lat = refLat + point.y / METERS_PER_DEG_LAT;
    return [wrapLng(lng), lat];
}
function cross(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function samePoint(a, b) {
    return Math.abs(a.x - b.x) < 0.05 && Math.abs(a.y - b.y) < 0.05;
}
function cellCenter(cell) {
    const [lat, lng] = (0, h3_js_1.cellToLatLng)(cell);
    return [wrapLng(lng), lat];
}
function boundaryRing(cell) {
    return (0, h3_js_1.cellToBoundary)(cell, true).map(([lng, lat]) => [wrapLng(lng), lat]);
}
function vertexKey(position) {
    return `${position[0].toFixed(4)},${position[1].toFixed(4)}`;
}
function midpoint(a, b) {
    const localB = toLocal(b, a[1], a[0]);
    return fromLocal({ x: localB.x / 2, y: localB.y / 2 }, a[1], a[0]);
}
function oneContainsOther(a, b) {
    const resolutionA = (0, h3_js_1.getResolution)(a);
    const resolutionB = (0, h3_js_1.getResolution)(b);
    if (resolutionA === resolutionB)
        return false;
    if (resolutionA < resolutionB)
        return (0, h3_js_1.cellToParent)(b, resolutionA) === a;
    return (0, h3_js_1.cellToParent)(a, resolutionB) === b;
}
function facingEdge(cell, toward) {
    const ring = boundaryRing(cell);
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < ring.length; i++) {
        const mid = midpoint(ring[i], ring[(i + 1) % ring.length]);
        const span = (0, distance_1.default)(mid, toward, { units: "meters" });
        if (span < bestDistance) {
            bestDistance = span;
            best = i;
        }
    }
    return [ring[best], ring[(best + 1) % ring.length]];
}
function sharedEdge(a, b) {
    const ringA = boundaryRing(a);
    const keysB = new Set(boundaryRing(b).map(vertexKey));
    for (let i = 0; i < ringA.length; i++) {
        const start = ringA[i];
        const end = ringA[(i + 1) % ringA.length];
        if (keysB.has(vertexKey(start)) && keysB.has(vertexKey(end))) {
            return [start, end];
        }
    }
    return null;
}
function orientPortal(from, to, start, end) {
    const origin = toLocal(from, from[1], from[0]);
    const aim = toLocal(to, from[1], from[0]);
    const left = toLocal(start, from[1], from[0]);
    const right = toLocal(end, from[1], from[0]);
    const mid = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
    const forward = { x: aim.x - origin.x, y: aim.y - origin.y };
    const score = forward.x * (left.y - mid.y) - forward.y * (left.x - mid.x);
    if (score >= 0)
        return { left: start, right: end };
    return { left: end, right: start };
}
/**
 * The hex edge crossed when moving from `from` to `to`, oriented so `left`
 * is on the left of the direction of travel. Parent/child steps are not
 * crossings.
 */
function portalBetween(from, to) {
    if (from === to || oneContainsOther(from, to))
        return null;
    const edge = sharedEdge(from, to) ??
        facingEdge((0, h3_js_1.getResolution)(from) >= (0, h3_js_1.getResolution)(to) ? from : to, cellCenter((0, h3_js_1.getResolution)(from) >= (0, h3_js_1.getResolution)(to) ? to : from));
    return orientPortal(cellCenter(from), cellCenter(to), edge[0], edge[1]);
}
function dedupe(coords) {
    const out = [];
    for (const coord of coords) {
        const prev = out[out.length - 1];
        if (prev &&
            (0, distance_1.default)(prev, coord, { units: "meters" }) < 5) {
            continue;
        }
        out.push(coord);
    }
    return out;
}
function removeColinear(coords) {
    if (coords.length < 3)
        return coords;
    const out = [coords[0]];
    for (let i = 1; i < coords.length - 1; i++) {
        const prev = out[out.length - 1];
        const next = coords[i + 1];
        const origin = toLocal(prev, prev[1], prev[0]);
        const mid = toLocal(coords[i], prev[1], prev[0]);
        const aim = toLocal(next, prev[1], prev[0]);
        if (Math.abs(cross(origin, mid, aim)) > 250) {
            out.push(coords[i]);
        }
    }
    out.push(coords[coords.length - 1]);
    return out;
}
/**
 * Taut string through a channel of portals. In open water this collapses to
 * a straight line. Around land it bends only at portal corners.
 */
function pullString(origin, portals, end) {
    const refLat = origin[1];
    const refLng = origin[0];
    const toXY = (position) => toLocal(position, refLat, refLng);
    const channel = portals.map((portal) => ({
        left: toXY(portal.left),
        right: toXY(portal.right),
    }));
    const endXY = toXY(end);
    channel.push({ left: endXY, right: endXY });
    const start = toXY(origin);
    const path = [start];
    let apex = start;
    let left = start;
    let right = start;
    let leftIndex = 0;
    let rightIndex = 0;
    let guard = 0;
    const epsilon = 1;
    for (let i = 0; i < channel.length; i++) {
        if (++guard > channel.length * 8)
            break;
        const portalRight = channel[i].right;
        const portalLeft = channel[i].left;
        if (samePoint(apex, right) || cross(apex, right, portalRight) >= -epsilon) {
            if (samePoint(apex, left) || cross(apex, left, portalRight) <= epsilon) {
                right = portalRight;
                rightIndex = i;
            }
            else {
                path.push(left);
                apex = left;
                const restartAt = leftIndex;
                left = apex;
                right = apex;
                leftIndex = restartAt;
                rightIndex = restartAt;
                i = restartAt;
                continue;
            }
        }
        if (samePoint(apex, left) || cross(apex, left, portalLeft) <= epsilon) {
            if (samePoint(apex, right) || cross(apex, right, portalLeft) >= -epsilon) {
                left = portalLeft;
                leftIndex = i;
            }
            else {
                path.push(right);
                apex = right;
                const restartAt = rightIndex;
                left = apex;
                right = apex;
                leftIndex = restartAt;
                rightIndex = restartAt;
                i = restartAt;
                continue;
            }
        }
    }
    path.push(endXY);
    return removeColinear(dedupe(path.map((point) => fromLocal(point, refLat, refLng))));
}
function addRing(ring, segments) {
    for (let i = 0; i < ring.length - 1; i++) {
        const start = ring[i];
        const end = ring[i + 1];
        if (start[0] === end[0] && start[1] === end[1])
            continue;
        segments.push([start, end]);
    }
}
function boundarySegments(geometry) {
    const segments = [];
    switch (geometry.type) {
        case "LineString":
            addRing(geometry.coordinates, segments);
            break;
        case "MultiLineString":
            for (const line of geometry.coordinates) {
                addRing(line, segments);
            }
            break;
        case "Polygon":
            for (const ring of geometry.coordinates) {
                addRing(ring, segments);
            }
            break;
        case "MultiPolygon":
            for (const poly of geometry.coordinates) {
                for (const ring of poly)
                    addRing(ring, segments);
            }
            break;
        default:
            break;
    }
    return segments;
}
function closestOnSegment(start, end, target) {
    const origin = toLocal(start, target[1], target[0]);
    const aim = toLocal(end, target[1], target[0]);
    const dx = aim.x - origin.x;
    const dy = aim.y - origin.y;
    const length2 = dx * dx + dy * dy;
    let t = 0;
    if (length2 > 0) {
        t = (-origin.x * dx + -origin.y * dy) / length2;
        t = Math.max(0, Math.min(1, t));
    }
    return fromLocal({ x: origin.x + dx * t, y: origin.y + dy * t }, target[1], target[0]);
}
function cellOf(position) {
    return (0, h3_js_1.latLngToCell)(position[1], wrapLng(position[0]), WATER_PATH_FINE_RESOLUTION);
}
/**
 * Point on the subject boundary where the water route leaves. Shore distance
 * uses the same idea: the line starts on an edge, not inside the polygon.
 */
function departurePoint(geometry, startCell, aim) {
    if (geometry.type === "Point")
        return geometry.coordinates;
    if (geometry.type === "MultiPoint") {
        const points = geometry.coordinates;
        let best = points[0] ?? aim;
        let bestDistance = Infinity;
        for (const point of points) {
            const span = (0, distance_1.default)(point, aim, { units: "meters" });
            if (span < bestDistance) {
                bestDistance = span;
                best = point;
            }
        }
        return best;
    }
    const neighborhood = new Set([
        startCell,
        ...(0, adaptiveGrid_1.sameResNeighbors)(startCell),
    ]);
    let best = null;
    let bestDistance = Infinity;
    for (const [start, end] of boundarySegments(geometry)) {
        const projected = closestOnSegment(start, end, aim);
        const candidates = [projected, start, end].filter((position) => neighborhood.has(cellOf(position)));
        for (const candidate of candidates) {
            const span = (0, distance_1.default)(candidate, aim, { units: "meters" });
            if (span < bestDistance) {
                bestDistance = span;
                best = candidate;
            }
        }
    }
    if (best)
        return best;
    let fallback = null;
    let fallbackDistance = Infinity;
    for (const [start, end] of boundarySegments(geometry)) {
        const projected = closestOnSegment(start, end, aim);
        const span = (0, distance_1.default)(projected, aim, { units: "meters" });
        if (span < fallbackDistance) {
            fallbackDistance = span;
            fallback = projected;
        }
    }
    return fallback ?? aim;
}
async function lineHitsLand(coords, segmentHitsLand) {
    for (let i = 1; i < coords.length; i++) {
        if (await segmentHitsLand(coords[i - 1], coords[i]))
            return true;
    }
    return false;
}
async function lineOfSight(coords, segmentHitsLand) {
    if (coords.length <= 2)
        return coords;
    const out = [coords[0]];
    let cursor = 0;
    while (cursor < coords.length - 1) {
        let farthest = coords.length - 1;
        while (farthest > cursor + 1 &&
            (await segmentHitsLand(coords[cursor], coords[farthest]))) {
            farthest--;
        }
        out.push(coords[farthest]);
        cursor = farthest;
    }
    return out;
}
function lerpPosition(start, end, t) {
    const local = toLocal(end, start[1], start[0]);
    return fromLocal({ x: local.x * t, y: local.y * t }, start[1], start[0]);
}
/**
 * Slide each bend toward the straight chord until the adjacent segments
 * touch land. The hex corridor bends early; this pulls the line onto the
 * shoreline tangent instead of the hex corner.
 */
async function pullTowardChord(path, segmentHitsLand) {
    let current = path.slice();
    for (let pass = 0; pass < 6; pass++) {
        if (current.length <= 2)
            break;
        const origin = current[0];
        const port = current[current.length - 1];
        const next = current.slice();
        let moved = false;
        for (let i = 1; i < current.length - 1; i++) {
            const from = current[i];
            const projection = closestOnSegment(origin, port, from);
            if ((0, distance_1.default)(from, projection, { units: "meters" }) < 40)
                continue;
            let low = 0;
            let high = 1;
            let best = 0;
            for (let step = 0; step < 10; step++) {
                const mid = (low + high) / 2;
                const candidate = lerpPosition(from, projection, mid);
                const blocked = (await segmentHitsLand(current[i - 1], candidate)) ||
                    (await segmentHitsLand(candidate, current[i + 1]));
                if (blocked)
                    high = mid;
                else {
                    low = mid;
                    best = mid;
                }
            }
            if (best > 0.02) {
                next[i] = lerpPosition(from, projection, best);
                moved = true;
            }
        }
        const candidate = removeColinear(dedupe(next));
        if (moved && (await lineHitsLand(candidate, segmentHitsLand)))
            break;
        current = candidate;
        if (!moved)
            break;
    }
    return current;
}
/**
 * Feasible route through the hex corridor, then pulled toward the straight
 * chord until land stops it. The reported distance is the length of this line.
 */
async function straightenWaterPath(geometry, chain, port, segmentHitsLand) {
    if (chain.length === 0)
        return [port];
    const portals = [];
    for (let i = 0; i < chain.length - 1; i++) {
        const portal = portalBetween(chain[i], chain[i + 1]);
        if (portal)
            portals.push(portal);
    }
    const aim = portals.length > 0
        ? midpoint(portals[0].left, portals[0].right)
        : port;
    const origin = departurePoint(geometry, chain[0], aim);
    const pulled = pullString(origin, portals, port);
    const base = (await lineHitsLand(pulled, segmentHitsLand))
        ? await lineOfSight(dedupe([origin, ...chain.map((cell) => cellCenter(cell)), port]), segmentHitsLand)
        : pulled;
    const tightened = await pullTowardChord(base, segmentHitsLand);
    if (await lineHitsLand(tightened, segmentHitsLand))
        return base;
    return lineOfSight(tightened, segmentHitsLand);
}
//# sourceMappingURL=straightenWaterPath.js.map