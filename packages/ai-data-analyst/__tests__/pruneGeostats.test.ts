import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pruneGeostats } from "../lib/geostats/shrinkGeostats";

type GeostatsFixture = {
  filename: string;
  geostats: unknown;
};

function loadFixture(name: string): GeostatsFixture {
  return JSON.parse(
    readFileSync(join(process.cwd(), "__tests__", "geostats", name), "utf8"),
  ) as GeostatsFixture;
}

describe("pruneGeostats", () => {
  it("substantially shrinks deepwater-bioregions fixture", () => {
    const fixture = loadFixture("deepwater-bioregions.json");
    const originalJson = JSON.stringify(fixture.geostats);
    const shrunk = pruneGeostats(fixture.geostats);
    const shrunkJson = JSON.stringify(shrunk);

    expect(shrunkJson.length).toBeLessThan(originalJson.length);
    expect(shrunkJson.length / originalJson.length).toBeLessThan(0.3);

    const layer = shrunk as {
      attributes?: Array<{ values?: Record<string, number> }>;
    };
    expect(Array.isArray(layer.attributes)).toBe(true);
    expect(
      Object.keys(layer.attributes?.[0]?.values ?? {}).length,
    ).toBeLessThanOrEqual(64);
  });

  it("substantially shrinks shoretypes fixture", () => {
    const fixture = loadFixture("shoretypes.json");
    const originalJson = JSON.stringify(fixture.geostats);
    const shrunk = pruneGeostats(fixture.geostats);
    const shrunkJson = JSON.stringify(shrunk);

    expect(shrunkJson.length).toBeLessThan(originalJson.length);
    expect(shrunkJson.length / originalJson.length).toBeLessThan(0.2);

    const layer = shrunk as {
      attributes?: Array<{ values?: Record<string, number> }>;
    };
    expect(Array.isArray(layer.attributes)).toBe(true);
    expect(
      Object.keys(layer.attributes?.[0]?.values ?? {}).length,
    ).toBeLessThanOrEqual(64);
  });

  it("keeps string values up to 64 keys and omits high-cardinality numeric value maps with valuesTruncated", () => {
    const geostats = {
      layer: "test",
      count: 100,
      geometry: "Polygon",
      attributeCount: 2,
      attributes: [
        {
          attribute: "category",
          type: "string",
          count: 100,
          countDistinct: 32,
          values: Object.fromEntries(
            Array.from({ length: 32 }, (_, i) => [`cat-${i}`, i + 1]),
          ),
        },
        {
          attribute: "depth",
          type: "number",
          count: 100,
          countDistinct: 200,
          min: 1,
          max: 10,
          values: Object.fromEntries(
            Array.from({ length: 200 }, (_, i) => [`${i / 20}`, 1]),
          ),
          stats: {
            avg: 5.5,
            naturalBreaks: {
              "3": [
                [1, 33],
                [4, 33],
                [7, 34],
                [10, null],
              ],
            },
          },
        },
      ],
    };

    const pruned = pruneGeostats(geostats) as {
      attributes: Array<{
        values?: Record<string, number>;
        stats?: { naturalBreakBucketCounts?: Record<string, number> };
      }>;
    };

    expect(Object.keys(pruned.attributes[0].values ?? {}).length).toBe(32);
    expect(pruned.attributes[0].valuesTruncated).toBeUndefined();
    expect(Object.keys(pruned.attributes[1].values ?? {}).length).toBe(0);
    expect(pruned.attributes[1].valuesTruncated).toBe(true);
    expect(pruned.attributes[1].stats?.naturalBreakBucketCounts?.["3"]).toBe(4);
  });

  it("caps low-cardinality numeric value keys at 8 and sets valuesTruncated", () => {
    const geostats = {
      layer: "test",
      geometry: "Point",
      attributes: [
        {
          attribute: "score",
          type: "number",
          count: 50,
          countDistinct: 20,
          min: 0,
          max: 19,
          values: Object.fromEntries(
            Array.from({ length: 20 }, (_, i) => [`${i}`, 2]),
          ),
        },
      ],
    };
    const pruned = pruneGeostats(geostats) as {
      attributes: Array<{
        values?: Record<string, number>;
        valuesTruncated?: boolean;
      }>;
    };
    expect(Object.keys(pruned.attributes[0].values ?? {}).length).toBe(8);
    expect(pruned.attributes[0].valuesTruncated).toBe(true);
  });

  it("caps string attribute value keys at 64 and sets valuesTruncated", () => {
    const geostats = {
      layer: "lots",
      count: 10_000,
      geometry: "Point",
      attributes: [
        {
          attribute: "name",
          type: "string",
          count: 10_000,
          countDistinct: 200,
          values: Object.fromEntries(
            Array.from({ length: 1200 }, (_, i) => [`v-${i}`, 1]),
          ),
        },
      ],
    };
    const pruned = pruneGeostats(geostats) as {
      attributes: Array<{
        values?: Record<string, number>;
        valuesTruncated?: boolean;
      }>;
    };
    expect(Object.keys(pruned.attributes[0].values ?? {}).length).toBe(64);
    expect(pruned.attributes[0].valuesTruncated).toBe(true);
  });

  it("normalizes numeric raster enum presentation to a string label", () => {
    const fixture = loadFixture("gfw2024.json");
    const pruned = pruneGeostats(fixture.geostats) as {
      presentation?: string;
      bands?: unknown[];
    };

    expect(pruned.presentation).toBe("continuous");
    expect(Array.isArray(pruned.bands)).toBe(true);
  });
});
