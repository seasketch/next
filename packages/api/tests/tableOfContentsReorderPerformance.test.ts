import { sql } from "slonik";
import { createPool } from "./pool";
import { createSession, projectTransaction } from "./helpers";

const pool = createPool("test");

// Large enough that the per-row draft-vs-published diff (one full project
// scan per rewritten table_of_contents_items row) is obvious, and small
// enough that the fixed path stays well under the budgets below.
const LAYER_COUNT = 400;
const ROOT_FOLDERS = 8;
// A reorder or reparent should be a handful of index updates plus one diff,
// not one diff per layer. These ceilings fail the pre-fix behavior.
const REORDER_BUDGET_MS = 1500;
const REPARENT_BUDGET_MS = 2000;
const BULK_DOWNLOAD_BUDGET_MS = 2000;
const MAX_PROJECT_FLAG_WRITES = 2;

describe("table of contents tree edits stay cheap on a large draft", () => {
  jest.setTimeout(180000);

  test("reordering root folders does not rewrite or rescan the layers inside them", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const tree = await buildLargeDraftTree(conn, projectId);
        await conn.oneFirst(
          sql`select count(*) from publish_table_of_contents(${projectId})`
        );
        expect(await hasChanges(conn, projectId)).toBe(false);

        const reversed = [...tree.rootIds].reverse();
        const reorder = await measure(conn, () =>
          reorderRoot(conn, reversed)
        );
        logMeasure("reorder", reorder);

        expect(reorder.projectUpdates).toBeLessThanOrEqual(
          MAX_PROJECT_FLAG_WRITES
        );
        expect(reorder.tocUpdates).toBeLessThanOrEqual(ROOT_FOLDERS + 2);
        expect(reorder.elapsedMs).toBeLessThan(REORDER_BUDGET_MS);
        expect(await rootIdsInOrder(conn, projectId)).toEqual(reversed);
        expect(await misplacedLayerPaths(conn, projectId, tree.bigStableId)).toBe(
          0
        );
        expect(await hasChanges(conn, projectId)).toBe(true);

        const restore = await measure(conn, () =>
          reorderRoot(conn, tree.rootIds)
        );
        logMeasure("restore order", restore);
        expect(restore.projectUpdates).toBeLessThanOrEqual(
          MAX_PROJECT_FLAG_WRITES
        );
        expect(restore.tocUpdates).toBeLessThanOrEqual(ROOT_FOLDERS + 2);
        expect(restore.elapsedMs).toBeLessThan(REORDER_BUDGET_MS);
        expect(await rootIdsInOrder(conn, projectId)).toEqual(tree.rootIds);
        expect(await hasChanges(conn, projectId)).toBe(false);
      }
    );
  });

  test("moving a folder of layers into another folder rewrites paths once", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const tree = await buildLargeDraftTree(conn, projectId);
        await conn.oneFirst(
          sql`select count(*) from publish_table_of_contents(${projectId})`
        );

        const move = await measure(conn, async () => {
          await conn.any(
            sql`select update_table_of_contents_item_children(${
              tree.destinationId
            }, ${sql.array([tree.bigFolderId], "int4")})`
          );
        });
        logMeasure("reparent", move);

        expect(move.projectUpdates).toBeLessThanOrEqual(MAX_PROJECT_FLAG_WRITES);
        expect(move.tocUpdates).toBeGreaterThanOrEqual(LAYER_COUNT);
        expect(move.tocUpdates).toBeLessThanOrEqual(LAYER_COUNT + 20);
        expect(move.elapsedMs).toBeLessThan(REPARENT_BUDGET_MS);

        const parentStableId = await conn.oneFirst(
          sql`select parent_stable_id from table_of_contents_items where id = ${tree.bigFolderId}`
        );
        expect(parentStableId).toBe(tree.destinationStableId);
        const folderPathMatches = await conn.oneFirst(
          sql`select path::text = (
            select path::text || '.' || ${tree.bigStableId}
            from table_of_contents_items where id = ${tree.destinationId}
          )
          from table_of_contents_items where id = ${tree.bigFolderId}`
        );
        expect(folderPathMatches).toBe(true);
        expect(await misplacedLayerPaths(conn, projectId, tree.bigStableId)).toBe(
          0
        );
        expect(
          await conn.oneFirst(
            sql`select count(*)::int from table_of_contents_items
              where project_id = ${projectId} and is_draft and parent_stable_id = ${tree.bigStableId}`
          )
        ).toBe(LAYER_COUNT);
        expect(await hasChanges(conn, projectId)).toBe(true);
      }
    );
  });

  test("turning download on for every layer diffs the project once", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        await buildLargeDraftTree(conn, projectId);
        await conn.oneFirst(
          sql`select count(*) from publish_table_of_contents(${projectId})`
        );
        const slug = await conn.oneFirst(
          sql`select slug from projects where id = ${projectId}`
        );
        const enable = !(await conn.oneFirst(
          sql`select enable_download from table_of_contents_items
            where project_id = ${projectId} and is_draft and is_folder = false
            limit 1`
        ));

        const bulk = await measure(conn, async () => {
          await conn.oneFirst(
            sql`select count(*) from set_enable_download_for_all_overlays(${slug}, ${enable})`
          );
        });
        logMeasure("bulk download", bulk);

        expect(bulk.projectUpdates).toBeLessThanOrEqual(MAX_PROJECT_FLAG_WRITES);
        expect(bulk.tocUpdates).toBeGreaterThanOrEqual(LAYER_COUNT);
        expect(bulk.elapsedMs).toBeLessThan(BULK_DOWNLOAD_BUDGET_MS);
        expect(
          await conn.oneFirst(
            sql`select count(*)::int from table_of_contents_items
              where project_id = ${projectId} and is_draft and is_folder = false and enable_download = ${enable}`
          )
        ).toBe(LAYER_COUNT);
        expect(await hasChanges(conn, projectId)).toBe(true);
      }
    );
  });
});

type Conn = Parameters<Parameters<typeof projectTransaction>[2]>[0];

async function buildLargeDraftTree(conn: Conn, projectId: number) {
  await conn.any(
    sql`insert into table_of_contents_items (project_id, title, is_folder, stable_id)
      select ${projectId}, 'folder ' || g, true,
        'perf' || ${projectId}::text || 'f' || g
      from generate_series(1, ${ROOT_FOLDERS}) g`
  );
  const bigStableId = `perf${projectId}f1`;
  const destinationStableId = `perf${projectId}f2`;
  const sourceId = await conn.oneFirst(
    sql`insert into data_sources (project_id, type, url)
      values (${projectId}, 'arcgis-dynamic-mapserver', 'https://example.com/arcgis/rest/services/perf/MapServer')
      returning id`
  );
  await conn.any(
    sql`with layers as (
        insert into data_layers (project_id, data_source_id, sublayer)
        select ${projectId}, ${sourceId}, g::text
        from generate_series(1, ${LAYER_COUNT}) g
        returning id
      ),
      numbered as (
        select id, row_number() over (order by id) as n from layers
      )
      insert into table_of_contents_items (
        project_id, title, is_folder, data_layer_id, stable_id, parent_stable_id
      )
      select ${projectId}, 'layer ' || n, false, id,
        'perf' || ${projectId}::text || 'l' || n,
        ${bigStableId}
      from numbered`
  );
  const rootIds = (
    await conn.anyFirst(
      sql`select id from table_of_contents_items
        where project_id = ${projectId} and is_draft and parent_stable_id is null
        order by sort_index, id`
    )
  ).map(Number);
  const bigFolderId = Number(
    await conn.oneFirst(
      sql`select id from table_of_contents_items
        where project_id = ${projectId} and is_draft and stable_id = ${bigStableId}`
    )
  );
  const destinationId = Number(
    await conn.oneFirst(
      sql`select id from table_of_contents_items
        where project_id = ${projectId} and is_draft and stable_id = ${destinationStableId}`
    )
  );
  return {
    rootIds,
    bigFolderId,
    bigStableId,
    destinationId,
    destinationStableId,
  };
}

async function reorderRoot(conn: Conn, childIds: number[]) {
  await conn.any(
    sql`select update_table_of_contents_item_children(null, ${sql.array(
      childIds,
      "int4"
    )})`
  );
}

async function rootIdsInOrder(conn: Conn, projectId: number) {
  return (
    await conn.anyFirst(
      sql`select id from table_of_contents_items
        where project_id = ${projectId} and is_draft and parent_stable_id is null
        order by sort_index, id`
    )
  ).map(Number);
}

async function misplacedLayerPaths(
  conn: Conn,
  projectId: number,
  folderStableId: string
) {
  return Number(
    await conn.oneFirst(
      sql`select count(*)::int from table_of_contents_items layer
        where layer.project_id = ${projectId}
          and layer.is_draft
          and layer.parent_stable_id = ${folderStableId}
          and layer.path::text is distinct from (
            select folder.path::text || '.' || layer.stable_id
            from table_of_contents_items folder
            where folder.project_id = ${projectId}
              and folder.is_draft
              and folder.stable_id = ${folderStableId}
          )`
    )
  );
}

async function hasChanges(conn: Conn, projectId: number) {
  return conn.oneFirst(
    sql`select draft_table_of_contents_has_changes from projects where id = ${projectId}`
  );
}

async function readStats(conn: Conn) {
  const row = await conn.one(
    sql`select
      pg_stat_get_xact_tuples_updated('public.projects'::regclass) as projects,
      pg_stat_get_xact_tuples_updated('public.table_of_contents_items'::regclass) as toc`
  );
  return {
    projects: Number(row.projects),
    toc: Number(row.toc),
  };
}

async function measure(conn: Conn, run: () => Promise<void>) {
  const before = await readStats(conn);
  const started = Date.now();
  await run();
  return {
    elapsedMs: Date.now() - started,
    projectUpdates: (await readStats(conn)).projects - before.projects,
    tocUpdates: (await readStats(conn)).toc - before.toc,
  };
}

function logMeasure(
  label: string,
  result: { elapsedMs: number; projectUpdates: number; tocUpdates: number }
) {
  console.log(
    `${label}: ${result.elapsedMs}ms, ${result.projectUpdates} project flag writes, ${result.tocUpdates} toc row updates`
  );
}
