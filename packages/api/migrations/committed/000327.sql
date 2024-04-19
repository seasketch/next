--! Previous: sha1:9c4a43c178c68291bf433e2079456478a23c100f
--! Hash: sha1:9ac5340f3099df1d7c250b020a1643cc53748ee6

-- Enter migration here
drop table if exists project_map_data_requests cascade;
drop function if exists projects_related_map_data_requests;

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


create table if not exists project_map_data_requests (
  project_id int not null references projects(id),
  interval interval not null,
  timestamp timestamp with time zone not null,
  count integer not null,
  cache_hit_ratio float not null,
  primary key (project_id, interval, timestamp)
);

comment on table project_map_data_requests is '@omit';
comment on table map_data_requests is '@omit';

grant execute on function map_data_requests to seasketch_user;
comment on function map_data_requests is '@simpleCollections only';

CREATE OR REPLACE FUNCTION public.projects_map_data_requests(project public.projects, period public.activity_stats_period) RETURNS SETOF public.project_map_data_requests
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select
      project.id as project_id,
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
      ) as interval,
      dd as timestamp,
      coalesce(
        (
          select 
            count 
          from 
            project_map_data_requests 
          where project_id = project.id and
          timestamp = dd
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
            project_map_data_requests 
          where timestamp = dd and project_id = project.id
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
    FROM generate_series(
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
    where session_is_admin(project.id)
    order by timestamp asc
  $$;

grant execute on function projects_map_data_requests to seasketch_user;

comment on function projects_map_data_requests is '@simpleCollections only';
