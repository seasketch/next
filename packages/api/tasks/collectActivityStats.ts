import { Helpers } from "graphile-worker";
const endpoint = `https://api.cloudflare.com/client/v4/graphql`;

/**
 * Does two things:
 *  1. Records global activity stats every minute
 *  2. Looks for recently active projects every minute and updates their
 *     activity logs
 *
 */
export default async function collectActivityStats(
  payload: {},
  helpers: Helpers
) {
  return await helpers.withPgClient(async (client) => {
    await client.query("select record_global_activity()");
    const recentProjectActivity = await client.query(`
      select get_projects_with_recent_activity() as project_ids
    `);
    if (
      recentProjectActivity.rowCount === 0 ||
      !recentProjectActivity.rows[0].project_ids
    ) {
      return;
    }
    const projectIds = recentProjectActivity.rows[0].project_ids as number[];
    for (const projectId of projectIds) {
      await client.query("select record_project_activity($1)", [projectId]);
    }
  });
}
