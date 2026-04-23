-- Report card bodies use reportBodySchema: doc content is "reportTitle block*", and the
-- card title lives in the reportTitle node (plain text via text* content).
-- Mirrors extract_report_title_from_prosemirror_body in committed migrations; uses
-- collect_text_from_prosemirror_body(body, max_length) so titles are not capped at 32
-- characters like the single-argument collector used for export slugs.

CREATE OR REPLACE FUNCTION public.extract_report_title_from_prosemirror_body(body jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  node jsonb;
  title_node jsonb;
  output text := '';
BEGIN
  IF body IS NULL OR jsonb_typeof(body) = 'null' THEN
    RETURN NULL;
  END IF;

  IF body->>'type' = 'doc' AND body ? 'content' THEN
    FOR node IN SELECT * FROM jsonb_array_elements(body->'content')
    LOOP
      IF node->>'type' = 'reportTitle' THEN
        title_node := node;
        EXIT;
      END IF;
    END LOOP;
  ELSIF body->>'type' = 'reportTitle' THEN
    title_node := body;
  END IF;

  IF title_node IS NOT NULL THEN
    -- Large limit: full title text (single-arg collect_text stops at 32 chars).
    output := collect_text_from_prosemirror_body(title_node, 10000);
  END IF;

  RETURN NULLIF(TRIM(output), '');
END;
$$;

create or replace function report_cards_title(card report_cards)
returns text
language sql
stable
security definer
as $$
select extract_report_title_from_prosemirror_body(card.body);
$$;

grant execute on function report_cards_title to anon;

alter table report_cards drop column if exists copied_from_card_id;

alter table report_cards drop column if exists display_map_layer_visibility_controls;
alter table report_cards drop column if exists tint;
alter table report_cards drop column if exists icon;
alter table report_cards drop column if exists type;

-- Card kind moved from report_cards.type into component_settings JSON (key "type").
-- Optional card_position: insert at that slot; shift existing rows only if the slot is already taken.
drop function if exists public.add_report_card(integer, jsonb, text, jsonb, integer);

create or replace function public.add_report_card(
  report_tab_id integer,
  component_settings jsonb,
  card_type text,
  body jsonb,
  card_position integer default null,
  alternate_language_settings jsonb default null
) returns public.report_cards
    language plpgsql security definer
    as $$
    declare
      new_card report_cards;
      tab_report_id int;
      is_published_target boolean;
      merged_settings jsonb;
      insert_position int;
    begin
      if session_is_admin((select project_id from reports where id = (select report_id from report_tabs where id = add_report_card.report_tab_id))) then
        select report_id from report_tabs where id = add_report_card.report_tab_id into tab_report_id;
        is_published_target := exists (
          select 1
          from sketch_classes sc
          join reports r on r.sketch_class_id = sc.id
          where r.id = tab_report_id
            and sc.report_id = tab_report_id
        );

        if is_published_target then
          raise exception 'You cannot add a card to a published report';
        end if;

        merged_settings := coalesce(add_report_card.component_settings, '{}'::jsonb)
          || case
               when add_report_card.card_type is not null then jsonb_build_object('type', add_report_card.card_type)
               else '{}'::jsonb
             end;

        if add_report_card.card_position is null then
          insert_position := coalesce((select max(position) from report_cards where report_cards.report_tab_id = add_report_card.report_tab_id), 0) + 1;
        else
          insert_position := add_report_card.card_position;
          if exists (
            select 1 from report_cards rc
            where rc.report_tab_id = add_report_card.report_tab_id
              and rc.position = insert_position
          ) then
            update report_cards rc
            set position = rc.position + 1
            where rc.report_tab_id = add_report_card.report_tab_id
              and rc.position >= insert_position;
          end if;
        end if;

        insert into report_cards (
          report_tab_id,
          position,
          component_settings,
          body,
          alternate_language_settings
        ) values (
          add_report_card.report_tab_id,
          insert_position,
          merged_settings,
          add_report_card.body,
          coalesce(add_report_card.alternate_language_settings, '{}'::jsonb)
        ) returning * into new_card;

        return new_card;
      else
        raise exception 'You are not authorized to add a card to this report';
      end if;
    end;
  $$;

grant execute on function public.add_report_card(integer, jsonb, text, jsonb, integer, jsonb) to seasketch_user;

CREATE OR REPLACE FUNCTION public.update_report_card(card_id integer, component_settings jsonb, body jsonb, alternate_language_settings jsonb, tint text, icon text, card_type text, display_map_layer_visibility_controls boolean) RETURNS public.report_cards
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      updated_card report_cards;
      tab_id int;
    begin
      select report_tab_id from report_cards where id = card_id into tab_id;
      if session_is_admin((select project_id from reports where id = (select report_id from report_tabs where id = tab_id))) then
        update report_cards set
          component_settings =
            coalesce(update_report_card.component_settings, report_cards.component_settings)
            || case
                 when update_report_card.card_type is not null then jsonb_build_object('type', update_report_card.card_type)
                 else '{}'::jsonb
               end,
          body = coalesce(update_report_card.body, report_cards.body),
          alternate_language_settings = coalesce(update_report_card.alternate_language_settings, report_cards.alternate_language_settings)
        where id = update_report_card.card_id returning * into updated_card;
        return updated_card;
      else
        raise exception 'You are not authorized to update this card';
      end if;
    end;
  $$;

CREATE OR REPLACE FUNCTION public.create_draft_report(sketch_class_id integer) RETURNS public.reports
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      dr_report_id int;
      dr_report_tab_id int;
      pid int;
      report reports;
    begin
      select project_id into pid from sketch_classes where sketch_classes.id = sketch_class_id limit 1;
      if session_is_admin(pid) then
        if ((select draft_report_id from sketch_classes where id = sketch_class_id)) is not null then
          raise exception 'A draft report already exists for this sketch class';
        end if;
        insert into reports (
          project_id,
          sketch_class_id
        ) values (
          pid,
          create_draft_report.sketch_class_id
        ) returning * into report;
        insert into report_tabs (
          report_id,
          title,
          position
        ) values (
          report.id,
          'Attributes',
          0
        ) returning id into dr_report_tab_id;
        insert into report_cards (
          report_tab_id,
          body,
          position,
          alternate_language_settings,
          component_settings
        ) values (
          dr_report_tab_id,
          '{"type": "doc", "content": [{"type": "reportTitle", "content": [{"type": "text", "text": "Attributes"}]}]}'::jsonb,
          0,
          '{}',
          jsonb_build_object('type', 'Attributes')
        );
        update sketch_classes set draft_report_id = report.id where sketch_classes.id = create_draft_report.sketch_class_id;
        return report;
      else
        raise exception 'You are not authorized to create a draft report for this sketch class';
      end if;
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
            was_repaired,
            contains_overlapping_features
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
            was_repaired,
            contains_overlapping_features
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
            insert into report_cards (report_tab_id, body, position, alternate_language_settings, component_settings, updated_at, is_draft)
            values (
              new_tab_id_copy,
              source_card.body, 
              source_card.position, 
              source_card.alternate_language_settings, 
              source_card.component_settings, 
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

drop function if exists update_report_card(card_id integer, component_settings jsonb, body jsonb, alternate_language_settings jsonb, tint text, icon text, card_type text, display_map_layer_visibility_controls boolean);
CREATE OR REPLACE FUNCTION public.update_report_card(card_id integer, component_settings jsonb, body jsonb, alternate_language_settings jsonb) RETURNS public.report_cards
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      updated_card report_cards;
      tab_id int;
    begin
      select report_tab_id from report_cards where id = card_id into tab_id;
      if session_is_admin((select project_id from reports where id = (select report_id from report_tabs where id = tab_id))) then
        update report_cards set component_settings = update_report_card.component_settings, body = update_report_card.body, alternate_language_settings = update_report_card.alternate_language_settings where id = update_report_card.card_id returning * into updated_card;
        return updated_card;
      else
        raise exception 'You are not authorized to update this card';
      end if;
    end;
  $$;

  grant execute on function update_report_card to seasketch_user;

-- Make get_or_create_spatial_metric concurrency-safe. The previous
-- SELECT-then-INSERT implementation could race between concurrent transactions
-- (e.g. the parallel refetches of ReportDependencies and
-- DraftReportDependencies that fire right after recalculate_spatial_metrics
-- deletes rows), producing a duplicate key violation on
-- spatial_metrics_unique_metric. Use INSERT ... ON CONFLICT DO NOTHING and
-- fall back to a SELECT to read the row inserted by the winning transaction.
CREATE OR REPLACE FUNCTION public.get_or_create_spatial_metric(
    p_subject_fragment_id text,
    p_subject_geography_id integer,
    p_type public.spatial_metric_type,
    p_overlay_source_url text,
    p_parameters jsonb,
    p_source_processing_job_dependency text,
    p_project_id integer,
    p_dependency_hash text
  ) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    metric_id bigint;
  begin
    -- Validation
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

    -- Atomic upsert: if another transaction inserted the same row first, this
    -- no-ops and returns no id via RETURNING. We then fall back to a SELECT
    -- to fetch the winner's row.
    insert into spatial_metrics (
      subject_fragment_id,
      subject_geography_id,
      type,
      overlay_source_url,
      source_processing_job_dependency,
      project_id,
      parameters,
      dependency_hash
    ) values (
      p_subject_fragment_id,
      p_subject_geography_id,
      p_type,
      p_overlay_source_url,
      p_source_processing_job_dependency,
      p_project_id,
      p_parameters,
      p_dependency_hash
    )
    on conflict (
      coalesce(overlay_source_url, ''),
      coalesce(source_processing_job_dependency, ''),
      coalesce(subject_fragment_id, ''),
      coalesce(subject_geography_id, -999999),
      type,
      parameters,
      dependency_hash
    ) do nothing
    returning id into metric_id;

    if metric_id is null then
      select id into metric_id
      from spatial_metrics
      where coalesce(overlay_source_url, '') = coalesce(p_overlay_source_url, '')
        and coalesce(source_processing_job_dependency, '') = coalesce(p_source_processing_job_dependency, '')
        and coalesce(subject_fragment_id, '') = coalesce(p_subject_fragment_id, '')
        and coalesce(subject_geography_id, -999999) = coalesce(p_subject_geography_id, -999999)
        and type = p_type
        and parameters = p_parameters
        and dependency_hash = p_dependency_hash;
    end if;

    return get_spatial_metric(metric_id);
  end;
$$;

comment on function get_or_create_spatial_metric is '@omit';

grant execute on function get_or_create_spatial_metric to anon;
