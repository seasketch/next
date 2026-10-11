"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CellSet = void 0;
exports.splitRings = splitRings;
exports.emptyContribution = emptyContribution;
exports.nextCover = nextCover;
exports.measureGeometry = measureGeometry;
exports.collectCoarse = collectCoarse;
exports.collectRefine = collectRefine;
exports.isPolygonGeometry = isPolygonGeometry;
const h3_js_1 = require("h3-js");
const constants_1 = require("./constants");
const coverage_1 = require("./coverage");
const h3int_1 = require("./h3int");
/**
 * h3-js runs on a fixed-size WebAssembly heap. A polygon with hundreds of
 * thousands of vertices, or one that produces millions of cells, exhausts it
 * and libh3 reports E_MEMORY_ALLOC (code 13). The polygon is then split along
 * its bounding box and each half is tried on its own.
 */
const MAX_SPLIT_DEPTH = 16;
function isH3MemoryError(error) {
    const message = error instanceof Error ? error.message : String(error);
    return /memory allocation failed/i.test(message);
}
function toPts(ring) {
    return ring.map((point) => [point[0], point[1]]);
}
/**
 * Cut a polygon in two along the longer axis of its bounding box. Both halves
 * keep their holes. Returns the non-empty halves, or null when the polygon is
 * too thin to cut.
 */
function splitRings(rings) {
    const outer = rings[0];
    if (!outer || outer.length < 4)
        return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of outer) {
        if (x < minX)
            minX = x;
        if (x > maxX)
            maxX = x;
        if (y < minY)
            minY = y;
        if (y > maxY)
            maxY = y;
    }
    const width = maxX - minX;
    const height = maxY - minY;
    if (!(Math.max(width, height) > 1e-9))
        return null;
    const windows = width >= height
        ? [
            [[minX, minY], [(minX + maxX) / 2, minY], [(minX + maxX) / 2, maxY], [minX, maxY]],
            [[(minX + maxX) / 2, minY], [maxX, minY], [maxX, maxY], [(minX + maxX) / 2, maxY]],
        ]
        : [
            [[minX, minY], [maxX, minY], [maxX, (minY + maxY) / 2], [minX, (minY + maxY) / 2]],
            [[minX, (minY + maxY) / 2], [maxX, (minY + maxY) / 2], [maxX, maxY], [minX, maxY]],
        ];
    const halves = [];
    for (const window of windows) {
        const clippedOuter = (0, coverage_1.clipToConvex)(toPts(outer), window);
        if (clippedOuter.length < 3)
            continue;
        const half = [closeRing(clippedOuter)];
        for (let i = 1; i < rings.length; i++) {
            const hole = (0, coverage_1.clipToConvex)(toPts(rings[i]), window);
            if (hole.length >= 3)
                half.push(closeRing(hole));
        }
        halves.push(half);
    }
    return halves.length > 0 ? halves : null;
}
/**
 * `polygonToCellsExperimental` that survives libh3 running out of heap by
 * splitting the polygon. Overlapping cells on the cut line are reported once.
 * Fully contained cells on the cut line are missed; they come back as
 * overlapping instead, which is conservative.
 */
function cellsFor(rings, resolution, flag, depth = 0) {
    try {
        return (0, h3_js_1.polygonToCellsExperimental)(rings, resolution, flag, true);
    }
    catch (error) {
        if (!isH3MemoryError(error) || depth >= MAX_SPLIT_DEPTH)
            throw error;
        const halves = splitRings(rings);
        if (!halves)
            throw error;
        const out = new Set();
        for (const half of halves) {
            for (const cell of cellsFor(half, resolution, flag, depth + 1))
                out.add(cell);
        }
        return out;
    }
}
/**
 * V8 refuses a single Set past 2^24 entries. One resolution-9 land polygon
 * can contain more cells than that, so entire-cell ids are stored in chunks.
 */
const CELL_SET_CHUNK = 8_000_000;
class CellSet {
    chunkSize;
    chunks = [];
    tail = new Set();
    size = 0;
    constructor(chunkSize = CELL_SET_CHUNK) {
        this.chunkSize = chunkSize;
    }
    add(value) {
        if (this.has(value))
            return;
        if (this.tail.size >= this.chunkSize) {
            this.chunks.push(this.tail);
            this.tail = new Set();
        }
        this.tail.add(value);
        this.size++;
    }
    has(value) {
        if (this.tail.has(value))
            return true;
        for (const chunk of this.chunks) {
            if (chunk.has(value))
                return true;
        }
        return false;
    }
    [Symbol.iterator]() {
        const chunks = this.chunks;
        const tail = this.tail;
        return (function* () {
            for (const chunk of chunks)
                yield* chunk;
            yield* tail;
        })();
    }
}
exports.CellSet = CellSet;
function emptyContribution() {
    return { entire: new CellSet(), cover: new Map() };
}
function nextCover(previous, added, cellArea, epsilon) {
    if (!(added > constants_1.MIN_COVER_M2))
        return { kind: "unchanged" };
    const cover = previous + added;
    if (cover >= cellArea * (1 - epsilon))
        return { kind: "entire", cover };
    return { kind: "partial", cover };
}
function closeRing(ring) {
    const out = ring.map((point) => [point[0], point[1]]);
    if (out.length === 0)
        return out;
    const first = out[0];
    const last = out[out.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1])
        out.push([first[0], first[1]]);
    return out;
}
function eachPolygon(geometry, visit) {
    if (geometry.type === "Polygon") {
        visit(geometry.coordinates.map(closeRing));
        return;
    }
    if (geometry.type === "MultiPolygon") {
        for (const polygon of geometry.coordinates)
            visit(polygon.map(closeRing));
        return;
    }
    throw new Error(`unsupported geometry ${geometry.type}`);
}
function usable(rings) {
    const outer = rings[0];
    return !!outer && outer.length >= 4;
}
/**
 * Classify one land polygon at `resolution`.
 *
 * `containmentFull` cells are entire: the piece covers them, so neighboring
 * pieces are not required. Remaining overlapping cells contribute intersection
 * area. Callers add that area across the non-overlapping subdivision and
 * promote a cell when the sum covers it.
 */
function measureGeometry(geometry, resolution, epsilon = constants_1.DEFAULT_COVER_EPSILON) {
    const contribution = emptyContribution();
    eachPolygon(geometry, (rings) => {
        if (!usable(rings))
            return;
        measureRings(rings, resolution, epsilon, contribution);
    });
    return contribution;
}
function measureRings(rings, resolution, epsilon, into) {
    const full = cellsFor(rings, resolution, h3_js_1.POLYGON_TO_CELLS_FLAGS.containmentFull);
    for (const index of full)
        into.entire.add((0, h3int_1.cellToInt)(index));
    const overlapping = cellsFor(rings, resolution, h3_js_1.POLYGON_TO_CELLS_FLAGS.containmentOverlapping);
    for (const index of overlapping) {
        const h3 = (0, h3int_1.cellToInt)(index);
        if (into.entire.has(h3))
            continue;
        const area = (0, coverage_1.intersectionAreaM2)(h3, rings);
        const cellArea = (0, coverage_1.hexAreaM2)(h3);
        const decision = nextCover(into.cover.get(h3) ?? 0, area, cellArea, epsilon);
        if (decision.kind === "entire") {
            into.cover.delete(h3);
            into.entire.add(h3);
        }
        else if (decision.kind === "partial") {
            into.cover.set(h3, decision.cover);
        }
    }
}
/**
 * Classify one geometry at the base resolution. Fully contained cells are
 * sealed. Overlapping cells keep their area and are refined later, including
 * cells that are almost entirely covered: the 0.1% sliver can still make a
 * finer child mixed.
 */
function collectCoarse(geometry, baseResolution) {
    const sealed = new CellSet();
    const pieces = [];
    eachPolygon(geometry, (rings) => {
        if (!usable(rings))
            return;
        pieces.push(rings);
    });
    for (const rings of pieces) {
        const full = cellsFor(rings, baseResolution, h3_js_1.POLYGON_TO_CELLS_FLAGS.containmentFull);
        for (const index of full)
            sealed.add((0, h3int_1.cellToInt)(index));
    }
    const overlap = new Map();
    for (const rings of pieces) {
        const overlapping = cellsFor(rings, baseResolution, h3_js_1.POLYGON_TO_CELLS_FLAGS.containmentOverlapping);
        for (const index of overlapping) {
            const h3 = (0, h3int_1.cellToInt)(index);
            if (sealed.has(h3))
                continue;
            const area = (0, coverage_1.intersectionAreaM2)(h3, rings);
            if (!(area > constants_1.MIN_COVER_M2))
                continue;
            overlap.set(h3, (overlap.get(h3) ?? 0) + area);
        }
    }
    return { sealed, overlap };
}
/**
 * Area this geometry adds to each fine child of a mixed base cell.
 *
 * Descendants reach outside the base cell's outline, so the polygon is
 * clipped to the base hexagon scaled by `DESCENDANT_REACH`, and the mixed
 * neighbors of every overlapping base cell are measured as well: a piece
 * that only touches the corner of a child may not overlap the parent at all.
 * Clipping first keeps a continental ring from being re-tested against every
 * child.
 */
function collectRefine(geometry, baseResolution, fineResolution, isMixed) {
    const covers = new Map();
    eachPolygon(geometry, (rings) => {
        if (!usable(rings))
            return;
        const bbox = (0, coverage_1.ringsBbox)(rings);
        const overlapping = cellsFor(rings, baseResolution, h3_js_1.POLYGON_TO_CELLS_FLAGS.containmentOverlapping);
        const parents = new Set();
        for (const index of overlapping) {
            for (const candidate of (0, h3_js_1.gridDisk)(index, 1)) {
                const parent = (0, h3int_1.cellToInt)(candidate);
                if (isMixed(parent))
                    parents.add(parent);
            }
        }
        for (const parent of parents) {
            if (!(0, coverage_1.bboxesOverlap)((0, coverage_1.cellReachBbox)(parent, coverage_1.DESCENDANT_REACH), bbox))
                continue;
            const clipped = (0, coverage_1.clipRingsToCell)(rings, parent, coverage_1.DESCENDANT_REACH);
            if (!clipped)
                continue;
            for (const child of (0, h3_js_1.cellToChildren)((0, h3int_1.intToCell)(parent), fineResolution)) {
                const h3 = (0, h3int_1.cellToInt)(child);
                const area = (0, coverage_1.intersectionAreaM2)(h3, clipped);
                if (!(area > constants_1.MIN_COVER_M2))
                    continue;
                covers.set(h3, (covers.get(h3) ?? 0) + area);
            }
        }
    });
    return covers;
}
function isPolygonGeometry(geometry) {
    return geometry?.type === "Polygon" || geometry?.type === "MultiPolygon";
}
//# sourceMappingURL=classify.js.map