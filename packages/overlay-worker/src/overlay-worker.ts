import {
  calculateArea,
  calculateFragmentOverlap,
  calculateGeographyOverlap,
  Cql2Query,
  initializeGeographySources,
  MetricSubjectFragment,
  MetricSubjectGeography,
} from "overlay-engine";
import {
  FragmentSubjectPayload,
  GeographySubjectPayload,
  OverlayWorkerPayload,
} from "./types";
import { FlatGeobufSource, SourceCache } from "fgb-source";
import {
  sendBeginMessage,
  sendErrorMessage,
  sendResultMessage,
  flushMessages,
} from "./messaging";
import { ProgressNotifier } from "./ProgressNotifier";
import * as geobuf from "geobuf";
import Pbf from "pbf";
import {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  MultiPolygon,
  Polygon,
} from "geojson";
import { fetch, Client, Pool } from "undici";
import { LRUCache } from "lru-cache";
import {
  createClippingWorkerPool,
  OverlayEngineBatchProcessor,
} from "overlay-engine/src/OverlayEngineBatchProcessor";
import simplify from "@turf/simplify";
import {
  GuaranteedOverlayWorkerHelpers,
  guaranteeHelpers,
} from "overlay-engine/src/utils/helpers";

const pool = new Pool(`https://uploads.seasketch.org`, {
  // 10 second timeout for body
  bodyTimeout: 10 * 1000,
});

const cache = new LRUCache<string, ArrayBuffer>({
  maxSize: 1000 * 1024 * 128, // 128 MB
  sizeCalculation: (value, key) => {
    return value.byteLength;
  },
});

const inFlightRequests = new Map<string, Promise<ArrayBuffer>>();

const sourceCache = new SourceCache("1GB", {
  fetchRangeFn: (url, range) => {
    // console.log("fetching", url, range);
    const cacheKey = `${url} range=${range[0]}-${range[1] ? range[1] : ""}`;
    // console.time(cacheKey);
    const cached = cache.get(cacheKey);
    if (cached) {
      // console.timeEnd(cacheKey);
      // console.log("cache hit", cacheKey);
      return Promise.resolve(cached);
    } else if (inFlightRequests.has(cacheKey)) {
      // console.log("in-flight request hit", cacheKey);
      return inFlightRequests.get(cacheKey) as Promise<ArrayBuffer>;
    } else {
      // console.log("cache miss", cacheKey);
      return pool
        .request({
          path: url.replace("https://uploads.seasketch.org", ""),
          method: "GET",
          headers: {
            Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}`,
          },
        })
        .then(async (response) => {
          const buffer = await response.body.arrayBuffer();
          // console.log("fetched", cacheKey, buffer.byteLength);
          return buffer;
        })
        .then((buffer) => {
          // console.timeEnd(cacheKey);
          cache.set(cacheKey, buffer);
          // console.log("response", response.headers.get("x-cache-status"));
          return buffer;
        })
        .catch((e) => {
          console.log("rethrowing error for", cacheKey);
          // rethrow error with enhanced error message consisting of url, range, and original error message
          throw new Error(
            `${e.message}. ${url} range=${range[0]}-${
              range[1] ? range[1] : ""
            }: ${e.message}`
          );
        });
      // .finally(() => {
      //   inFlightRequests.delete(cacheKey);
      // });
      // inFlightRequests.set(cacheKey, request);
      // return request;
    }
  },
  maxCacheSize: "256MB",
});

const workerPool = createClippingWorkerPool(
  process.env.PISCINA_WORKER_PATH || "worker.js"
);

export default async function handler(
  payload: OverlayWorkerPayload & {
    includedProperties?: string[];
    resultsLimit?: number;
  }
) {
  console.log("Overlay worker (v2) received payload", payload);
  const startTime = Date.now();
  const progressNotifier = new ProgressNotifier(
    payload.jobKey,
    1000,
    payload.queueUrl
  );
  await sendBeginMessage(
    payload.jobKey,
    "/test",
    new Date().toISOString(),
    payload.queueUrl
  );
  const helpers = guaranteeHelpers({
    progress: async (progress: number, message?: string) => {
      await progressNotifier.notify(progress, message);
      return;
    },
    log: (message: string) => {
      console.log(message);
    },
    time: (message: string) => {
      console.time(message);
    },
    timeEnd: (message: string) => {
      console.timeEnd(message);
    },
  });
  try {
    // Example of how to use the discriminated union with switch statements
    switch (payload.type) {
      case "total_area": {
        if (subjectIsGeography(payload.subject)) {
          progressNotifier.notify(0, "Beginning area calculation");
          const area = await calculateArea(
            payload.subject.clippingLayers,
            sourceCache,
            helpers
          );
          await flushMessages();
          await sendResultMessage(
            payload.jobKey,
            area,
            payload.queueUrl,
            Date.now() - startTime
          );
          return;
        } else if (subjectIsFragment(payload.subject)) {
          throw new Error(
            "Total area for fragments not implemented in worker."
          );
        } else {
          throw new Error(
            "Unknown subject type. Must be geography or fragment."
          );
        }
      }
      case "overlay_area": {
        if (!payload.sourceUrl) {
          throw new Error("sourceUrl is required for overlay_area");
        }
        const { intersectionFeature, differenceSources } =
          await subjectsForAnalysis(
            payload.subject as MetricSubjectFragment | MetricSubjectGeography,
            helpers
          );
        const source = await sourceCache.get<Feature<MultiPolygon | Polygon>>(
          payload.sourceUrl,
          {
            pageSize: "5MB",
          }
        );
        const processor = new OverlayEngineBatchProcessor(
          "overlay_area",
          1024 * 1024 * 1, // 5MB
          simplify(intersectionFeature, {
            tolerance: 0.002,
          }),
          source,
          differenceSources,
          helpers,
          payload.groupBy,
          workerPool
        );
        const area = await processor.calculate();
        await flushMessages();
        await sendResultMessage(
          payload.jobKey,
          area,
          payload.queueUrl,
          Date.now() - startTime
        );
        return;
      }
      case "presence_table":
      case "count":
      case "presence": {
        if (!payload.sourceUrl) {
          throw new Error("sourceUrl is required for count");
        }
        const { intersectionFeature, differenceSources } =
          await subjectsForAnalysis(
            payload.subject as MetricSubjectFragment | MetricSubjectGeography,
            helpers
          );
        const source = await sourceCache.get<Feature<MultiPolygon | Polygon>>(
          payload.sourceUrl,
          {
            pageSize: "5MB",
          }
        );
        const processor = new OverlayEngineBatchProcessor(
          payload.type,
          1024 * 1024 * 1, // 5MB
          simplify(intersectionFeature, {
            tolerance: 0.002,
          }),
          source,
          differenceSources,
          helpers,
          payload.groupBy,
          workerPool,
          payload.includedProperties,
          payload.resultsLimit
        );
        const count = await processor.calculate();
        await flushMessages();
        await sendResultMessage(
          payload.jobKey,
          count,
          payload.queueUrl,
          Date.now() - startTime
        );
        return;
      }
      default:
        throw new Error(`Unknown payload type: ${(payload as any).type}`);
    }
  } catch (e) {
    console.log("caught error in overlay worker", e);
    console.error(e);
    await sendErrorMessage(
      payload.jobKey,
      e instanceof Error ? e.message : "Unknown error",
      payload.queueUrl
    );
    // throw e;
  } finally {
    // Ensure any debounced progress sends and pending SQS sends are flushed
    try {
      progressNotifier.flush();
    } catch {}
    await flushMessages();
  }
}

export function validatePayload(data: any): OverlayWorkerPayload {
  // Validate required base properties
  if (!data || typeof data !== "object") {
    throw new Error("Payload must be an object");
  }

  if (!data.jobKey || typeof data.jobKey !== "string") {
    throw new Error("Payload must have a valid jobKey property");
  }

  if (!data.type || typeof data.type !== "string") {
    throw new Error("Payload must have a valid type property");
  }

  if (!data.subject || typeof data.subject !== "object") {
    throw new Error("Payload must have a valid subject property");
  }

  // Validate subject structure
  if ("type" in data.subject) {
    if (
      data.subject.type !== "geography" ||
      typeof data.subject.id !== "number"
    ) {
      throw new Error(
        'Geography subject must have type "geography" and numeric id'
      );
    }
  } else {
    if (typeof data.subject.hash !== "string") {
      throw new Error("Fragment subject must have hash id.");
    }
  }

  // Validate overlay-specific properties for metrics that need them
  if (data.type !== "total_area") {
    if (!data.sourceUrl || typeof data.sourceUrl !== "string") {
      throw new Error(
        `Payload type "${data.type}" must have sourceUrl property`
      );
    }
    if (!data.sourceType || typeof data.sourceType !== "string") {
      throw new Error(
        `Payload type "${data.type}" must have sourceType property`
      );
    }
    if (data.groupBy && typeof data.groupBy !== "string") {
      throw new Error(`Payload type "${data.type}" must have groupBy property`);
    }
  }

  // Ensure no value or count properties exist
  if ("value" in data) {
    throw new Error("Payload must not contain value property");
  }
  if ("count" in data) {
    throw new Error("Payload must not contain count property");
  }

  return data as OverlayWorkerPayload;
}

// Type guard for enhanced fragment subjects
export function subjectIsFragment(
  subject: any
): subject is MetricSubjectFragment & FragmentSubjectPayload {
  return "hash" in subject && "fragmentHash" in subject;
}

// Type guard for enhanced geography subjects
export function subjectIsGeography(
  subject: any
): subject is MetricSubjectGeography & GeographySubjectPayload {
  return (
    "type" in subject &&
    subject.type === "geography" &&
    "clippingLayers" in subject
  );
}

function polygonFromFragment(
  subject: FragmentSubjectPayload
): Feature<Polygon> {
  if (!subject.geobuf) {
    throw new Error("geobuf is required for fragment subjects");
  }
  // payload.subject.geobuf is a base64 encoded string
  const buffer = Buffer.from(subject.geobuf as string, "base64");
  let feature = geobuf.decode(new Pbf(buffer)) as
    | Feature<Polygon>
    | FeatureCollection<Polygon>;
  if (feature.type === "FeatureCollection") {
    feature = feature.features[0];
  }
  if (feature.geometry.type !== "Polygon") {
    throw new Error("geobuf is not a GeoJSON Polygon.");
  }
  return feature;
}

async function subjectsForAnalysis(
  subject: MetricSubjectFragment | MetricSubjectGeography,
  helpers: GuaranteedOverlayWorkerHelpers
): Promise<{
  intersectionFeature: Feature<Polygon | MultiPolygon>;
  differenceSources: {
    layerId: string;
    source: FlatGeobufSource<Feature<Polygon | MultiPolygon>>;
    cql2Query?: Cql2Query | undefined;
  }[];
}> {
  if (subjectIsGeography(subject)) {
    const { intersectionFeature, differenceLayers, differenceSources } =
      await initializeGeographySources(
        subject.clippingLayers,
        sourceCache,
        helpers,
        {
          pageSize: "5MB",
        }
      );
    return {
      intersectionFeature,
      differenceSources,
    };
  } else if ("geobuf" in subject) {
    const feature = polygonFromFragment(
      subject as unknown as FragmentSubjectPayload
    );
    return {
      intersectionFeature: feature,
      differenceSources: [],
    };
  } else {
    throw new Error("Unknown subject type. Must be geography or fragment.");
  }
}
