--! Previous: sha1:0f14f012c5e7d1c703275c4268969356aa2654aa
--! Hash: sha1:d9ab2b4d5877c7f8914ce68e361025c81ea28052

-- GetLayerItem reads containedBy. The old walk did not filter is_draft or
-- project_id, and it did not stop when a stable_id repeated. Draft and
-- published rows share stable_ids, so LIMIT 1 can follow a published cycle
-- even after the draft rows have been repaired.

create or replace function public.table_of_contents_items_contained_by(t public.table_of_contents_items)
returns public.table_of_contents_items[]
language plpgsql
stable
security definer
as $$
declare
  parents table_of_contents_items[];
  parent table_of_contents_items;
  seen text[] := array[t.stable_id];
begin
  if t.parent_stable_id is null then
    return null;
  end if;

  loop
    exit when t.parent_stable_id is null
      or t.parent_stable_id = any (seen)
      or cardinality(seen) > 64;

    select * into parent
    from table_of_contents_items
    where stable_id = t.parent_stable_id
      and is_draft = t.is_draft
      and project_id = t.project_id
    limit 1;

    exit when not found;

    parents := array_append(parents, parent);
    seen := seen || parent.stable_id;
    t := parent;
  end loop;

  return parents;
end;
$$;
