import { Helpers } from "graphile-worker";
import S3 from "aws-sdk/clients/s3";

/**
 * graphile-worker task that reprocesses a legacy data source through the
 * current upload pipeline. It downloads the original source file from its
 * CloudFront URL, uploads it to the spatial uploads S3 bucket, and then
 * hands off to the existing processDataUpload task (via add_job) which
 * invokes the spatial-uploads lambda and ultimately creates new
 * data_upload_outputs and geostats records.
 */
export default async function reprocessLegacyDataSource(
  payload: { jobId: string },
  helpers: Helpers
) {
  const { jobId } = payload;
  helpers.logger.info(`Reprocessing legacy data source for job: ${jobId}`);

  await helpers.withPgClient(async (client) => {
    // Mark as running immediately so the UI reflects activity
    await client.query(
      `update project_background_jobs
         set state = 'running', progress_message = 'downloading', started_at = now()
       where id = $1`,
      [jobId]
    );

    // Fetch the upload task record to get filename, content_type, and which
    // table_of_contents_item we are replacing
    const taskResult = await client.query<{
      id: string;
      filename: string;
      content_type: string;
      replace_table_of_contents_item_id: number;
    }>(
      `select id, filename, content_type, replace_table_of_contents_item_id
         from data_upload_tasks
        where project_background_job_id = $1
        limit 1`,
      [jobId]
    );

    const task = taskResult.rows[0];
    if (!task) {
      throw new Error(`No upload task found for job ${jobId}`);
    }

    // Resolve the current data source URL for the ToC item being replaced
    const sourceResult = await client.query<{
      url: string;
      uploaded_source_filename: string;
    }>(
      `select ds.url, ds.uploaded_source_filename
         from data_sources ds
         join data_layers dl on dl.data_source_id = ds.id
         join table_of_contents_items toc on toc.data_layer_id = dl.id
        where toc.id = $1`,
      [task.replace_table_of_contents_item_id]
    );

    const source = sourceResult.rows[0];
    if (!source) {
      throw new Error(
        `No data source found for table_of_contents_item ${task.replace_table_of_contents_item_id}`
      );
    }

    try {
      helpers.logger.info(`Downloading source from ${source.url}`);

      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(
          `Failed to download source from ${source.url}: ${response.status} ${response.statusText}`
        );
      }
      const buffer = Buffer.from(await response.arrayBuffer());

      // Upload to the spatial uploads bucket using the same key pattern that
      // the presigned URL system uses: {task.id}/{task.filename}. The
      // processDataUpload task reads this key via:
      //   select id || '/' || filename as object_key from data_upload_tasks
      const s3 = new S3({ region: process.env.S3_REGION });
      const objectKey = `${task.id}/${task.filename}`;

      helpers.logger.info(
        `Uploading to s3://${process.env.SPATIAL_UPLOADS_BUCKET}/${objectKey}`
      );

      await s3
        .putObject({
          Bucket: process.env.SPATIAL_UPLOADS_BUCKET!,
          Key: objectKey,
          Body: buffer,
          ContentType: task.content_type,
        })
        .promise();

      // Mark as uploaded and hand off to the existing processDataUpload task,
      // which will invoke the spatial-uploads lambda and eventually call
      // processDataUploadOutputs to write the new records.
      await client.query(
        `update project_background_jobs
           set progress_message = 'uploaded'
         where id = $1`,
        [jobId]
      );

      await client.query(
        `select graphile_worker.add_job(
           'processDataUpload',
           json_build_object('jobId', $1::text),
           max_attempts := 1
         )`,
        [jobId]
      );
    } catch (e) {
      helpers.logger.error(
        `reprocessLegacyDataSource failed for job ${jobId}: ${(e as Error).message}`
      );
      await client.query(
        `update project_background_jobs
           set state = 'failed',
               error_message = $2,
               progress_message = 'failed'
         where id = $1`,
        [jobId, (e as Error).message]
      );
      // Re-throw so graphile-worker records the failure
      throw e;
    }
  });
}
