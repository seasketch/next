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

alter table data_upload_outputs add column is_custom_upload boolean default false;