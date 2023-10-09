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
import {
  raw,
  // @ts-ignore
} from "slonik-sql-tag-raw";

const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
const id = nanoid.customAlphabet(alphabet, 9);

const pool = createPool("test");

describe("Data validation", () => {
  test("data_layer_id must be set if is_folder is false", async () => {
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
          sql`insert into table_of_contents_items(project_id, title, is_folder, data_layer_id, stable_id) values (${projectId}, 'item1', false, ${layerId}, ${id()}) returning id`
        );
        expect(itemId).toBeGreaterThan(0);
        expect(
          conn.oneFirst(
            sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'item1', false, ${id()}) returning id`
          )
        ).rejects.toThrow(/data_layer_id/);
      }
    );
  });
  test("provided path must be unique among draft items", async () => {
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
        const stableId = id();
        const itemId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, data_layer_id, stable_id) values (${projectId}, 'item1', false, ${layerId}, ${stableId}) returning id`
        );
        expect(itemId).toBeGreaterThan(0);
        expect(
          conn.oneFirst(
            sql`insert into table_of_contents_items(project_id, title, is_folder, data_layer_id, stable_id) values (${projectId}, 'item1', false, ${layerId}, ${stableId}) returning id`
          )
        ).rejects.toThrow(/stable_id/);
      }
    );
  });

  test("items can be rearranged in folders using updateTableOfContentsItemParent", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const folderA = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderA', true, ${id()}) returning stable_id`
        );
        const folderB = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderB', true, ${id()}) returning stable_id`
        );
        const folderC = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, parent_stable_id, stable_id) values (${projectId}, 'folderC', true, ${folderB}, ${id()}) returning stable_id`
        );
        //    A   B
        //         \
        //          C
        //
        const validSourceId = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'arcgis-dynamic-mapserver', 'https://example.com/arcgis/rest/services/bullshit/MapServer') returning id`
        );
        const layerId = await conn.oneFirst(
          sql`insert into data_layers (project_id, data_source_id, sublayer) values (${projectId}, ${validSourceId}, '3') returning id`
        );
        const stableId = id();
        const itemId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, data_layer_id, stable_id) values (${projectId}, 'item1', false, ${layerId}, ${stableId}) returning id`
        );
        expect(itemId).toBeGreaterThan(0);
        //    A   B      item1
        //         \
        //          C
        expect(
          conn.any(
            sql`select update_table_of_contents_item_parent(${itemId}, ${folderA})`
          )
        ).resolves.toBeTruthy();
        //    A   B
        //   /     \
        // item1    C
        expect(
          conn.any(
            sql`select update_table_of_contents_item_parent(${itemId}, ${folderC})`
          )
        ).resolves.toBeTruthy();
        //    A   B
        //         \
        //          C
        //           \
        //          item1
      }
    );
  });
  test("rearranging paths updates children of moved items", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const folderA = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderA', true, ${id()}) returning stable_id`
        );
        const folderB = id();
        const folderBId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderB', true, ${folderB}) returning id`
        );
        const folderC = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, parent_stable_id, stable_id) values (${projectId}, 'folderC', true, ${folderB}, ${id()}) returning stable_id`
        );
        //    A   B
        //         \
        //          C
        //
        const validSourceId = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'arcgis-dynamic-mapserver', 'https://example.com/arcgis/rest/services/bullshit/MapServer') returning id`
        );
        const layerId = await conn.oneFirst(
          sql`insert into data_layers (project_id, data_source_id, sublayer) values (${projectId}, ${validSourceId}, '3') returning id`
        );
        const stableId = id();
        const itemId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, data_layer_id, stable_id) values (${projectId}, 'item1', false, ${layerId}, ${stableId}) returning id`
        );
        expect(itemId).toBeGreaterThan(0);
        //    A   B      item1
        //         \
        //          C
        expect(
          conn.any(
            sql`select update_table_of_contents_item_parent(${itemId}, ${folderA})`
          )
        ).resolves.toBeTruthy();
        //    A   B
        //   /     \
        // item1    C
        expect(
          conn.any(
            sql`select update_table_of_contents_item_parent(${itemId}, ${folderC})`
          )
        ).resolves.toBeTruthy();
        //    A   B
        //         \
        //          C
        //           \
        //          item1
        expect(
          conn.any(
            sql`select update_table_of_contents_item_parent(${folderBId}, ${folderA})`
          )
        ).resolves.toBeTruthy();
        //     A
        //      \
        //       B
        //      /
        //     C
        //      \
        //     item1
        await clearSession(conn);
        expect(
          conn.oneFirst(
            sql`select path from table_of_contents_items where id = ${itemId}`
          )
        ).resolves.toBe(`${folderA}.${folderB}.${folderC}.${stableId}`);
        expect(
          conn.oneFirst(
            sql`select path from table_of_contents_items where stable_id = ${folderC}`
          )
        ).resolves.toBe(`${folderA}.${folderB}.${folderC}`);
      }
    );
  });

  test("Inserting a new item at the tree root sets sortIndex > max(sortIndex) of items at the root", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const folderA = id();
        const folderAId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderA', true, ${folderA}) returning id`
        );
        const folderB = id();
        const folderBId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderB', true, ${folderB}) returning id`
        );
        //    A[0]   B[1]
        expect(
          conn.oneFirst(
            sql`select sort_index from table_of_contents_items where id = ${folderAId}`
          )
        ).resolves.toBe(0);
        expect(
          conn.oneFirst(
            sql`select sort_index from table_of_contents_items where id = ${folderBId}`
          )
        ).resolves.toBe(1);
      }
    );
  });
  test("Inserting a new item under a parent item sets sortIndex > max(sortIndex) of children of that parent", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const folderA = id();
        const folderAId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderA', true, ${folderA}) returning id`
        );
        const folderB = id();
        const folderBId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderB', true, ${folderB}) returning id`
        );
        //    A[0]   B[1]
        expect(
          conn.oneFirst(
            sql`select sort_index from table_of_contents_items where id = ${folderAId}`
          )
        ).resolves.toBe(0);
        expect(
          conn.oneFirst(
            sql`select sort_index from table_of_contents_items where id = ${folderBId}`
          )
        ).resolves.toBe(1);
        const folderC = id();
        const folderCId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, parent_stable_id, stable_id) values (${projectId}, 'folderC', true, ${folderB}, ${folderC}) returning id`
        );
        //    A[0]   B[1]
        //           /
        //         C[0]
        const folderD = id();
        const folderDId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, parent_stable_id, stable_id) values (${projectId}, 'folderC', true, ${folderB}, ${folderD}) returning id`
        );
        //    A[0]   B[1]
        //           / \
        //         C[0] D[1]
        expect(
          conn.oneFirst(
            sql`select sort_index from table_of_contents_items where id = ${folderCId}`
          )
        ).resolves.toBe(0);
        expect(
          conn.oneFirst(
            sql`select sort_index from table_of_contents_items where id = ${folderDId}`
          )
        ).resolves.toBe(1);
      }
    );
  });

  test("updateTableOfContentsItemChildren can be used to set children and sort order of an item", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const folderA = id();
        const folderAId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderA', true, ${folderA}) returning id`
        );
        const folderB = id();
        const folderBId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderB', true, ${folderB}) returning id`
        );
        const folderC = id();
        const folderCId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, parent_stable_id, stable_id) values (${projectId}, 'folderC', true, ${folderB}, ${folderC}) returning id`
        );
        const folderD = id();
        const folderDId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, parent_stable_id, stable_id) values (${projectId}, 'folderD', true, ${folderC}, ${folderD}) returning id`
        );

        //    A   B
        //         \
        //          C
        //           \
        //            D
        expect(
          conn.any(
            sql`select update_table_of_contents_item_children(${folderBId}, ${sql.array(
              [folderAId, folderCId],
              "int4"
            )})`
          )
        ).resolves.toBeTruthy();
        //    B
        //   / \
        //  A   C
        //       \
        //        D
        expect(
          conn.oneFirst(
            sql`select sort_index from table_of_contents_items where stable_id = ${folderA}`
          )
        ).resolves.toBe(0);
        expect(
          conn.oneFirst(
            sql`select sort_index from table_of_contents_items where stable_id = ${folderC}`
          )
        ).resolves.toBe(1);
        expect(
          conn.any(
            sql`select update_table_of_contents_item_children(${folderBId}, ${sql.array(
              [folderCId, folderAId],
              "int4"
            )})`
          )
        ).resolves.toBeTruthy();
        //    B
        //   / \
        //  A   C
        //       \
        //        D
        expect(
          conn.oneFirst(
            sql`select sort_index from table_of_contents_items where stable_id = ${folderA}`
          )
        ).resolves.toBe(1);
        expect(
          conn.oneFirst(
            sql`select sort_index from table_of_contents_items where stable_id = ${folderC}`
          )
        ).resolves.toBe(0);

        let folderBSortIndex = await conn.oneFirst(
          sql`select sort_index from table_of_contents_items where stable_id = ${folderB}`
        );

        await clearSession(conn);
        expect(
          conn.oneFirst(
            sql`select path from table_of_contents_items where id = ${folderAId}`
          )
        ).resolves.toBe(`${folderB}.${folderA}`);

        expect(
          conn.oneFirst(
            sql`select path from table_of_contents_items where id = ${folderDId}`
          )
        ).resolves.toBe(`${folderB}.${folderC}.${folderD}`);

        await createSession(conn, adminId, true, false, projectId);

        expect(
          conn.any(
            sql`select update_table_of_contents_item_children(${folderBId}, ${sql.array(
              [folderAId],
              "int4"
            )})`
          )
        ).resolves.toBeTruthy();
        //    B  C
        //   /    \
        //  A      D

        expect(
          conn.oneFirst(
            sql`select sort_index from table_of_contents_items where stable_id = ${folderA}`
          )
        ).resolves.toBe(0);
        folderBSortIndex = await conn.oneFirst(
          sql`select sort_index from table_of_contents_items where stable_id = ${folderB}`
        );
        let folderCSortIndex = await conn.oneFirst(
          sql`select sort_index from table_of_contents_items where stable_id = ${folderC}`
        );
        expect(folderBSortIndex).toBeLessThan(folderCSortIndex as number);
        expect(
          conn.oneFirst(
            sql`select parent_stable_id from table_of_contents_items where stable_id = ${folderC}`
          )
        ).resolves.toBe(null);
        await clearSession(conn);

        expect(
          conn.oneFirst(
            sql`select path from table_of_contents_items where id = ${folderCId}`
          )
        ).resolves.toBe(`${folderC}`);
        expect(
          conn.oneFirst(
            sql`select path from table_of_contents_items where id = ${folderDId}`
          )
        ).resolves.toBe(`${folderC}.${folderD}`);
      }
    );
  });

  test("updateTableOfContentsItemChildren can be called with parentId = null (for root)", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const folderA = id();
        const folderAId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderA', true, ${folderA}) returning id`
        );
        const folderB = id();
        const folderBId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderB', true, ${folderB}) returning id`
        );
        //    A[0]   B[1]
        expect(
          conn.oneFirst(
            sql`select sort_index from table_of_contents_items where id = ${folderAId}`
          )
        ).resolves.toBe(0);
        expect(
          conn.oneFirst(
            sql`select sort_index from table_of_contents_items where id = ${folderBId}`
          )
        ).resolves.toBe(1);
        await conn.any(
          sql`select update_table_of_contents_item_children(null, ${sql.array(
            [folderBId, folderAId],
            "int4"
          )})`
        );
        // should be
        //    B[0]   A[1]
        const folderASortIndex = await conn.oneFirst(
          sql`select sort_index from table_of_contents_items where id = ${folderAId}`
        );
        const folderBSortIndex = await conn.oneFirst(
          sql`select sort_index from table_of_contents_items where id = ${folderBId}`
        );
        expect(folderBSortIndex).toBeLessThan(folderASortIndex as number);
      }
    );
  });

  test("updateTableOfContentsItemChildren works even after a tree is published (regression test)", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const folderA = id();
        const folderAId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderA', true, ${folderA}) returning id`
        );
        const folderB = id();
        const folderBId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderB', true, ${folderB}) returning id`
        );
        //    A[0]   B[1]
        expect(
          conn.oneFirst(
            sql`select sort_index from table_of_contents_items where id = ${folderAId}`
          )
        ).resolves.toBe(0);
        expect(
          conn.oneFirst(
            sql`select sort_index from table_of_contents_items where id = ${folderBId}`
          )
        ).resolves.toBe(1);
        await conn.any(sql`select publish_table_of_contents(${projectId})`);
        await conn.any(
          sql`select update_table_of_contents_item_children(null, ${sql.array(
            [folderBId, folderAId],
            "int4"
          )})`
        );
        // should be
        //    B[0]   A[1]
        const folderASortIndex = await conn.oneFirst(
          sql`select sort_index from table_of_contents_items where id = ${folderAId}`
        );
        const folderBSortIndex = await conn.oneFirst(
          sql`select sort_index from table_of_contents_items where id = ${folderBId}`
        );
        expect(folderBSortIndex).toBeLessThan(folderASortIndex as number);
      }
    );
  });

  test("items cannot be nested under non-existent paths", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const folderA = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderA', true, ${id()}) returning stable_id`
        );
        const folderB = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderB', true, ${id()}) returning stable_id`
        );
        const folderC = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, parent_stable_id, stable_id) values (${projectId}, 'folderC', true, ${folderB}, ${id()}) returning stable_id`
        );
        //    A   B
        //         \
        //          C
        //
        expect(
          conn.oneFirst(
            sql`insert into table_of_contents_items(project_id, title, is_folder, parent_stable_id, stable_id) values (${projectId}, 'folderC', true, ${"foobar"}, ${id()}) returning stable_id`
          )
        ).rejects.toThrow(/parent/);
      }
    );
  });

  test("folder props can only be set on folders (show_radio_children, is_click_off_only)", async () => {
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
        const folderProps = ["show_radio_children", "is_click_off_only"];
        let i = 0;
        for (const folderProp of folderProps) {
          await conn.any(sql`SAVEPOINT before_thing`);
          const folderId = await conn.oneFirst(
            sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id, ${sql.identifier(
              [folderProp]
            )}) values (${projectId}, 'item1', true, ${id()}, true) returning id`
          );
          expect(folderId).toBeTruthy();
          expect(
            conn.oneFirst(
              sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id, ${sql.identifier(
                [folderProp]
              )}, data_layer_id) values (${projectId}, 'item1', false, ${id()}, true, ${layerId}) returning id`
            )
          ).rejects.toThrow(/folder/);
          await conn.any(sql`ROLLBACK to before_thing`);
        }
      }
    );
  });
  test("layer props can only be set on layers (metadata, bounds, data_layer_id)", async () => {
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
        const layerProps = {
          metadata: sql.json({ foo: "bar" }),
          bounds: sql.array([1, 2, 3, 4], "int4"),
          // data_layer_id:
        };
        let i = 0;
        for (const prop of Object.keys(layerProps)) {
          const val = layerProps[prop as "metadata" | "bounds"];
          await conn.any(sql`SAVEPOINT before_thing`);
          const tocId = await conn.oneFirst(
            sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id, ${sql.identifier(
              [prop]
            )}, data_layer_id) values (${projectId}, 'item1', false, ${id()}, ${val}, ${layerId}) returning id`
          );
          expect(tocId).toBeTruthy();
          await conn.any(sql`ROLLBACK to before_thing`);
        }
        expect(
          conn.oneFirst(
            sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id, data_layer_id) values (${projectId}, 'item1', true, ${id()}, ${layerId}) returning id`
          )
        ).rejects.toThrow(/Folders/);
      }
    );
  });
  test("items can only be edited if is_draft is set to true", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const stableId = id();
        const folderA = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderA', true, ${stableId}) returning id`
        );
        const folder = await conn.one(
          sql`select id, title, show_radio_children from table_of_contents_items where id = ${folderA}`
        );
        await conn.any(sql`select publish_table_of_contents(${projectId})`);
        const publishedFolderAId = await conn.oneFirst(
          sql`select id from table_of_contents_items where stable_id=${stableId} and is_draft=false`
        );
        expect(
          conn.oneFirst(
            sql`update table_of_contents_items set show_radio_children = true where id = ${folderA} returning id`
          )
        ).resolves.toBeTruthy();
        expect(
          conn.any(
            sql`update table_of_contents_items set show_radio_children = true where id = ${publishedFolderAId}`
          )
        ).rejects.toThrow(/published/);
      }
    );
  });
  test("deleting a folder item deletes all it's children (but not published clones)", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const folderA = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderA', true, ${id()}) returning stable_id`
        );
        const folderB = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderB', true, ${id()}) returning stable_id`
        );
        const folderC = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, parent_stable_id, stable_id) values (${projectId}, 'folderC', true, ${folderB}, ${id()}) returning stable_id`
        );
        const validSourceId = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'arcgis-dynamic-mapserver', 'https://example.com/arcgis/rest/services/bullshit/MapServer') returning id`
        );
        const geojsonSourceId = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'geojson', 'https://example.com/layer.json') returning id`
        );
        const layer0Id = await conn.oneFirst(
          sql`insert into data_layers (project_id, data_source_id, sublayer) values (${projectId}, ${validSourceId}, '0') returning id`
        );
        const layer1Id = await conn.oneFirst(
          sql`insert into data_layers (project_id, data_source_id, sublayer) values (${projectId}, ${validSourceId}, '1') returning id`
        );
        const geoJsonLayerId = await conn.oneFirst(
          sql`insert into data_layers (project_id, data_source_id, mapbox_gl_styles) values (${projectId}, ${geojsonSourceId}, '{"foo": "bar"}'::jsonb) returning id`
        );
        const stableId = id();
        const sub0 = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, data_layer_id, stable_id, parent_stable_id) values (${projectId}, 'sublayer 0', false, ${layer0Id}, ${stableId}, ${folderA}) returning id`
        );
        const sub1 = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, data_layer_id, stable_id, parent_stable_id) values (${projectId}, 'sublayer 1', false, ${layer1Id}, ${id()}, ${folderC}) returning id`
        );
        const geojsonItemId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, data_layer_id, stable_id, parent_stable_id) values (${projectId}, 'geojson', false, ${geoJsonLayerId}, ${id()}, ${folderB}) returning id`
        );
        //    A     B
        //   /     / \
        // sub0  json C
        //             \
        //            sub1
        // make sure to test with many multiple layers, folders, etc
        // make sure nesting comes out intact
        await conn.any(sql`select publish_table_of_contents(${projectId})`);
        const allLayers = await conn.many(sql`select * from data_layers`);
        await conn.any(
          sql`select delete_table_of_contents_branch((select table_of_contents_items.id from table_of_contents_items where stable_id = ${folderB} and is_draft = true))`
        );
        const draftItems = await conn.many(
          sql`select title, stable_id, parent_stable_id, data_layer_id from table_of_contents_items where project_id = ${projectId} and is_draft=true`
        );

        // 6 published, two draft
        expect(draftItems.length).toBe(2);
        const publishedItems = await conn.many(
          sql`select title, stable_id, parent_stable_id, data_layer_id from table_of_contents_items where project_id = ${projectId} and is_draft=false`
        );
        // 6 published, two draft
        expect(publishedItems.length).toBe(6);

        const layers = await conn.many(
          sql`select * from data_layers where project_id = ${projectId}`
        );
        // 3 published, 1 draft
        expect(layers.length).toBe(4);
        const sources = await conn.many(
          sql`select * from data_sources where project_id = ${projectId}`
        );
        // 2 published, one left in draft
        expect(sources.length).toBe(3);
      }
    );
  });
});

describe("Special functions", () => {
  test("publishTableOfContents(project_id) deletes the current table of contents, layers, and source and copies all draft items into a public list", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const folderA = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderA', true, ${id()}) returning stable_id`
        );
        const folderB = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderB', true, ${id()}) returning stable_id`
        );
        const folderC = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, parent_stable_id, stable_id) values (${projectId}, 'folderC', true, ${folderB}, ${id()}) returning stable_id`
        );
        const validSourceId = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'arcgis-dynamic-mapserver', 'https://example.com/arcgis/rest/services/bullshit/MapServer') returning id`
        );
        const geojsonSourceId = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url) values (${projectId}, 'geojson', 'https://example.com/layer.json') returning id`
        );
        const layer0Id = await conn.oneFirst(
          sql`insert into data_layers (project_id, data_source_id, sublayer) values (${projectId}, ${validSourceId}, '0') returning id`
        );
        const layer1Id = await conn.oneFirst(
          sql`insert into data_layers (project_id, data_source_id, sublayer) values (${projectId}, ${validSourceId}, '1') returning id`
        );
        const geoJsonLayerId = await conn.oneFirst(
          sql`insert into data_layers (project_id, data_source_id, mapbox_gl_styles) values (${projectId}, ${geojsonSourceId}, '{"foo": "bar"}'::jsonb) returning id`
        );
        const stableId = id();
        const sub0 = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, data_layer_id, stable_id, parent_stable_id) values (${projectId}, 'sublayer 0', false, ${layer0Id}, ${stableId}, ${folderA}) returning id`
        );
        const sub1 = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, data_layer_id, stable_id, parent_stable_id) values (${projectId}, 'sublayer 1', false, ${layer1Id}, ${id()}, ${folderC}) returning id`
        );
        const geojsonItemId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, data_layer_id, stable_id, parent_stable_id) values (${projectId}, 'geojson', false, ${geoJsonLayerId}, ${id()}, ${folderB}) returning id`
        );
        //    A     B
        //   /     / \
        // sub0  json C
        //             \
        //            sub1
        // make sure to test with many multiple layers, folders, etc
        // make sure nesting comes out intact
        await conn.any(sql`select publish_table_of_contents(${projectId})`);
        const items = await conn.many(
          sql`select title, stable_id, parent_stable_id, data_layer_id from table_of_contents_items where project_id = ${projectId} and is_draft = false`
        );
        expect(items.length).toBe(6);
        // sources are duplicated (but not multiple copies for the same sublayer-type sources!!)
        const sources = await conn.many(
          sql`select url from data_sources where project_id = ${projectId}`
        );
        expect(sources.length).toBe(4);
        // layers are duplicated
        const layers = await conn.many(
          sql`select * from data_layers where project_id = ${projectId}`
        );
        expect(layers.length).toBe(6);
        const publishedJsonItem = items.find((i) => i.title === "geojson");
        expect(publishedJsonItem).toBeTruthy();
        // Should have a new clone of the data layer, not the original draft
        expect(publishedJsonItem!.data_layer_id).not.toBe(geoJsonLayerId);
        const dataLayer = await conn.one(
          sql`select * from data_layers where id = ${
            publishedJsonItem!.data_layer_id
          }`
        );
        expect(dataLayer!.data_source_id).not.toBe(geojsonSourceId);
        // create another project and publish
        const projectBId = await createProject(conn, adminId, "public");
        await createSession(conn, adminId, true, false, projectBId);
        const projectBFolderA = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectBId}, 'folderA', true, ${id()}) returning stable_id`
        );
        await conn.any(sql`select publish_table_of_contents(${projectBId})`);
        const tocs = await conn.many(
          sql`select id from table_of_contents_items where project_id = ${projectBId}`
        );
        await createSession(conn, adminId, true, false, projectId);
        expect(tocs.length).toBe(2);
        // make sure original project's items haven't changed
        const itemsAgain = await conn.many(
          sql`select title, stable_id, parent_stable_id, data_layer_id from table_of_contents_items where project_id = ${projectId} and is_draft = false`
        );
        expect(itemsAgain.length).toBe(6);
      }
    );
  });
});

describe("Access control", () => {
  test("table of contents items can be created and edited only by project admins", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const stableId = id();
        const folderA = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderA', true, ${stableId}) returning id`
        );
        expect(
          conn.oneFirst(
            sql`update table_of_contents_items set show_radio_children = true where id = ${folderA} returning id`
          )
        ).resolves.toBeTruthy();
        await createSession(conn, userA, true, false, projectId);
        expect(
          conn.oneFirst(
            sql`update table_of_contents_items set show_radio_children = true where id = ${folderA} returning id`
          )
        ).rejects.toThrow();
      }
    );
  });
  test("access control list settings are copied to published items and control visibilility of items for project users", async () => {
    await verifyOnlyProjectGroupMembersCanAccessResource(
      pool,
      "table_of_contents_items",
      async (conn, projectId, groupId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const stableId = id();
        const itemId = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderA', true, ${stableId}) returning id`
        );
        await limitToGroup(conn, "table_of_contents_item_id", itemId, groupId);
        await conn.any(sql`select publish_table_of_contents(${projectId})`);
        let publishedItemId = await conn.oneFirst(
          sql`select id from table_of_contents_items where is_draft = false and stable_id = ${stableId}`
        );
        return publishedItemId as number;
      }
    );
  });
  test("access control lists impact all children of an item", async () => {
    await verifyOnlyProjectGroupMembersCanAccessResource(
      pool,
      "table_of_contents_items",
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
        await limitToGroup(
          conn,
          "table_of_contents_item_id",
          protectedId,
          groupId
        );
        await conn.any(sql`select publish_table_of_contents(${projectId})`);
        let publishedItemId = await conn.oneFirst(
          sql`select id from table_of_contents_items where is_draft = false and stable_id = ${folderBStableId}`
        );
        let unprotectedItem = await conn.one(
          sql`select id, title, stable_id, is_folder, is_draft from table_of_contents_items where is_draft = false and stable_id = ${unprotectedFolderStableId}`
        );
        await clearSession(conn);
        // return unprotectedItem.id as number;
        return publishedItemId as number;
      }
    );
  });
  test("only admins can see is_draft items", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const stableId = id();
        const folderA = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderA', true, ${stableId}) returning id`
        );
        const folder = await conn.one(
          sql`select id, title, show_radio_children from table_of_contents_items where id = ${folderA}`
        );
        await conn.any(sql`select publish_table_of_contents(${projectId})`);
        const publishedFolderAId = await conn.oneFirst(
          sql`select id from table_of_contents_items where stable_id=${stableId} and is_draft=false`
        );
        expect(
          conn.oneFirst(
            sql`select id from table_of_contents_items where id = ${folderA}`
          )
        ).resolves.toBe(folderA);
        await createSession(conn, userA, true, false, projectId);
        expect(
          conn.oneFirst(
            sql`select id from table_of_contents_items where id = ${folderA}`
          )
        ).rejects.toThrow(/not found/);
      }
    );
  });
  test("access control takes into account project-level access as well", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        await createSession(conn, adminId, true, false, projectId);
        const stableId = id();
        const folderA = await conn.oneFirst(
          sql`insert into table_of_contents_items(project_id, title, is_folder, stable_id) values (${projectId}, 'folderA', true, ${stableId}) returning id`
        );
        const folder = await conn.one(
          sql`select id, title, show_radio_children from table_of_contents_items where id = ${folderA}`
        );
        await conn.any(sql`select publish_table_of_contents(${projectId})`);
        const publishedFolderAId = await conn.oneFirst(
          sql`select id from table_of_contents_items where stable_id=${stableId} and is_draft=false`
        );
        expect(
          conn.oneFirst(
            sql`select id from table_of_contents_items where id = ${folderA}`
          )
        ).resolves.toBe(folderA);
        await createSession(conn, userA, true, false, projectId);
        expect(
          conn.oneFirst(
            sql`select id from table_of_contents_items where id = ${publishedFolderAId}`
          )
        ).resolves.toBe(publishedFolderAId);
        await clearSession(conn);
        await createSession(conn);
        expect(
          conn.oneFirst(
            sql`select id from table_of_contents_items where id = ${publishedFolderAId}`
          )
        ).rejects.toThrow(/not found/);
      }
    );
  });
});
