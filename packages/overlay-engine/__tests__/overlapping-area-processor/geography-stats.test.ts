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
import { DebuggingFgbWriter } from "../../src/utils/debuggingFgbWriter";
import {
  OverlayWorkerHelpers,
  OverlayWorkerLogFeatureLayerConfig,
} from "../../src/utils/helpers";
import { compareResults } from "./compareResults";
import simplify from "@turf/simplify";

// const writer = new DebuggingFgbWriter("./classified-features.fgb", [
//   { name: "classification", type: "string" },
//   { name: "groupBy", type: "string" },
// ]);

const helpers: OverlayWorkerHelpers = {
  // logFeature: (
  //   layer: OverlayWorkerLogFeatureLayerConfig,
  //   feature: Feature<any>
  // ) => {
  //   if (layer.name !== "classified-features") {
  //     return;
  //   }
  //   writer.addFeature(feature);
  // },
};

const metrics = require("./precalc.json");
const geomorphologyMetrics = require("./precalcGeomorphACA.json");
const geomorphologyResults: { [key: string]: number } = { "*": 0 };
for (const metric of geomorphologyMetrics) {
  geomorphologyResults[metric.classId] = metric.value / 1_000_000;
  geomorphologyResults["*"] += metric.value / 1_000_000;
}

const deepwaterBioregionsResults: { [key: string]: number } = { "*": 0 };
for (const metric of metrics.filter(
  (m: any) =>
    m.classId.startsWith("deepwater_bioregions-") &&
    m.metricId === "area" &&
    m.geographyId === "eez" &&
    m.classId !== "deepwater_bioregions-total"
)) {
  const classKey = metric.classId.split("deepwater_bioregions-")[1];
  const value = metric.value / 1_000_000;
  deepwaterBioregionsResults[classKey] = value;
  deepwaterBioregionsResults["*"] += value;
}

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
        source: "https://uploads.seasketch.org/testing-eez.fgb",
        op: "INTERSECT",
      },
      {
        cql2Query: null,
        source: "https://uploads.seasketch.org/testing-land.fgb",
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
      const source = await sourceCache.get<Feature<MultiPolygon>>(
        "https://uploads.seasketch.org/testing-geomorphic-2.fgb",
        {
          pageSize: "5MB",
        }
      );
      const pool = createClippingWorkerPool(
        __dirname + "/../../dist/workers/clipBatch.standalone.js"
      );
      const processor = new OverlappingAreaBatchedClippingProcessor(
        "overlay_area",
        1024 * 1024 * 2, // 5MB
        simplify(intersectionFeatureGeojson, {
          tolerance: 0.002,
        }),
        source,
        differenceSources,
        undefined,
        "class",
        pool
      );
      const results = await processor.calculate();
      compareResults(
        results,
        geomorphologyResults,
        0.015,
        {
          // Reef flats are near to shore, and the tests are using a higher
          // resolution shoreline than legacy reports so we expect higher amounts
          // of the habitat to be present. The rough shoreline of the production
          // reports cuts a lot out.
          "Terrestrial Reef Flat": 0.055,
          "Outer Reef Flat": 0.03,
          "*": 0.02,
        },
        true
      );
    });

    it("Deepwater Bioregions", async () => {
      const {
        intersectionFeature: intersectionFeatureGeojson,
        differenceSources,
      } = await initializeGeographySources(FIJI_EEZ, sourceCache, undefined, {
        pageSize: "5MB",
      });
      const source = await sourceCache.get<Feature<MultiPolygon>>(
        "https://uploads.seasketch.org/testing-deepwater-bioregions-2.fgb",
        {
          pageSize: "5MB",
        }
      );
      const pool = createClippingWorkerPool(
        __dirname + "/../../dist/workers/clipBatch.standalone.js"
      );
      const processor = new OverlappingAreaBatchedClippingProcessor(
        "overlay_area",
        1024 * 1024 * 2, // 5MB
        simplify(intersectionFeatureGeojson, {
          tolerance: 0.002,
        }),
        source,
        differenceSources,
        helpers,
        "Draft_name",
        pool
      );
      const results = await processor.calculate();
      compareResults(
        results,
        deepwaterBioregionsResults,
        0.005,
        undefined,
        true
      );
    });
  });
  // afterAll(() => {
  //   writer.close();
  // });
});
