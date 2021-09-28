import { sql, DatabaseTransactionConnectionType } from "slonik";
import { createPool } from "./pool";
import {
  createProject,
  createSession,
  clearSession,
  createGroup,
  projectTransaction,
  addUserToGroup,
  removeUserFromGroup,
  createAndSendSurveyInvite,
  verifySessionCanAccessSurveyResources,
  asPg,
  createBody,
  getBodyStr,
} from "./helpers";
import MockSES from "aws-sdk/clients/ses";
import {
  sendQueuedSurveyInvites,
  sendSurveyInviteReminder,
  verifySurveyInvite,
} from "../src/invites/surveyInvites";
import auth0 from "auth0";
import { rotateKeys, verify } from "../src/auth/jwks";
import ms from "ms";
import MockDate from "mockdate";

const exampleToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

jest.mock("auth0");
// @ts-ignore
auth0.ManagementClient.prototype.updateUser = jest.fn(() => {});
// @ts-ignore
auth0.ManagementClient.prototype.getUsers = jest.fn((val) => {
  const subs = val?.q?.match(/"[^"]+"/g)?.map((v) => v.replace(/"/g, ""));
  if (subs && subs.length) {
    return subs.map((sub) => {
      return {
        user_id: sub,
        email: `${sub.replace(/[^\w]/g, "")}@example.com`,
      };
    });
  } else {
    return [];
  }
});

jest.mock("aws-sdk/clients/ses", () => {
  const mSES = {
    sendBulkTemplatedEmail: jest.fn().mockReturnThis(),
    promise: jest.fn(),
  };
  return jest.fn(() => mSES);
});

const pool = createPool("test");

const FormElementType = "TestTextFieldSurveyInvites";

beforeAll(async () => {
  await rotateKeys(asPg(pool));
  await pool.oneFirst(
    sql`insert into form_element_types (component_name, label) values (${FormElementType}, 'Test Text Input Survey Invites') returning component_name`
  );
});

describe("Schema", () => {
  test("Invite must have either an email address or user_id specified", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        // await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        expect(
          await conn.oneFirst(
            sql`insert into survey_invites (survey_id, email) values (${surveyId}, 'joe@example.com') returning id`
          )
        ).toBeTruthy();
        expect(
          conn.oneFirst(
            sql`insert into survey_invites (survey_id) values (${surveyId}) returning id`
          )
        ).rejects.toThrow(/user_id/i);
      }
    );
  });
  test("Invites created from groups (user_id specified) should not have an email or fullname set", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        // await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        expect(
          conn.oneFirst(
            sql`insert into survey_invites (survey_id, email, user_id) values (${surveyId}, 'joe@example.com', ${adminId}) returning id`
          )
        ).rejects.toThrow(/email/i);
      }
    );
  });
  test("Survey invites created with an email set can be updated to include the user_id of the eventual confirmed user", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        // await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const inviteId = await conn.oneFirst(
          sql`insert into survey_invites (survey_id, email) values (${surveyId}, 'joe@example.com') returning id`
        );
        expect(inviteId).toBeTruthy();
        expect(
          await conn.oneFirst(
            sql`update survey_invites set user_id = ${adminId} where id = ${inviteId} returning  user_id`
          )
        ).toBe(adminId);
      }
    );
  });
  test("was_added_from_group must be true if email is blank", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        // await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        expect(
          conn.oneFirst(
            sql`insert into survey_invites (survey_id, user_id, was_added_from_group) values (${surveyId}, ${adminId}, false) returning id`
          )
        ).rejects.toThrow(/was_added_from_group/i);
      }
    );
  });
});

describe("Management operations", () => {
  test("admins create survey invites with createSurveyInvites()", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const invites = await conn.many(
          sql`select * from create_survey_invites(${surveyId}, false, null, null, array[
                      ('bob@example.com', 'Bob')::survey_invite_options,
                      ('ed@example.com', 'Ed')::survey_invite_options
                    ])`
        );
        expect(invites.length).toBe(2);
        expect(invites[0].survey_id).toBe(surveyId);
        expect(invites[0].fullname).toBe("Bob");
      }
    );
  });

  test("duplicate emails are ignored where running createSurveyInvites", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const invites = await conn.many(
          sql`select * from create_survey_invites(${surveyId}, false, null, null, array[
                      ('bob@example.com', 'Bob')::survey_invite_options,
                      ('ed@example.com', 'Ed')::survey_invite_options
                    ])`
        );
        expect(invites.length).toBe(2);
        await conn.any(
          sql`select * from create_survey_invites(${surveyId}, false, null, null, array[
                      ('bob@example.com', 'Bob')::survey_invite_options
                    ])`
        );
        expect(
          await conn.oneFirst(
            sql`select count(*) from survey_invites where survey_id = ${surveyId}`
          )
        ).toBe(2);
      }
    );
  });
  test("survey invites can't be inserted directly", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        expect(
          conn.oneFirst(
            sql`insert into survey_invites (survey_id, email, user_id) values (${surveyId}, 'joe@example.com', ${adminId}) returning id`
          )
        ).rejects.toThrow(/permission/i);
      }
    );
  });
  test("admins can update only fullname on invites (Can't update email or was_added_from_group)", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const invites = await conn.any(
          sql`select * from create_survey_invites(${surveyId}, false, null, null, array[
                        ('bob@example.com', 'Bob')::survey_invite_options
                      ])`
        );
        expect(invites.length).toBe(1);
        await conn.one(
          sql`update survey_invites set fullname = 'FooBob' where id = ${invites[0].id} returning fullname`
        );
        expect(
          conn.one(
            sql`update survey_invites set email = 'foo@example.com' where id = ${invites[0].id} returning email`
          )
        ).rejects.toThrow(/permission/i);
      }
    );
  });
  test("admins can delete invites", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const invite = await conn.one(
          sql`select * from create_survey_invites(${surveyId}, false, null, null, array[
                        ('bob@example.com', 'Bob')::survey_invite_options
                      ])`
        );
        const deletedId = await conn.oneFirst(
          sql`delete from survey_invites where id = ${invite.id} returning id`
        );
        expect(deletedId).toBe(invite.id);
      }
    );
  });
  test("CRUD operations limited to admins", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const invite = await conn.one(
          sql`select * from create_survey_invites(${surveyId}, false, null, null, array[
                        ('bob@example.com', 'Bob')::survey_invite_options
                      ])`
        );
        const deletedId = await conn.oneFirst(
          sql`delete from survey_invites where id = ${invite.id} returning id`
        );
        expect(deletedId).toBe(invite.id);
      }
    );
  });

  test("createSurveyInvites() called with includeProjectInvite option creates a project invite, including group and makeAdmin options", async () => {
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
      }
    );
  });
});

describe("Invited Groups", () => {
  test("update_survey_invited_groups(groupIds) can be used to add associated groups, and surveys_invited_groups(surveys.*) can be used to retrieve them", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const groupA = await createGroup(conn, projectId, "Group A");
        await conn.any(
          sql`select update_survey_invited_groups(${surveyId}, array[${groupA}::int])`
        );
        const groupB = await createGroup(conn, projectId, "Group B");
        const groupC = await createGroup(conn, projectId, "Group C");
        await conn.any(
          sql`select update_survey_invited_groups(${surveyId}, array[${groupC}::int, ${groupB}::int])`
        );
        const groups = await conn.any(
          sql`select surveys_invited_groups(surveys.*) from surveys where id = ${surveyId}`
        );
        expect(groups.length).toBe(2);
      }
    );
  });
  test(`update_survey_invited_groups(groupIds) adds new invites for users in added groups`, async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const groupA = await createGroup(conn, projectId, "Group A");
        await addUserToGroup(conn, userA, groupA);
        const groupB = await createGroup(conn, projectId, "Group B");
        await addUserToGroup(conn, userB, groupB);
        await conn.any(
          sql`select update_survey_invited_groups(${surveyId}, array[${groupA}::int, ${groupB}::int])`
        );
        const groups = await conn.any(
          sql`select surveys_invited_groups(surveys.*) from surveys where id = ${surveyId}`
        );
        expect(groups.length).toBe(2);
        const invites = await conn.many(
          sql`select * from survey_invites where survey_id = ${surveyId}`
        );
        expect(invites.length).toBe(2);
        expect(invites[0].was_added_from_group).toBe(true);
      }
    );
  });
  test("update_survey_invited_groups(groupIds) removes invites related only to a group when that group drops out of the list", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const groupA = await createGroup(conn, projectId, "Group A");
        await addUserToGroup(conn, userA, groupA);
        const groupB = await createGroup(conn, projectId, "Group B");
        await addUserToGroup(conn, userB, groupB);
        await conn.any(
          sql`select update_survey_invited_groups(${surveyId}, array[${groupA}::int, ${groupB}::int])`
        );
        const groups = await conn.any(
          sql`select surveys_invited_groups(surveys.*) from surveys where id = ${surveyId}`
        );
        expect(groups.length).toBe(2);
        const invites = await conn.many(
          sql`select * from survey_invites where survey_id = ${surveyId}`
        );
        expect(invites.length).toBe(2);
        expect(invites[0].was_added_from_group).toBe(true);
        await conn.any(
          sql`select update_survey_invited_groups(${surveyId}, array[${groupA}::int])`
        );
        const invite = await conn.one(
          sql`select * from survey_invites where survey_id = ${surveyId}`
        );
        expect(invite.user_id).toBe(userA);
      }
    );
  });
  test("adding users to an invited group adds an invite to survey_invited_groups via trigger", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const groupA = await createGroup(conn, projectId, "Group A");
        await addUserToGroup(conn, userA, groupA);
        const groupB = await createGroup(conn, projectId, "Group B");
        await conn.any(
          sql`select update_survey_invited_groups(${surveyId}, array[${groupA}::int, ${groupB}::int])`
        );
        const groups = await conn.any(
          sql`select surveys_invited_groups(surveys.*) from surveys where id = ${surveyId}`
        );
        expect(groups.length).toBe(2);
        let invites = await conn.any(
          sql`select * from survey_invites where survey_id = ${surveyId}`
        );
        expect(invites.length).toBe(1);
        await addUserToGroup(conn, userB, groupB);
        invites = await conn.any(
          sql`select * from survey_invites where survey_id = ${surveyId}`
        );
        expect(invites.length).toBe(2);
      }
    );
  });

  test("Auto-generated survey_invites for users should have a blank fullname and email", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const groupA = await createGroup(conn, projectId, "Group A");
        await addUserToGroup(conn, userA, groupA);
        const groupB = await createGroup(conn, projectId, "Group B");
        await addUserToGroup(conn, userB, groupB);
        await conn.any(
          sql`select update_survey_invited_groups(${surveyId}, array[${groupA}::int, ${groupB}::int])`
        );
        const groups = await conn.any(
          sql`select surveys_invited_groups(surveys.*) from surveys where id = ${surveyId}`
        );
        expect(groups.length).toBe(2);
        const invites = await conn.many(
          sql`select * from survey_invites where survey_id = ${surveyId}`
        );
        expect(invites.length).toBe(2);
        expect(invites[0].fullname).toBe(null);
        expect(invites[0].email).toBe(null);
      }
    );
  });
  test("removing users from an invited group removes their invite via trigger", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const groupA = await createGroup(conn, projectId, "Group A");
        await addUserToGroup(conn, userA, groupA);
        const groupB = await createGroup(conn, projectId, "Group B");
        await conn.any(
          sql`select update_survey_invited_groups(${surveyId}, array[${groupA}::int, ${groupB}::int])`
        );
        const groups = await conn.any(
          sql`select surveys_invited_groups(surveys.*) from surveys where id = ${surveyId}`
        );
        expect(groups.length).toBe(2);
        let invites = await conn.any(
          sql`select * from survey_invites where survey_id = ${surveyId}`
        );
        expect(invites.length).toBe(1);
        await addUserToGroup(conn, userB, groupB);
        invites = await conn.any(
          sql`select * from survey_invites where survey_id = ${surveyId}`
        );
        expect(invites.length).toBe(2);
        await removeUserFromGroup(conn, userA, groupA);
        invites = await conn.any(
          sql`select * from survey_invites where survey_id = ${surveyId}`
        );
        expect(invites.length).toBe(1);
        expect(invites[0].user_id).toBe(userB);
      }
    );
  });

  test("removing users from an invited group doesn't clear their invite if they are in another acceptable group", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const groupA = await createGroup(conn, projectId, "Group A");
        await addUserToGroup(conn, userA, groupA);
        const groupB = await createGroup(conn, projectId, "Group B");
        const groupC = await createGroup(conn, projectId, "Group C");
        await addUserToGroup(conn, userA, groupC);
        await conn.any(
          sql`select update_survey_invited_groups(${surveyId}, array[${groupA}::int, ${groupB}::int, ${groupC}])`
        );
        let invites = await conn.any(
          sql`select * from survey_invites where survey_id = ${surveyId}`
        );
        expect(invites.length).toBe(1);
        await addUserToGroup(conn, userB, groupB);
        invites = await conn.any(
          sql`select * from survey_invites where survey_id = ${surveyId}`
        );
        expect(invites.length).toBe(2);
        await removeUserFromGroup(conn, userA, groupA);
        invites = await conn.any(
          sql`select * from survey_invites where survey_id = ${surveyId}`
        );
        expect(invites.length).toBe(2);
      }
    );
  });
});

describe("db.surveyInvites.sendQueuedSurveyInvites(limit)", () => {
  test("Creates invite_email with to_address, token, token_expires_at, updated_at, message_id, and status", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const formId = await conn.oneFirst(
          sql`select id from initialize_blank_survey_form(${surveyId})`
        );
        await conn.any(
          sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
        );

        const invites = await conn.many(
          sql`select * from create_survey_invites(${surveyId}, false, null, null, array[
                        ('bob@example.com', 'Bob')::survey_invite_options,
                        ('ed@example.com', 'Ed')::survey_invite_options
                      ])`
        );
        expect(invites.length).toBe(2);
        const mock = new MockSES();
        mock
          .sendBulkTemplatedEmail()
          // @ts-ignore
          .promise.mockImplementationOnce(() => {
            return {
              Status: [
                {
                  Status: "Success",
                  MessageId: "123abc",
                },
                {
                  Status: "Success",
                  MessageId: "456def",
                },
              ],
            };
          });
        await clearSession(conn);
        await sendQueuedSurveyInvites(asPg(conn));
        const emails = await conn.many(
          sql`select status, token, token_expires_at, message_id, to_address from invite_emails where survey_invite_id = any(${sql.array(
            invites.map((i) => i.id),
            "int4"
          )})`
        );
        expect(emails.length).toBe(2);
        expect(emails[0].status).toBe("SENT");
        expect((emails[0].token as string).length).toBeGreaterThan(0);
        expect(emails[0].token_expires_at).toBeTruthy();
        expect(emails[0].to_address).toBeTruthy();
      }
    );
  });
  test("Retrieves emails from auth0 if necessary", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const formId = await conn.oneFirst(
          sql`select id from initialize_blank_survey_form(${surveyId})`
        );
        await conn.any(
          sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
        );
        let invites = await conn.many(
          sql`select * from create_survey_invites(${surveyId}, false, null, null, array[
                        ('bob@example.com', 'Bob')::survey_invite_options,
                        ('ed@example.com', 'Ed')::survey_invite_options
                      ])`
        );
        const groupA = await createGroup(conn, projectId, "Group A");
        await addUserToGroup(conn, userA, groupA);
        const groupB = await createGroup(conn, projectId, "Group B");
        await addUserToGroup(conn, userB, groupB);
        await conn.any(
          sql`select update_survey_invited_groups(${surveyId}, array[${groupA}::int, ${groupB}::int])`
        );
        invites = await conn.any(
          sql`select * from survey_invites where survey_id = ${surveyId}`
        );
        expect(invites.length).toBe(4);
        const mock = new MockSES();
        mock
          .sendBulkTemplatedEmail()
          // @ts-ignore
          .promise.mockImplementationOnce(() => {
            return {
              Status: [
                {
                  Status: "Success",
                  MessageId: "123abc",
                },
                {
                  Status: "Success",
                  MessageId: "456def",
                },
                {
                  Status: "Success",
                  MessageId: "789abc",
                },
                {
                  Status: "Success",
                  MessageId: "101112def",
                },
              ],
            };
          });
        await clearSession(conn);
        await sendQueuedSurveyInvites(asPg(conn));
        const emails = await conn.many(
          sql`select status, token, token_expires_at, message_id, to_address from invite_emails where survey_invite_id = any(${sql.array(
            invites.map((i) => i.id),
            "int4"
          )})`
        );
        expect(emails.length).toBe(4);
        expect(emails[0].status).toBe("SENT");
        expect((emails[0].token as string).length).toBeGreaterThan(0);
        expect(emails[0].token_expires_at).toBeTruthy();
        expect(emails[0].to_address).toBeTruthy();
      }
    );
  });
  test("Checks email notification preferences", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const formId = await conn.oneFirst(
          sql`select id from initialize_blank_survey_form(${surveyId})`
        );
        await conn.any(
          sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
        );

        const groupA = await createGroup(conn, projectId, "Group A");
        await addUserToGroup(conn, userA, groupA);
        const groupB = await createGroup(conn, projectId, "Group B");
        await addUserToGroup(conn, userB, groupB);
        await conn.any(
          sql`select update_survey_invited_groups(${surveyId}, array[${groupA}::int, ${groupB}::int])`
        );
        const invites = await conn.any(
          sql`select * from survey_invites where survey_id = ${surveyId}`
        );
        expect(invites.length).toBe(2);
        const mock = new MockSES();
        mock
          .sendBulkTemplatedEmail()
          // @ts-ignore
          .promise.mockImplementationOnce(() => {
            return {
              Status: [
                {
                  Status: "Success",
                  MessageId: "123abc",
                },
              ],
            };
          });
        await clearSession(conn);
        await conn.any(
          sql`update email_notification_preferences set unsubscribe_all = ${true} where user_id = ${userA}`
        );
        await sendQueuedSurveyInvites(asPg(conn));
        const emails = await conn.many(
          sql`select status, token, token_expires_at, message_id, to_address from invite_emails where survey_invite_id = any(${sql.array(
            invites.map((i) => i.id),
            "int4"
          )})`
        );
        expect(emails.length).toBe(2);
        expect(emails.filter((e) => e.status === "UNSUBSCRIBED").length).toBe(
          1
        );
      }
    );
  });
  test("Will not send emails if survey.is_disabled", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const groupA = await createGroup(conn, projectId, "Group A");
        await addUserToGroup(conn, userA, groupA);
        const groupB = await createGroup(conn, projectId, "Group B");
        await addUserToGroup(conn, userB, groupB);
        await conn.any(
          sql`select update_survey_invited_groups(${surveyId}, array[${groupA}::int, ${groupB}::int])`
        );
        const invites = await conn.any(
          sql`select * from survey_invites where survey_id = ${surveyId}`
        );
        expect(invites.length).toBe(2);
        const mock = new MockSES();
        mock
          .sendBulkTemplatedEmail()
          // @ts-ignore
          .promise.mockImplementationOnce(() => {
            return {
              Status: [
                {
                  Status: "Success",
                  MessageId: "123abc",
                },
              ],
            };
          });
        await clearSession(conn);
        await sendQueuedSurveyInvites(asPg(conn));
        const emails = await conn.any(
          sql`select status, token, token_expires_at, message_id, to_address from invite_emails where survey_invite_id = any(${sql.array(
            invites.map((i) => i.id),
            "int4"
          )})`
        );
        expect(emails.length).toBe(0);
      }
    );
  });

  test("admins can resend invites using send_survey_reminder(inviteId)", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const formId = await conn.oneFirst(
          sql`select id from initialize_blank_survey_form(${surveyId})`
        );
        await conn.any(
          sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
        );

        const invite = await conn.one(
          sql`select * from create_survey_invites(${surveyId}, false, null, null, array[
                        ('bob@example.com', 'Bob')::survey_invite_options
                      ])`
        );
        const mock = new MockSES();
        mock
          .sendBulkTemplatedEmail()
          // @ts-ignore
          .promise.mockImplementationOnce(() => {
            return {
              Status: [
                {
                  Status: "Success",
                  MessageId: "123abc",
                },
              ],
            };
          });
        await clearSession(conn);
        await sendQueuedSurveyInvites(asPg(conn));
        const email = await conn.one(
          sql`select id, status, token, token_expires_at, message_id, to_address from invite_emails where survey_invite_id = ${invite.id}`
        );
        expect(email.status).toBe("SENT");
        await conn.any(
          sql`update invite_emails set status = 'DELIVERED' where id = ${email.id}`
        );
        await sendSurveyInviteReminder(asPg(conn), invite.id as number);
        const emails = await conn.many(
          sql`select status from invite_emails where survey_invite_id = ${invite.id}`
        );
        expect(emails.length).toBe(2);
      }
    );
  });

  test(`cannot send reminders if there are outstanding invites for that user`, async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const formId = await conn.oneFirst(
          sql`select id from initialize_blank_survey_form(${surveyId})`
        );
        await conn.any(
          sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
        );

        const invite = await conn.one(
          sql`select * from create_survey_invites(${surveyId}, false, null, null, array[
                          ('bob@example.com', 'Bob')::survey_invite_options
                        ])`
        );
        const mock = new MockSES();
        mock
          .sendBulkTemplatedEmail()
          // @ts-ignore
          .promise.mockImplementationOnce(() => {
            return {
              Status: [
                {
                  Status: "Success",
                  MessageId: "123abc",
                },
              ],
            };
          });
        await clearSession(conn);
        await sendQueuedSurveyInvites(asPg(conn));
        const email = await conn.one(
          sql`select id, status, token, token_expires_at, message_id, to_address from invite_emails where survey_invite_id = ${invite.id}`
        );
        expect(email.status).toBe("SENT");
        expect(
          sendSurveyInviteReminder(asPg(conn), invite.id as number)
        ).rejects.toThrow(/resend/i);
      }
    );
  });
  test(`cannot send emails to a user if they have marked seasketch emails as spam (in any project)`, async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const formId = await conn.oneFirst(
          sql`select id from initialize_blank_survey_form(${surveyId})`
        );
        await conn.any(
          sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
        );

        const invite = await conn.one(
          sql`select * from create_survey_invites(${surveyId}, false, null, null, array[
                            ('bob@example.com', 'Bob')::survey_invite_options
                          ])`
        );
        const mock = new MockSES();
        mock
          .sendBulkTemplatedEmail()
          // @ts-ignore
          .promise.mockImplementationOnce(() => {
            return {
              Status: [
                {
                  Status: "Success",
                  MessageId: "123abc",
                },
              ],
            };
          });
        await clearSession(conn);
        await sendQueuedSurveyInvites(asPg(conn));
        const email = await conn.one(
          sql`select id, status, token, token_expires_at, message_id, to_address from invite_emails where survey_invite_id = ${invite.id}`
        );
        expect(email.status).toBe("SENT");
        await conn.any(
          sql`update invite_emails set status = 'DELIVERED' where id = ${email.id}`
        );
        const otherProjectId = await createProject(conn, adminId, "public");
        await createSession(conn, adminId, true, false);
        const otherInvite = await conn.one(
          sql`select * from create_project_invites(${otherProjectId}, true, false, null, array[
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
        expect(
          sendSurveyInviteReminder(asPg(conn), invite.id as number)
        ).rejects.toThrow(/spam/i);
      }
    );
  });
});

describe("Sent invite status", () => {
  test(`admins can access invite_emails for a survey invite`, async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const formId = await conn.oneFirst(
          sql`select id from initialize_blank_survey_form(${surveyId})`
        );
        await conn.any(
          sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
        );

        const invites = await conn.many(
          sql`select * from create_survey_invites(${surveyId}, false, null, null, array[
                        ('bob@example.com', 'Bob')::survey_invite_options,
                        ('ed@example.com', 'Ed')::survey_invite_options
                      ])`
        );
        expect(invites.length).toBe(2);
        const mock = new MockSES();
        mock
          .sendBulkTemplatedEmail()
          // @ts-ignore
          .promise.mockImplementationOnce(() => {
            return {
              Status: [
                {
                  Status: "Success",
                  MessageId: "123abc",
                },
                {
                  Status: "Success",
                  MessageId: "456def",
                },
              ],
            };
          });
        await clearSession(conn);
        await sendQueuedSurveyInvites(asPg(conn));
        await createSession(conn, adminId, true, false, projectId);
        const emails = await conn.many(
          sql`select status from invite_emails where survey_invite_id = any(${sql.array(
            invites.map((i) => i.id),
            "int4"
          )})`
        );
        expect(emails.length).toBe(2);
        // regular users can't access
        await createSession(conn, userA, true, false, projectId);
        expect(
          (
            await conn.any(
              sql`select status from invite_emails where survey_invite_id = any(${sql.array(
                invites.map((i) => i.id),
                "int4"
              )})`
            )
          ).length
        ).toBe(0);
      }
    );
  });

  describe(`survey invite status reflects status of related emails`, () => {
    test(`queued - survey is active but email is not yet created`, async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false);
          const surveyId = await conn.oneFirst(
            sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
          );
          const formId = await conn.oneFirst(
            sql`select id from initialize_blank_survey_form(${surveyId})`
          );
          await conn.any(
            sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
          );

          const inviteId = await conn.oneFirst(
            sql`select id from create_survey_invites(${surveyId}, false, null, null, array[
                          ('bob@example.com', 'Bob')::survey_invite_options
                        ])`
          );
          await clearSession(conn);
          let status = await conn.oneFirst(
            sql`select survey_invites_status(survey_invites.*) from survey_invites where id = ${inviteId}`
          );
          expect(status).toBe("QUEUED");
        }
      );
    });
    test(`sent`, async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false);
          const surveyId = await conn.oneFirst(
            sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
          );
          const formId = await conn.oneFirst(
            sql`select id from initialize_blank_survey_form(${surveyId})`
          );
          await conn.any(
            sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
          );

          const inviteId = await conn.oneFirst(
            sql`select id from create_survey_invites(${surveyId}, false, null, null, array[
                          ('bob@example.com', 'Bob')::survey_invite_options
                        ])`
          );
          await clearSession(conn);
          const mock = new MockSES();
          mock
            .sendBulkTemplatedEmail()
            // @ts-ignore
            .promise.mockImplementationOnce(() => {
              return {
                Status: [
                  {
                    Status: "Success",
                    MessageId: "123abc",
                  },
                ],
              };
            });
          await sendQueuedSurveyInvites(asPg(conn));
          let status = await conn.oneFirst(
            sql`select survey_invites_status(survey_invites.*) from survey_invites where id = ${inviteId}`
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
          const surveyId = await conn.oneFirst(
            sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
          );
          const formId = await conn.oneFirst(
            sql`select id from initialize_blank_survey_form(${surveyId})`
          );
          await conn.any(
            sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
          );

          const inviteId = await conn.oneFirst(
            sql`select id from create_survey_invites(${surveyId}, false, null, null, array[
                          ('bob@example.com', 'Bob')::survey_invite_options
                        ])`
          );
          await clearSession(conn);
          const mock = new MockSES();
          mock
            .sendBulkTemplatedEmail()
            // @ts-ignore
            .promise.mockImplementationOnce(() => {
              return {
                Status: [
                  {
                    Status: "Success",
                    MessageId: "123abc",
                  },
                ],
              };
            });
          await sendQueuedSurveyInvites(asPg(conn));
          await conn.any(
            sql`update invite_emails set status = 'DELIVERED', token = ${exampleToken}, token_expires_at = to_timestamp(${
              new Date().getTime() + 10000
            })`
          );
          let status = await conn.oneFirst(
            sql`select survey_invites_status(survey_invites.*) from survey_invites where id = ${inviteId}`
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
          const surveyId = await conn.oneFirst(
            sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
          );
          const formId = await conn.oneFirst(
            sql`select id from initialize_blank_survey_form(${surveyId})`
          );
          await conn.any(
            sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
          );

          const inviteId = await conn.oneFirst(
            sql`select id from create_survey_invites(${surveyId}, false, null, null, array[
                          ('bob@example.com', 'Bob')::survey_invite_options
                        ])`
          );
          await clearSession(conn);
          const mock = new MockSES();
          mock
            .sendBulkTemplatedEmail()
            // @ts-ignore
            .promise.mockImplementationOnce(() => {
              return {
                Status: [
                  {
                    Status: "Success",
                    MessageId: "123abc",
                  },
                ],
              };
            });
          await sendQueuedSurveyInvites(asPg(conn));
          await conn.any(
            sql`update invite_emails set status = 'BOUNCED', token = ${exampleToken}, token_expires_at = to_timestamp(${
              new Date().getTime() + 10000
            })`
          );
          let status = await conn.oneFirst(
            sql`select survey_invites_status(survey_invites.*) from survey_invites where id = ${inviteId}`
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
          const surveyId = await conn.oneFirst(
            sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
          );
          const formId = await conn.oneFirst(
            sql`select id from initialize_blank_survey_form(${surveyId})`
          );
          await conn.any(
            sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
          );

          const inviteId = await conn.oneFirst(
            sql`select id from create_survey_invites(${surveyId}, false, null, null, array[
                          ('bob@example.com', 'Bob')::survey_invite_options
                        ])`
          );
          await clearSession(conn);
          const mock = new MockSES();
          mock
            .sendBulkTemplatedEmail()
            // @ts-ignore
            .promise.mockImplementationOnce(() => {
              return {
                Status: [
                  {
                    Status: "Success",
                    MessageId: "123abc",
                  },
                ],
              };
            });
          await sendQueuedSurveyInvites(asPg(conn));
          await conn.any(
            sql`update invite_emails set status = 'COMPLAINT', token = ${exampleToken}, token_expires_at = to_timestamp(${
              new Date().getTime() + 10000
            })`
          );
          let status = await conn.oneFirst(
            sql`select survey_invites_status(survey_invites.*) from survey_invites where id = ${inviteId}`
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
          const surveyId = await conn.oneFirst(
            sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
          );
          const formId = await conn.oneFirst(
            sql`select id from initialize_blank_survey_form(${surveyId})`
          );
          await conn.any(
            sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
          );

          const inviteId = await conn.oneFirst(
            sql`select id from create_survey_invites(${surveyId}, false, null, null, array[
                          ('bob@example.com', 'Bob')::survey_invite_options
                        ])`
          );
          await clearSession(conn);
          const mock = new MockSES();
          mock
            .sendBulkTemplatedEmail()
            // @ts-ignore
            .promise.mockImplementationOnce(() => {
              return {
                Status: [
                  {
                    Status: "Success",
                    MessageId: "123abc",
                  },
                ],
              };
            });
          await sendQueuedSurveyInvites(asPg(conn));
          await conn.any(
            sql`update invite_emails set token_expires_at = to_timestamp(${0})`
          );
          let status = await conn.oneFirst(
            sql`select survey_invites_status(survey_invites.*) from survey_invites where id = ${inviteId}`
          );
          expect(status).toBe("TOKEN_EXPIRED");
        }
      );
    });
    test(`Survey invite status changes to CONFIRMED on response`, async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false);
          const surveyId = await conn.oneFirst(
            sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
          );
          const formId = await conn.oneFirst(
            sql`select id from initialize_blank_survey_form(${surveyId})`
          );
          await conn.any(
            sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
          );
          const groupA = await createGroup(conn, projectId, "Group A");
          await addUserToGroup(conn, userA, groupA);
          await conn.any(
            sql`select update_survey_invited_groups(${surveyId}, array[${groupA}::int])`
          );
          await clearSession(conn);
          const mock = new MockSES();
          mock
            .sendBulkTemplatedEmail()
            // @ts-ignore
            .promise.mockImplementationOnce(() => {
              return {
                Status: [
                  {
                    Status: "Success",
                    MessageId: "123abc",
                  },
                ],
              };
            });
          await sendQueuedSurveyInvites(asPg(conn));
          // respond to survey
          await conn.any(
            sql`insert into survey_responses (survey_id, user_id) values (${surveyId}, ${userA})`
          );
          const invite = await conn.one(
            sql`select survey_invites_status(survey_invites.*) as status, * from survey_invites where survey_id = ${surveyId}`
          );
          expect(invite.status).toBe("CONFIRMED");
        }
      );
    });
  });

  test("Logged in users can see outstanding survey invites with me.outstandingSurveyInvites", async () => {
    await createAndSendSurveyInvite(
      pool,
      "PUBLIC",
      async (conn, projectId, adminId, userA, surveyId, inviteId) => {
        const token = (await conn.oneFirst(
          sql`select token from invite_emails where survey_invite_id = ${inviteId}`
        )) as string;
        await createSession(conn, userA, true, false, projectId);
        await conn.any(
          sql`select set_config('session.canonical_email', 'bob@example.com', true)`
        );
        const project = await conn.one(
          sql`select * from projects where id = ${projectId}`
        );
        const inviteInfo = await conn.any(
          sql`select projects_session_outstanding_survey_invites(projects.*) from projects where id = ${projectId}`
        );
        expect(inviteInfo.length).toBe(1);
      }
    );
  });
});

describe("Invite tokens", () => {
  test("invite_emails are populated with access tokens", async () => {
    await createAndSendSurveyInvite(
      pool,
      "PUBLIC",
      async (conn, projectId, adminId, userA, surveyId, inviteId) => {
        const token = (await conn.oneFirst(
          sql`select token from invite_emails where survey_invite_id = ${inviteId}`
        )) as string;
        expect(token.length).toBeGreaterThan(0);
        const claims = await verify(
          asPg(conn),
          token,
          process.env.HOST || "seasketch.org"
        );
        expect(claims.projectId).toBe(projectId);
        expect(claims.surveyId).toBe(surveyId);
        expect(claims.accessType).toBe("PUBLIC");
        expect(claims.fullname).toBe("Bob");
      }
    );
  });

  test("only valid for 60 days if invite_only", async () => {
    await createAndSendSurveyInvite(
      pool,
      "INVITE_ONLY",
      async (conn, projectId, adminId, userA, surveyId, inviteId) => {
        const token = (await conn.oneFirst(
          sql`select token from invite_emails where survey_invite_id = ${inviteId}`
        )) as string;
        const claims = await verify(
          asPg(conn),
          token,
          process.env.HOST || "seasketch.org"
        );
        expect(claims.accessType).toBe("INVITE_ONLY");
        const expiresBy = (new Date().getTime() + ms("65 days")) / 1000;
        expect(claims.exp).toBeLessThan(expiresBy);
        expect(claims.exp).toBeGreaterThan(
          (new Date().getTime() + ms("58 days")) / 1000
        );
      }
    );
  });

  test("no expiration if a public survey", async () => {
    await createAndSendSurveyInvite(
      pool,
      "PUBLIC",
      async (conn, projectId, adminId, userA, surveyId, inviteId) => {
        const token = (await conn.oneFirst(
          sql`select token from invite_emails where survey_invite_id = ${inviteId}`
        )) as string;
        const claims = await verify(
          asPg(conn),
          token,
          process.env.HOST || "seasketch.org"
        );
        expect(claims.accessType).toBe("PUBLIC");
        const expiresBy = (new Date().getTime() + ms("1 year")) / 1000;
        expect(claims.exp).toBeGreaterThan(expiresBy);
      }
    );
  });

  describe("db.surveyInvites.isValid/isValidSurveyInvite(token)", () => {
    test("can be called by anyone and returns token claims", async () => {
      await createAndSendSurveyInvite(
        pool,
        "PUBLIC",
        async (conn, projectId, adminId, userA, surveyId, inviteId) => {
          const token = (await conn.oneFirst(
            sql`select token from invite_emails where survey_invite_id = ${inviteId}`
          )) as string;
          // create anon session
          await createSession(conn);
          const claims = await verifySurveyInvite(
            asPg(conn),
            token,
            process.env.HOST || "seasketch.org"
          );
          expect(claims.surveyId).toBe(surveyId);
          expect(claims.wasUsed).toBe(false);
        }
      );
    });
    test("not valid if survey is disabled", async () => {
      await createAndSendSurveyInvite(
        pool,
        "PUBLIC",
        async (conn, projectId, adminId, userA, surveyId, inviteId) => {
          const token = (await conn.oneFirst(
            sql`select token from invite_emails where survey_invite_id = ${inviteId}`
          )) as string;
          await conn.any(sql`update surveys set is_disabled = true`);
          // create anon session
          await createSession(conn);
          expect(
            verifySurveyInvite(
              asPg(conn),
              token,
              process.env.HOST || "seasketch.org"
            )
          ).rejects.toThrow();
        }
      );
    });
    test("respects expiration", async () => {
      await createAndSendSurveyInvite(
        pool,
        "INVITE_ONLY",
        async (conn, projectId, adminId, userA, surveyId, inviteId) => {
          const token = (await conn.oneFirst(
            sql`select token from invite_emails where survey_invite_id = ${inviteId}`
          )) as string;
          await createSession(conn);
          MockDate.set(new Date().getTime() + ms("65 days"));
          expect(
            verifySurveyInvite(
              asPg(conn),
              token,
              process.env.HOST || "seasketch.org"
            )
          ).rejects.toThrow(/expired/i);
          MockDate.reset();
        }
      );
    });
    test("not valid if used more than once in a single-response survey", async () => {
      await createAndSendSurveyInvite(
        pool,
        "PUBLIC",
        async (conn, projectId, adminId, userA, surveyId, inviteId) => {
          const token = (await conn.oneFirst(
            sql`select token from invite_emails where survey_invite_id = ${inviteId}`
          )) as string;
          await conn.any(
            sql`update surveys set limit_to_single_response = ${true}`
          );
          await conn.any(sql`update survey_invites set was_used = ${true}`);
          // create anon session
          await createSession(conn);
          expect(
            verifySurveyInvite(
              asPg(conn),
              token,
              process.env.HOST || "seasketch.org"
            )
          ).rejects.toThrow();
        }
      );
    });
  });
});

describe("content access", () => {
  test("Logged in, invited users can access survey content without an invite token", async () => {
    // create a project transaction with an invite-only project
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        // create an invite only survey
        await createSession(conn, adminId, true, false, projectId);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name, access_type) values (${projectId}, 'Survey', 'INVITE_ONLY') returning id`
        );
        const formId = await conn.oneFirst(
          sql`select id from initialize_blank_survey_form(${surveyId})`
        );
        await conn.any(
          sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
        );
        const fieldId = await conn.oneFirst(
          sql`insert into form_elements (form_id, body, type_id, export_id) values (${formId}, ${createBody(
            "field 1"
          )}, ${FormElementType}, 'field1') returning id`
        );
        const field2Id = await conn.oneFirst(
          sql`insert into form_elements (form_id, body, type_id, export_id) values (${formId}, ${createBody(
            "yep nope"
          )}, ${FormElementType}, 'field2') returning id`
        );
        const ruleId = await conn.oneFirst(
          sql`insert into form_conditional_rendering_rules (field_id, predicate_field_id, value, operator) values (${fieldId}, ${field2Id}, 'nope', '=') returning id`
        );
        // add user to survey_invites
        await clearSession(conn);
        await conn.any(
          sql`insert into survey_invites (survey_id, user_id, was_added_from_group) values (${surveyId}, ${userA}, true)`
        );
        await createSession(conn, userA, true, false, projectId);
        await verifySessionCanAccessSurveyResources(
          conn,
          projectId,
          surveyId as number,
          formId as number,
          fieldId as number,
          ruleId as number
        );
      }
    );
  });

  test("invite tokens give access to protected resources needed to fill out the survey", async () => {
    // create a project transaction with an invite-only project
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        // create an invite only survey
        await createSession(conn, adminId, true, false, projectId);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name, access_type) values (${projectId}, 'Survey', 'INVITE_ONLY') returning id`
        );
        const formId = await conn.oneFirst(
          sql`select id from initialize_blank_survey_form(${surveyId})`
        );
        await conn.any(
          sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
        );
        const fieldId = await conn.oneFirst(
          sql`insert into form_elements (form_id, body, type_id, export_id) values (${formId}, ${createBody(
            "field 1"
          )}, ${FormElementType}, 'field1') returning id`
        );
        const field2Id = await conn.oneFirst(
          sql`insert into form_elements (form_id, body, type_id, export_id) values (${formId}, ${createBody(
            "yep nope"
          )}, ${FormElementType}, 'field2') returning id`
        );
        const ruleId = await conn.oneFirst(
          sql`insert into form_conditional_rendering_rules (field_id, predicate_field_id, value, operator) values (${fieldId}, ${field2Id}, 'nope', '=') returning id`
        );
        // add user to survey_invites
        const invite = await conn.one(
          sql`select * from create_survey_invites(${surveyId}, false, null, null, array[
                            ('bob@example.com', 'Bob')::survey_invite_options
                          ])`
        );
        const mock = new MockSES();
        mock
          .sendBulkTemplatedEmail()
          // @ts-ignore
          .promise.mockImplementationOnce(() => {
            return {
              Status: [
                {
                  Status: "Success",
                  MessageId: "123abc",
                },
              ],
            };
          });
        await clearSession(conn);
        await sendQueuedSurveyInvites(asPg(conn));
        await createSession(conn);
        await conn.any(
          sql`select set_config('session.survey_invite_email', 'bob@example.com', true)`
        );
        await verifySessionCanAccessSurveyResources(
          conn,
          projectId,
          surveyId as number,
          formId as number,
          fieldId as number,
          ruleId as number
        );
      }
    );
  });

  test("users with emails matching survey invites can access to protected resources needed to fill out the survey", async () => {
    // create a project transaction with an invite-only project
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        // create an invite only survey
        await createSession(conn, adminId, true, false, projectId);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name, access_type) values (${projectId}, 'Survey', 'INVITE_ONLY') returning id`
        );
        const formId = await conn.oneFirst(
          sql`select id from initialize_blank_survey_form(${surveyId})`
        );
        await conn.any(
          sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
        );
        const fieldId = await conn.oneFirst(
          sql`insert into form_elements (form_id, body, type_id, export_id) values (${formId}, ${createBody(
            "field 1"
          )}, ${FormElementType}, 'field1') returning id`
        );
        const field2Id = await conn.oneFirst(
          sql`insert into form_elements (form_id, body, type_id, export_id) values (${formId}, ${createBody(
            "yep nope"
          )}, ${FormElementType}, 'field2') returning id`
        );
        const ruleId = await conn.oneFirst(
          sql`insert into form_conditional_rendering_rules (field_id, predicate_field_id, value, operator) values (${fieldId}, ${field2Id}, 'nope', '=') returning id`
        );
        // add user to survey_invites
        const invite = await conn.one(
          sql`select * from create_survey_invites(${surveyId}, false, null, null, array[
                            ('bob@example.com', 'Bob')::survey_invite_options
                          ])`
        );
        const mock = new MockSES();
        mock
          .sendBulkTemplatedEmail()
          // @ts-ignore
          .promise.mockImplementationOnce(() => {
            return {
              Status: [
                {
                  Status: "Success",
                  MessageId: "123abc",
                },
              ],
            };
          });
        await clearSession(conn);
        await sendQueuedSurveyInvites(asPg(conn));
        await createSession(conn);
        await conn.any(
          sql`select set_config('session.canonical_email', 'bob@example.com', true)`
        );
        await conn.any(
          sql`select set_config('session.email_verified', ${true}, true)`
        );
        await verifySessionCanAccessSurveyResources(
          conn,
          projectId,
          surveyId as number,
          formId as number,
          fieldId as number,
          ruleId as number
        );
      }
    );
  });
});

describe("response submission", () => {
  test(`sets was_used on invite if token is used`, async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (project_id, name) values (${projectId}, 'Survey') returning id`
        );
        const formId = await conn.oneFirst(
          sql`select id from initialize_blank_survey_form(${surveyId})`
        );
        await conn.any(
          sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
        );
        const groupA = await createGroup(conn, projectId, "Group A");
        await addUserToGroup(conn, userA, groupA);
        await conn.any(
          sql`select update_survey_invited_groups(${surveyId}, array[${groupA}::int])`
        );
        await clearSession(conn);
        const mock = new MockSES();
        mock
          .sendBulkTemplatedEmail()
          // @ts-ignore
          .promise.mockImplementationOnce(() => {
            return {
              Status: [
                {
                  Status: "Success",
                  MessageId: "123abc",
                },
              ],
            };
          });
        await sendQueuedSurveyInvites(asPg(conn));
        // respond to survey
        await createSession(conn, userA, true);
        await conn.any(
          sql`select create_survey_response(${surveyId}, ${userA}, false, false, false)`
        );
        await clearSession(conn);
        const invite = await conn.one(
          sql`select survey_invites_status(survey_invites.*) as status, * from survey_invites where survey_id = ${surveyId}`
        );
        expect(invite.status).toBe("CONFIRMED");
        expect(invite.was_used).toBe(true);
      }
    );
  });
});
