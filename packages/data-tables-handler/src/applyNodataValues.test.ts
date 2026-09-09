import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { processCsvWithDuckDb } from "./processWithDuckDb";
import {
  applyNodataValuesOnParquet,
  nodataMatchSql,
} from "./applyNodataValues";
import { all, withDuckDb } from "./duckDb";

function writeCsv(dir: string, name: string, body: string): string {
  const csvPath = path.join(dir, name);
  writeFileSync(csvPath, body);
  return csvPath;
}

describe("nodataMatchSql", () => {
  it("matches numeric and string sentinels", () => {
    const sql = nodataMatchSql('"airtemp"', [-88, "NA"]);
    assert.match(sql || "", /try_cast\("airtemp" AS DOUBLE\) IN \(-88\)/);
    assert.match(sql || "", /CAST\("airtemp" AS VARCHAR\) IN \('-88', 'NA'\)/);
  });
});

describe("applyNodataValuesOnParquet", () => {
  it("rewrites numeric and string sentinels to null except the join column", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dt-nodata-"));
    const csvPath = writeCsv(
      dir,
      "wq.csv",
      [
        "siteid,airtemp,do_percent,notes",
        "CC-ADLC,-88,-88,NA",
        "CC-CAR,16.4,93,ok",
        "CC-CAR,-88,94,fine",
      ].join("\n"),
    );
    const parquetPath = path.join(dir, "data.parquet");
    await processCsvWithDuckDb(csvPath, parquetPath, { hasHeaderRow: true });

    const result = await applyNodataValuesOnParquet(
      parquetPath,
      [-88, "NA"],
      ["siteid"],
    );
    assert.equal(result.rowCount, 3);
    assert.deepEqual(result.values, [-88, "NA"]);

    const rows = await withDuckDb((conn) =>
      all<{
        siteid: string;
        airtemp: number | null;
        do_percent: number | null;
        notes: string | null;
      }>(
        conn,
        `SELECT siteid, airtemp, do_percent, notes
         FROM read_parquet('${parquetPath.replace(/'/g, "''")}')
         ORDER BY siteid, airtemp NULLS FIRST`,
      ),
    );
    assert.equal(rows.length, 3);
    const nullAir = rows.filter((row) => row.airtemp == null);
    assert.equal(nullAir.length, 2);
    const notes = rows.map((row) => row.notes);
    assert.ok(notes.includes(null) || notes.includes(undefined as never));
    assert.ok(rows.every((row) => row.siteid != null && row.siteid !== ""));
  });

  it("leaves cells unchanged when the sentinel list is empty", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dt-nodata-empty-"));
    const csvPath = writeCsv(
      dir,
      "wq.csv",
      ["siteid,airtemp", "CC-ADLC,-88", "CC-CAR,16.4"].join("\n"),
    );
    const parquetPath = path.join(dir, "data.parquet");
    await processCsvWithDuckDb(csvPath, parquetPath, { hasHeaderRow: true });
    await applyNodataValuesOnParquet(parquetPath, []);
    const rows = await withDuckDb((conn) =>
      all<{ airtemp: number | null }>(
        conn,
        `SELECT airtemp FROM read_parquet('${parquetPath.replace(/'/g, "''")}')
         ORDER BY airtemp`,
      ),
    );
    assert.deepEqual(
      rows.map((row) => row.airtemp),
      [-88, 16.4],
    );
  });
});
