-- Enter migration here
alter table if exists project_geography_settings rename to project_eez_settings;

DROP FUNCTION IF EXISTS public.projects_geography_settings(p public.projects);

drop function if exists project_geography_clipping_layers;
drop table if exists project_geography_settings;
drop type if exists project_geography_settings;
drop table if exists geography_clipping_layers;
drop table if exists project_geography;
drop type if exists geography_layer_operation;

create type geography_layer_operation as enum (
  'intersect',
  'difference'
);

create table if not exists project_geography (
  id integer generated always as identity primary key,
  project_id integer not null references projects(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  hash text,
  translated_props jsonb,
  client_template text
);

create index on project_geography(project_id);

create table if not exists geography_clipping_layers (
  id integer generated always as identity primary key,
  project_geography_id integer not null references project_geography(id) on delete cascade,
  data_layer_id integer not null references data_layers(id) on delete cascade,
  operation_type geography_layer_operation not null,
  cql2_query jsonb CHECK (
    jsonb_typeof(cql2_query) = 'object'
    AND cql2_query ? 'op'
    AND cql2_query ? 'args'
  ),
  template_id text
);

create index on geography_clipping_layers(project_geography_id);
create index on geography_clipping_layers(data_layer_id);

-- Function to compute hash for a project_geography row
create or replace function compute_project_geography_hash(geog_id integer) returns text as $$
declare
  hash_input text;
begin
  select string_agg(
    concat_ws(
      ':',
      data_layer_id::text,
      operation_type::text,
      cql2_query::text
    ),
    '|'
    order by id
  ) into hash_input
  from geography_clipping_layers
  where project_geography_id = geog_id;

  if hash_input is null then
    return null;
  end if;

  return encode(digest(hash_input, 'sha256'), 'hex');
end;
$$ language plpgsql;

-- Trigger function to update hash
create or replace function update_project_geography_hash() returns trigger as $$
begin
  update project_geography
    set hash = compute_project_geography_hash(NEW.project_geography_id)
    where id = NEW.project_geography_id;
  return null;
end;
$$ language plpgsql;

-- Trigger function for DELETE (since OLD is used)
create or replace function update_project_geography_hash_on_delete() returns trigger as $$
begin
  update project_geography
    set hash = compute_project_geography_hash(OLD.project_geography_id)
    where id = OLD.project_geography_id;
  return null;
end;
$$ language plpgsql;

-- Triggers on geography_clipping_layers
drop trigger if exists trg_update_geog_hash_insert on geography_clipping_layers;
create trigger trg_update_geog_hash_insert
  after insert or update of data_layer_id, operation_type, cql2_query on geography_clipping_layers
  for each row execute procedure update_project_geography_hash();

drop trigger if exists trg_update_geog_hash_delete on geography_clipping_layers;
create trigger trg_update_geog_hash_delete
  after delete on geography_clipping_layers
  for each row execute procedure update_project_geography_hash_on_delete();

-- Optionally, trigger to initialize hash for all project_geography rows
do $$
begin
  update project_geography
    set hash = compute_project_geography_hash(id);
end;
$$;

drop table if exists project_eez_settings cascade;

drop function if exists update_land_clipping_settings;
drop function if exists update_eez_clipping_settings;

-- add postgraphile "smart comment" to rename ProjectGeography to Geography
comment on type project_geography is E'@name Geography\n@plural Geography\n@description "Geography settings for a project, including clipping layers and operations."';

comment on table project_geography is E'@simpleCollections only';

grant select on project_geography to anon;

grant select on geography_clipping_layers to anon;

create or replace function project_geography_clipping_layers(geography project_geography)
  returns setof geography_clipping_layers
  language sql
  security definer
  stable
  as $$
    select * from geography_clipping_layers
    where project_geography_id = geography.id;
  $$;

grant execute on function project_geography_clipping_layers(geography project_geography) to anon;

comment on function project_geography_clipping_layers(geography project_geography) is E'@simpleCollections only\n@description "Returns the clipping layers for a given geography."';

grant insert, update, delete on project_geography to seasketch_user;
grant insert, update, delete on geography_clipping_layers to seasketch_user;

alter table project_geography enable row level security;
alter table geography_clipping_layers enable row level security;

-- Create policies for project_geography
create policy "Allow all users to read project geography" on project_geography
  for select using (true);
create policy "Allow project owners to insert, update, and delete their own project geography" on project_geography
  for all
  to seasketch_user
  using (session_is_admin(project_id))
  with check (session_is_admin(project_id));

-- Create policies for geography_clipping_layers
create policy "Allow all users to read geography clipping layers" on geography_clipping_layers
  for select using (true);

create policy "Allow project owners to insert, update, and delete their own geography clipping layers" on geography_clipping_layers
  for all
  to seasketch_user
  using (session_is_admin((select project_id from project_geography where project_geography.id = project_geography_id)))
  with check (session_is_admin((select project_id from project_geography where project_geography.id = project_geography_id)));

grant execute on function compute_project_geography_hash(geog_id integer) to seasketch_user;

grant execute on function digest(bytea, text) to anon;
grant execute on function digest(text, text) to anon;

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
        'MARINE_REGIONS_EEZ_LAND_JOINED',
        'MARINE_REGIONS_TERRITORIAL_SEA'
      ) and is_draft = true
    )
  $$;


create or replace function geography_clipping_layers_object_key(g geography_clipping_layers)
  returns text
  language sql
  stable
  security definer
  as $$
    select remote from data_upload_outputs where type = 'FlatGeobuf' and data_source_id = (
      select data_source_id from data_layers where id = g.data_layer_id
    );
  $$;

  grant execute on function geography_clipping_layers_object_key(g geography_clipping_layers) to anon;