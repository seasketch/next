import { sql } from "slonik";
import { createPool } from "./pool";
import * as jwks from "../src/auth/jwks";
import jwt from "jsonwebtoken";
import { asPg, createSession, clearSession } from "./helpers";
import { projectTransaction } from "./helpers";
import { createApiKey, revoke, verify } from "../src/apiKeys";

const pool = createPool("test");

jest.setTimeout(10000);

beforeAll(async () => {
  await pool.transaction(async (conn) => {
    await jwks.rotateKeys(asPg(conn));
  });
});

describe("api key creation and listing", () => {
  test("Can create an API Key for a project", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const token = await createApiKey(
          "test key",
          projectId,
          adminId,
          asPg(conn)
        );
        expect(token).toBeTruthy();
        expect(token.length).toBeGreaterThan(10);
        const claims = jwt.decode(token) as any;
        expect(claims).toBeTruthy();
        expect(claims).toHaveProperty("id");
        expect(claims).toHaveProperty("projectId");
        expect(claims.projectId).toBe(projectId);
        expect(claims).toHaveProperty("createdBy");
        expect(claims.createdBy).toBe(adminId);
        const isValid = await verify(token, asPg(conn));
        expect(isValid).toBeTruthy();
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
});

describe("api key expiration", () => {
  test("API key expires after the specified TTL", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const token = await createApiKey(
          "test key",
          projectId,
          adminId,
          asPg(conn),
          1
        );
        expect(token).toBeTruthy();
        expect(await verify(token, asPg(conn))).toBeTruthy();
        // Wait for the token to expire
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const isValid = await verify(token, asPg(conn));
        expect(isValid).toBeFalsy();
      }
    );
  });
});

describe("api key revocation", () => {
  test("Revoked API key is no longer valid", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
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
