/**
 * Push or pull the golden snapshot.
 *
 * Objects live under the prefix golden-snapshot/ in the private file-uploads
 * bucket (R2_FILE_UPLOADS_BUCKET), unless SNAPSHOT_R2_BUCKET is set.
 * current/ is what setup fetches. archive/ keeps the previous dump.
 *
 * pull never writes. push is maintainer-only.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
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
  return process.env.SNAPSHOT_R2_BUCKET || process.env.R2_FILE_UPLOADS_BUCKET;
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
      "R2 credentials are not set. setup can use a local golden.dump; snapshot:publish needs R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, and R2_FILE_UPLOADS_BUCKET."
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
    })
  );
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: currentManifestKey,
      Body: JSON.stringify(manifest, null, 2) + "\n",
      ContentType: "application/json",
    })
  );
  console.log(`Published ${currentDumpKey} to ${bucket}.`);
}

function readLocalManifest() {
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

async function pull() {
  const { s3, bucket } = client();
  let remote;
  try {
    remote = await readRemoteManifest(s3, bucket);
  } catch (error) {
    if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
      throw new Error(
        `No snapshot manifest at ${bucket}/${currentManifestKey}.`
      );
    }
    throw error;
  }
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
  const response = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: currentDumpKey })
  );
  await bodyToFile(response.Body, tmpDump);
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
