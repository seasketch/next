import { vi } from "vitest";
import { makeFetchRangeFn } from "../../scripts/optimizedFetchRangeFn";
import turfBbox from "@turf/bbox";
import { FlatGeobufSource, SourceCache } from "fgb-source";
import {
  ClippingFn,
  ClippingLayerOption,
  clipSketchToPolygons,
  initializeGeographySources,
} from "../../src/geographies/geographies";
import { Feature, MultiPolygon, Polygon } from "geojson";
import {
  OverlappingAreaBatchedClippingProcessor,
  createClippingWorkerPool,
} from "../../src/OverlappingAreaBatchedClippingProcessor";
import { DebuggingFgbWriter } from "../../src/utils/debuggingFgbWriter";
import {
  OverlayWorkerHelpers,
  OverlayWorkerLogFeatureLayerConfig,
} from "../../src/utils/helpers";
import { createFragments, GeographySettings } from "../../src/fragments";
import { prepareSketch } from "../../src/utils/prepareSketch";
import { Cql2Query } from "../../src/cql2";
import { compareResults } from "./compareResults";
import { WorkerPool } from "../../src/workers/pool";
import simplify from "@turf/simplify";
const insideBioregion = require("./sketches/Inside-bioregion-2.geojson.json");

const naitaba = require("./sketches/Naitaba.geojson.json");
const naitabaGeomorphologyMetrics = require("./sketches/GeomorphACA__Naitaba__2025-10-29T21_42_30Z.json");
const naitabaGeomorphologyResults: { [key: string]: number } = { "*": 0 };
for (const metric of naitabaGeomorphologyMetrics) {
  naitabaGeomorphologyResults[metric.classId] = metric.value / 1_000_000;
  naitabaGeomorphologyResults["*"] += metric.value / 1_000_000;
}

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
        const processor = new OverlappingAreaBatchedClippingProcessor(
          1024 * 1024 * 2, // 5MB
          prepared.feature,
          source,
          [],
          helpers,
          "class",
          pool
        );
        const results = await processor.calculateOverlap();
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
        const processor = new OverlappingAreaBatchedClippingProcessor(
          1024 * 1024 * 2, // 5MB
          prepared.feature,
          source,
          [],
          {}, //helpers,
          "Draft_name",
          pool
        );
        const results = await processor.calculateOverlap();
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
        const processor = new OverlappingAreaBatchedClippingProcessor(
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
        const results = await processor.calculateOverlap();
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
          const sketchProcessor = new OverlappingAreaBatchedClippingProcessor(
            1024 * 1024 * 2, // 5MB
            fragment,
            source,
            [],
            helpers,
            "Site_Name",
            pool
          );
          const sketchResults = await sketchProcessor.calculateOverlap();
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
      const processor = new OverlappingAreaBatchedClippingProcessor(
        1024 * 1024 * 2, // 5MB
        prepared.feature,
        source,
        [],
        helpers,
        undefined,
        pool
      );
      const results = await processor.calculateOverlap();
      expect(results["*"]).toBeCloseTo(11.06, 1);
      // console.log(results);
    });
  });
});
