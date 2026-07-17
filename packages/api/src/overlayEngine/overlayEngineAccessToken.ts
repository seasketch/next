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

/** Publish minted token JSON to Secrets Manager. */
export async function publishOverlayEngineAccessToken(
  secretId: string,
  payload: OverlayEngineAccessTokenPayload,
): Promise<void> {
  const sm = new AWS.SecretsManager({
    region:
      process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-west-2",
  });
  await sm
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
