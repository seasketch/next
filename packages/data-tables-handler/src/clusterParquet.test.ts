import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clusterColumns,
  copyObservationsParquetSql,
} from "./clusterParquet";

describe("clusterColumns", () => {
  it("uses only configured filter, time, and join columns", () => {
    assert.deepEqual(
      clusterColumns({
        columns: [
          "site",
          "classcode",
          "campus",
          "count",
          "year",
          "_when_start",
          "_when_end",
        ],
        joinColumn: "site",
        organismColumn: "classcode",
        requiredFilterColumns: ["campus"],
        temporalColumns: ["year"],
      }),
      ["classcode", "campus", "_when_start", "year"]
    );
  });

  it("places replicate columns immediately after survey time", () => {
    assert.deepEqual(
      clusterColumns({
        columns: [
          "site",
          "classcode",
          "campus",
          "zone",
          "transect",
          "year",
          "_when_start",
          "_when_end",
        ],
        joinColumn: "site",
        organismColumn: "classcode",
        requiredFilterColumns: ["campus"],
        temporalColumns: ["year"],
        replicateColumns: ["zone", "transect"],
      }),
      ["classcode", "campus", "_when_start", "zone", "transect", "year"]
    );
  });

  it("does not infer a filter column from its name", () => {
    assert.deepEqual(
      clusterColumns({
        columns: ["site", "classcode", "count", "year"],
        joinColumn: "site",
      }),
      ["site"]
    );
  });
});

describe("copyObservationsParquetSql", () => {
  it("orders the COPY by cluster columns", () => {
    const sql = copyObservationsParquetSql("/tmp/data.parquet", [
      "classcode",
      "_when_start",
    ]);
    assert.match(sql, /ORDER BY "classcode", "_when_start"/);
    assert.match(sql, /ROW_GROUP_SIZE 122880/);
  });
});
