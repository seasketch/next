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
  // Savepoint, so an expected refusal doesn't abort the test transaction.
  return conn.transaction((t) =>
    t.any(sql`select publish_report_snapshot(${reportId})`)
  );
}

/**
 * Points the draft layer at a new source that hasn't been preprocessed yet.
 * replace_data_source queues the job because a report card references the
 * layer.
 */
async function uploadVersionStillPreprocessing(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  layer: { layerId: number; stableId: string }
) {
  const key = id();
  const sourceId = (await conn.oneFirst(
    sql`insert into data_sources (project_id, type, url, import_type, byte_length)
        values (${projectId}, 'seasketch-vector', ${`https://uploads.example.test/${key}.geojson.json`}, 'upload', 12)
        returning id`
  )) as number;
  await conn.any(
    sql`select replace_data_source(${layer.layerId}, ${sourceId}, null, null, null, ${layer.stableId})`
  );
  const jobKey = (await conn.oneFirst(
    sql`select job_key from source_processing_jobs where data_source_id = ${sourceId}`
  )) as string;
  return { sourceId, jobKey, key };
}

/** What JobStatusUpdater writes when the subdivision worker finishes. */
async function completePreprocessing(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  job: { sourceId: number; jobKey: string; key: string }
) {
  const url = `https://uploads.example.test/subdivided/${job.key}.fgb`;
  await conn.any(
    sql`insert into data_upload_outputs (
          data_source_id, project_id, type, url, remote, size, filename, source_processing_job_key
        ) values (
          ${job.sourceId}, ${projectId}, 'ReportingFlatgeobufV1', ${url},
          ${`r2://bucket/subdivided/${job.key}.fgb`}, 12, ${`${job.key}.fgb`}, ${job.jobKey}
        )`
  );
  await conn.any(
    sql`update source_processing_jobs
        set state = 'complete', completed_at = now(), progress_percentage = 100
        where job_key = ${job.jobKey}`
  );
  return url;
}

function publishedRefs(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  stableId: string
) {
  return conn.one<{ source_url: string | null; source_processing_job_id: string | null }>(
    sql`select source_url, source_processing_job_id
        from report_overlay_source_refs_by_stable_ids(${projectId}, ${sql.array(
          [stableId],
          "text"
        )}, false)`
  );
}

async function publishedReportingOutputUrl(
  conn: DatabaseTransactionConnectionType,
  stableId: string
) {
  return conn.maybeOneFirst(
    sql`select (table_of_contents_items_reporting_output(i.*)).url
        from table_of_contents_items i
        where i.stable_id = ${stableId} and not i.is_draft`
  );
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

describe("publishing while a new layer version is still preprocessing", () => {
  test("published reports wait on the draft's preprocessing job", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      await clearSession(conn);
      const ebsa = await createReportingLayer(conn, projectId, "EBSAs");
      const reportId = await createDraftReport(conn, projectId, [ebsa.stableId]);
      await publishLayerList(conn, projectId, adminId);
      await publishReport(conn, reportId);

      const job = await uploadVersionStillPreprocessing(conn, projectId, ebsa);
      await publishLayerList(conn, projectId, adminId);

      expect(await publishedReportingOutputUrl(conn, ebsa.stableId)).toBeNull();
      expect(await publishedRefs(conn, projectId, ebsa.stableId)).toEqual({
        source_url: null,
        source_processing_job_id: job.jobKey,
      });
    });
  });

  test("the report can be published before preprocessing finishes", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      await clearSession(conn);
      const ebsa = await createReportingLayer(conn, projectId, "EBSAs");
      const reportId = await createDraftReport(conn, projectId, [ebsa.stableId]);
      await publishLayerList(conn, projectId, adminId);
      await publishReport(conn, reportId);

      await uploadVersionStillPreprocessing(conn, projectId, ebsa);
      await publishLayerList(conn, projectId, adminId);
      await publishReport(conn, reportId);

      const versions = await conn.manyFirst(
        sql`select version from reports where draft_id = ${reportId} order by version`
      );
      expect(versions).toEqual([1, 2]);
    });
  });

  test("published copies receive the reporting output when preprocessing completes", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      await clearSession(conn);
      const ebsa = await createReportingLayer(conn, projectId, "EBSAs");
      const reportId = await createDraftReport(conn, projectId, [ebsa.stableId]);
      await publishLayerList(conn, projectId, adminId);
      await publishReport(conn, reportId);

      const job = await uploadVersionStillPreprocessing(conn, projectId, ebsa);
      await publishLayerList(conn, projectId, adminId);
      await publishReport(conn, reportId);
      const outputUrl = await completePreprocessing(conn, projectId, job);

      expect(await publishedReportingOutputUrl(conn, ebsa.stableId)).toBe(outputUrl);
      expect(await publishedRefs(conn, projectId, ebsa.stableId)).toEqual({
        source_url: outputUrl,
        source_processing_job_id: job.jobKey,
      });
      const copies = await conn.oneFirst(
        sql`select count(*) from data_upload_outputs
            where url = ${outputUrl} and data_source_id <> ${job.sourceId}`
      );
      expect(copies).toBe(1);
    });
  });

  test("completion leaves sources that aren't published copies alone", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      await clearSession(conn);
      const ebsa = await createReportingLayer(conn, projectId, "EBSAs");
      await createDraftReport(conn, projectId, [ebsa.stableId]);
      await publishLayerList(conn, projectId, adminId);

      const job = await uploadVersionStillPreprocessing(conn, projectId, ebsa);
      const outputUrl = await completePreprocessing(conn, projectId, job);

      const outputs = await conn.manyFirst(
        sql`select data_source_id from data_upload_outputs where url = ${outputUrl}`
      );
      expect(outputs).toEqual([job.sourceId]);
    });
  });

  test("published copies missing an output resolve the draft's finished output", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      await clearSession(conn);
      const ebsa = await createReportingLayer(conn, projectId, "EBSAs");
      await createDraftReport(conn, projectId, [ebsa.stableId]);
      const job = await uploadVersionStillPreprocessing(conn, projectId, ebsa);
      await publishLayerList(conn, projectId, adminId);
      const outputUrl = await completePreprocessing(conn, projectId, job);
      // Copies published before the propagation on completion existed.
      await conn.any(
        sql`delete from data_upload_outputs
            where url = ${outputUrl} and data_source_id <> ${job.sourceId}`
      );

      expect(await publishedRefs(conn, projectId, ebsa.stableId)).toEqual({
        source_url: outputUrl,
        source_processing_job_id: job.jobKey,
      });
    });
  });

  test("queues preprocessing for a referenced layer that never had a job", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      await clearSession(conn);
      const ebsa = await createReportingLayer(conn, projectId, "EBSAs");
      const reportId = await createDraftReport(conn, projectId, [ebsa.stableId]);
      const sourceId = (await conn.oneFirst(
        sql`select data_source_id from data_layers where id = ${ebsa.layerId}`
      )) as number;
      await conn.any(sql`delete from source_processing_jobs where data_source_id = ${sourceId}`);
      await publishLayerList(conn, projectId, adminId);

      await publishReport(conn, reportId);

      const job = await conn.one<{ state: string; queued: boolean }>(
        sql`select spj.state, exists (
              select 1 from graphile_worker.jobs gj
              where gj.task_identifier = 'preprocessSource'
                and gj.payload->>'jobKey' = spj.job_key
            ) as queued
            from source_processing_jobs spj
            where spj.data_source_id = ${sourceId}`
      );
      expect(job).toEqual({ state: "queued", queued: true });
    });
  });

  test("refuses when preprocessing failed", async () => {
    await projectTransaction(pool, "public", async (conn, projectId, adminId) => {
      await clearSession(conn);
      const ebsa = await createReportingLayer(conn, projectId, "EBSAs");
      const reportId = await createDraftReport(conn, projectId, [ebsa.stableId]);
      await publishLayerList(conn, projectId, adminId);
      await publishReport(conn, reportId);

      const job = await uploadVersionStillPreprocessing(conn, projectId, ebsa);
      await conn.any(
        sql`update source_processing_jobs set state = 'error', error_message = 'boom'
            where job_key = ${job.jobKey}`
      );
      await publishLayerList(conn, projectId, adminId);

      await expect(publishReport(conn, reportId)).rejects.toThrow(
        /failed processing for reporting/
      );
      expect(await publishedRefs(conn, projectId, ebsa.stableId)).toEqual({
        source_url: null,
        source_processing_job_id: job.jobKey,
      });
    });
  });
});
