import { sql } from "slonik";
import { createPool } from "./pool";
import * as jwks from "../src/auth/jwks";
import jwt from "jsonwebtoken";
import { asPg } from "./helpers";

const pool = createPool("test");

jest.setTimeout(10000);

async function keyset(conn: Parameters<typeof asPg>[0]) {
  return jwks.createNewKeyset(asPg(conn));
}

describe("key creation and rotation rotation", () => {
  test("generating a key", async () => {
    await pool.transaction(async (conn) => {
      const kid = await keyset(conn);
      const privateKey = await jwks.getPrivateKey(asPg(conn), kid);
      expect(privateKey.kid).toBe(kid);
      expect(typeof privateKey.pem).toBe("string");
      await conn.any(sql`ROLLBACK`);
    });
  });
  test("creating a new key when latest is stale", async () => {
    await pool.transaction(async (conn) => {
      const inserted = await keyset(conn);
      await conn.query(
        sql`update jwks set created_at = (now() - interval '28 days') where kid = ${inserted}`
      );
      const staleAt28 = await conn.oneFirst(
        sql`select created_at <= (now() - interval '30 days') from jwks where kid = ${inserted}`
      );
      expect(staleAt28).toBe(false);

      await conn.query(
        sql`update jwks set created_at = (now() - interval '31 days') where kid = ${inserted}`
      );
      const staleAt31 = await conn.oneFirst(
        sql`select created_at <= (now() - interval '30 days') from jwks where kid = ${inserted}`
      );
      expect(staleAt31).toBe(true);

      const isLatest = await conn.oneFirst(
        sql`select not exists (
          select 1 from jwks where created_at > (
            select created_at from jwks where kid = ${inserted}
          )
        )`
      );
      if (isLatest) {
        const rotated = await jwks.rotateKeys(asPg(conn));
        expect(rotated).not.toBe(inserted);
        const privateKey = await jwks.getPrivateKey(asPg(conn));
        expect(privateKey.kid).not.toBe(inserted);
      }
      await conn.any(sql`ROLLBACK`);
    });
  });
});
test("old keys are deleted", async () => {
  await pool.transaction(async (conn) => {
    const kid = await keyset(conn);
    await conn.query(
      sql`update jwks set created_at = (now() - interval '121 days'), expires_at = (now() - interval '1 day') where kid = ${kid}`
    );
    await jwks.rotateKeys(asPg(conn));
    const remaining = await conn.maybeOneFirst(
      sql`select kid from jwks where kid = ${kid}`
    );
    expect(remaining).toBeNull();
    await conn.query(sql`rollback`);
  });
});
test("key rotation doesn't interfere with verify()", async () => {
  await pool.transaction(async (conn) => {
    await keyset(conn);
    const token = await jwks.sign(
      asPg(conn),
      { foo: "bar" },
      "30 days",
      "seasketch.org"
    );
    await keyset(conn);
    expect(await jwks.verify(asPg(conn), token, "seasketch.org")).toBeTruthy();
    await conn.query(sql`rollback`);
  });
});
describe("getJWKS", () => {
  test("returns all un-expired keys", async () => {
    await pool.transaction(async (conn) => {
      const expiredKid = await keyset(conn);
      await conn.query(
        sql`update jwks set created_at = (now() - interval '90 days'), expires_at = (now() - interval '90 days') where kid = ${expiredKid}`
      );
      const liveKid = await keyset(conn);
      const ks = await jwks.getJWKS(asPg(conn));
      const kids = ks.map((k) => k.kid);
      expect(kids).toContain(liveKid);
      expect(kids).not.toContain(expiredKid);
      await conn.query(sql`rollback`);
    });
  });
  test("only includes public key", async () => {
    await pool.transaction(async (conn) => {
      const kid = await keyset(conn);
      const ks = await jwks.getJWKS(asPg(conn));
      const ours = ks.find((k) => k.kid === kid);
      expect(ours).toBeTruthy();
      expect(Object.keys(ours!).sort().join("")).toBe(
        ["alg", "e", "kid", "kty", "n", "use"].join("")
      );
      await conn.query(sql`rollback`);
    });
  });
});

describe("jwt generation", () => {
  test("sign() returns a valid token", async () => {
    await pool.transaction(async (conn) => {
      const kid = await keyset(conn);
      const privateKey = await jwks.getPrivateKey(asPg(conn), kid);
      expect(privateKey.kid).toBe(kid);
      expect(typeof privateKey.pem).toBe("string");
      const token = await jwks.sign(
        asPg(conn),
        { foo: "bar" },
        "30 days",
        "seasketch.org"
      );
      expect(token).toBeTruthy();
      const usedKid = (jwt.decode(token, { complete: true }) as {
        header: { kid: string };
      }).header.kid;
      const publicPem = await conn.oneFirst(
        sql`select public_pem from jwks where kid = ${usedKid}`
      );
      expect(jwt.verify(token, publicPem as string)).toBeTruthy();
      await conn.query(sql`rollback`);
    });
  });
  test("sets iss, expiration", async () => {
    await pool.transaction(async (conn) => {
      await keyset(conn);
      const token = await jwks.sign(
        asPg(conn),
        { foo: "bar" },
        "1 day",
        "seasketch.org"
      );
      expect(token).toBeTruthy();
      const claims = await jwks.verify(asPg(conn), token, "seasketch.org");
      expect(claims.iss).toBe("seasketch.org");
      const dayMs = 1000 * 60 * 60 * 24;
      expect(claims.exp).toBeGreaterThan(
        (new Date().getTime() + dayMs - 2000) / 1000
      );
      expect(claims.foo).toBe("bar");
      await conn.query(sql`rollback`);
    });
  });
  test("sets the correct kid and jku", async () => {
    await pool.transaction(async (conn) => {
      await keyset(conn);
      const privateKey = await jwks.getPrivateKey(asPg(conn));
      const token = await jwks.sign(
        asPg(conn),
        { foo: "bar" },
        "1 day",
        "seasketch.org"
      );
      expect(token).toBeTruthy();
      const decoded = jwt.decode(token, { complete: true });
      // @ts-ignore
      expect(decoded.header.kid).toBe(privateKey.kid);
      // @ts-ignore
      expect(decoded.header.jku).toBe(
        "https://seasketch.org/.well-known/jwks.json"
      );
      await conn.query(sql`rollback`);
    });
  });
});

describe("jwt validation", () => {
  test("verify() accepts tokens from sign()", async () => {
    await pool.transaction(async (conn) => {
      await keyset(conn);
      const token = await jwks.sign(
        asPg(conn),
        { foo: "bar" },
        "1 day",
        "seasketch.org"
      );
      const claims = await jwks.verify(asPg(conn), token, "seasketch.org");
      expect(claims.foo).toBe("bar");
      await conn.query(sql`rollback`);
    });
  });
  test("only accepts same issuer", async () => {
    await pool.transaction(async (conn) => {
      await keyset(conn);
      const token = await jwks.sign(
        asPg(conn),
        { foo: "bar" },
        "1 day",
        "seasketch.org"
      );
      await expect(jwks.verify(asPg(conn), token, "pets.com")).rejects.toThrow(
        /issuer/i
      );
      await conn.query(sql`rollback`);
    });
  });
  test("checks expiration", async () => {
    await pool.transaction(async (conn) => {
      await keyset(conn);
      const token = await jwks.sign(
        asPg(conn),
        {
          foo: "bar",
          exp: Math.floor(Date.now() / 1000) - 60,
        },
        undefined,
        "seasketch.org"
      );
      await expect(
        jwks.verify(asPg(conn), token, "seasketch.org")
      ).rejects.toThrow(/exp/i);
      await conn.query(sql`rollback`);
    });
  });
});
