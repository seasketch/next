/// <reference types="jest" />
import { DatabaseTransactionConnectionType, sql } from "slonik";
import { createPool } from "./pool";
import { createSession, projectTransaction } from "./helpers";

const pool = createPool("test");

async function surveySketchClassId(
  conn: DatabaseTransactionConnectionType,
  projectId: number
) {
  const surveyId = await conn.oneFirst<number>(
    sql`select id from make_survey('Survey A', ${projectId}, null)`
  );
  const formId = await conn.oneFirst<number>(
    sql`select id from forms where survey_id = ${surveyId}`
  );
  const elementId = await conn.oneFirst<number>(
    sql`insert into form_elements (form_id, type_id, body)
        values (${formId}, 'MultiSpatialInput', '{}'::jsonb)
        returning id`
  );
  return conn.oneFirst<number>(
    sql`select id from sketch_classes where form_element_id = ${elementId}`
  );
}

describe("report assignment ignores survey sketch classes", () => {
  test("create_custom_report rejects a survey sketch class and does not create a report", async () => {
    await projectTransaction(pool, "admins_only", async (conn, projectId, adminId) => {
      await createSession(conn, adminId, true, false, projectId);
      const surveyClassId = await surveySketchClassId(conn, projectId);
      const mpaId = await conn.oneFirst<number>(
        sql`insert into sketch_classes (project_id, name, geometry_type)
            values (${projectId}, 'MPA', 'COLLECTION')
            returning id`
      );

      await conn.query(sql`savepoint before_reject`);
      await expect(
        conn.any(sql`
          select id from create_custom_report(
            ${projectId},
            'Should fail',
            ${sql.array([surveyClassId, mpaId], "int4")}
          )
        `)
      ).rejects.toThrow(/survey question/i);
      await conn.query(sql`rollback to savepoint before_reject`);

      const reportCount = await conn.oneFirst<number>(
        sql`select count(*)::int from reports where project_id = ${projectId} and title = 'Should fail'`
      );
      const surveyAssignment = await conn.oneFirst(
        sql`select get_primary_draft_report_id_for_sketch_class(${surveyClassId})`
      );
      const mpaAssignment = await conn.oneFirst(
        sql`select get_primary_draft_report_id_for_sketch_class(${mpaId})`
      );
      expect(reportCount).toBe(0);
      expect(surveyAssignment).toBeNull();
      expect(mpaAssignment).toBeNull();
    });
  });

  test("set_primary_report_for_sketch_class rejects a survey sketch class", async () => {
    await projectTransaction(pool, "admins_only", async (conn, projectId, adminId) => {
      await createSession(conn, adminId, true, false, projectId);
      const surveyClassId = await surveySketchClassId(conn, projectId);
      const reportId = await conn.oneFirst<number>(
        sql`insert into reports (project_id, title)
            values (${projectId}, 'MPA report')
            returning id`
      );

      await expect(
        conn.any(sql`
          select id from set_primary_report_for_sketch_class(
            ${surveyClassId},
            ${reportId}
          )
        `)
      ).rejects.toThrow(/survey question/i);
    });
  });

  test("project sketch classes can still be assigned", async () => {
    await projectTransaction(pool, "admins_only", async (conn, projectId, adminId) => {
      await createSession(conn, adminId, true, false, projectId);
      const mpaId = await conn.oneFirst<number>(
        sql`insert into sketch_classes (project_id, name, geometry_type)
            values (${projectId}, 'MPA', 'COLLECTION')
            returning id`
      );
      const reportId = await conn.oneFirst<number>(
        sql`select id from create_custom_report(
              ${projectId},
              'MPA report',
              ${sql.array([mpaId], "int4")}
            )`
      );
      const assignedId = await conn.oneFirst<number>(
        sql`select get_primary_draft_report_id_for_sketch_class(${mpaId})`
      );
      expect(assignedId).toBe(reportId);

      const replacementId = await conn.oneFirst<number>(
        sql`insert into reports (project_id, title)
            values (${projectId}, 'Replacement')
            returning id`
      );
      await conn.any(sql`
        select id from set_primary_report_for_sketch_class(${mpaId}, ${replacementId})
      `);
      const primaryId = await conn.oneFirst<number>(
        sql`select get_primary_draft_report_id_for_sketch_class(${mpaId})`
      );
      expect(primaryId).toBe(replacementId);
    });
  });
});
