--! Previous: sha1:a3c7e3102356eb32f9b052c1baa280ab994ecfe8
--! Hash: sha1:0f14f012c5e7d1c703275c4268969356aa2654aa

-- QuotaUsageDetails calls table_of_contents_items_breadcrumbs once per draft
-- item. A parent_stable_id cycle makes that recursive walk run until the
-- connection dies and the API process exits. Stop at a repeated stable_id.
-- Also refuse moves that would put an item inside its own subtree.

create or replace function public.table_of_contents_items_breadcrumbs(item public.table_of_contents_items)
returns setof public.folder_breadcrumbs
language sql
stable
security definer
as $$
  with recursive breadcrumbs as (
    select
      0 as position,
      id,
      title,
      parent_stable_id,
      stable_id,
      array[stable_id] as seen
    from table_of_contents_items
    where id = item.id
      and is_draft = item.is_draft
      and project_id = item.project_id
    union all
    select
      b.position + 1,
      t.id,
      t.title,
      t.parent_stable_id,
      t.stable_id,
      b.seen || t.stable_id
    from breadcrumbs b
    join table_of_contents_items t
      on t.stable_id = b.parent_stable_id
     and t.is_draft = item.is_draft
     and t.project_id = item.project_id
     and not t.stable_id = any (b.seen)
     and b.position < 64
  )
  select id, stable_id, title
  from breadcrumbs
  where position > 0
  order by position desc;
$$;

create or replace function public.update_table_of_contents_item_position("itemId" integer, "parentStableId" text, "sortIndex" integer)
returns public.table_of_contents_items
language plpgsql
security definer
as $$
declare
  pid int;
  parent_path ltree;
  current_path ltree;
  item table_of_contents_items;
begin
  select project_id into pid from table_of_contents_items where id = "itemId" and is_draft = true;
  if pid is null then
    raise 'Could not find draft item with id = %', "itemId";
  end if;
  if session_is_admin(pid) = false then
    raise 'Permission denied';
  end if;
  select path into current_path from table_of_contents_items where id = "itemId" and is_draft = true;

  if "parentStableId" is not null then
    select path into parent_path
    from table_of_contents_items
    where is_draft = true and project_id = pid and stable_id = "parentStableId";
    if parent_path is null then
      raise 'Could not find valid parent with stable_id=%', "parentStableId";
    end if;
    -- parent_path <@ current_path is true when the new parent is this item
    -- or one of its descendants. That move closes a cycle.
    if parent_path <@ current_path then
      raise 'Cannot move an item into itself or one of its subfolders';
    end if;
  end if;

  update table_of_contents_items
  set parent_stable_id = "parentStableId", sort_index = "sortIndex"
  where id = "itemId"
    and (
      parent_stable_id is distinct from "parentStableId"
      or sort_index is distinct from "sortIndex"
    );

  if "parentStableId" is not null then
    update table_of_contents_items
    set path = parent_path || subpath(path, nlevel(current_path) - 1)
    where is_draft = true and path <@ current_path;
  else
    update table_of_contents_items
    set path = subpath(path, nlevel(current_path) - 1)
    where is_draft = true and path <@ current_path;
  end if;

  select * into item from table_of_contents_items where id = "itemId";
  return item;
end;
$$;
