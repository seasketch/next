-- Enter migration here

create table if not exists ckan_metadata_sources (
  id int generated always as identity primary key,
  project_id int not null references projects(id) on delete cascade,
  base_url text not null,
  dataset_type text not null default 'dataset',
  title text,
  display_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(project_id, base_url)
);

comment on table ckan_metadata_sources is '@simpleCollections only';
comment on column ckan_metadata_sources.base_url is 'Normalized CKAN catalogue base URL, e.g. https://open.canada.ca/data/en';
comment on column ckan_metadata_sources.display_config is 'Source-level field selection, order, and label overrides applied to every layer linked to this catalogue.';

create index if not exists ckan_metadata_sources_project_id_idx on ckan_metadata_sources(project_id);

grant select, insert, update, delete on table ckan_metadata_sources to seasketch_user;

alter table ckan_metadata_sources enable row level security;

drop policy if exists ckan_metadata_sources_admin on ckan_metadata_sources;
create policy ckan_metadata_sources_admin on ckan_metadata_sources
  using (session_is_admin(project_id))
  with check (session_is_admin(project_id));

drop function if exists projects_ckan_metadata_sources(public.projects);

alter table table_of_contents_items
  add column if not exists ckan_dataset_url text;

grant select (ckan_dataset_url) on table_of_contents_items to anon;
grant update (ckan_dataset_url) on table_of_contents_items to seasketch_user;

comment on column table_of_contents_items.ckan_dataset_url is
  E'@name ckanDatasetUrl\nFully-qualified CKAN dataset page or API URL. When set, metadata is fetched from the record at view time and is not editable in SeaSketch.';

create or replace function public.table_of_contents_items_uses_dynamic_metadata(t public.table_of_contents_items)
returns boolean
language plpgsql
stable
security definer
as $$
  declare
    uses_dynamic_metadata boolean;
  begin
    if t.ckan_dataset_url is not null then
      return true;
    end if;
    if t.metadata is not null then
      return false;
    end if;
    if t.data_layer_id is null then
      return false;
    end if;
    select type = 'arcgis-dynamic-mapserver' or type = 'arcgis-vector' or type = 'arcgis-raster-tiles'
      into uses_dynamic_metadata
      from data_sources
      where id = (select data_source_id from data_layers where id = t.data_layer_id);
    return uses_dynamic_metadata;
  end;
$$;

CREATE OR REPLACE FUNCTION public.publish_table_of_contents("projectId" integer)
 RETURNS SETOF table_of_contents_items
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
      copied_from_data_library_template_id,
      hide_arcgis_rest_link,
      ckan_dataset_url
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
      item.copied_from_data_library_template_id,
      item.hide_arcgis_rest_link,
      item.ckan_dataset_url
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
    temporal,
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
    odt.temporal,
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
      temporal,
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
      temporal,
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
$function$

;

-- Preserve the setting when duplicating a layer.
CREATE OR REPLACE FUNCTION public.copy_table_of_contents_item(item_id integer, copy_data_source boolean, append_copy_to_name boolean, "projectId" integer, lpath ltree, "parentStableId" text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
    declare 
      copy_id int;
      child record;
      data_layer_copy_id int;
      original_data_source_id int;
      original_data_layer_id int;
      ds_id int;
      interactivity_id int;
      new_stable_id text;
      new_lpath ltree;
      isfolder boolean;
    begin
      select 
        data_layer_id, 
        is_folder 
      into 
        original_data_layer_id, 
        isfolder 
      from 
        table_of_contents_items 
      where 
        id = item_id;
      if isfolder = false and original_data_layer_id is null then
        raise exception 'original_data_layer_id is null';
      end if;
      select 
        data_source_id 
      into 
        original_data_source_id 
      from 
        data_layers 
      where 
        id = original_data_layer_id;
      if isfolder = false and original_data_source_id is null then
        raise exception 'original_data_source_id is null. original_data_layer=%', original_data_layer_id;
      end if;
      -- copy data source, if necessary
      if isfolder = false and copy_data_source then
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
          bucket_id,
          object_key,
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
          uploaded_by,
          was_converted_from_esri_feature_layer,
          created_by,
          changelog,
          temporal
        ) select
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
          bucket_id,
          object_key,
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
          uploaded_by,
          was_converted_from_esri_feature_layer,
          created_by,
          changelog,
          temporal
        from 
          data_sources
        where 
          id = original_data_source_id 
        returning 
          id 
        into 
          ds_id;     
        if ds_id is null then
          raise exception 'Failed to copy data source. original_data_source_id=%', original_data_source_id;
        end if;   
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
          epsg,
          num_features,
          num_invalid_features,
          num_repaired_features,
          was_repaired
        ) select 
            ds_id,
            "projectId",
            type,
            created_at,
            url,
            remote,
            is_original,
            size,
            filename,
            original_filename,
            epsg,
            num_features,
            num_invalid_features,
            num_repaired_features,
            was_repaired
          from 
            data_upload_outputs 
          where 
            data_source_id = original_data_source_id;
      else
        ds_id := original_data_source_id;
      end if;
      if isfolder = false then
        -- copy interactivity settings
        insert into interactivity_settings (
          type,
          short_template,
          long_template,
          cursor,
          layers,
          title
        ) select
          type,
          short_template,
          long_template,
          cursor,
          layers,
          title
        from interactivity_settings where id = (select interactivity_settings_id from data_layers where id = (select data_layer_id from table_of_contents_items where id = item_id)) returning id into interactivity_id;
        -- copy data layer

        insert into data_layers (
          project_id,
          data_source_id,
          source_layer,
          sublayer,
          render_under,
          mapbox_gl_styles,
          z_index,
          interactivity_settings_id,
          static_id,
          sublayer_type
        ) select
          "projectId",
          ds_id,
          source_layer,
          sublayer,
          render_under,
          mapbox_gl_styles,
          z_index,
          interactivity_id,
          static_id,
          sublayer_type
        from data_layers where id = original_data_layer_id
        returning id into data_layer_copy_id;
      end if;
      -- copy toc item
      new_stable_id := create_stable_id();
      -- create new lpath by appending new_stable_id to lpath using ltree api
      new_lpath := lpath || new_stable_id;
      insert into table_of_contents_items (
        path,
        project_id,
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
        enable_download,
        hide_arcgis_rest_link,
        translated_props,
        data_source_type,
        original_source_upload_available,
        copied_from_data_library_template_id,
        ckan_dataset_url
      ) select
        new_lpath,
        "projectId",
        new_stable_id,
        "parentStableId",
        (
          case 
            when append_copy_to_name then title || ' (copy)'
            else title
          end
        ),
        is_folder,
        show_radio_children,
        is_click_off_only,
        metadata,
        bounds,
        data_layer_copy_id,
        sort_index,
        hide_children,
        enable_download,
        hide_arcgis_rest_link,
        translated_props,
        data_source_type,
        original_source_upload_available,
        data_library_template_id,
        ckan_dataset_url
      from table_of_contents_items where id = item_id returning id into copy_id;
      return copy_id;
    end;
  $function$
;
