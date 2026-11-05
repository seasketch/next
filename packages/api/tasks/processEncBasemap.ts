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

/** The basemap description names this many cells. The catalog keeps all of them. */
const LISTED_CELLS = 30;

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
  let archivePaths: string[] = [];
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
    // A national chart takes hours. While the build is alive, keep pushing the
    // timeout out so the cleanup task does not fail a job that is still working.
    let stage = "reading charts";
    const heartbeat = () =>
      helpers
        .withPgClient((client) =>
          client.query(
            `update project_background_jobs
             set progress_message = $2,
                 timeout_at = timezone('utc', now()) + interval '20 minutes'
             where id = $1 and state = 'running'`,
            [jobId, stage.slice(0, 200)]
          )
        )
        .catch((error: unknown) => {
          helpers.logger.warn(
            `ENC job ${jobId} heartbeat failed: ${error instanceof Error ? error.message : String(error)}`
          );
        });
    const beating = setInterval(heartbeat, 60_000);
    let processed: Awaited<ReturnType<typeof processEncFiles>>;
    try {
      processed = await processEncFiles(inputs, {
        onProgress: (message) => {
          stage = message;
        },
      });
    } finally {
      clearInterval(beating);
    }
    archivePaths = processed.archives.map((archive) => archive.pmtilesPath);

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
    // One hosted archive per chart scale. The style overzooms each past its
    // maxzoom. `url` names the largest-scale archive for clients that read one.
    const sources: Array<{ id: string; url: string; maxzoom: number }> = [];
    for (const archive of processed.archives) {
      const tileId = uuid();
      await s3
        .upload({
          Bucket: tilesBucket,
          Key: `projects/${slug}/public/${tileId}.pmtiles`,
          Body: createReadStream(archive.pmtilesPath),
          ContentType: "application/octet-stream",
        })
        .promise();
      sources.push({
        id: archive.source,
        url: `${tilesBase}/projects/${slug}/public/${tileId}`,
        maxzoom: archive.maxzoom,
      });
    }
    if (sources.length === 0) throw new Error("The chart build produced no tile archives");
    const url = sources[sources.length - 1].url;
    const names = processed.cells.map((cell) => cell.cell);
    const cellList =
      names.length > LISTED_CELLS
        ? `${names.slice(0, LISTED_CELLS).join(", ")} and ${names.length - LISTED_CELLS} more cells`
        : names.join(", ");
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
         values ($1, $2::jsonb, 2, $3::jsonb, $4)`,
        [basemapId, JSON.stringify({ sources }), JSON.stringify(processed.cells), processed.bounds]
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
    const hosted = sources.map((source) => extractHostedTilesUuid(source.url)).join(", ");
    helpers.logger.info(
      `ENC basemap ${basemapId} (${hosted}) from ${processed.featureCount} features in ${processed.cells.length} cells`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    helpers.logger.error(`ENC job ${jobId} failed: ${message}`);
    await fail(helpers, jobId, message);
  } finally {
    await rm(work, { recursive: true, force: true });
    for (const archive of archivePaths) await rm(archive, { force: true });
  }
}
