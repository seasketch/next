import { sql } from "slonik";
import { createPool } from "./pool";
import {
  clearSession,
  createSession,
  createUser,
  projectTransaction,
} from "./helpers";

const pool = createPool("test");

const camera = { center: [0, 0], zoom: 4, bearing: 0, pitch: 0 };
const secret = "SECRET_SKETCH_GEOMETRY";

const style = {
  version: 8,
  layers: [
    { id: "basemap", source: "basemap", type: "raster" },
    { id: "overlay-a", source: "overlay-1", type: "fill" },
    { id: "sketch-9", source: "sketch-9", type: "fill" },
    { id: "gl-draw-line", source: "mapbox-gl-draw-cold", type: "line" },
    { id: "filter-layer-1", source: "filter-src", type: "line" },
    { id: "all-cells", source: "all-cells", type: "fill" },
  ],
  sources: {
    basemap: { type: "raster", tiles: ["https://example.com/b/{z}/{x}/{y}.png"] },
    "overlay-1": {
      type: "vector",
      tiles: ["https://example.com/o/{z}/{x}/{y}.pbf"],
    },
    "sketch-9": {
      type: "geojson",
      data: {
        type: "Feature",
        properties: { note: secret },
        geometry: { type: "Point", coordinates: [1, 2] },
      },
    },
    "mapbox-gl-draw-cold": {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    },
    "filter-src": {
      type: "vector",
      tiles: ["https://example.com/f/{z}/{x}/{y}.pbf"],
    },
    "all-cells": { type: "geojson", data: { type: "FeatureCollection", features: [] } },
  },
};

function callCreate(
  conn: any,
  slug: string,
  basemapId: number,
  layers: string[] = ["eez"],
) {
  return conn.one(sql`
    select id, kind::text, is_public, post_id, visible_sketches, visible_data_layers,
      screenshot_job_status::text, style, layer_names, sketch_names, user_id
    from create_map_view_bookmark(
      ${slug},
      ${sql.json(style)},
      ${sql.array(layers, "text")},
      ${basemapId},
      ${sql.json({})},
      ${sql.json(camera)},
      ${sql.array([1200, 800], "int4")},
      ${sql.json({ open: false, width: 0, isSmall: false })},
      'Ocean',
      ${sql.json({ eez: "Exclusive Economic Zone" })},
      'data:image/jpeg;base64,abc',
      ${sql.json({})}
    )`);
}

async function basemap(conn: any, projectId: number) {
  return Number(
    await conn.oneFirst(sql`
      insert into basemaps (project_id, name, type, url, thumbnail)
      values (
        ${projectId}, 'Ocean', 'MAPBOX',
        'mapbox://my-map/id', 'https://thumbnail.org/1.png'
      ) returning id`),
  );
}

describe("map view bookmarks", () => {
  test("a signed-in person gets a public map view with sketches removed", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      await createSession(conn, adminId, true, false, projectId);
      const slug = (await conn.oneFirst(
        sql`select slug from projects where id = ${projectId}`,
      )) as string;
      const basemapId = await basemap(conn, projectId);

      const created = await callCreate(conn, slug, basemapId);
      expect(created.kind).toBe("map_view");
      expect(created.is_public).toBe(true);
      expect(created.post_id).toBeNull();
      expect(created.visible_sketches).toEqual([]);
      expect(created.sketch_names).toEqual({});
      expect(created.visible_data_layers).toEqual(["eez"]);
      expect(created.screenshot_job_status).toBe("queued");
      expect(created.user_id).toBe(adminId);
      const creator = await conn.one(sql`
        select fullname from map_bookmarks_creator(bookmark_by_id(${created.id}))
      `);
      expect(creator.fullname).toBeNull();
      expect(JSON.stringify(created.style)).not.toContain(secret);
      expect(created.style.layers.map((layer: { id: string }) => layer.id)).toEqual([
        "basemap",
        "overlay-a",
      ]);
      expect(Object.keys(created.style.sources).sort()).toEqual([
        "basemap",
        "overlay-1",
      ]);

      const again = await callCreate(conn, slug, basemapId, ["land"]);
      expect(again.id).not.toBe(created.id);
      expect(again.visible_data_layers).toEqual(["land"]);

      const loaded = await conn.oneFirst(sql`
        select (bookmark_by_id(${created.id})).kind::text`);
      expect(loaded).toBe("map_view");

      await conn.any(
        sql`update projects set name = ${"American Samoa"} where id = ${projectId}`,
      );
      const preview = await conn.oneFirst(sql`
        select bookmark_link_preview(${slug}, ${created.id})`);
      expect(preview).toMatchObject({
        title: "Map bookmark",
        description: "Exclusive Economic Zone on the American Samoa map.",
      });
    });
  });

  test("forum bookmarks stay forum rows, and people without access cannot create a map view", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [, member]) => {
        await createSession(conn, adminId, true, false, projectId);
        const slug = (await conn.oneFirst(
          sql`select slug from projects where id = ${projectId}`,
        )) as string;
        const basemapId = await basemap(conn, projectId);
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
            ${sql.array([4], "int4")},
            null,
            'Ocean',
            ${sql.json({})},
            ${sql.json({ 4: "My plan" })},
            'data:image/jpeg;base64,abc'
          )`);
        expect(forum.kind).toBe("forum");

        const outsider = await createUser(conn);
        await createSession(conn, outsider, true, false, projectId);
        await conn.any(sql`savepoint denied`);
        await expect(callCreate(conn, slug, basemapId)).rejects.toThrow(
          /Permission denied/,
        );
        await conn.any(sql`rollback to savepoint denied`);

        await createSession(conn, member, true, false, projectId);
        const created = await callCreate(conn, slug, basemapId);
        expect(created.kind).toBe("map_view");

        await conn.any(sql`savepoint anon`);
        await createSession(conn);
        await expect(callCreate(conn, slug, basemapId)).rejects.toThrow(
          /permission denied/i,
        );
        await conn.any(sql`rollback to savepoint anon`);
      },
    );
  });

  test("a map view pasted into a post stays unattached, and a private topic title stays hidden", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [member]) => {
        await createSession(conn, adminId, true, false, projectId);
        const slug = (await conn.oneFirst(
          sql`select slug from projects where id = ${projectId}`,
        )) as string;
        const basemapId = await basemap(conn, projectId);
        const mapView = await callCreate(conn, slug, basemapId);
        const forum = await conn.one(sql`
          select id
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

        await clearSession(conn);
        const forumId = await conn.oneFirst(
          sql`insert into forums (project_id, name) values (${projectId}, 'Forum') returning id`,
        );
        await conn.any(
          sql`update access_control_lists set type = 'admins_only' where forum_id_read = ${forumId}`,
        );
        await createSession(conn, adminId, true, false, projectId);
        const topicTitle = "Private planning notes";
        const topicId = await conn.oneFirst(
          sql`select id from create_topic(${forumId}, ${topicTitle}, '{"type":"doc"}'::jsonb, '<p></p>')`,
        );
        let postId = await conn.maybeOneFirst(
          sql`select id from posts where topic_id = ${topicId} order by id limit 1`,
        );
        if (postId == null) {
          postId = await conn.oneFirst(
            sql`select id from create_post('{"type":"doc"}'::jsonb, ${topicId}, '<p></p>')`,
          );
        }

        await clearSession(conn);
        const body = {
          type: "doc",
          content: [
            {
              type: "attachments",
              content: [mapView.id, forum.id].map((id) => ({
                type: "attachment",
                attrs: { type: "MapBookmark", id },
              })),
            },
          ],
        };
        await conn.any(sql`
          select assign_post_id_to_attached_map_bookmarks(${sql.json(body)}, ${postId})
        `);
        const attached = await conn.any(sql`
          select id::text, kind::text, post_id
          from map_bookmarks
          where id = any(${sql.array([mapView.id, forum.id], "uuid")})
        `);
        const byId = new Map(attached.map((row) => [row.id, row]));
        expect(byId.get(mapView.id).post_id).toBeNull();
        expect(byId.get(forum.id).post_id).toBe(postId);

        await createSession(conn, adminId, true, false, projectId);
        const adminTitle = await conn.oneFirst(sql`
          select (map_bookmarks_forum_topic(bookmark_by_id(${forum.id}))).title
        `);
        expect(adminTitle).toBe(topicTitle);
        const mapViewTitle = await conn.maybeOneFirst(sql`
          select (map_bookmarks_forum_topic(bookmark_by_id(${mapView.id}))).title
        `);
        expect(mapViewTitle).toBeNull();

        await createSession(conn, member, true, false, projectId);
        const hidden = await conn.maybeOneFirst(sql`
          select (map_bookmarks_forum_topic(bookmark_by_id(${forum.id}))).title
        `);
        expect(hidden).toBeNull();

        await clearSession(conn);
        await conn.any(
          sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`,
        );
        await createSession(conn, member, true, false, projectId);
        const visible = await conn.oneFirst(sql`
          select (map_bookmarks_forum_topic(bookmark_by_id(${forum.id}))).title
        `);
        expect(visible).toBe(topicTitle);
      },
    );
  });
});
