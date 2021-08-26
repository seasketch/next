import { sql } from "slonik";
import { createProject, createUser } from "./helpers";
import { createPool } from "./pool";

const pool = createPool("test");

describe("current user access", () => {
  test("'me' is null when anonymous", async () => {
    await pool.transaction(async (conn) => {
      const userId = await conn.oneFirst(
        sql`insert into users (sub, canonical_email) values ('foo:abc123', 'abc123@example.com') returning id`
      );
      await conn.any(sql`select set_config('role', 'anon', true)`);
      const id = await conn.oneFirst(sql`select id from me()`);
      expect(id).toBe(null);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("'me' is populated when logged in", async () => {
    await pool.transaction(async (conn) => {
      const userId = await conn.oneFirst(
        sql`insert into users (sub, canonical_email) values ('foo:abc123', 'abc123@example.com') returning id`
      );
      await conn.any(
        sql`select set_config('role', 'seasketch_user', true), set_config('session.user_id', ${userId!.toString()}, true)`
      );
      const id = await conn.oneFirst(sql`select id from me()`);
      expect(id).toBe(userId);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("currentProject is null when when session vars are null", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      await conn.any(sql`select set_config('role', 'anon', true)`);
      const id = await conn.oneFirst(sql`select id from current_project()`);
      expect(id).toBe(null);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("currentProject is set when session vars are present", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const pid = await createProject(conn, adminId, "public");
      await conn.any(
        sql`select set_config('role', 'anon', true), set_config('session.project_id', ${pid}, true)`
      );
      const id = await conn.oneFirst(sql`select id from current_project()`);
      expect(id).toBe(pid);
      await conn.any(sql`ROLLBACK`);
    });
  });
});
