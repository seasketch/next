"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteDeadline = void 0;
exports.pastDeadline = pastDeadline;
exports.geodesicHitsIndex = geodesicHitsIndex;
exports.indexedRouteSamples = indexedRouteSamples;
exports.cellBlocked = cellBlocked;
exports.roughCorridor = roughCorridor;
const distance_1 = __importDefault(require("@turf/distance"));
const h3_js_1 = require("h3-js");
const bboxUtils_1 = require("../utils/bboxUtils");
const bboxForCell_1 = require("./bboxForCell");
const minHeap_1 = require("./minHeap");
/**
 * Thrown when a search passes its deadline. Hot loops check the clock and
 * throw so a synchronous stretch cannot run on after the budget.
 */
class RouteDeadline extends Error {
    constructor() {
        super("water path deadline");
        this.name = "RouteDeadline";
    }
}
exports.RouteDeadline = RouteDeadline;
function pastDeadline(deadline) {
    return deadline != null && Date.now() > deadline;
}
/** True when the straight line meets the land index, so it is not open water. */
function geodesicHitsIndex(land, origin, goal, cache, deadline) {
    let hits = 0;
    for (let step = 1; step <= 8; step++) {
        const t = step / 9;
        let lng = origin[0] + (goal[0] - origin[0]) * t;
        const lat = origin[1] + (goal[1] - origin[1]) * t;
        while (lng > 180)
            lng -= 360;
        while (lng < -180)
            lng += 360;
        const cell = (0, h3_js_1.latLngToCell)(Math.max(-85, Math.min(85, lat)), lng, 7);
        if (cellBlocked(land, cell, cache, deadline))
            hits++;
    }
    return hits >= 2;
}
/**
 * Interior samples whose cell meets the land index. A hit means the point
 * might be on land; the caller confirms with the polygon. Shoreline bboxes
 * make this true for a route that is still in the water.
 */
function indexedRouteSamples(land, coords, cache, deadline, stepMeters = 800) {
    const hits = [];
    if (coords.length < 2)
        return hits;
    const lengths = [];
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
        const length = metersBetween(coords[i - 1], coords[i]);
        lengths.push(length);
        total += length;
    }
    if (total <= 4500)
        return hits;
    let traveled = 0;
    for (let i = 1; i < coords.length; i++) {
        const start = coords[i - 1];
        const end = coords[i];
        let endLng = end[0];
        while (endLng - start[0] > 180)
            endLng -= 360;
        while (endLng - start[0] < -180)
            endLng += 360;
        const length = lengths[i - 1];
        const steps = Math.max(1, Math.ceil(length / stepMeters));
        for (let step = 1; step <= steps; step++) {
            const t = step / steps;
            const along = traveled + length * t;
            if (along < 2000 || along > total - 2500)
                continue;
            let lng = start[0] + (endLng - start[0]) * t;
            const lat = start[1] + (end[1] - start[1]) * t;
            while (lng > 180)
                lng -= 360;
            while (lng < -180)
                lng += 360;
            const cell = (0, h3_js_1.latLngToCell)(Math.max(-85, Math.min(85, lat)), lng, FINE);
            if (cellBlocked(land, cell, cache, deadline))
                hits.push([lng, lat]);
        }
        traveled += length;
    }
    return hits;
}
/** Open water is one step at this size (~8 km). */
const COARSE = 5;
/**
 * A cell this small (~460 m) that still meets the land index is treated as
 * shore. Narrow channels can be threaded without downloading polygons.
 */
const FINE = 8;
const MAX_EXPANSIONS = 8000;
/** Shoreline beside a rough path, in meters, included in the fetch window. */
const PATH_PAD_METERS = 8000;
/** When the index search finds no way around, fetch only this band. */
const FALLBACK_PAD_METERS = 18000;
const METERS_PER_DEG_LAT = 111320;
const NODE_ITEM_BYTE_LENGTH = 40;
function wrapLng(lng) {
    return ((((lng + 180) % 360) + 360) % 360) - 180;
}
function metersBetween(a, b) {
    let lng = b[0];
    while (lng - a[0] > 180)
        lng -= 360;
    while (lng - a[0] < -180)
        lng += 360;
    return (0, distance_1.default)(a, [lng, b[1]], { units: "meters" });
}
function center(cell) {
    const [lat, lng] = (0, h3_js_1.cellToLatLng)(cell);
    return [wrapLng(lng), lat];
}
/** Same bound as the FlatGeobuf R-tree: the first level end strictly past `value`. */
function upperBound(value, arr) {
    let i = 0;
    let j = arr.length - 1;
    while (i < j) {
        const m = (i + j) >> 1;
        if (arr[m] > value)
            j = m;
        else
            i = m + 1;
    }
    return arr[i];
}
/** True when any land-feature bbox meets this box. Stops at the first leaf. */
function indexIntersects(land, minX, minY, maxX, maxY) {
    const index = land.index;
    if (!index?.view || !index.details?.levels) {
        return land.search({ minX, minY, maxX, maxY }).features > 0;
    }
    const { view, details } = index;
    const leafStart = details.levels[details.levels.length - 2];
    let nodeIndex = 0;
    const queue = [];
    while (nodeIndex !== undefined) {
        const end = Math.min(nodeIndex + details.nodeSize, upperBound(nodeIndex, details.levels));
        for (let pos = nodeIndex; pos < end; pos++) {
            const byteIndex = pos * NODE_ITEM_BYTE_LENGTH;
            const nodeMinX = view.getFloat64(byteIndex, true);
            const nodeMinY = view.getFloat64(byteIndex + 8, true);
            const nodeMaxX = view.getFloat64(byteIndex + 16, true);
            const nodeMaxY = view.getFloat64(byteIndex + 24, true);
            if (maxX < nodeMinX ||
                maxY < nodeMinY ||
                minX > nodeMaxX ||
                minY > nodeMaxY) {
                continue;
            }
            if (pos >= leafStart)
                return true;
            queue.push(Number(view.getBigUint64(byteIndex + 32, true)));
        }
        nodeIndex = queue.pop();
    }
    return false;
}
function cellBlocked(land, cell, cache, deadline) {
    const known = cache.get(cell);
    if (known !== undefined)
        return known;
    if (pastDeadline(deadline))
        throw new RouteDeadline();
    const box = (0, bboxUtils_1.cleanBBox)((0, bboxForCell_1.bboxForCell)(cell));
    const parts = (0, bboxUtils_1.splitBBoxAntimeridian)(box);
    let hit = false;
    for (const part of parts) {
        if (indexIntersects(land, part[0], part[1], part[2], part[3])) {
            hit = true;
            break;
        }
    }
    cache.set(cell, hit);
    return hit;
}
function childrenOf(cell) {
    try {
        return (0, h3_js_1.cellToChildren)(cell, (0, h3_js_1.getResolution)(cell) + 1);
    }
    catch {
        return [];
    }
}
function touches(cell, other) {
    if (cell === other)
        return true;
    // Same-resolution neighbors share an edge, but a boundary vertex can fall in
    // a third cell, so the vertex probe below drops real neighbors.
    if ((0, h3_js_1.getResolution)(cell) === (0, h3_js_1.getResolution)(other)) {
        try {
            return (0, h3_js_1.areNeighborCells)(cell, other);
        }
        catch {
            return false;
        }
    }
    const res = (0, h3_js_1.getResolution)(cell);
    const probe = (0, h3_js_1.getResolution)(other) < res ? cell : other;
    const target = probe === cell ? other : cell;
    const targetRes = (0, h3_js_1.getResolution)(target);
    const [lat, lng] = (0, h3_js_1.cellToLatLng)(probe);
    if ((0, h3_js_1.latLngToCell)(lat, lng, targetRes) === target)
        return true;
    for (const [boundaryLat, boundaryLng] of (0, h3_js_1.cellToBoundary)(probe)) {
        if ((0, h3_js_1.latLngToCell)(boundaryLat, boundaryLng, targetRes) === target)
            return true;
    }
    return false;
}
function spanOf(points, padMeters, refLng) {
    let prev = refLng;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [lng, lat] of points) {
        let x = lng;
        while (x - prev > 180)
            x -= 360;
        while (x - prev < -180)
            x += 360;
        prev = x;
        if (x < minX)
            minX = x;
        if (x > maxX)
            maxX = x;
        if (lat < minY)
            minY = lat;
        if (lat > maxY)
            maxY = lat;
    }
    const midLat = (minY + maxY) / 2;
    const latPad = padMeters / METERS_PER_DEG_LAT;
    const lngPad = latPad / Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
    return {
        meters: 0,
        local: true,
        path: points,
        minX: minX - lngPad,
        maxX: maxX + lngPad,
        minY: Math.max(-85, minY - latPad),
        maxY: Math.min(85, maxY + latPad),
    };
}
/**
 * Index-only path from `origin` to `goal`. Land polygons are not downloaded.
 * The returned window is what the tangent router should fetch to hone the line.
 */
function roughCorridor(land, origin, goal, maxMeters, cache, deadline) {
    const geodesic = metersBetween(origin, goal);
    const fallback = () => {
        const span = spanOf([origin, goal], FALLBACK_PAD_METERS, origin[0]);
        span.meters = geodesic;
        span.local = false;
        span.path = [origin, goal];
        return span;
    };
    if (pastDeadline(deadline))
        throw new RouteDeadline();
    if (geodesic > maxMeters)
        return fallback();
    const blocked = (cell) => cellBlocked(land, cell, cache, deadline);
    const lift = (cell) => {
        let current = cell;
        while ((0, h3_js_1.getResolution)(current) > COARSE) {
            const parent = (0, h3_js_1.cellToParent)(current, (0, h3_js_1.getResolution)(current) - 1);
            if (blocked(parent))
                break;
            current = parent;
        }
        return current;
    };
    const anchor = (point) => {
        const lat = Math.max(-85, Math.min(85, point[1]));
        const lng = wrapLng(point[0]);
        const fine = (0, h3_js_1.latLngToCell)(lat, lng, FINE);
        if (!blocked(fine))
            return lift(fine);
        const coarse = (0, h3_js_1.latLngToCell)(lat, lng, COARSE);
        for (let ring = 0; ring <= 4; ring++) {
            const disk = (0, h3_js_1.gridDisk)(coarse, ring);
            const inner = ring === 0 ? new Set() : new Set((0, h3_js_1.gridDisk)(coarse, ring - 1));
            for (const cell of disk) {
                if (inner.has(cell))
                    continue;
                if (!blocked(cell))
                    return lift(cell);
                const queue = childrenOf(cell);
                let guard = 0;
                while (queue.length > 0 && guard++ < 48) {
                    const next = queue.shift();
                    if (!blocked(next))
                        return lift(next);
                    if ((0, h3_js_1.getResolution)(next) < FINE)
                        queue.push(...childrenOf(next));
                }
            }
        }
        return null;
    };
    const start = anchor(origin);
    const end = anchor(goal);
    if (!start || !end)
        return fallback();
    const goalAt = center(end);
    // A cell can be index-clear while the step to its neighbor crosses an island
    // that sits on the shared edge. Refuse that step and look for a finer one.
    const segmentCache = new Map();
    const segmentClear = (from, to) => {
        const key = `${from[0].toFixed(2)},${from[1].toFixed(2)}>${to[0].toFixed(2)},${to[1].toFixed(2)}`;
        const known = segmentCache.get(key);
        if (known !== undefined)
            return known;
        const span = metersBetween(from, to);
        const steps = Math.max(2, Math.ceil(span / 1000));
        let toLng = to[0];
        while (toLng - from[0] > 180)
            toLng -= 360;
        while (toLng - from[0] < -180)
            toLng += 360;
        let clear = true;
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            let lng = from[0] + (toLng - from[0]) * t;
            const lat = from[1] + (to[1] - from[1]) * t;
            while (lng > 180)
                lng -= 360;
            while (lng < -180)
                lng += 360;
            const sample = (0, h3_js_1.latLngToCell)(Math.max(-85, Math.min(85, lat)), lng, FINE);
            if (blocked(sample)) {
                clear = false;
                break;
            }
        }
        segmentCache.set(key, clear);
        return clear;
    };
    const neighborsOf = (cell) => {
        const out = [];
        const seen = new Set();
        const here = center(cell);
        const hereToGoal = metersBetween(here, goalAt);
        const add = (candidate) => {
            let chosen = candidate;
            let res = (0, h3_js_1.getResolution)(chosen);
            while (res > COARSE) {
                const parent = (0, h3_js_1.cellToParent)(chosen, res - 1);
                if (blocked(parent) || !segmentClear(here, center(parent)))
                    break;
                chosen = parent;
                res--;
            }
            if (seen.has(chosen))
                return;
            seen.add(chosen);
            out.push(chosen);
        };
        const walk = (candidate, depth) => {
            if (out.length >= 24)
                return;
            if (!touches(candidate, cell))
                return;
            if (!blocked(candidate)) {
                if (segmentClear(here, center(candidate))) {
                    add(candidate);
                    return;
                }
                if ((0, h3_js_1.getResolution)(candidate) >= FINE || depth >= 4)
                    return;
                for (const child of childrenOf(candidate))
                    walk(child, depth + 1);
                return;
            }
            // A channel often sits in a cell that is not closer to the port, because
            // the cell center is on the shore beside it. Take any clear water in
            // that cell, and keep splitting only when the cell is on the way.
            if (depth === 0) {
                const ahead = metersBetween(center(candidate), goalAt) < hereToGoal + 8000;
                if (!ahead && hereToGoal > 25000) {
                    const admit = (parent, nested) => {
                        if (nested > 2 || (0, h3_js_1.getResolution)(parent) >= FINE || out.length >= 24)
                            return;
                        for (const child of childrenOf(parent)) {
                            if (!touches(child, cell))
                                continue;
                            if (!blocked(child)) {
                                if (segmentClear(here, center(child)))
                                    add(child);
                                continue;
                            }
                            admit(child, nested + 1);
                        }
                    };
                    admit(candidate, 0);
                    return;
                }
            }
            if ((0, h3_js_1.getResolution)(candidate) >= FINE || depth >= 4)
                return;
            for (const child of childrenOf(candidate))
                walk(child, depth + 1);
        };
        for (const next of (0, h3_js_1.gridDisk)(cell, 1)) {
            if (next !== cell)
                walk(next, 0);
        }
        return out;
    };
    const reached = (cell) => {
        if (cell === end)
            return true;
        const res = (0, h3_js_1.getResolution)(cell);
        const endRes = (0, h3_js_1.getResolution)(end);
        if (res < endRes)
            return (0, h3_js_1.cellToParent)(end, res) === cell;
        if (endRes < res)
            return (0, h3_js_1.cellToParent)(cell, endRes) === end;
        return false;
    };
    const best = new Map();
    const prev = new Map();
    const heap = new minHeap_1.MinHeap();
    const push = (cell, from, g) => {
        if (g > maxMeters)
            return;
        const known = best.get(cell);
        if (known !== undefined && known <= g)
            return;
        best.set(cell, g);
        prev.set(cell, from);
        heap.push(g + metersBetween(center(cell), goalAt), { cell, g });
    };
    push(start, null, 0);
    let found = null;
    let expansions = 0;
    while (heap.size > 0 && expansions < MAX_EXPANSIONS) {
        if ((expansions & 31) === 0 && pastDeadline(deadline))
            throw new RouteDeadline();
        const popped = heap.pop();
        if (!popped)
            break;
        const { cell, g } = popped.value;
        if (best.get(cell) !== g)
            continue;
        expansions++;
        if (reached(cell)) {
            found = cell;
            break;
        }
        for (const next of neighborsOf(cell)) {
            push(next, cell, g + metersBetween(center(cell), center(next)));
        }
    }
    if (!found)
        return fallback();
    const cells = [];
    const seen = new Set();
    let cursor = found;
    while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        cells.push(cursor);
        cursor = prev.get(cursor) ?? null;
    }
    cells.reverse();
    const route = [origin];
    const windowPoints = [origin];
    let meters = 0;
    let previous = origin;
    for (const cell of cells) {
        const at = center(cell);
        meters += metersBetween(previous, at);
        previous = at;
        route.push(at);
        windowPoints.push(at);
        for (const next of (0, h3_js_1.gridDisk)(cell, 1)) {
            if (next === cell || !blocked(next))
                continue;
            if ((0, h3_js_1.getResolution)(next) >= FINE) {
                windowPoints.push(center(next));
                continue;
            }
            for (const child of childrenOf(next)) {
                if (blocked(child))
                    windowPoints.push(center(child));
            }
        }
    }
    meters += metersBetween(previous, goal);
    route.push(goal);
    windowPoints.push(goal);
    const span = spanOf(windowPoints, PATH_PAD_METERS, origin[0]);
    span.meters = Math.max(meters, geodesic);
    span.local = span.meters <= Math.max(geodesic * 1.8, geodesic + 20000);
    span.path = route;
    return span;
}
//# sourceMappingURL=waterPathRough.js.map