import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveStorageUrl } from "overlay-engine";
import {
  PRODUCTION_BUCKET_HOSTS,
  bucketHosts,
  isBoundBucket,
} from "./bucket-host.ts";

test("an unset UPLOADS_HOST is the production bucket", () => {
  const hosts = bucketHosts({});
  for (const host of PRODUCTION_BUCKET_HOSTS) {
    assert.equal(isBoundBucket(new URL(`https://${host}/a.fgb`), hosts), true);
  }
  assert.equal(
    isBoundBucket(new URL("https://uploads.seasketch.org:443/a.fgb"), hosts),
    true
  );
  assert.equal(
    isBoundBucket(new URL("https://example.com/a.fgb"), hosts),
    false
  );
});

test("a bare key resolves onto the bound production bucket", () => {
  const hosts = bucketHosts({});
  const target = resolveStorageUrl("projects/demo/layer.fgb");
  assert.equal(target.host, "uploads.seasketch.org");
  assert.equal(isBoundBucket(target, hosts), true);
});

test("a configured UPLOADS_HOST replaces the production hosts", () => {
  const hosts = bucketHosts({
    UPLOADS_HOST: " localhost:8788, 127.0.0.1:8788 ",
  });
  assert.equal(
    isBoundBucket(new URL("http://localhost:8788/projects/a.fgb"), hosts),
    true
  );
  assert.equal(
    isBoundBucket(
      new URL("https://uploads.seasketch.org/projects/a.fgb"),
      hosts
    ),
    false
  );
});
