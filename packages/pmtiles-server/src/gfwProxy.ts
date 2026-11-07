/**
 * Allowlisted Global Fishing Watch 4Wings proxy.
 * The browser never sees the upstream token. Only the pinned annual
 * fishing-effort dataset is forwarded.
 */

export const GFW_API_ORIGIN = "https://gateway.api.globalfishingwatch.org";
export const GFW_DATASET = "public-global-fishing-effort";
export const GFW_DATASET_VERSION = "v5.0";
export const GFW_COVERAGE_START = "2012-01-01";
export const GFW_TILE_CACHE_SECONDS = 6 * 60 * 60;
export const GFW_BINS_CACHE_SECONDS = 24 * 60 * 60;

const TILE_PATH = /^\/gfw\/tile\/(\d+)\/(\d+)\/(\d+)\.mvt$/;

export type GfwUpstream = {
  url: string;
  cacheKey: string;
  cacheTtlSeconds: number;
  contentType: string;
};

/**
 * Map a SeaSketch `/gfw/...` request to one upstream URL.
 * Returns null when the path or query is not on the allowlist.
 * `access_token` and `ns` are ignored so they never reach Global Fishing Watch
 * and never become part of the cache key.
 */
export function gfwUpstream(url: URL, now: Date = new Date()): GfwUpstream | null {
  if (!allowedQuery(url)) return null;
  if (url.pathname === "/gfw/bins") {
    const upstream = new URL("/v3/4wings/bins/0", GFW_API_ORIGIN);
    upstream.searchParams.set("datasets", datasetId());
    upstream.searchParams.set("interval", "YEAR");
    return {
      url: upstream.toString(),
      cacheKey: upstream.toString(),
      cacheTtlSeconds: GFW_BINS_CACHE_SECONDS,
      contentType: "application/json",
    };
  }
  const match = url.pathname.match(TILE_PATH);
  if (!match) return null;
  const z = Number(match[1]);
  const x = Number(match[2]);
  const y = Number(match[3]);
  if (!Number.isInteger(z) || z < 0 || z > 12) return null;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) return null;
  const limit = 2 ** z;
  if (x >= limit || y >= limit) return null;
  const end = now.toISOString().slice(0, 10);
  const upstream = new URL(
    `/v3/4wings/tile/heatmap/${z}/${x}/${y}`,
    GFW_API_ORIGIN
  );
  upstream.searchParams.set("datasets", datasetId());
  upstream.searchParams.set("interval", "YEAR");
  upstream.searchParams.set("temporal-aggregation", "false");
  upstream.searchParams.set("date-range", `${GFW_COVERAGE_START},${end}`);
  upstream.searchParams.set("format", "MVT");
  return {
    url: upstream.toString(),
    cacheKey: upstream.toString(),
    cacheTtlSeconds: GFW_TILE_CACHE_SECONDS,
    contentType: "application/vnd.mapbox-vector-tile",
  };
}

export function isGfwPath(pathname: string): boolean {
  return pathname === "/gfw" || pathname.startsWith("/gfw/");
}

function datasetId(): string {
  return `${GFW_DATASET}:${GFW_DATASET_VERSION}`;
}

function allowedQuery(url: URL): boolean {
  for (const [key, value] of url.searchParams.entries()) {
    if (key === "access_token" || key === "ns") continue;
    if (key === "dataset" && value === GFW_DATASET) continue;
    if (key === "version" && value === GFW_DATASET_VERSION) continue;
    if (key === "interval" && value === "YEAR") continue;
    return false;
  }
  return true;
}

export async function handleGfwRequest(
  request: Request,
  token: string,
  waitUntil: (promise: Promise<unknown>) => void,
  now: Date = new Date()
): Promise<Response> {
  if (request.method !== "GET") {
    return gfwError(405, "method_not_allowed");
  }
  const upstream = gfwUpstream(new URL(request.url), now);
  if (!upstream) {
    return gfwError(400, "not_allowed");
  }
  const cache = caches.default;
  const cacheRequest = new Request(upstream.cacheKey, { method: "GET" });
  const hit = await cache.match(cacheRequest);
  if (hit) {
    return withCors(hit);
  }
  const response = await fetch(upstream.url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: upstream.contentType,
    },
  });
  const headers = new Headers();
  const contentType = response.headers.get("Content-Type");
  headers.set("Content-Type", contentType || upstream.contentType);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set(
    "Cache-Control",
    response.ok ? `public, max-age=${upstream.cacheTtlSeconds}` : "no-store"
  );
  const out = new Response(response.body, {
    status: response.status,
    headers,
  });
  if (response.ok) {
    waitUntil(cache.put(cacheRequest, out.clone()));
  }
  return out;
}

export function gfwError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
