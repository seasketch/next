import { Helpers } from "graphile-worker";
import { PoolClient } from "pg";
import { getVisitorMetrics, getRealUserVisits } from "../src/visitorMetrics";

export default async function collectVisitorStats(
  payload: {},
  helpers: Helpers
) {
  return await helpers.withPgClient(async (client) => {
    const intervals: ("24 hours" | "7 days" | "30 days")[] = [
      "24 hours",
      "7 days",
      "30 days",
    ];
    const now = Date.now();
    for (const interval of intervals) {
      // Global visitor_metrics
      // These records will have a null project_id. After the global stats are
      // collected, we will collect project specific stats
      const times = await client.query(
        `select $1::timestamp  - $2::interval as start, ($1::timestamp) as end`,
        [new Date(now), interval]
      );
      if (!times.rows[0]) {
        throw new Error("No start date found");
      }
      const start = new Date(times.rows[0].start);
      const end = new Date(times.rows[0].end);
      const data = await getVisitorMetrics(start, end);
      await client.query(
        `
        insert into visitor_metrics (
          interval,
          timestamp,
          top_referrers,
          top_operating_systems,
          top_browsers,
          top_device_types,
          top_countries
        ) values (
          $1::interval,
          $2::timestamp,
          $3,
          $4,
          $5,
          $6,
          $7
        ) 
        on conflict (interval,month) 
        do update set
          top_referrers = EXCLUDED.top_referrers,
          top_operating_systems = EXCLUDED.top_operating_systems,
          top_browsers = EXCLUDED.top_browsers,
          top_device_types = EXCLUDED.top_device_types,
          top_countries = EXCLUDED.top_countries,
          timestamp = EXCLUDED.timestamp
      `,
        [
          interval,
          times.rows[0].end,
          JSON.stringify(data.topReferrers),
          JSON.stringify(data.topOperatingSystems),
          JSON.stringify(data.topBrowsers),
          JSON.stringify(data.topDeviceTypes),
          JSON.stringify(data.topCountries),
        ]
      );

      // Next, get real-user visits
      const realUserVisits = await getRealUserVisits(start, end, interval);
      for (const visit of realUserVisits) {
        await client.query(
          `
          insert into visitors (
            interval,
            timestamp,
            count
          ) values (
            $1::interval,
            $2::timestamp,
            $3::int
          ) on conflict on constraint unique_interval_timestamp do update
          set
            count = $3::int
          `,
          [
            interval === "24 hours"
              ? "15 minutes"
              : interval === "7 days"
              ? "1 hour"
              : "1 day",
            visit.datetime.toISOString(),
            visit.count,
          ]
        );
      }

      // Delete 15 minute interval records older than 48 hours
      await client.query(
        `
        delete from visitors
        where
          interval = '15 minutes' and
          timestamp < now() - interval '48 hours'
      `
      );
      // Delete 1 hour interval records older than 30 days
      await client.query(
        `
        delete from visitors
        where
          interval = '1 hour' and
          timestamp < now() - interval '30 days'
      `
      );
    }
  });
}
