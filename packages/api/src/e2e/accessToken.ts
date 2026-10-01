import jwt from "jsonwebtoken";
import { DBClient } from "../dbClient";
import { sign, verify } from "../auth/jwks";
import { E2E_ISSUER, E2E_TOKEN_TTL_SECONDS } from "./testMode";

const CANONICAL_EMAIL = "https://seasketch.org/canonical_email";
const EMAIL_VERIFIED = "https://seasketch.org/email_verified";
const SUPERUSER = "https://seasketch.org/superuser";

export type E2ETokenOptions = {
  superuser?: boolean;
  emailVerified?: boolean;
};

/**
 * Sign an access token for a user who already exists in this database.
 * Returns null when `sub` is unknown. Claims match the Auth0 Action names so
 * the rest of the API does not grow a test-mode branch.
 */
export async function issueE2EAccessToken(
  client: DBClient,
  sub: string,
  options: E2ETokenOptions = {}
): Promise<string | null> {
  const audience = process.env.JWT_AUD;
  if (!audience) {
    throw new Error("JWT_AUD is not set");
  }
  const { rows } = await client.query(
    `select canonical_email from users where sub = $1`,
    [sub]
  );
  if (rows.length === 0) {
    return null;
  }
  const emailVerified = options.emailVerified !== false;
  const superuser = options.superuser === true;
  return sign(
    client,
    {
      sub,
      aud: audience,
      [CANONICAL_EMAIL]: rows[0].canonical_email,
      [EMAIL_VERIFIED]: emailVerified,
      [SUPERUSER]: superuser,
    },
    E2E_TOKEN_TTL_SECONDS,
    E2E_ISSUER
  );
}

export function tokenIssuer(token: string): string | undefined {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === "string") {
    return undefined;
  }
  return typeof decoded.iss === "string" ? decoded.iss : undefined;
}

/** Verify a test-mode access token against the local jwks table. */
export async function authenticateE2EToken(client: DBClient, token: string) {
  const claims = await verify<Record<string, unknown>>(
    client,
    token,
    E2E_ISSUER,
    "12h"
  );
  const audience = claims.aud;
  const audiences = Array.isArray(audience) ? audience : [audience];
  if (!process.env.JWT_AUD || !audiences.includes(process.env.JWT_AUD)) {
    throw Object.assign(new Error("invalid audience"), { code: "invalid_token" });
  }
  return claims;
}
