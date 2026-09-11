import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { siblingRemote } from "./remotes";

describe("siblingRemote", () => {
  it("replaces data.parquet with a sidecar filename", () => {
    assert.equal(
      siblingRemote(
        "r2://bucket/projects/ca/public/abc/dataTables/u1/data.parquet",
        "organism-search.json"
      ),
      "r2://bucket/projects/ca/public/abc/dataTables/u1/organism-search.json"
    );
  });

  it("rejects remotes that are not data.parquet", () => {
    assert.equal(siblingRemote("r2://bucket/other.parquet", "x.json"), null);
    assert.equal(siblingRemote(null, "x.json"), null);
  });
});
