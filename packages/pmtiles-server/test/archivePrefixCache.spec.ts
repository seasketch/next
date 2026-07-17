import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  buildPrefixCacheRequest,
  fetchArchivePrefix,
  PMTILES_PREFIX_LENGTH,
} from "../src/archivePrefixCache";
import { RequestTiming } from "../src/timing";

describe("archive prefix cache", () => {
  it("uses a stable internal cache key per archive", () => {
    expect(buildPrefixCacheRequest("projects/foo/public/uuid").url).toBe(
      "https://pmtiles-prefix.internal/projects/foo/public/uuid.pmtiles"
    );
  });

  it("serves the prefix from PoP cache after the first R2 read", async () => {
    const archive = `projects/test/public/${crypto.randomUUID()}`;
    const key = `${archive}.pmtiles`;
    const bytes = new Uint8Array(PMTILES_PREFIX_LENGTH);
    bytes[0] = 0x4d;
    bytes[1] = 0x50;

    await env.TILES_BUCKET.put(key, bytes);

    const cacheKey = buildPrefixCacheRequest(archive);
    await caches.default.delete(cacheKey);

    const timing = new RequestTiming();
    const first = await fetchArchivePrefix(
      env.TILES_BUCKET,
      archive,
      timing
    );
    timing.addStage("total", 1);
    expect(first.data.byteLength).toBe(PMTILES_PREFIX_LENGTH);
    expect(first.etag).toBeTruthy();
    expect(await caches.default.match(cacheKey)).not.toBeNull();
    expect(timing.toHeader()).toContain("r2=1");
    expect(timing.toHeader()).not.toContain("prefix-cache");

    const cachedTiming = new RequestTiming();
    const second = await fetchArchivePrefix(
      env.TILES_BUCKET,
      archive,
      cachedTiming
    );
    cachedTiming.addStage("total", 1);
    expect(second.data.byteLength).toBe(PMTILES_PREFIX_LENGTH);
    expect(second.etag).toBe(first.etag);
    expect(cachedTiming.toHeader()).toContain("prefix-cache=1");
    expect(cachedTiming.toHeader()).not.toContain("r2=");
  });
});
