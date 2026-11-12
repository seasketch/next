import { sql } from "slonik";
import { createPool } from "./pool";
import {
  createSession,
  createUser,
  createProject,
  addParticipant,
  clearSession,
  projectTransaction,
  asDatabaseOwner,
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
  // TODO: restore when email verification is better implemented
  // test("Admin-only projects return DENIED_EMAIL_NOT_VERIFIED if email has not been verified, even if the user is an admin", async () => {
  //   await projectTransaction(
  //     pool,
  //     "admins_only",
  //     async (conn, projectId, adminId, [userA]) => {
  //       await createSession(conn, adminId, false, false, projectId);
  //       const status = await conn.oneFirst(
  //         sql`select project_access_status(${projectId})`
  //       );
  //       expect(status).toBe("DENIED_EMAIL_NOT_VERIFIED");
  //     }
  //   );
  // });
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
  // TODO: restore when email verification is better implemented
  // test("Invite-only projects return DENIED_EMAIL_NOT_VERIFIED if access request was approved but email has not been verified", async () => {
  //   await projectTransaction(
  //     pool,
  //     "invite_only",
  //     async (conn, projectId, adminId, [userA]) => {
  //       const userB = await createUser(conn);
  //       await createSession(conn, userB, true, false, projectId);
  //       await conn.oneFirst(sql`select join_project(${projectId})`);
  //       await createSession(conn, adminId, true, false, projectId);
  //       await conn.oneFirst(
  //         sql`select approve_participant(${projectId}, ${userB})`
  //       );
  //       await createSession(conn, userB, false, false, projectId);
  //       const status = await conn.oneFirst(
  //         sql`select project_access_status(${projectId})`
  //       );
  //       expect(status).toBe("DENIED_EMAIL_NOT_VERIFIED");
  //       await createSession(conn, userB, true, false, projectId);
  //       const statusAfterVerified = await conn.oneFirst(
  //         sql`select project_access_status(${projectId})`
  //       );
  //       expect(statusAfterVerified).toBe("GRANTED");
  //     }
  //   );
  // });
});

describe("survey invites do not grant project access", () => {
  test("an approved participant on an invite-only project still has access", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, userA, true, false, projectId);
        expect(
          await conn.oneFirst(
            sql`select session_has_project_access(${projectId})`
          )
        ).toBe(true);
        expect(
          await conn.oneFirst(sql`select project_access_status(${projectId})`)
        ).toBe("GRANTED");
      }
    );
  });

  test("seasketch_user cannot call create_survey_invites", async () => {
    await projectTransaction(
      pool,
      "admins_only",
      async (conn, projectId, adminId, [userA]) => {
        await clearSession(conn);
        const allowed = await conn.oneFirst(
          sql`select has_function_privilege(
            'seasketch_user',
            'public.create_survey_invites(integer, boolean, boolean, text[], public.survey_invite_options[])',
            'execute'
          )`
        );
        expect(allowed).toBe(false);

        await createSession(conn, adminId, true, false, projectId);
        const surveyId = await conn.oneFirst(
          sql`select id from make_survey('Survey', ${projectId}, null)`
        );
        await conn.any(sql`SAVEPOINT before_denied_call`);
        await expect(
          conn.any(
            sql`select * from create_survey_invites(${surveyId}, false, null, null, array[
              ('bob@example.com', 'Bob')::survey_invite_options
            ])`
          )
        ).rejects.toThrow(/permission denied/i);
        await conn.any(sql`ROLLBACK TO SAVEPOINT before_denied_call`);

        await createSession(conn, userA, true, false, projectId);
        await conn.any(sql`SAVEPOINT before_non_admin_call`);
        await expect(
          asDatabaseOwner(conn, () =>
            conn.any(
              sql`select * from create_survey_invites(${surveyId}, false, null, null, array[
                ('bob@example.com', 'Bob')::survey_invite_options
              ])`
            )
          )
        ).rejects.toThrow(/administrator/i);
        await conn.any(sql`ROLLBACK TO SAVEPOINT before_non_admin_call`);
      }
    );
  });

  test.each([
    ["admins_only", "user", "DENIED_ADMINS_ONLY"],
    ["admins_only", "verified_email", "DENIED_ADMINS_ONLY"],
    ["admins_only", "token", "DENIED_ANON"],
    ["admins_only", "signed_in_token", "DENIED_ADMINS_ONLY"],
    ["invite_only", "user", "DENIED_NOT_REQUESTED"],
    ["invite_only", "verified_email", "DENIED_NOT_REQUESTED"],
    ["invite_only", "token", "DENIED_ANON"],
    ["invite_only", "signed_in_token", "DENIED_NOT_REQUESTED"],
  ] as const)(
    "%s project stays closed for a survey invite matched by %s",
    async (accessControl, mode, deniedStatus) => {
      await projectTransaction(
        pool,
        accessControl,
        async (conn, projectId, adminId, [userA]) => {
          // invite_only fixtures approve userA. Use someone who was never added.
          const userId =
            accessControl === "invite_only" ? await createUser(conn) : userA;
          await createSession(conn, adminId, true, false, projectId);
          const surveyId = await conn.oneFirst(
            sql`select id from make_survey('Invite', ${projectId}, null)`
          );
          await conn.any(
            sql`update surveys set is_disabled = false, access_type = 'INVITE_ONLY' where id = ${surveyId}`
          );
          const forumId = await conn.oneFirst(
            sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
          );
          await conn.any(
            sql`insert into sketch_classes (mapbox_gl_style, project_id, name) values ('[]'::jsonb, ${projectId}, 'MPA')`
          );
          expect(
            (await conn.any(sql`select 1 from forums where id = ${forumId}`))
              .length
          ).toBe(1);

          const inviteEmail =
            mode === "token" || mode === "signed_in_token"
              ? "bob@example.com"
              : `test-${userId}@example.com`;
          if (mode === "user") {
            await asDatabaseOwner(conn, () =>
              conn.any(
                sql`insert into survey_invites (survey_id, user_id, was_added_from_group) values (${surveyId}, ${userId}, true)`
              )
            );
          } else {
            await asDatabaseOwner(conn, () =>
              conn.any(
                sql`select * from create_survey_invites(${surveyId}, false, null, null, array[
                  (${inviteEmail}, 'Bob')::survey_invite_options
                ])`
              )
            );
          }

          if (mode === "token") {
            await clearSession(conn);
            await createSession(conn);
            await conn.any(
              sql`select set_config('session.survey_invite_email', ${inviteEmail}, true)`
            );
          } else {
            await createSession(conn, userId, true, false, projectId);
            if (mode === "signed_in_token") {
              await conn.any(
                sql`select set_config('session.survey_invite_email', ${inviteEmail}, true)`
              );
            }
          }

          expect(
            await conn.oneFirst(
              sql`select session_has_project_access(${projectId})`
            )
          ).toBe(false);
          expect(
            await conn.oneFirst(sql`select project_access_status(${projectId})`)
          ).toBe(deniedStatus);
          expect(
            (await conn.any(sql`select 1 from forums where id = ${forumId}`))
              .length
          ).toBe(0);
          expect(
            (
              await conn.any(
                sql`select 1 from sketch_classes where project_id = ${projectId}`
              )
            ).length
          ).toBe(0);
          expect(
            await conn.oneFirst(
              sql`select session_has_survey_invite(${surveyId})`
            )
          ).toBe(true);
          expect(
            (await conn.any(sql`select 1 from surveys where id = ${surveyId}`))
              .length
          ).toBe(1);
          const formId = await conn.oneFirst(
            sql`select id from forms where survey_id = ${surveyId}`
          );
          expect(
            await conn.oneFirst(sql`select session_can_access_form(${formId})`)
          ).toBe(true);
          expect(
            (await conn.any(sql`select 1 from forms where id = ${formId}`))
              .length
          ).toBe(1);
        }
      );
    }
  );
});
