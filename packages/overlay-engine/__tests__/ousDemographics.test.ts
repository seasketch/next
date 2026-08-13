import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import booleanIntersects from "@turf/boolean-intersects";
import bbox from "@turf/bbox";
import * as clipping from "polyclip-ts";
import { createSource } from "fgb-source";
import {
  OusDemographicsAggregator,
  calculateOusDemographics,
} from "../src/metrics/ousDemographics";
import {
  OusDemographicsMetricValue,
  combineMetricsForFragments,
  combineOusDemographicsMetrics,
  summarizeOusDemographicsValue,
} from "../src/metrics/metrics";

const FIXTURES_DIR = path.join(__dirname, "fixtures", "ous-demographics");

function loadFixture<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, filename), "utf8"));
}

const sketch = loadFixture<Feature<Polygon>>("sketch.geojson");
const sectorsFixture = loadFixture<FeatureCollection>("sectors.geojson");
const gearsFixture = loadFixture<FeatureCollection>(
  "gears-exploded.geojson",
);

/**
 * Reference aggregation using plain booleanIntersects, matching the legacy
 * geoprocessing function's overlap test. Used both to assert the PDF values
 * and as a baseline for calculateOusDemographics (ContainerIndex path).
 */
function aggregateWithBooleanIntersects(
  features: Feature[],
  subject: Feature<Polygon | MultiPolygon>,
  groupBy: string,
): OusDemographicsMetricValue {
  const aggregator = new OusDemographicsAggregator(groupBy);
  for (const feature of features) {
    aggregator.addFeature(
      feature.properties,
      booleanIntersects(feature, subject),
    );
  }
  return aggregator.result();
}

/**
 * Expected values transcribed from a legacy geoprocessing report.
 * [within plan, total represented in survey]
 *
 * Two deliberate deviations in the Total column, both traced to the PDF
 * having been generated from an earlier vintage of the survey export (the
 * same drift that required the separate exploded gears dataset):
 *
 * - Waste Management: PDF says 16; this export yields 40 under every
 *   aggregation rule (9 respondents, clamped values 1+1+2+4+7+3+10+2+10).
 * - Mining: PDF says 94; this export has 96 Mining respondents each with
 *   represented_in_sector = 1, so no rule can produce 94.
 *
 * Every within-plan value and all other totals match the PDF exactly.
 */
const PDF_SECTOR_TABLE: { [sector: string]: [number, number] } = {
  Fishing: [111, 281],
  "Maritime Transportation": [71, 119],
  "Cultural Use": [16, 75],
  "Recreation & Tourism": [31, 56],
  "Waste Management": [4, 40],
  Mining: [34, 96],
  "Research & Conservation": [17, 36],
  "Development & Infrastructure": [5, 16],
  "Aquaculture & Mariculture": [10, 12],
};

const PDF_GEAR_TABLE: { [gear: string]: [number, number] } = {
  Trolling: [58, 104],
  "Bottom Longline": [20, 27],
  Dropline: [46, 65],
  "Traditional Fish Drive": [29, 32],
  "Gill Nets": [44, 176],
  "Underwater Breathing Apparatus": [6, 11],
  Handline: [76, 242],
  Spear: [37, 98],
  Gleaning: [26, 114],
  Other: [32, 60],
  "Deep Sea": [4, 10],
  "Pole and Line": [7, 29],
  "Drifting Longline": [5, 5],
  Traps: [7, 10],
};

/**
 * Village table uses participants for the Total column ("Total People
 * Represented In Survey" = sum of response-level participants, once per
 * respondent). [within plan (represented, lower bound), total participants]
 */
const PDF_VILLAGE_TABLE: { [village: string]: [number, number] } = {
  Lausake: [39, 61],
  Marow: [31, 110],
  Wiana: [22, 30],
  Ngurua: [46, 76],
  Mapua: [17, 57],
  Mangarongo: [0, 69],
};

describe("OusDemographicsAggregator", () => {
  it("clamps per-respondent values to participants", () => {
    const aggregator = new OusDemographicsAggregator("sector");
    // Respondent 1: two Fishing shapes claiming 30 people each, but the
    // response only represents 20 people in total.
    aggregator.addFeature(
      {
        response_id: "1",
        participants: 20,
        represented_in_sector: 30,
        sector: "Fishing",
      },
      true,
    );
    aggregator.addFeature(
      {
        response_id: "1",
        participants: 20,
        represented_in_sector: 30,
        sector: "Fishing",
      },
      true,
    );
    const value = aggregator.result();
    expect(value.groups.Fishing["1"]).toEqual({
      representedInSector: 20,
      participants: 20,
    });
    expect(value.totals.Fishing).toEqual({
      representedInSector: 20,
      participants: 20,
      respondents: 1,
    });
  });

  it("takes the max represented_in_sector across a respondent's shapes, not the sum", () => {
    const aggregator = new OusDemographicsAggregator("sector");
    aggregator.addFeature(
      {
        response_id: "1",
        participants: 20,
        represented_in_sector: 5,
        sector: "Fishing",
      },
      true,
    );
    aggregator.addFeature(
      {
        response_id: "1",
        participants: 20,
        represented_in_sector: 12,
        sector: "Fishing",
      },
      true,
    );
    const value = aggregator.result();
    expect(value.groups.Fishing["1"].representedInSector).toBe(12);
  });

  it("computes a respondent-level rollup under '*'", () => {
    const aggregator = new OusDemographicsAggregator("sector");
    aggregator.addFeature(
      {
        response_id: "1",
        participants: 20,
        represented_in_sector: 5,
        sector: "Fishing",
      },
      true,
    );
    aggregator.addFeature(
      {
        response_id: "1",
        participants: 20,
        represented_in_sector: 12,
        sector: "Mining",
      },
      false,
    );
    const value = aggregator.result();
    // Within plan: only the Fishing shape intersected.
    expect(value.groups["*"]["1"].representedInSector).toBe(5);
    // Dataset totals consider all shapes: max(5, 12) clamped to 20.
    expect(value.totals["*"]).toEqual({
      representedInSector: 12,
      participants: 20,
      respondents: 1,
    });
    expect(value.groups.Mining).toBeUndefined();
    expect(value.totals.Mining.respondents).toBe(1);
  });

  it("skips shapes missing required values, and errors when nothing is usable", () => {
    const aggregator = new OusDemographicsAggregator("sector");
    aggregator.addFeature(
      {
        response_id: "1",
        participants: 10,
        represented_in_sector: 4,
        sector: "Fishing",
      },
      true,
    );
    aggregator.addFeature(
      {
        response_id: null,
        participants: 10,
        represented_in_sector: 4,
        sector: "Fishing",
      },
      true,
    );
    aggregator.addFeature(
      {
        response_id: "2",
        participants: "not a number",
        represented_in_sector: 4,
        sector: "Fishing",
      },
      true,
    );
    expect(aggregator.skippedFeatureCount).toBe(2);
    const value = aggregator.result();
    expect(value.totals.Fishing.respondents).toBe(1);

    const empty = new OusDemographicsAggregator("sector");
    empty.addFeature({ name: "no ous columns here" }, true);
    expect(() => empty.result()).toThrow(/requires columns/);
  });

  it("errors when the groupBy column is absent from the source", () => {
    const aggregator = new OusDemographicsAggregator("village");
    aggregator.addFeature(
      {
        response_id: "1",
        participants: 10,
        represented_in_sector: 4,
        sector: "Fishing",
      },
      true,
    );
    expect(() => aggregator.result()).toThrow(/village/);
  });

  it("counts shapes without a groupBy value toward the rollup only", () => {
    const aggregator = new OusDemographicsAggregator("sector");
    aggregator.addFeature(
      {
        response_id: "1",
        participants: 10,
        represented_in_sector: 4,
        sector: null,
      },
      true,
    );
    aggregator.addFeature(
      {
        response_id: "2",
        participants: 6,
        represented_in_sector: 2,
        sector: "Fishing",
      },
      true,
    );
    const value = aggregator.result();
    expect(Object.keys(value.groups).sort()).toEqual(["*", "Fishing"]);
    expect(value.totals["*"].respondents).toBe(2);
  });

  it("rejects '*' as a groupBy column", () => {
    expect(() => new OusDemographicsAggregator("*")).toThrow(/reserved/);
  });
});

describe("combineOusDemographicsMetrics", () => {
  it("dedupes respondents across fragments by taking the max", () => {
    const fragmentA: OusDemographicsMetricValue = {
      groups: {
        Fishing: { "1": { representedInSector: 5, participants: 20 } },
        "*": { "1": { representedInSector: 5, participants: 20 } },
      },
      totals: {
        Fishing: { representedInSector: 12, participants: 20, respondents: 1 },
        "*": { representedInSector: 12, participants: 20, respondents: 1 },
      },
    };
    const fragmentB: OusDemographicsMetricValue = {
      groups: {
        Fishing: {
          "1": { representedInSector: 12, participants: 20 },
          "2": { representedInSector: 3, participants: 3 },
        },
        "*": {
          "1": { representedInSector: 12, participants: 20 },
          "2": { representedInSector: 3, participants: 3 },
        },
      },
      totals: fragmentA.totals,
    };
    const combined = combineOusDemographicsMetrics([fragmentA, fragmentB]);
    expect(combined.groups.Fishing["1"].representedInSector).toBe(12);
    expect(combined.groups.Fishing["2"].representedInSector).toBe(3);
    const summary = summarizeOusDemographicsValue(combined);
    expect(summary.Fishing.representedInSector).toBe(15);
    expect(summary.Fishing.respondents).toBe(2);
    // totals ride along unchanged
    expect(combined.totals).toEqual(fragmentA.totals);
  });

  it("is dispatched by combineMetricsForFragments, including the empty case", () => {
    const empty = combineMetricsForFragments([], "ous_demographics");
    expect(empty).toEqual({
      type: "ous_demographics",
      value: { groups: {}, totals: {} },
    });

    const value: OusDemographicsMetricValue = {
      groups: {
        "*": { "1": { representedInSector: 5, participants: 20 } },
      },
      totals: {
        "*": { representedInSector: 5, participants: 20, respondents: 1 },
      },
    };
    const combined = combineMetricsForFragments([
      { type: "ous_demographics", value },
      { type: "ous_demographics", value },
    ]);
    expect(combined.type).toBe("ous_demographics");
    expect(
      (combined.value as OusDemographicsMetricValue).groups["*"]["1"]
        .representedInSector,
    ).toBe(5);
  });
});

describe("fixtures match the legacy geoprocessing PDF", () => {
  it("reproduces the sector table (groupBy: sector)", () => {
    const value = aggregateWithBooleanIntersects(
      sectorsFixture.features,
      sketch,
      "sector",
    );
    const summary = summarizeOusDemographicsValue(value);
    for (const sector of Object.keys(PDF_SECTOR_TABLE)) {
      const [within, total] = PDF_SECTOR_TABLE[sector];
      expect(summary[sector]?.representedInSector, sector).toBe(within);
      expect(value.totals[sector]?.representedInSector, sector).toBe(total);
    }
    // No unexpected sectors beyond the rollup.
    expect(Object.keys(value.totals).sort()).toEqual(
      [...Object.keys(PDF_SECTOR_TABLE), "*"].sort(),
    );
  });

  it("reproduces the fishing method table (exploded source, groupBy: gear_type)", () => {
    const value = aggregateWithBooleanIntersects(
      gearsFixture.features,
      sketch,
      "gear_type",
    );
    const summary = summarizeOusDemographicsValue(value);
    for (const gear of Object.keys(PDF_GEAR_TABLE)) {
      const [within, total] = PDF_GEAR_TABLE[gear];
      expect(summary[gear]?.representedInSector, gear).toBe(within);
      expect(value.totals[gear]?.representedInSector, gear).toBe(total);
    }
    expect(Object.keys(value.totals).sort()).toEqual(
      [...Object.keys(PDF_GEAR_TABLE), "*"].sort(),
    );
  });

  it("reproduces the village table (groupBy: village, participants totals)", () => {
    const value = aggregateWithBooleanIntersects(
      sectorsFixture.features,
      sketch,
      "village",
    );
    const summary = summarizeOusDemographicsValue(value);
    for (const village of Object.keys(PDF_VILLAGE_TABLE)) {
      const [within, totalParticipants] = PDF_VILLAGE_TABLE[village];
      expect(
        summary[village]?.representedInSector ?? 0,
        village,
      ).toBe(within);
      expect(value.totals[village]?.participants, village).toBe(
        totalParticipants,
      );
    }
    // Mangarongo has no within-plan respondents but still appears in totals,
    // which is what report widgets key rows off of.
    expect(value.groups.Mangarongo).toBeUndefined();
    expect(value.totals.Mangarongo.respondents).toBeGreaterThan(0);
  });
});

describe("fragment splitting", () => {
  it("combining split-sketch fragments equals the unsplit result", () => {
    const [minX, minY, maxX, maxY] = bbox(sketch);
    const midX = (minX + maxX) / 2;
    const halves: Feature<Polygon | MultiPolygon>[] = [
      [minX - 0.1, minY - 0.1, midX, maxY + 0.1],
      [midX, minY - 0.1, maxX + 0.1, maxY + 0.1],
    ].map(([x1, y1, x2, y2]) => {
      const box: clipping.Geom = [
        [
          [
            [x1, y1],
            [x2, y1],
            [x2, y2],
            [x1, y2],
            [x1, y1],
          ],
        ],
      ];
      const geom = clipping.intersection(
        [sketch.geometry.coordinates] as clipping.Geom,
        box,
      );
      return {
        type: "Feature",
        properties: {},
        geometry: { type: "MultiPolygon", coordinates: geom },
      } as Feature<MultiPolygon>;
    });

    const whole = aggregateWithBooleanIntersects(
      sectorsFixture.features,
      sketch,
      "sector",
    );
    const fragmentValues = halves.map((half) =>
      aggregateWithBooleanIntersects(sectorsFixture.features, half, "sector"),
    );
    const combined = combineOusDemographicsMetrics(fragmentValues);

    // Survey shapes crossing the split boundary appear in both fragments;
    // combining must not double count them.
    expect(summarizeOusDemographicsValue(combined)).toEqual(
      summarizeOusDemographicsValue(whole),
    );
    expect(combined.totals).toEqual(whole.totals);

    // Sanity check that the split was meaningful: both fragments saw shapes.
    for (const fragmentValue of fragmentValues) {
      expect(Object.keys(fragmentValue.groups).length).toBeGreaterThan(0);
    }
  });
});

describe("calculateOusDemographics (full FlatGeobuf path)", () => {
  async function localSource(filename: string) {
    const filePath = path.join(FIXTURES_DIR, filename);
    return createSource(filePath, {
      fetchRangeFn: async (key, [start, end]) => {
        const buffer = fs.readFileSync(key);
        const slice = buffer.subarray(
          start,
          end === null ? undefined : end + 1,
        );
        return slice.buffer.slice(
          slice.byteOffset,
          slice.byteOffset + slice.byteLength,
        );
      },
    });
  }

  it("matches the PDF sector table using ContainerIndex classification", async () => {
    const source = await localSource("sectors.fgb");
    const value = await calculateOusDemographics(sketch, source, {
      groupBy: "sector",
    });
    const summary = summarizeOusDemographicsValue(value);
    for (const sector of Object.keys(PDF_SECTOR_TABLE)) {
      const [within, total] = PDF_SECTOR_TABLE[sector];
      expect(summary[sector]?.representedInSector, sector).toBe(within);
      expect(value.totals[sector]?.representedInSector, sector).toBe(total);
    }
  });

  it("matches the PDF fishing method table", async () => {
    const source = await localSource("gears-exploded.fgb");
    const value = await calculateOusDemographics(sketch, source, {
      groupBy: "gear_type",
    });
    const summary = summarizeOusDemographicsValue(value);
    for (const gear of Object.keys(PDF_GEAR_TABLE)) {
      const [within, total] = PDF_GEAR_TABLE[gear];
      expect(summary[gear]?.representedInSector, gear).toBe(within);
      expect(value.totals[gear]?.representedInSector, gear).toBe(total);
    }
  });

  it("matches the PDF village table", async () => {
    const source = await localSource("sectors.fgb");
    const value = await calculateOusDemographics(sketch, source, {
      groupBy: "village",
    });
    const summary = summarizeOusDemographicsValue(value);
    for (const village of Object.keys(PDF_VILLAGE_TABLE)) {
      const [within, totalParticipants] = PDF_VILLAGE_TABLE[village];
      expect(
        summary[village]?.representedInSector ?? 0,
        village,
      ).toBe(within);
      expect(value.totals[village]?.participants, village).toBe(
        totalParticipants,
      );
    }
  });

  it("throws a descriptive error for sources missing required columns", async () => {
    const source = await localSource("sectors.fgb");
    await expect(
      calculateOusDemographics(sketch, source, { groupBy: "gear_type" }),
    ).rejects.toThrow(/gear_type/);
  });
});
