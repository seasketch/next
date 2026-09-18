import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  ancestorsFromWormsRecord,
  createTaxonomyFetch,
  fetchWormsVernaculars,
  pickWormsAccepted,
  resolveOrganismTaxa,
  rewriteTaxonomyUrl,
  sanitizeWormsQueryName,
  wormsQueryName,
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

describe("ancestorsFromWormsRecord / fetchWormsVernaculars", () => {
  it("reads rank fields from an AphiaRecord", () => {
    assert.deepEqual(
      ancestorsFromWormsRecord({
        kingdom: "Animalia",
        phylum: "Mollusca",
        family: "Pectinidae",
        genus: "Crassadoma",
        scientificname: "Crassadoma gigantea",
      }),
      ["Animalia", "Mollusca", "Pectinidae", "Crassadoma", "Crassadoma gigantea"]
    );
  });

  it("treats WoRMS 204 as no vernaculars", async () => {
    const names = await fetchWormsVernaculars(
      {
        fetch: async () => ({
          ok: true,
          status: 204,
          json: async () => {
            throw new Error("Unexpected end of JSON input");
          },
        }),
      },
      1313053
    );
    assert.deepEqual(names, []);
  });
});

describe("sanitizeWormsQueryName", () => {
  it("strips life-stage tags and collapses lumped species lists to genus", () => {
    assert.equal(
      sanitizeWormsQueryName("Cephaloscyllium ventriosum EGG"),
      "Cephaloscyllium ventriosum"
    );
    assert.equal(
      sanitizeWormsQueryName("Sebastes chrysomelas/carnatus young of year"),
      "Sebastes"
    );
    assert.equal(
      sanitizeWormsQueryName("Sebastes atrovirens,carnatus,chrysomelas,caurinus"),
      "Sebastes"
    );
    assert.equal(sanitizeWormsQueryName("Atherinopsidae"), "Atherinopsidae");
    assert.equal(
      wormsQueryName({
        value: "SWELLEG",
        scientificName: "Heterodontus francisci EGG",
      }),
      "Heterodontus francisci"
    );
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
  it("batches WoRMS name matches and Wikidata ids without calling iNaturalist search", async () => {
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
        if (/\/v1\/taxa\/\d/.test(url)) {
          const ids = url.split("/taxa/")[1].split(",").map((id) => parseInt(id, 10));
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: ids.map((id) => ({ id, is_active: true })),
            }),
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
    assert.ok(inatIds.length >= 1);
    assert.equal(rows[0].inatTaxonId, 10);
    assert.equal(rows[1].inatTaxonId, 10);
    assert.equal(rows[2].inatTaxonId, 20);
    assert.equal(rows[0].confidence, "high");
    assert.ok(phases.includes("wikidata"));
    assert.equal(phases.includes("inat-ids"), false);
  });

  it("follows an inactive Wikidata iNat id to the live synonym", async () => {
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
        if (/\/v1\/taxa\/\d/.test(url)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: [
                {
                  id: 53699,
                  is_active: false,
                  current_synonymous_taxon_ids: [1439813],
                },
              ],
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      },
    };
    const [row] = await resolveOrganismTaxa(clients, [
      { value: "SPUL", scientificName: "Bodianus pulcher" },
    ]);
    assert.equal(row.inatTaxonId, 1439813);
    assert.equal(row.scientificName, "Bodianus pulcher");
    assert.equal(urls.filter((u) => u.includes("/v1/taxa?")).length, 0);
    assert.ok(urls.some((u) => /\/v1\/taxa\/53699$/.test(u)));
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

  it("finds sheephead on stale Wikidata keys and stores the live iNat id", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "worms-sheephead-"));
    await buildWormsParquet(WORMS_DWCA, outDir);
    const clients: TaxonomyClients = {
      wormsParquetDir: outDir,
      fetch: async (url, init) => {
        if (
          url.includes("marinespecies.org") ||
          url.includes("/taxonomy/worms/")
        ) {
          throw new Error(`unexpected WoRMS REST ${url}`);
        }
        if (url.includes("query.wikidata.org")) {
          const body = decodeURIComponent(String(init?.body || ""));
          const bindings: Array<Record<string, { value: string }>> = [];
          if (body.includes("282753")) {
            bindings.push({ aphia: { value: "282753" }, inat: { value: "53699" } });
          }
          if (body.includes("Semicossyphus")) {
            bindings.push({
              query: { value: "Semicossyphus pulcher" },
              inat: { value: "53699" },
            });
          }
          if (body.includes("California Sheephead")) {
            bindings.push({
              query: { value: "California Sheephead" },
              inat: { value: "53699" },
            });
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ results: { bindings } }),
          };
        }
        if (/\/v1\/taxa\/\d/.test(url)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: [
                {
                  id: 53699,
                  is_active: false,
                  current_synonymous_taxon_ids: [1439813],
                },
              ],
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      },
    };
    const [fromName, fromOldAphia] = await resolveOrganismTaxa(clients, [
      {
        value: "SPUL",
        scientificName: "Bodianus pulcher",
        commonName: "California Sheephead",
      },
      { value: "ID", wormsAphiaId: 282753 },
    ]);
    assert.equal(fromName.wormsAphiaId, 1702292);
    assert.equal(fromName.inatTaxonId, 1439813);
    assert.equal(fromOldAphia.wormsAphiaId, 1702292);
    assert.equal(fromOldAphia.inatTaxonId, 1439813);
  });

  it("falls back to WoRMS REST when the snapshot misses", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "worms-resolve-miss-"));
    await buildWormsParquet(WORMS_DWCA, outDir);
    const urls: string[] = [];
    let matchNames = 0;
    const clients: TaxonomyClients = {
      wormsParquetDir: outDir,
      fetch: async (url) => {
        urls.push(url);
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
        if (url.includes("AphiaVernacularsByAphiaID")) {
          return { ok: true, status: 204, json: async () => {
            throw new Error("Unexpected end of JSON input");
          } };
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
    assert.ok(row.ancestorNames.includes("Madeupidae"));
    assert.equal(
      urls.filter((url) => url.includes("AphiaClassificationByAphiaID")).length,
      0
    );
    assert.equal(
      urls.filter((url) => url.includes("AphiaVernacularsByAphiaID")).length,
      1
    );
  });

  it("skips vernaculars REST when Taxamatch lands on a snapshot AphiaID", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "worms-resolve-refill-"));
    await buildWormsParquet(WORMS_DWCA, outDir);
    const urls: string[] = [];
    const clients: TaxonomyClients = {
      wormsParquetDir: outDir,
      fetch: async (url) => {
        urls.push(url);
        if (url.includes("AphiaRecordsByMatchNames")) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              [
                {
                  status: "accepted",
                  AphiaID: 1702292,
                  scientificname: "Bodianus pulcher",
                  genus: "Bodianus",
                  family: "Labridae",
                },
              ],
            ],
          };
        }
        if (url.includes("query.wikidata.org")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ results: { bindings: [] } }),
          };
        }
        if (url.includes("marinespecies.org") || url.includes("/taxonomy/worms/")) {
          throw new Error(`unexpected WoRMS REST ${url}`);
        }
        return { ok: true, status: 200, json: async () => ({}) };
      },
    };
    const [row] = await resolveOrganismTaxa(clients, [
      { value: "SPUL", scientificName: "Madeup pulcher" },
    ]);
    assert.equal(row.wormsAphiaId, 1702292);
    assert.ok(row.ancestorNames.includes("Labridae"));
    assert.equal(
      urls.filter((url) => url.includes("AphiaClassificationByAphiaID")).length,
      0
    );
    assert.equal(
      urls.filter((url) => url.includes("AphiaVernacularsByAphiaID")).length,
      0
    );
  });

  it("keeps the active iNat id when Wikidata returns two P3151s", async () => {
    const urls: string[] = [];
    const clients: TaxonomyClients = {
      fetch: async (url) => {
        urls.push(url);
        if (url.includes("AphiaRecordByAphiaID")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status: "accepted",
              AphiaID: 240774,
              scientificname: "Crassadoma gigantea",
            }),
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
            json: async () => ({
              results: {
                bindings: [
                  { aphia: { value: "240774" }, inat: { value: "187594" } },
                  { aphia: { value: "240774" }, inat: { value: "54526" } },
                ],
              },
            }),
          };
        }
        if (url.includes("api.inaturalist.org/v1/taxa/")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: [
                { id: 187594, is_active: false },
                { id: 54526, is_active: true },
              ],
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      },
    };
    const [row] = await resolveOrganismTaxa(clients, [
      {
        value: "CRAGIGG",
        scientificName: "Crassadoma gigantea",
        wormsAphiaId: 240774,
      },
    ]);
    assert.equal(row.inatTaxonId, 54526);
    assert.equal(row.confidence, "high");
    assert.equal(urls.filter((url) => url.includes("/v1/taxa?")).length, 0);
    assert.equal(
      urls.filter((url) => url.includes("api.inaturalist.org/v1/taxa/")).length,
      1
    );
  });

  it("sends sanitized names to Taxamatch instead of survey lumps", async () => {
    const urls: string[] = [];
    const clients: TaxonomyClients = {
      fetch: async (url) => {
        urls.push(url);
        if (url.includes("AphiaRecordsByMatchNames")) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              [
                {
                  status: "accepted",
                  AphiaID: 277105,
                  scientificname: "Cephaloscyllium ventriosum",
                },
              ],
              [
                {
                  status: "accepted",
                  AphiaID: 126175,
                  scientificname: "Sebastes",
                  genus: "Sebastes",
                },
              ],
            ],
          };
        }
        if (url.includes("AphiaVernacularsByAphiaID")) {
          return { ok: true, status: 204, json: async () => null };
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
    await resolveOrganismTaxa(clients, [
      { value: "SWELLEG", scientificName: "Cephaloscyllium ventriosum EGG" },
      {
        value: "SEBSPP",
        scientificName: "Sebastes atrovirens,carnatus,chrysomelas",
      },
    ]);
    const match = urls.find((url) => url.includes("AphiaRecordsByMatchNames"));
    assert.ok(match);
    assert.match(match as string, /Cephaloscyllium\+ventriosum/);
    assert.doesNotMatch(match as string, /EGG/);
    assert.match(match as string, /Sebastes/);
    assert.doesNotMatch(match as string, /atrovirens/);
  });

  it("retries Taxamatch names individually after a batch 500", async () => {
    const urls: string[] = [];
    const clients: TaxonomyClients = {
      fetch: async (url) => {
        urls.push(url);
        if (url.includes("AphiaRecordsByMatchNames")) {
          const names = [...new URL(url).searchParams.values()];
          if (names.length > 1) {
            return { ok: false, status: 500, json: async () => null };
          }
          return {
            ok: true,
            status: 200,
            json: async () => [
              [
                {
                  status: "accepted",
                  AphiaID: 1,
                  scientificname: names[0],
                },
              ],
            ],
          };
        }
        if (url.includes("AphiaVernacularsByAphiaID")) {
          return { ok: true, status: 204, json: async () => null };
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
    const rows = await resolveOrganismTaxa(clients, [
      { value: "A", scientificName: "Atherinopsidae" },
      { value: "B", scientificName: "Embiotocidae" },
    ]);
    const matchNames = urls.filter((url) =>
      url.includes("AphiaRecordsByMatchNames")
    );
    assert.ok(matchNames.length >= 3);
    assert.equal(rows[0].wormsAphiaId, 1);
    assert.equal(rows[1].wormsAphiaId, 1);
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
