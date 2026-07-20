import { env } from "cloudflare:workers";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { handlePropertiesRequest } from "../src/propertiesBackend";

/** Shared data-library EEZ FlatGeobuf used by geography /properties callers. */
const KEY =
  "projects/superuser/public/1c3fb604-9c42-4b9d-ab72-14de0d66c783.fgb";
const FIXTURE_URL = `https://uploads.seasketch.org/${KEY}`;
const FIXTURE_PATH = path.join(
  process.cwd(),
  "test/fixtures/1c3fb604-9c42-4b9d-ab72-14de0d66c783.fgb",
);

beforeAll(async () => {
  let bytes: ArrayBuffer;
  try {
    const file = await readFile(FIXTURE_PATH);
    bytes = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    );
  } catch {
    const response = await fetch(FIXTURE_URL);
    if (!response.ok) {
      throw new Error(
        `Unable to download production FGB fixture: ${response.status}`,
      );
    }
    bytes = await response.arrayBuffer();
  }
  await env.TILES_BUCKET.put(KEY, bytes, {
    httpMetadata: { contentType: "application/octet-stream" },
  });
}, 120_000);

describe("production EEZ FlatGeobuf properties", () => {
  it(
    "accepts non-zero magic flags and returns property bags",
    async () => {
      const response = await handlePropertiesRequest(
        new Request(
          `https://overlay.seasketch.org/properties?dataset=${encodeURIComponent(KEY)}&include=MRGID_EEZ,UNION,POL_TYPE,SOVEREIGN1,MRGID_SOV1`,
        ),
        { TILES_BUCKET: env.TILES_BUCKET } as Env,
      );
      expect(response.status).toBe(200);
      const records = await response.json<Array<Record<string, unknown>>>();
      expect(records.length).toBeGreaterThan(100);
      expect(records[0]).toMatchObject({
        MRGID_EEZ: expect.anything(),
        UNION: expect.any(String),
      });
      expect(records[0].__offset).toEqual(expect.any(Number));
      expect(records[0].__byteLength).toEqual(expect.any(Number));
      expect(records[0]).not.toHaveProperty("__bbox");
    },
    60_000,
  );

  it(
    "returns antimeridian-aware bboxes for the geography wizard query",
    async () => {
      const response = await handlePropertiesRequest(
        new Request(
          `https://overlay.seasketch.org/properties?include=MRGID_EEZ,UNION,POL_TYPE,SOVEREIGN1,MRGID_SOV1&bbox=true&dataset=${encodeURIComponent(KEY)}`,
        ),
        { TILES_BUCKET: env.TILES_BUCKET } as Env,
      );
      expect(response.status).toBe(200);
      const records = await response.json<Array<Record<string, unknown>>>();
      expect(records.length).toBeGreaterThan(100);
      const withBbox = records.find((record) => Array.isArray(record.__bbox));
      expect(withBbox?.__bbox).toEqual([
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
      ]);
    },
    120_000,
  );
});
