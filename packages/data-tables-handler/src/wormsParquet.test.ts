import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { withDuckDb } from "./duckDb";
import {
  buildWormsParquet,
  binomialFromWormsNameKey,
  lookupWormsSynonymKeys,
  lookupWormsTaxaByAphiaIds,
  lookupWormsTaxaByNames,
  lookupWormsTaxaByVernaculars,
  normalizeVernacularKey,
  normalizeWormsNameKey,
  parseAphiaIdFromLsid,
  stripWormsAuthorship,
  wormsParquetIsPresent,
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

describe("binomialFromWormsNameKey", () => {
  it("restores genus case and drops authorship keys", () => {
    assert.equal(
      binomialFromWormsNameKey("oxyjulis californica"),
      "Oxyjulis californica"
    );
    assert.equal(
      binomialFromWormsNameKey("oxyjulis californica (günther, 1861)"),
      null
    );
    assert.equal(
      binomialFromWormsNameKey("halichoeres californicus günther, 1861"),
      null
    );
  });
});

describe("normalizeVernacularKey", () => {
  it("folds case, diacritics, and hyphens", () => {
    assert.equal(normalizeVernacularKey("  Señorita "), "senorita");
    assert.equal(
      normalizeVernacularKey("Black-and-yellow Example"),
      "black and yellow example"
    );
    assert.equal(normalizeVernacularKey("   "), null);
  });
});

describe("normalizeWormsNameKey", () => {
  it("strips parenthetical authorship and downcases", () => {
    assert.equal(
      normalizeWormsNameKey("Bodianus pulcher (Ayres, 1854)"),
      "bodianus pulcher"
    );
    assert.equal(stripWormsAuthorship("Gadus morhua Linnaeus, 1758"), "Gadus morhua");
    assert.equal(
      normalizeWormsNameKey("Atherinopsidae Fitzinger, 1873"),
      "atherinopsidae"
    );
    assert.equal(
      normalizeWormsNameKey("atherinopsidae fitzinger, 1873"),
      "atherinopsidae"
    );
  });
});

describe("buildWormsParquet", () => {
  it("resolves accepted taxa, synonym ids, and vernaculars", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "worms-parquet-"));
    const manifest = await buildWormsParquet(DWCA, outDir);
    assert.equal(manifest.taxaRows, 4);
    assert.equal(manifest.idRows, 5);

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

      const byVernacular = await lookupWormsTaxaByVernaculars(conn, outDir, [
        "Sheephead",
        "Senorita",
        "Black and Yellow Example",
        "Shared Name",
        "Not a taxon",
      ]);
      assert.equal(byVernacular.get("sheephead")?.kind, "unique");
      if (byVernacular.get("sheephead")?.kind === "unique") {
        assert.equal(byVernacular.get("sheephead")?.taxon.aphia_id, 1702292);
      }
      assert.equal(byVernacular.get("senorita")?.kind, "unique");
      if (byVernacular.get("senorita")?.kind === "unique") {
        assert.equal(byVernacular.get("senorita")?.taxon.aphia_id, 9001);
      }
      assert.equal(byVernacular.get("black and yellow example")?.kind, "unique");
      if (byVernacular.get("black and yellow example")?.kind === "unique") {
        assert.equal(
          byVernacular.get("black and yellow example")?.taxon.aphia_id,
          9002
        );
      }
      assert.equal(byVernacular.get("shared name")?.kind, "ambiguous");
      assert.equal(byVernacular.has("not a taxon"), false);

      const synonyms = await lookupWormsSynonymKeys(conn, outDir, [1702292]);
      assert.deepEqual(synonyms.get(1702292)?.aphiaIds, [282753]);
      assert.ok(
        synonyms.get(1702292)?.scientificNames.includes("Semicossyphus pulcher")
      );
    });

    assert.equal(wormsParquetIsPresent(outDir), true);
    assert.equal(wormsParquetIsPresent(join(outDir, "missing")), false);
  });
});
