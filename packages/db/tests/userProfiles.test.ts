import { sql, createPool } from "slonik";
import {
  createProject,
  createUser,
  createSession,
  addParticipant,
} from "./helpers";

const pool = createPool("postgres://postgres:password@localhost:54321/test");

test("Profiles are automatically added to user accounts on creation", async () => {
  await pool.transaction(async (conn) => {
    const userId = await createUser(conn);
    const name = await conn.oneFirst(
      sql`select fullname from user_profiles where user_id = ${userId}`
    );
    expect(name).toBe(null);
    await conn.any(sql`ROLLBACK`);
  });
});

describe("Access control for editing", () => {
  test("Users can update their own profiles", async () => {
    await pool.transaction(async (conn) => {
      const userId = await createUser(conn);
      await createSession(conn, userId);
      await conn.any(
        sql`update user_profiles set fullname = 'Name', picture=null where user_id = ${userId}`
      );
      const name = await conn.oneFirst(
        sql`select fullname from user_profiles where user_id = ${userId}`
      );
      expect(name).toBe("Name");
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("Users cannot modify other user's profiles", async () => {
    await pool.transaction(async (conn) => {
      const userA = await createUser(conn);
      const userB = await createUser(conn);
      await createSession(conn, userA);
      await conn.any(
        sql`update user_profiles set fullname = 'Name', picture=null where user_id = ${userB}`
      );
      await conn.any(sql`set role = postgres`);
      const name = await conn.oneFirst(
        sql`select fullname from user_profiles where user_id = ${userB}`
      );
      expect(name).toBe(null);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("Admins cannot modify other user profiles", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const userB = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      await createSession(conn, adminId, true, false, projectId);
      await conn.any(
        sql`update user_profiles set fullname = 'Name', picture=null where user_id = ${userB}`
      );
      await conn.any(sql`set role = postgres`);
      const name = await conn.oneFirst(
        sql`select fullname from user_profiles where user_id = ${userB}`
      );
      expect(name).toBe(null);
      await conn.any(sql`ROLLBACK`);
    });
  });
});

describe("Access control for reading", () => {
  test("Admins can see profiles for only those participants that have shared them, otherwise they are hidden", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      const userA = await createUser(conn);
      const userB = await createUser(conn);
      await conn.any(
        sql`update user_profiles set fullname = 'User Burt', picture=null where user_id = ${userB}`
      );
      await conn.any(
        sql`update user_profiles set fullname = 'User Abe', picture=null where user_id = ${userA}`
      );
      await addParticipant(conn, userA, projectId, false, false);
      await addParticipant(conn, userB, projectId, false, true);
      await createSession(conn, adminId, true, false, projectId);
      let records = await conn.any(
        sql`select fullname from user_profiles where user_id = ${userA}`
      );
      expect(records.length).toBe(0);
      const name = await conn.oneFirst(
        sql`select fullname from user_profiles where user_id = ${userB}`
      );
      expect(name).toBe("User Burt");
      await conn.any(sql`ROLLBACK`);
    });
  });
});

test("Cannot use invalid urls for pictures", async () => {
  await pool.transaction(async (conn) => {
    const userId = await createUser(conn);
    await createSession(conn, userId);
    expect(
      conn.any(
        sql`update user_profiles set picture = 'my-pic' where user_id = ${userId}`
      )
    ).rejects.toThrow();
    await conn.any(sql`ROLLBACK`);
  });
});

test("Cannot use invalid emails", async () => {
  await pool.transaction(async (conn) => {
    const userId = await createUser(conn);
    await createSession(conn, userId);
    expect(
      conn.any(
        sql`update user_profiles set email = 'not@email' where user_id = ${userId}`
      )
    ).rejects.toThrow();
    await conn.any(sql`ROLLBACK`);
  });
});
