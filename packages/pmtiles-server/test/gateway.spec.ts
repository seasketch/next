import { env } from "cloudflare:workers";
import { generateKeyPair, SignJWT, type KeyLike } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { handleGatewayRequest } from "../src/gateway";
import type { ProjectAclDoc } from "../src/auth/types";

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

const UUID = "cb5a5804-d8c7-4098-9f53-4ddcb6bf9ffe";

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

function backend() {
  return {
    fetch: vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      return new Response(
        JSON.stringify({
          pathname: url.pathname,
          search: url.search,
          authorization: request.headers.get("Authorization"),
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }),
  };
}

describe("authorization gateway", () => {
  it("allows public TileJSON and strips credentials before forwarding", async () => {
    const ns = `test-${crypto.randomUUID()}`;
    const slug = "public-project";
    await writeAcl(ns, slug, {
      v: 1,
      public: [UUID],
      rules: [],
      protected: {},
    });
    const tilesBackend = backend();

    const response = await handleGatewayRequest(
      new Request(
        `https://tiles.seasketch.org/v2/${ns}/projects/${slug}/public/${UUID}.json?access_token=invalid&other=kept`,
        { headers: { Authorization: "Bearer invalid" } },
      ),
      { TILES_BUCKET: env.TILES_BUCKET },
      tilesBackend,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-SS-Tile-Auth")).toBe("allow:public:public");
    expect(await response.json()).toEqual({
      pathname: `/projects/${slug}/public/${UUID}.json`,
      search: "?other=kept",
      authorization: null,
    });
  });

  it("returns 401 and does not call the backend without a protected token", async () => {
    const ns = `test-${crypto.randomUUID()}`;
    const slug = "private-project";
    await writeAcl(ns, slug, {
      v: 1,
      public: [],
      rules: [{ t: "admins_only" }],
      protected: { [UUID]: [0] },
    });
    const tilesBackend = backend();

    const response = await handleGatewayRequest(
      new Request(
        `https://tiles.seasketch.org/v2/${ns}/projects/${slug}/public/${UUID}.json`,
        { headers: { Accept: "application/json" } },
      ),
      { TILES_BUCKET: env.TILES_BUCKET },
      tilesBackend,
    );

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(tilesBackend.fetch).not.toHaveBeenCalled();
  });

  it("renders the token form for an unauthorized preview navigation", async () => {
    const ns = `test-${crypto.randomUUID()}`;
    const slug = "preview-project";
    await writeAcl(ns, slug, {
      v: 1,
      public: [],
      rules: [{ t: "admins_only" }],
      protected: { [UUID]: [0] },
    });

    const response = await handleGatewayRequest(
      new Request(
        `https://tiles.seasketch.org/v2/${ns}/projects/${slug}/public/${UUID}`,
        { headers: { Accept: "text/html" } },
      ),
      { TILES_BUCKET: env.TILES_BUCKET },
      backend(),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(await response.text()).toContain('id="token-form"');
  });

  it("bypasses ACL lookup and tokens for shared data-library paths", async () => {
    const ns = `test-${crypto.randomUUID()}`;
    const tilesBackend = backend();
    const response = await handleGatewayRequest(
      new Request(
        `https://tiles.seasketch.org/v2/${ns}/projects/superuser/public/${UUID}.json`,
      ),
      { TILES_BUCKET: env.TILES_BUCKET },
      tilesBackend,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-SS-Tile-Auth")).toBe(
      "allow:data_library:public",
    );
    expect(tilesBackend.fetch).toHaveBeenCalledOnce();
  });

  it("rejects malformed v2 URLs before any backend work", async () => {
    const tilesBackend = backend();
    const response = await handleGatewayRequest(
      new Request("https://tiles.seasketch.org/v2/prod/not-a-tile"),
      { TILES_BUCKET: env.TILES_BUCKET },
      tilesBackend,
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid /v2 tile URL");
    expect(tilesBackend.fetch).not.toHaveBeenCalled();
  });

  it("Responds to requests with appropriate credentials", async () => {
    const ns = `test-${crypto.randomUUID()}`;
    const slug = "project-with-acl";
    await writeAcl(ns, slug, {
      v: 1,
      public: [],
      rules: [{ t: "admins_only" }],
      protected: { [UUID]: [0] },
    });
    const tilesBackend = backend();
    const token = await adminToken(slug);
    const response = await handleGatewayRequest(
      new Request(
        `https://tiles.seasketch.org/v2/${ns}/projects/${slug}/public/${UUID}.json`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),
      { TILES_BUCKET: env.TILES_BUCKET },
      tilesBackend,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("X-SS-Tile-Auth")).toBe(
      "allow:admin:admins_only",
    );
  });

  it("authorizes object downloads and forwards ?download= in cacheKey", async () => {
    const ns = `test-${crypto.randomUUID()}`;
    const slug = "download-project";
    await writeAcl(ns, slug, {
      v: 1,
      public: [],
      rules: [{ t: "admins_only" }],
      protected: { [UUID]: [0] },
    });
    const tilesBackend = backend();
    const token = await adminToken(slug);
    const filename = "My Layer.geojson";
    const response = await handleGatewayRequest(
      new Request(
        `https://tiles.seasketch.org/v2/${ns}/projects/${slug}/public/${UUID}.geojson?download=${encodeURIComponent(filename)}&access_token=${token}`,
      ),
      { TILES_BUCKET: env.TILES_BUCKET },
      tilesBackend,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-SS-Tile-Auth")).toBe(
      "allow:admin:admins_only",
    );
    expect(tilesBackend.fetch).toHaveBeenCalledOnce();
    expect(tilesBackend.fetch).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        cf: {
          cacheKey: `/projects/${slug}/public/${UUID}.geojson?download=${filename}`,
        },
      }),
    );
    const forwarded = tilesBackend.fetch.mock.calls[0][0] as Request;
    const forwardedUrl = new URL(forwarded.url);
    expect(forwardedUrl.pathname).toBe(
      `/projects/${slug}/public/${UUID}.geojson`,
    );
    expect(forwardedUrl.searchParams.get("download")).toBe(filename);
    expect(forwardedUrl.searchParams.has("access_token")).toBe(false);
  });
});
