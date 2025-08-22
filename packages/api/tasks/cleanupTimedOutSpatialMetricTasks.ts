import { Helpers } from "graphile-worker";

export default async function cleanupTimedOutSpatialMetricTasks(
  payload: any,
  helpers: Helpers
) {
  await helpers.withPgClient(async (client) => {
    await client.query(
      `update spatial_metrics set state = 'error', error_message = 'Timeout. > 30 seconds since creation.' where state = 'queued' and created_at < now() - interval '30 seconds'`
    );
    await client.query(
      `update spatial_metrics set state = 'error', error_message = 'Timeout. > 30 seconds since last update.' where state = 'processing' and updated_at < now() - interval '30 seconds'`
    );
  });
}
