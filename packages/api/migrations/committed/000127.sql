--! Previous: sha1:d7709171c921e6f70fd0c49a8b4c632e6cc82032
--! Hash: sha1:f688f20bc01331d0a426b1b4fc2ccad367b9b114

-- Enter migration here
alter POLICY "survey_responses_update" on survey_responses
      TO seasketch_user
      USING (it_me(user_id) or session_is_admin((select project_id from surveys where surveys.id = survey_responses.survey_id)))
      WITH CHECK (it_me(user_id) or session_is_admin((select project_id from surveys where surveys.id = survey_responses.survey_id)));

grant update on survey_responses to seasketch_user;

CREATE or replace FUNCTION public.before_response_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  begin
    NEW.updated_at = now();
    if OLD.user_id != NEW.user_id then
      raise exception 'Cannot change userid';
    end if;
    if it_me(OLD.user_id) and not session_is_admin((select project_id from surveys where surveys.id = OLD.survey_id)) then
      if OLD.is_draft = false then
        raise exception 'Cannot edit submitted responses. Contact an admin and ask them to put your response into draft mode';
      end if;
    else
      if not session_is_admin((select project_id from surveys where surveys.id = OLD.survey_id)) then
        raise exception 'Must be a project administrator';
      -- else
      --   if OLD.is_draft != false or NEW.is_draft != true then
      --     raise exception 'Admins can only put responses back into draft mode';
      --   end if;
      end if;
    end if;
    return NEW;
  end;
$$;

create or replace function toggle_responses_practice(ids int[], "isPractice" bool)
  returns setof survey_responses
  language sql
  as $$
    update survey_responses set is_practice = "isPractice" where id = any(ids) returning survey_responses.*;
$$;

grant execute on function toggle_responses_practice to seasketch_user;

create or replace function make_responses_not_practice(ids int[])
  returns setof survey_responses
  language sql
  as $$
    update survey_responses set is_practice = false where id = any(ids) returning survey_responses.*;
$$;

grant execute on function make_responses_not_practice to seasketch_user;

alter table survey_responses add column if not exists archived boolean not null default false;

drop function if exists archive_responses;
create or replace function archive_responses(ids int[], "makeArchived" boolean)
  returns setof survey_responses
  language sql
  as $$
    update survey_responses set archived = "makeArchived" where id = any(ids) returning survey_responses.*;
$$;

grant execute on function archive_responses to seasketch_user;

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
      if  (TG_OP = 'INSERT') then
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
                    coalesce((feature_data.feature::jsonb #>> ARRAY['properties'::text,feature_name_element_id::text])::text, ''::text), 
                    st_geomfromgeojson(feature_data.feature::jsonb ->> 'geometry'::text),
                    feature_data.feature::jsonb -> 'properties'::text
                  ) returning id into sketch_id;
                  sketch_ids = sketch_ids || sketch_id;
                end loop;
                NEW.data = jsonb_set(NEW.data, ARRAY[f.id, 'collection'], to_json(sketch_ids)::jsonb);
              else
                raise exception 'Embedded sketches must be a FeatureCollection';
              end if;
            end if;
        end loop;
      end if;
      RETURN NEW;
    END;
  $$;

alter table survey_responses add column if not exists last_updated_by_id int references users (id);

create or replace function survey_responses_last_updated_by_email(r survey_responses)
  returns text
  security definer
  stable
  language sql
  as $$
    select canonical_email from users where users.id = r.last_updated_by_id;
$$;

grant execute on function survey_responses_last_updated_by_email to seasketch_user;


CREATE OR REPLACE FUNCTION set_survey_response_last_updated_by()
  RETURNS TRIGGER 
  LANGUAGE plpgsql
  AS $$
  BEGIN
    NEW.last_updated_by_id = nullif(current_setting('session.user_id', TRUE), '')::integer;
    RETURN NEW;
  END
$$; 

drop trigger if exists _002_set_survey_response_last_updated_by on survey_responses;

CREATE TRIGGER _002_set_survey_response_last_updated_by
    BEFORE UPDATE ON survey_responses
    FOR EACH ROW
    EXECUTE PROCEDURE set_survey_response_last_updated_by();
