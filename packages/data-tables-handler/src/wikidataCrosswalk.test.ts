import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addInatCandidate,
  buildWikidataAphiaQuery,
  buildWikidataNameQuery,
  escapeSparqlString,
  fetchWikidataInatCrosswalk,
  followInactiveInatId,
  INATURALIST_TAXA_URL,
  parseInatTaxonActivity,
  parseInatTaxonShow,
  parseWikidataInatBindings,
  pickActiveInatId,
  WIKIDATA_SPARQL_URL,
} from "./wikidataCrosswalk";

describe("escapeSparqlString / query builders", () => {
  it("escapes quotes in names", () => {
    assert.equal(escapeSparqlString('foo "bar"'), 'foo \\"bar\\"');
    assert.match(buildWikidataNameQuery(['foo "bar"']), /foo \\"bar\\"/);
  });

  it("embeds AphiaIDs as string VALUES", () => {
    const query = buildWikidataAphiaQuery([1702292, 272286]);
    assert.match(query, /"1702292"/);
    assert.match(query, /wdt:P850/);
    assert.match(query, /wdt:P3151/);
  });

  it("does not BIND language-tagged labels in the name query", () => {
    const query = buildWikidataNameQuery(["Bodianus pulcher"]);
    assert.doesNotMatch(query, /STRLANG/);
    assert.doesNotMatch(query, /rdfs:label/);
    assert.match(query, /wdt:P225/);
    assert.match(query, /wdt:P1843/);
    assert.match(query, /"Bodianus pulcher"@en/);
  });
});

describe("parseWikidataInatBindings", () => {
  it("reads SPARQL JSON and skips junk", () => {
    assert.deepEqual(parseWikidataInatBindings(null), []);
    assert.deepEqual(
      parseWikidataInatBindings({
        results: {
          bindings: [
            { aphia: { value: "1702292" }, inat: { value: "53699" } },
            { query: { value: "Bodianus pulcher" }, inat: { value: "1439813" } },
            { inat: { value: "nope" } },
          ],
        },
      }),
      [
        { aphia: "1702292", query: null, inat: 53699 },
        { aphia: null, query: "Bodianus pulcher", inat: 1439813 },
      ]
    );
  });
});

describe("pickActiveInatId / parseInatTaxonActivity", () => {
  it("keeps a single candidate without needing activity", () => {
    assert.equal(pickActiveInatId([187594], new Map()), 187594);
  });

  it("prefers the only active id among a clash", () => {
    const activity = new Map<number, boolean>([
      [187594, false],
      [54526, true],
    ]);
    assert.equal(pickActiveInatId([187594, 54526], activity), 54526);
  });

  it("drops clashes that are not a single live taxon", () => {
    assert.equal(
      pickActiveInatId(
        [1, 2],
        new Map([
          [1, true],
          [2, true],
        ])
      ),
      null
    );
    assert.equal(
      pickActiveInatId(
        [1, 2],
        new Map([
          [1, false],
          [2, false],
        ])
      ),
      null
    );
    assert.equal(pickActiveInatId([1, 2], new Map()), null);
    assert.equal(pickActiveInatId([], new Map()), null);
  });

  it("follows an inactive iNat id to its accepted synonym", () => {
    const show = parseInatTaxonShow({
      results: [
        {
          id: 53699,
          is_active: false,
          current_synonymous_taxon_ids: [1439813],
        },
        { id: 1439813, is_active: true },
      ],
    });
    assert.equal(followInactiveInatId(53699, show), 1439813);
    assert.equal(followInactiveInatId(1439813, show), 1439813);
    assert.equal(followInactiveInatId(53699, new Map()), 53699);
  });

  it("reads is_active and rejects junk", () => {
    assert.equal(parseInatTaxonActivity(null).size, 0);
    assert.equal(parseInatTaxonActivity(undefined).size, 0);
    assert.equal(parseInatTaxonActivity({ results: "nope" }).size, 0);
    const parsed = parseInatTaxonActivity({
      results: [
        { id: 54526, is_active: true },
        { id: 187594, is_active: false },
        { id: 0, is_active: true },
        { name: "no id" },
      ],
    });
    assert.equal(parsed.get(54526), true);
    assert.equal(parsed.get(187594), false);
    assert.equal(parsed.has(0), false);
  });

  it("collects distinct candidates per key", () => {
    const map = new Map<string, Set<number>>();
    addInatCandidate(map, "240774", 187594);
    addInatCandidate(map, "240774", 187594);
    addInatCandidate(map, "240774", 54526);
    assert.deepEqual(Array.from(map.get("240774") || []).sort(), [187594, 54526]);
  });
});

describe("fetchWikidataInatCrosswalk", () => {
  it("batches AphiaIDs and names and follows an inactive P3151", async () => {
    const urls: string[] = [];
    const bodies: string[] = [];
    const { byAphiaId, byName } = await fetchWikidataInatCrosswalk(
      async (url, init) => {
        urls.push(url);
        bodies.push(init?.body || "");
        if (url.startsWith(INATURALIST_TAXA_URL)) {
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
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: {
              bindings: [
                { aphia: { value: "1702292" }, inat: { value: "53699" } },
                { query: { value: "Bodianus pulcher" }, inat: { value: "53699" } },
              ],
            },
          }),
        };
      },
      { aphiaIds: [1702292], names: ["Bodianus pulcher", "Bodianus pulcher"] }
    );
    assert.equal(urls.filter((url) => url === WIKIDATA_SPARQL_URL).length, 3);
    assert.match(bodies[0], /1702292/);
    assert.match(bodies[1], /Bodianus/);
    assert.match(decodeURIComponent(bodies[2]), /@en/);
    assert.equal(byAphiaId.get(1702292), 1439813);
    assert.equal(byName.get("bodianus pulcher"), 1439813);
    assert.match(urls[3], /\/taxa\/53699$/);
  });

  it("keeps Aphia hits when a later name batch fails", async () => {
    let calls = 0;
    const { byAphiaId } = await fetchWikidataInatCrosswalk(
      async () => {
        calls += 1;
        if (calls === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: {
                bindings: [
                  { aphia: { value: "1702292" }, inat: { value: "53699" } },
                ],
              },
            }),
          };
        }
        return { ok: false, status: 400, json: async () => ({}) };
      },
      { aphiaIds: [1702292], names: ["Bodianus pulcher"] }
    );
    assert.equal(byAphiaId.get(1702292), 53699);
  });

  it("prefers the active iNat taxon when Wikidata lists two P3151s", async () => {
    const urls: string[] = [];
    const { byAphiaId } = await fetchWikidataInatCrosswalk(
      async (url) => {
        urls.push(url);
        if (url.startsWith(INATURALIST_TAXA_URL)) {
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
      },
      { aphiaIds: [240774], names: [] }
    );
    assert.equal(byAphiaId.get(240774), 54526);
    assert.equal(urls.filter((url) => url.includes("query.wikidata.org")).length, 1);
    const inat = urls.filter((url) => url.startsWith(INATURALIST_TAXA_URL));
    assert.equal(inat.length, 1);
    assert.match(inat[0], /\/taxa\/(54526,187594|187594,54526)$/);
    assert.equal(urls.filter((url) => url.includes("/v1/taxa?")).length, 0);
  });

  it("checks a unique P3151 on iNat show so inactive synonyms can be followed", async () => {
    const urls: string[] = [];
    const { byAphiaId } = await fetchWikidataInatCrosswalk(
      async (url) => {
        urls.push(url);
        if (url.startsWith(INATURALIST_TAXA_URL)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: [{ id: 54526, is_active: true }],
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: {
              bindings: [{ aphia: { value: "240774" }, inat: { value: "54526" } }],
            },
          }),
        };
      },
      { aphiaIds: [240774], names: [] }
    );
    assert.equal(byAphiaId.get(240774), 54526);
    assert.equal(urls.filter((url) => url.includes("api.inaturalist.org")).length, 1);
    assert.equal(urls.filter((url) => url.includes("/v1/taxa?")).length, 0);
  });
});
