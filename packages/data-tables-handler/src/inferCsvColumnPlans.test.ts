import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildTypedSelectSql,
  decideNmNullHandling,
  promotedNumericType,
  tokenLooksLikeCategoryCode,
  type CsvColumnPlan,
} from "./inferCsvColumnPlans";
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

describe("NM null heuristic", () => {
  it("treats a token as a category when it is no more common than its peers", () => {
    assert.equal(tokenLooksLikeCategoryCode(2, 2, 2), true);
    assert.equal(tokenLooksLikeCategoryCode(4, 5, 2), true);
    assert.equal(tokenLooksLikeCategoryCode(5, 4, 2), false);
    assert.equal(tokenLooksLikeCategoryCode(6, 10, 2), false);
    assert.equal(tokenLooksLikeCategoryCode(0, 5, 2), false);
  });

  it("nulls NM only when it does not look like a category code", () => {
    assert.equal(decideNmNullHandling(0, false), false);
    assert.equal(decideNmNullHandling(4, true), false);
    assert.equal(decideNmNullHandling(9, false), true);
  });

  it("promotes a column to a numeric type only when sentinels were the non-numeric values", () => {
    assert.equal(promotedNumericType(0, 0, 12), "BIGINT");
    assert.equal(promotedNumericType(0, 2, 12), "DOUBLE");
    assert.equal(promotedNumericType(1, 0, 12), null);
    assert.equal(promotedNumericType(0, 0, 0), null);
  });

  it("stores size bins as integers and blanks a dominant NM marker", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dt-nm-size-"));
    const csvPath = path.join(dir, "sizes.csv");
    writeFileSync(
      csvPath,
      [
        "species,size_bin",
        "AB,10",
        "CD,20",
        "NM,30",
        "EF,NM",
        "GH,NM",
        "IJ,NM",
      ].join("\n"),
    );
    const parquetPath = path.join(dir, "data.parquet");
    await processCsvWithDuckDb(csvPath, parquetPath, { hasHeaderRow: true });
    const escaped = parquetPath.replace(/'/g, "''");

    const schema = await withDuckDb((conn) =>
      all<{ column_name: string; column_type: string }>(
        conn,
        `SELECT column_name, column_type FROM (DESCRIBE SELECT * FROM read_parquet('${escaped}'))`,
      ),
    );
    const rows = await withDuckDb((conn) =>
      all<{ species: string | null; size_bin: number | null }>(
        conn,
        `SELECT species, size_bin FROM read_parquet('${escaped}') ORDER BY species`,
      ),
    );

    assert.equal(
      schema.find((column) => column.column_name === "size_bin")?.column_type,
      "BIGINT",
    );
    assert.equal(
      schema.find((column) => column.column_name === "species")?.column_type,
      "VARCHAR",
    );
    assert.deepEqual(
      rows.map((row) => row.species),
      ["AB", "CD", "EF", "GH", "IJ", "NM"],
    );
    assert.deepEqual(
      rows.map((row) =>
        row.size_bin == null ? null : Number(row.size_bin)
      ),
      [10, 20, null, null, null, 30],
    );
  });

  it("keeps a decimal column as DOUBLE when NM is the marker", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dt-nm-depth-"));
    const csvPath = path.join(dir, "depth.csv");
    writeFileSync(csvPath, ["depth", "1.5", "2.5", "NM", "NM", "NM"].join("\n"));
    const parquetPath = path.join(dir, "data.parquet");
    await processCsvWithDuckDb(csvPath, parquetPath, { hasHeaderRow: true });
    const escaped = parquetPath.replace(/'/g, "''");

    const schema = await withDuckDb((conn) =>
      all<{ column_type: string }>(
        conn,
        `SELECT column_type FROM (DESCRIBE SELECT * FROM read_parquet('${escaped}'))`,
      ),
    );
    const rows = await withDuckDb((conn) =>
      all<{ depth: number | null }>(
        conn,
        `SELECT depth FROM read_parquet('${escaped}') ORDER BY depth NULLS LAST`,
      ),
    );

    assert.equal(schema[0]?.column_type, "DOUBLE");
    assert.deepEqual(
      rows.map((row) => row.depth),
      [1.5, 2.5, null, null, null],
    );
  });

  it("keeps NM on a text column when it is just another code", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dt-nm-taxon-"));
    const csvPath = path.join(dir, "taxa.csv");
    writeFileSync(
      csvPath,
      ["taxon", "NM", "AB", "CD", "EF", "GH"].join("\n"),
    );
    const parquetPath = path.join(dir, "data.parquet");
    await processCsvWithDuckDb(csvPath, parquetPath, { hasHeaderRow: true });
    const escaped = parquetPath.replace(/'/g, "''");

    const rows = await withDuckDb((conn) =>
      all<{ taxon: string | null }>(
        conn,
        `SELECT taxon FROM read_parquet('${escaped}') ORDER BY taxon`,
      ),
    );
    assert.deepEqual(
      rows.map((row) => row.taxon),
      ["AB", "CD", "EF", "GH", "NM"],
    );
  });

  it("keeps a peer NM even when the other values are numeric", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dt-nm-codes-"));
    const csvPath = path.join(dir, "sites.csv");
    writeFileSync(
      csvPath,
      ["site", "1", "1", "2", "2", "3", "3", "NM", "NM"].join("\n"),
    );
    const parquetPath = path.join(dir, "data.parquet");
    await processCsvWithDuckDb(csvPath, parquetPath, { hasHeaderRow: true });
    const escaped = parquetPath.replace(/'/g, "''");

    const schema = await withDuckDb((conn) =>
      all<{ column_type: string }>(
        conn,
        `SELECT column_type FROM (DESCRIBE SELECT * FROM read_parquet('${escaped}'))`,
      ),
    );
    const rows = await withDuckDb((conn) =>
      all<{ site: string | null }>(
        conn,
        `SELECT site FROM read_parquet('${escaped}') ORDER BY site`,
      ),
    );

    assert.equal(schema[0]?.column_type, "VARCHAR");
    assert.deepEqual(
      rows.map((row) => row.site),
      ["1", "1", "2", "2", "3", "3", "NM", "NM"],
    );
  });

  it("blanks a bulk NM marker on a text column and leaves the real notes", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dt-nm-notes-"));
    const csvPath = path.join(dir, "notes.csv");
    writeFileSync(
      csvPath,
      ["notes", "NM", "NM", "NM", "saw one"].join("\n"),
    );
    const parquetPath = path.join(dir, "data.parquet");
    await processCsvWithDuckDb(csvPath, parquetPath, { hasHeaderRow: true });
    const escaped = parquetPath.replace(/'/g, "''");

    const schema = await withDuckDb((conn) =>
      all<{ column_type: string }>(
        conn,
        `SELECT column_type FROM (DESCRIBE SELECT * FROM read_parquet('${escaped}'))`,
      ),
    );
    const rows = await withDuckDb((conn) =>
      all<{ notes: string | null }>(
        conn,
        `SELECT notes FROM read_parquet('${escaped}') ORDER BY notes NULLS LAST`,
      ),
    );

    assert.equal(schema[0]?.column_type, "VARCHAR");
    assert.deepEqual(
      rows.map((row) => row.notes),
      ["saw one", null, null, null],
    );
  });
});
