--! Previous: sha1:b82a912cd7e5484ad4decb12c0d3b45d4b9dd9c0
--! Hash: sha1:d505e142def2d8b3d2842f68a10aa95b512b8cd6

-- Enter migration here
create table if not exists project_visitors (
  project_id int not null references projects(id),
  interval interval not null,
  timestamp timestamptz not null,
  count integer not null,
  unique(project_id, interval, timestamp)
);


CREATE OR REPLACE FUNCTION public.projects_visitors(p projects, period public.activity_stats_period) RETURNS SETOF public.visitors
    LANGUAGE sql 
    STABLE 
    SECURITY DEFINER
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
              project_visitors 
            where timestamp = dd and 
            interval = (
              case period
                when '24hrs' then '15 minutes'::interval
                when '7-days' then '1 hour'::interval
                when '30-days' then '1 day'::interval
                when '6-months' then '1 day'::interval
                when '1-year' then '1 day'::interval
                when 'all-time' then '1 day'::interval
                else '1 day'::interval
              end
            ) and
            project_id = p.id
          )
          , 0
        ) as count
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
      where session_is_admin(p.id)
      ORDER BY timestamp;
      -- project_id = p.id and 
      --   interval = (
      --     case period
      --       when '24hrs' then '15 minutes'::interval
      --       when '7-days' then '1 hour'::interval
      --       when '30-days' then '1 day'::interval
      --       when '6-months' then '1 day'::interval
      --       when '1-year' then '1 day'::interval
      --       when 'all-time' then '1 day'::interval
      --       else '1 day'::interval
      --     end
      --   )
      -- and timestamp >= now() - (
      --   case period
      --     when '24hrs' then '24 hours'::interval
      --     when '7-days' then '7 days'::interval
      --     when '30-days' then '30 days'::interval
      --     when '6-months' then '6 months'::interval
      --     when '1-year' then '1 year'::interval
      --     else '1 year'::interval
      --   end
      -- )
      -- order by timestamp asc
  $$;

grant execute on function projects_visitors to seasketch_user;

comment on function projects_visitors is '@simpleCollections only';

CREATE OR REPLACE FUNCTION public.projects_activity(p public.projects, period public.activity_stats_period) RETURNS public.project_activity_stats
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      stats project_activity_stats;
    begin
      select 
        (select coalesce(count(*), 0) from project_participants where project_id = p.id)::integer,
        (select coalesce(sum(size), 0) from data_upload_outputs where project_id = p.id)::bigint,
        (
          select coalesce(sum(forums_post_count(forums.*)), 0) from forums where project_id = p.id
        ),
        (
          select coalesce(count(*), 0) from sketches where sketch_class_id in (
            select id from sketch_classes where project_id = p.id
          )
        ),
        (
          select coalesce(sum(surveys_submitted_response_count(surveys.*)),0) from surveys where project_id = p.id
        ),
        (
          select coalesce(count(*), 0) from data_sources where project_id = p.id and type in ('seasketch-vector', 'seasketch-raster', 'seasketch-mvt')
        ),
        (select coalesce(count(*), 0) from data_sources where project_id = p.id)::integer,

        coalesce(sum(new_users), 0)::integer, 
        coalesce(sum(new_sketches), 0)::integer, 
        coalesce(sum(new_data_sources), 0)::integer, 
        coalesce(sum(new_forum_posts), 0)::integer, 
        coalesce(sum(new_survey_responses), 0)::integer, 
        coalesce(sum(new_uploaded_layers), 0)::integer, 
        coalesce(sum(new_uploaded_bytes), 0)::bigint
      into stats
      from 
        project_activity
      where project_activity.project_id = p.id and 
      date >= now() - (
        case period
          when '24hrs' then '24 hours'::interval
          when '7-days' then '7 days'::interval
          when '30-days' then '30 days'::interval
          when '6-months' then '6 months'::interval
          when '1-year' then '1 year'::interval
          else '1 day'::interval
        end
      ) and
      (session_is_admin(p.id) or p.access_control = 'public');
      return stats;
    end;
  $$;

CREATE OR REPLACE FUNCTION public.visitors(period public.activity_stats_period) RETURNS SETOF public.visitors
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
            visitors 
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
      ) as count
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

drop table if exists visitor_metrics cascade;
create table if not exists visitor_metrics (
  interval interval not null,
  timestamp timestamptz not null,
  month integer not null generated always as (date_part('month', timestamp AT TIME ZONE 'UTC')) stored,
  top_referrers jsonb not null,
  top_operating_systems jsonb not null,
  top_browsers jsonb not null,
  top_device_types jsonb not null,
  top_countries jsonb not null,
  primary key(interval, month)
);

drop table if exists project_visitor_metrics cascade;
create table if not exists project_visitor_metrics (
  project_id int not null references projects(id),
  interval interval not null,
  timestamp timestamptz not null,
  month integer not null generated always as (date_part('month', timestamp AT TIME ZONE 'UTC')) stored,
  top_referrers jsonb not null,
  top_operating_systems jsonb not null,
  top_browsers jsonb not null,
  top_device_types jsonb not null,
  top_countries jsonb not null,
  primary key(project_id, interval, month)
);

CREATE OR REPLACE FUNCTION public.visitor_metrics(period public.activity_stats_period) RETURNS SETOF public.visitor_metrics
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select * from visitor_metrics where session_is_superuser() and
    interval = (
      case period
        when '24hrs' then '24 hours'::interval
        when '7-days' then '7 days'::interval
        when '30-days' then '30 days'::interval
        else '1 day'::interval
      end
    ) order by timestamp desc limit 1;
  $$;


grant execute on function visitor_metrics to seasketch_user;

comment on function visitor_metrics is '@simpleCollections only';

create or replace function projects_visitor_metrics(p projects, period activity_stats_period)
  returns setof project_visitor_metrics
  language sql
  stable
  security definer
  as $$
    select * from project_visitor_metrics where session_is_admin(p.id) and
    project_id = p.id and
    interval = (
      case period
        when '24hrs' then '24 hours'::interval
        when '7-days' then '7 days'::interval
        when '30-days' then '30 days'::interval
        else '1 day'::interval
      end
    ) order by timestamp desc limit 1;
  $$;

grant execute on function projects_visitor_metrics to seasketch_user;
comment on function projects_visitor_metrics is '@simpleCollections only';

create or replace function schedule_visitor_metric_collection_for_all_projects()
  returns void
  language plpgsql
  stable
  security definer
  as $$
  declare
    p projects;
  begin
    for p in select * from projects loop
      perform graphile_worker.add_job(
      'collectProjectVisitorStats',
      payload := json_build_object(
        'id', p.id,
        'slug', p.slug
      ),
      run_at := NOW() + '5 seconds',
      queue_name := 'project-visitor-stats',
      job_key := 'collectProjectVisitorStats:' || p.id
    );
    end loop;
  end;
  $$;
