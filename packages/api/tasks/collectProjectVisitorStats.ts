import { Helpers } from "graphile-worker";
import { getVisitorMetrics, getRealUserVisits } from "../src/visitorMetrics";

const intervals: ("24 hours" | "7 days" | "30 days")[] = [
  "24 hours",
  "7 days",
  "30 days",
];

export default async function collectProjectVisitorStats(
  payload: { id: number; slug: string },
  helpers: Helpers
) {
  console.log("running collectProjectVisitorStats", payload);
  await helpers.withPgClient(async (client) => {
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
      const realUserVisits = await getRealUserVisits(
        start,
        end,
        interval,
        payload.slug
      );
      for (const visit of realUserVisits) {
        await client.query(
          `
          insert into project_visitors (
            project_id,
            interval,
            timestamp,
            count
          ) values (
            $1::int,
            $2::interval,
            $3::timestamp,
            $4::int
          ) on conflict(project_id, interval, timestamp) do update
          set
            count = $4::int
          `,
          [
            payload.id,
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

      // Collect metrics
      const data = await getVisitorMetrics(start, end, payload.slug);
      await client.query(
        `
        insert into project_visitor_metrics (
          project_id,
          interval,
          timestamp,
          top_referrers,
          top_operating_systems,
          top_browsers,
          top_device_types,
          top_countries
        ) values (
          $8,
          $1::interval,
          $2::timestamp,
          $3,
          $4,
          $5,
          $6,
          $7
        ) 
        on conflict (project_id,interval,month) 
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
          payload.id,
        ]
      );
    }
  });
}
