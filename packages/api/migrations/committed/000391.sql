--! Previous: sha1:a29f6da147329619b87264dfbdc134d982fcbe4f
--! Hash: sha1:456254661de12007ed2feb600e58b28079533adf

-- Enter migration here
-- Fix non-deterministic ordering in overlapping_fragments_for_collection
-- This ensures fragment processing order is consistent across test runs
CREATE OR REPLACE FUNCTION public.overlapping_fragments_for_collection(input_collection_id integer, input_envelopes public.geometry[], edited_sketch_id integer) RETURNS TABLE(hash text, geometry public.geometry, sketch_ids integer[], geography_ids integer[])
    LANGUAGE sql SECURITY DEFINER
    AS $$
  WITH sketches_in_collection AS (
    SELECT unnest(get_child_sketches_recursive(input_collection_id, 'sketch')) as id
  ),
  fragments_in_envelopes AS (
    SELECT f.*
    FROM fragments f
    JOIN unnest(input_envelopes) AS env ON f.geometry && env
  ),
  fragments_in_sketch as (
    select fragment_hash from sketch_fragments where sketch_id = edited_sketch_id
  ),
  overlapping_sketches AS (
    SELECT sketch_fragments.sketch_id
    FROM sketch_fragments
    WHERE sketch_fragments.fragment_hash = any(
      SELECT hash
      FROM fragments_in_envelopes
    ) or fragment_hash = any(
      select fragment_hash from fragments_in_sketch
    )
  )
  -- construct output table
  SELECT
    fragments.hash,
    fragments.geometry,
    ARRAY(
      SELECT sketch_fragments.sketch_id
      FROM sketch_fragments
      WHERE sketch_fragments.fragment_hash = fragments.hash
      AND sketch_fragments.sketch_id IN (SELECT id FROM sketches_in_collection)
      ORDER BY sketch_fragments.sketch_id
    ) AS sketch_ids,
    ARRAY(
      SELECT fragment_geographies.geography_id
      FROM fragment_geographies
      WHERE fragment_geographies.fragment_hash = fragments.hash
      ORDER BY fragment_geographies.geography_id
    ) AS geography_ids
  FROM fragments
  WHERE
    -- Include ALL fragments from sketches that have any overlapping fragments
  EXISTS (
    SELECT 1
    FROM sketch_fragments
    WHERE sketch_fragments.fragment_hash = fragments.hash
      AND sketch_fragments.sketch_id IN (SELECT sketch_id FROM overlapping_sketches)
      AND sketch_fragments.sketch_id IN (SELECT id FROM sketches_in_collection)
  )
  OR
  -- Include fragments that belong to the edited sketch
  EXISTS (
    SELECT 1
    FROM sketch_fragments
    WHERE sketch_fragments.fragment_hash = fragments.hash
      AND sketch_fragments.sketch_id = edited_sketch_id
  )
$$;

-- Also fix ordering in get_fragments_for_sketch for consistency
CREATE OR REPLACE FUNCTION public.get_fragments_for_sketch(sketch_id integer) RETURNS TABLE(hash text, geometry text, sketch_ids integer[], geography_ids integer[])
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    policy_passed boolean;
  begin
    -- Check that the session can access the given sketch using RLS policy
    policy_passed := check_sketch_rls_policy(get_fragments_for_sketch.sketch_id);
    if not policy_passed then
      raise exception 'Permission denied';
    end if;

    return query
    SELECT
    fragments.hash,
    ST_AsGeoJSON(fragments.geometry) as geometry,
    ARRAY(
      SELECT sketch_fragments.sketch_id
      FROM sketch_fragments
      WHERE sketch_fragments.fragment_hash = fragments.hash
      ORDER BY sketch_fragments.sketch_id
    ) AS sketch_ids,
    ARRAY(
      SELECT fragment_geographies.geography_id
      FROM fragment_geographies
      WHERE fragment_geographies.fragment_hash = fragments.hash
      ORDER BY fragment_geographies.geography_id
    ) AS geography_ids
    FROM fragments
    WHERE
    EXISTS (
      SELECT 1
      FROM sketch_fragments
      WHERE sketch_fragments.fragment_hash = fragments.hash
        AND sketch_fragments.sketch_id = get_fragments_for_sketch.sketch_id
    );
  end;
  $$;

CREATE OR REPLACE FUNCTION public.publish_table_of_contents("projectId" integer) RETURNS SETOF public.table_of_contents_items
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
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

      -- create a temporary table of report_card_layer references so that 
      -- existing published reports aren't broken by the publish operation.
      -- Drop if exists in case this function is called multiple times in the same transaction
      DROP TABLE IF EXISTS _rcl_snapshot;
      CREATE TEMP TABLE _rcl_snapshot (
        report_card_id integer,
        table_of_contents_item_id integer,
        layer_parameters jsonb,
        stable_id text
      ) ON COMMIT DROP;

      INSERT INTO _rcl_snapshot (report_card_id, table_of_contents_item_id, layer_parameters, stable_id)
      SELECT
        rcl.report_card_id,
        rcl.table_of_contents_item_id,
        rcl.layer_parameters,
        tci.stable_id
      FROM public.report_card_layers rcl
      JOIN public.table_of_contents_items tci
        ON tci.id = rcl.table_of_contents_item_id
      WHERE rcl.report_card_id in (
        select id from report_cards where report_tab_id in (
          select id from report_tabs where report_id in (
            select id from reports where project_id = "projectId"
          )
        )
      ) and tci.is_draft = false;
    
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
          original_filename
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
            original_filename
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

      -- restore report_card_layers that were referenced by the published report
      for ref in select * from _rcl_snapshot loop
        select id into new_toc_id from table_of_contents_items where stable_id = ref.stable_id and is_draft = false and project_id = "projectId";
        if new_toc_id is null then
          raise exception 'Table of contents item with stable_id % not found', ref.stable_id;
        end if;
        if new_toc_id is not null then
          insert into report_card_layers (report_card_id, layer_parameters, table_of_contents_item_id) values (ref.report_card_id, ref.layer_parameters, new_toc_id);
        end if;
      end loop;
      -- return items
      return query select * from table_of_contents_items 
        where project_id = "projectId" and is_draft = false;
    end;
  $$;
