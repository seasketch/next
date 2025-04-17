-- Enter migration here
alter table if exists project_geography_settings rename to project_eez_settings;

DROP FUNCTION IF EXISTS public.projects_geography_settings(p public.projects);

CREATE OR REPLACE FUNCTION public.projects_eez_settings(p public.projects) RETURNS public.project_eez_settings
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select * from project_eez_settings where project_id = p.id;
  $$;

grant execute on function public.projects_eez_settings(public.projects) to anon;

drop table if exists project_geography_settings;
drop type if exists project_geography_settings;
drop table if exists geography_clipping_layers;
drop table if exists project_geography;
drop type if exists geography_layer_operation;

create type geography_layer_operation as enum (
  'intersect',
  'difference',
  'exception'
);

create table if not exists project_geography (
  id integer generated always as identity primary key,
  project_id integer not null references projects(id) on delete cascade,
  name text not null,
  reporting_only boolean default false,
  created_at timestamptz default now(),
  hash text
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
  template_id text,
  exception_message text,
  translated_props jsonb
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