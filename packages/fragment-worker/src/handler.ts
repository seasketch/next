import {
  prepareSketch,
  PreparedSketch,
  clipToGeographies,
  clipSketchToPolygons,
  ClippingOperation,
  Cql2Query,
  GeographySettings,
  SketchFragment,
  FragmentResult,
} from "overlay-engine";
import { SourceCache } from "fgb-source";
import { Feature, MultiPolygon, Polygon } from "geojson";
import { Pool } from "undici";
import { LRUCache } from "lru-cache";

const pool = new Pool("https://uploads.seasketch.org", {
  bodyTimeout: 10 * 1000,
});

const cache = new LRUCache<string, ArrayBuffer>({
  maxSize: 1000 * 1024 * 128, // 128 MB
  sizeCalculation: (value: ArrayBuffer) => value.byteLength,
});

const inFlightRequests = new Map<string, Promise<ArrayBuffer>>();

const sourceCache = new SourceCache("1GB", {
  fetchRangeFn: (
    url: string,
    range: [number, number | null],
  ): Promise<ArrayBuffer> => {
    const cacheKey = `${url} range=${range[0]}-${range[1] ? range[1] : ""}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log("cache hit", cacheKey);
      return Promise.resolve(cached);
    } else if (inFlightRequests.has(cacheKey)) {
      console.log("in-flight request hit", cacheKey);
      return inFlightRequests.get(cacheKey) as Promise<ArrayBuffer>;
    } else {
      console.log("cache miss", cacheKey);
      const request = pool
        .request({
          path: "/" + url.replace("https://uploads.seasketch.org/", ""),
          method: "GET",
          headers: {
            Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}`,
          },
        })
        .then(async (response: any) => {
          const buffer: ArrayBuffer = await response.body.arrayBuffer();
          return buffer;
        })
        .then((buffer: ArrayBuffer) => {
          cache.set(cacheKey, buffer);
          inFlightRequests.delete(cacheKey);
          return buffer;
        })
        .catch((e: any) => {
          inFlightRequests.delete(cacheKey);
          throw new Error(
            `${e.message}. ${url} range=${range[0]}-${
              range[1] ? range[1] : ""
            }: ${e.message}`,
          );
        });
      inFlightRequests.set(cacheKey, request);
      return request;
    }
  },
  maxCacheSize: "256MB",
});

export interface WarmCachePayload {
  operation: "warm-cache";
  feature: Feature<any>;
  geographies: GeographySettings[];
}

export interface CreateFragmentsPayload {
  feature: Feature<any>;
  geographies: GeographySettings[];
  geographiesForClipping: number[];
  existingOverlappingFragments: SketchFragment[];
  existingSketchId: number | null;
}

export interface CreateFragmentsResult {
  success: boolean;
  clipped?: Feature<MultiPolygon> | null;
  fragments?: FragmentResult[];
  error?: string;
}

export async function handleWarmCache(
  payload: WarmCachePayload,
): Promise<{ success: boolean }> {
  const preparedSketch = prepareSketch(payload.feature);
  const uniqueSources = new Set<string>();
  for (const geography of payload.geographies) {
    for (const layer of geography.clippingLayers) {
      uniqueSources.add(layer.source);
    }
  }
  console.time("warm cache");
  await Promise.all(
    Array.from(uniqueSources).map(async (sourceKey) => {
      const source =
        await sourceCache.get<Feature<Polygon | MultiPolygon>>(sourceKey);
      return source.getFeaturesAsync(preparedSketch.envelopes, {
        warmCache: true,
      });
    }),
  );
  console.timeEnd("warm cache");
  return { success: true };
}

export async function handleCreateFragments(
  payload: CreateFragmentsPayload,
): Promise<CreateFragmentsResult> {
  const preparedSketch = prepareSketch(payload.feature);
  console.time("clip to geographies");
  const { clipped, fragments } = await clipToGeographies(
    preparedSketch,
    payload.geographies,
    payload.geographiesForClipping,
    payload.existingOverlappingFragments,
    payload.existingSketchId,
    async (
      feature: PreparedSketch,
      objectKey: string,
      op: ClippingOperation,
      cql2Query?: Cql2Query,
    ) => {
      const source =
        await sourceCache.get<Feature<Polygon | MultiPolygon>>(objectKey);
      return clipSketchToPolygons(
        feature,
        op,
        cql2Query,
        source.getFeaturesAsync(feature.envelopes),
      );
    },
  );
  console.timeEnd("clip to geographies");
  return { success: true, clipped, fragments };
}
