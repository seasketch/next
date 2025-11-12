import { FeatureWithMetadata } from "fgb-source";
import { Feature, Geometry, MultiPolygon, Polygon } from "geojson";
import * as clipping from "polyclip-ts";
import calcArea from "@turf/area";
import { parentPort } from "node:worker_threads";
import pip from "point-in-polygon-hao";
import booleanIntersects from "@turf/boolean-intersects";

export async function clipBatch({
  features,
  differenceMultiPolygon,
  subjectFeature,
  groupBy,
}: {
  features: {
    feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon>>;
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
      const area = await performClipping(
        features.filter((f) => f.feature.properties?.[groupBy!] === classKey),
        differenceMultiPolygon,
        subjectFeature
      );
      results[classKey] += area;
      results["*"] += area;
    }
  } else {
    const area = await performClipping(
      features,
      differenceMultiPolygon,
      subjectFeature
    );
    results["*"] += area;
  }
  return results;
}

export async function performClipping(
  features: {
    feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon>>;
    requiresIntersection: boolean;
    requiresDifference: boolean;
  }[],
  differenceGeoms: clipping.Geom[],
  subjectFeature: Feature<Polygon | MultiPolygon>
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

  const sqKm =
    calcArea({
      type: "Feature",
      geometry: {
        type: "MultiPolygon",
        coordinates: difference,
      },
      properties: {},
    }) * 1e-6;
  return sqKm;
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

parentPort?.on(
  "message",
  async (job: {
    operation?: "overlay_area" | "count";
    features: {
      feature: FeatureWithMetadata<Feature<Geometry>>;
      requiresIntersection: boolean;
      requiresDifference: boolean;
    }[];
    differenceMultiPolygon: clipping.Geom[];
    subjectFeature: Feature<Polygon | MultiPolygon>;
    groupBy?: string;
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
        console.log("running countFeatures");
        result = await countFeatures({
          features: job.features,
          differenceMultiPolygon: job.differenceMultiPolygon,
          subjectFeature: job.subjectFeature,
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
