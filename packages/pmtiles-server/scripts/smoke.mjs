#!/usr/bin/env node

const base = process.argv[2]?.replace(/\/$/, "");
if (!base) {
  console.error("Usage: npm run smoke -- https://worker.example");
  process.exit(2);
}

const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 20_000);
const token = process.env.SMOKE_TOKEN;
const auth = token ? { Authorization: `Bearer ${token}` } : {};

const cases = [
  {
    name: "public FGB header",
    path: "/eez-land-joined.fgb",
    headers: { Range: "bytes=0-32767" },
    expectStatus: 206,
    maxBytes: 64 * 1024,
  },
  {
    name: "public TIFF header",
    path: "/testing-fiji-bathy-3.tif",
    headers: { Range: "bytes=0-16383" },
    expectStatus: 206,
    maxBytes: 64 * 1024,
  },
  {
    name: "public FGB properties",
    // Keep the response small; full property scans still read the FGB once.
    path: "/properties?dataset=eez-land-joined.fgb&include=MRGID&v=smoke",
    expectStatus: 200,
    maxBytes: 2 * 1024 * 1024,
  },
  process.env.SMOKE_PROJECT_KEY && {
    name: "protected project object",
    path: (() => {
      const key = process.env.SMOKE_PROJECT_KEY.replace(/^\/+/, "");
      const q = new URLSearchParams();
      if (process.env.SMOKE_NS) q.set("ns", process.env.SMOKE_NS);
      if (token) q.set("access_token", token);
      const qs = q.toString();
      return `/${key}${qs ? `?${qs}` : ""}`;
    })(),
    headers: auth,
    expectStatus: 200,
    maxBytes: 64 * 1024,
  },
  process.env.SMOKE_TILEJSON_PATH && {
    name: "TileJSON",
    path: process.env.SMOKE_TILEJSON_PATH,
    headers: auth,
    expectStatus: 200,
    maxBytes: 1024 * 1024,
  },
  process.env.SMOKE_TILE_PATH && {
    name: "ZXY tile",
    path: process.env.SMOKE_TILE_PATH,
    headers: auth,
    expectStatus: 200,
    maxBytes: 1024 * 1024,
  },
].filter(Boolean);

let failures = 0;
for (const check of cases) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}${check.path}`, {
      headers: check.headers,
      redirect: "manual",
      signal: controller.signal,
    });

    // Never buffer unbounded bodies. Range smokes should be tiny; cancel early.
    const reader = response.body?.getReader();
    let downloaded = 0;
    if (reader) {
      const limit = check.maxBytes ?? 1024 * 1024;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        downloaded += value.byteLength;
        if (downloaded > limit) {
          await reader.cancel();
          throw new Error(`response exceeded ${limit} bytes`);
        }
      }
    }

    const result = {
      name: check.name,
      status: response.status,
      contentType: response.headers.get("content-type"),
      contentLength: response.headers.get("content-length"),
      contentRange: response.headers.get("content-range"),
      acceptRanges: response.headers.get("accept-ranges"),
      etag: response.headers.get("etag"),
      auth: response.headers.get("x-ss-tile-auth"),
      rangeCache: response.headers.get("x-ss-range-cache"),
      serverTiming: response.headers.get("server-timing"),
      downloaded,
      ms: Date.now() - started,
    };
    console.log(JSON.stringify(result));

    const expected = check.expectStatus ?? 200;
    if (response.status !== expected && !(expected === 200 && response.ok)) {
      failures++;
    }
  } catch (error) {
    failures++;
    console.error(
      JSON.stringify({
        name: check.name,
        error: String(error),
        ms: Date.now() - started,
      }),
    );
  } finally {
    clearTimeout(timer);
  }
}

if (!process.env.SMOKE_TILEJSON_PATH || !process.env.SMOKE_TILE_PATH) {
  console.log(
    "Set SMOKE_TILEJSON_PATH and SMOKE_TILE_PATH to include tile smoke checks.",
  );
}
process.exitCode = failures ? 1 : 0;
