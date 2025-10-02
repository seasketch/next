import { SourceCache } from "fgb-source";
import { calculateGeographyOverlap, ClippingLayerOption } from "overlay-engine";
import {
  DebuggingFgbWriter,
  FieldDefinition,
} from "overlay-engine/dist/utils/debuggingFgbWriter";
import { OverlayWorkerLogFeatureLayerConfig } from "overlay-engine/dist/utils/helpers";

// Reef-associated bioregions
const subdividedSource =
  "https://uploads.seasketch.org/projects/cburt/subdivided/149-90348c09-93c0-4957-ab07-615c0abf6099.fgb";

// Fiji EEZ, including complex shoreline clipping
const geography = [
  {
    cql2Query: null,
    source:
      "https://uploads.seasketch.org/projects/superuser/public/5dee67d7-83ea-4755-be22-afefc22cbee3.fgb",
    op: "DIFFERENCE",
  },
  {
    cql2Query: { op: "=", args: [{ property: "MRGID_EEZ" }, 8325] },
    source:
      "https://uploads.seasketch.org/projects/superuser/public/04620ab4-5550-4858-b827-9ef41539376b.fgb",
    op: "INTERSECT",
  },
];

const payload = {
  type: "overlay_area",
  jobKey: "ddf54573-ae36-4faf-bed0-3adfa532b13b",
  subject: {
    type: "geography",
    id: 54,
    clippingLayers: geography,
  },
  groupBy: "Name",
  sourceUrl: subdividedSource,
  sourceType: "FlatGeobuf",
  queueUrl:
    "https://sqs.us-west-2.amazonaws.com/196230260133/seasketch-dev-overlay-engine-worker-queue-1",
};

let fetchCount = 0;
let cumulativeFetchTime = 0;

// Debugging feature writers
type WriterEntry = { writer: DebuggingFgbWriter; path: string };
const downloadsDir = process.env.HOME
  ? `${process.env.HOME}/Downloads`
  : "/tmp";
const debugWriters = new Map<string, WriterEntry>();

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-");
}

function mapFieldsToDefinitions(
  fields: OverlayWorkerLogFeatureLayerConfig["fields"]
): FieldDefinition[] {
  const defs: FieldDefinition[] = [];
  for (const [name, type] of Object.entries(fields)) {
    if (type === "string") {
      defs.push({ name, type: "string" });
    } else if (type === "number") {
      defs.push({ name, type: "real" });
    } else if (type === "boolean") {
      // Store booleans as strings ("true"/"false") for compatibility
      defs.push({ name, type: "string" });
    }
  }
  return defs;
}

function getDebugWriter(
  layer: OverlayWorkerLogFeatureLayerConfig
): WriterEntry | null {
  try {
    const existing = debugWriters.get(layer.name);
    if (existing) return existing;
    const filename = `${sanitizeFilename(layer.name)}.fgb`;
    const path = `${downloadsDir}/${filename}`;
    const fieldDefs = mapFieldsToDefinitions(layer.fields);
    const writer = new DebuggingFgbWriter(path, fieldDefs);
    const entry = { writer, path };
    debugWriters.set(layer.name, entry);
    return entry;
  } catch (e) {
    // If GDAL or writer initialization fails, skip logging
    return null;
  }
}

// CLI progress bar (assumes cli-progress is installed)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cliProgress = require("cli-progress");
const progressBar = new cliProgress.SingleBar(
  {
    format: "Processing |{bar}| {percentage}% | {value}/{total} | {message}",
    hideCursor: true,
    clearOnComplete: true,
  },
  cliProgress.Presets.shades_classic
);
progressBar.start(100, 0, { message: "Initializing" });

const sourceCache = new SourceCache("1GB", {
  fetchRangeFn: (key, range) => {
    // console.log("fetching", key, range);
    fetchCount++;
    const startTime = performance.now();
    return fetch(key, {
      headers: { Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}` },
    }).then((response) => {
      const endTime = performance.now();
      cumulativeFetchTime += endTime - startTime;
      return response.arrayBuffer();
    });
  },
  maxCacheSize: "150MB",
});

calculateGeographyOverlap(
  payload.subject.clippingLayers as ClippingLayerOption[],
  sourceCache,
  subdividedSource,
  "FlatGeobuf",
  "Name",
  {
    log: (message) => {
      console.log(message);
    },
    // logFeature: (layer, feature) => {
    //   const entry = getDebugWriter(layer);
    //   if (!entry) return;
    //   try {
    //     // Coerce boolean properties to string when needed to match the schema
    //     const properties = { ...(feature.properties || {}) } as Record<
    //       string,
    //       any
    //     >;
    //     for (const [key, t] of Object.entries(layer.fields)) {
    //       if (t === "boolean" && typeof properties[key] === "boolean") {
    //         properties[key] = properties[key] ? "true" : "false";
    //       } else if (t === "number" && typeof properties[key] === "string") {
    //         const n = Number(properties[key]);
    //         if (!Number.isNaN(n)) properties[key] = n;
    //       }
    //     }
    //     entry.writer.addFeature({ ...feature, properties });
    //   } catch (_) {
    //     // ignore feature write errors
    //   }
    // },
    progress: async (progress, message) => {
      const percent = Math.max(0, Math.min(100, Math.round(progress)));
      progressBar.update(percent, { message: message || "" });
    },
  }
)
  .then(console.log)
  .then(async () => {
    progressBar.update(100, { message: "Done" });
    progressBar.stop();
    console.log("fetch count", fetchCount);
    console.log("cumulative fetch time", cumulativeFetchTime);
    const source = await sourceCache.get(geography[0].source);
    console.log("cache stats");
    console.log(source.cacheStats);
    // Close debugging writers
    const closePromises: Promise<void>[] = [];
    debugWriters.forEach((entry, name) => {
      closePromises.push(
        entry.writer
          .close()
          .then(() => {
            console.log(`wrote debug layer '${name}' to ${entry.path}`);
          })
          .catch(() => {})
      );
    });
    await Promise.all(closePromises);
  })
  .catch((err) => {
    try {
      progressBar.stop();
    } catch (_) {}
    throw err;
  });
