import { sql } from "slonik";
import { createPool } from "./pool";
import {
  createUser,
  createProject,
  createSession,
  clearSession,
  createGroup,
  projectTransaction,
  verifyCRUDOpsLimitedToAdmins,
  asPg,
} from "./helpers";
import {
  updateStatus,
  sendProjectInviteEmail,
  verifyProjectInvite,
  confirmProjectInvite,
} from "../src/invites/projectInvites";
import { rotateKeys, verify } from "../src/auth/jwks";
import ms from "ms";
import auth0 from "auth0";

// @ts-ignore
auth0.ManagementClient.prototype.updateUser = jest.fn(() => {});
// @ts-ignore
auth0.ManagementClient.prototype.getUsers = jest.fn((val) => {
  return [];
});

const pool = createPool("test");

jest.setTimeout(10000);

jest.mock("../src/invites/sendEmail");

const exampleToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

beforeAll(async () => {
  await rotateKeys(asPg(pool));
});

describe("Management operations", () => {
  test("project invites can't be inserted directly", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        expect(
          conn.any(
            sql`insert into project_invites (project_id, fullname, email) values (${projectId}, 'Jo Blow', 'joe@example.com')`
          )
        ).rejects.toThrow();
      }
    );
  });
  test("admins can update only fullname, email, make_admin on invites", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await clearSession(conn);
        const inviteId = await conn.oneFirst(
          sql`insert into project_invites (project_id, fullname, email) values (${projectId}, 'Jo Blow', 'joe@example.com') returning id`
        );
        expect(inviteId).toBeGreaterThan(0);
        await createSession(conn, adminId, true, false);
        const email = await conn.oneFirst(
          sql`update project_invites set fullname = 'Jo', email = 'blow@example.com', make_admin = true where id = ${inviteId} returning email`
        );
        expect(email).toBe("blow@example.com");
        expect(
          conn.any(
            sql`update project_invites set was_used = true where id = ${inviteId}`
          )
        ).rejects.toThrow();
      }
    );
  });
  test("admins can delete invites", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await clearSession(conn);
        const inviteId = await conn.oneFirst(
          sql`insert into project_invites (project_id, fullname, email) values (${projectId}, 'Jo Blow', 'joe@example.com') returning id`
        );
        expect(inviteId).toBeGreaterThan(0);
        await createSession(conn, adminId, true, false);
        const id = await conn.oneFirst(
          sql`delete from project_invites where id = ${inviteId} returning id`
        );
        expect(id).toBe(inviteId);
      }
    );
  });
  test("admins create project invites with createProjectInvites(projectId, ProjectInviteOptions)", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const invites = await conn.many(
          sql`select * from create_project_invites(${projectId}, false, false, null, array[
            ('jo@example.com', 'Jo')::project_invite_options,
            ('bob@example.com', 'Bob')::project_invite_options
          ]) order by fullname desc`
        );
        expect(invites.length).toBe(2);
        expect(invites[0].id).toBeGreaterThan(0);
        expect(invites[0].fullname).toBe("Jo");
        expect(invites[0].was_used).toBe(false);
      }
    );
  });
  test("createProjectInvites can be called with a list of groups to assign users", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const groupAId = await createGroup(conn, projectId, "Group A");
        const groupBId = await createGroup(conn, projectId, "Group B");
        const groupCId = await createGroup(conn, projectId, "Group C");
        const invites = await conn.many(
          sql`select * from create_project_invites(${projectId}, false, false, ${sql.array(
            ["Group A", "Group B"],
            "text"
          )}, array[
              ('jo@example.com', 'Jo')::project_invite_options,
              ('bob@example.com', 'Bob')::project_invite_options
            ])`
        );
        expect(invites.length).toBe(2);
        await clearSession(conn);
        const groupRecords = await conn.many(
          sql`select * from project_invite_groups`
        );
        expect(groupRecords.length).toBe(4);
      }
    );
  });
  test("creating and sending project invites in a single step", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId);
        const groupAId = await createGroup(conn, projectId, "Group A");
        const invite = await conn.one(
          sql`select * from create_project_invites(${projectId}, true, false, ${sql.array(
            ["Group A"],
            "text"
          )}, array[
              ('jo@example.com', 'Jo')::project_invite_options
            ])`
        );
        expect(invite.fullname).toBe("Jo");
        await clearSession(conn);
        const email = await conn.one(
          sql`select * from invite_emails where project_invite_id = ${invite.id}`
        );
        expect(email.status).toBe("QUEUED");
      }
    );
  });
  test("CRUD operations limited to admins", async () => {
    await verifyCRUDOpsLimitedToAdmins(pool, {
      create: async (conn, projectId, adminId, userIds) => {
        const invite = await conn.one(
          sql`select * from create_project_invites(${projectId}, false, false, null, array[
            ('bob@example.com', 'Bob')::project_invite_options
          ])`
        );
        return sql`select * from project_invites where id = ${invite.id}`;
      },
      update: (recordId) =>
        sql`update project_invites set fullname = 'Bob Boberts' where id = ${recordId} returning *`,
      delete: (recordId) => {
        return sql`delete from project_invites where id = ${recordId} returning *`;
      },
    });
  });
  test("invite listing limited to admins", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId);
        const groupAId = await createGroup(conn, projectId, "Group A");
        const invite = await conn.one(
          sql`select * from create_project_invites(${projectId}, true, false, ${sql.array(
            ["Group A"],
            "text"
          )}, array[
              ('jo@example.com', 'Jo')::project_invite_options
            ])`
        );
        await createSession(conn, userA, true, false, projectId);
        expect(conn.one(sql`select * from project_invites`)).rejects.toThrow();
      }
    );
  });
});

describe("Sending invites", () => {
  test(`sendAllProjectInvites(projectId) creates invite_emails records for all project invites`, async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const groupAId = await createGroup(conn, projectId, "Group A");
        const groupBId = await createGroup(conn, projectId, "Group B");
        const groupCId = await createGroup(conn, projectId, "Group C");
        const invites = await conn.many(
          sql`select * from create_project_invites(${projectId}, false, false, ${sql.array(
            ["Group A", "Group B"],
            "text"
          )}, array[
                ('jo@example.com', 'Jo')::project_invite_options,
                ('bob@example.com', 'Bob')::project_invite_options
              ])`
        );
        const sentInvites = await conn.many(
          sql`select * from create_project_invites(${projectId}, true, false, ${sql.array(
            [],
            "text"
          )}, array[
                ('chad@example.com', 'Chad Burt')::project_invite_options
              ])`
        );
        expect(invites.length).toBe(2);
        expect(sentInvites.length).toBe(1);
        let emails = await conn.many(sql`select status from invite_emails`);
        expect(emails.length).toBe(1);
        expect(emails[0].status).toBe("QUEUED");
        emails = await conn.many(
          sql`select status from send_all_project_invites(${projectId})`
        );
        await clearSession(conn);
        const allInviteEmails = await conn.many(
          sql`select * from invite_emails`
        );
        expect(emails.length).toBe(2);
        expect(emails[0].status).toBe("QUEUED");
      }
    );
  });
  test(`sendProjectInvites(projectInviteIds) creates invite_emails records for listed ids`, async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const groupAId = await createGroup(conn, projectId, "Group A");
        const groupBId = await createGroup(conn, projectId, "Group B");
        const groupCId = await createGroup(conn, projectId, "Group C");
        const invites = await conn.many(
          sql`select * from create_project_invites(${projectId}, false, false, ${sql.array(
            ["Group A", "Group B"],
            "text"
          )}, array[
                  ('jo@example.com', 'Jo')::project_invite_options,
                  ('bob@example.com', 'Bob')::project_invite_options
                ])`
        );
        await conn.any(
          sql`select send_project_invites(${sql.array(
            [invites[0].id],
            "int4"
          )})`
        );
        await clearSession(conn);
        const emails = await conn.many(sql`select * from invite_emails`);
        expect(emails.length).toBe(1);
        expect(emails[0].status).toBe("QUEUED");
      }
    );
  });
  test("sendProjectInvites() limited to admins", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const groupAId = await createGroup(conn, projectId, "Group A");
        const groupBId = await createGroup(conn, projectId, "Group B");
        const groupCId = await createGroup(conn, projectId, "Group C");
        const invites = await conn.many(
          sql`select * from create_project_invites(${projectId}, false, false, ${sql.array(
            ["Group A", "Group B"],
            "text"
          )}, array[
                  ('jo@example.com', 'Jo')::project_invite_options,
                  ('bob@example.com', 'Bob')::project_invite_options
                ])`
        );
        await createSession(conn, userA, true, false);
        expect(
          conn.any(
            sql`select send_project_invites(${sql.array(
              [invites[0].id],
              "int4"
            )})`
          )
        ).rejects.toThrow(/admin/i);
      }
    );
  });
  test("sendAllProjectInvites() limited to admins", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const groupAId = await createGroup(conn, projectId, "Group A");
        const groupBId = await createGroup(conn, projectId, "Group B");
        const groupCId = await createGroup(conn, projectId, "Group C");
        const invites = await conn.many(
          sql`select * from create_project_invites(${projectId}, false, false, ${sql.array(
            ["Group A", "Group B"],
            "text"
          )}, array[
                  ('jo@example.com', 'Jo')::project_invite_options,
                  ('bob@example.com', 'Bob')::project_invite_options
                ])`
        );
        await createSession(conn, userA, true, false);
        expect(
          conn.any(sql`select send_all_project_invites(${projectId})`)
        ).rejects.toThrow(/admin/i);
      }
    );
  });
  test(`invite emails cannot inserted, updated, or deleted directly by seasketch users`, async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const invites = await conn.many(
          sql`select * from create_project_invites(${projectId}, false, false, ${sql.array(
            [],
            "text"
          )}, array[
                    ('bob@example.com', 'Bob')::project_invite_options
                  ])`
        );
        await conn.any(
          sql`select send_project_invites(${sql.array(
            [invites[0].id],
            "int4"
          )})`
        );
        await conn.any(sql`savepoint update_invite_emails`);
        expect(
          conn.any(sql`update invite_emails set status = 'SENT'`)
        ).rejects.toThrow(/permission/);
        await conn.any(sql`rollback`);
        expect(
          conn.any(
            sql`delete from invite_emails where project_invite_id = ${invites[0].id} returning *`
          )
        ).resolves.toMatchObject([]);
      }
    );
  });
  test(`admins (and only admins) can access invite_emails for a project invite`, async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const groupAId = await createGroup(conn, projectId, "Group A");
        const groupBId = await createGroup(conn, projectId, "Group B");
        const groupCId = await createGroup(conn, projectId, "Group C");
        const invites = await conn.many(
          sql`select * from create_project_invites(${projectId}, false, false, ${sql.array(
            ["Group A", "Group B"],
            "text"
          )}, array[
                    ('jo@example.com', 'Jo')::project_invite_options,
                    ('bob@example.com', 'Bob')::project_invite_options
                  ])`
        );
        await conn.any(
          sql`select send_project_invites(${sql.array(
            [invites[0].id],
            "int4"
          )})`
        );
        const emails = await conn.many(
          sql`select status, created_at from invite_emails`
        );
        expect(emails.length).toBe(1);
        expect(emails[0].status).toBe("QUEUED");
        await createSession(conn, userA, true, false, projectId);
        expect(
          conn.many(sql`select status, created_at from invite_emails`)
        ).rejects.toThrow(/not found/);
      }
    );
  });

  describe(`project invite status reflects status of related emails`, () => {
    test(`queued`, async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                      ('bob@example.com', 'Bob')::project_invite_options
                    ])`
          );

          let status = await conn.oneFirst(
            sql`select project_invites_status(project_invites.*) from project_invites where id = ${invite.id}`
          );
          expect(status).toBe("QUEUED");
        }
      );
    });
    test("unsent", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, false, false, null, array[
                        ('bob@example.com', 'Bob')::project_invite_options
                      ])`
          );

          let status = await conn.oneFirst(
            sql`select project_invites_status(project_invites.*) from project_invites where id = ${invite.id}`
          );
          expect(status).toBe("UNSENT");
        }
      );
    });
    test(`sent`, async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                      ('bob@example.com', 'Bob')::project_invite_options
                    ])`
          );
          await clearSession(conn);
          await conn.any(
            sql`update invite_emails set status = 'SENT', token = ${exampleToken}, token_expires_at = to_timestamp(${
              new Date().getTime() + 10000
            })`
          );
          let status = await conn.oneFirst(
            sql`select project_invites_status(project_invites.*) from project_invites where id = ${invite.id}`
          );
          expect(status).toBe("SENT");
        }
      );
    });
    test(`delivered`, async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                      ('bob@example.com', 'Bob')::project_invite_options
                    ])`
          );
          await clearSession(conn);
          await conn.any(
            sql`update invite_emails set status = 'DELIVERED', token = ${exampleToken}, token_expires_at = to_timestamp(${
              new Date().getTime() + 10000
            })`
          );
          let status = await conn.oneFirst(
            sql`select project_invites_status(project_invites.*) from project_invites where id = ${invite.id}`
          );
          expect(status).toBe("DELIVERED");
        }
      );
    });
    test(`bounced`, async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                      ('bob@example.com', 'Bob')::project_invite_options
                    ])`
          );
          await clearSession(conn);
          await conn.any(
            sql`update invite_emails set status = 'BOUNCED', token = ${exampleToken}, token_expires_at = to_timestamp(${
              new Date().getTime() + 10000
            })`
          );
          let status = await conn.oneFirst(
            sql`select project_invites_status(project_invites.*) from project_invites where id = ${invite.id}`
          );
          expect(status).toBe("BOUNCED");
        }
      );
    });

    test(`spam`, async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                      ('bob@example.com', 'Bob')::project_invite_options
                    ])`
          );
          await clearSession(conn);
          await conn.any(
            sql`update invite_emails set status = 'COMPLAINT', token = ${exampleToken}, token_expires_at = to_timestamp(${
              new Date().getTime() + 10000
            })`
          );
          let status = await conn.oneFirst(
            sql`select project_invites_status(project_invites.*) from project_invites where id = ${invite.id}`
          );
          expect(status).toBe("COMPLAINT");
        }
      );
    });

    test("spam - from another project", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
              ('bob@example.com', 'Bob')::project_invite_options
            ])`
          );
          await clearSession(conn);
          await conn.any(
            sql`update invite_emails set created_at = to_timestamp(${
              (new Date().getTime() - 10000) / 1000
            }), token_expires_at = to_timestamp(${
              (new Date().getTime() + 10000) / 1000
            }), token = ${exampleToken}, status = 'COMPLAINT'`
          );
          await createSession(conn, adminId, true, false);
          await conn.any(
            sql`select * from send_project_invites(${sql.array(
              [invite.id],
              "int4"
            )})`
          );
          let status = await conn.oneFirst(
            sql`select project_invites_status(project_invites.*) from project_invites where id = ${invite.id}`
          );
          await clearSession(conn);
          let emails = await conn.many(sql`select * from invite_emails`);
          expect(emails.length).toBe(1);
          expect(status).toBe("COMPLAINT");
          const otherProjectId = await createProject(conn, adminId, "public");
          await createSession(conn, adminId, true, false);
          const otherInvite = await conn.one(
            sql`select * from create_project_invites(${otherProjectId}, true, false, null, array[
              ('bob@example.com', 'Bob')::project_invite_options
            ])`
          );
          status = await conn.oneFirst(
            sql`select project_invites_status(project_invites.*) from project_invites where id = ${otherInvite.id}`
          );
          expect(status).toBe("COMPLAINT");
        }
      );
    });

    test(`expired token`, async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                      ('bob@example.com', 'Bob')::project_invite_options
                    ])`
          );
          await clearSession(conn);
          await conn.any(
            sql`update invite_emails set token_expires_at = to_timestamp(0)`
          );
          let status = await conn.oneFirst(
            sql`select project_invites_status(project_invites.*) from project_invites where id = ${invite.id}`
          );
          expect(status).toBe("TOKEN_EXPIRED");
        }
      );
    });

    test(`error`, async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                      ('bob@example.com', 'Bob')::project_invite_options
                    ])`
          );
          await clearSession(conn);
          await conn.any(
            sql`update invite_emails set status = 'ERROR', token = ${exampleToken}, token_expires_at = to_timestamp(${
              new Date().getTime() + 10000
            })`
          );
          let status = await conn.oneFirst(
            sql`select project_invites_status(project_invites.*) from project_invites where id = ${invite.id}`
          );
          expect(status).toBe("ERROR");
        }
      );
    });

    test(`multiple emails`, async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                      ('bob@example.com', 'Bob')::project_invite_options
                    ])`
          );
          await clearSession(conn);
          await conn.any(
            sql`update invite_emails set created_at = to_timestamp(${
              (new Date().getTime() - 10000) / 1000
            }), token_expires_at = to_timestamp(${
              (new Date().getTime() + 10000) / 1000
            }), token = ${exampleToken}, status = 'DELIVERED'`
          );
          await createSession(conn, adminId, true, false);
          await conn.any(
            sql`select * from send_project_invites(${sql.array(
              [invite.id],
              "int4"
            )})`
          );
          let status = await conn.oneFirst(
            sql`select project_invites_status(project_invites.*) from project_invites where id = ${invite.id}`
          );
          await clearSession(conn);
          let emails = await conn.many(
            sql`select * from invite_emails where project_invite_id = ${invite.id} order by created_at desc`
          );
          expect(emails.length).toBe(2);
          expect(status).toBe("QUEUED");
        }
      );
    });

    test(`multiple emails - expired tokens`, async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                      ('bob@example.com', 'Bob')::project_invite_options
                    ])`
          );
          await clearSession(conn);
          await conn.any(
            sql`update invite_emails set created_at = to_timestamp(${
              (new Date().getTime() - 10000) / 1000
            }), token_expires_at = to_timestamp(0), token = ${exampleToken}, status = 'SENT'`
          );
          await createSession(conn, adminId, true, false);
          await conn.any(
            sql`select * from send_project_invites(${sql.array(
              [invite.id],
              "int4"
            )})`
          );
          let status = await conn.oneFirst(
            sql`select project_invites_status(project_invites.*) from project_invites where id = ${invite.id}`
          );
          await clearSession(conn);
          let emails = await conn.many(
            sql`select * from invite_emails where project_invite_id = ${invite.id} order by created_at desc`
          );
          expect(emails.length).toBe(2);
          expect(status).toBe("QUEUED");
        }
      );
    });
  });

  test("SURVEY_INVITE_QUEUED/SENT", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const groupId = await createGroup(conn, projectId, "Group A");
        const invite = await conn.one(
          sql`select * from create_survey_invites(${surveyId}, true, true, array['Group A'], array[
                          ('bob@example.com', 'Bob')::survey_invite_options
                        ])`
        );
        const projectInvites = await conn.any(
          sql`select * from project_invites where make_admin = true`
        );
        expect(projectInvites.length).toBe(1);
        await createSession(conn, adminId, true, false);
        let status = await conn.oneFirst(
          sql`select project_invites_status(project_invites.*) from project_invites`
        );
        expect(status).toBe("SURVEY_INVITE_QUEUED");
      }
    );
  });

  test(`multiple emails - errors`, async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const invite = await conn.one(
          sql`select * from create_project_invites(${projectId}, true, false, null, array[
                    ('bob@example.com', 'Bob')::project_invite_options
                  ])`
        );
        await clearSession(conn);
        await conn.any(
          sql`update invite_emails set created_at = to_timestamp(${
            (new Date().getTime() - 10000) / 1000
          }), token_expires_at = to_timestamp(0), token = ${exampleToken}, status = 'ERROR', error = 'SES screwed up'`
        );
        await createSession(conn, adminId, true, false);
        await conn.any(
          sql`select * from send_project_invites(${sql.array(
            [invite.id],
            "int4"
          )})`
        );
        let status = await conn.oneFirst(
          sql`select project_invites_status(project_invites.*) from project_invites where id = ${invite.id}`
        );
        await clearSession(conn);
        let emails = await conn.many(
          sql`select * from invite_emails where project_invite_id = ${invite.id} order by created_at desc`
        );
        expect(emails.length).toBe(2);
        expect(status).toBe("QUEUED");
      }
    );
  });

  test(`cannot send more emails if there are outstanding invites for that user`, async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const invite = await conn.one(
          sql`select * from create_project_invites(${projectId}, true, false, null, array[
                      ('bob@example.com', 'Bob')::project_invite_options
                    ])`
        );
        await createSession(conn, adminId, true, false);
        await conn.any(
          sql`select * from send_project_invites(${sql.array(
            [invite.id],
            "int4"
          )})`
        );
        await clearSession(conn);
        let emails = await conn.any(
          sql`select * from invite_emails where project_invite_id = ${invite.id} order by created_at desc`
        );
        expect(emails.length).toBe(1);
      }
    );
  });

  test(`cannot send emails to a user if they have marked seasketch emails as spam (in any project)`, async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const invite = await conn.one(
          sql`select * from create_project_invites(${projectId}, true, false, null, array[
            ('bob@example.com', 'Bob')::project_invite_options
          ])`
        );
        await clearSession(conn);
        await conn.any(
          sql`update invite_emails set created_at = to_timestamp(${
            (new Date().getTime() - 10000) / 1000
          }), token_expires_at = to_timestamp(${
            (new Date().getTime() + 10000) / 1000
          }), token = ${exampleToken}, status = 'COMPLAINT'`
        );
        await createSession(conn, adminId, true, false);
        await conn.any(
          sql`select * from send_project_invites(${sql.array(
            [invite.id],
            "int4"
          )})`
        );
        let status = await conn.oneFirst(
          sql`select project_invites_status(project_invites.*) from project_invites where id = ${invite.id}`
        );
        await clearSession(conn);
        let emails = await conn.many(sql`select * from invite_emails`);
        expect(emails.length).toBe(1);
        expect(status).toBe("COMPLAINT");
        const otherProjectId = await createProject(conn, adminId, "public");
        await createSession(conn, adminId, true, false);
        const otherInvites = await conn.one(
          sql`select * from create_project_invites(${otherProjectId}, true, false, null, array[
            ('bob@example.com', 'Bob')::project_invite_options
          ])`
        );
        await clearSession(conn);
        emails = await conn.many(sql`select * from invite_emails`);
        // still only one, failed-as-spam, email
        expect(emails.length).toBe(1);
      }
    );
  });
});

describe("Accepting Invites", () => {
  describe("verifyProjectInvite(token)", () => {
    test("can be called by anyone and returns token claims", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await rotateKeys(asPg(conn));
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                      ('bob@example.com', 'Bob')::project_invite_options
                    ])`
          );

          await clearSession(conn);
          const inviteEmail = await conn.oneFirst<number>(
            sql`select id from invite_emails where project_invite_id = ${invite.id}`
          );
          await sendProjectInviteEmail(inviteEmail, asPg(conn));
          let token = await conn.oneFirst<string>(
            sql`select token from invite_emails where project_invite_id = ${invite.id}`
          );
          await createSession(conn, undefined, false, false, projectId);
          const claims = await verifyProjectInvite(
            asPg(conn),
            token,
            (process.env.ISSUER || "seasketch.org")
              .split(",")
              .map((issuer) => issuer.trim()) || "seasketch.org"
          );
          expect(claims.wasUsed).toBe(false);
          expect(claims.projectId).toBe(projectId);
          expect(claims.iss).toContain(
            (process.env.ISSUER || "seasketch.org")
              .split(",")
              .map((issuer) => issuer.trim()) || "seasketch.org"
          );
          expect(claims.inviteId).toBeTruthy();
        }
      );
    });

    test("checks token signature", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await rotateKeys(asPg(conn));
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                          ('bob@example.com', 'Bob')::project_invite_options
                        ])`
          );
          await clearSession(conn);
          const inviteEmailId = await conn.oneFirst<number>(
            sql`select id from invite_emails where project_invite_id = ${invite.id}`
          );
          await sendProjectInviteEmail(inviteEmailId, asPg(conn));
          let token = await conn.oneFirst<string>(
            sql`select token from invite_emails where project_invite_id = ${invite.id}`
          );
          await createSession(conn, undefined, false, false, projectId);
          let parts = token.split(".");
          token = [token[0], token[1], token[2].slice(0, -1)].join(".");
          expect(
            verifyProjectInvite(
              asPg(conn),
              token,
              (process.env.ISSUER || "seasketch.org")
                .split(",")
                .map((issuer) => issuer.trim()) || "seasketch.org"
            )
          ).rejects.toThrow(/invalid/i);
        }
      );
    });

    test("returns value of was_used", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await rotateKeys(asPg(conn));
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                          ('bob@example.com', 'Bob')::project_invite_options
                        ])`
          );
          await clearSession(conn);
          const inviteEmailId = await conn.oneFirst<number>(
            sql`select id from invite_emails where project_invite_id = ${invite.id}`
          );
          await sendProjectInviteEmail(inviteEmailId, asPg(conn));
          await conn.any(sql`update project_invites set was_used = true`);
          let token = await conn.oneFirst<string>(
            sql`select token from invite_emails where project_invite_id = ${invite.id}`
          );
          await createSession(conn, undefined, false, false, projectId);
          const claims = await verifyProjectInvite(
            asPg(conn),
            token,
            (process.env.ISSUER || "seasketch.org")
              .split(",")
              .map((issuer) => issuer.trim()) || "seasketch.org"
          );
          expect(claims.wasUsed).toBe(true);
        }
      );
    });
  });

  describe("confirmProjectInvite(projectId, token)", () => {
    test("verifies token through the same process as verifyProjectInvite", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await rotateKeys(asPg(conn));
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                          ('bob@example.com', 'Bob')::project_invite_options
                        ])`
          );
          await clearSession(conn);
          const inviteEmailId = await conn.oneFirst<number>(
            sql`select id from invite_emails where project_invite_id = ${invite.id}`
          );
          await sendProjectInviteEmail(inviteEmailId, asPg(conn));
          let token = await conn.oneFirst<string>(
            sql`select token from invite_emails where project_invite_id = ${invite.id}`
          );
          await createSession(conn, undefined, false, false, projectId);
          let parts = token.split(".");
          token = [token[0], token[1], token[2].slice(0, -1)].join(".");
          expect(
            confirmProjectInvite(
              asPg(conn),
              token,
              (process.env.ISSUER || "seasketch.org")
                .split(",")
                .map((issuer) => issuer.trim()) || "seasketch.org"
            )
          ).rejects.toThrow(/invalid/i);
        }
      );
    });
    test("create project participant record with profile sharing disabled, and sets email_verified=true in auth0", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          // @ts-ignore
          auth0.ManagementClient.prototype.updateUser.mockReset();
          await rotateKeys(asPg(conn));
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                          ('bob@example.com', 'Bob')::project_invite_options
                        ])`
          );
          await clearSession(conn);
          const inviteEmailId = await conn.oneFirst<number>(
            sql`select id from invite_emails where project_invite_id = ${invite.id}`
          );
          await sendProjectInviteEmail(inviteEmailId, asPg(conn));

          let token = await conn.oneFirst<string>(
            sql`select token from invite_emails where project_invite_id = ${invite.id}`
          );
          await createSession(conn, userA, false, false, projectId);
          let parts = token.split(".");
          const claims = await confirmProjectInvite(
            asPg(conn),
            token,
            (process.env.ISSUER || "seasketch.org")
              .split(",")
              .map((issuer) => issuer.trim()) || "seasketch.org"
          );
          expect(claims.admin).toBe(false);
          await clearSession(conn);
          const participant = await conn.one(
            sql`select * from project_participants where user_id = ${userA} and project_id = ${projectId}`
          );
          expect(participant.is_admin).toBe(false);
          expect(participant.share_profile).toBe(false);
          expect(participant.approved).toBe(true);
          expect(
            // @ts-ignore
            auth0.ManagementClient.prototype.updateUser.mock.calls.length
          ).toBe(1);
        }
      );
    });
    test("if project participant record exists, it is updated", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          // @ts-ignore
          auth0.ManagementClient.prototype.updateUser.mockReset();
          await rotateKeys(asPg(conn));
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, true, null, array[
                            ('bob@example.com', 'Bob')::project_invite_options
                          ])`
          );
          const invite2 = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                            ('bob2@example.com', 'Bob Two')::project_invite_options
                          ])`
          );
          await clearSession(conn);
          await conn.any(
            sql`insert into project_participants (project_id, user_id, is_admin, share_profile) values (${projectId}, ${userA}, false, true)`
          );
          const inviteEmailId = await conn.oneFirst<number>(
            sql`select id from invite_emails where project_invite_id = ${invite.id}`
          );
          await sendProjectInviteEmail(inviteEmailId, asPg(conn));
          const inviteEmail2Id = await conn.oneFirst<number>(
            sql`select id from invite_emails where project_invite_id = ${invite2.id}`
          );
          await sendProjectInviteEmail(inviteEmail2Id, asPg(conn));
          let token = await conn.oneFirst<string>(
            sql`select token from invite_emails where project_invite_id = ${invite.id}`
          );
          await createSession(conn, userA, false, false, projectId);
          const claims = await confirmProjectInvite(
            asPg(conn),
            token,
            (process.env.ISSUER || "seasketch.org")
              .split(",")
              .map((issuer) => issuer.trim()) || "seasketch.org"
          );
          await clearSession(conn);
          const participant = await conn.one(
            sql`select * from project_participants where user_id = ${userA} and project_id = ${projectId}`
          );
          expect(participant.is_admin).toBe(true);
          expect(participant.share_profile).toBe(true);
          await clearSession(conn);
          ({ token } = await conn.one(
            sql`select token from invite_emails where project_invite_id = ${invite2.id}`
          ));
          await createSession(conn, adminId, true, false, projectId);
          await confirmProjectInvite(
            asPg(conn),
            token,
            (process.env.ISSUER || "seasketch.org")
              .split(",")
              .map((issuer) => issuer.trim()) || "seasketch.org"
          );
          const participant2 = await conn.one(
            sql`select * from project_participants where user_id = ${adminId} and project_id = ${projectId}`
          );
          expect(participant.is_admin).toBe(true);
        }
      );
    });
    test("sets admin permission if specified", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          // @ts-ignore
          auth0.ManagementClient.prototype.updateUser.mockReset();
          await rotateKeys(asPg(conn));
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, true, null, array[
                          ('bob@example.com', 'Bob')::project_invite_options
                        ])`
          );
          await clearSession(conn);
          const inviteEmailId = await conn.oneFirst<number>(
            sql`select id from invite_emails where project_invite_id = ${invite.id}`
          );
          await sendProjectInviteEmail(inviteEmailId, asPg(conn));
          let token = await conn.oneFirst<string>(
            sql`select token from invite_emails where project_invite_id = ${invite.id}`
          );
          await createSession(conn, userA, false, false, projectId);
          const claims = await confirmProjectInvite(
            asPg(conn),
            token,
            (process.env.ISSUER || "seasketch.org")
              .split(",")
              .map((issuer) => issuer.trim()) || "seasketch.org"
          );
          expect(claims.admin).toBe(true);
          await clearSession(conn);
          const participant = await conn.one(
            sql`select * from project_participants where user_id = ${userA} and project_id = ${projectId}`
          );
          expect(participant.is_admin).toBe(true);
        }
      );
    });
    test(`adds group access`, async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          // @ts-ignore
          auth0.ManagementClient.prototype.updateUser.mockReset();
          const groupA = await createGroup(conn, projectId, "Group A");
          const groupB = await createGroup(conn, projectId, "Group B");
          const groupC = await createGroup(conn, projectId, "GroupC");
          await rotateKeys(asPg(conn));
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, array['Group A', 'Group B'], array[
                          ('bob@example.com', 'Bob')::project_invite_options
                        ])`
          );
          await clearSession(conn);
          const inviteEmailId = await conn.oneFirst<number>(
            sql`select id from invite_emails where project_invite_id = ${invite.id}`
          );
          await sendProjectInviteEmail(inviteEmailId, asPg(conn));
          let token = await conn.oneFirst<string>(
            sql`select token from invite_emails where project_invite_id = ${invite.id}`
          );
          await createSession(conn, userA, false, false, projectId);
          let parts = token.split(".");
          const claims = await confirmProjectInvite(
            asPg(conn),
            token,
            (process.env.ISSUER || "seasketch.org")
              .split(",")
              .map((issuer) => issuer.trim()) || "seasketch.org"
          );
          expect(claims.admin).toBe(false);
          await clearSession(conn);
          const participant = await conn.one(
            sql`select * from project_participants where user_id = ${userA} and project_id = ${projectId}`
          );
          expect(participant.is_admin).toBe(false);
          expect(participant.share_profile).toBe(false);
          expect(participant.approved).toBe(true);
          expect(
            // @ts-ignore
            auth0.ManagementClient.prototype.updateUser.mock.calls.length
          ).toBe(1);
          const groups = await conn.manyFirst(
            sql`select group_id from project_group_members where user_id = ${userA}`
          );
          expect(groups.length).toBe(2);
        }
      );
    });
    test(`sets user_id and was_used on invite`, async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          // @ts-ignore
          auth0.ManagementClient.prototype.updateUser.mockReset();
          await rotateKeys(asPg(conn));
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                          ('bob@example.com', 'Bob')::project_invite_options
                        ])`
          );
          await clearSession(conn);
          const inviteEmailId = await conn.oneFirst<number>(
            sql`select id from invite_emails where project_invite_id = ${invite.id}`
          );
          await sendProjectInviteEmail(inviteEmailId, asPg(conn));
          let token = await conn.oneFirst<string>(
            sql`select token from invite_emails where project_invite_id = ${invite.id}`
          );
          await createSession(conn, userA, false, false, projectId);
          const claims = await confirmProjectInvite(
            asPg(conn),
            token,
            (process.env.ISSUER || "seasketch.org")
              .split(",")
              .map((issuer) => issuer.trim()) || "seasketch.org"
          );
          await clearSession(conn);
          const participant = await conn.one(
            sql`select * from project_participants where user_id = ${userA} and project_id = ${projectId}`
          );
          expect(participant.user_id).toBe(userA);
          const wasUsed = await conn.oneFirst(
            sql`select was_used from project_invites where id = ${invite.id}`
          );
          expect(wasUsed).toBe(true);
        }
      );
    });
    test(`confirm_project_invite_with_verified_email(projectId) can be used to confirm invites without a token`, async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          // @ts-ignore
          auth0.ManagementClient.prototype.updateUser.mockReset();
          await rotateKeys(asPg(conn));
          await conn.any(
            sql`select set_config('session.canonical_email', 'bob@example.com', true)`
          );
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                            ('bob@example.com', 'Bob')::project_invite_options
                          ])`
          );
          await clearSession(conn);
          const inviteEmailId = await conn.oneFirst<number>(
            sql`select id from invite_emails where project_invite_id = ${invite.id}`
          );
          await sendProjectInviteEmail(inviteEmailId, asPg(conn));
          await createSession(conn, userA, true, false, projectId);
          await conn.any(
            sql`select set_config('session.canonical_email', 'bob@example.com', true)`
          );
          const uid = await conn.oneFirst(
            sql`select * from confirm_project_invite_with_verified_email(${projectId})`
          );
          expect(uid).toBeTruthy();
          await clearSession(conn);
          const participant = await conn.one(
            sql`select * from project_participants where user_id = ${userA} and project_id = ${projectId}`
          );
          expect(participant.user_id).toBe(userA);
          const wasUsed = await conn.oneFirst(
            sql`select was_used from project_invites where id = ${invite.id}`
          );
          expect(wasUsed).toBe(true);
        }
      );
    });
    test(`confirm_project_invite_with_verified_email must be called with a verified email`, async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          // @ts-ignore
          auth0.ManagementClient.prototype.updateUser.mockReset();
          await rotateKeys(asPg(conn));
          await conn.any(
            sql`select set_config('session.canonical_email', 'bob@example.com', true)`
          );
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                              ('bob@example.com', 'Bob')::project_invite_options
                            ])`
          );
          await clearSession(conn);
          const inviteEmailId = await conn.oneFirst<number>(
            sql`select id from invite_emails where project_invite_id = ${invite.id}`
          );
          await sendProjectInviteEmail(inviteEmailId, asPg(conn));
          await createSession(conn, userA, false, false, projectId);
          expect(
            conn.oneFirst(
              sql`select * from confirm_project_invite_with_verified_email(${projectId})`
            )
          ).rejects.toThrow(/verified/i);
        }
      );
    });
    test(`confirm_project_invite_with_verified_email can only be called for an invite with matching email *that has been sent*`, async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          // @ts-ignore
          auth0.ManagementClient.prototype.updateUser.mockReset();
          await rotateKeys(asPg(conn));
          await conn.any(
            sql`select set_config('session.canonical_email', 'bob@example.com', true)`
          );
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, false, false, null, array[
                              ('bob@example.com', 'Bob')::project_invite_options
                            ])`
          );
          await createSession(conn, userA, true, false, projectId);
          expect(
            conn.oneFirst(
              sql`select * from confirm_project_invite_with_verified_email(${projectId})`
            )
          ).rejects.toThrow(/matching/i);
        }
      );
    });
    test("confirm_project_invite_with_survey_token can be called if `x-ss-survey-invite-token` is set", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false);
          const surveyId = await conn.oneFirst(
            sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
          );
          const groupId = await createGroup(conn, projectId, "Group A");
          const invite = await conn.one(
            sql`select * from create_survey_invites(${surveyId}, true, true, array['Group A'], array[
                                ('bob@example.com', 'Bob')::survey_invite_options
                              ])`
          );
          await createSession(conn, userA, true, false, projectId);
          await conn.any(
            sql`select set_config('session.survey_invite_email', 'bob@example.com', true)`
          );
          const uid = await conn.oneFirst(
            sql`select * from confirm_project_invite_with_survey_token(${projectId})`
          );
          expect(uid).toBeTruthy();
          await clearSession(conn);
          const participant = await conn.one(
            sql`select * from project_participants where user_id = ${userA} and project_id = ${projectId}`
          );
          expect(participant.user_id).toBe(userA);
        }
      );
    });
    test(`single invite can only be used once`, async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          // @ts-ignore
          auth0.ManagementClient.prototype.updateUser.mockReset();
          await rotateKeys(asPg(conn));
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                          ('bob@example.com', 'Bob')::project_invite_options
                        ])`
          );
          await clearSession(conn);
          const inviteEmailId = await conn.oneFirst<number>(
            sql`select id from invite_emails where project_invite_id = ${invite.id}`
          );
          await sendProjectInviteEmail(inviteEmailId, asPg(conn));
          let token = await conn.oneFirst<string>(
            sql`select token from invite_emails where project_invite_id = ${invite.id}`
          );
          await createSession(conn, userA, false, false, projectId);
          const claims = await confirmProjectInvite(
            asPg(conn),
            token,
            (process.env.ISSUER || "seasketch.org")
              .split(",")
              .map((issuer) => issuer.trim()) || "seasketch.org"
          );
          expect(claims.admin).toBe(false);
          await createSession(conn, userB, false, false, projectId);
          expect(
            confirmProjectInvite(
              asPg(conn),
              token,
              (process.env.ISSUER || "seasketch.org")
                .split(",")
                .map((issuer) => issuer.trim()) || "seasketch.org"
            )
          ).rejects.toThrow();
        }
      );
    });
  });

  describe("Ingress without email - projects_invite(*.projects)", () => {
    test("indicates confirmation state, admin status", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          // @ts-ignore
          auth0.ManagementClient.prototype.updateUser.mockReset();
          await rotateKeys(asPg(conn));
          await conn.any(
            sql`select set_config('session.canonical_email', 'bob@example.com', true)`
          );
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                            ('bob@example.com', 'Bob')::project_invite_options
                          ])`
          );
          await clearSession(conn);
          const inviteEmailId = await conn.oneFirst<number>(
            sql`select id from invite_emails where project_invite_id = ${invite.id}`
          );
          await sendProjectInviteEmail(inviteEmailId, asPg(conn));
          await createSession(conn, userA, true, false, projectId);
          await conn.any(
            sql`select set_config('session.canonical_email', 'bob@example.com', true)`
          );
          const details = await conn.oneFirst(
            sql`select projects_invite(projects.*) from projects where id = ${projectId}`
          );
          expect(details).toMatch(/Bob/);
          expect(details).toMatch(/bob@example.com/);
        }
      );
    });
    test("is only set if invite has been sent", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          // @ts-ignore
          auth0.ManagementClient.prototype.updateUser.mockReset();
          await rotateKeys(asPg(conn));
          await conn.any(
            sql`select set_config('session.canonical_email', 'bob@example.com', true)`
          );
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, false, false, null, array[
                            ('bob@example.com', 'Bob')::project_invite_options
                          ])`
          );
          const details = await conn.oneFirst(
            sql`select projects_invite(projects.*) from projects where id = ${projectId}`
          );
          expect(details).toBeNull();
        }
      );
    });
    test("or is set if the user is bearing a survey invite", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false);
          const surveyId = await conn.oneFirst(
            sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
          );
          const groupId = await createGroup(conn, projectId, "Group A");
          const invite = await conn.one(
            sql`select * from create_survey_invites(${surveyId}, true, true, array['Group A'], array[
                                ('bob@example.com', 'Bob')::survey_invite_options
                              ])`
          );
          await createSession(conn, userA, true, false, projectId);
          await conn.any(
            sql`select set_config('session.survey_invite_email', 'bob@example.com', true)`
          );
          const details = await conn.oneFirst(
            sql`select projects_invite(projects.*) from projects where id = ${projectId}`
          );
          expect(details).toMatch(/Bob/);
          expect(details).toMatch(/bob@example.com/);
        }
      );
    });
    test("returns null if anonymous", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          // @ts-ignore
          auth0.ManagementClient.prototype.updateUser.mockReset();
          await rotateKeys(asPg(conn));
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                            ('bob@example.com', 'Bob')::project_invite_options
                          ])`
          );
          await clearSession(conn);
          const inviteEmailId = await conn.oneFirst<number>(
            sql`select id from invite_emails where project_invite_id = ${invite.id}`
          );
          await sendProjectInviteEmail(inviteEmailId, asPg(conn));
          await createSession(conn);
          const details = await conn.oneFirst(
            sql`select projects_invite(projects.*) from projects where id = ${projectId}`
          );
          expect(details).toBeNull();
        }
      );
    });
  });
});
describe("db.projectInvites.sendQueuedProjectInvites(limit)", () => {
  test("Updates token, token_expires_at, message_id, and status. Sends to appropriate recipient", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await rotateKeys(asPg(conn));
        await createSession(conn, adminId, true, false);
        const invite = await conn.one(
          sql`select * from create_project_invites(${projectId}, true, false, null, array[
                        ('bob@example.com', 'Bob')::project_invite_options
                      ])`
        );
        await clearSession(conn);
        const inviteEmailId = await conn.oneFirst<number>(
          sql`select id from invite_emails where project_invite_id = ${invite.id}`
        );
        await sendProjectInviteEmail(inviteEmailId, asPg(conn));
        let { status, token, token_expires_at, message_id } = await conn.one<{
          token: string;
          status: string;
          token_expires_at: number;
          message_id: number;
        }>(
          sql`select status, token, token_expires_at, message_id from invite_emails where project_invite_id = ${invite.id}`
        );
        expect(status).toBe("SENT");
        expect(token.length).toBeGreaterThan(1);
        expect(token_expires_at * 1000).toBeGreaterThan(new Date().getTime());
        expect(message_id).toMatch(/test-email-id-\d+/);
      }
    );
  });
  test("Not accessible to any graphile users (even admins)", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const invite = await conn.one(
          sql`select * from create_project_invites(${projectId}, true, false, null, array[
                          ('bob@example.com', 'Bob')::project_invite_options
                        ])`
        );
        const messageId = "123abc";
        const inviteEmailId = await conn.oneFirst<number>(
          sql`select id from invite_emails where project_invite_id = ${invite.id}`
        );
        expect(
          sendProjectInviteEmail(inviteEmailId, asPg(conn))
        ).rejects.toThrow(/permission/);
      }
    );
  });
  describe("Invite tokens", () => {
    test("invite tokens identify fullname, email, and project id", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await rotateKeys(asPg(conn));
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                          ('bob@example.com', 'Bob')::project_invite_options
                        ])`
          );
          await clearSession(conn);
          const inviteEmailId = await conn.oneFirst<number>(
            sql`select id from invite_emails where project_invite_id = ${invite.id}`
          );
          await sendProjectInviteEmail(inviteEmailId, asPg(conn));
          let { status, token, token_expires_at, message_id } = await conn.one(
            sql`select status, token, token_expires_at, message_id from invite_emails where project_invite_id = ${invite.id}`
          );
          const claims = await verify(
            asPg(conn),
            token as string,
            (process.env.ISSUER || "seasketch.org")
              .split(",")
              .map((issuer) => issuer.trim()) || "seasketch.org"
          );
          expect(claims.fullname).toBe("Bob");
          expect(claims.email).toBe("bob@example.com");
          expect(claims.admin).toBe(false);
          expect(claims.projectId).toBe(projectId);
        }
      );
    });
    test("project invite email tokens are only good for 90 days", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await rotateKeys(asPg(conn));
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, false, null, array[
                          ('bob@example.com', 'Bob')::project_invite_options
                        ])`
          );
          await clearSession(conn);
          const inviteEmailId = await conn.oneFirst<number>(
            sql`select id from invite_emails where project_invite_id = ${invite.id}`
          );
          await sendProjectInviteEmail(inviteEmailId, asPg(conn));
          let { status, token, token_expires_at, message_id } = await conn.one(
            sql`select status, token, token_expires_at, message_id from invite_emails where project_invite_id = ${invite.id}`
          );
          const claims = await verify(
            asPg(conn),
            token as string,
            (process.env.ISSUER || "seasketch.org")
              .split(",")
              .map((issuer) => issuer.trim()) || "seasketch.org"
          );
          expect(claims.exp * 1000).toBeGreaterThan(
            new Date().getTime() + ms("89 days")
          );
          expect(claims.exp * 1000).toBeLessThan(
            new Date().getTime() + ms("91 days")
          );
        }
      );
    });
    test("admin project invite email tokens are only good for 30 days", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await rotateKeys(asPg(conn));
          await createSession(conn, adminId, true, false);
          const invite = await conn.one(
            sql`select * from create_project_invites(${projectId}, true, true, null, array[
                          ('bob@example.com', 'Bob')::project_invite_options
                        ])`
          );
          await clearSession(conn);
          const inviteEmailId = await conn.oneFirst<number>(
            sql`select id from invite_emails where project_invite_id = ${invite.id}`
          );
          await sendProjectInviteEmail(inviteEmailId, asPg(conn));
          let { status, token, token_expires_at, message_id } = await conn.one(
            sql`select status, token, token_expires_at, message_id from invite_emails where project_invite_id = ${invite.id}`
          );
          const claims = await verify(
            asPg(conn),
            token as string,
            (process.env.ISSUER || "seasketch.org")
              .split(",")
              .map((issuer) => issuer.trim()) || "seasketch.org"
          );
          expect(claims.admin).toBe(true);
          expect(claims.exp * 1000).toBeGreaterThan(
            new Date().getTime() + ms("29 days")
          );
          expect(claims.exp * 1000).toBeLessThan(
            new Date().getTime() + ms("31 days")
          );
        }
      );
    });
  });
});
test("db.inviteEmails.updateStatus", async () => {
  await projectTransaction(
    pool,
    "public",
    async (conn, projectId, adminId, [userA, userB]) => {
      await createSession(conn, adminId, true, false);
      const invite = await conn.one(
        sql`select * from create_project_invites(${projectId}, true, false, null, array[
                      ('bob@example.com', 'Bob')::project_invite_options
                    ])`
      );
      await clearSession(conn);
      await conn.any(
        sql`update invite_emails set status = 'SENT', token = ${exampleToken}, token_expires_at = to_timestamp(${
          new Date().getTime() + 10000
        }), message_id = '123'`
      );
      let status = await conn.oneFirst(
        sql`select project_invites_status(project_invites.*) from project_invites where id = ${invite.id}`
      );
      expect(status).toBe("SENT");
      const count = await updateStatus(asPg(conn), "123", "Bounce");
      expect(count).toBe(1);
      status = await conn.oneFirst(
        sql`select project_invites_status(project_invites.*) from project_invites where id = ${invite.id}`
      );
      expect(status).toBe("BOUNCED");
    }
  );
});
test("Admins can access a invite_counts() property on projects", async () => {
  await projectTransaction(
    pool,
    "public",
    async (conn, projectId, adminId, [userA, userB]) => {
      await createSession(conn, adminId, true, false);
      const invite = await conn.one(
        sql`select * from create_project_invites(${projectId}, true, false, null, array[
                      ('bob@example.com', 'Bob')::project_invite_options
                    ])`
      );
      await clearSession(conn);
      await conn.any(
        sql`update invite_emails set status = 'SENT', token = ${exampleToken}, token_expires_at = to_timestamp(${
          new Date().getTime() + 10000
        }), message_id = '123'`
      );
      await createSession(conn, adminId, true, false, projectId);
      let counts = await conn.oneFirst(
        sql`select projects_invite_counts(projects.*) from projects where id = ${projectId} limit 1`
      );
      expect(counts).toMatch(/SENT/);
    }
  );
});
test("invite_counts() returns nothing to non-admins", async () => {
  await projectTransaction(
    pool,
    "public",
    async (conn, projectId, adminId, [userA, userB]) => {
      await createSession(conn, adminId, true, false);
      const invite = await conn.one(
        sql`select * from create_project_invites(${projectId}, true, false, null, array[
                      ('bob@example.com', 'Bob')::project_invite_options
                    ])`
      );
      await clearSession(conn);
      await conn.any(
        sql`update invite_emails set status = 'SENT', token = ${exampleToken}, token_expires_at = to_timestamp(${
          new Date().getTime() + 10000
        }), message_id = '123'`
      );
      await createSession(conn, userA, true, false, projectId);
      let counts = await conn.any(
        sql`select projects_invite_counts(projects.*) from projects where id = ${projectId} limit 1`
      );
      expect(counts.length).toBe(0);
    }
  );
});
test("project_invite_groups crud operations limited to admins", async () => {
  let groupId: number;
  let invite: { id: number };
  await verifyCRUDOpsLimitedToAdmins(pool, {
    create: async (conn, projectId, adminId) => {
      await createSession(conn, adminId, true, false);
      groupId = await createGroup(conn, projectId);
      invite = await conn.one(
        sql`select * from create_project_invites(${projectId}, true, false, null, array[
                          ('bob@example.com', 'Bob')::project_invite_options
                        ])`
      );
      return sql`insert into project_invite_groups (group_id, invite_id) values (${groupId}, ${invite.id}) returning *`;
    },
    update: false,
    delete: () => {
      return sql`delete from project_invite_groups where group_id = ${groupId} and invite_id = ${invite.id} returning *`;
    },
  });
});
test("Mailer updates email status if user is UNSUBSCRIBED", async () => {
  await projectTransaction(
    pool,
    "public",
    async (conn, projectId, adminId, [userA, userB]) => {
      await rotateKeys(asPg(conn));
      const userId = await createUser(conn);
      const canonicalEmail = await conn.oneFirst(
        sql`select canonical_email from users where id = ${userId}`
      );
      const sub = await conn.oneFirst(
        sql`select sub from users where id = ${userId}`
      );
      await conn.any(
        sql`update email_notification_preferences set unsubscribe_all = true where user_id = ${userId}`
      );
      await createSession(conn, adminId, true, false);
      const invite = await conn.one(
        sql`select * from create_project_invites(${projectId}, true, true, null, array[
                      (${canonicalEmail}, 'Bob')::project_invite_options
                    ])`
      );
      await clearSession(conn);
      const inviteEmailId = await conn.oneFirst<number>(
        sql`select id from invite_emails where project_invite_id = ${invite.id}`
      );
      await sendProjectInviteEmail(inviteEmailId, asPg(conn));
      let { status } = await conn.one(
        sql`select status from invite_emails where project_invite_id = ${invite.id}`
      );
      expect(status).toBe("UNSUBSCRIBED");
      status = await conn.oneFirst(
        sql`select project_invites_status(project_invites.*) from project_invites where id = ${invite.id}`
      );
      expect(status).toBe("UNSUBSCRIBED");
    }
  );
});
