import { Helpers } from "graphile-worker";
import {
  getSlugsForDataRequests,
  getVisitedSlugs,
} from "../src/visitorMetrics";

export default async function identifyProjectsWithDataRequests(
  payload: {},
  helpers: Helpers
) {
  return await helpers.withPgClient(async (client) => {
    const times = await client.query(
      `select now() - '15 minutes'::interval as start, now() as end`
    );
    const potentialSlugs = await getSlugsForDataRequests(
      new Date(times.rows[0].start),
      new Date(times.rows[0].end)
    );
    console.log(potentialSlugs);
    if (potentialSlugs.length === 0) {
      return;
    }
    const projectIds = await client.query(
      `select id, slug from projects where slug = any($1)`,
      [potentialSlugs]
    );
    if (projectIds.rowCount === 0) {
      return;
    }
    for (const row of projectIds.rows) {
      console.log(
        `schedule record_project_data_requests for project ${row.id}`
      );
      await helpers.addJob(
        "collectProjectDataRequests",
        { id: row.id, slug: row.slug },
        {
          jobKey: `collectProjectDataRequests:${row.id}`,
          queueName: "project-data-requests",
        }
      );
    }
  });
}
