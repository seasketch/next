import { describe, expect, it, beforeEach } from "vitest";
import MiniSearch from "minisearch";
import {
  ORGANISM_SEARCH_INDEX_OPTIONS,
  catalogRowToSearchDocument,
  type OrganismCatalogRow,
} from "@seasketch/geostats-types";
import {
  executeOrgQuery,
  normalizeOrgQueryTableRef,
  parseOrgQueryParams,
  resetOrgQueryCache,
  type OrgQueryStore,
} from "../../src/dataTables/orgQuery";

const TABLE_A =
  "projects/ca/public/11111111-1111-1111-1111-111111111111/dataTables/u1";
const TABLE_B =
  "projects/ca/public/22222222-2222-2222-2222-222222222222/dataTables/u2";

function row(partial: Partial<OrganismCatalogRow> & { value: string }): OrganismCatalogRow {
  return {
    scientific_name: null,
    common_name: null,
    common_names: [],
    genus: null,
    family: null,
    ancestor_names: [],
    description: null,
    inat_taxon_id: null,
    worms_aphia_id: null,
    search_text: partial.value,
    occurrence_count: 1,
    confidence: "high",
    ...partial,
  };
}

function indexJson(rows: OrganismCatalogRow[], column = "classcode"): string {
  const mini = new MiniSearch(ORGANISM_SEARCH_INDEX_OPTIONS);
  mini.addAll(rows.map((entry) => catalogRowToSearchDocument(entry, column)));
  return JSON.stringify(mini);
}

function memoryStore(
  files: Record<string, string>
): OrgQueryStore & { stats: number; gets: number } {
  const store = {
    stats: 0,
    gets: 0,
    async stat(key: string) {
      store.stats += 1;
      if (!(key in files)) return null;
      return { etag: `etag-${key}` };
    },
    async get(key: string) {
      store.gets += 1;
      const text = files[key];
      if (!text) return null;
      return { text, etag: `etag-${key}` };
    },
  };
  return store;
}

describe("normalizeOrgQueryTableRef", () => {
  it("accepts prefixes, query URLs, and sidecar keys", () => {
    expect(normalizeOrgQueryTableRef(TABLE_A)).toBe(TABLE_A);
    expect(
      normalizeOrgQueryTableRef(
        `https://uploads.seasketch.org/${TABLE_A}/query`
      )
    ).toBe(TABLE_A);
    expect(
      normalizeOrgQueryTableRef(`/${TABLE_A}/organism-search.json`)
    ).toBe(TABLE_A);
  });

  it("rejects null, traversal, and non-table paths", () => {
    expect(normalizeOrgQueryTableRef(null)).toBeNull();
    expect(normalizeOrgQueryTableRef(undefined)).toBeNull();
    expect(normalizeOrgQueryTableRef("projects/ca/public/not-a-uuid/dataTables/u1")).toBeNull();
    expect(normalizeOrgQueryTableRef("projects/ca/../secret")).toBeNull();
    expect(normalizeOrgQueryTableRef("acl/prod.json")).toBeNull();
  });
});

describe("parseOrgQueryParams", () => {
  it("dedupes tables and defaults limit", () => {
    const parsed = parseOrgQueryParams(
      new URLSearchParams(`tables=${TABLE_A},${TABLE_A}/query&q=sheephead`)
    );
    expect(parsed.tables).toEqual([TABLE_A]);
    expect(parsed.q).toBe("sheephead");
    expect(parsed.limit).toBe(2000);
  });

  it("rejects a missing tables list", () => {
    expect(() => parseOrgQueryParams(new URLSearchParams("q=x"))).toThrow(
      /tables is required/
    );
  });
});

describe("executeOrgQuery", () => {
  beforeEach(() => {
    resetOrgQueryCache();
  });

  const sheephead = row({
    value: "SPUL",
    scientific_name: "Bodianus pulcher",
    common_name: "California Sheephead",
    common_names: ["Sheephead"],
    genus: "Bodianus",
    ancestor_names: ["Wrasses", "Labridae"],
    inat_taxon_id: 1439813,
    worms_aphia_id: 1702292,
  });
  const rockfish = row({
    value: "SEBSPP",
    scientific_name: "Sebastes spp.",
    common_name: "Rockfishes",
    genus: "Sebastes",
    ancestor_names: ["Rockfishes"],
  });
  const boulder = row({
    value: "boulder",
    common_name: "Boulder",
  });

  it("ranks a common-name prefix above an ancestor-only hit", async () => {
    const store = memoryStore({
      [`${TABLE_A}/organism-search.json`]: indexJson([
        sheephead,
        rockfish,
        boulder,
      ]),
    });
    const sheep = await executeOrgQuery(
      { q: "shee", tables: [TABLE_A], limit: 10 },
      store
    );
    expect(sheep.tablesScanned).toBe(1);
    expect(sheep.hits[0]?.value).toBe("SPUL");
    expect(sheep.hits[0]?.commonName).toBe("California Sheephead");
    expect(sheep.hits[0]?.inatTaxonId).toBe(1439813);

    const rocks = await executeOrgQuery(
      { q: "rockfish", tables: [TABLE_A], limit: 10 },
      store
    );
    expect(rocks.hits.map((hit) => hit.value)).toContain("SEBSPP");

    const substrate = await executeOrgQuery(
      { q: "boulder", tables: [TABLE_A], limit: 10 },
      store
    );
    expect(substrate.hits[0]?.value).toBe("boulder");
  });

  it("returns the full catalog alphabetically when q is empty", async () => {
    const store = memoryStore({
      [`${TABLE_A}/organism-search.json`]: indexJson([
        sheephead,
        rockfish,
        boulder,
      ]),
    });
    const result = await executeOrgQuery(
      { q: "", tables: [TABLE_A], limit: 2000 },
      store
    );
    expect(result.tablesScanned).toBe(1);
    expect(result.hits.map((hit) => hit.value)).toEqual([
      "boulder",
      "SPUL",
      "SEBSPP",
    ]);
    expect(result.hits.map((hit) => hit.commonName)).toEqual([
      "Boulder",
      "California Sheephead",
      "Rockfishes",
    ]);
  });

  it("merges multiple tables and skips missing indexes", async () => {
    const store = memoryStore({
      [`${TABLE_A}/organism-search.json`]: indexJson([sheephead]),
    });
    const result = await executeOrgQuery(
      { q: "sheephead", tables: [TABLE_A, TABLE_B], limit: 10 },
      store
    );
    expect(result.tablesScanned).toBe(1);
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.table).toBe(TABLE_A);
  });

  it("reuses a deserialized index on a warm isolate", async () => {
    const store = memoryStore({
      [`${TABLE_A}/organism-search.json`]: indexJson([sheephead]),
    });
    await executeOrgQuery({ q: "SPUL", tables: [TABLE_A], limit: 5 }, store);
    await executeOrgQuery(
      { q: "sheephead", tables: [TABLE_A], limit: 5 },
      store
    );
    expect(store.gets).toBe(1);
    expect(store.stats).toBe(2);
  });
});
