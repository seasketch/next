import { SourceCache } from "fgb-source";
import {
  calculateGeographyOverlap,
  ClippingLayerOption,
  initializeGeographySources,
} from "../src/geographies/geographies";
import { guaranteeHelpers } from "../src/utils/helpers";
import {
  createClippingWorkerPool,
  OverlappingAreaBatchedClippingProcessor,
} from "../src/OverlappingAreaBatchedClippingProcessor";
import { Feature, MultiPolygon, Polygon } from "geojson";
import { makeFetchRangeFn } from "./optimizedFetchRangeFn";

const { fetchRangeFn, cacheHits, cacheMisses } = makeFetchRangeFn(
  `https://uploads.seasketch.org`,
  1000 * 1024 * 128
);

const sourceCache = new SourceCache("1GB", {
  fetchRangeFn,
});

const testCases = {
  mangroves: {
    source: "http://uploads.seasketch.org/testing:fiji-mangroves.fgb",
    groupBy: null,
  },
  deepwaterBioregions: {
    source: "https://uploads.seasketch.org/testing-deepwater-bioregions.fgb",
    groupBy: "Draft_name",
  },
  geomorphic: {
    source:
      "https://uploads.seasketch.org/projects/fiji/subdivided/123-2791aa46-9583-4268-a360-91dd1cee71c5.fgb",
    groupBy: "class",
  },
};

const testCase = testCases.geomorphic;

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

let lastLoggedProgress = 0;
const helpers = guaranteeHelpers({
  log: (message) => {
    console.log(message);
  },
  progress: async (progress, message) => {
    if (Math.floor(progress) - lastLoggedProgress >= 1) {
      console.log(Math.floor(progress), message);
      lastLoggedProgress = Math.floor(progress);
    }
  },
});

(async () => {
  console.time("get intersection feature");
  const { intersectionFeature: intersectionFeatureGeojson, differenceSources } =
    await initializeGeographySources(FIJI_EEZ, sourceCache, helpers, {
      pageSize: "5MB",
    });
  console.timeEnd("get intersection feature");
  const source = await sourceCache.get<Feature<MultiPolygon>>(testCase.source, {
    pageSize: "5MB",
  });
  const pool = createClippingWorkerPool(
    __dirname + "/../dist/workers/clipBatch.standalone.js"
  );
  const processor = new OverlappingAreaBatchedClippingProcessor(
    1024 * 1024 * 2, // 5MB
    intersectionFeatureGeojson,
    source,
    differenceSources,
    helpers,
    testCase.groupBy || undefined,
    pool
  );
  console.time("calculate overlap");
  const results = await processor.calculateOverlap();
  await pool.destroy();
  console.timeEnd("calculate overlap");
  console.log(`Cache hits: ${cacheHits}`);
  console.log(`Cache misses: ${cacheMisses}`);
  console.log(results);
})();
