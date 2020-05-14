import { sql } from "slonik";
import {
  createSession,
  createUser,
  createProject,
  addParticipant,
} from "./helpers";
import { createPool } from "./pool";

const pool = createPool("test");

describe("Group lists", () => {
  test("admins can create and list their project's groups", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      await createSession(conn, adminId, true, false, projectId);
      await conn.any(
        sql`insert into project_groups (project_id, name) values (${projectId}, 'Group A')`
      );
      const groupName = await conn.oneFirst(
        sql`select name from project_groups where project_id = ${projectId}`
      );
      expect(groupName).toBe("Group A");
      await conn.any(sql`ROLLBACK`);
    });
  });
  test("other users cannot list groups", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const userA = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      await conn.any(
        sql`insert into project_groups (project_id, name) values (${projectId}, 'Group A')`
      );
      await createSession(conn, userA, true, false, projectId);
      const records = await conn.any(
        sql`select name from project_groups where project_id = ${projectId}`
      );
      expect(records.length).toBe(0);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("Admins cannot list other project's groups", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const adminB = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      const projectBId = await createProject(conn, adminB);
      await createSession(conn, adminId, true, false, projectId);
      await conn.any(
        sql`insert into project_groups (project_id, name) values (${projectId}, 'Group A')`
      );
      await createSession(conn, adminB, true, false, projectId);
      const records = await conn.any(
        sql`select name from project_groups where project_id = ${projectId}`
      );
      expect(records.length).toBe(0);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("Admins cannot create groups in other projects", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const adminB = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      const projectBId = await createProject(conn, adminB);
      await createSession(conn, adminB, true, false, projectId);
      expect(
        conn.any(
          sql`insert into project_groups (project_id, name) values (${projectId}, 'Group A')`
        )
      ).rejects.toThrow();
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("Admins can delete groups in their projects", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      await createSession(conn, adminId, true, false, projectId);
      await conn.any(
        sql`insert into project_groups (project_id, name) values (${projectId}, 'Group A')`
      );
      expect(
        conn.any(
          sql`delete from project_groups where project_id = ${projectId}`
        )
      ).resolves.toBeTruthy();
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("admins can list group members", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const userId = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      // note that user must be a participant sharing a profile to be listed as
      // a member
      await addParticipant(conn, userId, projectId, false, true);
      await createSession(conn, adminId, true, false, projectId);
      const groupId = await conn.oneFirst(
        sql`insert into project_groups (project_id, name) values (${projectId}, 'Group A') returning id`
      );
      await conn.any(sql`select add_user_to_group(${groupId}, ${userId})`);
      const members = await conn.many(
        sql`select project_groups_members(project_groups.*) from project_groups where id = ${groupId}`
      );
      expect(members.length).toBe(1);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("Group members without a shared user_profile are not listed", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const userId = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      // note that user must be a participant sharing a profile to be listed as
      // a member
      await addParticipant(conn, userId, projectId, false, false);
      await createSession(conn, adminId, true, false, projectId);
      const groupId = await conn.oneFirst(
        sql`insert into project_groups (project_id, name) values (${projectId}, 'Group A') returning id`
      );
      await conn.any(sql`select add_user_to_group(${groupId}, ${userId})`);
      const members = await conn.any(
        sql`select project_groups_members(project_groups.*) from project_groups where id = ${groupId}`
      );
      expect(members.length).toBe(0);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("other users cannot list group members", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const userId = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      await addParticipant(conn, userId, projectId, false, true);
      await createSession(conn, adminId, true, false, projectId);
      const groupId = await conn.oneFirst(
        sql`insert into project_groups (project_id, name) values (${projectId}, 'Group A') returning id`
      );
      await conn.any(sql`select add_user_to_group(${groupId}, ${userId})`);
      await createSession(conn, userId, true, false, projectId);
      const members = await conn.any(
        sql`select project_groups_members(project_groups.*) from project_groups where id = ${groupId}`
      );
      expect(members.length).toBe(0);
      await conn.any(sql`ROLLBACK`);
    });
  });
});

describe("Group mutations", () => {
  // addUserToGroup is already tested in the above test cases
  test("removeUserFromGroup(groupId, userId)", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const userId = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      await addParticipant(conn, userId, projectId, false, true);
      await createSession(conn, adminId, true, false, projectId);
      const groupId = await conn.oneFirst(
        sql`insert into project_groups (project_id, name) values (${projectId}, 'Group A') returning id`
      );
      await conn.any(sql`select add_user_to_group(${groupId}, ${userId})`);
      let members = await conn.any(
        sql`select project_groups_members(project_groups.*) from project_groups where id = ${groupId}`
      );
      expect(members.length).toBe(1);
      await conn.any(sql`select remove_user_from_group(${groupId}, ${userId})`);
      members = await conn.any(
        sql`select project_groups_members(project_groups.*) from project_groups where id = ${groupId}`
      );
      expect(members.length).toBe(0);
      await conn.any(sql`ROLLBACK`);
    });
  });
});
