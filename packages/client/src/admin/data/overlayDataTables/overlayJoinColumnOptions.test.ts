/* eslint-disable i18next/no-literal-string */
import { describe, expect, it } from "@jest/globals";
import { GeostatsLayer } from "@seasketch/geostats-types";
import { partitionOverlayJoinColumnOptions } from "./overlayJoinColumnOptions";

const kelpSiteLayer: GeostatsLayer = {
  layer: "site_points",
  count: 401,
  geometry: "Point",
  hasZ: false,
  attributeCount: 4,
  attributes: [
    {
      attribute: "site",
      type: "string",
      count: 401,
      countDistinct: 396,
      values: Object.fromEntries(
        Array.from({ length: 396 }, (_, i) => [`SITE_${i}`, i < 391 ? 1 : 2]),
      ),
    },
    {
      attribute: "CA_MPA_Name_Short",
      type: "string",
      count: 401,
      countDistinct: 59,
      values: Object.fromEntries(
        Array.from({ length: 59 }, (_, i) => [`MPA_${i}`, Math.ceil(401 / 59)]),
      ),
    },
    {
      attribute: "campus",
      type: "string",
      count: 401,
      countDistinct: 1,
      values: { UCSC: 401 },
    },
    {
      attribute: "source_row_count",
      type: "number",
      count: 401,
      countDistinct: 80,
      values: Object.fromEntries(
        Array.from({ length: 80 }, (_, i) => [String(i + 1), 5]),
      ),
    },
  ],
};

describe("partitionOverlayJoinColumnOptions", () => {
  it("puts ai bestIdColumn first in suggested even when close", () => {
    const { suggested, other } = partitionOverlayJoinColumnOptions(
      kelpSiteLayer,
      "site",
    );
    expect(suggested[0]?.attribute).toBe("site");
    expect(suggested[0]?.hintSource).toBe("ai");
    expect(suggested[0]?.status).toBe("close");
    expect(other.map((option) => option.attribute)).not.toContain("site");
  });

  it("uses cardinality heuristics when ai hint is unavailable", () => {
    const { suggested, primaryHint } = partitionOverlayJoinColumnOptions(
      kelpSiteLayer,
    );
    expect(primaryHint).toBe("site");
    expect(suggested[0]?.attribute).toBe("site");
    expect(suggested[0]?.hintSource).toBe("computed");
  });

  it("includes valid columns in suggested ahead of low-cardinality fields", () => {
    const layer: GeostatsLayer = {
      ...kelpSiteLayer,
      count: 3,
      attributes: [
        {
          attribute: "site_id",
          type: "string",
          count: 3,
          countDistinct: 3,
          values: { A: 1, B: 1, C: 1 },
        },
        kelpSiteLayer.attributes[1],
      ],
    };
    const { suggested } = partitionOverlayJoinColumnOptions(layer);
    expect(suggested.map((option) => option.attribute)).toContain("site_id");
    expect(suggested.find((option) => option.attribute === "site_id")?.status)
      .toBe("valid");
  });
});
