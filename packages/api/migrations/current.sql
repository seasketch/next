-- Enter migration here
alter table projects add column if not exists is_offline_enabled boolean default false;
revoke update (is_offline_enabled) on projects from anon;
revoke update (is_offline_enabled) on projects from seasketch_user;

create or replace function enable_offline_support (project_id int, enable boolean)
  returns projects
  security definer
  language sql
  as $$
    update projects set is_offline_enabled = enable where projects.id = project_id and session_is_superuser() returning *; 
  $$;

grant execute on function enable_offline_support to seasketch_user;

create or replace function surveys_basemaps(survey surveys)
  returns setof basemaps
  STABLE
  language sql
  as $$
    select * from basemaps where id = any(select distinct(unnest(array_cat(
      (select array_agg(c) from (
        select unnest(map_basemaps) from form_elements where form_id = (
          select id from forms where survey_id = survey.id) and layout = any('{MAP_STACKED,MAP_SIDEBAR_LEFT,MAP_SIDEBAR_RIGHT,MAP_FULLSCREEN,MAP_TOP}')
        ) as dt(c)
      ),
      (select array_agg(basemaps) from (
        select jsonb_array_elements(component_settings->'basemaps') as basemaps from form_elements where form_id = (
          select id from forms where survey_id = survey.id
        ) and component_settings->'basemaps' is not null
      ) as f)::int[]
    ))));
  $$;

grant execute on function surveys_basemaps to anon;

comment on function surveys_basemaps is '@simpleCollections only';

alter table basemaps add column if not exists is_offline_enabled boolean not null default false;