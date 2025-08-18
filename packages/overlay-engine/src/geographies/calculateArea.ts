import { Feature, MultiPolygon, Polygon } from "geojson";
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
// import { DebuggingFgbWriter } from "../utils/debuggingFgbWriter";
// import { coverWithRectangles } from "../utils/coverWithRectangles";

// Determines whether to apply a difference operation against an entire diff
// layer vs the intersection layer union, or to apply an intersection against
// each feature in the difference layer and sum up the overlapping area
// piecemeal.
// I noticed problems > 40MB, but it probably makes sense to set it lower just
// in case. TODO: check for pathological performance differences
const MAX_SAFE_CLIPPING_OPERATION_BYTES = 10_000_000;
const MAX_SAFE_CLIPPING_OPERATION_FEATURE_COUNT = 2_000;

export async function calculateArea(
  geography: ClippingLayerOption[],
  sourceCache: SourceCache
) {
  // first, start initialization of all sources. Later code can still await
  // sourceCache.get, but the requests will already be resolved or in-flight
  geography.map((layer) => {
    sourceCache.get(layer.source);
  });
  // const classifiedLand = new DebuggingFgbWriter(
  //   "/Users/cburt/Downloads/classified.fgb",
  //   [
  //     { name: "__offset", type: "integer" },
  //     { name: "class", type: "string" },
  //   ]
  // );
  // const intersectionWriter = new DebuggingFgbWriter(
  //   "/Users/cburt/Downloads/intersection.fgb",
  //   [{ name: "name", type: "string" }]
  // );
  // first, fetch all intersection layers and union the features
  console.time("create intersection feature");
  const intersectionLayers = geography.filter((l) => l.op === "INTERSECT");
  const differenceLayers = geography.filter((l) => l.op === "DIFFERENCE");
  const intersectionFeatures = [] as Feature<Polygon | MultiPolygon>[];
  let intersectionFeatureBytes = 0;
  await Promise.all(
    intersectionLayers.map(async (l) => {
      console.log("get layer", l.source);
      const source = await sourceCache.get<Feature<Polygon | MultiPolygon>>(
        l.source
      );
      for await (const {
        properties,
        getFeature,
      } of source.getFeatureProperties()) {
        if (evaluateCql2JSONQuery(l.cql2Query, properties)) {
          intersectionFeatures.push(getFeature());
          intersectionFeatureBytes += properties?.__byteLength || 0;
        }
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
  if (differenceLayers.length === 0) {
    console.log("no difference layers, calculate area");
    const sumArea = intersectionFeatures.reduce(
      (acc, f) => acc + polygonArea(f.geometry.coordinates),
      0
    );
    // convert to square kilometers
    return sumArea / 1_000_000;
  } else {
    // first, create a union of the intersection features
    let intersectionFeature = union(
      intersectionFeatures.map(
        (f) => f.geometry.coordinates as polygonClipping.Geom
      )
    );
    const intersectionFeaturesByteSize = intersectionFeatures.reduce(
      (sum, f) => {
        sum += f.properties?.__byteLength || 0;
        return sum;
      },
      0
    );
    // turn back into geojson feature
    let intersectionFeatureGeojson = unionAtAntimeridian({
      type: "Feature",
      geometry: { type: "MultiPolygon", coordinates: intersectionFeature },
      properties: { name: "union-at-antimeridian" },
    });
    // intersectionWriter.addFeature(intersectionFeatureGeojson);
    const prepared = prepareSketch(intersectionFeatureGeojson);
    const envelopes = prepared.envelopes;
    // intersectionWriter.addFeature({
    //   type: "Feature",
    //   geometry: prepared.feature.geometry,
    //   properties: { name: "prepared" },
    // });
    // await intersectionWriter.close();

    let mixedGeoms = [] as polygonClipping.Geom[];
    let mixedGeomsBytes = 0;
    const differenceGeoms = [] as polygonClipping.Geom[];
    let bytesFetched = 0;
    let overlappingDifferenceFeaturesSqKm = 0;
    for (const layer of differenceLayers) {
      console.time("get source");
      const source = await sourceCache.get<Feature<Polygon | MultiPolygon>>(
        layer.source
      );
      console.timeEnd("get source");
      console.time("countAndBytesForQuery");
      const { bytes, features } = await source.countAndBytesForQuery(envelopes);
      console.log("bytes", bytes, "features", features, envelopes);
      console.timeEnd("countAndBytesForQuery");
      if (
        true ||
        bytes > MAX_SAFE_CLIPPING_OPERATION_BYTES ||
        features > MAX_SAFE_CLIPPING_OPERATION_FEATURE_COUNT
      ) {
        console.log(
          "Large difference layer. Performing piecemeal intersection to calculate area"
        );
        console.log({ intersectionFeatureBytes });
        let simplifiedIntersectionFeature: Feature<
          Polygon | MultiPolygon
        > | null = null;
        simplifiedIntersectionFeature = simplify(prepared.feature, {
          tolerance: 0.01,
        });
        let i = 0;
        let fullyContainedFeatures = 0;
        let intersectingFeatures = 0;
        let lastLoggedPercent = 0;
        let outsideFeatures = 0;
        const containerIndex = new ContainerIndex(
          simplifiedIntersectionFeature || intersectionFeatureGeojson
        );
        // const bboxPolygons = containerIndex.getBBoxPolygons();
        // const bboxesWriter = new DebuggingFgbWriter(
        //   "/Users/cburt/Downloads/bboxes.fgb",
        //   []
        // );
        // for (const f of bboxPolygons.features) {
        //   bboxesWriter.addFeature(f);
        // }
        // await bboxesWriter.close();
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
              console.log(
                `running overlap ${percent.toFixed(2)}%`,
                `fully contained features: ${fullyContainedFeatures}, intersecting features: ${intersectingFeatures}, outside features: ${outsideFeatures}, total features: ${i}`
              );
            }
            const classification = containerIndex.classify(f);
            if (classification === "inside") {
              // classifiedLand.addFeature({
              //   type: "Feature",
              //   geometry: f.geometry,
              //   properties: {
              //     class: "inside",
              //     __offset: f.properties?.__offset,
              //   },
              // });
              overlappingDifferenceFeaturesSqKm += area(f) / 1_000_000;
              fullyContainedFeatures++;
            } else if (classification === "mixed") {
              // classifiedLand.addFeature({
              //   type: "Feature",
              //   geometry: f.geometry,
              //   properties: {
              //     class: "mixed",
              //     __offset: f.properties?.__offset,
              //   },
              // });
              intersectingFeatures++;
              mixedGeoms.push(f.geometry.coordinates as polygonClipping.Geom);
              mixedGeomsBytes += f.properties?.__byteLength || 0;
              if (mixedGeomsBytes > 10_000) {
                console.log(
                  `calculating intersection of mixed geoms. ${mixedGeomsBytes} bytes, ${mixedGeoms.length} geoms`
                );
                for (const geom of mixedGeoms) {
                  const overlap = intersection([intersectionFeature, geom]);
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
                    overlappingDifferenceFeaturesSqKm += overlappingSqKm;
                    console.log("overlapping sq km", overlappingSqKm);
                  }
                }
                mixedGeoms = [];
                mixedGeomsBytes = 0;
              }
            } else {
              // outside
              // classifiedLand.addFeature({
              //   type: "Feature",
              //   geometry: f.geometry,
              //   properties: {
              //     class: "outside",
              //     __offset: f.properties?.__offset,
              //   },
              // });
              outsideFeatures++;
            }
          }
        }
        if (mixedGeoms.length > 0) {
          console.log(
            `calculating intersection of mixed geoms. ${mixedGeomsBytes} bytes, ${mixedGeoms.length} geoms`
          );
          for (const geom of mixedGeoms) {
            const overlap = intersection([intersectionFeature, geom]);
            if (overlap) {
              const overlappingSqKm =
                area({
                  type: "Feature",
                  geometry: { type: "MultiPolygon", coordinates: overlap },
                  properties: {},
                }) / 1_000_000;
              console.log("overlapping sq km", overlappingSqKm);
              overlappingDifferenceFeaturesSqKm += overlappingSqKm;
            }
          }
          mixedGeoms = [];
          mixedGeomsBytes = 0;
        }
        console.log(
          `fully contained features: ${fullyContainedFeatures}, intersecting features: ${intersectingFeatures}, outside features: ${outsideFeatures}, total features: ${i}`
        );
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
      intersectionFeature = difference([
        intersectionFeature,
        ...differenceGeoms,
      ]);
    }

    const productGeojson = {
      type: "Feature",
      geometry: { type: "MultiPolygon", coordinates: intersectionFeature },
      properties: {},
    } as Feature<MultiPolygon>;

    console.log("product made, calculate area");
    const sqKm = area(productGeojson) / 1_000_000;
    console.log({
      sqKm,
      overlappingDifferenceFeaturesSqKm,
      total: sqKm - overlappingDifferenceFeaturesSqKm,
    });
    // await classifiedLand.close();
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
