/**
 * Push or pull the golden snapshot.
 *
 * Objects live under golden-snapshot/ in the tiles bucket (R2_TILES_BUCKET),
 * unless SNAPSHOT_R2_BUCKET is set. uploads.seasketch.org serves that bucket,
 * and a key outside projects/ is public, so pull is an ordinary HTTPS GET.
 * Nothing in the dump is private. current/ is what setup fetches. archive/
 * keeps the previous dump.
 *
 * The objects are uploaded with Cache-Control: no-cache. current/ is
 * overwritten in place, and the tiles worker otherwise marks raw objects
 * immutable for a year.
 *
 * pull never writes and needs no credentials. push is maintainer-only.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");

const apiDir = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(apiDir, ".env") });

const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");

const dumpPath = path.join(apiDir, "snapshots", "golden.dump");
const manifestPath = path.join(apiDir, "snapshots", "golden.manifest.json");
const prefix = (process.env.SNAPSHOT_R2_PREFIX || "golden-snapshot").replace(
  /^\/|\/$/g,
  ""
);
const currentDumpKey = `${prefix}/current/golden.dump`;
const currentManifestKey = `${prefix}/current/manifest.json`;
const publicBase = (
  process.env.SNAPSHOT_PUBLIC_BASE_URL || "https://uploads.seasketch.org"
).replace(/\/$/, "");
// current/ is replaced in place. Immutable caching would pin a stale dump.
const cacheControl = "no-cache";

function credentials() {
  return {
    accessKeyId:
      process.env.SNAPSHOT_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID,
    secretAccessKey:
      process.env.SNAPSHOT_R2_SECRET_ACCESS_KEY ||
      process.env.R2_SECRET_ACCESS_KEY,
  };
}

function bucketName() {
  return process.env.SNAPSHOT_R2_BUCKET || process.env.R2_TILES_BUCKET;
}

function endpoint() {
  return process.env.SNAPSHOT_R2_ENDPOINT || process.env.R2_ENDPOINT;
}

function client() {
  const creds = credentials();
  const endpointUrl = endpoint();
  const bucket = bucketName();
  if (!creds.accessKeyId || !creds.secretAccessKey || !endpointUrl || !bucket) {
    const error = new Error(
      "R2 credentials are not set. snapshot:publish needs R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, and R2_TILES_BUCKET. setup downloads the snapshot from uploads.seasketch.org and does not use them."
    );
    error.code = "NO_CREDENTIALS";
    throw error;
  }
  return {
    bucket,
    s3: new S3Client({
      region: "auto",
      endpoint: endpointUrl,
      credentials: creds,
    }),
  };
}

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

async function bodyToFile(body, filePath) {
  await pipeline(body, fs.createWriteStream(filePath));
}

async function objectExists(s3, bucket, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

async function readRemoteManifest(s3, bucket) {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: currentManifestKey })
  );
  return JSON.parse(await response.Body.transformToString());
}

async function archiveCurrent(s3, bucket) {
  if (!(await objectExists(s3, bucket, currentManifestKey))) {
    return;
  }
  const manifest = await readRemoteManifest(s3, bucket);
  const stamp = `${manifest.createdAt || "unknown"}-${manifest.migration || "unknown"}`.replace(
    /[^0-9A-Za-z._-]+/g,
    "_"
  );
  for (const [from, name] of [
    [currentDumpKey, "golden.dump"],
    [currentManifestKey, "manifest.json"],
  ]) {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: from })
    );
    const got = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: from })
    );
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${prefix}/archive/${stamp}/${name}`,
        Body: got.Body,
        ContentLength: head.ContentLength,
        ContentType: name.endsWith(".json")
          ? "application/json"
          : "application/octet-stream",
        CacheControl: cacheControl,
      })
    );
  }
  console.log(`Archived previous snapshot as ${prefix}/archive/${stamp}/`);
}

async function push() {
  if (!fs.existsSync(dumpPath) || !fs.existsSync(manifestPath)) {
    throw new Error(
      "Local golden.dump and golden.manifest.json are required. Run npm run snapshot:create first."
    );
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const digest = sha256(dumpPath);
  if (manifest.sha256 && manifest.sha256 !== digest) {
    throw new Error("Local manifest sha256 does not match golden.dump.");
  }
  manifest.sha256 = digest;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  const { s3, bucket } = client();
  await archiveCurrent(s3, bucket);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: currentDumpKey,
      Body: fs.createReadStream(dumpPath),
      ContentLength: fs.statSync(dumpPath).size,
      ContentType: "application/octet-stream",
      CacheControl: cacheControl,
    })
  );
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: currentManifestKey,
      Body: JSON.stringify(manifest, null, 2) + "\n",
      ContentType: "application/json",
      CacheControl: cacheControl,
    })
  );
  console.log(`Published ${currentDumpKey} to ${bucket}.`);
}

function readLocalManifest() {
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function publicUrl(key) {
  return `${publicBase}/${key}`;
}

async function fetchPublic(key) {
  const url = publicUrl(key);
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`Could not fetch ${url}: ${error.message || error}`);
  }
  if (response.status === 404) {
    throw new Error(`No golden snapshot at ${url}.`);
  }
  if (!response.ok) {
    throw new Error(`Fetch ${url} failed (${response.status}).`);
  }
  return response;
}

async function pull() {
  const manifestResponse = await fetchPublic(currentManifestKey);
  const remote = await manifestResponse.json();
  const local = readLocalManifest();
  if (
    local &&
    fs.existsSync(dumpPath) &&
    local.createdAt &&
    remote.createdAt &&
    local.createdAt >= remote.createdAt &&
    local.sha256 &&
    local.sha256 === sha256(dumpPath)
  ) {
    console.log(
      `Local golden snapshot is current (${local.createdAt}, ${local.migration}).`
    );
    return;
  }
  console.log(
    `Fetching golden snapshot ${remote.createdAt || ""} ${remote.migration || ""}...`
  );
  const tmpDump = `${dumpPath}.partial`;
  const response = await fetchPublic(currentDumpKey);
  await bodyToFile(Readable.fromWeb(response.body), tmpDump);
  if (remote.sha256 && sha256(tmpDump) !== remote.sha256) {
    fs.unlinkSync(tmpDump);
    throw new Error("Downloaded golden snapshot failed its sha256 check.");
  }
  fs.mkdirSync(path.dirname(dumpPath), { recursive: true });
  fs.renameSync(tmpDump, dumpPath);
  fs.writeFileSync(manifestPath, JSON.stringify(remote, null, 2) + "\n");
  console.log(`Fetched ${currentDumpKey}.`);
}

async function main() {
  const command = process.argv[2];
  if (command === "push") {
    await push();
  } else if (command === "pull") {
    await pull();
  } else {
    throw new Error("Usage: snapshot-r2.js pull|push");
  }
}

main().catch((error) => {
  if (error.code === "NO_CREDENTIALS") {
    console.error(error.message);
    process.exit(2);
  }
  console.error(error.message || error);
  process.exit(1);
});
