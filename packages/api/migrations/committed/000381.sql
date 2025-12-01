--! Previous: sha1:121dca3205af573a2af6eb41606efe0ac77db537
--! Hash: sha1:37a4fa6a9f38ae6654817c54a4c716d100708706

-- Enter migration here

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
