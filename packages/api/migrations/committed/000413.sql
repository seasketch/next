--! Previous: sha1:16b7f940786ddf86c355ff756a32c7c8ad126f6e
--! Hash: sha1:deda86fed4084042d4eba07a6eef3a610f6f1356

-- Enter migration here
-- Enter migration here
drop table if exists change_logs cascade;
drop type if exists change_log_field_group cascade;
do $$
begin
    if not exists (select 1 from pg_type where typname = 'change_log_status') then
        create type change_log_status as enum ('open', 'closed');
    end if;
end$$;

do $$
begin
    if not exists (select 1 from pg_type where typname = 'change_log_field_group') then
        create type change_log_field_group as enum (
          'layer:title',
          'layer:attribution',
          'layer:metadata',
          'layer:cartography',
          'layer:downloadable',
          'layer:acl',
          'layer:interactivity',
          'layer:deleted',
          'layers:z-order-change',
          'folder:type',
          'folder:title',
          'folder:acl',
          'folder:deleted',
          'layers:published',
          'layer:uploaded',
          'folder:created',
          'layer:parent-changed'
        );
    end if;
end$$;

DO
$$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE
      pg_type.typname = 'change_log_field_group'
      AND pg_enum.enumlabel = 'layer:uploaded'
  ) THEN
    ALTER TYPE change_log_field_group ADD VALUE 'layer:uploaded';
  END IF;
END
$$;

DO
$$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE
      pg_type.typname = 'change_log_field_group'
      AND pg_enum.enumlabel = 'layers:z-order-change'
  ) THEN
    ALTER TYPE change_log_field_group ADD VALUE 'layers:z-order-change';
  END IF;
END
$$;


-- drop table if exists change_logs;

create table if not exists change_logs (
  id bigint generated always as identity primary key,
  project_id int not null references projects(id) on delete cascade,
  editor_id int not null references users(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  status change_log_status not null default 'open',
  save_count int not null default 1,
  from_summary jsonb not null default '{}'::jsonb,
  to_summary jsonb not null default '{}'::jsonb,
  from_blob jsonb,
  to_blob jsonb,
  entity_id integer not null,
  entity_type text not null,
  field_group change_log_field_group not null,
  meta jsonb
);


alter table change_logs
add column if not exists net_zero_changes boolean
generated always as (
  case
    -- If either blob is non-null, compare blobs (NULL-safe)
    when (from_blob is not null) or (to_blob is not null) then
      not (from_blob is distinct from to_blob)

    -- Otherwise compare summaries (NULL-safe)
    else
      not (from_summary is distinct from to_summary)
  end
) stored;

-- One and only one "open" log row per editor/entity/field_group within a project.
create unique index if not exists change_logs_open_uniq
on change_logs (project_id, editor_id, entity_type, entity_id, field_group)
where status = 'open';

-- Retire layer:z-order (per-layer TOC changelogs); use layers:z-order-change from update_z_indexes instead.
do
$$
begin
  drop trigger if exists trg_changelog_data_layers_z_index_for_toc on data_layers;
  drop function if exists trg_changelog_data_layers_z_index_for_toc();

  if to_regclass('public.change_logs') is not null then
    delete from change_logs
    where field_group::text = 'layer:z-order';
  end if;

  if exists (
    select 1
    from pg_enum
    join pg_type on pg_enum.enumtypid = pg_type.oid
    where pg_type.typname = 'change_log_field_group'
      and pg_enum.enumlabel = 'layer:z-order'
  ) then
    alter type change_log_field_group rename value 'layer:z-order' to 'removed__layer_z_order';
  end if;
end
$$;

create or replace function record_changelog(
  p_project_id   int,
  p_editor_id    int,
  p_entity_type  text,
  p_entity_id    int,
  p_field_group  change_log_field_group,
  p_from_summary jsonb,
  p_to_summary   jsonb,
  p_from_blob    jsonb default null,
  p_to_blob      jsonb default null,
  p_meta         jsonb default null
) returns bigint
language plpgsql
as $$
declare
  v_now          timestamptz := clock_timestamp();
  v_window       interval;
  v_existing_id  bigint;
  v_existing_last timestamptz;
begin
  -- Choose your coalescing window per field_group.
  -- These only need to be changed for settings which users might really 
  -- deliberate on, such as cartography, or changes that should be immediately
  -- recorded (e.g. layer:deleted).
  v_window :=
    case p_field_group
      when 'layer:metadata'::change_log_field_group then interval '5 minutes'
      when 'layer:cartography'::change_log_field_group then interval '5 minutes'
      when 'layer:interactivity'::change_log_field_group then interval '2 minutes'
      when 'layers:published'::change_log_field_group then interval '5 seconds'
      when 'layers:z-order-change'::change_log_field_group then interval '5 minutes'
      when 'layer:uploaded'::change_log_field_group then interval '0 seconds'
      when 'layer:downloadable'::change_log_field_group then interval '10 seconds'
      when 'layer:deleted'::change_log_field_group then interval '0 seconds'
      when 'folder:deleted'::change_log_field_group then interval '0 seconds'
      else interval '1 minute'
    end;

  /*
    Find the current open row for this key (if any) and lock it.
    Because of the partial unique index, there can be at most one open row.
  */
  select id, last_at
    into v_existing_id, v_existing_last
  from change_logs
  where project_id = p_project_id
    and editor_id = p_editor_id
    and entity_type = p_entity_type
    and entity_id = p_entity_id
    and field_group = p_field_group
    and status = 'open'
  limit 1
  for update;

  if v_existing_id is not null then
    -- Decide whether to merge into the existing open row, or close+start a new one.
    if (v_now - v_existing_last) <= v_window then
      -- Merge: preserve from_* and meta; update to_* and counters.
      update change_logs
      set
        last_at    = v_now,
        save_count = save_count + 1,
        to_summary = coalesce(p_to_summary, to_summary),
        to_blob    = case
                       when p_to_blob is null then to_blob
                       else p_to_blob
                     end
      where id = v_existing_id;

      return v_existing_id;
    else
      -- Outside the window: close the old row and create a new open row.
      update change_logs
      set status = 'closed'
      where id = v_existing_id;

      insert into change_logs (
        project_id, editor_id,
        started_at, last_at,
        status, save_count,
        from_summary, to_summary,
        from_blob, to_blob,
        entity_type, entity_id,
        field_group, meta
      ) values (
        p_project_id, p_editor_id,
        v_now, v_now,
        'open', 1,
        coalesce(p_from_summary, '{}'::jsonb),
        coalesce(p_to_summary, '{}'::jsonb),
        p_from_blob,
        p_to_blob,
        p_entity_type, p_entity_id,
        p_field_group,
        p_meta
      )
      returning id into v_existing_id;

      return v_existing_id;
    end if;
  else
    -- No open row exists: create one.
    insert into change_logs (
      project_id, editor_id,
      started_at, last_at,
      status, save_count,
      from_summary, to_summary,
      from_blob, to_blob,
      entity_type, entity_id,
      field_group, meta
    ) values (
      p_project_id, p_editor_id,
      v_now, v_now,
      'open', 1,
      coalesce(p_from_summary, '{}'::jsonb),
      coalesce(p_to_summary, '{}'::jsonb),
      p_from_blob,
      p_to_blob,
      p_entity_type, p_entity_id,
      p_field_group,
      p_meta
    )
    returning id into v_existing_id;

    return v_existing_id;
  end if;
end;
$$;

drop index if exists change_logs_project_type_lastat_idx;
drop index if exists change_logs_project_entity_lastat_idx;
drop index if exists change_logs_project_lastat_idx;

create index if not exists change_logs_project_type_lastat_idx
on change_logs (project_id, entity_type, net_zero_changes, last_at desc);

create index if not exists change_logs_project_entity_lastat_idx
on change_logs (project_id, entity_type, entity_id, net_zero_changes, last_at desc);

create index if not exists change_logs_project_lastat_idx
on change_logs (project_id, net_zero_changes, last_at desc);

-- Skip no-op updates so reordering folder children (same parent + sort) does not fire
-- AFTER UPDATE OF parent_stable_id for every row; PostgreSQL invokes that trigger whenever
-- parent_stable_id appears in SET, even when the value is unchanged.
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
begin
  select project_id into pid from table_of_contents_items where id = "itemId" and is_draft = true;
  if pid is null then
    raise 'Could not find draft item with id = %', "itemId";
  end if;
  if session_is_admin(pid) = false then
    raise 'Permission denied';
  end if;
  select path into current_path from table_of_contents_items where id = "itemId" and is_draft = true;

  update table_of_contents_items
  set parent_stable_id = "parentStableId", sort_index = "sortIndex"
  where id = "itemId"
    and (
      parent_stable_id is distinct from "parentStableId"
      or sort_index is distinct from "sortIndex"
    );

  if "parentStableId" is not null then
    select path into parent_path
    from table_of_contents_items
    where is_draft = true and project_id = pid and stable_id = "parentStableId";
    if parent_path is null then
      raise 'Could not find valid parent with stable_id=%', "parentStableId";
    else
      update table_of_contents_items
      set path = parent_path || subpath(path, nlevel(current_path) - 1)
      where is_draft = true and path <@ current_path;
    end if;
  else
    update table_of_contents_items
    set path = subpath(path, nlevel(current_path) - 1)
    where is_draft = true and path <@ current_path;
  end if;

  select * into item from table_of_contents_items where id = "itemId";
  return item;
end;
$$;

-- Fix `id != ANY(childIds)`: in SQL, != ANY means "not equal to at least one array element",
-- so every id in a multi-element list matches and every folder child was wrongly unrooted
-- before being reassigned — two parent_stable_id updates per sibling and spam changelogs.
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

  return query
  select *
  from table_of_contents_items
  where id = any("childIds");
end;
$$;


-- Append-only changelog rows from triggers; SECURITY DEFINER avoids granting insert on change_logs to clients.
create or replace function trg_changelog_table_of_contents_items_title()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_editor int;
  v_field_group change_log_field_group;
begin
  if not new.is_draft then
    return new;
  end if;
  if old.title is not distinct from new.title then
    return new;
  end if;

  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is null then
    return new;
  end if;

  v_field_group :=
    case when new.is_folder then 'folder:title'::change_log_field_group
         else 'layer:title'::change_log_field_group end;

  perform record_changelog(
    new.project_id,
    v_editor,
    'table_of_contents_items',
    new.id,
    v_field_group,
    jsonb_build_object('title', old.title),
    jsonb_build_object('title', new.title),
    null,
    null,
    null
  );

  return new;
end;
$$;

drop trigger if exists trg_changelog_table_of_contents_items_title on table_of_contents_items;

create trigger trg_changelog_table_of_contents_items_title
  after update of title on table_of_contents_items
  for each row
  execute function trg_changelog_table_of_contents_items_title();

comment on function trg_changelog_table_of_contents_items_title is
  'Records admin changelog entries when a draft table_of_contents_items title is updated (session.user_id).';

create or replace function trg_changelog_table_of_contents_items_insert_created()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_editor int;
begin
  if not new.is_draft or not new.is_folder then
    return new;
  end if;

  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is null then
    return new;
  end if;

  perform record_changelog(
    new.project_id,
    v_editor,
    'table_of_contents_items',
    new.id,
    'folder:created'::change_log_field_group,
    '{}'::jsonb,
    jsonb_build_object('title', new.title),
    null,
    null,
    null
  );

  return new;
end;
$$;

drop trigger if exists trg_changelog_table_of_contents_items_insert_created on table_of_contents_items;

create trigger trg_changelog_table_of_contents_items_insert_created
  after insert on table_of_contents_items
  for each row
  execute function trg_changelog_table_of_contents_items_insert_created();

comment on function trg_changelog_table_of_contents_items_insert_created is
  'Records folder:created when a draft folder table_of_contents_items row is inserted (session.user_id).';

-- layer:uploaded uses data_sources.uploaded_by (not session.user_id) for worker-driven uploads.
create or replace function trg_changelog_table_of_contents_items_insert_layer_uploaded()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_uploaded_by     int;
  v_filename        text;
  v_data_source_id  int;
  v_url             text;
begin
  if not new.is_draft or new.is_folder or new.data_layer_id is null then
    return new;
  end if;

  select ds.id, ds.uploaded_by, ds.uploaded_source_filename, ds.url
  into v_data_source_id, v_uploaded_by, v_filename, v_url
  from data_layers dl
  join data_sources ds on ds.id = dl.data_source_id
  where dl.id = new.data_layer_id;

  if v_uploaded_by is null or v_filename is null or btrim(v_filename) = '' then
    return new;
  end if;

  perform record_changelog(
    new.project_id,
    v_uploaded_by,
    'table_of_contents_items',
    new.id,
    'layer:uploaded'::change_log_field_group,
    '{}'::jsonb,
    jsonb_build_object('filename', v_filename),
    null,
    null,
    jsonb_build_object('data_source_id', v_data_source_id, 'url', v_url)
  );

  return new;
end;
$$;

drop trigger if exists trg_changelog_table_of_contents_items_insert_layer_uploaded on table_of_contents_items;

create trigger trg_changelog_table_of_contents_items_insert_layer_uploaded
  after insert on table_of_contents_items
  for each row
  execute function trg_changelog_table_of_contents_items_insert_layer_uploaded();

comment on function trg_changelog_table_of_contents_items_insert_layer_uploaded is
  'Records layer:uploaded when a draft layer TOC row is inserted with an upload-backed data_source; meta has data_source_id and url.';

create or replace function trg_changelog_table_of_contents_items_data_layer_uploaded()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_uploaded_by     int;
  v_filename        text;
  v_changelog       text;
  v_summary         jsonb;
  v_data_source_id  int;
  v_url             text;
begin
  if not new.is_draft or new.is_folder then
    return new;
  end if;
  if old.data_layer_id is not distinct from new.data_layer_id then
    return new;
  end if;
  if new.data_layer_id is null then
    return new;
  end if;

  select ds.id, ds.uploaded_by, ds.uploaded_source_filename, ds.changelog, ds.url
  into v_data_source_id, v_uploaded_by, v_filename, v_changelog, v_url
  from data_layers dl
  join data_sources ds on ds.id = dl.data_source_id
  where dl.id = new.data_layer_id;

  if v_uploaded_by is null or v_filename is null or btrim(v_filename) = '' then
    return new;
  end if;

  v_summary := jsonb_build_object('filename', v_filename, 'replacement', true);
  if v_changelog is not null then
    v_summary := v_summary || jsonb_build_object('changelog', v_changelog);
  end if;

  perform record_changelog(
    new.project_id,
    v_uploaded_by,
    'table_of_contents_items',
    new.id,
    'layer:uploaded'::change_log_field_group,
    '{}'::jsonb,
    v_summary,
    null,
    null,
    jsonb_build_object('data_source_id', v_data_source_id, 'url', v_url)
  );

  return new;
end;
$$;

drop trigger if exists trg_changelog_table_of_contents_items_data_layer_uploaded on table_of_contents_items;

create trigger trg_changelog_table_of_contents_items_data_layer_uploaded
  after update of data_layer_id on table_of_contents_items
  for each row
  execute function trg_changelog_table_of_contents_items_data_layer_uploaded();

comment on function trg_changelog_table_of_contents_items_data_layer_uploaded is
  'Records layer:uploaded when draft layer TOC data_layer_id changes to an upload-backed data_source (replacement + optional data_sources.changelog in to_summary).';

-- replace_data_source() swaps data_layers.data_source_id in place; TOC rows keep the same data_layer_id.
create or replace function trg_changelog_data_layers_data_source_layer_uploaded()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_uploaded_by     int;
  v_filename        text;
  v_changelog       text;
  v_summary         jsonb;
  v_url             text;
  v_toc             record;
begin
  if old.data_source_id is not distinct from new.data_source_id then
    return new;
  end if;

  select ds.uploaded_by, ds.uploaded_source_filename, ds.changelog, ds.url
  into v_uploaded_by, v_filename, v_changelog, v_url
  from data_sources ds
  where ds.id = new.data_source_id;

  if v_uploaded_by is null or v_filename is null or btrim(v_filename) = '' then
    return new;
  end if;

  v_summary := jsonb_build_object('filename', v_filename, 'replacement', true);
  if v_changelog is not null then
    v_summary := v_summary || jsonb_build_object('changelog', v_changelog);
  end if;

  for v_toc in
    select toc.id, toc.project_id
    from table_of_contents_items toc
    where toc.data_layer_id = new.id
      and toc.is_draft = true
      and toc.is_folder = false
  loop
    perform record_changelog(
      v_toc.project_id,
      v_uploaded_by,
      'table_of_contents_items',
      v_toc.id,
      'layer:uploaded'::change_log_field_group,
      '{}'::jsonb,
      v_summary,
      null,
      null,
      jsonb_build_object('data_source_id', new.data_source_id, 'url', v_url)
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_changelog_data_layers_data_source_layer_uploaded on data_layers;

create trigger trg_changelog_data_layers_data_source_layer_uploaded
  after update of data_source_id on data_layers
  for each row
  execute function trg_changelog_data_layers_data_source_layer_uploaded();

comment on function trg_changelog_data_layers_data_source_layer_uploaded is
  'Records layer:uploaded (replacement) when a data_layer data_source_id changes to an upload-backed source; to_summary may include data_sources.changelog (e.g. replace_data_source).';

create or replace function trg_changelog_table_of_contents_items_enable_download()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_editor      int;
  v_bulk        boolean;
  v_from_summary jsonb;
  v_to_summary   jsonb;
  v_from_blob    jsonb;
  v_to_blob      jsonb;
begin
  if not new.is_draft or new.is_folder then
    return new;
  end if;
  if old.enable_download is not distinct from new.enable_download then
    return new;
  end if;

  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is null then
    return new;
  end if;

  v_bulk := coalesce(current_setting('seasketch.bulk_layer_download', true), '') = 'true';

  v_from_summary := jsonb_build_object('enable_download', old.enable_download);
  v_to_summary := jsonb_build_object('enable_download', new.enable_download);
  v_from_blob := null;
  v_to_blob := null;

  if v_bulk then
    v_from_summary := v_from_summary || jsonb_build_object('bulk', true);
    v_to_summary := v_to_summary || jsonb_build_object('bulk', true);
    v_from_blob := jsonb_build_object('enable_download', old.enable_download, 'bulk', true);
    v_to_blob := jsonb_build_object('enable_download', new.enable_download, 'bulk', true);
  end if;

  perform record_changelog(
    new.project_id,
    v_editor,
    'table_of_contents_items',
    new.id,
    'layer:downloadable'::change_log_field_group,
    v_from_summary,
    v_to_summary,
    v_from_blob,
    v_to_blob,
    null
  );

  return new;
end;
$$;

drop trigger if exists trg_changelog_table_of_contents_items_enable_download on table_of_contents_items;

create trigger trg_changelog_table_of_contents_items_enable_download
  after update of enable_download on table_of_contents_items
  for each row
  execute function trg_changelog_table_of_contents_items_enable_download();

comment on function trg_changelog_table_of_contents_items_enable_download is
  'Records layer:downloadable when a draft layer TOC enable_download changes (session.user_id). When seasketch.bulk_layer_download is true (set by bulk RPCs), summaries and blobs include bulk: true.';

-- Bulk menu uses these RPCs (not per-row GraphQL); they set a txn-local GUC so the trigger can tag change_logs.
create or replace function public.enable_download_for_eligible_layers(slug text)
  returns public.projects
  language plpgsql
  as $$
declare
  project projects;
begin
  perform set_config('seasketch.bulk_layer_download', 'true', true);

  update
    table_of_contents_items
  set
    enable_download = true
  where
    table_of_contents_items.project_id = (
      select
        id
      from
        projects
      where
        projects.slug = enable_download_for_eligible_layers.slug
    )
    and table_of_contents_items.is_draft = true
    and table_of_contents_items_is_downloadable_source_type(table_of_contents_items.*);

  perform set_config('seasketch.bulk_layer_download', 'false', true);

  select
    *
  from
    projects
  into
    project
  where
    projects.slug = enable_download_for_eligible_layers.slug
  limit 1;

  return project;
end;
$$;

create or replace function public.disable_download_for_shared_layers(slug text)
  returns public.projects
  language plpgsql
  as $$
declare
  project projects;
begin
  perform set_config('seasketch.bulk_layer_download', 'true', true);

  update
    table_of_contents_items
  set
    enable_download = false
  where
    table_of_contents_items.project_id = (
      select
        id
      from
        projects
      where
        projects.slug = disable_download_for_shared_layers.slug
    )
    and table_of_contents_items.is_draft = true
    and table_of_contents_items.is_folder = false;

  perform set_config('seasketch.bulk_layer_download', 'false', true);

  select
    *
  from
    projects
  into
    project
  where
    projects.slug = disable_download_for_shared_layers.slug
  limit 1;

  return project;
end;
$$;

-- Folder type label matches EditFolderModal folderToType: hide_children, then click-off, then radio, else DEFAULT.
create or replace function trg_changelog_table_of_contents_items_folder_type()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_editor       int;
  v_from_blob    jsonb;
  v_to_blob      jsonb;
  v_from_type    text;
  v_to_type      text;
begin
  if not new.is_draft or not new.is_folder then
    return new;
  end if;
  if old.hide_children is not distinct from new.hide_children
     and old.show_radio_children is not distinct from new.show_radio_children
     and old.is_click_off_only is not distinct from new.is_click_off_only then
    return new;
  end if;

  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is null then
    return new;
  end if;

  v_from_blob := jsonb_build_object(
    'hide_children', old.hide_children,
    'show_radio_children', old.show_radio_children,
    'is_click_off_only', old.is_click_off_only
  );
  v_to_blob := jsonb_build_object(
    'hide_children', new.hide_children,
    'show_radio_children', new.show_radio_children,
    'is_click_off_only', new.is_click_off_only
  );

  v_from_type :=
    case
      when old.hide_children then 'HIDDEN_CHILDREN'
      when old.is_click_off_only then 'CHECK_OFF_ONLY'
      when old.show_radio_children then 'RADIO_CHILDREN'
      else 'DEFAULT'
    end;
  v_to_type :=
    case
      when new.hide_children then 'HIDDEN_CHILDREN'
      when new.is_click_off_only then 'CHECK_OFF_ONLY'
      when new.show_radio_children then 'RADIO_CHILDREN'
      else 'DEFAULT'
    end;

  perform record_changelog(
    new.project_id,
    v_editor,
    'table_of_contents_items',
    new.id,
    'folder:type'::change_log_field_group,
    jsonb_build_object('type', v_from_type),
    jsonb_build_object('type', v_to_type),
    v_from_blob,
    v_to_blob,
    null
  );

  return new;
end;
$$;

drop trigger if exists trg_changelog_table_of_contents_items_folder_type on table_of_contents_items;

create trigger trg_changelog_table_of_contents_items_folder_type
  after update of hide_children, show_radio_children, is_click_off_only on table_of_contents_items
  for each row
  execute function trg_changelog_table_of_contents_items_folder_type();

comment on function trg_changelog_table_of_contents_items_folder_type is
  'Records folder:type when draft folder flags change; summary type matches EditFolderModal folderToType.';

create or replace function trg_changelog_table_of_contents_items_metadata()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_editor int;
begin
  if not new.is_draft or new.is_folder then
    return new;
  end if;
  if old.metadata is not distinct from new.metadata then
    return new;
  end if;

  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is null then
    return new;
  end if;

  perform record_changelog(
    new.project_id,
    v_editor,
    'table_of_contents_items',
    new.id,
    'layer:metadata'::change_log_field_group,
    '{}'::jsonb,
    '{}'::jsonb,
    old.metadata,
    new.metadata,
    null
  );

  return new;
end;
$$;

drop trigger if exists trg_changelog_table_of_contents_items_metadata on table_of_contents_items;

create trigger trg_changelog_table_of_contents_items_metadata
  after update of metadata on table_of_contents_items
  for each row
  execute function trg_changelog_table_of_contents_items_metadata();

comment on function trg_changelog_table_of_contents_items_metadata is
  'Draft layer TOC metadata edits; full metadata json in from_blob/to_blob.';

create or replace function trg_changelog_data_layers_mapbox_styles_for_toc()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_editor int;
  v_toc    record;
begin
  if old.mapbox_gl_styles is not distinct from new.mapbox_gl_styles then
    return new;
  end if;

  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is null then
    return new;
  end if;

  for v_toc in
    select toc.id, toc.project_id
    from table_of_contents_items toc
    where toc.data_layer_id = new.id
      and toc.is_draft = true
      and toc.is_folder = false
  loop
    perform record_changelog(
      v_toc.project_id,
      v_editor,
      'table_of_contents_items',
      v_toc.id,
      'layer:cartography'::change_log_field_group,
      '{}'::jsonb,
      '{}'::jsonb,
      old.mapbox_gl_styles,
      new.mapbox_gl_styles,
      null
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_changelog_data_layers_mapbox_styles_for_toc on data_layers;

create trigger trg_changelog_data_layers_mapbox_styles_for_toc
  after update of mapbox_gl_styles on data_layers
  for each row
  execute function trg_changelog_data_layers_mapbox_styles_for_toc();

comment on function trg_changelog_data_layers_mapbox_styles_for_toc is
  'Draft layer TOC cartography (mapbox_gl_styles on related data_layer); full styles in blobs.';

create or replace function trg_changelog_table_of_contents_items_deleted()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_editor     int;
  v_field_group change_log_field_group;
  v_from_blob  jsonb;
  v_ds_id      int;
  v_ds_url     text;
begin
  if not old.is_draft then
    return old;
  end if;

  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is null then
    return old;
  end if;

  v_field_group :=
    case when old.is_folder then 'folder:deleted'::change_log_field_group
         else 'layer:deleted'::change_log_field_group end;

  v_ds_id := null;
  v_ds_url := null;
  if not old.is_folder and old.data_layer_id is not null then
    select dl.data_source_id, ds.url
    into v_ds_id, v_ds_url
    from data_layers dl
    left join data_sources ds on ds.id = dl.data_source_id
    where dl.id = old.data_layer_id;
  end if;

  v_from_blob := jsonb_build_object(
    'data_source_type', old.data_source_type,
    'data_layer_id', old.data_layer_id,
    'data_source_id', v_ds_id
  );
  if v_ds_url is not null then
    v_from_blob := v_from_blob || jsonb_build_object('url', v_ds_url);
  end if;

  perform record_changelog(
    old.project_id,
    v_editor,
    'table_of_contents_items',
    old.id,
    v_field_group,
    jsonb_build_object('title', old.title, 'is_folder', old.is_folder),
    '{}'::jsonb,
    v_from_blob,
    null,
    null
  );

  return old;
end;
$$;

drop trigger if exists trg_changelog_table_of_contents_items_deleted on table_of_contents_items;

create trigger trg_changelog_table_of_contents_items_deleted
  before delete on table_of_contents_items
  for each row
  execute function trg_changelog_table_of_contents_items_deleted();

comment on function trg_changelog_table_of_contents_items_deleted is
  'Draft TOC item delete; layer:deleted vs folder:deleted; summary title+is_folder; from_blob has source refs and data_sources.url when set.';

create or replace function trg_changelog_table_of_contents_items_parent_changed()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_editor           int;
  v_old_parent_title text;
  v_new_parent_title text;
begin
  if not new.is_draft or new.is_folder then
    return new;
  end if;
  if old.parent_stable_id is not distinct from new.parent_stable_id then
    return new;
  end if;

  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is null then
    return new;
  end if;

  if old.parent_stable_id is not null then
    select p.title into v_old_parent_title
    from table_of_contents_items p
    where p.project_id = new.project_id
      and p.stable_id = old.parent_stable_id
      and p.is_draft = true
    limit 1;
  end if;

  if new.parent_stable_id is not null then
    select p.title into v_new_parent_title
    from table_of_contents_items p
    where p.project_id = new.project_id
      and p.stable_id = new.parent_stable_id
      and p.is_draft = true
    limit 1;
  end if;

  perform record_changelog(
    new.project_id,
    v_editor,
    'table_of_contents_items',
    new.id,
    'layer:parent-changed'::change_log_field_group,
    jsonb_build_object('folder', v_old_parent_title),
    jsonb_build_object('folder', v_new_parent_title),
    jsonb_build_object('parent_stable_id', old.parent_stable_id),
    jsonb_build_object('parent_stable_id', new.parent_stable_id),
    null
  );

  return new;
end;
$$;

drop trigger if exists trg_changelog_table_of_contents_items_parent_changed on table_of_contents_items;

create trigger trg_changelog_table_of_contents_items_parent_changed
  after update of parent_stable_id on table_of_contents_items
  for each row
  when (old.parent_stable_id is distinct from new.parent_stable_id)
  execute function trg_changelog_table_of_contents_items_parent_changed();

comment on function trg_changelog_table_of_contents_items_parent_changed is
  'Draft layer parent change (parent_stable_id). Trigger WHEN + update_table_of_contents_item_position no-op skip avoid layer:parent-changed spam when folder child order is rewritten without changing each child''s parent.';

-- Layer attribution is stored on data_sources; for each related draft non-folder TOC item, log under that item id.
create or replace function trg_changelog_data_sources_attribution_for_toc()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_editor int;
  v_toc     record;
begin
  if old.attribution is not distinct from new.attribution then
    return new;
  end if;

  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is null then
    return new;
  end if;

  for v_toc in
    select toc.id, toc.project_id
    from table_of_contents_items toc
    join data_layers dl on dl.id = toc.data_layer_id
    where dl.data_source_id = new.id
      and toc.is_draft = true
      and toc.is_folder = false
  loop
    perform record_changelog(
      v_toc.project_id,
      v_editor,
      'table_of_contents_items',
      v_toc.id,
      'layer:attribution'::change_log_field_group,
      jsonb_build_object('attribution', old.attribution),
      jsonb_build_object('attribution', new.attribution),
      null,
      null,
      null
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_changelog_data_sources_attribution on data_sources;

create trigger trg_changelog_data_sources_attribution
  after update of attribution on data_sources
  for each row
  execute function trg_changelog_data_sources_attribution_for_toc();

comment on function trg_changelog_data_sources_attribution_for_toc is
  'Records admin change_logs (layer:attribution) for draft table_of_contents_items that use this data source (session.user_id).';

-- layer:interactivity — only when type, short_template, long_template, or title change (UPDATE OF excludes cursor/layers-only).
create or replace function trg_changelog_interactivity_settings_for_toc()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_editor        int;
  v_toc           record;
  v_text_changes  boolean;
  v_from_summary  jsonb;
  v_to_summary    jsonb;
  v_from_blob     jsonb;
  v_to_blob       jsonb;
begin
  if
    old.type is not distinct from new.type
    and old.short_template is not distinct from new.short_template
    and old.long_template is not distinct from new.long_template
    and old.title is not distinct from new.title
  then
    return new;
  end if;

  v_text_changes :=
    old.short_template is distinct from new.short_template
    or old.long_template is distinct from new.long_template
    or old.title is distinct from new.title;

  v_from_summary := jsonb_build_object(
    'type', old.type::text,
    'text_changes', v_text_changes
  );
  v_to_summary := jsonb_build_object(
    'type', new.type::text,
    'text_changes', v_text_changes
  );

  v_from_blob := jsonb_build_object(
    'short_template', old.short_template,
    'long_template', old.long_template,
    'cursor', old.cursor::text,
    'title', old.title,
    'layers', to_jsonb(coalesce(old.layers, array[]::text[]))
  );
  v_to_blob := jsonb_build_object(
    'short_template', new.short_template,
    'long_template', new.long_template,
    'cursor', new.cursor::text,
    'title', new.title,
    'layers', to_jsonb(coalesce(new.layers, array[]::text[]))
  );

  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is null then
    return new;
  end if;

  for v_toc in
    select toc.id, toc.project_id
    from table_of_contents_items toc
    where toc.data_layer_id in (
      select dl.id from data_layers dl where dl.interactivity_settings_id = new.id
    )
      and toc.is_draft = true
      and toc.is_folder = false
  loop
    perform record_changelog(
      v_toc.project_id,
      v_editor,
      'table_of_contents_items',
      v_toc.id,
      'layer:interactivity'::change_log_field_group,
      v_from_summary,
      v_to_summary,
      v_from_blob,
      v_to_blob,
      null
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_changelog_interactivity_settings_for_toc on interactivity_settings;

create trigger trg_changelog_interactivity_settings_for_toc
  after update of type, short_template, long_template, title on interactivity_settings
  for each row
  when (
    old.type is distinct from new.type
    or old.short_template is distinct from new.short_template
    or old.long_template is distinct from new.long_template
    or old.title is distinct from new.title
  )
  execute function trg_changelog_interactivity_settings_for_toc();

comment on function trg_changelog_interactivity_settings_for_toc is
  'Draft layer interactivity_settings edits → layer:interactivity on related draft TOC (session.user_id). Summaries {type,text_changes}; blobs include cursor/layers. No row for cursor/layers-only updates (UPDATE OF).';

-- ---------------------------------------------------------------------------
-- ACL changelogs (layer:acl / folder:acl) for draft TOC items.
-- Summaries match AclSummary { type, groups: string[] }; blobs add ids:
-- { type, groups: [ { id, name }, ... ] }
-- ---------------------------------------------------------------------------

create or replace function acl_changelog_summary_jsonb(
  p_acl_id int,
  p_type text,
  p_exclude_group_id int default null,
  p_union_group_id int default null
) returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'type', p_type,
    'groups', coalesce(
      (
        with gids as (
          select aclg.group_id as gid
          from access_control_list_groups aclg
          where aclg.access_control_list_id = p_acl_id
            and (
              p_exclude_group_id is null
              or aclg.group_id is distinct from p_exclude_group_id
            )
          union
          select p_union_group_id
          where p_union_group_id is not null
        )
        select jsonb_agg(pg.name order by pg.id)
        from gids
        join project_groups pg on pg.id = gids.gid
        where pg.project_id = (select a.project_id from access_control_lists a where a.id = p_acl_id)
      ),
      '[]'::jsonb
    )
  );
$$;

create or replace function acl_changelog_blob_jsonb(
  p_acl_id int,
  p_type text,
  p_exclude_group_id int default null,
  p_union_group_id int default null
) returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'type', p_type,
    'groups', coalesce(
      (
        with gids as (
          select aclg.group_id as gid
          from access_control_list_groups aclg
          where aclg.access_control_list_id = p_acl_id
            and (
              p_exclude_group_id is null
              or aclg.group_id is distinct from p_exclude_group_id
            )
          union
          select p_union_group_id
          where p_union_group_id is not null
        )
        select jsonb_agg(
          jsonb_build_object('id', pg.id, 'name', pg.name)
          order by pg.id
        )
        from gids
        join project_groups pg on pg.id = gids.gid
        where pg.project_id = (select a.project_id from access_control_lists a where a.id = p_acl_id)
      ),
      '[]'::jsonb
    )
  );
$$;

create or replace function acl_changelog_try_record(
  p_acl_id int,
  p_from_summary jsonb,
  p_to_summary jsonb,
  p_from_blob jsonb,
  p_to_blob jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_editor       int;
  v_field_group  change_log_field_group;
  v_toc_id       int;
  v_project_id   int;
begin
  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is null then
    return;
  end if;

  select
    toc.id,
    toc.project_id,
    case
      when toc.is_folder then 'folder:acl'::change_log_field_group
      else 'layer:acl'::change_log_field_group
    end
  into v_toc_id, v_project_id, v_field_group
  from access_control_lists acl
  join table_of_contents_items toc on toc.id = acl.table_of_contents_item_id
  where acl.id = p_acl_id
    and acl.table_of_contents_item_id is not null
    and toc.is_draft = true;

  if v_toc_id is null then
    return;
  end if;

  if p_from_summary is not distinct from p_to_summary
     and coalesce(p_from_blob, '{}'::jsonb) is not distinct from coalesce(p_to_blob, '{}'::jsonb) then
    return;
  end if;

  perform record_changelog(
    v_project_id,
    v_editor,
    'table_of_contents_items',
    v_toc_id,
    v_field_group,
    p_from_summary,
    p_to_summary,
    p_from_blob,
    p_to_blob,
    null
  );
end;
$$;

create or replace function trg_changelog_access_control_lists_type_for_toc()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  -- WHEN cannot contain subqueries; draft check lives here.
  if new.table_of_contents_item_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from table_of_contents_items toc
    where toc.id = new.table_of_contents_item_id
      and toc.is_draft = true
  ) then
    return new;
  end if;

  perform acl_changelog_try_record(
    new.id,
    acl_changelog_summary_jsonb(new.id, old.type::text, null, null),
    acl_changelog_summary_jsonb(new.id, new.type::text, null, null),
    acl_changelog_blob_jsonb(new.id, old.type::text, null, null),
    acl_changelog_blob_jsonb(new.id, new.type::text, null, null)
  );
  return new;
end;
$$;

drop trigger if exists trg_changelog_access_control_lists_type_for_toc on access_control_lists;

create trigger trg_changelog_access_control_lists_type_for_toc
  after update of type on access_control_lists
  for each row
  when (
    new.table_of_contents_item_id is not null
    and old.type is distinct from new.type
  )
  execute function trg_changelog_access_control_lists_type_for_toc();

comment on function trg_changelog_access_control_lists_type_for_toc is
  'Draft TOC ACL type change → layer:acl or folder:acl on linked table_of_contents_items (session.user_id).';

create or replace function trg_changelog_access_control_list_groups_for_toc()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_acl_id int;
  v_type   text;
  v_gid    int;
begin
  if tg_op = 'INSERT' then
    v_acl_id := new.access_control_list_id;
    v_gid := new.group_id;
  else
    v_acl_id := old.access_control_list_id;
    v_gid := old.group_id;
  end if;

  if not exists (
    select 1
    from access_control_lists acl
    join table_of_contents_items toc on toc.id = acl.table_of_contents_item_id
    where acl.id = v_acl_id
      and acl.table_of_contents_item_id is not null
      and toc.is_draft = true
  ) then
    if tg_op = 'INSERT' then
      return new;
    else
      return old;
    end if;
  end if;

  select type::text into v_type from access_control_lists where id = v_acl_id;
  if v_type is null then
    if tg_op = 'INSERT' then
      return new;
    else
      return old;
    end if;
  end if;

  if tg_op = 'INSERT' then
    perform acl_changelog_try_record(
      v_acl_id,
      acl_changelog_summary_jsonb(v_acl_id, v_type, v_gid, null),
      acl_changelog_summary_jsonb(v_acl_id, v_type, null, null),
      acl_changelog_blob_jsonb(v_acl_id, v_type, v_gid, null),
      acl_changelog_blob_jsonb(v_acl_id, v_type, null, null)
    );
    return new;
  else
    perform acl_changelog_try_record(
      v_acl_id,
      acl_changelog_summary_jsonb(v_acl_id, v_type, null, v_gid),
      acl_changelog_summary_jsonb(v_acl_id, v_type, null, null),
      acl_changelog_blob_jsonb(v_acl_id, v_type, null, v_gid),
      acl_changelog_blob_jsonb(v_acl_id, v_type, null, null)
    );
    return old;
  end if;
end;
$$;

drop trigger if exists trg_changelog_access_control_list_groups_ins_for_toc on access_control_list_groups;
drop trigger if exists trg_changelog_access_control_list_groups_del_for_toc on access_control_list_groups;

create trigger trg_changelog_access_control_list_groups_ins_for_toc
  after insert on access_control_list_groups
  for each row
  execute function trg_changelog_access_control_list_groups_for_toc();

create trigger trg_changelog_access_control_list_groups_del_for_toc
  after delete on access_control_list_groups
  for each row
  execute function trg_changelog_access_control_list_groups_for_toc();

comment on function trg_changelog_access_control_list_groups_for_toc is
  'Draft TOC ACL group membership → layer:acl or folder:acl (session.user_id). INSERT/DELETE on access_control_list_groups.';

comment on function acl_changelog_try_record is
  'Resolves draft table_of_contents_items for an ACL and writes layer:acl or folder:acl change_logs.';

comment on function acl_changelog_summary_jsonb is
  'Builds AclSummary-shaped jsonb { type, groups: string[] } for an ACL; optional exclude or union group id.';

comment on function acl_changelog_blob_jsonb is
  'Builds { type, groups: [ { id, name }, ... ] } for ACL changelog blobs; optional exclude or union group id.';


CREATE OR REPLACE FUNCTION public.publish_table_of_contents("projectId" integer) RETURNS SETOF public.table_of_contents_items
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      v_editor int;
      v_layer_count int;
      lid int;
      item table_of_contents_items;
      source_id int;
      copied_source_id int;
      acl_type access_control_list_type;
      acl_id int;
      orig_acl_id int;
      new_toc_id int;
      new_interactivity_settings_id int;
      new_source_id integer;
      ref record;
    begin
      -- check permissions
      if session_is_admin("projectId") = false then
        raise 'Permission denied. Must be a project admin';
      end if;
    
      -- delete existing published table of contents items, layers, sources, and interactivity settings
      delete from 
        interactivity_settings 
      where
        id in (
          select 
            data_layers.interactivity_settings_id
          from
            data_layers
          inner JOIN
            table_of_contents_items
          on
            data_layers.id = table_of_contents_items.data_layer_id
          where
            table_of_contents_items.project_id = "projectId" and
            is_draft = false
        );

      delete from data_sources where data_sources.id in (
        select 
          data_source_id 
        from
          data_layers
        inner JOIN
          table_of_contents_items
        on
          data_layers.id = table_of_contents_items.data_layer_id
        where
          table_of_contents_items.project_id = "projectId" and
          is_draft = false
      );
      delete from data_layers where id in (
        select 
          data_layer_id 
        from 
          table_of_contents_items 
        where 
          project_id = "projectId" and
          is_draft = false
      );
      delete from 
        table_of_contents_items 
      where 
        project_id = "projectId" and 
        is_draft = false;

      -- one-by-one, copy related layers and link table of contents items
      for item in 
        select 
          * 
        from 
          table_of_contents_items 
        where 
          is_draft = true and 
          project_id = "projectId"
      loop
        if item.is_folder = false then
          -- copy interactivity settings first
          insert into interactivity_settings (
            type,
            short_template,
            long_template,
            cursor,
            title
          ) select
              type,
              short_template,
              long_template,
              cursor,
              title
            from
              interactivity_settings
            where
              interactivity_settings.id = (
                select interactivity_settings_id from data_layers where data_layers.id = item.data_layer_id
              )
            returning
              id
            into
              new_interactivity_settings_id;

          insert into data_layers (
            project_id,
            data_source_id,
            source_layer,
            sublayer,
            sublayer_type,
            render_under,
            mapbox_gl_styles,
            interactivity_settings_id,
            z_index
          )
          select "projectId", 
            data_source_id, 
            source_layer, 
            sublayer, 
            sublayer_type,
            render_under, 
            mapbox_gl_styles,
            new_interactivity_settings_id,
            z_index
          from 
            data_layers
          where 
            id = item.data_layer_id
          returning id into lid;
        else
          lid = item.data_layer_id;
        end if;
        -- TODO: this will have to be modified with the addition of any columns
        insert into table_of_contents_items (
          is_draft,
          project_id,
          path,
          stable_id,
          parent_stable_id,
          title,
          is_folder,
          show_radio_children,
          is_click_off_only,
          metadata,
          bounds,
          data_layer_id,
          sort_index,
          hide_children,
          geoprocessing_reference_id,
          translated_props,
          enable_download
        ) values (
          false,
          "projectId",
          item.path,
          item.stable_id,
          item.parent_stable_id,
          item.title,
          item.is_folder,
          item.show_radio_children,
          item.is_click_off_only,
          item.metadata,
          item.bounds,
          lid,
          item.sort_index,
          item.hide_children,
          item.geoprocessing_reference_id,
          item.translated_props,
          item.enable_download
        ) returning id into new_toc_id;
        select 
          type, id into acl_type, orig_acl_id 
        from 
          access_control_lists 
        where 
          table_of_contents_item_id = (
            select 
              id 
            from 
              table_of_contents_items 
            where is_draft = true and stable_id = item.stable_id
          );
        -- copy access control list settings
        if acl_type != 'public' then
          update 
            access_control_lists 
          set type = acl_type 
          where table_of_contents_item_id = new_toc_id 
          returning id into acl_id;
          if acl_type = 'group' then
            insert into 
              access_control_list_groups (
                access_control_list_id, 
                group_id
              ) 
            select 
              acl_id, 
              group_id 
            from 
              access_control_list_groups 
            where 
              access_control_list_id = orig_acl_id;
          end if;
        end if;
      end loop;
      -- one-by-one, copy related sources and update foreign keys of layers
      for source_id in
        select distinct(data_source_id) from data_layers where id in (
          select 
            data_layer_id 
          from 
            table_of_contents_items 
          where 
            is_draft = false and 
            project_id = "projectId" and 
            is_folder = false
        )
      loop
        -- TODO: This function will have to be updated whenever the schema 
        -- changes since these columns are hard coded... no way around it.
        insert into data_sources (
          project_id,
          type,
          attribution,
          bounds,
          maxzoom,
          minzoom,
          url,
          scheme,
          tiles,
          tile_size,
          encoding,
          buffer,
          cluster,
          cluster_max_zoom,
          cluster_properties,
          cluster_radius,
          generate_id,
          line_metrics,
          promote_id,
          tolerance,
          coordinates,
          urls,
          query_parameters,
          use_device_pixel_ratio,
          import_type,
          original_source_url,
          enhanced_security,
          byte_length,
          supports_dynamic_layers,
          uploaded_source_filename,
          uploaded_source_layername,
          normalized_source_object_key,
          normalized_source_bytes,
          geostats,
          upload_task_id,
          translated_props,
          arcgis_fetch_strategy,
          created_by
        )
          select 
            "projectId", 
          type,
          attribution,
          bounds,
          maxzoom,
          minzoom,
          url,
          scheme,
          tiles,
          tile_size,
          encoding,
          buffer,
          cluster,
          cluster_max_zoom,
          cluster_properties,
          cluster_radius,
          generate_id,
          line_metrics,
          promote_id,
          tolerance,
          coordinates,
          urls,
          query_parameters,
          use_device_pixel_ratio,
          import_type,
          original_source_url,
          enhanced_security,
          byte_length,
          supports_dynamic_layers,
          uploaded_source_filename,
          uploaded_source_layername,
          normalized_source_object_key,
          normalized_source_bytes,
          geostats,
          upload_task_id,
          translated_props,
          arcgis_fetch_strategy,
          created_by
          from 
            data_sources 
          where
            id = source_id
          returning id into copied_source_id;
        -- copy data_upload_outputs
        insert into data_upload_outputs (
          data_source_id,
          project_id,
          type,
          created_at,
          url,
          remote,
          is_original,
          size,
          filename,
          original_filename,
          source_processing_job_key,
          epsg
        ) select 
            copied_source_id,
            project_id,
            type,
            created_at,
            url,
            remote,
            is_original,
            size,
            filename,
            original_filename,
            source_processing_job_key,
            epsg
          from 
            data_upload_outputs 
          where 
            data_source_id = source_id;
        -- update data_layers that should now reference the copy
        update 
          data_layers 
        set data_source_id = copied_source_id 
        where 
          data_source_id = source_id and
          data_layers.id in ((
            select distinct(data_layer_id) from table_of_contents_items where is_draft = false and 
            project_id = "projectId" and 
            is_folder = false
          ));
      end loop;
      update 
        projects 
      set 
        draft_table_of_contents_has_changes = false, 
        table_of_contents_last_published = now() 
      where 
        id = "projectId";

      v_editor := nullif(current_setting('session.user_id', true), '')::int;
      if v_editor is not null then
        select count(*)::int into v_layer_count
        from table_of_contents_items
        where project_id = "projectId"
          and is_draft = true
          and is_folder = false;

        perform record_changelog(
          "projectId",
          v_editor,
          'projects',
          "projectId",
          'layers:published'::change_log_field_group,
          '{}'::jsonb,
          jsonb_build_object('layer_count', v_layer_count),
          null,
          null,
          null
        );
      end if;
      -- return items
      return query select * from table_of_contents_items 
        where project_id = "projectId" and is_draft = false;
    end;
  $$;

comment on function public.publish_table_of_contents(integer) is
  'Copies draft TOC to published; sets project flags. Records change_logs (layers:published) with draft layer_count when session.user_id is set.';

revoke all on function public.publish_table_of_contents(integer) from public;
grant all on function public.publish_table_of_contents(integer) to seasketch_user;

create or replace function public.update_z_indexes("dataLayerIds" integer[]) returns setof public.data_layers
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  z int;
  pid int;
  v_editor int;
begin
  if (select count(distinct(project_id)) from data_layers where id = any("dataLayerIds")) > 1 then
    raise 'Denied. Attempting to modify more than one project.';
  end if;
  if (session_is_admin((select project_id from data_layers where id = any("dataLayerIds") limit 1))) != true then
    raise 'Unauthorized';
  end if;

  pid := (select project_id from data_layers where id = any("dataLayerIds") limit 1);

  -- Disable triggers to prevent unnecessary checks which could cause
  -- deadlocks if rapidly updating z-indexes on a large number of layers.
  set session_replication_role = replica;
  z = 0;
  for i in array_lower("dataLayerIds", 1)..array_upper("dataLayerIds", 1) loop
    z = z + 1;
    update data_layers set z_index = z where id = "dataLayerIds"[i];
  end loop;
  set session_replication_role = default;

  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is not null then
    perform record_changelog(
      pid,
      v_editor,
      'projects',
      pid,
      'layers:z-order-change'::change_log_field_group,
      '{}'::jsonb,
      '{}'::jsonb,
      null,
      null,
      null
    );
  end if;

  return query (select * from data_layers where id = any("dataLayerIds"));
end;
$$;

comment on function public.update_z_indexes("dataLayerIds" integer[]) is
  'Batch reassigns z_index for one project. Records change_logs (layers:z-order-change) on projects when session.user_id is set; summaries/blobs empty.';

revoke all on function public.update_z_indexes("dataLayerIds" integer[]) from public;
grant all on function public.update_z_indexes("dataLayerIds" integer[]) to seasketch_user;

alter table change_logs enable row level security;

grant select on change_logs to seasketch_user;

create policy change_logs_select on change_logs using (
  session_is_admin(project_id)
);
