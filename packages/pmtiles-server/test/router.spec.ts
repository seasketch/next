import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { generateKeyPair, SignJWT, type KeyLike } from "jose";
import { handleClassifiedRequest } from "../src/gateway";
import { classifyResource } from "../src/resource";

const uuid = "11111111-1111-1111-1111-111111111111";
const projectJson = `projects/router-test/public/${uuid}.json`;
const subdivided = "projects/router-test/subdivided/42-output.fgb";

let testPrivateKey: KeyLike;

beforeAll(async () => {
  testPrivateKey = (await generateKeyPair("RS256")).privateKey;
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

  it("keeps subdivided uploads public while AUTH_ACL_ENABLED is false", async () => {
    const response = await SELF.fetch(
      `https://uploads.seasketch.org/${subdivided}`,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("subdivided");
  });

  it("protects subdivided paths when ACL enforcement is enabled", async () => {
    const resource = classifyResource(subdivided)!;
    const denied = await handleClassifiedRequest(
      new Request(`https://uploads.seasketch.org/${subdivided}?ns=dev-test`),
      { TILES_BUCKET: env.TILES_BUCKET },
      {
        fetch: async () => new Response("should-not-run"),
      },
      resource,
      { ns: "dev-test", enforce: true },
    );
    expect(denied.status).toBe(401);
    expect(denied.headers.get("Cache-Control")).toBe("no-store");

    const token = await new SignJWT({
      type: "map-access",
      projectId: 1,
      projectSlug: "router-test",
      userId: 1,
      role: "admin",
      groups: [],
    })
      .setProtectedHeader({ alg: "RS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .sign(testPrivateKey);

    const allowed = await handleClassifiedRequest(
      new Request(`https://uploads.seasketch.org/${subdivided}?ns=dev-test`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      { TILES_BUCKET: env.TILES_BUCKET },
      {
        fetch: async () => new Response("subdivided-ok"),
      },
      resource,
      { ns: "dev-test", enforce: true },
    );
    expect(allowed.status).toBe(200);
    expect(await allowed.text()).toBe("subdivided-ok");
  });
});
