--! Previous: sha1:deaa8d3a6ecac35b3a09e1c81611e5a07ebf813e
--! Hash: sha1:a29f6da147329619b87264dfbdc134d982fcbe4f

-- Enter migration here
alter table projects add column if not exists feature_flags jsonb not null default '{}'::jsonb;
grant select(feature_flags) on projects to anon;

create or replace function update_feature_flags(slug text, flags jsonb)
  returns projects
  language plpgsql
  security definer
  as $$
    declare
      project_id int;
      key text;
      project projects;
    begin
      select id into project_id from projects where projects.slug = update_feature_flags.slug;
      if project_id is null then
        raise exception 'Project not found';
      end if;
      if session_is_admin(project_id) then
        -- flags should be a javascript object, keyed by the string name of the 
        -- flag, with a boolean value.
        -- First, validate the flags object.
        if jsonb_typeof(flags) != 'object' then
          raise exception 'Flags must be a JSON object';
        end if;
        -- Make sure all values are booleans.
        for key in select jsonb_object_keys(flags) as key loop
          if jsonb_typeof(flags->key) != 'boolean' then
            raise exception 'Flags must be a JSON object with boolean values. Invalid flag: %', key;
          end if;
        end loop;
        -- Update the project with the new flags, merging given flags with 
        -- existing flags.
        update projects set feature_flags = feature_flags || flags where id = project_id returning * into project;
        return project;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

grant execute on function update_feature_flags(text, jsonb) to seasketch_user;

comment on column projects.feature_flags is '@omit';
