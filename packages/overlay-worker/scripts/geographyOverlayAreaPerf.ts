import { SourceCache } from "fgb-source";
import { calculateGeographyOverlap, ClippingLayerOption } from "overlay-engine";
import {
  DebuggingFgbWriter,
  FieldDefinition,
} from "overlay-engine/dist/utils/debuggingFgbWriter";
import { OverlayWorkerLogFeatureLayerConfig } from "overlay-engine/dist/utils/helpers";
import { fetch, Pool } from "undici";
import { LRUCache } from "lru-cache";

const pool = new Pool(`https://uploads.seasketch.org`, {
  // allowH2: true,
  // 10 second timeout for body
  bodyTimeout: 10 * 1000,
});

const cache = new LRUCache<string, ArrayBuffer>({
  maxSize: 1000 * 1024 * 24, // 64 MB
  sizeCalculation: (value, key) => {
    return value.byteLength;
  },
});

// Set the global dispatcher to use our caching client
// setGlobalDispatcher(client);

const cliProgress = require("cli-progress");

// Reef-associated bioregions
// const subdividedSource =
// "https://uploads.seasketch.org/projects/cburt/subdivided/149-90348c09-93c0-4957-ab07-615c0abf6099.fgb";

// const subdividedSource =
//   "https://uploads.seasketch.org/projects/cburt/subdivided/131-04d8a3a3-7ea7-43c8-baa5-40dfb484b994.fgb";

// ACA Geomorphic Cropped
const subdividedSource =
  "https://uploads.seasketch.org/projects/cburt/subdivided/117-00f805f7-caf0-489f-9d44-c3e266027e81.fgb";

// Fiji EEZ, including complex shoreline clipping
const geography = [
  {
    cql2Query: null,
    source:
      "https://uploads.seasketch.org/projects/superuser/public/8a1adc53-7e67-436a-9b19-3318b8b14ad2.fgb",
    op: "DIFFERENCE",
  },
  {
    cql2Query: { op: "=", args: [{ property: "MRGID_EEZ" }, 8325] },
    source:
      "https://uploads.seasketch.org/projects/superuser/public/04620ab4-5550-4858-b827-9ef41539376b.fgb",
    op: "INTERSECT",
  },
];

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

let progressBar: any = null;

function getOrCreateProgressBar() {
  if (!progressBar) {
    progressBar = new cliProgress.SingleBar(
      {
        format:
          "Processing |{bar}| {percentage}% | {value}/{total} | {message}",
        hideCursor: true,
        clearOnComplete: true,
      },
      cliProgress.Presets.shades_classic
    );
    progressBar.start(100, 0, { message: "Initializing" });
  }
  return progressBar;
}

const sourceCache = new SourceCache("1GB", {
  fetchRangeFn: (url, range) => {
    // console.log("fetching", url, range);
    fetchCount++;
    const cacheKey = `${url} range=${range[0]}-${range[1] ? range[1] : ""}`;
    // console.time(cacheKey);
    const cached = cache.get(cacheKey);
    if (cached) {
      // console.timeEnd(cacheKey);
      return Promise.resolve(cached);
    } else {
      console.log("cache miss", cacheKey);
      return pool
        .request({
          path: url.replace("https://uploads.seasketch.org", ""),
          method: "GET",
          headers: {
            Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}`,
          },
        })
        .then((response) => response.body.arrayBuffer())
        .then((buffer) => {
          cache.set(cacheKey, buffer);
          return buffer;
        })
        .catch((e) => {
          throw new Error(
            `Error fetching ${url} range=${range[0]}-${
              range[1] ? range[1] : ""
            }: ${e.message}`
          );
        });

      // fetch(url, {
      //   headers: {
      //     Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}`,
      //   },
      // })
      //   .then((response) => response.arrayBuffer())
      //   // .then((b) => {
      //   //   if (Math.random() < 0.5 && range[0] > 100000) {
      //   //     throw new Error(`Terminated! ${url} ${range[0]} ${range[1]}`);
      //   //   }
      //   //   return b;
      //   // })
      //   .then((buffer) => {
      //     // console.timeEnd(cacheKey);
      //     cache.set(cacheKey, buffer);
      //     // console.log("response", response.headers.get("x-cache-status"));
      //     return buffer;
      //   })
      //   .catch((e) => {
      //     // rethrow error with enhanced error message consisting of url, range, and original error message
      //     throw new Error(
      //       `Error fetching ${url} range=${range[0]}-${
      //         range[1] ? range[1] : ""
      //       }: ${e.message}`
      //     );
      //   })
      // );
    }
  },
  maxCacheSize: "256MB",
});

let lastlogged = performance.now();

calculateGeographyOverlap(
  geography as ClippingLayerOption[],
  sourceCache,
  subdividedSource,
  "FlatGeobuf",
  "class",
  // "Name",
  {
    log: (message) => {
      console.log(message);
    },
    logFeature: (layer, feature) => {
      const entry = getDebugWriter(layer);
      if (!entry) return;
      try {
        // Coerce boolean properties to string when needed to match the schema
        const properties = { ...(feature.properties || {}) } as Record<
          string,
          any
        >;
        for (const [key, t] of Object.entries(layer.fields)) {
          if (t === "boolean" && typeof properties[key] === "boolean") {
            properties[key] = properties[key] ? "true" : "false";
          } else if (t === "number" && typeof properties[key] === "string") {
            const n = Number(properties[key]);
            if (!Number.isNaN(n)) properties[key] = n;
          }
        }
        entry.writer.addFeature({ ...feature, properties });
      } catch (_) {
        // ignore feature write errors
      }
    },
    progress: async (progress, message) => {
      if (performance.now() - lastlogged > 100) {
        lastlogged = performance.now();
        console.log(`${progress}% - ${message}`);
      }
      // console.log(`${progress}% - ${message}`);
      // const progressBar = getOrCreateProgressBar();
      // const percent = Math.max(0, Math.min(100, Math.round(progress)));
      // progressBar.update(percent, { message: message || "" });
    },
  }
)
  .then(console.log)
  .then(async () => {
    // progressBar.update(100, { message: "Done" });
    // progressBar.stop();
    const source = await sourceCache.get(geography[0].source);
    console.log("cache stats");
    console.log(`fetchCount: ${fetchCount}`);
    console.log(
      `cache size: ${cache.size} entries. ${cache.calculatedSize} bytes.`
    );
    await closeDebugWriters();
  })
  .catch(async (err) => {
    // Ensure progress/cleanup complete before surfacing error
    try {
      if (progressBar) {
        progressBar.stop();
      }
    } catch (_) {}
    try {
      await closeDebugWriters();
    } catch (_) {}
    console.log("Error caught. Would create sqs message in real worker.");
    // Ensure non-zero exit while letting outer runner see the message
    process.exitCode = 1;
    // Re-throw to produce stack trace for local runs
    throw err;
  });

async function closeDebugWriters() {
  const closePromises: Promise<void>[] = [];
  debugWriters.forEach((entry, name) => {
    closePromises.push(
      entry.writer.close().then(() => {
        console.log(`wrote debug layer '${name}' to ${entry.path}`);
      })
    );
  });
  await Promise.all(closePromises);
}

// process.on("unhandledRejection", (reason, promise) => {
//   console.error("Unhandled promise rejection:", reason);
// });
