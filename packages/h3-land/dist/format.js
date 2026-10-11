"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OccupancyArchive = exports.OccupancyAccumulator = exports.FILE_STATE_NONE = exports.RECORD_STRIDE = exports.RECORD_SLOTS = exports.HEADER_BYTES = exports.FINE_RESOLUTION = exports.COARSE_RESOLUTION = exports.ARCHIVE_VERSION = exports.ARCHIVE_MAGIC = void 0;
exports.buildRankTables = buildRankTables;
exports.cellRank = cellRank;
exports.parentAtCoarse = parentAtCoarse;
exports.childPosition = childPosition;
exports.recordSlots = recordSlots;
exports.recordStride = recordStride;
exports.pentagonFineChildren = pentagonFineChildren;
exports.fineChildCount = fineChildCount;
exports.descendantSlotBlock = descendantSlotBlock;
exports.packedBytes = packedBytes;
exports.getPackedState = getPackedState;
exports.setPackedState = setPackedState;
const h3_js_1 = require("h3-js");
const constants_1 = require("./constants");
const h3int_1 = require("./h3int");
/**
 * Fixed-stride H3 land occupancy.
 *
 *   0  char[4]  "H3LD"
 *   4  u8       version (1)
 *   5  u8       fine resolution (8)
 *   6  u8       coarse resolution (4)
 *   7  u8       first stored plane (0)
 *   8  u8       bits per cell (2)
 *   9  u8[3]    reserved
 *  12  u32le    slots in one fine record (2401)
 *  16  u32le    record stride in bytes (601)
 *  20  u32le    number of fine records
 *  24  u32le    byte offset of the first fine record
 *
 * Planes for resolutions 0..coarse follow the header. Each plane is
 * `u32le cellCount` plus 2-bit values packed little-bit-first (four cells
 * per byte). State 0 is water, 1 is partial, 2 is entire.
 *
 * Fine records follow, one per partial coarse cell, in ascending coarse
 * rank. A record is 2,401 slots of the same 2-bit packing, indexed by
 * `cellToChildPos(cell, coarse)`. The record index is the number of
 * partial coarse cells with a smaller rank, so a client that has the
 * coarse plane can form the byte range without any other index.
 * Resolutions between coarse and fine are folded from that record.
 */
exports.ARCHIVE_MAGIC = "H3LD";
exports.ARCHIVE_VERSION = 1;
exports.COARSE_RESOLUTION = 4;
exports.FINE_RESOLUTION = 8;
exports.HEADER_BYTES = 28;
exports.RECORD_SLOTS = 7 ** (exports.FINE_RESOLUTION - exports.COARSE_RESOLUTION);
exports.RECORD_STRIDE = Math.ceil((exports.RECORD_SLOTS * 2) / 8);
exports.FILE_STATE_NONE = 0;
function buildRankTables() {
    const pentagonBases = new Set((0, h3_js_1.getPentagons)(0).map((cell) => (0, h3_js_1.getBaseCellNumber)(cell)));
    const prefix = [];
    for (let res = 0; res <= exports.COARSE_RESOLUTION; res++) {
        const starts = new Uint32Array(123);
        for (let base = 0; base < 122; base++) {
            const count = res === 0
                ? 1
                : pentagonBases.has(base)
                    ? 1 + (5 * (7 ** res - 1)) / 6
                    : 7 ** res;
            starts[base + 1] = starts[base] + count;
        }
        if (starts[122] !== (0, h3_js_1.getNumCells)(res)) {
            throw new Error(`rank table at res ${res} covers ${starts[122]} cells, H3 has ${(0, h3_js_1.getNumCells)(res)}`);
        }
        prefix.push(starts);
    }
    return { pentagonBases, prefix };
}
function cellRank(cell, res, tables) {
    const base = (0, h3_js_1.getBaseCellNumber)(cell);
    const pos = res === 0 ? 0 : (0, h3_js_1.cellToChildPos)(cell, 0);
    const start = tables.prefix[res][base];
    const end = tables.prefix[res][base + 1];
    if (pos < 0 || start + pos >= end) {
        throw new Error(`cell ${cell} is outside the rank range of its base cell`);
    }
    return start + pos;
}
/**
 * Coarse parent of a fine cell. Digits finer than `coarse` are set to 7 and
 * the resolution field is rewritten, which is how H3 forms the parent index.
 */
function parentAtCoarse(h3, coarse = exports.COARSE_RESOLUTION) {
    const resolution = Number((h3 >> 52n) & 15n);
    const resolutionMask = 15n << 52n;
    const bits = 3 * (resolution - coarse);
    const shift = 3 * (15 - resolution);
    const belowCoarse = ((1n << BigInt(bits)) - 1n) << BigInt(shift);
    return ((h3 & ~(resolutionMask | belowCoarse)) |
        (BigInt(coarse) << 52n) |
        belowCoarse);
}
function underPentagon(h3, tables) {
    const base = Number((h3 >> 45n) & 127n);
    if (!tables.pentagonBases.has(base))
        return false;
    return ((h3 >> 33n) & 4095n) === 0n;
}
/** Slot of a fine cell inside its coarse parent record. */
function childPosition(h3, tables, coarse = exports.COARSE_RESOLUTION) {
    if (underPentagon(h3, tables)) {
        return (0, h3_js_1.cellToChildPos)((0, h3int_1.intToCell)(h3), coarse);
    }
    const resolution = Number((h3 >> 52n) & 15n);
    let pos = 0;
    for (let digit = coarse + 1; digit <= resolution; digit++) {
        const shift = BigInt(3 * (15 - digit));
        pos = pos * 7 + Number((h3 >> shift) & 7n);
    }
    return pos;
}
function recordSlots(fineResolution, coarse = exports.COARSE_RESOLUTION) {
    return 7 ** (fineResolution - coarse);
}
function recordStride(fineResolution, coarse = exports.COARSE_RESOLUTION) {
    return Math.ceil((recordSlots(fineResolution, coarse) * 2) / 8);
}
function pentagonFineChildren(fineResolution, coarse = exports.COARSE_RESOLUTION) {
    const hex = recordSlots(fineResolution, coarse);
    return 1 + (5 * (hex - 1)) / 6;
}
function fineChildCount(parent, fineResolution, tables) {
    return underPentagon(parent, tables)
        ? pentagonFineChildren(fineResolution)
        : recordSlots(fineResolution);
}
/**
 * Slot range of `h3` inside its resolution-4 record at `fineResolution`.
 * Hex children occupy a contiguous base-7 block. Pentagon descendants use
 * H3 child positions, which stay contiguous but are not a raw power of 7.
 */
function descendantSlotBlock(h3, fineResolution, tables) {
    const resolution = Number((h3 >> 52n) & 15n);
    if (resolution < exports.COARSE_RESOLUTION || resolution > fineResolution) {
        throw new Error(`cell resolution ${resolution} cannot fill a fine record`);
    }
    if (!underPentagon(h3, tables)) {
        const span = 7 ** (fineResolution - resolution);
        return { start: childPosition(h3, tables) * span, count: span };
    }
    const children = (0, h3_js_1.cellToChildren)((0, h3int_1.intToCell)(h3), fineResolution);
    if (children.length === 0)
        return { start: 0, count: 0 };
    let start = Number.POSITIVE_INFINITY;
    let end = -1;
    for (const child of children) {
        const pos = (0, h3_js_1.cellToChildPos)(child, exports.COARSE_RESOLUTION);
        if (pos < start)
            start = pos;
        if (pos > end)
            end = pos;
    }
    if (end - start + 1 !== children.length) {
        throw new Error("pentagon descendants are not a contiguous slot block");
    }
    return { start, count: children.length };
}
function packedBytes(cellCount) {
    return Math.ceil((cellCount * 2) / 8);
}
function getPackedState(bytes, index) {
    const shift = (index & 3) << 1;
    return (bytes[index >> 2] >> shift) & 3;
}
function setPackedState(bytes, index, state) {
    const at = index >> 2;
    const shift = (index & 3) << 1;
    bytes[at] = (bytes[at] & ~(3 << shift)) | (state << shift);
}
class OccupancyAccumulator {
    tables = buildRankTables();
    fineResolution;
    slots;
    stride;
    hexChildren;
    pentagonChildren;
    buckets = new Map();
    uniformEntire = new Set();
    cells = 0;
    entireCells = 0;
    partialCells = 0;
    constructor(fineResolution = exports.FINE_RESOLUTION) {
        if (fineResolution <= exports.COARSE_RESOLUTION || fineResolution > 15) {
            throw new Error(`fine resolution must be between ${exports.COARSE_RESOLUTION + 1} and 15`);
        }
        this.fineResolution = fineResolution;
        this.slots = recordSlots(fineResolution);
        this.stride = recordStride(fineResolution);
        this.hexChildren = this.slots;
        this.pentagonChildren = pentagonFineChildren(fineResolution);
    }
    /** A coarse cell whose every fine child is land. Its children are not stored. */
    markUniformEntire(parent) {
        if (this.buckets.has(parent) || this.uniformEntire.has(parent)) {
            throw new Error("coarse cell was recorded twice");
        }
        const expected = fineChildCount(parent, this.fineResolution, this.tables);
        this.uniformEntire.add(parent);
        this.cells += expected;
        this.entireCells += expected;
    }
    add(h3, state) {
        const parent = parentAtCoarse(h3);
        this.addAt(parent, childPosition(h3, this.tables), state);
    }
    /** Mark a contiguous run of fine slots, used when a coarser cell is entirely land. */
    fillSlots(parent, start, count, state) {
        for (let pos = start; pos < start + count; pos++)
            this.addAt(parent, pos, state);
    }
    addAt(parent, pos, state) {
        if (state !== constants_1.STATE_PARTIAL && state !== constants_1.STATE_ENTIRE) {
            throw new Error(`cell state must be partial or entire, got ${state}`);
        }
        if (this.uniformEntire.has(parent)) {
            throw new Error("cell belongs to a coarse cell already marked entirely land");
        }
        if (pos < 0 || pos >= this.slots) {
            throw new Error(`child position ${pos} is outside a coarse record`);
        }
        let bucket = this.buckets.get(parent);
        if (!bucket) {
            bucket = { pos: new Uint16Array(8), state: new Uint8Array(8), n: 0 };
            this.buckets.set(parent, bucket);
        }
        if (bucket.n === bucket.pos.length) {
            const grown = new Uint16Array(bucket.n * 2);
            const grownState = new Uint8Array(bucket.n * 2);
            grown.set(bucket.pos);
            grownState.set(bucket.state);
            bucket.pos = grown;
            bucket.state = grownState;
        }
        bucket.pos[bucket.n] = pos;
        bucket.state[bucket.n] = state;
        bucket.n++;
        if (bucket.n > this.hexChildren) {
            throw new Error(`coarse cell has more than ${this.hexChildren} children`);
        }
        this.cells++;
        if (state === constants_1.STATE_ENTIRE)
            this.entireCells++;
        else
            this.partialCells++;
    }
    finish() {
        const tables = this.tables;
        const coarseCount = tables.prefix[exports.COARSE_RESOLUTION][122];
        const coarseState = new Uint8Array(coarseCount);
        const mixed = [];
        let entireParents = this.uniformEntire.size;
        for (const parent of this.uniformEntire) {
            const rank = cellRank((0, h3int_1.intToCell)(parent), exports.COARSE_RESOLUTION, tables);
            coarseState[rank] = constants_1.STATE_ENTIRE;
        }
        for (const [parent, bucket] of this.buckets) {
            const cell = (0, h3int_1.intToCell)(parent);
            const rank = cellRank(cell, exports.COARSE_RESOLUTION, tables);
            const expected = underPentagon(parent, tables)
                ? this.pentagonChildren
                : this.hexChildren;
            let allEntire = bucket.n === expected;
            if (allEntire) {
                for (let i = 0; i < bucket.n; i++) {
                    if (bucket.state[i] !== constants_1.STATE_ENTIRE) {
                        allEntire = false;
                        break;
                    }
                }
            }
            if (allEntire) {
                coarseState[rank] = constants_1.STATE_ENTIRE;
                entireParents++;
                continue;
            }
            coarseState[rank] = constants_1.STATE_PARTIAL;
            mixed.push({ parent, rank, bucket });
        }
        mixed.sort((a, b) => a.rank - b.rank);
        const planeLengths = [];
        let planesBytes = 0;
        for (let res = 0; res <= exports.COARSE_RESOLUTION; res++) {
            const bytes = 4 + packedBytes(tables.prefix[res][122]);
            planeLengths.push(bytes);
            planesBytes += bytes;
        }
        const recordsStart = exports.HEADER_BYTES + planesBytes;
        const out = new Uint8Array(recordsStart + mixed.length * this.stride);
        const view = new DataView(out.buffer);
        out.set(new TextEncoder().encode(exports.ARCHIVE_MAGIC), 0);
        out[4] = exports.ARCHIVE_VERSION;
        out[5] = this.fineResolution;
        out[6] = exports.COARSE_RESOLUTION;
        out[7] = 0;
        out[8] = 2;
        view.setUint32(12, this.slots, true);
        view.setUint32(16, this.stride, true);
        view.setUint32(20, mixed.length, true);
        view.setUint32(24, recordsStart, true);
        const planeOffset = [];
        let cursor = exports.HEADER_BYTES;
        for (let res = 0; res <= exports.COARSE_RESOLUTION; res++) {
            view.setUint32(cursor, tables.prefix[res][122], true);
            planeOffset.push(cursor + 4);
            cursor += planeLengths[res];
        }
        const coarsePacked = out.subarray(planeOffset[exports.COARSE_RESOLUTION], planeOffset[exports.COARSE_RESOLUTION] + packedBytes(coarseCount));
        for (let rank = 0; rank < coarseCount; rank++) {
            if (coarseState[rank])
                setPackedState(coarsePacked, rank, coarseState[rank]);
        }
        const used = new Uint8Array(this.slots);
        for (let record = 0; record < mixed.length; record++) {
            const bucket = mixed[record].bucket;
            const packed = out.subarray(recordsStart + record * this.stride, recordsStart + (record + 1) * this.stride);
            used.fill(0xff);
            for (let i = 0; i < bucket.n; i++) {
                const pos = bucket.pos[i];
                if (used[pos] !== 0xff) {
                    throw new Error(`duplicate child position ${pos}`);
                }
                used[pos] = bucket.state[i];
                setPackedState(packed, pos, bucket.state[i]);
            }
        }
        writeCoarserPlanes(out, planeOffset, coarseState, tables);
        return {
            bytes: out,
            stats: {
                cells: this.cells,
                entireCells: this.entireCells,
                partialCells: this.partialCells,
                entireParents,
                mixedParents: mixed.length,
                waterParents: coarseCount - entireParents - mixed.length,
                bytes: out.byteLength,
            },
        };
    }
}
exports.OccupancyAccumulator = OccupancyAccumulator;
function writeCoarserPlanes(out, planeOffset, coarseState, tables) {
    const notes = [];
    for (let res = 0; res < exports.COARSE_RESOLUTION; res++) {
        const count = tables.prefix[res][122];
        notes.push(Array.from({ length: count }, () => ({
            seen: 0,
            allEntire: true,
            allWater: true,
        })));
    }
    for (const base of (0, h3_js_1.getRes0Cells)()) {
        for (const cell of (0, h3_js_1.cellToChildren)(base, exports.COARSE_RESOLUTION)) {
            const rank = cellRank(cell, exports.COARSE_RESOLUTION, tables);
            const state = coarseState[rank] ?? exports.FILE_STATE_NONE;
            let current = cell;
            for (let res = exports.COARSE_RESOLUTION - 1; res >= 0; res--) {
                const parent = (0, h3_js_1.cellToParent)(current, res);
                const parentRank = cellRank(parent, res, tables);
                const note = notes[res][parentRank];
                note.seen++;
                if (state !== constants_1.STATE_ENTIRE)
                    note.allEntire = false;
                if (state !== exports.FILE_STATE_NONE)
                    note.allWater = false;
                current = parent;
            }
        }
    }
    for (let res = 0; res < exports.COARSE_RESOLUTION; res++) {
        const count = tables.prefix[res][122];
        const packed = out.subarray(planeOffset[res], planeOffset[res] + packedBytes(count));
        for (const base of (0, h3_js_1.getRes0Cells)()) {
            const cells = res === 0 ? [base] : (0, h3_js_1.cellToChildren)(base, res);
            for (const cell of cells) {
                const rank = cellRank(cell, res, tables);
                const note = notes[res][rank];
                const expected = (0, h3_js_1.cellToChildrenSize)(cell, exports.COARSE_RESOLUTION);
                if (note.seen !== expected) {
                    throw new Error(`res ${res} cell ${cell} saw ${note.seen} coarse children, expected ${expected}`);
                }
                const state = note.allWater
                    ? exports.FILE_STATE_NONE
                    : note.allEntire
                        ? constants_1.STATE_ENTIRE
                        : constants_1.STATE_PARTIAL;
                if (state !== exports.FILE_STATE_NONE)
                    setPackedState(packed, rank, state);
            }
        }
    }
}
class OccupancyArchive {
    bytes;
    recordsStart;
    mixedCount;
    fineResolution;
    stride;
    planes;
    /** Record index of each partial coarse cell, or -1 when the coarse cell is uniform. */
    recordIndex;
    constructor(bytes, recordsStart, mixedCount, fineResolution, stride, planes, recordIndex) {
        this.bytes = bytes;
        this.recordsStart = recordsStart;
        this.mixedCount = mixedCount;
        this.fineResolution = fineResolution;
        this.stride = stride;
        this.planes = planes;
        this.recordIndex = recordIndex;
    }
    static open(bytes) {
        if (bytes.byteLength < exports.HEADER_BYTES)
            throw new Error("archive is shorter than its header");
        const magic = new TextDecoder().decode(bytes.subarray(0, 4));
        if (magic !== exports.ARCHIVE_MAGIC)
            throw new Error(`unexpected archive magic ${magic}`);
        if (bytes[4] !== exports.ARCHIVE_VERSION)
            throw new Error(`unsupported archive version ${bytes[4]}`);
        const fineResolution = bytes[5];
        if (bytes[6] !== exports.COARSE_RESOLUTION || fineResolution <= exports.COARSE_RESOLUTION) {
            throw new Error("archive resolution does not match this reader");
        }
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const slots = view.getUint32(12, true);
        const stride = view.getUint32(16, true);
        const mixedCount = view.getUint32(20, true);
        const recordsStart = view.getUint32(24, true);
        if (slots !== recordSlots(fineResolution) ||
            stride !== recordStride(fineResolution)) {
            throw new Error("archive record layout does not match this reader");
        }
        const planes = [];
        let cursor = exports.HEADER_BYTES;
        for (let res = 0; res <= exports.COARSE_RESOLUTION; res++) {
            if (cursor + 4 > bytes.byteLength)
                throw new Error("archive planes are truncated");
            const count = view.getUint32(cursor, true);
            if (count !== (0, h3_js_1.getNumCells)(res)) {
                throw new Error(`plane ${res} has ${count} cells, H3 has ${(0, h3_js_1.getNumCells)(res)}`);
            }
            const size = packedBytes(count);
            planes.push({ count, offset: cursor + 4 });
            cursor += 4 + size;
        }
        if (cursor !== recordsStart) {
            throw new Error("record offset does not follow the coarse planes");
        }
        const end = recordsStart + mixedCount * stride;
        if (bytes.byteLength < end)
            throw new Error("archive records are truncated");
        const coarse = planes[exports.COARSE_RESOLUTION];
        const recordIndex = new Int32Array(coarse.count);
        recordIndex.fill(-1);
        let next = 0;
        const packed = bytes.subarray(coarse.offset, coarse.offset + packedBytes(coarse.count));
        for (let rank = 0; rank < coarse.count; rank++) {
            if (getPackedState(packed, rank) === constants_1.STATE_PARTIAL)
                recordIndex[rank] = next++;
        }
        if (next !== mixedCount) {
            throw new Error(`header lists ${mixedCount} records, the coarse plane has ${next}`);
        }
        return new OccupancyArchive(bytes, recordsStart, mixedCount, fineResolution, stride, planes, recordIndex);
    }
    /** Byte offset of a partial coarse cell's record, or null when the cell is uniform. */
    recordOffset(coarseCell) {
        const rank = cellRank(coarseCell, exports.COARSE_RESOLUTION, sharedTables);
        const index = this.recordIndex[rank];
        if (index == null || index < 0)
            return null;
        return this.recordsStart + index * this.stride;
    }
    state(cell) {
        const resolution = (0, h3_js_1.getResolution)(cell);
        if (resolution <= exports.COARSE_RESOLUTION) {
            const rank = cellRank(cell, resolution, sharedTables);
            const plane = this.planes[resolution];
            const packed = this.bytes.subarray(plane.offset, plane.offset + packedBytes(plane.count));
            return getPackedState(packed, rank);
        }
        if (resolution > this.fineResolution) {
            throw new Error(`cell ${cell} is finer than this archive`);
        }
        const parent = (0, h3_js_1.cellToParent)(cell, exports.COARSE_RESOLUTION);
        const parentState = this.state(parent);
        if (parentState !== constants_1.STATE_PARTIAL)
            return parentState;
        const offset = this.recordOffset(parent);
        if (offset == null)
            throw new Error(`partial cell ${parent} has no record`);
        const record = this.bytes.subarray(offset, offset + this.stride);
        if (resolution === this.fineResolution) {
            return getPackedState(record, (0, h3_js_1.cellToChildPos)(cell, exports.COARSE_RESOLUTION));
        }
        return foldRecord(record, cell, this.fineResolution);
    }
}
exports.OccupancyArchive = OccupancyArchive;
const sharedTables = buildRankTables();
function foldRecord(record, cell, fineResolution) {
    const children = (0, h3_js_1.cellToChildren)(cell, fineResolution);
    let allEntire = true;
    let allWater = true;
    for (const child of children) {
        const state = getPackedState(record, (0, h3_js_1.cellToChildPos)(child, exports.COARSE_RESOLUTION));
        if (state !== constants_1.STATE_ENTIRE)
            allEntire = false;
        if (state !== exports.FILE_STATE_NONE)
            allWater = false;
        if (!allEntire && !allWater)
            return constants_1.STATE_PARTIAL;
    }
    if (allWater)
        return exports.FILE_STATE_NONE;
    if (allEntire)
        return constants_1.STATE_ENTIRE;
    return constants_1.STATE_PARTIAL;
}
//# sourceMappingURL=format.js.map