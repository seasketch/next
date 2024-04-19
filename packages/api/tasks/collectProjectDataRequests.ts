import { Helpers } from "graphile-worker";
import {
  getVisitorMetrics,
  getRealUserVisits,
  getMapDataRequests,
} from "../src/visitorMetrics";

const intervals = ["15 minutes", "1 hour", "1 day"] as (
  | "15 minutes"
  | "1 hour"
  | "1 day"
)[];

export default async function collectProjectDataRequests(
  payload: { id: number; slug: string },
  helpers: Helpers
) {
  return await helpers.withPgClient(async (client) => {
    const now = Date.now();
    for (const interval of intervals) {
      const times = await client.query(
        `select $1::timestamp  - $2::interval as start, ($1::timestamp) as end`,
        [new Date(now), interval]
      );
      if (!times.rows[0]) {
        throw new Error("No start date found");
      }
      const start = new Date(times.rows[0].start);
      const end = new Date(times.rows[0].end);
      const mapDataRequests = await getMapDataRequests(
        start,
        end,
        interval,
        payload.slug
      );
      for (const visit of mapDataRequests) {
        await client.query(
          `
          insert into project_map_data_requests (
            interval,
            timestamp,
            count,
            cache_hit_ratio,
            project_id
          ) values (
            $1::interval,
            $2::timestamp,
            $3::int,
            $4::float,
            $5::int
          ) on conflict (project_id, interval, timestamp) do update
          set
            count = EXCLUDED.count,
            cache_hit_ratio = EXCLUDED.cache_hit_ratio
          `,
          [
            interval,
            visit.datetime.toISOString(),
            visit.count,
            visit.cacheRatio,
            payload.id,
          ]
        );
      }
    }

    // Delete 15 minute interval records older than 48 hours
    await client.query(
      `
        delete from project_map_data_requests
        where
          interval = '15 minutes' and
          timestamp < now() - interval '48 hours'
      `
    );
    // Delete 1 hour interval records older than 30 days
    await client.query(
      `
        delete from project_map_data_requests
        where
          interval = '1 hour' and
          timestamp < now() - interval '30 days'
      `
    );
  });
}
