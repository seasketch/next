import { SourceCache } from "fgb-source";
import {
  calculateGeographyOverlap,
  ClippingLayerOption,
  initializeGeographySources,
} from "../src/geographies/geographies";
import { guaranteeHelpers } from "../src/utils/helpers";
import { OverlappingAreaBatchedClippingProcessor } from "../src/OverlappingAreaBatchedClippingProcessor";
import { Feature, MultiPolygon, Polygon } from "geojson";
import { Pool } from "undici";
import { LRUCache } from "lru-cache";

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

let cacheHits = 0;
let cacheMisses = 0;

const sourceCache = new SourceCache("1GB", {
  fetchRangeFn: (url, range) => {
    // console.log("fetching", url, range);
    const cacheKey = `${url} range=${range[0]}-${range[1] ? range[1] : ""}`;
    // console.time(cacheKey);
    const cached = cache.get(cacheKey);
    if (cached) {
      // console.timeEnd(cacheKey);
      // console.log("cache hit", cacheKey);
      cacheHits++;
      return Promise.resolve(cached);
    } else if (inFlightRequests.has(cacheKey)) {
      // console.log("in-flight request hit", cacheKey);
      cacheHits++;
      return inFlightRequests.get(cacheKey) as Promise<ArrayBuffer>;
    } else {
      cacheMisses++;
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

const mangrovesSource =
  "http://uploads.seasketch.org/testing:fiji-mangroves.fgb";

const deepwaterBioregionsSource =
  "https://uploads.seasketch.org/testing-deepwater-bioregions.fgb";

const geomorphicSource =
  "https://uploads.seasketch.org/projects/fiji/subdivided/123-dc99ab0f-2f1b-44ea-8c8b-8635341cbdda.fgb";

// const intersectionSourceUrl = deepwaterBioregionsSource;
// const groupBy = "Draft_name";

const intersectionSourceUrl = geomorphicSource;
const groupBy = "class";

// const intersectionSourceUrl = mangrovesSource;
// const groupBy = undefined;

const FIJI_EEZ = [
  {
    cql2Query: {
      op: "=",
      args: [
        {
          property: "MRGID_EEZ",
        },
        8325,
      ],
    },
    source:
      "https://uploads.seasketch.org/projects/superuser/public/04620ab4-5550-4858-b827-9ef41539376b.fgb",
    op: "INTERSECT",
  },
  {
    cql2Query: null,
    source:
      "https://uploads.seasketch.org/projects/superuser/public/5dee67d7-83ea-4755-be22-afefc22cbee3.fgb",
    op: "DIFFERENCE",
    headerSizeHint: 38500000,
  },
] as ClippingLayerOption[];

// const sourceCache = new SourceCache("200 MB");

const helpers = guaranteeHelpers({
  log: (message) => {
    console.log(message);
  },
  progress: async (progress, message) => {
    console.log(progress, message);
  },
});

// calculateGeographyOverlap(
//   FIJI_EEZ,
//   sourceCache,
//   mangrovesSource,
//   "FlatGeobuf",
//   undefined,
//   {
//     log: (message) => {
//       console.log(message);
//     },
//     progress: async (progress, message) => {
//       console.log(progress, message);
//     },
//   }
// ).then(console.log);

(async () => {
  console.time("get intersection feature");
  const { intersectionFeature: intersectionFeatureGeojson, differenceLayers } =
    await initializeGeographySources(FIJI_EEZ, sourceCache, helpers, {
      pageSize: "5MB",
    });
  console.timeEnd("get intersection feature");
  const differenceSources = await Promise.all(
    differenceLayers.map(async (layer) => {
      const diffSource = await sourceCache.get<Feature<Polygon | MultiPolygon>>(
        layer.source,
        {
          pageSize: "10MB",
        }
      );
      return {
        cql2Query: layer.cql2Query,
        source: diffSource,
        layerId: layer.source,
      };
    })
  );
  const intersectionSource = await sourceCache.get<Feature<MultiPolygon>>(
    // deepwaterBioregionsSource,
    // geomorphicSource,
    intersectionSourceUrl,
    {
      pageSize: "5MB",
    }
  );
  const processor = new OverlappingAreaBatchedClippingProcessor(
    1024 * 1024 * 0.5, // 5MB
    intersectionFeatureGeojson,
    intersectionSource,
    differenceSources,
    helpers,
    groupBy,
    {
      useWorkers: true,
    }
  );
  console.time("calculate overlap");
  const results = await processor.calculateOverlap();
  console.timeEnd("calculate overlap");
  console.log(`Cache hits: ${cacheHits}`);
  console.log(`Cache misses: ${cacheMisses}`);
  console.log(results);
})();
