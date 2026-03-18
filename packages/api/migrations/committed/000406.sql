--! Previous: sha1:3ee6831408f1f9353839d9f0c4c1f7f6c2567ac7
--! Hash: sha1:b36dcf179468a00d504503e3b30db784d847b01a

-- update_sketch_fragments: drop postgres/session_user bypass (SECURITY DEFINER + test pool
-- as postgres made those checks wrong). Worker sets session.user_id to sketch owner instead.

CREATE OR REPLACE FUNCTION public.update_sketch_fragments(p_sketch_id integer, p_fragments public.fragment_input[], p_fragment_deletion_scope text[] DEFAULT NULL::text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_fragment fragment_input;
  v_hash text;
  v_existing_fragment_hashes text[];
  v_user_id int;
  v_geography_id int;
begin
  v_user_id := nullif(current_setting('session.user_id', TRUE), '')::int;

  if not exists (
    select 1 from sketches
    where id = p_sketch_id
    and user_id = v_user_id
  ) then
    raise exception 'Permission denied';
  end if;

  begin
    select array_agg(fragment_hash) into v_existing_fragment_hashes
    from sketch_fragments
    where sketch_id = p_sketch_id;

    foreach v_fragment in array p_fragments
    loop
      v_hash := md5(st_asbinary(st_normalize(v_fragment.geometry)));

      if not exists (select 1 from fragments where hash = v_hash) then
        insert into fragments (geometry)
        values (v_fragment.geometry);
      end if;

      insert into sketch_fragments (sketch_id, fragment_hash)
      values (p_sketch_id, v_hash)
      on conflict (sketch_id, fragment_hash) do nothing;

      delete from fragment_geographies
      where fragment_hash = v_hash;

      foreach v_geography_id in array v_fragment.geography_ids
      loop
        insert into fragment_geographies (fragment_hash, geography_id)
        values (v_hash, v_geography_id);
      end loop;
    end loop;

    delete from sketch_fragments
    where sketch_id = p_sketch_id
    and fragment_hash not in (
      select md5(st_asbinary(st_normalize((unnest(p_fragments)).geometry)))
    )
    and (
      p_fragment_deletion_scope is null
      or
      fragment_hash = any(p_fragment_deletion_scope)
    );

    delete from fragments
    where hash in (
      select f.hash
      from fragments f
      left join sketch_fragments sf on f.hash = sf.fragment_hash
      where sf.fragment_hash is null
    );

  exception
    when others then
      raise exception 'Error updating sketch fragments: %', sqlerrm;
  end;
end;
$$;
