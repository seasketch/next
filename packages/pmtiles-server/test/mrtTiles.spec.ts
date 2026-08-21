import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { writePmtilesArchive } from "../../raster-array/src/pmtiles/write";
import { sliceByteRange } from "../src/byteRange";
import { handleTilesBackendRequest } from "../src/tilesBackend";

const TINY_MRT_PMTILES = Buffer.from(
  "UE1UaWxlcwN/AAAAAAAAABkAAAAAAAAAmAAAAAAAAAB9AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVAQAAAAAAAA0AAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQIBAAAAgGln/4BpZ/+AlpgAgJaYAAAAAAAAAAAAAB+LCAAAAAAAABNjZGDkZQQAQfopOAUAAAAfiwgAAAAAAAATFctBCsMgEEDRu/y1CxtoF3OVEIppxiKogdEW0uDdS3Zv807ibiV0hGIdRw1FEXqqBw4Lras9czjUGjKfpA3htX/VcMSkeWvIyRrqhZnJe89yzfpWZPbutjh6ytrST5Hp/nCsnxjVED/GMv44fa3XgwAAAE1SVC1URVNULVRJTEU=",
  "base64",
);

const UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const PROJECT_NAME = `projects/mrt-test/public/${UUID}`;
const FIXTURE_NAME = "raster-array/gmw-global";
const LIBRARY_PLAIN = "dataLibrary/gmw-global";

async function putArchive(name: string) {
  await env.TILES_BUCKET.put(`${name}.pmtiles`, TINY_MRT_PMTILES, {
    httpMetadata: { contentType: "application/octet-stream" },
  });
}

describe("byte range into an extracted MRT tile", () => {
  it("clamps an oversize 16 KB probe instead of 416", () => {
    const body = new TextEncoder().encode("MRT-TEST-TILE").buffer;
    const sliced = sliceByteRange(body, "bytes=0-16383");
    expect(sliced.status).toBe(206);
    expect(sliced.contentRange).toBe("bytes 0-12/13");
    expect(new TextDecoder().decode(sliced.body)).toBe("MRT-TEST-TILE");
  });

  it("returns 416 only when start is past EOF", () => {
    const body = new TextEncoder().encode("abc").buffer;
    const sliced = sliceByteRange(body, "bytes=10-20");
    expect(sliced.status).toBe(416);
  });
});

describe("MRT PMTiles on TilesBackend", () => {
  it("serves TileJSON with format mrt and .mrt tile URLs", async () => {
    await putArchive(PROJECT_NAME);
    const response = await handleTilesBackendRequest(
      new Request(`https://tiles.seasketch.org/${PROJECT_NAME}.json`),
      env,
    );
    expect(response.status, await response.clone().text()).toBe(200);
    const json = await response.json<{
      format: string;
      tiles: string[];
      raster_layers: Array<{ id: string }>;
    }>();
    expect(json.format).toBe("mrt");
    expect(json.tiles[0]).toMatch(/\/\{z\}\/\{x\}\/\{y\}\.mrt$/);
    expect(json.raster_layers?.[0]?.id).toBe("cover");
    expect(json).not.toHaveProperty("vector_layers");
  });

  it("extracts the tile and honors a clamped Range probe", async () => {
    await putArchive(PROJECT_NAME);
    const response = await handleTilesBackendRequest(
      new Request(`https://tiles.seasketch.org/${PROJECT_NAME}/0/0/0.mrt`, {
        headers: { Range: "bytes=0-16383" },
      }),
      env,
    );
    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(response.headers.get("Content-Range")).toBe("bytes 0-12/13");
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(new TextDecoder().decode(await response.arrayBuffer())).toBe(
      "MRT-TEST-TILE",
    );
  });

  it("serves {uuid}.json from {uuid}.pmtiles, including MRT archives", async () => {
    await putArchive(PROJECT_NAME);
    const response = await handleTilesBackendRequest(
      new Request(`https://tiles.seasketch.org/${PROJECT_NAME}.json`),
      env,
    );
    expect(response.status).toBe(200);
    expect((await response.json<{ format?: string }>()).format).toBe("mrt");
  });

  it("serves public fixture and dataLibrary archive TileJSON without a UUID", async () => {
    await putArchive(FIXTURE_NAME);
    await putArchive(LIBRARY_PLAIN);
    const fixture = await handleTilesBackendRequest(
      new Request(`https://tiles.seasketch.org/${FIXTURE_NAME}.json`),
      env,
    );
    const library = await handleTilesBackendRequest(
      new Request(`https://tiles.seasketch.org/${LIBRARY_PLAIN}.json`),
      env,
    );
    expect(fixture.status).toBe(200);
    expect(library.status).toBe(200);
    expect((await fixture.json<{ format: string }>()).format).toBe("mrt");
    expect((await library.json<{ format: string }>()).format).toBe("mrt");
  });

  it("serves dataLibrary/gmw-global from gmw-global.pmtiles (no .mrt suffix)", async () => {
    await putArchive(LIBRARY_PLAIN);
    const jsonRes = await handleTilesBackendRequest(
      new Request(`https://tiles.seasketch.org/${LIBRARY_PLAIN}.json`),
      env,
    );
    expect(jsonRes.status, await jsonRes.clone().text()).toBe(200);
    const json = await jsonRes.json<{ format: string; tiles: string[] }>();
    expect(json.format).toBe("mrt");
    expect(json).not.toHaveProperty("vector_layers");
    expect(json.tiles[0]).toBe(
      `https://tiles.seasketch.org/${LIBRARY_PLAIN}/{z}/{x}/{y}.mrt`,
    );

    const tile = await handleTilesBackendRequest(
      new Request(`https://tiles.seasketch.org/${LIBRARY_PLAIN}/0/0/0.mrt`, {
        headers: { Range: "bytes=0-16383" },
      }),
      env,
    );
    expect(tile.status).toBe(206);
    expect(new TextDecoder().decode(await tile.arrayBuffer())).toBe(
      "MRT-TEST-TILE",
    );

    const missing = await handleTilesBackendRequest(
      new Request(`https://tiles.seasketch.org/${LIBRARY_PLAIN}/1/0/0.mrt`),
      env,
    );
    expect(missing.status).toBe(404);
    expect(missing.headers.get("Cache-Control")).toMatch(/immutable/);

    const holeyName = "dataLibrary/gmw-holey";
    const holey = writePmtilesArchive({
      tiles: [{ z: 0, x: 0, y: 0, data: Buffer.from("MRT-TEST-TILE") }],
      metadata: { format: "mrt", raster_layers: [{ id: "cover" }] },
      minzoom: 0,
      maxzoom: 1,
    });
    await env.TILES_BUCKET.put(`${holeyName}.pmtiles`, holey.bytes);
    const empty = await handleTilesBackendRequest(
      new Request(`https://tiles.seasketch.org/${holeyName}/1/0/0.mrt`),
      env,
    );
    expect(empty.status).toBe(404);
    expect(empty.headers.get("Cache-Control")).toMatch(/immutable/);

    const preview = await handleTilesBackendRequest(
      new Request(`https://tiles.seasketch.org/${LIBRARY_PLAIN}`),
      { ...env, MAPBOX_ACCESS_TOKEN: "pk.test" },
    );
    expect(preview.status).toBe(200);
    expect(preview.headers.get("Content-Type")).toMatch(/text\/html/);
    expect(await preview.text()).toContain("raster-array");
  });
});
