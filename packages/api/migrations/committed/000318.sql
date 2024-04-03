--! Previous: sha1:d0bf8535ff626e18c3341bda495d1df1361969c5
--! Hash: sha1:9e78beeed856232eab9bed7ca8934c3afbfa78a6

-- Enter migration here
drop function if exists dashboard_stats;
drop type if exists dashboard_stats;
create type dashboard_stats as (
  users integer,
  projects integer,
  uploads int,
  uploaded_bytes bigint,
  sketches int,
  forum_posts int,
  data_sources int
);

create or replace function dashboard_stats()
  returns dashboard_stats
  language plpgsql
  stable
  security definer
  as $$
  declare
    result dashboard_stats;
  begin
    if session_is_superuser() then
      select into result * from ( select
        (select count(*)::int from users) as users,
        (select count(*)::int from projects) as projects,
        (select count(*)::int from data_sources where uploaded_by is not null) as uploads,
        (select sum(size)::bigint from data_upload_outputs) as uploaded_bytes,
        (select count(*)::int from sketches) as sketches,
        (select count(*)::int from posts) as forum_posts,
        (select count(*)::int from data_sources) as data_sources) as foo;
      return result;
    else
      raise exception 'Permission denied';
    end if;
  end;
  $$;

grant execute on function dashboard_stats to seasketch_user;
