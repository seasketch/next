"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.packDatabase = packDatabase;
const node_module_1 = require("node:module");
const node_fs_1 = require("node:fs");
const constants_1 = require("./constants");
const format_1 = require("./format");
const { DatabaseSync: SqliteDatabase } = (0, node_module_1.createRequire)(__filename)("node:" + "sqlite");
/**
 * Pack a finalized raw occupancy database into the fixed-stride archive.
 * Cells are read as two 32-bit halves because Node 22.16 cannot return an
 * H3 index as a JavaScript number. Uniform land parents are counted on the
 * first pass and omitted from the second, so a resolution-9 table does not
 * have to keep every interior cell in memory.
 */
function packDatabase(input, output) {
    const db = new SqliteDatabase(input, {
        readOnly: true,
        timeout: 10_000,
    });
    try {
        if (readMeta(db, "base_resolution") != null)
            return packHierarchical(db, output);
        const resolution = readResolution(db);
        const counts = new Map();
        let rows = 0;
        const started = Date.now();
        console.error(`counting resolution-${resolution} cells...`);
        for (const record of iterateCells(db)) {
            const count = counts.get(record.parent) ?? { entire: 0, partial: 0 };
            if (record.state === constants_1.STATE_ENTIRE)
                count.entire++;
            else if (record.state === constants_1.STATE_PARTIAL)
                count.partial++;
            else
                throw new Error(`unexpected cell state ${record.state}`);
            counts.set(record.parent, count);
            rows++;
            if (rows % 20_000_000 === 0)
                logScan("counted", rows, started);
        }
        const tables = (0, format_1.buildRankTables)();
        const accumulator = new format_1.OccupancyAccumulator(resolution);
        const mixed = new Set();
        let expectedEntire = 0;
        let expectedPartial = 0;
        for (const [parent, count] of counts) {
            expectedEntire += count.entire;
            expectedPartial += count.partial;
            const expected = (0, format_1.fineChildCount)(parent, resolution, tables);
            if (count.partial === 0 && count.entire === expected) {
                accumulator.markUniformEntire(parent);
            }
            else {
                if (count.entire + count.partial > expected) {
                    throw new Error("a coarse cell has more fine children than H3 allows");
                }
                mixed.add(parent);
            }
        }
        counts.clear();
        console.error(`${mixed.size.toLocaleString("en-US")} mixed coarse cells, ${accumulator.cells.toLocaleString("en-US")} uniform land cells`);
        rows = 0;
        const fillStarted = Date.now();
        for (const record of iterateCells(db)) {
            if (mixed.has(record.parent))
                accumulator.add(record.h3, record.state);
            rows++;
            if (rows % 20_000_000 === 0)
                logScan("filled", rows, fillStarted);
        }
        console.error("folding coarse planes...");
        const { bytes, stats } = accumulator.finish();
        if (stats.entireCells !== expectedEntire || stats.partialCells !== expectedPartial) {
            throw new Error(`packed ${stats.entireCells} entire and ${stats.partialCells} partial cells, the table has ${expectedEntire} and ${expectedPartial}`);
        }
        (0, node_fs_1.writeFileSync)(output, bytes);
        return stats;
    }
    finally {
        db.close();
    }
}
/**
 * Sealed resolution-7 cells stand for every finer descendant. Only mixed
 * parents have rows in `fine`. Uniform resolution-4 land is still one mark.
 */
function packHierarchical(db, output) {
    const fineResolution = readResolution(db);
    const tables = (0, format_1.buildRankTables)();
    const counts = new Map();
    let rows = 0;
    const started = Date.now();
    console.error("counting resolution-7 cells...");
    for (const record of iterateCells(db)) {
        const count = counts.get(record.parent) ?? { sealed: 0, mixed: 0 };
        if (record.state === constants_1.STATE_ENTIRE)
            count.sealed++;
        else if (record.state === constants_1.STATE_PARTIAL)
            count.mixed++;
        else
            throw new Error(`unexpected cell state ${record.state}`);
        counts.set(record.parent, count);
        rows++;
        if (rows % 2_000_000 === 0)
            logScan("counted", rows, started);
    }
    const accumulator = new format_1.OccupancyAccumulator(fineResolution);
    const mixedParents = new Set();
    for (const [parent, count] of counts) {
        const expected = (0, format_1.fineChildCount)(parent, constants_1.BASE_RESOLUTION, tables);
        if (count.sealed + count.mixed > expected) {
            throw new Error("a coarse cell has more resolution-7 children than H3 allows");
        }
        if (count.mixed === 0 && count.sealed === expected)
            accumulator.markUniformEntire(parent);
        else
            mixedParents.add(parent);
    }
    counts.clear();
    console.error(`${mixedParents.size.toLocaleString("en-US")} mixed resolution-4 cells, ${accumulator.cells.toLocaleString("en-US")} uniform land cells`);
    rows = 0;
    const fillStarted = Date.now();
    for (const record of iterateCells(db)) {
        if (record.state !== constants_1.STATE_ENTIRE)
            continue;
        if (!mixedParents.has(record.parent))
            continue;
        const block = (0, format_1.descendantSlotBlock)(record.h3, fineResolution, tables);
        accumulator.fillSlots(record.parent, block.start, block.count, constants_1.STATE_ENTIRE);
        rows++;
        if (rows % 2_000_000 === 0)
            logScan("filled sealed", rows, fillStarted);
    }
    for (const record of iterateFine(db)) {
        if (!mixedParents.has(record.parent)) {
            throw new Error("a fine cell sits under a resolution-4 cell that is entirely land or water");
        }
        accumulator.add(record.h3, record.state);
    }
    console.error("folding coarse planes...");
    const { bytes, stats } = accumulator.finish();
    (0, node_fs_1.writeFileSync)(output, bytes);
    return stats;
}
function readMeta(db, key) {
    const hasMeta = db
        .prepare("SELECT 1 AS hit FROM sqlite_master WHERE type = 'table' AND name = 'meta'")
        .get();
    if (!hasMeta)
        return null;
    const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key);
    return row?.value ?? null;
}
function readResolution(db) {
    const hasMeta = db
        .prepare("SELECT 1 AS hit FROM sqlite_master WHERE type = 'table' AND name = 'meta'")
        .get();
    if (!hasMeta)
        return format_1.FINE_RESOLUTION;
    const finalized = db
        .prepare("SELECT value FROM meta WHERE key = 'finalized'")
        .get();
    if (finalized && finalized.value !== "1") {
        throw new Error("the occupancy database is not finalized");
    }
    const resolution = db
        .prepare("SELECT value FROM meta WHERE key = 'resolution'")
        .get();
    const parsed = resolution ? Number(resolution.value) : format_1.FINE_RESOLUTION;
    if (!Number.isInteger(parsed) || parsed <= 4 || parsed > 15) {
        throw new Error(`database resolution ${resolution?.value} cannot be packed`);
    }
    return parsed;
}
function* iterateCells(db) {
    const stmt = db.prepare("SELECT (h3 & 4294967295) AS lo, (h3 >> 32) AS hi, state FROM cells");
    for (const row of stmt.iterate()) {
        const record = row;
        const h3 = (BigInt(record.hi) << 32n) | BigInt(record.lo);
        yield { h3, parent: (0, format_1.parentAtCoarse)(h3), state: record.state };
    }
}
function* iterateFine(db) {
    const hasFine = db
        .prepare("SELECT 1 AS hit FROM sqlite_master WHERE type = 'table' AND name = 'fine'")
        .get();
    if (!hasFine)
        return;
    const stmt = db.prepare("SELECT (h3 & 4294967295) AS lo, (h3 >> 32) AS hi, state FROM fine");
    for (const row of stmt.iterate()) {
        const record = row;
        const h3 = (BigInt(record.hi) << 32n) | BigInt(record.lo);
        yield { h3, parent: (0, format_1.parentAtCoarse)(h3), state: record.state };
    }
}
function logScan(label, rows, started) {
    const seconds = (Date.now() - started) / 1000;
    console.error(`${label} ${rows.toLocaleString("en-US")} cells in ${seconds.toFixed(0)}s, rss ${Math.round(process.memoryUsage().rss / 1048576)} MB`);
}
//# sourceMappingURL=pack.js.map