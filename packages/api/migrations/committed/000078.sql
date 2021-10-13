--! Previous: sha1:35a7f940539212d8afd860d3df772321d68c22ce
--! Hash: sha1:432d19a30f639fb3d7a7fabf6dd530c5cd0a7aab

-- Enter migration here
create or replace function surveys_is_template(survey surveys)
  returns boolean
  stable
  language sql
  security definer
  as $$
    select is_template from forms where survey_id = survey.id;
  $$;

grant execute on function surveys_is_template to anon;

grant update on forms to seasketch_superuser;

create or replace function _create_survey(name text, project_id int, template_id int default null)
  returns surveys
  language plpgsql
  security definer
  as $$
    declare
      surveyid int;
      templateid int;
      survey surveys;
    begin
      if template_id is null then
        select id into templateid from forms where template_name = 'Basic Template';
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

drop function if exists make_survey(text, int);

create or replace function make_survey(name text, project_id int, template_id int)
  returns surveys
  language sql
  security definer
  as $$
    select _create_survey(name, project_id, template_id);
$$;

grant execute on function make_survey(text, int, int) to seasketch_user;

-- create or replace function make_survey(name text, project_id int)
--   returns surveys
--   language sql
--   security definer
--   as $$
--     select _create_survey(name, project_id);
-- $$;

-- grant execute on function make_survey(text, int) to seasketch_user;

revoke execute on function initialize_survey_form_from_template from seasketch_user;
revoke execute on function initialize_blank_survey_form from seasketch_user;
grant execute on function initialize_sketch_class_form_from_template to seasketch_user;
grant execute on function initialize_blank_sketch_class_form to seasketch_user;
