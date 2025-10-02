import { SourceCache } from "fgb-source";
import { ClippingLayerOption, initializeGeographySources } from "./geographies";
import { SourceType } from "../metrics/metrics";
import {
  guaranteeHelpers,
  OverlayWorkerHelpers,
  OverlayWorkerLogFeatureLayerConfig,
} from "../utils/helpers";
import { Feature, MultiPolygon, Polygon } from "geojson";
import { evaluateCql2JSONQuery } from "../cql2";
import { bbox } from "@turf/bbox";
import { bboxToEnvelope } from "../utils/bboxUtils";
import * as clipping from "polyclip-ts";
import calcArea from "@turf/area";
import simplify from "@turf/simplify";
import { ContainerIndex } from "../utils/containerIndex";

const layers: Record<string, OverlayWorkerLogFeatureLayerConfig> = {
  bboxes: {
    name: "outer-polygon-edge-box",
    geometryType: "Polygon",
    fields: { category: "string" },
  },
  classifiedSourceFeatures: {
    name: "classified-source-features",
    geometryType: "Polygon",
    fields: { category: "string" },
  },
  outerPolygonIntersectionResults: {
    name: "outer-polygon-intersection-results",
    geometryType: "MultiPolygon",
    fields: { category: "string" },
  },
  allDifferenceFeatures: {
    name: "all-difference-features",
    geometryType: "Polygon",
    fields: { offset: "number" },
  },
  finalProductFeatures: {
    name: "final-product-features",
    geometryType: "MultiPolygon",
    fields: {},
  },
};

export async function calculateGeographyOverlap(
  geography: ClippingLayerOption[],
  sourceCache: SourceCache,
  sourceUrl: string,
  sourceType: SourceType,
  groupBy?: string,
  helpersOption?: OverlayWorkerHelpers
) {
  let differenceReferences = 0;
  const loggedDifferenceFeatures = new Set<string>();
  const helpers = guaranteeHelpers(helpersOption);
  if (sourceType !== "FlatGeobuf") {
    throw new Error(`Unsupported source type: ${sourceType}`);
  }

  // start source prefetching
  sourceCache.get<Feature<Polygon | MultiPolygon>>(sourceUrl);

  const { intersectionFeature: intersectionFeatureGeojson, differenceLayers } =
    await initializeGeographySources(geography, sourceCache, helpers, {
      pageSize: "16MB",
    });

  const simplified = simplify(intersectionFeatureGeojson, {
    tolerance: 0.002,
  });

  const outerPolygonContainerIndex = new ContainerIndex(simplified);

  if (helpers.logFeature) {
    const bboxPolygons = outerPolygonContainerIndex.getBBoxPolygons();
    for (const f of bboxPolygons.features) {
      helpers.logFeature(layers.bboxes, {
        ...f,
        properties: { category: "outer-polygon-edge-box" },
      });
    }
  }

  const differenceSources = await Promise.all(
    differenceLayers.map(async (layer) => {
      const diffSource = await sourceCache.get<Feature<Polygon | MultiPolygon>>(
        layer.source
      );
      return {
        cql2Query: layer.cql2Query,
        source: diffSource,
      };
    })
  );

  // difference layers often include the osm land layer, which is very large.
  // to optimize performance, start fetching pages from the difference layers
  // for every page that intersects the geography. Afterwards,
  // feature-by-feature calculations can be performed.

  const env = bboxToEnvelope(bbox(intersectionFeatureGeojson));

  helpers.log("prefetching difference sources");
  for (const differenceSource of differenceSources) {
    differenceSource.source.prefetch(env);
  }

  helpers.log("initialized geography sources");
  let progress = 0;

  let featuresProcessed = 0;
  helpers.time("initializing layer source");
  const source = await sourceCache.get<Feature<Polygon | MultiPolygon>>(
    sourceUrl
  );
  helpers.timeEnd("initializing layer source");

  const envelope = bboxToEnvelope(bbox(intersectionFeatureGeojson));
  const estimate = await source.countAndBytesForQuery(envelope);
  helpers.log(
    `Querying source. Estimated features: ${estimate.features}, estimated bytes: ${estimate.bytes}, requests: ${estimate.requests}`
  );
  helpers.progress(progress, `Processing ${estimate.features} features`);
  helpers.time("time to first feature");

  const areaByClassId: { [classId: string]: number } = { "*": 0 };

  const intersectionGeom = intersectionFeatureGeojson.geometry
    .coordinates as clipping.Geom;

  for await (const feature of source.getFeaturesAsync(envelope)) {
    if (featuresProcessed === 0) {
      helpers.timeEnd("time to first feature");
    }
    featuresProcessed++;
    const percent = (featuresProcessed / estimate.features) * 100;
    await helpers.progress(
      percent,
      `Processing features: (${featuresProcessed}/${estimate.features})`
    );

    let hasChanged = false;
    let intersection: clipping.Geom;
    const classification = outerPolygonContainerIndex.classify(feature);
    if (helpers.logFeature) {
      helpers.logFeature(layers.classifiedSourceFeatures, {
        ...feature,
        properties: {
          category: classification,
        },
      });
    }
    if (classification === "outside") {
      continue;
    } else if (classification === "mixed") {
      hasChanged = true;
      intersection = clipping.intersection(
        intersectionGeom,
        feature.geometry.coordinates as clipping.Geom
      );
      if (helpers.logFeature) {
        helpers.logFeature(layers.outerPolygonIntersectionResults, {
          ...feature,
          properties: { category: "outer-polygon-intersection-results" },
          geometry: {
            type: "MultiPolygon",
            coordinates: intersection,
          },
        });
      }
    } else {
      intersection = feature.geometry.coordinates as clipping.Geom;
    }

    if (differenceSources.length > 0) {
      for (const diffLayer of differenceSources) {
        let differenceGeoms = [] as clipping.Geom[];
        const featureEnvelope = bboxToEnvelope(bbox(feature.geometry));
        for await (const differenceFeature of diffLayer.source.getFeaturesAsync(
          featureEnvelope
        )) {
          differenceReferences++;
          if (
            !diffLayer.cql2Query ||
            evaluateCql2JSONQuery(
              diffLayer.cql2Query,
              differenceFeature.properties
            )
          ) {
            if (
              helpers.logFeature &&
              !loggedDifferenceFeatures.has(
                `${differenceSources.indexOf(diffLayer)}-${
                  differenceFeature.properties?.__offset
                }`
              )
            ) {
              helpers.logFeature(layers.allDifferenceFeatures, {
                ...differenceFeature,
                properties: {
                  offset: differenceFeature.properties?.__offset || 0,
                },
              });
            }
            differenceGeoms.push(
              differenceFeature.geometry.coordinates as clipping.Geom
            );
          }
        }
        if (differenceGeoms.length > 0) {
          // console.log("difference geoms", differenceGeoms.length);
          hasChanged = true;
          intersection = clipping.difference(intersection, ...differenceGeoms);
        } else {
          // console.log("no difference geoms");
        }
      }
    }
    if (helpers.logFeature) {
      if (hasChanged) {
        helpers.logFeature(layers.finalProductFeatures, {
          type: "Feature",
          properties: {},
          geometry: {
            type: "MultiPolygon",
            // @ts-ignore
            coordinates: intersection,
          },
        });
      } else {
        helpers.logFeature(layers.finalProductFeatures, {
          ...feature,
        });
      }
    }
    let area = 0;
    if (hasChanged) {
      area =
        calcArea({
          type: "Feature",
          properties: {},
          geometry: {
            type: "MultiPolygon",
            coordinates: intersection,
          },
        }) / 1_000_000;
    } else {
      area = feature.properties?.__area || calcArea(feature) / 1_000_000;
    }
    areaByClassId["*"] += area;
    if (groupBy) {
      const classKey = feature.properties[groupBy];
      if (classKey !== undefined) {
        if (!areaByClassId[classKey]) {
          areaByClassId[classKey] = 0;
        }
        areaByClassId[classKey] += area;
      }
    }
  }

  return areaByClassId;
}
