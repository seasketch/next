import { sql } from "slonik";
import { createPgPool, createPool } from "./pool";
import * as jwks from "../src/auth/jwks";
import jwt from "jsonwebtoken";
import { asPg, createSession, clearSession, projectTransaction } from "./helpers";
import {
  createApiKey,
  ensureSigningKey,
  revoke,
  rotateSigningKey,
  verify,
} from "../src/apiKeys";

const pool = createPool("test");

jest.setTimeout(15000);

describe("signing key startup initialization", () => {
  test("ensureSigningKey creates a signing key when missing and is idempotent", async () => {
    await pool.transaction(async (conn) => {
      await conn.query(sql`delete from api_key_signing_keys`);
      const kid1 = await ensureSigningKey(asPg(conn));
      expect(kid1).toBeTruthy();

      const kid2 = await ensureSigningKey(asPg(conn));
      expect(kid2).toBe(kid1);

      const count = await conn.oneFirst<number>(
        sql`select count(*)::int from api_key_signing_keys`
      );
      expect(count).toBe(1);
      await conn.query(sql`rollback`);
    });
  });

  test("concurrent ensureSigningKey calls on an empty table settle on one active key", async () => {
    const pgPool = createPgPool("test");
    try {
      await pgPool.query(`delete from api_key_signing_keys`);
      const [kid1, kid2, kid3] = await Promise.all([
        ensureSigningKey(pgPool),
        ensureSigningKey(pgPool),
        ensureSigningKey(pgPool),
      ]);
      expect(kid1).toBeTruthy();
      expect(kid2).toBe(kid1);
      expect(kid3).toBe(kid1);

      const { rows } = await pgPool.query(
        `select count(*)::int as count from api_key_signing_keys where private_pem is not null`
      );
      expect(rows[0].count).toBe(1);
    } finally {
      await pgPool.query(`delete from api_key_signing_keys`);
      await pgPool.end();
    }
  });
});

describe("api key creation and listing", () => {
  test("Can create an API Key for a project without relying on jwks", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await conn.query(sql`delete from jwks`);
        const token = await createApiKey(
          "test key",
          projectId,
          adminId,
          asPg(conn)
        );
        expect(token).toBeTruthy();
        expect(token.length).toBeGreaterThan(10);
        const decoded = jwt.decode(token, { complete: true }) as any;
        expect(decoded).toBeTruthy();
        expect(decoded.header).not.toHaveProperty("jku");
        expect(decoded.payload).toHaveProperty("id");
        expect(decoded.payload.projectId).toBe(projectId);
        expect(decoded.payload.createdBy).toBe(adminId);
        expect(decoded.payload).not.toHaveProperty("exp");
        const isValid = await verify(token, asPg(conn));
        expect(isValid).toEqual({
          projectId,
          createdBy: adminId,
          label: "test key",
        });
      }
    );
  });

  test("api key must be created with an adminId which belongs to the project", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await expect(
          createApiKey("test key", projectId, userA, asPg(conn))
        ).rejects.toThrow();
      }
    );
  });

  test("rejects non-positive TTL values", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await expect(
          createApiKey("bad ttl", projectId, adminId, asPg(conn), 0)
        ).rejects.toThrow();
        await expect(
          createApiKey("bad ttl", projectId, adminId, asPg(conn), -60)
        ).rejects.toThrow();
      }
    );
  });
});

describe("api key expiration", () => {
  test("API key expires after the specified TTL", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        const token = await createApiKey(
          "test key",
          projectId,
          adminId,
          asPg(conn),
          1
        );
        expect(token).toBeTruthy();
        const claims = jwt.decode(token) as any;
        expect(typeof claims.exp).toBe("number");
        expect(await verify(token, asPg(conn))).toBeTruthy();
        // Wait for the token to expire
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const isValid = await verify(token, asPg(conn));
        expect(isValid).toBeFalsy();
      }
    );
  });

  test("API key without exp does not expire regardless of age", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        const token = await createApiKey(
          "long-lived key",
          projectId,
          adminId,
          asPg(conn)
        );
        const decoded = jwt.decode(token, { complete: true }) as any;
        const signingKey = await conn.one<{
          kid: string;
          private_pem: string;
        }>(
          sql`select kid, private_pem from api_key_signing_keys where kid = ${decoded.header.kid}`
        );
        // Re-sign the same key id with an iat 10 years in the past and no exp
        const tenYearsAgo = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 3650;
        const oldToken = jwt.sign(
          {
            id: decoded.payload.id,
            projectId,
            createdBy: adminId,
            iat: tenYearsAgo,
          },
          signingKey.private_pem,
          {
            issuer: "seasketch.org",
            keyid: signingKey.kid,
            algorithm: "RS256",
            noTimestamp: true,
          }
        );
        expect(await verify(oldToken, asPg(conn))).toEqual({
          projectId,
          createdBy: adminId,
          label: "long-lived key",
        });
      }
    );
  });
});

describe("isolation from jwks", () => {
  test("tokens signed by jwks are rejected by apiKeys.verify", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await jwks.rotateKeys(asPg(conn));
        const realToken = await createApiKey(
          "real key",
          projectId,
          adminId,
          asPg(conn)
        );
        const realClaims = jwt.decode(realToken) as any;
        const jwksSignedToken = await jwks.sign(
          asPg(conn),
          {
            id: realClaims.id,
            projectId,
            createdBy: adminId,
          },
          undefined,
          "seasketch.org"
        );
        expect(await verify(jwksSignedToken, asPg(conn))).toBe(false);
      }
    );
  });

  test("clearing jwks does not affect existing API keys", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await jwks.rotateKeys(asPg(conn));
        const token = await createApiKey(
          "independent key",
          projectId,
          adminId,
          asPg(conn)
        );
        await conn.query(sql`delete from jwks`);
        expect(await verify(token, asPg(conn))).toBeTruthy();
      }
    );
  });
});

describe("manual signing key rotation", () => {
  test("rotateSigningKey retires the old private key while keeping old tokens valid", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        const tokenBefore = await createApiKey(
          "before rotation",
          projectId,
          adminId,
          asPg(conn)
        );
        const kidBefore = (jwt.decode(tokenBefore, { complete: true }) as any)
          .header.kid;

        const kidAfter = await rotateSigningKey(asPg(conn));
        expect(kidAfter).not.toBe(kidBefore);

        const oldRow = await conn.one<{
          private_pem: string | null;
          public_pem: string;
          retired_at: string | null;
        }>(
          sql`select private_pem, public_pem, retired_at from api_key_signing_keys where kid = ${kidBefore}`
        );
        expect(oldRow.private_pem).toBeNull();
        expect(oldRow.retired_at).not.toBeNull();
        expect(oldRow.public_pem).toBeTruthy();

        const tokenAfter = await createApiKey(
          "after rotation",
          projectId,
          adminId,
          asPg(conn)
        );
        const usedKidAfter = (jwt.decode(tokenAfter, { complete: true }) as any)
          .header.kid;
        expect(usedKidAfter).toBe(kidAfter);

        // Both old and new API keys verify
        expect(await verify(tokenBefore, asPg(conn))).toBeTruthy();
        expect(await verify(tokenAfter, asPg(conn))).toBeTruthy();
      }
    );
  });

  test("rotateSigningKey with invalidatePreviousKeys rejects previously issued tokens", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        const tokenBefore = await createApiKey(
          "before compromise",
          projectId,
          adminId,
          asPg(conn)
        );
        await rotateSigningKey(asPg(conn), { invalidatePreviousKeys: true });
        expect(await verify(tokenBefore, asPg(conn))).toBe(false);

        const tokenAfter = await createApiKey(
          "after compromise",
          projectId,
          adminId,
          asPg(conn)
        );
        expect(await verify(tokenAfter, asPg(conn))).toBeTruthy();
      }
    );
  });
});

describe("api key revocation", () => {
  test("Revoked API key is no longer valid", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        const token = await createApiKey(
          "test key",
          projectId,
          adminId,
          asPg(conn)
        );
        expect(token).toBeTruthy();
        const claims = jwt.decode(token) as any;
        await createSession(conn, adminId);
        await revoke(claims.id, asPg(conn));
        const isValid = await verify(token, asPg(conn));
        expect(isValid).toBeFalsy();
      }
    );
  });
});

describe("access control", () => {
  test("api keys can only be selected by admins of the same project", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        const token = await createApiKey(
          "test key",
          projectId,
          adminId,
          asPg(conn)
        );
        expect(token).toBeTruthy();

        await createSession(conn, adminId);
        // admin should be able to select api keys (count=1)
        const adminKeys = await conn.query(sql`SELECT * FROM api_keys`);
        expect(adminKeys.rowCount).toBe(1);
        await clearSession(pool);
        await createSession(conn, userA);
        // userA should not be able to select api keys
        const data = await conn.query(sql`SELECT * FROM api_keys`);
        expect(data.rowCount).toBe(0);
        await projectTransaction(
          pool,
          "public",
          async (conn, projectId, adminId, [userA, userB]) => {
            await createSession(conn, adminId);
            // userB should not be able to select api keys
            const data = await conn.query(sql`SELECT * FROM api_keys`);
            expect(data.rowCount).toBe(0);
          }
        );
      }
    );
  });
});
