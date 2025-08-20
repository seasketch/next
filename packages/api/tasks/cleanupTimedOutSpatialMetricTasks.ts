import { Helpers } from "graphile-worker";

export default async function cleanupTimedOutSpatialMetricTasks(
  payload: any,
  helpers: Helpers
) {
  await helpers.withPgClient(async (client) => {
    await client.query(
      `update spatial_metrics set state = 'error', error_message = 'Timeout' where state = 'queued' and created_at < now() - interval '60 seconds'`
    );
  });
}
