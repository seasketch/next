import { aclNamespaceFromRequest } from "../resource";
import { extractTokenFromRequest, resolveSeaSketchAccessToken } from "./jwt";

/**
 * Map tiles cannot send the overlay-engine JWT. Accept a project map-access
 * token (what the browser already puts on hosted tile URLs) or an
 * overlay-engine token.
 */
export async function authorizeGfwProxy(
  request: Request,
  env: { JWKS_URL?: string }
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const token = extractTokenFromRequest(request);
  if (!token) {
    return deny(401, "missing_token");
  }
  try {
    const resolved = await resolveSeaSketchAccessToken(
      token,
      env.JWKS_URL,
      aclNamespaceFromRequest(request)
    );
    if (
      resolved.claims.type !== "map-access" &&
      resolved.claims.type !== "overlay-engine"
    ) {
      return deny(403, "forbidden");
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
        "Access-Control-Allow-Origin": "*",
      },
    }),
  };
}
