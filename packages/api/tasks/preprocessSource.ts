import { Helpers } from "graphile-worker";
import AWS from "aws-sdk";
import { v4 as uuid } from "uuid";

const lambda = new AWS.Lambda({
  region: process.env.AWS_REGION || "us-west-2",
  httpOptions: {
    timeout: 30000,
  },
});

export default async function preprocessSource(
  payload: { jobKey: string },
  helpers: Helpers
) {
  const { jobKey } = payload;

  if (!process.env.SUBDIVISION_WORKER_LAMBDA_ARN) {
    throw new Error("SUBDIVISION_WORKER_LAMBDA_ARN is not set");
  }

  const arn = process.env.SUBDIVISION_WORKER_LAMBDA_ARN;

  await helpers.withPgClient(async (client) => {
    const existingJobQ = await client.query(
      `select job_key, state, data_source_id from source_processing_jobs where job_key = $1`,
      [jobKey]
    );

    const existingJob = existingJobQ?.rows?.[0];

    if (!existingJob) {
      throw new Error(`Source processing job not found for jobKey: ${jobKey}`);
    } else if (existingJob.state !== "queued") {
      console.log(
        `Source processing job is already in progress for jobKey: ${jobKey}`
      );
      return;
    }

    const dataSourceId = existingJob.data_source_id;

    const slugResults = await client.query(
      `select slug from projects where id = (select project_id from data_sources where id = $1)`,
      [dataSourceId]
    );
    const slug: string = slugResults.rows[0].slug;

    // Determine the canonical source URL for this data source (prefer FlatGeobuf)
    const sourceResult = await client.query(
      `
        select url
        from data_upload_outputs
        where data_source_id = $1
        order by case when type = 'FlatGeobuf' then 0 else 1 end
        limit 1
      `,
      [dataSourceId]
    );

    if (sourceResult.rows.length === 0) {
      await client.query(
        `update source_processing_jobs set state = 'error', error_message = 'Canonical source URL not found for dataSourceId: ${dataSourceId}' where job_key = $1`,
        [jobKey]
      );
      await client.query(
        `update spatial_metrics set state = 'error', error_message = 'Source preprocessing failed.' where source_processing_job_dependency = $1`,
        [jobKey]
      );
      throw new Error(
        `Canonical source URL not found for dataSourceId: ${dataSourceId}`
      );
    }

    const sourceUrl: string = sourceResult.rows[0].url as string;

    const objectKey = `projects/${slug}/subdivided/${dataSourceId}-${uuid()}.fgb`;
    const payloadForLambda = {
      url: sourceUrl,
      jobKey,
      key: objectKey,
      queueUrl: process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL,
    };

    // Invoke subdivision worker lambda asynchronously
    await lambda
      .invoke({
        FunctionName: arn,
        InvocationType: "Event",
        Payload: JSON.stringify(payloadForLambda),
      })
      .promise();

    await client.query(
      `update source_processing_jobs set state = 'processing' where job_key = $1`,
      [jobKey]
    );
  });
}
