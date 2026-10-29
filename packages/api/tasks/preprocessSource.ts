import { Helpers } from "graphile-worker";
import AWS from "aws-sdk";
import { v4 as uuid } from "uuid";

const lambda = new AWS.Lambda({
  region: process.env.AWS_REGION || "us-west-2",
  httpOptions: {
    timeout: 30000,
  },
});

type SubdivisionPayload = {
  url: string;
  jobKey: string;
  key: string;
  queueUrl: string | undefined;
  repair_invalid: boolean;
};

/**
 * Same rule as the other handlers: a dev handler URL (the Lambda emulator
 * `npm run dev` starts) is used before the deployed function's ARN.
 */
function subdivisionTarget():
  | { devHandler: string }
  | { arn: string } {
  if (process.env.SUBDIVISION_WORKER_DEV_HANDLER) {
    return { devHandler: process.env.SUBDIVISION_WORKER_DEV_HANDLER };
  }
  if (process.env.SUBDIVISION_WORKER_LAMBDA_ARN) {
    return { arn: process.env.SUBDIVISION_WORKER_LAMBDA_ARN };
  }
  throw new Error(
    "Neither SUBDIVISION_WORKER_DEV_HANDLER nor SUBDIVISION_WORKER_LAMBDA_ARN is set",
  );
}

/**
 * Production invokes asynchronously and the worker reports through the
 * results queue. The emulator only answers when the handler returns, which
 * can take minutes, so the request is not awaited here either. Progress and
 * completion still arrive through the queue.
 */
async function invokeSubdivisionWorker(
  target: ReturnType<typeof subdivisionTarget>,
  payload: SubdivisionPayload,
) {
  if ("devHandler" in target) {
    const url = target.devHandler;
    void fetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    })
      .then(async (response) => {
        const text = await response.text();
        if (!response.ok) {
          console.error(
            `Subdivision dev handler HTTP ${response.status} for ${payload.jobKey}: ${text.slice(0, 500)}`,
          );
        }
      })
      .catch((e) => {
        console.error(
          `Could not reach subdivision dev handler (${url}) for ${payload.jobKey}. Is the subdivision container running?`,
          e,
        );
      });
    return;
  }
  await lambda
    .invoke({
      FunctionName: target.arn,
      InvocationType: "Event",
      Payload: JSON.stringify(payload),
    })
    .promise();
}

export default async function preprocessSource(
  payload: { jobKey: string; repairInvalid?: boolean },
  helpers: Helpers,
) {
  const { jobKey, repairInvalid } = payload;

  const target = subdivisionTarget();

  await helpers.withPgClient(async (client) => {
    const existingJobQ = await client.query(
      `select job_key, state, data_source_id from source_processing_jobs where job_key = $1`,
      [jobKey],
    );

    const existingJob = existingJobQ?.rows?.[0];

    if (!existingJob) {
      throw new Error(`Source processing job not found for jobKey: ${jobKey}`);
    } else if (existingJob.state !== "queued") {
      console.log(
        `Source processing job is already in progress for jobKey: ${jobKey}`,
      );
      return;
    }

    const dataSourceId = existingJob.data_source_id;

    const slugResults = await client.query(
      `select slug from projects where id = (select project_id from data_sources where id = $1)`,
      [dataSourceId],
    );
    const slug: string = slugResults.rows[0].slug;

    const typeResult = await client.query(
      `select type from data_sources where id = $1`,
      [dataSourceId],
    );
    const type: string = typeResult.rows[0].type;

    let sourceUrl: string | undefined;

    if (type === "seasketch-raster") {
      // Prefer the user's original GeoTIFF (native CRS). NetCDF uploads have no
      // GeoTIFF row with is_original; then use the earliest derivative GeoTIFF.
      const originalGeoTiff = await client.query<{
        url: string;
        epsg?: number;
      }>(
        `select url, epsg from data_upload_outputs
         where data_source_id = $1 and type = 'GeoTIFF' and is_original = true
         limit 1`,
        [dataSourceId],
      );
      if (originalGeoTiff.rows.length > 0) {
        console.log(
          `Using original GeoTIFF for source URL: ${originalGeoTiff.rows[0].url}, EPSG: ${originalGeoTiff.rows[0].epsg}`,
        );
        sourceUrl = originalGeoTiff.rows[0].url;
      } else {
        const fallbackGeoTiff = await client.query<{ url: string }>(
          `select url from data_upload_outputs
           where data_source_id = $1 and type = 'GeoTIFF'
           order by created_at asc
           limit 1`,
          [dataSourceId],
        );
        if (fallbackGeoTiff.rows.length > 0) {
          sourceUrl = fallbackGeoTiff.rows[0].url;
        }
      }
    } else {
      const sourceResult = await client.query<{ url: string }>(
        `
        select url
        from data_upload_outputs
        where data_source_id = $1
        order by case when type = 'FlatGeobuf' then 0 else 1 end
        limit 1
      `,
        [dataSourceId],
      );
      if (sourceResult.rows.length > 0) {
        sourceUrl = sourceResult.rows[0].url;
      }
    }

    if (!sourceUrl) {
      await client.query(
        `update source_processing_jobs set state = 'error', error_message = $2 where job_key = $1`,
        [
          jobKey,
          `Preprocess source URL not found for dataSourceId: ${dataSourceId}`,
        ],
      );
      await client.query(
        `update spatial_metrics set state = 'error', error_message = 'Source preprocessing failed.' where source_processing_job_dependency = $1`,
        [jobKey],
      );
      throw new Error(
        `Preprocess source URL not found for dataSourceId: ${dataSourceId}`,
      );
    }

    // Use appropriate extension based on data source type
    const extension = type === "seasketch-raster" ? ".tif" : ".fgb";
    const objectKey = `projects/${slug}/subdivided/${dataSourceId}-${uuid()}${extension}`;
    console.log("sourceUrl", sourceUrl);
    console.log("objectKey", objectKey);
    const payloadForLambda: SubdivisionPayload = {
      url: sourceUrl,
      jobKey,
      key: objectKey,
      queueUrl: process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL,
      repair_invalid: repairInvalid || false,
    };

    await invokeSubdivisionWorker(target, payloadForLambda);

    await client.query(
      `update source_processing_jobs set state = 'processing' where job_key = $1`,
      [jobKey],
    );
  });
}
