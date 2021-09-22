import { sql } from "slonik";
import { createPool } from "./pool";
import {
  createUser,
  createProject,
  addParticipant,
  createSession,
  clearSession,
  createGroup,
  addGroupToAcl,
  projectTransaction,
  verifyOnlyAuthorsCanEditRecords,
  verifyOnlyAuthorsCanAccessRecords,
  verifyOnlyProjectGroupMembersCanAccessResource,
  limitToGroup,
  verifyCRUDOpsLimitedToAdmins,
  createBody,
  getBodyStr,
} from "./helpers";
import { createExportId } from "../src/plugins/exportIdPlugin";

const pool = createPool("test");

const FormElementType = "TestTextFieldForm";
beforeAll(async () => {
  await pool.oneFirst(
    sql`insert into form_element_types (component_name, label) values (${FormElementType}, 'Test Text Input Forms') returning component_name`
  );
});

describe("Forms", () => {
  describe("access control", () => {
    test("cannot be directly created", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const sketchClassId = await conn.oneFirst(
            sql`insert into sketch_classes (name, project_id) values ('Sketch Class A', ${projectId}) returning id`
          );
          expect(
            conn.oneFirst(
              sql`insert into forms (sketch_class_id) values (${sketchClassId}) returning id`
            )
          ).rejects.toThrow(/permission/);
        }
      );
    });
    test("admins can create using initializeSketchClassForm(sketchClassId)", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const sketchClassId = await conn.oneFirst(
            sql`insert into sketch_classes (name, project_id) values ('Sketch Class A', ${projectId}) returning id`
          );
          const form = await conn.one(
            sql`select * from initialize_blank_sketch_class_form(${sketchClassId})`
          );
          expect(form.id).toBeTruthy();
          expect(form.is_template).toBe(false);
          expect(form.sketch_class_id).toBe(sketchClassId);
        }
      );
    });
    test("only admins can use initializeSketchClassForm", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const sketchClassId = await conn.oneFirst(
            sql`insert into sketch_classes (name, project_id) values ('Sketch Class A', ${projectId}) returning id`
          );
          await createSession(conn, userIds[0], true, false, projectId);
          expect(
            conn.one(
              sql`select * from initialize_blank_sketch_class_form(${sketchClassId})`
            )
          ).rejects.toThrow(/admin/i);
        }
      );
    });
    test("initializeSketchClassForm can only be called after existing form is deleted if exists", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const sketchClassId = await conn.oneFirst(
            sql`insert into sketch_classes (name, project_id) values ('Sketch Class A', ${projectId}) returning id`
          );
          const form = await conn.one(
            sql`select * from initialize_blank_sketch_class_form(${sketchClassId})`
          );
          expect(form.id).toBeTruthy();
          expect(form.sketch_class_id).toBe(sketchClassId);
          await conn.any(sql`delete from forms where id = ${form.id}`);
          const form2 = await conn.one(
            sql`select * from initialize_blank_sketch_class_form(${sketchClassId})`
          );
          expect(form2.id).not.toBe(form.id);
          expect(
            conn.one(
              sql`select * from initialize_blank_sketch_class_form(${sketchClassId})`
            )
          ).rejects.toThrow();
        }
      );
    });

    test("can only be deleted by admins", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const sketchClassId = await conn.oneFirst(
            sql`insert into sketch_classes (name, project_id) values ('Sketch Class A', ${projectId}) returning id`
          );
          let form = await conn.one(
            sql`select * from initialize_blank_sketch_class_form(${sketchClassId})`
          );
          await createSession(conn, userIds[0], true, false, projectId);
          expect(
            conn.oneFirst(
              sql`delete from forms where id = ${form.id} returning id`
            )
          ).rejects.toThrow();
          await createSession(conn, adminId, true, false, projectId);
          let existing = await conn.any(
            sql`select id from forms where id = ${form.id}`
          );
          expect(existing.length).toBe(1);
        }
      );
    });

    test("are accessible to users who have access to the related sketch class", async () => {
      await verifyOnlyProjectGroupMembersCanAccessResource(
        pool,
        "forms",
        async (conn, projectId, groupId, adminId) => {
          await createSession(conn, adminId, true, false, projectId);
          const sketchClassId = await conn.oneFirst(
            sql`insert into sketch_classes (name, project_id) values ('Sketch Class A', ${projectId}) returning id`
          );
          await limitToGroup(conn, "sketch_class_id", sketchClassId, groupId);
          let form = await conn.one(
            sql`select * from initialize_blank_sketch_class_form(${sketchClassId})`
          );
          return form.id as number;
        }
      );
    });

    test("are accessible to users who have access to the related survey", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [userA, userB]) => {
          await createSession(conn, adminId, true, false, projectId);
          const surveyId = await conn.oneFirst(
            sql`insert into surveys (name, project_id, access_type) values ('Survey A', ${projectId}, 'INVITE_ONLY') returning id`
          );
          const formId = await conn.oneFirst(
            sql`select id from initialize_blank_survey_form(${surveyId})`
          );
          await conn.any(
            sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
          );
          await clearSession(conn);
          await createSession(conn, adminId, true, false, projectId);
          const fieldId = await conn.oneFirst(
            sql`insert into form_elements (body, type_id, form_id, export_id) values (${createBody(
              "field a"
            )}, ${FormElementType}, ${formId}, 'field_a') returning id`
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
          ).toBe(1);
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
  });

  describe("Templates", () => {
    test("templates can only be created by superusers", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, true, projectId);
          const sketchClassId = await conn.oneFirst(
            sql`insert into sketch_classes (name, project_id) values ('Sketch Class A', ${projectId}) returning id`
          );
          let form = await conn.one(
            sql`select * from initialize_blank_sketch_class_form(${sketchClassId})`
          );
          let template = await conn.one(
            sql`select * from create_form_template_from_sketch_class(${sketchClassId}, 'Template A', 'SKETCHES')`
          );
          expect(template.is_template).toBe(true);
          await createSession(conn, adminId, true, false, projectId);
          expect(
            conn.one(
              sql`select * from create_form_template_from_sketch_class(${sketchClassId}, 'Template B', 'SKETCHES')`
            )
          ).rejects.toThrow(/permission/i);
        }
      );
    });
  });

  describe("Assigning a form to a sketch class", () => {
    test("Creating a blank form", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const sketchClassId = await conn.oneFirst(
            sql`insert into sketch_classes (name, project_id) values ('Sketch Class A', ${projectId}) returning id`
          );
          const form = await conn.one(
            sql`select * from initialize_blank_sketch_class_form(${sketchClassId})`
          );
          expect(form.sketch_class_id).toBe(sketchClassId);
        }
      );
    });
    test("Copying a template", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, true, projectId);
          const sketchClassId = await conn.oneFirst(
            sql`insert into sketch_classes (name, project_id) values ('Sketch Class A', ${projectId}) returning id`
          );
          const source = await conn.one(
            sql`select * from initialize_blank_sketch_class_form(${sketchClassId})`
          );
          let template = await conn.one(
            sql`select * from create_form_template_from_sketch_class(${sketchClassId}, 'Template A', 'SKETCHES')`
          );
          expect(template.is_template).toBe(true);
          await createSession(conn, adminId, true, false, projectId);
          const sketchClassBId = await conn.oneFirst(
            sql`insert into sketch_classes (name, project_id) values ('Sketch Class B', ${projectId}) returning id`
          );
          const form = await conn.one(
            sql`select * from initialize_sketch_class_form_from_template(${sketchClassBId}, ${template.id})`
          );
          expect(form.sketch_class_id).toBe(sketchClassBId);
        }
      );
    });
    test("Copied templates copy all related form fields", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, true, projectId);
          const sketchClassId = await conn.oneFirst(
            sql`insert into sketch_classes (name, project_id) values ('Sketch Class A', ${projectId}) returning id`
          );
          const source = await conn.one(
            sql`select * from initialize_blank_sketch_class_form(${sketchClassId})`
          );
          const field = await conn.one(
            sql`insert into form_elements (form_id, body, export_id, type_id) values (${
              source.id
            }, ${createBody(
              "field a"
            )}, 'field_a', ${FormElementType}) returning *`
          );
          let template = await conn.one(
            sql`select * from create_form_template_from_sketch_class(${sketchClassId}, 'Template A', 'SKETCHES')`
          );
          expect(template.is_template).toBe(true);
          expect(
            await conn.oneFirst(
              sql`select count(*) from form_elements where form_id = ${template.id}`
            )
          ).toBe(1);
          await createSession(conn, adminId, true, false, projectId);
          const sketchClassBId = await conn.oneFirst(
            sql`insert into sketch_classes (name, project_id) values ('Sketch Class B', ${projectId}) returning id`
          );
          const form = await conn.one(
            sql`select * from initialize_sketch_class_form_from_template(${sketchClassBId}, ${template.id})`
          );
          await clearSession(conn);
          expect(form.sketch_class_id).toBe(sketchClassBId);
          expect(
            (
              await conn.many(
                sql`select * from form_elements where form_id = ${form.id}`
              )
            ).length
          ).toBe(1);
        }
      );
    });
  });
});

describe("Form Fields", () => {
  describe("access control", () => {
    test("can only be created by admins of the project", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const sketchClassId = await conn.oneFirst(
            sql`insert into sketch_classes (name, project_id) values ('Sketch Class A', ${projectId}) returning id`
          );
          const form = await conn.one(
            sql`select * from initialize_blank_sketch_class_form(${sketchClassId})`
          );
          expect(form.sketch_class_id).toBe(sketchClassId);
          const field = await conn.one(
            sql`insert into form_elements (form_id, body, export_id, type_id) values (${
              form.id
            }, ${createBody(
              "field a"
            )}, 'field_a', ${FormElementType}) returning *`
          );
          // @ts-ignore
          expect(field.body.content[0].content[0].text).toBe("field a");
          await createSession(conn, userIds[0], true, false, projectId);
          expect(
            conn.one(
              sql`insert into form_elements (form_id, body, export_id, type_id) values (${form.id}, 'field b', 'field_b', ${FormElementType}) returning *`
            )
          ).rejects.toThrow();
        }
      );
    });
    test("can only be updated and deleted by admins", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const sketchClassId = await conn.oneFirst(
            sql`insert into sketch_classes (name, project_id) values ('Sketch Class A', ${projectId}) returning id`
          );
          const form = await conn.one(
            sql`select * from initialize_blank_sketch_class_form(${sketchClassId})`
          );
          expect(form.sketch_class_id).toBe(sketchClassId);
          const fieldA = await conn.one(
            sql`insert into form_elements (form_id, body, export_id, type_id) values (${
              form.id
            }, ${createBody(
              "field a"
            )}, 'field_a', ${FormElementType}) returning *`
          );
          expect(getBodyStr(fieldA.body)).toBe("field a");
          const fieldB = await conn.one(
            sql`insert into form_elements (form_id, body, export_id, type_id) values (${
              form.id
            }, ${createBody(
              "field b"
            )}, 'field_b', ${FormElementType}) returning *`
          );
          const updatedFieldA = await conn.one(
            sql`update form_elements set body = ${createBody(
              "Field A"
            )} where id = ${fieldA.id} returning *`
          );
          expect(getBodyStr(updatedFieldA.body)).toBe("Field A");
          await conn.any(
            sql`delete from form_elements where id = ${fieldA.id}`
          );
          expect(
            (
              await conn.any(
                sql`select * from form_elements where id = ${fieldA.id}`
              )
            ).length
          ).toBe(0);
          await createSession(conn, userIds[0], true, false, projectId);
          expect(
            conn.one(
              sql`update form_elements set body = ${createBody(
                "Field B"
              )} where id = ${fieldB.id} returning *`
            )
          ).rejects.toThrow();
          expect(
            conn.one(
              sql`delete from form_elements where id = ${fieldB.id} returning *`
            )
          ).rejects.toThrow();
        }
      );
    });

    test("CRUD operations are limited to admins (surveys)", async () => {
      let surveyId: number;
      let groupId: number;
      let formId: number;
      await verifyCRUDOpsLimitedToAdmins(pool, {
        create: async (conn, projectId, adminId, userIds) => {
          surveyId = (await conn.oneFirst(
            sql`insert into surveys (name, project_id) values ('Survey A', ${projectId}) returning id`
          )) as number;
          groupId = await createGroup(conn, projectId);
          return sql`select id from initialize_blank_survey_form(${surveyId})`;
        },
        update: false,
        delete: (recordId) => {
          return sql`delete from forms where survey_id = ${surveyId} returning *`;
        },
      });
    });

    test("are accessible to users who have access to the related sketch class", async () => {
      await verifyOnlyProjectGroupMembersCanAccessResource(
        pool,
        "form_elements",
        async (conn, projectId, groupId, adminId) => {
          await createSession(conn, adminId, true, false, projectId);
          const sketchClassId = await conn.oneFirst(
            sql`insert into sketch_classes (name, project_id) values ('Sketch Class A', ${projectId}) returning id`
          );
          await limitToGroup(conn, "sketch_class_id", sketchClassId, groupId);
          let form = await conn.one(
            sql`select * from initialize_blank_sketch_class_form(${sketchClassId})`
          );
          let field = await conn.one(
            sql`insert into form_elements (form_id, body, export_id, type_id) values (${
              form.id
            }, ${createBody(
              "field 1"
            )}, 'field_1', ${FormElementType}) returning *`
          );
          return field.id as number;
        }
      );
    });
  });
  test("must be tied to a form", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, userIds) => {
        await createSession(conn, adminId, true, false, projectId);
        const sketchClassId = await conn.oneFirst(
          sql`insert into sketch_classes (name, project_id) values ('Sketch Class A', ${projectId}) returning id`
        );
        const form = await conn.one(
          sql`select * from initialize_blank_sketch_class_form(${sketchClassId})`
        );
        expect(
          conn.one(
            sql`insert into form_elements (body, type_id) values (${createBody(
              "field a"
            )}, ${FormElementType}) returning *`
          )
        ).rejects.toThrow();
      }
    );
  });
  describe("updatePositions()", () => {
    test("updates the position of all fields in a form (sketch_class form)", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const sketchClassId = await conn.oneFirst(
            sql`insert into sketch_classes (name, project_id) values ('Sketch Class A', ${projectId}) returning id`
          );
          const form = await conn.one(
            sql`select * from initialize_blank_sketch_class_form(${sketchClassId})`
          );
          const fieldA = await conn.one(
            sql`insert into form_elements (form_id, body, export_id, type_id) values (${
              form.id
            }, ${createBody(
              "field a"
            )}, 'field_a', ${FormElementType}) returning *`
          );
          const fieldB = await conn.one(
            sql`insert into form_elements (form_id, body, export_id, type_id) values (${
              form.id
            }, ${createBody(
              "field b"
            )}, 'field_b', ${FormElementType}) returning *`
          );
          const fieldC = await conn.one(
            sql`insert into form_elements (form_id, body, export_id, type_id) values (${
              form.id
            }, ${createBody(
              "field c"
            )}, 'field_c', ${FormElementType}) returning *`
          );
          const fieldD = await conn.one(
            sql`insert into form_elements (form_id, body, export_id, type_id) values (${
              form.id
            }, ${createBody(
              "field d"
            )}, 'field_d', ${FormElementType}) returning *`
          );
          const fields = await conn.manyFirst(
            sql`select id from set_form_element_order(${sql.array(
              [fieldB.id, fieldD.id, fieldC.id],
              "int4"
            )})`
          );
          expect(fields.join(",")).toBe(
            [fieldB.id, fieldD.id, fieldC.id, fieldA.id].join(",")
          );
        }
      );
    });

    test("updates the position of all fields in a form (survey form)", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const surveyId = await conn.oneFirst(
            sql`insert into surveys (name, project_id) values ('Survey A', ${projectId}) returning id`
          );
          const form = await conn.one(
            sql`select * from initialize_blank_survey_form(${surveyId})`
          );
          const fieldA = await conn.one(
            sql`insert into form_elements (form_id, body, export_id, type_id) values (${
              form.id
            }, ${createBody(
              "field a"
            )}, 'field_a', ${FormElementType}) returning *`
          );
          const fieldB = await conn.one(
            sql`insert into form_elements (form_id, body, export_id, type_id) values (${
              form.id
            }, ${createBody(
              "field b"
            )}, 'field_b', ${FormElementType}) returning *`
          );
          const fieldC = await conn.one(
            sql`insert into form_elements (form_id, body, export_id, type_id) values (${
              form.id
            }, ${createBody(
              "field c"
            )}, 'field_c', ${FormElementType}) returning *`
          );
          const fieldD = await conn.one(
            sql`insert into form_elements (form_id, body, export_id, type_id) values (${
              form.id
            }, ${createBody(
              "field d"
            )}, 'field_d', ${FormElementType}) returning *`
          );
          const fields = await conn.manyFirst(
            sql`select id from set_form_element_order(${sql.array(
              [fieldB.id, fieldD.id, fieldC.id],
              "int4"
            )})`
          );
          expect(fields.join(",")).toBe(
            [fieldB.id, fieldD.id, fieldC.id, fieldA.id].join(",")
          );
        }
      );
    });

    test("can only be called by admins", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const sketchClassId = await conn.oneFirst(
            sql`insert into sketch_classes (name, project_id) values ('Sketch Class A', ${projectId}) returning id`
          );
          const form = await conn.one(
            sql`select * from initialize_blank_sketch_class_form(${sketchClassId})`
          );
          const fieldA = await conn.one(
            sql`insert into form_elements (form_id, body, export_id, type_id) values (${
              form.id
            }, ${createBody(
              "field a"
            )}, 'field_a', ${FormElementType}) returning *`
          );
          const fieldB = await conn.one(
            sql`insert into form_elements (form_id, body, export_id, type_id) values (${
              form.id
            }, ${createBody(
              "field b"
            )}, 'field_b', ${FormElementType}) returning *`
          );
          await createSession(conn, userIds[0], true, false, projectId);
          expect(
            conn.manyFirst(
              sql`select id from set_form_element_order(${sql.array(
                [fieldB.id, fieldA.id],
                "int4"
              )})`
            )
          ).rejects.toThrow(/admin/i);
        }
      );
    });
  });
});

describe("Conditional Field Rendering Rules", () => {
  test("CRUD operations limited to admins (sketch_classes)", async () => {
    await verifyCRUDOpsLimitedToAdmins(pool, {
      create: async (conn, projectId, adminId, userIds) => {
        const sketchClassId = await conn.oneFirst(
          sql`insert into sketch_classes (name, project_id) values ('Sketch Class A', ${projectId}) returning id`
        );
        const form = await conn.one(
          sql`select * from initialize_blank_sketch_class_form(${sketchClassId})`
        );
        const fieldA = await conn.one(
          sql`insert into form_elements (form_id, body, export_id, type_id) values (${
            form.id
          }, ${createBody(
            "field a"
          )}, 'field_a', ${FormElementType}) returning *`
        );
        const fieldB = await conn.one(
          sql`insert into form_elements (form_id, body, export_id, type_id) values (${
            form.id
          }, ${createBody(
            "field b"
          )}, 'field_b', ${FormElementType}) returning *`
        );
        return sql`insert into form_conditional_rendering_rules (field_id, predicate_field_id, value, operator) values (${
          fieldB.id
        }, ${fieldA.id}, ${3}, '=') returning *`;
      },
      update: (recordId) =>
        sql`update form_conditional_rendering_rules set operator = '<' where id = ${recordId} returning *`,
      delete: (recordId) => {
        return sql`delete from form_conditional_rendering_rules where id = ${recordId} returning *`;
      },
    });
  });

  test("CRUD operations limited to admins (surveys)", async () => {
    await verifyCRUDOpsLimitedToAdmins(pool, {
      create: async (conn, projectId, adminId, userIds) => {
        const surveyId = await conn.oneFirst(
          sql`insert into surveys (name, project_id) values ('Survey A', ${projectId}) returning id`
        );
        const form = await conn.one(
          sql`select * from initialize_blank_survey_form(${surveyId})`
        );
        const fieldA = await conn.one(
          sql`insert into form_elements (form_id, body, export_id, type_id) values (${
            form.id
          }, ${createBody(
            "field a"
          )}, 'field_a', ${FormElementType}) returning *`
        );
        const fieldB = await conn.one(
          sql`insert into form_elements (form_id, body, export_id, type_id) values (${
            form.id
          }, ${createBody(
            "field b"
          )}, 'field_b', ${FormElementType}) returning *`
        );
        return sql`insert into form_conditional_rendering_rules (field_id, predicate_field_id, value, operator) values (${
          fieldB.id
        }, ${fieldA.id}, ${3}, '=') returning *`;
      },
      update: (recordId) =>
        sql`update form_conditional_rendering_rules set operator = '<' where id = ${recordId} returning *`,
      delete: (recordId) => {
        return sql`delete from form_conditional_rendering_rules where id = ${recordId} returning *`;
      },
    });
  });

  test("Can be viewed by anyone", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, userIds) => {
        await createSession(conn, adminId, true, false, projectId);
        const sketchClassId = await conn.oneFirst(
          sql`insert into sketch_classes (name, project_id) values ('Sketch Class A', ${projectId}) returning id`
        );
        const form = await conn.one(
          sql`select * from initialize_blank_sketch_class_form(${sketchClassId})`
        );
        const fieldA = await conn.one(
          sql`insert into form_elements (form_id, body, export_id, type_id) values (${
            form.id
          }, ${createBody(
            "field a"
          )}, 'field_a', ${FormElementType}) returning *`
        );
        const fieldB = await conn.one(
          sql`insert into form_elements (form_id, body, export_id, type_id) values (${
            form.id
          }, ${createBody(
            "field b"
          )}, 'field_b', ${FormElementType}) returning *`
        );
        const rule = await conn.one(
          sql`insert into form_conditional_rendering_rules (field_id, predicate_field_id, value, operator) values (${
            fieldB.id
          }, ${fieldA.id}, ${3}, '=') returning *`
        );
        expect(rule.field_id).toBe(fieldB.id);
        await createSession(conn, userIds[0], true, false, projectId);
        const rules = await conn.many(
          sql`select * from form_conditional_rendering_rules`
        );
        expect(rules.length).toBe(1);
      }
    );
  });
});

test("export_id will be generated from body if blank", () => {
  const body = createBody("This is my question, it is really long");
  const exportId = createExportId(1, body.value!);
  expect(exportId).toBe("this_is_my_question_it_is_really");
  expect(createExportId(12, createBody("short"))).toBe("form_element_12");
});

test("export_id can be explicitly set", () => {
  const body = createBody("This is my question, it is really long");
  expect(createExportId(12, body, "my_export_id")).toBe("my_export_id");
});
