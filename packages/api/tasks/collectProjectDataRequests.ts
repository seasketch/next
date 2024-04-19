import { Helpers } from "graphile-worker";
import {
  getVisitorMetrics,
  getRealUserVisits,
  getMapDataRequests,
  getRequestsBySource,
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

      if (
        interval !== "1 day" &&
        mapDataRequests.find((visit) => visit.count > 0)
      ) {
        const times = await client.query(
          `select $1::timestamp  - ($2::interval) * 4 as start, ($1::timestamp) as end`,
          [new Date(now), interval]
        );
        if (!times.rows[0]) {
          throw new Error("No start date found");
        }
        const start = new Date(times.rows[0].start);
        const end = new Date(times.rows[0].end);
        // collect requests by source
        const requestsBySource = await getRequestsBySource(
          start,
          end,
          interval,
          payload.slug
        );
        for (const row of requestsBySource) {
          // get a source_id if it can be found
          const results = await client.query(
            `select data_source_id from data_upload_outputs where url like $1 and (
              type = 'PMTiles' or type = 'GeoJSON'
            )`,
            [`%${row.uuid}%`]
          );
          if (results.rows.length > 0) {
            const sourceId = results.rows[0].data_source_id;
            await client.query(
              `
              insert into data_source_requests (
                project_id,
                data_source_id,
                timestamp,
                interval,
                count
              ) values (
                $1,
                $2,
                $3,
                $4,
                $5
              ) on conflict (project_id, data_source_id, interval, timestamp) do update set
                count = EXCLUDED.count
            `,
              [payload.id, sourceId, row.timestamp, interval, row.count]
            );
          }
        }
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
