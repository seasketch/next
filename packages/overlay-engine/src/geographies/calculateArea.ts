import { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { evaluateCql2JSONQuery } from "../cql2";
import * as polygonClipping from "polygon-clipping";
import area from "@turf/area";
import { union, intersection } from "../utils/polygonClipping";
import { SourceCache } from "fgb-source";
import { simplify } from "@turf/simplify";
import { ContainerIndex } from "../utils/containerIndex";
import { ClippingLayerOption, initializeGeographySources } from "./geographies";
import flatten from "@turf/flatten";
import bbox from "@turf/bbox";
import { bboxToEnvelope } from "../utils/bboxUtils";
import {
  OverlayWorkerHelpers,
  OverlayWorkerLogFeatureLayerConfig,
  guaranteeHelpers,
} from "../utils/helpers";

// Layer configurations for logging features
const layers: Record<string, OverlayWorkerLogFeatureLayerConfig> = {
  bboxes: {
    name: "edge-box",
    geometryType: "Polygon",
    fields: { category: "string" },
  },
  intersection: {
    name: "intersection-layer",
    geometryType: "MultiPolygon",
    fields: { name: "string" },
  },
  classified: {
    name: "classified-difference-feature",
    geometryType: "Polygon",
    fields: { category: "string", id: "number" },
  },
};

export async function calculateArea(
  geography: ClippingLayerOption[],
  sourceCache: SourceCache,
  helpersOption?: OverlayWorkerHelpers
) {
  // Transform optional helpers into guaranteed interface with no-op functions for log and progress
  const helpers = guaranteeHelpers(helpersOption);

  const { intersectionFeature: intersectionFeatureGeojson, differenceLayers } =
    await initializeGeographySources(geography, sourceCache, helpers);

  let progress = 0;

  if (differenceLayers.length === 0) {
    helpers.progress(50, "No difference layers, calculating final area");
    return area(intersectionFeatureGeojson) / 1_000_000;
  } else {
    helpers.progress(progress++, "Processing difference layers");
    const envelopes = flatten(intersectionFeatureGeojson).features.map((f) =>
      bboxToEnvelope(bbox(f))
    );

    const simplified = simplify(intersectionFeatureGeojson, {
      tolerance: 0.002,
    });

    helpers.progress(progress++, "Simplified intersection geometry");

    if (helpers.logFeature) {
      helpers.logFeature(layers.intersection, {
        ...intersectionFeatureGeojson,
        properties: { name: "union" },
      });
      helpers.logFeature(layers.intersection, {
        ...simplified,
        properties: { name: "simplified" },
      });
    }

    let mixedGeoms = [] as Position[][][];
    let mixedGeomsBytes = 0;
    let overlappingDifferenceFeaturesSqKm = 0;
    for (const layer of differenceLayers) {
      helpers.log("Getting source for difference layer");
      const source = await sourceCache.get<Feature<Polygon | MultiPolygon>>(
        layer.source,
        {
          initialHeaderRequestLength: layer.headerSizeHint,
        }
      );
      helpers.progress(progress++, "Fetched difference layer source");
      helpers.log("Counting bytes and features for query");
      const { bytes, features } = await source.countAndBytesForQuery(envelopes);
      helpers.log(
        `Bytes: ${bytes}, Features: ${features}, Envelopes: ${envelopes.length}`
      );
      helpers.progress(progress++, "Counted features and bytes");

      let i = 0;
      let fullyContainedFeatures = 0;
      let intersectingFeatures = 0;
      let outsideFeatures = 0;
      const containerIndex = new ContainerIndex(simplified);

      if (helpers.logFeature) {
        const bboxPolygons = containerIndex.getBBoxPolygons();
        for (const f of bboxPolygons.features) {
          helpers.logFeature(layers.bboxes, {
            ...f,
            properties: { category: "edge-box" },
          });
        }
      }
      // get features from difference layer
      for await (const f of source.getFeaturesAsync(envelopes)) {
        if (
          !layer.cql2Query ||
          evaluateCql2JSONQuery(layer.cql2Query, f.properties)
        ) {
          i++;
          const percent = (i / features) * 100;
          await helpers.progress(
            percent < 95 ? percent : 95,
            `Processing difference features: ${percent}%`
          );
          const classification = containerIndex.classify(f);

          if (helpers.logFeature) {
            // Handle debugging callback for all classified features
            helpers.logFeature(layers.classified, {
              type: "Feature",
              geometry: f.geometry,
              properties: {
                category: classification,
                id: f.properties?.__offset,
              },
            });
          }

          if (classification === "inside") {
            overlappingDifferenceFeaturesSqKm += area(f) / 1_000_000;
            fullyContainedFeatures++;
          } else if (classification === "mixed") {
            intersectingFeatures++;
            if (f.geometry.type === "Polygon") {
              mixedGeoms.push(f.geometry.coordinates);
            } else {
              for (const poly of f.geometry.coordinates) {
                mixedGeoms.push(poly);
              }
            }
            mixedGeomsBytes += f.properties?.__byteLength || 0;
            if (mixedGeomsBytes > 200_000) {
              overlappingDifferenceFeaturesSqKm += handleMixedGeoms(
                mixedGeoms,
                simplified.geometry.coordinates as polygonClipping.Geom
              );
              mixedGeoms = [];
              mixedGeomsBytes = 0;
            }
          } else {
            // outside
            outsideFeatures++;
          }
        }
      }
      if (mixedGeoms.length > 0) {
        overlappingDifferenceFeaturesSqKm += handleMixedGeoms(
          mixedGeoms,
          simplified.geometry.coordinates as polygonClipping.Geom
        );
        mixedGeoms = [];
        mixedGeomsBytes = 0;
      }
    }

    helpers.progress(98, "Final calculation");
    const sqKm = area(intersectionFeatureGeojson) / 1_000_000;
    helpers.log(
      `Area calculation complete: ${sqKm} sq km - ${overlappingDifferenceFeaturesSqKm} sq km = ${
        sqKm - overlappingDifferenceFeaturesSqKm
      } sq km`
    );
    return sqKm - overlappingDifferenceFeaturesSqKm;
  }
}

/**
 * Handles mixed geometries by intersecting them with the intersection feature
 * and calculating the area of the resulting multipolygon.
 *
 * "Mixed geometries" are geometries that are part of the difference layer that
 * are not fully contained by the intersection feature, and are not fully
 * outside of it. They are likely to be polygons that are intersected by the
 * intersection feature.
 *
 * @param mixedGeoms - The mixed geometries to handle.
 * @param intersectionFeature - The intersection feature to intersect with.
 * @returns The area of the resulting multipolygon.
 */
function handleMixedGeoms(
  mixedGeoms: Position[][][],
  intersectionFeature: polygonClipping.Geom
) {
  let areaKm = 0;
  let multipart: polygonClipping.Geom[] = [];
  for (const geom of mixedGeoms) {
    multipart.push(geom as any);
  }
  const overlap = intersection([intersectionFeature, union(multipart)]);
  if (overlap) {
    const overlappingSqKm =
      area({
        type: "Feature",
        geometry: {
          type: "MultiPolygon",
          coordinates: overlap,
        },
        properties: {},
      }) / 1_000_000;
    areaKm += overlappingSqKm;
  }
  return areaKm;
}
