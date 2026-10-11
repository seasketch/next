"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchWaterPathByOccupancy = searchWaterPathByOccupancy;
const boolean_intersects_1 = __importDefault(require("@turf/boolean-intersects"));
const boolean_point_in_polygon_1 = __importDefault(require("@turf/boolean-point-in-polygon"));
const h3_js_1 = require("h3-js");
const client_1 = require("@seasketch/h3-land/client");
const bboxUtils_1 = require("../utils/bboxUtils");
const bboxForCell_1 = require("./bboxForCell");
const minHeap_1 = require("./minHeap");
const waterPathNearestH3_1 = require("./waterPathNearestH3");
/**
 * Resolution-9 occupancy router.
 *
 * Open ocean is one step at resolution 4 (~22 km), because a water parent is
 * water everywhere inside it. A mixed parent is split, to resolution 7 and
 * then 9, and only the water children are entered. The cell chain is then
 * pulled straight. Real land polygons are fetched for the ends of the route,
 * and for a short mixed stretch the straight line still has to cross.
 */
const COARSE = 4;
const MID = 7;
const OCCUPANCY_URL = process.env.H3_LAND_URL ?? "https://tiles.seasketch.org/h3-land/v1/land-res9.h3ld";
const DEPARTURE_METERS = 800;
const ARRIVAL_METERS = 800;
const HARBOR_METERS = 3500;
const CORRIDOR_METERS = 6000;
const MAX_EXPANSIONS = 12000;
const CANDIDATE_FACTOR = 8;
const openings = new Map();
function landArchive(url) {
    const existing = openings.get(url);
    if (existing)
        return existing;
    const pending = (0, client_1.openLandOccupancy)(url, {
        cacheBytes: 64 * 1024 * 1024,
        read: (start, end) => readRange(url, start, end),
    }).catch((error) => {
        openings.delete(url);
        throw error;
    });
    openings.set(url, pending);
    return pending;
}
async function readRange(url, start, end) {
    const response = await fetch(url, {
        headers: {
            Range: `bytes=${start}-${end - 1}`,
            "User-Agent": "seasketch-overlay-engine",
        },
    });
    if (!response.ok && response.status !== 206) {
        throw new Error(`land occupancy range ${start}-${end - 1} returned ${response.status}`);
    }
    const body = new Uint8Array(await response.arrayBuffer());
    if (response.status === 206 || body.byteLength === end - start)
        return body;
    if (response.status === 200 && body.byteLength >= end)
        return body.slice(start, end);
    throw new Error(`land occupancy range ${start}-${end - 1} returned ${response.status} (${body.byteLength} bytes)`);
}
function wrapLng(lng) {
    return ((((lng + 180) % 360) + 360) % 360) - 180;
}
function metersBetween(a, b) {
    let lng = b[0];
    while (lng - a[0] > 180)
        lng -= 360;
    while (lng - a[0] < -180)
        lng += 360;
    const rad = Math.PI / 180;
    const dLat = (b[1] - a[1]) * rad;
    const dLng = (lng - a[0]) * rad;
    const lat1 = a[1] * rad;
    const lat2 = b[1] * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}
const centerCache = new Map();
function center(cell) {
    const cached = centerCache.get(cell);
    if (cached)
        return cached;
    const [lat, lng] = (0, h3_js_1.cellToLatLng)(cell);
    const point = [wrapLng(lng), lat];
    centerCache.set(cell, point);
    return point;
}
function edgeMeters(resolution) {
    return (0, h3_js_1.getHexagonEdgeLengthAvg)(resolution, "m");
}
function cellContains(coarse, finer) {
    const coarseRes = (0, h3_js_1.getResolution)(coarse);
    const fineRes = (0, h3_js_1.getResolution)(finer);
    if (fineRes < coarseRes)
        return false;
    if (fineRes === coarseRes)
        return coarse === finer;
    return (0, h3_js_1.cellToParent)(finer, coarseRes) === coarse;
}
function covers(session, cell, point) {
    const fine = (0, h3_js_1.latLngToCell)(point[1], wrapLng(point[0]), session.fine);
    return cellContains(cell, fine);
}
const diskCache = new Map();
const childCache = new Map();
function neighborsOf(cell) {
    const cached = diskCache.get(cell);
    if (cached)
        return cached;
    const disk = (0, h3_js_1.gridDisk)(cell, 1);
    diskCache.set(cell, disk);
    return disk;
}
function childrenAt(cell, resolution) {
    const key = `${cell}:${resolution}`;
    const cached = childCache.get(key);
    if (cached)
        return cached;
    const children = (0, h3_js_1.cellToChildren)(cell, resolution);
    childCache.set(key, children);
    return children;
}
function adjacentTo(a, b) {
    if (a === b)
        return false;
    const aRes = (0, h3_js_1.getResolution)(a);
    const bRes = (0, h3_js_1.getResolution)(b);
    if (aRes === bRes) {
        for (const neighbor of neighborsOf(a)) {
            if (neighbor === b)
                return true;
        }
        return false;
    }
    const fine = aRes > bRes ? a : b;
    const coarse = fine === a ? b : a;
    if ((0, h3_js_1.cellToParent)(fine, (0, h3_js_1.getResolution)(coarse)) === coarse)
        return false;
    for (const neighbor of neighborsOf(fine)) {
        if (neighbor === fine)
            continue;
        if ((0, h3_js_1.cellToParent)(neighbor, (0, h3_js_1.getResolution)(coarse)) === coarse)
            return true;
    }
    return false;
}
async function classify(session, cells) {
    const need = [];
    const seen = new Set();
    const add = (cell) => {
        if (session.known.has(cell) || seen.has(cell))
            return;
        seen.add(cell);
        need.push(cell);
        const resolution = (0, h3_js_1.getResolution)(cell);
        if (resolution > MID)
            add((0, h3_js_1.cellToParent)(cell, MID));
        else if (resolution > COARSE)
            add((0, h3_js_1.cellToParent)(cell, COARSE));
    };
    for (const cell of cells)
        add(cell);
    if (need.length === 0)
        return;
    const states = await session.occupancy.states(need);
    for (const [cell, state] of states)
        session.known.set(cell, state);
}
function liftAbove(session, cell, blocked) {
    if (session.known.get(cell) !== "water")
        return cell;
    let current = cell;
    while ((0, h3_js_1.getResolution)(current) > COARSE) {
        const parentRes = (0, h3_js_1.getResolution)(current) > MID ? MID : COARSE;
        const parent = (0, h3_js_1.cellToParent)(current, parentRes);
        if (session.known.get(parent) !== "water")
            break;
        if (cellContains(parent, blocked))
            break;
        current = parent;
    }
    return current;
}
async function waterNeighbors(session, from) {
    const cached = session.waterAdj.get(from);
    if (cached)
        return cached;
    const out = [];
    const seen = new Set([from]);
    const queue = neighborsOf(from).filter((cell) => cell !== from);
    let read = 0;
    while (read < queue.length) {
        const pending = [];
        for (let i = read; i < queue.length; i++)
            pending.push(queue[i]);
        await classify(session, pending);
        const end = queue.length;
        while (read < end) {
            const candidate = queue[read++];
            if (seen.has(candidate))
                continue;
            seen.add(candidate);
            const state = session.known.get(candidate);
            if (state === "water") {
                const lifted = liftAbove(session, candidate, from);
                // `candidate` is already in `seen`. A neighbor that stays at its own
                // resolution must still be kept; only a coarser parent is shared.
                if (lifted === from || (lifted !== candidate && seen.has(lifted)))
                    continue;
                if (lifted !== candidate)
                    seen.add(lifted);
                out.push(lifted);
                continue;
            }
            if (state !== "mixed" || (0, h3_js_1.getResolution)(candidate) >= session.fine)
                continue;
            const nextRes = (0, h3_js_1.getResolution)(candidate) < MID ? MID : session.fine;
            const border = childrenAt(candidate, nextRes).filter((child) => adjacentTo(from, child));
            for (const child of border) {
                if (!seen.has(child))
                    queue.push(child);
            }
        }
    }
    session.waterAdj.set(from, out);
    return out;
}
function nearPoint(cell, point, limit) {
    return metersBetween(center(cell), point) <= limit + edgeMeters((0, h3_js_1.getResolution)(cell));
}
function metersToSegment(point, a, b) {
    let bx = b[0];
    while (bx - a[0] > 180)
        bx -= 360;
    while (bx - a[0] < -180)
        bx += 360;
    let px = point[0];
    while (px - a[0] > 180)
        px -= 360;
    while (px - a[0] < -180)
        px += 360;
    const scale = Math.max(0.2, Math.cos((a[1] * Math.PI) / 180));
    const abx = (bx - a[0]) * scale;
    const aby = b[1] - a[1];
    const apx = (px - a[0]) * scale;
    const apy = point[1] - a[1];
    const len2 = abx * abx + aby * aby;
    let t = 0;
    if (len2 > 0)
        t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / len2));
    const dx = (apx - abx * t) * 111320;
    const dy = (apy - aby * t) * 111320;
    return Math.hypot(dx, dy);
}
function wantsMixed(cell, origin, goal, mode) {
    if (nearPoint(cell, origin, HARBOR_METERS) || nearPoint(cell, goal, HARBOR_METERS)) {
        return true;
    }
    return mode === "corridor" && metersToSegment(center(cell), origin, goal) <= CORRIDOR_METERS;
}
async function loadBox(session, minX, minY, maxX, maxY) {
    const key = `${minX.toFixed(4)},${minY.toFixed(4)},${maxX.toFixed(4)},${maxY.toFixed(4)}`;
    if (session.loaded.has(key))
        return;
    session.loaded.add(key);
    const parts = (0, bboxUtils_1.splitBBoxAntimeridian)((0, bboxUtils_1.cleanBBox)([minX, minY, maxX, maxY]));
    for (const part of parts) {
        const envelope = (0, bboxUtils_1.bboxToEnvelope)(part);
        for await (const feature of session.land.getFeaturesAsync(envelope)) {
            const offset = feature.properties?.__offset;
            if (typeof offset === "number")
                session.features.set(offset, feature);
        }
    }
}
async function loadAround(session, point, meters) {
    const lat = meters / 111320;
    const lng = lat / Math.max(0.2, Math.cos((point[1] * Math.PI) / 180));
    const x = wrapLng(point[0]);
    await loadBox(session, x - lng, point[1] - lat, x + lng, point[1] + lat);
}
function boxOf(session, feature) {
    const known = session.featureBox.get(feature);
    if (known)
        return known;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const visit = (coords) => {
        if (!Array.isArray(coords))
            return;
        if (typeof coords[0] === "number" && typeof coords[1] === "number") {
            const x = coords[0];
            const y = coords[1];
            if (x < minX)
                minX = x;
            if (x > maxX)
                maxX = x;
            if (y < minY)
                minY = y;
            if (y > maxY)
                maxY = y;
            return;
        }
        for (const child of coords)
            visit(child);
    };
    const geometry = feature.geometry;
    if (geometry && "coordinates" in geometry)
        visit(geometry.coordinates);
    const box = [minX, minY, maxX, maxY];
    session.featureBox.set(feature, box);
    return box;
}
function pointOnFeature(point, feature) {
    const lng = wrapLng(point[0]);
    const lat = point[1];
    for (const shifted of [lng, lng + 360, lng - 360]) {
        if ((0, boolean_point_in_polygon_1.default)([shifted, lat], feature))
            return true;
    }
    return false;
}
async function waterCenter(session, cell) {
    const known = session.centerWater.get(cell);
    if (known !== undefined)
        return known;
    const box = (0, bboxForCell_1.bboxForCell)(cell);
    await loadBox(session, box[0], box[1], box[2], box[3]);
    const at = center(cell);
    let water = true;
    for (const feature of session.features.values()) {
        const bounds = boxOf(session, feature);
        if (at[0] < bounds[0] - 0.02 || at[0] > bounds[2] + 0.02)
            continue;
        if (at[1] < bounds[1] - 0.02 || at[1] > bounds[3] + 0.02)
            continue;
        if (pointOnFeature(at, feature)) {
            water = false;
            break;
        }
    }
    session.centerWater.set(cell, water);
    return water;
}
async function mixedExtras(session, from, origin, goal, mode) {
    if (!wantsMixed(from, origin, goal, mode))
        return [];
    const out = [];
    const seen = new Set([from]);
    const queue = neighborsOf(from).filter((cell) => cell !== from);
    let read = 0;
    while (read < queue.length) {
        const pending = [];
        for (let i = read; i < queue.length; i++)
            pending.push(queue[i]);
        await classify(session, pending);
        const end = queue.length;
        while (read < end) {
            const candidate = queue[read++];
            if (seen.has(candidate))
                continue;
            seen.add(candidate);
            if (session.known.get(candidate) !== "mixed")
                continue;
            if (!wantsMixed(candidate, origin, goal, mode))
                continue;
            if ((0, h3_js_1.getResolution)(candidate) >= session.fine) {
                if (await waterCenter(session, candidate))
                    out.push(candidate);
                continue;
            }
            const nextRes = (0, h3_js_1.getResolution)(candidate) < MID ? MID : session.fine;
            for (const child of childrenAt(candidate, nextRes)) {
                if (!seen.has(child) && adjacentTo(from, child))
                    queue.push(child);
            }
        }
    }
    return out;
}
function pointAlong(a, lng, lat, t) {
    return [a[0] + (lng - a[0]) * t, a[1] + (lat - a[1]) * t];
}
function ignoreEdge(mode, edge, meters) {
    if (edge === "start" && (mode === "prefix" || mode === "ends"))
        return meters;
    if (edge === "end" && (mode === "suffix" || mode === "ends"))
        return meters;
    return 0;
}
function overlapsOpen(d0, d1, span, ignoreStart, ignoreEnd) {
    return Math.min(d1, span - ignoreEnd) - Math.max(d0, ignoreStart) > 1;
}
/**
 * Cells a straight line crosses, in order. Each step doubles until the cell
 * changes, then binary-searches the boundary, so a clear stretch costs a
 * handful of lookups instead of one every 40 m.
 */
function lineCrossings(a, lng, lat, span, resolution, d0, d1) {
    const out = [];
    let d = Math.max(0, d0);
    const end = Math.min(span, d1);
    const step0 = Math.max(15, edgeMeters(resolution) * 0.2);
    let guard = 0;
    while (d < end - 0.4 && guard++ < 8000) {
        const at = pointAlong(a, lng, lat, span === 0 ? 0 : d / span);
        const cell = (0, h3_js_1.latLngToCell)(at[1], wrapLng(at[0]), resolution);
        let inside = d;
        let outside = Math.min(end, d + step0);
        let grow = step0;
        while (outside < end - 0.4) {
            const probe = pointAlong(a, lng, lat, outside / span);
            if ((0, h3_js_1.latLngToCell)(probe[1], wrapLng(probe[0]), resolution) !== cell)
                break;
            inside = outside;
            grow *= 2;
            outside = Math.min(end, outside + grow);
        }
        const endAt = pointAlong(a, lng, lat, span === 0 ? 0 : end / span);
        if (outside >= end - 0.4 &&
            (0, h3_js_1.latLngToCell)(endAt[1], wrapLng(endAt[0]), resolution) === cell) {
            const prev = out[out.length - 1];
            if (prev && prev.cell === cell)
                prev.d1 = end;
            else
                out.push({ cell, d0: d, d1: end });
            break;
        }
        let lo = inside;
        let hi = Math.min(end, outside);
        for (let i = 0; i < 16; i++) {
            const mid = (lo + hi) / 2;
            const probe = pointAlong(a, lng, lat, span === 0 ? 0 : mid / span);
            if ((0, h3_js_1.latLngToCell)(probe[1], wrapLng(probe[0]), resolution) === cell)
                lo = mid;
            else
                hi = mid;
        }
        const prev = out[out.length - 1];
        if (prev && prev.cell === cell && d <= prev.d1 + 2)
            prev.d1 = lo;
        else
            out.push({ cell, d0: d, d1: lo });
        d = hi;
        const check = pointAlong(a, lng, lat, span === 0 ? 0 : d / span);
        if ((0, h3_js_1.latLngToCell)(check[1], wrapLng(check[0]), resolution) === cell) {
            d = Math.min(end, d + 1);
        }
        if (d <= inside)
            d = Math.min(end, inside + step0);
    }
    return out;
}
/**
 * Shoreline polygons inside fine mixed cells. A water cell is water
 * everywhere, so the geometric test only runs on the mixed stretches.
 */
async function polygonsOnMixed(session, a, lng, lat, span, pieces, ignoreStart, ignoreEnd) {
    if (pieces.length === 0)
        return null;
    const cells = new Set();
    for (const piece of pieces)
        cells.add(piece.cell);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let crosses = false;
    for (const cell of cells) {
        const box = (0, bboxForCell_1.bboxForCell)(cell);
        if (box[0] > box[2])
            crosses = true;
        minX = Math.min(minX, box[0], box[2]);
        maxX = Math.max(maxX, box[0], box[2]);
        minY = Math.min(minY, box[1]);
        maxY = Math.max(maxY, box[3]);
    }
    if (!crosses && metersBetween([minX, minY], [maxX, maxY]) < 40000) {
        await loadBox(session, minX, minY, maxX, maxY);
    }
    else {
        for (const cell of cells) {
            const box = (0, bboxForCell_1.bboxForCell)(cell);
            await loadBox(session, box[0], box[1], box[2], box[3]);
        }
    }
    for (const piece of pieces) {
        const from = Math.max(piece.d0, ignoreStart);
        const to = Math.min(piece.d1, span - ignoreEnd);
        if (to - from <= 1)
            continue;
        const start = pointAlong(a, lng, lat, from / span);
        const stop = pointAlong(a, lng, lat, to / span);
        if (Math.abs(wrapLng(stop[0]) - wrapLng(start[0])) <= 180) {
            const pieceLine = {
                type: "LineString",
                coordinates: [
                    [wrapLng(start[0]), start[1]],
                    [wrapLng(stop[0]), stop[1]],
                ],
            };
            const x0 = Math.min(pieceLine.coordinates[0][0], pieceLine.coordinates[1][0]);
            const x1 = Math.max(pieceLine.coordinates[0][0], pieceLine.coordinates[1][0]);
            const y0 = Math.min(start[1], stop[1]);
            const y1 = Math.max(start[1], stop[1]);
            for (const feature of session.features.values()) {
                const bounds = boxOf(session, feature);
                if (x1 < bounds[0] - 0.02 || x0 > bounds[2] + 0.02)
                    continue;
                if (y1 < bounds[1] - 0.02 || y0 > bounds[3] + 0.02)
                    continue;
                if ((0, boolean_intersects_1.default)(pieceLine, feature))
                    return start;
            }
        }
        for (let d = from; d <= to; d += 40) {
            const at = pointAlong(a, lng, lat, d / span);
            if (pointHitsLoadedLand(session, at))
                return at;
        }
    }
    return null;
}
/** Land blocking the open part of a segment, or null when the line stays on water. */
async function occupancyHit(session, a, lng, lat, span, resolution, d0, d1, cellStart, cellEnd, polygonStart, polygonEnd) {
    const pieces = lineCrossings(a, lng, lat, span, resolution, d0, d1);
    if (pieces.length === 0)
        return null;
    await classify(session, pieces.map((piece) => piece.cell));
    const finer = [];
    const polygonPieces = [];
    for (const piece of pieces) {
        const state = session.known.get(piece.cell);
        if (state === "water")
            continue;
        if (state === "land") {
            if (!overlapsOpen(piece.d0, piece.d1, span, cellStart, cellEnd))
                continue;
            const from = Math.max(piece.d0, cellStart);
            const to = Math.min(piece.d1, span - cellEnd);
            return pointAlong(a, lng, lat, ((from + to) / 2) / span);
        }
        if (resolution >= session.fine) {
            if (overlapsOpen(piece.d0, piece.d1, span, polygonStart, polygonEnd))
                polygonPieces.push(piece);
            continue;
        }
        finer.push(piece);
    }
    const polygonHit = await polygonsOnMixed(session, a, lng, lat, span, polygonPieces, polygonStart, polygonEnd);
    if (polygonHit)
        return polygonHit;
    const next = resolution < MID ? MID : session.fine;
    for (const piece of finer) {
        const hit = await occupancyHit(session, a, lng, lat, span, next, piece.d0, piece.d1, cellStart, cellEnd, polygonStart, polygonEnd);
        if (hit)
            return hit;
    }
    return null;
}
async function segmentBlocked(session, a, b, mode) {
    let lng = b[0];
    while (lng - a[0] > 180)
        lng -= 360;
    while (lng - a[0] < -180)
        lng += 360;
    const span = metersBetween(a, [lng, b[1]]);
    if (span < 1)
        return false;
    const memoKey = `${mode}:${a[0].toFixed(4)},${a[1].toFixed(4)}:${lng.toFixed(4)},${b[1].toFixed(4)}`;
    const remembered = session.segments.get(memoKey);
    if (remembered !== undefined)
        return remembered;
    // Resolution-4 water is water everywhere inside the cell. Mixed parents are
    // split to 7 and then to the archive's fine resolution. Land cells and
    // shoreline polygons both block outside the 800 m harbor allowance, so a
    // shortcut cannot clip an island that sits just seaward of a port.
    const hit = await occupancyHit(session, a, lng, b[1], span, COARSE, 0, span, ignoreEdge(mode, "start", DEPARTURE_METERS), ignoreEdge(mode, "end", ARRIVAL_METERS), ignoreEdge(mode, "start", DEPARTURE_METERS), ignoreEdge(mode, "end", ARRIVAL_METERS));
    const blocked = hit != null;
    session.segments.set(memoKey, blocked);
    return blocked;
}
async function bendAround(session, a, b, mode) {
    let lng = b[0];
    while (lng - a[0] > 180)
        lng -= 360;
    while (lng - a[0] < -180)
        lng += 360;
    const mid = pointAlong(a, lng, b[1], 0.5);
    const cos = Math.max(0.2, Math.cos((mid[1] * Math.PI) / 180));
    const east = (lng - a[0]) * cos * 111320;
    const north = (b[1] - a[1]) * 111320;
    const len = Math.hypot(east, north) || 1;
    const sideEast = -north / len;
    const sideNorth = east / len;
    for (const meters of [200, 450, 900, 1800, 3600, 7000]) {
        for (const side of [1, -1]) {
            const at = [
                mid[0] + (sideEast * meters * side) / (111320 * cos),
                mid[1] + (sideNorth * meters * side) / 111320,
            ];
            const firstMode = mode === "suffix" ? "none" : mode === "ends" ? "prefix" : mode;
            const secondMode = mode === "prefix" ? "none" : mode === "ends" ? "suffix" : mode;
            if (await segmentBlocked(session, a, at, firstMode))
                continue;
            if (await segmentBlocked(session, at, [lng, b[1]], secondMode))
                continue;
            return at;
        }
    }
    return null;
}
async function openHops(session, coords) {
    if (coords.length < 2)
        return coords;
    const out = [coords[0]];
    for (let i = 1; i < coords.length; i++) {
        const prev = out[out.length - 1];
        const next = coords[i];
        const last = i === coords.length - 1;
        const mode = out.length === 1 && last ? "ends" : out.length === 1 ? "prefix" : last ? "suffix" : "none";
        if (!(await segmentBlocked(session, prev, next, mode))) {
            out.push(next);
            continue;
        }
        const bend = await bendAround(session, prev, next, mode);
        if (bend)
            out.push(bend);
        out.push(next);
    }
    return out;
}
async function stringPull(session, coords) {
    if (coords.length < 3)
        return coords;
    const out = [coords[0]];
    let index = 0;
    const last = coords.length - 1;
    const modeFor = (j) => index === 0 && j === last ? "ends" : index === 0 ? "prefix" : j === last ? "suffix" : "none";
    while (index < last) {
        let step = 1;
        let chosen = index + 1;
        while (index + step * 2 <= last) {
            const j = index + step * 2;
            if (await segmentBlocked(session, coords[index], coords[j], modeFor(j)))
                break;
            chosen = j;
            step *= 2;
        }
        const remaining = last - chosen;
        if (remaining > 0 && remaining < step) {
            if (!(await segmentBlocked(session, coords[index], coords[last], modeFor(last)))) {
                chosen = last;
            }
        }
        out.push(coords[chosen]);
        index = chosen;
    }
    return out;
}
function heuristic(cell, goal) {
    return Math.max(0, metersBetween(center(cell), goal) - edgeMeters((0, h3_js_1.getResolution)(cell)));
}
async function routeCells(session, seeds, anchor, origin, goal, maxDistanceMeters, mode, deadline, limitMeters) {
    const gScore = new Map();
    const prev = new Map();
    const depart = new Map();
    const expanded = new Set();
    const heap = new minHeap_1.MinHeap();
    for (const seed of seeds) {
        const inside = covers(session, seed.cell, seed.point);
        const g = inside ? 0 : seed.hop;
        const previous = gScore.get(seed.cell);
        if (previous !== undefined && previous <= g)
            continue;
        gScore.set(seed.cell, g);
        prev.set(seed.cell, null);
        depart.set(seed.cell, seed.point);
        heap.push(g + heuristic(seed.cell, goal), seed.cell);
    }
    let expansions = 0;
    while (heap.size > 0) {
        const popped = heap.pop();
        if (!popped)
            break;
        if (popped.key >= limitMeters)
            break;
        const cell = popped.value;
        const g = gScore.get(cell);
        if (g === undefined || expanded.has(cell))
            continue;
        if (popped.key > g + heuristic(cell, goal) + 1)
            continue;
        expanded.add(cell);
        if (cell === anchor || cellContains(cell, anchor)) {
            const sameFineCell = cell === anchor && (0, h3_js_1.getResolution)(cell) === session.fine;
            if (sameFineCell ||
                g > 0 ||
                !(await segmentBlocked(session, depart.get(cell), goal, "ends"))) {
                return { end: cell, prev, depart };
            }
        }
        if (++expansions > MAX_EXPANSIONS)
            return null;
        session.expansions++;
        if ((expansions & 255) === 0 && deadline != null && Date.now() > deadline)
            return null;
        const neighbors = await waterNeighbors(session, cell);
        const extras = await mixedExtras(session, cell, origin, goal, mode);
        const at = prev.get(cell) == null ? depart.get(cell) : center(cell);
        const unique = new Set([...neighbors, ...extras]);
        for (const next of unique) {
            if (next === cell)
                continue;
            const step = Math.max(1, metersBetween(at, center(next)));
            const nextG = g + step;
            if (nextG > maxDistanceMeters * 1.35)
                continue;
            if (nextG + heuristic(next, goal) >= limitMeters)
                continue;
            const old = gScore.get(next);
            if (old !== undefined && nextG >= old - 0.5)
                continue;
            gScore.set(next, nextG);
            prev.set(next, cell);
            depart.set(next, depart.get(cell));
            heap.push(nextG + heuristic(next, goal), next);
        }
    }
    return null;
}
function trace(session, end, prev, depart, port) {
    const cells = [];
    const guard = new Set();
    let cursor = end;
    while (cursor && !guard.has(cursor)) {
        guard.add(cursor);
        cells.push(cursor);
        cursor = prev.get(cursor) ?? null;
    }
    cells.reverse();
    const start = depart.get(cells[0]) ?? center(cells[0]);
    const raw = [start];
    for (const cell of cells) {
        if (raw.length === 1 && covers(session, cell, start))
            continue;
        raw.push(center(cell));
    }
    raw.push(port);
    return raw;
}
function finishLine(coords) {
    const out = [];
    for (const [lng, lat] of coords) {
        const wrapped = [wrapLng(lng), lat];
        const prev = out[out.length - 1];
        if (prev && metersBetween(prev, wrapped) < 1 && Math.abs(wrapped[0] - prev[0]) <= 180) {
            continue;
        }
        out.push(wrapped);
    }
    return cutAntimeridian(out);
}
/**
 * A segment whose stored longitudes differ by more than 180° is the short hop
 * across the antimeridian, but a straight line through those coordinates is
 * drawn the long way around the earth. Insert both sides of the meridian so
 * each piece stays on the short arc. The two meridian vertices are one point;
 * the segment between them has no length.
 */
function cutAntimeridian(coords) {
    if (coords.length < 2)
        return coords;
    const out = [coords[0]];
    for (let i = 1; i < coords.length; i++) {
        const prev = out[out.length - 1];
        const next = coords[i];
        const raw = next[0] - prev[0];
        if (raw > 180 || raw < -180) {
            let lng = next[0];
            while (lng - prev[0] > 180)
                lng -= 360;
            while (lng - prev[0] < -180)
                lng += 360;
            const span = lng - prev[0];
            if (span !== 0) {
                const boundary = span > 0 ? 180 : -180;
                const t = (boundary - prev[0]) / span;
                const lat = prev[1] + (next[1] - prev[1]) * t;
                if (Math.abs(boundary - prev[0]) > 1e-8)
                    out.push([boundary, lat]);
                const exitLng = boundary === 180 ? -180 : 180;
                out.push([exitLng, lat]);
            }
        }
        const last = out[out.length - 1];
        if (last[0] === next[0] && last[1] === next[1])
            continue;
        out.push(next);
    }
    return out;
}
function lineLength(coords) {
    let meters = 0;
    for (let i = 1; i < coords.length; i++)
        meters += metersBetween(coords[i - 1], coords[i]);
    return meters;
}
function pointHitsLoadedLand(session, point) {
    const x = wrapLng(point[0]);
    for (const feature of session.features.values()) {
        const bounds = boxOf(session, feature);
        if (x < bounds[0] - 0.02 || x > bounds[2] + 0.02)
            continue;
        if (point[1] < bounds[1] - 0.02 || point[1] > bounds[3] + 0.02)
            continue;
        if (pointOnFeature(point, feature))
            return true;
    }
    return false;
}
/** Same windows as the port tests: land in the first 2 km or last 2.5 km is the harbor. */
async function firstInteriorLand(session, coords) {
    const total = lineLength(coords);
    if (total < 4500)
        return null;
    let walked = 0;
    for (let i = 1; i < coords.length; i++) {
        const a = coords[i - 1];
        const b = coords[i];
        let lng = b[0];
        while (lng - a[0] > 180)
            lng -= 360;
        while (lng - a[0] < -180)
            lng += 360;
        const span = metersBetween(a, [lng, b[1]]);
        const ignoreStart = Math.max(0, 2000 - walked);
        const ignoreEnd = Math.max(0, 2500 - (total - walked - span));
        if (span > 1 && ignoreStart + ignoreEnd < span) {
            const hit = await occupancyHit(session, a, lng, b[1], span, COARSE, 0, span, ignoreStart, ignoreEnd, ignoreStart, ignoreEnd);
            if (hit)
                return hit;
        }
        walked += span;
    }
    return null;
}
function moveMeters(origin, eastMeters, northMeters) {
    const cos = Math.max(0.2, Math.cos((origin[1] * Math.PI) / 180));
    return [origin[0] + eastMeters / (111320 * cos), origin[1] + northMeters / 111320];
}
async function offshoreGoal(session, point) {
    await loadAround(session, point, 3500);
    if (!pointHitsLoadedLand(session, point))
        return point;
    for (let dist = 200; dist <= 3500; dist += 200) {
        const steps = Math.max(12, Math.ceil((2 * Math.PI * dist) / 250));
        for (let step = 0; step < steps; step++) {
            const rad = (step / steps) * Math.PI * 2;
            const at = moveMeters(point, Math.sin(rad) * dist, Math.cos(rad) * dist);
            if (!pointHitsLoadedLand(session, at))
                return at;
        }
    }
    return point;
}
async function dockAtShore(session, coords) {
    if (coords.length < 2)
        return coords;
    const port = coords[coords.length - 1];
    await loadAround(session, port, 4000);
    for (let index = coords.length - 2; index >= 0; index--) {
        const from = coords[index];
        let best = null;
        let bestMeters = Infinity;
        for (let bearing = 0; bearing < 360; bearing += 20) {
            const rad = (bearing * Math.PI) / 180;
            for (const dist of [900, 1600, 2300]) {
                const at = moveMeters(port, Math.sin(rad) * dist, Math.cos(rad) * dist);
                if (pointHitsLoadedLand(session, at))
                    continue;
                const mode = index === 0 ? "prefix" : "none";
                if (await segmentBlocked(session, from, at, mode))
                    continue;
                const meters = metersBetween(from, at);
                if (meters < bestMeters) {
                    bestMeters = meters;
                    best = at;
                }
            }
        }
        if (!best)
            continue;
        const docked = coords.slice(0, index + 1).concat([best, port]);
        if (!(await firstInteriorLand(session, docked)))
            return docked;
    }
    return coords;
}
async function nudgeOffLand(session, coords, hit) {
    let bestIndex = 1;
    let best = Infinity;
    for (let i = 1; i < coords.length; i++) {
        const meters = metersBetween(hit, coords[i]);
        if (meters < best) {
            best = meters;
            bestIndex = i;
        }
    }
    const a = coords[bestIndex - 1];
    const b = coords[bestIndex];
    let lng = b[0];
    while (lng - a[0] > 180)
        lng -= 360;
    while (lng - a[0] < -180)
        lng += 360;
    const cos = Math.max(0.2, Math.cos((hit[1] * Math.PI) / 180));
    const east = (lng - a[0]) * cos * 111320;
    const north = (b[1] - a[1]) * 111320;
    const len = Math.hypot(east, north) || 1;
    const sideEast = -north / len;
    const sideNorth = east / len;
    for (const meters of [400, 900, 1800, 3500, 7000]) {
        for (const side of [1, -1]) {
            const at = [
                hit[0] + (sideEast * meters * side) / (111320 * cos),
                hit[1] + (sideNorth * meters * side) / 111320,
            ];
            const next = coords.slice();
            next.splice(bestIndex, 0, at);
            if (!(await firstInteriorLand(session, next)))
                return next;
        }
    }
    return null;
}
async function anchorFor(session, point) {
    const fine = (0, h3_js_1.latLngToCell)(point[1], wrapLng(point[0]), session.fine);
    await classify(session, [fine]);
    if (session.known.get(fine) === "water")
        return fine;
    const disk = (0, h3_js_1.gridDisk)(fine, 22);
    await classify(session, disk);
    let best = null;
    for (const cell of disk) {
        if (session.known.get(cell) !== "water")
            continue;
        const meters = metersBetween(point, center(cell));
        if (meters > 4500)
            continue;
        if (!best || meters < best.meters)
            best = { cell, meters };
    }
    if (best)
        return best.cell;
    for (const cell of disk) {
        if ((0, h3_js_1.getResolution)(cell) !== session.fine || session.known.get(cell) !== "mixed")
            continue;
        const meters = metersBetween(point, center(cell));
        if (meters > 2500)
            continue;
        if (!(await waterCenter(session, cell)))
            continue;
        if (!best || meters < best.meters)
            best = { cell, meters };
    }
    return best?.cell ?? null;
}
async function seedFor(session, point, anchor) {
    const fine = (0, h3_js_1.latLngToCell)(point[1], wrapLng(point[0]), session.fine);
    await classify(session, [fine]);
    let cell = session.known.get(fine) === "water" ? fine : null;
    let hop = cell ? metersBetween(point, center(cell)) : Infinity;
    if (!cell) {
        const disk = (0, h3_js_1.gridDisk)(fine, 20);
        await classify(session, disk);
        for (const candidate of disk) {
            if (session.known.get(candidate) !== "water")
                continue;
            const meters = metersBetween(point, center(candidate));
            if (meters < hop) {
                hop = meters;
                cell = candidate;
            }
        }
        if (!cell) {
            for (const candidate of disk) {
                if ((0, h3_js_1.getResolution)(candidate) !== session.fine)
                    continue;
                if (session.known.get(candidate) !== "mixed")
                    continue;
                const meters = metersBetween(point, center(candidate));
                if (meters > 2500 || meters >= hop)
                    continue;
                if (!(await waterCenter(session, candidate)))
                    continue;
                hop = meters;
                cell = candidate;
            }
        }
    }
    if (!cell)
        return null;
    const lifted = descendBeside(session, liftAbove(session, cell, anchor), point, anchor);
    const inside = covers(session, lifted, point);
    return { point, cell: lifted, hop: inside ? 0 : metersBetween(point, center(lifted)) };
}
function exteriorRings(geometry) {
    if (!geometry)
        return [];
    if (geometry.type === "Polygon") {
        const ring = geometry.coordinates[0];
        return ring ? [ring] : [];
    }
    if (geometry.type === "MultiPolygon") {
        const rings = [];
        for (const polygon of geometry.coordinates) {
            if (polygon[0])
                rings.push(polygon[0]);
        }
        return rings;
    }
    if (geometry.type === "LineString")
        return [geometry.coordinates];
    if (geometry.type === "MultiLineString")
        return geometry.coordinates;
    return [];
}
function pointPositions(geometry) {
    if (!geometry)
        return [];
    if (geometry.type === "Point")
        return [geometry.coordinates];
    if (geometry.type === "MultiPoint")
        return geometry.coordinates;
    return [];
}
function closestOnSegment(start, end, target) {
    let ex = end[0];
    while (ex - start[0] > 180)
        ex -= 360;
    while (ex - start[0] < -180)
        ex += 360;
    let tx = target[0];
    while (tx - start[0] > 180)
        tx -= 360;
    while (tx - start[0] < -180)
        tx += 360;
    const dx = ex - start[0];
    const dy = end[1] - start[1];
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 0) {
        t = ((tx - start[0]) * dx + (target[1] - start[1]) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
    }
    return [start[0] + dx * t, start[1] + dy * t];
}
function descendBeside(session, cell, point, anchor) {
    let current = cell;
    while ((0, h3_js_1.getResolution)(current) < session.fine &&
        current !== anchor &&
        cellContains(current, anchor)) {
        const childRes = (0, h3_js_1.getResolution)(current) < MID ? MID : session.fine;
        const child = (0, h3_js_1.latLngToCell)(point[1], wrapLng(point[0]), childRes);
        if ((0, h3_js_1.cellToParent)(child, (0, h3_js_1.getResolution)(current)) !== current)
            break;
        current = child;
    }
    return current;
}
function boundarySamples(rings, goal) {
    const samples = [];
    for (const ring of rings) {
        if (ring.length === 0)
            continue;
        if (ring.length === 1) {
            samples.push(ring[0]);
            continue;
        }
        const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
        const edges = closed ? ring.length - 1 : ring.length;
        for (let i = 0; i < edges; i++) {
            const start = ring[i];
            const end = ring[(i + 1) % ring.length];
            samples.push(closestOnSegment(start, end, goal));
            const span = metersBetween(start, end);
            const steps = Math.max(1, Math.ceil(span / 350));
            for (let step = 0; step <= steps; step++) {
                samples.push(pointAlong(start, unwrapLng(start[0], end[0]), end[1], step / steps));
            }
        }
    }
    samples.sort((a, b) => metersBetween(a, goal) - metersBetween(b, goal));
    const unique = [];
    for (const sample of samples) {
        if (unique.some((kept) => metersBetween(kept, sample) < 120))
            continue;
        unique.push(sample);
        if (unique.length >= 48)
            break;
    }
    return unique;
}
function unwrapLng(from, lng) {
    let x = lng;
    while (x - from > 180)
        x -= 360;
    while (x - from < -180)
        x += 360;
    return x;
}
function spread(samples, goal) {
    const picked = samples.slice(0, 12);
    const step = Math.max(1, Math.floor(samples.length / 8));
    for (let i = 0; i < samples.length; i += step)
        picked.push(samples[i]);
    picked.sort((a, b) => metersBetween(a, goal) - metersBetween(b, goal));
    return picked;
}
function lineFeature(coords) {
    return {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: coords },
    };
}
function publicProperties(properties, includedColumns) {
    if (!properties)
        return {};
    const keys = includedColumns?.length ? includedColumns : Object.keys(properties);
    const out = {};
    for (const key of keys) {
        if (key.startsWith("__"))
            continue;
        if (key in properties)
            out[key] = properties[key];
    }
    return out;
}
function featureId(feature, position) {
    const offset = feature.properties?.__offset;
    if (typeof offset === "number" && Number.isFinite(offset))
        return offset;
    return Math.round(position[0] * 1e5) * 1000003 + Math.round(position[1] * 1e5);
}
async function loadPoints(source, minX, minY, maxX, maxY) {
    const parts = (0, bboxUtils_1.splitBBoxAntimeridian)((0, bboxUtils_1.cleanBBox)([minX, minY, maxX, maxY]));
    const found = [];
    const seen = new Set();
    for (const part of parts) {
        const envelope = (0, bboxUtils_1.bboxToEnvelope)(part);
        for await (const feature of source.getFeaturesAsync(envelope)) {
            const offset = feature.properties?.__offset;
            if (typeof offset === "number") {
                if (seen.has(offset))
                    continue;
                seen.add(offset);
            }
            found.push(feature);
        }
    }
    return found;
}
async function warmCoarse(session, minX, minY, maxX, maxY) {
    const boxes = (0, bboxUtils_1.splitBBoxAntimeridian)((0, bboxUtils_1.cleanBBox)([minX, minY, maxX, maxY]));
    const cells = [];
    for (const box of boxes) {
        const ring = [
            [box[0], box[1]],
            [box[2], box[1]],
            [box[2], box[3]],
            [box[0], box[3]],
            [box[0], box[1]],
        ];
        try {
            for (const cell of (0, h3_js_1.polygonToCells)([ring], COARSE, true))
                cells.push(cell);
        }
        catch {
            // A degenerate ring still leaves the on-demand lookups.
        }
    }
    if (cells.length > 0)
        await session.occupancy.prefetch(cells);
}
async function searchWaterPathByOccupancy(feature, points, land, options) {
    if (!feature.geometry) {
        throw new Error("searchWaterPathByOccupancy: feature.geometry is required");
    }
    const started = Date.now();
    const occupancy = await landArchive(options?.archiveUrl || OCCUPANCY_URL);
    const session = {
        occupancy,
        fine: occupancy.fineResolution,
        land,
        known: new Map(),
        waterAdj: new Map(),
        centerWater: new Map(),
        features: new Map(),
        featureBox: new Map(),
        loaded: new Set(),
        segments: new Map(),
        expansions: 0,
    };
    const requestsBefore = occupancy.stats.requests;
    const bytesBefore = occupancy.stats.bytes;
    const maxResults = Math.min(waterPathNearestH3_1.MAX_WATER_PATH_RESULTS, Math.max(1, options?.maxResults ?? waterPathNearestH3_1.DEFAULT_WATER_PATH_MAX_RESULTS));
    const requestedKm = options?.maxDistanceKm ?? waterPathNearestH3_1.DEFAULT_WATER_PATH_DISTANCE_KM;
    const maxDistanceMeters = Math.min(requestedKm, waterPathNearestH3_1.MAX_DISTANCE_TO_FEATURES_KM) * 1000;
    const deadline = options?.deadline;
    const rings = exteriorRings(feature.geometry);
    if (rings.length === 0 && feature.geometry.type === "Point") {
        rings.push([feature.geometry.coordinates]);
    }
    const boundary = rings.flat();
    if (boundary.length === 0) {
        return { features: [], exceededLimit: false, candidates: [] };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let prev = boundary[0][0];
    for (const [lng, lat] of boundary) {
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
    const refLat = (minY + maxY) / 2;
    const latPad = maxDistanceMeters / 111320;
    const lngPad = latPad / Math.max(0.2, Math.cos((refLat * Math.PI) / 180));
    await warmCoarse(session, minX - lngPad, minY - latPad, maxX + lngPad, maxY + latPad);
    const sketch = [wrapLng((minX + maxX) / 2), refLat];
    await loadAround(session, sketch, 6000);
    const pointFeatures = await loadPoints(points, minX - lngPad, minY - latPad, maxX + lngPad, maxY + latPad);
    const candidates = [];
    for (const pointFeature of pointFeatures) {
        for (const position of pointPositions(pointFeature.geometry)) {
            const samples = boundarySamples(rings, position);
            const origin = samples[0] ?? boundary[0];
            const geodesic = metersBetween(origin, position);
            if (geodesic > maxDistanceMeters)
                continue;
            candidates.push({
                id: featureId(pointFeature, position),
                position,
                geodesic,
                properties: publicProperties(pointFeature.properties, options?.includedColumns),
                samples,
            });
        }
    }
    candidates.sort((a, b) => a.geodesic - b.geodesic);
    const routes = [];
    let exceededLimit = false;
    let routed = 0;
    const pool = candidates.slice(0, Math.max(maxResults * CANDIDATE_FACTOR, maxResults));
    const accept = (id, meters, properties, line) => {
        if (meters <= 0 || meters > maxDistanceMeters || line.length < 2)
            return;
        const previous = routes.find((hit) => hit.__id === id);
        if (previous && previous.meters <= meters)
            return;
        if (previous)
            routes.splice(routes.indexOf(previous), 1);
        routes.push({
            __id: id,
            meters,
            properties,
            geojsonLine: lineFeature(line),
        });
        routes.sort((a, b) => a.meters - b.meters);
        if (routes.length > maxResults)
            routes.length = maxResults;
    };
    for (const candidate of pool) {
        if (deadline != null && Date.now() > deadline) {
            exceededLimit = true;
            break;
        }
        // Geodesic distance is a lower bound, so a port farther than the worst
        // route already kept cannot enter the top results.
        if (routes.length >= maxResults && candidate.geodesic >= routes[maxResults - 1].meters) {
            break;
        }
        if (routed >= maxResults * CANDIDATE_FACTOR) {
            exceededLimit = true;
            break;
        }
        routed++;
        const goal = await offshoreGoal(session, candidate.position);
        let direct = null;
        let attempts = 0;
        for (const sample of candidate.samples) {
            if (++attempts > 16)
                break;
            if (await segmentBlocked(session, sample, goal, "ends"))
                continue;
            direct = finishLine([sample, goal]);
            break;
        }
        if (direct && !(await firstInteriorLand(session, direct))) {
            accept(candidate.id, lineLength(direct), candidate.properties, direct);
            continue;
        }
        const anchor = await anchorFor(session, goal);
        if (!anchor)
            continue;
        await loadAround(session, goal, 6000);
        const seeds = [];
        const seeded = new Set();
        for (const sample of spread(candidate.samples, candidate.position)) {
            const seed = await seedFor(session, sample, anchor);
            if (!seed || seeded.has(seed.cell))
                continue;
            seeded.add(seed.cell);
            seeds.push(seed);
            if (seeds.length >= 10)
                break;
        }
        if (seeds.length === 0)
            continue;
        const origin = seeds[0].point;
        // Until the result list is full, a later port may still be closer by
        // water than anything kept so far. After that, only a route that beats
        // the worst kept one is worth the walk.
        const limitMeters = routes.length >= maxResults ? routes[maxResults - 1].meters : maxDistanceMeters;
        let found = await routeCells(session, seeds, anchor, origin, goal, maxDistanceMeters, "ends", deadline, limitMeters);
        if (!found && (deadline == null || Date.now() < deadline)) {
            found = await routeCells(session, seeds, anchor, origin, goal, maxDistanceMeters, "corridor", deadline, limitMeters);
        }
        if (!found)
            continue;
        let pulled = finishLine(await stringPull(session, await openHops(session, await stringPull(session, trace(session, found.end, found.prev, found.depart, goal)))));
        for (let attempt = 0; attempt < 4; attempt++) {
            const hit = await firstInteriorLand(session, pulled);
            if (!hit)
                break;
            const nudged = await nudgeOffLand(session, pulled, hit);
            if (!nudged)
                break;
            const simplified = finishLine(await stringPull(session, nudged));
            pulled = (await firstInteriorLand(session, simplified)) ? nudged : simplified;
        }
        if (await firstInteriorLand(session, pulled)) {
            pulled = await dockAtShore(session, pulled);
        }
        if (await firstInteriorLand(session, pulled))
            continue;
        accept(candidate.id, lineLength(pulled), candidate.properties, pulled);
    }
    if (process.env.WATER_PATH_DEBUG) {
        const name = String(feature.properties?.name ?? "occupancy");
        console.log(`occupancy ${name}: routes=${routes.length} expansions=${session.expansions} requests=${occupancy.stats.requests - requestsBefore} bytes=${occupancy.stats.bytes - bytesBefore} ${Date.now() - started}ms`);
    }
    const routedMeters = new Map(routes.map((route) => [route.__id, route.meters]));
    const kept = routes.slice(0, maxResults);
    const occupancyTrace = options?.trace
        ? {
            fine: session.fine,
            expansions: session.expansions,
            requests: occupancy.stats.requests - requestsBefore,
            bytes: occupancy.stats.bytes - bytesBefore,
            cells: [...session.known].map(([cell, state]) => ({ cell, state })),
        }
        : undefined;
    return {
        features: kept,
        exceededLimit,
        candidates: candidates.map((candidate) => ({
            __id: candidate.id,
            position: candidate.position,
            properties: candidate.properties,
            geodesicMeters: candidate.geodesic,
            meters: routedMeters.get(candidate.id),
        })),
        trace: occupancyTrace,
    };
}
//# sourceMappingURL=waterPathOccupancy.js.map