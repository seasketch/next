import fs from "fs";
import path from "path";
import { sql } from "slonik";
import { createPool } from "./pool";
import { asPg } from "./helpers";
import {
  assertE2ETestModeConfiguration,
  E2E_ISSUER,
  e2eSecretMatches,
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
import { verifyEmail } from "../src/auth/auth0";
import { createNewKeyset } from "../src/auth/jwks";

jest.mock("aws-sdk/clients/ses", () => {
  const sendEmail = jest.fn(() => ({
    promise: () => Promise.resolve({ MessageId: "ses" }),
  }));
  const SES = jest.fn().mockImplementation(() => ({ sendEmail }));
  return SES;
});

import sendEmail from "../src/invites/sendEmail";

const pool = createPool("test");

const ENV_KEYS = [
  "NODE_ENV",
  "E2E_TEST_MODE",
  "E2E_TEST_SECRET",
  "JWT_AUD",
  "SES_EMAIL_SOURCE",
] as const;

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
  });

  test("stays off unless it is explicitly enabled with a secret", () => {
    delete process.env.E2E_TEST_MODE;
    delete process.env.E2E_TEST_SECRET;
    expect(isE2ETestModeEnabled()).toBe(false);
    expect(() => assertE2ETestModeConfiguration()).not.toThrow();

    process.env.E2E_TEST_MODE = "true";
    expect(() => assertE2ETestModeConfiguration()).toThrow(/E2E_TEST_SECRET/);
    expect(isE2ETestModeEnabled()).toBe(false);
  });

  test("refuses to enable when NODE_ENV is production", () => {
    process.env.NODE_ENV = "production";
    process.env.E2E_TEST_MODE = "true";
    process.env.E2E_TEST_SECRET = "secret";
    expect(() => assertE2ETestModeConfiguration()).toThrow(/production/);
    expect(isE2ETestModeEnabled()).toBe(false);
    expect(e2eSecretMatches("secret")).toBe(false);
  });

  test("issues a token for a known user and rejects everyone else", async () => {
    process.env.NODE_ENV = "test";
    process.env.E2E_TEST_MODE = "true";
    process.env.E2E_TEST_SECRET = "test-secret";
    process.env.JWT_AUD = "https://api.seasketch.test";
    const sub = `e2e|jest-${Date.now()}`;
    const email = `${sub}@example.test`;

    await pool.transaction(async (conn) => {
      await conn.query(sql`SET LOCAL session_replication_role = replica`);
      await createNewKeyset(asPg(conn));
      await conn.query(
        sql`insert into users (sub, canonical_email) values (${sub}, ${email})`
      );
      const client = asPg(conn);

      expect(await issueE2EAccessToken(client, "e2e|missing")).toBeNull();
      expect(e2eSecretMatches("nope")).toBe(false);
      expect(e2eSecretMatches("test-secret")).toBe(true);

      const token = await issueE2EAccessToken(client, sub, {
        superuser: true,
      });
      expect(token).toEqual(expect.any(String));
      const claims = await authenticateE2EToken(client, token!);
      expect(claims.iss).toBe(E2E_ISSUER);
      expect(claims.sub).toBe(sub);
      expect(claims.aud).toBe("https://api.seasketch.test");
      expect(claims["https://seasketch.org/canonical_email"]).toBe(email);
      expect(claims["https://seasketch.org/email_verified"]).toBe(true);
      expect(claims["https://seasketch.org/superuser"]).toBe(true);

      const unverified = await issueE2EAccessToken(client, sub, {
        emailVerified: false,
      });
      const unverifiedClaims = await authenticateE2EToken(client, unverified!);
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

      await conn.any(sql`ROLLBACK`);
    });
  });

  test("verifyEmail does not call Auth0", async () => {
    process.env.NODE_ENV = "test";
    process.env.E2E_TEST_MODE = "true";
    process.env.E2E_TEST_SECRET = "test-secret";
    delete process.env.AUTH0_DOMAIN;
    await expect(verifyEmail("e2e|member")).resolves.toMatchObject({
      email_verified: true,
    });
  });

  test("sendEmail writes a file and does not call SES", async () => {
    process.env.NODE_ENV = "test";
    process.env.E2E_TEST_MODE = "true";
    process.env.E2E_TEST_SECRET = "test-secret";
    delete process.env.SES_EMAIL_SOURCE;

    const result = await sendEmail(
      "member@example.test",
      "Invite",
      "<a href=\"https://example.test/invite\">join</a>",
      "join https://example.test/invite"
    );
    expect(result).toMatchObject({ MessageId: "e2e-test-mode" });

    const dir = path.join(process.cwd(), "e2e-emails");
    const files = fs.readdirSync(dir).filter((name) => name.endsWith(".json"));
    const written = files
      .map((name) =>
        JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as {
          destination: string;
          textEmail: string;
        }
      )
      .find((message) => message.destination === "member@example.test");
    expect(written?.textEmail).toContain("https://example.test/invite");
    for (const name of files) {
      if (
        JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")).destination ===
        "member@example.test"
      ) {
        fs.unlinkSync(path.join(dir, name));
      }
    }
  });
});
