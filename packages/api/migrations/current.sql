-- Enter migration here
CREATE OR REPLACE FUNCTION public.get_fragment_ids_for_sketch_recursive(sketch_id integer) RETURNS TABLE(hash text, sketches integer[], geographies integer[])
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    policy_passed boolean;
    sketch_ids integer[];
  begin
    -- Check that the session can access the given sketch using RLS policy
    policy_passed := check_sketch_rls_policy(get_fragment_ids_for_sketch_recursive.sketch_id);
    if not policy_passed then
      raise exception 'Permission denied';
    end if;

    -- get ids of all children of the sketch, if it is a collection
    -- add the sketch id to the list
    sketch_ids := array_append(sketch_ids, get_fragment_ids_for_sketch_recursive.sketch_id);
    -- get ids of all children of the sketch, if it is a collection
    sketch_ids := array_append(sketch_ids, (
      SELECT get_child_sketches_recursive(get_fragment_ids_for_sketch_recursive.sketch_id, 'sketch')
    ));

    return query
    SELECT
    fragments.hash,
    ARRAY(
      SELECT sketch_fragments.sketch_id
      FROM sketch_fragments
      WHERE sketch_fragments.fragment_hash = fragments.hash AND sketch_fragments.sketch_id = ANY(get_fragment_ids_for_sketch_recursive.sketch_ids)
    ) AS sketches,
    ARRAY(
      SELECT fragment_geographies.geography_id
      FROM fragment_geographies
      WHERE fragment_geographies.fragment_hash = fragments.hash) AS geographies
    FROM fragments
    WHERE
    EXISTS (
      SELECT 1
      FROM sketch_fragments
      WHERE sketch_fragments.fragment_hash = fragments.hash
        AND sketch_fragments.sketch_id = ANY(get_fragment_ids_for_sketch_recursive.sketch_ids)
    );
  end;
  $$;

grant execute on function public.get_fragment_ids_for_sketch_recursive to anon;
comment on function public.get_fragment_ids_for_sketch_recursive is '@omit';

create or replace function sketches_related_fragments(sketch sketches) returns table(hash text, sketches integer[], geographies integer[])
    language sql
    stable
    as $$
      select * from get_fragment_ids_for_sketch_recursive(sketch.id);
  $$;

grant execute on function public.sketches_related_fragments to anon;

comment on function public.sketches_related_fragments is '@simpleCollections only';

create or replace function sketches_siblings(sketch sketches) returns
  setof sketches
  language plpgsql
  security definer
  stable
  as $$
  declare
    policy_passed boolean;
    collection_id integer;
  begin
    policy_passed := check_sketch_rls_policy(sketch.id);
    if not policy_passed then
      raise exception 'Permission denied';
    end if;
    

    collection_id := coalesce(get_parent_collection_id(sketch),sketch.id);

    return query
    select * from sketches
    where
      id = any(select get_child_sketches_recursive(collection_id, 'sketch'));
  end;
  $$;

grant execute on function public.sketches_siblings to anon;

comment on function public.sketches_siblings is '@simpleCollections only';

create or replace function sketches_children(sketch sketches) returns
  setof sketches
  language plpgsql
  security definer
  stable
  as $$
  declare
    policy_passed boolean;
  begin
    policy_passed := check_sketch_rls_policy(sketch.id);
    if not policy_passed then
      raise exception 'Permission denied';
    end if;
    return query
    select * from sketches
    where
      id = any(select get_child_sketches_recursive(sketch.id, 'sketch'));
  end;
  $$;

grant execute on function public.sketches_children to anon;

comment on function public.sketches_children is '@simpleCollections only';