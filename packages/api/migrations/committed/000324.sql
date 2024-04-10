--! Previous: sha1:b312fe5e6e7f890462ce77f2179bd202b90837ed
--! Hash: sha1:b82a912cd7e5484ad4decb12c0d3b45d4b9dd9c0

-- Enter migration here

drop function if exists dashboard_stats;
drop type if exists dashboard_stats;
CREATE TYPE public.dashboard_stats AS (
	users integer,
	projects integer,
	uploads integer,
	uploaded_bytes bigint,
	sketches integer,
	forum_posts integer,
	data_sources integer,
  survey_responses integer
);

CREATE FUNCTION public.dashboard_stats() RETURNS public.dashboard_stats
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
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
        (select count(*)::int from data_sources) as data_sources,
        (select count(*)::int from survey_responses) as survey_responses
        ) as foo;
      return result;
    else
      raise exception 'Permission denied';
    end if;
  end;
  $$;

grant execute on function dashboard_stats to seasketch_user;
