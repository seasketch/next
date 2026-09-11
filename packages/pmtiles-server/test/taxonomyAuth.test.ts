import { exportJWK, generateKeyPair, type JWK, type KeyLike, SignJWT } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { authorizeTaxonomyProxy } from "../src/auth/taxonomyAuth";

let productionPrivateKey: KeyLike;
let productionJwk: JWK;

beforeAll(async () => {
  const production = await generateKeyPair("RS256");
  productionPrivateKey = production.privateKey;
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

function token(type: string) {
  const claims =
    type === "map-access"
      ? {
          type,
          projectId: 1,
          projectSlug: "example",
          userId: 2,
          role: "admin",
          groups: [],
        }
      : { type };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "production-key" })
    .setIssuer("seasketch.org")
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(productionPrivateKey);
}

function mockJwks() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ keys: [productionJwk] }), {
        headers: { "Content-Type": "application/json" },
      })
    )
  );
}

describe("authorizeTaxonomyProxy", () => {
  it("rejects a missing token", async () => {
    const result = await authorizeTaxonomyProxy(
      new Request("https://uploads.seasketch.org/taxonomy/worms/AphiaRecordByAphiaID/1"),
      { JWKS_URL: "https://example.test/jwks" }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("rejects a map-access token", async () => {
    mockJwks();
    const mapToken = await token("map-access");
    const result = await authorizeTaxonomyProxy(
      new Request("https://uploads.seasketch.org/taxonomy/worms/AphiaRecordByAphiaID/1", {
        headers: { Authorization: `Bearer ${mapToken}` },
      }),
      { JWKS_URL: "https://example.test/jwks" }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("allows a JWKS-verified overlay-engine token", async () => {
    mockJwks();
    const engineToken = await token("overlay-engine");
    const result = await authorizeTaxonomyProxy(
      new Request("https://uploads.seasketch.org/taxonomy/worms/AphiaRecordByAphiaID/1", {
        headers: { Authorization: `Bearer ${engineToken}` },
      }),
      { JWKS_URL: "https://example.test/jwks" }
    );
    expect(result.ok).toBe(true);
  });
});
