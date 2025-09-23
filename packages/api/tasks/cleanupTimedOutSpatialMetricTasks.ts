import { Helpers } from "graphile-worker";

export default async function cleanupTimedOutSpatialMetricTasks(
  payload: any,
  helpers: Helpers
) {
  await helpers.withPgClient(async (client) => {
    await client.query(
      `
        update spatial_metrics 
        set 
          state = 'error', 
          error_message = 'Timeout. > 30 seconds since creation.' 
        where 
          state = 'queued' and 
          source_processing_job_dependency is null and 
          created_at < now() - interval '30 seconds'
      `
    );
    await client.query(
      `
      update spatial_metrics 
      set 
        state = 'error', 
        error_message = 'Timeout. > 30 seconds since last update.' 
      where 
        state = 'processing' and 
        updated_at < now() - interval '30 seconds'
      `
    );

    const results = await client.query(
      `
        update source_processing_jobs
        set state = 'error', error_message = 'Timeout. > 30 seconds since last update.'
        where updated_at < now() - interval '30 seconds' returning job_key
      `
    );
    const timedOutJobKeys = results.rows.map((row) => row.job_key);
    console.log(`Timed out job keys: ${timedOutJobKeys}`);
    const updatedResults = await client.query(
      `
        update spatial_metrics
        set state = 'error', error_message = 'Overlay dependency processing timed out.'
        where source_processing_job_dependency = any($1)
      `,
      [timedOutJobKeys]
    );
    console.log(`Updated spatial metrics: ${updatedResults.rowCount}`);
  });
}
