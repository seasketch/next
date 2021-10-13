--! Previous: sha1:432d19a30f639fb3d7a7fabf6dd530c5cd0a7aab
--! Hash: sha1:7094acbf0cc711a1ab65d4ae999764caa54d8ed4

-- Enter migration here
alter table form_element_types add column if not exists is_required_for_surveys boolean not null default false;

update form_element_types set is_required_for_surveys = true where component_name = 'WelcomeMessage';

CREATE OR REPLACE FUNCTION public.set_form_element_order("elementIds" integer[]) RETURNS SETOF public.form_elements
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      project_id int;
      sketch_class_id int;
      survey_id int;
      formid int;
      pos int;
      field record;
    begin
      select
        form_elements.form_id
      into
        formid
      from
        form_elements
      where
        id = any("elementIds")
      limit 1;
      -- raise exception if session is not an admin
      select
        forms.sketch_class_id
        , forms.survey_id
      into
        sketch_class_id
        , survey_id
      from
        forms
      where
        forms.id = formid;
      if sketch_class_id is not null then
        select
          sketch_classes.project_id
        into
          project_id
        from
          sketch_classes
        where
          id = sketch_class_id;
      end if;
      if survey_id is not null then
        select
          surveys.project_id
        into
          project_id
        from
          surveys
        where
          id = survey_id;
      end if;
      if session_is_admin(project_id) = false then
        raise exception 'Must be project admin';
      end if;
      pos = 1;
      -- select fields in order of fieldIDs
      -- loop through each, setting a position
      for field in select * from form_elements where form_id = formid order by array_position("elementIds", id) loop
        update form_elements set position = pos where id = field.id;
        pos = pos + 1;
      end loop;
      -- return all the fields in this form
      return query select * from form_elements where form_elements.form_id = formid order by position asc;
    end
  $$;


CREATE OR REPLACE FUNCTION check_element_type() 
  RETURNS trigger 
  security definer
  language plpgsql
  AS $$
  DECLARE
    is_required boolean;
  BEGIN
    -- skip if the deletion is caused by a cascade from the form being deleted
    if (select count(id) from forms where id = OLD.form_id) > 0 then
      select is_required_for_surveys into is_required from form_element_types where component_name = OLD.type_id;
      if is_required then
        raise exception 'Cannot delete elements of type %', OLD.type_id;
      else
        return OLD;
      end if;
    else
      return OLD;
    end if;
  END;
$$;

DROP TRIGGER IF EXISTS before_delete_on_form_elements_001 on form_elements;

CREATE TRIGGER before_delete_on_form_elements_001
   BEFORE DELETE ON form_elements FOR EACH ROW
   EXECUTE PROCEDURE check_element_type();
