import { sql } from "slonik";
import { createPool } from "./pool";
import {
  createSession,
  createUser,
  createProject,
  addParticipant,
  clearSession,
  projectTransaction,
} from "./helpers";

const pool = createPool("test");

describe("currentProjectAccessStatus", () => {
  test("Public projects always return GRANTED", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, undefined, false, false, projectId);
        const status = await conn.oneFirst(
          sql`select project_access_status(${projectId})`
        );
        expect(status).toBe("GRANTED");
      }
    );
  });
  test("PROJECT_DOES_NOT_EXIST is returned when project doesn't exist", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, undefined, false, false, 9999999);
        const status = await conn.oneFirst(
          sql`select project_access_status(${99999999})`
        );
        expect(status).toBe("PROJECT_DOES_NOT_EXIST");
      }
    );
  });
  test("Admin-only projects return DENIED_ADMINS_ONLY if the user is not an admin", async () => {
    await projectTransaction(
      pool,
      "admins_only",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, userA, true, false, projectId);
        const status = await conn.oneFirst(
          sql`select project_access_status(${projectId})`
        );
        expect(status).toBe("DENIED_ADMINS_ONLY");
      }
    );
  });
  test("Admin-only projects return GRANTED if the user is an admin", async () => {
    await projectTransaction(
      pool,
      "admins_only",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const status = await conn.oneFirst(
          sql`select project_access_status(${projectId})`
        );
        expect(status).toBe("GRANTED");
      }
    );
  });
  test("Admin-only projects return DENIED_EMAIL_NOT_VERIFIED if email has not been verified, even if the user is an admin", async () => {
    await projectTransaction(
      pool,
      "admins_only",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, false, false, projectId);
        const status = await conn.oneFirst(
          sql`select project_access_status(${projectId})`
        );
        expect(status).toBe("DENIED_EMAIL_NOT_VERIFIED");
      }
    );
  });
  test("Invite-only projects return DENIED_ANON if user is anon", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, undefined, false, false, projectId);
        const status = await conn.oneFirst(
          sql`select project_access_status(${projectId})`
        );
        expect(status).toBe("DENIED_ANON");
      }
    );
  });
  test("Invite-only projects return DENIED_NOT_REQUESTED if user is signed in but never requested access", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        const userB = await createUser(conn);
        await createSession(conn, userB, true, false, projectId);
        const status = await conn.oneFirst(
          sql`select project_access_status(${projectId})`
        );
        expect(status).toBe("DENIED_NOT_REQUESTED");
      }
    );
  });
  test("Invite-only projects return DENIED_NOT_APPROVED if user requested access but an admin has not approved", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        const userB = await createUser(conn);
        await createSession(conn, userB, true, false, projectId);
        await conn.oneFirst(sql`select join_project(${projectId})`);
        const status = await conn.oneFirst(
          sql`select project_access_status(${projectId})`
        );
        expect(status).toBe("DENIED_NOT_APPROVED");
      }
    );
  });
  test("Invite-only projects return DENIED_EMAIL_NOT_VERIFIED if access request was approved but email has not been verified", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        const userB = await createUser(conn);
        await createSession(conn, userB, true, false, projectId);
        await conn.oneFirst(sql`select join_project(${projectId})`);
        await createSession(conn, adminId, true, false, projectId);
        await conn.oneFirst(
          sql`select approve_participant(${projectId}, ${userB})`
        );
        await createSession(conn, userB, false, false, projectId);
        const status = await conn.oneFirst(
          sql`select project_access_status(${projectId})`
        );
        expect(status).toBe("DENIED_EMAIL_NOT_VERIFIED");
        await createSession(conn, userB, true, false, projectId);
        const statusAfterVerified = await conn.oneFirst(
          sql`select project_access_status(${projectId})`
        );
        expect(statusAfterVerified).toBe("GRANTED");
      }
    );
  });
});
