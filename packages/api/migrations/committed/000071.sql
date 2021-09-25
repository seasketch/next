--! Previous: sha1:7089b3d409d79794decbf694d531e2c4bbfc054f
--! Hash: sha1:2c882b88dde489f22b70a77097a6ae4c7cd57836

-- Enter migration here
grant delete on surveys to seasketch_user;
drop policy surveys_admin ON public.surveys;
CREATE POLICY surveys_admin ON public.surveys for all TO seasketch_user USING (public.session_is_admin(project_id)) WITH CHECK (public.session_is_admin(project_id));

CREATE OR REPLACE FUNCTION public.before_survey_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    num int;
  begin
    select count(*)::int from survey_responses into num where survey_id = OLD.id and (user_id is null or user_id != current_setting('session.user_id', TRUE)::integer);
    if num >= 5 then
      raise exception 'Preventing deletion. Survey has 5 or more responses from other users. Contact support@seasketch.org or simply disable survey.';
    end if;
    return OLD;
  end;
$$;

delete from form_element_types where component_name = 'WelcomeMessage';
insert into form_element_types (
  component_name, 
  label, 
  is_input, 
  is_surveys_only, 
  is_single_use_only
) values (
  'WelcomeMessage',
  'Welcome Message',
  false,
  true,
  true
);

delete from form_element_types where component_name = 'ShortText';
insert into form_element_types (
  component_name, 
  label, 
  is_input, 
  is_surveys_only, 
  is_single_use_only
) values (
  'ShortText',
  'Short Text',
  true,
  false,
  false
);
