import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTypedSelectSql, type CsvColumnPlan } from "./inferCsvColumnPlans";
import { processCsvWithDuckDb } from "./processWithDuckDb";
import { all, run, withDuckDb } from "./duckDb";

const plans: CsvColumnPlan[] = [
  { name: "name", duckDbType: "VARCHAR", nullifyNa: true },
  { name: "code", duckDbType: "VARCHAR", nullifyNa: false },
  { name: "n", duckDbType: "INTEGER", nullifyNa: true },
];

describe("buildTypedSelectSql", () => {
  it("trims whitespace at the ends of string columns and leaves internal spaces", async () => {
    const sql = buildTypedSelectSql(plans);
    assert.match(sql, /regexp_replace\("name"/);
    assert.doesNotMatch(sql, /regexp_replace\("n"/);

    const rows = await withDuckDb(async (conn) => {
      await run(
        conn,
        `CREATE TABLE src (name VARCHAR, code VARCHAR, n VARCHAR)`,
      );
      await run(
        conn,
        `INSERT INTO src VALUES
          ('Vermilion Rockfish ', ' NA ', ' 12 '),
          ('  a  b  ', 'NA', 'NA'),
          (chr(9) || 'tab' || chr(10), '  keep  ', ' 3 '),
          (chr(160) || 'nbsp' || chr(160), 'x', NULL),
          ('   ', '   ', '   ')`,
      );
      return all<{ name: string | null; code: string | null; n: number | null }>(
        conn,
        `SELECT ${sql} FROM src ORDER BY n NULLS LAST, name NULLS LAST`,
      );
    });

    assert.deepEqual(
      rows.map((row) => row.name),
      ["tab", "Vermilion Rockfish", "a  b", "nbsp", null],
    );
    assert.deepEqual(
      rows.map((row) => row.code),
      ["keep", "NA", "NA", "x", null],
    );
    assert.deepEqual(
      rows.map((row) => row.n),
      [3, 12, null, null, null],
    );
  });
});

describe("processCsvWithDuckDb string trim", () => {
  it("stores trimmed text from an uploaded csv", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dt-trim-"));
    const nbsp = "\u00A0";
    const csvPath = path.join(dir, "fish.csv");
    writeFileSync(
      csvPath,
      [
        "Common_Name,note",
        `"Vermilion Rockfish ","a  b"`,
        `Vermilion Rockfish,${nbsp}padded${nbsp}`,
        `"\ttabbed\t",kept`,
        `"   ",kept`,
      ].join("\n"),
    );
    const parquetPath = path.join(dir, "data.parquet");
    await processCsvWithDuckDb(csvPath, parquetPath, { hasHeaderRow: true });

    const rows = await withDuckDb((conn) =>
      all<{ Common_Name: string | null; note: string | null }>(
        conn,
        `SELECT Common_Name, note FROM read_parquet('${parquetPath.replace(/'/g, "''")}') ORDER BY note, Common_Name NULLS LAST`,
      ),
    );

    assert.deepEqual(rows, [
      { Common_Name: "Vermilion Rockfish", note: "a  b" },
      { Common_Name: "tabbed", note: "kept" },
      { Common_Name: null, note: "kept" },
      { Common_Name: "Vermilion Rockfish", note: "padded" },
    ]);
  });
});
