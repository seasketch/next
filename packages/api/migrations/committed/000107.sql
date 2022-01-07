--! Previous: sha1:e181ce30057c4b04d9689379a01be28efce9a526
--! Hash: sha1:63cf405e9783f8ab23cd111a2c6462eb3ca8dff2

-- Enter migration here
CREATE OR REPLACE FUNCTION public._001_unnest_survey_response_sketches() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      f record;
      feature_data record;
      sketch_ids int[];
      sketch_id int;
      feature_name_element_id int;
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
          select id into feature_name_element_id from form_elements where form_id = (select id from forms where sketch_class_id = f.sketch_class_id) and type_id = 'FeatureName';
          if NEW.data::jsonb ? f.id THEN
            sketch_ids = ARRAY[]::int[];
            set constraints sketches_response_id_fkey deferred;
            if NEW.data::jsonb #> ARRAY[f.id,'collection'::text, 'features'::text] is not null then
              for feature_data in select jsonb_array_elements(NEW.data::jsonb #> ARRAY[f.id,'collection'::text, 'features'::text]) as feature loop
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
                  coalesce((feature_data.feature::jsonb #> ARRAY['properties'::text,feature_name_element_id::text])::text, ''::text), 
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
