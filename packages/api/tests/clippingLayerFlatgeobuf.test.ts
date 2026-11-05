/// <reference types="jest" />
import { sql } from "slonik";
import { createPool } from "./pool";
import { createSession, projectTransaction } from "./helpers";

const pool = createPool("test");

describe("clipping layer FlatGeobuf lookup", () => {
  test("returns the processed FlatGeobuf when a source has more than one", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const geographyId = await conn.oneFirst(sql`
          insert into project_geography (project_id, name)
          values (${projectId}, 'Planning Area')
          returning id
        `);
        const sourceId = await conn.oneFirst(sql`
          insert into data_sources (project_id, type, url, import_type)
          values (
            ${projectId},
            'seasketch-mvt',
            'https://tiles.example.test/source.pmtiles',
            'upload'
          )
          returning id
        `);
        const layerId = await conn.oneFirst(sql`
          insert into data_layers (data_source_id, project_id, mapbox_gl_styles)
          values (${sourceId}, ${projectId}, '[]'::jsonb)
          returning id
        `);

        await conn.any(sql`set role postgres`);
        await conn.any(sql`
          insert into data_upload_outputs (
            data_source_id, project_id, type, url, remote, is_original, size, filename
          ) values
            (
              ${sourceId},
              ${projectId},
              'FlatGeobuf',
              'https://uploads.example.test/original.fgb',
              'r2://ssn-tiles/projects/example/original.fgb',
              true,
              100,
              'original.fgb'
            ),
            (
              ${sourceId},
              ${projectId},
              'FlatGeobuf',
              'https://uploads.example.test/processed.fgb',
              'r2://ssn-tiles/projects/example/processed.fgb',
              false,
              90,
              'processed.fgb'
            )
        `);
        await createSession(conn, adminId, true, false, projectId);

        const clippingLayerId = await conn.oneFirst(sql`
          insert into geography_clipping_layers (
            project_geography_id, data_layer_id, operation_type
          ) values (
            ${geographyId}, ${layerId}, 'intersect'
          )
          returning id
        `);

        const sketchClassId = await conn.oneFirst(sql`
          insert into sketch_classes (
            mapbox_gl_style, project_id, name, geometry_type
          ) values (
            '[]'::jsonb, ${projectId}, 'MPA', 'POLYGON'
          )
          returning id
        `);

        const forGeography = await conn.one(sql`
          select fgb_url
          from clipping_layers_for_geography(${geographyId})
        `);
        expect(forGeography.fgb_url).toEqual(
          "https://uploads.example.test/processed.fgb"
        );

        const source = await conn.one(sql`
          select fgb_url from clipping_layer_source(${clippingLayerId})
        `);
        expect(source.fgb_url).toEqual(
          "https://uploads.example.test/processed.fgb"
        );

        const fgbUrl = await conn.oneFirst(sql`
          select geography_clipping_layers_fgb_url(gcl)
          from geography_clipping_layers gcl
          where gcl.id = ${clippingLayerId}
        `);
        expect(fgbUrl).toEqual("https://uploads.example.test/processed.fgb");

        const objectKey = await conn.oneFirst(sql`
          select data_layers_vector_object_key(dl)
          from data_layers dl
          where dl.id = ${layerId}
        `);
        expect(objectKey).toEqual("projects/example/processed.fgb");

        const forSketchClass = await conn.one(sql`
          select fgb_url
          from clipping_layers_for_sketch_class(${projectId}, ${sketchClassId})
          where id = ${clippingLayerId}
        `);
        expect(forSketchClass.fgb_url).toEqual(
          "https://uploads.example.test/processed.fgb"
        );
      }
    );
  });
});
