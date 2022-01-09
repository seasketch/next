--! Previous: sha1:0116bf55da836c8e9ceaa653169fa082ef183391
--! Hash: sha1:f1f4cf82373d47ce0df2c9bda194d29effe190c4

-- Enter migration here
alter table surveys add column if not exists supported_languages text[] not null default '{}'::text[];

alter table form_elements add column if not exists alternate_language_settings jsonb not null default '{}'::jsonb;
