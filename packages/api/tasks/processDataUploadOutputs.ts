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
    uploadId: string;
    data: ProcessedUploadResponse;
  },
  helpers: Helpers
) {
  const { uploadId, data } = payload;
  helpers.logger.info(`Handling spatial data upload: ${uploadId}`);
  helpers.logger.info(`Data: ${data}`);
  await helpers.withPgClient(async (client) => {
    const results = await client.query(
      `update data_upload_tasks set state = 'cartography', started_at = now() where id = $1 returning *`,
      [uploadId]
    );
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
        `update data_upload_tasks set state = 'complete', outputs = $1 where id = $2`,
        [data, uploadId]
      );
    } else {
      await client.query(
        `update data_upload_tasks set state = 'failed', error_message = $1 where id = $2`,
        [data.error, uploadId]
      );
    }
  });
}
