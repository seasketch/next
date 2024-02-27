import { Helpers } from "graphile-worker";

/**
 * Cleans up project_background_jobs in a couple different scenarios
 *  * Times-out jobs if they take longer than their timeout_at.
 *  * Jobs which are never processed are deleted after 24 hours
 *  * Deletees jobs that are not in a failed state after 3 days
 * @param payload
 * @param helpers
 */
async function cleanupProjectBackgroundJobs(payload: {}, helpers: Helpers) {
  await helpers.withPgClient(async (client) => {
    await client.query(`
      update project_background_jobs set state = 'failed', error_message = 'Timed out', progress_message = 'timeout' where (state = 'queued' or state = 'running') and now() >= timeout_at
    `);
    await client.query(`
      delete from project_background_jobs where state = 'queued' and created_at < now() - interval '1 day'
    `);
    await client.query(`
      delete from project_background_jobs where state != 'failed' and created_at < now() - interval '3 days'
    `);
  });
}
export default cleanupProjectBackgroundJobs;
