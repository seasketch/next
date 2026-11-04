import { createReadStream } from "fs";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { Helpers } from "graphile-worker";
import { v4 as uuid } from "uuid";
import { storageClientV2 } from "../src/storage/client";
import { processEncFiles } from "../src/enc/processEnc";
import { ENC_MAX_ZOOM } from "../src/enc/layers";
import {
  extractHostedTilesUuid,
  writeProjectAclDocToR2,
} from "../src/tilesAcl/writeProjectAclDoc";

const THUMBNAIL =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect fill="#c5e8f7" width="240" height="240"/><path fill="#efe4c6" d="M0 150 L70 110 L130 160 L240 100 L240 240 L0 240 Z"/><circle cx="168" cy="78" r="6" fill="#e6a817"/><text x="16" y="36" font-family="sans-serif" font-size="20" fill="#16324a">ENC</text></svg>'
  );

async function fail(helpers: Helpers, jobId: string, message: string) {
  await helpers.withPgClient((client) =>
    client.query(
      `update project_background_jobs
       set state = 'failed', error_message = $2, progress_message = 'failed'
       where id = $1 and state <> 'complete'`,
      [jobId, message.slice(0, 2000)]
    )
  );
}

/**
 * Build one public ENC basemap from the S-57 files uploaded for this job.
 * Runs in the API worker with GDAL and tippecanoe on PATH. The spatial
 * uploads container does not host this yet.
 */
export default async function processEncBasemap(
  payload: { jobId?: string },
  helpers: Helpers
) {
  const jobId = payload?.jobId;
  if (!jobId) throw new Error("processEncBasemap requires jobId");
  const uploadsBucket = process.env.SPATIAL_UPLOADS_BUCKET;
  const tilesBucket = process.env.R2_TILES_BUCKET;
  const tilesBase = process.env.TILES_BASE_URL?.replace(/\/$/, "");
  if (!uploadsBucket || !tilesBucket || !tilesBase) {
    await fail(
      helpers,
      jobId,
      "ENC processing needs SPATIAL_UPLOADS_BUCKET, R2_TILES_BUCKET, and TILES_BASE_URL"
    );
    return;
  }

  const work = await mkdtemp(path.join(tmpdir(), "enc-job-"));
  let pmtilesPath: string | null = null;
  try {
    const { rows } = await helpers.withPgClient((client) =>
      client.query(
        `update project_background_jobs
         set state = 'running', started_at = now(), progress = 0.05,
             progress_message = 'downloading',
             timeout_at = timezone('utc', now()) + interval '20 minutes'
         where id = $1
         returning project_id`,
        [jobId]
      )
    );
    if (rows.length === 0) throw new Error(`No background job ${jobId}`);
    const projectId = rows[0].project_id as number;
    const upload = await helpers.withPgClient((client) =>
      client.query(
        `select name, object_keys from enc_basemap_uploads where job_id = $1`,
        [jobId]
      )
    );
    if (upload.rows.length === 0) throw new Error("No ENC upload is attached to this job");
    const name = upload.rows[0].name as string;
    const keys = upload.rows[0].object_keys as string[];
    const s3 = storageClientV2();
    const inputs: string[] = [];
    for (const key of keys) {
      const object = await s3.getObject({ Bucket: uploadsBucket, Key: key }).promise();
      const body = object.Body;
      if (!body) throw new Error(`Upload ${key} was empty`);
      const filename = path.basename(key);
      const local = path.join(work, filename);
      await writeFile(local, body as Buffer);
      inputs.push(local);
    }

    await helpers.withPgClient((client) =>
      client.query(
        `update project_background_jobs set progress = 0.2, progress_message = 'reading charts' where id = $1`,
        [jobId]
      )
    );
    const processed = await processEncFiles(inputs);
    pmtilesPath = processed.pmtilesPath;

    await helpers.withPgClient((client) =>
      client.query(
        `update project_background_jobs set progress = 0.8, progress_message = 'publishing' where id = $1`,
        [jobId]
      )
    );
    const slugRow = await helpers.withPgClient((client) =>
      client.query(`select slug from projects where id = $1`, [projectId])
    );
    const slug = slugRow.rows[0].slug as string;
    const tileId = uuid();
    const objectKey = `projects/${slug}/public/${tileId}.pmtiles`;
    await s3
      .upload({
        Bucket: tilesBucket,
        Key: objectKey,
        Body: createReadStream(pmtilesPath),
        ContentType: "application/octet-stream",
      })
      .promise();
    const url = `${tilesBase}/projects/${slug}/public/${tileId}`;
    const cellList = processed.cells.map((cell) => cell.cell).join(", ");
    const description = `${cellList}. Not for navigation.`;

    const basemap = await helpers.withPgClient((client) =>
      client.query(
        `insert into basemaps (
           project_id, name, type, url, thumbnail, attribution, labels_layer_id,
           description, maxzoom
         ) values (
           $1, $2, 'ENC', $3, $4, $5, 'enc-sounding-label', $6, ${ENC_MAX_ZOOM}
         ) returning id`,
        [
          projectId,
          name,
          url,
          THUMBNAIL,
          "Not for navigation.",
          description,
        ]
      )
    );
    const basemapId = basemap.rows[0].id as number;
    await helpers.withPgClient((client) =>
      client.query(
        `insert into enc_basemaps (basemap_id, settings, schema_version, catalog, bounds)
         values ($1, '{}'::jsonb, 1, $2::jsonb, $3)`,
        [basemapId, JSON.stringify(processed.cells), processed.bounds]
      )
    );
    await helpers.withPgClient((client) =>
      client.query(`update enc_basemap_uploads set basemap_id = $2 where job_id = $1`, [
        jobId,
        basemapId,
      ])
    );
    await helpers.withPgClient((client) =>
      client.query(
        `update project_background_jobs
         set state = 'complete', progress = 1, progress_message = 'complete'
         where id = $1`,
        [jobId]
      )
    );

    try {
      await helpers.withPgClient((client) => writeProjectAclDocToR2(client, projectId));
    } catch (error) {
      helpers.logger.warn(
        `ENC basemap ${basemapId} is public, but the ACL document was not rewritten: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    const hosted = extractHostedTilesUuid(url);
    helpers.logger.info(
      `ENC basemap ${basemapId} (${hosted}) from ${processed.featureCount} features in ${processed.cells.length} cells`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    helpers.logger.error(`ENC job ${jobId} failed: ${message}`);
    await fail(helpers, jobId, message);
  } finally {
    await rm(work, { recursive: true, force: true });
    if (pmtilesPath) await rm(pmtilesPath, { force: true });
  }
}
