import { Helpers } from "graphile-worker";
import { PoolClient } from "pg";

const endpoint = `https://api.cloudflare.com/client/v4/graphql`;

export default async function collectActivityStats(
  payload: {},
  helpers: Helpers
) {
  await helpers.withPgClient(async (client) => {
    const intervals = ["15 minutes", "1 hour", "1 day"];
    const now = Date.now();
    for (const interval of intervals) {
      // Global activity_stats
      // These records will have a null project_id. After the global stats are
      // collected, we will collect project specific stats

      // first, determine if we are in the middle of an interval with an
      // existing record or if we need to create a new one
      const existingRecord = await client.query(
        `
        select 
          *
        from 
          activity_stats 
        where 
          project_id is null and
          interval = $1::interval and
          -- timestamp falls within start and end
          now() >= start and
          now() < start + interval
      `,
        [interval]
      );
      if (existingRecord.rowCount > 1) {
        throw new Error("Multiple records found for same interval");
      }
      let activeProjects: number[] = [];
      if (existingRecord.rowCount > 0) {
        // we are in the middle of an interval with an existing record, and it
        // needs to be updated
        const start = new Date(existingRecord.rows[0].start);
        const data = await getStatsForInterval(client, start);
        activeProjects = data.active_projects;
        await client.query(
          `
          update activity_stats
          set
            registered_users = $1,
            uploads_storage_used = $2::bigint,
            total_forum_posts = $3,
            total_sketches = $4,
            total_data_sources = $5,
            total_uploaded_layers = $6,
            new_users = $9,
            new_sketches = $10,
            new_data_sources = $11,
            new_forum_posts = $12,
            new_uploaded_bytes = $13::bigint
          where
            project_id is null and
            interval = $7::interval and
            id = $8
        `,
          [
            data.registered_users,
            data.uploads_storage_used,
            data.total_forum_posts,
            data.total_sketches,
            data.total_data_sources,
            data.total_uploaded_layers,
            interval,
            existingRecord.rows[0].id,
            data.new_users,
            data.new_sketches,
            data.new_data_sources,
            data.new_forum_posts,
            data.new_uploaded_bytes,
          ]
        );
      } else {
        // we are at the beginning of a new interval, and a new record needs to
        // be created. Note that this interval could start immediately after
        // the a previously stored interval, or there could be a gap.
        const data = await getStatsForInterval(client, new Date(now));
        activeProjects = data.active_projects;
        await client.query(
          `
          insert into activity_stats (
            project_id,
            interval,
            start,
            registered_users,
            uploads_storage_used,
            total_forum_posts,
            total_sketches,
            total_data_sources,
            total_uploaded_layers,
            new_users,
            new_sketches,
            new_data_sources,
            new_forum_posts,
            new_uploaded_bytes
          ) values (
            null,
            $1::interval,
            $2::timestamp - $1::interval,
            $3,
            $4::bigint,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13::bigint
          )
        `,
          [
            interval,
            new Date(now).toISOString(),
            data.registered_users,
            data.uploads_storage_used,
            data.total_forum_posts,
            data.total_sketches,
            data.total_data_sources,
            data.total_uploaded_layers,
            data.new_users,
            data.new_sketches,
            data.new_data_sources,
            data.new_forum_posts,
            data.new_uploaded_bytes,
          ]
        );
      }

      // Next, collect project specific stats for active projects
      for (const projectId of activeProjects) {
        const existingRecord = await client.query(
          `
          select 
            *
          from 
            activity_stats 
          where 
            project_id = $1 and
            interval = $2::interval and
            -- timestamp falls within start and end
            now() >= start and
            now() < start + interval
        `,
          [projectId, interval]
        );
        if (existingRecord.rowCount > 1) {
          throw new Error("Multiple records found for same interval");
        }
        if (existingRecord.rowCount > 0) {
          // we are in the middle of an interval with an existing record, and it
          // needs to be updated
          const start = new Date(existingRecord.rows[0].start);
          const data = await getStatsForInterval(client, start, projectId);
          await client.query(
            `
            update activity_stats
            set
              registered_users = $1,
              uploads_storage_used = $2::bigint,
              total_forum_posts = $3,
              total_sketches = $4,
              total_data_sources = $5,
              total_uploaded_layers = $6,
              new_users = $9,
              new_sketches = $10,
              new_data_sources = $11,
              new_forum_posts = $12,
              new_uploaded_bytes = $13::bigint
            where
              project_id = $7 and
              interval = $8::interval and
              id = $14
          `,
            [
              data.registered_users,
              data.uploads_storage_used,
              data.total_forum_posts,
              data.total_sketches,
              data.total_data_sources,
              data.total_uploaded_layers,
              projectId,
              interval,
              data.new_users,
              data.new_sketches,
              data.new_data_sources,
              data.new_forum_posts,
              data.new_uploaded_bytes,
              existingRecord.rows[0].id,
            ]
          );
        } else {
          // we are at the beginning of a new interval, and a new record needs to
          // be created. Note that this interval could start immediately after
          // the a previously stored interval, or there could be a gap.
          const data = await getStatsForInterval(
            client,
            new Date(now),
            projectId
          );
          await client.query(
            `
            insert into activity_stats (
              project_id,
              interval,
              start,
              registered_users,
              uploads_storage_used,
              total_forum_posts,
              total_sketches,
              total_data_sources,
              total_uploaded_layers,
              new_users,
              new_sketches,
              new_data_sources,
              new_forum_posts,
              new_uploaded_bytes
            ) values (
              $1,
              $2::interval,
              $3::timestamp - $1::interval,
              $4,
              $5::bigint,
              $6,
              $7,
              $8,
              $9,
              $10,
              $11,
              $12,
              $13,
              $14::bigint
            )
          `,
            [
              projectId,
              interval,
              new Date(now).toISOString(),
              data.registered_users,
              data.uploads_storage_used,
              data.total_forum_posts,
              data.total_sketches,
              data.total_data_sources,
              data.total_uploaded_layers,
              data.new_users,
              data.new_sketches,
              data.new_data_sources,
              data.new_forum_posts,
              data.new_uploaded_bytes,
            ]
          );
        }
      }
    }
    // cleanup old records
    // Delete 15-minute interval records older than 7 days
    await client.query(`
      delete from activity_stats where interval = '15 minutes'::interval and start < now() - '7 days'::interval
    `);
    // Delete 1-hour interval records older than 30 days
    await client.query(`
      delete from activity_stats where interval = '1 hour'::interval and start < now() - '30 days'::interval
    `);
    // Never delete daily stats
  });
}

async function getStatsForInterval(
  client: PoolClient,
  begin: Date,
  projectId?: number
) {
  let query = `
  select 
    (select count(*)::int from users) as registered_users,
    (select coalesce(sum(size)::bigint, 0) from data_upload_outputs) as uploads_storage_used,
    (select count(*)::int from posts) as total_forum_posts,
    (select count(*)::int from sketches) as total_sketches,
    (select count(*)::int from data_sources) as total_data_sources,
    (select count(*)::int from data_sources where type in (
      'seasketch-vector', 'seasketch-raster', 'seasketch-mvt'
    )) as total_uploaded_layers,
    coalesce((
      select array_agg(id) from projects where
        -- projects with sketches created in the selected time period
        id in (
          select project_id from sketch_classes where id in (
            select sketch_class_id from sketches where created_at >= $1
          )
        ) or
        -- projects with data sources created in the selected time period
        id in (
          select project_id from data_sources where created_at >= $1
        ) or
        -- projects with forum posts created in the selected time period
        id in (
          select 
            project_id 
          from
            forums
          where
            forums.id in (
              select 
                forum_id 
              from 
                topics 
              where 
                topics.id in (
                  select 
                    topic_id 
                  from 
                    posts 
                  where 
                    created_at >= $1
                )
            )
        )
    ), '{}'::int[]) as active_projects,
    (
      select count(*)::int from users where registered_at >= $1
    ) as new_users,
    (
      select count(*)::int from sketches where created_at >= $1
    ) as new_sketches,
    (
      select count(*)::int from data_sources where created_at >= $1
    ) as new_data_sources,
    (
      select count(*)::int from posts where created_at >= $1
    ) as new_forum_posts,
    (
      select coalesce(sum(size), 0)::bigint from data_upload_outputs where created_at >= $1
    ) as new_uploaded_bytes
  ;
`;
  if (projectId) {
    query = `
      select 
        (select count(*)::int from project_participants where project_id = $2) as registered_users,
        (select coalesce(sum(size)::bigint, 0) from data_upload_outputs where project_id = $2) as uploads_storage_used,
        (select count(*)::int from posts where topic_id in (
          select id from topics where forum_id in (
            select id from forums where project_id = $2
          )
        )) as total_forum_posts,
        (select count(*)::int from sketches where sketch_class_id in (select id from sketch_classes where project_id = $2)) as total_sketches,
        (select count(*)::int from data_sources where project_id = $2) as total_data_sources,
        (select count(*)::int from data_sources where project_id = $2 and type in (
          'seasketch-vector', 'seasketch-raster', 'seasketch-mvt'
        )) as total_uploaded_layers,
        (select array_agg(id) from projects where id = $2) as active_projects,
        (
          select count(*)::int from project_participants where project_id = $2 and requested_at >= $1
        ) as new_users,
        (
          select count(*)::int from sketches where sketch_class_id in (
            select id from sketch_classes where project_id = $2
          ) and created_at >= $1
        ) as new_sketches,
        (
          select count(*)::int from data_sources where project_id = $2 and created_at >= $1
        ) as new_data_sources,
        (
          select count(*)::int from posts where topic_id in (
            select id from topics where forum_id in (
              select id from forums where project_id = $2
            )
          ) and
          created_at >= $1
        ) as new_forum_posts,
        (
          select coalesce(sum(size), 0)::bigint from data_upload_outputs where project_id = $2 and created_at >= $1
        ) as new_uploaded_bytes
      ;
    `;
  }
  const response = await client.query(
    query,
    projectId ? [begin.toISOString(), projectId] : [begin.toISOString()]
  );

  if (response.rows.length === 0) {
    throw new Error("No response from database");
  }

  return response.rows[0] as {
    registered_users: number;
    uploads_storage_used: string;
    total_forum_posts: number;
    total_sketches: number;
    total_data_sources: number;
    total_uploaded_layers: number;
    active_projects: number[];
    new_users: number;
    new_sketches: number;
    new_data_sources: number;
    new_forum_posts: number;
    new_uploaded_bytes: string;
  };
}
