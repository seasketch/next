/// <reference types="jest" />
import { sql, DatabaseTransactionConnectionType } from "slonik";
import { createPool } from "./pool";
import { clearSession, createSession, projectTransaction } from "./helpers";
// @ts-ignore
import nanoid from "nanoid";

const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
const id = nanoid.customAlphabet(alphabet, 9);

const pool = createPool("test");

const UNPUBLISHED_VERSION =
  /references updated versions of data sources which have not yet been published/;

/**
 * An uploaded vector source with the ReportingFlatgeobufV1 output that
 * preprocessing writes.
 */
async function createPreprocessedSource(
  conn: DatabaseTransactionConnectionType,
  projectId: number
) {
  const key = id();
  const sourceId = (await conn.oneFirst(
    sql`insert into data_sources (project_id, type, url, import_type, byte_length)
        values (${projectId}, 'seasketch-vector', ${`https://uploads.example.test/${key}.geojson.json`}, 'upload', 12)
        returning id`
  )) as number;
  const jobKey = (await conn.oneFirst(
    sql`insert into source_processing_jobs (data_source_id, project_id, state)
        values (${sourceId}, ${projectId}, 'complete')
        returning job_key`
  )) as string;
  await conn.any(
    sql`insert into data_upload_outputs (
          data_source_id, project_id, type, url, remote, size, filename, source_processing_job_key
        ) values (
          ${sourceId}, ${projectId}, 'ReportingFlatgeobufV1',
          ${`https://uploads.example.test/subdivided/${key}.fgb`},
          ${`r2://bucket/subdivided/${key}.fgb`}, 12, ${`${key}.fgb`}, ${jobKey}
        )`
  );
  return sourceId;
}

async function createReportingLayer(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  title: string
) {
  const sourceId = await createPreprocessedSource(conn, projectId);
  const layerId = (await conn.oneFirst(
    sql`insert into data_layers (project_id, data_source_id, mapbox_gl_styles)
        values (${projectId}, ${sourceId}, '[{"type": "fill"}]'::jsonb)
        returning id`
  )) as number;
  const stableId = id();
  await conn.any(
    sql`insert into table_of_contents_items (project_id, title, is_folder, data_layer_id, stable_id)
        values (${projectId}, ${title}, false, ${layerId}, ${stableId})`
  );
  return { layerId, stableId };
}

/** Points the draft layer at a new, preprocessed source, as a version upload does. */
async function uploadNewVersion(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  layer: { layerId: number; stableId: string }
) {
  const sourceId = await createPreprocessedSource(conn, projectId);
  await conn.any(
    sql`select replace_data_source(${layer.layerId}, ${sourceId}, null, null, null, ${layer.stableId})`
  );
  return sourceId;
}

function overlapCard(stableId: string) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "metric",
            attrs: {
              type: "InlineMetric",
              metrics: [
                { type: "overlay_area", subjectType: "fragments", stableId },
              ],
              componentSettings: { presentation: "overlay_area" },
            },
          },
        ],
      },
    ],
  };
}

async function createDraftReport(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  stableIds: string[]
) {
  const sketchClassId = (await conn.oneFirst(
    sql`insert into sketch_classes (project_id, name, geometry_type)
        values (${projectId}, ${`Class ${id()}`}, 'COLLECTION')
        returning id`
  )) as number;
  const reportId = (await conn.oneFirst(
    sql`insert into reports (project_id, sketch_class_id, title)
        values (${projectId}, ${sketchClassId}, 'Report')
        returning id`
  )) as number;
  const tabId = (await conn.oneFirst(
    sql`insert into report_tabs (report_id, title, position)
        values (${reportId}, 'Tab', 0)
        returning id`
  )) as number;
  for (const [position, stableId] of stableIds.entries()) {
    await conn.any(
      sql`insert into report_cards (report_tab_id, position, body)
          values (${tabId}, ${position}, ${sql.json(overlapCard(stableId))})`
    );
  }
  return reportId;
}

async function publishLayerList(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  adminId: number
) {
  await createSession(conn, adminId, true, false, projectId);
  await conn.any(sql`select publish_table_of_contents(${projectId})`);
  await clearSession(conn);
}

function publishReport(conn: DatabaseTransactionConnectionType, reportId: number) {
  return conn.any(sql`select publish_report_snapshot(${reportId})`);
}

describe("publish_report_snapshot and unpublished layer versions", () => {
  test("refuses when the report's only layer has an unpublished version", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      await clearSession(conn);
      const ebsa = await createReportingLayer(conn, projectId, "EBSAs");
      const reportId = await createDraftReport(conn, projectId, [ebsa.stableId]);
      await publishLayerList(conn, projectId, adminId);
      await publishReport(conn, reportId);

      await uploadNewVersion(conn, projectId, ebsa);
      await expect(publishReport(conn, reportId)).rejects.toThrow(
        UNPUBLISHED_VERSION
      );
    });
  });

  test("refuses when every referenced layer has an unpublished version", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      await clearSession(conn);
      const ebsa = await createReportingLayer(conn, projectId, "EBSAs");
      const seamounts = await createReportingLayer(conn, projectId, "Seamounts");
      const reportId = await createDraftReport(conn, projectId, [
        ebsa.stableId,
        seamounts.stableId,
      ]);
      await publishLayerList(conn, projectId, adminId);
      await publishReport(conn, reportId);

      await uploadNewVersion(conn, projectId, ebsa);
      await uploadNewVersion(conn, projectId, seamounts);
      await expect(publishReport(conn, reportId)).rejects.toThrow(
        UNPUBLISHED_VERSION
      );
    });
  });

  test("refuses when one of several referenced layers has an unpublished version", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      await clearSession(conn);
      const ebsa = await createReportingLayer(conn, projectId, "EBSAs");
      const seamounts = await createReportingLayer(conn, projectId, "Seamounts");
      const reportId = await createDraftReport(conn, projectId, [
        ebsa.stableId,
        seamounts.stableId,
      ]);
      await publishLayerList(conn, projectId, adminId);
      await publishReport(conn, reportId);

      await uploadNewVersion(conn, projectId, ebsa);
      await expect(publishReport(conn, reportId)).rejects.toThrow(
        UNPUBLISHED_VERSION
      );
    });
  });

  test("publishes once the layer list carrying the new version is published", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      await clearSession(conn);
      const ebsa = await createReportingLayer(conn, projectId, "EBSAs");
      const reportId = await createDraftReport(conn, projectId, [ebsa.stableId]);
      await publishLayerList(conn, projectId, adminId);
      await publishReport(conn, reportId);

      const newSourceId = await uploadNewVersion(conn, projectId, ebsa);
      await publishLayerList(conn, projectId, adminId);
      await publishReport(conn, reportId);

      const versions = await conn.manyFirst(
        sql`select version from reports where draft_id = ${reportId} order by version`
      );
      expect(versions).toEqual([1, 2]);
      const publishedUrl = await conn.oneFirst(
        sql`select ds.url
            from table_of_contents_items i
            join data_layers l on l.id = i.data_layer_id
            join data_sources ds on ds.id = l.data_source_id
            where i.stable_id = ${ebsa.stableId} and not i.is_draft`
      );
      const newUrl = await conn.oneFirst(
        sql`select url from data_sources where id = ${newSourceId}`
      );
      expect(publishedUrl).toBe(newUrl);
    });
  });
});
