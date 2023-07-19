import { Helpers } from "graphile-worker";
import S3 from "aws-sdk/clients/s3";
import {
  ProcessedUploadResponse,
  SpatialUploadsHandlerRequest,
} from "spatial-uploads-handler";
import { createDBRecordsForProcessedUpload } from "../src/spatialUploads";
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
  payload: { uploadId: string },
  helpers: Helpers
) {
  const { uploadId } = payload;
  helpers.logger.info(`Handling spatial data upload: ${uploadId}`);
  await helpers.withPgClient(async (client) => {
    const results = await client.query(
      `update data_upload_tasks set state = 'processing', started_at = now() where id = $1 returning *`,
      [uploadId]
    );
    const projectId = results.rows[0].project_id;
    const source_buckets = await client.query(
      `select bucket, url from data_sources_buckets where url = (select data_sources_bucket_id from projects where id = $1)`,
      [projectId]
    );
    const slugResults = await client.query(
      `select slug from projects where id = $1`,
      [projectId]
    );

    const userResults = await client.query(
      `
      select users.canonical_email, user_profiles.fullname, user_profiles.email from users inner join user_profiles on user_profiles.user_id = users.id where users.id = $1
    `,
      [results.rows[0].user_id]
    );

    const slug = slugResults.rows[0].slug;
    const filename = results.rows[0].filename;
    const user: {
      canonical_email: string;
      fullname?: string | null;
      email?: string | null;
    } = userResults.rows[0];

    // Fire off request to lambda (or local http server if in development)
    try {
      await runLambda({
        taskId: uploadId,
        objectKey: `${uploadId}/${filename}`,
        dataSourcesBucket: source_buckets.rows[0].bucket,
        dataSourcesUrl: source_buckets.rows[0].url,
        suffix: slug,
        requestingUser: user.fullname
          ? `${user.fullname} <${user.email || user.canonical_email}>`
          : user.email || user.canonical_email,
        // skipLoggingProgress: true,
      });

      // if (!data.error) {
      //   // Create layers
      //   for (const layer of data.layers) {
      //     const records = await createDBRecordsForProcessedUpload(
      //       layer,
      //       projectId,
      //       client,
      //       uploadId
      //     );
      //   }
      //   await client.query(
      //     `update data_upload_tasks set state = 'complete', outputs = $1 where id = $2`,
      //     [data, uploadId]
      //   );
      // } else {
      //   await client.query(
      //     `update data_upload_tasks set state = 'failed', error_message = $1 where id = $2`,
      //     [data.error, uploadId]
      //   );
      // }
    } catch (e) {
      console.error("error!!", e);
      if (process.env.SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER) {
        await client.query(
          `update data_upload_tasks set state = 'failed', error_message = $2 where id = $1`,
          [uploadId, (e as Error).message]
        );
      } else {
        await client.query(
          `update data_upload_tasks set state = 'failed', error_message = 'Lambda invocation failure' where id = $1`,
          [uploadId]
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

async function runLambda(
  event: SpatialUploadsHandlerRequest
): Promise<ProcessedUploadResponse> {
  if (process.env.SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER) {
    const response = await fetch(
      process.env.SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER,
      {
        method: "POST",
        body: JSON.stringify(event),
      }
    );
    const text = await response.text();
    if (text.length === 0) {
      throw new Error(
        "Lambda invocation failed. Could be due to attempting to run multiple simultaneous tasks with dev container."
      );
    }
    const data = JSON.parse(text) as ProcessedUploadResponse;
    return data;
  } else if (process.env.SPATIAL_UPLOADS_LAMBDA_ARN) {
    const response = await client
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
    if (!response.Payload) {
      console.error(
        `upload task invocation error (${event.taskId}): ${event.objectKey}`,
        response.Payload
      );
      console.log(event);
      console.log("lambda arn = ", process.env.SPATIAL_UPLOADS_LAMBDA_ARN);
      throw new Error("Lambda function invocation error");
    }
    if (typeof response.Payload === "string") {
      return JSON.parse(response.Payload) as ProcessedUploadResponse;
    } else {
      return response.Payload as ProcessedUploadResponse;
    }
  } else {
    throw new Error(
      `Neither SPATIAL_UPLOADS_LAMBDA_ARN or SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER are defined`
    );
  }
}
