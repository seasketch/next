import { Helpers } from "graphile-worker";
import { getMapDataRequests } from "../src/visitorMetrics";

export default async function collectMapDataRequestCounts(
  payload: {},
  helpers: Helpers
) {
  return await helpers.withPgClient(async (client) => {
    const intervals = ["15 minutes", "1 hour", "1 day"] as (
      | "15 minutes"
      | "1 hour"
      | "1 day"
    )[];
    const now = Date.now();
    for (const interval of intervals) {
      // Global visitor_metrics
      // These records will have a null project_id. After the global stats are
      // collected, we will collect project specific stats
      const period = interval === "15 minutes" ? "24 hours" : "7 days";
      const times = await client.query(
        `select $1::timestamp  - $2::interval as start, ($1::timestamp) as end`,
        [new Date(now), period]
      );
      if (!times.rows[0]) {
        throw new Error("No start date found");
      }
      const start = new Date(times.rows[0].start);
      const end = new Date(times.rows[0].end);
      // Next, get real-user visits
      const mapDataRequests = await getMapDataRequests(start, end, interval);
      const sum = mapDataRequests.reduce((acc, r) => acc + r.count, 0);
      for (const visit of mapDataRequests) {
        await client.query(
          `
          insert into map_data_requests (
            interval,
            timestamp,
            count,
            cache_hit_ratio
          ) values (
            $1::interval,
            $2::timestamp,
            $3::int,
            $4::float
          ) on conflict (interval, timestamp) do update
          set
            count = EXCLUDED.count,
            cache_hit_ratio = EXCLUDED.cache_hit_ratio
          `,
          [
            interval,
            visit.datetime.toISOString(),
            visit.count,
            visit.cacheRatio,
          ]
        );
      }
    }
    // Delete 15 minute interval records older than 48 hours
    await client.query(
      `
        delete from map_data_requests
        where
          interval = '15 minutes' and
          timestamp < now() - interval '48 hours'
      `
    );
    // Delete 1 hour interval records older than 30 days
    await client.query(
      `
        delete from map_data_requests
        where
          interval = '1 hour' and
          timestamp < now() - interval '30 days'
      `
    );
  });
}
