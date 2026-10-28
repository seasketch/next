// Contract test for Miniflare's local S3 API.
//
// Every SeaSketch writer's real storage calls, made with the settings of the
// shared client factories (packages/api/src/storage/client.ts and the handler
// remotes.ts files), against a wrangler dev session this test starts itself.
// It is the tripwire for a wrangler upgrade that renames the experimental
// config key, changes the S3 path, or alters request-body handling.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createWriteStream, mkdtempSync, rmSync, createReadStream } from "node:fs";
import { randomBytes } from "node:crypto";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { after, before, describe, test } from "node:test";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import AWS from "aws-sdk";
import {
  credentials,
  endpoint,
  packageDir,
  spatialUploadsBucket,
  tilesBucket,
  wranglerBin,
} from "../config.mjs";

const MB = 1024 * 1024;

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function startWrangler(port, persistTo) {
  const child = spawn(
    process.execPath,
    [
      wranglerBin,
      "dev",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--persist-to",
      persistTo,
      "--no-show-interactive-dev-session",
    ],
    {
      cwd: packageDir,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    }
  );
  let logs = "";
  const keep = (chunk) => {
    logs = (logs + chunk.toString()).slice(-8000);
  };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);
  return {
    logs: () => logs,
    stop() {
      if (!child.pid) return;
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    },
  };
}

async function waitForWorker(port, logs) {
  const deadline = Date.now() + 120_000;
  let last = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
      last = `status ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`local-r2 did not become ready (${last})\n${logs()}`);
}

async function writeRandomFile(dir, name, size) {
  const file = path.join(dir, name);
  const chunk = 1 * MB;
  async function* bytes() {
    let remaining = size;
    while (remaining > 0) {
      const n = Math.min(chunk, remaining);
      remaining -= n;
      yield randomBytes(n);
    }
  }
  await pipeline(Readable.from(bytes()), createWriteStream(file));
  return file;
}

async function readAll(body) {
  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function clientV3(port, overrides = {}) {
  // Same settings as storageClientV3 in packages/api/src/storage/client.ts.
  return new S3Client({
    region: "auto",
    endpoint: endpoint(port, "127.0.0.1"),
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials,
    ...overrides,
  });
}

function clientV2(port) {
  // Same settings as storageClientV2.
  return new AWS.S3({
    region: "auto",
    endpoint: endpoint(port, "127.0.0.1"),
    signatureVersion: "v4",
    s3ForcePathStyle: true,
    credentials,
  });
}

describe("Miniflare local S3 API", () => {
  let port;
  let worker;
  let tmp;
  let s3;

  before(async () => {
    port = await freePort();
    tmp = mkdtempSync(path.join(os.tmpdir(), "local-r2-test-"));
    worker = startWrangler(port, path.join(tmp, "persist"));
    await waitForWorker(port, worker.logs);
    s3 = clientV3(port);
  });

  after(() => {
    worker?.stop();
    rmSync(tmp, { recursive: true, force: true });
  });

  test("both configured buckets exist and an unknown bucket does not", async () => {
    await s3.send(new HeadBucketCommand({ Bucket: tilesBucket }));
    await s3.send(new HeadBucketCommand({ Bucket: spatialUploadsBucket }));
    await assert.rejects(
      s3.send(new HeadBucketCommand({ Bucket: "ssn-does-not-exist" })),
      (error) => error.$metadata?.httpStatusCode === 404
    );
  });

  test("signatures are verified", async () => {
    const wrong = clientV3(port, {
      credentials: { accessKeyId: credentials.accessKeyId, secretAccessKey: "wrong" },
    });
    await assert.rejects(
      wrong.send(
        new PutObjectCommand({ Bucket: tilesBucket, Key: "denied.txt", Body: "x" })
      ),
      (error) => error.$metadata?.httpStatusCode === 403
    );
  });

  test("SDK v3: streamed PutObject, HeadObject, ranged GetObject", async () => {
    const size = 3 * MB;
    const file = await writeRandomFile(tmp, "stream.bin", size);
    const Key = "projects/test/stream.bin";
    await s3.send(
      new PutObjectCommand({
        Bucket: tilesBucket,
        Key,
        Body: createReadStream(file),
        ContentType: "application/octet-stream",
      })
    );
    const head = await s3.send(new HeadObjectCommand({ Bucket: tilesBucket, Key }));
    assert.equal(head.ContentLength, size);
    assert.equal(head.ContentType, "application/octet-stream");

    const ranged = await s3.send(
      new GetObjectCommand({ Bucket: tilesBucket, Key, Range: "bytes=1048576-1048585" })
    );
    assert.equal(ranged.$metadata.httpStatusCode, 206);
    const got = await readAll(ranged.Body);
    const expected = await readAll(
      createReadStream(file, { start: 1048576, end: 1048585 })
    );
    assert.equal(got.length, 10);
    assert.ok(got.equals(expected));
  });

  test("SDK v3 without WHEN_REQUIRED is rejected (aws-chunked bodies are not unframed)", async () => {
    // storageClientV3 sets requestChecksumCalculation: "WHEN_REQUIRED" so a
    // stream body is sent with Content-Length and an unsigned payload. If
    // this test starts passing, Miniflare learned to unframe aws-chunked
    // bodies and the setting can be reconsidered.
    const file = await writeRandomFile(tmp, "chunked.bin", 1 * MB);
    const defaults = clientV3(port, { requestChecksumCalculation: "WHEN_SUPPORTED" });
    await assert.rejects(
      defaults.send(
        new PutObjectCommand({
          Bucket: tilesBucket,
          Key: "chunked.bin",
          Body: createReadStream(file),
        })
      )
    );
  });

  test("lib-storage multipart upload", async () => {
    const size = 12 * MB;
    const file = await writeRandomFile(tmp, "multipart.bin", size);
    const Key = "projects/test/multipart.pmtiles";
    const upload = new Upload({
      client: s3,
      params: { Bucket: tilesBucket, Key, Body: createReadStream(file) },
      partSize: 5 * MB,
      queueSize: 3,
    });
    await upload.done();
    const head = await s3.send(new HeadObjectCommand({ Bucket: tilesBucket, Key }));
    assert.equal(head.ContentLength, size);

    const tail = await s3.send(
      new GetObjectCommand({ Bucket: tilesBucket, Key, Range: `bytes=${size - 16}-` })
    );
    const got = await readAll(tail.Body);
    const expected = await readAll(createReadStream(file, { start: size - 16 }));
    assert.ok(got.equals(expected));
  });

  test("presigned PUT with CORS preflight, as the browser sends it", async () => {
    const Key = "uploads/presigned.geojson";
    const body = JSON.stringify({ type: "FeatureCollection", features: [] });
    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: spatialUploadsBucket,
        Key,
        ContentType: "application/geo+json",
      }),
      { expiresIn: 600 }
    );

    const preflight = await fetch(url, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    assert.ok(preflight.status < 300, `preflight ${preflight.status}`);
    assert.ok(preflight.headers.get("access-control-allow-origin"));

    const put = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "application/geo+json", Origin: "http://localhost:3000" },
      body,
    });
    assert.equal(put.status, 200, await put.text());
    assert.ok(put.headers.get("access-control-allow-origin"));

    const head = await s3.send(
      new HeadObjectCommand({ Bucket: spatialUploadsBucket, Key })
    );
    assert.equal(head.ContentLength, Buffer.byteLength(body));
    assert.equal(head.ContentType, "application/geo+json");
  });

  test("presigned GET", async () => {
    const Key = "uploads/presigned-get.txt";
    await s3.send(
      new PutObjectCommand({ Bucket: spatialUploadsBucket, Key, Body: "hello" })
    );
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: spatialUploadsBucket, Key }),
      { expiresIn: 600 }
    );
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "hello");
  });

  test("objects written over S3 are readable through the R2 binding", async () => {
    const Key = "projects/test/binding.txt";
    await s3.send(
      new PutObjectCommand({
        Bucket: tilesBucket,
        Key,
        Body: "via s3",
        ContentType: "text/plain",
      })
    );
    const response = await fetch(`http://127.0.0.1:${port}/binding/${tilesBucket}/${Key}`);
    const text = await response.text();
    assert.equal(response.status, 200, text);
    assert.equal(text, "via s3");
    assert.match(response.headers.get("content-type") ?? "", /^text\/plain/);
  });

  test("CopyObject, ListObjectsV2, DeleteObjects", async () => {
    await s3.send(
      new CopyObjectCommand({
        Bucket: tilesBucket,
        CopySource: `/${tilesBucket}/projects/test/binding.txt`,
        Key: "projects/test/copy.txt",
      })
    );
    const listed = await s3.send(
      new ListObjectsV2Command({ Bucket: tilesBucket, Prefix: "projects/test/" })
    );
    const keys = (listed.Contents ?? []).map((item) => item.Key).sort();
    assert.deepEqual(keys, [
      "projects/test/binding.txt",
      "projects/test/copy.txt",
      "projects/test/multipart.pmtiles",
      "projects/test/stream.bin",
    ]);

    await s3.send(
      new DeleteObjectsCommand({
        Bucket: tilesBucket,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      })
    );
    const after = await s3.send(
      new ListObjectsV2Command({ Bucket: tilesBucket, Prefix: "projects/test/" })
    );
    assert.equal(after.KeyCount ?? 0, 0);
  });

  test("aws-sdk v2: putObject, getObject, listObjectsV2, deleteObject", async () => {
    const v2 = clientV2(port);
    const Key = "v2/object.json";
    await v2
      .putObject({
        Bucket: spatialUploadsBucket,
        Key,
        Body: Buffer.from('{"ok":true}'),
        ContentType: "application/json",
      })
      .promise();
    const got = await v2.getObject({ Bucket: spatialUploadsBucket, Key }).promise();
    assert.equal(got.Body.toString(), '{"ok":true}');
    assert.equal(got.ContentType, "application/json");

    const listed = await v2
      .listObjectsV2({ Bucket: spatialUploadsBucket, Prefix: "v2/" })
      .promise();
    assert.deepEqual(
      listed.Contents.map((item) => item.Key),
      [Key]
    );

    const url = v2.getSignedUrl("putObject", {
      Bucket: spatialUploadsBucket,
      Key: "v2/presigned.bin",
      Expires: 600,
      ContentType: "application/octet-stream",
    });
    const put = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "application/octet-stream" },
      body: randomBytes(1024),
    });
    assert.equal(put.status, 200, await put.text());

    await v2.deleteObject({ Bucket: spatialUploadsBucket, Key }).promise();
    await s3.send(
      new DeleteObjectCommand({ Bucket: spatialUploadsBucket, Key: "v2/presigned.bin" })
    );
    await assert.rejects(
      s3.send(new HeadObjectCommand({ Bucket: spatialUploadsBucket, Key })),
      (error) => error.$metadata?.httpStatusCode === 404
    );
  });
});
