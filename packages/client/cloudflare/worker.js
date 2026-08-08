/**
 * SeaSketch client Worker (Workers Static Assets).
 *
 * run_worker_first: true — every request hits this script first. That is
 * required so SPA fallback cannot be skipped for browser navigations
 * (compatibility_date ≥ 2025-04-01 otherwise prefers asset serving and
 * returns a bare 404 when not_found_handling is unset).
 *
 * - /sprites/* → proxy to SPRITES_BASE_URL (OPTIONS → 204 CORS preflight)
 * - SPA paths (/, /vanuatu, /citizen.science, …) → index.html
 * - known static extensions → ASSETS (real 404 + no-store on miss)
 */

/** Extensions that are never SPA routes when present on the last path segment. */
const STATIC_FILE_EXTENSIONS = new Set([
  "js",
  "mjs",
  "cjs",
  "css",
  "map",
  "json",
  "wasm",
  "txt",
  "xml",
  "html",
  "htm",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
  "ico",
  "woff",
  "woff2",
  "ttf",
  "eot",
  "mp4",
  "webm",
  "pdf",
  "csv",
  "geojson",
  "topojson",
]);

const SPRITE_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "600",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/sprites/")) {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: SPRITE_CORS_HEADERS,
        });
      }

      const filename = /sprites\/(.*)/.exec(url.pathname)[1];
      const spriteUrl = `${env.SPRITES_BASE_URL}${filename}`;
      const response = await fetch(spriteUrl);
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("Cache-Control", "public, max-age=500");
      for (const [key, value] of Object.entries(SPRITE_CORS_HEADERS)) {
        newResponse.headers.set(key, value);
      }
      return newResponse;
    }

    if (shouldSpaFallback(url.pathname)) {
      return env.ASSETS.fetch(new URL("/index.html", url.origin));
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status === 404) {
      return new Response(null, {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }
    return assetResponse;
  },
};

/**
 * True for SPA routes: "/", "/vanuatu", "/citizen.science", "/vanuatu/app".
 * False for real static files: "/static/js/x.js", "/manifest.json".
 */
function shouldSpaFallback(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return true;
  }
  const last = segments[segments.length - 1];
  const dot = last.lastIndexOf(".");
  if (dot <= 0) {
    // No extension, or leading-dot segment — treat as SPA.
    return true;
  }
  const ext = last.slice(dot + 1).toLowerCase();
  return !STATIC_FILE_EXTENSIONS.has(ext);
}
