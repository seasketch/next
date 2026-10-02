import { APIRequestContext, BrowserContext } from "@playwright/test";
import { auth0, e2ePassphrase, Persona, apiURL, clientURL } from "./config";

const CANONICAL_EMAIL = "https://seasketch.org/canonical_email";
const EMAIL_VERIFIED = "https://seasketch.org/email_verified";
const SUPERUSER = "https://seasketch.org/superuser";

type Claims = {
  sub: string;
  exp: number;
  aud: string;
  iss: string;
  [key: string]: unknown;
};

export type IssuedToken = {
  accessToken: string;
  claims: Claims;
};

/**
 * Ask the local API for an access token. The API signs it with its own key
 * under the test issuer. Production does not expose this route.
 */
export async function issueToken(
  request: APIRequestContext,
  persona: Persona
): Promise<IssuedToken> {
  let response;
  try {
    response = await request.post(`${apiURL}/e2e/token`, {
      data: {
        passphrase: e2ePassphrase,
        sub: persona.sub,
        superuser: persona.superuser,
        emailVerified: true,
      },
    });
  } catch (error) {
    throw new Error(
      `Could not reach ${apiURL}/e2e/token. Start Postgres, then from packages/api run: set -a; source ../e2e/e2e.env; set +a; npm run dev`
    );
  }
  if (response.status() === 404) {
    throw new Error(
      `POST /e2e/token is not registered. The API on ${apiURL} was started without E2E_TEST_MODE. Stop it and start it with packages/e2e/e2e.env sourced, so NODE_ENV stays development and the test passphrase is set.`
    );
  }
  if (!response.ok()) {
    throw new Error(
      `POST /e2e/token failed (${response.status()}): ${await response.text()}`
    );
  }
  const body = (await response.json()) as { access_token: string };
  return { accessToken: body.access_token, claims: decodeJwt(body.access_token) };
}

function decodeJwt(token: string): Claims {
  const payload = token.split(".")[1];
  if (!payload) {
    throw new Error("Access token has no payload");
  }
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

/**
 * Plant the same localStorage entries and session cookie a completed Auth0
 * login leaves behind (@auth0/auth0-spa-js 2, cacheLocation localstorage,
 * useRefreshTokens). The access token is still valid, so the SDK returns it
 * from cache and does not call Auth0. No refresh token is stored.
 */
export async function installSession(
  context: BrowserContext,
  issued: IssuedToken
) {
  const { accessToken, claims } = issued;
  const user = {
    sub: claims.sub,
    email: claims[CANONICAL_EMAIL],
    email_verified: claims[EMAIL_VERIFIED] === true,
    name: claims[CANONICAL_EMAIL],
    nickname: claims.sub,
    [CANONICAL_EMAIL]: claims[CANONICAL_EMAIL],
    [EMAIL_VERIFIED]: claims[EMAIL_VERIFIED],
    [SUPERUSER]: claims[SUPERUSER] === true,
  };
  const decodedToken = { claims, user };
  const accessKey = `@@auth0spajs@@::${auth0.clientId}::${auth0.audience}::${auth0.scope}`;
  const userKey = `@@auth0spajs@@::${auth0.clientId}::@@user@@`;
  const entries: [string, string][] = [
    [
      accessKey,
      JSON.stringify({
        body: {
          access_token: accessToken,
          expires_in: claims.exp - Math.floor(Date.now() / 1000),
          audience: auth0.audience,
          scope: auth0.scope,
          client_id: auth0.clientId,
          decodedToken,
        },
        expiresAt: claims.exp,
      }),
    ],
    [
      userKey,
      JSON.stringify({
        id_token: accessToken,
        decodedToken,
      }),
    ],
  ];

  await context.addCookies([
    {
      name: `auth0.${auth0.clientId}.is.authenticated`,
      value: "true",
      url: clientURL,
      sameSite: "Lax",
    },
  ]);
  await context.addInitScript((items) => {
    for (const [key, value] of items) {
      window.localStorage.setItem(key, value);
    }
  }, entries);
}
