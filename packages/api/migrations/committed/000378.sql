--! Previous: sha1:7141afb3f3cc8923e5b16a64ceaaef0645c2972a
--! Hash: sha1:cbda519be653b92b96dfbc9a09e3dbea220805de

-- Enter migration here

CREATE OR REPLACE FUNCTION public.get_metrics_for_geography(geography_id integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
  begin
    if not session_has_project_access((select project_id from project_geography where id = geography_id limit 1)) then
      raise exception 'Permission denied';
    end if;
    return (
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'type', type,
          'updatedAt', updated_at,
          'createdAt', created_at,
          'value', value,
          'state', state,
          'sourceUrl', overlay_source_url,
          'sourceType', extension_to_source_type(overlay_source_url),
          'groupBy', overlay_group_by,
          'includedProperties', included_properties,
          'subject', jsonb_build_object('id', subject_geography_id, '__typename', 'GeographySubject'),
          'errorMessage', error_message,
          'progress', progress_percentage,
          'jobKey', job_key,
          'sourceProcessingJobDependency', source_processing_job_dependency,
          'eta', eta,
          'startedAt', started_at,
          'durationSeconds', extract(epoch from duration)::float
        )
      )
      from spatial_metrics
      where subject_geography_id = geography_id
    );
  end;
  $$;

CREATE OR REPLACE FUNCTION public.get_metrics_for_sketch(skid integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
  declare
    policy_passed boolean;
    hash_fragments text[];
  begin
    policy_passed := check_sketch_rls_policy(skid);
    if not policy_passed then
      raise exception 'Permission denied';
    end if;
    select array_agg(hash) into hash_fragments
    from get_fragment_ids_for_sketch_recursive(skid);
    return (
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'type', type,
          'updatedAt', updated_at,
          'createdAt', created_at,
          'value', value,
          'state', state,
          'sourceUrl', overlay_source_url,
          'sourceType', extension_to_source_type(overlay_source_url),
          'groupBy', overlay_group_by,
          'includedProperties', included_properties,
          'subject', jsonb_build_object('hash', subject_fragment_id, 'sketches', (select array_agg(sketch_id) from sketch_fragments where fragment_hash = subject_fragment_id), 'geographies', (select array_agg(geography_id) from fragment_geographies where fragment_hash = subject_fragment_id), '__typename', 'FragmentSubject'),
          'errorMessage', error_message,
          'progress', progress_percentage,
          'jobKey', job_key,
          'sourceProcessingJobDependency', source_processing_job_dependency,
          'eta', eta,
          'startedAt', started_at,
          'durationSeconds', extract(epoch from duration)::float
        )
      )
      from spatial_metrics
      where subject_fragment_id = any(hash_fragments)
      and subject_geography_id is null
    );
  end;
  $$;

CREATE OR REPLACE FUNCTION public.get_spatial_metric(metric_id bigint) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
  declare
    policy_passed boolean;
    subj_geography_id integer;
    subj_fragment_id text;
  begin
    select subject_geography_id, subject_fragment_id into subj_geography_id, subj_fragment_id
    from spatial_metrics
    where id = metric_id;
    if current_user not in ('graphile_worker', 'postgres') then
      if subj_geography_id is not null then
        if not session_has_project_access((select project_id from project_geography where id = subj_geography_id limit 1)) then
          raise exception 'Permission denied';
        end if;
      else
        policy_passed := check_sketch_rls_policy((select sketch_id from sketch_fragments where fragment_hash = subj_fragment_id limit 1));
        if not policy_passed then
          raise exception 'Permission denied';
        end if;
      end if;
    end if;
    return (
      select jsonb_build_object(
        'id', id,
        'type', type,
        'updatedAt', updated_at,
        'createdAt', created_at,
        'value', value,
        'state', state,
        'sourceUrl', overlay_source_url,
        'sourceType', extension_to_source_type(overlay_source_url),
        'groupBy', overlay_group_by,
        'includedProperties', included_properties,
        'jobKey', job_key,
        'subject', 
        case when subject_geography_id is not null then
          jsonb_build_object('id', subject_geography_id, '__typename', 'GeographySubject')
        else
          jsonb_build_object('hash', subject_fragment_id, 'sketches', (select array_agg(sketch_id) from sketch_fragments where fragment_hash = subject_fragment_id), 'geographies', (select array_agg(geography_id) from fragment_geographies where fragment_hash = subject_fragment_id), '__typename', 'FragmentSubject')
        end,
        'errorMessage', error_message,
        'progress', progress_percentage,
        'sourceProcessingJobDependency', source_processing_job_dependency,
        'eta', eta,
        'startedAt', started_at,
        'durationSeconds', extract(epoch from duration)::float
      ) from spatial_metrics where id = metric_id
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
      CREATE TEMP TABLE _rcl_snapshot (
        report_card_id integer,
        table_of_contents_item_id integer,
        group_by text,
        stable_id text
      ) ON COMMIT DROP;

      INSERT INTO _rcl_snapshot (report_card_id, table_of_contents_item_id, group_by, stable_id)
      SELECT
        rcl.report_card_id,
        rcl.table_of_contents_item_id,
        rcl.group_by,
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
          insert into report_card_layers (report_card_id, group_by, table_of_contents_item_id) values (ref.report_card_id, ref.group_by, new_toc_id);
        end if;
      end loop;
      -- return items
      return query select * from table_of_contents_items 
        where project_id = "projectId" and is_draft = false;
    end;
  $$;

create or replace function retry_failed_source_processing_job(jobkey text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    updated_job_key text;
  begin
    update source_processing_jobs set state = 'queued', error_message = null, updated_at = now(), created_at = now(), progress_percentage = 0, job_key = gen_random_uuid()::text where job_key = jobkey returning job_key into updated_job_key;
    if updated_job_key is not null then
      update spatial_metrics set source_processing_job_dependency = updated_job_key where source_processing_job_dependency = jobkey;
      perform graphile_worker.add_job(
        'preprocessSource',
        json_build_object('jobKey', updated_job_key),
        max_attempts := 1
      );
    end if;
    return true;
  end;
  $$;

CREATE OR REPLACE FUNCTION public.retry_failed_spatial_metrics(metric_ids bigint[]) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    metric spatial_metrics;
    updated_metric_id bigint;
    metric_id bigint;
    job_dep text;
    existing_job_state spatial_metric_state;
  begin
    -- loop through the metric ids, and update the state to queued
    foreach metric_id in array metric_ids loop
      update 
        spatial_metrics 
      set 
        state = 'queued', 
        error_message = null, 
        updated_at = now(), 
        created_at = now(), 
        progress_percentage = 0, 
        job_key = gen_random_uuid()::text 
      where 
        id = metric_id 
      returning 
        id into updated_metric_id;
      if updated_metric_id is not null then
        -- if this metric depends on a source_processing_job, restart it first
        select source_processing_job_dependency into job_dep from spatial_metrics where id = updated_metric_id;
        if job_dep is not null then
          select state into existing_job_state from source_processing_jobs where job_key = job_dep;
          if existing_job_state = 'error' then
            perform retry_failed_source_processing_job(job_dep);
          end if;
        end if;
        perform graphile_worker.add_job(
          'calculateSpatialMetric',
          json_build_object('metricId', updated_metric_id),
          max_attempts := 1,
          job_key := 'calculateSpatialMetric:' || updated_metric_id,
          job_key_mode := 'replace'
        );
      end if;
    end loop;
    return true;
  end;
  $$;


CREATE OR REPLACE FUNCTION public.after_delete_toc_items_cascade_report_card_layers() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF OLD.is_draft THEN
    DELETE FROM public.report_card_layers rcl
    USING public.report_cards rc,
          public.report_tabs rtab,
          public.reports r
    WHERE rcl.table_of_contents_item_id = OLD.id
      AND rc.id = rcl.report_card_id
      AND rc.is_draft = true;
  END IF;
  RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.recalculate_spatial_metrics(metric_ids bigint[], preprocess_sources boolean) RETURNS boolean
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
      -- loop through the source preprocessing jobs, and retry them
      foreach source_job_key in array source_preprocessing_jobs loop
        select data_source_id into source_id from source_processing_jobs where job_key = source_job_key;
        if source_id is not null then
          delete from data_upload_outputs where data_source_id = source_id and type = 'ReportingFlatgeobufV1'::data_upload_output_type;
        end if;
        delete from spatial_metrics where source_processing_job_dependency = source_job_key;
        perform retry_failed_source_processing_job(source_job_key);
      end loop;
    end if;
    return true;
  end;
$$;
