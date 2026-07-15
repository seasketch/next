import {
  createLocalJWKSet,
  decodeJwt,
  jwtVerify,
  JWTPayload,
  JSONWebKeySet,
} from "jose";
import type { MapAccessClaims } from "./types";

type JwksCache = {
  url: string;
  jwks: ReturnType<typeof createLocalJWKSet>;
  fetchedAt: number;
};

let jwksCache: JwksCache | null = null;
/** How long to reuse a fetched JWKS in this isolate before re-fetching. */
const JWKS_TTL_MS = 60 * 60 * 1000; // 1 hour

/** ACL namespace that requires full JWKS signature verification (no dev-trust). */
export const PROD_ACL_NAMESPACE = "prod";

/**
 * Acceptable `iss` values on cryptographically verified map-access JWTs.
 * Production tokens are signed with ISSUER (default `seasketch.org`); the
 * public JWKS is published at api.seasket.ch.
 */
export const ALLOWED_MAP_ACCESS_ISSUERS = [
  "seasketch.org",
  "https://seasketch.org",
  "api.seasket.ch",
  "https://api.seasket.ch",
] as const;

/**
 * SeaSketch's /.well-known/jwks.json historically returned a bare JWK array.
 * RFC 7517 / jose expect `{ "keys": [ ... ] }`. Accept both.
 */
async function loadJWKS(
  jwksUrl: string,
  options?: { forceRefresh?: boolean }
): Promise<ReturnType<typeof createLocalJWKSet>> {
  const now = Date.now();
  if (
    !options?.forceRefresh &&
    jwksCache &&
    jwksCache.url === jwksUrl &&
    now - jwksCache.fetchedAt < JWKS_TTL_MS
  ) {
    return jwksCache.jwks;
  }

  const res = await fetch(jwksUrl, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`jwks_fetch_failed:${res.status}`);
  }
  const body = await res.json();
  let keyset: JSONWebKeySet;
  if (Array.isArray(body)) {
    keyset = { keys: body };
  } else if (body && Array.isArray((body as JSONWebKeySet).keys)) {
    keyset = body as JSONWebKeySet;
  } else {
    throw new Error("jwks_malformed");
  }

  const jwks = createLocalJWKSet(keyset);
  jwksCache = { url: jwksUrl, jwks, fetchedAt: now };
  return jwks;
}

/** jose: JWKS cache missed a newly rotated signing key */
function isMissingSigningKeyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /no applicable key found/i.test(msg) ||
    /\"kid\".*not present in the key store/i.test(msg) ||
    /JWKSNoMatchingKey/i.test(msg) ||
    (typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "ERR_JWKS_NO_MATCHING_KEY")
  );
}

/**
 * Prefer `?access_token=` (Mapbox-friendly; avoids CORS preflight) then
 * `Authorization: Bearer …`.
 */
export function extractTokenFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  const q = url.searchParams.get("access_token");
  if (q && q.length > 0) {
    return q;
  }
  const auth = request.headers.get("Authorization");
  if (auth && /^Bearer\s+/i.test(auth)) {
    return auth.replace(/^Bearer\s+/i, "").trim() || null;
  }
  return null;
}

/** Outcome of resolveMapAccessToken, including how the token was accepted. */
export type TokenResolveResult = {
  claims: MapAccessClaims;
  /** `jwks` = cryptographically verified; `dev-trust` = decoded only (non-prod ns) */
  mode: "jwks" | "dev-trust";
};

/**
 * Resolve a map-access token for the given ACL namespace.
 *
 * - `prod` namespace: signature must verify against JWKS_URL **and** `iss` must
 *   be a known SeaSketch issuer. The Worker only has the *public* JWKS — it
 *   never holds signing keys.
 * - Any other namespace: if JWKS+issuer verify fails (typical for local API
 *   tokens), decode and trust claims without signature checks. Still requires
 *   `type=map-access` and a non-expired `exp`. Unverified tokens are never
 *   accepted for `prod`.
 */
export async function resolveMapAccessToken(
  token: string,
  jwksUrl: string | undefined,
  ns: string,
): Promise<TokenResolveResult> {
  const isProdNs = ns === PROD_ACL_NAMESPACE;

  if (jwksUrl) {
    try {
      const claims = await verifyMapAccessToken(token, jwksUrl);
      return { claims, mode: "jwks" };
    } catch (e) {
      if (isProdNs) {
        throw e;
      }
      // fall through to trusted decode for non-prod namespaces
    }
  } else if (isProdNs) {
    throw new Error("jwks_url_not_configured");
  }

  if (isProdNs) {
    throw new Error("dev_trust_not_allowed_on_prod");
  }

  return { claims: trustDecodeMapAccessToken(token), mode: "dev-trust" };
}

/**
 * Verify an RS256 map-access JWT against JWKS and allowed issuers.
 * On missing `kid`, refetches JWKS once and retries (key rotation).
 */
export async function verifyMapAccessToken(
  token: string,
  jwksUrl: string,
  expectedSlug?: string,
): Promise<MapAccessClaims> {
  const tryVerify = async (forceRefresh: boolean) => {
    const jwks = await loadJWKS(jwksUrl, { forceRefresh });
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ["RS256"],
      issuer: [...ALLOWED_MAP_ACCESS_ISSUERS],
    });
    return assertMapAccessClaims(payload, expectedSlug);
  };

  try {
    return await tryVerify(false);
  } catch (err) {
    // After key rotation the isolate may still hold a JWKS without the new kid.
    // Refetch once and retry before failing.
    if (!isMissingSigningKeyError(err)) {
      throw err;
    }
    return await tryVerify(true);
  }
}

/**
 * Decode without verifying the signature. Only for non-prod ACL namespaces
 * (local API tokens whose keys are not in production JWKS).
 */
export function trustDecodeMapAccessToken(token: string): MapAccessClaims {
  let payload: JWTPayload;
  try {
    payload = decodeJwt(token);
  } catch {
    throw new Error("token_malformed");
  }

  return assertMapAccessClaims(payload);
}

function assertMapAccessClaims(
  payload: JWTPayload,
  expectedSlug?: string,
): MapAccessClaims {
  const claims = normalizeClaims(payload);
  if (claims.type !== "map-access") {
    throw new Error(`Unexpected token type: ${claims.type}`);
  }
  if (typeof payload.exp !== "number") {
    throw new Error("token_exp_required");
  }
  if (payload.exp * 1000 <= Date.now()) {
    throw new Error("token_expired");
  }
  if (
    expectedSlug &&
    claims.projectSlug &&
    claims.projectSlug !== expectedSlug
  ) {
    throw new Error(
      `Token projectSlug mismatch: ${claims.projectSlug} !== ${expectedSlug}`,
    );
  }
  return claims;
}

function normalizeClaims(payload: JWTPayload): MapAccessClaims {
  const type = String(payload.type ?? "");
  const role = payload.role === "admin" ? "admin" : "user";
  const groupsRaw = payload.groups;
  const groups = Array.isArray(groupsRaw)
    ? groupsRaw.map((g) => Number(g)).filter((n) => !Number.isNaN(n))
    : [];

  return {
    type: type as "map-access",
    projectId: Number(payload.projectId),
    projectSlug: String(payload.projectSlug ?? ""),
    userId: Number(payload.userId),
    role,
    groups,
    isSuperuser: Boolean(payload.isSuperuser),
    iat: typeof payload.iat === "number" ? payload.iat : undefined,
    exp: typeof payload.exp === "number" ? payload.exp : undefined,
    iss: typeof payload.iss === "string" ? payload.iss : undefined,
  };
}
