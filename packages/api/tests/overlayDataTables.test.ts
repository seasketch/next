import { sql } from "slonik";
import { createPool } from "./pool";
import {
  createUser,
  createProject,
  createSession,
  clearSession,
  projectTransaction,
} from "./helpers";
// @ts-ignore
import nanoid from "nanoid";

const id = nanoid.customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz",
  9,
);

const pool = createPool("test");

async function asPostgres(
  conn: any,
  fn: () => Promise<void>,
  restore?: { userId: number; projectId: number },
) {
  await conn.any(sql`SAVEPOINT as_postgres`);
  await conn.any(sql`set role postgres`);
  try {
    await fn();
    await conn.any(sql`set role seasketch_user`);
    await conn.any(sql`RELEASE SAVEPOINT as_postgres`);
    if (restore) {
      await createSession(conn, restore.userId, true, false, restore.projectId);
    }
  } catch (error) {
    await conn.any(sql`ROLLBACK TO SAVEPOINT as_postgres`);
    await conn.any(sql`RELEASE SAVEPOINT as_postgres`);
    if (restore) {
      await createSession(conn, restore.userId, true, false, restore.projectId);
    }
    throw error;
  }
}

async function createDraftLayer(
  conn: any,
  projectId: number,
  adminId: number,
) {
  const sourceId = await conn.oneFirst(
    sql`insert into data_sources (project_id, type, url, attribution)
      values (${projectId}, 'vector', 'https://example.com/vector-tiles/{z}/{x}/{y}.pbf', 'test')
      returning id`,
  );
  const layerId = await conn.oneFirst(
    sql`insert into data_layers (project_id, data_source_id, source_layer, mapbox_gl_styles)
      values (${projectId}, ${sourceId}, 'test-layer', ${sql.json([
        { type: "circle", paint: { "circle-color": "#0000ff" } },
      ])}) returning id`,
  );
  const stableId = id();
  const tocId = await conn.oneFirst(
    sql`insert into table_of_contents_items (project_id, title, is_folder, data_layer_id, stable_id)
      values (${projectId}, 'Sites', false, ${layerId}, ${stableId}) returning id`,
  );
  return { sourceId, layerId, tocId };
}

describe("overlay_data_tables", () => {
  test("admin can insert and soft delete draft data table", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const { tocId } = await createDraftLayer(conn, projectId, adminId);

        let jobId: string;
        await asPostgres(
          conn,
          async () => {
            jobId = (await conn.oneFirst(sql`
            insert into project_background_jobs (project_id, title, type, user_id)
            values (${projectId}, 'test', 'data_table_upload', ${adminId}) returning id`)) as string;
            await conn.any(sql`
            insert into overlay_data_table_uploads (
              project_background_job_id, table_of_contents_item_id, filename, content_type,
              overlay_geostats
            ) values (
              ${jobId}, ${tocId}, 'fish.csv', 'text/csv', '{"layers":[]}'::jsonb
            )`);
            await conn.any(sql`
              select complete_overlay_data_table_upload(
                ${jobId}, 'fish', 'site_id', 'id', 10,
                'r2://bucket/projects/test/public/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/dataTables/u1/data.parquet',
                'r2://bucket/projects/test/public/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/dataTables/u1/column-stats.json'
              )`);
          },
          { userId: adminId, projectId },
        );

        const row = await conn.one(
          sql`select name from overlay_data_tables where table_of_contents_item_id = ${tocId} and deleted_at is null`,
        );
        expect(row.name).toBe("fish");

        const tableId = await conn.oneFirst(
          sql`select id from overlay_data_tables where table_of_contents_item_id = ${tocId} and deleted_at is null`,
        );
        await conn.any(
          sql`select soft_delete_overlay_data_table(${tableId})`,
        );
        const deleted = await conn.one(
          sql`select deleted_at from overlay_data_tables where id = ${tableId}`,
        );
        expect(deleted.deleted_at).not.toBeNull();
      },
    );
  });

  test("non-admin cannot insert overlay data tables", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const { tocId } = await createDraftLayer(conn, projectId, adminId);
        await createSession(conn, userA, true, false, projectId);
        await expect(
          conn.oneFirst(sql`
            insert into overlay_data_tables (
              table_of_contents_item_id, project_id, name, join_column, overlay_join_column,
              row_count, created_by, parquet_remote, column_stats_remote
            ) values (
              ${tocId}, ${projectId}, 'fish', 'site_id', 'id', 10, ${userA},
              'r2://bucket/a.parquet', 'r2://bucket/a.json'
            ) returning id`),
        ).rejects.toThrow();
      },
    );
  });

  test("publish copies active draft tables to published toc item", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const { tocId } = await createDraftLayer(conn, projectId, adminId);

        await asPostgres(
          conn,
          async () => {
            await conn.any(sql`
            insert into overlay_data_tables (
              table_of_contents_item_id, project_id, name, join_column, overlay_join_column,
              row_count, created_by, parquet_remote, column_stats_remote
            ) values (
              ${tocId}, ${projectId}, 'fish', 'site_id', 'id', 10, ${adminId},
              'r2://bucket/projects/test/public/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/dataTables/u1/data.parquet',
              'r2://bucket/projects/test/public/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/dataTables/u1/column-stats.json'
            )`);
          },
          { userId: adminId, projectId },
        );

        await conn.any(sql`select publish_table_of_contents(${projectId})`);

        const published = await conn.one(sql`
          select odt.name, toc.is_draft
          from overlay_data_tables odt
          inner join table_of_contents_items toc on toc.id = odt.table_of_contents_item_id
          where odt.project_id = ${projectId} and toc.is_draft = false`);

        expect(published.name).toBe("fish");
        expect(published.is_draft).toBe(false);
      },
    );
  });

  test("allows duplicate active table names per toc item", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const { tocId } = await createDraftLayer(conn, projectId, adminId);

        await asPostgres(
          conn,
          async () => {
            await conn.any(sql`
            insert into overlay_data_tables (
              table_of_contents_item_id, project_id, name, join_column, overlay_join_column,
              row_count, created_by, parquet_remote, column_stats_remote
            ) values (
              ${tocId}, ${projectId}, 'fish', 'site_id', 'id', 10, ${adminId},
              'r2://bucket/a.parquet', 'r2://bucket/a.json'
            )`);
            await conn.any(sql`
              insert into overlay_data_tables (
                table_of_contents_item_id, project_id, name, join_column, overlay_join_column,
                row_count, created_by, parquet_remote, column_stats_remote
              ) values (
                ${tocId}, ${projectId}, 'fish', 'site_id', 'id', 5, ${adminId},
                'r2://bucket/b.parquet', 'r2://bucket/b.json'
              )`);
          },
          { userId: adminId, projectId },
        );

        const count = await conn.oneFirst(sql`
          select count(*) from overlay_data_tables
          where table_of_contents_item_id = ${tocId}
            and name = 'fish'
            and deleted_at is null`);
        expect(count).toBe(2);
      },
    );
  });

  test("replace increments version and soft deletes previous", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const { tocId } = await createDraftLayer(conn, projectId, adminId);

        let jobId: string;
        let oldId: number;
        await asPostgres(
          conn,
          async () => {
            jobId = (await conn.oneFirst(sql`
            insert into project_background_jobs (project_id, title, type, user_id)
            values (${projectId}, 'test', 'data_table_upload', ${adminId}) returning id`)) as string;

            oldId = Number(await conn.oneFirst(sql`
            insert into overlay_data_tables (
              table_of_contents_item_id, project_id, name, join_column, overlay_join_column,
              row_count, created_by, version, parquet_remote, column_stats_remote
            ) values (
              ${tocId}, ${projectId}, 'fish', 'site_id', 'id', 10, ${adminId}, 1,
              'r2://bucket/old.parquet', 'r2://bucket/old.json'
            ) returning id`));

            await conn.any(sql`
            insert into overlay_data_table_uploads (
              project_background_job_id, table_of_contents_item_id, filename, content_type,
              overlay_geostats, replace_overlay_data_table_id
            ) values (
              ${jobId}, ${tocId}, 'fish.csv', 'text/csv',
              '{"layers":[{"attributes":[]}]}'::jsonb,
              ${oldId}
            )`);
            await conn.any(sql`
              select complete_overlay_data_table_upload(
                ${jobId}, 'fish', 'site_id', 'id', 20,
                'r2://bucket/new.parquet', 'r2://bucket/new.json'
              )`);
          },
          { userId: adminId, projectId },
        );

        const oldRow = await conn.one(
          sql`select deleted_at, replaced_by_id, version from overlay_data_tables where id = ${oldId!}`,
        );
        expect(oldRow.deleted_at).not.toBeNull();
        expect(oldRow.replaced_by_id).not.toBeNull();

        const newRow = await conn.one(
          sql`select version, deleted_at from overlay_data_tables where id = ${oldRow.replaced_by_id}`,
        );
        expect(newRow.version).toBe(2);
        expect(newRow.deleted_at).toBeNull();
      },
    );
  });

  test("replace records changelog when completed without session", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const { tocId } = await createDraftLayer(conn, projectId, adminId);

        let jobId: string;
        let oldId: number;
        await asPostgres(
          conn,
          async () => {
            jobId = (await conn.oneFirst(sql`
            insert into project_background_jobs (project_id, title, type, user_id)
            values (${projectId}, 'test', 'data_table_upload', ${adminId}) returning id`)) as string;

            oldId = Number(await conn.oneFirst(sql`
            insert into overlay_data_tables (
              table_of_contents_item_id, project_id, name, join_column, overlay_join_column,
              row_count, created_by, version, parquet_remote, column_stats_remote
            ) values (
              ${tocId}, ${projectId}, 'fish', 'site_id', 'id', 10, ${adminId}, 1,
              'r2://bucket/old.parquet', 'r2://bucket/old.json'
            ) returning id`));

            await conn.any(sql`
            insert into overlay_data_table_uploads (
              project_background_job_id, table_of_contents_item_id, filename, content_type,
              overlay_geostats, replace_overlay_data_table_id
            ) values (
              ${jobId}, ${tocId}, 'fish.csv', 'text/csv',
              '{"layers":[{"attributes":[]}]}'::jsonb,
              ${oldId}
            )`);
            await clearSession(conn);
            await conn.any(sql`
              select set_config('seasketch.uploads_base_url', 'https://uploads.example.org', true)
            `);
            await conn.any(sql`
              select complete_overlay_data_table_upload(
                ${jobId}, 'fish', 'site_id', 'id', 20,
                'r2://bucket/new.parquet', 'r2://bucket/new.json'
              )`);
          },
          { userId: adminId, projectId },
        );

        const changelog = await conn.one(sql`
          select field_group, editor_id, from_summary, to_summary
          from change_logs
          where entity_type = 'overlay_data_table'
            and field_group = 'data_table:replaced'
            and (meta->>'table_of_contents_item_id')::int = ${tocId}
          order by last_at desc
          limit 1`);
        expect(changelog.field_group).toBe("data_table:replaced");
        expect(changelog.editor_id).toBe(adminId);
        expect(changelog.from_summary).toEqual(
          expect.objectContaining({ name: "fish", version: 1 }),
        );
        expect(changelog.to_summary).toEqual(
          expect.objectContaining({ name: "fish", version: 2 }),
        );
        expect(changelog.from_summary).toEqual(
          expect.objectContaining({
            name: "fish",
            version: 1,
            parquet_url: "https://uploads.example.org/old.parquet",
          }),
        );
      },
    );
  });
});
