import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import { AsyncBuffer, FileMetaData, parquetMetadataAsync } from "hyparquet";

function asyncBufferFromFile(path: string): AsyncBuffer {
  const data = fs.readFileSync(path);
  const buffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  );
  return {
    byteLength: buffer.byteLength,
    slice: (start: number, end?: number) => buffer.slice(start, end),
  };
}
import { parseQueryParams, QueryError } from "../../src/dataTables/params";
import { planQuery } from "../../src/dataTables/engine/plan";
import { executeQuery } from "../../src/dataTables/engine/execute";

/**
 * Subsets extracted with DuckDB. Do not replace these with the full sources.
 *
 * Fish (351 rows), from mid-depth-rocky-ecosystems-fish.parquet which holds
 * the kelp fish transect table:
 *   SELECT site, survey_year, zone, level, transect, classcode, count,
 *          fish_tl, sex, observer, _when_start, _when_end
 *   WHERE classcode = 'SPUL'
 *     AND site IN ('SCI_GULL_ISLE_E', 'SCI_GULL_ISLE_W')
 *     AND survey_year IN (2023, 2024)
 *
 * UPC (77 rows), from UPC_v3.parquet:
 *   SELECT site, zone, transect, classcode, category, pct_cov, count,
 *          _when_start, _when_end
 *   WHERE site = 'SCI_GULL_ISLE_E' AND survey_year = 2024
 *     AND category = 'COVER'
 *
 * Expected numbers below were computed with DuckDB AVG/SUM over those files,
 * not with this engine.
 */

const FISH = "test/dataTables/fixtures/fish-spul.parquet";
const UPC = "test/dataTables/fixtures/upc-cover.parquet";

let fishFile: AsyncBuffer;
let fishMeta: FileMetaData;
let upcFile: AsyncBuffer;
let upcMeta: FileMetaData;

beforeAll(async () => {
  fishFile = asyncBufferFromFile(FISH);
  fishMeta = await parquetMetadataAsync(fishFile);
  upcFile = asyncBufferFromFile(UPC);
  upcMeta = await parquetMetadataAsync(upcFile);
});

async function run(file: AsyncBuffer, metadata: FileMetaData, qs: string) {
  const query = parseQueryParams(new URLSearchParams(qs));
  const plan = await planQuery(metadata, query, file);
  const result = await executeQuery({ file, metadata, query, plan });
  return result;
}

const GULL_2024 =
  "q.classcode=SPUL&q.site=SCI_GULL_ISLE_E&q.survey_year=2024";

describe("replicate mode", () => {
  it("rejects replicateBy without within", () => {
    expect(() =>
      parseQueryParams(
        new URLSearchParams("op=mean&column=count&replicateBy=zone")
      )
    ).toThrow(QueryError);
  });

  it("rejects an unknown replicate column", async () => {
    await expect(
      run(
        fishFile,
        fishMeta,
        `op=mean&column=count&groupBy=site&replicateBy=nope&within=sum&${GULL_2024}`
      )
    ).rejects.toBeInstanceOf(QueryError);
  });

  it("leaves UPC on the row mean when replicateBy is absent", async () => {
    const result = await run(
      upcFile,
      upcMeta,
      "op=mean,count&column=pct_cov&groupBy=site&q.classcode=CRUCOR&q.site=SCI_GULL_ISLE_E"
    );
    const group = result.groups![0];
    expect(group.count).toBe(6);
    expect(group.mean).toBeCloseTo(14.383333333333333, 6);
  });

  it("means sheephead transect sums at Gull Isle East in 2024", async () => {
    const result = await run(
      fishFile,
      fishMeta,
      `op=mean,sum,count&column=count&groupBy=site&replicateBy=zone,transect&within=sum&${GULL_2024}`
    );
    expect(result.groups).toHaveLength(1);
    const group = result.groups![0];
    expect(group.count).toBe(12);
    expect(group.sum).toBe(133);
    expect(group.mean).toBeCloseTo(11.083333333333334, 6);
  });

  it("row mean of the same sheephead rows stays 1.48", async () => {
    const result = await run(
      fishFile,
      fishMeta,
      `op=mean,count&column=count&groupBy=site&${GULL_2024}`
    );
    const group = result.groups![0];
    expect(group.count).toBe(90);
    expect(group.mean).toBeCloseTo(1.4777777777777779, 6);
  });

  it("treats each diver level as its own replicate when level is included", async () => {
    const result = await run(
      fishFile,
      fishMeta,
      `op=mean,count&column=count&groupBy=site&replicateBy=zone,transect,level&within=sum&${GULL_2024}`
    );
    const group = result.groups![0];
    expect(group.count).not.toBe(12);
    expect(group.mean).toBeCloseTo(5.541666666666667, 6);
  });

  it("changes transect totals when sex is filtered to female", async () => {
    const result = await run(
      fishFile,
      fishMeta,
      `op=mean,sum,count&column=count&groupBy=site&replicateBy=zone,transect&within=sum&${GULL_2024}&q.sex=FEMALE`
    );
    const group = result.groups![0];
    expect(group.count).toBe(12);
    expect(group.sum).toBe(61);
    expect(group.mean).toBeCloseTo(5.083333333333333, 6);
  });

  it("averages per-transect mean lengths instead of summing them", async () => {
    const result = await run(
      fishFile,
      fishMeta,
      `op=mean&column=fish_tl&groupBy=site&replicateBy=zone,transect&within=mean&${GULL_2024}`
    );
    expect(result.groups![0].mean).toBeCloseTo(31.865834818775994, 5);
  });

  it("weights a two-year mean by transect count", async () => {
    const result = await run(
      fishFile,
      fishMeta,
      "op=mean,count&column=count&groupBy=site&replicateBy=zone,transect&within=sum" +
        "&q.classcode=SPUL&q.site=SCI_GULL_ISLE_E" +
        "&when.start=1672531200&when.end=1735689600&when.step=year"
    );
    const byYear = new Map(
      (result.groups || []).map((group) => [String(group.step).slice(0, 4), group])
    );
    expect(byYear.get("2023")?.count).toBe(12);
    expect(byYear.get("2023")?.mean).toBeCloseTo(11.75, 6);
    expect(byYear.get("2024")?.count).toBe(12);
    expect(byYear.get("2024")?.mean).toBeCloseTo(11.083333333333334, 6);
    const pooled =
      (11.75 * 12 + 11.083333333333334 * 12) / 24;
    expect(pooled).toBeCloseTo(274 / 24, 6);
  });

  it("returns the same raw rows with and without replicateBy", async () => {
    const plain = await run(fishFile, fishMeta, `${GULL_2024}&limit=100000`);
    const flagged = await run(
      fishFile,
      fishMeta,
      `${GULL_2024}&replicateBy=zone,transect&within=sum&limit=100000`
    );
    expect(plain.rowsMatched).toBe(flagged.rowsMatched);
    expect(plain.rows).toEqual(flagged.rows);
  });
});
