--! Previous: sha1:697a029523cecdd849f726650886ac4c50a27324
--! Hash: sha1:604ca18758df0eaec25644225959b9a4dd85d8bf

-- Enter migration here
alter table form_elements add column if not exists created_at timestamp not null default now();
alter table survey_consent_documents add column if not exists created_at timestamp not null default now();
