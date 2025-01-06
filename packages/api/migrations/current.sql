-- Enter migration here
alter table projects add column if not exists about_page_contents jsonb not null default '{}'::jsonb;

alter table projects add column if not exists about_page_enabled boolean not null default false;

create or replace function update_about_page_content(slug text, content jsonb, lang text)
  returns projects
  language sql
  security definer
  as $$
    update projects
    set about_page_contents = jsonb_set(about_page_contents, array[lang], content)
    where projects.slug = update_about_page_content.slug
    and session_is_admin(projects.id)
    returning *;
  $$;

grant execute on function update_about_page_content(text, jsonb, text) to seasketch_user;

create or replace function update_about_page_enabled(slug text, enabled boolean)
  returns projects
  security definer
  language sql
  as $$
    update projects
    set about_page_enabled = enabled
    where projects.slug = update_about_page_enabled.slug
    and session_is_admin(projects.id)
    returning *;
  $$;

grant execute on function update_about_page_enabled(text, boolean) to seasketch_user;