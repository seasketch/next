import { Feature, MultiPolygon, Polygon } from "geojson";
import {
  clipToGeography,
  clipSketchToPolygons,
  ClippingFn,
  ClippingLayerOption,
} from "../src/geographies/geographies";
import { SourceCache } from "fgb-source";
import { prepareSketch } from "../src/utils/prepareSketch";
import { describe, it, expect, beforeAll } from "vitest";
import { hawaiiTestFeatures } from "./test-features";
import { createFragments } from "../src/fragments";
import { vi } from "vitest";

const eezUrl = "https://uploads.seasketch.org/eez-land-joined.fgb";
const territorialSeaUrl =
  "https://uploads.seasketch.org/territorial-sea-land-joined.fgb";

// Geography configurations
const hawaiiTerritorialSea: ClippingLayerOption[] = [
  {
    source: territorialSeaUrl,
    op: "INTERSECT",
    cql2Query: { op: "=", args: [{ property: "UNION" }, "Hawaii"] },
  },
];

const hawaiiOffshore: ClippingLayerOption[] = [
  {
    source: eezUrl,
    op: "INTERSECT",
    cql2Query: { op: "=", args: [{ property: "UNION" }, "Hawaii"] },
  },
  {
    source: territorialSeaUrl,
    op: "DIFFERENCE",
  },
];

// Helper function to measure performance
async function measurePerformance<T>(
  operation: () => Promise<T>,
  iterations: number = 10
): Promise<{ result: T; averageTime: number }> {
  const times: number[] = [];
  let result: T;

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();
    result = await operation();
    const endTime = performance.now();
    times.push(endTime - startTime);
  }

  const averageTime = times.reduce((sum, time) => sum + time, 0) / iterations;
  return { result: result!, averageTime };
}

describe("Performance tests", () => {
  let sourceCache: SourceCache;
  let clippingFn: ClippingFn;

  vi.setConfig({ testTimeout: 1000 * 12 });

  beforeAll(() => {
    sourceCache = new SourceCache("256mb");
    clippingFn = async (sketch, source, op, query) => {
      const fgbSource = await sourceCache.get<Feature<MultiPolygon | Polygon>>(
        source
      );
      return clipSketchToPolygons(
        sketch,
        op,
        query,
        fgbSource.getFeaturesAsync(sketch.envelopes)
      );
    };
  });

  describe("clipToGeography", () => {
    it("should maintain performance for territorial sea clipping", async () => {
      const preparedSketch = prepareSketch(
        hawaiiTestFeatures.clipToTerritorialSea
      );

      const { result, averageTime } = await measurePerformance(() =>
        clipToGeography(preparedSketch, hawaiiTerritorialSea, clippingFn)
      );

      // Fail if the operation takes more than 800ms on average
      expect(averageTime).toBeLessThan(800);
      expect(result).not.toBeNull();
    });

    it("should maintain performance for offshore clipping", async () => {
      const preparedSketch = prepareSketch(hawaiiTestFeatures.clipToEez);

      const { result, averageTime } = await measurePerformance(() =>
        clipToGeography(preparedSketch, hawaiiOffshore, clippingFn)
      );

      // Fail if the operation takes more than 800ms on average
      expect(averageTime).toBeLessThan(800);
      expect(result).not.toBeNull();
    });
  });

  describe("createFragments", () => {
    it("should maintain performance for fragment creation", async () => {
      const preparedSketch = prepareSketch(hawaiiTestFeatures.clipToEez);
      const geographies = [
        {
          id: 1,
          name: "Territorial Sea",
          clippingLayers: hawaiiTerritorialSea,
        },
        {
          id: 2,
          name: "Offshore",
          clippingLayers: hawaiiOffshore,
        },
      ];

      const { result, averageTime } = await measurePerformance(() =>
        createFragments(preparedSketch, geographies, clippingFn)
      );

      // Fail if the operation takes more than 500ms on average
      expect(averageTime).toBeLessThan(500);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
