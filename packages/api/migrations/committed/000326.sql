--! Previous: sha1:d505e142def2d8b3d2842f68a10aa95b512b8cd6
--! Hash: sha1:9c4a43c178c68291bf433e2079456478a23c100f

-- Enter migration here
CREATE OR REPLACE FUNCTION public.schedule_visitor_metric_collection_for_all_projects() RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
  declare
    p projects;
    i integer;
  begin
    i = 1;
    for p in select * from projects order by id desc loop
      perform graphile_worker.add_job(
      'collectProjectVisitorStats',
      payload := json_build_object(
        'id', p.id,
        'slug', p.slug
      ),
      run_at := NOW() + (10 || ' seconds')::interval,
      queue_name := 'project-visitor-stats',
      job_key := 'collectProjectVisitorStats:' || p.id
    );
    i := i + 1;
    end loop;
  end;
  $$;

drop table if exists map_data_requests cascade;
create table if not exists map_data_requests(
  interval interval not null,
  timestamp timestamp with time zone not null,
  count integer not null,
  cache_hit_ratio float not null,
  primary key (interval, timestamp)
);

revoke select on map_data_requests from seasketch_user;

-- alter table map_data_requests enable row level security;

-- create policy select_map_data_requests on map_data_requests for select using (session_is_superuser());



CREATE OR REPLACE FUNCTION public.map_data_requests(period public.activity_stats_period) RETURNS SETOF public.map_data_requests
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select
      (
        case period
          when '24hrs' then '15 minutes'::interval
          when '7-days' then '1 hour'::interval
          when '30-days' then '1 day'::interval
          when '6-months' then '1 day'::interval
          when '1-year' then '1 day'::interval
          when 'all-time' then '1 day'::interval
          else '1 day'::interval
        end
      ),
      dd as timestamp,
      coalesce(
        (
          select 
            count 
          from 
            map_data_requests 
          where timestamp = dd
          and interval = (
            case period
              when '24hrs' then '15 minutes'::interval
              when '7-days' then '1 hour'::interval
              when '30-days' then '1 day'::interval
              when '6-months' then '1 day'::interval
              when '1-year' then '1 day'::interval
              when 'all-time' then '1 day'::interval
              else '1 day'::interval
            end
          )
        )
        , 0
      ) as count,
      coalesce(
        (
          select 
            cache_hit_ratio 
          from 
            map_data_requests 
          where timestamp = dd
          and interval = (
            case period
              when '24hrs' then '15 minutes'::interval
              when '7-days' then '1 hour'::interval
              when '30-days' then '1 day'::interval
              when '6-months' then '1 day'::interval
              when '1-year' then '1 day'::interval
              when 'all-time' then '1 day'::interval
              else '1 day'::interval
            end
          )
        )
        , 0
      ) as cache_hit_ratio
    from generate_series(
        (
          case period
            when '24hrs' then (
              (date_trunc('hour', now()) + floor(date_part('minute', now())::int / 15) * interval '15 min') - '24 hours'::interval
            )
            when '7-days' then date_trunc('day', now() - '7 days'::interval)
            when '30-days' then date_trunc('day', now())::date - '30 days'::interval
            when '6-months' then date_trunc('day', now())::date - '6 months'::interval
            when '1-year' then date_trunc('day', now())::date - '1 year'::interval
            when 'all-time' then date_trunc('day', now())::date - '1 month'::interval
            else date_trunc('day', now())::date - '1 month'::interval
          end
        ),
        (
          now()
        ), 
        (
          case period
            when '24hrs' then '15 minutes'::interval
            when '7-days' then '1 hour'::interval
            when '30-days' then '1 day'::interval
            when '6-months' then '1 day'::interval
            when '1-year' then '1 day'::interval
            when 'all-time' then '1 day'::interval
            else '1 day'::interval
          end
        )
      ) dd
    where session_is_superuser()
    order by timestamp asc
  $$;

grant execute on function map_data_requests to seasketch_user;

comment on function map_data_requests is '@simpleCollections only';
