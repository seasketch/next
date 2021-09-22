--! Previous: sha1:f1b603fc3391b120dca9e797a5044dafd98c348c
--! Hash: sha1:44cdb2b7d9da8bee36ee4e2360997c3f14313610

-- Enter migration here
DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='form_elements' and column_name='name')
  THEN
      ALTER TABLE "public"."form_elements" RENAME COLUMN "name" TO "title";
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_form_template_from_survey("surveyId" integer, "templateName" text, template_type public.form_template_type) RETURNS public.forms
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      form forms;
      original_id int;
    begin
      select id into original_id from forms where survey_id = "surveyId";
      insert into forms (survey_id, is_template, template_name, template_type) values (null, true, "templateName", template_type) returning * into form;
      insert into 
        form_elements (
          form_id, 
          title, 
          description, 
          type_id, 
          is_required, 
          export_id, 
          position, 
          component_settings
        ) 
      select 
        form.id, 
        title, 
        description, 
        type_id, 
        is_required, 
        export_id, 
        position, 
        component_settings
      from
        form_elements
      where
        form_id = original_id;
      return form;
    end
  $$;


  CREATE OR REPLACE FUNCTION public.initialize_survey_form_from_template(survey_id integer, template_id integer) RETURNS public.forms
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      form forms;
    begin
      if session_is_admin((select project_id from surveys where id = survey_id)) = false then
        raise exception 'Must be project admin';
      end if;
      insert into forms (survey_id) values (survey_id) returning * into form;
      insert into 
        form_elements (
          form_id, 
          title, 
          description, 
          type_id, 
          is_required, 
          export_id, 
          position, 
          component_settings
        )
      select 
        form.id, 
        title, 
        description, 
        type_id, 
        is_required, 
        export_id, 
        position, 
        component_settings
      from
        form_elements
      where
        form_elements.form_id = template_id;
      return form;
    end
  $$;

CREATE OR REPLACE FUNCTION public.initialize_sketch_class_form_from_template(sketch_class_id integer, template_id integer) RETURNS public.forms
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      form forms;
    begin
      if session_is_admin((select project_id from sketch_classes where id = sketch_class_id)) = false then
        raise exception 'Must be project admin';
      end if;
      insert into forms (sketch_class_id) values (sketch_class_id) returning * into form;
      insert into 
        form_elements (
          form_id, 
          title, 
          description, 
          type_id, 
          is_required, 
          export_id, 
          position, 
          component_settings
        )
      select 
        form.id, 
        title, 
        description, 
        type_id, 
        is_required, 
        export_id, 
        position, 
        component_settings
      from
        form_elements
      where
        form_elements.form_id = template_id;
      return form;
    end
  $$;

CREATE OR REPLACE FUNCTION public.create_form_template_from_sketch_class("sketchClassId" integer, "templateName" text, template_type public.form_template_type) RETURNS public.forms
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      form forms;
      original_id int;
    begin
      select id into original_id from forms where sketch_class_id = "sketchClassId";
      insert into forms (sketch_class_id, is_template, template_name, template_type) values (null, true, "templateName", template_type) returning * into form;
      insert into 
        form_elements (
          form_id, 
          title, 
          description, 
          type_id, 
          is_required, 
          export_id, 
          position, 
          component_settings
        ) 
      select 
        form.id, 
        title, 
        description, 
        type_id, 
        is_required, 
        export_id, 
        position, 
        component_settings
      from
        form_elements
      where
        form_id = original_id;
      return form;
    end
  $$;
