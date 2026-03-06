--! Previous: sha1:68a8ac0f1a2030a5c3c2d013ea3a295c053b6e3e
--! Hash: sha1:6266efde7585d7dbd9d807cd958ee2840b6ef603

-- Add contains_overlapping_features column to data_upload_outputs (idempotent)
alter table data_upload_outputs add column if not exists contains_overlapping_features boolean;

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
