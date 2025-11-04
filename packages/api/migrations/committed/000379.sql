--! Previous: sha1:cbda519be653b92b96dfbc9a09e3dbea220805de
--! Hash: sha1:cb9d2784cb5be99f152243e5d33fd7ef8ebfb27b

alter table source_processing_jobs drop column if exists data_upload_output_id;
alter table data_upload_outputs add column if not exists source_processing_job_key text references source_processing_jobs(job_key) on delete set null;


-- Enter migration here
-- Ensure unique indexes for spatial_metrics correctly handle NULL overlay_source_url
-- and distinguish pending metrics by source_processing_job_dependency. Idempotent.
DROP INDEX IF EXISTS spatial_metrics_fragment_unique_idx;
DROP INDEX IF EXISTS spatial_metrics_geography_unique_idx;

DROP INDEX IF EXISTS spatial_metrics_fragment_by_source_url_unique_idx;
DROP INDEX IF EXISTS spatial_metrics_fragment_by_job_unique_idx;
DROP INDEX IF EXISTS spatial_metrics_fragment_total_area_unique_idx;
DROP INDEX IF EXISTS spatial_metrics_geography_by_source_url_unique_idx;
DROP INDEX IF EXISTS spatial_metrics_geography_by_job_unique_idx;
DROP INDEX IF EXISTS spatial_metrics_geography_total_area_unique_idx;

-- Fragment-based metrics
CREATE UNIQUE INDEX IF NOT EXISTS spatial_metrics_fragment_by_source_url_unique_idx
  ON public.spatial_metrics (subject_fragment_id, type, overlay_source_url, COALESCE(overlay_group_by, ''))
  WHERE subject_fragment_id IS NOT NULL AND subject_geography_id IS NULL AND overlay_source_url IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS spatial_metrics_fragment_by_job_unique_idx
  ON public.spatial_metrics (subject_fragment_id, type, source_processing_job_dependency, COALESCE(overlay_group_by, ''))
  WHERE subject_fragment_id IS NOT NULL AND subject_geography_id IS NULL AND overlay_source_url IS NULL AND source_processing_job_dependency IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS spatial_metrics_fragment_total_area_unique_idx
  ON public.spatial_metrics (subject_fragment_id, type, COALESCE(overlay_group_by, ''))
  WHERE subject_fragment_id IS NOT NULL AND subject_geography_id IS NULL AND overlay_source_url IS NULL AND source_processing_job_dependency IS NULL AND type = 'total_area'::public.spatial_metric_type;

-- Geography-based metrics
CREATE UNIQUE INDEX IF NOT EXISTS spatial_metrics_geography_by_source_url_unique_idx
  ON public.spatial_metrics (subject_geography_id, type, overlay_source_url, COALESCE(overlay_group_by, ''))
  WHERE subject_geography_id IS NOT NULL AND subject_fragment_id IS NULL AND overlay_source_url IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS spatial_metrics_geography_by_job_unique_idx
  ON public.spatial_metrics (subject_geography_id, type, source_processing_job_dependency, COALESCE(overlay_group_by, ''))
  WHERE subject_geography_id IS NOT NULL AND subject_fragment_id IS NULL AND overlay_source_url IS NULL AND source_processing_job_dependency IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS spatial_metrics_geography_total_area_unique_idx
  ON public.spatial_metrics (subject_geography_id, type, COALESCE(overlay_group_by, ''))
  WHERE subject_geography_id IS NOT NULL AND subject_fragment_id IS NULL AND overlay_source_url IS NULL AND source_processing_job_dependency IS NULL AND type = 'total_area'::public.spatial_metric_type;
CREATE OR REPLACE FUNCTION public.get_or_create_spatial_metric(p_subject_fragment_id text, p_subject_geography_id integer, p_type public.spatial_metric_type, p_overlay_source_url text, p_overlay_group_by text, p_included_properties text[], p_source_processing_job_dependency text, p_project_id integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    metric_id bigint;
  begin
    if p_subject_fragment_id is not null and p_subject_geography_id is not null then
      raise exception 'Exactly one of subject_fragment_id or subject_geography_id must be provided';
    end if;
    if p_subject_fragment_id is null and p_subject_geography_id is null then
      raise exception 'Exactly one of subject_fragment_id or subject_geography_id must be provided';
    end if;
    if p_type is null then
      raise exception 'type parameter is required';
    end if;
    if (p_overlay_source_url is null and p_source_processing_job_dependency is null) and p_type != 'total_area' then
      raise exception 'overlay_source_url or source_processing_job_dependency parameter is required for non-total_area metrics';
    end if;
    
    if p_subject_fragment_id is not null then
      -- Fragment metrics
      if p_type = 'total_area' and p_overlay_source_url is null and p_source_processing_job_dependency is null then
        insert into spatial_metrics (
          subject_fragment_id,
          subject_geography_id,
          type,
          overlay_source_url,
          overlay_group_by,
          included_properties,
          source_processing_job_dependency,
          project_id
        ) values (
          p_subject_fragment_id,
          p_subject_geography_id,
          p_type,
          p_overlay_source_url,
          p_overlay_group_by,
          p_included_properties,
          p_source_processing_job_dependency,
          p_project_id
        )
        on conflict do nothing
        returning id into metric_id;
        if metric_id is null then
          select id into metric_id from spatial_metrics
          where subject_fragment_id = p_subject_fragment_id
            and subject_geography_id is null
            and type = 'total_area'::public.spatial_metric_type
            and overlay_source_url is null
            and source_processing_job_dependency is null
            and coalesce(overlay_group_by, '') = coalesce(p_overlay_group_by, '');
        end if;
      elsif p_overlay_source_url is not null then
        insert into spatial_metrics (
          subject_fragment_id,
          subject_geography_id,
          type,
          overlay_source_url,
          overlay_group_by,
          included_properties,
          source_processing_job_dependency,
          project_id
        ) values (
          p_subject_fragment_id,
          p_subject_geography_id,
          p_type,
          p_overlay_source_url,
          p_overlay_group_by,
          p_included_properties,
          p_source_processing_job_dependency,
          p_project_id
        )
        on conflict do nothing
        returning id into metric_id;
        if metric_id is null then
          select id into metric_id from spatial_metrics
          where subject_fragment_id = p_subject_fragment_id
            and subject_geography_id is null
            and type = p_type
            and overlay_source_url = p_overlay_source_url
            and coalesce(overlay_group_by, '') = coalesce(p_overlay_group_by, '');
        end if;
      else
        insert into spatial_metrics (
          subject_fragment_id,
          subject_geography_id,
          type,
          overlay_source_url,
          overlay_group_by,
          included_properties,
          source_processing_job_dependency,
          project_id
        ) values (
          p_subject_fragment_id,
          p_subject_geography_id,
          p_type,
          p_overlay_source_url,
          p_overlay_group_by,
          p_included_properties,
          p_source_processing_job_dependency,
          p_project_id
        )
        on conflict do nothing
        returning id into metric_id;
        if metric_id is null then
          select id into metric_id from spatial_metrics
          where subject_fragment_id = p_subject_fragment_id
            and subject_geography_id is null
            and type = p_type
            and overlay_source_url is null
            and source_processing_job_dependency = p_source_processing_job_dependency
            and coalesce(overlay_group_by, '') = coalesce(p_overlay_group_by, '');
        end if;
      end if;
    else
      -- Geography metrics
      if p_type = 'total_area' and p_overlay_source_url is null and p_source_processing_job_dependency is null then
        insert into spatial_metrics (
          subject_fragment_id,
          subject_geography_id,
          type,
          overlay_source_url,
          overlay_group_by,
          included_properties,
          source_processing_job_dependency,
          project_id
        ) values (
          p_subject_fragment_id,
          p_subject_geography_id,
          p_type,
          p_overlay_source_url,
          p_overlay_group_by,
          p_included_properties,
          p_source_processing_job_dependency,
          p_project_id
        )
        on conflict do nothing
        returning id into metric_id;
        if metric_id is null then
          select id into metric_id from spatial_metrics
          where subject_geography_id = p_subject_geography_id
            and subject_fragment_id is null
            and type = 'total_area'::public.spatial_metric_type
            and overlay_source_url is null
            and source_processing_job_dependency is null
            and coalesce(overlay_group_by, '') = coalesce(p_overlay_group_by, '');
        end if;
      elsif p_overlay_source_url is not null then
        insert into spatial_metrics (
          subject_fragment_id,
          subject_geography_id,
          type,
          overlay_source_url,
          overlay_group_by,
          included_properties,
          source_processing_job_dependency,
          project_id
        ) values (
          p_subject_fragment_id,
          p_subject_geography_id,
          p_type,
          p_overlay_source_url,
          p_overlay_group_by,
          p_included_properties,
          p_source_processing_job_dependency,
          p_project_id
        )
        on conflict do nothing
        returning id into metric_id;
        if metric_id is null then
          select id into metric_id from spatial_metrics
          where subject_geography_id = p_subject_geography_id
            and subject_fragment_id is null
            and type = p_type
            and overlay_source_url = p_overlay_source_url
            and coalesce(overlay_group_by, '') = coalesce(p_overlay_group_by, '');
        end if;
      else
        insert into spatial_metrics (
          subject_fragment_id,
          subject_geography_id,
          type,
          overlay_source_url,
          overlay_group_by,
          included_properties,
          source_processing_job_dependency,
          project_id
        ) values (
          p_subject_fragment_id,
          p_subject_geography_id,
          p_type,
          p_overlay_source_url,
          p_overlay_group_by,
          p_included_properties,
          p_source_processing_job_dependency,
          p_project_id
        )
        on conflict do nothing
        returning id into metric_id;
        if metric_id is null then
          select id into metric_id from spatial_metrics
          where subject_geography_id = p_subject_geography_id
            and subject_fragment_id is null
            and type = p_type
            and overlay_source_url is null
            and source_processing_job_dependency = p_source_processing_job_dependency
            and coalesce(overlay_group_by, '') = coalesce(p_overlay_group_by, '');
        end if;
      end if;
    end if;
    
    return (select get_spatial_metric(metric_id));
  end;
$$;


-- If a spatial_metric depends on a source_processing_job that already errored,
-- mark the metric as failed immediately on insert
CREATE OR REPLACE FUNCTION public.before_insert_spatial_metrics_check_dependency_error() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    dep_state public.spatial_metric_state;
  begin
    if NEW.source_processing_job_dependency is not null then
      select state into dep_state from source_processing_jobs where job_key = NEW.source_processing_job_dependency;
      if dep_state = 'error' then
        NEW.state := 'error';
        NEW.error_message := 'Related overlay did not complete processing.';
      end if;
    end if;
    return NEW;
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
              delete from data_upload_outputs where data_source_id = published_source_id and type = 'ReportingFlatgeobufV1'::data_upload_output_type;
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
              from data_upload_outputs where data_source_id = original_source_id and type = 'ReportingFlatgeobufV1'::data_upload_output_type returning id into published_data_upload_output_id;
              if published_data_upload_output_id is null then
                raise exception 'published_data_upload_output_id is null. Are you attempting to publish a report that references layers that have not completed preprocessing?';
              end if;
              -- copy the source processing job?
              insert into report_card_layers (report_card_id, table_of_contents_item_id, group_by)
              values (
                new_report_card_id,
                published_toc_item_id,
                rcl.group_by
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
    if not exists (select 1 from data_upload_outputs where data_source_id = ds_id and type = 'ReportingFlatgeobufV1'::data_upload_output_type) then
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


drop function if exists public.job_key_for_output_url;

drop index if exists idx_data_upload_outputs_url;

delete from report_card_layers;
delete from report_cards where type = 'OverlappingAreas';
delete from source_processing_jobs;
delete from data_upload_outputs where type = 'ReportingFlatgeobufV1'::data_upload_output_type;

delete from data_upload_outputs where source_processing_job_key is null and type = 'ReportingFlatgeobufV1'::data_upload_output_type;

alter table data_upload_outputs drop constraint if exists data_upload_outputs_reporting_fgb_job_key_required;

-- DO $$
-- BEGIN
--   -- Enforce that ReportingFlatgeobufV1 outputs must have a source_processing_job_key (idempotent)
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_constraint WHERE conname = 'data_upload_outputs_reporting_fgb_job_key_required'
--   ) THEN
--     ALTER TABLE public.data_upload_outputs
--       ADD CONSTRAINT data_upload_outputs_reporting_fgb_job_key_required
--       CHECK (
--         type != 'ReportingFlatgeobufV1'::data_upload_output_type
--         OR source_processing_job_key IS NOT NULL
--       ) NOT VALID;
--   END IF;
-- END $$;


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
        perform retry_failed_source_processing_job(source_job_key);
      end loop;
    end if;
    return true;
  end;
$$;

delete from spatial_metrics;

CREATE OR REPLACE FUNCTION public.retry_failed_source_processing_job(jobkey text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    updated_job_key text;
  begin
    update data_upload_outputs set source_processing_job_key = null where source_processing_job_key = jobkey;
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
