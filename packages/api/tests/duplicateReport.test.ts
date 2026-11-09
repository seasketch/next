/// <reference types="jest" />
import { sql } from "slonik";
import { createPool } from "./pool";
import { clearSession, createSession, projectTransaction } from "./helpers";

const pool = createPool("test");

describe("duplicate_report", () => {
  test("copies tabs and cards into an unassigned draft and leaves the original assignment", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [otherUser]) => {
        await clearSession(conn);
        const sketchClassId = (await conn.oneFirst(
          sql`insert into sketch_classes (project_id, name, geometry_type)
              values (${projectId}, 'MPA', 'COLLECTION')
              returning id`
        )) as number;
        const reportId = (await conn.oneFirst(
          sql`insert into reports (project_id, sketch_class_id, title)
              values (${projectId}, ${sketchClassId}, 'MPA GG')
              returning id`
        )) as number;
        await conn.any(
          sql`insert into sketch_class_reports (sketch_class_id, draft_report_id, is_primary)
              values (${sketchClassId}, ${reportId}, true)`
        );

        const viabilityId = (await conn.oneFirst(
          sql`insert into report_tabs (report_id, title, position, alternate_language_settings)
              values (
                ${reportId},
                'Viability',
                0,
                ${sql.json({ es: { title: "Viabilidad" } })}
              )
              returning id`
        )) as number;
        const representationId = (await conn.oneFirst(
          sql`insert into report_tabs (report_id, title, position, alternate_language_settings)
              values (${reportId}, 'Representation', 2, '{}'::jsonb)
              returning id`
        )) as number;

        const sizeBody = {
          type: "doc",
          content: [
            {
              type: "reportTitle",
              content: [{ type: "text", text: "Size" }],
            },
          ],
        };
        const fishingBody = {
          type: "doc",
          content: [
            {
              type: "reportTitle",
              content: [{ type: "text", text: "Fishing" }],
            },
          ],
        };
        const sizeSettings = { type: "textBlock", copiedFromCardId: 9 };
        const fishingSettings = { type: "overlayTable", layerId: 4 };

        await conn.any(
          sql`insert into report_cards (
                report_tab_id, position, body, component_settings, alternate_language_settings, is_draft
              ) values (
                ${viabilityId},
                0,
                ${sql.json(sizeBody)},
                ${sql.json(sizeSettings)},
                ${sql.json({ es: { title: "Tamaño" } })},
                true
              )`
        );
        await conn.any(
          sql`insert into report_cards (
                report_tab_id, position, body, component_settings, alternate_language_settings
              ) values (
                ${viabilityId},
                3,
                ${sql.json(fishingBody)},
                ${sql.json(fishingSettings)},
                '{}'::jsonb
              )`
        );
        await conn.any(
          sql`insert into report_cards (report_tab_id, position, body, component_settings)
              values (
                ${representationId},
                0,
                ${sql.json({ type: "doc", content: [] })},
                ${sql.json({ type: "textBlock" })}
              )`
        );

        await createSession(conn, adminId);
        const copy = await conn.one<{
          id: number;
          project_id: number;
          sketch_class_id: number | null;
          title: string;
          version: number;
          draft_id: number | null;
          published_at: string | null;
        }>(sql`select * from duplicate_report(${reportId})`);

        expect(copy.id).not.toBe(reportId);
        expect(copy.project_id).toBe(projectId);
        expect(copy.title).toBe("MPA GG (copy)");
        expect(copy.sketch_class_id).toBeNull();
        expect(copy.version).toBe(0);
        expect(copy.draft_id).toBeNull();
        expect(copy.published_at).toBeNull();

        await clearSession(conn);
        const primaryId = await conn.oneFirst(
          sql`select draft_report_id
              from sketch_class_reports
              where sketch_class_id = ${sketchClassId} and is_primary`
        );
        expect(primaryId).toBe(reportId);
        const copyAssignments = await conn.any(
          sql`select 1 from sketch_class_reports where draft_report_id = ${copy.id}`
        );
        expect(copyAssignments).toHaveLength(0);

        const copiedTabs = await conn.any<{
          title: string;
          position: number;
          alternate_language_settings: { es?: { title: string } };
          cards: Array<{
            position: number;
            body: { type: string };
            component_settings: { type: string; copiedFromCardId?: number };
            alternate_language_settings: { es?: { title: string } };
            is_draft: boolean;
          }>;
        }>(sql`
          select
            rt.title,
            rt.position,
            rt.alternate_language_settings,
            coalesce(
              (
                select json_agg(
                  json_build_object(
                    'position', rc.position,
                    'body', rc.body,
                    'component_settings', rc.component_settings,
                    'alternate_language_settings', rc.alternate_language_settings,
                    'is_draft', rc.is_draft
                  )
                  order by rc.position
                )
                from report_cards rc
                where rc.report_tab_id = rt.id
              ),
              '[]'::json
            ) as cards
          from report_tabs rt
          where rt.report_id = ${copy.id}
          order by rt.position
        `);

        expect(copiedTabs).toHaveLength(2);
        expect(copiedTabs[0].title).toBe("Viability");
        expect(copiedTabs[0].position).toBe(0);
        expect(copiedTabs[0].alternate_language_settings).toEqual({
          es: { title: "Viabilidad" },
        });
        expect(copiedTabs[0].cards).toEqual([
          {
            position: 0,
            body: sizeBody,
            component_settings: sizeSettings,
            alternate_language_settings: { es: { title: "Tamaño" } },
            is_draft: true,
          },
          {
            position: 3,
            body: fishingBody,
            component_settings: fishingSettings,
            alternate_language_settings: {},
            is_draft: true,
          },
        ]);
        expect(copiedTabs[1].title).toBe("Representation");
        expect(copiedTabs[1].position).toBe(2);
        expect(copiedTabs[1].cards).toHaveLength(1);
        expect(copiedTabs[1].cards[0].position).toBe(0);

        const sourceCardCount = await conn.oneFirst(
          sql`select count(*)
              from report_cards rc
              join report_tabs rt on rt.id = rc.report_tab_id
              where rt.report_id = ${reportId}`
        );
        expect(Number(sourceCardCount)).toBe(3);

        await createSession(conn, adminId);
        const second = await conn.one<{ id: number; title: string }>(
          sql`select id, title from duplicate_report(${reportId})`
        );
        expect(second.id).not.toBe(copy.id);
        expect(second.title).toBe("MPA GG (copy 2)");

        const renamed = await conn.oneFirst(
          sql`update reports set title = 'Working copy' where id = ${copy.id} returning title`
        );
        expect(renamed).toBe("Working copy");

        await createSession(conn, otherUser);
        const blockedRename = await conn.maybeOne(
          sql`update reports set title = 'hacked' where id = ${copy.id} returning id`
        );
        expect(blockedRename).toBeNull();

        await expect(
          conn.transaction((nested) =>
            nested.any(sql`select duplicate_report(${reportId})`)
          )
        ).rejects.toThrow(/not authorized/);

        await createSession(conn, adminId);
        const deleted = await conn.oneFirst(
          sql`delete from reports where id = ${copy.id} returning id`
        );
        expect(deleted).toBe(copy.id);

        const publishedId = (await conn.oneFirst(
          sql`insert into reports (project_id, sketch_class_id, title, version, draft_id, published_at)
              values (${projectId}, ${sketchClassId}, 'MPA GG', 1, ${reportId}, now())
              returning id`
        )) as number;
        await expect(
          conn.transaction((nested) =>
            nested.any(sql`select duplicate_report(${publishedId})`)
          )
        ).rejects.toThrow(/Only draft reports can be duplicated/);

        await expect(
          conn.transaction((nested) =>
            nested.any(sql`select duplicate_report(${-1})`)
          )
        ).rejects.toThrow(/Report not found/);
      }
    );
  });
});
