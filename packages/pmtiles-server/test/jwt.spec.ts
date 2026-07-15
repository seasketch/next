import { exportJWK, generateKeyPair, JWK, KeyLike, SignJWT } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  extractTokenFromRequest,
  resolveMapAccessToken,
  trustDecodeMapAccessToken,
  verifyMapAccessToken,
} from "../src/auth/jwt";

let productionPrivateKey: KeyLike;
let otherPrivateKey: KeyLike;
let productionJwk: JWK;
let otherJwk: JWK;

const baseClaims = {
  type: "map-access",
  projectId: 1,
  projectSlug: "example",
  userId: 2,
  role: "user",
  groups: [4, 9],
};

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
  otherJwk = {
    ...(await exportJWK(other.publicKey)),
    kid: "other-key",
    alg: "RS256",
    use: "sig",
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function token(options: {
  key?: KeyLike;
  kid?: string;
  issuer?: string;
  type?: string;
  expiresAt?: number | null;
}) {
  const key = options.key ?? productionPrivateKey;
  const kid = options.kid ?? "production-key";
  let jwt = new SignJWT({
    ...baseClaims,
    type: options.type ?? baseClaims.type,
  })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(options.issuer ?? "seasketch.org")
    .setIssuedAt();

  if (options.expiresAt !== null) {
    jwt = jwt.setExpirationTime(
      options.expiresAt ?? Math.floor(Date.now() / 1000) + 3600,
    );
  }
  return jwt.sign(key);
}

function mockJwks(...keysets: JWK[][]) {
  const fetchMock = vi.fn();
  for (const keys of keysets) {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ keys }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("map-access JWTs", () => {
  it("extracts query tokens before Authorization headers", () => {
    const request = new Request(
      "https://tiles.seasketch.org/path?access_token=query-token",
      { headers: { Authorization: "Bearer header-token" } },
    );
    expect(extractTokenFromRequest(request)).toBe("query-token");
    expect(
      extractTokenFromRequest(
        new Request("https://tiles.seasketch.org/path", {
          headers: { Authorization: "bearer header-token" },
        }),
      ),
    ).toBe("header-token");
  });

  it("verifies signature, issuer, expiry, type, and claims", async () => {
    const url = `https://jwks.example/${crypto.randomUUID()}`;
    mockJwks([productionJwk]);

    await expect(
      verifyMapAccessToken(await token({}), url),
    ).resolves.toMatchObject({
      type: "map-access",
      projectSlug: "example",
      groups: [4, 9],
      iss: "seasketch.org",
    });
  });

  it("rejects a valid signature from an unknown issuer", async () => {
    const url = `https://jwks.example/${crypto.randomUUID()}`;
    mockJwks([productionJwk]);

    await expect(
      verifyMapAccessToken(
        await token({ issuer: "https://attacker.example" }),
        url,
      ),
    ).rejects.toThrow(/iss|issuer/i);
  });

  it("refetches JWKS once when a new kid is missing", async () => {
    const url = `https://jwks.example/${crypto.randomUUID()}`;
    const fetchMock = mockJwks([otherJwk], [productionJwk, otherJwk]);

    await expect(
      verifyMapAccessToken(await token({}), url),
    ).resolves.toMatchObject({ projectSlug: "example" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never falls back to unverified claims for prod", async () => {
    const url = `https://jwks.example/${crypto.randomUUID()}`;
    mockJwks([productionJwk], [productionJwk]);
    const locallySigned = await token({
      key: otherPrivateKey,
      kid: "other-key",
      issuer: "localhost",
    });

    await expect(
      resolveMapAccessToken(locallySigned, url, "prod"),
    ).rejects.toThrow();
    await expect(
      resolveMapAccessToken(locallySigned, undefined, "prod"),
    ).rejects.toThrow("jwks_url_not_configured");
    await expect(
      resolveMapAccessToken(locallySigned, undefined, "local-dev"),
    ).resolves.toMatchObject({
      mode: "dev-trust",
      claims: { projectSlug: "example" },
    });
  });

  it("trusts a well-formed unverified token only outside prod", async () => {
    const locallySigned = await token({
      key: otherPrivateKey,
      kid: "other-key",
      issuer: "localhost",
    });
    await expect(
      resolveMapAccessToken(locallySigned, undefined, "dev-user"),
    ).resolves.toMatchObject({
      mode: "dev-trust",
      claims: { projectSlug: "example" },
    });
  });

  it("requires map-access type and an unexpired exp in dev-trust mode", async () => {
    const missingExp = await token({ expiresAt: null });
    const expired = await token({
      expiresAt: Math.floor(Date.now() / 1000) - 1,
    });
    const wrongType = await token({ type: "another-token" });

    expect(() => trustDecodeMapAccessToken(missingExp)).toThrow(
      "token_exp_required",
    );
    expect(() => trustDecodeMapAccessToken(expired)).toThrow("token_expired");
    expect(() => trustDecodeMapAccessToken(wrongType)).toThrow(
      "Unexpected token type",
    );
  });
});
