import { lookupAclForAuth } from "./auth/acl";
import { authorizeAccess } from "./auth/authorize";
import { applyCorsHeaders, corsPreflightResponse } from "./auth/cors";
import {
  extractTokenFromRequest,
  resolveMapAccessToken,
} from "./auth/jwt";
import { parseV2Path, isV2PreviewPath } from "./auth/path";
import type { AuthDecision, MapAccessClaims } from "./auth/types";
import { renderTokenPrompt } from "./tokenPrompt";

type GatewayEnv = Env & {
  TILES_BUCKET: R2Bucket;
  JWKS_URL?: string;
};

type TilesBackendFetcher = {
  fetch(request: Request, options?: { cf?: { cacheKey?: string } }): Promise<Response>;
};

/** Data-library layers live under /projects/superuser/public/... and are always public. */
const DATA_LIBRARY_STORAGE_SLUG = "superuser";

/**
 * Authorize a /v2/{ns}/projects/{storageSlug}/public/{uuid}... request and
 * forward to TilesBackend on allow.
 *
 * ACL docs are keyed by the *project* slug (from the map-access JWT when
 * present, otherwise the storage path slug). Storage path slug may differ from
 * the project slug when a project was renamed or data_source URLs were copied.
 *
 * Exception: storage slug `superuser` is the shared data library — always
 * public, no ACL doc or token required.
 */
export async function handleGatewayRequest(
  request: Request,
  env: GatewayEnv,
  tilesBackend: TilesBackendFetcher
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return corsPreflightResponse(request);
  }

  const url = new URL(request.url);
  const parts = parseV2Path(url.pathname);
  if (!parts) {
    const headers = new Headers({ "Content-Type": "text/plain" });
    applyCorsHeaders(headers, request, { allowAuthorization: true });
    return new Response("Invalid /v2 tile URL", { status: 400, headers });
  }

  const { ns, slug: storageSlug, uuid, legacyPath } = parts;

  if (storageSlug === DATA_LIBRARY_STORAGE_SLUG) {
    const decision: AuthDecision = {
      allowed: true,
      status: 200,
      reason: "data_library",
      aclClass: "public",
      hadToken: false,
      role: null,
      groups: [],
      aclVersion: null,
    };
    logAuthDecision({
      ns,
      storageSlug,
      aclSlug: storageSlug,
      uuid,
      decision,
      fromCache: false,
      path: url.pathname,
    });
    return forwardToBackend(request, tilesBackend, legacyPath, decision);
  }

  let claims: MapAccessClaims | null = null;
  let tokenError: string | null = null;
  let tokenMode: "jwks" | "dev-trust" | null = null;
  const rawToken = extractTokenFromRequest(request);

  // Resolve token before ACL when present so we can look up the project ACL
  // (JWT projectSlug), not only the storage-path slug.
  // Non-prod namespaces accept local/dev JWTs without JWKS verification.
  if (rawToken) {
    try {
      const resolved = await resolveMapAccessToken(
        rawToken,
        env.JWKS_URL,
        ns
      );
      claims = resolved.claims;
      tokenMode = resolved.mode;
    } catch (e: any) {
      tokenError = e?.message || "verify_failed";
      claims = null;
    }
  }

  const aclSlug = claims?.projectSlug || storageSlug;
  const acl = await lookupAclForAuth(env.TILES_BUCKET, ns, aclSlug, uuid);

  // Public tiles skip token requirements; clear spurious verify errors.
  if (acl.class === "public") {
    tokenError = null;
  } else if (!rawToken) {
    tokenError = null; // missing handled in authorizeAccess
  }

  const decision = authorizeAccess({
    aclClass: acl.class,
    aclRules: acl.rules,
    claims,
    tokenError,
    aclProjectSlug: acl.doc?.slug || aclSlug,
  });
  decision.aclVersion = acl.doc?.v ?? null;

  logAuthDecision({
    ns,
    storageSlug,
    aclSlug,
    uuid,
    decision,
    fromCache: acl.fromCache,
    path: url.pathname,
    tokenMode,
  });

  if (!decision.allowed) {
    return authDenyResponse(request, decision);
  }

  return forwardToBackend(request, tilesBackend, legacyPath, decision);
}

async function forwardToBackend(
  request: Request,
  tilesBackend: TilesBackendFetcher,
  legacyPath: string,
  decision: AuthDecision
): Promise<Response> {
  const forwardUrl = new URL(request.url);
  forwardUrl.pathname = legacyPath;
  forwardUrl.searchParams.delete("access_token");

  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.delete("Authorization");

  const forwardReq = new Request(forwardUrl.toString(), {
    method: request.method,
    headers: forwardHeaders,
  });

  // Include ?download= in the Workers cache key so Content-Disposition varies
  // by download filename without contaminating tile/TileJSON cache entries.
  const download = forwardUrl.searchParams.get("download");
  const cacheKey =
    download && download.length > 0
      ? `${legacyPath}?download=${download}`
      : legacyPath;

  const backendResponse = await tilesBackend.fetch(forwardReq, {
    cf: { cacheKey },
  });

  return decorateGatewayResponse(request, backendResponse, decision);
}

function logAuthDecision(args: {
  ns: string;
  storageSlug: string;
  aclSlug: string;
  uuid: string;
  decision: AuthDecision;
  fromCache: boolean;
  path: string;
  tokenMode?: "jwks" | "dev-trust" | null;
}) {
  const {
    ns,
    storageSlug,
    aclSlug,
    uuid,
    decision,
    fromCache,
    path,
    tokenMode,
  } = args;
  console.log(
    JSON.stringify({
      msg: "tile-auth",
      ns,
      storageSlug,
      aclSlug,
      uuid,
      path,
      allowed: decision.allowed,
      status: decision.status,
      reason: decision.reason,
      aclClass: decision.aclClass,
      hadToken: decision.hadToken,
      tokenMode: tokenMode ?? null,
      role: decision.role,
      groups: decision.groups,
      aclVersion: decision.aclVersion,
      fromCache,
    })
  );
}

function authDenyResponse(request: Request, decision: AuthDecision): Response {
  const url = new URL(request.url);
  const wantsHtmlPreview =
    isV2PreviewPath(url.pathname) &&
    (request.method === "GET" || request.method === "HEAD") &&
    acceptsHtml(request);

  if (wantsHtmlPreview) {
    const headers = new Headers({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-SS-Tile-Auth": `deny:${decision.reason}`,
    });
    applyCorsHeaders(headers, request, { allowAuthorization: true });
    return new Response(
      renderTokenPrompt({
        hadToken: decision.hadToken,
        error:
          decision.reason.startsWith("invalid_token:")
            ? decision.reason.replace(/^invalid_token:/, "")
            : null,
      }),
      { status: decision.status, headers }
    );
  }

  const headers = new Headers({
    "Content-Type": "text/plain",
    "Cache-Control": "no-store",
    "X-SS-Tile-Auth": `deny:${decision.reason}`,
  });
  applyCorsHeaders(headers, request, { allowAuthorization: true });
  const body =
    decision.status === 401 ? "Unauthorized" : "Forbidden";
  return new Response(body, { status: decision.status, headers });
}

function acceptsHtml(request: Request): boolean {
  const accept = request.headers.get("Accept") || "";
  // Browser navigations typically include text/html; tile clients usually don't.
  if (!accept || accept === "*/*") return true;
  return /text\/html/i.test(accept);
}

function decorateGatewayResponse(
  request: Request,
  backendResponse: Response,
  decision: AuthDecision
): Response {
  const headers = new Headers(backendResponse.headers);
  applyCorsHeaders(headers, request, { allowAuthorization: true });
  headers.set(
    "X-SS-Tile-Auth",
    `allow:${decision.reason}:${decision.aclClass}`
  );

  if (decision.aclClass !== "public") {
    headers.set("Cache-Control", "private, immutable, max-age=31536000");
  }

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers,
  });
}
