import { Helpers } from "graphile-worker";
import {
  ProcessedUploadResponse,
  SpatialUploadsHandlerRequest,
} from "spatial-uploads-handler";
import { createDBRecordsForProcessedUpload } from "../src/spatialUploads";

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
    const results = await client.query(
      `update project_background_jobs set progress_message = 'cartography' where id = $1 returning *`,
      [jobId]
    );
    const q = await client.query(
      `select id from data_upload_tasks where project_background_job_id = $1 limit 1`,
      [jobId]
    );
    if (!q.rows[0]) {
      throw new Error("Could not find upload task for job with ID=" + jobId);
    }
    const uploadId = q.rows[0].id;
    try {
      const projectId = results.rows[0].project_id;
      if (!data.error) {
        // Create layers
        for (const layer of data.layers) {
          const records = await createDBRecordsForProcessedUpload(
            layer,
            projectId,
            client,
            uploadId
          );
        }
        await client.query(
          `update project_background_jobs set progress_message = 'complete', state = 'complete' where id = $1`,
          [jobId]
        );
        await client.query(
          `update data_upload_tasks set outputs = $2 where id = $1`,
          [uploadId, JSON.stringify(data)]
        );
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
