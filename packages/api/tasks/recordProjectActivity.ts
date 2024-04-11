import { Helpers } from "graphile-worker";
/**
 * Database triggers are setup to run this task (debounced) whenever
 * a table of contents item or data upload ouput is deleted. This ensures
 * that the project's activity is updated to reflect the deletion.
 *
 * Newly added items are not recorded here. Instead, activity is checked
 * at the top of every minute and active projects have their activity
 * updated. This cron process is handled by the collectActivityStats task
 */
export default async function recordProjectActivity(
  payload: {
    projectId: number;
  },
  helpers: Helpers
) {
  await helpers.withPgClient(async (client) => {
    await client.query("select record_project_activity($1)", [
      payload.projectId,
    ]);
  });
}
