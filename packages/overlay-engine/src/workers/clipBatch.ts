import { FeatureWithMetadata } from "fgb-source";
import {
  Feature,
  Geometry,
  LineString,
  MultiLineString,
  MultiPolygon,
  Point,
  Polygon,
  Position,
} from "geojson";
import * as clipping from "polyclip-ts";
import calcArea from "@turf/area";
import { parentPort } from "node:worker_threads";
import pip from "point-in-polygon-hao";
import booleanIntersects from "@turf/boolean-intersects";
import { PresenceTableValue } from "../metrics/metrics";
import turfLength from "@turf/length";
import booleanWithin from "@turf/boolean-within";
import booleanDisjoint from "@turf/boolean-disjoint";
import lineSplit from "@turf/line-split";
import along from "@turf/along";

export async function clipBatch({
  features,
  differenceMultiPolygon,
  subjectFeature,
  groupBy,
}: {
  features: {
    feature: FeatureWithMetadata<
      Feature<Polygon | MultiPolygon | LineString | MultiLineString>
    >;
    requiresIntersection: boolean;
    requiresDifference: boolean;
  }[];
  differenceMultiPolygon: clipping.Geom[];
  subjectFeature: Feature<Polygon | MultiPolygon>;
  groupBy?: string;
}) {
  const results: { [classKey: string]: number } = { "*": 0 };
  if (groupBy) {
    const classKeys = ["*"];
    for (const f of features) {
      const classKey = f.feature.properties?.[groupBy];
      if (classKey && !classKeys.includes(classKey)) {
        classKeys.push(classKey);
        results[classKey] = 0;
      }
    }
    for (const classKey of classKeys) {
      if (classKey === "*") {
        continue;
      }
      const size = calculatedClippedOverlapSize(
        features.filter((f) => f.feature.properties?.[groupBy!] === classKey),
        differenceMultiPolygon,
        subjectFeature
      );
      results[classKey] += size;
      results["*"] += size;
    }
  } else {
    const size = calculatedClippedOverlapSize(
      features,
      differenceMultiPolygon,
      subjectFeature
    );
    results["*"] += size;
  }
  return results;
}

function calcSize(
  feature: Feature<Polygon | MultiPolygon | LineString | MultiLineString>
) {
  if (
    feature.geometry.type === "Polygon" ||
    feature.geometry.type === "MultiPolygon"
  ) {
    return calcArea(feature) * 1e-6;
  } else if (
    feature.geometry.type === "LineString" ||
    feature.geometry.type === "MultiLineString"
  ) {
    return turfLength(feature, { units: "kilometers" });
  }
  return 0;
}

export function calculatedClippedOverlapSize(
  features: {
    feature: FeatureWithMetadata<
      Feature<Polygon | MultiPolygon | LineString | MultiLineString>
    >;
    requiresIntersection: boolean;
    requiresDifference: boolean;
  }[],
  differenceGeoms: clipping.Geom[],
  subjectFeature: Feature<Polygon | MultiPolygon>
): number {
  if (
    features[0].feature.geometry.type === "Polygon" ||
    features[0].feature.geometry.type === "MultiPolygon"
  ) {
    let product: clipping.Geom = [];
    let forClipping: clipping.Geom = [];
    for (const f of features) {
      const target = f.requiresIntersection ? forClipping : product;
      if (f.feature.geometry.type === "Polygon") {
        // @ts-ignore
        target.push(f.feature.geometry.coordinates);
      } else {
        for (const poly of f.feature.geometry.coordinates) {
          // @ts-ignore
          target.push(poly as clipping.Geom);
        }
      }
    }
    if (forClipping.length > 0) {
      const result = clipping.intersection(
        forClipping,
        subjectFeature.geometry.coordinates as clipping.Geom
      );
      if (result.length > 0) {
        // @ts-ignore
        product.push(...result);
      }
    }

    const difference = clipping.difference(product, ...differenceGeoms);

    return calcSize({
      type: "Feature",
      geometry: {
        type: "MultiPolygon",
        coordinates: difference,
      },
      properties: {},
    } as Feature<MultiPolygon>);
  } else if (
    features[0].feature.geometry.type === "LineString" ||
    features[0].feature.geometry.type === "MultiLineString"
  ) {
    let totalLength = 0;
    for (const f of features) {
      const processed = performOperationsOnFeature(
        f.feature,
        f.requiresIntersection,
        f.requiresDifference,
        differenceGeoms,
        subjectFeature
      );
      if (
        processed.geometry.type === "LineString" ||
        processed.geometry.type === "MultiLineString"
      ) {
        totalLength += calcSize(
          processed as Feature<LineString | MultiLineString>
        );
      }
    }
    return totalLength;
  }
  return 0;
}

export async function countFeatures({
  features,
  differenceMultiPolygon,
  subjectFeature,
  groupBy,
}: {
  features: {
    feature: FeatureWithMetadata<Feature<Geometry>>;
    requiresIntersection: boolean;
    requiresDifference: boolean;
  }[];
  differenceMultiPolygon: clipping.Geom[];
  subjectFeature: Feature<Polygon | MultiPolygon>;
  groupBy?: string;
}) {
  const results: { [classKey: string]: Set<number> } = { "*": new Set() };
  for (const f of features) {
    if (f.requiresIntersection) {
      throw new Error(
        "Not implemented. If just counting features, they should never be added to the batch if unsure if they lie within the subject feature."
      );
    }
    if (f.requiresDifference) {
      if (
        f.feature.geometry.type === "Point" ||
        f.feature.geometry.type === "MultiPoint"
      ) {
        const coords =
          f.feature.geometry.type === "Point"
            ? [f.feature.geometry.coordinates]
            : f.feature.geometry.coordinates;
        for (const coord of coords) {
          let anyMisses = false;
          for (const poly of differenceMultiPolygon) {
            const r = pip(coord, poly as number[][][]);
            if (r === false) {
              anyMisses = true;
              break;
            }
          }
          if (!anyMisses) {
            continue;
          }
        }
      } else {
        // for any other geometry type, we'll use booleanIntersects to check if
        // the feature intersects the difference feature
        if (
          booleanIntersects(f.feature, {
            type: "Feature",
            geometry: {
              type: "MultiPolygon",
              coordinates: differenceMultiPolygon,
            },
            properties: {},
          })
        ) {
          continue;
        }
      }
    }
    if (!("__oidx" in f.feature.properties || {})) {
      throw new Error("Feature properties must contain __oidx");
    }
    if (groupBy) {
      const classKey = f.feature.properties?.[groupBy];
      if (classKey) {
        if (!(classKey in results)) {
          results[classKey] = new Set();
        }
        results[classKey].add(f.feature.properties.__oidx);
      }
    }
    results["*"].add(f.feature.properties.__oidx);
  }
  return Object.fromEntries(
    Object.entries(results).map(([key, value]) => [key, Array.from(value)])
  );
}

export async function testForPresenceInSubject({
  features,
  differenceMultiPolygon,
  subjectFeature,
}: {
  features: {
    feature: FeatureWithMetadata<Feature<Geometry>>;
    requiresIntersection: boolean;
    requiresDifference: boolean;
  }[];
  differenceMultiPolygon: clipping.Geom[];
  subjectFeature: Feature<Polygon | MultiPolygon>;
}) {
  // Tests whether any features in the feature array are present in the subject
  // feature. If any of those features are in the subject but also in the
  // difference feature, they don't count as a match. This function will return
  // tru as soon as it finds any match.
  for (const f of features) {
    if (f.requiresIntersection) {
      if (!booleanIntersects(f.feature, subjectFeature)) {
        continue;
      }
    }
    if (f.requiresDifference) {
      if (
        booleanIntersects(f.feature, {
          type: "Feature",
          properties: {},
          geometry: {
            type: "MultiPolygon",
            coordinates: differenceMultiPolygon,
          },
        })
      ) {
        continue;
      }
    }
    return true;
  }
  return false;
}

export async function createPresenceTable({
  features,
  differenceMultiPolygon,
  subjectFeature,
  limit = 50,
  includedProperties,
}: {
  features: {
    feature: FeatureWithMetadata<Feature<Geometry>>;
    requiresIntersection: boolean;
    requiresDifference: boolean;
  }[];
  differenceMultiPolygon: clipping.Geom[];
  subjectFeature: Feature<Polygon | MultiPolygon>;
  limit?: number;
  includedProperties?: string[];
}) {
  const results: { exceededLimit: boolean; values: PresenceTableValue[] } = {
    exceededLimit: false,
    values: [],
  };
  for (const f of features) {
    if (results.exceededLimit) {
      break;
    }
    if (f.requiresIntersection) {
      throw new Error(
        "Not implemented. If just counting features, they should never be added to the batch if unsure if they lie within the subject feature."
      );
    }
    if (f.requiresDifference) {
      if (
        f.feature.geometry.type === "Point" ||
        f.feature.geometry.type === "MultiPoint"
      ) {
        const coords =
          f.feature.geometry.type === "Point"
            ? [f.feature.geometry.coordinates]
            : f.feature.geometry.coordinates;
        for (const coord of coords) {
          let anyMisses = false;
          for (const poly of differenceMultiPolygon) {
            const r = pip(coord, poly as number[][][]);
            if (r === false) {
              anyMisses = true;
              break;
            }
          }
          if (!anyMisses) {
            continue;
          }
        }
      } else {
        // for any other geometry type, we'll use booleanIntersects to check if
        // the feature intersects the difference feature
        if (
          booleanIntersects(f.feature, {
            type: "Feature",
            geometry: {
              type: "MultiPolygon",
              coordinates: differenceMultiPolygon,
            },
            properties: {},
          })
        ) {
          continue;
        }
      }
    }
    if (!("__oidx" in f.feature.properties || {})) {
      throw new Error("Feature properties must contain __oidx");
    }
    let result = {
      __id: f.feature.properties.__oidx,
      ...f.feature.properties,
    };
    result = pick(result, includedProperties);
    results.values.push(result);
    if (results.values.length >= limit) {
      results.exceededLimit = true;
    }
  }
  return results;
}

export type ColumnValues =
  | [
      /** column value */
      number | string | boolean,
      /* area of overlap (in sq meters) if feature is polygonal, or length in meters if feature is linestring */
      number
    ]
  | [
      /** column value */
      number | string | boolean
    ];

export async function collectColumnValues({
  features,
  differenceMultiPolygon,
  subjectFeature,
  property,
  groupBy,
}: {
  features: {
    feature: FeatureWithMetadata<Feature<Geometry>>;
    requiresIntersection: boolean;
    requiresDifference: boolean;
  }[];
  differenceMultiPolygon: clipping.Geom[];
  subjectFeature: Feature<Polygon | MultiPolygon>;
  property: string;
  groupBy?: string;
}) {
  const results: { [classKey: string]: ColumnValues[] } = { "*": [] };
  for (const f of features) {
    if (
      f.feature.geometry.type === "Point" ||
      f.feature.geometry.type === "MultiPoint"
    ) {
      if (f.requiresIntersection) {
        throw new Error(
          "Not implemented. If just collecting column values for points. They should never be added to the batch if unsure if they lie within the subject feature."
        );
      }
      if (f.requiresDifference) {
        if (
          f.feature.geometry.type === "Point" ||
          f.feature.geometry.type === "MultiPoint"
        ) {
          const coords =
            f.feature.geometry.type === "Point"
              ? [f.feature.geometry.coordinates]
              : f.feature.geometry.coordinates;
          for (const coord of coords) {
            let anyMisses = false;
            for (const poly of differenceMultiPolygon) {
              const r = pip(coord, poly as number[][][]);
              if (r === false) {
                anyMisses = true;
                break;
              }
            }
            if (!anyMisses) {
              continue;
            }
          }
        }
      }
    } else if (
      f.feature.geometry.type === "Polygon" ||
      f.feature.geometry.type === "MultiPolygon" ||
      f.feature.geometry.type === "LineString" ||
      f.feature.geometry.type === "MultiLineString"
    ) {
      f.feature = performOperationsOnFeature(
        f.feature,
        f.requiresIntersection,
        f.requiresDifference,
        differenceMultiPolygon,
        subjectFeature
      );
    }
    const value = f.feature.properties?.[property];
    const columnValue: ColumnValues = [value];
    if (
      f.feature.geometry.type === "Polygon" ||
      f.feature.geometry.type === "MultiPolygon"
    ) {
      const sqKm = calcArea(f.feature) * 1e-6;
      if (isNaN(sqKm) || sqKm === 0) {
        continue;
      }
      columnValue.push(sqKm);
    } else if (
      f.feature.geometry.type === "LineString" ||
      f.feature.geometry.type === "MultiLineString"
    ) {
      const length = turfLength(f.feature);
      if (isNaN(length) || length === 0) {
        continue;
      }
      columnValue.push(length);
    }
    if (
      typeof value === "number" ||
      typeof value === "string" ||
      typeof value === "boolean"
    ) {
      results["*"].push(columnValue);
      if (groupBy) {
        const classKey = f.feature.properties?.[groupBy];
        if (classKey) {
          if (!(classKey in results)) {
            results[classKey] = [];
          }
          results[classKey].push(columnValue);
        }
      }
    }
  }
  return results;
}

parentPort?.on(
  "message",
  async (job: {
    operation?:
      | "overlay_area"
      | "count"
      | "presence"
      | "presence_table"
      | "column_values";
    features: {
      feature: FeatureWithMetadata<Feature<Geometry>>;
      requiresIntersection: boolean;
      requiresDifference: boolean;
    }[];
    differenceMultiPolygon: clipping.Geom[];
    subjectFeature: Feature<Polygon | MultiPolygon>;
    groupBy?: string;
    limit?: number;
    includedProperties?: string[];
    property?: string;
  }) => {
    try {
      const operation = job.operation || "overlay_area"; // Default to overlay_area for backward compatibility
      let result;
      if (operation === "overlay_area") {
        result = await clipBatch({
          features: job.features as {
            feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon>>;
            requiresIntersection: boolean;
            requiresDifference: boolean;
          }[],
          differenceMultiPolygon: job.differenceMultiPolygon,
          subjectFeature: job.subjectFeature,
          groupBy: job.groupBy,
        });
      } else if (operation === "count") {
        result = await countFeatures({
          features: job.features,
          differenceMultiPolygon: job.differenceMultiPolygon,
          subjectFeature: job.subjectFeature,
          groupBy: job.groupBy,
        });
      } else if (operation === "presence") {
        result = await testForPresenceInSubject({
          features: job.features,
          differenceMultiPolygon: job.differenceMultiPolygon,
          subjectFeature: job.subjectFeature,
        });
      } else if (operation === "presence_table") {
        result = await createPresenceTable({
          features: job.features,
          differenceMultiPolygon: job.differenceMultiPolygon,
          subjectFeature: job.subjectFeature,
          limit: job.limit,
          includedProperties: job.includedProperties,
        });
      } else if (operation === "column_values") {
        if (!job.property) {
          throw new Error("property is required for column_values operation");
        }
        result = await collectColumnValues({
          features: job.features,
          differenceMultiPolygon: job.differenceMultiPolygon,
          subjectFeature: job.subjectFeature,
          property: job.property,
          groupBy: job.groupBy,
        });
      } else {
        throw new Error(`Unknown operation type: ${operation}`);
      }
      parentPort?.postMessage({ ok: true, result });
    } catch (err) {
      parentPort?.postMessage({
        ok: false,
        error: { message: (err as Error).message, stack: (err as Error).stack },
      });
    }
  }
);

export function pick(object: any, keys?: string[]) {
  keys = keys || Object.keys(object);
  keys = keys.filter(
    (key) =>
      key !== "__oidx" &&
      key !== "__byteLength" &&
      key !== "__area" &&
      key !== "__offset"
  );
  return keys.reduce((acc, key) => {
    acc[key] = object[key];
    return acc;
  }, {} as any);
}

function performOperationsOnFeature(
  feature: FeatureWithMetadata<Feature<Geometry>>,
  requiresIntersection: boolean,
  requiresDifference: boolean,
  differenceMultiPolygon: clipping.Geom[],
  subjectFeature: Feature<Polygon | MultiPolygon>
) {
  // Clone the feature to avoid modifying the original
  let result = JSON.parse(JSON.stringify(feature)) as typeof feature;
  if (
    result.geometry.type === "Polygon" ||
    result.geometry.type === "MultiPolygon"
  ) {
    let geom =
      result.geometry.type === "Polygon"
        ? ([result.geometry.coordinates] as clipping.Geom)
        : (result.geometry.coordinates as clipping.Geom);
    if (requiresIntersection) {
      geom = clipping.intersection(
        geom,
        subjectFeature.geometry.coordinates as clipping.Geom
      );
    }
    if (requiresDifference) {
      geom = clipping.difference(geom, ...differenceMultiPolygon);
    }
    result.geometry = {
      type: "MultiPolygon",
      coordinates: geom as Position[][][],
    };
  } else if (
    result.geometry.type === "LineString" ||
    result.geometry.type === "MultiLineString"
  ) {
    let multiLine = toMultiLineCoordinates(result.geometry);
    if (requiresIntersection) {
      multiLine = clipLinesWithPolygon(multiLine, subjectFeature, "intersect");
    }
    if (requiresDifference && differenceMultiPolygon.length > 0) {
      for (const geom of differenceMultiPolygon) {
        if (multiLine.length === 0) {
          break;
        }
        if (!geom || geom.length === 0) {
          continue;
        }
        const differenceFeature = geomToMultiPolygonFeature(geom);
        multiLine = clipLinesWithPolygon(
          multiLine,
          differenceFeature,
          "difference"
        );
      }
    }
    result.geometry = {
      type: "MultiLineString",
      coordinates: multiLine,
    };
  } else {
    throw new Error(
      `Unsupported geometry type: ${(feature.geometry as any).type}`
    );
  }
  return result as typeof feature;
}

type MultiLineCoordinates = Position[][];
type LineClipMode = "intersect" | "difference";

function toMultiLineCoordinates(
  geometry: LineString | MultiLineString
): MultiLineCoordinates {
  if (geometry.type === "LineString") {
    return [cloneLineCoordinates(geometry.coordinates)];
  }
  return geometry.coordinates.map((line) => cloneLineCoordinates(line));
}

function clipLinesWithPolygon(
  lines: MultiLineCoordinates,
  polygon: Feature<Polygon | MultiPolygon>,
  mode: LineClipMode
): MultiLineCoordinates {
  if (lines.length === 0) {
    return [];
  }
  const keepInside = mode === "intersect";
  const result: MultiLineCoordinates = [];
  for (const coords of lines) {
    const filtered = filterLineStringAgainstPolygon(
      coords,
      polygon,
      keepInside
    );
    if (filtered.length > 0) {
      result.push(...filtered);
    }
  }
  return result;
}

function filterLineStringAgainstPolygon(
  coords: Position[],
  polygon: Feature<Polygon | MultiPolygon>,
  keepInside: boolean
): MultiLineCoordinates {
  if (coords.length < 2) {
    return [];
  }
  const line: Feature<LineString> = {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: coords,
    },
    properties: {},
  };
  // Line fully within polygon
  if (booleanWithin(line, polygon)) {
    return keepInside ? [cloneLineCoordinates(coords)] : [];
  }
  // Line fully outside polygon
  if (booleanDisjoint(polygon, line)) {
    return keepInside ? [] : [cloneLineCoordinates(coords)];
  }
  // Line intersects polygon - split and check each segment
  const split = lineSplit(line, polygon);
  const segments: MultiLineCoordinates = [];
  for (const segment of split.features) {
    if (segment.geometry.type !== "LineString") {
      continue;
    }
    if (segment.geometry.coordinates.length < 2) {
      continue;
    }
    const segmentFeature = segment as Feature<LineString>;
    // Filter out very small segments (< 0.2 meters) to avoid precision issues
    const segmentLengthKm = turfLength(segmentFeature, {
      units: "kilometers",
    });
    const segmentLengthMeters = segmentLengthKm * 1000;
    if (segmentLengthMeters <= 0.2) {
      continue;
    }

    const samplePoint = samplePointOnSegment(segmentFeature, segmentLengthKm);
    const inside = samplePoint
      ? booleanWithin(samplePoint, polygon)
      : booleanWithin(segmentFeature, polygon);

    if ((keepInside && inside) || (!keepInside && !inside)) {
      segments.push(cloneLineCoordinates(segment.geometry.coordinates));
    }
  }
  return segments;
}

function cloneLineCoordinates(coords: Position[]): Position[] {
  return coords.map((pt) => pt.slice() as Position);
}

function samplePointOnSegment(
  segment: Feature<LineString>,
  segmentLengthKm: number
): Feature<Point> | null {
  const distanceKm = Math.max(segmentLengthKm / 2, 1e-6);
  try {
    const sampled = along(segment, distanceKm, { units: "kilometers" });
    if (sampled?.geometry?.type === "Point") {
      return sampled as Feature<Point>;
    }
  } catch (err) {
    // Fall through to manual midpoint fallback
  }

  const coords = segment.geometry.coordinates;
  if (!coords || coords.length === 0) {
    return null;
  }
  const midIdx = Math.floor(coords.length / 2);
  const midpoint = coords[midIdx];
  if (!midpoint) {
    return null;
  }
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: midpoint,
    },
    properties: {},
  };
}

function geomToMultiPolygonFeature(
  geom: clipping.Geom
): Feature<Polygon | MultiPolygon> {
  return {
    type: "Feature",
    geometry: {
      type: "MultiPolygon",
      coordinates: geomToMultiPolygonCoordinates(geom),
    },
    properties: {},
  };
}

function geomToMultiPolygonCoordinates(geom: clipping.Geom): Position[][][] {
  if (!geom || geom.length === 0) {
    return [];
  }
  const indicator = (geom as any)?.[0]?.[0]?.[0];
  if (Array.isArray(indicator)) {
    return geom as Position[][][];
  }
  return [geom as Position[][]];
}

// export function lineOverlap(
//   poly: Feature<Polygon | MultiPolygon>,
//   line: FeatureWithMetadata<Feature<LineString | MultiLineString>>
// ): FeatureWithMetadata<Feature<LineString | MultiLineString>> | null {
//   // Line fully within polygon
//   if (booleanWithin(line, poly)) {
//     return line;
//   }

//   // Line fully outside polygon
//   if (booleanDisjoint(poly, line)) {
//     return null;
//   }

//   // Line intersects polygon
//   const splitLines = lineSplit(line, poly);
//   for (const segment of splitLines.features) {
//     if (
//       segment.geometry.type === "LineString" &&
//       turfLength(segment, { units: "meters" }) > 0.2 &&
//       booleanWithin(
//         lineSliceAlong(segment, 0.1, 0.1, { units: "meters" }),
//         poly
//       )
//     ) {
//       results.push(segment);
//     }
//   }
// }
