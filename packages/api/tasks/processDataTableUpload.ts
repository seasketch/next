import { Helpers } from "graphile-worker";
import AWS from "aws-sdk";
import { extractHostedTilesUuid } from "../src/tilesAcl/writeProjectAclDoc";

interface DataTablesHandlerRequest {
  taskId: string;
  uploadId: string;
  objectKey: string;
  suffix: string;
  sourceUuid: string;
  skipLoggingProgress?: boolean;
}

const client = new AWS.Lambda({
  region: process.env.AWS_REGION || "us-west-2",
  httpOptions: { timeout: 60000 * 5.5 },
});

export async function runDataTablesLambda(event: DataTablesHandlerRequest) {
  if (process.env.DATA_TABLES_LAMBDA_DEV_HANDLER) {
    const url = process.env.DATA_TABLES_LAMBDA_DEV_HANDLER;
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(event),
      headers: { "Content-Type": "application/json" },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `Data tables dev handler HTTP ${response.status}: ${text.slice(0, 500)}`,
      );
    }
    return JSON.parse(text);
  }
  if (process.env.DATA_TABLES_HANDLER_LAMBDA_ARN) {
    await client
      .invoke({
        InvocationType: "Event",
        FunctionName: process.env.DATA_TABLES_HANDLER_LAMBDA_ARN,
        Payload: JSON.stringify({
          ...event,
          skipLoggingProgress:
            process.env.PGHOST && /rds.amazonaws.com/.test(process.env.PGHOST)
              ? false
              : true,
        }),
      })
      .promise();
    return;
  }
  throw new Error(
    "Neither DATA_TABLES_HANDLER_LAMBDA_ARN nor DATA_TABLES_LAMBDA_DEV_HANDLER are defined. " +
      "For local dev, run `npm run dev` in packages/data-tables-handler and set " +
      "DATA_TABLES_LAMBDA_DEV_HANDLER=http://localhost:3006 on the API server.",
  );
}

export default async function processDataTableUpload(
  payload: { jobId: string },
  helpers: Helpers,
) {
  const { jobId } = payload;
  helpers.logger.info(`Handling data table upload: ${jobId}`);
  await helpers.withPgClient(async (client) => {
    await client.query(
      `update project_background_jobs set progress_message = 'processing', state = 'running', started_at = now(), timeout_at = timezone('utc', now()) + interval '60 seconds' where id = $1`,
      [jobId],
    );
    const q = await client.query(
      `select
        odtu.id as upload_id,
        odtu.id || '/' || odtu.filename as object_key,
        p.slug,
        ds.url as data_source_url
      from overlay_data_table_uploads odtu
      join project_background_jobs pbj on pbj.id = odtu.project_background_job_id
      join projects p on p.id = pbj.project_id
      join table_of_contents_items toc on toc.id = odtu.table_of_contents_item_id
      join data_layers dl on dl.id = toc.data_layer_id
      join data_sources ds on ds.id = dl.data_source_id
      where odtu.project_background_job_id = $1
      limit 1`,
      [jobId],
    );
    if (!q.rows[0]) {
      throw new Error("Could not find upload for job " + jobId);
    }
    const sourceUuid = extractHostedTilesUuid(q.rows[0].data_source_url);
    if (!sourceUuid) {
      const message =
        "Parent layer has no hosted tiles UUID; data tables must be stored under the layer path for ACL";
      await client.query(`select fail_overlay_data_table_upload($1, $2)`, [
        jobId,
        message,
      ]);
      throw new Error(message);
    }
    try {
      await runDataTablesLambda({
        taskId: jobId,
        uploadId: q.rows[0].upload_id,
        objectKey: q.rows[0].object_key,
        suffix: q.rows[0].slug,
        sourceUuid,
      });
    } catch (e) {
      if (process.env.DATA_TABLES_LAMBDA_DEV_HANDLER) {
        await client.query(`select fail_overlay_data_table_upload($1, $2)`, [
          jobId,
          (e as Error).message,
        ]);
      } else {
        await client.query(`select fail_overlay_data_table_upload($1, $2)`, [
          jobId,
          "Lambda invocation failure",
        ]);
      }
    }
  });
}
