--! Previous: sha1:81e45138026914cfdedc1fbe696e9e7235b2c6c0
--! Hash: sha1:235b4dd278d55928a7046c504d07e68f39046214

-- Enter migration here

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
    'type', old.type::text,
    'short_template', old.short_template,
    'long_template', old.long_template,
    'cursor', old.cursor::text,
    'title', old.title,
    'layers', to_jsonb(coalesce(old.layers, array[]::text[]))
  );
  v_to_blob := jsonb_build_object(
    'type', new.type::text,
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

comment on function trg_changelog_interactivity_settings_for_toc is
  'Draft layer interactivity_settings edits -> layer:interactivity on related draft TOC (session.user_id). Summaries {type,text_changes}; blobs include type/cursor/layers/text fields. No row for cursor/layers-only updates (UPDATE OF).';

update change_logs
set
  from_blob = coalesce(from_blob, '{}'::jsonb) || jsonb_build_object('type', from_summary->>'type'),
  to_blob = coalesce(to_blob, '{}'::jsonb) || jsonb_build_object('type', to_summary->>'type')
where field_group = 'layer:interactivity'
  and from_summary ? 'type'
  and to_summary ? 'type'
  and (
    from_blob is null
    or to_blob is null
    or from_blob->>'type' is distinct from from_summary->>'type'
    or to_blob->>'type' is distinct from to_summary->>'type'
  );

create or replace function projects_change_logs_since_last_publish(project projects)
  returns setof change_logs
  language plpgsql
  security definer
  stable
  as $$
  declare
    v_last_publish timestamp;
  begin
    if session_is_admin(project.id) = false then
      raise 'Permission denied. Must be a project admin';
    end if;
    select table_of_contents_last_published into v_last_publish from projects where id = project.id;
    if v_last_publish is null then
      return query
        select *
        from change_logs
        where project_id = project.id
          and net_zero_changes = false
          and field_group != 'layers:published'
          and session_is_admin(project_id)
        order by last_at desc;
    end if;
    return query
      select *
      from change_logs
      where project_id = project.id
        and last_at > v_last_publish
        and net_zero_changes = false
        and field_group != 'layers:published'
      order by last_at desc;
  end;
$$;

grant execute on function projects_change_logs_since_last_publish(project projects) to seasketch_user;

comment on function projects_change_logs_since_last_publish(project projects) is '@simpleCollections only';
