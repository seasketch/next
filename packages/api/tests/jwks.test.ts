import { sql } from "slonik";
import { createPool } from "./pool";
import * as jwks from "../src/auth/jwks";
import jwt from "jsonwebtoken";
import { asPg } from "./helpers";

const pool = createPool("test");

jest.setTimeout(10000);

describe("key creation and rotation rotation", () => {
  test("generating the first key", async () => {
    await pool.transaction(async (conn) => {
      await conn.any(sql`delete from jwks`);
      const kid = await jwks.rotateKeys(asPg(conn));
      const privateKey = await jwks.getPrivateKey(asPg(conn));
      expect(privateKey.kid).toBeTruthy();
      expect(kid).toBe(privateKey.kid);
      expect(typeof privateKey.pem).toBe("string");
      await conn.any(sql`ROLLBACK`);
    });
  });
  test("creating a new key when latest is stale", async () => {
    await pool.transaction(async (conn) => {
      await conn.any(sql`delete from jwks`);
      let count = await conn.oneFirst(sql`select count(*) from jwks`);
      const inserted = await jwks.rotateKeys(asPg(conn));
      let { kid } = await jwks.getPrivateKey(asPg(conn));
      expect(inserted).toBe(kid);
      await conn.query(
        sql`update jwks set created_at = (now() - interval '28 days') where kid = ${kid}`
      );
      await jwks.rotateKeys(asPg(conn));
      ({ kid } = await jwks.getPrivateKey(asPg(conn)));
      expect(kid).toBe(inserted);
      await conn.query(
        sql`update jwks set created_at = (now() - interval '31 days') where kid = ${kid}`
      );
      await jwks.rotateKeys(asPg(conn));
      const privateKey = await jwks.getPrivateKey(asPg(conn));
      expect(privateKey.kid).not.toBe(kid);
      await conn.any(sql`ROLLBACK`);
    });
  });
});
test("old keys are deleted", async () => {
  await pool.transaction(async (conn) => {
    await conn.any(sql`delete from jwks`);
    await jwks.rotateKeys(asPg(conn));
    const { kid } = await jwks.getPrivateKey(asPg(conn));
    await conn.query(
      sql`update jwks set created_at = (now() - interval '121 days'), expires_at = (now() - interval '1 day') where kid = ${kid}`
    );
    await jwks.rotateKeys(asPg(conn));
    const rows = await conn.any(sql`select kid from jwks`);
    expect(rows.length).toBe(1);
    const privateKey = await jwks.getPrivateKey(asPg(conn));
    expect(privateKey.kid).not.toBe(kid);
    await conn.query(sql`rollback`);
  });
});
test("key rotation doesn't interfere with verify()", async () => {
  await pool.transaction(async (conn) => {
    await conn.any(sql`delete from jwks`);
    let i = 4;
    while (i--) {
      await jwks.rotateKeys(asPg(conn));
      await conn.query(
        sql`update jwks set created_at = (created_at - interval '30 days'), expires_at = (expires_at - interval '30 days')`
      );
    }
    const token = await jwks.sign(
      asPg(conn),
      { foo: "bar" },
      "30 days",
      "seasketch.org"
    );
    await conn.query(
      sql`update jwks set created_at = (created_at - interval '30 days'), expires_at = (expires_at - interval '30 days')`
    );
    await jwks.rotateKeys(asPg(conn));
    expect(await jwks.verify(asPg(conn), token, "seasketch.org")).toBeTruthy();
    await conn.query(sql`rollback`);
  });
});
describe("getJWKS", () => {
  test("returns all un-expired keys", async () => {
    await pool.transaction(async (conn) => {
      await conn.any(sql`delete from jwks`);
      await conn.query(sql`begin transaction`);
      let i = 2;
      while (i--) {
        await jwks.rotateKeys(asPg(conn));
        await conn.query(
          sql`update jwks set created_at = (created_at - interval '90 days'), expires_at = (expires_at - interval '90 days')`
        );
      }
      const ks = await jwks.getJWKS(asPg(conn));
      expect(ks.length).toBe(1);
      await conn.query(sql`rollback`);
    });
  });
  test("only includes public key", async () => {
    await pool.transaction(async (conn) => {
      await conn.any(sql`delete from jwks`);
      await jwks.rotateKeys(asPg(conn));
      const ks = await jwks.getJWKS(asPg(conn));
      expect(ks.length).toBe(1);
      expect(Object.keys(ks[0]).sort().join("")).toBe(
        ["alg", "e", "kid", "kty", "n", "use"].join("")
      );
      await conn.query(sql`rollback`);
    });
  });
});

describe("jwt generation", () => {
  test("sign() returns a valid token", async () => {
    await pool.transaction(async (conn) => {
      await conn.any(sql`delete from jwks`);
      await jwks.rotateKeys(asPg(conn));
      const privateKey = await jwks.getPrivateKey(asPg(conn));
      expect(privateKey.kid).toBeTruthy();
      expect(typeof privateKey.pem).toBe("string");
      const token = await jwks.sign(
        asPg(conn),
        { foo: "bar" },
        "30 days",
        "seasketch.org"
      );
      expect(token).toBeTruthy();
      const publicPem = await conn.oneFirst(
        sql`select public_pem from jwks limit 1`
      );
      expect(jwt.verify(token, publicPem as string)).toBeTruthy();
      await conn.query(sql`rollback`);
    });
  });
  test("sets iss, expiration", async () => {
    await pool.transaction(async (conn) => {
      await conn.any(sql`delete from jwks`);
      await jwks.rotateKeys(asPg(conn));
      const privateKey = await jwks.getPrivateKey(asPg(conn));
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
      await conn.any(sql`delete from jwks`);
      await jwks.rotateKeys(asPg(conn));
      const privateKey = await jwks.getPrivateKey(asPg(conn));
      const token = await jwks.sign(
        asPg(conn),
        { foo: "bar" },
        "1 day",
        "seasketch.org"
      );
      expect(token).toBeTruthy();
      const kid = await conn.oneFirst(sql`select kid from jwks`);
      const decoded = jwt.decode(token, { complete: true });
      // @ts-ignore
      expect(decoded.header.kid).toBe(kid);
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
      await conn.any(sql`delete from jwks`);
      await jwks.rotateKeys(asPg(conn));
      const privateKey = await jwks.getPrivateKey(asPg(conn));
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
      await conn.any(sql`delete from jwks`);
      await jwks.rotateKeys(asPg(conn));
      const privateKey = await jwks.getPrivateKey(asPg(conn));
      const token = await jwks.sign(
        asPg(conn),
        { foo: "bar" },
        "1 day",
        "seasketch.org"
      );
      expect(jwks.verify(asPg(conn), token, "pets.com")).rejects.toThrow(
        /issuer/i
      );
      await conn.query(sql`rollback`);
    });
  });
  test("checks expiration", async () => {
    await pool.transaction(async (conn) => {
      await conn.any(sql`delete from jwks`);
      await jwks.rotateKeys(asPg(conn));
      const privateKey = await jwks.getPrivateKey(asPg(conn));
      const token = await jwks.sign(
        asPg(conn),
        { foo: "bar" },
        "1ms",
        "seasketch.org"
      );
      await jwks.rotateKeys(asPg(conn));
      expect(jwks.verify(asPg(conn), token, "seasketch.org")).rejects.toThrow(
        /exp/i
      );
      await conn.query(sql`rollback`);
    });
  });
});
