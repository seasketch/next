import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeColumnStatsFromParquet,
  finiteColumnStat,
} from "./processWithDuckDb";
import { run, withDuckDb } from "./duckDb";

describe("finiteColumnStat", () => {
  it("keeps finite numbers and drops null", () => {
    assert.equal(finiteColumnStat(null), undefined);
    assert.equal(finiteColumnStat(undefined), undefined);
    assert.equal(finiteColumnStat(Number.NaN), undefined);
    assert.equal(finiteColumnStat(Number.POSITIVE_INFINITY), undefined);
    assert.equal(finiteColumnStat("1.5"), undefined);
    assert.equal(finiteColumnStat(0), 0);
    assert.equal(finiteColumnStat(1.5), 1.5);
  });
});

describe("computeColumnStatsFromParquet", () => {
  it("omits min and max when every value in a numeric column is null", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "column-stats-"));
    const parquet = path.join(dir, "table.parquet");
    try {
      await withDuckDb(async (conn) => {
        await run(
          conn,
          `COPY (
            SELECT * FROM (VALUES
              ('a', 1.5::DOUBLE, NULL::DOUBLE, 0::INTEGER),
              ('b', 4::DOUBLE, NULL::DOUBLE, 10::INTEGER)
            ) t(site, abundance, biomass, count_n)
          ) TO '${parquet.replace(/'/g, "''")}' (FORMAT PARQUET)`,
        );
      });

      const stats = await computeColumnStatsFromParquet(parquet, "estuary", {
        column: "site",
        overlayAttribute: "id",
        matchRate: 1,
        matchedRows: 2,
        unmatchedRows: 0,
        unmatchedOverlayValues: 0,
      });
      const byName = Object.fromEntries(
        stats.columns.map((column) => [column.attribute, column]),
      );

      assert.equal(byName.biomass?.type, "number");
      assert.equal(byName.biomass?.count, 0);
      assert.equal(byName.biomass?.min, undefined);
      assert.equal(byName.biomass?.max, undefined);
      assert.equal(byName.abundance?.min, 1.5);
      assert.equal(byName.abundance?.max, 4);
      assert.equal(byName.count_n?.min, 0);
      assert.equal(byName.count_n?.max, 10);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
