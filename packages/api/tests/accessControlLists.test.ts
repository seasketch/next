import { sql } from "slonik";
import {
  createSession,
  createUser,
  createProject,
  addParticipant,
  clearSession,
  projectTransaction,
} from "./helpers";
import { createPool } from "./pool";

const pool = createPool("test");

describe("Admins can edit access control lists", () => {
  test("updating type", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      await createSession(conn, adminId, true, false, projectId);
      const forumId = await conn.oneFirst(
        sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
      );
      let aclType = await conn.oneFirst(
        sql`select type from access_control_lists where forum_id_read = ${forumId}`
      );
      expect(aclType).toBe("public");
      await conn.any(
        sql`update access_control_lists set type = 'admins_only' where forum_id_read = ${forumId}`
      );
      aclType = await conn.oneFirst(
        sql`select type from access_control_lists where forum_id_read = ${forumId}`
      );
      expect(aclType).toBe("admins_only");
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("must be admin to update type", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId, "public");
      await createSession(conn, adminId, true, false, projectId);
      const forumId = await conn.oneFirst(
        sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
      );
      let aclType = await conn.oneFirst(
        sql`select type from access_control_lists where forum_id_read = ${forumId}`
      );
      expect(aclType).toBe("public");
      const rando = await createUser(conn);
      await createSession(conn, rando, true, false, projectId);
      expect(
        conn.oneFirst(
          sql`update access_control_lists set type = 'admins_only' where forum_id_read = ${forumId} returning id`
        )
      ).rejects.toThrow();
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("adding groups", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      await createSession(conn, adminId, true, false, projectId);
      const forumId = await conn.oneFirst(
        sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
      );
      const aclId = await conn.oneFirst(
        sql`update access_control_lists set type = 'group' where forum_id_read = ${forumId} returning id`
      );
      const groupId = await conn.oneFirst(
        sql`insert into project_groups (project_id, name) values (${projectId}, 'Group A') returning id`
      );
      await conn.any(sql`select add_group_to_acl(${aclId}, ${groupId})`);
      await clearSession(conn);
      const groups = await conn.many(
        sql`select group_id from access_control_list_groups where access_control_list_id = ${aclId}`
      );
      expect(groups.length).toBe(1);
      await conn.any(sql`ROLLBACK`);
    });
  });
  test("removing groups", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      await createSession(conn, adminId, true, false, projectId);
      const forumId = await conn.oneFirst(
        sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
      );
      const aclId = await conn.oneFirst(
        sql`update access_control_lists set type = 'group' where forum_id_read = ${forumId} returning id`
      );
      const groupId = await conn.oneFirst(
        sql`insert into project_groups (project_id, name) values (${projectId}, 'Group A') returning id`
      );
      await conn.any(sql`select add_group_to_acl(${aclId}, ${groupId})`);
      await clearSession(conn);
      let groups = await conn.many(
        sql`select group_id from access_control_list_groups where access_control_list_id = ${aclId}`
      );
      expect(groups.length).toBe(1);
      await createSession(conn, adminId, true, false, projectId);
      await conn.any(sql`select remove_group_from_acl(${aclId}, ${groupId})`);
      await clearSession(conn);
      groups = await conn.any(
        sql`select group_id from access_control_list_groups where access_control_list_id = ${aclId}`
      );
      expect(groups.length).toBe(0);

      await conn.any(sql`ROLLBACK`);
    });
  });
});

describe("ACL evaluation", () => {
  test("public content is available to everyone", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      const forumId = await conn.oneFirst(
        sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
      );
      const aclId = await conn.oneFirst(
        sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId} returning id`
      );
      await conn.any(sql`set role = anon`);
      const passes = await conn.oneFirst(sql`select session_on_acl(${aclId})`);
      expect(passes).toBe(true);
      await conn.any(sql`ROLLBACK`);
    });
  });
  test("admin_only content is only available to admins", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      const forumId = await conn.oneFirst(
        sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
      );
      const aclId = await conn.oneFirst(
        sql`update access_control_lists set type = 'admins_only' where forum_id_read = ${forumId} returning id`
      );
      await clearSession(conn);
      await conn.any(sql`set role = anon`);
      let passes = await conn.oneFirst(sql`select session_on_acl(${aclId})`);
      expect(passes).toBe(false);
      await createSession(conn, adminId);
      passes = await conn.oneFirst(sql`select session_on_acl(${aclId})`);
      expect(passes).toBe(true);
      await conn.any(sql`ROLLBACK`);
    });
  });
  test("group limited content is only available to group members and admins", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const userA = await createUser(conn);
      const userB = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      await createSession(conn, adminId, true, false, projectId);
      const forumId = await conn.oneFirst(
        sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
      );
      const aclId = await conn.oneFirst(
        sql`update access_control_lists set type = 'group' where forum_id_read = ${forumId} returning id`
      );
      const groupId = await conn.oneFirst(
        sql`insert into project_groups (project_id, name) values (${projectId}, 'Group A') returning id`
      );
      await conn.any(sql`select add_group_to_acl(${aclId}, ${groupId})`);
      await conn.any(sql`select add_user_to_group(${groupId}, ${userA})`);
      await clearSession(conn);
      let passes = await conn.oneFirst(sql`select session_on_acl(${aclId})`);
      expect(passes).toBe(false);
      await createSession(conn, userA);
      passes = await conn.oneFirst(sql`select session_on_acl(${aclId})`);
      expect(passes).toBe(true);
      await createSession(conn, userB);
      passes = await conn.oneFirst(sql`select session_on_acl(${aclId})`);
      expect(passes).toBe(false);
      await createSession(conn, adminId);
      passes = await conn.oneFirst(sql`select session_on_acl(${aclId})`);
      expect(passes).toBe(true);
      await conn.any(sql`ROLLBACK`);
    });
  });
});
// TODO: restore when email verification is better implemented
// describe("email confirmation and access to protected resources", () => {
//   test("session_is_admin returns false if email is not confirmed", async () => {
//     await projectTransaction(
//       pool,
//       "public",
//       async (conn, projectId, adminId, [userA, userB]) => {
//         await createSession(conn, adminId, false, false, projectId);
//         let isAdmin = await conn.oneFirst(
//           sql`select session_is_admin(${projectId})`
//         );
//         expect(isAdmin).toBe(false);
//         await createSession(conn, adminId, true, false, projectId);
//         isAdmin = await conn.oneFirst(
//           sql`select session_is_admin(${projectId})`
//         );
//         expect(isAdmin).toBe(true);
//       }
//     );
//   });
// TODO: Figure out how to handle after workshop
// test("session_on_acl returns false if email is not confirmed for group-only content", async () => {
//   await projectTransaction(
//     pool,
//     "public",
//     async (conn, projectId, adminId, [userA]) => {
//       await createSession(conn, adminId, true, false, projectId);
//       const forumId = await conn.oneFirst(
//         sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
//       );
//       const aclId = await conn.oneFirst(
//         sql`update access_control_lists set type = 'group' where forum_id_read = ${forumId} returning id`
//       );
//       const groupId = await conn.oneFirst(
//         sql`insert into project_groups (project_id, name) values (${projectId}, 'Group A') returning id`
//       );
//       await conn.any(sql`select add_group_to_acl(${aclId}, ${groupId})`);
//       await conn.any(sql`select add_user_to_group(${groupId}, ${userA})`);
//       await createSession(conn, userA, false, false, projectId);
//       let passes = await conn.oneFirst(sql`select session_on_acl(${aclId})`);
//       expect(passes).toBe(false);
//       await createSession(conn, userA, true, false, projectId);
//       passes = await conn.oneFirst(sql`select session_on_acl(${aclId})`);
//       expect(passes).toBe(true);
//     }
//   );
// });
// TODO: restore when email verification is better implemented
// test("session_has_project_access returns false if email is not confirmed for invite-only projects", async () => {
//   await projectTransaction(
//     pool,
//     "invite_only",
//     async (conn, projectId, adminId, [userA]) => {
//       await createSession(conn, userA, false, false, projectId);
//       let passes = await conn.oneFirst(
//         sql`select session_has_project_access(${projectId})`
//       );
//       expect(passes).toBe(false);
//       await createSession(conn, userA, true, false, projectId);
//       passes = await conn.oneFirst(
//         sql`select session_has_project_access(${projectId})`
//       );
//       expect(passes).toBe(true);
//     }
//   );
// });
// TODO: restore when email verification is better implemented
// test("session_has_project_access returns false if email is not confirmed for admins-only projects", async () => {
//   await projectTransaction(
//     pool,
//     "admins_only",
//     async (conn, projectId, adminId, [userA]) => {
//       await createSession(conn, adminId, false, false, projectId);
//       let passes = await conn.oneFirst(
//         sql`select session_has_project_access(${projectId})`
//       );
//       expect(passes).toBe(false);
//       await createSession(conn, adminId, true, false, projectId);
//       passes = await conn.oneFirst(
//         sql`select session_has_project_access(${projectId})`
//       );
//       expect(passes).toBe(true);
//     }
//   );
// });
// });
