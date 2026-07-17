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
  createFragments,
  eliminateOverlap,
} from "overlay-engine";
import { SourceCache } from "fgb-source";
import { Feature, MultiPolygon, Polygon } from "geojson";
import { Pool } from "undici";
import { LRUCache } from "lru-cache";
import {
  bustOverlayEngineAccessTokenCache,
  getOverlayEngineAccessToken,
} from "./overlayEngineAccessToken";

const pool = new Pool("https://uploads.seasketch.org", {
  bodyTimeout: 10 * 1000,
});

const cache = new LRUCache<string, ArrayBuffer>({
  maxSize: 1000 * 1024 * 128, // 128 MB
  sizeCalculation: (value: ArrayBuffer) => value.byteLength,
});

const inFlightRequests = new Map<string, Promise<ArrayBuffer>>();

/** Drain undici body; destroy() can emit unhandled UND_ERR_ABORTED. */
async function discardResponseBody(body: {
  dump?: () => Promise<void>;
  arrayBuffer: () => Promise<ArrayBuffer>;
}): Promise<void> {
  if (typeof body.dump === "function") {
    await body.dump();
    return;
  }
  await body.arrayBuffer();
}

async function fetchUploadsRange(
  url: string,
  range: [number, number | null],
  retriedAuth = false,
): Promise<ArrayBuffer> {
  const token = await getOverlayEngineAccessToken();
  const response = await pool.request({
    path: "/" + url.replace("https://uploads.seasketch.org/", ""),
    method: "GET",
    headers: {
      Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}`,
      Authorization: `Bearer ${token}`,
    },
  });
  if (
    (response.statusCode === 401 || response.statusCode === 403) &&
    !retriedAuth
  ) {
    await discardResponseBody(response.body);
    bustOverlayEngineAccessTokenCache();
    return fetchUploadsRange(url, range, true);
  }
  if (response.statusCode >= 400) {
    await discardResponseBody(response.body);
    const authHint =
      response.statusCode === 401 || response.statusCode === 403
        ? " (uploads authentication failed)"
        : "";
    throw new Error(
      `HTTP ${response.statusCode}${authHint}. ${url} range=${range[0]}-${
        range[1] ? range[1] : ""
      }`,
    );
  }
  return response.body.arrayBuffer();
}

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
      const request = fetchUploadsRange(url, range)
        .then((buffer: ArrayBuffer) => {
          cache.set(cacheKey, buffer);
          return buffer;
        })
        .catch((e: any) => {
          const message = e instanceof Error ? e.message : String(e);
          throw new Error(
            `${message}. ${url} range=${range[0]}-${
              range[1] ? range[1] : ""
            }: ${message}`,
          );
        })
        .finally(() => {
          inFlightRequests.delete(cacheKey);
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

export interface CreateCollectionFragmentsPayload {
  operation: "create-collection-fragments";
  sketches: Array<{ id: number; feature: Feature<any> }>;
  geographies: GeographySettings[];
  geographiesForClipping: number[];
}

export interface CreateCollectionFragmentsResult {
  success: boolean;
  fragmentsBySketchId?: Record<number, FragmentResult[]>;
  error?: string;
}

export interface ReconcileOverlapPayload {
  operation: "reconcile-overlap";
  newFragments: SketchFragment[];
  existingFragments: SketchFragment[];
}

export interface ReconcileOverlapResult {
  success: boolean;
  fragments?: SketchFragment[];
  error?: string;
}

/**
 * Run {@link eliminateOverlap} for sketch fragments when a sketch is moved
 * into a collection (offloaded from the API server).
 */
export async function handleReconcileOverlap(
  payload: ReconcileOverlapPayload,
): Promise<ReconcileOverlapResult> {
  const fragments = eliminateOverlap(
    payload.newFragments,
    payload.existingFragments,
  );
  return { success: true, fragments };
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

export async function handleCreateCollectionFragments(
  payload: CreateCollectionFragmentsPayload,
): Promise<CreateCollectionFragmentsResult> {
  const preparedSketches = payload.sketches.map((sketch) => ({
    id: sketch.id,
    preparedSketch: prepareSketch(sketch.feature),
  }));

  const allFragmentsBySketch = await Promise.all(
    preparedSketches.map(async ({ id, preparedSketch }) => {
      const fragments = await createFragments(
        preparedSketch,
        payload.geographies,
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
      const clippingFragments = fragments.filter((fragment) =>
        fragment.properties.__geographyIds.some((geographyId) =>
          payload.geographiesForClipping.includes(geographyId),
        ),
      );
      return {
        id,
        fragments: clippingFragments,
      };
    }),
  );

  const taggedFragments = allFragmentsBySketch.flatMap(({ id, fragments }) =>
    fragments.map((fragment) => ({
      ...fragment,
      properties: {
        ...fragment.properties,
        __sketchIds: [id],
      },
    })),
  );

  const reconciled = eliminateOverlap(taggedFragments, []);
  const fragmentsBySketchId: Record<number, FragmentResult[]> = {};

  for (const sketch of payload.sketches) {
    fragmentsBySketchId[sketch.id] = [];
  }
  for (const fragment of reconciled) {
    for (const sketchId of fragment.properties.__sketchIds) {
      if (!fragmentsBySketchId[sketchId]) {
        fragmentsBySketchId[sketchId] = [];
      }
      fragmentsBySketchId[sketchId].push(fragment);
    }
  }

  return {
    success: true,
    fragmentsBySketchId,
  };
}
