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
  payload: { dataSourceId: number },
  helpers: Helpers
) {
  const { dataSourceId } = payload;

  if (!process.env.SUBDIVISION_WORKER_LAMBDA_ARN) {
    throw new Error("SUBDIVISION_WORKER_LAMBDA_ARN is not set");
  }

  const arn = process.env.SUBDIVISION_WORKER_LAMBDA_ARN;

  await helpers.withPgClient(async (client) => {
    const existingJob = await client.query(
      `select job_key, state from source_processing_jobs where data_source_id = $1`,
      [dataSourceId]
    );

    if (existingJob.rows.length > 0) {
      const state: string = existingJob.rows[0].state;
      if (state === "queued" || state === "running" || state === "complete") {
        // Job already in progress or finished; nothing to do
        return;
      }
      if (state === "error") {
        await client.query(
          `delete from source_processing_jobs where data_source_id = $1`,
          [dataSourceId]
        );
      }
    }

    // Create a new source processing job
    const result = await client.query(
      `insert into source_processing_jobs (data_source_id, project_id) values ($1, (select project_id from data_sources where id = $1)) returning *`,
      [dataSourceId]
    );

    const jobKey: string = result.rows[0].job_key;

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
  });
}
