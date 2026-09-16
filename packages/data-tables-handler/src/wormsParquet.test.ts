import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { withDuckDb } from "./duckDb";
import {
  buildWormsParquet,
  lookupWormsTaxaByAphiaIds,
  lookupWormsTaxaByNames,
  normalizeWormsNameKey,
  parseAphiaIdFromLsid,
  stripWormsAuthorship,
} from "./wormsParquet";

const DWCA = join(__dirname, "..", "testdata", "worms-dwca");

describe("parseAphiaIdFromLsid", () => {
  it("reads LSIDs, plain ids, and rejects junk", () => {
    assert.equal(
      parseAphiaIdFromLsid("urn:lsid:marinespecies.org:taxname:1702292"),
      1702292
    );
    assert.equal(parseAphiaIdFromLsid("1702292"), 1702292);
    assert.equal(parseAphiaIdFromLsid(null), null);
    assert.equal(parseAphiaIdFromLsid("not-an-id"), null);
  });
});

describe("normalizeWormsNameKey", () => {
  it("strips parenthetical authorship and downcases", () => {
    assert.equal(
      normalizeWormsNameKey("Bodianus pulcher (Ayres, 1854)"),
      "bodianus pulcher"
    );
    assert.equal(stripWormsAuthorship("Gadus morhua Linnaeus, 1758"), "Gadus morhua");
  });
});

describe("buildWormsParquet", () => {
  it("resolves accepted taxa, synonym ids, and vernaculars", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "worms-parquet-"));
    const manifest = await buildWormsParquet(DWCA, outDir);
    assert.equal(manifest.taxaRows, 2);
    assert.equal(manifest.idRows, 3);

    await withDuckDb(async (conn) => {
      const byId = await lookupWormsTaxaByAphiaIds(conn, outDir, [
        1702292, 282753,
      ]);
      const accepted = byId.get(1702292);
      const synonym = byId.get(282753);
      assert.ok(accepted);
      assert.equal(accepted.scientific_name, "Bodianus pulcher");
      assert.equal(accepted.family, "Labridae");
      assert.equal(accepted.genus, "Bodianus");
      assert.equal(accepted.common_name, "California Sheephead");
      assert.ok(accepted.vernaculars.includes("Sheephead"));
      assert.ok(accepted.ancestor_names.includes("Labridae"));
      assert.deepEqual(synonym, accepted);

      const byName = await lookupWormsTaxaByNames(conn, outDir, [
        "Bodianus pulcher (Ayres, 1854)",
        "Semicossyphus pulcher",
      ]);
      assert.equal(byName.get("bodianus pulcher")?.aphia_id, 1702292);
      assert.equal(byName.get("semicossyphus pulcher")?.aphia_id, 1702292);
    });
  });
});
