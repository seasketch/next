import {
  calculateArea,
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
  sendErrorMessage,
  sendProgressMessage,
  sendResultMessage,
} from "./messaging";
import debounce from "lodash.debounce";

const sourceCache = new SourceCache("128 mb");

export default async function handler(
  payload: OverlayWorkerPayload,
  jobKey: string
) {
  const progressNotifier = new ProgressNotifier(jobKey, 100, 500);
  try {
    // Example of how to use the discriminated union with switch statements
    switch (payload.type) {
      case "total_area":
        if (subjectIsGeography(payload.subject)) {
          progressNotifier.notify(0, "Beginning area calculation");
          const area = await calculateArea(
            payload.subject.clippingLayers,
            sourceCache,
            {
              progressCallback: (progress) => {
                progressNotifier.notify(progress);
              },
            }
          );
          sendResultMessage(jobKey, area);
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
      default:
        throw new Error(`Unknown payload type: ${payload.type}`);
    }
  } catch (e) {
    await sendErrorMessage(
      jobKey,
      e instanceof Error ? e.message : "Unknown error"
    );
  }
}

// Debounces progress messages to avoid spamming the database and client
class ProgressNotifier {
  private jobKey: string;
  private progress = 0;
  private message?: string;
  private sendMessage = () => {};

  constructor(jobKey: string, debounceMs: number, maxWaitMs: number) {
    this.jobKey = jobKey;
    // this.sendMessage = () => {
    //   console.log("Sending progress message", this.progress, this.message);
    //   sendProgressMessage(this.jobKey, this.progress, this.message);
    // };
    this.sendMessage = debounce(
      () => {
        sendProgressMessage(this.jobKey, this.progress, this.message);
      },
      debounceMs,
      {
        maxWait: maxWaitMs,
      }
    );
  }

  notify(progress: number, message?: string) {
    let hasChanged = false;
    if (progress >= this.progress && message !== this.message) {
      this.message = message;
      hasChanged = true;
    }
    if (progress > this.progress) {
      this.progress = progress;
      hasChanged = true;
    }
    if (hasChanged) {
      this.sendMessage();
    }
  }
}

export function validatePayload(data: any): OverlayWorkerPayload {
  // Validate required base properties
  if (!data || typeof data !== "object") {
    throw new Error("Payload must be an object");
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
    if (
      typeof data.subject.hash !== "string" ||
      !Array.isArray(data.subject.geographies) ||
      !Array.isArray(data.subject.sketches)
    ) {
      throw new Error(
        "Fragment subject must have hash, geographies array, and sketches array"
      );
    }
  }

  // Validate overlay-specific properties for metrics that need them
  if (data.type !== "total_area") {
    if (!data.layerStableId || typeof data.layerStableId !== "string") {
      throw new Error(
        `Payload type "${data.type}" must have layerStableId property`
      );
    }
    if (!data.groupBy || typeof data.groupBy !== "string") {
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

export { OverlayWorkerPayload, OverlayWorkerResponse } from "./types";
