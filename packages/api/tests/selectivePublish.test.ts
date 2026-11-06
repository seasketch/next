import { sql } from "slonik";
import { randomUUID } from "crypto";
import { createPool } from "./pool";
import {
  addParticipant,
  createSession,
  projectTransaction,
} from "./helpers";

const pool = createPool("test");

function sid() {
  return randomUUID().replace(/-/g, "");
}

async function addFolder(
  conn: any,
  projectId: number,
  title: string,
  parent?: string | null
) {
  const stableId = sid();
  const id = Number(
    await conn.oneFirst(sql`
      insert into table_of_contents_items
        (project_id, title, is_folder, stable_id, parent_stable_id)
      values
        (${projectId}, ${title}, true, ${stableId}, ${parent ?? null})
      returning id
    `)
  );
  return { id, stableId, title };
}

async function addLayer(
  conn: any,
  projectId: number,
  title: string,
  parent?: string | null,
  sourceId?: number
) {
  const stableId = sid();
  const source =
    sourceId ??
    Number(
      await conn.oneFirst(sql`
        insert into data_sources (project_id, type, url, attribution)
        values (
          ${projectId},
          'geojson',
          ${"https://example.com/" + stableId + ".json"},
          'original'
        )
        returning id
      `)
    );
  const layerId = Number(
    await conn.oneFirst(sql`
      insert into data_layers (project_id, data_source_id, mapbox_gl_styles, z_index)
      values (${projectId}, ${source}, '{"layers":[]}'::jsonb, 0)
      returning id
    `)
  );
  const itemId = Number(
    await conn.oneFirst(sql`
      insert into table_of_contents_items (
        project_id, title, is_folder, data_layer_id, stable_id, parent_stable_id
      ) values (
        ${projectId}, ${title}, false, ${layerId}, ${stableId}, ${parent ?? null}
      )
      returning id
    `)
  );
  return { itemId, stableId, layerId, sourceId: source, title };
}

async function publishAll(conn: any, projectId: number) {
  await conn.any(sql`select publish_table_of_contents(${projectId})`);
}

async function publishSome(
  conn: any,
  projectId: number,
  stableIds: string[]
) {
  await conn.any(sql`
    select publish_table_of_contents_items(
      ${projectId},
      ${sql.array(stableIds, "text")}
    )
  `);
}

async function pending(conn: any, projectId: number) {
  return conn.any(sql`
    select
      u.stable_id,
      u.kind,
      u.title,
      u.is_folder,
      u.bundle_id,
      u.included_in_bundle,
      u.requires_stable_ids,
      u.draft_id
    from projects p
    cross join lateral projects_pending_publish_items(p) u
    where p.id = ${projectId}
    order by u.kind, u.title
  `);
}

async function publishedTitles(conn: any, projectId: number) {
  const rows = await conn.any(sql`
    select title
    from table_of_contents_items
    where project_id = ${projectId} and not is_draft
    order by title
  `);
  return rows.map((row) => row.title);
}

async function siblingOrder(
  conn: any,
  projectId: number,
  parent: string | null,
  draft: boolean
) {
  const rows = await conn.any(sql`
    select stable_id
    from table_of_contents_items
    where project_id = ${projectId}
      and is_draft = ${draft}
      and parent_stable_id is not distinct from ${parent}
    order by sort_index, stable_id
  `);
  return rows.map((row) => row.stable_id);
}

async function zOrder(conn: any, projectId: number, draft: boolean) {
  const rows = await conn.any(sql`
    select t.stable_id
    from table_of_contents_items t
    join data_layers dl on dl.id = t.data_layer_id
    where t.project_id = ${projectId}
      and t.is_draft = ${draft}
      and not t.is_folder
    order by dl.z_index, t.stable_id
  `);
  return rows.map((row) => row.stable_id);
}

async function move(
  conn: any,
  itemId: number,
  parent: string | null,
  sortIndex: number
) {
  await conn.any(sql`
    select update_table_of_contents_item_position(
      ${itemId},
      ${parent},
      ${sortIndex}
    )
  `);
}

async function hasChanges(conn: any, projectId: number) {
  return Boolean(
    await conn.oneFirst(sql`
      select draft_table_of_contents_has_changes
      from projects where id = ${projectId}
    `)
  );
}

function asAdmin(
  fn: (
    conn: any,
    projectId: number,
    adminId: number,
    users: [number, number]
  ) => Promise<void>
) {
  return projectTransaction(
    pool,
    "public",
    async (conn, projectId, adminId, users) => {
      await createSession(conn, adminId, true, false, projectId);
      await fn(conn, projectId, adminId, users);
    }
  );
}

describe("selective overlay publish", () => {
  jest.setTimeout(30000);

  test("1. a layer's edits publish as one current state", async () => {
    await asAdmin( async (conn, projectId) => {
      const layer = await addLayer(conn, projectId, "Coral");
      await publishAll(conn, projectId);
      await conn.any(sql`
        update table_of_contents_items
        set title = 'Coral cover', metadata = '{"a":1}'::jsonb
        where id = ${layer.itemId}
      `);
      await conn.any(sql`
        update data_layers
        set mapbox_gl_styles = '{"layers":[{"id":"x"}]}'::jsonb
        where id = ${layer.layerId}
      `);
      const rows = await pending(conn, projectId);
      expect(rows).toHaveLength(1);
      expect(rows[0].kind).toBe("updated");
      expect(rows[0].stable_id).toBe(layer.stableId);
      await publishSome(conn, projectId, [layer.stableId]);
      const published = await conn.one(sql`
        select t.title, t.metadata, dl.mapbox_gl_styles
        from table_of_contents_items t
        join data_layers dl on dl.id = t.data_layer_id
        where t.project_id = ${projectId}
          and not t.is_draft
          and t.stable_id = ${layer.stableId}
      `);
      expect(published.title).toBe("Coral cover");
      expect(published.metadata).toEqual({ a: 1 });
      expect(published.mapbox_gl_styles).toEqual({ layers: [{ id: "x" }] });
      expect(await pending(conn, projectId)).toHaveLength(0);
    });
  });

  test("2. deleting a layer publishes the removal, not its earlier edits", async () => {
    await asAdmin( async (conn, projectId) => {
      const layer = await addLayer(conn, projectId, "Coral");
      await publishAll(conn, projectId);
      await conn.any(sql`
        update table_of_contents_items set title = 'Renamed' where id = ${layer.itemId}
      `);
      await conn.any(sql`select delete_table_of_contents_branch(${layer.itemId})`);
      const rows = await pending(conn, projectId);
      expect(rows.map((row) => row.kind)).toEqual(["removed"]);
      expect(rows[0].title).toBe("Coral");
      await publishSome(conn, projectId, [layer.stableId]);
      expect(await publishedTitles(conn, projectId)).toEqual([]);
    });
  });

  test("3. an item created and deleted since publish has no unit", async () => {
    await asAdmin( async (conn, projectId) => {
      const kept = await addLayer(conn, projectId, "Kept");
      await publishAll(conn, projectId);
      const fleeting = await addLayer(conn, projectId, "Fleeting");
      await conn.any(
        sql`select delete_table_of_contents_branch(${fleeting.itemId})`
      );
      const rows = await pending(conn, projectId);
      expect(rows.find((row) => row.title === "Fleeting")).toBeUndefined();
      expect(rows.find((row) => row.stable_id === kept.stableId)).toBeUndefined();
    });
  });

  test("4. a new layer publishes whole and is appended, leaving sibling order alone", async () => {
    await asAdmin( async (conn, projectId) => {
      const a = await addLayer(conn, projectId, "A");
      const b = await addLayer(conn, projectId, "B");
      await publishAll(conn, projectId);
      const d = await addLayer(conn, projectId, "D");
      await move(conn, a.itemId, null, 0);
      await move(conn, d.itemId, null, 1);
      await move(conn, b.itemId, null, 2);
      await publishSome(conn, projectId, [d.stableId]);
      expect(await siblingOrder(conn, projectId, null, false)).toEqual([
        a.stableId,
        b.stableId,
        d.stableId,
      ]);
      expect(await publishedTitles(conn, projectId)).toEqual(["A", "B", "D"]);
      expect(await hasChanges(conn, projectId)).toBe(true);
    });
  });

  test("5. replacing a layer source publishes with the layer", async () => {
    await asAdmin( async (conn, projectId) => {
      const layer = await addLayer(conn, projectId, "Coral");
      await publishAll(conn, projectId);
      const replacement = Number(
        await conn.oneFirst(sql`
          insert into data_sources (project_id, type, url)
          values (${projectId}, 'geojson', 'https://example.com/new.json')
          returning id
        `)
      );
      await conn.any(sql`
        update data_layers set data_source_id = ${replacement} where id = ${layer.layerId}
      `);
      await publishSome(conn, projectId, [layer.stableId]);
      const url = await conn.oneFirst(sql`
        select ds.url
        from table_of_contents_items t
        join data_layers dl on dl.id = t.data_layer_id
        join data_sources ds on ds.id = dl.data_source_id
        where t.project_id = ${projectId}
          and not t.is_draft
          and t.stable_id = ${layer.stableId}
      `);
      expect(url).toBe("https://example.com/new.json");
    });
  });

  test("6. a duplicated layer is an independent added unit", async () => {
    await asAdmin( async (conn, projectId) => {
      const layer = await addLayer(conn, projectId, "Coral");
      await publishAll(conn, projectId);
      const copy = await addLayer(conn, projectId, "Coral copy");
      await publishSome(conn, projectId, [copy.stableId]);
      expect(await publishedTitles(conn, projectId)).toEqual([
        "Coral",
        "Coral copy",
      ]);
      const ids = await conn.any(sql`
        select stable_id from table_of_contents_items
        where project_id = ${projectId} and not is_draft
      `);
      expect(new Set(ids.map((row) => row.stable_id)).size).toBe(2);
      expect(ids.map((row) => row.stable_id)).toContain(layer.stableId);
    });
  });

  test("7. download, interactivity, and temporal edits are one updated unit", async () => {
    await asAdmin( async (conn, projectId) => {
      const layer = await addLayer(conn, projectId, "Coral");
      await publishAll(conn, projectId);
      await conn.any(sql`
        update table_of_contents_items
        set enable_download = false
        where id = ${layer.itemId}
      `);
      await conn.any(sql`
        update interactivity_settings
        set type = 'TOOLTIP'
        where id = (
          select interactivity_settings_id from data_layers where id = ${layer.layerId}
        )
      `);
      await conn.any(sql`
        update data_sources
        set temporal = '{"version":1}'::jsonb
        where id = ${layer.sourceId}
      `);
      const rows = await pending(conn, projectId);
      expect(rows).toHaveLength(1);
      await publishSome(conn, projectId, [layer.stableId]);
      const published = await conn.one(sql`
        select t.enable_download, i.type, ds.temporal
        from table_of_contents_items t
        join data_layers dl on dl.id = t.data_layer_id
        join interactivity_settings i on i.id = dl.interactivity_settings_id
        join data_sources ds on ds.id = dl.data_source_id
        where t.project_id = ${projectId} and not t.is_draft
          and t.stable_id = ${layer.stableId}
      `);
      expect(published.enable_download).toBe(false);
      expect(published.type).toBe("TOOLTIP");
      expect(published.temporal).toEqual({ version: 1 });
    });
  });

  test("8. an untracked field stays out of the checkbox list and survives in the flag", async () => {
    await asAdmin( async (conn, projectId) => {
      const layer = await addLayer(conn, projectId, "Coral");
      await publishAll(conn, projectId);
      await conn.any(sql`
        update table_of_contents_items
        set bounds = '{1,2,3,4}'::numeric[]
        where id = ${layer.itemId}
      `);
      expect(await pending(conn, projectId)).toHaveLength(0);
      expect(await hasChanges(conn, projectId)).toBe(true);
      await publishAll(conn, projectId);
      const bounds = await conn.oneFirst(sql`
        select bounds from table_of_contents_items
        where project_id = ${projectId} and not is_draft and stable_id = ${layer.stableId}
      `);
      expect(bounds).toEqual([1, 2, 3, 4]);
    });
  });

  test("9. a shared source attribution change binds every layer on that source", async () => {
    await asAdmin( async (conn, projectId) => {
      const a = await addLayer(conn, projectId, "A");
      const b = await addLayer(conn, projectId, "B", null, a.sourceId);
      await publishAll(conn, projectId);
      await conn.any(sql`
        update data_sources set attribution = 'shared' where id = ${a.sourceId}
      `);
      const rows = await pending(conn, projectId);
      expect(rows).toHaveLength(2);
      expect(new Set(rows.map((row) => row.bundle_id)).size).toBe(1);
      expect(rows.filter((row) => row.included_in_bundle)).toHaveLength(1);
      await publishSome(conn, projectId, [a.stableId]);
      const sources = await conn.any(sql`
        select t.title, dl.data_source_id, ds.attribution
        from table_of_contents_items t
        join data_layers dl on dl.id = t.data_layer_id
        join data_sources ds on ds.id = dl.data_source_id
        where t.project_id = ${projectId} and not t.is_draft
        order by t.title
      `);
      expect(sources).toHaveLength(2);
      expect(sources[0].data_source_id).toBe(sources[1].data_source_id);
      expect(sources[0].attribution).toBe("shared");
      expect(sources[0].data_source_id).not.toBe(a.sourceId);
      expect(b.stableId).toBeTruthy();
    });
  });

  test("10. a style edit on one layer of a shared source does not bind the other", async () => {
    await asAdmin( async (conn, projectId) => {
      const a = await addLayer(conn, projectId, "A");
      const b = await addLayer(conn, projectId, "B", null, a.sourceId);
      await publishAll(conn, projectId);
      const publishedSource = Number(
        await conn.oneFirst(sql`
          select dl.data_source_id
          from table_of_contents_items t
          join data_layers dl on dl.id = t.data_layer_id
          where t.project_id = ${projectId} and not t.is_draft and t.stable_id = ${b.stableId}
        `)
      );
      await conn.any(sql`
        update data_layers
        set mapbox_gl_styles = '{"layers":[{"id":"only-a"}]}'::jsonb
        where id = ${a.layerId}
      `);
      const rows = await pending(conn, projectId);
      expect(rows.map((row) => row.stable_id)).toEqual([a.stableId]);
      await publishSome(conn, projectId, [a.stableId]);
      const bSource = Number(
        await conn.oneFirst(sql`
          select dl.data_source_id
          from table_of_contents_items t
          join data_layers dl on dl.id = t.data_layer_id
          where t.project_id = ${projectId} and not t.is_draft and t.stable_id = ${b.stableId}
        `)
      );
      expect(bSource).toBe(publishedSource);
    });
  });

  test("11. a data-library source edit is already live and is not a pending unit", async () => {
    await asAdmin( async (conn, projectId, adminId) => {
      const template = `lib-${sid()}`;
      const sourceId = Number(
        await conn.oneFirst(sql`
          insert into data_sources (project_id, type, url, attribution, data_library_template_id)
          values (${projectId}, 'geojson', 'https://example.com/lib.json', 'lib', ${template})
          returning id
        `)
      );
      const layer = await addLayer(conn, projectId, "Library", null, sourceId);
      await conn.any(sql`set role postgres`);
      await conn.any(sql`
        update table_of_contents_items
        set copied_from_data_library_template_id = ${template}
        where id = ${layer.itemId}
      `);
      await createSession(conn, adminId, true, false, projectId);
      await publishAll(conn, projectId);
      await conn.any(sql`
        update data_sources set attribution = 'changed' where id = ${sourceId}
      `);
      expect(
        (await pending(conn, projectId)).find((row) => row.stable_id === layer.stableId)
      ).toBeUndefined();
      await conn.any(sql`
        update table_of_contents_items set title = 'Library renamed' where id = ${layer.itemId}
      `);
      await publishSome(conn, projectId, [layer.stableId]);
      const publishedSource = Number(
        await conn.oneFirst(sql`
          select dl.data_source_id
          from table_of_contents_items t
          join data_layers dl on dl.id = t.data_layer_id
          where t.project_id = ${projectId} and not t.is_draft
        `)
      );
      expect(publishedSource).toBe(sourceId);
    });
  });

  test("12. a data table change publishes with its layer and keeps stable_id", async () => {
    await asAdmin( async (conn, projectId, adminId) => {
      const layer = await addLayer(conn, projectId, "Sites");
      await conn.any(sql`
        update table_of_contents_items
        set enable_data_tables = true, data_table_join_column = 'id'
        where id = ${layer.itemId}
      `);
      await conn.any(sql`set role postgres`);
      const tableId = Number(
        await conn.oneFirst(sql`
          insert into overlay_data_tables (
            table_of_contents_item_id, project_id, name, join_column, overlay_join_column,
            row_count, created_by, parquet_remote, parquet_url, column_stats_remote
          ) values (
            ${layer.itemId}, ${projectId}, 'fish', 'site_id', 'id', 10, ${adminId},
            'r2://bucket/data.parquet', 'https://example.com/data.parquet', 'r2://bucket/stats.json'
          ) returning id
        `)
      );
      await createSession(conn, adminId, true, false, projectId);
      await publishAll(conn, projectId);
      await conn.any(sql`select rename_overlay_data_table(${tableId}, 'fish-2024')`);
      expect((await pending(conn, projectId)).map((row) => row.stable_id)).toEqual([
        layer.stableId,
      ]);
      const draftTableStableId = await conn.oneFirst(sql`
        select stable_id from overlay_data_tables where id = ${tableId}
      `);
      await publishSome(conn, projectId, [layer.stableId]);
      const published = await conn.one(sql`
        select odt.name, odt.stable_id
        from overlay_data_tables odt
        join table_of_contents_items t on t.id = odt.table_of_contents_item_id
        where t.project_id = ${projectId} and not t.is_draft and odt.deleted_at is null
      `);
      expect(published.name).toBe("fish-2024");
      expect(published.stable_id).toBe(draftTableStableId);
    });
  });

  test("13. moving a layer into a published folder needs no other item", async () => {
    await asAdmin( async (conn, projectId) => {
      const folder = await addFolder(conn, projectId, "Habitats");
      const layer = await addLayer(conn, projectId, "Coral");
      await publishAll(conn, projectId);
      await move(conn, layer.itemId, folder.stableId, 0);
      const rows = await pending(conn, projectId);
      expect(rows).toHaveLength(1);
      expect(rows[0].requires_stable_ids).toEqual([]);
      await publishSome(conn, projectId, [layer.stableId]);
      const parent = await conn.oneFirst(sql`
        select parent_stable_id from table_of_contents_items
        where project_id = ${projectId} and not is_draft and stable_id = ${layer.stableId}
      `);
      expect(parent).toBe(folder.stableId);
    });
  });

  test("14. moving a layer into a new folder requires that folder", async () => {
    await asAdmin( async (conn, projectId) => {
      const layer = await addLayer(conn, projectId, "Coral");
      await publishAll(conn, projectId);
      const folder = await addFolder(conn, projectId, "Habitats");
      await move(conn, layer.itemId, folder.stableId, 0);
      const rows = await pending(conn, projectId);
      const layerRow = rows.find((row) => row.stable_id === layer.stableId);
      expect(layerRow.requires_stable_ids).toEqual([folder.stableId]);
      await publishSome(conn, projectId, [layer.stableId]);
      expect(await publishedTitles(conn, projectId)).toEqual(["Coral", "Habitats"]);
    });
  });

  test("15. a move into a nested new folder requires both folders", async () => {
    await asAdmin( async (conn, projectId) => {
      const layer = await addLayer(conn, projectId, "Coral");
      await publishAll(conn, projectId);
      const outer = await addFolder(conn, projectId, "Outer");
      const inner = await addFolder(conn, projectId, "Inner", outer.stableId);
      await move(conn, layer.itemId, inner.stableId, 0);
      const layerRow = (await pending(conn, projectId)).find(
        (row) => row.stable_id === layer.stableId
      );
      expect(new Set(layerRow.requires_stable_ids)).toEqual(
        new Set([outer.stableId, inner.stableId])
      );
      await publishSome(conn, projectId, [layer.stableId]);
      const path = String(
        await conn.oneFirst(sql`
          select path::text from table_of_contents_items
          where project_id = ${projectId} and not is_draft and stable_id = ${layer.stableId}
        `)
      );
      expect(path.split(".")).toEqual([
        outer.stableId,
        inner.stableId,
        layer.stableId,
      ]);
    });
  });

  test("16. publishing only a new folder leaves moved layers where they are published", async () => {
    await asAdmin( async (conn, projectId) => {
      const layer = await addLayer(conn, projectId, "Coral");
      await publishAll(conn, projectId);
      const folder = await addFolder(conn, projectId, "Habitats");
      await move(conn, layer.itemId, folder.stableId, 0);
      await publishSome(conn, projectId, [folder.stableId]);
      const parent = await conn.oneFirst(sql`
        select parent_stable_id from table_of_contents_items
        where project_id = ${projectId} and not is_draft and stable_id = ${layer.stableId}
      `);
      expect(parent).toBeNull();
      expect(
        (await pending(conn, projectId)).map((row) => row.stable_id)
      ).toEqual([layer.stableId]);
    });
  });

  test("17. deleting a folder after moving a layer out requires publishing that layer", async () => {
    await asAdmin( async (conn, projectId) => {
      const folder = await addFolder(conn, projectId, "Old");
      const layer = await addLayer(conn, projectId, "Coral", folder.stableId);
      const other = await addFolder(conn, projectId, "New");
      await publishAll(conn, projectId);
      await move(conn, layer.itemId, other.stableId, 0);
      await conn.any(sql`select delete_table_of_contents_branch(${folder.id})`);
      const folderRow = (await pending(conn, projectId)).find(
        (row) => row.stable_id === folder.stableId
      );
      expect(folderRow.kind).toBe("removed");
      expect(folderRow.requires_stable_ids).toEqual([layer.stableId]);
      await publishSome(conn, projectId, [folder.stableId]);
      expect(await publishedTitles(conn, projectId)).toEqual(["Coral", "New"]);
      const parent = await conn.oneFirst(sql`
        select parent_stable_id from table_of_contents_items
        where project_id = ${projectId} and not is_draft and stable_id = ${layer.stableId}
      `);
      expect(parent).toBe(other.stableId);
    });
  });

  test("18. moving between two new folders requires only the destination", async () => {
    await asAdmin( async (conn, projectId) => {
      const layer = await addLayer(conn, projectId, "Coral");
      await publishAll(conn, projectId);
      const a = await addFolder(conn, projectId, "A");
      const b = await addFolder(conn, projectId, "B");
      await move(conn, layer.itemId, a.stableId, 0);
      await move(conn, layer.itemId, b.stableId, 0);
      const layerRow = (await pending(conn, projectId)).find(
        (row) => row.stable_id === layer.stableId
      );
      expect(layerRow.requires_stable_ids).toEqual([b.stableId]);
    });
  });

  test("19. moving a folder rewrites descendant paths without listing descendants", async () => {
    await asAdmin( async (conn, projectId) => {
      const outer = await addFolder(conn, projectId, "Outer");
      const inner = await addFolder(conn, projectId, "Inner", outer.stableId);
      const layer = await addLayer(conn, projectId, "Coral", inner.stableId);
      const dest = await addFolder(conn, projectId, "Dest");
      await publishAll(conn, projectId);
      await move(conn, outer.id, dest.stableId, 0);
      const rows = await pending(conn, projectId);
      expect(rows.map((row) => row.stable_id)).toEqual([outer.stableId]);
      await publishSome(conn, projectId, [outer.stableId]);
      const layerPath = String(
        await conn.oneFirst(sql`
          select path::text from table_of_contents_items
          where project_id = ${projectId} and not is_draft and stable_id = ${layer.stableId}
        `)
      );
      expect(layerPath.split(".")).toEqual([
        dest.stableId,
        outer.stableId,
        inner.stableId,
        layer.stableId,
      ]);
      const layerTitle = await conn.oneFirst(sql`
        select title from table_of_contents_items
        where project_id = ${projectId} and not is_draft and stable_id = ${layer.stableId}
      `);
      expect(layerTitle).toBe("Coral");
    });
  });

  test("20. a moved folder and an edited child are independent", async () => {
    await asAdmin( async (conn, projectId) => {
      const folder = await addFolder(conn, projectId, "Habitats");
      const layer = await addLayer(conn, projectId, "Coral", folder.stableId);
      const dest = await addFolder(conn, projectId, "Dest");
      await publishAll(conn, projectId);
      await move(conn, folder.id, dest.stableId, 0);
      await conn.any(sql`
        update table_of_contents_items set title = 'Coral cover' where id = ${layer.itemId}
      `);
      await publishSome(conn, projectId, [layer.stableId]);
      const folderParent = await conn.oneFirst(sql`
        select parent_stable_id from table_of_contents_items
        where project_id = ${projectId} and not is_draft and stable_id = ${folder.stableId}
      `);
      expect(folderParent).toBeNull();
      const title = await conn.oneFirst(sql`
        select title from table_of_contents_items
        where project_id = ${projectId} and not is_draft and stable_id = ${layer.stableId}
      `);
      expect(title).toBe("Coral cover");
      expect(
        (await pending(conn, projectId)).map((row) => row.stable_id)
      ).toEqual([folder.stableId]);
    });
  });

  test("21. deleting a folder bundles every deleted descendant", async () => {
    await asAdmin( async (conn, projectId) => {
      const folder = await addFolder(conn, projectId, "Habitats");
      const inner = await addFolder(conn, projectId, "Inner", folder.stableId);
      await addLayer(conn, projectId, "Coral", inner.stableId);
      await publishAll(conn, projectId);
      await conn.any(sql`select delete_table_of_contents_branch(${folder.id})`);
      const rows = await pending(conn, projectId);
      expect(rows).toHaveLength(3);
      const leader = rows.find((row) => row.stable_id === folder.stableId);
      expect(leader.included_in_bundle).toBe(false);
      expect(rows.filter((row) => row.included_in_bundle)).toHaveLength(2);
      expect(new Set(rows.map((row) => row.bundle_id))).toEqual(
        new Set([folder.stableId])
      );
      await publishSome(conn, projectId, [folder.stableId]);
      expect(await publishedTitles(conn, projectId)).toEqual([]);
    });
  });

  test("22. a folder delete bundles removed children and requires moved ones", async () => {
    await asAdmin( async (conn, projectId) => {
      const folder = await addFolder(conn, projectId, "Habitats");
      const stayed = await addLayer(conn, projectId, "Stay", folder.stableId);
      const left = await addLayer(conn, projectId, "Leave", folder.stableId);
      const dest = await addFolder(conn, projectId, "Dest");
      await publishAll(conn, projectId);
      await move(conn, left.itemId, dest.stableId, 0);
      await conn.any(sql`select delete_table_of_contents_branch(${stayed.itemId})`);
      await conn.any(sql`select delete_table_of_contents_branch(${folder.id})`);
      const folderRow = (await pending(conn, projectId)).find(
        (row) => row.stable_id === folder.stableId
      );
      expect(folderRow.requires_stable_ids).toEqual([left.stableId]);
      const stayedRow = (await pending(conn, projectId)).find(
        (row) => row.stable_id === stayed.stableId
      );
      expect(stayedRow.included_in_bundle).toBe(true);
      expect(stayedRow.bundle_id).toBe(folder.stableId);
    });
  });

  test("23. renaming a folder is one updated unit", async () => {
    await asAdmin( async (conn, projectId) => {
      const folder = await addFolder(conn, projectId, "Habitats");
      await addLayer(conn, projectId, "Coral", folder.stableId);
      await publishAll(conn, projectId);
      await conn.any(sql`
        update table_of_contents_items set title = 'Habitat types' where id = ${folder.id}
      `);
      const rows = await pending(conn, projectId);
      expect(rows).toHaveLength(1);
      expect(rows[0].requires_stable_ids).toEqual([]);
      await publishSome(conn, projectId, [folder.stableId]);
      expect(await publishedTitles(conn, projectId)).toContain("Habitat types");
    });
  });

  test("24. a folder access change publishes without its children", async () => {
    await asAdmin( async (conn, projectId) => {
      const folder = await addFolder(conn, projectId, "Habitats");
      const layer = await addLayer(conn, projectId, "Coral", folder.stableId);
      await publishAll(conn, projectId);
      await conn.any(sql`
        update access_control_lists
        set type = 'admins_only'
        where table_of_contents_item_id = ${folder.id}
      `);
      expect((await pending(conn, projectId)).map((row) => row.stable_id)).toEqual([
        folder.stableId,
      ]);
      await publishSome(conn, projectId, [folder.stableId]);
      const type = await conn.oneFirst(sql`
        select acl.type
        from access_control_lists acl
        join table_of_contents_items t on t.id = acl.table_of_contents_item_id
        where t.project_id = ${projectId} and not t.is_draft and t.stable_id = ${folder.stableId}
      `);
      expect(type).toBe("admins_only");
      const childPublishedAt = await conn.oneFirst(sql`
        select published_at from table_of_contents_items
        where project_id = ${projectId} and not is_draft and stable_id = ${layer.stableId}
      `);
      const folderPublishedAt = await conn.oneFirst(sql`
        select published_at from table_of_contents_items
        where project_id = ${projectId} and not is_draft and stable_id = ${folder.stableId}
      `);
      expect(new Date(childPublishedAt).getTime()).toBeLessThan(
        new Date(folderPublishedAt).getTime()
      );
    });
  });

  test("25. folder behaviour changes are one unit and do not require children", async () => {
    await asAdmin( async (conn, projectId) => {
      const folder = await addFolder(conn, projectId, "Habitats");
      await addLayer(conn, projectId, "Coral", folder.stableId);
      await publishAll(conn, projectId);
      await conn.any(sql`
        update table_of_contents_items
        set show_radio_children = true
        where id = ${folder.id}
      `);
      const rows = await pending(conn, projectId);
      expect(rows).toHaveLength(1);
      await publishSome(conn, projectId, [folder.stableId]);
      const flag = await conn.oneFirst(sql`
        select show_radio_children from table_of_contents_items
        where project_id = ${projectId} and not is_draft and stable_id = ${folder.stableId}
      `);
      expect(flag).toBe(true);
    });
  });

  test("26. an empty folder can be published alone", async () => {
    await asAdmin( async (conn, projectId) => {
      await publishAll(conn, projectId);
      const folder = await addFolder(conn, projectId, "Empty");
      await publishSome(conn, projectId, [folder.stableId]);
      expect(await publishedTitles(conn, projectId)).toEqual(["Empty"]);
      expect(await hasChanges(conn, projectId)).toBe(false);
    });
  });

  test("27. checking only a new child pulls in its new folder on the server", async () => {
    await asAdmin( async (conn, projectId) => {
      const folder = await addFolder(conn, projectId, "Habitats");
      const layer = await addLayer(conn, projectId, "Coral", folder.stableId);
      await publishSome(conn, projectId, [layer.stableId]);
      expect(await publishedTitles(conn, projectId)).toEqual(["Coral", "Habitats"]);
    });
  });

  test("28. a sibling reorder alone is not a checkbox and full publish ships it", async () => {
    await asAdmin( async (conn, projectId) => {
      const a = await addLayer(conn, projectId, "A");
      const b = await addLayer(conn, projectId, "B");
      await publishAll(conn, projectId);
      await move(conn, b.itemId, null, 0);
      await move(conn, a.itemId, null, 1);
      expect(await pending(conn, projectId)).toHaveLength(0);
      expect(await hasChanges(conn, projectId)).toBe(true);
      await publishAll(conn, projectId);
      expect(await siblingOrder(conn, projectId, null, false)).toEqual([
        b.stableId,
        a.stableId,
      ]);
    });
  });

  test("29. a new layer is appended and existing sibling order is unchanged", async () => {
    await asAdmin( async (conn, projectId) => {
      const a = await addLayer(conn, projectId, "A");
      const b = await addLayer(conn, projectId, "B");
      const c = await addLayer(conn, projectId, "C");
      await publishAll(conn, projectId);
      const before = await siblingOrder(conn, projectId, null, false);
      const d = await addLayer(conn, projectId, "D");
      await move(conn, a.itemId, null, 0);
      await move(conn, d.itemId, null, 1);
      await move(conn, c.itemId, null, 2);
      await move(conn, b.itemId, null, 3);
      await publishSome(conn, projectId, [d.stableId]);
      expect(await siblingOrder(conn, projectId, null, false)).toEqual([
        ...before,
        d.stableId,
      ]);
    });
  });

  test("30. editing a layer does not publish its new position in the folder", async () => {
    await asAdmin( async (conn, projectId) => {
      const a = await addLayer(conn, projectId, "A");
      const b = await addLayer(conn, projectId, "B");
      const c = await addLayer(conn, projectId, "C");
      await publishAll(conn, projectId);
      const before = await siblingOrder(conn, projectId, null, false);
      await move(conn, a.itemId, null, 0);
      await move(conn, c.itemId, null, 1);
      await move(conn, b.itemId, null, 2);
      await conn.any(sql`
        update table_of_contents_items set title = 'C2' where id = ${c.itemId}
      `);
      await publishSome(conn, projectId, [c.stableId]);
      expect(await siblingOrder(conn, projectId, null, false)).toEqual(before);
      const title = await conn.oneFirst(sql`
        select title from table_of_contents_items
        where project_id = ${projectId} and not is_draft and stable_id = ${c.stableId}
      `);
      expect(title).toBe("C2");
      expect(await hasChanges(conn, projectId)).toBe(true);
    });
  });

  test("31. stacking order is left for a full publish", async () => {
    await asAdmin( async (conn, projectId) => {
      const a = await addLayer(conn, projectId, "A");
      const b = await addLayer(conn, projectId, "B");
      const c = await addLayer(conn, projectId, "C");
      await publishAll(conn, projectId);
      const publishedBefore = await zOrder(conn, projectId, false);
      await conn.any(sql`
        update table_of_contents_items set title = 'A2' where id = ${a.itemId}
      `);
      await conn.any(sql`
        select update_z_indexes(${sql.array([c.layerId, b.layerId, a.layerId], "int4")})
      `);
      await publishSome(conn, projectId, [a.stableId]);
      expect(await zOrder(conn, projectId, false)).toEqual(publishedBefore);
      expect(
        await conn.oneFirst(sql`
          select projects_layer_stack_order_pending(p)
          from projects p where p.id = ${projectId}
        `)
      ).toBe(true);
      expect(await hasChanges(conn, projectId)).toBe(true);
      await publishAll(conn, projectId);
      expect(await zOrder(conn, projectId, false)).toEqual([
        c.stableId,
        b.stableId,
        a.stableId,
      ]);
      expect(await hasChanges(conn, projectId)).toBe(false);
    });
  });

  test("32. a new layer is stacked at the end and other layers keep their order", async () => {
    await asAdmin( async (conn, projectId) => {
      const a = await addLayer(conn, projectId, "A");
      const b = await addLayer(conn, projectId, "B");
      const c = await addLayer(conn, projectId, "C");
      await conn.any(sql`
        select update_z_indexes(${sql.array([a.layerId, b.layerId, c.layerId], "int4")})
      `);
      await publishAll(conn, projectId);
      const publishedBefore = await zOrder(conn, projectId, false);
      await conn.any(sql`
        select update_z_indexes(${sql.array([c.layerId, b.layerId, a.layerId], "int4")})
      `);
      const d = await addLayer(conn, projectId, "D");
      await conn.any(sql`
        select update_z_indexes(${sql.array(
          [c.layerId, b.layerId, a.layerId, d.layerId],
          "int4"
        )})
      `);
      await publishSome(conn, projectId, [d.stableId]);
      const order = await zOrder(conn, projectId, false);
      expect(order.slice(0, publishedBefore.length)).toEqual(publishedBefore);
      expect(order[order.length - 1]).toBe(d.stableId);
      expect(
        await conn.oneFirst(sql`
          select projects_layer_stack_order_pending(p)
          from projects p where p.id = ${projectId}
        `)
      ).toBe(true);
    });
  });

  test("33. an empty partial publish does not ship stacking order or a new layer", async () => {
    await asAdmin( async (conn, projectId) => {
      const a = await addLayer(conn, projectId, "A");
      const b = await addLayer(conn, projectId, "B");
      await publishAll(conn, projectId);
      const publishedBefore = await zOrder(conn, projectId, false);
      await conn.any(sql`
        select update_z_indexes(${sql.array([b.layerId, a.layerId], "int4")})
      `);
      const d = await addLayer(conn, projectId, "D");
      await publishSome(conn, projectId, []);
      expect(await publishedTitles(conn, projectId)).toEqual(["A", "B"]);
      expect(await zOrder(conn, projectId, false)).toEqual(publishedBefore);
      expect(
        (await pending(conn, projectId)).map((row) => row.stable_id)
      ).toEqual([d.stableId]);
      expect(await hasChanges(conn, projectId)).toBe(true);
    });
  });

  test("34. one editor can publish their layer and leave another editor's layer pending", async () => {
    await asAdmin( async (conn, projectId, adminId, [, userB]) => {
      const x = await addLayer(conn, projectId, "X");
      const y = await addLayer(conn, projectId, "Y");
      await publishAll(conn, projectId);
      await conn.any(sql`set role postgres`);
      await addParticipant(conn, userB, projectId, true, true, true);
      await createSession(conn, userB, true, false, projectId);
      await createSession(conn, userB, true, false, projectId);
      await conn.any(sql`
        update table_of_contents_items set title = 'Y2' where id = ${y.itemId}
      `);
      await createSession(conn, adminId, true, false, projectId);
      await conn.any(sql`
        update table_of_contents_items set title = 'X2' where id = ${x.itemId}
      `);
      await publishSome(conn, projectId, [x.stableId]);
      const rows = await pending(conn, projectId);
      expect(rows.map((row) => row.stable_id)).toEqual([y.stableId]);
      const publishedX = await conn.oneFirst(sql`
        select title from table_of_contents_items
        where project_id = ${projectId} and not is_draft and stable_id = ${x.stableId}
      `);
      expect(publishedX).toBe("X2");
    });
  });

  test("35. publish ships the draft state at execution time", async () => {
    await asAdmin( async (conn, projectId) => {
      const layer = await addLayer(conn, projectId, "Coral");
      await publishAll(conn, projectId);
      await conn.any(sql`
        update table_of_contents_items set title = 'First' where id = ${layer.itemId}
      `);
      await conn.any(sql`
        update table_of_contents_items set title = 'Latest' where id = ${layer.itemId}
      `);
      await publishSome(conn, projectId, [layer.stableId]);
      const title = await conn.oneFirst(sql`
        select title from table_of_contents_items
        where project_id = ${projectId} and not is_draft and stable_id = ${layer.stableId}
      `);
      expect(title).toBe("Latest");
    });
  });

  test("36. a publish holds the project advisory lock until the transaction ends", async () => {
    await asAdmin( async (conn, projectId) => {
      const layer = await addLayer(conn, projectId, "Coral");
      await publishSome(conn, projectId, [layer.stableId]);
      const held = Number(
        await conn.oneFirst(sql`
          select count(*)::int
          from pg_locks
          where locktype = 'advisory'
            and objid = hashtext('publish_toc:' || ${projectId}::text)
            and granted
        `)
      );
      expect(held).toBeGreaterThan(0);
    });
  });

  test("37. publishing the same selection again changes nothing", async () => {
    await asAdmin( async (conn, projectId) => {
      const layer = await addLayer(conn, projectId, "Coral");
      await publishAll(conn, projectId);
      await conn.any(sql`
        update table_of_contents_items set title = 'Coral cover' where id = ${layer.itemId}
      `);
      await publishSome(conn, projectId, [layer.stableId]);
      const before = await conn.one(sql`
        select published_at, table_of_contents_last_published as last
        from table_of_contents_items t
        join projects p on p.id = t.project_id
        where t.project_id = ${projectId} and not t.is_draft
      `);
      const logsBefore = Number(
        await conn.oneFirst(sql`
          select count(*)::int from change_logs
          where project_id = ${projectId} and field_group = 'layers:published'
        `)
      );
      await publishSome(conn, projectId, [layer.stableId]);
      const after = await conn.one(sql`
        select published_at, table_of_contents_last_published as last
        from table_of_contents_items t
        join projects p on p.id = t.project_id
        where t.project_id = ${projectId} and not t.is_draft
      `);
      expect(after.published_at).toEqual(before.published_at);
      expect(after.last).toEqual(before.last);
      const logsAfter = Number(
        await conn.oneFirst(sql`
          select count(*)::int from change_logs
          where project_id = ${projectId} and field_group = 'layers:published'
        `)
      );
      expect(logsAfter).toBe(logsBefore);
    });
  });

  test("39. a partial publish records the existing layers:published summary", async () => {
    await asAdmin( async (conn, projectId) => {
      const layer = await addLayer(conn, projectId, "Coral");
      const other = await addLayer(conn, projectId, "Other");
      await publishAll(conn, projectId);
      await conn.any(sql`
        update table_of_contents_items set title = 'Coral cover' where id = ${layer.itemId}
      `);
      await publishSome(conn, projectId, [layer.stableId]);
      const log = await conn.one(sql`
        select to_summary
        from change_logs
        where project_id = ${projectId} and field_group = 'layers:published'
        order by id desc
        limit 1
      `);
      expect(log.to_summary).toEqual({ layer_count: 2 });
      expect(other.stableId).toBeTruthy();
      const groups = await conn.any(sql`
        select distinct field_group::text as field_group
        from change_logs where project_id = ${projectId}
      `);
      expect(groups.map((row) => row.field_group)).not.toContain(
        "folder:children-reordered"
      );
    });
  });

  test("40. full publish still replaces the tree, including reorders", async () => {
    await asAdmin( async (conn, projectId) => {
      const a = await addLayer(conn, projectId, "A");
      const b = await addLayer(conn, projectId, "B");
      await publishAll(conn, projectId);
      await move(conn, b.itemId, null, 0);
      await move(conn, a.itemId, null, 1);
      await conn.any(sql`
        update table_of_contents_items set bounds = '{9,9,9,9}'::numeric[] where id = ${a.itemId}
      `);
      await publishAll(conn, projectId);
      expect(await siblingOrder(conn, projectId, null, false)).toEqual([
        b.stableId,
        a.stableId,
      ]);
      const bounds = await conn.oneFirst(sql`
        select bounds from table_of_contents_items
        where project_id = ${projectId} and not is_draft and stable_id = ${a.stableId}
      `);
      expect(bounds).toEqual([9, 9, 9, 9]);
      expect(await hasChanges(conn, projectId)).toBe(false);
    });
  });

  test("a non-admin cannot partial-publish", async () => {
    await asAdmin( async (conn, projectId, adminId, [userA]) => {
      const layer = await addLayer(conn, projectId, "Coral");
      await createSession(conn, userA, true, false, projectId);
      await expect(
        publishSome(conn, projectId, [layer.stableId])
      ).rejects.toThrow(/Permission denied/);
    });
  });

  test("partial publish leaves an unselected edit in the full-publish changelog", async () => {
    await asAdmin( async (conn, projectId, adminId) => {
      const a = await addLayer(conn, projectId, "A");
      const b = await addLayer(conn, projectId, "B");
      await publishAll(conn, projectId);
      const lastFull = await conn.oneFirst(sql`
        select table_of_contents_last_published from projects where id = ${projectId}
      `);
      await conn.any(sql`
        update table_of_contents_items set title = 'A2' where id = ${a.itemId}
      `);
      await conn.any(sql`
        update table_of_contents_items set title = 'B2' where id = ${b.itemId}
      `);
      await conn.any(sql`
        select create_resolvable_layer_comment(
          ${projectId}, ${a.itemId}, '{"text":"on A"}'::jsonb, null, false
        )
      `);
      await conn.any(sql`
        select create_resolvable_layer_comment(
          ${projectId}, ${b.itemId}, '{"text":"on B"}'::jsonb, null, false
        )
      `);
      await conn.any(sql`set role postgres`);
      await conn.any(sql`
        update resolvable_layer_comments
        set created_at = clock_timestamp()
        where project_id = ${projectId}
      `);
      await createSession(conn, adminId, true, false, projectId);
      await publishSome(conn, projectId, [a.stableId]);
      const lastAfter = await conn.oneFirst(sql`
        select table_of_contents_last_published from projects where id = ${projectId}
      `);
      expect(lastAfter).toEqual(lastFull);
      const rows = await pending(conn, projectId);
      expect(rows.map((row) => row.stable_id)).toEqual([b.stableId]);
      const logs = await conn.any(sql`
        select cl.entity_id
        from projects p
        cross join lateral projects_change_logs_since_last_publish(p) cl
        where p.id = ${projectId}
          and cl.field_group = 'layer:title'
      `);
      expect(logs.map((row) => Number(row.entity_id))).toEqual([b.itemId]);
      const comments = await conn.any(sql`
        select c.table_of_contents_item_id
        from projects p
        cross join lateral projects_comments_since_last_publish(p) c
        where p.id = ${projectId}
      `);
      expect(comments.map((row) => Number(row.table_of_contents_item_id))).toEqual([
        b.itemId,
      ]);
      expect(await hasChanges(conn, projectId)).toBe(true);
      expect(adminId).toBeGreaterThan(0);
    });
  });

  test("stamping published_at does not turn the unpublished-changes flag on", async () => {
    await asAdmin( async (conn, projectId, adminId) => {
      const layer = await addLayer(conn, projectId, "Coral");
      await publishAll(conn, projectId);
      expect(await hasChanges(conn, projectId)).toBe(false);
      const sourceType = await conn.oneFirst(sql`
        select data_source_type from table_of_contents_items
        where project_id = ${projectId} and not is_draft and stable_id = ${layer.stableId}
      `);
      expect(sourceType).toBe("geojson");
      await conn.any(sql`set role postgres`);
      await conn.any(sql`select set_config('seasketch.publishing', 'true', true)`);
      await conn.any(sql`
        update table_of_contents_items
        set published_at = clock_timestamp()
        where project_id = ${projectId} and not is_draft
      `);
      await conn.any(sql`select set_config('seasketch.publishing', 'false', true)`);
      await createSession(conn, adminId, true, false, projectId);
      expect(await hasChanges(conn, projectId)).toBe(false);
    });
  });
});
