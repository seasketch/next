/// <reference types="jest" />
import { randomUUID } from "crypto";
import { PoolClient } from "pg";
import { createLayerYearTemporalInfo } from "@seasketch/geostats-types";
import type { ProcessedUploadLayer } from "spatial-uploads-handler";
import { createDBRecordsForProcessedLayer } from "../src/spatialUploads";
import { createPgPool } from "./pool";

const pgPool = createPgPool("test");

jest.setTimeout(1000 * 30);

afterAll(async () => {
  await pgPool.end();
});

const EXISTING_STYLE = [
  {
    type: "fill",
    paint: { "fill-color": "#ff0000" },
  },
];

const AI_ATTRIBUTION = "AI-generated attribution that must not replace admin copy";

function processedReplacementLayer(): ProcessedUploadLayer {
  return {
    name: "habitats",
    filename: "habitats.shp",
    url: "https://tiles.example.com/habitats",
    bounds: [-1, -1, 1, 1],
    geostats: {
      layer: "habitats",
      geometry: "Polygon",
      count: 3,
      attributeCount: 1,
      attributes: [
        {
          attribute: "class",
          type: "string",
          count: 3,
          values: [
            { value: "reef", count: 2 },
            { value: "seagrass", count: 1 },
          ],
        },
      ],
      metadata: { attribution: "geostats attribution" },
    },
    aiDataAnalystNotes: {
      junk_columns: [],
      chosen_presentation_type: "CATEGORICAL_POLYGON",
      chosen_presentation_column: "class",
      reverse_palette: false,
      show_labels: false,
      interactivity_type: "ALL_PROPERTIES_POPUP",
      notes: "AI cartography notes",
      attribution: AI_ATTRIBUTION,
      palette: "schemeTableau10",
    },
    outputs: [
      {
        type: "FlatGeobuf",
        remote: "s3://test-bucket/norm.fgb",
        filename: "norm.fgb",
        size: 1200,
        isNormalizedOutput: true,
        url: "https://example.com/norm.fgb",
      },
      {
        type: "ZippedShapefile",
        remote: "s3://test-bucket/orig.zip",
        filename: "orig.zip",
        size: 800,
        isOriginal: true,
        url: "https://example.com/orig.zip",
      },
      {
        type: "PMTiles",
        remote: "s3://test-bucket/habitats.pmtiles",
        filename: "habitats.pmtiles",
        size: 2000,
        url: "https://tiles.example.com/habitats",
      },
    ],
  };
}

async function withPgTx(fn: (client: PoolClient) => Promise<void>) {
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    await fn(client);
    await client.query("ROLLBACK");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure after a failed BEGIN/query
    }
    throw error;
  } finally {
    client.release();
  }
}

async function createAdminProject(client: PoolClient) {
  await client.query("set role postgres");
  const email = `${randomUUID()}@example.com`;
  const userRes = await client.query(
    `select get_or_create_user_by_sub($1, $2) as id`,
    [`test:${randomUUID()}`, email],
  );
  const adminId = userRes.rows[0].id as number;
  await client.query(`select set_config('session.user_id', $1, true)`, [
    String(adminId),
  ]);
  await client.query(
    `select set_config('session.canonical_email', $1, true)`,
    [email],
  );
  await client.query(
    `select set_config('session.email_verified', $1, true)`,
    ["true"],
  );
  const slug = `p${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const projectRes = await client.query(
    `select id from create_project($1, $1)`,
    [slug],
  );
  const projectId = projectRes.rows[0].id as number;
  await client.query("set role postgres");
  return { adminId, projectId };
}

async function createHostedLayerToReplace(
  client: PoolClient,
  projectId: number,
  adminId: number,
) {
  const temporal = createLayerYearTemporalInfo(2018);
  const sourceRes = await client.query(
    `insert into data_sources (
       project_id, type, import_type, url, attribution, temporal, translated_props
     ) values (
       $1, 'seasketch-mvt', 'upload', 'https://tiles.example.com/old',
       $2, $3::jsonb, $4::jsonb
     ) returning id`,
    [
      projectId,
      "Admin attribution",
      JSON.stringify(temporal),
      JSON.stringify({ attribution: { es: "Atribución" } }),
    ],
  );
  const sourceId = sourceRes.rows[0].id as number;
  const layerRes = await client.query(
    `insert into data_layers (project_id, data_source_id, source_layer, mapbox_gl_styles)
     values ($1, $2, 'habitats', $3::jsonb)
     returning id, interactivity_settings_id`,
    [projectId, sourceId, JSON.stringify(EXISTING_STYLE)],
  );
  const layerId = layerRes.rows[0].id as number;
  const interactivitySettingsId = layerRes.rows[0]
    .interactivity_settings_id as number;
  await client.query(
    `update interactivity_settings set type = 'TOOLTIP', short_template = '{{class}}' where id = $1`,
    [interactivitySettingsId],
  );
  const tocRes = await client.query(
    `insert into table_of_contents_items (
       project_id, title, is_folder, data_layer_id, stable_id
     ) values ($1, 'Habitats', false, $2, $3)
     returning id`,
    [projectId, layerId, randomUUID().replace(/-/g, "").slice(0, 9)],
  );
  const jobRes = await client.query(
    `insert into project_background_jobs (project_id, title, type, user_id)
     values ($1, 'Replacement upload habitats.shp', 'data_upload', $2)
     returning id`,
    [projectId, adminId],
  );
  const jobId = jobRes.rows[0].id as string;
  await client.query(
    `insert into data_upload_tasks (
       filename, content_type, project_background_job_id, replace_table_of_contents_item_id
     ) values ('habitats.shp', 'application/zip', $1, $2)`,
    [jobId, tocRes.rows[0].id],
  );
  return { sourceId, layerId, jobId, interactivitySettingsId };
}

describe("createDBRecordsForProcessedLayer replace", () => {
  test("copies admin-authored source fields onto the new source", async () => {
    await withPgTx(async (client) => {
      const { adminId, projectId } = await createAdminProject(client);
      const { sourceId, layerId, jobId } = await createHostedLayerToReplace(
        client,
        projectId,
        adminId,
      );

      const result = await createDBRecordsForProcessedLayer(
        processedReplacementLayer(),
        projectId,
        client,
        jobId,
        "upload",
        { sourceId, layerId },
      );

      const newSource = (
        await client.query(
          `select attribution, temporal, translated_props from data_sources where id = $1`,
          [result.dataSourceId],
        )
      ).rows[0];

      expect(result.dataSourceId).not.toBe(sourceId);
      expect(newSource.attribution).toBe("Admin attribution");
      expect(newSource.temporal).toEqual(createLayerYearTemporalInfo(2018));
      expect(newSource.translated_props).toEqual({
        attribution: { es: "Atribución" },
      });
    });
  });

  test("keeps existing mapbox_gl_styles and interactivity instead of applying AI cartography", async () => {
    await withPgTx(async (client) => {
      const { adminId, projectId } = await createAdminProject(client);
      const { sourceId, layerId, jobId, interactivitySettingsId } =
        await createHostedLayerToReplace(client, projectId, adminId);

      await createDBRecordsForProcessedLayer(
        processedReplacementLayer(),
        projectId,
        client,
        jobId,
        "upload",
        { sourceId, layerId },
      );

      const layer = (
        await client.query(
          `select mapbox_gl_styles, data_source_id from data_layers where id = $1`,
          [layerId],
        )
      ).rows[0];
      const interactivity = (
        await client.query(
          `select type, short_template from interactivity_settings where id = $1`,
          [interactivitySettingsId],
        )
      ).rows[0];

      expect(layer.data_source_id).not.toBe(sourceId);
      expect(layer.mapbox_gl_styles).toEqual(EXISTING_STYLE);
      expect(interactivity.type).toBe("TOOLTIP");
      expect(interactivity.short_template).toBe("{{class}}");
    });
  });
});
