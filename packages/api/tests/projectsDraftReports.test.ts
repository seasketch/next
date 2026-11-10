/// <reference types="jest" />
import { sql } from "slonik";
import { createPool } from "./pool";
import {
  clearSession,
  createProject,
  createSession,
  projectTransaction,
} from "./helpers";

const pool = createPool("test");

describe("projects_draft_reports", () => {
  test("returns every draft in the project and skips published copies and other projects", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await clearSession(conn);
        await createSession(conn, adminId);

        const otherProjectId = await createProject(conn, adminId, "public");
        await createSession(conn, adminId);

        const zetaId = (await conn.oneFirst(
          sql`insert into reports (project_id, title)
              values (${projectId}, 'Zeta draft')
              returning id`
        )) as number;
        const alphaId = (await conn.oneFirst(
          sql`insert into reports (project_id, title)
              values (${projectId}, 'Alpha draft')
              returning id`
        )) as number;
        await conn.any(
          sql`insert into reports (project_id, title, version, draft_id)
              values (${projectId}, 'Alpha published', 1, ${alphaId})`
        );
        await conn.any(
          sql`insert into reports (project_id, title)
              values (${otherProjectId}, 'Other project draft')`
        );

        const rows = await conn.any(
          sql`select id, title
              from public.projects_draft_reports(
                (select p from public.projects p where p.id = ${projectId})
              )`
        );

        const titles = rows.map((row) => row.title);
        const sortedTitles = [...titles].sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" })
        );
        expect(titles).toEqual(sortedTitles);
        expect(rows).toEqual(
          expect.arrayContaining([
            { id: alphaId, title: "Alpha draft" },
            { id: zetaId, title: "Zeta draft" },
          ])
        );
        expect(titles).not.toContain("Alpha published");
        expect(titles).not.toContain("Other project draft");
      }
    );
  });
});
