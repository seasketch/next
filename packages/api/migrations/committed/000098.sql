--! Previous: sha1:3ae5dab33cd5d1ee6f86aeb29b609c2a253b0c5e
--! Hash: sha1:18575f50269f64c9f93bfb47260bd4e616428eec

-- Enter migration here

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'form_element_background_image_placement') THEN
      alter type form_element_background_image_placement rename to form_element_layout;
    END IF;
    --more types here...
END$$;
DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='form_elements' and column_name='background_image_placement')
  THEN
      ALTER TABLE "public"."form_elements" RENAME COLUMN "background_image_placement" TO "layout";
  END IF;
END $$;

alter table form_elements alter column layout drop default;
alter table form_elements alter column layout drop not null;

ALTER TYPE form_element_layout ADD VALUE if not exists 'MAP_STACKED';
ALTER TYPE form_element_layout ADD VALUE if not exists 'MAP_SIDEBAR_LEFT';
ALTER TYPE form_element_layout ADD VALUE if not exists 'MAP_SIDEBAR_RIGHT';

drop function if exists create_form_element_associated_sketch_class cascade;

alter table sketch_classes add column if not exists form_element_id int unique references form_elements(id) on delete cascade;

create index on sketch_classes(form_element_id);

comment on column sketch_classes.form_element_id is '
If set, this sketch class is only for use in a survey indicated by the form_element.
';

comment on constraint sketch_classes_form_element_id_fkey on sketch_classes is '
@omit many
';

update projects set is_listed = false where slug = 'superuser';

drop trigger if exists before_delete_sketch_class_001 on sketch_classes;
create or replace function before_delete_sketch_class_check_form_element_id() returns trigger
  language plpgsql
  as $$
  begin
    if (OLD.form_element_id is not null and (select count(*) from form_elements where id = OLD.form_element_id) > 0) then
      raise exception 'Sketch Class is associated with a form element. Delete form element first';
    end if;
    return OLD;
    end;
  $$;

CREATE TRIGGER before_delete_sketch_class_001
   BEFORE DELETE ON sketch_classes FOR EACH ROW
   EXECUTE PROCEDURE before_delete_sketch_class_check_form_element_id();

alter table sketch_classes drop column if exists is_my_plans_option;


alter table form_element_types add column if not exists allowed_layouts form_element_layout[];

alter table form_element_types add column if not exists is_spatial boolean not null default false;
alter table form_element_types drop column if exists sketch_class_template_id;
alter table form_element_types add column if not exists sketch_class_template_id int references sketch_classes(id) on delete cascade;

delete from form_element_types where component_name = 'SingleSpatialInput';
delete from form_element_types where component_name = 'FeatureName';

alter table form_element_types add column if not exists is_required_for_sketch_classes boolean not null default false;

alter table sketches add column if not exists survey_response_id int references survey_responses (id) on delete cascade;

-- TODO: add means to access sketches if anon using a token

alter table sketches add column if not exists attributes jsonb not null default '{}'::jsonb;

create or replace function form_elements_sketch_class(form_element form_elements)
  returns sketch_classes
  language sql
  stable
  as $$
    select * from sketch_classes where sketch_classes.form_element_id = form_element.id limit 1;
$$;

grant execute on function form_elements_sketch_class to anon;

comment on function form_elements_sketch_class is '
Sketch Class to be used in conjuction with a form element that supports spatial feature input.
';

CREATE OR REPLACE FUNCTION public.session_can_access_form(fid integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select session_is_admin((select project_id_for_form_id(fid))) or 
    session_has_survey_invite((select survey_id from forms where id = fid)) or
    (
      session_has_project_access((select project_id_for_form_id(fid))) and (
        session_on_acl((
          select 
            id 
          from 
            access_control_lists 
          where 
            access_control_lists.sketch_class_id is not null and
            access_control_lists.sketch_class_id = (select sketch_class_id from forms where id = fid)
        )) or (
          exists(
            select
              id
            from
              surveys
            where
              id = (select survey_id from forms where forms.id = fid) and
              (
                is_disabled = false and (
                  access_type = 'PUBLIC' or session_in_group(survey_group_ids(surveys.id))
                )
              )
          )
        )
      )
    )
  $$;

create or replace function create_form_element_associated_sketch_class()
  returns trigger
  security definer
  language plpgsql
  as $$
    declare
      pid int;
      template_id int;
      s boolean;
      sc sketch_classes;
    begin
      select sketch_class_template_id, form_element_types.is_spatial into template_id, s from form_element_types where component_name = NEW.type_id;
      if s = true then
        select project_id into pid from surveys where id = (
          select survey_id from forms where id = NEW.form_id limit 1
        );
        if pid is null then
          raise exception 'project_id is null %, %', NEW.form_id, NEW;
        end if;
        -- raise log 'template %, %', (select allow_multi from sketch_classes where sketch_classes.id = template_id), template_id;
        -- raise log 'results % - %', template_id, (select row_to_json(T.*) from (select
        --   pid,
        --   'generated',
        --   NEW.id,
        --   geometry_type,
        --   allow_multi,
        --   geoprocessing_project_url, 
        --   geoprocessing_client_url, 
        --   geoprocessing_client_name, 
        --   mapbox_gl_style
        -- from sketch_classes
        -- where sketch_classes.id = template_id) as T);
        insert into sketch_classes (
          project_id, 
          name, 
          form_element_id,
          geometry_type, 
          allow_multi, 
          geoprocessing_project_url, 
          geoprocessing_client_url, 
          geoprocessing_client_name, 
          mapbox_gl_style
        ) (select
            pid,
            format('generated-form-element-%s', NEW.id),
            NEW.id,
            geometry_type,
            allow_multi,
            geoprocessing_project_url, 
            geoprocessing_client_url, 
            geoprocessing_client_name, 
            mapbox_gl_style
          from sketch_classes
          where sketch_classes.id = template_id)
          returning * into sc;
          perform initialize_sketch_class_form_from_template(sc.id, (
            select id from forms where sketch_class_id = template_id
          ));
      end if;
      return NEW;
    end;
  $$;

CREATE TRIGGER form_element_associated_sketch_class
AFTER INSERT ON form_elements
FOR EACH ROW
EXECUTE PROCEDURE create_form_element_associated_sketch_class();

grant update(geometry_type) on sketch_classes to seasketch_user;
grant update(mapbox_gl_style) on sketch_classes to seasketch_user;

CREATE OR REPLACE FUNCTION public._create_survey(name text, project_id integer, template_id integer DEFAULT NULL::integer) RETURNS public.surveys
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      surveyid int;
      templateid int;
      survey surveys;
    begin
      if template_id is null then
        select id into templateid from forms where template_name = 'Basic Template' and template_type = 'SURVEYS';
        if templateid is null then
          raise exception 'Form template with name "Basic Template" has not been created!';
        end if;
      else
        templateid = template_id;
      end if;
      if session_is_admin(project_id) then
        insert into surveys (name, project_id) values (name, project_id) returning id into surveyid;
        perform initialize_survey_form_from_template(surveyid, templateid);
        select * into survey from surveys where id = surveyid;
        return survey;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

CREATE OR REPLACE FUNCTION public._create_sketch_class(name text, project_id integer, form_element_id integer DEFAULT NULL::integer, template_id integer DEFAULT NULL::integer) RETURNS public.sketch_classes
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      sc_id int;
      templateid int;
      sketch_class sketch_classes;
      geometrytype sketch_geometry_type;
      multi boolean;
      project_url text;
      client_name text;
      client_url text;
      gl_style jsonb;
    begin
      if template_id is null then
        select id, sketch_class_id into templateid, sc_id from forms where template_name = 'Basic Template' and template_type = 'SKETCHES';
        if templateid is null then
          raise exception 'Form template with name "Basic Template" has not been created!';
        end if;
      else
        templateid = template_id;
      end if;

      select geometry_type, is_multi, geoprocessing_project_url, geoprocessing_client_name, geoprocessing_client_url, mapbox_gl_style into geometrytype, multi, project_url, client_name, client_url, gl_style from sketch_classes where id = sc_id;

      if session_is_admin(project_id) then
        insert into sketch_classes (name, project_id, geometry_type, is_multi, geoprocessing_project_url, geoprocessing_client_name, geoprocessing_client_url, mapbox_gl_style, form_element_id) values ('generated_from_template', project_id, geometrytype, multi, project_url, client_name, client_url, gl_style, form_element_id) returning id into sc_id;
        perform initialize_sketch_class_form_from_template(sc_id, templateid);
        select * into sketch_class from sketch_classes where id = sc_id;
        return sketch_class;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

create or replace function make_sketch_class(name text, project_id integer, template_id integer)
  returns sketch_classes
  language sql
  security definer
  as $$
    select _create_sketch_class(name, project_id, null, template_id);
$$;

grant execute on function make_sketch_class to seasketch_user;

comment on function initialize_blank_sketch_class_form is '@omit';
comment on function initialize_blank_survey_form is '@omit';
comment on function initialize_survey_form_from_template is '@omit';
comment on function initialize_sketch_class_form_from_template is '@omit';

-- delete/hide existing initialization functions
COMMENT ON TABLE public.sketch_classes IS '
@omit all,create
Sketch Classes act as a schema for sketches drawn by users.
';
COMMENT ON TABLE public.surveys IS '
@simpleCollections only
@omit all,create
';


-- TODO: enforce allowed_layouts
DROP TRIGGER if exists form_elements_check_allowed_layouts_002 on form_elements;
CREATE OR REPLACE FUNCTION check_allowed_layouts() RETURNS trigger AS $$
    BEGIN
        if (select NEW.layout is null or allowed_layouts is null or NEW.layout = any(allowed_layouts) from form_element_types where component_name = NEW.type_id) then
          return NEW;
        else
          raise exception '% is not an allowed layout for this component', NEW.layout;
        end if;
    END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER form_elements_check_allowed_layouts_002 BEFORE INSERT OR UPDATE ON form_elements
    FOR EACH ROW EXECUTE PROCEDURE check_allowed_layouts();
