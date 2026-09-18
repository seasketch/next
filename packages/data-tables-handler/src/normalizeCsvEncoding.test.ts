import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectCsvEncoding,
  normalizeCsvEncodingIfNeeded,
} from "./normalizeCsvEncoding";
import { processCsvWithDuckDb } from "./processWithDuckDb";
import { all, withDuckDb } from "./duckDb";

function tmpDir(prefix: string): string {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

describe("detectCsvEncoding", () => {
  it("treats empty and ascii files as utf-8", () => {
    const dir = tmpDir("dt-enc-ascii-");
    const emptyPath = path.join(dir, "empty.csv");
    const asciiPath = path.join(dir, "ascii.csv");
    writeFileSync(emptyPath, "");
    writeFileSync(asciiPath, "site,count\nA,1\n");
    assert.equal(detectCsvEncoding(emptyPath), "utf-8");
    assert.equal(detectCsvEncoding(asciiPath), "utf-8");
  });

  it("treats multi-byte utf-8 as utf-8", () => {
    const dir = tmpDir("dt-enc-utf8-");
    const csvPath = path.join(dir, "utf8.csv");
    writeFileSync(csvPath, "site,name\nA,café\n", "utf8");
    assert.equal(detectCsvEncoding(csvPath), "utf-8");
  });

  it("treats isolated high bytes as windows-1252", () => {
    const dir = tmpDir("dt-enc-latin1-");
    const csvPath = path.join(dir, "latin1.csv");
    writeFileSync(csvPath, Buffer.from("site,name\nA,caf\xE9\n", "latin1"));
    assert.equal(detectCsvEncoding(csvPath), "windows-1252");
  });

  it("treats windows-1252 bytes 0x80-0x9F as windows-1252", () => {
    const dir = tmpDir("dt-enc-cp1252-");
    const csvPath = path.join(dir, "cp1252.csv");
    writeFileSync(csvPath, Buffer.from("site,note\nA,ok\x80\x93\n", "latin1"));
    assert.equal(detectCsvEncoding(csvPath), "windows-1252");
  });

  it("does not decode the whole file as one string", () => {
    const dir = tmpDir("dt-enc-chunk-");
    const csvPath = path.join(dir, "chunk.csv");
    const highByteEveryMeg = Buffer.concat([
      Buffer.alloc(1024 * 1024, 0x61),
      Buffer.from([0xe9]),
      Buffer.from("\nsite\nA\n"),
    ]);
    writeFileSync(csvPath, highByteEveryMeg);
    assert.equal(detectCsvEncoding(csvPath), "windows-1252");
  });
});

describe("normalizeCsvEncodingIfNeeded", () => {
  it("leaves valid utf-8 in place", async () => {
    const dir = tmpDir("dt-norm-utf8-");
    const csvPath = path.join(dir, "utf8.csv");
    writeFileSync(csvPath, "site,name\nA,café\n", "utf8");
    const result = await normalizeCsvEncodingIfNeeded(csvPath);
    assert.equal(result.normalized, false);
    assert.equal(result.path, csvPath);
  });

  it("rewrites windows-1252 including 0x80-0x9F to utf-8", async () => {
    const dir = tmpDir("dt-norm-cp1252-");
    const csvPath = path.join(dir, "cp1252.csv");
    const outPath = path.join(dir, "out.csv");
    writeFileSync(csvPath, Buffer.from("site,note\nA,ok\x80\x93\n", "latin1"));
    const result = await normalizeCsvEncodingIfNeeded(csvPath, outPath);
    assert.equal(result.normalized, true);
    assert.equal(result.path, outPath);
    assert.equal(readFileSync(outPath, "utf8"), "site,note\nA,ok€“\n");
  });
});

describe("processCsvWithDuckDb encoding", () => {
  it("reads latin-1 bytes after streaming them to utf-8", async () => {
    const dir = tmpDir("dt-enc-duck-");
    const csvPath = path.join(dir, "latin1.csv");
    const parquetPath = path.join(dir, "data.parquet");
    writeFileSync(csvPath, Buffer.from("site,name\nA,caf\xE9\n", "latin1"));

    const result = await processCsvWithDuckDb(csvPath, parquetPath, {
      hasHeaderRow: true,
    });
    assert.equal(result.rowCount, 1);
    assert.deepEqual(result.headers, ["site", "name"]);

    const rows = await withDuckDb((conn) =>
      all<{ site: string; name: string }>(
        conn,
        `SELECT site, name FROM read_parquet('${parquetPath.replace(/'/g, "''")}')`,
      ),
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].site, "A");
    assert.equal(rows[0].name, "café");
  });

  it("reads windows-1252 bytes that duckdb latin-1 rejects", async () => {
    const dir = tmpDir("dt-enc-duck-cp1252-");
    const csvPath = path.join(dir, "cp1252.csv");
    const parquetPath = path.join(dir, "data.parquet");
    writeFileSync(csvPath, Buffer.from("site,note\nA,ok\x80\n", "latin1"));

    const result = await processCsvWithDuckDb(csvPath, parquetPath, {
      hasHeaderRow: true,
    });
    assert.equal(result.rowCount, 1);

    const rows = await withDuckDb((conn) =>
      all<{ site: string; note: string }>(
        conn,
        `SELECT site, note FROM read_parquet('${parquetPath.replace(/'/g, "''")}')`,
      ),
    );
    assert.equal(rows[0].note, "ok€");
  });
});
