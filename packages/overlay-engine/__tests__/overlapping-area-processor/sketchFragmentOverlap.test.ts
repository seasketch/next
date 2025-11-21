import { vi } from "vitest";
import { makeFetchRangeFn } from "../../scripts/optimizedFetchRangeFn";
import { SourceCache } from "fgb-source";
import {
  ClippingFn,
  ClippingLayerOption,
  clipSketchToPolygons,
  initializeGeographySources,
} from "../../src/geographies/geographies";
import { Feature, MultiPolygon, Polygon } from "geojson";
import {
  OverlayEngineBatchProcessor,
  createClippingWorkerPool,
} from "../../src/OverlayEngineBatchProcessor";
import { DebuggingFgbWriter } from "../../src/utils/debuggingFgbWriter";
import {
  OverlayWorkerHelpers,
  OverlayWorkerLogFeatureLayerConfig,
} from "../../src/utils/helpers";
import { createFragments, GeographySettings } from "../../src/fragments";
import { prepareSketch } from "../../src/utils/prepareSketch";
import { compareResults } from "./compareResults";
import { WorkerPool } from "../../src/workers/pool";
import simplify from "@turf/simplify";
import { calculateRasterStats } from "../../src/rasterStats";
import { reprojectFeatureTo6933 } from "../../src/utils/reproject";

const insideBioregion = require("./sketches/Inside-bioregion-2.geojson.json");

const naitaba = require("./sketches/Naitaba.geojson.json");
const naitabaGeomorphologyMetrics = require("./sketches/GeomorphACA__Naitaba__2025-10-29T21_42_30Z.json");
const naitabaGeomorphologyResults: { [key: string]: number } = { "*": 0 };
for (const metric of naitabaGeomorphologyMetrics) {
  naitabaGeomorphologyResults[metric.classId] = metric.value / 1_000_000;
  naitabaGeomorphologyResults["*"] += metric.value / 1_000_000;
}
const ventsSketch = require("./sketches/Hydrothermal-vents.geojson.json");

describe("sketchFragmentOverlap", () => {
  vi.setConfig({ testTimeout: 1000 * 10 });

  describe("Fiji", () => {
    const { fetchRangeFn, cacheHits, cacheMisses } = makeFetchRangeFn(
      `https://uploads.seasketch.org`,
      1000 * 1024 * 128
    );

    const FIJI_EEZ: GeographySettings = {
      id: 1,
      clippingLayers: [
        {
          source: "https://uploads.seasketch.org/testing-eez.fgb",
          op: "INTERSECT",
          cql2Query: { op: "=", args: [{ property: "UNION" }, "Fiji"] },
        },
        {
          source: "https://uploads.seasketch.org/testing-land.fgb",
          op: "DIFFERENCE",
        },
      ],
    };

    let sourceCache: SourceCache;
    let clippingFn: ClippingFn;
    let pool: WorkerPool<any, any>;

    beforeAll(async () => {
      sourceCache = new SourceCache("256mb");
      clippingFn = async (sketch, source, op, query) => {
        const fgbSource = await sourceCache.get<
          Feature<MultiPolygon | Polygon>
        >(source, {
          fetchRangeFn,
        });
        const overlappingFeatures = fgbSource.getFeaturesAsync(
          sketch.envelopes
        );
        return clipSketchToPolygons(sketch, op, query, overlappingFeatures);
      };
      pool = createClippingWorkerPool(
        __dirname + "/../../dist/workers/clipBatch.standalone.js"
      );
    });

    describe("Naitaba", () => {
      let writer: DebuggingFgbWriter;
      let bboxWriter: DebuggingFgbWriter;
      let helpers: OverlayWorkerHelpers;
      let subjectWriter: DebuggingFgbWriter;

      beforeAll(async () => {
        writer = new DebuggingFgbWriter(
          __dirname + "/../outputs/naitaba-classified-features.fgb",
          [
            { name: "classification", type: "string" },
            { name: "groupBy", type: "string" },
          ]
        );
        bboxWriter = new DebuggingFgbWriter(
          __dirname + "/../outputs/naitaba-bbox-features.fgb",
          [{ name: "id", type: "integer" }]
        );
        subjectWriter = new DebuggingFgbWriter(
          __dirname + "/../outputs/naitaba-subject-feature.fgb",
          []
        );
        helpers = {
          logFeature: (
            layer: OverlayWorkerLogFeatureLayerConfig,
            feature: Feature<any>
          ) => {
            switch (layer.name) {
              case "classified-features":
                writer.addFeature(feature);
                break;
              case "container-index-boxes":
                bboxWriter.addFeature(feature);
                break;
              case "subject-feature":
                subjectWriter.addFeature(feature);
                break;
            }
          },
        };
      });

      afterAll(async () => {
        await writer.close();
        await bboxWriter.close();
        await subjectWriter.close();
      });

      it("Should generate a single fragment", async () => {
        const prepared = prepareSketch(naitaba);
        const fragments = await createFragments(
          prepared,
          [FIJI_EEZ],
          clippingFn
        );
        expect(fragments).toHaveLength(1);
      });
      it("Should have similar geomorphic results to the production fiji reports", async () => {
        const source = await sourceCache.get<Feature<MultiPolygon>>(
          "https://uploads.seasketch.org/testing-geomorphic-2.fgb",
          {
            pageSize: "5MB",
          }
        );
        const prepared = prepareSketch(naitaba);
        const processor = new OverlayEngineBatchProcessor(
          "overlay_area",
          1024 * 1024 * 2, // 5MB
          prepared.feature,
          source,
          [],
          helpers,
          "class",
          pool
        );
        const results = await processor.calculate();
        compareResults(results, naitabaGeomorphologyResults, 0.005, {}, true);
      });
    });

    describe("Inside Bioregion", () => {
      let writer: DebuggingFgbWriter;
      let bboxWriter: DebuggingFgbWriter;
      let helpers: OverlayWorkerHelpers;
      let subjectWriter: DebuggingFgbWriter;

      beforeAll(async () => {
        writer = new DebuggingFgbWriter(
          __dirname + "/../outputs/naitaba-classified-features.fgb",
          [
            { name: "classification", type: "string" },
            { name: "groupBy", type: "string" },
          ]
        );
        bboxWriter = new DebuggingFgbWriter(
          __dirname + "/../outputs/naitaba-bbox-features.fgb",
          [{ name: "id", type: "integer" }]
        );
        subjectWriter = new DebuggingFgbWriter(
          __dirname + "/../outputs/naitaba-subject-feature.fgb",
          []
        );
        helpers = {
          logFeature: (
            layer: OverlayWorkerLogFeatureLayerConfig,
            feature: Feature<any>
          ) => {
            switch (layer.name) {
              case "classified-features":
                writer.addFeature(feature);
                break;
              case "container-index-boxes":
                bboxWriter.addFeature(feature);
                break;
              case "subject-feature":
                subjectWriter.addFeature(feature);
                break;
            }
          },
        };
      });

      afterAll(async () => {
        await writer.close();
        await bboxWriter.close();
        await subjectWriter.close();
      });

      it("Should have at least one bioregion result", async () => {
        const source = await sourceCache.get<Feature<MultiPolygon>>(
          "https://uploads.seasketch.org/testing-deepwater-bioregions-2.fgb",
          {
            pageSize: "5MB",
          }
        );
        const prepared = prepareSketch(insideBioregion);
        const processor = new OverlayEngineBatchProcessor(
          "overlay_area",
          1024 * 1024 * 2, // 5MB
          prepared.feature,
          source,
          [],
          {}, //helpers,
          "Draft_name",
          pool
        );
        const results = await processor.calculate();
        expect(results["Ambae Trough and North Fiji Basin"]).toBeGreaterThan(0);
      });
    });

    describe("Eco suma", () => {
      let writer: DebuggingFgbWriter;
      let bboxWriter: DebuggingFgbWriter;
      let helpers: OverlayWorkerHelpers;
      let subjectWriter: DebuggingFgbWriter;
      let fragmentWriter: DebuggingFgbWriter;
      let clippingFn: ClippingFn;

      beforeAll(async () => {
        writer = new DebuggingFgbWriter(
          __dirname + "/../outputs/naitaba-classified-features.fgb",
          [
            { name: "classification", type: "string" },
            { name: "groupBy", type: "string" },
          ]
        );
        bboxWriter = new DebuggingFgbWriter(
          __dirname + "/../outputs/naitaba-bbox-features.fgb",
          [{ name: "id", type: "integer" }]
        );
        subjectWriter = new DebuggingFgbWriter(
          __dirname + "/../outputs/naitaba-subject-feature.fgb",
          []
        );
        fragmentWriter = new DebuggingFgbWriter(
          __dirname + "/../outputs/hunga-fragments.fgb",
          [{ name: "id", type: "integer" }]
        );
        helpers = {
          logFeature: (
            layer: OverlayWorkerLogFeatureLayerConfig,
            feature: Feature<any>
          ) => {
            switch (layer.name) {
              case "classified-features":
                writer.addFeature(feature);
                break;
              case "container-index-boxes":
                bboxWriter.addFeature(feature);
                break;
              case "subject-feature":
                subjectWriter.addFeature(feature);
                break;
              case "fragments":
                fragmentWriter.addFeature(feature);
                break;
            }
          },
        };
        clippingFn = async (sketch, source, op, query) => {
          const fgbSource = await sourceCache.get<
            Feature<MultiPolygon | Polygon>
          >(source);
          const overlappingFeatures = fgbSource.getFeaturesAsync(
            sketch.envelopes
          );
          return clipSketchToPolygons(sketch, op, query, overlappingFeatures);
        };
      });

      afterAll(async () => {
        await fragmentWriter.close();
        await writer.close();
        await bboxWriter.close();
        await subjectWriter.close();
      });

      vi.setConfig({ testTimeout: 1000 * 60 });

      it("Should not have any results that total > 100% of the geography totals (proxy for testing container index hole detection)", async () => {
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

        const {
          intersectionFeature: intersectionFeatureGeojson,
          differenceSources,
        } = await initializeGeographySources(FIJI_EEZ, sourceCache, undefined, {
          pageSize: "5MB",
        });
        const source = await sourceCache.get<Feature<MultiPolygon>>(
          "https://uploads.seasketch.org/testing-eco-suma.fgb",
          {
            pageSize: "5MB",
          }
        );

        const pool = createClippingWorkerPool(
          __dirname + "/../../dist/workers/clipBatch.standalone.js"
        );
        const processor = new OverlayEngineBatchProcessor(
          "overlay_area",
          1024 * 1024 * 2, // 5MB
          simplify(intersectionFeatureGeojson, {
            tolerance: 0.002,
          }),
          source,
          differenceSources,
          undefined,
          "Site_Name",
          pool
        );
        const results = await processor.calculate();
        expect(true).toBe(true);

        const prepared = prepareSketch(
          require("./sketches/hunga-unclipped.geojson.json")
        );
        const fragments = await createFragments(
          prepared,
          [
            {
              id: 1,
              clippingLayers: FIJI_EEZ,
            },
          ],
          clippingFn
        );
        expect(fragments.length).toBeGreaterThan(1);
        if (helpers.logFeature) {
          let id = 0;
          for (const fragment of fragments) {
            helpers.logFeature(
              {
                name: "fragments",
                geometryType: "Polygon",
                fields: {
                  id: "number",
                },
              },
              {
                ...fragment,
                properties: {
                  id: id++,
                },
              }
            );
          }
        }
        let totalResults: { [key: string]: number } = { "*": 0 };
        for (const fragment of fragments) {
          const sketchProcessor = new OverlayEngineBatchProcessor(
            "overlay_area",
            1024 * 1024 * 2, // 5MB
            fragment,
            source,
            [],
            helpers,
            "Site_Name",
            pool
          );
          const sketchResults = await sketchProcessor.calculate();
          for (const classKey in sketchResults) {
            if (!totalResults[classKey]) {
              totalResults[classKey] = 0;
            }
            totalResults[classKey] += sketchResults[classKey];
          }
        }
        // make sure no result is greater than 100% of the total area
        for (const classKey in totalResults) {
          // console.log(
          //   `${classKey} ${totalResults[classKey]} ${results[classKey]}`
          // );
          expect(totalResults[classKey]).toBeLessThanOrEqual(
            results[classKey] * 1.002
          );
        }
        // const sketchProcessor
      });
    });

    describe("Count metrics", () => {
      describe("Hydrothermal vents", () => {
        it("Should match vents in sketch", async () => {
          const source = await sourceCache.get<Feature<MultiPolygon>>(
            "https://uploads.seasketch.org/testing-hydrothermal-vents.fgb",
            {
              pageSize: "5MB",
            }
          );
          const prepared = prepareSketch(ventsSketch);
          const processor = new OverlayEngineBatchProcessor(
            "count",
            1024 * 1024 * 2, // 5MB
            prepared.feature,
            source,
            [],
            {}
          );
          const results = await processor.calculate();
          expect(results["*"].count).toBe(5);
        });
      });

      it("EBSA - Should count features not subdivided parts", async () => {
        const source = await sourceCache.get<Feature<MultiPolygon>>(
          "https://uploads.seasketch.org/testing-ebsa.fgb",
          {
            pageSize: "5MB",
          }
        );
        const prepared = prepareSketch(
          require("./sketches/hunga-unclipped.geojson.json")
        );
        const processor = new OverlayEngineBatchProcessor(
          "count",
          1024 * 1024 * 2, // 5MB
          prepared.feature,
          source,
          [],
          {}
        );
        const results = await processor.calculate();
        expect(results["*"].count).toBe(2);
      });

      it("Kanacea Island Expedition sites", async () => {
        const source = await sourceCache.get<Feature<MultiPolygon>>(
          "https://uploads.seasketch.org/testing-nitrogen-2.fgb",
          {
            pageSize: "5MB",
          }
        );
        const prepared = prepareSketch(
          require("./sketches/Kanacea-Island.geojson.json")
        );
        const processor = new OverlayEngineBatchProcessor(
          "count",
          1024 * 1024 * 2, // 5MB
          prepared.feature,
          source,
          [],
          {}
        );
        const results = await processor.calculate();
        console.log(results);
        expect(results["*"].count).toBe(3);
      });
    });

    describe("Presence Table metrics", () => {
      it("Seamounts overlap with Fiji", async () => {
        const source = await sourceCache.get<Feature<MultiPolygon>>(
          "https://uploads.seasketch.org/testing-seamounts.fgb",
          {
            pageSize: "5MB",
          }
        );
        const prepared = prepareSketch(
          require("./sketches/Offshore-North.geojson.json")
        );
        const processor = new OverlayEngineBatchProcessor(
          "presence_table",
          1024 * 1024 * 2, // 5MB
          prepared.feature,
          source,
          [],
          {}
        );
        const results = await processor.calculate();
        expect(results.values.length).toBe(26);
      });
    });

    describe("Column values metrics", () => {
      it("Should have values for Kanacea Island test case", async () => {
        const source = await sourceCache.get<Feature<MultiPolygon>>(
          "https://uploads.seasketch.org/testing-nitrogen-2.fgb",
          {
            pageSize: "5MB",
          }
        );
        const prepared = prepareSketch(
          require("./sketches/Kanacea-Island.geojson.json")
        );
        const processor = new OverlayEngineBatchProcessor(
          "column_values",
          1024 * 1024 * 2, // 5MB
          prepared.feature,
          source,
          [],
          {},
          undefined,
          pool,
          undefined,
          undefined,
          "d15n"
        );
        const results = await processor.calculate();
        expect(results["*"].length).toBe(3);
        // Verify that results are IdentifiedValues tuples [oidx, value]
        expect(Array.isArray(results["*"][0])).toBe(true);
        expect(results["*"][0].length).toBe(2);
        expect(results["*"][0][0]).toBe(55);
        expect(results["*"][0][1]).toBe(1.933);
      });
    });
  });

  describe("CA", () => {
    let writer: DebuggingFgbWriter;
    let bboxWriter: DebuggingFgbWriter;
    let helpers: OverlayWorkerHelpers;
    let subjectWriter: DebuggingFgbWriter;
    let fragmentWriter: DebuggingFgbWriter;
    let clippingFn: ClippingFn;

    beforeAll(async () => {
      writer = new DebuggingFgbWriter(
        __dirname + "/../outputs/naitaba-classified-features.fgb",
        [
          { name: "classification", type: "string" },
          { name: "groupBy", type: "string" },
        ]
      );
      bboxWriter = new DebuggingFgbWriter(
        __dirname + "/../outputs/naitaba-bbox-features.fgb",
        [{ name: "id", type: "integer" }]
      );
      subjectWriter = new DebuggingFgbWriter(
        __dirname + "/../outputs/subject-feature.fgb",
        []
      );
      fragmentWriter = new DebuggingFgbWriter(
        __dirname + "/../outputs/hunga-fragments.fgb",
        [{ name: "id", type: "integer" }]
      );
      helpers = {
        logFeature: (
          layer: OverlayWorkerLogFeatureLayerConfig,
          feature: Feature<any>
        ) => {
          switch (layer.name) {
            case "classified-features":
              writer.addFeature(feature);
              break;
            case "container-index-boxes":
              bboxWriter.addFeature(feature);
              break;
            case "subject-feature":
              subjectWriter.addFeature(feature);
              break;
            case "fragments":
              fragmentWriter.addFeature(feature);
              break;
          }
        },
      };
    });

    afterAll(async () => {
      await fragmentWriter.close();
      await writer.close();
      await bboxWriter.close();
      await subjectWriter.close();
    });

    const { fetchRangeFn, cacheHits, cacheMisses } = makeFetchRangeFn(
      `https://uploads.seasketch.org`,
      1000 * 1024 * 128
    );
    const sourceCache = new SourceCache("128mb", {
      fetchRangeFn,
    });
    it("Estuaries (no groupBy)", async () => {
      const source = await sourceCache.get<Feature<MultiPolygon>>(
        "https://uploads.seasketch.org/testing-ca-estuaries.fgb",
        {
          pageSize: "5MB",
        }
      );
      const prepared = prepareSketch(
        require("./sketches/Long-Beach.geojson.json")
      );
      const pool = createClippingWorkerPool(
        __dirname + "/../../dist/workers/clipBatch.standalone.js"
      );
      if (helpers.logFeature) {
        helpers.logFeature(
          { name: "subject-feature", geometryType: "Polygon", fields: {} },
          prepared.feature
        );
      }
      const processor = new OverlayEngineBatchProcessor(
        "overlay_area",
        1024 * 1024 * 2, // 5MB
        prepared.feature,
        source,
        [],
        helpers,
        undefined,
        pool
      );
      const results = await processor.calculate();
      expect(results["*"]).toBeCloseTo(11.06, 1);
      // console.log(results);
    });
  });

  describe("CRDSS", () => {
    const { fetchRangeFn } = makeFetchRangeFn(
      `https://uploads.seasketch.org`,
      1000 * 1024 * 128
    );

    let pool: WorkerPool<any, any>;
    let sourceCache: SourceCache;

    beforeAll(async () => {
      sourceCache = new SourceCache("128mb", {
        fetchRangeFn,
      });
      pool = createClippingWorkerPool(
        __dirname + "/../../dist/workers/clipBatch.standalone.js"
      );
    });

    it("Should count features not subdivided parts", async () => {
      const source = await sourceCache.get<Feature<MultiPolygon>>(
        "https://uploads.seasketch.org/testing-reef-injury-sites-2.fgb",
        {
          pageSize: "5MB",
        }
      );
      const prepared = prepareSketch(
        require("./sketches/CRDSS-Example-A.geojson.json")
      );
      console.log("prepared", prepared);
      const processor = new OverlayEngineBatchProcessor(
        "count",
        1024 * 1024 * 2, // 5MB
        prepared.feature,
        source,
        [],
        {},
        "Type",
        pool
      );
      const results = await processor.calculate();
      expect(results["*"].count).toBe(7);
      expect(results["chain"].count).toBe(1);
      expect(results["grounding"].count).toBe(5);
      expect(results["sunken object"].count).toBe(1);
    });

    it("Presence metrics", async () => {
      const source = await sourceCache.get<Feature<MultiPolygon>>(
        "https://uploads.seasketch.org/testing-reef-injury-sites-2.fgb",
        {
          pageSize: "5MB",
        }
      );
      const prepared = prepareSketch(
        require("./sketches/CRDSS-Example-A.geojson.json")
      );
      const processor = new OverlayEngineBatchProcessor(
        "presence",
        1024 * 1024 * 2, // 5MB
        prepared.feature,
        source,
        [],
        {}
      );
      const results = await processor.calculate();
      expect(results).toBe(true);
    });

    it("Presence miss", async () => {
      const source = await sourceCache.get<Feature<MultiPolygon>>(
        "https://uploads.seasketch.org/testing-reef-injury-sites-2.fgb",
        {
          pageSize: "5MB",
        }
      );
      const prepared = prepareSketch(
        require("./sketches/Long-Beach.geojson.json")
      );
      const processor = new OverlayEngineBatchProcessor(
        "presence",
        1024 * 1024 * 2, // 5MB
        prepared.feature,
        source,
        [],
        {}
      );
      const results = await processor.calculate();
      expect(results).toBe(false);
    });
  });
});

describe("Raster metrics", () => {
  it("Should calculate raster stats", async () => {
    const source = "https://uploads.seasketch.org/testing-fiji-bathy-3.tif";
    // const source = "https://uploads.seasketch.org/gebco-cog.tif";
    const prepared = prepareSketch(
      require("./sketches/Kanacea-Island.geojson.json")
    );
    const f = reprojectFeatureTo6933(prepared.feature);
    const stats = await calculateRasterStats(source, f);
    expect(stats.bands[0].mean).toBeCloseTo(-20.6666);
    expect(stats.bands[0].min).toBeCloseTo(-207);
    expect(stats.bands[0].max).toBeCloseTo(54);
  });
});
