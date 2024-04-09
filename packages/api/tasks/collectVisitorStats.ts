import { Helpers } from "graphile-worker";
import { PoolClient } from "pg";
import { getVisitorMetrics, getRealUserVisits } from "../src/visitorMetrics";

const endpoint = `https://api.cloudflare.com/client/v4/graphql`;

export default async function collectVisitorStats(
  payload: {},
  helpers: Helpers
) {
  await helpers.withPgClient(async (client) => {
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

      // First, determine if there are any existing records for this interval.
      // If so, update it.
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

      const existingRecord = await client.query(
        `
        select 
          id
        from 
          visitor_metrics 
        where 
          project_id is null and
          interval = $1::interval
          order by start desc
          limit 1
      `,
        [interval]
      );
      const row = existingRecord.rows[0];
      if (row) {
        await client.query(
          `
          update visitor_metrics
          set
            top_referrers = $1,
            top_operating_systems = $2,
            top_browsers = $3,
            top_device_types = $4,
            top_countries = $5,
            last_updated = now(),
            start = now() - interval
          where
            id = $6
        `,
          [
            JSON.stringify(data.topReferrers),
            JSON.stringify(data.topOperatingSystems),
            JSON.stringify(data.topBrowsers),
            JSON.stringify(data.topDeviceTypes),
            JSON.stringify(data.topCountries),
            existingRecord.rows[0].id,
          ]
        );
      } else {
        await client.query(
          `
          insert into visitor_metrics (
            project_id,
            interval,
            start,
            top_referrers,
            top_operating_systems,
            top_browsers,
            top_device_types,
            top_countries,
            last_updated
          ) values (
            null,
            $1::interval,
            $2::timestamp,
            $3,
            $4,
            $5,
            $6,
            $7,
            now()
          )
        `,
          [
            interval,
            times.rows[0].start,
            JSON.stringify(data.topReferrers),
            JSON.stringify(data.topOperatingSystems),
            JSON.stringify(data.topBrowsers),
            JSON.stringify(data.topDeviceTypes),
            JSON.stringify(data.topCountries),
          ]
        );
      }

      // 30 day intervals are special. They get "rolled off" into a permanent
      // record for use in doing annual (or longer) reporting.
      if (interval === "30 days") {
        // check to see if there is an existing 30 day record that is younger
        // than 30 days old. If not, create a new one.
        // First, get current 30 day interval record
        const current = await client.query(
          `
          select 
            id,
            start,
            last_updated
          from 
            visitor_metrics 
          where 
            project_id is null and
            interval = '30 days'
            order by start desc
            limit 1
        `
        );
        if (!current.rows[0]) {
          throw new Error("No current 30 day record found");
        }
        // Is there another record older than the current one?
        const older = await client.query(
          `
          select 
            id,
            start,
            start + (interval * 2) < now() as is_old
          from 
            visitor_metrics 
          where 
            project_id is null and
            interval = '30 days' and
            start < now() and
            id != $1
          order by start desc
          limit 1
        `,
          [current.rows[0].id]
        );
        if (older.rowCount === 0 || older.rows[0].is_old === true) {
          // create a new record. This will actually replace the existing
          // "current" record since it will have a newer start date. That's fine
          await client.query(
            `
            insert into visitor_metrics (
              project_id,
              interval,
              start,
              top_referrers,
              top_operating_systems,
              top_browsers,
              top_device_types,
              top_countries,
              last_updated
            ) values (
              null,
              '30 days',
              now() - interval '30 days',
              $1,
              $2,
              $3,
              $4,
              $5,
              now()
            )
          `,
            [
              JSON.stringify(data.topReferrers),
              JSON.stringify(data.topOperatingSystems),
              JSON.stringify(data.topBrowsers),
              JSON.stringify(data.topDeviceTypes),
              JSON.stringify(data.topCountries),
            ]
          );
        }
      }

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

// Helpers from:
// https://github.com/brianc/node-postgres/issues/957#issuecomment-426852393

function expand(rowCount: number, columnCount: number, startAt = 1) {
  var index = startAt;
  return Array(rowCount)
    .fill(0)
    .map(
      (v) =>
        `(${Array(columnCount)
          .fill(0)
          .map((v) => `$${index++}`)
          .join(", ")})`
    )
    .join(", ");
}

// flatten([[1, 2], [3, 4]]) returns [1, 2, 3, 4]
function flatten(arr: any[]) {
  var newArr: any[] = [];
  arr.forEach((v) => v.forEach((p: any) => newArr.push(p)));
  return newArr;
}
