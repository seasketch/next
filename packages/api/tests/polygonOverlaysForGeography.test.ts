/// <reference types="jest" />
import { sql, DatabaseTransactionConnectionType } from "slonik";
import { createPool } from "./pool";
import { createSession, projectTransaction } from "./helpers";
// @ts-ignore
import nanoid from "nanoid";

const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
const id = nanoid.customAlphabet(alphabet, 9);

const pool = createPool("test");

function geostats(geometry: string, count = 1) {
  return {
    layers: [
      {
        layer: "layer",
        count,
        geometry,
        hasZ: false,
        attributeCount: 0,
        attributes: [],
      },
    ],
  };
}

async function createOverlay(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  adminId: number,
  options: {
    title: string;
    geometry: string;
    withFlatGeobuf?: boolean;
    createdAt?: string;
  }
) {
  await createSession(conn, adminId, true, false, projectId);
  const sourceId = Number(
    await conn.oneFirst(sql`
      insert into data_sources (
        project_id, type, url, import_type, byte_length, geostats, created_at
      ) values (
        ${projectId},
        'seasketch-vector',
        'https://example.com/source.json',
        'upload',
        0,
        ${sql.json(geostats(options.geometry))},
        ${options.createdAt ?? sql`timezone('utc', now())`}
      )
      returning id
    `)
  );
  const layerId = Number(
    await conn.oneFirst(sql`
      insert into data_layers (project_id, data_source_id, mapbox_gl_styles)
      values (${projectId}, ${sourceId}, ${sql.json([
        { type: "fill", paint: { "fill-color": "#00ff00" } },
      ])})
      returning id
    `)
  );
  const itemId = Number(
    await conn.oneFirst(sql`
      insert into table_of_contents_items (
        project_id, title, is_folder, data_layer_id, stable_id
      ) values (
        ${projectId}, ${options.title}, false, ${layerId}, ${id()}
      )
      returning id
    `)
  );

  if (options.withFlatGeobuf !== false) {
    await conn.any(sql`set role postgres`);
    await conn.any(sql`
      insert into data_upload_outputs (
        data_source_id, project_id, type, url, remote, is_original, size, filename
      ) values (
        ${sourceId},
        ${projectId},
        'FlatGeobuf',
        ${"https://uploads.example.com/" + id() + ".fgb"},
        ${"r2://test-bucket/" + id() + ".fgb"},
        true,
        1234,
        'layer.fgb'
      )
    `);
    await createSession(conn, adminId, true, false, projectId);
  }

  return { sourceId, layerId, itemId };
}

async function overlayTitles(
  conn: DatabaseTransactionConnectionType,
  projectId: number
) {
  const rows = await conn.any(sql`
    select toc.title
    from projects p,
    lateral projects_polygon_overlays_for_geography(p) toc
    where p.id = ${projectId}
  `);
  return rows.map((row) => String(row.title));
}

describe("projects_polygon_overlays_for_geography", () => {
  test("returns only draft polygon overlays that have a FlatGeobuf output, newest first", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);

        await createOverlay(conn, projectId, adminId, {
          title: "Older polygon",
          geometry: "Polygon",
          createdAt: "2024-01-01T00:00:00Z",
        });
        await createOverlay(conn, projectId, adminId, {
          title: "Newer multipolygon",
          geometry: "MultiPolygon",
          createdAt: "2024-06-01T00:00:00Z",
        });
        await createOverlay(conn, projectId, adminId, {
          title: "Point layer",
          geometry: "Point",
        });
        await createOverlay(conn, projectId, adminId, {
          title: "Polygon without fgb",
          geometry: "Polygon",
          withFlatGeobuf: false,
        });
        await conn.any(sql`
          insert into table_of_contents_items (
            project_id, title, is_folder, stable_id
          ) values (
            ${projectId}, 'A folder', true, ${id()}
          )
        `);

        expect(await overlayTitles(conn, projectId)).toEqual([
          "Newer multipolygon",
          "Older polygon",
        ]);
      }
    );
  });
});
