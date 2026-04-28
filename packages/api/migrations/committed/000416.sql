--! Previous: sha1:5295be379ba4c07364271f3aa1d66e92d85eef6d
--! Hash: sha1:8ec1b079b735ecd63d94391502c3db11bc29b24b

-- Enter migration here
create or replace function table_of_contents_items_metadata_change_logs(item table_of_contents_items)
  returns setof change_logs
  language sql
  security definer
  stable
  as $$
    select * from change_logs where entity_id = item.id and entity_type = 'table_of_contents_items' and net_zero_changes = false and session_is_admin(change_logs.project_id) order by last_at desc;
  $$;

grant execute on function table_of_contents_items_metadata_change_logs(item table_of_contents_items) to seasketch_user;

comment on function table_of_contents_items_metadata_change_logs(item table_of_contents_items) is '@simpleCollections only';

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
      when 'layer:metadata'::change_log_field_group then interval '10 seconds'
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

create or replace function table_of_contents_items_cartography_change_logs(item table_of_contents_items)
  returns setof change_logs
  language sql
  security definer
  stable
  as $$
    select * from change_logs where entity_id = item.id and entity_type = 'table_of_contents_items' and field_group = 'layer:cartography' and net_zero_changes = false and session_is_admin(change_logs.project_id) order by last_at desc;
  $$;

grant execute on function table_of_contents_items_cartography_change_logs(item table_of_contents_items) to seasketch_user;

comment on function table_of_contents_items_cartography_change_logs(item table_of_contents_items) is '@simpleCollections only';
