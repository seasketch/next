import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { processCsvWithDuckDb } from "./processWithDuckDb";
import { deriveWhenColumnsOnParquet, whenSelectSql } from "./deriveWhenColumns";
import { deriveWhenIntervalFromRow } from "../../geostats-types/lib/temporal";

function writeCsv(dir: string, name: string, body: string): string {
  const csvPath = path.join(dir, name);
  writeFileSync(csvPath, body);
  return csvPath;
}

describe("whenSelectSql", () => {
  it("emits year and slash-date expressions", () => {
    const year = whenSelectSql({
      kind: "instant",
      column: "survey_year",
      format: "year",
    });
    assert.match(year.start, /make_timestamp/);
    const mdy = whenSelectSql({
      kind: "instant",
      column: "Date",
      format: "mdy",
    });
    assert.match(mdy.start, /%m\/%d\/%Y/);
  });
});

describe("deriveWhenColumnsOnParquet", () => {
  it("matches TS derivation for year, mdy, and component mappings", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dt-when-"));
    const csvPath = writeCsv(
      dir,
      "pilot.csv",
      [
        "site,survey_year,year,month,day,Date",
        "A,2018,2018,6,15,6/15/2018",
        "B,2019,2019,1,1,1/1/2019",
        "C,2020,2020,12,31,12/31/2020",
      ].join("\n"),
    );
    const parquetPath = path.join(dir, "data.parquet");
    await processCsvWithDuckDb(csvPath, parquetPath, { hasHeaderRow: true });

    const year = await deriveWhenColumnsOnParquet(parquetPath, {
      sourceColumns: {
        kind: "instant",
        column: "survey_year",
        format: "year",
      },
      defaultViewResolution: "year",
    });
    assert.equal(year.parseableCount, 3);
    assert.equal(year.unparseableCount, 0);
    assert.equal(year.temporal.coverage.start, "2018");
    assert.equal(year.temporal.coverage.end, "2021");
    assert.equal(year.temporal.granularity, "row");
    assert.equal(year.temporal.mapping?.type, "row");

    const ts = deriveWhenIntervalFromRow(
      { Date: "6/15/2018" },
      { kind: "instant", column: "Date", format: "mdy" },
    );
    const mdy = await deriveWhenColumnsOnParquet(parquetPath, {
      sourceColumns: { kind: "instant", column: "Date", format: "mdy" },
    });
    assert.equal(mdy.parseableCount, 3);
    assert.equal(mdy.temporal.nativeResolution, "day");
    assert.ok(ts);
    assert.equal(mdy.temporal.coverage.start, "2018-06-15");

    const components = await deriveWhenColumnsOnParquet(parquetPath, {
      sourceColumns: {
        kind: "components",
        year: "year",
        month: "month",
        day: "day",
      },
      defaultViewResolution: "year",
    });
    assert.equal(components.parseableCount, 3);
    assert.equal(components.temporal.defaultViewResolution, "year");
    assert.equal(components.temporal.availability?.type, "histogram");
  });

  it("parses CCFRP-style MDY dates and sparse intertidal years", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dt-when-pilot-"));
    const csvPath = writeCsv(
      dir,
      "pilot.csv",
      [
        "site,Date,samplecollectiondate,survey_year",
        "A,6/15/2018,6/15/2018,2018",
        "B,8/2/2018,8/2/2018,2018",
        "C,7/1/2021,7/1/2021,2021",
      ].join("\n"),
    );
    const parquetPath = path.join(dir, "data.parquet");
    await processCsvWithDuckDb(csvPath, parquetPath, { hasHeaderRow: true });

    const ccfrp = await deriveWhenColumnsOnParquet(parquetPath, {
      sourceColumns: { kind: "instant", column: "Date", format: "mdy" },
      defaultViewResolution: "year",
    });
    assert.equal(ccfrp.parseableCount, 3);
    assert.equal(ccfrp.temporal.nativeResolution, "day");
    assert.equal(ccfrp.temporal.coverage.start, "2018-06-15");
    assert.equal(ccfrp.temporal.availability?.type, "histogram");

    const estuary = await deriveWhenColumnsOnParquet(parquetPath, {
      sourceColumns: {
        kind: "instant",
        column: "samplecollectiondate",
        format: "mdy",
      },
    });
    assert.equal(estuary.parseableCount, 3);

    const sparse = await deriveWhenColumnsOnParquet(parquetPath, {
      sourceColumns: {
        kind: "instant",
        column: "survey_year",
        format: "year",
      },
    });
    assert.equal(sparse.temporal.coverage.start, "2018");
    assert.equal(sparse.temporal.coverage.end, "2022");
    if (sparse.temporal.availability?.type === "histogram") {
      assert.equal(sparse.temporal.availability.bins.length, 2);
      assert.equal(sparse.temporal.availability.bins[0].start, "2018");
      assert.equal(sparse.temporal.availability.bins[1].start, "2021");
    } else {
      assert.fail("expected histogram availability");
    }
  });

  it("fails when no rows parse", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dt-when-bad-"));
    const csvPath = writeCsv(dir, "bad.csv", "site,Date\nA,not-a-date\n");
    const parquetPath = path.join(dir, "data.parquet");
    await processCsvWithDuckDb(csvPath, parquetPath, { hasHeaderRow: true });
    await assert.rejects(
      () =>
        deriveWhenColumnsOnParquet(parquetPath, {
          sourceColumns: { kind: "instant", column: "Date", format: "mdy" },
        }),
      /No rows could be parsed/,
    );
  });
});
