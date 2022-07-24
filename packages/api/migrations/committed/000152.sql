--! Previous: sha1:cf508692ae21c6b024f5b25ea67a93c146a20af8
--! Hash: sha1:f0f437106aed3f160ba6a9dbb8ddcefbdbdb0e7f

-- Enter migration here
drop function if exists surveys_by_ids;
drop function if exists get_all_surveys;
create or replace function get_surveys(ids int[])
  returns setof surveys
  language sql
  stable
  as $$
    select * from surveys where id = any(ids);
$$;

grant execute on function get_surveys to anon;

comment on function get_surveys is '@simpleCollections only';
