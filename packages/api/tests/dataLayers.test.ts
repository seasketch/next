import { sql } from "slonik";
import { createPool } from "./pool";
import {
  createUser,
  createProject,
  addParticipant,
  createSession,
  clearSession,
  createGroup,
  addGroupToAcl,
  projectTransaction,
  verifyOnlyAuthorsCanEditRecords,
  verifyOnlyAuthorsCanAccessRecords,
  verifyOnlyProjectGroupMembersCanAccessResource,
  limitToGroup,
  verifyCRUDOpsLimitedToAdmins,
} from "./helpers";
import nanoid from "nanoid";
const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
const id = nanoid.customAlphabet(alphabet, 9);

const pool = createPool("test");

describe("Data validation", () => {
  test("sublayer prop only valid for arcgis-dynamic-mapserver sources", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const validSourceId = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'arcgis-dynamic-mapserver', 'https://example.com/arcgis/rest/services/bullshit/MapServer') returning id`
        );
        const invalidSourceId = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'geojson', 'https://example.com/data.json') returning id`
        );
        const layerId = await conn.oneFirst(
          sql`insert into data_layers (project_id, data_source_id, sublayer) values (${projectId}, ${validSourceId}, '3') returning id`
        );
        expect(layerId).toBeGreaterThan(0);
        expect(
          conn.any(
            sql`insert into data_layers (project_id, data_source_id, sublayer) values (${projectId}, ${invalidSourceId}, '3') returning id`
          )
        ).rejects.toThrow(/sublayer/);
      }
    );
  });
  test("source_layer only required for vector sources", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const validSourceId = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'vector', 'https://example.com/arcgis/rest/services/bullshit/MapServer') returning id`
        );
        const invalidSourceId = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'geojson', 'https://example.com/data.json') returning id`
        );
        const layerId = await conn.oneFirst(
          sql`insert into data_layers (project_id, data_source_id, source_layer, mapbox_gl_styles) values (${projectId}, ${validSourceId}, 'threeve', ${sql.json(
            { foo: "bar" }
          )}) returning id`
        );
        expect(layerId).toBeGreaterThan(0);
        expect(
          conn.any(
            sql`insert into data_layers (project_id, data_source_id, source_layer, mapbox_gl_styles) values (${projectId}, ${invalidSourceId}, 'threeve', ${sql.json(
              { foo: "bar" }
            )}) returning id`
          )
        ).rejects.toThrow(/source_layer/);
      }
    );
  });
  test("mapbox_gl_styles required only for vector, seasketch-vector, or geojson sources", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const validSourceId = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'vector', 'https://example.com/arcgis/rest/services/bullshit/MapServer') returning id`
        );
        const validSourceId2 = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url, import_type, byte_length) values (${projectId}, 'seasketch-vector', 'https://example.com/arcgis/rest/services/bullshit/MapServer', 'upload', 0) returning id`
        );
        const validSourceId3 = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'geojson', 'https://example.com/arcgis/rest/services/bullshit/MapServer') returning id`
        );
        const invalidSourceId = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'arcgis-dynamic-mapserver', 'https://example.com/data.json') returning id`
        );
        expect(
          conn.oneFirst(
            sql`insert into data_layers (project_id, data_source_id, source_layer, mapbox_gl_styles) values (${projectId}, ${validSourceId}, 'threeve', ${sql.json(
              { foo: "bar" }
            )}) returning id`
          )
        ).resolves.toBeGreaterThan(0);
        expect(
          conn.oneFirst(
            sql`insert into data_layers (project_id, data_source_id, mapbox_gl_styles) values (${projectId}, ${validSourceId2}, ${sql.json(
              { foo: "bar" }
            )}) returning id`
          )
        ).resolves.toBeGreaterThan(0);
        expect(
          conn.oneFirst(
            sql`insert into data_layers (project_id, data_source_id, mapbox_gl_styles) values (${projectId}, ${validSourceId3}, ${sql.json(
              { foo: "bar" }
            )}) returning id`
          )
        ).resolves.toBeGreaterThan(0);
        expect(
          conn.any(
            sql`insert into data_layers (project_id, data_source_id, mapbox_gl_styles) values (${projectId}, ${invalidSourceId}, ${sql.json(
              { foo: "bar" }
            )}) returning id`
          )
        ).rejects.toThrow(/mapbox_gl_styles/);
      }
    );
  });
});

describe("Access control", () => {
  test("Data layers accessible and editable for all admins", async () => {
    let validSourceId: number;
    await verifyCRUDOpsLimitedToAdmins(pool, {
      setup: async (conn, projectId, adminId) => {
        validSourceId = await conn.oneFirst<number>(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'vector', 'https://example.com/arcgis/rest/services/bullshit/MapServer') returning id`
        );
      },
      create: async (conn, projectId, adminId) => {
        return sql`insert into data_layers (project_id, data_source_id, source_layer, mapbox_gl_styles) values (${projectId}, ${validSourceId}, 'threeve', ${sql.json(
          { foo: "bar" }
        )}) returning id`;
      },
      update: (id) => {
        return sql`update data_layers set render_under = 'land' where id = ${id} returning *`;
      },
      delete: (id) => {
        return sql`delete from data_layers where id = ${id}`;
      },
    });
  });
  test("Data layers cannot be edited if they are associated with a non-draft table of contents item", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const validSourceId = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'arcgis-dynamic-mapserver', 'https://example.com/arcgis/rest/services/bullshit/MapServer') returning id`
        );
        const layerId = await conn.oneFirst(
          sql`insert into data_layers (project_id, data_source_id, sublayer) values (${projectId}, ${validSourceId}, '3') returning id`
        );
        const itemId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, data_layer_id, stable_id) values (${projectId}, 'item1', false, ${layerId}, ${"abc123"}) returning id`
        );
        const updated = await conn.oneFirst(
          sql`update data_layers set sublayer = 2 where id = ${layerId} returning id`
        );
        expect(updated).toBe(layerId);
        await conn.any(sql`select publish_table_of_contents(${projectId})`);
        const publishedLayerId = await conn.oneFirst(
          sql`select data_layer_id from table_of_contents_items where is_draft = false and stable_id = 'abc123'`
        );
        expect(publishedLayerId).toBeTruthy();
        expect(
          conn.oneFirst(
            sql`update data_layers set sublayer = '200' where id = ${publishedLayerId} returning sublayer`
          )
        ).rejects.toThrow(/not found/);
      }
    );
  });
  test("Data layers accessible to other users only if user has access to related table of contents items", async () => {
    await verifyOnlyProjectGroupMembersCanAccessResource(
      pool,
      "data_layers",
      async (conn, projectId, groupId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const folderAStableId = id();
        const folderBStableId = id();
        const protectedId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderA', true, ${folderAStableId}) returning id`
        );
        const protectedSubfolderId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id, parent_stable_id) values (${projectId}, 'subfolder', true, ${folderBStableId}, ${folderAStableId}) returning id`
        );
        const unprotectedFolderStableId = id();
        const unprotectedFolderId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'unprotected', true, ${unprotectedFolderStableId}) returning id`
        );
        const validSourceId = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'arcgis-dynamic-mapserver', 'https://example.com/arcgis/rest/services/bullshit/MapServer') returning id`
        );
        const layerId = await conn.oneFirst(
          sql`insert into data_layers (project_id, data_source_id, sublayer) values (${projectId}, ${validSourceId}, '3') returning id`
        );
        const itemId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, data_layer_id, stable_id, parent_stable_id) values (${projectId}, 'protected layer', false, ${layerId}, ${"abc123"}, ${folderBStableId}) returning id`
        );

        await limitToGroup(
          conn,
          "table_of_contents_item_id",
          protectedId,
          groupId
        );
        await conn.any(sql`select publish_table_of_contents(${projectId})`);
        let publishedItem = await conn.one(
          sql`select * from table_of_contents_items where is_draft = false and stable_id = ${folderBStableId}`
        );
        let unprotectedItem = await conn.one(
          sql`select id, title, stable_id, is_folder, is_draft from table_of_contents_items where is_draft = false and stable_id = ${unprotectedFolderStableId}`
        );
        let publishedLayerTocItem = await await conn.one(
          sql`select path, title, is_draft, stable_id, parent_stable_id, id, data_layer_id from table_of_contents_items where is_draft = false and stable_id = ${"abc123"}`
        );
        await clearSession(conn);
        await createSession(conn);
        // return unprotectedItem.id as number;
        // return publishedItemId as number;
        return publishedLayerTocItem.data_layer_id as number;
      }
    );
  });
});
