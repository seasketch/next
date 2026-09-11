import { WorkerEntrypoint } from "cloudflare:workers";

export const TAXONOMY_CACHE_TTL_SECONDS = 3600;
export const WORMS_REST_URL = "https://www.marinespecies.org/rest";
export const ORGANISM_USER_AGENT =
  "SeaSketch-organism-enrichment/1.0 (https://www.seasketch.org)";

const WORMS_RECORD = /^\/taxonomy\/worms\/AphiaRecordByAphiaID\/([0-9]+)$/;
const WORMS_CLASSIFICATION =
  /^\/taxonomy\/worms\/AphiaClassificationByAphiaID\/([0-9]+)$/;
const WORMS_VERNACULARS =
  /^\/taxonomy\/worms\/AphiaVernacularsByAphiaID\/([0-9]+)$/;
const WORMS_MATCH_NAMES = /^\/taxonomy\/worms\/AphiaRecordsByMatchNames$/;

export type TaxonomyUpstream = {
  url: string;
  method: "GET" | "POST";
  provider: "worms";
};

/**
 * Map `/taxonomy/worms/...` to the allowlisted upstream URL.
 * Anything else is rejected so this is not an open proxy.
 */
export function taxonomyUpstream(
  pathname: string,
  method: string
): TaxonomyUpstream | null {
  if (pathname.match(WORMS_RECORD)) {
    if (method !== "GET") return null;
    const id = pathname.split("/").pop();
    return {
      url: `${WORMS_REST_URL}/AphiaRecordByAphiaID/${id}`,
      method: "GET",
      provider: "worms",
    };
  }
  if (pathname.match(WORMS_CLASSIFICATION)) {
    if (method !== "GET") return null;
    const id = pathname.split("/").pop();
    return {
      url: `${WORMS_REST_URL}/AphiaClassificationByAphiaID/${id}`,
      method: "GET",
      provider: "worms",
    };
  }
  if (pathname.match(WORMS_VERNACULARS)) {
    if (method !== "GET") return null;
    const id = pathname.split("/").pop();
    return {
      url: `${WORMS_REST_URL}/AphiaVernacularsByAphiaID/${id}`,
      method: "GET",
      provider: "worms",
    };
  }
  if (pathname.match(WORMS_MATCH_NAMES)) {
    if (method !== "POST") return null;
    return {
      url: `${WORMS_REST_URL}/AphiaRecordsByMatchNames`,
      method: "POST",
      provider: "worms",
    };
  }
  return null;
}

function cacheKeyRequest(upstream: TaxonomyUpstream, body: string): Request {
  const keyUrl =
    upstream.method === "POST"
      ? `https://taxonomy-cache.seasketch.invalid/${upstream.provider}?body=${body}`
      : upstream.url;
  return new Request(keyUrl, { method: "GET" });
}

export async function handleTaxonomyRequest(
  request: Request,
  options?: {
    fetch?: typeof fetch;
    cache?: Cache;
    waitUntil?: (promise: Promise<unknown>) => void;
  }
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const url = new URL(request.url);
  const upstream = taxonomyUpstream(url.pathname, request.method);
  if (!upstream) {
    return new Response(
      JSON.stringify({
        error:
          "Not found. Allowlisted taxonomy proxy: /taxonomy/worms/{AphiaRecord|AphiaClassification|AphiaVernaculars}ByAphiaID/{id} or POST AphiaRecordsByMatchNames",
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const body = upstream.method === "POST" ? await request.text() : "";
  const fetchFn = options?.fetch || fetch;
  const cache = options?.cache;
  const key = cacheKeyRequest(upstream, body);

  if (cache) {
    const hit = await cache.match(key);
    if (hit) {
      const headers = new Headers(hit.headers);
      headers.set("X-Taxonomy-Cache", "hit");
      return new Response(hit.body, { status: hit.status, headers });
    }
  }

  const upstreamResponse = await fetchFn(upstream.url, {
    method: upstream.method,
    headers: {
      Accept: "application/json",
      "User-Agent": ORGANISM_USER_AGENT,
      ...(upstream.method === "POST"
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body: upstream.method === "POST" ? body : undefined,
  });

  const payload = await upstreamResponse.arrayBuffer();
  const headers = new Headers();
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Taxonomy-Cache", "miss");
  headers.set(
    "Cache-Control",
    `public, max-age=${TAXONOMY_CACHE_TTL_SECONDS}`
  );

  const response = new Response(payload, {
    status: upstreamResponse.status,
    headers,
  });

  if (cache && upstreamResponse.ok) {
    const put = cache.put(key, response.clone());
    if (options?.waitUntil) {
      options.waitUntil(put);
    } else {
      await put;
    }
  }

  return response;
}

/** Cached entrypoint: allowlisted WoRMS proxy. */
export class TaxonomyBackend extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    return handleTaxonomyRequest(request, {
      cache: caches.default,
      waitUntil: (promise) => this.ctx.waitUntil(promise),
    });
  }
}
