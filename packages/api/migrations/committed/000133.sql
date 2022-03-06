--! Previous: sha1:33781cfdea6e48560c2cefb8efcf763d9003f33e
--! Hash: sha1:ee93c93851c760e7e7f66034918f0c197c04b03c

-- Enter migration here
alter table basemaps add column if not exists surveys_only boolean not null default false;
create index if not exists basemap_project_id_and_surveys_only on basemaps (project_id, surveys_only);

-- alter projects_basemaps function to exclude surveys_only basemaps
CREATE OR REPLACE FUNCTION public.projects_basemaps(project public.projects) RETURNS SETOF public.basemaps
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select 
      * 
    from 
      basemaps 
    where 
      session_has_project_access(project.id) and 
      (
        (basemaps.project_id = project.id and (basemaps.surveys_only = false)) or 
        basemaps.id in (
          select 
            basemap_id 
          from 
            projects_shared_basemaps 
          where 
            projects_shared_basemaps.project_id = project.id
        )
      );
  $$;

CREATE OR REPLACE FUNCTION public.projects_survey_basemaps(project public.projects) RETURNS SETOF public.basemaps
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select 
      * 
    from 
      basemaps 
    where 
      session_has_project_access(project.id) and 
      (
        basemaps.project_id = project.id and basemaps.surveys_only = true
      );
  $$;


grant execute on function projects_survey_basemaps to anon;
comment on function projects_survey_basemaps is '
@simpleCollections only
';

drop function if exists basemaps_related_form_elements(basemaps);
create or replace function basemaps_related_form_elements(basemap basemaps)
  returns setof form_elements
  stable
  language sql
  as $$
    select * from form_elements where basemap.id = any(form_elements.map_basemaps);
  $$;

grant execute on function basemaps_related_form_elements to seasketch_user;

create index if not exists form_elements_basemap_ids on form_elements (map_basemaps);

comment on function basemaps_related_form_elements is '@simpleCollections only';
