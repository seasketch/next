/**
 * Tests for the organism identity module (lib/organism.ts).
 * Build first: `npm run build && npm test`.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isOrganismColumnRole,
  isOrganismValueKind,
  isOrganismInfo,
  isDataTableOrganismConfig,
  isOrganismCatalogRow,
  suggestOrganismColumnRoles,
  suggestOrganismIdentityColumn,
  columnsWithRole,
  uniqueStrings,
  buildOrganismSearchText,
  catalogRowToSearchDocument,
  organismInfoFromConfig,
  organismClassificationCounts,
  organismIsClassified,
  includeLowConfidenceMatchesEnabled,
  isLumpedOrganismValue,
  genusFromOrganismName,
  ORGANISM_SEARCH_INDEX_OPTIONS,
  ORGANISM_SEARCH_BOOSTS,
} = require("../dist/lib/organism.js");

const validInfo = {
  version: 1,
  column: "classcode",
  valueKind: "code",
  roles: { classcode: "code", scientific_name: "scientificName" },
  authoredBy: "admin",
};

const validCatalogRow = {
  value: "SPUL",
  scientific_name: "Bodianus pulcher",
  common_name: "California Sheephead",
  common_names: ["Sheephead"],
  genus: "Bodianus",
  family: "Labridae",
  ancestor_names: ["Rockfishes", "Labridae"],
  description: "Size cutoff 10 cm",
  inat_taxon_id: 1439813,
  worms_aphia_id: 1702292,
  search_text: "SPUL Bodianus pulcher California Sheephead",
  occurrence_count: 12,
  confidence: "high",
};

test("all organism guards reject null, undefined, and non-objects", () => {
  for (const guard of [isOrganismInfo, isDataTableOrganismConfig, isOrganismCatalogRow]) {
    for (const junk of [null, undefined, 42, "x", true, [], () => {}]) {
      assert.equal(guard(junk), false, `${guard.name}(${String(junk)})`);
    }
  }
});

test("primitive organism guards", () => {
  assert.equal(isOrganismColumnRole("code"), true);
  assert.equal(isOrganismColumnRole("taxon"), false);
  assert.equal(isOrganismValueKind("mixed"), true);
  assert.equal(isOrganismValueKind("latin"), false);
});

test("isOrganismInfo accepts a valid document", () => {
  assert.equal(isOrganismInfo(validInfo), true);
  assert.equal(
    isOrganismInfo({
      ...validInfo,
      roles: { notes: ["description", "commonName"] },
    }),
    true
  );
});

test("isOrganismInfo rejects malformed documents", () => {
  assert.equal(isOrganismInfo({ ...validInfo, version: 2 }), false);
  assert.equal(isOrganismInfo({ ...validInfo, column: "" }), false);
  assert.equal(isOrganismInfo({ ...validInfo, valueKind: "latin" }), false);
  assert.equal(isOrganismInfo({ ...validInfo, roles: { x: "taxon" } }), false);
  assert.equal(isOrganismInfo({ ...validInfo, authoredBy: "robot" }), false);
  const { column, ...missing } = validInfo;
  assert.equal(isOrganismInfo(missing), false);
});

test("isDataTableOrganismConfig does not require authoredBy", () => {
  const { authoredBy, ...config } = validInfo;
  assert.equal(isDataTableOrganismConfig(config), true);
  assert.equal(isDataTableOrganismConfig(validInfo), true);
  assert.equal(
    isDataTableOrganismConfig({
      ...config,
      includeLowConfidenceMatches: true,
    }),
    true
  );
  assert.equal(
    isDataTableOrganismConfig({
      ...config,
      includeLowConfidenceMatches: "yes",
    }),
    false
  );
});

test("isOrganismInfo accepts optional counts and the low-confidence switch", () => {
  assert.equal(
    isOrganismInfo({
      ...validInfo,
      includeLowConfidenceMatches: false,
      valueCount: 150,
      classifiedCount: 142,
    }),
    true
  );
  assert.equal(
    isOrganismInfo({ ...validInfo, classifiedCount: -1 }),
    false
  );
});

test("isOrganismCatalogRow accepts a valid row and rejects junk ids", () => {
  assert.equal(isOrganismCatalogRow(validCatalogRow), true);
  assert.equal(isOrganismCatalogRow({ ...validCatalogRow, inat_taxon_id: 0 }), false);
  assert.equal(
    isOrganismCatalogRow({ ...validCatalogRow, common_names: "Sheephead" }),
    false
  );
  assert.equal(
    isOrganismCatalogRow({ ...validCatalogRow, confidence: "maybe" }),
    false
  );
});

test("suggestOrganismColumnRoles pre-fills CA class-table headers", () => {
  const roles = suggestOrganismColumnRoles([
    "classcode",
    "Scientific_Name",
    "Common_Name",
    "Genus",
    "Species",
    "taxanomic_id",
    "species_definition",
    "site",
  ]);
  assert.equal(roles.classcode, "code");
  assert.equal(roles.Scientific_Name, "scientificName");
  assert.equal(roles.Common_Name, "commonName");
  assert.equal(roles.Genus, "genus");
  assert.equal(roles.Species, "species");
  assert.equal(roles.taxanomic_id, "wormsAphiaId");
  assert.equal(roles.species_definition, "description");
  assert.equal(roles.site, undefined);
});

test("suggestOrganismIdentityColumn prefers classcode then scientific then common", () => {
  assert.deepEqual(
    suggestOrganismIdentityColumn(["site", "classcode", "count"]),
    { column: "classcode", valueKind: "code" }
  );
  assert.deepEqual(
    suggestOrganismIdentityColumn(["scientificname", "density"]),
    { column: "scientificname", valueKind: "scientificName" }
  );
  assert.equal(suggestOrganismIdentityColumn(["site", "count"]), null);
  assert.equal(suggestOrganismIdentityColumn(null), null);
});

test("columnsWithRole and uniqueStrings", () => {
  assert.deepEqual(
    columnsWithRole(
      { a: "description", b: ["commonName", "description"] },
      "description"
    ),
    ["a", "b"]
  );
  assert.deepEqual(uniqueStrings([" Sheephead ", "sheephead", "", null, "Bocaccio"]), [
    "Sheephead",
    "Bocaccio",
  ]);
});

test("search text and MiniSearch document contract", () => {
  const text = buildOrganismSearchText(validCatalogRow);
  assert.match(text, /SPUL/);
  assert.match(text, /Bodianus pulcher/);
  assert.match(text, /Rockfishes/);
  const doc = catalogRowToSearchDocument(validCatalogRow, "classcode");
  assert.equal(doc.id, "SPUL");
  assert.equal(doc.column, "classcode");
  assert.equal(doc.common_names, "Sheephead");
  const lowRow = { ...validCatalogRow, confidence: "low", inat_taxon_id: 99 };
  assert.equal(
    catalogRowToSearchDocument(lowRow, "classcode", false).inat_taxon_id,
    null
  );
  assert.equal(
    catalogRowToSearchDocument(lowRow, "classcode", true).inat_taxon_id,
    99
  );
  assert.deepEqual(ORGANISM_SEARCH_INDEX_OPTIONS.fields, [
    "value",
    "common_name",
    "scientific_name",
    "common_names",
    "genus",
    "ancestor_names",
    "description",
  ]);
  assert.equal(ORGANISM_SEARCH_BOOSTS.value, 8);
  assert.equal(ORGANISM_SEARCH_BOOSTS.ancestor_names, 2);
  assert.equal(ORGANISM_SEARCH_INDEX_OPTIONS.searchOptions.prefix, true);
});

test("organismInfoFromConfig and lump helpers", () => {
  assert.deepEqual(
    organismInfoFromConfig({
      column: "classcode",
      valueKind: "code",
      roles: { classcode: "code" },
    }),
    {
      version: 1,
      column: "classcode",
      valueKind: "code",
      roles: { classcode: "code" },
      authoredBy: "admin",
      includeLowConfidenceMatches: false,
    }
  );
  assert.equal(isLumpedOrganismValue("Sebastes spp."), true);
  assert.equal(isLumpedOrganismValue("Sebastes spp"), true);
  assert.equal(isLumpedOrganismValue("SPUL"), false);
  assert.equal(genusFromOrganismName("Sebastes spp."), "Sebastes");
  assert.equal(genusFromOrganismName("Bodianus pulcher"), "Bodianus");
  assert.equal(genusFromOrganismName("boulder"), null);
  assert.equal(includeLowConfidenceMatchesEnabled({}), false);
  assert.equal(
    includeLowConfidenceMatchesEnabled({ includeLowConfidenceMatches: true }),
    true
  );
  assert.equal(organismIsClassified({ confidence: "low" }, false), false);
  assert.equal(organismIsClassified({ confidence: "low" }, true), true);
  assert.deepEqual(
    organismClassificationCounts(
      [{ confidence: "high" }, { confidence: "low" }, { confidence: "unresolved" }],
      false
    ),
    { valueCount: 3, classifiedCount: 1 }
  );
});
