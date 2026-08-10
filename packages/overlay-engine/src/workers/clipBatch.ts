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

/**
 * Per-feature clip record produced only when collecting buffered fragment
 * `overlay_area` overlap metadata (`collectOverlapEntries`). Unbuffered
 * `overlay_area` never emits these. See {@link OverlayAreaOverlapInfo}.
 */
export type OverlayFeatureClipEntry = {
  oidx: number;
  classKey: string;
  /** Area/length of the feature clipped to the buffered subject. */
  clippedArea: number;
  /** Full unclipped feature area/length; equals clippedArea when fully covered. */
  featureArea: number;
  /** Portion of the clipped geometry that lies inside the collar. */
  collarArea: number;
};

export async function clipBatch({
  features,
  differenceMultiPolygon,
  subjectFeature,
  groupBy,
  overlappingFeatures,
  collectOverlapEntries,
  collarFeature,
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
  overlappingFeatures?: boolean;
  /**
   * When true (buffered fragment `overlay_area` only), clip per-feature and
   * attach `__featureEntries` for overlap detection. When false/omitted —
   * the unbuffered default — use the ordinary class-aggregate clip path
   * with no per-feature collar work.
   * @see OverlayAreaOverlapInfo
   */
  collectOverlapEntries?: boolean;
  collarFeature?: Feature<Polygon | MultiPolygon>;
}): Promise<{
  [classKey: string]: number | OverlayFeatureClipEntry[] | undefined;
}> {
  if (collectOverlapEntries) {
    return clipBatchCollectingOverlapEntries({
      features,
      differenceMultiPolygon,
      subjectFeature,
      groupBy,
      collarFeature,
    });
  }

  // Unbuffered / no-overlap-metadata path: aggregate class totals only.
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
        subjectFeature,
        0,
        overlappingFeatures,
      );
      results[classKey] += size;
      results["*"] += size;
    }
  } else {
    const size = calculatedClippedOverlapSize(
      features,
      differenceMultiPolygon,
      subjectFeature,
      0,
      overlappingFeatures,
    );
    results["*"] += size;
  }
  return results;
}

/**
 * Per-feature clip pass used only for buffered fragment `overlay_area`.
 * Produces headline class totals plus collar entries for
 * {@link OverlayAreaOverlapInfo}. Not used when `collectOverlapEntries` is
 * false (unbuffered path).
 */
function clipBatchCollectingOverlapEntries({
  features,
  differenceMultiPolygon,
  subjectFeature,
  groupBy,
  collarFeature,
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
  collarFeature?: Feature<Polygon | MultiPolygon>;
}): {
  [classKey: string]: number | OverlayFeatureClipEntry[] | undefined;
} {
  const results: {
    [classKey: string]: number | OverlayFeatureClipEntry[] | undefined;
  } = { "*": 0 };
  const featureEntries: OverlayFeatureClipEntry[] = [];

  for (const f of features) {
    const classKey =
      (groupBy && f.feature.properties?.[groupBy]
        ? String(f.feature.properties[groupBy])
        : null) || null;

    const clipped = clipSingleFeatureToSubject(
      f,
      differenceMultiPolygon,
      subjectFeature,
    );
    if (!clipped || clipped.size <= 0) {
      continue;
    }

    results["*"] = (results["*"] as number) + clipped.size;
    if (classKey) {
      results[classKey] = ((results[classKey] as number) || 0) + clipped.size;
    }

    const oidx = f.feature.properties?.__oidx;
    if (typeof oidx !== "number") {
      continue;
    }

    let collarArea = 0;
    if (collarFeature && clipped.geometry) {
      collarArea = sizeInsideCollar(clipped.geometry, collarFeature);
    } else if (!collarFeature) {
      // No collar available — treat entire clip as collar (conservative).
      collarArea = clipped.size;
    }

    if (collarArea > 0) {
      const entryClass = classKey || "*";
      featureEntries.push({
        oidx,
        classKey: entryClass,
        clippedArea: clipped.size,
        featureArea: clipped.featureSize,
        collarArea,
      });
    }
  }

  if (featureEntries.length > 0) {
    results.__featureEntries = featureEntries;
  }
  return results;
}

function clipSingleFeatureToSubject(
  f: {
    feature: FeatureWithMetadata<
      Feature<Polygon | MultiPolygon | LineString | MultiLineString>
    >;
    requiresIntersection: boolean;
    requiresDifference: boolean;
  },
  differenceGeoms: clipping.Geom[],
  subjectFeature: Feature<Polygon | MultiPolygon>,
): {
  size: number;
  featureSize: number;
  geometry:
    | Feature<Polygon | MultiPolygon | LineString | MultiLineString>
    | null;
} | null {
  const featureSize = calcSize(f.feature);
  const geomType = f.feature.geometry.type;

  if (geomType === "Polygon" || geomType === "MultiPolygon") {
    let geom: clipping.Geom;
    if (f.feature.geometry.type === "Polygon") {
      geom = [f.feature.geometry.coordinates] as clipping.Geom;
    } else {
      geom = f.feature.geometry.coordinates as clipping.Geom;
    }

    if (f.requiresIntersection) {
      geom = clipping.intersection(
        geom,
        subjectFeature.geometry.coordinates as clipping.Geom,
      );
    }

    if (geom.length > 0 && differenceGeoms.length > 0 && f.requiresDifference) {
      geom = clipping.difference(geom, ...differenceGeoms);
    } else if (geom.length > 0 && differenceGeoms.length > 0) {
      // requiresDifference may be false when ContainerIndex said "inside",
      // but buffered collection still applies differences when present.
      geom = clipping.difference(geom, ...differenceGeoms);
    }

    if (!geom.length) {
      return null;
    }

    const geometry = {
      type: "Feature",
      geometry: {
        type: "MultiPolygon",
        coordinates: geom,
      },
      properties: {},
    } as Feature<MultiPolygon>;

    return {
      size: calcSize(geometry),
      featureSize,
      geometry,
    };
  }

  if (geomType === "LineString" || geomType === "MultiLineString") {
    const processed = performOperationsOnFeature(
      f.feature,
      f.requiresIntersection,
      f.requiresDifference || differenceGeoms.length > 0,
      differenceGeoms,
      subjectFeature,
    );
    if (
      processed.geometry.type !== "LineString" &&
      processed.geometry.type !== "MultiLineString"
    ) {
      return null;
    }
    const geometry = processed as Feature<LineString | MultiLineString>;
    const size = calcSize(geometry);
    if (size <= 0) {
      return null;
    }
    return { size, featureSize, geometry };
  }

  return null;
}

function sizeInsideCollar(
  clipped: Feature<Polygon | MultiPolygon | LineString | MultiLineString>,
  collarFeature: Feature<Polygon | MultiPolygon>,
): number {
  if (
    clipped.geometry.type === "Polygon" ||
    clipped.geometry.type === "MultiPolygon"
  ) {
    let geom: clipping.Geom;
    if (clipped.geometry.type === "Polygon") {
      geom = [clipped.geometry.coordinates] as clipping.Geom;
    } else {
      geom = clipped.geometry.coordinates as clipping.Geom;
    }
    const inside = clipping.intersection(
      geom,
      collarFeature.geometry.coordinates as clipping.Geom,
    );
    if (!inside.length) {
      return 0;
    }
    return calcSize({
      type: "Feature",
      geometry: { type: "MultiPolygon", coordinates: inside },
      properties: {},
    } as Feature<MultiPolygon>);
  }

  // Lines: approximate collar membership via intersection test; if the line
  // intersects the collar, count its full clipped length (conservative).
  try {
    if (booleanIntersects(clipped, collarFeature)) {
      return calcSize(clipped);
    }
  } catch {
    return calcSize(clipped);
  }
  return 0;
}

function calcSize(
  feature: Feature<Polygon | MultiPolygon | LineString | MultiLineString>,
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

const SUBDIVISION_LIMIT = 3;

export function calculatedClippedOverlapSize(
  features: {
    feature: FeatureWithMetadata<
      Feature<Polygon | MultiPolygon | LineString | MultiLineString>
    >;
    requiresIntersection: boolean;
    requiresDifference: boolean;
  }[],
  differenceGeoms: clipping.Geom[],
  subjectFeature: Feature<Polygon | MultiPolygon>,
  subdivisions = 0,
  overlappingFeatures = false,
): number {
  try {
    return calculatedClippedOverlapSizeUnsafe(
      features,
      differenceGeoms,
      subjectFeature,
      overlappingFeatures,
    );
  } catch (e) {
    // If a batch fails, we'll subdivide the batch into smaller buckets
    // recursively to try and calculate overlap with as many features as
    // possible. We'll limit the number of subdivisions to avoid clipping
    // features individually in the worst case, if they are all invalid
    //  geometries.
    subdivisions++;
    if (subdivisions > SUBDIVISION_LIMIT) {
      console.warn(
        `polyclip-ts error on batch of ${features.length} features, reached subdivision limit: ${
          (e as Error).message
        }`,
      );
      return 0;
    }
    if (features.length <= 1) {
      console.warn(
        `polyclip-ts error for single feature, reporting size as 0: ${
          (e as Error).message
        }`,
      );
      return 0;
    }
    console.warn(
      `polyclip-ts error on batch of ${features.length} features, subdividing to isolate bad geometries: ${
        (e as Error).message
      }`,
    );
    const bucketCount = Math.min(5, features.length);
    const bucketSize = Math.ceil(features.length / bucketCount);
    let total = 0;
    for (let i = 0; i < features.length; i += bucketSize) {
      const bucket = features.slice(i, i + bucketSize);
      total += calculatedClippedOverlapSize(
        bucket,
        differenceGeoms,
        subjectFeature,
        subdivisions,
        overlappingFeatures,
      );
    }
    return total;
  }
}

function calculatedClippedOverlapSizeUnsafe(
  features: {
    feature: FeatureWithMetadata<
      Feature<Polygon | MultiPolygon | LineString | MultiLineString>
    >;
    requiresIntersection: boolean;
    requiresDifference: boolean;
  }[],
  differenceGeoms: clipping.Geom[],
  subjectFeature: Feature<Polygon | MultiPolygon>,
  overlappingFeatures = false,
): number {
  if (
    features[0].feature.geometry.type === "Polygon" ||
    features[0].feature.geometry.type === "MultiPolygon"
  ) {
    if (overlappingFeatures) {
      return calculatedClippedOverlapSizePerFeature(
        features,
        differenceGeoms,
        subjectFeature,
      );
    }
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
        subjectFeature.geometry.coordinates as clipping.Geom,
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
        subjectFeature,
      );
      if (
        processed.geometry.type === "LineString" ||
        processed.geometry.type === "MultiLineString"
      ) {
        totalLength += calcSize(
          processed as Feature<LineString | MultiLineString>,
        );
      }
    }
    return totalLength;
  }
  return 0;
}

/**
 * Per-feature clipping path for source layers with overlapping polygons.
 * Each feature is clipped independently so that overlapping areas are counted
 * for every feature rather than being unioned by polyclip-ts.
 */
function calculatedClippedOverlapSizePerFeature(
  features: {
    feature: FeatureWithMetadata<
      Feature<Polygon | MultiPolygon | LineString | MultiLineString>
    >;
    requiresIntersection: boolean;
    requiresDifference: boolean;
  }[],
  differenceGeoms: clipping.Geom[],
  subjectFeature: Feature<Polygon | MultiPolygon>,
): number {
  let totalSize = 0;
  for (const f of features) {
    let geom: clipping.Geom;
    if (f.feature.geometry.type === "Polygon") {
      geom = [f.feature.geometry.coordinates] as clipping.Geom;
    } else {
      geom = f.feature.geometry.coordinates as clipping.Geom;
    }

    if (f.requiresIntersection) {
      geom = clipping.intersection(
        geom,
        subjectFeature.geometry.coordinates as clipping.Geom,
      );
    }

    if (geom.length > 0 && differenceGeoms.length > 0) {
      geom = clipping.difference(geom, ...differenceGeoms);
    }

    if (geom.length > 0) {
      totalSize += calcSize({
        type: "Feature",
        geometry: {
          type: "MultiPolygon",
          coordinates: geom,
        },
        properties: {},
      } as Feature<MultiPolygon>);
    }
  }
  return totalSize;
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
        "Not implemented. If just counting features, they should never be added to the batch if unsure if they lie within the subject feature.",
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
    Object.entries(results).map(([key, value]) => [key, Array.from(value)]),
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
        "Not implemented. If just counting features, they should never be added to the batch if unsure if they lie within the subject feature.",
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

/**
 * Interim record for a single (possibly subdivided) feature part that
 * intersects the subject. Parts are grouped by original feature id when
 * statistics are finalized so that subdivided features are not
 * double-counted.
 */
export type ColumnValues = [
  /** column value */
  number | string | boolean,
  /**
   * Overlap weight: area in sq km if the feature is polygonal, length in km
   * if it is linear, or 0 for unweighted (e.g. point) features.
   */
  number,
  /** `__oidx` of the original (pre-subdivision) feature */
  number,
  /** `__offset` of this part in the FlatGeobuf file */
  number,
];

export async function collectColumnValues({
  features,
  differenceMultiPolygon,
  subjectFeature,
  properties,
  groupBy,
}: {
  features: {
    feature: FeatureWithMetadata<Feature<Geometry>>;
    requiresIntersection: boolean;
    requiresDifference: boolean;
  }[];
  differenceMultiPolygon: clipping.Geom[];
  subjectFeature: Feature<Polygon | MultiPolygon>;
  /** If provided, only values for these columns are collected. */
  properties?: string[];
  groupBy?: string;
}) {
  const results: {
    [classKey: string]: {
      [attr: string]: ColumnValues[];
    };
  } = { "*": {} };
  for (const f of features) {
    if (
      f.feature.geometry.type === "Point" ||
      f.feature.geometry.type === "MultiPoint"
    ) {
      if (f.requiresIntersection) {
        throw new Error(
          "Not implemented. If just collecting column values for points. They should never be added to the batch if unsure if they lie within the subject feature.",
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
        subjectFeature,
      );
    }
    addColumnValuesToResults(results, f.feature, groupBy, properties);
  }
  return results;
}

export function addColumnValuesToResults(
  results: {
    [classKey: string]: {
      [attr: string]: ColumnValues[];
    };
  },
  feature: FeatureWithMetadata<Feature<Geometry>>,
  groupBy?: string,
  properties?: string[],
) {
  // Overlap weight for this (already clipped) part. Calculated once, shared
  // by all collected columns.
  let weight = 0;
  if (
    feature.geometry.type === "Polygon" ||
    feature.geometry.type === "MultiPolygon"
  ) {
    const sqKm = calcArea(feature) * 1e-6;
    if (isNaN(sqKm) || sqKm === 0) {
      return;
    }
    weight = sqKm;
  } else if (
    feature.geometry.type === "LineString" ||
    feature.geometry.type === "MultiLineString"
  ) {
    const length = turfLength(feature);
    if (isNaN(length) || length === 0) {
      return;
    }
    weight = length;
  }
  const offset = feature.properties.__offset;
  // Sources preprocessed for reporting are subdivided and stamp __oidx on
  // each part. Fall back to the part's byte offset for sources without it
  // (no cross-part grouping possible in that case).
  const oidx =
    typeof feature.properties.__oidx === "number"
      ? feature.properties.__oidx
      : offset;
  for (const attr in feature.properties) {
    if (
      attr === "__oidx" ||
      attr === "__byteLength" ||
      attr === "__area" ||
      attr === "__offset"
    ) {
      continue;
    }
    if (
      properties !== undefined &&
      properties.length > 0 &&
      !properties.includes(attr)
    ) {
      continue;
    }
    const value = feature.properties[attr];
    const columnValue: ColumnValues = [value, weight, oidx, offset];
    if (
      typeof value === "number" ||
      typeof value === "string" ||
      typeof value === "boolean"
    ) {
      if (!(attr in results["*"]) || !Array.isArray(results["*"][attr])) {
        results["*"][attr] = [];
      }
      results["*"][attr].push(columnValue);
      if (groupBy) {
        const classKey = feature.properties?.[groupBy];
        if (classKey) {
          if (!(classKey in results)) {
            results[classKey] = {} as { [attr: string]: ColumnValues[] };
          }
          if (
            !(attr in results[classKey]) ||
            !Array.isArray(results[classKey][attr])
          ) {
            results[classKey][attr] = [];
          }
          results[classKey][attr].push(columnValue);
        }
      }
    }
  }
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
    overlappingFeatures?: boolean;
    collectOverlapEntries?: boolean;
    collarFeature?: Feature<Polygon | MultiPolygon>;
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
          overlappingFeatures: job.overlappingFeatures,
          collectOverlapEntries: job.collectOverlapEntries,
          collarFeature: job.collarFeature,
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
        result = await collectColumnValues({
          features: job.features,
          differenceMultiPolygon: job.differenceMultiPolygon,
          subjectFeature: job.subjectFeature,
          properties: job.includedProperties,
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
  },
);

export function pick(object: any, keys?: string[]) {
  keys = keys || Object.keys(object);
  keys = keys.filter(
    (key) =>
      key !== "__oidx" &&
      key !== "__byteLength" &&
      key !== "__area" &&
      key !== "__offset",
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
  subjectFeature: Feature<Polygon | MultiPolygon>,
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
        subjectFeature.geometry.coordinates as clipping.Geom,
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
          "difference",
        );
      }
    }
    result.geometry = {
      type: "MultiLineString",
      coordinates: multiLine,
    };
  } else {
    throw new Error(
      `Unsupported geometry type: ${(feature.geometry as any).type}`,
    );
  }
  return result as typeof feature;
}

type MultiLineCoordinates = Position[][];
type LineClipMode = "intersect" | "difference";

function toMultiLineCoordinates(
  geometry: LineString | MultiLineString,
): MultiLineCoordinates {
  if (geometry.type === "LineString") {
    return [cloneLineCoordinates(geometry.coordinates)];
  }
  return geometry.coordinates.map((line) => cloneLineCoordinates(line));
}

function clipLinesWithPolygon(
  lines: MultiLineCoordinates,
  polygon: Feature<Polygon | MultiPolygon>,
  mode: LineClipMode,
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
      keepInside,
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
  keepInside: boolean,
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
  segmentLengthKm: number,
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
  geom: clipping.Geom,
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
