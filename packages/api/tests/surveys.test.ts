import {
  sql,
  DatabaseTransactionConnectionType,
  DatabasePoolType,
} from "slonik";
import { createPool } from "./pool";
import {
  createSession,
  clearSession,
  createGroup,
  projectTransaction,
  verifyCRUDOpsLimitedToAdmins,
  createBody,
  getBodyStr,
} from "./helpers";

const pool = createPool("test");

const FormElementType = "ShortText";
beforeAll(async () => {
  const formId = await pool.oneFirst(
    sql`insert into forms (is_template, template_name, template_type) values (true, 'Basic Template', 'SURVEYS') returning id`
  );
  let welcomeField = await pool.any(
    sql`insert into form_elements (form_id, body, export_id, type_id) values (${formId}, ${createBody(
      "Welcome"
    )}, 'field_1', 'WelcomeMessage') returning *`
  );
});

describe("Surveys", () => {
  test("creating a survey using the Basic Template", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, userIds) => {
        await createSession(conn, adminId, true, false, projectId);
        const surveyId = await conn.oneFirst(
          sql`select id from make_survey('Survey A', ${projectId}, null)`
        );
        const form = await conn.one(
          sql`select * from forms where survey_id = ${surveyId}`
        );
        expect(form.id).toBeTruthy();
        expect(form.is_template).toBe(false);
        expect(form.survey_id).toBe(surveyId);
      }
    );
  });
  test("creating a survey from a specified template", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, userIds) => {
        await createSession(conn, adminId, true, true, projectId);
        const surveyId = await conn.oneFirst(
          sql`select id from make_survey('Survey A', ${projectId}, null)`
        );
        const source = await conn.one(
          sql`select id from forms where survey_id = ${surveyId}`
        );
        const field = await conn.one(
          sql`insert into form_elements (form_id, body, export_id, type_id) values (${
            source.id
          }, ${createBody("field a")}, 'field_a', 'ShortText') returning *`
        );
        let template = await conn.one(
          sql`update forms set template_name = 'Template A', template_type = 'SURVEYS', is_template = true where survey_id = ${surveyId} returning *`
        );
        expect(template.is_template).toBe(true);
        expect(
          await conn.oneFirst(
            sql`select count(*) from form_elements where form_id = ${template.id}`
          )
        ).toBeGreaterThan(0);
        await createSession(conn, adminId, true, false, projectId);
        const surveyBId = await conn.oneFirst(
          sql`select id from make_survey('Survey B', ${projectId}, ${template.id})`
        );
        const form = await conn.one(
          sql`select * from forms where survey_id = ${surveyBId}`
        );
        await clearSession(conn);
        expect(form.survey_id).toBe(surveyBId);
        expect(
          (
            await conn.many(
              sql`select * from form_elements where form_id = ${form.id}`
            )
          ).length
        ).toBeGreaterThan(0);
      }
    );
  });

  test("surveys cannot be made public until a form is assigned", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA, userB]) => {
        await createSession(conn, adminId, true, false, projectId);
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (name, project_id, access_type, is_disabled) values ('Survey A', ${projectId}, 'PUBLIC', ${true}) returning id`
        );
        expect(
          conn.any(
            sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
          )
        ).rejects.toThrow(/form/i);
      }
    );
  });

  test("only project admins can invite groups to a survey", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, userIds) => {
        await createSession(conn, adminId, true, false, projectId);
        const surveyId = await conn.oneFirst(
          sql`select id from make_survey('Survey A', ${projectId}, null)`
        );
        const groupId = await createGroup(conn, projectId, "Group A", [
          userIds[0],
        ]);
        await createSession(conn, userIds[1], true, false, projectId);
        expect(
          conn.any(
            sql`insert into survey_invited_groups (survey_id, group_id) values (${surveyId}, ${groupId}) returning *`
          )
        ).rejects.toThrow();
      }
    );
  });

  describe("Access Control", () => {
    test("CRUD operations are limited to project admins", async () => {
      await verifyCRUDOpsLimitedToAdmins(pool, {
        create: async (conn, projectId, adminId, userIds) => {
          return sql`select * from make_survey('Survey A', ${projectId}, null)`;
        },
        update: (recordId) =>
          sql`update surveys set name = 'Survey A (updated)' where id = ${recordId} returning *`,
        delete: (recordId) => {
          return sql`delete from surveys where id = ${recordId} returning *`;
        },
      });
    });
    // include tests for forms, form fields (rules are public since not sensitive)
    test("Public surveys are visible to everyone", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false, projectId);
          const surveyId = await conn.oneFirst(
            sql`select id from make_survey('Survey A', ${projectId}, null)`
          );
          const formId = await conn.oneFirst(
            sql`select id from forms where survey_id = ${surveyId}`
          );
          await conn.any(
            sql`update surveys set access_type = 'PUBLIC' where id = ${surveyId}`
          );
          await conn.any(
            sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
          );
          await clearSession(conn);
          await createSession(conn, adminId, true, false, projectId);
          const fieldId = await conn.oneFirst(
            sql`insert into form_elements (body, type_id, form_id, export_id) values (${createBody(
              "field a"
            )}, 'ShortText', ${formId}, 'field_a') returning id`
          );
          await createSession(conn, userA, false, false, projectId);
          expect(
            (await conn.any(sql`select * from surveys where id = ${surveyId}`))
              .length
          ).toBe(1);
          await createSession(conn, undefined, false, false, projectId);
          expect(
            (await conn.any(sql`select * from surveys where id = ${surveyId}`))
              .length
          ).toBe(1);
          expect(
            (
              await conn.any(
                sql`select * from forms where survey_id = ${surveyId}`
              )
            ).length
          ).toBe(1);
          expect(
            (
              await conn.any(
                sql`select * from form_elements where form_id = ${formId}`
              )
            ).length
          ).toBeGreaterThan(0);
        }
      );
    });

    test("Invite-only surveys are accessible to admins", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false, projectId);
          const surveyId = await conn.oneFirst(
            sql`select id from make_survey('Survey A', ${projectId}, null)`
          );
          const formId = await conn.oneFirst(
            sql`select id from forms where survey_id = ${surveyId}`
          );
          await conn.any(
            sql`update surveys set access_type = 'INVITE_ONLY' where id = ${surveyId}`
          );
          await conn.any(
            sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
          );
          await clearSession(conn);
          await createSession(conn, adminId, true, false, projectId);
          const fieldId = await conn.oneFirst(
            sql`insert into form_elements (body, type_id, form_id, export_id) values (${createBody(
              "field a"
            )}, 'ShortText', ${formId}, 'field_a') returning id`
          );
          expect(
            (await conn.any(sql`select * from surveys where id = ${surveyId}`))
              .length
          ).toBe(1);
          await createSession(conn, adminId, true, false, projectId);
          expect(
            (await conn.any(sql`select * from surveys where id = ${surveyId}`))
              .length
          ).toBe(1);
          expect(
            (
              await conn.any(
                sql`select * from forms where survey_id = ${surveyId}`
              )
            ).length
          ).toBe(1);
          expect(
            (
              await conn.any(
                sql`select * from form_elements where form_id = ${formId}`
              )
            ).length
          ).toBeGreaterThan(0);
        }
      );
    });

    test("Invite-only surveys are accessible to chosen user groups", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false, projectId);
          const surveyId = await conn.oneFirst(
            sql`select id from make_survey('Survey A', ${projectId}, null)`
          );
          const formId = await conn.oneFirst(
            sql`select id from forms where survey_id = ${surveyId}`
          );
          await conn.any(
            sql`update surveys set access_type = 'INVITE_ONLY' where id = ${surveyId}`
          );
          await conn.any(
            sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
          );
          await clearSession(conn);
          await createSession(conn, adminId, true, false, projectId);
          const fieldId = await conn.oneFirst(
            sql`insert into form_elements (body, type_id, form_id, export_id) values (${createBody(
              "field a"
            )}, 'ShortText', ${formId}, 'field_a') returning id`
          );
          const groupId = await createGroup(conn, projectId, "Group A", [
            userA,
          ]);
          await conn.any(
            sql`insert into survey_invited_groups (survey_id, group_id) values (${surveyId}, ${groupId})`
          );
          await createSession(conn, userA, false, false, projectId);
          expect(
            (await conn.any(sql`select * from surveys where id = ${surveyId}`))
              .length
          ).toBe(1);
          expect(
            (
              await conn.any(
                sql`select * from forms where survey_id = ${surveyId}`
              )
            ).length
          ).toBe(1);
          expect(
            (
              await conn.any(
                sql`select * from form_elements where form_id = ${formId}`
              )
            ).length
          ).toBeGreaterThan(0);
          await createSession(conn, userB, true, false, projectId);
          expect(
            (await conn.any(sql`select * from surveys where id = ${surveyId}`))
              .length
          ).toBe(0);
          expect(
            (
              await conn.any(
                sql`select * from forms where survey_id = ${surveyId}`
              )
            ).length
          ).toBe(0);
          expect(
            (
              await conn.any(
                sql`select * from form_elements where form_id = ${formId}`
              )
            ).length
          ).toBe(0);
        }
      );
    });

    test("Disabled surveys are not visible to end-users", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false, projectId);
          const surveyId = await conn.oneFirst(
            sql`select id from make_survey('Survey A', ${projectId}, null)`
          );
          const formId = await conn.oneFirst(
            sql`select id from forms where survey_id = ${surveyId}`
          );
          await conn.any(
            sql`update surveys set access_type = 'INVITE_ONLY' where id = ${surveyId}`
          );
          await createSession(conn, adminId, true, false, projectId);
          const fieldId = await conn.oneFirst(
            sql`insert into form_elements (body, type_id, form_id, export_id) values (${createBody(
              "field a"
            )}, 'ShortText', ${formId}, 'field_a') returning id`
          );
          const groupId = await createGroup(conn, projectId, "Group A", [
            userA,
          ]);
          await conn.any(
            sql`insert into survey_invited_groups (survey_id, group_id) values (${surveyId}, ${groupId})`
          );
          await createSession(conn, userA, false, false, projectId);
          expect(
            (await conn.any(sql`select * from surveys where id = ${surveyId}`))
              .length
          ).toBe(0);
          expect(
            (
              await conn.any(
                sql`select * from forms where survey_id = ${surveyId}`
              )
            ).length
          ).toBe(0);
          expect(
            (
              await conn.any(
                sql`select * from form_elements where form_id = ${formId}`
              )
            ).length
          ).toBe(0);
          await createSession(conn, adminId, true, false, projectId);
          await conn.any(
            sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
          );
          await createSession(conn, userA, true, false, projectId);
          expect(
            (await conn.any(sql`select * from surveys where id = ${surveyId}`))
              .length
          ).toBe(1);
          expect(
            (
              await conn.any(
                sql`select * from forms where survey_id = ${surveyId}`
              )
            ).length
          ).toBe(1);
          expect(
            (
              await conn.any(
                sql`select * from form_elements where form_id = ${formId}`
              )
            ).length
          ).toBeGreaterThan(0);
        }
      );
    });

    test("Admins cannot delete surveys with more than 5 responses from users other than themselves", async () => {
      await surveyTransaction(
        pool,
        "PUBLIC",
        async (
          conn,
          projectId,
          adminId,
          surveyId,
          invitedUser,
          uninvitedUser
        ) => {
          await clearSession(conn);
          let count = 5;
          while (count) {
            count--;
            await conn.one(
              sql`select create_survey_response(${surveyId}, ${sql.json(
                {}
              )}, false, false, false, false, null)`
            );
          }
          await createSession(conn, adminId, true, false, projectId);
          expect(
            conn.any(sql`delete from surveys where id = ${surveyId}`)
          ).rejects.toThrow(/responses/i);
        }
      );
    });
  });

  describe("Responses", () => {
    test("updated_at field automatically set", async () => {
      await surveyTransaction(
        pool,
        "PUBLIC",
        async (
          conn,
          projectId,
          adminId,
          surveyId,
          invitedUser,
          uninvitedUser
        ) => {
          await createSession(conn, invitedUser, true, false, projectId);
          const response = await conn.one(
            sql`select * from create_survey_response(${surveyId}, ${sql.json(
              {}
            )}, false, true, false, false, null)`
          );
          expect(response.updated_at).toBe(null);
          const r = await conn.one(
            sql`update survey_responses set data = ${sql.json({
              foo: "bar",
            })} where id = ${response.id} returning *`
          );
          // cant test updated_at != create_at because of transaction
          expect(r.updated_at).not.toBe(null);
        }
      );
    });

    test("only admins can change draft from false -> true", async () => {
      await surveyTransaction(
        pool,
        "PUBLIC",
        async (conn, projectId, adminId, surveyId, userA, userB) => {
          await createSession(conn, userA, true, false, projectId);
          const responseA = await conn.one(
            sql`select * from create_survey_response(${surveyId}, ${sql.json(
              {}
            )}, false, false, false, false, null)`
          );
          await createSession(conn, userA, true, false, projectId);
          expect(
            conn.oneFirst(
              sql`select is_draft from make_response_draft(${responseA.id})`
            )
          ).rejects.toThrow(/admin/i);
        }
      );
    });

    test("outside_geofence set on insert and cannot be updated", async () => {
      await surveyTransaction(
        pool,
        "PUBLIC",
        async (
          conn,
          projectId,
          adminId,
          surveyId,
          invitedUser,
          uninvitedUser
        ) => {
          await createSession(conn, invitedUser, true, false, projectId);
          const response = await conn.one(
            sql`select * from create_survey_response(${surveyId}, ${sql.json(
              {}
            )}, false, true, false, false, null)`
          );
          expect(
            conn.one(
              sql`update survey_responses set outside_geofence = true where id = ${response.id} returning *`
            )
          ).rejects.toThrow();
        }
      );
    });

    test.todo("Geofence is evaluated if present when submitting responses");

    describe("Access Control", () => {
      test("Users can create responses to public surveys", async () => {
        await surveyTransaction(
          pool,
          "PUBLIC",
          async (
            conn,
            projectId,
            adminId,
            surveyId,
            invitedUser,
            uninvitedUser
          ) => {
            await createSession(conn, invitedUser, true, false, projectId);
            const response = await conn.one(
              sql`select * from create_survey_response(${surveyId}, ${sql.json(
                {}
              )}, false, false ,false, false, null)`
            );
            expect(response).toBeTruthy();
          }
        );
      });

      test("Anonymous users can create responses to public surveys", async () => {
        await surveyTransaction(
          pool,
          "PUBLIC",
          async (
            conn,
            projectId,
            adminId,
            surveyId,
            invitedUser,
            uninvitedUser
          ) => {
            await createSession(conn, undefined, false, false, projectId);
            const response = await conn.query(
              sql`select * from create_survey_response(${surveyId}, ${sql.json(
                {}
              )}, false, false ,false, false, null)`
            );
            expect(response).toBeTruthy();
          }
        );
      });

      test("Users can create responses if they are in an invited group", async () => {
        await surveyTransaction(
          pool,
          "INVITE_ONLY",
          async (
            conn,
            projectId,
            adminId,
            surveyId,
            invitedUser,
            uninvitedUser
          ) => {
            await createSession(conn, invitedUser, true, false, projectId);
            const response = await conn.one(
              sql`select * from create_survey_response(${surveyId}, ${sql.json(
                {}
              )}, false, false ,false, false, null)`
            );
            expect(response).toBeTruthy();
            await createSession(conn, uninvitedUser, true, false, projectId);
            expect(
              conn.one(
                sql`select * from create_survey_response(${surveyId}, ${sql.json(
                  {}
                )}, false, false ,false, false, null)`
              )
            ).rejects.toThrow();
          }
        );
      });

      test("Users can't update responses if not in draft mode", async () => {
        await surveyTransaction(
          pool,
          "PUBLIC",
          async (
            conn,
            projectId,
            adminId,
            surveyId,
            invitedUser,
            uninvitedUser
          ) => {
            await createSession(conn, invitedUser, true, false, projectId);
            const response = await conn.one(
              sql`select * from create_survey_response(${surveyId}, ${sql.json(
                {}
              )}, false, false ,false, false, null)`
            );
            expect(response).toBeTruthy();
            expect(
              conn.one(
                sql`update survey_responses set data = ${sql.json({
                  foo: "bar",
                })} where id = ${response.id} returning *`
              )
            ).rejects.toThrow(/submit/i);
          }
        );
      });

      test("Users can delete their own responses (if draft)", async () => {
        await surveyTransaction(
          pool,
          "PUBLIC",
          async (
            conn,
            projectId,
            adminId,
            surveyId,
            invitedUser,
            uninvitedUser
          ) => {
            await createSession(conn, invitedUser, true, false, projectId);
            const response = await conn.one(
              sql`select * from create_survey_response(${surveyId}, ${sql.json(
                {}
              )}, false, false ,false, false, null)`
            );
            expect(response).toBeTruthy();
            expect(
              conn.one(
                sql`update survey_responses set data = ${sql.json({
                  foo: "bar",
                })} where id = ${response.id} returning *`
              )
            ).rejects.toThrow(/submit/i);
          }
        );
      });

      // Admins must be able to delete responses so that they may delete surveys
      test("Admins can delete responses", async () => {
        await surveyTransaction(
          pool,
          "PUBLIC",
          async (
            conn,
            projectId,
            adminId,
            surveyId,
            invitedUser,
            uninvitedUser
          ) => {
            await createSession(conn, invitedUser, true, false, projectId);
            const response = await conn.one(
              sql`select * from create_survey_response(${surveyId}, ${sql.json(
                {}
              )}, false, false ,false, false, null)`
            );
            await createSession(conn, adminId, true, false, projectId);
            const deleted = await conn.oneFirst(
              sql`delete from survey_responses where id = ${response.id} returning id`
            );
            expect(deleted).toBeTruthy();
          }
        );
      });

      test("Users can only see their own responses", async () => {
        await surveyTransaction(
          pool,
          "PUBLIC",
          async (conn, projectId, adminId, surveyId, userA, userB) => {
            await createSession(conn, userA, true, false, projectId);
            const responseA = await conn.one(
              sql`select * from create_survey_response(${surveyId}, ${sql.json(
                {}
              )}, false, false ,false, false, null)`
            );
            await createSession(conn, userB, true, false, projectId);
            const responseB = await conn.one(
              sql`select * from create_survey_response(${surveyId}, ${sql.json(
                {}
              )}, false, false ,false, false, null)`
            );
            const responses = await conn.any(
              sql`select * from survey_responses where survey_id = ${surveyId}`
            );
            expect(responses.length).toBe(1);
          }
        );
      });

      test("Admins can view submitted (but not draft) responses", async () => {
        await surveyTransaction(
          pool,
          "PUBLIC",
          async (conn, projectId, adminId, surveyId, userA, userB) => {
            await createSession(conn, userA, true, false, projectId);
            const responseA = await conn.one(
              sql`select * from create_survey_response(${surveyId}, ${sql.json(
                {}
              )}, false, false ,false, false, null)`
            );
            await createSession(conn, userB, true, false, projectId);
            const responseB = await conn.one(
              sql`select * from create_survey_response(${surveyId}, ${sql.json(
                {}
              )}, false, false ,false, false, null)`
            );
            const responses = await conn.any(
              sql`select * from survey_responses where survey_id = ${surveyId}`
            );
            expect(responses.length).toBe(1);
            const responseC = await conn.one(
              sql`select * from create_survey_response(${surveyId}, ${sql.json(
                {}
              )}, false, true,false,false, null)`
            );
            await createSession(conn, adminId, true, false, projectId);
            const adminView = await conn.any(
              sql`select * from survey_responses where survey_id = ${surveyId}`
            );
            expect(adminView.length).toBeGreaterThan(0);
          }
        );
      });

      test("Admins can put a submitted response back into draft status", async () => {
        await surveyTransaction(
          pool,
          "PUBLIC",
          async (conn, projectId, adminId, surveyId, userA, userB) => {
            await createSession(conn, userA, true, false, projectId);
            const responseA = await conn.one(
              sql`select * from create_survey_response(${surveyId}, ${sql.json(
                {}
              )}, false, false ,false, false, null)`
            );
            await createSession(conn, adminId, true, false, projectId);
            const draft = await conn.oneFirst(
              sql`select is_draft from make_response_draft(${responseA.id})`
            );
            expect(draft).toBe(true);
          }
        );
      });
    });

    describe("ballot stuffing detection", () => {
      test("submitting a response creates a new survey_response_network_addresses entry", async () => {
        await surveyTransaction(
          pool,
          "PUBLIC",
          async (conn, projectId, adminId, surveyId, userA, userB) => {
            await createSession(conn, userA, true, false, projectId);
            const responseA = await conn.one(
              sql`select * from create_survey_response(${surveyId}, ${sql.json(
                {}
              )}, false, false ,false, false, null)`
            );
            await clearSession(conn);
            const hash = await conn.one(
              sql`select * from survey_response_network_addresses`
            );
            expect(hash.survey_id).toBe(surveyId);
            expect(hash.num_responses).toBe(1);
          }
        );
      });
      test("repeated submissions from the same IP set response.is_duplicate_ip", async () => {
        await surveyTransaction(
          pool,
          "PUBLIC",
          async (conn, projectId, adminId, surveyId, userA, userB) => {
            await createSession(conn, userA, true, false, projectId);
            const responseA = await conn.one(
              sql`select * from create_survey_response(${surveyId}, ${sql.json(
                {}
              )}, false, false ,false, false, null)`
            );
            const responseB = await conn.one(
              sql`select * from create_survey_response(${surveyId}, ${sql.json(
                {}
              )}, false, false ,false, false, null)`
            );
            await clearSession(conn);
            const hash = await conn.one(
              sql`select * from survey_response_network_addresses`
            );
            expect(hash.survey_id).toBe(surveyId);
            expect(hash.num_responses).toBeGreaterThan(0);
            expect(responseA.is_duplicate_ip).toBe(false);
            expect(responseB.is_duplicate_ip).toBe(true);
          }
        );
      });
      test("nobody can alter response.is_duplicate_ip", async () => {
        await surveyTransaction(
          pool,
          "PUBLIC",
          async (conn, projectId, adminId, surveyId, userA, userB) => {
            await createSession(conn, userA, true, false, projectId);
            const responseA = await conn.one(
              sql`select * from create_survey_response(${surveyId}, ${sql.json(
                {}
              )}, false, false ,false, false, null)`
            );
            const responseB = await conn.one(
              sql`select * from create_survey_response(${surveyId}, ${sql.json(
                {}
              )}, false, false ,false, false, null)`
            );
            await createSession(conn, adminId, true, false, projectId);
            expect(responseB.is_duplicate_ip).toBe(true);
            expect(
              conn.one(
                sql`update survey_responses set is_duplicate_ip = ${false} where id = ${
                  responseB.id
                } returning *`
              )
            ).rejects.toThrow();
          }
        );
      });
      test("bypassed_duplicate_submission_control cannot be updated by anyone", async () => {
        await surveyTransaction(
          pool,
          "PUBLIC",
          async (conn, projectId, adminId, surveyId, userA, userB) => {
            await createSession(conn, userA, true, false, projectId);
            const responseA = await conn.one(
              sql`select * from create_survey_response(${surveyId}, ${sql.json(
                {}
              )}, false, false, true, false, null)`
            );
            await createSession(conn, adminId, true, false, projectId);
            expect(responseA.bypassed_duplicate_submission_control).toBe(true);
            expect(
              conn.one(
                sql`update survey_responses set bypassed_duplicate_submission_control = ${false} where id = ${
                  responseA.id
                } returning *`
              )
            ).rejects.toThrow();
          }
        );
      });
    });
  });
});

describe("Survey Response Spatial Data Layers", () => {
  test.todo("mvt service");
});

test("is_required_for_surveys questions cannot be removed", async () => {
  await projectTransaction(
    pool,
    "public",
    async (conn, projectId, adminId, userIds) => {
      await createSession(conn, adminId, true, false, projectId);
      const surveyId = await conn.oneFirst(
        sql`select id from make_survey('Survey A', ${projectId}, null)`
      );
      const form = await conn.one(
        sql`select * from forms where survey_id = ${surveyId}`
      );
      expect(form.id).toBeTruthy();
      expect(form.is_template).toBe(false);
      expect(form.survey_id).toBe(surveyId);
      const welcomeElementId = await conn.oneFirst(
        sql`select id from form_elements where type_id = 'WelcomeMessage' and form_id = ${form.id}`
      );
      expect(
        conn.any(sql`delete from form_elements where id = ${welcomeElementId}`)
      ).rejects.toThrow(/Cannot delete/);
    }
  );
});

async function surveyTransaction(
  pool: DatabasePoolType,
  accessType: "PUBLIC" | "INVITE_ONLY",
  func: (
    conn: DatabaseTransactionConnectionType,
    projectId: number,
    adminId: number,
    surveyId: number,
    invitedUser: number,
    uninvitedUser: number
  ) => Promise<void>
) {
  await projectTransaction(
    pool,
    "public",
    async (conn, projectId, adminId, [userA, userB]) => {
      await createSession(conn, adminId, true, false, projectId);
      const surveyId = await conn.oneFirst(
        sql`select id from make_survey('Survey A', ${projectId}, null)`
      );
      const formId = await conn.oneFirst(
        sql`select id from forms where survey_id = ${surveyId}`
      );
      await conn.any(
        sql`update surveys set access_type = ${accessType} where id = ${surveyId}`
      );
      await conn.any(
        sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
      );
      if (accessType === "INVITE_ONLY") {
        const groupId = await createGroup(conn, projectId, "Group A", [userA]);
        await conn.any(
          sql`insert into survey_invited_groups (survey_id, group_id) values (${surveyId}, ${groupId})`
        );
      }
      await clearSession(conn);
      await func(conn, projectId, adminId, surveyId as number, userA, userB);
    }
  );
}

describe("Handling of sketches", () => {
  test("embedded sketches are moved to their own table", async () => {
    await surveyTransaction(
      pool,
      "PUBLIC",
      async (conn, projectId, adminId, surveyId) => {
        const formId = await conn.oneFirst<number>(
          sql`select id from forms where survey_id = ${surveyId}`
        );

        await createSession(conn, adminId, true, false, projectId);
        const elementId = await conn.oneFirst<string>(
          sql`insert into form_elements (form_id, type_id, body) values (${formId}, 'MultiSpatialInput', ${createBody(
            "Shape"
          )}) returning id`
        );
        await conn.any(
          sql`update sketch_classes set geometry_type = 'POINT' where form_element_id = ${elementId}`
        );
        const response = await conn.one<{
          id: number;
          data: any;
          user_id: number;
        }>(
          sql`select * from create_survey_response(${surveyId}, ${sql.json({
            [elementId]: {
              collection: {
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    properties: {
                      name: "Location 1",
                      otherAttribute: "foo",
                    },
                    geometry: {
                      type: "Point",
                      coordinates: [-119.1234, 34.4321],
                    },
                  },
                  {
                    type: "Feature",
                    properties: {
                      name: "Location 2",
                      otherAttribute: "bar",
                    },
                    geometry: {
                      type: "Point",
                      coordinates: [-119.1234, 34.12345],
                    },
                  },
                ],
              },
            },
          })}, false, true, false, false, null)`
        );
        expect(response.user_id).toBe(adminId);
        expect(response.data[elementId].collection.length).toBe(2);
        const sketches = await conn.many(
          sql`select * from sketches where response_id = ${response.id}`
        );
        expect(sketches.length).toBe(2);
        expect(sketches[0].user_id).toBe(adminId);
        expect(sketches[0].properties).toHaveProperty("otherAttribute");
      }
    );
  });

  test("embeded sketches must be a feature collection", async () => {
    await surveyTransaction(
      pool,
      "PUBLIC",
      async (conn, projectId, adminId, surveyId) => {
        const formId = await conn.oneFirst<number>(
          sql`select id from forms where survey_id = ${surveyId}`
        );
        await createSession(conn, adminId, true, false, projectId);
        const elementId = await conn.oneFirst<string>(
          sql`insert into form_elements (form_id, type_id, body) values (${formId}, 'SingleSpatialInput', ${createBody(
            "Shape"
          )}) returning id`
        );
        expect(
          conn.one(
            sql`select * from create_survey_response(${surveyId}, ${sql.json({
              [elementId]: {
                type: "Feature",
                properties: {
                  name: "Location 1",
                  otherAttribute: "foo",
                },
              },
            })}, false, true, false, false, null)`
          )
        ).rejects.toThrow("FeatureCollection");
      }
    );
  });
});
