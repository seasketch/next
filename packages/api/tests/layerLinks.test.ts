import { sql } from "slonik";
import { createPool } from "./pool";
import {
  createSession,
  projectTransaction,
  createGroup,
  addGroupToAcl,
} from "./helpers";
// @ts-ignore
import nanoid from "nanoid";

const stable = nanoid.customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz",
  12,
);

const pool = createPool("test");

const style = { version: 8, sources: {}, layers: [] };
const camera = { center: [0, 0], zoom: 4, bearing: 0, pitch: 0 };

async function createDraftLayer(
  conn: any,
  projectId: number,
  title: string,
  attribution: string | null,
  parentStableId: string | null,
) {
  const sourceId = await conn.oneFirst(
    sql`insert into data_sources (project_id, type, url, attribution)
      values (${projectId}, 'vector', 'https://example.com/{z}/{x}/{y}.pbf', ${attribution})
      returning id`,
  );
  const layerId = await conn.oneFirst(
    sql`insert into data_layers (project_id, data_source_id, source_layer, mapbox_gl_styles)
      values (${projectId}, ${sourceId}, 'rockfish', ${sql.json([
        { type: "fill", paint: { "fill-color": "#125" } },
      ])}) returning id`,
  );
  const stableId = stable();
  await conn.any(sql`
    insert into table_of_contents_items (
      project_id, title, is_folder, data_layer_id, stable_id, parent_stable_id
    ) values (
      ${projectId}, ${title}, false, ${layerId}, ${stableId}, ${parentStableId}
    )`);
  return stableId;
}

async function publish(conn: any, projectId: number, stableIds: string[]) {
  await conn.any(sql`
    select publish_table_of_contents_items(
      ${projectId},
      ${sql.array(stableIds, "text")}
    )`);
}

function callEnsure(
  conn: any,
  slug: string,
  stableId: string,
  nextCamera = camera,
  basemapId: number,
  draft = false,
  refresh = true,
) {
  return conn.one(sql`
    select id, kind::text, subject_stable_id, subject_is_draft, image_id,
      screenshot_job_status::text, visible_data_layers, is_public, camera_options,
      layer_names
    from ensure_layer_link(
      ${slug},
      ${stableId},
      ${sql.json(style)},
      ${basemapId},
      ${sql.json({})},
      ${sql.json(nextCamera)},
      ${sql.array([1200, 800], "int4")},
      'Ocean',
      ${sql.json({ [stableId]: "Rockfish" })},
      ${draft},
      ${refresh}
    )`);
}

describe("layer links", () => {
  test("admins get one stable bookmark per published layer", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const slug = (await conn.oneFirst(
          sql`select slug from projects where id = ${projectId}`,
        )) as string;
        const basemapId = Number(
          await conn.oneFirst(sql`
            insert into basemaps (project_id, name, type, url, thumbnail)
            values (
              ${projectId}, 'Ocean', 'MAPBOX',
              'mapbox://my-map/id', 'https://thumbnail.org/1.png'
            ) returning id`),
        );
        const stableId = await createDraftLayer(
          conn,
          projectId,
          "Rockfish",
          "Fisheries and Oceans Canada",
          null,
        );
        await publish(conn, projectId, [stableId]);

        const created = await callEnsure(conn, slug, stableId, camera, basemapId);
        expect(created.kind).toBe("layer_link");
        expect(created.subject_stable_id).toBe(stableId);
        expect(created.subject_is_draft).toBe(false);
        expect(created.visible_data_layers).toEqual([stableId]);
        expect(created.is_public).toBe(true);
        expect(created.screenshot_job_status).toBe("queued");

        await conn.any(sql`set role postgres`);
        await conn.any(sql`
          update map_bookmarks
          set image_id = 'img_123', screenshot_job_status = 'finished'
          where id = ${created.id}`);
        const count = await conn.oneFirst(sql`
          select count(*) from map_bookmarks
          where project_id = ${projectId} and kind = 'layer_link'`);
        await createSession(conn, adminId, true, false, projectId);

        const again = await callEnsure(conn, slug, stableId, camera, basemapId);
        expect(again.id).toBe(created.id);
        expect(again.image_id).toBe("img_123");
        expect(again.screenshot_job_status).toBe("finished");

        expect(Number(count)).toBe(1);

        const refreshed = await callEnsure(
          conn,
          slug,
          stableId,
          { center: [1, 2], zoom: 5, bearing: 0, pitch: 0 },
          basemapId,
        );
        expect(refreshed.id).toBe(created.id);
        expect(refreshed.image_id).toBeNull();
        expect(refreshed.screenshot_job_status).toBe("queued");
        expect(refreshed.camera_options).toEqual({
          center: [1, 2],
          zoom: 5,
          bearing: 0,
          pitch: 0,
        });
      },
    );
  });

  test("forum bookmarks stay kind forum and non-admins cannot create a layer link", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [member]) => {
        await createSession(conn, adminId, true, false, projectId);
        const slug = (await conn.oneFirst(
          sql`select slug from projects where id = ${projectId}`,
        )) as string;
        const basemapId = Number(
          await conn.oneFirst(sql`
            insert into basemaps (project_id, name, type, url, thumbnail)
            values (
              ${projectId}, 'Ocean', 'MAPBOX',
              'mapbox://my-map/id', 'https://thumbnail.org/1.png'
            ) returning id`),
        );
        const forum = await conn.one(sql`
          select kind::text
          from create_map_bookmark(
            ${slug},
            false,
            ${sql.json({})},
            ${sql.array([], "text")},
            ${basemapId},
            ${sql.json({})},
            ${sql.json(camera)},
            ${sql.array([800, 600], "int4")},
            ${sql.array([], "int4")},
            null,
            'Ocean',
            ${sql.json({})},
            ${sql.json({})},
            'data:image/jpeg;base64,abc'
          )`);
        expect(forum.kind).toBe("forum");

        const stableId = await createDraftLayer(
          conn,
          projectId,
          "Rockfish",
          "Fisheries and Oceans Canada",
          null,
        );
        await publish(conn, projectId, [stableId]);
        await createSession(conn, member, true, false, projectId);
        await expect(
          callEnsure(conn, slug, stableId, camera, basemapId),
        ).rejects.toThrow(/Permission denied/);
      },
    );
  });

  test("unpublished layers are refused", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const slug = (await conn.oneFirst(
          sql`select slug from projects where id = ${projectId}`,
        )) as string;
        const basemapId = Number(
          await conn.oneFirst(sql`
            insert into basemaps (project_id, name, type, url, thumbnail)
            values (
              ${projectId}, 'Ocean', 'MAPBOX',
              'mapbox://my-map/id', 'https://thumbnail.org/1.png'
            ) returning id`),
        );
        const stableId = stable();
        const sourceId = await conn.oneFirst(
          sql`insert into data_sources (project_id, type, url)
            values (${projectId}, 'vector', 'https://example.com/{z}/{x}/{y}.pbf')
            returning id`,
        );
        const layerId = await conn.oneFirst(
          sql`insert into data_layers (project_id, data_source_id, source_layer, mapbox_gl_styles)
            values (${projectId}, ${sourceId}, 'draft', ${sql.json([
              { type: "fill", paint: { "fill-color": "#125" } },
            ])}) returning id`,
        );
        await conn.any(sql`
          insert into table_of_contents_items (
            project_id, title, is_folder, data_layer_id, stable_id
          ) values (
            ${projectId}, 'Draft rockfish', false, ${layerId}, ${stableId}
          )`);
        await expect(
          callEnsure(conn, slug, stableId, camera, basemapId),
        ).rejects.toThrow(/Publish this layer/);
      },
    );
  });

  test("sharing summary includes project access and inherited folder groups", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const slug = (await conn.oneFirst(
          sql`select slug from projects where id = ${projectId}`,
        )) as string;
        const folderStable = stable();
        await conn.any(sql`
          insert into table_of_contents_items (
            project_id, title, is_folder, stable_id
          ) values (
            ${projectId}, 'Species', true, ${folderStable}
          )`);
        const layerStable = await createDraftLayer(
          conn,
          projectId,
          "Rockfish",
          "DFO",
          folderStable,
        );
        await publish(conn, projectId, [folderStable, layerStable]);
        const folderId = await conn.oneFirst(sql`
          select id from table_of_contents_items
          where project_id = ${projectId}
            and stable_id = ${folderStable}
            and not is_draft`);
        await conn.any(sql`set role postgres`);
        const aclId = await conn.oneFirst(sql`
          select id from access_control_lists
          where table_of_contents_item_id = ${folderId}`);
        await conn.any(sql`
          update access_control_lists set type = 'group' where id = ${aclId}`);
        await createSession(conn, adminId, true, false, projectId);
        const groupId = await createGroup(conn, projectId, "Planners");
        await addGroupToAcl(conn, Number(aclId), groupId);

        const summary = await conn.oneFirst(sql`
          select layer_link_sharing(${slug}, ${layerStable})`);
        expect(summary).toEqual({
          projectName: slug,
          projectAccess: "invite_only",
          title: "Rockfish",
          attribution: "DFO",
          folderTitles: ["Species"],
          restrictions: [
            {
              title: "Species",
              isFolder: true,
              type: "group",
              groups: ["Planners"],
            },
          ],
        });
      },
    );
  });

  test("admin links are a second bookmark and stay hidden from other people", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [member]) => {
        await createSession(conn, adminId, true, false, projectId);
        const slug = (await conn.oneFirst(
          sql`select slug from projects where id = ${projectId}`,
        )) as string;
        const basemapId = Number(
          await conn.oneFirst(sql`
            insert into basemaps (project_id, name, type, url, thumbnail)
            values (
              ${projectId}, 'Ocean', 'MAPBOX',
              'mapbox://my-map/id', 'https://thumbnail.org/1.png'
            ) returning id`),
        );
        const stableId = await createDraftLayer(
          conn,
          projectId,
          "Rockfish",
          null,
          null,
        );
        const draftLink = await callEnsure(
          conn,
          slug,
          stableId,
          camera,
          basemapId,
          true,
        );
        expect(draftLink.subject_is_draft).toBe(true);
        expect(draftLink.is_public).toBe(false);

        await conn.any(sql`savepoint before_published_link`);
        await expect(
          callEnsure(conn, slug, stableId, camera, basemapId, false),
        ).rejects.toThrow(/Publish this layer/);
        await conn.any(sql`rollback to savepoint before_published_link`);

        await publish(conn, projectId, [stableId]);
        const published = await callEnsure(
          conn,
          slug,
          stableId,
          camera,
          basemapId,
          false,
        );
        expect(published.id).not.toBe(draftLink.id);
        expect(published.subject_is_draft).toBe(false);

        await conn.any(sql`set role postgres`);
        await conn.any(sql`
          update map_bookmarks
          set image_id = 'img_published', screenshot_job_status = 'finished'
          where id = ${published.id}`);
        await createSession(conn, adminId, true, false, projectId);
        const untouched = await callEnsure(
          conn,
          slug,
          stableId,
          { center: [9, 9], zoom: 2, bearing: 0, pitch: 0 },
          basemapId,
          false,
          false,
        );
        expect(untouched.id).toBe(published.id);
        expect(untouched.image_id).toBe("img_published");
        expect(untouched.camera_options).toEqual(camera);

        await createSession(conn, member, true, false, projectId);
        const hidden = await conn.oneFirst(sql`
          select (bookmark_by_id(${draftLink.id})).id`);
        expect(hidden).toBeNull();
        expect(
          await conn.oneFirst(sql`select layer_link_access(${draftLink.id})`),
        ).toBe("admins_only");

        await createSession(conn, adminId, true, false, projectId);
        const visible = await conn.oneFirst(sql`
          select (bookmark_by_id(${draftLink.id})).id`);
        expect(visible).toBe(draftLink.id);
        expect(
          await conn.oneFirst(sql`select layer_link_access(${draftLink.id})`),
        ).toBe("ok");
      },
    );
  });
});
