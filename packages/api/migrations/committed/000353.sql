--! Previous: sha1:3df032a8928b4ef0cb384e47ce355cc85abd8b48
--! Hash: sha1:4345fac0990437b48303fa34fe112a0f8b567796

-- Enter migration here
alter table projects add column if not exists enable_report_builder boolean default false;

drop function if exists projects_geography_settings;
drop function if exists update_eez_clipping_settings;
drop function if exists update_land_clipping_settings;
drop table if exists project_geography_settings;

create table project_geography_settings (
  id integer not null generated always as identity primary key,
  project_id integer references projects(id) on delete cascade,
  enable_land_clipping boolean default true,
  eez_selections text[] default '{}',
  mrgid_eez integer[] default '{}',
  enable_eez_clipping boolean default false
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
grant update(enable_report_builder) on projects to seasketch_user;

create or replace function projects_geography_settings(p projects)
  returns project_geography_settings
  language sql
  stable
  security definer
  as $$
    select * from project_geography_settings where project_id = p.id;
  $$;

grant execute on function projects_geography_settings to anon;

-- create and assign a trigger that prevents enable_eez_clipping from being set to true if there are no eez_selections
create or replace function prevent_eez_clipping_without_selections()
  returns trigger
  language plpgsql
  as $$
  begin
    if new.enable_eez_clipping = true and (new.eez_selections is null or array_length(new.eez_selections, 1) is null or new.eez_selections = '{}') then
      raise exception 'Cannot enable eez clipping without selecting any eezs';
    end if;
    return new;
  end;
  $$;

drop trigger if exists prevent_eez_clipping_without_selections on project_geography_settings;

create trigger prevent_eez_clipping_without_selections
before insert or update on project_geography_settings
for each row
execute function prevent_eez_clipping_without_selections();

create or replace function update_eez_clipping_settings(slug text, selections text[], ids integer[], enable_clipping boolean)
  returns project_geography_settings
  language sql
  stable
  security definer
  as $$
    update project_geography_settings
    set eez_selections = selections, mrgid_eez = ids, enable_eez_clipping = (
      case
        when array_length(selections, 1) is null or selections = '{}' or array_length(ids, 1) is null or ids = '{}' then false
        else enable_clipping
      end
    )
    where project_id = (select id from projects where projects.slug = update_eez_clipping_settings.slug and session_is_admin(projects.id))
    returning *;
  $$;

  grant execute on function update_eez_clipping_settings to seasketch_user;

  create or replace function update_land_clipping_settings(slug text, enable_clipping boolean)
  returns project_geography_settings
  language sql
  security definer
  as $$
    update project_geography_settings
    set enable_land_clipping = enable_clipping
    where project_id = (select id from projects where projects.slug = update_land_clipping_settings.slug and session_is_admin(projects.id))
    returning *;
    $$;

    grant execute on function update_land_clipping_settings to seasketch_user;

create or replace function EEZLayer() 
  returns table_of_contents_items
  language sql
  security definer
  stable
  as $$
    select * from table_of_contents_items where data_library_template_id = 'MARINE_REGIONS_EEZ_LAND_JOINED';
    $$;

grant execute on function EEZLayer to anon;
