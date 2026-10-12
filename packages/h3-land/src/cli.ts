#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { generateLandOccupancy } from "./generate";
import { DEFAULT_COVER_EPSILON, DEFAULT_RESOLUTION } from "./constants";
import { formatCount, readLandSummary } from "./db";
import { packDatabase } from "./pack";

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
  --resolution <n>     H3 resolution (default ${DEFAULT_RESOLUTION})
  --epsilon <fraction> Promote a boundary cell to entire at this coverage
                       (default ${DEFAULT_COVER_EPSILON})
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

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h" || command === "help") {
    console.log(HELP);
    return;
  }
  const args = parseArgs(rest);
  if (command === "stats") {
    const output = required(args, "output");
    const summary = readLandSummary(output);
    console.log(`finalized: ${summary.finalized}`);
    console.log(`next feature: ${formatCount(summary.nextFeature)}`);
    console.log(`entire: ${formatCount(summary.entire)}`);
    console.log(`partial: ${formatCount(summary.partial)}`);
    console.log(`open boundary rows: ${formatCount(summary.openPartials)}`);
    console.log(`oversize covers: ${formatCount(summary.oversize)}`);
    console.log(`failures: ${formatCount(summary.failures)}`);
    if (summary.meta.base_resolution != null) {
      console.log(`base resolution: ${summary.meta.base_resolution}`);
      console.log(`phase: ${summary.meta.phase ?? "coarse"}`);
      console.log(`mixed base cells: ${formatCount(Number(summary.meta.mixed_count ?? 0))}`);
      console.log(`fine entire: ${formatCount(Number(summary.meta.fine_entire ?? 0))}`);
      console.log(`fine partial: ${formatCount(Number(summary.meta.fine_partial ?? 0))}`);
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
      if (summary.meta[key] != null) console.log(`${key}: ${summary.meta[key]}`);
    }
    return;
  }
  if (command === "pack") {
    const stats = packDatabase(required(args, "input"), required(args, "output"));
    console.log(`bytes: ${formatCount(stats.bytes)}`);
    console.log(`cells: ${formatCount(stats.cells)}`);
    console.log(`entire cells: ${formatCount(stats.entireCells)}`);
    console.log(`partial cells: ${formatCount(stats.partialCells)}`);
    console.log(`entire coarse parents: ${formatCount(stats.entireParents)}`);
    console.log(`mixed coarse parents: ${formatCount(stats.mixedParents)}`);
    console.log(`water coarse parents: ${formatCount(stats.waterParents)}`);
    return;
  }
  if (command !== "generate") {
    throw new Error(`unknown command ${command}\n\n${HELP}`);
  }
  const bbox = parseBBox(args.get("bbox"));
  await generateLandOccupancy({
    input: required(args, "input"),
    output: required(args, "output"),
    resolution: parseInteger(args.get("resolution"), DEFAULT_RESOLUTION, "resolution"),
    epsilon: parseNumber(args.get("epsilon"), DEFAULT_COVER_EPSILON, "epsilon"),
    bbox,
    commitEvery: parseInteger(args.get("commit-every"), 100, "commit-every"),
    limit: args.has("limit")
      ? parseInteger(args.get("limit"), 0, "limit")
      : null,
    restart: args.has("restart"),
    redoRefine: args.has("redo-refine"),
  });
}

function parseArgs(argv: string[]): Map<string, string | true> {
  const args = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (!token.startsWith("--")) throw new Error(`unexpected argument ${token}`);
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith("--")) args.set(key, true);
    else {
      args.set(key, next);
      i++;
    }
  }
  return args;
}

function required(args: Map<string, string | true>, name: string): string {
  const value = args.get(name);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`--${name} is required\n\n${HELP}`);
  }
  return value;
}

function parseInteger(
  value: string | true | undefined,
  fallback: number,
  name: string
): number {
  if (value == null || value === true) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative integer`);
  }
  return parsed;
}

function parseNumber(
  value: string | true | undefined,
  fallback: number,
  name: string
): number {
  if (value == null || value === true) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 1) {
    throw new Error(`--${name} must be a fraction in [0, 1)`);
  }
  return parsed;
}

function parseBBox(
  value: string | true | undefined
): [number, number, number, number] | null {
  if (value == null) return null;
  if (value === true) throw new Error("--bbox needs w,s,e,n");
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error("--bbox must be west,south,east,north");
  }
  const [west, south, east, north] = parts as [number, number, number, number];
  if (south > north) throw new Error("--bbox south is north of north");
  return [west, south, east, north];
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  try {
    writeFileSync("/tmp/h3-land-error.txt", message);
  } catch {
    // The database cursor is already committed; the log is only a convenience.
  }
  process.exit(1);
});
