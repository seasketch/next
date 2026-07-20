import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { handleObjectRequest } from "../src/objectBackend";

const key = `fixtures/${crypto.randomUUID()}.fgb`;
const bytes = new TextEncoder().encode("0123456789");

beforeEach(async () => {
  await env.TILES_BUCKET.put(key, bytes, {
    httpMetadata: { contentType: "application/octet-stream" },
  });
});

describe("raw object backend", () => {
  it("streams GET and HEAD with metadata and download headers", async () => {
    const get = await handleObjectRequest(
      new Request(`https://uploads.seasketch.org/${key}?download=layer.fgb`),
      { TILES_BUCKET: env.TILES_BUCKET } as Env,
    );
    expect(get.status).toBe(200);
    expect(get.headers.get("Content-Length")).toBe("10");
    expect(get.headers.get("Content-Disposition")).toContain("layer.fgb");
    expect(await get.text()).toBe("0123456789");

    const head = await handleObjectRequest(
      new Request(`https://uploads.seasketch.org/${key}`, { method: "HEAD" }),
      { TILES_BUCKET: env.TILES_BUCKET } as Env,
    );
    expect(head.status).toBe(200);
    expect(head.headers.get("Accept-Ranges")).toBe("bytes");
    expect(head.headers.get("Content-Length")).toBe("10");
  });

  it("supports closed, open, and suffix byte ranges", async () => {
    const cases = [
      ["bytes=2-5", "2345", "bytes 2-5/10"],
      ["bytes=7-", "789", "bytes 7-9/10"],
      ["bytes=-3", "789", "bytes 7-9/10"],
    ];
    for (const [range, body, contentRange] of cases) {
      const response = await handleObjectRequest(
        new Request(`https://uploads.seasketch.org/${key}`, {
          headers: { Range: range },
        }),
        { TILES_BUCKET: env.TILES_BUCKET } as Env,
      );
      expect(response.status).toBe(206);
      expect(response.headers.get("Content-Range")).toBe(contentRange);
      expect(await response.text()).toBe(body);
    }
  });

  it("honors ETag conditional requests", async () => {
    const initial = await handleObjectRequest(
      new Request(`https://uploads.seasketch.org/${key}`),
      { TILES_BUCKET: env.TILES_BUCKET } as Env,
    );
    const etag = initial.headers.get("etag")!;
    await initial.body?.cancel();
    const conditional = await handleObjectRequest(
      new Request(`https://uploads.seasketch.org/${key}`, {
        headers: { "If-None-Match": etag },
      }),
      { TILES_BUCKET: env.TILES_BUCKET } as Env,
    );
    expect(conditional.status).toBe(304);
  });

  it("caches identical ranges under synthetic PoP keys", async () => {
    const request = () =>
      new Request(`https://uploads.seasketch.org/${key}`, {
        headers: { Range: "bytes=0-3" },
      });
    const first = await handleObjectRequest(
      request(),
      { TILES_BUCKET: env.TILES_BUCKET } as Env,
    );
    expect(first.headers.get("X-SS-Range-Cache")).toBe("miss");
    await first.arrayBuffer();
    const second = await handleObjectRequest(
      request(),
      { TILES_BUCKET: env.TILES_BUCKET } as Env,
    );
    expect(second.headers.get("X-SS-Range-Cache")).toBe("hit");
    expect(await second.text()).toBe("0123");
  });

  it("serves concurrent identical ranges without disturbing shared bodies", async () => {
    const envLike = { TILES_BUCKET: env.TILES_BUCKET } as Env;
    const request = () =>
      new Request(`https://uploads.seasketch.org/${key}`, {
        headers: { Range: "bytes=0-9" },
      });
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => handleObjectRequest(request(), envLike)),
    );
    const bodies = await Promise.all(responses.map((r) => r.text()));
    for (const response of responses) {
      expect(response.status).toBe(206);
    }
    expect(bodies.every((body) => body === "0123456789")).toBe(true);
  });

  it("streams open-ended ranges without buffering the whole object", async () => {
    // Build a payload larger than MAX_RANGE_CACHE_BYTES so a buffered
    // open-ended read would be expensive; streaming should still 206.
    const bigKey = `fixtures/${crypto.randomUUID()}.bin`;
    const big = new Uint8Array(64 * 1024);
    for (let i = 0; i < big.length; i++) big[i] = i % 256;
    await env.TILES_BUCKET.put(bigKey, big);

    const response = await handleObjectRequest(
      new Request(`https://uploads.seasketch.org/${bigKey}`, {
        headers: { Range: "bytes=10-" },
      }),
      { TILES_BUCKET: env.TILES_BUCKET } as Env,
    );
    expect(response.status).toBe(206);
    expect(response.headers.get("X-SS-Range-Cache")).toBe("bypass");
    expect(response.headers.get("Content-Range")).toBe(
      `bytes 10-${big.length - 1}/${big.length}`,
    );
    const body = new Uint8Array(await response.arrayBuffer());
    expect(body.length).toBe(big.length - 10);
    expect(body[0]).toBe(10);
    expect(body[body.length - 1]).toBe((big.length - 1) % 256);
  });

  it("returns 416 for malformed and unsatisfiable ranges", async () => {
    for (const range of ["bytes=0-1,4-5", "items=0-1", "bytes=99-"]) {
      const response = await handleObjectRequest(
        new Request(`https://uploads.seasketch.org/${key}`, {
          headers: { Range: range },
        }),
        { TILES_BUCKET: env.TILES_BUCKET } as Env,
      );
      expect(response.status).toBe(416);
    }
  });
});
