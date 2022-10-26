import { Helpers } from "graphile-worker";
import S3 from "aws-sdk/clients/s3";
import { UPLOAD_TASK_PRESIGNED_URL_TTL } from "../src/plugins/dataUploadTaskPlugin";
import { ResponseOutput } from "spatial-uploads-handler";

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
      );
    `);
    if (results.rowCount > 0) {
      helpers.logger.info(`Deleted ${results.rows.length} unused data_sources`);
    }

    results = await client.query(`
      select id, outputs from data_upload_tasks where not exists (
        select id from data_sources where upload_task_id = data_upload_tasks.id
      ) and state = 'complete'
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
              await deleteRemote(output.remote);
            }
          }
        }
      }
      await client.query(`delete from data_upload_tasks where id = $1`, [
        row.id,
      ]);
    }

    // TODO: delete old deleted_data_layers and replace with table that just
    // stores geojson objectId and bucket when no upload is associated with a
    // deleted data_source (esri imports)

    const data = await client.query(
      `select deleted_geojson_objects.id, deleted_geojson_objects.object_key, data_sources_buckets.bucket as bucket from deleted_geojson_objects inner join data_sources_buckets on data_sources_buckets.url = deleted_geojson_objects.bucket`
    );

    if (data.rowCount > 0) {
      helpers.logger.info(
        `Deleting ${data.rowCount} imported geojson assets that are no longer being used.`
      );
      for (const record of data.rows) {
        await deleteRemote(`s3://${record.bucket}/${record.object_key}`);
        await client.query(
          `delete from deleted_geojson_objects where id = $1`,
          [record.id]
        );
      }
    }
  });
}

async function deleteRemote(remote: string) {
  console.log(`delete ${remote}`);
  // return;
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
