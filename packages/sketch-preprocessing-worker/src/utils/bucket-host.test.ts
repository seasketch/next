import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveStorageUrl } from "overlay-engine";
import { bucketHosts, isBoundBucket } from "./bucket-host.ts";

test("UPLOADS_HOST is required", () => {
  assert.throws(() => bucketHosts({}), /UPLOADS_HOST is required/);
  assert.throws(() => bucketHosts({ UPLOADS_HOST: "  , " }), /UPLOADS_HOST is required/);
});

test("a configured host list is the bound bucket", () => {
  const hosts = bucketHosts({
    UPLOADS_HOST: "uploads.example, tiles.example",
  });
  assert.equal(isBoundBucket(new URL("https://uploads.example/a.fgb"), hosts), true);
  assert.equal(
    isBoundBucket(new URL("https://uploads.example:443/a.fgb"), hosts),
    true
  );
  assert.equal(isBoundBucket(new URL("https://other.example/a.fgb"), hosts), false);
});

test("a bare key is bound only when its resolved host is configured", () => {
  const target = resolveStorageUrl("projects/demo/layer.fgb");
  assert.equal(target.host, "uploads.seasketch.org");
  assert.equal(
    isBoundBucket(target, bucketHosts({ UPLOADS_HOST: "uploads.seasketch.org" })),
    true
  );
  assert.equal(
    isBoundBucket(target, bucketHosts({ UPLOADS_HOST: "localhost:8788" })),
    false
  );
});

test("a local uploads host does not include other origins", () => {
  const hosts = bucketHosts({
    UPLOADS_HOST: " localhost:8788, 127.0.0.1:8788 ",
  });
  assert.equal(
    isBoundBucket(new URL("http://localhost:8788/projects/a.fgb"), hosts),
    true
  );
  assert.equal(
    isBoundBucket(new URL("https://uploads.seasketch.org/projects/a.fgb"), hosts),
    false
  );
});
