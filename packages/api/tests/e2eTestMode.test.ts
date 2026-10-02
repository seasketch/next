import fs from "fs";
import path from "path";
import { sql } from "slonik";
import { createPool } from "./pool";
import { asPg } from "./helpers";
import {
  assertE2ETestModeConfiguration,
  E2E_ISSUER,
  e2ePassphraseMatches,
  isE2ESub,
  isE2ETestModeEnabled,
} from "../src/e2e/testMode";
import {
  authenticateE2EToken,
  issueE2EAccessToken,
} from "../src/e2e/accessToken";
import {
  lookupCanonicalEmails,
  lookupSubsForEmails,
} from "../src/e2e/directory";
import { registerE2ETokenRoute, e2eTokenRoute } from "../src/e2e/tokenRoute";
import { createAuthorizationMiddleware } from "../src/middleware/authorizationMiddleware";
import { verifyEmail } from "../src/auth/auth0";
import { createNewKeyset, sign } from "../src/auth/jwks";
import { DBClient } from "../src/dbClient";

import SES from "aws-sdk/clients/ses";
import sendEmail from "../src/invites/sendEmail";
import { sendBulkTemplatedInviteEmail } from "../src/invites/surveyInvites";

// tests/helpers mocks SES with one shared instance. It has no sendEmail, so
// add one here to assert it is not called.
const sesInstance = new (SES as any)() as {
  sendEmail?: jest.Mock;
  sendBulkTemplatedEmail: jest.Mock;
  promise: jest.Mock;
};
sesInstance.sendEmail = jest.fn().mockReturnThis();
const mockSendEmail = sesInstance.sendEmail;
const mockSendBulkTemplatedEmail = sesInstance.sendBulkTemplatedEmail;

const pool = createPool("test");

const PASSPHRASE = "test-passphrase-that-is-at-least-32-characters";
const AUDIENCE = "https://api.seasketch.test";
const MAILBOX = path.join(process.cwd(), "e2e-emails");

const ENV_KEYS = [
  "NODE_ENV",
  "E2E_TEST_MODE",
  "E2E_TEST_PASSPHRASE",
  "JWT_AUD",
  "SES_EMAIL_SOURCE",
  "CLIENT_DOMAIN",
  "PGHOST",
  "DATABASE_URL",
  "ADMIN_DATABASE_URL",
  "AUTH0_DOMAIN",
] as const;

function enableTestMode() {
  process.env.NODE_ENV = "test";
  process.env.E2E_TEST_MODE = "true";
  process.env.E2E_TEST_PASSPHRASE = PASSPHRASE;
  process.env.JWT_AUD = AUDIENCE;
  process.env.CLIENT_DOMAIN = "localhost:3080";
  process.env.DATABASE_URL = "postgres://graphile:x@localhost:54321/seasketch";
  process.env.ADMIN_DATABASE_URL =
    "postgres://postgres:x@localhost:54321/seasketch";
  delete process.env.PGHOST;
}

/** Messages in the test mailbox sent to `destination`, removed after reading. */
function takeMail(destination: string) {
  if (!fs.existsSync(MAILBOX)) {
    return [];
  }
  const messages = [];
  for (const name of fs.readdirSync(MAILBOX)) {
    if (!name.endsWith(".json")) {
      continue;
    }
    const file = path.join(MAILBOX, name);
    const message = JSON.parse(fs.readFileSync(file, "utf8"));
    if (message.destination === destination) {
      messages.push(message);
      fs.unlinkSync(file);
    }
  }
  return messages;
}

async function authorize(client: DBClient, token: string) {
  const auth0Check = jest.fn((req: any, res: any, next: any) => next());
  const middleware = createAuthorizationMiddleware(client, auth0Check);
  const req: any = {
    query: {},
    header: (name: string) =>
      name.toLowerCase() === "authorization" ? `Bearer ${token}` : undefined,
  };
  const error = await new Promise<any>((resolve) =>
    middleware(req, {} as any, (err?: any) => resolve(err))
  );
  return { user: req.user, error, usedAuth0: auth0Check.mock.calls.length > 0 };
}

function fakeResponse() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body: unknown) => {
    res.body = body;
    return res;
  };
  return res;
}

describe("E2E_TEST_MODE", () => {
  const original: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> =
    {};

  beforeAll(() => {
    for (const key of ENV_KEYS) {
      original[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
    mockSendEmail.mockClear();
    mockSendBulkTemplatedEmail.mockClear();
  });

  describe("configuration", () => {
    test("stays off unless it is explicitly requested", () => {
      enableTestMode();
      delete process.env.E2E_TEST_MODE;
      expect(isE2ETestModeEnabled()).toBe(false);
      expect(() => assertE2ETestModeConfiguration()).not.toThrow();
    });

    test("turns on in development and test with a long passphrase", () => {
      enableTestMode();
      expect(isE2ETestModeEnabled()).toBe(true);
      expect(() => assertE2ETestModeConfiguration()).not.toThrow();
      process.env.NODE_ENV = "development";
      expect(isE2ETestModeEnabled()).toBe(true);
    });

    test.each([
      ["production", /NODE_ENV/],
      ["staging", /NODE_ENV/],
      [undefined, /NODE_ENV/],
    ])("refuses NODE_ENV %s", (nodeEnv, message) => {
      enableTestMode();
      if (nodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = nodeEnv;
      }
      expect(() => assertE2ETestModeConfiguration()).toThrow(message);
      expect(isE2ETestModeEnabled()).toBe(false);
      expect(e2ePassphraseMatches(PASSPHRASE)).toBe(false);
    });

    test("refuses a missing or short passphrase", () => {
      enableTestMode();
      delete process.env.E2E_TEST_PASSPHRASE;
      expect(() => assertE2ETestModeConfiguration()).toThrow(
        /E2E_TEST_PASSPHRASE/
      );
      expect(isE2ETestModeEnabled()).toBe(false);

      process.env.E2E_TEST_PASSPHRASE = "short";
      expect(() => assertE2ETestModeConfiguration()).toThrow(/32 characters/);
      expect(isE2ETestModeEnabled()).toBe(false);
    });

    test.each(["seasketch.org", "www.seasketch.org", "SeaSketch.org"])(
      "refuses the production client domain %s",
      (domain) => {
        enableTestMode();
        process.env.CLIENT_DOMAIN = domain;
        expect(() => assertE2ETestModeConfiguration()).toThrow(/CLIENT_DOMAIN/);
        expect(isE2ETestModeEnabled()).toBe(false);
      }
    );

    test("refuses an RDS database host", () => {
      const rds = "seasketch.abc123.us-west-2.rds.amazonaws.com";
      enableTestMode();
      process.env.PGHOST = rds;
      expect(() => assertE2ETestModeConfiguration()).toThrow(/RDS/);

      enableTestMode();
      process.env.DATABASE_URL = `postgres://graphile:x@${rds}:5432/seasketch`;
      expect(() => assertE2ETestModeConfiguration()).toThrow(/RDS/);

      enableTestMode();
      process.env.ADMIN_DATABASE_URL = `postgres://postgres:x@${rds}:5432/seasketch`;
      expect(isE2ETestModeEnabled()).toBe(false);
    });

    test("only e2e| subs are test users", () => {
      expect(isE2ESub("e2e|member")).toBe(true);
      expect(isE2ESub("e2e|")).toBe(false);
      expect(isE2ESub("google-oauth2|123")).toBe(false);
      expect(isE2ESub("seasketch|root")).toBe(false);
      expect(isE2ESub(undefined)).toBe(false);
      expect(isE2ESub(null)).toBe(false);
      expect(isE2ESub(42)).toBe(false);
    });
  });

  describe("token route registration", () => {
    test("is skipped when the mode is off", () => {
      enableTestMode();
      delete process.env.E2E_TEST_MODE;
      const app = { post: jest.fn() };
      expect(registerE2ETokenRoute(app as any, {} as DBClient)).toBe(false);
      expect(app.post).not.toHaveBeenCalled();
    });

    test("is skipped when the process looks like production", () => {
      enableTestMode();
      process.env.NODE_ENV = "production";
      const app = { post: jest.fn() };
      expect(registerE2ETokenRoute(app as any, {} as DBClient)).toBe(false);
      expect(app.post).not.toHaveBeenCalled();
    });

    test("adds POST /e2e/token when the mode is on", () => {
      enableTestMode();
      const app = { post: jest.fn() };
      expect(registerE2ETokenRoute(app as any, {} as DBClient)).toBe(true);
      expect(app.post).toHaveBeenCalledWith(
        "/e2e/token",
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  describe("tokens", () => {
    const sub = `e2e|jest-${Date.now()}`;
    const email = `jest-${Date.now()}@example.test`;
    const realSub = `google-oauth2|jest-${Date.now()}`;

    async function withUsers(fn: (client: DBClient) => Promise<void>) {
      await pool.transaction(async (conn) => {
        await conn.query(sql`SET LOCAL session_replication_role = replica`);
        await createNewKeyset(asPg(conn));
        await conn.query(
          sql`insert into users (sub, canonical_email) values (${sub}, ${email}), (${realSub}, ${"real@example.test"})`
        );
        await fn(asPg(conn));
        await conn.any(sql`ROLLBACK`);
      });
    }

    test("issues superuser and unverified tokens for an e2e user", async () => {
      enableTestMode();
      await withUsers(async (client) => {
        expect(await issueE2EAccessToken(client, "e2e|missing")).toBeNull();

        const token = await issueE2EAccessToken(client, sub, {
          superuser: true,
        });
        const claims = await authenticateE2EToken(client, token!);
        expect(claims.iss).toBe(E2E_ISSUER);
        expect(claims.sub).toBe(sub);
        expect(claims.aud).toBe(AUDIENCE);
        expect(claims["https://seasketch.org/canonical_email"]).toBe(email);
        expect(claims["https://seasketch.org/email_verified"]).toBe(true);
        expect(claims["https://seasketch.org/superuser"]).toBe(true);

        const unverified = await issueE2EAccessToken(client, sub, {
          emailVerified: false,
        });
        const unverifiedClaims = await authenticateE2EToken(
          client,
          unverified!
        );
        expect(unverifiedClaims["https://seasketch.org/email_verified"]).toBe(
          false
        );
        expect(unverifiedClaims["https://seasketch.org/superuser"]).toBe(false);

        expect(await lookupCanonicalEmails(client, [sub])).toEqual({
          [sub]: email,
        });
        expect(await lookupSubsForEmails(client, [email])).toEqual({
          [email]: sub,
        });

        process.env.JWT_AUD = "https://someone-else.example";
        await expect(authenticateE2EToken(client, token!)).rejects.toThrow(
          /audience/
        );
      });
    });

    test("will not sign in a real account, even one in the database", async () => {
      enableTestMode();
      await withUsers(async (client) => {
        await expect(issueE2EAccessToken(client, realSub)).rejects.toThrow(
          /e2e\|/
        );
        await expect(
          issueE2EAccessToken(client, "seasketch|root")
        ).rejects.toThrow(/e2e\|/);

        const forged = await sign(
          client,
          { sub: realSub, aud: AUDIENCE },
          60,
          E2E_ISSUER
        );
        await expect(authenticateE2EToken(client, forged)).rejects.toThrow(
          /e2e\|/
        );
      });
    });

    test("the token route checks the passphrase and the sub", async () => {
      enableTestMode();
      await withUsers(async (client) => {
        const route = e2eTokenRoute(client);

        const wrongPassphrase = fakeResponse();
        await route(
          { body: { passphrase: "nope", sub } } as any,
          wrongPassphrase
        );
        expect(wrongPassphrase.statusCode).toBe(401);

        const realUser = fakeResponse();
        await route(
          { body: { passphrase: PASSPHRASE, sub: realSub } } as any,
          realUser
        );
        expect(realUser.statusCode).toBe(403);

        const superuser = fakeResponse();
        await route(
          { body: { passphrase: PASSPHRASE, sub, superuser: true } } as any,
          superuser
        );
        expect(superuser.statusCode).toBe(200);
        const claims = await authenticateE2EToken(
          client,
          superuser.body.access_token
        );
        expect(claims["https://seasketch.org/superuser"]).toBe(true);
      });
    });

    test("an expired test token is rejected", async () => {
      enableTestMode();
      await withUsers(async (client) => {
        const now = Math.floor(Date.now() / 1000);
        const expired = await sign(
          client,
          { sub, aud: AUDIENCE, iat: now - 120, exp: now - 60 },
          undefined,
          E2E_ISSUER
        );
        await expect(authenticateE2EToken(client, expired)).rejects.toThrow(
          /expired/
        );
      });
    });
  });

  describe("authorization middleware", () => {
    const sub = `e2e|mw-${Date.now()}`;

    async function withToken(
      fn: (client: DBClient, token: string) => Promise<void>
    ) {
      enableTestMode();
      await pool.transaction(async (conn) => {
        await conn.query(sql`SET LOCAL session_replication_role = replica`);
        const client = asPg(conn);
        await createNewKeyset(client);
        await conn.query(
          sql`insert into users (sub, canonical_email) values (${sub}, ${"mw@example.test"})`
        );
        const token = (await issueE2EAccessToken(client, sub))!;
        await fn(client, token);
        await conn.any(sql`ROLLBACK`);
      });
    }

    test("accepts a test token while the mode is on", async () => {
      await withToken(async (client, token) => {
        const result = await authorize(client, token);
        expect(result.error).toBeUndefined();
        expect(result.usedAuth0).toBe(false);
        expect(result.user.sub).toBe(sub);
      });
    });

    test("sends a valid test token to Auth0 when the mode is off", async () => {
      await withToken(async (client, token) => {
        delete process.env.E2E_TEST_MODE;
        const result = await authorize(client, token);
        expect(result.usedAuth0).toBe(true);
        expect(result.user).toBeUndefined();
      });
    });

    test("sends a valid test token to Auth0 when NODE_ENV is production", async () => {
      await withToken(async (client, token) => {
        process.env.NODE_ENV = "production";
        const result = await authorize(client, token);
        expect(result.usedAuth0).toBe(true);
        expect(result.user).toBeUndefined();
      });
    });

    test("does not verify other locally signed tokens as test logins", async () => {
      await withToken(async (client) => {
        const inviteLike = await sign(
          client,
          { sub, aud: AUDIENCE },
          60,
          "seasketch.org"
        );
        const result = await authorize(client, inviteLike);
        expect(result.usedAuth0).toBe(true);
        expect(result.user).toBeUndefined();
      });
    });

    test("rejects a test-issuer token for a real account", async () => {
      await withToken(async (client) => {
        const forged = await sign(
          client,
          { sub: "google-oauth2|someone", aud: AUDIENCE },
          60,
          E2E_ISSUER
        );
        const result = await authorize(client, forged);
        expect(result.usedAuth0).toBe(false);
        expect(result.user).toBeUndefined();
        expect(result.error.code).toBe("invalid_token");
      });
    });
  });

  describe("Auth0 Management and email", () => {
    test("verifyEmail does not call Auth0", async () => {
      enableTestMode();
      delete process.env.AUTH0_DOMAIN;
      await expect(verifyEmail("e2e|member")).resolves.toMatchObject({
        email_verified: true,
      });
    });

    test("sendEmail writes a file and does not call SES", async () => {
      enableTestMode();
      delete process.env.SES_EMAIL_SOURCE;
      const destination = `send-${Date.now()}@example.test`;

      const result = await sendEmail(
        destination,
        "Invite",
        '<a href="https://example.test/invite">join</a>',
        "join https://example.test/invite"
      );
      expect(result).toMatchObject({ MessageId: "e2e-test-mode" });
      expect(mockSendEmail).not.toHaveBeenCalled();

      const mail = takeMail(destination);
      expect(mail).toHaveLength(1);
      expect(mail[0].textEmail).toContain("https://example.test/invite");
    });

    test("survey invites write each destination and do not call SES", async () => {
      enableTestMode();
      const first = `survey-a-${Date.now()}@example.test`;
      const second = `survey-b-${Date.now()}@example.test`;

      const response = await sendBulkTemplatedInviteEmail({
        Source: "noreply@example.test",
        Template: "SeaSketchSurveyInvite",
        Destinations: [first, second].map((address) => ({
          Destination: { ToAddresses: [address] },
          ReplacementTags: [
            {
              Name: "inviteLink",
              Value: `https://example.test/auth/surveyInvite?token=${address}`,
            },
            { Name: "surveyName", Value: "Ocean uses" },
          ],
        })),
      });
      expect(mockSendBulkTemplatedEmail).not.toHaveBeenCalled();
      expect(response.Status).toHaveLength(2);
      expect(response.Status.every((s) => s.Status === "Success")).toBe(true);

      for (const address of [first, second]) {
        const mail = takeMail(address);
        expect(mail).toHaveLength(1);
        expect(mail[0].template).toBe("SeaSketchSurveyInvite");
        expect(mail[0].replacementTags.inviteLink).toBe(
          `https://example.test/auth/surveyInvite?token=${address}`
        );
        expect(mail[0].textEmail).toContain(address);
      }
    });

    test("survey invites still use SES when the mode is off", async () => {
      enableTestMode();
      delete process.env.E2E_TEST_MODE;
      sesInstance.promise.mockResolvedValueOnce({ Status: [] });
      await sendBulkTemplatedInviteEmail({
        Source: "noreply@example.test",
        Template: "SeaSketchSurveyInvite",
        Destinations: [],
      });
      expect(mockSendBulkTemplatedEmail).toHaveBeenCalledTimes(1);
    });
  });
});
