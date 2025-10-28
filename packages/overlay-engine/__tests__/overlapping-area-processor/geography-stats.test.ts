import { vi } from "vitest";
import { makeFetchRangeFn } from "../../scripts/optimizedFetchRangeFn";
import { SourceCache } from "fgb-source";
import {
  ClippingLayerOption,
  initializeGeographySources,
} from "../../src/geographies/geographies";
import { Feature, MultiPolygon } from "geojson";
import {
  OverlappingAreaBatchedClippingProcessor,
  createClippingWorkerPool,
} from "../../src/OverlappingAreaBatchedClippingProcessor";

const metrics = require("./precalc.json");
const geomorphologyMetrics = require("./precalcGeomorphACA.json");

describe("OverlappingAreaBatchedClippingProcessor - Geography Test Cases", () => {
  vi.setConfig({ testTimeout: 1000000 });

  const { fetchRangeFn, cacheHits, cacheMisses } = makeFetchRangeFn(
    `https://uploads.seasketch.org`,
    1000 * 1024 * 128
  );

  const sourceCache = new SourceCache("1GB", {
    fetchRangeFn,
  });

  describe("Fiji", () => {
    const FIJI_EEZ = [
      {
        cql2Query: {
          op: "=",
          args: [
            {
              property: "MRGID_EEZ",
            },
            8325,
          ],
        },
        source:
          "https://uploads.seasketch.org/projects/superuser/public/04620ab4-5550-4858-b827-9ef41539376b.fgb",
        op: "INTERSECT",
      },
      {
        cql2Query: null,
        source:
          "https://uploads.seasketch.org/projects/superuser/public/5dee67d7-83ea-4755-be22-afefc22cbee3.fgb",
        op: "DIFFERENCE",
        headerSizeHint: 38500000,
      },
    ] as ClippingLayerOption[];

    it("ACA Geomorphic Stats", async () => {
      const {
        intersectionFeature: intersectionFeatureGeojson,
        differenceSources,
      } = await initializeGeographySources(FIJI_EEZ, sourceCache, undefined, {
        pageSize: "5MB",
      });
      console.log("created intersection feature");
      const source = await sourceCache.get<Feature<MultiPolygon>>(
        "https://uploads.seasketch.org/projects/fiji/subdivided/123-2791aa46-9583-4268-a360-91dd1cee71c5.fgb",
        {
          pageSize: "5MB",
        }
      );
      console.log("initialized source");
      const pool = createClippingWorkerPool(
        __dirname + "/../../dist/workers/clipBatch.standalone.js"
      );
      const processor = new OverlappingAreaBatchedClippingProcessor(
        1024 * 1024 * 2, // 5MB
        intersectionFeatureGeojson,
        source,
        differenceSources,
        undefined,
        "class",
        pool
      );
      console.log("calculating");
      const results = await processor.calculateOverlap();
      // console.log("results", results);
      expect(true).toBe(true);
      let sum = 0;
      for (const metric of geomorphologyMetrics) {
        const classKey = metric.classId;
        const sqKm = metric.value / 1_000_000;
        let acceptableDifferenceRatio =
          classKey === "Terrestrial Reef Flat" ? 0.1 : 0.025;
        sum += sqKm;
        expect(Object.keys(results)).toContain(classKey);
        expect(results[classKey]).toBeLessThan(
          sqKm * (1 + acceptableDifferenceRatio)
        );
        expect(results[classKey]).toBeGreaterThan(
          sqKm * (1 - acceptableDifferenceRatio)
        );
        console.log(
          `${classKey} differed by ${results[classKey] > sqKm ? "+" : "-"}${
            Math.round(((results[classKey] - sqKm) / sqKm) * 1000) / 10
          }%`
        );
      }
      const acceptableDifferenceRatio = 0.02;
      expect(results["*"]).toBeLessThan(sum * (1 + acceptableDifferenceRatio));
      expect(results["*"]).toBeGreaterThan(
        sum * (1 - acceptableDifferenceRatio)
      );
      console.log(
        `total differed by ${results["*"] > sum ? "+" : "-"}${
          Math.round(((results["*"] - sum) / sum) * 1000) / 10
        }%`
      );
      console.log(
        `total expected: ${sum} km^2, results: ${
          results["*"]
        } km^2. Difference percentage: ${
          Math.round(((results["*"] - sum) / sum) * 1000) / 10
        }%`
      );
    });
  });
});
