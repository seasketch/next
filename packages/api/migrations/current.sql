-- Enter migration here
alter table projects add column if not exists enable_report_builder boolean default false;

drop table if exists project_geography_settings;

create table project_geography_settings (
  project_id integer references projects(id) on delete cascade,
  enable_land_clipping boolean default true,
  eez_selections text[] default '{}',
  enable_eez_clipping boolean default true
);

insert into project_geography_settings (project_id)
select id from projects;

drop trigger if exists after_project_insert on projects;

create or replace function create_project_geography_settings() 
returns trigger as $$
begin
  insert into project_geography_settings (project_id)
  values (new.id);
  return new;
end;
$$ language plpgsql;

create trigger after_project_insert
after insert on projects
for each row
execute function create_project_geography_settings();

grant update(enable_report_builder) on projects to seasketch_user;

alter table data_upload_outputs add column if not exists is_custom_upload boolean default false;

create or replace function geography_clipping_layers()
  returns setof data_layers
  language sql
  stable
  security definer
  as $$
    select * from data_layers where id in (
      select 
        data_layer_id 
      from 
        table_of_contents_items 
      where project_id = (
        select id from projects where slug = 'superuser'
      ) and data_library_template_id in (
        'DAYLIGHT_COASTLINE', 
        'MARINE_REGIONS_EEZ_LAND_JOINED'
      ) and is_draft = true
    )
  $$;

grant execute on function geography_clipping_layers to anon;

comment on function geography_clipping_layers is '@simpleCollections only';

grant execute on function data_sources_author_profile to anon;

CREATE OR REPLACE FUNCTION public.data_sources_author_profile(source public.data_sources) RETURNS public.user_profiles
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select
      user_profiles.*
    from
      user_profiles
    inner join
      project_participants
    on
      project_participants.user_id = coalesce(source.created_by, source.uploaded_by)
    where

      (source.data_library_template_id is not null or (session_is_admin(source.project_id) and
      (project_participants.is_admin = true or (
      project_participants.share_profile = true and
      project_participants.project_id = source.project_id)))) and
      user_profiles.user_id = coalesce(source.created_by, source.uploaded_by)
    limit 1;
  $$;

DROP POLICY table_of_contents_items_select on public.table_of_contents_items;
CREATE POLICY table_of_contents_items_select ON public.table_of_contents_items FOR SELECT TO anon USING ((public.session_has_project_access(project_id) AND (is_draft = false) AND public._session_on_toc_item_acl(path)) or data_library_template_id is not null);