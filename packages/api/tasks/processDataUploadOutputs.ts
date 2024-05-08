import { Helpers } from "graphile-worker";
import {
  ProcessedUploadResponse,
  SpatialUploadsHandlerRequest,
} from "spatial-uploads-handler";
import { createDBRecordsForProcessedLayer } from "../src/spatialUploads";

/**
 * graphile-worker task which processes outputs from the spatial-uploads-handler
 * lambda. This task is triggered by the spatial-uploads-handler lambda itself.
 * @param payload
 * @param helpers
 */
export default async function processDataUpload(
  payload: {
    jobId: string;
    data: ProcessedUploadResponse;
  },
  helpers: Helpers
) {
  const { jobId, data } = payload;
  helpers.logger.info(`Handling spatial data upload: ${jobId}`);
  helpers.logger.info(`Data: ${data}`);
  await helpers.withPgClient(async (client) => {
    async function handleError(msg: string) {
      return client.query(
        `update project_background_jobs set state = 'failed', error_message = $2, progress_message = 'failed' where id = $1`,
        [jobId, msg]
      );
    }
    try {
      let replaceSourceId: number | undefined = undefined;
      const results = await client.query(
        `update project_background_jobs set progress_message = 'cartography' where id = $1 returning *`,
        [jobId]
      );
      const conversionTaskQuery = await client.query(
        `
        select project_background_job_id, table_of_contents_item_id from esri_feature_layer_conversion_tasks where project_background_job_id = $1 limit 1
      `,
        [jobId]
      );
      const uploadTaskQuery = await client.query(
        `select id, replace_source_id from data_upload_tasks where project_background_job_id = $1 limit 1`,
        [jobId]
      );
      const isConversionTask = conversionTaskQuery.rows.length > 0;
      const isUploadTask = uploadTaskQuery.rows.length > 0;
      if (isUploadTask) {
        replaceSourceId = uploadTaskQuery.rows[0].replace_source_id;
      } else if (isConversionTask) {
        const originalSource = await client.query(
          `
          select data_source_id from data_layers where id = (
            select data_layer_id from table_of_contents_items where id = $1
          )
        `,
          [conversionTaskQuery.rows[0].table_of_contents_item_id]
        );
        if (originalSource.rows.length >= 1) {
          replaceSourceId = originalSource.rows[0].data_source_id;
        }
      }
      if (!isConversionTask && !isUploadTask) {
        return handleError(
          "Could not find conversion or upload task related to background job " +
            jobId
        );
      }
      const projectId = results.rows[0].project_id;
      if (!data.error) {
        // Create layers
        for (const layer of data.layers) {
          await createDBRecordsForProcessedLayer(
            layer,
            projectId,
            client,
            jobId,
            isConversionTask ? "conversion" : "upload",
            replaceSourceId
          );
        }
        await client.query(
          `update project_background_jobs set progress_message = 'complete', state = 'complete' where id = $1`,
          [jobId]
        );
        if (isUploadTask) {
          const uploadId = uploadTaskQuery.rows[0].id;
          await client.query(
            `update data_upload_tasks set outputs = $2 where id = $1`,
            [uploadId, JSON.stringify(data)]
          );
        }
      } else {
        await client.query(
          `update project_background_jobs set state = 'failed', error_message = $1, progress_message = 'failed' where id = $2`,
          [data.error, jobId]
        );
      }
    } catch (e) {
      await client.query(
        `update project_background_jobs set progress_message = 'failed', state = 'failed', error_message = $1 where id = $2`,
        [(e as Error).toString(), jobId]
      );
    }
  });
}
