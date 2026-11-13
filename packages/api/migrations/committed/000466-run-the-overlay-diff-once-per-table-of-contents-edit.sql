--! Previous: sha1:98b3f127dabc19ee91061d5172d32994703a636a
--! Hash: sha1:124f40b84abc1c39c3abd5a1f262c7b02642ec76
--! Message: Run the overlay diff once per table of contents edit

-- Dragging a folder was rewriting every descendant row, and each of those
-- rows reran overlay_list_has_unpublished_changes. On a large project that is
-- one full draft-vs-published diff per layer. Reorders do not change paths, so
-- skip that rewrite. When a statement does touch many rows, diff once for the
-- statement. Loops that issue a statement per layer defer that diff and run it
-- once at the end.

create or replace function public.refresh_draft_table_of_contents_has_changes(p_project_id integer)
  returns void
  language plpgsql
  security definer
  set search_path to public, pg_temp
as $$
begin
  if p_project_id is null then
    return;
  end if;
  update projects
  set draft_table_of_contents_has_changes =
    public.overlay_list_has_unpublished_changes(id)
  where id = p_project_id;
end;
$$;

comment on function public.refresh_draft_table_of_contents_has_changes(integer) is '@omit';
revoke all on function public.refresh_draft_table_of_contents_has_changes(integer) from public;

-- Returns true when this call turned deferral on, so the matching end() is
-- the one that refreshes. Nested callers see it already on and do nothing.
create or replace function public.toc_has_changes_defer_begin()
  returns boolean
  language plpgsql
  set search_path to public, pg_temp
as $$
declare
  v_outer boolean;
begin
  v_outer := coalesce(current_setting('seasketch.defer_toc_has_changes', true), '')
    is distinct from 'true';
  if v_outer then
    perform set_config('seasketch.defer_toc_has_changes', 'true', true);
  end if;
  return v_outer;
end;
$$;

comment on function public.toc_has_changes_defer_begin() is '@omit';
revoke all on function public.toc_has_changes_defer_begin() from public;

create or replace function public.toc_has_changes_defer_end(p_outer boolean, p_project_id integer)
  returns void
  language plpgsql
  security definer
  set search_path to public, pg_temp
as $$
begin
  if p_outer then
    perform set_config('seasketch.defer_toc_has_changes', 'false', true);
    perform public.refresh_draft_table_of_contents_has_changes(p_project_id);
  end if;
end;
$$;

comment on function public.toc_has_changes_defer_end(boolean, integer) is '@omit';
revoke all on function public.toc_has_changes_defer_end(boolean, integer) from public;

-- One diff per insert, update, or delete statement. Transition tables are
-- per event, so insert, update, and delete each have their own trigger.
drop trigger if exists table_of_contents_items_project_update on public.table_of_contents_items;

create or replace function public.table_of_contents_items_project_update()
  returns trigger
  language plpgsql
  security definer
  set search_path to public, pg_temp
as $$
declare
  v_project_id int;
begin
  if coalesce(current_setting('seasketch.publishing', true), '') = 'true' then
    return null;
  end if;
  if coalesce(current_setting('seasketch.skip_library_source_side_effects', true), '') = 'true' then
    return null;
  end if;
  if coalesce(current_setting('seasketch.defer_toc_has_changes', true), '') = 'true' then
    return null;
  end if;

  for v_project_id in
    select distinct project_id
    from changed_rows
    where project_id is not null
  loop
    perform public.refresh_draft_table_of_contents_has_changes(v_project_id);
  end loop;
  return null;
end;
$$;

comment on function public.table_of_contents_items_project_update() is
  'Sets projects.draft_table_of_contents_has_changes from the draft-vs-published diff once per TOC statement. seasketch.defer_toc_has_changes skips it so a loop can refresh once at the end.';

-- Drop the new names too so committing this file can re-run it on a database
-- that already applied current.sql.
drop trigger if exists table_of_contents_items_project_update_insert on public.table_of_contents_items;
drop trigger if exists table_of_contents_items_project_update_update on public.table_of_contents_items;
drop trigger if exists table_of_contents_items_project_update_delete on public.table_of_contents_items;

create trigger table_of_contents_items_project_update_insert
  after insert on public.table_of_contents_items
  referencing new table as changed_rows
  for each statement
  execute procedure public.table_of_contents_items_project_update();

create trigger table_of_contents_items_project_update_update
  after update on public.table_of_contents_items
  referencing new table as changed_rows
  for each statement
  execute procedure public.table_of_contents_items_project_update();

create trigger table_of_contents_items_project_update_delete
  after delete on public.table_of_contents_items
  referencing old table as changed_rows
  for each statement
  execute procedure public.table_of_contents_items_project_update();

create or replace function public.after_data_layers_update_or_delete_set_draft_table_of_contents_()
  returns trigger
  language plpgsql
  security definer
as $$
begin
  -- publishing-bailout
  if coalesce(current_setting('seasketch.publishing', true), '') = 'true' then
    return new;
  end if;
  if coalesce(current_setting('seasketch.skip_library_source_side_effects', true), '') = 'true' then
    return new;
  end if;
  if coalesce(current_setting('seasketch.defer_toc_has_changes', true), '') = 'true' then
    return coalesce(new, old);
  end if;
  update projects p
  set draft_table_of_contents_has_changes =
    public.overlay_list_has_unpublished_changes(p.id)
  where id in (
    select tocs.project_id
    from table_of_contents_items as tocs
    where tocs.data_layer_id = coalesce(old.id, new.id)
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.after_data_sources_update_or_delete_set_draft_table_of_contents()
  returns trigger
  language plpgsql
  security definer
as $$
declare
  v_library_template_id text;
  v_project_id int;
begin
  -- publishing-bailout
  if coalesce(current_setting('seasketch.publishing', true), '') = 'true' then
    return new;
  end if;
  if coalesce(current_setting('seasketch.skip_library_source_side_effects', true), '') = 'true' then
    return new;
  end if;
  if coalesce(current_setting('seasketch.defer_toc_has_changes', true), '') = 'true' then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    v_library_template_id := old.data_library_template_id;
    v_project_id := old.project_id;
  else
    v_library_template_id := new.data_library_template_id;
    v_project_id := new.project_id;
  end if;

  -- Live library sources: do not fan out "unpublished changes" to every
  -- consumer project. The owning (Data Library) project still gets the flag.
  if v_library_template_id is not null then
    update projects p
      set draft_table_of_contents_has_changes =
        public.overlay_list_has_unpublished_changes(p.id)
      where id = v_project_id;
    return coalesce(new, old);
  end if;

  update projects p
  set draft_table_of_contents_has_changes =
    public.overlay_list_has_unpublished_changes(p.id)
  where id in (
    select tocs.project_id
    from table_of_contents_items as tocs
    where tocs.data_layer_id in (
      select data_layers.id from data_layers where data_layers.data_source_id = coalesce(old.id, new.id)
    )
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.acl_update_draft_toc_has_changes()
  returns trigger
  language plpgsql
  security definer
as $$
begin
  -- publishing-bailout
  if coalesce(current_setting('seasketch.publishing', true), '') = 'true' then
    return new;
  end if;
  if coalesce(current_setting('seasketch.defer_toc_has_changes', true), '') = 'true' then
    return new;
  end if;
  update projects p
  set draft_table_of_contents_has_changes =
    public.overlay_list_has_unpublished_changes(p.id)
  where id = (
    select project_id from table_of_contents_items where id = (
      select table_of_contents_item_id from access_control_lists where id = new.id
    )
  );
  return new;
end;
$$;

create or replace function public.before_insert_or_update_table_of_contents_items_trigger()
  returns trigger
  language plpgsql
  security definer
as $$
begin
  -- publishing-bailout
  if coalesce(current_setting('seasketch.publishing', true), '') = 'true' and new.is_draft = false then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.is_draft = false
     and coalesce(current_setting('seasketch.skip_library_source_side_effects', true), '') != 'true'
  then
    raise 'Cannot alter table of contents items after they are published';
  end if;
  -- Moving a folder rewrites path on every descendant and nothing else.
  -- Skip the per-layer source lookup and the rest of the validation.
  if tg_op = 'UPDATE'
     and old.path is distinct from new.path
     and (to_jsonb(old) - 'path') is not distinct from (to_jsonb(new) - 'path')
  then
    return new;
  end if;
  if tg_op = 'INSERT' or old.data_layer_id is distinct from new.data_layer_id then
    if new.is_folder or new.data_layer_id is null then
      new.data_source_type = null;
    else
      new.data_source_type = data_source_type(new.data_layer_id);
    end if;
    if (new.data_source_type = 'seasketch-vector' or new.data_source_type = 'seasketch-mvt' or new.data_source_type = 'seasketch-raster') and new.original_source_upload_available = false then
      new.original_source_upload_available = (
        select exists (
          select
            original_filename
          from
            data_upload_outputs
          where
            data_upload_outputs.data_source_id = (
              select
                data_layers.data_source_id
              from
                data_layers
              where
                data_layers.id = new.data_layer_id
            ) and
            data_upload_outputs.is_original = true
        )
      );
    end if;
  end if;
  if old.is_folder != new.is_folder then
    raise 'Cannot change is_folder. Create a new table of contents item';
  end if;
  if old.is_draft = false and coalesce(current_setting('seasketch.skip_library_source_side_effects', true), '') != 'true' then
    raise 'Cannot alter table of contents items after they are published';
  end if;
  if new.sort_index is null then
    new.sort_index = (select coalesce(max(sort_index), -1) + 1 from table_of_contents_items where is_draft = true and project_id = new.project_id and parent_stable_id = new.parent_stable_id or (parent_stable_id is null and new.parent_stable_id is null));
  end if;
  if old is null and new.is_draft = true then -- inserting
    new.enable_download = (select enable_download_by_default from projects where id = new.project_id);
    -- verify that stable_id is unique among draft items
    if (select count(id) from table_of_contents_items where stable_id = new.stable_id and is_draft = true) > 0 then
      raise '% is not a unique stable_id.', new.stable_id;
    end if;
    -- set path
    if new.parent_stable_id is null then
      new.path = new.stable_id;
    else
      if (select count(id) from table_of_contents_items where is_draft = true and stable_id = new.parent_stable_id) > 0 then
        -- set path, finding path of parent and appending to it
        new.path = (select path from table_of_contents_items where is_draft = true and stable_id = new.parent_stable_id) || new.stable_id;
      else
        raise 'Cannot find parent item with stable_id=%', new.parent_stable_id;
      end if;
    end if;
  end if;
  if new.is_folder then
    if new.data_layer_id is not null then
      raise 'Folders cannot have data_layer_id set';
    end if;
    if new.bounds is not null then
      raise 'Folders cannot have bounds set';
    end if;
  else
    if new.data_layer_id is null then
      raise 'data_layer_id must be set if is_folder=false';
    end if;
    if new.show_radio_children then
      raise 'show_radio_children must be false if is_folder=false';
    end if;
    if new.is_click_off_only then
      raise 'is_click_off_only must be false if is_folder=false';
    end if;
  end if;
  if length(trim(new.title)) = 0 then
    raise 'title cannot be empty';
  end if;
  return new;
end;
$$;

create or replace function public.update_table_of_contents_item_position(
  "itemId" integer,
  "parentStableId" text,
  "sortIndex" integer
) returns public.table_of_contents_items
  language plpgsql
  security definer
as $$
declare
  pid int;
  parent_path ltree;
  current_path ltree;
  item table_of_contents_items;
  old_sort int;
  old_parent text;
  v_editor int;
begin
  select project_id, sort_index, parent_stable_id
    into pid, old_sort, old_parent
  from table_of_contents_items
  where id = "itemId" and is_draft = true;
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

  if found
    and old_sort is distinct from "sortIndex"
    and old_parent is not distinct from "parentStableId"
    and coalesce(current_setting('seasketch.publishing', true), '') <> 'true'
  then
    v_editor := nullif(current_setting('session.user_id', true), '')::int;
    if v_editor is not null then
      perform record_changelog(
        pid,
        v_editor,
        'projects',
        pid,
        'layers:list-order-change'::change_log_field_group,
        '{}'::jsonb,
        '{}'::jsonb,
        null,
        null,
        null
      );
    end if;
  end if;

  -- A reorder keeps the same parent, so every descendant path is already
  -- correct. Rewriting them fired the has-changes trigger once per layer.
  if old_parent is distinct from "parentStableId" then
    if "parentStableId" is not null then
      update table_of_contents_items
      set path = parent_path || subpath(path, nlevel(current_path) - 1)
      where is_draft = true and path <@ current_path;
    else
      update table_of_contents_items
      set path = subpath(path, nlevel(current_path) - 1)
      where is_draft = true and path <@ current_path;
    end if;
  end if;

  select * into item from table_of_contents_items where id = "itemId";
  return item;
end;
$$;

create or replace function public.update_table_of_contents_item_children(
  "parentId" integer,
  "childIds" integer[]
) returns setof public.table_of_contents_items
  language plpgsql
  security definer
as $$
declare
  "parentStableId" text;
  "maxRootSortIndex" int;
  "projectId" int;
  item table_of_contents_items;
  v_outer boolean;
begin
  select project_id into "projectId"
  from table_of_contents_items
  where id = "parentId" or id = "childIds"[1]
  limit 1;
  if "projectId" is null then
    raise 'Could not find draft item with id = %', "parentId";
  end if;
  if session_is_admin("projectId") = false then
    raise 'Permission denied';
  end if;
  if (
    select count(id)
    from table_of_contents_items
    where project_id != "projectId" and id = any("childIds")
  ) > 0 then
    raise 'Permission denied. Not all items in project';
  end if;
  select stable_id into "parentStableId" from table_of_contents_items where id = "parentId";
  select max(sort_index) into "maxRootSortIndex"
  from table_of_contents_items
  where is_draft = true and project_id = "projectId" and parent_stable_id is null;

  -- One position() call per sibling. Defer the diff until the list is final.
  v_outer := public.toc_has_changes_defer_begin();

  for item in
    select *
    from table_of_contents_items
    where parent_stable_id = "parentStableId"
      and is_draft = true
      and not (id = any("childIds"))
  loop
    "maxRootSortIndex" = "maxRootSortIndex" + 1;
    perform update_table_of_contents_item_position(item.id, null, "maxRootSortIndex");
  end loop;

  for i in array_lower("childIds", 1)..array_upper("childIds", 1) loop
    perform update_table_of_contents_item_position("childIds"[i], "parentStableId", i - 1);
  end loop;

  perform public.toc_has_changes_defer_end(v_outer, "projectId");

  return query
  select *
  from table_of_contents_items
  where id = any("childIds");
end;
$$;

create or replace function public.delete_table_of_contents_branch("tableOfContentsItemId" integer)
  returns void
  language plpgsql
  security definer
as $$
declare
  toc_id int;
  root_path ltree;
  v_project_id int;
  v_outer boolean;
begin
  select project_id into v_project_id
  from table_of_contents_items
  where table_of_contents_items.id = "tableOfContentsItemId";
  if session_is_admin(v_project_id) = false then
    raise 'Permission denied. Must be a project admin';
  end if;
  if (select is_draft from table_of_contents_items where table_of_contents_items.id = "tableOfContentsItemId") = false then
    raise 'Cannot delete published table of contents items';
  end if;
  select path into root_path from table_of_contents_items where table_of_contents_items.id = "tableOfContentsItemId";
  v_outer := public.toc_has_changes_defer_begin();
  for toc_id in
    select table_of_contents_items.id from table_of_contents_items where root_path @> path and is_draft = true
  loop
    execute _delete_table_of_contents_item(toc_id);
  end loop;
  perform public.toc_has_changes_defer_end(v_outer, v_project_id);
  return;
end;
$$;

create or replace function public.nest_new_project_geography_draft_toc_under_folder(p_project_id integer)
  returns void
  language plpgsql
  security definer
  set search_path to public
as $$
declare
  folder_stable text;
  layer_rec record;
  i integer := 0;
  v_outer boolean;
begin
  if session_is_admin(p_project_id) is not true then
    raise exception 'Permission denied';
  end if;

  -- Draft overlay layers still at tree root (typical right after geography cloning).
  if not exists (
    select 1
    from table_of_contents_items
    where project_id = p_project_id
      and is_draft = true
      and is_folder = false
      and parent_stable_id is null
  ) then
    return;
  end if;

  folder_stable := create_stable_id();
  v_outer := public.toc_has_changes_defer_begin();

  update table_of_contents_items
  set sort_index = sort_index + 1
  where project_id = p_project_id
    and is_draft = true
    and parent_stable_id is null;

  insert into table_of_contents_items (
    project_id,
    stable_id,
    parent_stable_id,
    title,
    is_folder,
    is_draft,
    show_radio_children,
    is_click_off_only,
    hide_children,
    translated_props,
    sort_index
  ) values (
    p_project_id,
    folder_stable,
    null,
    'Geography layers',
    true,
    true,
    false,
    false,
    false,
    '{}'::jsonb,
    0
  );

  for layer_rec in
    select id
    from table_of_contents_items
    where project_id = p_project_id
      and is_draft = true
      and is_folder = false
      and parent_stable_id is null
    order by sort_index asc, id asc
  loop
    perform update_table_of_contents_item_position(layer_rec.id, folder_stable, i);
    i := i + 1;
  end loop;

  perform public.toc_has_changes_defer_end(v_outer, p_project_id);
end;
$$;

create or replace function public.copy_table_of_contents_item_recursive(
  item_id integer,
  copy_data_source boolean,
  append_copy_to_name boolean,
  project_id integer,
  lpath public.ltree,
  parent_stable_id text
) returns integer
  language plpgsql
  security definer
  set search_path to public, pg_temp
as $$
declare
  copy_id int;
  child record;
  new_stable_id text;
  old_stable_id text;
  v_outer boolean;
begin
  v_outer := public.toc_has_changes_defer_begin();

  select stable_id into old_stable_id
  from table_of_contents_items
  where id = item_id;

  copy_id := copy_table_of_contents_item(
    item_id,
    copy_data_source,
    append_copy_to_name,
    project_id,
    lpath,
    parent_stable_id
  );

  -- copy_table_of_contents_item predates data tables and omits these TOC flags.
  update table_of_contents_items copied
  set enable_data_tables = source.enable_data_tables,
      data_table_join_column = source.data_table_join_column
  from table_of_contents_items source
  where copied.id = copy_id
    and source.id = item_id;

  -- Duplicate active tables onto the copied draft layer. Artifact remotes are
  -- shared until a table is replaced or reprocessed, so sidecar deletion must
  -- remain reference-aware.
  insert into overlay_data_tables (
    table_of_contents_item_id,
    project_id,
    name,
    join_column,
    overlay_join_column,
    row_count,
    created_by,
    version,
    parquet_remote,
    parquet_url,
    column_stats_remote,
    visualization_columns,
    visualization_ops,
    calculation_mode,
    additional_replicate_identifiers,
    replicate_label,
    replicate_label_custom,
    within_replicate_operations,
    across_replicate_operations,
    subject_column,
    observation_detail_columns,
    coverage_mode,
    coverage_remote,
    effort_marker_values,
    excluded_values,
    required_filter_columns,
    hidden_filter_columns,
    filter_column_labels,
    temporal,
    organism,
    nodata_values,
    source_parquet_remote,
    description
  )
  select
    copy_id,
    copy_table_of_contents_item_recursive.project_id,
    odt.name,
    odt.join_column,
    odt.overlay_join_column,
    odt.row_count,
    coalesce(
      nullif(current_setting('session.user_id', true), '')::integer,
      odt.created_by
    ),
    odt.version,
    odt.parquet_remote,
    odt.parquet_url,
    odt.column_stats_remote,
    odt.visualization_columns,
    odt.visualization_ops,
    odt.calculation_mode,
    odt.additional_replicate_identifiers,
    odt.replicate_label,
    odt.replicate_label_custom,
    odt.within_replicate_operations,
    odt.across_replicate_operations,
    odt.subject_column,
    odt.observation_detail_columns,
    odt.coverage_mode,
    odt.coverage_remote,
    odt.effort_marker_values,
    odt.excluded_values,
    odt.required_filter_columns,
    odt.hidden_filter_columns,
    odt.filter_column_labels,
    odt.temporal,
    odt.organism,
    odt.nodata_values,
    odt.source_parquet_remote,
    odt.description
  from overlay_data_tables odt
  where odt.table_of_contents_item_id = item_id
    and odt.deleted_at is null;

  select stable_id into new_stable_id
  from table_of_contents_items
  where id = copy_id;

  for child in
    select *
    from table_of_contents_items
    where table_of_contents_items.parent_stable_id = old_stable_id
      and is_draft = true
  loop
    perform copy_table_of_contents_item_recursive(
      child.id,
      copy_data_source,
      false,
      project_id,
      lpath || new_stable_id,
      new_stable_id
    );
  end loop;

  perform public.toc_has_changes_defer_end(
    v_outer,
    copy_table_of_contents_item_recursive.project_id
  );
  return copy_id;
end;
$$;
