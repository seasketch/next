--! Previous: sha1:c368e554d7649da0b8ac59aa803bd5f8b2ed5e0f
--! Hash: sha1:0d8e1d2b60b7ca54e574687c87c3ad091698e8c4

ALTER TABLE data_upload_outputs ADD COLUMN IF NOT EXISTS num_invalid_features integer;
ALTER TABLE data_upload_outputs ADD COLUMN IF NOT EXISTS num_features integer;
ALTER TABLE data_upload_outputs ADD COLUMN IF NOT EXISTS num_repaired_features integer;
ALTER TABLE data_upload_outputs ADD COLUMN IF NOT EXISTS was_repaired boolean;


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
          epsg,
          num_features,
          num_invalid_features,
          num_repaired_features,
          was_repaired
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
            epsg,
            num_features,
            num_invalid_features,
            num_repaired_features,
            was_repaired
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

      -- return items
      return query select * from table_of_contents_items 
        where project_id = "projectId" and is_draft = false;
    end;
  $$;



CREATE OR REPLACE FUNCTION public.copy_table_of_contents_item(item_id integer, copy_data_source boolean, append_copy_to_name boolean, "projectId" integer, lpath public.ltree, "parentStableId" text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
          changelog
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
          changelog
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
        translated_props,
        data_source_type,
        original_source_upload_available,
        copied_from_data_library_template_id
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
        translated_props,
        data_source_type,
        original_source_upload_available,
        data_library_template_id
      from table_of_contents_items where id = item_id returning id into copy_id;
      return copy_id;
    end;
  $$;



CREATE OR REPLACE FUNCTION public.publish_report(sketch_class_id integer) RETURNS public.sketch_classes
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      published_sketch_class sketch_classes;
      new_report reports;
      draft_report_id int;
      project_id int;
      new_report_id int;
      new_tab_id int;
      old_report_id int;
      new_report_card_id int;
      source_card report_cards;
      published_toc_item_id int;
      source_url text;
      published_source_id int;
      original_source_id int;
      published_data_upload_output_id int;
      original_card_ids integer[];
      original_tab_ids integer[];
      referenced_stable_ids text[];
      missing_outputs integer[];
      stable_ids_missing_outputs text[];
      draft_data_source_urls text[];
      published_data_source_urls text[];
      sid text;
    begin
      -- Note that this function copies many columns by name, much like the 
      -- data layers table of contents publishing function. Like it, we will
      -- need to update this function regularly as columns are added or removed.
      
      -- Get the draft report id and project id
      select sc.draft_report_id, sc.project_id 
      from sketch_classes sc 
      where sc.id = sketch_class_id 
      into draft_report_id, project_id;
      
      -- Check authorization
      -- if not session_is_admin(project_id) then
      --   raise exception 'You are not authorized to publish this report';
      -- end if;
      
      -- Check that there is an existing draft report
      if draft_report_id is null then
        raise exception 'No draft report exists for this sketch class';
      end if;
      
      -- Get the current published report id (if any)
      select sc.report_id from sketch_classes sc where sc.id = sketch_class_id into old_report_id;
      
      -- Create a new report by copying the draft report
      insert into reports (project_id, sketch_class_id)
      select reports.project_id, reports.sketch_class_id
      from reports 
      where id = draft_report_id
      returning * into new_report;
      
      new_report_id := new_report.id;

      original_tab_ids := array(select id from report_tabs where report_id = draft_report_id);
      original_card_ids := array(select id from report_cards where report_tab_id in (select id from report_tabs where report_id = draft_report_id));

      referenced_stable_ids := get_referenced_stable_ids_for_report(draft_report_id);


      -- make sure there's at least one referenced stable id
      if array_length(referenced_stable_ids, 1) = 0 then
        raise exception 'No stable ids found in the draft report';
      end if;

      -- verify that all referenced stable ids have a published counterpart
      if (select count(*) from table_of_contents_items where stable_id = any(referenced_stable_ids) and is_draft = false) < array_length(referenced_stable_ids, 1) then
        raise exception 'This report references data layers that have not yet been published. Please publish the layer list first.';
      end if;

      -- verify that all referenced data sources have matching urls
      draft_data_source_urls := (select array_agg(url) from data_sources where id = any(select data_source_id from data_layers where id = any(select data_layer_id from table_of_contents_items where stable_id = any(referenced_stable_ids) and is_draft = true)));
      published_data_source_urls := (select array_agg(url) from data_sources where url = any(draft_data_source_urls) and id = any(select data_source_id from data_layers where id = any(select data_layer_id from table_of_contents_items where stable_id = any(referenced_stable_ids) and is_draft = false)));

      if array_length(draft_data_source_urls, 1) != array_length(published_data_source_urls, 1) then
        raise exception 'This report references updated versions of data sources which have not yet been published. Please publish the data sources first.';
      end if;

      -- verify all referenced table of contents items have been preprocessed
      missing_outputs := verify_table_of_contents_items_have_report_outputs((select array_agg(id) from table_of_contents_items where stable_id = any(referenced_stable_ids) and is_draft = true));
      if array_length(missing_outputs, 1) > 0 then
        raise exception 'This report references table of contents items that have not yet been processed for reporting. Please review your report for errors and ensure all cards render correctly before publishing.';
      end if;


      -- copy missing report-ready data_upload_outputs, if necessary
      stable_ids_missing_outputs := (
        select 
          array_agg(stable_id) 
        from 
          table_of_contents_items 
        where 
          stable_id = any(referenced_stable_ids) and 
          is_draft = false and 
          table_of_contents_items_reporting_output(table_of_contents_items.*) is null
        );
      if array_length(stable_ids_missing_outputs, 1) > 0 then
        -- We already know these layers reference the same "version" based on the data_source_url checks above, so it's safe to just copy the appropriate data_upload_outputs to the published table of contents item counterparts.
        foreach sid in array stable_ids_missing_outputs loop
          insert into data_upload_outputs (
            data_source_id,
            project_id,
            type,
            url,
            remote,
            is_original,
            size,
            filename,
            original_filename,
            is_custom_upload,
            fgb_header_size,
            source_processing_job_key,
            epsg,
            num_features,
            num_invalid_features,
            num_repaired_features,
            was_repaired
          ) select
            (select data_source_id from data_layers where id = (select data_layer_id from table_of_contents_items where stable_id = sid and is_draft = false)),
            data_upload_outputs.project_id,
            type,
            url,
            remote,
            is_original,
            size,
            filename,
            original_filename,
            is_custom_upload,
            fgb_header_size,
            source_processing_job_key,
            epsg,
            num_features,
            num_invalid_features,
            num_repaired_features,
            was_repaired
          from data_upload_outputs where data_source_id = (select data_source_id from data_layers where id = (select data_layer_id from table_of_contents_items where stable_id = sid and is_draft = true)) and is_reporting_type(type) order by created_at desc limit 1;
          raise notice 'Copied data_upload_output for stable id: %', sid;
        end loop;
      end if;

      -- -- copy references to source_processing_job and data_upload_outputs to these published table of content item counterparts
      -- for published_toc_counterpart_record in select * from jsonb_each(published_toc_counterparts) loop
      --   perform copy_report_output_to_published_table_of_contents_item(published_toc_counterpart_record.key::integer, published_toc_counterpart_record.value::integer);
      -- end loop;
      
      -- Copy all report tabs from draft to new report
      for new_tab_id in 
        select rt.id 
        from report_tabs rt 
        where rt.report_id = draft_report_id 
        order by rt.position
      loop
        declare
          new_tab_id_copy int;
          old_tab_id int;
        begin
          old_tab_id := new_tab_id;
          
          -- Insert the tab and get the new tab id
          insert into report_tabs (report_id, title, position, alternate_language_settings, updated_at)
          select new_report_id, title, position, alternate_language_settings, updated_at
          from report_tabs 
          where id = old_tab_id
          returning id into new_tab_id_copy;
          

          -- Copy all cards for this tab
          -- loop through all existing report_cards in the old tab, creating new
          -- non-draft report_cards in the new tab
          for source_card in
            select * from report_cards 
            where report_tab_id = old_tab_id
            order by position
          loop
            insert into report_cards (report_tab_id, body, position, alternate_language_settings, component_settings, type, tint, icon, updated_at, is_draft)
            values (
              new_tab_id_copy,
              source_card.body, 
              source_card.position, 
              source_card.alternate_language_settings, 
              source_card.component_settings, 
              source_card.type, 
              source_card.tint, 
              source_card.icon,
              source_card.updated_at,
              false
            ) returning id into new_report_card_id;

          end loop;
        end;
      end loop;
      
      -- Delete the current published report if it exists
      if old_report_id is not null then
        delete from reports where id = old_report_id;
      end if;
      
      -- Update sketch_class to point to the new published report
      update sketch_classes 
      set report_id = new_report_id 
      where id = sketch_class_id;
      
      -- Return the updated sketch class
      select * from sketch_classes where id = sketch_class_id into published_sketch_class;
      return published_sketch_class;
    end;
  $$;


DROP FUNCTION IF EXISTS public.retry_failed_source_processing_job(text);
DROP FUNCTION IF EXISTS public.retry_failed_source_processing_job(text, boolean);
CREATE OR REPLACE FUNCTION public.retry_failed_source_processing_job(jobkey text, repair_invalid boolean default false) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    updated_job_key text;
  begin
    -- Delete reporting-type outputs for the draft data source. They will be
    -- recreated when preprocessing completes. Published copies (which have a
    -- different data_source_id) are left untouched.
    delete from data_upload_outputs
      where source_processing_job_key = jobkey
        and data_source_id = (select data_source_id from source_processing_jobs where job_key = jobkey)
        and is_reporting_type(type);
    update source_processing_jobs set state = 'queued', error_message = null, updated_at = now(), created_at = now(), progress_percentage = 0, job_key = gen_random_uuid()::text where job_key = jobkey returning job_key into updated_job_key;
    if updated_job_key is not null then
      update spatial_metrics set source_processing_job_dependency = updated_job_key where source_processing_job_dependency = jobkey;
      perform graphile_worker.add_job(
        'preprocessSource',
        json_build_object('jobKey', updated_job_key, 'repairInvalid', repair_invalid),
        max_attempts := 1
      );
    end if;
    return true;
  end;
  $$;


DROP FUNCTION IF EXISTS public.recalculate_spatial_metrics(bigint[], boolean);
CREATE OR REPLACE FUNCTION public.recalculate_spatial_metrics(metric_ids bigint[], preprocess_sources boolean, repair_invalid boolean default false) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    metric_id bigint;
    source_id integer;
    source_url text;
    source_job_key text;
    source_preprocessing_jobs text[];
  begin
    if nullif(current_setting('session.user_id', true), '') is null then
      raise exception 'User not authenticated';
    end if;
    foreach metric_id in array metric_ids loop
      if preprocess_sources then
        select source_processing_job_dependency into source_job_key from spatial_metrics where id = metric_id;
        if source_job_key is not null then
          source_preprocessing_jobs = array_append(source_preprocessing_jobs, source_job_key);
        end if;
      end if;
      delete from spatial_metrics where id = metric_id and (subject_fragment_id is not null or session_is_admin((select project_id from project_geography where id = spatial_metrics.subject_geography_id limit 1)));
    end loop;
    if array_length(source_preprocessing_jobs, 1) > 0 then
      foreach source_job_key in array source_preprocessing_jobs loop
        select data_source_id into source_id from source_processing_jobs where job_key = source_job_key;
        if source_id is not null then
          delete from data_upload_outputs where data_source_id = source_id and is_reporting_type(type);
        end if;
        delete from spatial_metrics where source_processing_job_dependency = source_job_key;
        perform retry_failed_source_processing_job(source_job_key, repair_invalid);
      end loop;
    end if;
    return true;
  end;
$$;

grant execute on function recalculate_spatial_metrics to seasketch_user;
grant execute on function retry_failed_source_processing_job to seasketch_user;
