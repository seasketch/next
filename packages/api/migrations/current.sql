-- Enter migration here
drop function if exists add_report_card;
alter table report_cards drop column if exists collapsible_footer_body;
alter table report_cards drop column if exists collapsible_footer_enabled;



CREATE OR REPLACE FUNCTION public.add_report_card(report_tab_id integer, component_settings jsonb, card_type text, body jsonb) RETURNS public.report_cards
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      new_card report_cards;
      tab_report_id int;
      is_published_target boolean;
    begin
      if session_is_admin((select project_id from reports where id = (select report_id from report_tabs where id = add_report_card.report_tab_id))) then
        -- Determine if the target tab belongs to the published or draft report
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

        insert into report_cards (
          report_tab_id,
          position,
          component_settings,
          type,
          body
        ) values (
          add_report_card.report_tab_id,
          coalesce((select max(position) from report_cards where report_cards.report_tab_id = add_report_card.report_tab_id), 0) + 1,
          add_report_card.component_settings,
          add_report_card.card_type,
          add_report_card.body
        ) returning * into new_card;

        return new_card;
      else
        raise exception 'You are not authorized to add a card to this report';
      end if;
    end;
  $$;

grant execute on function add_report_card to seasketch_user;

drop function if exists after_delete_toc_items_cascade_report_card_layers cascade;
drop function if exists before_insert_or_update_report_card_layers cascade;

CREATE OR REPLACE FUNCTION public.extract_table_of_contents_item_ids_from_body(body jsonb) RETURNS integer[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      result integer[] := ARRAY[]::integer[];
      node jsonb;
      metrics jsonb;
      metric jsonb;
      toc_id integer;
    begin
      -- Handle null or invalid input
      if body is null or jsonb_typeof(body) = 'null' then
        return result;
      end if;
      
      -- Check if this is a node with type "metric" or "blockMetric" that has attrs.metrics
      if (body->>'type') in ('metric', 'blockMetric') and body->'attrs'->'metrics' is not null then
        metrics := body->'attrs'->'metrics';
        if jsonb_typeof(metrics) = 'array' then
          -- Extract tableOfContentsItemId from each metric
          for metric in select * from jsonb_array_elements(metrics)
          loop
            if metric->>'tableOfContentsItemId' is not null then
              toc_id := (metric->>'tableOfContentsItemId')::integer;
              if toc_id is not null then
                result := array_append(result, toc_id);
              end if;
            end if;
          end loop;
        end if;
      end if;
      
      -- Recursively process content array if it exists
      if body->'content' is not null and jsonb_typeof(body->'content') = 'array' then
        for node in select * from jsonb_array_elements(body->'content')
        loop
          result := result || extract_table_of_contents_item_ids_from_body(node);
        end loop;
      end if;
      
      return result;
    end;
  $$;

grant execute on function extract_table_of_contents_item_ids_from_body to anon;

drop function if exists get_referenced_table_of_contents_items_for_report;
create or replace function get_referenced_table_of_contents_items_for_report(_report_id integer) returns integer[]
    language plpgsql immutable
    as $$
    declare
      result integer[] := ARRAY[]::integer[];
      card_ids integer[];
      tab_ids integer[];
    begin
      card_ids := array(select id from report_cards where report_tab_id in (select id from report_tabs where report_id = _report_id));
      tab_ids := array(select id from report_tabs where report_id = _report_id);
      select array(select distinct toc_id from (select unnest(extract_table_of_contents_item_ids_from_body(body)) as toc_id from report_cards where id = any(card_ids)) sub) into result;
      return result;
    end;
  $$;

grant execute on function get_referenced_table_of_contents_items_for_report to anon;

create or replace function get_published_toc_counterparts(toc_item_ids integer[]) returns jsonb
    language plpgsql immutable
    as $$
    declare
      result jsonb := '{}'::jsonb;
      draft_item record;
      source_url text;
      published_toc_item_id integer;
    begin
      -- Handle empty input
      if toc_item_ids is null or array_length(toc_item_ids, 1) is null then
        return result;
      end if;
      
      -- For each draft table_of_contents_item, find its published counterpart
      for draft_item in
        select 
          toc.id as draft_id,
          toc.project_id,
          toc.is_folder,
          dl.data_source_id,
          ds.url
        from table_of_contents_items toc
        left join data_layers dl on dl.id = toc.data_layer_id
        left join data_sources ds on ds.id = dl.data_source_id
        where toc.id = any(toc_item_ids)
          and toc.is_draft = true
      loop
        published_toc_item_id := null;
        
        -- Only try to match if it's not a folder and has a data source URL
        if draft_item.is_folder = false and draft_item.url is not null then
          source_url := draft_item.url;
          
          -- Find published counterpart by matching data source URL within the same project
          select 
            published_toc.id
          into published_toc_item_id
          from table_of_contents_items published_toc
          join data_layers published_dl on published_dl.id = published_toc.data_layer_id
          join data_sources published_ds on published_ds.id = published_dl.data_source_id
          where published_toc.is_draft = false
            and published_toc.project_id = draft_item.project_id
            and published_toc.is_folder = false
            and published_ds.url = source_url
          limit 1;
        end if;
        
        -- Add to result map: original_id -> published_id (or null)
        result := result || jsonb_build_object(draft_item.draft_id::text, published_toc_item_id);
      end loop;
      
      return result;
    end;
  $$;

create or replace function verify_table_of_contents_items_have_report_outputs(toc_item_ids integer[]) returns integer[]
  language plpgsql
  security definer
  as $$
    declare
      items_missing_outputs integer[] := ARRAY[]::integer[];
    begin
      select id from (select id, table_of_contents_items_reporting_output(table_of_contents_items.*) as output from table_of_contents_items where id = any(toc_item_ids)) as foo where foo.output is null into items_missing_outputs;
      return items_missing_outputs;
    end;
  $$;

create or replace function replace_toc_references_in_body_recursive(body jsonb, published_toc_counterparts jsonb) returns jsonb
    language plpgsql
    as $$
    declare
      metrics jsonb;
      new_metrics jsonb;
      metric jsonb;
      updated_metric jsonb;
      draft_toc_id text;
      published_toc_id integer;
      new_content jsonb;
      child jsonb;
      idx integer;
    begin
      -- Handle null input
      if body is null or jsonb_typeof(body) = 'null' then
        return body;
      end if;

      -- Check if this is a widget node (metric or blockMetric) with tableOfContentsItemId references
      if (body->>'type') in ('metric', 'blockMetric') and body->'attrs'->'metrics' is not null then
        metrics := body->'attrs'->'metrics';
        if jsonb_typeof(metrics) = 'array' then
          new_metrics := '[]'::jsonb;
          -- Process each metric dependency and replace tableOfContentsItemId
          for metric in select * from jsonb_array_elements(metrics)
          loop
            if metric->>'tableOfContentsItemId' is not null then
              draft_toc_id := metric->>'tableOfContentsItemId';
              raise notice 'Found metric with tableOfContentsItemId: %, type: %', draft_toc_id, metric->>'type';
              -- Look up the published counterpart
              if published_toc_counterparts ? draft_toc_id then
                published_toc_id := (published_toc_counterparts->>draft_toc_id)::integer;
                raise notice 'Replacing tableOfContentsItemId % with published counterpart %', draft_toc_id, published_toc_id;
                -- Replace the tableOfContentsItemId with the published one
                updated_metric := metric || jsonb_build_object('tableOfContentsItemId', published_toc_id);
              else
                -- No mapping found - this is an error condition
                raise exception 'Report references table of contents item % which has no published counterpart', draft_toc_id;
              end if;
            else
              -- No tableOfContentsItemId, keep as is
              updated_metric := metric;
            end if;
            new_metrics := new_metrics || jsonb_build_array(updated_metric);
          end loop;
          -- Update the body with the new metrics array
          body := jsonb_set(body, '{attrs,metrics}', new_metrics);
        end if;
      end if;

      -- Recursively process content array if it exists
      if body->'content' is not null and jsonb_typeof(body->'content') = 'array' then
        new_content := '[]'::jsonb;
        for child in select * from jsonb_array_elements(body->'content')
        loop
          child := replace_toc_references_in_body_recursive(child, published_toc_counterparts);
          new_content := new_content || jsonb_build_array(child);
        end loop;
        body := jsonb_set(body, '{content}', new_content);
      end if;

      return body;
    end;
  $$;

create or replace function replace_toc_references_in_body(body jsonb, published_toc_counterparts jsonb) returns jsonb
    language plpgsql
    as $$
    declare
      published_toc_counterpart_record record;
    begin
      -- first, check that published_toc_counterparts is a valid jsonb object with the correct keys and values
      if jsonb_typeof(published_toc_counterparts) != 'object' then
        raise exception 'published_toc_counterparts is not a valid jsonb object';
      end if;
      if jsonb_typeof(published_toc_counterparts) = 'object' then
        for published_toc_counterpart_record in select * from jsonb_each(published_toc_counterparts) loop
          if published_toc_counterpart_record.value is null or jsonb_typeof(published_toc_counterpart_record.value) = 'null' then
            raise exception 'This report references data layers that have not yet been published. Please publish the layer list first.';
          end if;
        end loop;
      end if;
      -- now, replace the references to draft table of contents item ids with published table of contents item ids, referencing the published_toc_counterparts map. This will require walking through all nodes in the prosemirror document.
      body := replace_toc_references_in_body_recursive(body, published_toc_counterparts);
      return body;
    end;
  $$;

create or replace function copy_report_output_to_published_table_of_contents_item(draft_toc_item_id integer, published_toc_item_id integer) returns void
    language plpgsql
    security definer
    as $$
    declare
      draft_output_url text;
      published_output_url text;
      draft_is_draft boolean;
      published_is_draft boolean;
      published_data_source_id int;
    begin
      -- Check draft item exists and is actually a draft
      select t.is_draft into draft_is_draft from table_of_contents_items t where t.id = draft_toc_item_id;
      if draft_is_draft is null then
        raise exception 'The table of contents item with id % does not exist', draft_toc_item_id;
      end if;
      if draft_is_draft != true then
        raise exception 'The table of contents item with id % is not a draft item', draft_toc_item_id;
      end if;
      
      -- Check published item exists and is actually published
      select t.is_draft into published_is_draft from table_of_contents_items t where t.id = published_toc_item_id;
      if published_is_draft is null then
        raise exception 'The table of contents item with id % does not exist', published_toc_item_id;
      end if;
      if published_is_draft != false then
        raise exception 'The table of contents item with id % is not a published item', published_toc_item_id;
      end if;
      
      -- Get the output URLs directly via SQL
      -- select duo.url into draft_output_url
      -- from data_upload_outputs duo
      -- join data_layers dl on dl.data_source_id = duo.data_source_id
      -- join table_of_contents_items toc on toc.data_layer_id = dl.id
      -- where toc.id = draft_toc_item_id and is_reporting_type(duo.type)
      -- limit 1;
      
      delete from data_upload_outputs where data_source_id = (
        select data_source_id from data_layers where id = (select data_layer_id from table_of_contents_items where id = published_toc_item_id) limit 1
      ) and is_reporting_type(type);

      
      -- select duo.url into published_output_url
      -- from data_upload_outputs duo
      -- join data_layers dl on dl.data_source_id = duo.data_source_id
      -- join table_of_contents_items toc on toc.data_layer_id = dl.id
      -- where toc.id = published_toc_item_id and is_reporting_type(duo.type)
      -- limit 1;
      
      -- -- Check if both outputs exist and are the same
      -- if draft_output_url is not null and published_output_url is not null and draft_output_url = published_output_url then
      --   raise notice 'The draft(%) and published(%) table of contents items have the same output. Skipping copy.', draft_toc_item_id, published_toc_item_id;
      --   return;
      -- end if;
      
      select data_source_id into published_data_source_id from data_layers where id = (select data_layer_id from table_of_contents_items where id = published_toc_item_id) limit 1;
      if published_data_source_id is null then
        raise exception 'The published table of contents item with id % does not have a data source', published_toc_item_id;
      end if;
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
        is_custom_upload,
        fgb_header_size,
        source_processing_job_key,
        epsg
      ) select
        published_data_source_id,
        project_id,
        type,
        created_at,
        url,
        remote,
        is_original,
        size,
        filename,
        original_filename,
        is_custom_upload,
        fgb_header_size,
        source_processing_job_key,
        epsg
      from data_upload_outputs where data_source_id = (
        select data_source_id from data_layers where id = (select data_layer_id from table_of_contents_items where id = draft_toc_item_id) limit 1
      ) and is_reporting_type(type) order by created_at desc limit 1;
      raise notice 'Copied report output from draft table of contents item % to published table of contents item %', draft_toc_item_id, published_toc_item_id;
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
      referenced_table_of_contents_item_ids integer[];
      published_toc_counterparts jsonb;
      published_toc_counterpart_id int;
      published_toc_counterpart_record record;
      published_toc_counterpart_key text;
      published_toc_counterpart_value int;
      missing_outputs integer[];
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

      referenced_table_of_contents_item_ids := get_referenced_table_of_contents_items_for_report(draft_report_id);

      if referenced_table_of_contents_item_ids is null or array_length(referenced_table_of_contents_item_ids, 1) = 0 then
        raise exception 'No table of contents item ids found in the draft report';
      end if;

      -- verify that all referenced table of contents items have a published counterpart
      published_toc_counterparts := get_published_toc_counterparts(referenced_table_of_contents_item_ids);
      if published_toc_counterparts is null or jsonb_typeof(published_toc_counterparts) = 'null' then
        raise exception 'No published table of contents item counterparts found';
      end if;
      if jsonb_typeof(published_toc_counterparts) = 'object' then
        for published_toc_counterpart_record in select * from jsonb_each(published_toc_counterparts) loop
          if published_toc_counterpart_record.value is null or jsonb_typeof(published_toc_counterpart_record.value) = 'null' then
            raise exception 'This report references data layers that have not yet been published. Please publish the layer list first.';
          end if;
        end loop;
      end if;

      -- verify all referenced table of contents items have been preprocessed
      missing_outputs := verify_table_of_contents_items_have_report_outputs(referenced_table_of_contents_item_ids);
      if array_length(missing_outputs, 1) > 0 then
        raise exception 'This report references table of contents items that have not yet been processed for reporting. Please review your report for errors and ensure all cards render correctly before publishing.';
      end if;

      -- copy references to source_processing_job and data_upload_outputs to these published table of content item counterparts
      for published_toc_counterpart_record in select * from jsonb_each(published_toc_counterparts) loop
        perform copy_report_output_to_published_table_of_contents_item(published_toc_counterpart_record.key::integer, published_toc_counterpart_record.value::integer);
      end loop;
      
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
              replace_toc_references_in_body(source_card.body, published_toc_counterparts), 
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

      -- return items
      return query select * from table_of_contents_items 
        where project_id = "projectId" and is_draft = false;
    end;
  $$;

drop function if exists report_card_layers_processed_output;

CREATE OR REPLACE FUNCTION public.table_of_contents_items_reporting_output(item public.table_of_contents_items) RETURNS public.data_upload_outputs
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select * from data_upload_outputs where data_source_id = (select data_source_id from data_layers where id = item.data_layer_id) and is_reporting_type(type) limit 1;
  $$;

grant execute on function table_of_contents_items_reporting_output to anon;

drop table if exists report_card_layers;

drop function if exists report_cards_reporting_layers;
-- CREATE OR REPLACE FUNCTION public.report_cards_reporting_layers(rc public.report_cards) RETURNS SETOF public.reporting_layer
--     LANGUAGE sql STABLE SECURITY DEFINER COST 1 ROWS 1 PARALLEL SAFE
--     AS $$
--   select
--     t.id as table_of_contents_item_id,
--     t.title,
--     t.data_source_type,
--     ds.geostats,
--     dl.mapbox_gl_styles,
--     -- rcl.layer_parameters,
--     '{}'::jsonb as layer_parameters,
--     spj.job_key as processing_job_id
--   from table_of_contents_items t
--   join data_layers dl on dl.id = t.data_layer_id
--   join data_sources ds on ds.id = dl.data_source_id
--   -- join report_card_layers rcl on rcl.table_of_contents_item_id = t.id and rcl.report_card_id = rc.id
--   left join source_processing_jobs spj on spj.data_source_id = dl.data_source_id
--   where t.id = ANY('{}'::integer[])
--     -- select table_of_contents_item_id from report_card_layers where report_card_id = rc.id
--     and t.is_draft = rc.is_draft
--   limit 1;
-- $$;

-- grant execute on function report_cards_reporting_layers to anon;
-- comment on function report_cards_reporting_layers is '@simpleCollections only';

grant execute on function update_feature_flags to seasketch_user;



drop function if exists update_report_card(card_id integer, component_settings jsonb, body jsonb, alternate_language_settings jsonb, tint text, icon text, card_type text, collapsible_footer_enabled boolean, collapsible_footer_body jsonb, display_map_layer_visibility_controls boolean);

CREATE OR REPLACE FUNCTION public.update_report_card(card_id integer, component_settings jsonb, body jsonb, alternate_language_settings jsonb, tint text, icon text, card_type text, display_map_layer_visibility_controls boolean) RETURNS public.report_cards
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      updated_card report_cards;
      tab_id int;
    begin
      select report_tab_id from report_cards where id = card_id into tab_id;
      if session_is_admin((select project_id from reports where id = (select report_id from report_tabs where id = tab_id))) then
        update report_cards set component_settings = update_report_card.component_settings, body = update_report_card.body, alternate_language_settings = update_report_card.alternate_language_settings, tint = update_report_card.tint, icon = update_report_card.icon, type = update_report_card.card_type, display_map_layer_visibility_controls = update_report_card.display_map_layer_visibility_controls where id = update_report_card.card_id returning * into updated_card;
        return updated_card;
      else
        raise exception 'You are not authorized to update this card';
      end if;
    end;
  $$;



grant execute on function update_report_card to seasketch_user;

delete from spatial_metrics;

alter table spatial_metrics add column if not exists dependency_hash text not null;

CREATE OR REPLACE FUNCTION public.spatial_metric_to_json(sm public.spatial_metrics) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select jsonb_build_object(
    'id', sm.id,
    'type', sm.type,
    'updatedAt', sm.updated_at,
    'createdAt', sm.created_at,
    'value', sm.value,
    'state', sm.state,
    'sourceUrl', sm.overlay_source_url,
    'sourceType', extension_to_source_type(sm.overlay_source_url),
    'parameters', coalesce(sm.parameters, '{}'::jsonb),
    'jobKey', sm.job_key,
    'subject', 
    case when sm.subject_geography_id is not null then
      jsonb_build_object('id', sm.subject_geography_id, '__typename', 'GeographySubject')
    else
      jsonb_build_object(
        'hash', sm.subject_fragment_id, 
        'sketches', (select array_agg(sketch_id) from sketch_fragments where fragment_hash = sm.subject_fragment_id), 
        'geographies', (select array_agg(geography_id) from fragment_geographies where fragment_hash = sm.subject_fragment_id), 
        '__typename', 'FragmentSubject'
      )
    end,
    'errorMessage', sm.error_message,
    'progress', sm.progress_percentage,
    'sourceProcessingJobDependency', sm.source_processing_job_dependency,
    'eta', sm.eta,
    'startedAt', sm.started_at,
    'durationSeconds', extract(epoch from sm.duration)::float,
    'dependencyHash', sm.dependency_hash
  );
$$;

DROP function if exists get_or_create_spatial_metric;

drop index if exists spatial_metrics_unique_metric;

CREATE UNIQUE INDEX spatial_metrics_unique_metric ON public.spatial_metrics USING btree (COALESCE(overlay_source_url, ''::text), COALESCE(source_processing_job_dependency, ''::text), COALESCE(subject_fragment_id, ''::text), COALESCE(subject_geography_id, '-999999'::integer), type, parameters, dependency_hash);


CREATE OR REPLACE FUNCTION public.get_or_create_spatial_metric(p_subject_fragment_id text, p_subject_geography_id integer, p_type public.spatial_metric_type, p_overlay_source_url text, p_parameters jsonb, p_source_processing_job_dependency text, p_project_id integer, p_dependency_hash text) RETURNS jsonb
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
        
    -- Try to get existing metric first (matching the unique index logic)
    select id into metric_id
    from spatial_metrics
    where coalesce(overlay_source_url, '') = coalesce(p_overlay_source_url, '')
      and coalesce(source_processing_job_dependency, '') = coalesce(p_source_processing_job_dependency, '')
      and coalesce(subject_fragment_id, '') = coalesce(p_subject_fragment_id, '')
      and coalesce(subject_geography_id, -999999) = coalesce(p_subject_geography_id, -999999)
      and type = p_type
      and parameters = p_parameters and dependency_hash = p_dependency_hash;
    
    -- If not found, insert new metric
    if metric_id is null then
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
      returning id into metric_id;
    end if;
    
    return get_spatial_metric(metric_id);
  end;
$$;

comment on function get_or_create_spatial_metric is '@omit';

grant execute on function get_or_create_spatial_metric to anon;

create or replace function preprocess_source(slug text, source_id integer)
    returns public.table_of_contents_items
    language plpgsql SECURITY DEFINER
AS $$
  declare
    item table_of_contents_items;
    source_processing_job_key text;
  begin
    -- Find the table of contents item for this source up front so we can always return it.
    select *
      into item
      from table_of_contents_items
     where data_layer_id = (
       select id from data_layers where data_source_id = source_id limit 1
     )
     limit 1;

    if (session_is_admin((select id from projects where projects.slug = preprocess_source.slug))) then
      if (not exists (select 1 from data_sources where id = source_id)) then
        raise exception 'Data source % not found', source_id;
      end if;
      if (not exists (select 1 from data_upload_outputs where data_source_id = source_id and is_reporting_type(type))) then
        insert into source_processing_jobs (data_source_id, project_id) values (source_id, (select project_id from data_sources where id = source_id)) on conflict do nothing returning job_key into source_processing_job_key;
        if source_processing_job_key is not null then
          PERFORM graphile_worker.add_job(
            'preprocessSource',
            json_build_object('jobKey', source_processing_job_key),
            max_attempts := 1
          );
        end if;
      end if;
      return item;
    else
      raise exception 'You are not authorized to preprocess this source';
    end if;
  end;
$$;


grant execute on function preprocess_source to seasketch_user;


create or replace function trigger_geography_metric_subscription()
  returns trigger
  language plpgsql
  security definer
  stable
  as $$
  declare
    pid integer;
    skid integer;
  begin
      if NEW.subject_geography_id is not null then
        select project_id into pid from project_geography where id = NEW.subject_geography_id limit 1;
        perform pg_notify(
          'graphql:projects:' || pid || ':geography-metrics',
          '{"metricId": ' || NEW.id || ', "geographyId": ' || NEW.subject_geography_id || ', "projectId": ' || pid || '}'
        );
      end if;
      if NEW.subject_fragment_id is not null then
        select sketch_id into skid from sketch_fragments where fragment_hash = NEW.subject_fragment_id limit 1;
        perform pg_notify(
          'graphql:sketches:' || skid || ':metrics',
          '{"metricId": ' || NEW.id || ', "sketchId": ' || skid || '}'
        );
      end if;
    return NEW;
  end;
  $$;

CREATE OR REPLACE FUNCTION public.trigger_report_overlay_source_subscription() RETURNS trigger
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
  BEGIN
    -- Notify GraphQL subscription for source processing job updates
    PERFORM pg_notify(
      'graphql:projects:' || NEW.project_id || ':reportOverlaySources',
      '{"jobKey": "' || NEW.job_key || '", "projectId": ' || NEW.project_id || ', "dataSourceId": ' || NEW.data_source_id || '}'
    );
    RETURN NEW;
  END;
  $$;


CREATE OR REPLACE FUNCTION public.update_report_card_body(card_id integer, body jsonb) RETURNS public.report_cards
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      updated_card report_cards;
    begin
      if session_is_admin((select project_id from reports where id = (select report_id from report_tabs where id = (select report_tab_id from report_cards where id = card_id)))) then
        update report_cards set body = update_report_card_body.body where id = update_report_card_body.card_id returning * into updated_card;
        return updated_card;
      else
        raise exception 'You are not authorized to update this card';
      end if;
    end;
  $$;



grant execute on function update_report_card_body to seasketch_user;

create or replace function report_cards_tab(card report_cards)
  returns report_tabs
  language sql
  stable
  security definer
  as $$
    select * from report_tabs where id = (card.report_tab_id);
  $$;

grant execute on function report_cards_tab to anon;

create or replace function enqueue_metric_calculations_for_sketch(sketch_id int)
  returns void
  language plpgsql
  security definer
  as $$
  begin
    perform graphile_worker.add_job(
      'startMetricCalculationsForSketch',
      json_build_object('sketchId', sketch_id),
      max_attempts := 1
    );
  end;
$$;

grant execute on function enqueue_metric_calculations_for_sketch to anon;

comment on function enqueue_metric_calculations_for_sketch is '@omit';

grant select on source_processing_jobs to anon;
comment on table source_processing_jobs is '';

create policy source_processing_jobs_public_select on source_processing_jobs for select using (true);

CREATE OR REPLACE FUNCTION public.spatial_metric_to_json(sm public.spatial_metrics) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select jsonb_build_object(
    'id', sm.id,
    'type', sm.type,
    'updatedAt', sm.updated_at,
    'createdAt', sm.created_at,
    'value', sm.value,
    'state', sm.state,
    'sourceUrl', sm.overlay_source_url,
    'sourceType', extension_to_source_type(sm.overlay_source_url),
    'parameters', coalesce(sm.parameters, '{}'::jsonb),
    'jobKey', sm.job_key,
    'subject', 
    case when sm.subject_geography_id is not null then
      jsonb_build_object('id', sm.subject_geography_id, '__typename', 'GeographySubject')
    else
      jsonb_build_object(
        'hash', sm.subject_fragment_id, 
        'sketches', (select array_agg(sketch_id) from sketch_fragments where fragment_hash = sm.subject_fragment_id), 
        'geographies', (select array_agg(geography_id) from fragment_geographies where fragment_hash = sm.subject_fragment_id), 
        '__typename', 'FragmentSubject'
      )
    end,
    'errorMessage', sm.error_message,
    'progress', sm.progress_percentage,
    'sourceProcessingJobDependency', sm.source_processing_job_dependency,
    'eta', sm.eta,
    'startedAt', sm.started_at,
    'durationSeconds', extract(epoch from sm.duration)::float,
    'dependencyHash', sm.dependency_hash
  );
$$;
