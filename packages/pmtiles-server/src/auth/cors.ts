/**
 * CORS helpers for the /v2 authorization gateway.
 *
 * Allowed browser origins are SeaSketch hosts plus localhost / 127.0.0.1.
 * This is a browser same-origin policy gate only — it is not tile authorization.
 */

const ALLOWED_ORIGIN_SUFFIXES = [
  "seasketch.org",
  "localhost",
  "127.0.0.1",
];

/** True when Origin is a SeaSketch hostname or local development host. */
export function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    const host = u.hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
    return ALLOWED_ORIGIN_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    );
  } catch {
    return false;
  }
}

/**
 * Set CORS response headers for an /v2 reply.
 *
 * Echoes allowed Origins (with Vary). Omits ACAO for disallowed browser origins
 * (browser will block). Uses `*` when there is no Origin (non-browser clients).
 * With `allowAuthorization`, advertises Authorization / GET / HEAD / OPTIONS.
 */
export function applyCorsHeaders(
  headers: Headers,
  request: Request,
  options?: { allowAuthorization?: boolean }
) {
  const origin = request.headers.get("Origin");
  // Backends may set permissive CORS for direct public access. The gateway is
  // authoritative for outward responses and must not preserve that wildcard
  // when a browser supplied a disallowed Origin.
  headers.delete("Access-Control-Allow-Origin");
  if (isAllowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  } else if (!origin) {
    // Non-browser clients
    headers.set("Access-Control-Allow-Origin", "*");
  }
  // If origin present but not allowed, omit ACAO (browser will block).

  if (options?.allowAuthorization) {
    headers.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type"
    );
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    headers.set("Access-Control-Max-Age", "86400");
  }
}

/** Empty 204 response for browser OPTIONS preflight on /v2 routes. */
export function corsPreflightResponse(request: Request): Response {
  const headers = new Headers();
  applyCorsHeaders(headers, request, { allowAuthorization: true });
  return new Response(null, { status: 204, headers });
}
