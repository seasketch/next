#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const generate_1 = require("./generate");
const constants_1 = require("./constants");
const db_1 = require("./db");
const pack_1 = require("./pack");
const HELP = `Build a raw H3 land-occupancy database from OSM land polygons.

Cells with no row are water (none). state 1 is partial, state 2 is entire.
A cell that spans a subdivision boundary is entire once the pieces cover it.
The hierarchy is not collapsed: every non-water cell at the chosen resolution
is its own row.

Usage:
  h3-land generate --input <land.fgb | https://...> --output <land.sqlite>
  h3-land stats --output <land.sqlite>
  h3-land pack --input <land.sqlite> --output <land.h3ld>

Options for generate:
  --resolution <n>     H3 resolution (default ${constants_1.DEFAULT_RESOLUTION})
  --epsilon <fraction> Promote a boundary cell to entire at this coverage
                       (default ${constants_1.DEFAULT_COVER_EPSILON})
  --bbox w,s,e,n       Only polygons intersecting this box. The file cursor
                       still walks from the start, so resume stays aligned.
  --limit <n>          Stop after classifying n polygons and save the cursor.
  --commit-every <n>   Polygons per SQLite transaction (default 100)
  --restart            Delete the output database and start over
  --redo-refine        Keep the resolution-7 pass, discard the fine cells, and
                       run the refine pass again (two-pass databases only)

Rerun the same generate command to resume after a stop. The run is finished
when stats reports finalized.

A resolution above 7 is built in two passes. The first pass classifies
resolution 7. Cells fully inside one land piece, and whose neighbors are too,
are sealed: every finer cell inside them is land. The second pass measures
finer children for the remaining mixed resolution-7 cells.

pack writes the fixed-stride archive. Resolutions 0-4 are dense 2-bit planes.
Each partial resolution-4 cell then has one record of its finest children,
in rank order, so a reader can form HTTP ranges from the coarse plane alone.
`;
async function main() {
    const [command, ...rest] = process.argv.slice(2);
    if (!command || command === "--help" || command === "-h" || command === "help") {
        console.log(HELP);
        return;
    }
    const args = parseArgs(rest);
    if (command === "stats") {
        const output = required(args, "output");
        const summary = (0, db_1.readLandSummary)(output);
        console.log(`finalized: ${summary.finalized}`);
        console.log(`next feature: ${(0, db_1.formatCount)(summary.nextFeature)}`);
        console.log(`entire: ${(0, db_1.formatCount)(summary.entire)}`);
        console.log(`partial: ${(0, db_1.formatCount)(summary.partial)}`);
        console.log(`open boundary rows: ${(0, db_1.formatCount)(summary.openPartials)}`);
        console.log(`oversize covers: ${(0, db_1.formatCount)(summary.oversize)}`);
        console.log(`failures: ${(0, db_1.formatCount)(summary.failures)}`);
        if (summary.meta.base_resolution != null) {
            console.log(`base resolution: ${summary.meta.base_resolution}`);
            console.log(`phase: ${summary.meta.phase ?? "coarse"}`);
            console.log(`mixed base cells: ${(0, db_1.formatCount)(Number(summary.meta.mixed_count ?? 0))}`);
            console.log(`fine entire: ${(0, db_1.formatCount)(Number(summary.meta.fine_entire ?? 0))}`);
            console.log(`fine partial: ${(0, db_1.formatCount)(Number(summary.meta.fine_partial ?? 0))}`);
        }
        for (const key of [
            "input",
            "resolution",
            "epsilon",
            "bbox",
            "features_count",
            "generator_version",
            "absent_state",
        ]) {
            if (summary.meta[key] != null)
                console.log(`${key}: ${summary.meta[key]}`);
        }
        return;
    }
    if (command === "pack") {
        const stats = (0, pack_1.packDatabase)(required(args, "input"), required(args, "output"));
        console.log(`bytes: ${(0, db_1.formatCount)(stats.bytes)}`);
        console.log(`cells: ${(0, db_1.formatCount)(stats.cells)}`);
        console.log(`entire cells: ${(0, db_1.formatCount)(stats.entireCells)}`);
        console.log(`partial cells: ${(0, db_1.formatCount)(stats.partialCells)}`);
        console.log(`entire coarse parents: ${(0, db_1.formatCount)(stats.entireParents)}`);
        console.log(`mixed coarse parents: ${(0, db_1.formatCount)(stats.mixedParents)}`);
        console.log(`water coarse parents: ${(0, db_1.formatCount)(stats.waterParents)}`);
        return;
    }
    if (command !== "generate") {
        throw new Error(`unknown command ${command}\n\n${HELP}`);
    }
    const bbox = parseBBox(args.get("bbox"));
    await (0, generate_1.generateLandOccupancy)({
        input: required(args, "input"),
        output: required(args, "output"),
        resolution: parseInteger(args.get("resolution"), constants_1.DEFAULT_RESOLUTION, "resolution"),
        epsilon: parseNumber(args.get("epsilon"), constants_1.DEFAULT_COVER_EPSILON, "epsilon"),
        bbox,
        commitEvery: parseInteger(args.get("commit-every"), 100, "commit-every"),
        limit: args.has("limit")
            ? parseInteger(args.get("limit"), 0, "limit")
            : null,
        restart: args.has("restart"),
        redoRefine: args.has("redo-refine"),
    });
}
function parseArgs(argv) {
    const args = new Map();
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (!token.startsWith("--"))
            throw new Error(`unexpected argument ${token}`);
        const key = token.slice(2);
        const next = argv[i + 1];
        if (next == null || next.startsWith("--"))
            args.set(key, true);
        else {
            args.set(key, next);
            i++;
        }
    }
    return args;
}
function required(args, name) {
    const value = args.get(name);
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`--${name} is required\n\n${HELP}`);
    }
    return value;
}
function parseInteger(value, fallback, name) {
    if (value == null || value === true)
        return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`--${name} must be a non-negative integer`);
    }
    return parsed;
}
function parseNumber(value, fallback, name) {
    if (value == null || value === true)
        return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 1) {
        throw new Error(`--${name} must be a fraction in [0, 1)`);
    }
    return parsed;
}
function parseBBox(value) {
    if (value == null)
        return null;
    if (value === true)
        throw new Error("--bbox needs w,s,e,n");
    const parts = value.split(",").map((part) => Number(part.trim()));
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
        throw new Error("--bbox must be west,south,east,north");
    }
    const [west, south, east, north] = parts;
    if (south > north)
        throw new Error("--bbox south is north of north");
    return [west, south, east, north];
}
main().catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error(message);
    try {
        (0, node_fs_1.writeFileSync)("/tmp/h3-land-error.txt", message);
    }
    catch {
        // The database cursor is already committed; the log is only a convenience.
    }
    process.exit(1);
});
//# sourceMappingURL=cli.js.map