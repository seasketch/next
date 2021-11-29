--! Previous: sha1:cdc7d76f6715e8d551c3f1d9e48c52474df93e45
--! Hash: sha1:77c37f9c23934689b111565948ee7ad4acfdc082

-- Enter migration here

alter table sketches alter column user_geom drop not null;
alter table sketches drop column if exists bbox;
alter table sketches add column bbox real[] generated always as (create_bbox(coalesce(geom, user_geom))) stored;


alter table sketches drop column if exists num_vertices;
alter table sketches add column num_vertices int generated always as (st_npoints(coalesce(geom, user_geom))) stored;

alter table sketches add column if not exists form_element_id int references form_elements(id);

alter table sketches drop column if exists response_id;
alter table sketches drop column if exists survey_response_id;
alter table sketches add column response_id int references survey_responses (id) DEFERRABLE;

DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='sketches' and column_name='attributes')
  THEN
      ALTER TABLE "public"."sketches" RENAME COLUMN "attributes" TO "properties";
  END IF;
END $$;

drop trigger if exists _001_unnest_survey_response_sketches_trigger on survey_responses;

create or replace function _001_unnest_survey_response_sketches()
  returns trigger
  security definer
  language plpgsql
  as $$
    declare
      f record;
      feature_data record;
      sketch_ids int[];
      sketch_id int;
    BEGIN
      -- loop over spatial form elements in survey
      for f in select 
          form_elements.id::text as id,
          is_spatial,
          sketch_classes.id as sketch_class_id
        from 
          form_elements 
        inner join
          form_element_types
        on 
          form_element_types.component_name = form_elements.type_id
        inner join 
          sketch_classes
        on
          sketch_classes.form_element_id = form_elements.id
        where
          form_element_types.is_spatial = true
      loop
          if NEW.data::jsonb ? f.id THEN
            sketch_ids = ARRAY[]::int[];
            set constraints sketches_response_id_fkey deferred;
            if NEW.data::jsonb #> ARRAY[f.id,'features'::text] is not null then
              for feature_data in select jsonb_array_elements(NEW.data::jsonb #> ARRAY[f.id,'features'::text]) as feature loop
                insert into sketches (
                  response_id, 
                  form_element_id, 
                  sketch_class_id, 
                  user_id,
                  name, 
                  user_geom, 
                  properties
                ) values (
                  NEW.id, 
                  f.id::int, 
                  f.sketch_class_id, 
                  NEW.user_id,
                  feature_data.feature::jsonb #> ARRAY['properties'::text,'name'::text], 
                  st_geomfromgeojson(feature_data.feature::jsonb ->> 'geometry'::text),
                  feature_data.feature::jsonb -> 'properties'::text
                ) returning id into sketch_id;
                sketch_ids = sketch_ids || sketch_id;
              end loop;
              NEW.data = jsonb_set(NEW.data, ARRAY[f.id], to_json(sketch_ids)::jsonb);
            else
              raise exception 'Embedded sketches must be a FeatureCollection';
            end if;
          end if;
      end loop;
      RETURN NEW;
    END;
  $$;

CREATE TRIGGER _001_unnest_survey_response_sketches_trigger
    BEFORE INSERT OR UPDATE ON survey_responses
    FOR EACH ROW
    EXECUTE PROCEDURE _001_unnest_survey_response_sketches();


CREATE OR REPLACE FUNCTION public.before_sketch_insert_or_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      class_geometry_type sketch_geometry_type;
      allow_multi boolean;
      incoming_geometry_type text;
      new_geometry_type text;
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
    end
  $$;

alter table sketches alter column user_id drop not null;
