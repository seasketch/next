import { sql } from "slonik";
import { createPool } from "./pool";
import {
  createUser,
  createProject,
  addParticipant,
  createSession,
  clearSession,
} from "./helpers";

const pool = createPool("test");

describe("User lists", () => {
  // TODO: check in graphql schema. This is not enforced at the db level
  // test.todo("Users cannot be listed arbitrarily by anyone");

  test("Admins can list project participants who have shared a profile", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      let users = 10;
      const participantIds = [];
      while (users--) {
        const uid = await createUser(conn);
        participantIds.push(uid);
        await addParticipant(conn, uid, projectId, false);
      }
      const unshared = await createUser(conn);
      await addParticipant(conn, unshared, projectId, false, false);

      await createSession(conn, adminId, true, false, projectId);
      const participants = await conn.manyFirst(
        sql`SELECT projects_participants(projects.*) from projects where id = ${projectId}`
      );
      expect(participants.length).toBe(11);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("Regular users cannot access project participants", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId);
      let users = 10;
      const participantIds = [];
      while (users--) {
        const uid = await createUser(conn);
        participantIds.push(uid);
        await addParticipant(conn, uid, projectId, false);
      }
      const unshared = await createUser(conn);
      await addParticipant(conn, unshared, projectId, false, false);

      await createSession(conn, participantIds[0], true, false, projectId);
      expect(
        conn.manyFirst(
          sql`SELECT projects_participants(projects.*) from projects where id = ${projectId}`
        )
      ).rejects.toThrow();
      await conn.any(sql`ROLLBACK`);
    });
  });
});

describe("User account mutations", () => {
  test("onboarded()", async () => {
    // Can be used to show an onboarding ui when a user first registers
    await pool.transaction(async (conn) => {
      const userId = await createUser(conn);
      let onboarded = await conn.oneFirst(
        sql`select onboarded from users where id = ${userId}`
      );
      expect(onboarded).toBe(null);
      await createSession(conn, userId);
      await conn.any(sql`select onboarded()`);
      onboarded = await conn.oneFirst(
        sql`select onboarded from users where id = ${userId}`
      );
      expect(onboarded).toBeGreaterThan(new Date().getTime() - 1000);
      await conn.any(sql`ROLLBACK`);
    });
  });

  describe("participationStatus(projectId)", () => {
    test("accessible to self", async () => {
      await pool.transaction(async (conn) => {
        const adminId = await createUser(conn);
        const projectId = await createProject(conn, adminId);
        await conn.any(
          sql`update projects 
            set access_control = 'public', 
            is_listed = true 
          where id = ${projectId}`
        );
        const userId = await createUser(conn);
        await addParticipant(conn, userId, projectId);
        await createSession(conn, userId, true, false, projectId);
        const status = await conn.oneFirst(sql`
          select 
            users_participation_status(users.*, ${projectId}) 
          from 
            users 
          where 
            users.id = ${userId}
        `);
        expect(status).toBe("participant");
        await conn.any(sql`ROLLBACK`);
      });
    });

    test("accessible to admins on the project", async () => {
      await pool.transaction(async (conn) => {
        const adminId = await createUser(conn);
        const projectId = await createProject(conn, adminId);
        await conn.any(
          sql`update projects 
            set access_control = 'public', 
            is_listed = true 
          where id = ${projectId}`
        );
        const userId = await createUser(conn);
        await addParticipant(conn, userId, projectId);
        await createSession(conn, adminId, true, false, projectId);
        const status = await conn.oneFirst(sql`
          select 
            users_participation_status(users.*, ${projectId}) 
          from 
            users 
          where 
            users.id = ${userId}
        `);
        expect(status).toBe("participant");
        await conn.any(sql`ROLLBACK`);
      });
    });

    test("returns none for everyone else", async () => {
      await pool.transaction(async (conn) => {
        const adminId = await createUser(conn);
        const projectId = await createProject(conn, adminId);
        await conn.any(
          sql`update projects 
            set access_control = 'public', 
            is_listed = true 
          where id = ${projectId}`
        );
        const userId = await createUser(conn);
        await addParticipant(conn, userId, projectId);
        await createSession(conn, userId, true, false, projectId);
        const status = await conn.oneFirst(sql`
          select 
            users_participation_status(users.*, ${projectId}) 
          from 
            users 
          where 
            users.id = ${adminId}
        `);
        expect(status).toBe("none");
        await conn.any(sql`ROLLBACK`);
      });
    });

    test("invite-only projects require approval", async () => {
      await pool.transaction(async (conn) => {
        const adminId = await createUser(conn);
        const projectId = await createProject(conn, adminId);
        await conn.any(
          sql`update projects 
            set access_control = 'invite_only', 
            is_listed = true 
          where id = ${projectId}`
        );
        const userId = await createUser(conn);
        await addParticipant(conn, userId, projectId);
        await createSession(conn, adminId, true, false, projectId);
        const status = await conn.oneFirst(sql`
          select 
            users_participation_status(users.*, ${projectId}) 
          from 
            users 
          where 
            users.id = ${userId}
        `);
        expect(status).toBe("pending_approval");
        await conn.any(sql`ROLLBACK`);
      });
    });
  });

  test("joinProject(projectId)", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId, "public");
      let users = 3;
      const participantIds = [];
      while (users--) {
        const uid = await createUser(conn);
        participantIds.push(uid);
        await addParticipant(conn, uid, projectId, false);
      }
      const uid = await createUser(conn);
      await addParticipant(conn, uid, projectId, false, false);
      const unshared = await createUser(conn);
      await createSession(conn, adminId, true, false, projectId);
      const participants = await conn.manyFirst(
        sql`SELECT projects_participants(projects.*) from projects where id = ${projectId}`
      );
      expect(participants.length).toBe(4);
      await createSession(conn, unshared, true, false, projectId);
      await conn.any(sql`select join_project(${projectId})`);
      await createSession(conn, adminId, true, false, projectId);
      const newParticipants = await conn.manyFirst(
        sql`SELECT projects_participants(projects.*) from projects where id = ${projectId}`
      );
      expect(newParticipants.length).toBe(5);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("leaveProject(projectId)", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId, "public");
      let users = 3;
      const participantIds = [];
      while (users--) {
        const uid = await createUser(conn);
        participantIds.push(uid);
        await addParticipant(conn, uid, projectId, false);
      }
      await createSession(conn, adminId, true, false, projectId);
      const participants = await conn.manyFirst(
        sql`SELECT projects_participants(projects.*) from projects where id = ${projectId}`
      );
      expect(participants.length).toBe(4);
      await createSession(conn, participantIds[0], true, false, projectId);
      await conn.any(sql`select leave_project(${projectId})`);
      await createSession(conn, adminId, true, false, projectId);
      const newParticipants = await conn.manyFirst(
        sql`SELECT projects_participants(projects.*) from projects where id = ${projectId}`
      );
      expect(newParticipants.length).toBe(3);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("approveParticipant(projectId, userId)", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId, "invite_only");
      const unapproved = await createUser(conn);
      await addParticipant(conn, unapproved, projectId, false, true, false);
      await createSession(conn, adminId, true, false, projectId);
      let isApproved = await conn.oneFirst(
        sql`SELECT approved from project_participants where project_id = ${projectId} and user_id = ${unapproved}`
      );
      expect(isApproved).toBe(false);
      await conn.any(
        sql`select approve_participant(${projectId}, ${unapproved})`
      );
      isApproved = await conn.oneFirst(
        sql`SELECT approved from project_participants where project_id = ${projectId} and user_id = ${unapproved}`
      );
      expect(isApproved).toBe(true);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("grantAdminAccess(projectId, userId)", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId, "public");
      const newAdmin = await createUser(conn);
      await addParticipant(conn, newAdmin, projectId, false, true);
      await createSession(conn, adminId, true, false, projectId);
      let isAdmin = await conn.oneFirst(
        sql`SELECT is_admin from project_participants where project_id = ${projectId} and user_id = ${newAdmin}`
      );
      expect(isAdmin).toBe(false);
      await conn.any(sql`select grant_admin_access(${projectId}, ${newAdmin})`);
      isAdmin = await conn.oneFirst(
        sql`SELECT is_admin from project_participants where project_id = ${projectId} and user_id = ${newAdmin}`
      );
      expect(isAdmin).toBe(true);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("grantAdminAccess can only be called for users with shared profile", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId, "public");
      const newAdmin = await createUser(conn);
      await addParticipant(conn, newAdmin, projectId, false, false);
      await createSession(conn, adminId, true, false, projectId);
      let isAdmin = await conn.oneFirst(
        sql`SELECT is_admin from project_participants where project_id = ${projectId} and user_id = ${newAdmin}`
      );
      expect(isAdmin).toBe(false);
      expect(
        conn.any(sql`select grant_admin_access(${projectId}, ${newAdmin})`)
      ).rejects.toThrow(/share/);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("approveParticipant is only accessible to project admins", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId, "invite_only");
      const unapproved = await createUser(conn);
      await addParticipant(conn, unapproved, projectId, false, true, false);
      await createSession(conn, adminId, true, false, projectId);
      expect(
        conn.any(sql`select approve_participant(${999}, ${unapproved})`)
      ).rejects.toThrow(/admin/);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("grantAdminAccess is accessible only to project admins", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId, "invite_only");
      const unapproved = await createUser(conn);
      await addParticipant(conn, unapproved, projectId, false, true, false);
      await createSession(conn, adminId, true, false, projectId);
      expect(
        conn.any(sql`select grant_admin_access(${999}, ${unapproved})`)
      ).rejects.toThrow(/admin/);
      await conn.any(sql`ROLLBACK`);
    });
  });
});

describe("isAdmin property", () => {
  test("can be called on self", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId, "public");
      const regularUserId = await createUser(conn);
      await addParticipant(conn, regularUserId, projectId, false, true);
      await createSession(conn, regularUserId, true, false, projectId);
      let isAdmin = await conn.oneFirst(
        sql`select users_is_admin(users.*, ${projectId}) from users where id = ${regularUserId}`
      );
      expect(isAdmin).toBe(false);
      await createSession(conn, adminId, true, false, projectId);
      isAdmin = await conn.oneFirst(
        sql`select users_is_admin(users.*, ${projectId}) from users where id = ${adminId}`
      );
      expect(isAdmin).toBe(true);
      await conn.any(sql`ROLLBACK`);
    });
  });

  test("can be called by admins", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId, "public");
      const regularUserId = await createUser(conn);
      await addParticipant(conn, regularUserId, projectId, false, true);
      await createSession(conn, adminId, true, false, projectId);
      let isAdmin = await conn.oneFirst(
        sql`select users_is_admin(users.*, ${projectId}) from users where id = ${regularUserId}`
      );
      expect(isAdmin).toBe(false);
      await conn.any(sql`ROLLBACK`);
    });
  });
  test("always returns false when called by non-admins", async () => {
    await pool.transaction(async (conn) => {
      const adminId = await createUser(conn);
      const projectId = await createProject(conn, adminId, "public");
      const regularUserId = await createUser(conn);
      await addParticipant(conn, regularUserId, projectId, false, true);
      await createSession(conn, regularUserId, true, false, projectId);
      let isAdmin = await conn.oneFirst(
        sql`select users_is_admin(users.*, ${projectId}) from users where id = ${adminId}`
      );
      expect(isAdmin).toBe(false);
      await conn.any(sql`ROLLBACK`);
    });
  });
});
