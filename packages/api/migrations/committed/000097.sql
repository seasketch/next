--! Previous: sha1:2a911af9cfb7fa75e232790171a67e59b722a836
--! Hash: sha1:3ae5dab33cd5d1ee6f86aeb29b609c2a253b0c5e

-- Enter migration here

-- create an internal root user and superuser project to manage sketch class and survey templates

insert into users (sub, canonical_email) values ('seasketch|root', 'admin@seasketch.org') on conflict do nothing;

alter table projects alter column data_sources_bucket_id drop not null;

insert into projects (name, slug, creator_id, support_email, is_listed) values ('superuser', 'superuser', (select id from users where canonical_email = 'admin@seasketch.org' and sub = 'seasketch|root'), 'admin@seasketch.org', false) on conflict do nothing;

-- create surveys Basic Template if does not exist
do $$
    declare survey_id int;
    declare form_id int;
    declare project_id int;
    begin
        delete from surveys where name = 'Basic Template' and surveys.project_id = (select id from projects where slug = 'superuser');
        select id into project_id from projects where projects.slug = 'superuser';
        insert into surveys (project_id, name) values (project_id, 'Basic Template') returning id into survey_id;
        insert into forms (survey_id) values (survey_id) returning id into form_id;
        update forms set is_template = true, template_type = 'SURVEYS', template_name = 'Basic Template' where id = form_id;
        insert into form_elements (form_id, component_settings, type_id, body) values (form_id, '{"beginButtonText": "Begin"}'::jsonb, 'WelcomeMessage', '{"type": "doc", "content": [{"type": "heading", "attrs": {"level": 1}, "content": [{"text": "Welcome to the Survey", "type": "text"}]}, {"type": "paragraph", "content": [{"text": "Please describe your survey to potential respondents here.", "type": "text"}]}]}'::jsonb);
        insert into form_elements (form_id, component_settings, type_id, body) values (form_id, '{}'::jsonb, 'ShortText', '{"type": "doc", "content": [{"type": "question"}]}'::jsonb);
        insert into form_elements (form_id, component_settings, type_id, body) values (form_id, '{}'::jsonb, 'ThankYou', '{"type": "doc", "content": [{"type": "heading", "attrs": {"level": 1}, "content": [{"text": "Thank You for Responding", "type": "text"}]}, {"type": "paragraph","content": [{"text": "Use this page to show a ", "type": "text"}, {"text": "customized","type": "text", "marks": [{"type": "em"}]}, {"text": " message when users finish the survey.", "type": "text"}]}]}');
    end;
$$;
