import { env } from "cloudflare:workers";
import { exportJWK, generateKeyPair, type JWK, type KeyLike, SignJWT } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { authorizeResource } from "../src/auth/resourceAuth";
import type { ProjectAclDoc } from "../src/auth/types";
import { classifyResource } from "../src/resource";

const UUID = "11111111-1111-1111-1111-111111111111";
const SLUG = "auth-project";

let productionPrivateKey: KeyLike;
let otherPrivateKey: KeyLike;
let productionJwk: JWK;

beforeAll(async () => {
  const production = await generateKeyPair("RS256");
  const other = await generateKeyPair("RS256");
  productionPrivateKey = production.privateKey;
  otherPrivateKey = other.privateKey;
  productionJwk = {
    ...(await exportJWK(production.publicKey)),
    kid: "production-key",
    alg: "RS256",
    use: "sig",
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockJwks(keys: JWK[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ keys }), {
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

async function sign(options: {
  type: "map-access" | "overlay-engine";
  key?: KeyLike;
  kid?: string;
  issuer?: string;
  role?: "admin" | "user";
  projectSlug?: string;
}) {
  const key = options.key ?? productionPrivateKey;
  const claims =
    options.type === "overlay-engine"
      ? { type: "overlay-engine" }
      : {
          type: "map-access",
          projectId: 1,
          projectSlug: options.projectSlug ?? SLUG,
          userId: 2,
          role: options.role ?? "admin",
          groups: [],
        };
  return new SignJWT(claims)
    .setProtectedHeader({
      alg: "RS256",
      kid: options.kid ?? "production-key",
    })
    .setIssuer(options.issuer ?? "seasketch.org")
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(key);
}

async function writeAcl(ns: string, doc: Omit<ProjectAclDoc, "slug">) {
  await env.TILES_BUCKET.put(
    `acl/${ns}/projects/${SLUG}.json`,
    JSON.stringify({ ...doc, slug: SLUG }),
  );
}

describe("resource authorization", () => {
  it("allows non-production overlay-engine tokens across project resources", async () => {
    const token = await sign({
      type: "overlay-engine",
      key: otherPrivateKey,
      kid: "other-key",
      issuer: "localhost",
    });
    const resource = classifyResource(
      "projects/example/subdivided/12-output.fgb",
    )!;
    const result = await authorizeResource({
      request: new Request("https://uploads.example/object", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env: { TILES_BUCKET: env.TILES_BUCKET },
      ns: "dev-user",
      resource,
      enforce: true,
    });
    expect(result.decision).toMatchObject({
      allowed: true,
      reason: "overlay_engine",
    });
    expect(result.tokenMode).toBe("dev-trust");
  });

  it("requires a matching admin or superuser for subdivided data", async () => {
    const participant = await sign({
      type: "map-access",
      role: "user",
      projectSlug: "example",
      key: otherPrivateKey,
      kid: "other-key",
      issuer: "localhost",
    });
    const resource = classifyResource(
      "projects/example/subdivided/12-output.fgb",
    )!;
    const result = await authorizeResource({
      request: new Request("https://uploads.example/object", {
        headers: { Authorization: `Bearer ${participant}` },
      }),
      env: { TILES_BUCKET: env.TILES_BUCKET },
      ns: "dev-user",
      resource,
      enforce: true,
    });
    expect(result.decision).toMatchObject({
      allowed: false,
      status: 403,
      reason: "admins_only",
    });
  });

  it("keeps fixtures and data-library objects public", async () => {
    for (const key of [
      "eez-land-joined.fgb",
      "projects/superuser/public/11111111-1111-1111-1111-111111111111.fgb",
    ]) {
      const result = await authorizeResource({
        request: new Request("https://uploads.example/object"),
        env: { TILES_BUCKET: env.TILES_BUCKET },
        ns: "prod",
        resource: classifyResource(key)!,
        enforce: true,
      });
      expect(result.decision.allowed).toBe(true);
    }
  });

  it("treats missing ACL docs as public when legacy auth is enabled", async () => {
    const ns = `missing-acl-${crypto.randomUUID()}`;
    const resource = classifyResource(
      `projects/${SLUG}/public/${UUID}.fgb`,
    )!;
    const result = await authorizeResource({
      request: new Request("https://uploads.example/v2/object"),
      env: {
        TILES_BUCKET: env.TILES_BUCKET,
        AUTH_LEGACY_PROJECT_PATHS: "true",
      } as Env,
      ns,
      resource,
      enforce: true,
    });
    expect(result.decision).toMatchObject({
      allowed: true,
      reason: "legacy_missing_acl",
      aclClass: "public",
    });
  });

  it("treats missing ACL docs as admins-only when legacy auth is disabled", async () => {
    const ns = `missing-acl-${crypto.randomUUID()}`;
    const resource = classifyResource(
      `projects/${SLUG}/public/${UUID}.fgb`,
    )!;
    const result = await authorizeResource({
      request: new Request("https://uploads.example/v2/object"),
      env: {
        TILES_BUCKET: env.TILES_BUCKET,
        AUTH_LEGACY_PROJECT_PATHS: "false",
      } as Env,
      ns,
      resource,
      enforce: true,
    });
    expect(result.decision).toMatchObject({
      allowed: false,
      status: 401,
      reason: "missing_token",
      aclClass: "admins_only",
    });
  });
});

describe("prod namespace resource authorization", () => {
  const jwksUrl = () => `https://jwks.example/${crypto.randomUUID()}`;
  const published = classifyResource(
    `projects/${SLUG}/public/${UUID}.fgb`,
  )!;
  const subdivided = classifyResource(
    `projects/${SLUG}/subdivided/12-output.fgb`,
  )!;

  async function authorize(
    token: string,
    resource = published,
    url = jwksUrl(),
  ) {
    return authorizeResource({
      request: new Request("https://uploads.seasketch.org/object", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env: {
        TILES_BUCKET: env.TILES_BUCKET,
        JWKS_URL: url,
      } as Env,
      ns: "prod",
      resource,
      enforce: true,
    });
  }

  beforeAll(async () => {
    await writeAcl("prod", {
      v: 1,
      public: [],
      rules: [{ t: "admins_only" }],
      protected: { [UUID]: [0] },
    });
  });

  it("allows JWKS-verified map-access admin tokens on protected published data", async () => {
    const url = jwksUrl();
    mockJwks([productionJwk]);
    const token = await sign({ type: "map-access", role: "admin" });
    const result = await authorize(token, published, url);
    expect(result.decision).toMatchObject({
      allowed: true,
      reason: "admin",
    });
    expect(result.tokenMode).toBe("jwks");
  });

  it("allows JWKS-verified overlay-engine tokens on protected and subdivided data", async () => {
    const url = jwksUrl();
    mockJwks([productionJwk]);
    const token = await sign({ type: "overlay-engine" });
    for (const resource of [published, subdivided]) {
      const result = await authorize(token, resource, url);
      expect(result.decision).toMatchObject({
        allowed: true,
        reason: "overlay_engine",
      });
      expect(result.tokenMode).toBe("jwks");
    }
  });

  it("rejects locally signed map-access tokens for prod protected data", async () => {
    const url = jwksUrl();
    mockJwks([productionJwk]);
    const token = await sign({
      type: "map-access",
      role: "admin",
      key: otherPrivateKey,
      kid: "other-key",
      issuer: "localhost",
    });
    const result = await authorize(token, published, url);
    expect(result.decision).toMatchObject({
      allowed: false,
      status: 401,
    });
    expect(result.decision.reason).toMatch(/^invalid_token:/);
    expect(result.tokenMode).toBeNull();
  });

  it("rejects locally signed overlay-engine tokens for prod protected data", async () => {
    const url = jwksUrl();
    mockJwks([productionJwk]);
    const token = await sign({
      type: "overlay-engine",
      key: otherPrivateKey,
      kid: "other-key",
      issuer: "localhost",
    });
    const result = await authorize(token, published, url);
    expect(result.decision).toMatchObject({
      allowed: false,
      status: 401,
    });
    expect(result.decision.reason).toMatch(/^invalid_token:/);
    expect(result.tokenMode).toBeNull();
  });

  it("rejects prod access when JWKS_URL is missing", async () => {
    const token = await sign({
      type: "overlay-engine",
      key: otherPrivateKey,
      kid: "other-key",
      issuer: "localhost",
    });
    const result = await authorizeResource({
      request: new Request("https://uploads.seasketch.org/object", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env: { TILES_BUCKET: env.TILES_BUCKET } as Env,
      ns: "prod",
      resource: published,
      enforce: true,
    });
    expect(result.decision).toMatchObject({
      allowed: false,
      status: 401,
      reason: "invalid_token:jwks_url_not_configured",
    });
  });

  it("rejects wrong-issuer overlay-engine tokens on prod", async () => {
    const url = jwksUrl();
    mockJwks([productionJwk]);
    const token = await sign({
      type: "overlay-engine",
      issuer: "https://attacker.example",
    });
    const result = await authorize(token, subdivided, url);
    expect(result.decision.allowed).toBe(false);
    expect(result.decision.status).toBe(401);
  });
});
