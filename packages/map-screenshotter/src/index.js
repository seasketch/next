import { captureMap } from "./capture.js";
import { parseScreenshotRequest, tokensMatch } from "./validate.js";

export default {
  /**
   * @param {Request} request
   * @param {{ BROWSER: import("@cloudflare/puppeteer").BrowserWorker, SCREENSHOTTER_TOKEN: string, SCREENSHOTTER_ALLOW_LOCALHOST?: string }} env
   */
  async fetch(request, env) {
    if (request.method === "GET" && new URL(request.url).pathname === "/health") {
      return json({ ok: true }, 200);
    }
    if (request.method !== "POST") {
      return json({ error: "POST required" }, 405);
    }
    const header = request.headers.get("Authorization") ?? "";
    const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!env.SCREENSHOTTER_TOKEN || !tokensMatch(presented, env.SCREENSHOTTER_TOKEN)) {
      return json({ error: "Unauthorized" }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const parsed = parseScreenshotRequest(body, {
      allowLocalhost: env.SCREENSHOTTER_ALLOW_LOCALHOST === "true",
    });
    if (!parsed.ok) {
      return json({ error: parsed.error }, 400);
    }

    try {
      const png = await captureMap(env.BROWSER, parsed.request);
      if (png.byteLength === 0) {
        return json({ error: "Screenshot was empty" }, 500);
      }
      return new Response(png, {
        headers: { "content-type": "image/png" },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Screenshot failed";
      console.error(JSON.stringify({ msg: "screenshot failed", message }));
      return json({ error: message }, 500);
    }
  },
};

/**
 * @param {Record<string, string>} body
 * @param {number} status
 */
function json(body, status) {
  return Response.json(body, { status });
}
