// Values other code needs from wrangler.jsonc: the S3 credentials, bucket
// names, and the path Miniflare serves the S3 API under. The dev launcher,
// the contract test, and scripts/dev.config.mjs import this instead of
// repeating the strings.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const packageDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(packageDir, "..", "..");

// npm hoists wrangler to the root node_modules unless versions conflict, so
// resolve it rather than assuming a path. Run with process.execPath.
const wranglerPackageJson = createRequire(import.meta.url).resolve(
  "wrangler/package.json"
);
export const wranglerBin = path.join(
  path.dirname(wranglerPackageJson),
  "bin",
  "wrangler.js"
);

// The Miniflare that wrangler itself runs. The repository has an older
// miniflare at the root (a dependency of @cloudflare/vitest-pool-workers)
// which has no S3 API and writes a different on-disk layout, so resolve the
// copy nested under wrangler. That is the one the pmtiles-server sessions
// run through `wrangler dev`, so both read and write the same files.
export const miniflare = createRequire(wranglerPackageJson)("miniflare");

export const defaultPort = 8333;
export const defaultPersistDir = path.join(repoRoot, ".data", "wrangler");

// Miniflare serves the S3 API here on the wrangler dev port.
export const s3Path = "/cdn-cgi/local/r2/s3";

function readWranglerConfig() {
  const text = readFileSync(path.join(packageDir, "wrangler.jsonc"), "utf8");
  const withoutComments = text
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  return JSON.parse(withoutComments);
}

const config = readWranglerConfig();

export const compatibilityDate = config.compatibility_date;

export const buckets = config.r2_buckets.map((bucket) => ({
  binding: bucket.binding,
  name: bucket.bucket_name,
  accessKeyId: bucket.local_dev.experimental_s3_credentials.accessKeyId,
  secretAccessKey: bucket.local_dev.experimental_s3_credentials.secretAccessKey,
}));

const first = buckets[0];
for (const bucket of buckets) {
  if (
    bucket.accessKeyId !== first.accessKeyId ||
    bucket.secretAccessKey !== first.secretAccessKey
  ) {
    throw new Error(
      "packages/local-r2/wrangler.jsonc: every bucket must share the same S3 credentials"
    );
  }
}

export const credentials = {
  accessKeyId: first.accessKeyId,
  secretAccessKey: first.secretAccessKey,
};

export const tilesBucket = buckets.find((b) => b.binding === "TILES_BUCKET").name;
export const spatialUploadsBucket = buckets.find(
  (b) => b.binding === "SPATIAL_UPLOADS_BUCKET"
).name;

export function endpoint(port = defaultPort, host = "localhost") {
  return `http://${host}:${port}${s3Path}`;
}

// The .env values a process needs to use this storage. Printed by the dev
// launcher and used by the contract test to build its clients.
export function envValues(port = defaultPort) {
  return {
    R2_ENDPOINT: endpoint(port),
    R2_ACCESS_KEY_ID: credentials.accessKeyId,
    R2_SECRET_ACCESS_KEY: credentials.secretAccessKey,
    R2_TILES_BUCKET: tilesBucket,
    SPATIAL_UPLOADS_BUCKET: spatialUploadsBucket,
  };
}
