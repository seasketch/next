import AWS from "aws-sdk";
import { decode } from "jsonwebtoken";
import { sign } from "../auth/jwks";
import { DBClient } from "../dbClient";

/** Stable Secrets Manager name (also used when ARN env is unset). */
export const OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_NAME =
  "seasketch/overlay-engine/access-token";

export const OVERLAY_ENGINE_ACCESS_TOKEN_TTL = "14 days";

const ISSUER = (process.env.ISSUER || "seasketch.org")
  .split(",")
  .map((issuer) => issuer.trim());

export type OverlayEngineAccessTokenPayload = {
  token: string;
  exp: number;
  iat: number;
  kid: string;
};

/** Resolve secret id from env ARN or the stable name. */
export function overlayEngineAccessTokenSecretId(
  override?: string | null,
): string {
  if (override && override.trim()) return override.trim();
  const arn = process.env.OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN;
  if (arn && arn.trim()) return arn.trim();
  return OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_NAME;
}

/**
 * Mint a JWKS-signed overlay-engine JWT (14-day TTL).
 * Returns metadata suitable for Secrets Manager (never log `token`).
 */
export async function mintOverlayEngineAccessToken(
  client: DBClient,
): Promise<OverlayEngineAccessTokenPayload> {
  const token = await sign(
    client,
    { type: "overlay-engine" },
    OVERLAY_ENGINE_ACCESS_TOKEN_TTL,
    ISSUER[0],
  );
  const decoded = decode(token, { complete: true });
  if (!decoded || typeof decoded === "string" || !decoded.payload) {
    throw new Error("Failed to decode minted overlay-engine token");
  }
  const payload = decoded.payload as { exp?: number; iat?: number };
  if (typeof payload.exp !== "number" || typeof payload.iat !== "number") {
    throw new Error("Minted overlay-engine token missing exp/iat");
  }
  const kid =
    typeof decoded.header?.kid === "string" ? decoded.header.kid : "";
  return { token, exp: payload.exp, iat: payload.iat, kid };
}

function secretsManagerClient() {
  return new AWS.SecretsManager({
    region:
      process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-west-2",
  });
}

/** Publish minted token JSON to Secrets Manager. */
export async function publishOverlayEngineAccessToken(
  secretId: string,
  payload: OverlayEngineAccessTokenPayload,
): Promise<void> {
  await secretsManagerClient()
    .putSecretValue({
      SecretId: secretId,
      SecretString: JSON.stringify({
        token: payload.token,
        exp: payload.exp,
        iat: payload.iat,
        kid: payload.kid,
      }),
    })
    .promise();
}

/** Stable message prefix for API server-side uploads fetches. */
export class OverlayEngineAccessTokenError extends Error {
  constructor(reason: string) {
    super(`overlay_engine_access_token_unavailable: ${reason}`);
    this.name = "OverlayEngineAccessTokenError";
  }
}

type CachedToken = {
  token: string;
  exp: number;
};

const REFRESH_WHEN_REMAINING_MS = 24 * 60 * 60 * 1000;

let readCache: CachedToken | null = null;
let readInFlight: Promise<CachedToken | null> | null = null;
let warnedUnavailable = false;

function parseSecretString(raw: string): CachedToken {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new OverlayEngineAccessTokenError("invalid_secret");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as { token?: unknown }).token !== "string" ||
    typeof (parsed as { exp?: unknown }).exp !== "number"
  ) {
    throw new OverlayEngineAccessTokenError("invalid_secret");
  }
  const token = (parsed as { token: string }).token;
  const exp = (parsed as { exp: number }).exp;
  if (!token || !Number.isFinite(exp)) {
    throw new OverlayEngineAccessTokenError("invalid_secret");
  }
  return { token, exp };
}

function isExpired(cached: CachedToken, skewMs = 0): boolean {
  return cached.exp * 1000 <= Date.now() + skewMs;
}

function needsRefresh(cached: CachedToken): boolean {
  return cached.exp * 1000 - Date.now() < REFRESH_WHEN_REMAINING_MS;
}

function warnUnavailable(reason: string): void {
  if (warnedUnavailable) return;
  warnedUnavailable = true;
  console.warn(
    `overlay-engine access token unavailable (${reason}); continuing without Authorization`,
  );
}

/** Drop cached read token (e.g. after 401 from uploads/tiles). */
export function bustOverlayEngineAccessTokenCache(): void {
  readCache = null;
}

/**
 * Return the published overlay-engine JWT from Secrets Manager for server-side
 * fetches (GeographyPlugin, etc.). Cached in-process; refreshes within 24h of
 * expiry. Returns null (and warns once) if the secret is missing/unreadable —
 * callers should proceed without Authorization (local/dev).
 */
export async function getOverlayEngineAccessToken(): Promise<string | null> {
  if (readCache && !isExpired(readCache) && !needsRefresh(readCache)) {
    return readCache.token;
  }

  if (!readInFlight) {
    readInFlight = (async () => {
      let response;
      try {
        response = await secretsManagerClient()
          .getSecretValue({
            SecretId: overlayEngineAccessTokenSecretId(),
          })
          .promise();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        warnUnavailable(`missing:${msg}`);
        return null;
      }
      if (!response.SecretString) {
        warnUnavailable("missing");
        return null;
      }
      let fetched: CachedToken;
      try {
        fetched = parseSecretString(response.SecretString);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        warnUnavailable(msg);
        return null;
      }
      if (isExpired(fetched, 60_000)) {
        warnUnavailable("expired");
        return null;
      }
      readCache = fetched;
      warnedUnavailable = false;
      return fetched;
    })().finally(() => {
      readInFlight = null;
    });
  }

  const result = await readInFlight;
  if (!result) return null;
  if (isExpired(result, 60_000)) {
    warnUnavailable("expired");
    return null;
  }
  return result.token;
}

/**
 * fetch() with overlay-engine Bearer when available. If the secret cannot be
 * loaded, fetches without Authorization. On 401/403 with a token, busts cache
 * and retries once.
 */
export async function fetchWithOverlayEngineAccessToken(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const doFetch = async (token: string | null) => {
    const headers = new Headers(init?.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    } else {
      headers.delete("Authorization");
    }
    return fetch(input, { ...init, headers });
  };

  let token = await getOverlayEngineAccessToken();
  let response = await doFetch(token);
  if (token && (response.status === 401 || response.status === 403)) {
    bustOverlayEngineAccessTokenCache();
    token = await getOverlayEngineAccessToken();
    if (token) {
      response = await doFetch(token);
    }
  }
  return response;
}
