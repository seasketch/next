import { Helpers } from "graphile-worker";
import S3 from "aws-sdk/clients/s3";
import {
  ProcessedUploadResponse,
  SpatialUploadsHandlerRequest,
} from "spatial-uploads-handler";
import AWS from "aws-sdk";
const s3 = new S3();

/**
 * graphile-worker task which fires off requests for spatial data upload
 * processing. On production this happens via lambda, in development a local
 * version of the lambda can be run if process.env.DEV_UPLOAD_HANDLER is set.
 * @param payload
 * @param helpers
 */
export default async function processDataUpload(
  payload: { jobId: string; enableAiDataAnalyst?: boolean },
  helpers: Helpers,
) {
  const { jobId, enableAiDataAnalyst = false } = payload;
  helpers.logger.info(`Handling spatial data upload: ${jobId}`);
  await helpers.withPgClient(async (client) => {
    const results = await client.query(
      `update project_background_jobs set progress_message = 'processing', state = 'running', started_at = now() where id = $1 returning *`,
      [jobId],
    );
    const job = results.rows[0];
    const q = await client.query(
      `
      select
        id || '/' || filename as object_key
      from
        data_upload_tasks
      where
        project_background_job_id = $1
      limit 1
    `,
      [jobId],
    );
    if (!q.rows[0]) {
      throw new Error("Could not find objectKey for job with ID=" + jobId);
    }
    const objectKey = q.rows[0].object_key;
    if (!job) {
      throw new Error("Could not find job with ID=" + job.id);
    }
    const projectId = job.project_id;
    const slugResults = await client.query(
      `select slug from projects where id = $1`,
      [projectId],
    );

    const userResults = await client.query(
      `
      select users.canonical_email, user_profiles.fullname, user_profiles.email from users inner join user_profiles on user_profiles.user_id = users.id where users.id = $1
    `,
      [results.rows[0].user_id],
    );

    const slug = slugResults.rows[0].slug;
    const user: {
      canonical_email: string;
      fullname?: string | null;
      email?: string | null;
    } = userResults.rows[0];

    // Fire off request to lambda (or local http server if in development)
    try {
      await runLambda({
        taskId: jobId,
        objectKey,
        suffix: slug,
        enableAiDataAnalyst,
        requestingUser: user.fullname
          ? `${user.fullname} <${user.email || user.canonical_email}>`
          : user.email || user.canonical_email,
      });
    } catch (e) {
      console.error("error!!", e);
      if (process.env.SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER) {
        await client.query(
          `update project_background_jobs set state = 'failed', error_message = $2, progress_message = 'failed' where id = $1`,
          [jobId, (e as Error).message],
        );
      } else {
        await client.query(
          `update project_background_tasks set state = 'failed', progress_message = 'failed', error_message = 'Lambda invocation failure' where id = $1`,
          [jobId],
        );
      }
    }
  });
}

const client = new AWS.Lambda({
  region: process.env.AWS_REGION || "us-west-2",
  httpOptions: {
    timeout: 60000 * 5.5,
  },
});

/** Handler JSON can include `error` (e.g. missing GEOSTATS_PII_CLASSIFIER_ARN); treat as failure. */
function assertNoHandlerError(
  data: ProcessedUploadResponse & { error?: string; log?: string },
): asserts data is ProcessedUploadResponse {
  if (data.error) {
    throw new Error(data.error);
  }
}

function formatDevHandlerFetchError(err: unknown, url: string): Error {
  if (err instanceof TypeError && err.message === "fetch failed") {
    const cause = (err as Error & { cause?: unknown }).cause;
    let detail = "";
    if (cause instanceof Error) {
      detail = cause.message;
    } else if (
      cause &&
      typeof cause === "object" &&
      "code" in cause &&
      (cause as { code?: string }).code
    ) {
      detail = (cause as { code: string }).code;
    } else if (cause !== undefined) {
      detail = String(cause);
    }
    return new Error(
      `Could not reach spatial uploads dev handler (${url}). ${detail || "Network error"}. Is the handler running and is SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER correct?`,
    );
  }
  return err instanceof Error ? err : new Error(String(err));
}

export async function runLambda(event: SpatialUploadsHandlerRequest) {
  if (process.env.SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER) {
    const url = process.env.SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER;
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        body: JSON.stringify(event),
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      throw formatDevHandlerFetchError(e, url);
    }
    const text = await response.text();
    if (text.length === 0) {
      throw new Error(
        "Lambda invocation failed. Could be due to attempting to run multiple simultaneous tasks with dev container.",
      );
    }
    let data: ProcessedUploadResponse & { error?: string };
    try {
      data = JSON.parse(text) as ProcessedUploadResponse & { error?: string };
    } catch {
      throw new Error(
        `Spatial uploads dev handler returned non-JSON (HTTP ${response.status}): ${text.slice(0, 500)}`,
      );
    }
    if (!response.ok) {
      throw new Error(
        data.error ||
          `Spatial uploads dev handler HTTP ${response.status}: ${text.slice(0, 500)}`,
      );
    }
    assertNoHandlerError(data);
    return data;
  } else if (process.env.SPATIAL_UPLOADS_LAMBDA_ARN) {
    await client
      .invoke({
        InvocationType: "Event",
        FunctionName: process.env.SPATIAL_UPLOADS_LAMBDA_ARN,
        Payload: JSON.stringify({
          ...event,
          skipLoggingProgress:
            process.env.PGHOST && /rds.amazonaws.com/.test(process.env.PGHOST)
              ? false
              : true,
        }),
      })
      .promise();
  } else {
    throw new Error(
      `Neither SPATIAL_UPLOADS_LAMBDA_ARN or SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER are defined`,
    );
  }
}
