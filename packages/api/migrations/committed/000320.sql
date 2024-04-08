--! Previous: sha1:dc2a4e92ad5ca1df1041e35a154a2d6d149bf8ee
--! Hash: sha1:39031990bc305db92605c7271292cfb7067697fd

-- Enter migration here
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
