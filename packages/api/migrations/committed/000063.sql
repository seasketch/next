--! Previous: sha1:1e03200a7cd1c8e5db9df39ffa074e95c18a189c
--! Hash: sha1:671fde8515abe65bb5c05302c3e71a6982bfef9d

-- Enter migration here
alter table if exists form_fields rename to form_elements;

DROP FUNCTION IF EXISTS set_form_field_order;
DROP FUNCTION IF EXISTS set_form_element_order;
CREATE FUNCTION public.set_form_element_order("elementIds" integer[]) RETURNS SETOF public.form_elements
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
      return query select * from form_elements where form_elements.form_id = form_id order by position asc;
    end
  $$;

grant execute on function set_form_element_order to seasketch_user;

comment on function set_form_element_order is '
Sets the positions of all elements in a form at once. Any missing element ids from
the input will be positioned at the end of the form.

Use this instead of trying to manage the position of form elements individually.
';

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
          type, 
          is_required, 
          export_id, 
          position, 
          component_settings
        ) 
      select 
        form.id, 
        name, 
        description, 
        type, 
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
          type, 
          is_required, 
          export_id, 
          position, 
          component_settings
        ) 
      select 
        form.id, 
        name, 
        description, 
        type, 
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
          type, 
          is_required, 
          export_id, 
          position, 
          component_settings
        )
      select 
        form.id, 
        name, 
        description, 
        type, 
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
          type, 
          is_required, 
          export_id, 
          position, 
          component_settings
        )
      select 
        form.id, 
        name, 
        description, 
        type, 
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


CREATE OR REPLACE FUNCTION public.project_id_from_field_id(fid integer) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    select project_id_for_form_id((select form_id from form_elements where form_elements.id = fid))
  $$;





COMMENT ON COLUMN public.form_elements."position" IS '
Determines order of field display. Clients should display fields in ascending 
order. Cannot be changed individually. Use `setFormElementOrder()` mutation to 
update.
';

COMMENT ON TABLE public.forms IS '
@omit all
Custom user-input Forms are used in two places in SeaSketch. For SketchClasses,
Forms are used to add attributes to spatial features. In Surveys, Forms are used
in support of gathering response data.

Forms have any number of *FormElements* ordered by a `position` field, and form 
contents may be hidden depending on the evaluation of *FormConditionalRenderingRules*.

Forms typically belong to either a *Survey* or *SketchClass* exclusively. Some
Forms may be designated as a template, in which case they belong to neither. 
Only superusers can create form templates, and clients should provide templates
as an option when creating new forms.
';

COMMENT ON TABLE public.form_elements IS '
@omit all
*FormElements* represent input fields or read-only content in a form. Records contain fields to support
generic functionality like name, description, position, and isRequired. They 
also have a JSON `componentSettings` field that can have custom data to support
a particular input type, indicated by the `type` field.

Project administrators have full control over managing form elements through
graphile-generated CRUD mutations.
';


GRANT SELECT ON TABLE public.form_elements TO anon;
GRANT INSERT,DELETE ON TABLE public.form_elements TO seasketch_user;
GRANT UPDATE(name) ON TABLE public.form_elements TO seasketch_user;
GRANT UPDATE(description) ON TABLE public.form_elements TO seasketch_user;
GRANT UPDATE(type) ON TABLE public.form_elements TO seasketch_user;
GRANT UPDATE(is_required) ON TABLE public.form_elements TO seasketch_user;
GRANT UPDATE(export_id) ON TABLE public.form_elements TO seasketch_user;
GRANT UPDATE("position") ON TABLE public.form_elements TO seasketch_user;
GRANT UPDATE(component_settings) ON TABLE public.form_elements TO seasketch_user;
