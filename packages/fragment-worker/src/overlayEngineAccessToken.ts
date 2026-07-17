import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

/** Stable message prefix for fragment-worker logs / caller errors. */
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
const DEFAULT_SECRET_NAME = "seasketch/overlay-engine/access-token";

let cache: CachedToken | null = null;
let inFlight: Promise<CachedToken> | null = null;

function secretId(): string {
  const arn = process.env.OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN;
  if (arn && arn.trim()) return arn.trim();
  return DEFAULT_SECRET_NAME;
}

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

async function fetchFromSecretsManager(): Promise<CachedToken> {
  const client = new SecretsManagerClient({
    region:
      process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-west-2",
  });
  let response;
  try {
    response = await client.send(
      new GetSecretValueCommand({ SecretId: secretId() }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new OverlayEngineAccessTokenError(`missing:${msg}`);
  }
  if (!response.SecretString) {
    throw new OverlayEngineAccessTokenError("missing");
  }
  return parseSecretString(response.SecretString);
}

function isExpired(cached: CachedToken, skewMs = 0): boolean {
  return cached.exp * 1000 <= Date.now() + skewMs;
}

function needsRefresh(cached: CachedToken): boolean {
  return cached.exp * 1000 - Date.now() < REFRESH_WHEN_REMAINING_MS;
}

/** Drop cached token (e.g. after 401 from uploads). */
export function bustOverlayEngineAccessTokenCache(): void {
  cache = null;
}

/**
 * Return a valid overlay-engine JWT for uploads fetches.
 * Loads from Secrets Manager on cold start / first use; refreshes when within
 * 24h of expiry.
 */
export async function getOverlayEngineAccessToken(): Promise<string> {
  if (cache && !isExpired(cache) && !needsRefresh(cache)) {
    return cache.token;
  }

  if (!inFlight) {
    inFlight = (async () => {
      const fetched = await fetchFromSecretsManager();
      if (isExpired(fetched, 60_000)) {
        throw new OverlayEngineAccessTokenError("expired");
      }
      cache = fetched;
      return fetched;
    })().finally(() => {
      inFlight = null;
    });
  }

  const result = await inFlight;
  if (isExpired(result, 60_000)) {
    throw new OverlayEngineAccessTokenError("expired");
  }
  return result.token;
}
