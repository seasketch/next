/// <reference types="jest" />
import { sql } from "slonik";
import { createPool } from "./pool";
import { createSession, projectTransaction, uniqueSlug } from "./helpers";

const pool = createPool("test");

describe("projects_draft_reports", () => {
  test("returns this project's drafts, including unassigned reports, and skips published copies", async () => {
    await projectTransaction(
      pool,
      "admins_only",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId);
        const otherProjectId = (await conn.oneFirst(
          sql`select id from create_project('Other', ${uniqueSlug()})`
        )) as number;
        const sketchClassId = (await conn.oneFirst(
          sql`insert into sketch_classes (project_id, name, geometry_type)
              values (${projectId}, 'MPA', 'COLLECTION')
              returning id`
        )) as number;
        const assignedId = (await conn.oneFirst(
          sql`insert into reports (project_id, sketch_class_id, title)
              values (${projectId}, ${sketchClassId}, 'Zebra report')
              returning id`
        )) as number;
        const unassignedId = (await conn.oneFirst(
          sql`insert into reports (project_id, title)
              values (${projectId}, 'Alpha report')
              returning id`
        )) as number;
        await conn.query(sql`
          insert into reports (
            project_id, sketch_class_id, title, version, draft_id, published_at
          )
          values (
            ${projectId}, ${sketchClassId}, 'Published zebra', 1, ${assignedId}, now()
          )
        `);
        await conn.query(sql`
          insert into reports (project_id, title)
          values (${otherProjectId}, 'Other project')
        `);

        const rows = await conn.any(sql`
          select r.id, r.title
          from projects p
          cross join lateral public.projects_draft_reports(p) r
          where p.id = ${projectId}
        `);

        expect(rows.map((row) => row.id)).toEqual(
          expect.arrayContaining([unassignedId, assignedId])
        );
        const titles = rows.map((row) => row.title);
        expect(titles).toContain("Alpha report");
        expect(titles).toContain("Zebra report");
        expect(titles).not.toContain("Published zebra");
        expect(titles).not.toContain("Other project");
        expect(titles.indexOf("Alpha report")).toBeLessThan(
          titles.indexOf("Zebra report")
        );
      }
    );
  });
});
