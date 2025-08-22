import { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { prepareSketch } from "../utils/prepareSketch";
import { evaluateCql2JSONQuery } from "../cql2";
import * as polygonClipping from "polygon-clipping";
import area from "@turf/area";
import { unionAtAntimeridian } from "../utils/unionAtAntimeridian";
import { union, difference, intersection } from "../utils/polygonClipping";
import { SourceCache } from "fgb-source";
import { simplify } from "@turf/simplify";
import { ContainerIndex } from "../utils/containerIndex";
import { ClippingLayerOption } from "./geographies";
import { coverWithRectangles } from "../utils/coverWithRectangles";
import flatten from "@turf/flatten";
import bbox from "@turf/bbox";
import { bboxToEnvelope } from "../utils/bboxUtils";

// Determines whether to apply a difference operation against an entire diff
// layer vs the intersection layer union, or to apply an intersection against
// each feature in the difference layer and sum up the overlapping area
// piecemeal.
// I noticed problems > 40MB, but it probably makes sense to set it lower just
// in case. TODO: check for pathological performance differences
const MAX_SAFE_CLIPPING_OPERATION_BYTES = 10_000_000;
const MAX_SAFE_CLIPPING_OPERATION_FEATURE_COUNT = 2_000;

export type DebuggingCallback = (
  type: "edge-box" | "classified-difference-feature" | "intersection-layer",
  feature: Feature<Polygon | MultiPolygon>
) => void;

export interface CalculateAreaOptions {
  debuggingCallback?: DebuggingCallback;
  progressCallback?: (progress: number) => void;
}

export async function calculateArea(
  geography: ClippingLayerOption[],
  sourceCache: SourceCache,
  options: CalculateAreaOptions = {}
) {
  const { debuggingCallback, progressCallback } = options;

  // first, start initialization of all sources. Later code can still await
  // sourceCache.get, but the requests will already be resolved or in-flight
  geography.map((layer) => {
    sourceCache.get(layer.source, {
      initialHeaderRequestLength: layer.headerSizeHint,
    });
  });

  let progress = 0;

  // first, fetch all intersection layers and union the features into a single
  // multipolygon
  console.time("create intersection feature");
  if (progressCallback) {
    progressCallback(progress++); // Starting intersection layer processing
  }
  const intersectionLayers = geography.filter((l) => l.op === "INTERSECT");
  const differenceLayers = geography.filter((l) => l.op === "DIFFERENCE");
  const intersectionFeatures = [] as Feature<Polygon | MultiPolygon>[];
  let intersectionFeatureBytes = 0;
  await Promise.all(
    intersectionLayers.map(async (l) => {
      const source = await sourceCache.get<Feature<Polygon | MultiPolygon>>(
        l.source
      );
      if (progressCallback) {
        progressCallback(progress++); // Starting intersection layer processing
      }
      for await (const {
        properties,
        getFeature,
      } of source.getFeatureProperties()) {
        if (evaluateCql2JSONQuery(l.cql2Query, properties)) {
          intersectionFeatures.push(getFeature());
          intersectionFeatureBytes += properties?.__byteLength || 0;
        }
      }
      if (progressCallback) {
        progressCallback(progress++); // Starting intersection layer processing
      }
      console.log("got intersection features", intersectionFeatures.length);
    })
  );
  console.timeEnd("create intersection feature");
  console.log(
    "got intersection features",
    intersectionFeatures.length,
    intersectionFeatureBytes + " bytes"
  );

  // create a single multipolygon from the intersection features
  const intersectionFeatureGeojson = {
    type: "Feature",
    geometry: {
      type: "MultiPolygon",
      coordinates: union(
        intersectionFeatures.map(
          (f) => f.geometry.coordinates as polygonClipping.Geom
        )
      ),
    },
    properties: {},
  } as Feature<MultiPolygon>;

  if (differenceLayers.length === 0) {
    if (progressCallback) {
      progressCallback(50);
    }
    return area(intersectionFeatureGeojson) / 1_000_000;
  } else {
    if (progressCallback) {
      progressCallback(progress++);
    }
    const envelopes = flatten(intersectionFeatureGeojson).features.map((f) =>
      bboxToEnvelope(bbox(f))
    );

    const simplified = simplify(intersectionFeatureGeojson, {
      tolerance: 0.002,
    });

    if (progressCallback) {
      progressCallback(progress++);
    }

    if (debuggingCallback) {
      debuggingCallback("intersection-layer", {
        ...intersectionFeatureGeojson,
        properties: { name: "union" },
      });
      debuggingCallback("intersection-layer", {
        ...simplified,
        properties: { name: "simplified" },
      });
    }

    let mixedGeoms = [] as Position[][][];
    let mixedGeomsBytes = 0;
    const differenceGeoms = [] as polygonClipping.Geom[];
    let bytesFetched = 0;
    let overlappingDifferenceFeaturesSqKm = 0;
    for (const layer of differenceLayers) {
      console.time("get source");
      const source = await sourceCache.get<Feature<Polygon | MultiPolygon>>(
        layer.source,
        {
          initialHeaderRequestLength: layer.headerSizeHint,
        }
      );
      if (progressCallback) {
        progressCallback(progress++);
      }
      console.timeEnd("get source");
      console.time("countAndBytesForQuery");
      const { bytes, features } = await source.countAndBytesForQuery(envelopes);
      console.log("bytes", bytes, "features", features, envelopes);
      console.timeEnd("countAndBytesForQuery");
      if (progressCallback) {
        progressCallback(progress++);
      }
      if (
        true ||
        bytes > MAX_SAFE_CLIPPING_OPERATION_BYTES ||
        features > MAX_SAFE_CLIPPING_OPERATION_FEATURE_COUNT
      ) {
        console.log(
          "Large difference layer. Performing piecemeal intersection to calculate area"
        );

        let i = 0;
        let fullyContainedFeatures = 0;
        let intersectingFeatures = 0;
        let lastLoggedPercent = 0;
        let outsideFeatures = 0;
        const containerIndex = new ContainerIndex(simplified);
        const bboxPolygons = containerIndex.getBBoxPolygons();

        if (debuggingCallback) {
          for (const f of bboxPolygons.features) {
            debuggingCallback("edge-box", f);
          }
        }

        // get features from difference layer
        for await (const f of source.getFeaturesAsync(envelopes)) {
          if (
            !layer.cql2Query ||
            evaluateCql2JSONQuery(layer.cql2Query, f.properties)
          ) {
            i++;
            // console.log(i);
            const percent = (i / features) * 100;
            if (percent - lastLoggedPercent > 1) {
              lastLoggedPercent = percent;
              if (progressCallback) {
                progressCallback(
                  Math.round(percent) < 95 ? Math.round(percent) : 95
                );
              }
            }
            const classification = containerIndex.classify(f);

            // Handle debugging callback for all classified features
            if (debuggingCallback) {
              debuggingCallback("classified-difference-feature", {
                type: "Feature",
                geometry: f.geometry,
                properties: {
                  class: classification,
                  __offset: f.properties?.__offset,
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
      } else {
        console.log(
          "Small difference layer. Performing union to calculate area"
        );
        for (const b of envelopes) {
          for await (const f of source.getFeaturesAsync(b)) {
            bytesFetched += f.properties?.__byteLength || 0;
            if (bytesFetched > 40_000_000) {
              throw new Error(
                "bytes fetched too high, aborting. " + bytesFetched
              );
            }
            if (
              !layer.cql2Query ||
              evaluateCql2JSONQuery(layer.cql2Query, f.properties)
            ) {
              differenceGeoms.push(
                f.geometry.coordinates as polygonClipping.Geom
              );
            }
          }
        }
      }
    }

    if (differenceGeoms.length > 0) {
      const differenceFeature = difference([
        simplified.geometry.coordinates as polygonClipping.Geom,
        ...differenceGeoms,
      ]);
    }

    const productGeojson = {
      type: "Feature",
      geometry: {
        type: "MultiPolygon",
        coordinates: intersectionFeatureGeojson.geometry.coordinates,
      },
      properties: {},
    } as Feature<MultiPolygon>;

    if (progressCallback) {
      progressCallback(98); // Final calculation
    }
    console.log("product made, calculate area");
    const sqKm = area(productGeojson) / 1_000_000;
    console.log({
      sqKm,
      overlappingDifferenceFeaturesSqKm,
      total: sqKm - overlappingDifferenceFeaturesSqKm,
    });
    return sqKm - overlappingDifferenceFeaturesSqKm;
  }
}

function ringArea(coords: any) {
  let sum = 0;
  for (let i = 0, len = coords.length, j = len - 1; i < len; j = i++) {
    sum += (coords[j][0] - coords[i][0]) * (coords[j][1] + coords[i][1]);
  }
  return Math.abs(sum / 2);
}

function polygonArea(polygon: any) {
  let area = ringArea(polygon[0]); // exterior
  for (let i = 1; i < polygon.length; i++) {
    area -= ringArea(polygon[i]); // subtract holes
  }
  return area;
}

function handleMixedGeoms(
  mixedGeoms: Position[][][],
  intersectionFeature: polygonClipping.Geom
) {
  let areaKm = 0;
  let multipart = [] as polygonClipping.Geom;
  for (const geom of mixedGeoms) {
    // @ts-ignore
    multipart.push(geom);
  }
  const overlap = intersection([intersectionFeature, multipart]);
  // for (const geom of mixedGeoms) {
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
    console.log("overlapping sq km", overlappingSqKm);
    // }
  }
  return areaKm;
}
