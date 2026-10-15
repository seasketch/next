/**
 * Compares the environment to packages/api/env-manifest.json.
 *
 * setup.sh runs this file directly and always checks, because setup is not a
 * production deploy. API startup calls assertNonProductionProfile and skips
 * the file when NODE_ENV is production.
 *
 * Forbidden entries with enforce:false are recorded for the Auth0 cutover and
 * do not refuse today's laptops.
 */
const fs = require("fs");
const path = require("path");

const MANIFEST_PATH = path.join(__dirname, "env-manifest.json");
const CLASSES = [
  "public-config",
  "shared-development-secret",
  "ci-secret",
  "production-secret",
  "per-environment-name",
];

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isForbiddenEntry(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return (
    typeof value.name === "string" &&
    value.name.length > 0 &&
    typeof value.equals === "string" &&
    value.equals.length > 0 &&
    typeof value.enforce === "boolean"
  );
}

function isVariable(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return (
    typeof value.name === "string" &&
    value.name.length > 0 &&
    typeof value.class === "string" &&
    CLASSES.includes(value.class) &&
    isStringArray(value.packages) &&
    isStringArray(value.requiredBy) &&
    typeof value.description === "string"
  );
}

function loadManifest(raw) {
  if (raw === null || raw === undefined || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("env-manifest.json must be an object");
  }
  if (!Array.isArray(raw.variables) || !raw.variables.every(isVariable)) {
    throw new Error("env-manifest.json variables are missing or malformed");
  }
  const profiles = raw.profiles;
  if (profiles === null || typeof profiles !== "object" || Array.isArray(profiles)) {
    throw new Error("env-manifest.json profiles must be an object");
  }
  const profile = profiles["seasketch.org"];
  if (profile === null || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error("env-manifest.json is missing the seasketch.org profile");
  }
  if (!Array.isArray(profile.forbidden) || !profile.forbidden.every(isForbiddenEntry)) {
    throw new Error("seasketch.org forbidden entries are missing or malformed");
  }
  return raw;
}

function readManifest() {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read ${MANIFEST_PATH}: ${message}`);
  }
  return loadManifest(parsed);
}

function comparable(value) {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

function productionProfileRefusals(env, manifest) {
  const refusals = [];
  for (const entry of manifest.profiles["seasketch.org"].forbidden) {
    if (!entry.enforce) {
      continue;
    }
    const actual = env[entry.name];
    if (typeof actual !== "string" || actual.trim() === "") {
      continue;
    }
    if (comparable(actual) === comparable(entry.equals)) {
      refusals.push(
        `${entry.name} is the seasketch.org production value ${entry.equals}`,
      );
    }
  }
  return refusals;
}

function assertNonProductionProfile(env = process.env) {
  if (env.NODE_ENV === "production") {
    return;
  }
  const refusals = productionProfileRefusals(env, readManifest());
  if (refusals.length > 0) {
    throw new Error(
      `Refusing production configuration: ${refusals.join("; ")}`,
    );
  }
}

function readDotenvFile(file) {
  if (!fs.existsSync(file)) {
    return null;
  }
  return require("dotenv").parse(fs.readFileSync(file));
}

function assertSetupEnvironment() {
  const manifest = readManifest();
  const files = [
    path.join(__dirname, ".env"),
    path.join(__dirname, "..", "client", ".env"),
  ];
  const refusals = [];
  for (const file of files) {
    const parsed = readDotenvFile(file);
    if (!parsed) {
      continue;
    }
    refusals.push(...productionProfileRefusals(parsed, manifest));
  }
  refusals.push(...productionProfileRefusals(process.env, manifest));
  const unique = [...new Set(refusals)];
  if (unique.length > 0) {
    console.error(`Refusing production configuration: ${unique.join("; ")}`);
    process.exit(1);
  }
}

if (require.main === module) {
  assertSetupEnvironment();
}

module.exports = {
  loadManifest,
  readManifest,
  productionProfileRefusals,
  assertNonProductionProfile,
};
