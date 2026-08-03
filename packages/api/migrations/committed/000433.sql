--! Previous: sha1:9d7cf102f1004e681cf9a6a0461123ee670222b2
--! Hash: sha1:edb72f17ccf91a679efe5ba585326caf7ae88a72

-- Enter migration here

-- =============================================================================
-- Live data library source updates
--
-- Data library layers (CRW, Global Mangrove Watch, etc.) are backed by shared
-- data_sources rows referenced by draft copies across projects. Previously:
--   * publish_table_of_contents cloned those sources for published layers, so
--     end-users only saw library updates after an admin republished.
--   * replace_data_source fan-out flipped draft_table_of_contents_has_changes
--     and wrote layer:uploaded change_logs rows in every consuming project,
--     filling changelogs and lighting up the Publish button with updates that
--     admins never authored (e.g. 6x daily CRW updates).
--
-- This migration makes library layers "live":
--   1. publish_table_of_contents keeps published layers on the shared library
--      source (no clone) and copies copied_from_data_library_template_id onto
--      published TOC rows so they remain identifiable.
--   2. replace_data_source fans out to every layer on any version of the
--      library source (draft + published), and suppresses publish-flag and
--      changelog side effects via a statement-scoped GUC
--      (seasketch.skip_library_source_side_effects).
--   3. Existing trigger functions get a one-line early-return guard for that
--      GUC. No new triggers are added; per-row cost for normal CRUD is a
--      single current_setting() call on an unset GUC.
--   4. Backfill: tag published siblings of library copies, re-point their
--      layers at the shared source, delete historical library changelog
--      noise, and conservatively clear false "needs publish" flags.
--
-- Source version history is still tracked via archived_data_sources and
-- data_sources.data_library_metadata.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Guard existing side-effect trigger functions with the GUC.
--    (Function names are unchanged; CREATE OR REPLACE preserves ACLs and the
--    triggers that reference them.)
-- -----------------------------------------------------------------------------

-- Sets projects.draft_table_of_contents_has_changes on data_layers changes.
create or replace function after_data_layers_update_or_delete_set_draft_table_of_contents_()
returns trigger
security definer
as $$
begin
  if coalesce(current_setting('seasketch.skip_library_source_side_effects', true), '') = 'true' then
    return NEW;
  end if;
  update projects
  set draft_table_of_contents_has_changes = true
  where id in (
    select 
      tocs.project_id
    from 
      table_of_contents_items as tocs
    where 
      tocs.data_layer_id = old.id
  );
  return NEW;
end;
$$ language plpgsql;

-- Sets projects.draft_table_of_contents_has_changes on data_sources changes.
create or replace function after_data_sources_update_or_delete_set_draft_table_of_contents()
returns trigger
security definer
as $$
begin
  if coalesce(current_setting('seasketch.skip_library_source_side_effects', true), '') = 'true' then
    return NEW;
  end if;
  update projects
  set draft_table_of_contents_has_changes = true
  where id in (
    select 
      tocs.project_id
    from 
      table_of_contents_items as tocs
    where 
      tocs.data_layer_id in (
        select data_layers.id from data_layers where data_layers.data_source_id = old.id
      )
    );
  return NEW;
end;
$$ language plpgsql;

-- Sets projects.draft_table_of_contents_has_changes on TOC changes (fires from
-- bounds updates during library fan-out).
create or replace function table_of_contents_items_project_update()
returns trigger
security definer
as $$
    begin
      if coalesce(current_setting('seasketch.skip_library_source_side_effects', true), '') = 'true' then
        return NEW;
      end if;
      if tg_op = 'INSERT' or tg_op = 'UPDATE' or tg_op = 'DELETE' then
        update projects set draft_table_of_contents_has_changes = true where id = NEW.project_id;
      end if;
      return NEW;
    end;
  $$ language plpgsql;

-- Published TOC items are normally immutable, but library fan-out needs to
-- update bounds on published copies (and the backfill below tags them with
-- copied_from_data_library_template_id), so the immutability guard honors the
-- GUC as well. All other validation in the function is unchanged.
create or replace function before_insert_or_update_table_of_contents_items_trigger()
returns trigger
security definer
as $$
  begin
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
$$ language plpgsql;

-- Records layer:uploaded when data_layers.data_source_id changes to an
-- upload-backed source (the replace_data_source path).
create or replace function trg_changelog_data_layers_data_source_layer_uploaded()
returns trigger
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uploaded_by     int;
  v_filename        text;
  v_changelog       text;
  v_summary         jsonb;
  v_url             text;
  v_toc             record;
begin
  if coalesce(current_setting('seasketch.skip_library_source_side_effects', true), '') = 'true' then
    return new;
  end if;

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
$$ language plpgsql;

comment on function trg_changelog_data_layers_data_source_layer_uploaded() is 'Records layer:uploaded (replacement) when a data_layer data_source_id changes to an upload-backed source; to_summary may include data_sources.changelog (e.g. replace_data_source). Suppressed during data library source fan-out via seasketch.skip_library_source_side_effects.';

-- -----------------------------------------------------------------------------
-- 2. replace_data_source: live fan-out + no publish/changelog noise for
--    data library templates.
-- -----------------------------------------------------------------------------

create or replace function replace_data_source(data_layer_id integer, data_source_id integer, source_layer text, bounds numeric[], gl_styles jsonb, stableid text)
returns void
security definer
language plpgsql
as $$
    declare
      old_source_id integer;
      old_source_type text;
      old_metadata_is_dynamic boolean;
      dl_template_id text;
      replacing_reporting_layer boolean := false;
      projectid integer;
      stable_ids text[];
      source_processing_job_key text;
    begin
        -- first, determine if a related table_of_contents_item has
        -- data_library_template_id set. If so, this is a data library template
        -- update and must fan out to copies in other projects (draft and
        -- published) without generating changelog entries or flipping
        -- draft_table_of_contents_has_changes.

        select data_library_template_id into dl_template_id from table_of_contents_items where table_of_contents_items.data_layer_id = replace_data_source.data_layer_id and data_library_template_id is not null limit 1;

        select project_id from data_sources where id = replace_data_source.data_source_id into projectid;

        -- Check to see if this layer is used in reporting
        if dl_template_id is null then
          select 
            array_agg(distinct stable_id)
            into stable_ids
          from 
            report_cards
            cross join lateral unnest(extract_stable_ids_from_body(report_cards.body)) as stable_id
          where
            report_tab_id in (
              select id from report_tabs where report_id in (
                select id from reports where project_id = projectid
              )
            );
          if stableid = any(coalesce(stable_ids, '{}')) then
            replacing_reporting_layer := true;
          end if;
        end if;


        select data_layers.data_source_id into old_source_id from data_layers where id = replace_data_source.data_layer_id;
        select type into old_source_type from data_sources where id = old_source_id;
        select metadata is null and (old_source_type = 'arcgis-vector' or old_source_type = 'arcgis-dynamic-mapserver') into old_metadata_is_dynamic from table_of_contents_items where table_of_contents_items.data_layer_id = replace_data_source.data_layer_id limit 1;
        insert into archived_data_sources (
          data_source_id,
          data_layer_id,
          version,
          mapbox_gl_style,
          changelog,
          source_layer,
          bounds,
          sublayer,
          sublayer_type,
          dynamic_metadata,
          project_id
        ) values (
          old_source_id,
          replace_data_source.data_layer_id,
          (
            select 
              coalesce(max(version), 0) + 1 
            from 
              archived_data_sources 
            where archived_data_sources.data_layer_id = replace_data_source.data_layer_id
          ),
          (
            select 
              mapbox_gl_styles
            from 
              data_layers 
            where id = replace_data_source.data_layer_id
          ),
          (select changelog from data_sources where id = replace_data_source.data_source_id),
          (select data_layers.source_layer from data_layers where data_layers.id = replace_data_source.data_layer_id),
          (select table_of_contents_items.bounds from table_of_contents_items where table_of_contents_items.data_layer_id = replace_data_source.data_layer_id and table_of_contents_items.bounds is not null limit 1),
          (select sublayer from data_layers where id = replace_data_source.data_layer_id),
          (select sublayer_type from data_layers where id = replace_data_source.data_layer_id),
          old_metadata_is_dynamic,
          projectid
        );

        if dl_template_id is not null then
          -- Library updates are "live": suppress draft_table_of_contents_has_changes
          -- and layer:uploaded changelog side effects for the remainder of this
          -- function. Statement-scoped (transaction-local) and cleared before
          -- returning.
          perform set_config('seasketch.skip_library_source_side_effects', 'true', true);

          -- Stamp the template id onto the new source and every source
          -- currently referenced by copies of this template (all versions of
          -- the library source end up stamped, which is what the fan-out below
          -- keys off of).
          update 
            data_sources
          set data_library_template_id = dl_template_id
          where 
          id = replace_data_source.data_source_id or
          id = any((
            select
              data_layers.data_source_id
            from
              data_layers
            where
              id = any (
                select
                  table_of_contents_items.data_layer_id
                from
                  table_of_contents_items
                where
                  copied_from_data_library_template_id = dl_template_id or
                  data_library_template_id = dl_template_id
              )
          )) or id = any ((
            select 
              data_layers.data_source_id 
            from
              data_layers
            where
              id = replace_data_source.data_layer_id 
          ));
        end if;

        update 
          data_layers 
        set 
          data_source_id = replace_data_source.data_source_id, 
          source_layer = replace_data_source.source_layer, 
          mapbox_gl_styles = coalesce(
            gl_styles, data_layers.mapbox_gl_styles
          ), 
          sublayer = null 
        where 
          id = replace_data_source.data_layer_id;

        if dl_template_id is not null then
          -- Fan out to every layer referencing any (stamped) version of the
          -- library source. Covers draft copies, published copies, and copies
          -- stranded on an older version (e.g. after a template rollback).
          update
            data_layers
          set
            data_source_id = replace_data_source.data_source_id,
            source_layer = replace_data_source.source_layer
          where
            id != replace_data_source.data_layer_id and
            data_layers.data_source_id != replace_data_source.data_source_id and
            data_layers.data_source_id in (
              select id from data_sources where data_sources.data_library_template_id = dl_template_id
            );

          -- Update bounds on exactly the TOC items whose layers were swapped
          -- (template + all copies, draft and published).
          update 
            table_of_contents_items 
          set bounds = replace_data_source.bounds 
          where 
            table_of_contents_items.data_layer_id in (
              select id from data_layers where data_layers.data_source_id = replace_data_source.data_source_id
            );

          perform set_config('seasketch.skip_library_source_side_effects', 'false', true);
        else
          update 
            table_of_contents_items 
          set bounds = replace_data_source.bounds 
          where 
            table_of_contents_items.data_layer_id = replace_data_source.data_layer_id;
        end if;

        if replacing_reporting_layer then
          -- trigger proprocessing graphile-worker job
          insert into source_processing_jobs (data_source_id, project_id) values (replace_data_source.data_source_id, projectid) on conflict do nothing returning job_key into source_processing_job_key;
          if source_processing_job_key is not null then
            PERFORM graphile_worker.add_job(
              'preprocessSource',
              json_build_object('jobKey', source_processing_job_key),
              max_attempts := 1
            );
          end if;
        end if;

    end;
  $$;

-- -----------------------------------------------------------------------------
-- 3. publish_table_of_contents: keep published layers on shared library
--    sources instead of cloning, and carry copied_from_data_library_template_id
--    onto published TOC rows.
--    (data_library_template_id itself is intentionally NOT copied; it has a
--    UNIQUE constraint and belongs only to the canonical draft template.)
-- -----------------------------------------------------------------------------

create or replace function publish_table_of_contents("projectId" integer)
returns setof table_of_contents_items
security definer
language plpgsql
as $$
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
begin
  -- check permissions
  if session_is_admin("projectId") = false then
    raise 'Permission denied. Must be a project admin';
  end if;

  -- delete existing published table of contents items, layers, sources, and interactivity settings
  -- (published overlay_data_tables cascade-delete with their TOC rows)
  delete from
    interactivity_settings
  where
    id in (
      select
        data_layers.interactivity_settings_id
      from
        data_layers
      inner join
        table_of_contents_items
      on
        data_layers.id = table_of_contents_items.data_layer_id
      where
        table_of_contents_items.project_id = "projectId" and
        is_draft = false
    );

  -- Never delete shared data library sources; they are referenced by the
  -- canonical template and by draft/published copies in other projects.
  delete from data_sources where data_sources.data_library_template_id is null and data_sources.id in (
    select
      data_source_id
    from
      data_layers
    inner join
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
      enable_download,
      enable_data_tables,
      data_table_join_column,
      copied_from_data_library_template_id
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
      item.enable_download,
      item.enable_data_tables,
      item.data_table_join_column,
      item.copied_from_data_library_template_id
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

  -- Copy active draft overlay data tables onto newly published TOC items in one
  -- statement (matched by TOC stable_id). Soft-deleted draft history is skipped.
  -- Data table stable_id is preserved so bookmarks/prefs survive publish.
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
    column_stats_remote,
    visualization_columns,
    visualization_ops,
    required_filter_columns,
    stable_id
  )
  select
    published_toc.id,
    odt.project_id,
    odt.name,
    odt.join_column,
    odt.overlay_join_column,
    odt.row_count,
    odt.created_by,
    odt.version,
    odt.parquet_remote,
    odt.column_stats_remote,
    odt.visualization_columns,
    odt.visualization_ops,
    odt.required_filter_columns,
    odt.stable_id
  from overlay_data_tables odt
  inner join table_of_contents_items draft_toc
    on draft_toc.id = odt.table_of_contents_item_id
  inner join table_of_contents_items published_toc
    on published_toc.project_id = draft_toc.project_id
    and published_toc.stable_id = draft_toc.stable_id
    and published_toc.is_draft = false
  where draft_toc.project_id = "projectId"
    and draft_toc.is_draft = true
    and draft_toc.is_folder = false
    and odt.deleted_at is null;

  -- one-by-one, copy related sources and update foreign keys of layers.
  -- Data library sources are skipped: published layers keep referencing the
  -- shared source so library updates are visible to end-users immediately
  -- ("live" layers), without requiring a republish.
  for source_id in
    select distinct(data_layers.data_source_id) from data_layers
    inner join data_sources
      on data_sources.id = data_layers.data_source_id
    where data_sources.data_library_template_id is null and data_layers.id in (
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

-- -----------------------------------------------------------------------------
-- 4. One-time backfill.
--    Idempotent: safe if current.sql is re-run by graphile-migrate watch.
-- -----------------------------------------------------------------------------

-- Suppress publish-flag / changelog side effects for the backfill statements.
select set_config('seasketch.skip_library_source_side_effects', 'true', false);

-- 4a. Tag published siblings of draft library copies so they participate in
--     future fan-out and remain identifiable.
update table_of_contents_items pub
set copied_from_data_library_template_id = draft.copied_from_data_library_template_id
from table_of_contents_items draft
where
  pub.is_draft = false and
  pub.copied_from_data_library_template_id is null and
  draft.is_draft = true and
  draft.project_id = pub.project_id and
  draft.stable_id = pub.stable_id and
  draft.copied_from_data_library_template_id is not null;

-- 4b. Re-point published library layers from their publish-time clone sources
--     to the shared (draft) source. Orphaned clones are left in place; they
--     are invisible to projects and existing cleanup paths handle source
--     lifecycle. Remote objects are protected by the remote-url refcount in
--     cleanupDeletedOverlayRecords whenever clones are eventually deleted.
update data_layers dl
set
  data_source_id = draft_dl.data_source_id,
  source_layer = draft_dl.source_layer
from
  table_of_contents_items pub,
  table_of_contents_items draft,
  data_layers draft_dl
where
  pub.is_draft = false and
  pub.copied_from_data_library_template_id is not null and
  pub.data_layer_id = dl.id and
  draft.is_draft = true and
  draft.project_id = pub.project_id and
  draft.stable_id = pub.stable_id and
  draft.copied_from_data_library_template_id = pub.copied_from_data_library_template_id and
  draft_dl.id = draft.data_layer_id and
  dl.data_source_id is distinct from draft_dl.data_source_id;

select set_config('seasketch.skip_library_source_side_effects', 'false', false);

-- 4c. Delete historical changelog noise generated by automated library
--     updates (e.g. "34 updates to CRW" entries in publish modals).
--     net_zero_changes is a generated column and cannot be flipped, so these
--     rows are removed instead. Admin-authored history is untouched.
delete from change_logs
where field_group = 'layer:uploaded'
  and editor_id in (select id from users where sub = 'data-library-template-updater');

-- 4d. Conservatively clear false "needs publish" flags. Only projects that:
--       * contain library copies (or templates),
--       * have published at least once, and
--       * have zero remaining non-publish changelog activity since their last
--         publish
--     are cleared. Leaving a stale flag (admin publishes a no-op) is harmless;
--     hiding real unpublished changes is not, so mixed-activity projects keep
--     their flag until the next publish.
update projects p
set draft_table_of_contents_has_changes = false
where
  p.draft_table_of_contents_has_changes = true and
  p.table_of_contents_last_published is not null and
  exists (
    select 1 from table_of_contents_items t
    where t.project_id = p.id
      and (
        t.copied_from_data_library_template_id is not null or
        t.data_library_template_id is not null
      )
  ) and
  not exists (
    select 1 from change_logs cl
    where cl.project_id = p.id
      and cl.last_at > p.table_of_contents_last_published
      and cl.field_group != 'layers:published'
      and cl.net_zero_changes = false
  );
