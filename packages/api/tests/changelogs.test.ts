import { sql, DatabaseTransactionConnectionType } from "slonik";
import { createPool } from "./pool";
import {
  addGroupToAcl,
  clearSession,
  createGroup,
  createSession,
  projectTransaction,
} from "./helpers";
// @ts-ignore
import nanoid from "nanoid";

const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
const id = nanoid.customAlphabet(alphabet, 9);

const pool = createPool("test");

type TocLayer = {
  sourceId: number;
  layerId: number;
  itemId: number;
  stableId: string;
  interactivitySettingsId: number;
};

async function withPg<T>(
  conn: DatabaseTransactionConnectionType,
  fn: () => Promise<T>,
) {
  const userId = (await conn.oneFirst(
    sql`select nullif(current_setting('session.user_id', true), '')::int`,
  )) as number | null;
  const projectId = (await conn.oneFirst(
    sql`select nullif(current_setting('session.project_id', true), '')::int`,
  )) as number | null;

  await conn.any(sql`set role postgres`);
  try {
    return await fn();
  } finally {
    if (userId) {
      await createSession(conn, userId, true, false, projectId || undefined);
    }
  }
}

async function clearLogs(conn: DatabaseTransactionConnectionType) {
  await withPg(conn, () => conn.any(sql`delete from change_logs`));
}

async function countLogs(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
) {
  return Number(
    await withPg(conn, () =>
      conn.oneFirst(
        sql`select count(*)::int from change_logs where project_id = ${projectId}`,
      ),
    ),
  );
}

async function logsFor(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  fieldGroup: string,
) {
  return withPg(conn, () =>
    conn.any(sql`
      select
        project_id,
        editor_id,
        entity_type,
        entity_id,
        field_group::text as field_group,
        status::text as status,
        save_count,
        from_summary,
        to_summary,
        from_blob,
        to_blob,
        meta,
        net_zero_changes
      from change_logs
      where project_id = ${projectId}
        and field_group::text = ${fieldGroup}
      order by started_at, id
    `),
  );
}

async function closeLogs(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
) {
  await withPg(conn, () =>
    conn.any(
      sql`update change_logs set status = 'closed' where project_id = ${projectId}`,
    ),
  );
}

async function ageLog(
  conn: DatabaseTransactionConnectionType,
  id: number | string,
) {
  await withPg(conn, () =>
    conn.any(sql`
      update change_logs
      set last_at = clock_timestamp() - interval '2 minutes'
      where id = ${id}
    `),
  );
}

async function onlyLogFor(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  fieldGroup: string,
) {
  const rows = await logsFor(conn, projectId, fieldGroup);
  expect(rows).toHaveLength(1);
  return rows[0] as any;
}

async function createTocLayer(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  title = "Layer",
): Promise<TocLayer> {
  const sourceId = Number(
    await conn.oneFirst(sql`
      insert into data_sources (project_id, type, url, attribution)
      values (${projectId}, 'vector', 'https://example.com/vector-tiles/{z}/{x}/{y}.pbf', 'Initial attribution')
      returning id
    `),
  );
  const layer = (await conn.one(sql`
      insert into data_layers (project_id, data_source_id, source_layer, mapbox_gl_styles)
      values (${projectId}, ${sourceId}, 'test-layer', ${sql.json([
        { type: "fill", paint: { "fill-color": "#ff0000" } },
      ])})
      returning id, interactivity_settings_id
    `)) as any;
  const stableId = id();
  const itemId = Number(
    await conn.oneFirst(sql`
      insert into table_of_contents_items (project_id, title, is_folder, data_layer_id, stable_id, metadata)
      values (${projectId}, ${title}, false, ${layer.id}, ${stableId}, ${sql.json(
        { description: "Initial metadata" },
      )})
      returning id
    `),
  );

  return {
    sourceId,
    layerId: Number(layer.id),
    itemId,
    stableId,
    interactivitySettingsId: Number(layer.interactivity_settings_id),
  };
}

async function createFolder(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  title = "Folder",
) {
  const stableId = id();
  const itemId = Number(
    await conn.oneFirst(sql`
      insert into table_of_contents_items (project_id, title, is_folder, stable_id)
      values (${projectId}, ${title}, true, ${stableId})
      returning id
    `),
  );
  return { itemId, stableId };
}

async function tocAclId(
  conn: DatabaseTransactionConnectionType,
  itemId: number,
) {
  return Number(
    await conn.oneFirst(
      sql`select id from access_control_lists where table_of_contents_item_id = ${itemId}`,
    ),
  );
}

describe("change_logs", () => {
  test("supports every current field group", async () => {
    const groups = await pool.any(sql`
      select enumlabel
      from pg_enum
      join pg_type on pg_enum.enumtypid = pg_type.oid
      where pg_type.typname = 'change_log_field_group'
      order by enumlabel
    `);

    expect(groups.map((row: any) => row.enumlabel).sort()).toEqual(
      [
        "folder:acl",
        "folder:created",
        "folder:deleted",
        "folder:title",
        "folder:type",
        "layer:acl",
        "layer:attribution",
        "layer:cartography",
        "layer:deleted",
        "layer:downloadable",
        "layer:interactivity",
        "layer:metadata",
        "layer:parent-changed",
        "layer:title",
        "layer:uploaded",
        "layers:published",
        "layers:z-order-change",
      ].sort(),
    );
  });

  test("record_changelog merges within the field group window and closes stale open rows", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const layer = await createTocLayer(conn, projectId);
        await clearLogs(conn);

        const firstId = await withPg(conn, () =>
          conn.oneFirst(sql`
            select record_changelog(
              ${projectId},
              ${adminId},
              'table_of_contents_items',
              ${layer.itemId},
              'layer:title'::change_log_field_group,
              ${sql.json({ title: "before" })},
              ${sql.json({ title: "after" })},
              null,
              null,
              null
            )
          `),
        );
        const secondId = await withPg(conn, () =>
          conn.oneFirst(sql`
            select record_changelog(
              ${projectId},
              ${adminId},
              'table_of_contents_items',
              ${layer.itemId},
              'layer:title'::change_log_field_group,
              ${sql.json({ title: "before ignored" })},
              ${sql.json({ title: "after again" })},
              null,
              null,
              null
            )
          `),
        );

        expect(secondId).toBe(firstId);
        let row = await onlyLogFor(conn, projectId, "layer:title");
        expect(row.save_count).toBe(2);
        expect(row.from_summary).toEqual({ title: "before" });
        expect(row.to_summary).toEqual({ title: "after again" });
        expect(row.status).toBe("open");

        await ageLog(conn, firstId as string | number);
        const thirdId = await withPg(conn, () =>
          conn.oneFirst(sql`
            select record_changelog(
              ${projectId},
              ${adminId},
              'table_of_contents_items',
              ${layer.itemId},
              'layer:title'::change_log_field_group,
              ${sql.json({ title: "new before" })},
              ${sql.json({ title: "new after" })},
              null,
              null,
              null
            )
          `),
        );

        expect(thirdId).not.toBe(firstId);
        const rows = await logsFor(conn, projectId, "layer:title");
        expect(rows.map((log: any) => log.status)).toEqual(["closed", "open"]);
      },
    );
  });

  test("records title changes for layers and folders, but only for draft items with a session editor", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const layer = await createTocLayer(conn, projectId, "Layer A");
        const folder = await createFolder(conn, projectId, "Folder A");
        await clearLogs(conn);

        await conn.any(
          sql`update table_of_contents_items set title = 'Layer B' where id = ${layer.itemId}`,
        );
        await conn.any(
          sql`update table_of_contents_items set title = 'Folder B' where id = ${folder.itemId}`,
        );

        let log = await onlyLogFor(conn, projectId, "layer:title");
        expect(log.entity_type).toBe("table_of_contents_items");
        expect(log.entity_id).toBe(layer.itemId);
        expect(log.editor_id).toBe(adminId);
        expect(log.from_summary).toEqual({ title: "Layer A" });
        expect(log.to_summary).toEqual({ title: "Layer B" });

        log = await onlyLogFor(conn, projectId, "folder:title");
        expect(log.entity_id).toBe(folder.itemId);
        expect(log.from_summary).toEqual({ title: "Folder A" });
        expect(log.to_summary).toEqual({ title: "Folder B" });

        await clearLogs(conn);
        await clearLogs(conn);
        await clearSession(conn);
        await withPg(conn, () =>
          conn.any(
            sql`update table_of_contents_items set title = 'Layer C' where id = ${layer.itemId}`,
          ),
        );
        expect(await countLogs(conn, projectId)).toBe(0);
      },
    );
  });

  test("records folder creation and all folder type variants", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        await clearLogs(conn);
        const folder = await createFolder(conn, projectId, "New Folder");

        let log = await onlyLogFor(conn, projectId, "folder:created");
        expect(log.entity_id).toBe(folder.itemId);
        expect(log.from_summary).toEqual({});
        expect(log.to_summary).toEqual({ title: "New Folder" });

        await clearLogs(conn);
        await conn.any(
          sql`update table_of_contents_items set hide_children = true where id = ${folder.itemId}`,
        );
        log = await onlyLogFor(conn, projectId, "folder:type");
        expect(log.from_summary).toEqual({ type: "DEFAULT" });
        expect(log.to_summary).toEqual({ type: "HIDDEN_CHILDREN" });
        expect(log.to_blob).toMatchObject({ hide_children: true });

        await closeLogs(conn, projectId);
        await conn.any(sql`
          update table_of_contents_items
          set hide_children = false, is_click_off_only = true
          where id = ${folder.itemId}
        `);
        log = (await logsFor(conn, projectId, "folder:type"))[1] as any;
        expect(log.from_summary).toEqual({ type: "HIDDEN_CHILDREN" });
        expect(log.to_summary).toEqual({ type: "CHECK_OFF_ONLY" });

        await closeLogs(conn, projectId);
        await conn.any(sql`
          update table_of_contents_items
          set is_click_off_only = false, show_radio_children = true
          where id = ${folder.itemId}
        `);
        log = (await logsFor(conn, projectId, "folder:type"))[2] as any;
        expect(log.from_summary).toEqual({ type: "CHECK_OFF_ONLY" });
        expect(log.to_summary).toEqual({ type: "RADIO_CHILDREN" });
      },
    );
  });

  test("records layer metadata, cartography, attribution, and interactivity changes", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const layer = await createTocLayer(conn, projectId);
        await clearLogs(conn);

        await conn.any(sql`
          update table_of_contents_items
          set metadata = ${sql.json({ description: "Updated metadata" })}
          where id = ${layer.itemId}
        `);
        let log = await onlyLogFor(conn, projectId, "layer:metadata");
        expect(log.from_summary).toEqual({});
        expect(log.to_summary).toEqual({});
        expect(log.from_blob).toEqual({ description: "Initial metadata" });
        expect(log.to_blob).toEqual({ description: "Updated metadata" });

        await conn.any(sql`
          update data_layers
          set mapbox_gl_styles = ${sql.json([
            { type: "line", paint: { "line-color": "#00ff00" } },
          ])}
          where id = ${layer.layerId}
        `);
        log = await onlyLogFor(conn, projectId, "layer:cartography");
        expect(log.entity_id).toBe(layer.itemId);
        expect(log.to_blob).toEqual([
          { type: "line", paint: { "line-color": "#00ff00" } },
        ]);

        await conn.any(sql`
          update data_sources
          set attribution = 'Updated attribution'
          where id = ${layer.sourceId}
        `);
        log = await onlyLogFor(conn, projectId, "layer:attribution");
        expect(log.from_summary).toEqual({
          attribution: "Initial attribution",
        });
        expect(log.to_summary).toEqual({ attribution: "Updated attribution" });

        await conn.any(sql`
          update interactivity_settings
          set type = 'BANNER', title = 'Feature title', short_template = 'Short', long_template = 'Long'
          where id = ${layer.interactivitySettingsId}
        `);
        log = await onlyLogFor(conn, projectId, "layer:interactivity");
        expect(log.entity_id).toBe(layer.itemId);
        expect(log.to_summary).toEqual({
          type: "BANNER",
          text_changes: true,
        });
        expect(log.to_blob).toMatchObject({
          title: "Feature title",
          short_template: "Short",
          long_template: "Long",
        });

        await clearLogs(conn);
        await conn.any(sql`
          update interactivity_settings
          set cursor = 'POINTER'
          where id = ${layer.interactivitySettingsId}
        `);
        expect(await countLogs(conn, projectId)).toBe(0);
      },
    );
  });

  test("records downloadable changes, including the bulk marker", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const layer = await createTocLayer(conn, projectId);
        await withPg(conn, () =>
          conn.any(
            sql`update table_of_contents_items set enable_download = true where id = ${layer.itemId}`,
          ),
        );
        await clearLogs(conn);

        await conn.any(
          sql`update table_of_contents_items set enable_download = false where id = ${layer.itemId}`,
        );
        let log = await onlyLogFor(conn, projectId, "layer:downloadable");
        expect(log.from_summary).toEqual({ enable_download: true });
        expect(log.to_summary).toEqual({ enable_download: false });
        expect(log.from_blob).toBeNull();
        expect(log.to_blob).toBeNull();

        await withPg(conn, () =>
          conn.any(
            sql`update table_of_contents_items set enable_download = true where id = ${layer.itemId}`,
          ),
        );
        await clearLogs(conn);
        await conn.any(
          sql`select set_config('seasketch.bulk_layer_download', 'true', true)`,
        );
        await withPg(conn, () =>
          conn.any(
            sql`update table_of_contents_items set enable_download = false where id = ${layer.itemId}`,
          ),
        );
        await conn.any(
          sql`select set_config('seasketch.bulk_layer_download', 'false', true)`,
        );
        log = await onlyLogFor(conn, projectId, "layer:downloadable");
        expect(log.from_summary).toEqual({
          enable_download: true,
          bulk: true,
        });
        expect(log.to_summary).toEqual({ enable_download: false, bulk: true });
        expect(log.to_blob).toEqual({ enable_download: false, bulk: true });
      },
    );
  });

  test("records parent changes for layers without logging no-op child order rewrites", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const folderA = await createFolder(conn, projectId, "Folder A");
        const folderB = await createFolder(conn, projectId, "Folder B");
        const layer = await createTocLayer(conn, projectId);
        await clearLogs(conn);

        await conn.any(
          sql`select update_table_of_contents_item_parent(${layer.itemId}, ${folderA.stableId})`,
        );
        let log = await onlyLogFor(conn, projectId, "layer:parent-changed");
        expect(log.from_summary).toEqual({ folder: null });
        expect(log.to_summary).toEqual({ folder: "Folder A" });
        expect(log.to_blob).toEqual({
          parent_stable_id: folderA.stableId,
        });

        await clearLogs(conn);
        await conn.any(
          sql`select update_table_of_contents_item_children(${folderA.itemId}, ${sql.array(
            [layer.itemId],
            "int4",
          )})`,
        );
        expect(await countLogs(conn, projectId)).toBe(0);

        await conn.any(
          sql`select update_table_of_contents_item_parent(${layer.itemId}, ${folderB.stableId})`,
        );
        log = await onlyLogFor(conn, projectId, "layer:parent-changed");
        expect(log.from_summary).toEqual({ folder: "Folder A" });
        expect(log.to_summary).toEqual({ folder: "Folder B" });
      },
    );
  });

  test("records layer and folder ACL type and group membership changes", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const layer = await createTocLayer(conn, projectId);
        const folder = await createFolder(conn, projectId);
        const layerAclId = await tocAclId(conn, layer.itemId);
        const folderAclId = await tocAclId(conn, folder.itemId);
        const groupId = await createGroup(conn, projectId, "Test Group", [
          userA,
        ]);
        await clearLogs(conn);

        await conn.any(
          sql`update access_control_lists set type = 'admins_only' where id = ${layerAclId}`,
        );
        let log = await onlyLogFor(conn, projectId, "layer:acl");
        expect(log.entity_id).toBe(layer.itemId);
        expect(log.from_summary).toEqual({ type: "public", groups: [] });
        expect(log.to_summary).toEqual({ type: "admins_only", groups: [] });

        await conn.any(
          sql`update access_control_lists set type = 'group' where id = ${folderAclId}`,
        );
        log = await onlyLogFor(conn, projectId, "folder:acl");
        expect(log.entity_id).toBe(folder.itemId);
        expect(log.from_summary).toEqual({ type: "public", groups: [] });
        expect(log.to_summary).toEqual({ type: "group", groups: [] });

        await clearLogs(conn);
        await addGroupToAcl(conn, layerAclId, groupId);
        log = await onlyLogFor(conn, projectId, "layer:acl");
        expect(log.from_summary).toEqual({
          type: "admins_only",
          groups: [],
        });
        expect(log.to_summary).toEqual({
          type: "admins_only",
          groups: ["Test Group"],
        });
        expect(log.to_blob).toEqual({
          type: "admins_only",
          groups: [{ id: groupId, name: "Test Group" }],
        });
      },
    );
  });

  test("records delete changelogs for draft layers and folders", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const layer = await createTocLayer(conn, projectId, "Delete Layer");
        const folder = await createFolder(conn, projectId, "Delete Folder");
        await clearLogs(conn);

        await withPg(conn, () =>
          conn.any(
            sql`delete from table_of_contents_items where id = ${layer.itemId}`,
          ),
        );
        let log = await onlyLogFor(conn, projectId, "layer:deleted");
        expect(log.entity_id).toBe(layer.itemId);
        expect(log.from_summary).toEqual({
          title: "Delete Layer",
          is_folder: false,
        });
        expect(log.to_summary).toEqual({});
        expect(log.from_blob).toMatchObject({
          data_layer_id: layer.layerId,
          data_source_id: layer.sourceId,
        });

        await withPg(conn, () =>
          conn.any(
            sql`delete from table_of_contents_items where id = ${folder.itemId}`,
          ),
        );
        log = await onlyLogFor(conn, projectId, "folder:deleted");
        expect(log.entity_id).toBe(folder.itemId);
        expect(log.from_summary).toEqual({
          title: "Delete Folder",
          is_folder: true,
        });
        expect(log.from_blob).toEqual({
          data_source_type: null,
          data_layer_id: null,
          data_source_id: null,
        });
      },
    );
  });

  test("records layer uploads for insert and replacement variants using uploaded_by", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        await clearLogs(conn);

        const insertSourceId = Number(
          await conn.oneFirst(sql`
            insert into data_sources (
              project_id, type, url, import_type, byte_length, uploaded_by, uploaded_source_filename
            ) values (
              ${projectId}, 'seasketch-vector', 'https://example.com/uploaded-a.fgb', 'upload', 0, ${userA}, 'uploaded-a.geojson'
            ) returning id
          `),
        );
        const insertLayerId = Number(
          await conn.oneFirst(sql`
            insert into data_layers (project_id, data_source_id, mapbox_gl_styles)
            values (${projectId}, ${insertSourceId}, ${sql.json([
              { type: "circle", paint: { "circle-color": "#0000ff" } },
            ])})
            returning id
          `),
        );
        const uploadedItemId = Number(
          await conn.oneFirst(sql`
            insert into table_of_contents_items (project_id, title, is_folder, data_layer_id, stable_id)
            values (${projectId}, 'Uploaded Layer', false, ${insertLayerId}, ${id()})
            returning id
          `),
        );
        let log = await onlyLogFor(conn, projectId, "layer:uploaded");
        expect(log.editor_id).toBe(userA);
        expect(log.entity_id).toBe(uploadedItemId);
        expect(log.to_summary).toEqual({ filename: "uploaded-a.geojson" });
        expect(log.meta).toEqual({
          data_source_id: insertSourceId,
          url: "https://example.com/uploaded-a.fgb",
        });

        await clearLogs(conn);
        const normal = await createTocLayer(conn, projectId, "Replace via TOC");
        const replacementSourceId = Number(
          await conn.oneFirst(sql`
            insert into data_sources (
              project_id, type, url, import_type, byte_length, uploaded_by, uploaded_source_filename, changelog
            ) values (
              ${projectId}, 'seasketch-vector', 'https://example.com/uploaded-b.fgb', 'upload', 0, ${userA}, 'uploaded-b.geojson', 'cleaned geometry'
            ) returning id
          `),
        );
        const replacementLayerId = Number(
          await conn.oneFirst(sql`
            insert into data_layers (project_id, data_source_id, mapbox_gl_styles)
            values (${projectId}, ${replacementSourceId}, ${sql.json([
              { type: "circle", paint: { "circle-color": "#00ffff" } },
            ])})
            returning id
          `),
        );
        await clearLogs(conn);
        await conn.any(sql`
          update table_of_contents_items
          set data_layer_id = ${replacementLayerId}
          where id = ${normal.itemId}
        `);
        log = await onlyLogFor(conn, projectId, "layer:uploaded");
        expect(log.entity_id).toBe(normal.itemId);
        expect(log.to_summary).toEqual({
          filename: "uploaded-b.geojson",
          replacement: true,
          changelog: "cleaned geometry",
        });

        await clearLogs(conn);
        const secondReplacementSourceId = Number(
          await conn.oneFirst(sql`
            insert into data_sources (
              project_id, type, url, import_type, byte_length, uploaded_by, uploaded_source_filename, changelog
            ) values (
              ${projectId}, 'seasketch-vector', 'https://example.com/uploaded-c.fgb', 'upload', 0, ${userA}, 'uploaded-c.geojson', 'new attributes'
            ) returning id
          `),
        );
        await conn.any(sql`
          update data_layers
          set data_source_id = ${secondReplacementSourceId}
          where id = ${replacementLayerId}
        `);
        log = await onlyLogFor(conn, projectId, "layer:uploaded");
        expect(log.entity_id).toBe(normal.itemId);
        expect(log.to_summary).toEqual({
          filename: "uploaded-c.geojson",
          replacement: true,
          changelog: "new attributes",
        });
        expect(log.meta).toEqual({
          data_source_id: secondReplacementSourceId,
          url: "https://example.com/uploaded-c.fgb",
        });
      },
    );
  });

  test("records project-level publish and z-order changes", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const layerA = await createTocLayer(conn, projectId, "Layer A");
        const layerB = await createTocLayer(conn, projectId, "Layer B");
        await clearLogs(conn);

        await conn.any(sql`select publish_table_of_contents(${projectId})`);
        let log = await onlyLogFor(conn, projectId, "layers:published");
        expect(log.entity_type).toBe("projects");
        expect(log.entity_id).toBe(projectId);
        expect(log.from_summary).toEqual({});
        expect(log.to_summary).toEqual({ layer_count: 2 });
        expect(log.from_blob).toBeNull();
        expect(log.to_blob).toBeNull();

        await clearLogs(conn);
        await conn.any(sql`
          select update_z_indexes(${sql.array(
            [layerB.layerId, layerA.layerId],
            "int4",
          )})
        `);
        log = await onlyLogFor(conn, projectId, "layers:z-order-change");
        expect(log.entity_type).toBe("projects");
        expect(log.entity_id).toBe(projectId);
        expect(log.from_summary).toEqual({});
        expect(log.to_summary).toEqual({});
        expect(log.from_blob).toBeNull();
        expect(log.to_blob).toBeNull();

        const indexes = await conn.any(sql`
          select id, z_index
          from data_layers
          where id = any(${sql.array([layerA.layerId, layerB.layerId], "int4")})
          order by z_index
        `);
        expect(indexes.map((row: any) => row.id)).toEqual([
          layerB.layerId,
          layerA.layerId,
        ]);
      },
    );
  });
});
