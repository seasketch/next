import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

const uuid = "11111111-1111-1111-1111-111111111111";
const projectJson = `projects/router-test/public/${uuid}.json`;
const subdivided = "projects/router-test/subdivided/42-output.fgb";

beforeAll(async () => {
  await env.TILES_BUCKET.put(projectJson, '{"raw":true}', {
    httpMetadata: { contentType: "application/json" },
  });
  await env.TILES_BUCKET.put(subdivided, "subdivided");
  await env.TILES_BUCKET.put("router-fixture.fgb", "fixture");
});

describe("host-aware router", () => {
  it("serves opaque JSON on uploads without confusing it with TileJSON", async () => {
    const uploads = await SELF.fetch(
      `https://uploads.seasketch.org/${projectJson}`,
    );
    expect(uploads.status).toBe(200);
    expect(await uploads.json()).toEqual({ raw: true });

    const tiles = await SELF.fetch(
      `https://tiles.seasketch.org/${projectJson}`,
    );
    expect(tiles.status).toBe(404);
  });

  it("keeps root fixtures and data-library content public", async () => {
    const fixture = await SELF.fetch(
      "https://uploads.seasketch.org/router-fixture.fgb",
    );
    expect(fixture.status).toBe(200);
    expect(await fixture.text()).toBe("fixture");
  });

  it("routes fixture PMTiles ZXY through TilesBackend on the tiles host", async () => {
    // Missing archive → TilesBackend 404 body, not ObjectBackend "Object not found".
    const tiles = await SELF.fetch(
      "https://tiles.seasketch.org/crdss-cells-6/0/0/0.pbf",
    );
    expect(tiles.status).toBe(404);
    expect(await tiles.text()).toBe("Tileset not found");

    // Same path on uploads stays an opaque object key.
    const uploads = await SELF.fetch(
      "https://uploads.seasketch.org/crdss-cells-6/0/0/0.pbf",
    );
    expect(uploads.status).toBe(404);
    expect(await uploads.text()).toBe("Object not found");
  });

  it("still serves non-tile fixture objects from ObjectBackend on tiles", async () => {
    const response = await SELF.fetch(
      "https://tiles.seasketch.org/router-fixture.fgb",
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("fixture");
  });

  it("keeps legacy subdivided uploads public while the switch is false", async () => {
    const response = await SELF.fetch(
      `https://uploads.seasketch.org/${subdivided}`,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("subdivided");
  });

  it("always protects explicit v2 subdivided routes", async () => {
    const response = await SELF.fetch(
      `https://uploads.seasketch.org/v2/dev-test/${subdivided}`,
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
