--! Previous: sha1:d20b263713b6677759f13ddf403126ce0e0de22e
--! Hash: sha1:e632987478bed226e7e4fba2c9d4bd91f0476f2b

-- Replace contextualized_mean with column_stats in spatial_metric_type enum

-- Step 1: Add the new enum value first (safe operation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'spatial_metric_type'
      AND e.enumlabel = 'column_values'
  ) THEN
    ALTER TYPE spatial_metric_type ADD VALUE 'column_values';
  END IF;
END $$;

-- Step 2: Delete any existing metrics with contextualized_mean type
DELETE FROM spatial_metrics WHERE type = 'contextualized_mean'::spatial_metric_type;

alter table data_upload_outputs add column if not exists epsg integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'spatial_metric_type'
      AND e.enumlabel = 'column_values'
  ) THEN
    ALTER TYPE spatial_metric_type ADD VALUE 'column_values';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'data_upload_output_type'
      AND e.enumlabel = 'ReportingCOG'
  ) THEN
    ALTER TYPE data_upload_output_type ADD VALUE 'ReportingCOG';
  END IF;
END $$;

create or replace function is_reporting_type(type data_upload_output_type)
returns boolean
language sql
as $$
  select type::text in ('ReportingCOG', 'ReportingFlatgeobufV1') as is_reporting_type;
$$;

grant execute on function is_reporting_type to anon;

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
      rcl report_card_layers;
      published_data_upload_output_id int;
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
      if not session_is_admin(project_id) then
        raise exception 'You are not authorized to publish this report';
      end if;
      
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
          -- non-draft report_cards in the new tab, and copying report_card_layers
          for source_card in
            select * from report_cards 
            where report_tab_id = old_tab_id
            order by position
          loop
            insert into report_cards (report_tab_id, body, position, alternate_language_settings, component_settings, type, tint, icon, updated_at, is_draft, collapsible_footer_body, collapsible_footer_enabled)
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
              false,
              source_card.collapsible_footer_body,
              source_card.collapsible_footer_enabled
            ) returning id into new_report_card_id;

            for rcl in
              select * from report_card_layers where report_card_id = source_card.id
            loop
              -- get the associated data source for the referenced draft tocitem
              select data_source_id into original_source_id from data_layers where id = (
                select data_layer_id from table_of_contents_items where id = rcl.table_of_contents_item_id
              ) limit 1;
              select 
                url into source_url 
              from 
                data_sources where id = original_source_id;
              if original_source_id is null then
                raise exception 'original_source_id is null';
              end if;
              if source_url is null then
                raise exception 'source_url is null';
              end if;

              -- ensure there is a published counterpart to the draft toc item
              select
                id into published_toc_item_id
              from
                table_of_contents_items
              where
                is_draft = false and
                data_layer_id in (
                  select
                    id
                  from
                    data_layers
                  where
                    data_source_id in (
                      select id from data_sources where url = source_url
                    )
                )
              limit 1;
              if published_toc_item_id is null then
                raise exception 'This report references data layers that have not yet been published. Please publish the layer list first.';
              end if;

              select data_source_id into published_source_id from data_layers where id = (
                select data_layer_id from table_of_contents_items where id = published_toc_item_id
              ) limit 1;

              if published_source_id is null then
                raise exception 'published_source_id is null';
              end if;

              -- copy data_upload_output with type = 'ReportingFlatgeobufV1' for the 
              -- published source replacing any that already exist.
              delete from data_upload_outputs where data_source_id = published_source_id and is_reporting_type(type);

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
                created_at
              ) select
                published_source_id,
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
                created_at
              from data_upload_outputs where data_source_id = original_source_id and is_reporting_type(type) order by created_at desc limit 1 returning id into published_data_upload_output_id;
              if published_data_upload_output_id is null then
                raise exception 'published_data_upload_output_id is null. Are you attempting to publish a report that references layers that have not completed preprocessing?';
              end if;
              -- copy the source processing job?
              insert into report_card_layers (report_card_id, table_of_contents_item_id, layer_parameters)
              values (
                new_report_card_id,
                published_toc_item_id,
                rcl.layer_parameters
              );
            end loop;
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
          delete from data_upload_outputs where data_source_id = source_id and is_reporting_type(type);
        end if;
        perform retry_failed_source_processing_job(source_job_key);
      end loop;
    end if;
    return true;
  end;
$$;

CREATE OR REPLACE FUNCTION public.report_card_layers_processed_output(layer public.report_card_layers) RETURNS public.data_upload_outputs
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select * from data_upload_outputs where data_source_id = (select data_source_id from data_layers where id = (select data_layer_id from table_of_contents_items where id = layer.table_of_contents_item_id)) and is_reporting_type(type) limit 1;
  $$;

CREATE OR REPLACE FUNCTION public.trigger_queue_preprocess_source_on_rcl() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    existing_output_id integer;
    ds_id integer;
    source_processing_job_key text;
  BEGIN
    -- Determine data source id for the referenced TOC item
    SELECT data_source_id INTO ds_id
    FROM data_layers
    WHERE id = (
      SELECT data_layer_id
      FROM table_of_contents_items
      WHERE id = NEW.table_of_contents_item_id
    );

    -- If we can't resolve a data source, do nothing
    IF ds_id IS NULL THEN
      raise exception 'No data source found for table of contents item %', NEW.table_of_contents_item_id;
      RETURN NEW;
    END IF;

    
    -- if no ReportingFlatgeobufV1 data upload output exists for this data source,
    -- enqueue a preprocess job for this data source
    if not exists (select 1 from data_upload_outputs where data_source_id = ds_id and is_reporting_type(type)) then
      insert into source_processing_jobs (data_source_id, project_id) values (ds_id, (select project_id from data_sources where id = ds_id)) on conflict do nothing returning job_key into source_processing_job_key;
      if source_processing_job_key is not null then
        PERFORM graphile_worker.add_job(
          'preprocessSource',
          json_build_object('jobKey', source_processing_job_key),
          max_attempts := 1
        );
      end if;
    end if;

    -- -- If no existing source processing job exists, enqueue a preprocess job for this data source
    -- IF (SELECT COUNT(*) FROM source_processing_jobs WHERE data_source_id = ds_id) = 0 THEN
    --   insert into source_processing_jobs (data_source_id, project_id) values (ds_id, (select project_id from data_sources where id = ds_id)) returning job_key into source_processing_job_key;
    --   PERFORM graphile_worker.add_job(
    --     'preprocessSource',
    --     json_build_object('jobKey', source_processing_job_key),
    --     max_attempts := 1
    --   );
    -- END IF;
    return new;
  END;
  $$;

CREATE OR REPLACE FUNCTION public.trigger_queue_spatial_metrics_on_source_complete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    metric_record RECORD;
    completed_source_url text;
  BEGIN
    IF NEW.state = 'complete' AND (OLD.state IS NULL OR OLD.state != 'complete') THEN
      -- get the completed source url
      select url into completed_source_url from data_upload_outputs where is_reporting_type(type) and data_source_id = NEW.data_source_id limit 1;
      if completed_source_url is null then
        raise exception 'Completed source url not found';
      end if;
      -- Find all spatial_metrics that depend on this source processing job
      FOR metric_record IN 
        SELECT id 
        FROM spatial_metrics 
        WHERE source_processing_job_dependency = NEW.job_key
      LOOP
        -- update the spatial_metrics with the completed source url
        update spatial_metrics set overlay_source_url = completed_source_url, state = 'queued' where id = metric_record.id;
        -- Queue a calculateSpatialMetric job for each dependent metric
        PERFORM graphile_worker.add_job(
          'calculateSpatialMetric',
          json_build_object('metricId', metric_record.id),
          max_attempts := 1,
          job_key := 'calculateSpatialMetric:' || metric_record.id,
          job_key_mode := 'replace'
        );
      END LOOP;
    END IF;
    IF NEW.state = 'error' AND (OLD.state IS NULL OR OLD.state != 'error') THEN
      -- update the spatial_metrics with the error message
      update spatial_metrics set state = 'error', error_message = 'Error processing source dependency.' where source_processing_job_dependency = NEW.job_key;
    END IF;
    
    RETURN NEW;
  END;
  $$;
