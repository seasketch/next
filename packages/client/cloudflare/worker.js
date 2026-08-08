/**
 * SeaSketch client Worker (Workers Static Assets).
 *
 * Existing files under build/ are served by the platform (asset-first).
 * Misses (and /sprites/* via run_worker_first) invoke this script:
 * - /sprites/* → proxy to SPRITES_BASE_URL
 * - extensionless paths (/, /vanuatu, /vanuatu/app, …) → index.html SPA shell
 * - everything else (e.g. missing /static/js/*.chunk.js) → real 404, no-store
 *
 * Extension-based SPA fallback (not Sec-Fetch-Mode) avoids HTML-as-JS cache
 * poisoning: Cloudflare does not Vary on Sec-Fetch-Mode, and /static/* has
 * immutable Cache-Control via _headers.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/sprites/")) {
      const filename = /sprites\/(.*)/.exec(url.pathname)[1];
      const spriteUrl = `${env.SPRITES_BASE_URL}${filename}`;
      const response = await fetch(spriteUrl);
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("Cache-Control", "public, max-age=500");
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      newResponse.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      newResponse.headers.set("Access-Control-Allow-Headers", "Content-Type");
      newResponse.headers.set("Access-Control-Max-Age", "600");
      return newResponse;
    }

    if (isExtensionlessPath(url.pathname)) {
      return env.ASSETS.fetch(new URL("/index.html", url.origin));
    }

    return new Response(null, {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  },
};

/**
 * True for "/", "/vanuatu", "/vanuatu/app/foo".
 * False for "/static/js/x.js", "/manifest.json".
 */
function isExtensionlessPath(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return true;
  }
  const last = segments[segments.length - 1];
  return !last.includes(".");
}
