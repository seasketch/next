import { SourceCache } from "fgb-source";
import { ClippingLayerOption, initializeGeographySources } from "./geographies";
import { SourceType } from "../metrics/metrics";
import { guaranteeHelpers, OverlayWorkerHelpers } from "../utils/helpers";
import { Feature, MultiPolygon, Polygon } from "geojson";
import { evaluateCql2JSONQuery } from "../cql2";
import { bbox } from "@turf/bbox";
import { bboxToEnvelope } from "../utils/bboxUtils";
import * as clipping from "polyclip-ts";
import calcArea from "@turf/area";

export async function calculateGeographyOverlap(
  geography: ClippingLayerOption[],
  sourceCache: SourceCache,
  sourceUrl: string,
  sourceType: SourceType,
  groupBy?: string,
  helpersOption?: OverlayWorkerHelpers
) {
  let differenceReferences = 0;
  const helpers = guaranteeHelpers(helpersOption);
  if (sourceType !== "FlatGeobuf") {
    throw new Error(`Unsupported source type: ${sourceType}`);
  }

  const { intersectionFeature: intersectionFeatureGeojson, differenceLayers } =
    await initializeGeographySources(geography, sourceCache, helpers);

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

    let intersection = clipping.intersection(
      intersectionGeom,
      feature.geometry.coordinates as clipping.Geom
    );
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
            differenceGeoms.push(
              differenceFeature.geometry.coordinates as clipping.Geom
            );
          }
        }
        if (differenceGeoms.length > 0) {
          console.log("difference geoms", differenceGeoms.length);
          intersection = clipping.difference(intersection, ...differenceGeoms);
        } else {
          console.log("no difference geoms");
        }
      }
    }
    const area =
      calcArea({
        type: "Feature",
        properties: {},
        geometry: {
          type: "MultiPolygon",
          coordinates: intersection,
        },
      }) / 1_000_000;
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

  console.log("difference references", differenceReferences);
  return areaByClassId;
}
