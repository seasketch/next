--! Previous: sha1:2b28e4889d461aeb0e2e3e3382bb69863432c63b
--! Hash: sha1:2ca2fd961964107591546ea8a56a3caae241ae1e

-- Enter migration here
CREATE OR REPLACE FUNCTION public.security_definer_get_children_of_folder("folderId" integer) RETURNS TABLE(id integer, type public.sketch_child_type, name text, is_leaf boolean)
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
  begin
    return query select
      sketches.id as id,
      'sketch'::sketch_child_type as type,
      sketches.name,
      is_collection(sketches.sketch_class_id) = false as is_leaf
    from sketches
    where
      folder_id = "folderId"
    union ALL
    select
      sketch_folders.id,
      'sketch_folder'::sketch_child_type as type,
      sketch_folders.name,
      false as is_leaf
    from sketch_folders
    where
      folder_id = "folderId";
  end;
  $$;


CREATE OR REPLACE FUNCTION public.security_definer_get_children_of_collection("collectionId" integer) RETURNS TABLE(id integer, type public.sketch_child_type, name text, is_leaf boolean)
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
  begin
    return query select
      sketches.id as id,
      'sketch'::sketch_child_type as type,
      sketches.name,
      is_collection(sketches.sketch_class_id) = false as is_leaf
    from sketches
    where
      collection_id = "collectionId"
    union ALL
    select
      sketch_folders.id as id,
      'sketch_folder'::sketch_child_type as type,
      sketch_folders.name,
      false as is_leaf
    from sketch_folders
    where
      collection_id = "collectionId";
  end;
  $$;


CREATE OR REPLACE FUNCTION security_definer_get_child_sketches_recursive(parent_id integer, child_type public.sketch_child_type) RETURNS integer[]
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
  declare
    ids int[] = '{}';
    child_ids int[];
    child record;
  begin
    if child_type = 'sketch' then
      FOR child IN SELECT * FROM security_definer_get_children_of_collection(parent_id)
      LOOP
      if child.type = 'sketch' and child.is_leaf then
        ids := ids || child.id;
      end if;
      if child.is_leaf = false then
        select security_definer_get_child_sketches_recursive(child.id, child.type) into child_ids;
        ids := ids || child_ids;
      end if;
      END LOOP;
    else
      FOR child IN SELECT * FROM security_definer_get_children_of_folder(parent_id)
      LOOP
      if child.type = 'sketch' and child.is_leaf then
        ids := ids || child.id;
      end if;
      if child.is_leaf = false then
        select security_definer_get_child_sketches_recursive(child.id, child.type) into child_ids;
        ids := ids || child_ids;
      end if;
      END LOOP;
    end if;
    return ids;
  end;
  $$;

grant execute on function public.security_definer_get_child_sketches_recursive to anon;
grant execute on function public.security_definer_get_children_of_folder to anon;
grant execute on function public.security_definer_get_children_of_collection to anon;

comment on function security_definer_get_child_sketches_recursive is '@omit';
comment on function security_definer_get_children_of_folder is '@omit';
comment on function security_definer_get_children_of_collection is '@omit';


CREATE OR REPLACE FUNCTION public.get_fragment_ids_for_sketch_recursive(sketch_id integer) RETURNS TABLE(hash text, sketches integer[], geographies integer[])
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    policy_passed boolean;
    sketch_ids integer[];
  begin
    -- Check that the session can access the given sketch using RLS policy
    policy_passed := check_sketch_rls_policy(sketch_id);
    if not policy_passed then
      raise exception 'Permission denied';
    end if;

    -- get ids of all children of the sketch, if it is a collection
    -- initialize and add the sketch id to the list
    sketch_ids := ARRAY[]::integer[];
    sketch_ids := array_append(sketch_ids, sketch_id);
    -- concatenate ids of all children of the sketch, if it is a collection
    sketch_ids := array_cat(
      sketch_ids,
      coalesce((
        SELECT security_definer_get_child_sketches_recursive(sketch_id, 'sketch')
      ), ARRAY[]::integer[])
    );

    return query
    SELECT
    fragments.hash,
    ARRAY(
      SELECT sketch_fragments.sketch_id
      FROM sketch_fragments
      WHERE sketch_fragments.fragment_hash = fragments.hash AND sketch_fragments.sketch_id = ANY(sketch_ids)
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
        AND sketch_fragments.sketch_id = ANY(sketch_ids)
    );
  end;
  $$;

create or replace function get_fragment_hashes_for_sketch(sketch_id integer) returns text[]
  language plpgsql
  security definer
  stable
  as $$
    declare
    fragment_hashes text[];
    policy_passed boolean;
    sketch_ids integer[];
  begin
    policy_passed := check_sketch_rls_policy(sketch_id);
    if not policy_passed then
      raise exception 'Permission denied';
    end if;
-- get ids of all children of the sketch, if it is a collection
    -- initialize and add the sketch id to the list
    sketch_ids := ARRAY[]::integer[];
    sketch_ids := array_append(sketch_ids, sketch_id);
    -- concatenate ids of all children of the sketch, if it is a collection
    sketch_ids := array_cat(
      sketch_ids,
      coalesce((
        SELECT security_definer_get_child_sketches_recursive(sketch_id, 'sketch')
      ), ARRAY[]::integer[])
    );
    select array_agg(fragment_hash) into fragment_hashes
    from fragments
    inner join sketch_fragments on sketch_fragments.fragment_hash = fragments.hash
    where sketch_fragments.sketch_id = any(sketch_ids);
    return fragment_hashes;
  end;
  $$;


CREATE OR REPLACE FUNCTION public.sketches_siblings(sketch public.sketches)
RETURNS SETOF public.sketches
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  policy_passed boolean;
  coll_id integer;
BEGIN
  policy_passed := check_sketch_rls_policy(sketch.id);
  IF NOT policy_passed THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  coll_id := COALESCE(get_parent_collection_id(sketch), sketch.id);

  RETURN QUERY
  WITH wanted(id) AS (
    SELECT unnest(
      COALESCE(security_definer_get_child_sketches_recursive(coll_id, 'sketch'), '{}')
    )
  )
  SELECT s.*
  FROM public.sketches s
  JOIN wanted w ON w.id = s.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sketches_children(sketch public.sketches)
RETURNS SETOF public.sketches
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  policy_passed boolean;
BEGIN
  policy_passed := check_sketch_rls_policy(sketch.id);
  IF NOT policy_passed THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  WITH wanted(id) AS (
    SELECT unnest(
      COALESCE(security_definer_get_child_sketches_recursive(sketch.id, 'sketch'), '{}')
    )
  )
  SELECT s.*
  FROM public.sketches s
  JOIN wanted w ON w.id = s.id;
END;
$$;

create index if not exists sketches_folder_id_idx on sketches (folder_id);
