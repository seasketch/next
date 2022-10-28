import { Helpers } from "graphile-worker";

const UPLOAD_TASK_TIMEOUT = 5 * 60;

/**
 * graphile-worker task cleans up upload records in a couple different scenarios
 *   * Times-out DataUploadTasks if they take longer than UPLOAD_TASK_TIMEOUT.
 *     The lambda itself should fail in processDataUpload, but this is a
 *     secondary measure in case something fails there.
 *   * DataUploadTasks which never are never processed (likely due to never
 *     finishing an upload) are deleted after 24 hours
 *   * Set failures to dismissed after 3 days (in case people don't know how to dismiss, the auto-hide)
 *
 * @param payload
 * @param helpers
 */
async function cleanupDataUploads(payload: {}, helpers: Helpers) {
  await helpers.withPgClient(async (client) => {
    await client.query(`
      update data_upload_tasks set state = 'failed', error_message = '10 minute timeout' where (state != 'complete' and state != 'failed' and state != 'failed_dismissed') and (started_at < NOW() - INTERVAL '${
        UPLOAD_TASK_TIMEOUT + 60
      } seconds' or created_at < NOW() - INTERVAL '${
      UPLOAD_TASK_TIMEOUT + 120
    } seconds')
    `);
    await client.query(`
      delete from data_upload_tasks where state = 'awaiting_upload' and created_at < NOW() - INTERVAL '1 day' 
    `);
    await client.query(`
      update data_upload_tasks set state = 'failed_dismissed' where state = 'failed' and started_at < NOW() - INTERVAL '3 days' 
    `);
  });
}
export default cleanupDataUploads;
