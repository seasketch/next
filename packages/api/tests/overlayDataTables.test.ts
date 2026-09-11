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

  test("complete writes temporal only when the processor supplies it", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const { tocId } = await createDraftLayer(conn, projectId, adminId);
        const temporal = {
          version: 1,
          granularity: "row",
          coverage: {
            kind: "interval",
            start: "2018",
            end: "2019",
            precision: "year",
          },
          nativeResolution: "year",
          defaultViewResolution: "year",
          mapping: {
            type: "row",
            startColumn: "_when_start",
            endColumn: "_when_end",
            sourceColumns: {
              kind: "instant",
              column: "survey_year",
              format: "year",
            },
          },
          authoredBy: "admin",
        };

        await asPostgres(
          conn,
          async () => {
            const jobId = (await conn.oneFirst(sql`
            insert into project_background_jobs (project_id, title, type, user_id)
            values (${projectId}, 'test', 'data_table_upload', ${adminId}) returning id`)) as string;
            await conn.any(sql`
            insert into overlay_data_table_uploads (
              project_background_job_id, table_of_contents_item_id, filename, content_type,
              overlay_geostats, temporal_config
            ) values (
              ${jobId}, ${tocId}, 'fish.csv', 'text/csv', '{"layers":[]}'::jsonb,
              ${sql.json({
                sourceColumns: {
                  kind: "instant",
                  column: "survey_year",
                  format: "year",
                },
              })}
            )`);
            await conn.any(sql`
              select complete_overlay_data_table_upload(
                ${jobId}, 'fish', 'site_id', 'id', 10,
                'r2://bucket/a.parquet', 'r2://bucket/a.json',
                ${sql.json(temporal)}
              )`);
          },
          { userId: adminId, projectId },
        );

        const row = await conn.one(
          sql`select temporal from overlay_data_tables
              where table_of_contents_item_id = ${tocId} and deleted_at is null`,
        );
        expect(row.temporal).toEqual(temporal);
      },
    );
  });

  test("reprocess stores ephemeral config and leaves table temporal untouched", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const { tocId, sourceId } = await createDraftLayer(
          conn,
          projectId,
          adminId,
        );
        await conn.any(sql`
          update table_of_contents_items
          set enable_data_tables = true, data_table_join_column = 'id'
          where id = ${tocId}`);

        let tableId: number;
        let previous: unknown;
        await asPostgres(
          conn,
          async () => {
            await conn.any(sql`
              update data_sources
              set geostats = '{"layers":[{"attributes":[]}]}'::jsonb
              where id = ${sourceId}`);
            tableId = Number(
              await conn.oneFirst(sql`
                insert into overlay_data_tables (
                  table_of_contents_item_id, project_id, name, join_column, overlay_join_column,
                  row_count, created_by, version, parquet_remote, column_stats_remote,
                  temporal
                ) values (
                  ${tocId}, ${projectId}, 'fish', 'site_id', 'id', 10, ${adminId}, 1,
                  'r2://bucket/old.parquet', 'r2://bucket/old.json',
                  ${sql.json({
                    version: 1,
                    granularity: "row",
                    coverage: {
                      kind: "interval",
                      start: "2018",
                      end: "2019",
                      precision: "year",
                    },
                    nativeResolution: "year",
                    defaultViewResolution: "year",
                    authoredBy: "admin",
                  })}
                ) returning id`),
            );
            previous = await conn.oneFirst(
              sql`select temporal from overlay_data_tables where id = ${tableId}`,
            );
          },
          { userId: adminId, projectId },
        );

        const upload = await conn.one(sql`
          select * from create_overlay_data_table_reprocess(
            ${tableId},
            ${sql.json({
              sourceColumns: {
                kind: "instant",
                column: "survey_year",
                format: "year",
              },
            })}
          )`);

        expect(upload.reprocess_of_overlay_data_table_id).toBe(tableId);
        expect(upload.temporal_config).toEqual({
          sourceColumns: {
            kind: "instant",
            column: "survey_year",
            format: "year",
          },
        });

        const after = await conn.oneFirst(
          sql`select temporal from overlay_data_tables where id = ${tableId}`,
        );
        expect(after).toEqual(previous);
      },
    );
  });

  test("admin can start a no-data reprocess without writing nodata_values yet", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const { tocId, sourceId } = await createDraftLayer(
          conn,
          projectId,
          adminId,
        );
        await conn.any(sql`
          update table_of_contents_items
          set enable_data_tables = true, data_table_join_column = 'id'
          where id = ${tocId}`);
        let tableId: number;
        await asPostgres(
          conn,
          async () => {
            await conn.any(sql`
              update data_sources
              set geostats = '{"layers":[{"attributes":[]}]}'::jsonb
              where id = ${sourceId}`);
            tableId = Number(
              await conn.oneFirst(sql`
              insert into overlay_data_tables (
                table_of_contents_item_id, project_id, name, join_column, overlay_join_column,
                row_count, created_by, version, parquet_remote, column_stats_remote
              ) values (
                ${tocId}, ${projectId}, 'wq', 'siteid', 'siteid', 10, ${adminId}, 1,
                'r2://bucket/old.parquet', 'r2://bucket/old.json'
              ) returning id`),
            );
          },
          { userId: adminId, projectId },
        );

        const upload = await conn.one(sql`
          select * from create_overlay_data_table_reprocess(
            ${tableId},
            null,
            ${sql.json({ values: [-88, "NA"] })}
          )`);

        expect(upload.reprocess_of_overlay_data_table_id).toBe(tableId);
        expect(upload.nodata_config).toEqual({ values: [-88, "NA"] });
        expect(upload.temporal_config).toBeNull();
        const stored = await conn.oneFirst(
          sql`select nodata_values from overlay_data_tables where id = ${tableId}`,
        );
        expect(stored).toEqual([]);
      },
    );
  });

  test("admin can start a no-data reprocess that clears sentinels", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const { tocId, sourceId } = await createDraftLayer(
          conn,
          projectId,
          adminId,
        );
        await conn.any(sql`
          update table_of_contents_items
          set enable_data_tables = true, data_table_join_column = 'id'
          where id = ${tocId}`);
        let tableId: number;
        await asPostgres(
          conn,
          async () => {
            await conn.any(sql`
              update data_sources
              set geostats = '{"layers":[{"attributes":[]}]}'::jsonb
              where id = ${sourceId}`);
            tableId = Number(
              await conn.oneFirst(sql`
              insert into overlay_data_tables (
                table_of_contents_item_id, project_id, name, join_column, overlay_join_column,
                row_count, created_by, version, parquet_remote, column_stats_remote,
                nodata_values
              ) values (
                ${tocId}, ${projectId}, 'wq', 'siteid', 'siteid', 10, ${adminId}, 1,
                'r2://bucket/old.parquet', 'r2://bucket/old.json',
                ${sql.json([-88])}
              ) returning id`),
            );
          },
          { userId: adminId, projectId },
        );

        const upload = await conn.one(sql`
          select * from create_overlay_data_table_reprocess(
            ${tableId},
            null,
            ${sql.json({ values: [] })}
          )`);

        expect(upload.nodata_config).toEqual({ values: [] });
        expect(upload.reprocess_of_overlay_data_table_id).toBe(tableId);
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

        const temporal = {
          version: 1,
          granularity: "row",
          coverage: {
            kind: "interval",
            start: "2018",
            end: "2019",
            precision: "year",
          },
          nativeResolution: "year",
          defaultViewResolution: "year",
          mapping: {
            type: "row",
            startColumn: "_when_start",
            endColumn: "_when_end",
            sourceColumns: {
              kind: "instant",
              column: "survey_year",
              format: "year",
            },
          },
          authoredBy: "admin",
        };

        await asPostgres(
          conn,
          async () => {
            await conn.any(sql`
              update table_of_contents_items
              set enable_data_tables = true, data_table_join_column = 'id'
              where id = ${tocId}`);
            await conn.any(sql`
            insert into overlay_data_tables (
              table_of_contents_item_id, project_id, name, join_column, overlay_join_column,
              row_count, created_by, parquet_remote, column_stats_remote,
              visualization_columns, visualization_ops, required_filter_columns,
              hidden_filter_columns, filter_column_labels,
              temporal, organism
            ) values (
              ${tocId}, ${projectId}, 'fish', 'site_id', 'id', 10, ${adminId},
              'r2://bucket/projects/test/public/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/dataTables/u1/data.parquet',
              'r2://bucket/projects/test/public/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/dataTables/u1/column-stats.json',
              ${sql.array(['count'], 'text')}, ${sql.array(['sum'], 'text')},
              ${sql.array(['year'], 'text')},
              ${sql.array(['region'], 'text')},
              ${sql.json({ year: 'Year' })},
              ${sql.json(temporal)},
              ${sql.json({
                version: 1,
                column: "classcode",
                valueKind: "code",
                roles: { classcode: "code" },
                authoredBy: "admin",
              })}
            )`);
            // Soft-deleted draft history must not be published.
            await conn.any(sql`
            insert into overlay_data_tables (
              table_of_contents_item_id, project_id, name, join_column, overlay_join_column,
              row_count, created_by, parquet_remote, column_stats_remote, deleted_at
            ) values (
              ${tocId}, ${projectId}, 'old-fish', 'site_id', 'id', 1, ${adminId},
              'r2://bucket/old.parquet', 'r2://bucket/old.json', now()
            )`);
          },
          { userId: adminId, projectId },
        );

        await conn.any(sql`select publish_table_of_contents(${projectId})`);

        const publishedToc = await conn.one(sql`
          select enable_data_tables, data_table_join_column
          from table_of_contents_items
          where project_id = ${projectId} and is_draft = false and is_folder = false`);
        expect(publishedToc.enable_data_tables).toBe(true);
        expect(publishedToc.data_table_join_column).toBe("id");

        const draftStableId = await conn.oneFirst(sql`
          select stable_id from overlay_data_tables
          where table_of_contents_item_id = ${tocId} and deleted_at is null`);

        const published = await conn.many(sql`
          select odt.name, toc.is_draft, odt.visualization_columns, odt.visualization_ops,
            odt.required_filter_columns, odt.hidden_filter_columns, odt.filter_column_labels,
            odt.parquet_remote, odt.stable_id, odt.temporal, odt.organism
          from overlay_data_tables odt
          inner join table_of_contents_items toc on toc.id = odt.table_of_contents_item_id
          where odt.project_id = ${projectId} and toc.is_draft = false
          order by odt.name`);

        expect(published).toHaveLength(1);
        expect(published[0].name).toBe("fish");
        expect(published[0].is_draft).toBe(false);
        expect(published[0].visualization_columns).toEqual(["count"]);
        expect(published[0].visualization_ops).toEqual(["sum"]);
        expect(published[0].required_filter_columns).toEqual(["year"]);
        expect(published[0].hidden_filter_columns).toEqual(["region"]);
        expect(published[0].filter_column_labels).toEqual({ year: "Year" });
        expect(published[0].stable_id).toBe(draftStableId);
        expect(published[0].temporal).toEqual(temporal);
        expect(published[0].organism).toEqual({
          version: 1,
          column: "classcode",
          valueKind: "code",
          roles: { classcode: "code" },
          authoredBy: "admin",
        });

        const draftStillThere = await conn.oneFirst(sql`
          select count(*) from overlay_data_tables odt
          inner join table_of_contents_items toc on toc.id = odt.table_of_contents_item_id
          where odt.project_id = ${projectId} and toc.is_draft = true and odt.deleted_at is null`);
        expect(draftStillThere).toBe(1);

        // Republish replaces prior published copies (CASCADE delete of old published TOC).
        await asPostgres(
          conn,
          async () => {
            await conn.any(sql`
              update overlay_data_tables
              set name = 'fish-v2', visualization_ops = ${sql.array(['mean'], 'text')}
              where table_of_contents_item_id = ${tocId} and deleted_at is null`);
          },
          { userId: adminId, projectId },
        );
        await conn.any(sql`select publish_table_of_contents(${projectId})`);

        const republished = await conn.many(sql`
          select odt.name, odt.visualization_ops
          from overlay_data_tables odt
          inner join table_of_contents_items toc on toc.id = odt.table_of_contents_item_id
          where odt.project_id = ${projectId} and toc.is_draft = false`);
        expect(republished).toHaveLength(1);
        expect(republished[0].name).toBe("fish-v2");
        expect(republished[0].visualization_ops).toEqual(["mean"]);
      },
    );
  });

  test("set_overlay_data_table_visualization_settings stores hidden filters and labels", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const { tocId } = await createDraftLayer(conn, projectId, adminId);
        let tableId = 0;
        await asPostgres(
          conn,
          async () => {
            await conn.any(sql`
              update table_of_contents_items
              set enable_data_tables = true, data_table_join_column = 'id'
              where id = ${tocId}`);
            tableId = Number(
              await conn.oneFirst(sql`
              insert into overlay_data_tables (
                table_of_contents_item_id, project_id, name, join_column, overlay_join_column,
                row_count, created_by, parquet_remote, column_stats_remote
              ) values (
                ${tocId}, ${projectId}, 'fish', 'site_id', 'id', 10, ${adminId},
                'r2://bucket/a.parquet', 'r2://bucket/a.json'
              ) returning id`),
            );
          },
          { userId: adminId, projectId },
        );

        await conn.any(sql`
          select set_overlay_data_table_visualization_settings(
            ${tableId},
            ${sql.array(["count"], "text")},
            ${sql.array(["mean"], "text")},
            ${sql.array(["year"], "text")},
            ${sql.array(["year", "region"], "text")},
            ${sql.json({ year: " Year ", species: "   ", "": "nope" })}
          )`);

        const row = await conn.one(sql`
          select visualization_columns, visualization_ops, required_filter_columns,
            hidden_filter_columns, filter_column_labels
          from overlay_data_tables where id = ${tableId}`);
        expect(row.visualization_columns).toEqual(["count"]);
        expect(row.visualization_ops).toEqual(["mean"]);
        expect(row.required_filter_columns).toEqual(["year"]);
        expect(row.hidden_filter_columns).toEqual(["region"]);
        expect(row.filter_column_labels).toEqual({ year: "Year" });
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
          sql`select deleted_at, replaced_by_id, version, stable_id from overlay_data_tables where id = ${oldId!}`,
        );
        expect(oldRow.deleted_at).not.toBeNull();
        expect(oldRow.replaced_by_id).not.toBeNull();

        const newRow = await conn.one(
          sql`select version, deleted_at, stable_id from overlay_data_tables where id = ${oldRow.replaced_by_id}`,
        );
        expect(newRow.version).toBe(2);
        expect(newRow.deleted_at).toBeNull();
        expect(newRow.stable_id).toBe(oldRow.stable_id);
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

  test("in-place temporal save records data_table:temporal changelog", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const { tocId } = await createDraftLayer(conn, projectId, adminId);
        const previous = {
          version: 1,
          granularity: "row",
          coverage: {
            kind: "interval",
            start: "2018",
            end: "2019",
            precision: "year",
          },
          nativeResolution: "year",
          defaultViewResolution: "year",
          authoredBy: "admin",
        };
        const next = {
          ...previous,
          defaultViewResolution: "month",
          supportedViewResolutions: ["year", "month"],
        };

        let tableId = 0;
        await asPostgres(
          conn,
          async () => {
            tableId = Number(
              await conn.oneFirst(sql`
                insert into overlay_data_tables (
                  table_of_contents_item_id, project_id, name, join_column, overlay_join_column,
                  row_count, created_by, version, parquet_remote, column_stats_remote,
                  temporal
                ) values (
                  ${tocId}, ${projectId}, 'fish', 'site_id', 'id', 10, ${adminId}, 1,
                  'r2://bucket/a.parquet', 'r2://bucket/a.json',
                  ${sql.json(previous)}
                ) returning id`),
            );
          },
          { userId: adminId, projectId },
        );

        await conn.any(sql`
          select update_overlay_data_table_temporal(
            ${tableId},
            ${sql.json(next)}
          )`);

        const changelog = await conn.one(sql`
          select field_group, editor_id, from_summary, to_summary, meta
          from change_logs
          where entity_type = 'overlay_data_table'
            and entity_id = ${tableId}
            and field_group = 'data_table:temporal'
          order by last_at desc
          limit 1`);
        expect(changelog.editor_id).toBe(adminId);
        expect(changelog.meta).toEqual(
          expect.objectContaining({
            table_of_contents_item_id: tocId,
            reprocessed: false,
          }),
        );
        expect(changelog.from_summary).toEqual(
          expect.objectContaining({
            name: "fish",
            version: 1,
            temporal: previous,
          }),
        );
        expect(changelog.to_summary).toEqual(
          expect.objectContaining({
            name: "fish",
            version: 1,
            temporal: next,
          }),
        );
      },
    );
  });

  test("temporal reprocess records data_table:temporal, not replaced", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const { tocId } = await createDraftLayer(conn, projectId, adminId);
        const previous = {
          version: 1,
          granularity: "row",
          coverage: {
            kind: "interval",
            start: "2018",
            end: "2019",
            precision: "year",
          },
          nativeResolution: "year",
          defaultViewResolution: "year",
          authoredBy: "admin",
        };
        const next = {
          ...previous,
          coverage: {
            kind: "interval",
            start: "1999",
            end: "2026",
            precision: "year",
          },
          mapping: {
            type: "row",
            startColumn: "_when_start",
            endColumn: "_when_end",
            sourceColumns: {
              kind: "instant",
              column: "survey_year",
              format: "year",
            },
          },
        };

        let jobId: string;
        let oldId: number;
        await asPostgres(
          conn,
          async () => {
            jobId = (await conn.oneFirst(sql`
            insert into project_background_jobs (project_id, title, type, user_id)
            values (${projectId}, 'reprocess', 'data_table_upload', ${adminId}) returning id`)) as string;

            oldId = Number(await conn.oneFirst(sql`
            insert into overlay_data_tables (
              table_of_contents_item_id, project_id, name, join_column, overlay_join_column,
              row_count, created_by, version, parquet_remote, column_stats_remote,
              temporal
            ) values (
              ${tocId}, ${projectId}, 'fish', 'site_id', 'id', 10, ${adminId}, 1,
              'r2://bucket/old.parquet', 'r2://bucket/old.json',
              ${sql.json(previous)}
            ) returning id`));

            await conn.any(sql`
            insert into overlay_data_table_uploads (
              project_background_job_id, table_of_contents_item_id, filename, content_type,
              overlay_geostats, replace_overlay_data_table_id,
              reprocess_of_overlay_data_table_id, temporal_config
            ) values (
              ${jobId}, ${tocId}, 'reprocess.parquet', 'application/vnd.apache.parquet',
              '{"layers":[{"attributes":[]}]}'::jsonb,
              ${oldId}, ${oldId},
              ${sql.json({
                sourceColumns: {
                  kind: "instant",
                  column: "survey_year",
                  format: "year",
                },
              })}
            )`);
            await clearSession(conn);
            await conn.any(sql`
              select set_config('seasketch.uploads_base_url', 'https://uploads.example.org', true)
            `);
            await conn.any(sql`
              select complete_overlay_data_table_upload(
                ${jobId}, 'fish', 'site_id', 'id', 10,
                'r2://bucket/new.parquet', 'r2://bucket/new.json',
                ${sql.json(next)}
              )`);
          },
          { userId: adminId, projectId },
        );

        const groups = await conn.any(sql`
          select field_group
          from change_logs
          where entity_type = 'overlay_data_table'
            and (meta->>'table_of_contents_item_id')::int = ${tocId}
          order by last_at desc`);
        expect(groups.map((row) => row.field_group)).toEqual([
          "data_table:temporal",
        ]);

        const changelog = await conn.one(sql`
          select field_group, from_summary, to_summary, meta
          from change_logs
          where entity_type = 'overlay_data_table'
            and field_group = 'data_table:temporal'
            and (meta->>'table_of_contents_item_id')::int = ${tocId}
          order by last_at desc
          limit 1`);
        expect(changelog.meta).toEqual(
          expect.objectContaining({
            table_of_contents_item_id: tocId,
            reprocessed: true,
          }),
        );
        expect(changelog.from_summary).toEqual(
          expect.objectContaining({
            name: "fish",
            version: 1,
            temporal: previous,
            parquet_url: "https://uploads.example.org/old.parquet",
          }),
        );
        expect(changelog.to_summary).toEqual(
          expect.objectContaining({
            name: "fish",
            version: 2,
            temporal: next,
          }),
        );
      },
    );
  });

  test("create_map_bookmark accepts dataTableStates", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const slug = (await conn.oneFirst(
          sql`select slug from projects where id = ${projectId}`,
        )) as string;
        const basemapId = (await conn.oneFirst(sql`
          insert into basemaps (project_id, name, type, url, thumbnail)
          values (
            ${projectId}, 'basemap a', 'MAPBOX',
            'mapbox://my-map/id', 'https://thumbnail.org/1.png'
          ) returning id`)) as number;

        const dataTableStates = {
          "toc-stable-id": {
            stableId: "11111111-2222-3333-4444-555555555555",
            column: "biomass",
            op: "sum",
          },
        };

        const bookmark = await conn.one(sql`
          select data_table_states
          from create_map_bookmark(
            ${slug},
            true,
            ${sql.json({})},
            ${sql.array([], "text")},
            ${basemapId},
            ${sql.json({})},
            ${sql.json({ center: [0, 0], zoom: 1 })},
            ${sql.array([800, 600], "int4")},
            ${sql.array([], "int4")},
            null,
            'basemap a',
            ${sql.json({})},
            ${sql.json({})},
            'data:image/jpeg;base64,abc',
            ${sql.json(dataTableStates)}
          )`);

        expect(bookmark.data_table_states).toEqual(dataTableStates);
      },
    );
  });

  test("in-place organism save records data_table:organism changelog", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const { tocId } = await createDraftLayer(conn, projectId, adminId);
        const previous = {
          version: 1,
          column: "classcode",
          valueKind: "code",
          roles: { classcode: "code" },
          authoredBy: "admin",
        };
        const next = {
          ...previous,
          roles: { classcode: "code", common_name: "commonName" },
        };

        let tableId = 0;
        await asPostgres(
          conn,
          async () => {
            tableId = Number(
              await conn.oneFirst(sql`
                insert into overlay_data_tables (
                  table_of_contents_item_id, project_id, name, join_column, overlay_join_column,
                  row_count, created_by, version, parquet_remote, column_stats_remote,
                  organism
                ) values (
                  ${tocId}, ${projectId}, 'fish', 'site_id', 'id', 10, ${adminId}, 1,
                  'r2://bucket/a.parquet', 'r2://bucket/a.json',
                  ${sql.json(previous)}
                ) returning id`),
            );
          },
          { userId: adminId, projectId },
        );

        await conn.any(sql`
          select update_overlay_data_table_organism(
            ${tableId},
            ${sql.json(next)}
          )`);

        const stored = await conn.oneFirst(
          sql`select organism from overlay_data_tables where id = ${tableId}`,
        );
        expect(stored).toEqual(next);

        const changelog = await conn.one(sql`
          select field_group, editor_id, from_summary, to_summary, meta
          from change_logs
          where entity_type = 'overlay_data_table'
            and entity_id = ${tableId}
            and field_group = 'data_table:organism'
          order by last_at desc
          limit 1`);
        expect(changelog.editor_id).toBe(adminId);
        expect(changelog.meta).toEqual(
          expect.objectContaining({
            table_of_contents_item_id: tocId,
            reprocessed: false,
          }),
        );
        expect(changelog.from_summary).toEqual(
          expect.objectContaining({ organism: previous }),
        );
        expect(changelog.to_summary).toEqual(
          expect.objectContaining({ organism: next }),
        );
      },
    );
  });

  test("admin can start an organism reprocess without writing organism yet", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const { tocId, sourceId } = await createDraftLayer(
          conn,
          projectId,
          adminId,
        );
        await conn.any(sql`
          update table_of_contents_items
          set enable_data_tables = true, data_table_join_column = 'id'
          where id = ${tocId}`);

        const config = {
          column: "classcode",
          valueKind: "code",
          roles: { classcode: "code" },
        };

        let tableId: number;
        await asPostgres(
          conn,
          async () => {
            await conn.any(sql`
              update data_sources
              set geostats = '{"layers":[{"attributes":[]}]}'::jsonb
              where id = ${sourceId}`);
            tableId = Number(
              await conn.oneFirst(sql`
                insert into overlay_data_tables (
                  table_of_contents_item_id, project_id, name, join_column, overlay_join_column,
                  row_count, created_by, version, parquet_remote, column_stats_remote
                ) values (
                  ${tocId}, ${projectId}, 'fish', 'site_id', 'id', 10, ${adminId}, 1,
                  'r2://bucket/old.parquet', 'r2://bucket/old.json'
                ) returning id`),
            );
          },
          { userId: adminId, projectId },
        );

        const upload = await conn.one(sql`
          select * from create_overlay_data_table_organism_reprocess(
            ${tableId},
            ${sql.json(config)}
          )`);

        expect(upload.reprocess_of_overlay_data_table_id).toBe(tableId);
        expect(upload.replace_overlay_data_table_id).toBeNull();
        expect(upload.organism_config).toEqual(config);

        const after = await conn.oneFirst(
          sql`select organism from overlay_data_tables where id = ${tableId}`,
        );
        expect(after).toBeNull();
      },
    );
  });

  test("organism reprocess complete updates the existing table", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const { tocId, sourceId } = await createDraftLayer(
          conn,
          projectId,
          adminId,
        );
        await conn.any(sql`
          update table_of_contents_items
          set enable_data_tables = true, data_table_join_column = 'id'
          where id = ${tocId}`);

        const config = {
          column: "classcode",
          valueKind: "code",
          roles: { classcode: "code" },
        };
        const organism = {
          version: 1,
          ...config,
          authoredBy: "admin",
        };

        let tableId: number;
        await asPostgres(
          conn,
          async () => {
            await conn.any(sql`
              update data_sources
              set geostats = '{"layers":[{"attributes":[]}]}'::jsonb
              where id = ${sourceId}`);
            tableId = Number(
              await conn.oneFirst(sql`
                insert into overlay_data_tables (
                  table_of_contents_item_id, project_id, name, join_column, overlay_join_column,
                  row_count, created_by, version, parquet_remote, column_stats_remote
                ) values (
                  ${tocId}, ${projectId}, 'fish', 'site_id', 'id', 10, ${adminId}, 1,
                  'r2://bucket/old.parquet', 'r2://bucket/old.json'
                ) returning id`),
            );
          },
          { userId: adminId, projectId },
        );

        const upload = await conn.one(sql`
          select * from create_overlay_data_table_organism_reprocess(
            ${tableId},
            ${sql.json(config)}
          )`);

        await asPostgres(
          conn,
          async () => {
            await conn.any(sql`
              select complete_overlay_data_table_organism_reprocess(
                ${upload.project_background_job_id},
                ${sql.json(organism)}
              )`);
          },
          { userId: adminId, projectId },
        );

        const row = await conn.one(sql`
          select id, version, organism, deleted_at
          from overlay_data_tables
          where id = ${tableId}`);
        expect(row.version).toBe(1);
        expect(row.deleted_at).toBeNull();
        expect(row.organism).toEqual(organism);

        const changelog = await conn.one(sql`
          select field_group, meta
          from change_logs
          where entity_type = 'overlay_data_table'
            and entity_id = ${tableId}
            and field_group = 'data_table:organism'
          order by last_at desc
          limit 1`);
        expect(changelog.meta).toEqual(
          expect.objectContaining({ reprocessed: true }),
        );
      },
    );
  });
});
