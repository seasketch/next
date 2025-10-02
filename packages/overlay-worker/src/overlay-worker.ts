import {
  calculateArea,
  calculateFragmentOverlap,
  calculateGeographyOverlap,
  MetricSubjectFragment,
  MetricSubjectGeography,
} from "overlay-engine";
import {
  FragmentSubjectPayload,
  GeographySubjectPayload,
  OverlayWorkerPayload,
} from "./types";
import { SourceCache } from "fgb-source";
import {
  sendBeginMessage,
  sendErrorMessage,
  sendResultMessage,
  flushMessages,
} from "./messaging";
import { ProgressNotifier } from "./ProgressNotifier";
import * as geobuf from "geobuf";
import Pbf from "pbf";
import { Feature, FeatureCollection, Polygon } from "geojson";

const sourceCache = new SourceCache("1GB", {
  maxCacheSize: "150MB",
});

export default async function handler(payload: OverlayWorkerPayload) {
  console.log("Overlay worker (v2) received payload", payload);
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
  const helpers = {
    progress: (progress: number, message?: string) => {
      return progressNotifier.notify(progress, message);
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
  };
  try {
    // Example of how to use the discriminated union with switch statements
    switch (payload.type) {
      case "total_area":
        if (subjectIsGeography(payload.subject)) {
          progressNotifier.notify(0, "Beginning area calculation");
          const area = await calculateArea(
            payload.subject.clippingLayers,
            sourceCache,
            helpers
          );
          await flushMessages();
          await sendResultMessage(payload.jobKey, area, payload.queueUrl);
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
        break;
      case "overlay_area":
        if (!payload.sourceUrl) {
          throw new Error("sourceUrl is required for overlay_area");
        }
        if (subjectIsGeography(payload.subject)) {
          progressNotifier.notify(0, "Beginning area calculation");
          const area = await calculateGeographyOverlap(
            payload.subject.clippingLayers,
            sourceCache,
            payload.sourceUrl,
            payload.sourceType,
            payload.groupBy,
            helpers
          );
          await flushMessages();
          await sendResultMessage(payload.jobKey, area, payload.queueUrl);
          return;
        } else {
          if ("geobuf" in payload.subject) {
            // payload.subject.geobuf is a base64 encoded string
            const buffer = Buffer.from(
              payload.subject.geobuf as string,
              "base64"
            );
            let feature = geobuf.decode(new Pbf(buffer)) as
              | Feature<Polygon>
              | FeatureCollection<Polygon>;
            helpers.log(`decoded geobuf feature. ${buffer.byteLength} bytes`);
            if (feature.type === "FeatureCollection") {
              feature = feature.features[0];
            }
            if (feature.geometry.type !== "Polygon") {
              throw new Error("geobuf is not a GeoJSON Polygon.");
            }

            progressNotifier.notify(0, "Beginning overlay area calculation");
            await flushMessages();
            const area = await calculateFragmentOverlap(
              feature as Feature<Polygon>,
              sourceCache,
              payload.sourceUrl,
              payload.sourceType,
              payload.groupBy,
              helpers
            );
            await flushMessages();
            await sendResultMessage(payload.jobKey, area, payload.queueUrl);
            return;
          } else {
            throw new Error(
              "Geobuf feature was not provided. Fetch-based workflows not suppored yet."
            );
          }
        }
      default:
        throw new Error(`Unknown payload type: ${payload.type}`);
    }
  } catch (e) {
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
