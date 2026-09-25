import { execFileSync } from "node:child_process";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import { AsyncBuffer, FileMetaData, parquetMetadataAsync } from "hyparquet";
import { parseQueryParams } from "../../src/dataTables/params";
import { planQuery } from "../../src/dataTables/engine/plan";
import { executeQuery } from "../../src/dataTables/engine/execute";

/**
 * Derived subsets. Expected numbers are computed here by DuckDB, not by the
 * query engine. `duckdb` must be on PATH.
 *
 * birds-mosb-wegu.parquet — Birds_v2.parquet
 *   site_code = 'MoSB' AND species_code = 'WeGu' (one count per survey day)
 * bruv-dume-2019.parquet — Fish (BRUVs)_v3.parquet
 *   site_code = 'Dume' AND year = 2019 (one max_n per bruv × species)
 * bruv-maxn-frames.parquet — the four estuary frames from the monitoring notes
 * ccfrp-pc10-2018.parquet — CCFRP-Fishing Effort_v2.parquet
 *   Grid_Cell_ID = 'PC10' AND Year = 2018 (most date × species keys are doubled)
 * fish-gull-e-2024-two-species.parquet — kelp fish table
 *   SCI_GULL_ISLE_E, 2024, classcode IN ('SPUL', 'ELAT')
 * upc-cover.parquet — already extracted UPC cover rows for SCI_GULL_ISLE_E 2024
 */

const FIXTURES = path.resolve("test/dataTables/fixtures");

function pq(name: string): string {
  return path.join(FIXTURES, name).replaceAll("'", "''");
}

/** One numeric cell from a DuckDB query. The SQL is the oracle. */
function duckdbNumber(sql: string): number {
  const out = execFileSync("duckdb", ["-csv", "-c", sql], { encoding: "utf8" });
  const line = out
    .trim()
    .split("\n")
    .map((row) => row.trim())
    .filter((row) => row.length > 0)
    .pop();
  const value = Number(line);
  if (!Number.isFinite(value)) {
    throw new Error(`DuckDB did not return a number:\n${out}`);
  }
  return value;
}

function asyncBufferFromFile(filePath: string): AsyncBuffer {
  const data = fs.readFileSync(filePath);
  const buffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  );
  return {
    byteLength: buffer.byteLength,
    slice: (start: number, end?: number) => buffer.slice(start, end),
  };
}

async function run(file: AsyncBuffer, metadata: FileMetaData, qs: string) {
  const query = parseQueryParams(new URLSearchParams(qs));
  const plan = await planQuery(metadata, query, file);
  return executeQuery({ file, metadata, query, plan });
}

async function load(name: string) {
  const file = asyncBufferFromFile(path.join(FIXTURES, name));
  const metadata = await parquetMetadataAsync(file);
  return { file, metadata };
}

let birds: { file: AsyncBuffer; metadata: FileMetaData };
let bruv: { file: AsyncBuffer; metadata: FileMetaData };
let maxn: { file: AsyncBuffer; metadata: FileMetaData };
let ccfrp: { file: AsyncBuffer; metadata: FileMetaData };
let fish: { file: AsyncBuffer; metadata: FileMetaData };
let upc: { file: AsyncBuffer; metadata: FileMetaData };

beforeAll(async () => {
  birds = await load("birds-mosb-wegu.parquet");
  bruv = await load("bruv-dume-2019.parquet");
  maxn = await load("bruv-maxn-frames.parquet");
  ccfrp = await load("ccfrp-pc10-2018.parquet");
  fish = await load("fish-gull-e-2024-two-species.parquet");
  upc = await load("upc-cover.parquet");
});

describe("birds, simple mode", () => {
  it("averages one count per survey day, matching DuckDB", async () => {
    const expectedMean = duckdbNumber(
      `SELECT avg(count) FROM read_parquet('${pq("birds-mosb-wegu.parquet")}')`
    );
    const expectedCount = duckdbNumber(
      `SELECT count(count) FROM read_parquet('${pq("birds-mosb-wegu.parquet")}')`
    );
    const result = await run(
      birds.file,
      birds.metadata,
      "op=mean,count&column=count&groupBy=site_code&q.species_code=WeGu"
    );
    expect(result.groups).toHaveLength(1);
    expect(result.groups![0].count).toBe(expectedCount);
    expect(result.groups![0].mean).toBeCloseTo(expectedMean, 6);
  });
});

describe("beach BRUV, simple mode", () => {
  it("averages one max_n per camera, matching DuckDB", async () => {
    const expectedMean = duckdbNumber(
      `SELECT avg(max_n) FROM read_parquet('${pq("bruv-dume-2019.parquet")}') WHERE species_code = 'PCLA'`
    );
    const expectedCount = duckdbNumber(
      `SELECT count(max_n) FROM read_parquet('${pq("bruv-dume-2019.parquet")}') WHERE species_code = 'PCLA'`
    );
    const result = await run(
      bruv.file,
      bruv.metadata,
      "op=mean,count&column=max_n&groupBy=site_code&q.species_code=PCLA"
    );
    expect(result.groups![0].count).toBe(expectedCount);
    expect(result.groups![0].mean).toBeCloseTo(expectedMean, 6);
  });
});

describe("estuary BRUV frames, max then mean", () => {
  it("takes the max inside each camera, then the mean of those maxima", async () => {
    const expected = duckdbNumber(`
      SELECT avg(peak) FROM (
        SELECT camerareplicate, max(maxns) AS peak
        FROM read_parquet('${pq("bruv-maxn-frames.parquet")}')
        WHERE scientificname = 'Atherinops affinis'
        GROUP BY camerareplicate
      )
    `);
    const result = await run(
      maxn.file,
      maxn.metadata,
      "op=mean,count&column=maxns&groupBy=siteid&replicateBy=camerareplicate&within=max&q.scientificname=Atherinops affinis"
    );
    expect(result.groups![0].count).toBe(2);
    expect(result.groups![0].mean).toBeCloseTo(expected, 6);
    expect(result.groups![0].mean).toBeCloseTo(3.5, 6);
  });
});

describe("CCFRP catch rate", () => {
  const file = "ccfrp-pc10-2018.parquet";

  it("keeps a row mean of CPUE, matching DuckDB", async () => {
    const expected = duckdbNumber(
      `SELECT avg(CPUE_catch_per_angler_hour) FROM read_parquet('${pq(file)}')`
    );
    const result = await run(
      ccfrp.file,
      ccfrp.metadata,
      "op=mean&column=CPUE_catch_per_angler_hour&groupBy=Grid_Cell_ID"
    );
    expect(result.groups![0].mean).toBeCloseTo(expected, 6);
  });

  it("does not sum CPUE inside a date and species", async () => {
    const rowMean = duckdbNumber(
      `SELECT avg(CPUE_catch_per_angler_hour) FROM read_parquet('${pq(file)}')`
    );
    const summed = duckdbNumber(`
      SELECT avg(total) FROM (
        SELECT Date, Common_Name, sum(CPUE_catch_per_angler_hour) AS total
        FROM read_parquet('${pq(file)}')
        GROUP BY Date, Common_Name
      )
    `);
    const result = await run(
      ccfrp.file,
      ccfrp.metadata,
      "op=mean&column=CPUE_catch_per_angler_hour&groupBy=Grid_Cell_ID&replicateBy=Date,Common_Name&within=sum"
    );
    expect(result.groups![0].mean).toBeCloseTo(summed, 5);
    expect(result.groups![0].mean).not.toBeCloseTo(rowMean, 2);
  });
});

describe("kelp fish, two species in one transect", () => {
  const file = "fish-gull-e-2024-two-species.parquet";
  const base =
    "op=mean,sum,count&column=count&groupBy=site&q.site=SCI_GULL_ISLE_E&q.survey_year=2024";

  it("sums both taxa inside the transect when classcode is not filtered", async () => {
    const expectedMean = duckdbNumber(`
      SELECT avg(total) FROM (
        SELECT zone, transect, sum(count) AS total
        FROM read_parquet('${pq(file)}')
        GROUP BY zone, transect
      )
    `);
    const expectedCount = duckdbNumber(`
      SELECT count(*) FROM (
        SELECT zone, transect FROM read_parquet('${pq(file)}') GROUP BY zone, transect
      )
    `);
    const result = await run(
      fish.file,
      fish.metadata,
      `${base}&replicateBy=zone,transect&within=sum`
    );
    expect(result.groups![0].count).toBe(expectedCount);
    expect(result.groups![0].mean).toBeCloseTo(expectedMean, 6);
  });

  it("changes the mean when diver level is its own replicate", async () => {
    const withoutLevel = duckdbNumber(`
      SELECT avg(total) FROM (
        SELECT zone, transect, sum(count) AS total
        FROM read_parquet('${pq(file)}') WHERE classcode = 'SPUL'
        GROUP BY zone, transect
      )
    `);
    const withLevel = duckdbNumber(`
      SELECT avg(total) FROM (
        SELECT zone, transect, level, sum(count) AS total
        FROM read_parquet('${pq(file)}') WHERE classcode = 'SPUL'
        GROUP BY zone, transect, level
      )
    `);
    const result = await run(
      fish.file,
      fish.metadata,
      `${base}&q.classcode=SPUL&replicateBy=zone,transect,level&within=sum`
    );
    expect(withLevel).not.toBeCloseTo(withoutLevel, 2);
    expect(result.groups![0].mean).toBeCloseTo(withLevel, 6);
  });

  it("averages per-transect mean lengths", async () => {
    const expected = duckdbNumber(`
      SELECT avg(len) FROM (
        SELECT zone, transect, avg(fish_tl) AS len
        FROM read_parquet('${pq(file)}')
        WHERE classcode = 'SPUL' AND fish_tl IS NOT NULL
        GROUP BY zone, transect
      )
    `);
    const result = await run(
      fish.file,
      fish.metadata,
      "op=mean&column=fish_tl&groupBy=site&replicateBy=zone,transect&within=mean&q.classcode=SPUL&q.site=SCI_GULL_ISLE_E&q.survey_year=2024"
    );
    expect(result.groups![0].mean).toBeCloseTo(expected, 5);
  });
});

describe("UPC cover, several species", () => {
  it("averages the selected covers inside each transect, then across transects", async () => {
    const expected = duckdbNumber(`
      SELECT avg(cover) FROM (
        SELECT zone, transect, avg(pct_cov) AS cover
        FROM read_parquet('${pq("upc-cover.parquet")}')
        WHERE classcode IN ('CRUCOR', 'ERECOR')
        GROUP BY zone, transect
      )
    `);
    const result = await run(
      upc.file,
      upc.metadata,
      "op=mean&column=pct_cov&groupBy=site&replicateBy=zone,transect&within=mean&q.classcode=in.(CRUCOR,ERECOR)"
    );
    expect(result.groups![0].mean).toBeCloseTo(expected, 6);
  });
});
