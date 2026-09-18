import { PROD_ACL_NAMESPACE } from "./jwt";
import { extractTokenFromRequest, resolveSeaSketchAccessToken } from "./jwt";

/**
 * /taxonomy is a service proxy, not a project asset. Reuse the overlay-engine
 * JWT that overlay-worker / fragment-worker already send to this host.
 * Map-access tokens are not enough — that would let any project admin use
 * the Worker as a WoRMS proxy.
 */
export async function authorizeTaxonomyProxy(
  request: Request,
  env: { JWKS_URL?: string }
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const token = extractTokenFromRequest(request);
  if (!token) {
    return deny(401, "missing_token");
  }
  if (!env.JWKS_URL) {
    return deny(401, "jwks_url_not_configured");
  }
  try {
    const resolved = await resolveSeaSketchAccessToken(
      token,
      env.JWKS_URL,
      PROD_ACL_NAMESPACE
    );
    if (resolved.claims.type !== "overlay-engine") {
      return deny(403, "overlay_engine_required");
    }
    return { ok: true };
  } catch {
    return deny(401, "invalid_token");
  }
}

function deny(
  status: 401 | 403,
  error: string
): { ok: false; response: Response } {
  return {
    ok: false,
    response: new Response(JSON.stringify({ error }), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }),
  };
}
