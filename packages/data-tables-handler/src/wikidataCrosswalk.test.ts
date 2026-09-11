import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assignUniqueInatId,
  buildWikidataAphiaQuery,
  buildWikidataNameQuery,
  escapeSparqlString,
  fetchWikidataInatCrosswalk,
  parseWikidataInatBindings,
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

describe("assignUniqueInatId", () => {
  it("drops a key when two different ids disagree", () => {
    const map = new Map<string, number>();
    assignUniqueInatId(map, "sheephead", 1);
    assignUniqueInatId(map, "sheephead", 1);
    assert.equal(map.get("sheephead"), 1);
    assignUniqueInatId(map, "sheephead", 2);
    assert.equal(map.get("sheephead"), -1);
  });
});

describe("fetchWikidataInatCrosswalk", () => {
  it("batches AphiaIDs and names and keeps unique hits", async () => {
    const urls: string[] = [];
    const bodies: string[] = [];
    const { byAphiaId, byName } = await fetchWikidataInatCrosswalk(
      async (url, init) => {
        urls.push(url);
        bodies.push(init?.body || "");
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
    assert.equal(urls.length, 3);
    assert.ok(urls.every((url) => url === WIKIDATA_SPARQL_URL));
    assert.match(bodies[0], /1702292/);
    assert.match(bodies[1], /Bodianus/);
    assert.match(decodeURIComponent(bodies[2]), /@en/);
    assert.equal(byAphiaId.get(1702292), 53699);
    assert.equal(byName.get("bodianus pulcher"), 53699);
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
});
