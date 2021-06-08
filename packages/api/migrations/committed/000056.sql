--! Previous: sha1:baeb3e1d916a2602b914a7c8ee12ea9197ad4304
--! Hash: sha1:8c54281c4bb58ca5408b8da089e2581ffd116f0c

-- Enter migration here
drop function get_project_id(text);
create or replace function get_project_id(_slug text) returns int
  security definer
  language sql
  stable as $$
    select id from projects where projects.slug = _slug;
$$;

grant execute on function get_project_id to anon;
comment on function get_project_id is '@omit';
