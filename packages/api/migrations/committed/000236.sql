--! Previous: sha1:173fa4631e9a2e65fca53cc0d2c40dc89e0d28d2
--! Hash: sha1:0d0e27944fcdceb0b43705ab232737cd2ad27f2f

-- Enter migration here
alter table projects add column if not exists supported_languages text[] not null default '{}'::text[];

grant select(supported_languages) on projects to anon;

create or replace function toggle_language_support(slug text, code text, enable boolean)
  returns projects
  language sql
  security definer
  as $$
    update projects 
      set supported_languages = case
        when enable then array_append(array_remove(projects.supported_languages, code), code)
        else array_remove(projects.supported_languages, code)
      end
    where 
      projects.slug = toggle_language_support.slug and 
      session_is_admin(projects.id)
    returning *;
  $$;

grant execute on function toggle_language_support to seasketch_user;

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
        insert into surveys (name, project_id, supported_languages) values (name, project_id, (select projects.supported_languages from projects where projects.id = _create_survey.project_id)) returning id into surveyid;
        perform initialize_survey_form_from_template(surveyid, templateid);
        select * into survey from surveys where id = surveyid;
        return survey;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;
