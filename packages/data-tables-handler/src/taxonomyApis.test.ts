import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  createTaxonomyFetch,
  pickWormsAccepted,
  resolveOrganismTaxa,
  rewriteTaxonomyUrl,
  type TaxonomyClients,
} from "./taxonomyApis";
import { buildWormsParquet } from "./wormsParquet";

const WORMS_DWCA = join(__dirname, "..", "testdata", "worms-dwca");

describe("rewriteTaxonomyUrl", () => {
  it("rewrites WoRMS URLs onto the worker proxy and leaves iNat alone", () => {
    assert.equal(
      rewriteTaxonomyUrl(
        "https://www.marinespecies.org/rest/AphiaRecordByAphiaID/1",
        "https://uploads.seasketch.org/taxonomy/"
      ),
      "https://uploads.seasketch.org/taxonomy/worms/AphiaRecordByAphiaID/1"
    );
    assert.equal(
      rewriteTaxonomyUrl(
        "https://api.inaturalist.org/v1/taxa?q=Bodianus",
        "https://uploads.seasketch.org/taxonomy"
      ),
      "https://api.inaturalist.org/v1/taxa?q=Bodianus"
    );
  });
});

describe("createTaxonomyFetch", () => {
  it("sends the overlay-engine Bearer when using the proxy", async () => {
    let authorization: string | undefined;
    const fetchFn = (async (url: string, init?: { headers?: Record<string, string> }) => {
      authorization = init?.headers?.Authorization;
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      };
    }) as unknown as typeof fetch;
    const fetchTaxonomy = createTaxonomyFetch(
      fetchFn,
      "https://uploads.seasketch.org/taxonomy",
      "engine-jwt"
    );
    await fetchTaxonomy("https://api.inaturalist.org/v1/taxa?q=x");
    assert.equal(authorization, "Bearer engine-jwt");
  });
});

describe("pickWormsAccepted", () => {
  it("prefers an accepted record over an unaccepted synonym", () => {
    const picked = pickWormsAccepted([
      { status: "unaccepted", scientificname: "Old name", valid_name: "New" },
      { status: "accepted", scientificname: "New", AphiaID: 2 },
    ]);
    assert.equal(picked?.scientificname, "New");
  });
});

describe("resolveOrganismTaxa", () => {
  it("batches WoRMS name matches and Wikidata ids without calling iNaturalist", async () => {
    const urls: string[] = [];
    const clients: TaxonomyClients = {
      fetch: async (url, init) => {
        urls.push(url);
        if (url.includes("AphiaRecordsByMatchNames")) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              [
                {
                  status: "accepted",
                  AphiaID: 1,
                  scientificname: "Bodianus pulcher",
                  genus: "Bodianus",
                  family: "Labridae",
                },
              ],
              [
                {
                  status: "accepted",
                  AphiaID: 2,
                  scientificname: "Sebastes mystinus",
                  genus: "Sebastes",
                  family: "Sebastidae",
                },
              ],
            ],
          };
        }
        if (url.includes("AphiaClassificationByAphiaID")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ scientificname: "Biota" }),
          };
        }
        if (url.includes("AphiaVernacularsByAphiaID")) {
          return { ok: true, status: 200, json: async () => [] };
        }
        if (url.includes("query.wikidata.org")) {
          const body = init?.body || "";
          const bindings: Array<Record<string, { value: string }>> = [];
          if (body.includes("Bodianus")) {
            bindings.push({
              query: { value: "Bodianus pulcher" },
              inat: { value: "10" },
            });
          }
          if (body.includes("Sebastes")) {
            bindings.push({
              query: { value: "Sebastes mystinus" },
              inat: { value: "20" },
            });
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ results: { bindings } }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      },
    };

    const phases: string[] = [];
    const rows = await resolveOrganismTaxa(
      clients,
      [
        { value: "SPUL", scientificName: "Bodianus pulcher" },
        { value: "SPUL2", scientificName: "Bodianus pulcher" },
        { value: "SMYS", scientificName: "Sebastes mystinus" },
      ],
      (update) => {
        phases.push(update.phase);
      }
    );

    const matchNames = urls.filter((u) => u.includes("AphiaRecordsByMatchNames"));
    const wikiPosts = urls.filter((u) => u.includes("query.wikidata.org"));
    const inatSearches = urls.filter((u) => u.includes("/v1/taxa?"));
    const inatIds = urls.filter((u) => /\/v1\/taxa\/\d/.test(u));
    assert.equal(matchNames.length, 1);
    assert.match(matchNames[0], /scientificnames/);
    assert.ok(wikiPosts.length >= 1);
    assert.equal(inatSearches.length, 0);
    assert.equal(inatIds.length, 0);
    assert.equal(rows[0].inatTaxonId, 10);
    assert.equal(rows[1].inatTaxonId, 10);
    assert.equal(rows[2].inatTaxonId, 20);
    assert.equal(rows[0].confidence, "high");
    assert.ok(phases.includes("wikidata"));
    assert.equal(phases.includes("inat-ids"), false);
  });

  it("stores the Wikidata iNat id even when it is an inactive synonym", async () => {
    const urls: string[] = [];
    const clients: TaxonomyClients = {
      fetch: async (url) => {
        urls.push(url);
        if (url.includes("query.wikidata.org")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: {
                bindings: [
                  {
                    query: { value: "Bodianus pulcher" },
                    inat: { value: "53699" },
                  },
                ],
              },
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      },
    };
    const [row] = await resolveOrganismTaxa(clients, [
      { value: "SPUL", scientificName: "Bodianus pulcher" },
    ]);
    assert.equal(row.inatTaxonId, 53699);
    assert.equal(row.scientificName, "Bodianus pulcher");
    assert.equal(
      urls.filter((u) => u.includes("api.inaturalist.org") || u.includes("/v1/taxa")).length,
      0
    );
  });

  it("uses the parquet snapshot and skips WoRMS REST on a hit", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "worms-resolve-"));
    await buildWormsParquet(WORMS_DWCA, outDir);
    const urls: string[] = [];
    const clients: TaxonomyClients = {
      wormsParquetDir: outDir,
      fetch: async (url) => {
        urls.push(url);
        if (
          url.includes("marinespecies.org") ||
          url.includes("/taxonomy/worms/")
        ) {
          throw new Error(`unexpected WoRMS REST ${url}`);
        }
        if (url.includes("query.wikidata.org")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: {
                bindings: [
                  { aphia: { value: "1702292" }, inat: { value: "1439813" } },
                ],
              },
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      },
    };
    const rows = await resolveOrganismTaxa(clients, [
      { value: "SPUL", scientificName: "Semicossyphus pulcher" },
      { value: "ID", wormsAphiaId: 282753 },
    ]);
    assert.equal(rows[0].wormsAphiaId, 1702292);
    assert.equal(rows[0].scientificName, "Bodianus pulcher");
    assert.equal(rows[0].family, "Labridae");
    assert.ok(rows[0].ancestorNames.includes("Labridae"));
    assert.ok(
      rows[0].commonNames.includes("Sheephead") ||
        rows[0].commonName === "California Sheephead"
    );
    assert.equal(rows[0].inatTaxonId, 1439813);
    assert.equal(rows[1].wormsAphiaId, 1702292);
    assert.equal(rows[1].scientificName, "Bodianus pulcher");
    assert.equal(
      urls.filter(
        (url) =>
          url.includes("marinespecies.org") || url.includes("/taxonomy/worms/")
      ).length,
      0
    );
  });

  it("falls back to WoRMS REST when the snapshot misses", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "worms-resolve-miss-"));
    await buildWormsParquet(WORMS_DWCA, outDir);
    let matchNames = 0;
    const clients: TaxonomyClients = {
      wormsParquetDir: outDir,
      fetch: async (url) => {
        if (url.includes("AphiaRecordsByMatchNames")) {
          matchNames += 1;
          return {
            ok: true,
            status: 200,
            json: async () => [
              [
                {
                  status: "accepted",
                  AphiaID: 999,
                  scientificname: "Madeup species",
                  genus: "Madeup",
                  family: "Madeupidae",
                },
              ],
            ],
          };
        }
        if (
          url.includes("AphiaClassificationByAphiaID") ||
          url.includes("AphiaVernacularsByAphiaID")
        ) {
          return { ok: true, status: 200, json: async () => [] };
        }
        if (url.includes("query.wikidata.org")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ results: { bindings: [] } }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      },
    };
    const [row] = await resolveOrganismTaxa(clients, [
      { value: "X", scientificName: "Madeup species" },
    ]);
    assert.equal(matchNames, 1);
    assert.equal(row.wormsAphiaId, 999);
    assert.equal(row.scientificName, "Madeup species");
    assert.equal(row.confidence, "high");
  });

  it("marks a unique common-name Wikidata hit as low confidence", async () => {
    const clients: TaxonomyClients = {
      fetch: async (url) => {
        if (url.includes("query.wikidata.org")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: {
                bindings: [
                  { query: { value: "Sheephead" }, inat: { value: "99" } },
                ],
              },
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      },
    };
    const [row] = await resolveOrganismTaxa(clients, [
      { value: "Sheephead", commonName: "Sheephead" },
    ]);
    assert.equal(row.inatTaxonId, 99);
    assert.equal(row.confidence, "low");
  });

});
