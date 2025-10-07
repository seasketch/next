import { SourceCache } from "fgb-source";
import { SourceType } from "./metrics/metrics";
import { Feature, MultiPolygon, Polygon } from "geojson";
import * as clipping from "polyclip-ts";
import calcBBox from "@turf/bbox";
import calcArea from "@turf/area";
import { bboxToEnvelope } from "./utils/bboxUtils";
import { guaranteeHelpers, OverlayWorkerHelpers } from "./utils/helpers";

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
    sourceUrl
  );
  helpers.timeEnd("initializing source");
  const estimate = await source.search(envelope);
  helpers.log(
    `Querying source. Estimated features: ${estimate.features}, estimated bytes: ${estimate.bytes}`
  );
  helpers.progress(0, `Processing ${estimate.features} features`);
  helpers.time("time to first feature");
  for await (const feature of source.getFeaturesAsync(envelope)) {
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
    const clipped = clipping.intersection(
      geom,
      feature.geometry.coordinates as clipping.Geom
    );
    totalAreas[classKey] +=
      calcArea({
        type: "Feature",
        geometry: {
          type: "MultiPolygon",
          coordinates: clipped,
        },
        properties: {},
      }) / 1_000_000;
  }
  if (groupBy) {
    return totalAreas;
  }
  return totalAreas["*"];
}
