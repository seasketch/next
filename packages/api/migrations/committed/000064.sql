--! Previous: sha1:671fde8515abe65bb5c05302c3e71a6982bfef9d
--! Hash: sha1:aab5712b0bb2543841c54fded163f1feaa4439be

-- Enter migration here
drop function if exists form_element_type;
drop function if exists form_elements_type;
alter table form_elements drop column if exists type_id;
drop table if exists form_element_types;
drop table if exists form_element_type;
create table form_element_types (
  component_name text primary key,
  label text not null unique,
  is_input boolean not null default false,
  is_surveys_only boolean not null default false,
  is_hidden boolean not null default false,
  is_single_use_only boolean not null default false
);

alter table form_elements drop column if exists type;

alter table form_elements add column type_id text not null references form_element_types(component_name) on delete cascade;

grant select on table form_element_types to anon;

create or replace function form_elements_type(e public.form_elements)
  returns form_element_types
  stable
  language sql
  security definer
  as $$
    select * from form_element_types where e.type_id = form_element_types.component_name;
$$;

grant execute on function form_elements_type to anon;


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
          name, 
          description, 
          type_id, 
          is_required, 
          export_id, 
          position, 
          component_settings
        ) 
      select 
        form.id, 
        name, 
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
          name, 
          description, 
          type_id, 
          is_required, 
          export_id, 
          position, 
          component_settings
        ) 
      select 
        form.id, 
        name, 
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
          name, 
          description, 
          type_id, 
          is_required, 
          export_id, 
          position, 
          component_settings
        )
      select 
        form.id, 
        name, 
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
          name, 
          description, 
          type_id, 
          is_required, 
          export_id, 
          position, 
          component_settings
        )
      select 
        form.id, 
        name, 
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


GRANT UPDATE(type_id) ON TABLE public.form_elements TO seasketch_user;
