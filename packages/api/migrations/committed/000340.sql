--! Previous: sha1:9bc19cbc712fb81e17c7a84ccee62a3facdf5ea5
--! Hash: sha1:a98e9d208313bdb12a74b6a18f984d1d203092e1

-- Enter migration here
set role seasketch_superuser;
delete from sketch_classes where project_id = (select id from projects where slug = 'superuser') and name = 'Filtered Planning Units';

insert into sketch_classes(
  project_id, 
  name, 
  geometry_type, 
  mapbox_gl_style, 
  is_template, 
  template_description
) values (
  (select id from projects where slug = 'superuser'),
  'Filtered Planning Units',
  'FILTERED_PLANNING_UNITS'::sketch_geometry_type,
  '{}'::jsonb,
  true,
  'Filter polygons by criteria. Requires an API server.'
) on conflict do nothing;

select initialize_sketch_class_form_from_template((select id from sketch_classes where name = 'Filtered Planning Units' and is_template = true), (select id from forms where is_template = true and template_type = 'SKETCHES' and template_name = 'Basic Template'));
set role postgres;

GRANT update (filter_api_server_location) on sketch_classes to seasketch_user;
GRANT update (filter_api_version) on sketch_classes to seasketch_user;

delete from form_element_types where component_name = 'FilterInput';
insert into form_element_types (
  component_name,
  label,
  is_input,
  is_surveys_only
) values (
  'FilterInput',
  'Filter Input',
  true,
  false
);

CREATE OR REPLACE FUNCTION public.before_sketch_insert_or_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      class_geometry_type sketch_geometry_type;
      allow_multi boolean;
      incoming_geometry_type text;
      new_geometry_type text;
      parent_collection_id int;
    begin
      select 
        geometry_type, 
        sketch_classes.allow_multi
      into 
        class_geometry_type, 
        allow_multi, 
        incoming_geometry_type 
      from 
        sketch_classes 
      where 
        id = NEW.sketch_class_id;
      if NEW.folder_id is not null and NEW.collection_id is not null then
        raise exception 'Parent cannot be to both folder and collection';
      end if;
      if class_geometry_type = 'COLLECTION' then
        -- Also check for parent collection of parent folder (recursively)
        if NEW.collection_id is not null then
          if (select get_parent_collection_id('sketch', NEW.collection_id)) is not null then
            raise exception 'Nested collections are not allowed';
          end if;
        elsif NEW.folder_id is not null then
          if (select get_parent_collection_id('sketch_folder', NEW.folder_id)) is not null then
            raise exception 'Nested collections are not allowed';
          end if;
        end if;
        -- geom must be present unless a collection
        if NEW.geom is not null or NEW.user_geom is not null then
          raise exception 'Collections should not have geometry';
        else
          -- no nested collections
          if NEW.collection_id is not null then
            raise exception 'Nested collections are not allowed';
          else
            return NEW;
          end if;
        end if;
      elsif class_geometry_type = 'FILTERED_PLANNING_UNITS' then
        -- Also check for parent collection of parent folder (recursively)
        if NEW.collection_id is not null then
          raise exception 'Filtered planning units cannot be part of a collection';
        elsif NEW.folder_id is not null then
          if (select get_parent_collection_id('sketch_folder', NEW.folder_id)) is not null then
            raise exception 'Filtered planning units cannot be part of a collection';
          end if;
        end if;
        -- geom must be present unless a collection
        if NEW.geom is not null or NEW.user_geom is not null then
          raise exception 'Filtered planning units should not have geometry';
        else
          -- no nested collections
          if NEW.collection_id is not null then
            raise exception 'Filtered planning units cannot be part of a collection';
          else
            return NEW;
          end if;
        end if;
      else
        select geometrytype(NEW.user_geom) into new_geometry_type;
        -- geometry type must match sketch_class.geometry_type and sketch_class.allow_multi
        if (new_geometry_type = class_geometry_type::text) or (allow_multi and new_geometry_type like '%' || class_geometry_type::text) then
          -- if specifying a collection_id, must be in it's valid_children
          if NEW.collection_id is null or not exists(select 1 from sketch_classes_valid_children where parent_id in (select sketch_class_id from sketches where id = NEW.collection_id)) or exists(select 1 from sketch_classes_valid_children where parent_id in (select sketch_class_id from sketches where id = NEW.collection_id) and child_id = NEW.sketch_class_id) then
            return NEW;
          else
            raise exception 'Sketch is not a valid child of collection';
          end if;
        else
          raise exception 'Geometry type does not match sketch class';
        end if;
      end if;
    end;
  $$;


CREATE OR REPLACE FUNCTION url_encode(input text)
RETURNS text AS $$
DECLARE
    cleaned_input text;
    output text := '';
    ch text;
    ch_code int;
BEGIN
    -- Remove all extraneous whitespace from the input JSON text
    cleaned_input := regexp_replace(input, '\s+', '', 'g');

    -- Perform URL encoding on the cleaned input
    FOR i IN 1..length(cleaned_input) LOOP
        ch := substr(cleaned_input, i, 1);
        ch_code := ascii(ch);
        -- Allow only URL-safe characters (alphanumeric and unreserved characters)
        IF ch ~ '[a-zA-Z0-9_.~-]' THEN
            output := output || ch;
        ELSE
            -- Use lpad and upper to ensure two-character hexadecimal representation
            output := output || '%' || lpad(upper(to_hex(ch_code)), 2, '0');
        END IF;
    END LOOP;

    RETURN output;
END;
$$ LANGUAGE plpgsql;

grant execute on function url_encode to anon;
comment on function url_encode is '@omit';

drop function if exists filter_state_to_search_string(jsonb, int);
drop function if exists filter_state_to_search_string(jsonb);

CREATE OR REPLACE FUNCTION filter_state_to_search_string(filters jsonb, sketch_class_id int)
RETURNS text AS $$
DECLARE
    state jsonb := '{}';
    filter jsonb;
    attr text;
    result text;
    attribute_name text;
    filter_server_location text;
    filter_version int;
    final_url text;
BEGIN
    -- Retrieve the filter_api_server_location and filter_api_version from sketch_classes table
    SELECT sketch_classes.filter_api_server_location, sketch_classes.filter_api_version
    INTO filter_server_location, filter_version
    FROM sketch_classes
    WHERE id = sketch_class_id;

    -- If filter_api_server_location is NULL, return NULL
    IF filter_server_location IS NULL THEN
        RETURN NULL;
    END IF;

    -- Loop through each attribute in the input JSONB object
    FOR attr, filter IN
        SELECT key, value FROM jsonb_each(filters)
    LOOP
        -- Only process if "selected" is true
        IF filter->>'selected' = 'true' THEN
            if filter->>'attribute' is not null then
                attribute_name := filter->>'attribute';
            else
              -- Look up the attribute name from form_elements for the current attr ID
              SELECT component_settings->>'attribute'
              INTO attribute_name
              FROM form_elements
              WHERE id = attr::int; -- Cast attr to integer to match form_elements ID
            end if;


            -- Default to the original key if no match is found
            IF attribute_name IS NULL THEN
                attribute_name := attr;
            END IF;

            -- Check for numberState
            IF filter ? 'numberState' THEN
                state := state || jsonb_build_object(attribute_name, jsonb_build_object(
                    'min', filter->'numberState'->'min',
                    'max', filter->'numberState'->'max'
                ));

            -- Check for stringState
            ELSIF filter ? 'stringState' THEN
                state := state || jsonb_build_object(attribute_name, jsonb_build_object(
                    'choices', filter->'stringState'
                ));

            -- Check for booleanState
            ELSIF filter ? 'booleanState' THEN
                state := state || jsonb_build_object(attribute_name, jsonb_build_object(
                    'bool', COALESCE(filter->'booleanState', 'false')::boolean
                ));
            END IF;
        END IF;
    END LOOP;

    -- If no keys were added, return an empty string; otherwise, encode the JSON
    IF state = '{}'::jsonb THEN
        RETURN filter_server_location || '/v' || filter_version || '/mvt/{z}/{x}/{y}.pbf';
    ELSE
        -- Convert the JSONB object to a text string without formatting
        result := state::text;

        -- URL encode the resulting JSON text using the updated url_encode function
        result := url_encode(result);

        -- Construct the final URL
        final_url := filter_server_location || '/v' || filter_version || '/mvt/{z}/{x}/{y}.pbf?filter=' || result;
        RETURN final_url;
    END IF;
END;
$$ LANGUAGE plpgsql;

grant execute on function filter_state_to_search_string to anon;
comment on function filter_state_to_search_string is '@omit';

alter table sketches drop column if exists filter_mvt_url;
create or replace function sketches_filter_mvt_url(s sketches)
  returns text
  language sql
  security definer
  stable
  as $$
  select filter_state_to_search_string(s.properties, s.sketch_class_id);
  $$;


grant execute on function sketches_filter_mvt_url to anon;
-- alter table sketches add column if not exists filter_mvt_url text generated always as (filter_state_to_search_string(properties, sketch_class_id)) stored;

-- grant select(filter_mvt_url) on sketches to anon;

delete from form_element_types where component_name = 'CollapsibleGroup';
insert into form_element_types (
  component_name,
  label,
  is_input,
  is_surveys_only
) values (
  'CollapsibleGroup',
  'Collapsible Group',
  false,
  false
);
