--! Previous: sha1:01d1c196be25caceb3e4f4c3d2b65dd3fa2865d2
--! Hash: sha1:a4e551bebb1a43ad4c948d0a479f7ef209a4d814

-- Enter migration here
drop function if exists visitors;
drop table if exists visitors;

create table visitors (
  interval interval not null,
  timestamp TIMESTAMPTZ NOT NULL,
  count integer not null,
  constraint unique_interval_timestamp unique (interval, timestamp)
);

create index visitors_interval on visitors(interval);

grant select on visitors to seasketch_user;

alter table visitors enable row level security;

create policy select_visitors_policy on visitors for select using (session_is_superuser());

create or replace function visitors(period activity_stats_period)
  returns setof visitors
  language sql
  security definer
  stable
  as $$
    select
      *
    from visitors
    where session_is_superuser() and 
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
      )
    and timestamp >= now() - (
      case period
        when '24hrs' then '24 hours'::interval
        when '7-days' then '7 days'::interval
        when '30-days' then '30 days'::interval
        when '6-months' then '6 months'::interval
        when '1-year' then '1 year'::interval
        else '1 year'::interval
      end
    )
    order by timestamp asc
  $$;

grant execute on function visitors to seasketch_user;
comment on function visitors is '@simpleCollections only';

CREATE OR REPLACE FUNCTION public.projects_activity(p public.projects, period public.activity_stats_period) RETURNS public.project_activity_stats
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      stats project_activity_stats;
    begin
      select 
        sum(new_users)::integer, 
        sum(new_sketches)::integer, 
        sum(new_data_sources)::integer, 
        sum(new_forum_posts)::integer, 
        sum(new_uploaded_bytes)::bigint, 
        sum(registered_users)::integer, 
        sum(uploads_storage_used)::bigint, 
        sum(total_forum_posts)::integer, 
        sum(total_sketches)::integer, 
        sum(total_data_sources)::integer, 
        sum(total_uploaded_layers)::integer
      into stats
      from 
        activity_stats 
      where interval = (
        case period
          when '24hrs' then '15 minutes'::interval
          when '7-days' then '1 hour'::interval
          when '30-days' then '1 day'::interval
          when '6-months' then '1 day'::interval
          when '1-year' then '1 day'::interval
          when 'all-time' then '1 day'::interval
          else '1 day'::interval
        end
      ) and activity_stats.project_id = p.id and 
      start >= now() - (
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
