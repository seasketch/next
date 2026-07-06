import { describe, expect, it } from "@jest/globals";
import {
  detectJoinColumnCandidates,
  isOverlayIdAttribute,
  pickJoinColumn,
} from "./detectJoinColumn";
import { GeostatsLayer } from "@seasketch/geostats-types";

const numericIdLayer: GeostatsLayer = {
  layer: "sites",
  count: 3,
  geometry: "Point",
  hasZ: false,
  attributeCount: 1,
  attributes: [
    {
      attribute: "id",
      type: "number",
      count: 3,
      countDistinct: 3,
      values: { "1": 1, "2": 1, "3": 1 },
    },
  ],
};

const kelpSiteLayer: GeostatsLayer = {
  layer: "site_points",
  count: 3,
  geometry: "Point",
  hasZ: false,
  attributeCount: 3,
  attributes: [
    {
      attribute: "site",
      type: "string",
      count: 3,
      countDistinct: 3,
      values: { HOPKINS_DC: 1, HOPKINS_UC: 1, ASILOMAR_DC: 1 },
    },
    {
      attribute: "campus",
      type: "string",
      count: 3,
      countDistinct: 1,
      values: { UCSC: 3 },
    },
    {
      attribute: "CA_MPA_Name_Short",
      type: "string",
      count: 3,
      countDistinct: 2,
      values: { "Lovers Point - Julia Platt SMR": 2, "Asilomar SMR": 1 },
    },
  ],
};

describe("isOverlayIdAttribute", () => {
  it("requires one distinct value per feature", () => {
    expect(
      isOverlayIdAttribute(kelpSiteLayer.attributes[0], kelpSiteLayer.count),
    ).toBe(true);
    expect(
      isOverlayIdAttribute(kelpSiteLayer.attributes[1], kelpSiteLayer.count),
    ).toBe(false);
    expect(
      isOverlayIdAttribute(kelpSiteLayer.attributes[2], kelpSiteLayer.count),
    ).toBe(false);
  });
});

describe("detectJoinColumn", () => {
  it("finds site_id as join to numeric id", () => {
    const candidates = detectJoinColumnCandidates(
      ["site_id", "species", "count"],
      [
        ["1", "bass", "99"],
        ["2", "bass", "88"],
      ],
      numericIdLayer,
      "id",
    );
    expect(candidates).toEqual([
      {
        csvColumn: "site_id",
        overlayAttribute: "id",
        score: 2,
      },
    ]);
  });

  it("prefers the csv column with the most matching id values", () => {
    const layer: GeostatsLayer = {
      ...numericIdLayer,
      count: 4,
      attributes: [
        {
          attribute: "id",
          type: "number",
          count: 4,
          countDistinct: 4,
          values: { "1": 1, "2": 1, "3": 1, "4": 1 },
        },
      ],
    };
    const candidates = detectJoinColumnCandidates(
      ["partial_id", "full_id", "species"],
      [
        ["1", "1", "bass"],
        ["2", "2", "bass"],
        ["3", "3", "bass"],
        ["", "4", "bass"],
      ],
      layer,
      "id",
    );
    expect(candidates[0]).toMatchObject({
      csvColumn: "full_id",
      overlayAttribute: "id",
      score: 4,
    });
    expect(candidates[1]).toMatchObject({
      csvColumn: "partial_id",
      overlayAttribute: "id",
      score: 3,
    });
  });

  it("matches swath observations to overlay site ids only", () => {
    const candidates = detectJoinColumnCandidates(
      [
        "campus",
        "method",
        "survey_year",
        "year",
        "month",
        "day",
        "site",
        "zone",
      ],
      [
        ["UCSC", "SBTL_SWATH_PISCO", "1999", "1999", "9", "7", "HOPKINS_DC", "INNER"],
        ["UCSC", "SBTL_SWATH_PISCO", "1999", "1999", "9", "7", "HOPKINS_DC", "MID"],
        ["UCSC", "SBTL_SWATH_PISCO", "1999", "1999", "9", "7", "HOPKINS_UC", "INNER"],
      ],
      kelpSiteLayer,
      "site",
    );
    expect(candidates).toEqual([
      {
        csvColumn: "site",
        overlayAttribute: "site",
        score: 2,
      },
    ]);
  });

  it("rejects csv columns with values missing from the overlay id set", () => {
    const candidates = detectJoinColumnCandidates(
      ["site", "site_name_old"],
      [
        ["HOPKINS_DC", "UNKNOWN_SITE"],
        ["HOPKINS_UC", "UNKNOWN_SITE"],
        ["MYSTERY_SITE", "UNKNOWN_SITE"],
      ],
      kelpSiteLayer,
      "site",
    );
    expect(candidates).toEqual([]);
  });

  it("auto-picks when only one strong candidate", () => {
    const candidates = detectJoinColumnCandidates(
      ["site_id", "species"],
      [["1", "bass"]],
      numericIdLayer,
      "id",
    );
    const picked = pickJoinColumn(candidates);
    expect(picked?.needsPrompt).toBe(false);
    expect(picked?.joinColumn).toBe("site_id");
  });

  it("prompts when multiple candidates tie for the top score", () => {
    const layer: GeostatsLayer = {
      layer: "sites",
      count: 2,
      geometry: "Point",
      hasZ: false,
      attributeCount: 2,
      attributes: [
        {
          attribute: "site_code",
          type: "string",
          count: 2,
          countDistinct: 2,
          values: { A: 1, B: 1 },
        },
      ],
    };
    const candidates = detectJoinColumnCandidates(
      ["site", "site_alias"],
      [
        ["A", "A"],
        ["B", "B"],
      ],
      layer,
      "site_code",
    );
    const picked = pickJoinColumn(candidates);
    expect(candidates).toHaveLength(2);
    expect(picked?.needsPrompt).toBe(true);
  });
});
