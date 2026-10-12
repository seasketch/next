"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BLOCK_RECORDS = void 0;
exports.openLandOccupancy = openLandOccupancy;
exports.openLandOccupancyBytes = openLandOccupancyBytes;
exports.coalesceBlocks = coalesceBlocks;
const h3_js_1 = require("h3-js");
const constants_1 = require("./constants");
const format_1 = require("./format");
/**
 * About 80% of mixed resolution-4 cells that share an edge are at most this
 * many records apart in the global land archive. A block of this many records
 * is the default fetch and cache unit.
 */
exports.DEFAULT_BLOCK_RECORDS = 16;
const DEFAULT_CACHE_BYTES = 32 * 1024 * 1024;
const DEFAULT_CONCURRENCY = 6;
const tables = (0, format_1.buildRankTables)();
async function openLandOccupancy(url, options = {}) {
    const read = options.read ?? httpReader(url, options.signal);
    const header = await read(0, format_1.HEADER_BYTES);
    if (header.byteLength < format_1.HEADER_BYTES) {
        throw new Error("archive is shorter than its header");
    }
    const recordsStart = new DataView(header.buffer, header.byteOffset, header.byteLength).getUint32(24, true);
    if (recordsStart < format_1.HEADER_BYTES) {
        throw new Error("archive record offset is inside the header");
    }
    const rest = recordsStart > format_1.HEADER_BYTES ? await read(format_1.HEADER_BYTES, recordsStart) : new Uint8Array();
    const prefix = new Uint8Array(recordsStart);
    prefix.set(header.subarray(0, format_1.HEADER_BYTES), 0);
    prefix.set(rest.subarray(0, recordsStart - format_1.HEADER_BYTES), format_1.HEADER_BYTES);
    const opened = openCatalog(url, parsePrefix(prefix), read, options);
    opened.stats.requests += rest.byteLength > 0 ? 2 : 1;
    opened.stats.bytes += format_1.HEADER_BYTES + Math.min(rest.byteLength, recordsStart - format_1.HEADER_BYTES);
    return opened;
}
/** Open an archive that is already in memory. */
function openLandOccupancyBytes(bytes, options = {}) {
    const read = options.read ??
        (async (start, end) => {
            if (start < 0 || end < start || end > bytes.byteLength) {
                throw new Error(`range ${start}-${end} is outside the archive`);
            }
            return bytes.subarray(start, end);
        });
    const recordsStart = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(24, true);
    return openCatalog(null, parsePrefix(bytes.subarray(0, recordsStart)), read, options);
}
function openCatalog(source, catalog, read, options) {
    const blockRecords = options.blockRecords ?? exports.DEFAULT_BLOCK_RECORDS;
    if (!Number.isInteger(blockRecords) || blockRecords < 1) {
        throw new Error("blockRecords must be a positive integer");
    }
    const coalesceGap = options.coalesceGap ?? blockRecords;
    const cache = new BlockCache(options.cacheBytes ?? DEFAULT_CACHE_BYTES, catalog.stride);
    const flights = new Map();
    const gate = new Gate(options.concurrency ?? DEFAULT_CONCURRENCY);
    const stats = { requests: 0, bytes: 0, records: 0, hits: 0 };
    const pinCount = new Map();
    const pinned = {
        has(index) {
            return pinCount.has(index);
        },
    };
    function pin(blocks) {
        for (const block of blocks)
            pinCount.set(block, (pinCount.get(block) ?? 0) + 1);
    }
    function unpin(blocks) {
        for (const block of blocks) {
            const next = (pinCount.get(block) ?? 0) - 1;
            if (next <= 0)
                pinCount.delete(block);
            else
                pinCount.set(block, next);
        }
    }
    const publish = () => {
        stats.records = cache.records;
    };
    async function loadBlocks(indexes) {
        const missing = [];
        const mine = new Map();
        for (const index of indexes) {
            if (cache.get(index)) {
                stats.hits++;
                continue;
            }
            if (!flights.has(index))
                missing.push(index);
        }
        const waiting = [];
        for (const index of indexes) {
            const flight = flights.get(index);
            if (flight)
                waiting.push(flight);
        }
        for (const span of coalesceBlocks(missing, blockRecords, coalesceGap)) {
            const run = gate.run(async () => {
                const first = span[0];
                const last = span[span.length - 1];
                const startRecord = first * blockRecords;
                const endRecord = Math.min(catalog.mixedCount, (last + 1) * blockRecords);
                const start = catalog.recordsStart + startRecord * catalog.stride;
                const end = catalog.recordsStart + endRecord * catalog.stride;
                const bytes = await read(start, end);
                if (bytes.byteLength < end - start) {
                    throw new Error(`record bytes ${start}-${end} returned ${bytes.byteLength} bytes`);
                }
                stats.requests++;
                stats.bytes += end - start;
                for (const index of span) {
                    const rec0 = index * blockRecords;
                    const rec1 = Math.min(catalog.mixedCount, (index + 1) * blockRecords);
                    cache.set(index, bytes.slice((rec0 - startRecord) * catalog.stride, (rec1 - startRecord) * catalog.stride), pinned);
                }
                publish();
            });
            for (const index of span) {
                flights.set(index, run);
                mine.set(index, run);
            }
            waiting.push(run);
        }
        try {
            await Promise.all(waiting);
        }
        finally {
            for (const [index, run] of mine) {
                if (flights.get(index) === run)
                    flights.delete(index);
            }
        }
    }
    async function withCells(cells, body) {
        const blocks = parentsOf(cells);
        pin(blocks);
        try {
            if (blocks.length > 0)
                await loadBlocks(blocks);
            return body();
        }
        finally {
            unpin(blocks);
            cache.evict(pinned);
            publish();
        }
    }
    function recordNumber(parent) {
        const rank = (0, format_1.cellRank)(parent, format_1.COARSE_RESOLUTION, tables);
        const index = catalog.recordIndex[rank];
        return index == null || index < 0 ? null : index;
    }
    function parentsOf(cells) {
        const needed = new Set();
        for (const cell of cells) {
            const parent = coarseParent(cell, catalog.fineResolution);
            if (planeState(catalog, parent) !== constants_1.STATE_PARTIAL)
                continue;
            const record = recordNumber(parent);
            if (record == null) {
                throw new Error(`partial cell ${parent} has no record`);
            }
            needed.add(Math.floor(record / blockRecords));
        }
        return [...needed];
    }
    function answer(cell) {
        return named(numericState(catalog, cell, (record) => {
            const block = Math.floor(record / blockRecords);
            const data = cache.get(block);
            if (!data)
                throw new Error(`record ${record} is not loaded`);
            const local = record - block * blockRecords;
            return data.subarray(local * catalog.stride, (local + 1) * catalog.stride);
        }));
    }
    const occupancy = {
        source,
        coarseResolution: format_1.COARSE_RESOLUTION,
        fineResolution: catalog.fineResolution,
        stride: catalog.stride,
        slots: catalog.slots,
        blockRecords,
        stats,
        async state(cell) {
            return withCells([cell], () => answer(cell));
        },
        async states(input) {
            const cells = [...input];
            return withCells(cells, () => {
                const out = new Map();
                for (const cell of cells)
                    out.set(cell, answer(cell));
                return out;
            });
        },
        async split(cell) {
            const children = (0, h3_js_1.cellToChildren)(cell, (0, h3_js_1.getResolution)(cell) + 1);
            const states = await occupancy.states(children);
            return children.map((child) => ({ cell: child, state: states.get(child) }));
        },
        async prefetch(input) {
            await withCells([...input], () => undefined);
        },
        clearCache() {
            cache.clear();
            publish();
        },
    };
    return occupancy;
}
/**
 * Groups of block indexes to fetch together. `indexes` need not be sorted.
 * A run continues while the records between two blocks are within `gap`.
 */
function coalesceBlocks(indexes, blockRecords, gap) {
    const ordered = [...new Set(indexes)].sort((a, b) => a - b);
    const runs = [];
    for (const index of ordered) {
        const run = runs[runs.length - 1];
        const previous = run?.[run.length - 1];
        if (previous == null) {
            runs.push([index]);
            continue;
        }
        const hole = (index - previous - 1) * blockRecords;
        if (hole <= gap)
            run.push(index);
        else
            runs.push([index]);
    }
    return runs;
}
function coarseParent(cell, fineResolution) {
    const resolution = (0, h3_js_1.getResolution)(cell);
    if (resolution > fineResolution) {
        throw new Error(`cell ${cell} is finer than this archive`);
    }
    return resolution <= format_1.COARSE_RESOLUTION
        ? cell
        : (0, h3_js_1.cellToParent)(cell, format_1.COARSE_RESOLUTION);
}
function numericState(catalog, cell, recordAt) {
    const resolution = (0, h3_js_1.getResolution)(cell);
    if (resolution <= format_1.COARSE_RESOLUTION) {
        return (0, format_1.getPackedState)(catalog.planes[resolution], (0, format_1.cellRank)(cell, resolution, tables));
    }
    if (resolution > catalog.fineResolution) {
        throw new Error(`cell ${cell} is finer than this archive`);
    }
    const parent = (0, h3_js_1.cellToParent)(cell, format_1.COARSE_RESOLUTION);
    const parentState = (0, format_1.getPackedState)(catalog.planes[format_1.COARSE_RESOLUTION], (0, format_1.cellRank)(parent, format_1.COARSE_RESOLUTION, tables));
    if (parentState !== constants_1.STATE_PARTIAL)
        return parentState;
    const record = catalog.recordIndex[(0, format_1.cellRank)(parent, format_1.COARSE_RESOLUTION, tables)];
    if (record == null || record < 0) {
        throw new Error(`partial cell ${parent} has no record`);
    }
    const packed = recordAt(record);
    if (resolution === catalog.fineResolution) {
        return (0, format_1.getPackedState)(packed, (0, h3_js_1.cellToChildPos)(cell, format_1.COARSE_RESOLUTION));
    }
    // Hex children occupy one contiguous run of fine slots inside the
    // resolution-4 record. A pentagon (or a cell under one) does not, so those
    // few cells still list their descendants.
    if (!pentagonLine(cell)) {
        const count = 7 ** (catalog.fineResolution - resolution);
        const start = (0, h3_js_1.cellToChildPos)(cell, format_1.COARSE_RESOLUTION) * count;
        return summarizePacked(packed, start, count);
    }
    let allEntire = true;
    let allWater = true;
    for (const child of (0, h3_js_1.cellToChildren)(cell, catalog.fineResolution)) {
        const state = (0, format_1.getPackedState)(packed, (0, h3_js_1.cellToChildPos)(child, format_1.COARSE_RESOLUTION));
        if (state !== constants_1.STATE_ENTIRE)
            allEntire = false;
        if (state !== format_1.FILE_STATE_NONE)
            allWater = false;
        if (!allEntire && !allWater)
            return constants_1.STATE_PARTIAL;
    }
    if (allWater)
        return format_1.FILE_STATE_NONE;
    if (allEntire)
        return constants_1.STATE_ENTIRE;
    return constants_1.STATE_PARTIAL;
}
function summarizePacked(packed, start, count) {
    let allEntire = true;
    let allWater = true;
    for (let index = start; index < start + count; index++) {
        const state = (0, format_1.getPackedState)(packed, index);
        if (state !== constants_1.STATE_ENTIRE)
            allEntire = false;
        if (state !== format_1.FILE_STATE_NONE)
            allWater = false;
        if (!allEntire && !allWater)
            return constants_1.STATE_PARTIAL;
    }
    if (allWater)
        return format_1.FILE_STATE_NONE;
    if (allEntire)
        return constants_1.STATE_ENTIRE;
    return constants_1.STATE_PARTIAL;
}
const pentagonAncestor = new Map();
function pentagonLine(cell) {
    const known = pentagonAncestor.get(cell);
    if (known !== undefined)
        return known;
    const chain = [];
    let current = cell;
    let found = false;
    while ((0, h3_js_1.getResolution)(current) >= format_1.COARSE_RESOLUTION) {
        chain.push(current);
        if ((0, h3_js_1.isPentagon)(current)) {
            found = true;
            break;
        }
        if ((0, h3_js_1.getResolution)(current) === format_1.COARSE_RESOLUTION)
            break;
        current = (0, h3_js_1.cellToParent)(current, (0, h3_js_1.getResolution)(current) - 1);
    }
    for (const item of chain)
        pentagonAncestor.set(item, found);
    return found;
}
function named(state) {
    if (state === format_1.FILE_STATE_NONE)
        return "water";
    if (state === constants_1.STATE_PARTIAL)
        return "mixed";
    if (state === constants_1.STATE_ENTIRE)
        return "land";
    throw new Error(`unexpected cell state ${state}`);
}
function planeState(catalog, cell) {
    const resolution = (0, h3_js_1.getResolution)(cell);
    return (0, format_1.getPackedState)(catalog.planes[resolution], (0, format_1.cellRank)(cell, resolution, tables));
}
function parsePrefix(bytes) {
    if (bytes.byteLength < format_1.HEADER_BYTES) {
        throw new Error("archive is shorter than its header");
    }
    const magic = new TextDecoder().decode(bytes.subarray(0, 4));
    if (magic !== format_1.ARCHIVE_MAGIC)
        throw new Error(`unexpected archive magic ${magic}`);
    if (bytes[4] !== format_1.ARCHIVE_VERSION) {
        throw new Error(`unsupported archive version ${bytes[4]}`);
    }
    const fineResolution = bytes[5];
    if (bytes[6] !== format_1.COARSE_RESOLUTION || fineResolution <= format_1.COARSE_RESOLUTION) {
        throw new Error("archive resolution does not match this reader");
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const slots = view.getUint32(12, true);
    const stride = view.getUint32(16, true);
    const mixedCount = view.getUint32(20, true);
    const recordsStart = view.getUint32(24, true);
    if (slots !== (0, format_1.recordSlots)(fineResolution) || stride !== (0, format_1.recordStride)(fineResolution)) {
        throw new Error("archive record layout does not match this reader");
    }
    const planes = [];
    let cursor = format_1.HEADER_BYTES;
    for (let res = 0; res <= format_1.COARSE_RESOLUTION; res++) {
        if (cursor + 4 > bytes.byteLength)
            throw new Error("archive planes are truncated");
        const count = view.getUint32(cursor, true);
        if (count !== (0, h3_js_1.getNumCells)(res)) {
            throw new Error(`plane ${res} has ${count} cells, H3 has ${(0, h3_js_1.getNumCells)(res)}`);
        }
        const size = (0, format_1.packedBytes)(count);
        planes.push(bytes.slice(cursor + 4, cursor + 4 + size));
        cursor += 4 + size;
    }
    if (cursor !== recordsStart) {
        throw new Error("record offset does not follow the coarse planes");
    }
    const recordIndex = new Int32Array((0, h3_js_1.getNumCells)(format_1.COARSE_RESOLUTION));
    recordIndex.fill(-1);
    let next = 0;
    const coarse = planes[format_1.COARSE_RESOLUTION];
    const count = (0, h3_js_1.getNumCells)(format_1.COARSE_RESOLUTION);
    for (let rank = 0; rank < count; rank++) {
        if ((0, format_1.getPackedState)(coarse, rank) === constants_1.STATE_PARTIAL)
            recordIndex[rank] = next++;
    }
    if (next !== mixedCount) {
        throw new Error(`header lists ${mixedCount} records, the coarse plane has ${next}`);
    }
    return { fineResolution, stride, slots, mixedCount, recordsStart, planes, recordIndex };
}
function httpReader(url, signal) {
    return async (start, end) => {
        const response = await fetch(url, {
            headers: { Range: `bytes=${start}-${end - 1}` },
            signal,
        });
        if (!response.ok && response.status !== 206) {
            throw new Error(`range ${start}-${end - 1} returned ${response.status}`);
        }
        const body = new Uint8Array(await response.arrayBuffer());
        if (response.status === 206 || body.byteLength === end - start)
            return body;
        if (response.status === 200 && body.byteLength >= end)
            return body.slice(start, end);
        throw new Error(`range ${start}-${end - 1} returned ${response.status} (${body.byteLength} bytes)`);
    };
}
class BlockCache {
    limit;
    stride;
    blocks = new Map();
    retained = 0;
    records = 0;
    constructor(limit, stride) {
        this.limit = limit;
        this.stride = stride;
    }
    has(index) {
        return this.blocks.has(index);
    }
    get(index) {
        const hit = this.blocks.get(index);
        if (!hit)
            return undefined;
        this.blocks.delete(index);
        this.blocks.set(index, hit);
        return hit;
    }
    set(index, data, pinned) {
        this.forget(index);
        this.blocks.set(index, data);
        this.retained += data.byteLength;
        this.records += data.byteLength / this.stride;
        this.evict(pinned);
    }
    evict(pinned) {
        for (const [index] of this.blocks) {
            if (this.retained <= this.limit)
                return;
            if (pinned.has(index))
                continue;
            this.forget(index);
        }
    }
    clear() {
        this.blocks.clear();
        this.retained = 0;
        this.records = 0;
    }
    forget(index) {
        const previous = this.blocks.get(index);
        if (!previous)
            return;
        this.blocks.delete(index);
        this.retained -= previous.byteLength;
        this.records -= previous.byteLength / this.stride;
    }
}
class Gate {
    limit;
    active = 0;
    waiting = [];
    constructor(limit) {
        this.limit = limit;
    }
    async run(task) {
        if (this.active >= this.limit) {
            await new Promise((resolve) => this.waiting.push(resolve));
        }
        this.active++;
        try {
            return await task();
        }
        finally {
            this.active--;
            const next = this.waiting.shift();
            if (next)
                next();
        }
    }
}
//# sourceMappingURL=client.js.map