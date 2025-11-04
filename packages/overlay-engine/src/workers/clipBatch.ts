import { FeatureWithMetadata } from "fgb-source";
import { Feature, MultiPolygon, Polygon } from "geojson";
import * as clipping from "polyclip-ts";
import calcArea from "@turf/area";
import { parentPort } from "node:worker_threads";

let i = 0;
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

parentPort?.on(
  "message",
  async (job: {
    features: {
      feature: FeatureWithMetadata<Feature<Polygon | MultiPolygon>>;
      requiresIntersection: boolean;
      requiresDifference: boolean;
    }[];
    differenceMultiPolygon: clipping.Geom[];
    subjectFeature: Feature<Polygon | MultiPolygon>;
    groupBy?: string;
  }) => {
    try {
      const result = await clipBatch(job);
      parentPort?.postMessage({ ok: true, result });
    } catch (err) {
      parentPort?.postMessage({
        ok: false,
        error: { message: (err as Error).message, stack: (err as Error).stack },
      });
    }
  }
);
