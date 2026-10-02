import crypto from "crypto";

/** Issuer of access tokens minted for automated tests. Production never trusts it. */
export const E2E_ISSUER = "https://e2e.seasketch.test/";

export const E2E_TOKEN_TTL_SECONDS = 12 * 60 * 60;

/** Test mode signs in only users whose sub has this prefix. */
export const E2E_SUB_PREFIX = "e2e|";

export const E2E_PASSPHRASE_MIN_LENGTH = 32;

const ALLOWED_NODE_ENVS = ["development", "test"];

/** Values that only the seasketch.org production install holds. */
const PRODUCTION_CLIENT_DOMAINS = ["seasketch.org", "www.seasketch.org"];
const PRODUCTION_DATABASE_HOST_SUFFIX = ".rds.amazonaws.com";

export function e2eTestModeRequested(): boolean {
  return process.env.E2E_TEST_MODE === "true";
}

function databaseHosts(): string[] {
  const hosts: string[] = [];
  if (process.env.PGHOST) {
    hosts.push(process.env.PGHOST);
  }
  for (const url of [
    process.env.DATABASE_URL,
    process.env.ADMIN_DATABASE_URL,
  ]) {
    if (!url) {
      continue;
    }
    try {
      hosts.push(new URL(url).hostname);
    } catch {
      // An unparseable URL fails later when the pool connects.
    }
  }
  return hosts.map((host) => host.toLowerCase());
}

/**
 * Reasons test mode must not run in this process, or an empty list. Checked at
 * startup and on every use, so a process that looks like production cannot
 * mint or accept test tokens even if E2E_TEST_MODE is set.
 */
export function e2eTestModeRefusals(): string[] {
  const refusals: string[] = [];
  const nodeEnv = process.env.NODE_ENV;
  if (!nodeEnv || !ALLOWED_NODE_ENVS.includes(nodeEnv)) {
    refusals.push(
      `NODE_ENV must be development or test, not ${nodeEnv || "unset"}`
    );
  }
  const passphrase = process.env.E2E_TEST_PASSPHRASE;
  if (!passphrase) {
    refusals.push("E2E_TEST_PASSPHRASE is not set");
  } else if (passphrase.length < E2E_PASSPHRASE_MIN_LENGTH) {
    refusals.push(
      `E2E_TEST_PASSPHRASE must be at least ${E2E_PASSPHRASE_MIN_LENGTH} characters`
    );
  }
  const clientDomain = (process.env.CLIENT_DOMAIN || "").toLowerCase();
  if (PRODUCTION_CLIENT_DOMAINS.includes(clientDomain)) {
    refusals.push(`CLIENT_DOMAIN is the production domain ${clientDomain}`);
  }
  for (const host of databaseHosts()) {
    if (host.endsWith(PRODUCTION_DATABASE_HOST_SUFFIX)) {
      refusals.push(`database host ${host} is an RDS instance`);
    }
  }
  return refusals;
}

/**
 * Fail the process when test mode is asked for in an environment that might be
 * production. A quiet misconfiguration must not boot an API that can mint tokens.
 */
export function assertE2ETestModeConfiguration(): void {
  if (!e2eTestModeRequested()) {
    return;
  }
  const refusals = e2eTestModeRefusals();
  if (refusals.length > 0) {
    throw new Error(`E2E_TEST_MODE refused: ${refusals.join("; ")}`);
  }
}

export function isE2ETestModeEnabled(): boolean {
  return e2eTestModeRequested() && e2eTestModeRefusals().length === 0;
}

export function isE2ESub(sub: unknown): sub is string {
  return (
    typeof sub === "string" &&
    sub.startsWith(E2E_SUB_PREFIX) &&
    sub.length > E2E_SUB_PREFIX.length
  );
}

export function e2ePassphraseMatches(provided: unknown): boolean {
  const expected = process.env.E2E_TEST_PASSPHRASE;
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
