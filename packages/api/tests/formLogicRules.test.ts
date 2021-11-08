import { DatabaseTransactionConnectionType, sql, SqlTokenType } from "slonik";
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
  await pool.any(
    sql`insert into form_element_types (component_name, label, is_input, supported_operators) values (${FormElementType}, ${FormElementType}, true, '{"="}')`
  );
});

async function createForm(
  callback: (
    conn: DatabaseTransactionConnectionType,
    formId: number,
    projectId: number,
    adminId: number,
    userIds: [number, number]
  ) => void
) {
  await projectTransaction(
    pool,
    "public",
    async (conn, projectId, adminId, userIds) => {
      await createSession(conn, adminId, true, false, projectId);
      const surveyId = await conn.oneFirst(
        sql`select id from make_survey('Survey A', ${projectId}, null)`
      );
      const formId = await conn.oneFirst<number>(
        sql`select id from forms where survey_id = ${surveyId}`
      );
      await callback(conn, formId, projectId, adminId, userIds);
    }
  );
}

describe("form_logic_rules", () => {
  test("jump_to_id must be set if command is 'JUMP'", async () => {
    await createForm(async (conn, formId, projectId, adminId, userIds) => {
      const formElementId = await conn.oneFirst<number>(
        sql`insert into form_elements (type_id, form_id, body) values (${FormElementType}, ${formId}, '{}'::jsonb) returning id`
      );
      expect(
        conn.any(
          sql`insert into form_logic_rules(form_element_id, command) values (${formElementId}, 'JUMP') returning *`
        )
      ).rejects.toThrow(/jump_to_id/);
    });
  });
  test("jump_to_id must be null if command is 'HIDE' or 'SHOW'", async () => {
    await createForm(async (conn, formId, projectId, adminId, userIds) => {
      const formElementId = await conn.oneFirst<number>(
        sql`insert into form_elements (type_id, form_id, body) values (${FormElementType}, ${formId}, '{}'::jsonb) returning id`
      );
      expect(
        conn.any(
          sql`insert into form_logic_rules(form_element_id, command, jump_to_id) values (${formElementId}, 'SHOW', 1) returning *`
        )
      ).rejects.toThrow(/jump_to_id/);
    });
  });
  test("position is set on insert so that new rules appear at end of list", async () => {
    await createForm(async (conn, formId, projectId, adminId, userIds) => {
      const formElementId = await conn.oneFirst<number>(
        sql`insert into form_elements (type_id, form_id, body) values (${FormElementType}, ${formId}, '{}'::jsonb) returning id`
      );
      const formElement2Id = await conn.oneFirst<number>(
        sql`insert into form_elements (type_id, form_id, body) values (${FormElementType}, ${formId}, '{}'::jsonb) returning id`
      );
      const rule1 = await conn.one(
        sql`insert into form_logic_rules(form_element_id, command, jump_to_id) values (${formElementId}, 'JUMP', ${formElement2Id}) returning *`
      );
      const rule2 = await conn.one(
        sql`insert into form_logic_rules(form_element_id, command, jump_to_id) values (${formElementId}, 'JUMP', ${formElement2Id}) returning *`
      );
      expect(rule2.position).toBeGreaterThan(rule1.position as number);
    });
  });
  describe("Access Control", () => {
    test("Read-only to everyone", async () => {
      await createForm(async (conn, formId, projectId, adminId, userIds) => {
        const formElementId = await conn.oneFirst<number>(
          sql`insert into form_elements (type_id, form_id, body) values (${FormElementType}, ${formId}, '{}'::jsonb) returning id`
        );
        const formElement2Id = await conn.oneFirst<number>(
          sql`insert into form_elements (type_id, form_id, body) values (${FormElementType}, ${formId}, '{}'::jsonb) returning id`
        );
        const rule1 = await conn.one(
          sql`insert into form_logic_rules(form_element_id, command, jump_to_id) values (${formElementId}, 'JUMP', ${formElement2Id}) returning *`
        );
        const rule2 = await conn.one(
          sql`insert into form_logic_rules(form_element_id, command, jump_to_id) values (${formElementId}, 'JUMP', ${formElement2Id}) returning *`
        );
        await createSession(conn, undefined);
        const rules = await conn.many(
          sql`select forms_logic_rules(forms.*) from forms where id = ${formId}`
        );
        expect(rules.length).toBe(2);
      });
    });
    test("Inserts and updates limited to project admins", async () => {
      await verifyCRUDOpsLimitedToAdmins(pool, {
        create: async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const surveyId = await conn.oneFirst(
            sql`select id from make_survey('Survey A', ${projectId}, null)`
          );
          const formId = await conn.oneFirst<number>(
            sql`select id from forms where survey_id = ${surveyId}`
          );
          const formElementId = await conn.oneFirst<number>(
            sql`insert into form_elements (type_id, form_id, body) values (${FormElementType}, ${formId}, '{}'::jsonb) returning id`
          );
          const formElement2Id = await conn.oneFirst<number>(
            sql`insert into form_elements (type_id, form_id, body) values (${FormElementType}, ${formId}, '{}'::jsonb) returning id`
          );
          return sql`insert into form_logic_rules(form_element_id, command, jump_to_id) values (${formElementId}, 'JUMP', ${formElement2Id}) returning *`;
        },
        update: (recordId) =>
          sql`update form_logic_rules set command = 'HIDE', jump_to_id = null where id = ${recordId} returning *`,
        delete: (recordId) => {
          return sql`delete from form_logic_rules where id = ${recordId} returning *`;
        },
      });
    });
  });
  describe("reorder_form_logic_rules", () => {
    test("sets position of all form_logic_rules", async () => {
      await createForm(async (conn, formId, projectId, adminId, userIds) => {
        const formElementId = await conn.oneFirst<number>(
          sql`insert into form_elements (type_id, form_id, body) values (${FormElementType}, ${formId}, '{}'::jsonb) returning id`
        );
        const formElement2Id = await conn.oneFirst<number>(
          sql`insert into form_elements (type_id, form_id, body) values (${FormElementType}, ${formId}, '{}'::jsonb) returning id`
        );
        const rule1 = await conn.one(
          sql`insert into form_logic_rules(form_element_id, command, jump_to_id) values (${formElementId}, 'JUMP', ${formElement2Id}) returning *`
        );
        const rule2 = await conn.one(
          sql`insert into form_logic_rules(form_element_id, command, jump_to_id) values (${formElementId}, 'JUMP', ${formElement2Id}) returning *`
        );
        const rule3 = await conn.one(
          sql`insert into form_logic_rules(form_element_id, command, jump_to_id) values (${formElementId}, 'JUMP', ${formElement2Id}) returning *`
        );
        expect(rule2.position).toBeGreaterThan(rule1.position as number);
        const records = await conn.many(
          sql`select * from set_form_logic_rule_order(${sql.array(
            [rule3.id, rule1.id, rule2.id],
            "int4"
          )}) order by position asc`
        );
        expect(records.map((r) => r.id)).toStrictEqual([
          rule3.id,
          rule1.id,
          rule2.id,
        ]);
      });
    });
    test("limited to project admins", async () => {
      await createForm(async (conn, formId, projectId, adminId, userIds) => {
        const formElementId = await conn.oneFirst<number>(
          sql`insert into form_elements (type_id, form_id, body) values (${FormElementType}, ${formId}, '{}'::jsonb) returning id`
        );
        const formElement2Id = await conn.oneFirst<number>(
          sql`insert into form_elements (type_id, form_id, body) values (${FormElementType}, ${formId}, '{}'::jsonb) returning id`
        );
        const rule1 = await conn.one(
          sql`insert into form_logic_rules(form_element_id, command, jump_to_id) values (${formElementId}, 'JUMP', ${formElement2Id}) returning *`
        );
        const rule2 = await conn.one(
          sql`insert into form_logic_rules(form_element_id, command, jump_to_id) values (${formElementId}, 'JUMP', ${formElement2Id}) returning *`
        );
        const rule3 = await conn.one(
          sql`insert into form_logic_rules(form_element_id, command, jump_to_id) values (${formElementId}, 'JUMP', ${formElement2Id}) returning *`
        );
        expect(rule2.position).toBeGreaterThan(rule1.position as number);
        await createSession(conn, userIds[0]);
        expect(
          conn.many(
            sql`select * from set_form_logic_rule_order(${sql.array(
              [rule3.id, rule1.id, rule2.id],
              "int4"
            )}) order by position asc`
          )
        ).rejects.toThrow(/Permission/);
      });
    });
  });
});

describe("form_logic_conditions", () => {
  describe("Access Control", () => {
    test("Read-only to everyone", async () => {
      await createForm(async (conn, formId, projectId, adminId, userIds) => {
        const formElementId = await conn.oneFirst<number>(
          sql`insert into form_elements (type_id, form_id, body) values (${FormElementType}, ${formId}, '{}'::jsonb) returning id`
        );
        const formElement2Id = await conn.oneFirst<number>(
          sql`insert into form_elements (type_id, form_id, body) values (${FormElementType}, ${formId}, '{}'::jsonb) returning id`
        );
        const rule = await conn.one(
          sql`insert into form_logic_rules(form_element_id, command, jump_to_id) values (${formElementId}, 'JUMP', ${formElement2Id}) returning *`
        );
        const condition = await conn.one(
          sql`insert into form_logic_conditions (rule_id, subject_id, operator, value) values (${rule.id}, ${formElementId}, '=', 'true'::json) returning *`
        );
        await createSession(conn);
        expect(
          await conn.oneFirst<number>(
            sql`select count(*) from form_logic_conditions`
          )
        ).toBe(1);
      });
    });
    test("Inserts and updates limited to project admins", async () => {
      await verifyCRUDOpsLimitedToAdmins(pool, {
        create: async (conn, projectId, adminId, userIds) => {
          await createSession(conn, adminId, true, false, projectId);
          const surveyId = await conn.oneFirst(
            sql`select id from make_survey('Survey A', ${projectId}, null)`
          );
          const formId = await conn.oneFirst<number>(
            sql`select id from forms where survey_id = ${surveyId}`
          );
          const formElementId = await conn.oneFirst<number>(
            sql`insert into form_elements (type_id, form_id, body) values (${FormElementType}, ${formId}, '{}'::jsonb) returning id`
          );
          const formElement2Id = await conn.oneFirst<number>(
            sql`insert into form_elements (type_id, form_id, body) values (${FormElementType}, ${formId}, '{}'::jsonb) returning id`
          );
          const ruleId = await conn.oneFirst<number>(
            sql`insert into form_logic_rules(form_element_id, command, jump_to_id) values (${formElementId}, 'JUMP', ${formElement2Id}) returning id`
          );
          return sql`insert into form_logic_conditions (rule_id, subject_id) values (${ruleId}, ${formElementId}) returning *`;
        },
        update: (recordId) =>
          sql`update form_logic_conditions set value = 'false'::jsonb where id = ${recordId} returning *`,
        delete: (recordId) => {
          return sql`delete from form_logic_conditions where id = ${recordId} returning *`;
        },
      });
    });
  });
  test("operator can only be set to those supported by the form_element_type of the subject", async () => {
    await createForm(async (conn, formId, projectId, adminId, userIds) => {
      const formElementId = await conn.oneFirst<number>(
        sql`insert into form_elements (type_id, form_id, body) values (${FormElementType}, ${formId}, '{}'::jsonb) returning id`
      );
      const formElement2Id = await conn.oneFirst<number>(
        sql`insert into form_elements (type_id, form_id, body) values (${FormElementType}, ${formId}, '{}'::jsonb) returning id`
      );
      const rule = await conn.one(
        sql`insert into form_logic_rules(form_element_id, command, jump_to_id) values (${formElementId}, 'JUMP', ${formElement2Id}) returning *`
      );
      expect(
        conn.any(
          sql`insert into form_logic_conditions (rule_id, subject_id, operator) values (${rule.id}, ${formElementId}, 'is blank') returning *`
        )
      ).rejects.toThrow(/operator/i);
    });
  });
});
