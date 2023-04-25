import { Pool, PoolClient } from "pg";
import { sign, verify } from "./auth/jwks";
import { ManagementClient } from "auth0";
import * as cache from "./cache";
import sendEmail from "./invites/sendEmail";
import htmlTemplate from "./invites/verifyEmailTemplate";
import textTemplate from "./invites/verifyEmailTemplateText";
import { default as mustache } from "mustache";

const ISSUER = (process.env.ISSUER || "seasketch.org")
  .split(",")
  .map((issuer) => issuer.trim());

export async function verifyEmailWithToken(token: string, pool: Pool) {
  const claims = await verify(pool, token, ISSUER);
  if (!claims || !claims.sub) {
    throw new Error("Invalid token");
  }
  // Use auth0 management API to set email as verified
  const auth0 = new ManagementClient({
    domain: process.env.AUTH0_DOMAIN,
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    scope: "read:users update:users",
  });
  await auth0.updateUser({ id: claims.sub }, { email_verified: true });
  // Set email as verified in redis cache so that existing tokens with stale
  // emailVerified claims can still be used
  await cache.set(`user:${claims.sub}:emailVerified`, "true");
  return claims;
}

export async function sendEmailVerification(
  pgClient: Pool | PoolClient,
  sub: string,
  email: string,
  redirectUrl?: string
) {
  const token = await sign(
    pgClient,
    {
      sub,
      email,
      redirectUrl: redirectUrl || "https://seasketch.org",
    },
    "7 days",
    ISSUER[0]
  );

  const templateVars = {
    // See server.ts for the verify-email route
    action_url: `${process.env.API_ROOT}/verify-email?verification=${token}`,
    support_email: "support@seasketch.org",
    docs_url: "http://help.seasketch.org",
  };

  const textEmail = mustache.render(textTemplate, templateVars);
  const htmlEmail = mustache.render(htmlTemplate, templateVars);

  await sendEmail(email, "Verify your SeaSketch account", htmlEmail, textEmail);
}
