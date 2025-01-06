-- Enter migration here
alter table projects add column if not exists about_page_contents jsonb not null default '{}'::jsonb;

alter table projects add column if not exists about_page_enabled boolean not null default false;