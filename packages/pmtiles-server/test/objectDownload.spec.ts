import { env } from "cloudflare:workers";
import { generateKeyPair, SignJWT, type KeyLike } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import type { ProjectAclDoc } from "../src/auth/types";
import { handleGatewayRequest } from "../src/gateway";
import { handleTilesBackendRequest } from "../src/tilesBackend";

const UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const SLUG = "download-acl-project";
const KEY = `projects/${SLUG}/public/${UUID}.geojson`;
const BODY = '{"type":"FeatureCollection","features":[]}';

let testPrivateKey: KeyLike;

beforeAll(async () => {
  testPrivateKey = (await generateKeyPair("RS256")).privateKey;
});

async function adminToken(projectSlug: string) {
  return new SignJWT({
    type: "map-access",
    projectId: 1,
    projectSlug,
    userId: 1,
    role: "admin",
    groups: [],
  })
    .setProtectedHeader({ alg: "RS256" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(testPrivateKey);
}

async function writeAcl(
  ns: string,
  slug: string,
  doc: Omit<ProjectAclDoc, "slug">,
) {
  await env.TILES_BUCKET.put(
    `acl/${ns}/projects/${slug}.json`,
    JSON.stringify({ ...doc, slug }),
  );
}

/** Real TilesBackend behind the auth gateway (not a mock). */
const tilesBackend = {
  fetch: (request: Request) => handleTilesBackendRequest(request, env),
};

describe("object downloads", () => {
  it("serves R2 objects with Content-Disposition from ?download=", async () => {
    await env.TILES_BUCKET.put(KEY, BODY, {
      httpMetadata: { contentType: "application/geo+json" },
    });

    const response = await handleTilesBackendRequest(
      new Request(
        `https://tiles.seasketch.org/${KEY}?download=${encodeURIComponent(
          'Layer "Name".geojson',
        )}`,
      ),
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Layer _Name_.geojson"',
    );
    expect(await response.text()).toContain("FeatureCollection");
  });

  it("does not treat TileJSON paths as raw object keys", async () => {
    // No matching .pmtiles archive → KeyNotFoundError → 404 tileset, not object
    const response = await handleTilesBackendRequest(
      new Request(
        `https://tiles.seasketch.org/projects/${SLUG}/public/${UUID}.json`,
      ),
      env,
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Tileset not found");
  });

  it("denies protected /v2 downloads without a map-access token", async () => {
    const ns = `test-${crypto.randomUUID()}`;
    await env.TILES_BUCKET.put(KEY, BODY, {
      httpMetadata: { contentType: "application/geo+json" },
    });
    await writeAcl(ns, SLUG, {
      v: 1,
      public: [],
      rules: [{ t: "admins_only" }],
      protected: { [UUID]: [0] },
    });

    const response = await handleGatewayRequest(
      new Request(
        `https://tiles.seasketch.org/v2/${ns}/projects/${SLUG}/public/${UUID}.geojson?download=Layer.geojson`,
        { headers: { Accept: "application/geo+json" } },
      ),
      { TILES_BUCKET: env.TILES_BUCKET },
      tilesBackend,
    );

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
    expect(response.headers.get("X-SS-Tile-Auth")).toMatch(/^deny:/);
    expect(response.headers.get("Content-Disposition")).toBeNull();
  });

  it("allows protected /v2 downloads with a valid admin token", async () => {
    const ns = `test-${crypto.randomUUID()}`;
    await env.TILES_BUCKET.put(KEY, BODY, {
      httpMetadata: { contentType: "application/geo+json" },
    });
    await writeAcl(ns, SLUG, {
      v: 1,
      public: [],
      rules: [{ t: "admins_only" }],
      protected: { [UUID]: [0] },
    });
    const token = await adminToken(SLUG);
    const filename = "Admins Only.geojson";

    const response = await handleGatewayRequest(
      new Request(
        `https://tiles.seasketch.org/v2/${ns}/projects/${SLUG}/public/${UUID}.geojson?download=${encodeURIComponent(
          filename,
        )}&access_token=${token}`,
      ),
      { TILES_BUCKET: env.TILES_BUCKET },
      tilesBackend,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-SS-Tile-Auth")).toBe(
      "allow:admin:admins_only",
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="${filename}"`,
    );
    expect(await response.text()).toContain("FeatureCollection");
  });

  it("allows public /v2 downloads without a token", async () => {
    const ns = `test-${crypto.randomUUID()}`;
    await env.TILES_BUCKET.put(KEY, BODY, {
      httpMetadata: { contentType: "application/geo+json" },
    });
    await writeAcl(ns, SLUG, {
      v: 1,
      public: [UUID],
      rules: [],
      protected: {},
    });

    const response = await handleGatewayRequest(
      new Request(
        `https://tiles.seasketch.org/v2/${ns}/projects/${SLUG}/public/${UUID}.geojson?download=Public.geojson`,
      ),
      { TILES_BUCKET: env.TILES_BUCKET },
      tilesBackend,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-SS-Tile-Auth")).toBe("allow:public:public");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Public.geojson"',
    );
    expect(await response.text()).toContain("FeatureCollection");
  });
});
