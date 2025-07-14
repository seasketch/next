import { PoolClient } from "pg";
import { S3 } from "aws-sdk";
import { v4 as uuid } from "uuid";
import { JobHelpers } from "graphile-worker";
import { runLambda } from "../../tasks/processDataUpload";
import tmp from "tmp";
import fs from "fs";

const region = process.env.S3_REGION;
const bucket = process.env.SPATIAL_UPLOADS_BUCKET;
const s3 = new S3({ region });

export async function createSourceReplacementJob(
  filename: string,
  contentType: string,
  itemId: number,
  client: PoolClient,
  metadata: any = {},
  timeoutInterval = "15 minutes"
) {
  const r0 = await client.query(
    `select id from projects where slug = 'superuser'`
  );
  if (r0.rows.length === 0) {
    throw new Error("superuser project not found");
  }
  const projectId = r0.rows[0].id;
  // create the data upload job by calling create_data_upload stored procedure
  const r1 = await client.query(
    `
    insert into project_background_jobs (
      project_id, 
      title, 
      user_id, 
      type,
      timeout_at
    ) values (
      $1, 
      'Updating NOAA Coral Reef Watch Data Library template', 
      (select id from users where sub = 'data-library-template-updater'), 
      'data_upload',
      timezone('utc'::text, now()) + interval '${timeoutInterval}'
    )
    returning *
    `,
    [projectId]
  );
  if (r1.rows.length === 0) {
    throw new Error("Failed to create project_background_job");
  }
  const jobId = r1.rows[0].id;
  await client.query(
    `
    insert into data_upload_tasks(
      filename, 
      content_type, 
      project_background_job_id,
      replace_table_of_contents_item_id,
      data_library_metadata
    ) values (
      $1, 
      $2, 
      $3,
      $4,
      $5
    ) returning *
    `,
    [filename, contentType, jobId, itemId, metadata]
  );
  return jobId;
}

export async function getTemplateDetails<T>(
  templateId: string,
  client: PoolClient
): Promise<{
  itemId: number;
  dataSourceId: number;
  metadata?: T;
}> {
  const r0 = await client.query(`
    select
      id,
      data_layer_id
    from
      table_of_contents_items
    where
      is_draft = true and
      data_library_template_id = '${templateId}' and
      project_id = (select id from projects where slug = 'superuser')
  `);
  if (r0.rows.length === 0) {
    throw new Error("Data layer not found (" + templateId + ")");
  }
  const itemId = r0.rows[0].id as number;
  const dataLayerId = r0.rows[0].data_layer_id as number;
  const r1 = await client.query(
    `
    select
      data_source_id
    from
      data_layers
    where
      id = $1
  `,
    [dataLayerId]
  );
  if (r1.rows.length === 0) {
    throw new Error(`Data source not found (${templateId})`);
  }
  const { data_source_id } = r1.rows[0];
  const r2 = await client.query(
    `
    select
      data_library_metadata
    from
      data_sources
    where
      id = $1
  `,
    [data_source_id]
  );
  const metadata = r2.rows[0].data_library_metadata;
  return {
    itemId,
    dataSourceId: parseInt(data_source_id),
    metadata,
  };
}

export async function updateSourceWithGeoJSON(
  data: any,
  itemId: number,
  templateId: string,
  client: PoolClient,
  helpers: JobHelpers,
  metadata: any = {}
) {
  const geojsonStr = JSON.stringify(data);
  const key = `${templateId}/${uuid()}.geojson`;
  const jobId = await createSourceReplacementJob(
    templateId + ".geojson",
    "application/json",
    itemId,
    client,
    metadata
  );
  helpers.logger.info(`Uploading ${key} to S3`);
  await s3
    .putObject({
      Bucket: bucket,
      Key: key,
      Body: geojsonStr,
      ContentType: "application/json",
    })
    .promise();
  try {
    await runLambda({
      taskId: jobId,
      objectKey: key,
      suffix: "superuser",
      requestingUser: "Data Library Template Updater <support@seasketch.org>",
    });
  } catch (e) {
    console.error(`Error updating Data Library Template ${templateId}`);
    console.error(e);
  }
}

export async function updateSourceWithUrl(
  url: string,
  itemId: number,
  templateId: string,
  client: PoolClient,
  helpers: JobHelpers,
  metadata: any = {}
) {
  const fileName = url.split("/").pop()!;
  const fileExtension = /\.\w+$/.test(url) ? url.split(".").pop()! : "";
  const key = `${templateId}/${uuid()}/${fileName}`;
  const jobId = await createSourceReplacementJob(
    fileName,
    "application/octet-stream",
    itemId,
    client,
    metadata
  );
  // save the contents of the url to a temporary file
  const tmpFile = tmp.fileSync();
  const tmpFileName = tmpFile.name;
  const tmpFileStream = fs.createWriteStream(tmpFileName);
  await new Promise((resolve, reject) => {
    tmpFileStream.on("finish", () => resolve(undefined));
    tmpFileStream.on("error", reject);
    require("https").get(url, (res: any) => {
      res.pipe(tmpFileStream);
    });
  });
  // upload the file to S3
  helpers.logger.info(`Uploading ${key} to S3`);
  await s3
    .putObject({
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(tmpFile.name),
      ContentType: "application/octet-stream",
    })
    .promise();
  // fire off the lambda to process the data
  helpers.logger.info(`Starting lambda for ${key}`);
  try {
    await runLambda({
      taskId: jobId,
      objectKey: key,
      suffix: "superuser",
      requestingUser: "Data Library Template Updater <support@seasketch.org>",
    });
  } catch (e) {
    console.error(`Error updating Data Library Template ${templateId}`);
    console.error(e);
  }
}
