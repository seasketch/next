import { describe, it } from "node:test";
import assert from "node:assert/strict";
import MiniSearch from "minisearch";
import { ORGANISM_SEARCH_INDEX_OPTIONS } from "@seasketch/geostats-types";
import {
  classTableJoinColumn,
  enrichOrganismValues,
  previewPayloadFromCatalog,
  resolveInputFromValue,
  serializeOrganismSearchIndex,
} from "./enrichOrganisms";
import type { TaxonomyClients } from "./taxonomyApis";

const config = {
  column: "classcode",
  valueKind: "code" as const,
  roles: {
    classcode: "code" as const,
    Scientific_Name: "scientificName" as const,
    Common_Name: "commonName" as const,
    taxanomic_id: "wormsAphiaId" as const,
    species_definition: "description" as const,
  },
};

function mockClients(): TaxonomyClients {
  return {
    fetch: async (url) => {
      if (url.includes("AphiaRecordByAphiaID/1702292")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            AphiaID: 1702292,
            scientificname: "Bodianus pulcher",
            valid_name: "Bodianus pulcher",
            status: "accepted",
            genus: "Bodianus",
            family: "Labridae",
          }),
        };
      }
      if (url.includes("AphiaClassificationByAphiaID/1702292")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            scientificname: "Biota",
            child: {
              scientificname: "Labridae",
              child: { scientificname: "Bodianus pulcher" },
            },
          }),
        };
      }
      if (url.includes("AphiaVernacularsByAphiaID/1702292")) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ vernacular: "California Sheephead" }],
        };
      }
      if (url.includes("query.wikidata.org")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: {
              bindings: [
                { aphia: { value: "1702292" }, inat: { value: "1439813" } },
                {
                  query: { value: "Bodianus pulcher" },
                  inat: { value: "1439813" },
                },
              ],
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    },
  };
}

describe("classTableJoinColumn", () => {
  it("prefers the code role, then the identity column name", () => {
    assert.equal(
      classTableJoinColumn(config, ["classcode", "Scientific_Name"]),
      "classcode"
    );
    assert.equal(
      classTableJoinColumn(
        { column: "Common_Name", valueKind: "commonName", roles: {} },
        ["Common_Name", "Scientific_Name"]
      ),
      "Common_Name"
    );
  });
});

describe("resolveInputFromValue", () => {
  it("reads class-table roles including AphiaID", () => {
    const input = resolveInputFromValue("SPUL", config, {
      classcode: "SPUL",
      Scientific_Name: "Bodianus pulcher",
      Common_Name: "California Sheephead",
      taxanomic_id: 1702292,
      species_definition: "Size cutoff",
    });
    assert.equal(input.scientificName, "Bodianus pulcher");
    assert.equal(input.wormsAphiaId, 1702292);
    assert.equal(input.commonName, "California Sheephead");
  });
});

describe("enrichOrganismValues", () => {
  it("resolves AphiaID rows and leaves substrate unresolved without API calls", async () => {
    let fetches = 0;
    const clients = mockClients();
    const wrapped: TaxonomyClients = {
      fetch: async (url, init) => {
        fetches += 1;
        return clients.fetch(url, init);
      },
    };
    const rows = await enrichOrganismValues({
      values: [
        { value: "SPUL", occurrenceCount: 12 },
        { value: "boulder", occurrenceCount: 4 },
      ],
      classRows: [
        {
          classcode: "SPUL",
          Scientific_Name: "Bodianus pulcher",
          Common_Name: "California Sheephead",
          taxanomic_id: 1702292,
          species_definition: "Size cutoff 10 cm",
        },
        {
          classcode: "boulder",
          species_definition: "Substrate",
        },
      ],
      config,
      clients: wrapped,
    });
    const sheephead = rows.find((row) => row.value === "SPUL");
    const boulder = rows.find((row) => row.value === "boulder");
    assert.ok(sheephead);
    assert.equal(sheephead.scientific_name, "Bodianus pulcher");
    assert.equal(sheephead.inat_taxon_id, 1439813);
    assert.equal(sheephead.worms_aphia_id, 1702292);
    assert.equal(sheephead.confidence, "high");
    assert.match(sheephead.description || "", /Size cutoff/);
    assert.ok(boulder);
    assert.equal(boulder.confidence, "unresolved");
    assert.equal(boulder.inat_taxon_id, null);
    assert.ok(fetches > 0);
  });

  it("keeps low-confidence guesses on preview rows but counts them only when the switch is on", async () => {
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
        if (url.includes("/v1/taxa/99")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              results: [
                {
                  id: 99,
                  name: "Archosargus probatocephalus",
                  preferred_common_name: "Sheepshead",
                },
              ],
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      },
    };
    const commonConfig = {
      column: "Common_Name",
      valueKind: "commonName" as const,
      roles: {},
      includeLowConfidenceMatches: false as const,
    };
    const rows = await enrichOrganismValues({
      values: [{ value: "Sheephead", occurrenceCount: 1 }],
      config: commonConfig,
      clients,
    });
    assert.equal(rows[0].confidence, "low");
    assert.equal(rows[0].inat_taxon_id, 99);
    const previewOff = previewPayloadFromCatalog(rows, commonConfig);
    assert.equal(previewOff.classifiedCount, 0);
    assert.equal(previewOff.valueCount, 1);
    const previewOn = previewPayloadFromCatalog(rows, {
      ...commonConfig,
      includeLowConfidenceMatches: true,
    });
    assert.equal(previewOn.classifiedCount, 1);
  });

  it("serializes a MiniSearch index that can prefix-search sheephead", () => {
    const json = serializeOrganismSearchIndex(
      [
        {
          value: "SPUL",
          scientific_name: "Bodianus pulcher",
          common_name: "California Sheephead",
          common_names: ["Sheephead"],
          genus: "Bodianus",
          family: "Labridae",
          ancestor_names: ["Rockfishes"],
          description: null,
          inat_taxon_id: 1439813,
          worms_aphia_id: 1702292,
          search_text: "SPUL Sheephead",
          occurrence_count: 1,
          confidence: "high",
        },
      ],
      "classcode"
    );
    const mini = MiniSearch.loadJSON(json, ORGANISM_SEARCH_INDEX_OPTIONS);
    const hits = mini.search("shee", ORGANISM_SEARCH_INDEX_OPTIONS.searchOptions);
    assert.equal(hits[0]?.id, "SPUL");
  });
});
