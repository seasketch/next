import { FeatureWithMetadata, SourceCache } from "fgb-source";
import { SourceType } from "./metrics/metrics";
import { Feature, MultiPolygon, Polygon } from "geojson";
import * as clipping from "polyclip-ts";
import calcBBox from "@turf/bbox";
import calcArea from "@turf/area";
import { bboxToEnvelope } from "./utils/bboxUtils";
import { guaranteeHelpers, OverlayWorkerHelpers } from "./utils/helpers";
import { ContainerIndex } from "./utils/containerIndex";
import simplify from "@turf/simplify";
import { groupGeomsByClassKey } from "./geographies/calculateOverlap";

/**
 *
 * @deprecated Use the OverlappingAreaBatchedClippingProcessor instead.
 */
export async function calculateFragmentOverlap(
  fragment: Feature<Polygon>,
  sourceCache: SourceCache,
  sourceUrl: string,
  sourceType: SourceType,
  groupBy?: string,
  helpersOption?: OverlayWorkerHelpers
) {
  const helpers = guaranteeHelpers(helpersOption);
  if (sourceType !== "FlatGeobuf") {
    throw new Error(`Unsupported source type: ${sourceType}`);
  }
  let totalAreas: { [classKey: string]: number } = {};
  const bbox = calcBBox(fragment);
  const envelope = bboxToEnvelope(bbox);
  const geom = fragment.geometry.coordinates as clipping.Geom;
  let featuresProcessed = 0;
  helpers.time("initializing source");
  const source = await sourceCache.get<Feature<Polygon | MultiPolygon>>(
    sourceUrl,
    {
      pageSize: "5MB",
    }
  );
  helpers.time("Creating container index");
  const containerIndex = new ContainerIndex(
    simplify(fragment, {
      tolerance: 0.002,
    })
  );
  helpers.timeEnd("Creating container index");
  helpers.timeEnd("initializing source");
  const estimate = await source.search(envelope);
  helpers.log(
    `Querying source. Estimated features: ${estimate.features}, estimated bytes: ${estimate.bytes}`
  );
  helpers.progress(0, `Processing ${estimate.features} features`);
  const queryPlan = source.createPlan(envelope);
  console.log(
    `Query plan: ${queryPlan.pages.length} pages, ${queryPlan.pages.reduce(
      (acc, page) => acc + (page.range[1] ?? 0) - (page.range[0] ?? 0),
      0
    )} bytes`
  );
  helpers.time("time to first feature");
  let clippingPerformed = 0;
  const clippingBatchProcessor = new BatchProcessor(
    1024 * 1024 * 5,
    (batch) => {
      console.time("clipping batch");
      console.log(`processing batch of ${batch.length} features`);
      const geoms = groupGeomsByClassKey(batch, groupBy);
      console.log(`grouped into ${Object.keys(geoms).length} classes`);
      for (const classKey in geoms) {
        console.log(
          `processing class ${classKey}. ${geoms[classKey].length} geoms`
        );
        const intersection = clipping.intersection(geom, ...geoms[classKey]);
        totalAreas[classKey] +=
          calcArea({
            type: "Feature",
            geometry: { type: "MultiPolygon", coordinates: intersection },
            properties: {},
          }) / 1_000_000;
        clippingPerformed++;
      }
      console.timeEnd("clipping batch");
    }
  );
  for await (const feature of source.getFeaturesAsync(envelope, {
    queryPlan,
  })) {
    if (featuresProcessed === 0) {
      helpers.timeEnd("time to first feature");
    }
    featuresProcessed++;
    const percent = (featuresProcessed / estimate.features) * 100;
    helpers.progress(
      percent,
      `Processing features: (${featuresProcessed}/${estimate.features})`
    );
    const classKey = groupBy ? feature.properties[groupBy] : "*";
    if (!totalAreas[classKey]) {
      totalAreas[classKey] = 0;
    }
    const classification = containerIndex.classify(feature);
    if (classification === "outside") {
      // console.log(`outside ${featuresProcessed}/${estimate.features}`);
      continue;
    } else if (classification === "mixed") {
      // console.log(`mixed ${featuresProcessed}/${estimate.features}`);
      // clippingPerformed++;
      // const clipped = clipping.intersection(
      //   geom,
      //   feature.geometry.coordinates as clipping.Geom
      // );
      // totalAreas[classKey] +=
      //   calcArea({
      //     type: "Feature",
      //     geometry: {
      //       type: "MultiPolygon",
      //       coordinates: clipped,
      //     },
      //     properties: {},
      //   }) / 1_000_000;
      clippingBatchProcessor.addFeature(feature);
    } else {
      if (feature.properties?.__area === undefined) {
        console.warn(
          `undefined area in completely-inside feature. ${featuresProcessed}/${estimate.features}`
        );
      }
      // completely inside
      totalAreas[classKey] +=
        feature.properties?.__area || calcArea(feature) / 1_000_000;
    }
  }
  clippingBatchProcessor.flush();
  console.log(
    `clipping performed: ${clippingPerformed}, features processed: ${featuresProcessed}`
  );
  if (groupBy) {
    return totalAreas;
  }
  return totalAreas["*"];
}

class BatchProcessor<
  T extends FeatureWithMetadata<Feature<Polygon | MultiPolygon>>
> {
  batchSize: number;
  batch = [] as T[];
  bytes = 0;
  processBatch: (batch: T[]) => void;

  constructor(batchSize: number, processBatch: (batch: T[]) => void) {
    this.batchSize = batchSize;
    this.processBatch = processBatch;
  }

  addFeature(feature: T) {
    if (this.batch.length >= this.batchSize) {
      this.processBatch(this.batch);
      this.batch = [];
      this.bytes = 0;
    }
    this.batch.push(feature);
    this.bytes += feature.properties?.__byteLength || 0;
  }

  flush() {
    this.processBatch(this.batch);
    this.batch = [];
    this.bytes = 0;
  }
}
