--! Previous: sha1:9e78beeed856232eab9bed7ca8934c3afbfa78a6
--! Hash: sha1:dc2a4e92ad5ca1df1041e35a154a2d6d149bf8ee

-- Enter migration here
drop function if exists projects_activity;
drop function if exists active_projects;
drop function if exists projects_activity_stats;
drop type if exists activity_stats_period;
create type activity_stats_period as enum ('24hrs', '7-days', '30-days', '6-months', '1-year', 'all-time');

create or replace function active_projects(period activity_stats_period, "limit" integer default 10)
  returns setof projects
  language sql
  stable
  security definer
  as $$
    select * from projects where (access_control = 'public' or session_is_admin(id)) and id in (select project_id from (
    select 
      distinct(project_id), 
      sum(new_users + new_sketches + new_data_sources + new_forum_posts) as sum
    from activity_stats where interval = (
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
    project_id is not null
    and (
      new_users > 0 or
      new_sketches > 0 or
      new_data_sources > 0 or
      new_forum_posts > 0
    )
    group by project_id
    order by sum desc
    limit active_projects.limit) as foo);
  $$;

comment on function active_projects is '@simpleCollections only';

grant execute on function active_projects to anon;

drop function if exists num_sketches;
drop function if exists num_data_sources;
drop function if exists num_forum_posts;
drop function if exists num_users;

create or replace function projects_num_sketches(p projects)
  returns int
  language sql
  security definer
  stable
  as $$
    select count(*) from sketches where sketch_class_id in (select id from sketch_classes where project_id = p.id);
  $$;

grant execute on function projects_num_sketches to anon;

create or replace function projects_num_data_sources(p projects)
  returns int
  language sql
  security definer
  stable
  as $$
    select count(*) from data_sources where project_id = p.id;
  $$;

grant execute on function projects_num_data_sources to anon;

create or replace function projects_num_forum_posts(p projects)
  returns int
  language sql
  security definer
  stable
  as $$
    select count(*) from posts where topic_id in (select id from topics where forum_id in (select id from forums where project_id = p.id));
  $$;

grant execute on function projects_num_forum_posts to anon;

create or replace function projects_num_users(p projects)
  returns int
  language sql
  security definer
  stable
  as $$
    select count(*) from project_participants where project_id = p.id;
  $$;

grant execute on function projects_num_users to anon;

create or replace function projects_num_uploads(p projects)
  returns int
  language sql
  security definer
  stable
  as $$
    select count(*) from data_sources where project_id = p.id and uploaded_by is not null;
  $$;

grant execute on function projects_num_uploads to anon;


drop type if exists project_activity_stats;
create type project_activity_stats as (
  new_users integer,
  new_sketches integer,
  new_data_sources integer,
  new_forum_posts integer,
  new_uploaded_bytes bigint,
  registered_users integer,
  uploads_storage_used bigint,
  total_forum_posts integer,
  total_sketches integer,
  total_data_sources integer,
  total_uploaded_layers integer
);

drop function if exists projects_activity_stats;
drop function if exists projects_activity;
create or replace function projects_activity(p projects, period activity_stats_period)
  returns project_activity_stats
  language plpgsql
  security definer
  stable
  as $$
    declare
      stats project_activity_stats;
    begin
      select 
        sum(new_users), 
        sum(new_sketches), 
        sum(new_data_sources), 
        sum(new_forum_posts), 
        sum(new_uploaded_bytes), 
        sum(registered_users), 
        sum(uploads_storage_used), 
        sum(total_forum_posts), 
        sum(total_sketches), 
        sum(total_data_sources), 
        sum(total_uploaded_layers)
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

grant execute on function projects_activity to anon;
