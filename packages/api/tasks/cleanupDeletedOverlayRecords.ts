import { Helpers } from "graphile-worker";
import S3 from "aws-sdk/clients/s3";
import { PoolClient } from "pg";

const s3 = new S3({
  region: process.env.AWS_REGION!,
});

const r2 = new S3({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  signatureVersion: "v4",
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
});

const REQUIRED_ENV_VARS = [
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "AWS_REGION",
];

/**
 * Deletes data_layers and data_sources when they are no longer referred to by
 * an active table_of_contents_item. Also deletes related uploads.
 *
 * When an upload is deleted from the database and there are no references to
 * it's outputs, it should be deleted from cloud storage to save on hosting
 * costs.
 *
 * Should be performed fairly frequently via cron, otherwise records could build
 * up and result in a lot of work to be performed.
 *
 * @param payload
 * @param helpers
 */
export default async function cleanupDeletedOverlayRecords(
  payload: {},
  helpers: Helpers
) {
  for (const envvar of REQUIRED_ENV_VARS) {
    if (!process.env[envvar]) {
      throw new Error(`Missing env var ${envvar}`);
    }
  }

  await helpers.withPgClient(async (client) => {
    let results = await client.query(`
      delete from data_layers where not exists (
        select id from table_of_contents_items where table_of_contents_items.data_layer_id = data_layers.id
      ) returning id;    
    `);
    if (results.rowCount > 0) {
      helpers.logger.info(`Deleted ${results.rows.length} unused data_layers`);
    }

    results = await client.query(`
      delete from data_sources where not exists (
        select id from data_layers where data_source_id = data_sources.id
      ) and not exists (
        select data_source_id from archived_data_sources where data_source_id = data_sources.id
      );
    `);
    if (results.rowCount > 0) {
      helpers.logger.info(`Deleted ${results.rows.length} unused data_sources`);
    }

    results = await client.query(`
      select 
        data_upload_tasks.id, 
        data_upload_tasks.outputs 
      from 
        data_upload_tasks 
      inner join
        project_background_jobs as job
      on
        job.id = data_upload_tasks.project_background_job_id
      where 
        not exists (
          select id from data_sources where upload_task_id = data_upload_tasks.id
        ) and 
        job.state = 'complete'
    `);

    if (results.rowCount > 0) {
      helpers.logger.info(
        `Deleting outputs related to ${results.rowCount} deleted records`
      );
    }

    for (const row of results.rows) {
      if (
        row.outputs &&
        "layers" in row.outputs &&
        Array.isArray(row.outputs.layers)
      ) {
        for (const layer of row.outputs.layers) {
          if ("outputs" in layer && Array.isArray(layer.outputs)) {
            for (const output of layer.outputs) {
              await deleteRemote(output.remote, client);
            }
          }
        }
      }
      await client.query(`delete from data_upload_tasks where id = $1`, [
        row.id,
      ]);
    }

    const data = await client.query(
      `select id, remote from deleted_data_upload_outputs order by deleted_at asc limit 20`
    );

    if (data.rowCount > 0) {
      helpers.logger.info(
        `Deleting ${data.rowCount} uploaded data ouputs that are no longer being used.`
      );
      for (const record of data.rows) {
        // First, check if there are any outputs still used which refer to the
        // same remote
        const { rowCount } = await client.query(
          `select id from data_upload_outputs where remote = $1`,
          [record.remote]
        );
        if (rowCount > 0) {
          helpers.logger.info(
            `Skipping deletion of ${record.remote} as it is still being used.`
          );
          await client.query(
            `delete from deleted_data_upload_outputs where id = $1`,
            [record.id]
          );
        } else {
          await deleteRemote(record.remote, client);
          helpers.logger.info(`Deleted ${record.remote}.`);
          await client.query(
            `delete from deleted_data_upload_outputs where id = $1`,
            [record.id]
          );
        }
      }
    }
  });
}

async function deleteRemote(remote: string, pool: PoolClient) {
  // before deleting a remote, make damn sure it's no longer referenced by
  // anything
  const { rowCount } = await pool.query(
    `select 1 from data_upload_outputs where remote = $1`,
    [remote]
  );
  if (rowCount > 0) {
    console.error(`Remote ${remote} is still being used.`);
    return;
  }
  const client = /s3:/.test(remote) ? s3 : r2;
  const parts = remote.split(/:\/*/)[1].split("/");
  const Bucket = parts[0];
  const Key = parts.slice(1).join("/");
  return await client
    .deleteObject({
      Bucket,
      Key,
    })
    .promise();
}
