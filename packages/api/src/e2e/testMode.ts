import crypto from "crypto";

/** Issuer of access tokens minted for automated tests. Production never trusts it. */
export const E2E_ISSUER = "https://e2e.seasketch.test/";

export const E2E_TOKEN_TTL_SECONDS = 12 * 60 * 60;

export function e2eTestModeRequested(): boolean {
  return process.env.E2E_TEST_MODE === "true";
}

/**
 * Fail the process when test mode is asked for in production, or without a
 * shared secret. A quiet misconfiguration must not boot a production API that
 * can mint tokens.
 */
export function assertE2ETestModeConfiguration(): void {
  if (!e2eTestModeRequested()) {
    return;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "E2E_TEST_MODE cannot be enabled when NODE_ENV is production"
    );
  }
  if (!process.env.E2E_TEST_SECRET) {
    throw new Error("E2E_TEST_MODE requires E2E_TEST_SECRET");
  }
}

export function isE2ETestModeEnabled(): boolean {
  return (
    e2eTestModeRequested() &&
    process.env.NODE_ENV !== "production" &&
    Boolean(process.env.E2E_TEST_SECRET)
  );
}

export function e2eSecretMatches(provided: unknown): boolean {
  const expected = process.env.E2E_TEST_SECRET;
  if (!isE2ETestModeEnabled() || typeof provided !== "string" || !expected) {
    return false;
  }
  const given = Buffer.from(provided);
  const actual = Buffer.from(expected);
  if (given.length !== actual.length) {
    return false;
  }
  return crypto.timingSafeEqual(given, actual);
}
