import { expect, describe, test } from "@jest/globals";
import { sql } from "slonik";
import { createPool } from "./pool";
import { projectTransaction, createSession, clearSession } from "./helpers";
import * as nanoid from "nanoid";

const pool = createPool("test");

describe("report_card_layers minimal flow", () => {
  test("admin can link a report card to an allowed TOC layer (same project)", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        // 1) Create a sketch class and draft report
        await createSession(conn, adminId, true, false, projectId);
        const sketchClassId = await conn.oneFirst<number>(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name) values ('[]'::jsonb, ${projectId}, 'SC') returning id`
        );
        const draftReportId = await conn.oneFirst<number>(
          sql`select id from create_draft_report(${sketchClassId})`
        );

        // 2) Create a new tab and card via SECURITY DEFINER fns (avoid direct table RLS)
        const tab = await conn.one<{ id: number }>(
          sql`select * from add_report_tab(${draftReportId}, 'Test Tab', 1)`
        );
        const card = await conn.one<{ id: number }>(
          sql`select * from add_report_card(${tab.id}, ${sql.json(
            {}
          )}, ${"Test"}, ${sql.json({ type: "doc", content: [] })})`
        );

        // 3) Create an allowed layer (seasketch-vector) and a TOC item in same project
        const sourceId = await conn.oneFirst<number>(
          sql`insert into data_sources (project_id, type, url, import_type, byte_length) values (${projectId}, 'seasketch-vector', 'https://example.com/data.pmtiles', 'upload', 0) returning id`
        );
        const layerId = await conn.oneFirst<number>(
          sql`insert into data_layers (project_id, data_source_id, mapbox_gl_styles) values (${projectId}, ${sourceId}, ${sql.json(
            { foo: "bar" }
          )}) returning id`
        );
        const alphabet =
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
        const makeId = nanoid.customAlphabet(alphabet, 9);
        const stableId = makeId();
        await conn.oneFirst<number>(
          sql`insert into table_of_contents_items (project_id, title, is_folder, data_layer_id, stable_id) values (${projectId}, 'Layer', false, ${layerId}, ${stableId}) returning id`
        );

        // 4) Link the card to the TOC item via join table
        await conn.any(
          sql`insert into report_card_layers (report_card_id, toc_stable_id) values (${card.id}, ${stableId})`
        );
        await clearSession(conn);

        // 5) Assert link exists using report_cards_layers()
        const count = await conn.oneFirst<number>(
          sql`select count(*) from report_cards rc, LATERAL report_cards_layers(rc) t where rc.id = ${card.id}`
        );
        expect(count).toBe(1);
      }
    );
  });

  test("rejects invalid toc_stable_id", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        // Setup: draft report with card
        await createSession(conn, adminId, true, false, projectId);
        const sketchClassId = await conn.oneFirst<number>(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name) values ('[]'::jsonb, ${projectId}, 'SC') returning id`
        );
        const draftReportId = await conn.oneFirst<number>(
          sql`select id from create_draft_report(${sketchClassId})`
        );
        const tab = await conn.one<{ id: number }>(
          sql`select * from add_report_tab(${draftReportId}, 'Test Tab', 1)`
        );
        const card = await conn.one<{ id: number }>(
          sql`select * from add_report_card(${tab.id}, ${sql.json(
            {}
          )}, ${"Test"}, ${sql.json({ type: "doc", content: [] })})`
        );

        // Attempt to link to non-existent stable_id
        await conn.any(sql`SAVEPOINT before_invalid`);
        await expect(
          conn.any(
            sql`insert into report_card_layers (report_card_id, toc_stable_id) values (${
              card.id
            }, ${"does-not-exist"})`
          )
        ).rejects.toThrow(/toc_stable_id/i);
        await conn.any(sql`ROLLBACK to before_invalid`);
        await clearSession(conn);
      }
    );
  });

  test("rejects cross-project toc_stable_id", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        // Setup: draft report with card in project A
        await createSession(conn, adminId, true, false, projectId);
        const scA = await conn.oneFirst<number>(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name) values ('[]'::jsonb, ${projectId}, 'SC-A') returning id`
        );
        const draftA = await conn.oneFirst<number>(
          sql`select id from create_draft_report(${scA})`
        );
        const tabA = await conn.one<{ id: number }>(
          sql`select * from add_report_tab(${draftA}, 'Tab A', 1)`
        );
        const cardA = await conn.one<{ id: number }>(
          sql`select * from add_report_card(${tabA.id}, ${sql.json(
            {}
          )}, ${"Test"}, ${sql.json({ type: "doc", content: [] })})`
        );
        await clearSession(conn);

        // Create project B and a TOC item there
        await createSession(conn, adminId, true, false, projectId);
        const projectB = await conn.oneFirst<number>(
          sql`select id from create_project(${nanoid.nanoid()}, ${nanoid.nanoid()})`
        );
        await clearSession(conn);

        await createSession(conn, adminId, true, false, projectB);
        const sourceB = await conn.oneFirst<number>(
          sql`insert into data_sources (project_id, type, url, import_type, byte_length) values (${projectB}, 'seasketch-vector', 'https://example.com/data.pmtiles', 'upload', 0) returning id`
        );
        const layerB = await conn.oneFirst<number>(
          sql`insert into data_layers (project_id, data_source_id, mapbox_gl_styles) values (${projectB}, ${sourceB}, ${sql.json(
            { foo: "bar" }
          )}) returning id`
        );
        const alphabet =
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
        const makeId = nanoid.customAlphabet(alphabet, 9);
        const stableIdB = makeId();
        await conn.oneFirst<number>(
          sql`insert into table_of_contents_items (project_id, title, is_folder, data_layer_id, stable_id) values (${projectB}, 'LayerB', false, ${layerB}, ${stableIdB}) returning id`
        );
        await clearSession(conn);

        // Attempt to link card in project A to TOC stable_id from project B
        await conn.any(sql`SAVEPOINT before_cross`);
        await expect(
          conn.any(
            sql`insert into report_card_layers (report_card_id, toc_stable_id) values (${cardA.id}, ${stableIdB})`
          )
        ).rejects.toThrow(/same project/i);
        await conn.any(sql`ROLLBACK to before_cross`);
      }
    );
  });

  test("rejects disallowed layer types", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        // Draft report and card
        const sc = await conn.oneFirst<number>(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name) values ('[]'::jsonb, ${projectId}, 'SC') returning id`
        );
        const dr = await conn.oneFirst<number>(
          sql`select id from create_draft_report(${sc})`
        );
        const tab = await conn.one<{ id: number }>(
          sql`select * from add_report_tab(${dr}, 'Tab', 1)`
        );
        const card = await conn.one<{ id: number }>(
          sql`select * from add_report_card(${tab.id}, ${sql.json(
            {}
          )}, ${"Test"}, ${sql.json({ type: "doc", content: [] })})`
        );

        // Create a TOC item with a disallowed data source type, e.g., 'vector'
        const source = await conn.oneFirst<number>(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'vector', 'https://example.com/vector') returning id`
        );
        const layer = await conn.oneFirst<number>(
          sql`insert into data_layers (project_id, data_source_id, source_layer, mapbox_gl_styles) values (${projectId}, ${source}, 'layer', ${sql.json(
            { foo: "bar" }
          )}) returning id`
        );
        const alphabet =
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
        const makeId = nanoid.customAlphabet(alphabet, 9);
        const stableId = makeId();
        await conn.oneFirst<number>(
          sql`insert into table_of_contents_items (project_id, title, is_folder, data_layer_id, stable_id) values (${projectId}, 'BadLayer', false, ${layer}, ${stableId}) returning id`
        );

        await conn.any(sql`SAVEPOINT before_disallowed`);
        await expect(
          conn.any(
            sql`insert into report_card_layers (report_card_id, toc_stable_id) values (${card.id}, ${stableId})`
          )
        ).rejects.toThrow(/supported data layer type/i);
        await conn.any(sql`ROLLBACK to before_disallowed`);
        await clearSession(conn);
      }
    );
  });

  test("deleting a report_card cascades join rows", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const sc = await conn.oneFirst<number>(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name) values ('[]'::jsonb, ${projectId}, 'SC') returning id`
        );
        const dr = await conn.oneFirst<number>(
          sql`select id from create_draft_report(${sc})`
        );
        const tab = await conn.one<{ id: number }>(
          sql`select * from add_report_tab(${dr}, 'Tab', 1)`
        );
        const card = await conn.one<{ id: number }>(
          sql`select * from add_report_card(${tab.id}, ${sql.json(
            {}
          )}, ${"Test"}, ${sql.json({ type: "doc", content: [] })})`
        );
        const source = await conn.oneFirst<number>(
          sql`insert into data_sources (project_id, type, url, import_type, byte_length) values (${projectId}, 'seasketch-vector', 'https://example.com/data.pmtiles', 'upload', 0) returning id`
        );
        const layer = await conn.oneFirst<number>(
          sql`insert into data_layers (project_id, data_source_id, mapbox_gl_styles) values (${projectId}, ${source}, ${sql.json(
            { foo: "bar" }
          )}) returning id`
        );
        const makeId = nanoid.customAlphabet(
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz",
          9
        );
        const stableId = makeId();
        await conn.oneFirst<number>(
          sql`insert into table_of_contents_items (project_id, title, is_folder, data_layer_id, stable_id) values (${projectId}, 'Layer', false, ${layer}, ${stableId}) returning id`
        );
        await conn.any(
          sql`insert into report_card_layers (report_card_id, toc_stable_id) values (${card.id}, ${stableId})`
        );

        // delete card via helper
        await conn.any(sql`select delete_report_card(${card.id})`);
        await clearSession(conn);

        const count = await conn.oneFirst<number>(
          sql`select count(*) from report_cards rc, LATERAL report_cards_layers(rc) t where rc.id = ${card.id}`
        );
        expect(count).toBe(0);
      }
    );
  });

  test("deleting a draft TOC item removes only draft-card links", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const sc = await conn.oneFirst<number>(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name) values ('[]'::jsonb, ${projectId}, 'SC') returning id`
        );
        const dr = await conn.oneFirst<number>(
          sql`select id from create_draft_report(${sc})`
        );
        const tab = await conn.one<{ id: number }>(
          sql`select * from add_report_tab(${dr}, 'Tab', 1)`
        );
        const draftCard = await conn.one<{ id: number }>(
          sql`select * from add_report_card(${tab.id}, ${sql.json(
            {}
          )}, ${"Test"}, ${sql.json({ type: "doc", content: [] })})`
        );
        const src = await conn.oneFirst<number>(
          sql`insert into data_sources (project_id, type, url, import_type, byte_length) values (${projectId}, 'seasketch-vector', 'https://example.com/data.pmtiles', 'upload', 0) returning id`
        );
        const lyr = await conn.oneFirst<number>(
          sql`insert into data_layers (project_id, data_source_id, mapbox_gl_styles) values (${projectId}, ${src}, ${sql.json(
            { foo: "bar" }
          )}) returning id`
        );
        const mk = nanoid.customAlphabet(
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz",
          9
        );
        const stableId = mk();
        const tocId = await conn.oneFirst<number>(
          sql`insert into table_of_contents_items (project_id, title, is_folder, data_layer_id, stable_id) values (${projectId}, 'Layer', false, ${lyr}, ${stableId}) returning id`
        );
        await conn.any(
          sql`insert into report_card_layers (report_card_id, toc_stable_id) values (${draftCard.id}, ${stableId})`
        );

        // Publish report to create published copy of cards
        await conn.any(sql`select publish_report(${sc})`);
        const publishedReportId = await conn.oneFirst<number>(
          sql`select report_id from sketch_classes where id = ${sc}`
        );
        // Find the published copy of the draft card (same tab/card positions)
        // Resolve draft positions using SECURITY DEFINER functions (no direct table access)
        // No need to resolve positions; verify layer link exists on any published card

        // Publish TOC so published items exist for report_cards_layers(), then delete draft
        await conn.any(sql`select publish_table_of_contents(${projectId})`);
        // Now delete the draft TOC item via provided function
        await conn.any(sql`select delete_table_of_contents_branch(${tocId})`);
        await clearSession(conn);

        const draftCount = await conn.oneFirst<number>(
          sql`select count(*) from report_cards rc, LATERAL report_cards_layers(rc) t where rc.id = ${draftCard.id}`
        );
        const publishedCount = await conn.oneFirst<number>(
          sql`select count(*)
              from reports r
              cross join lateral reports_tabs(r) t
              cross join lateral report_tabs_cards(t) c
              cross join lateral report_cards_layers(c) l
              where r.id = ${publishedReportId}
                and l.stable_id = ${stableId}`
        );
        expect(draftCount).toBe(0);
        expect(publishedCount).toBe(1);
      }
    );
  });

  test("deleting draft TOC after publish does not remove published links", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        // Setup: draft report/card and draft TOC layer
        const sc = await conn.oneFirst<number>(
          sql`insert into sketch_classes (mapbox_gl_style, project_id, name) values ('[]'::jsonb, ${projectId}, 'SC') returning id`
        );
        const dr = await conn.oneFirst<number>(
          sql`select id from create_draft_report(${sc})`
        );
        const tab = await conn.one<{ id: number }>(
          sql`select * from add_report_tab(${dr}, 'Tab', 1)`
        );
        const draftCard = await conn.one<{ id: number }>(
          sql`select * from add_report_card(${tab.id}, ${sql.json(
            {}
          )}, ${"Test"}, ${sql.json({ type: "doc", content: [] })})`
        );
        const src = await conn.oneFirst<number>(
          sql`insert into data_sources (project_id, type, url, import_type, byte_length) values (${projectId}, 'seasketch-vector', 'https://example.com/data.pmtiles', 'upload', 0) returning id`
        );
        const lyr = await conn.oneFirst<number>(
          sql`insert into data_layers (project_id, data_source_id, mapbox_gl_styles) values (${projectId}, ${src}, ${sql.json(
            { foo: "bar" }
          )}) returning id`
        );
        const mk = nanoid.customAlphabet(
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz",
          9
        );
        const stableId = mk();
        const tocDraftId = await conn.oneFirst<number>(
          sql`insert into table_of_contents_items (project_id, title, is_folder, data_layer_id, stable_id) values (${projectId}, 'Layer', false, ${lyr}, ${stableId}) returning id`
        );
        await conn.any(
          sql`insert into report_card_layers (report_card_id, toc_stable_id) values (${draftCard.id}, ${stableId})`
        );

        // Publish TOC and Report
        await conn.any(sql`select publish_table_of_contents(${projectId})`);
        await conn.any(sql`select publish_report(${sc})`);

        // Find published TOC item with same stable_id
        const tocPublishedId = await conn.oneFirst<number>(
          sql`select id from table_of_contents_items where is_draft = false and stable_id = ${stableId}`
        );
        // Identify the published copy of the draft card and link it
        const publishedReportId = await conn.oneFirst<number>(
          sql`select report_id from sketch_classes where id = ${sc}`
        );
        // No need to resolve positions; verify layer link exists on any published card

        // Delete remaining draft TOC item
        await conn.any(
          sql`select delete_table_of_contents_branch(${tocDraftId})`
        );
        await clearSession(conn);

        // Verify published link remains
        const publishedCount = await conn.oneFirst<number>(
          sql`select count(*)
              from reports r
              cross join lateral reports_tabs(r) t
              cross join lateral report_tabs_cards(t) c
              cross join lateral report_cards_layers(c) l
              where r.id = ${publishedReportId}
                and l.stable_id = ${stableId}`
        );
        expect(publishedCount).toBe(1);
        // Draft link should be gone
        const draftCount = await conn.oneFirst<number>(
          sql`select count(*) from report_cards rc, LATERAL report_cards_layers(rc) t where rc.id = ${draftCard.id}`
        );
        expect(draftCount).toBe(0);
      }
    );
  });
});
