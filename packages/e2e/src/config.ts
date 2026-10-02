import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

/**
 * Last assignment in a file wins. That matches the dotenv Create React App
 * loads, which overwrites duplicate keys. Developer `.env` files often keep
 * an older client id above the one the running bundle actually uses.
 */
function readEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) {
    return {};
  }
  const values: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) {
      continue;
    }
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

/**
 * Same file order as `react-scripts start`: the first file to set a key
 * wins, and later files only fill gaps.
 */
function readClientEnvironment(): Record<string, string> {
  const dir = path.join(repoRoot, "packages/client");
  const merged: Record<string, string> = {};
  for (const name of [
    ".env.development.local",
    ".env.local",
    ".env.development",
    ".env",
  ]) {
    for (const [key, value] of Object.entries(readEnvFile(path.join(dir, name)))) {
      if (merged[key] === undefined) {
        merged[key] = value;
      }
    }
  }
  return merged;
}

const e2eEnv = readEnvFile(path.join(__dirname, "../e2e.env"));
const clientEnv = readClientEnvironment();

function required(name: string, value: string | undefined): string {
  if (!value || value.startsWith("op://")) {
    throw new Error(
      process.env.CI
        ? `${name} is missing from the environment. CI starts the client with these variables; there is no packages/client/.env.`
        : `${name} is missing. The smoke suite reads it from packages/client/.env, which is what the running client was started with.`
    );
  }
  return value;
}

/**
 * Locally the client is already running from packages/client/.env. In CI the
 * workflow starts it, and Create React App uses the process environment
 * instead of that file.
 */
const auth0Source = process.env.CI ? process.env : clientEnv;

/** Scope the Auth0 SPA SDK actually caches. It always adds openid, and offline_access when refresh tokens are on. */
export function auth0CacheScope(configuredScope: string): string {
  const parts = ["openid", ...configuredScope.split(/\s+/), "offline_access"];
  const seen = new Set<string>();
  return parts.filter((part) => part && !seen.has(part) && seen.add(part)).join(" ");
}

export const e2ePassphrase =
  process.env.E2E_TEST_PASSPHRASE || e2eEnv.E2E_TEST_PASSPHRASE;
export const apiURL = process.env.E2E_API_URL || "http://localhost:3857";
export const clientURL = process.env.E2E_CLIENT_URL || "http://localhost:3000";
export const databaseURL =
  process.env.ADMIN_DATABASE_URL ||
  "postgres://postgres:password@localhost:54321/seasketch";

export const auth0 = {
  clientId: required(
    "REACT_APP_AUTH0_CLIENT_ID",
    auth0Source.REACT_APP_AUTH0_CLIENT_ID
  ),
  audience: required(
    "REACT_APP_AUTH0_AUDIENCE",
    auth0Source.REACT_APP_AUTH0_AUDIENCE
  ),
  scope: auth0CacheScope(
    required("REACT_APP_AUTH0_SCOPE", auth0Source.REACT_APP_AUTH0_SCOPE)
  ),
};

export const personas = {
  member: { sub: "e2e|member", superuser: false },
  admin: { sub: "e2e|admin", superuser: false },
} as const;

export type Persona = (typeof personas)[keyof typeof personas];
