-- Enter migration here

CREATE OR REPLACE FUNCTION public.publish_report_snapshot(p_draft_report_id integer) RETURNS public.sketch_classes
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  published_sketch_class public.sketch_classes;
  new_report public.reports;
  draft_report_id int;
  project_id int;
  draft_report_version int;
  draft_lineage_parent_id int;
  draft_sketch_class_id int;
  new_report_id int;
  old_tab_id int;
  new_tab_id int;
  referenced_stable_ids text[];
  missing_outputs integer[];
  stable_ids_missing_outputs text[];
  sid text;
  max_lineage_version int;
begin
  draft_report_id := p_draft_report_id;

  select
    r.project_id,
    r.version,
    r.draft_id,
    r.sketch_class_id
  into
    project_id,
    draft_report_version,
    draft_lineage_parent_id,
    draft_sketch_class_id
  from public.reports r
  where r.id = draft_report_id;

  if project_id is null then
    raise exception 'Report not found';
  end if;

  if draft_report_version != 0 or draft_lineage_parent_id is not null then
    raise exception 'Only draft reports can be published';
  end if;

  select coalesce(max(version), 0)
  into max_lineage_version
  from public.reports r
  where r.id = draft_report_id or r.draft_id = draft_report_id;

  referenced_stable_ids := public.get_referenced_stable_ids_for_report(draft_report_id);
  if array_length(referenced_stable_ids, 1) > 0 then
    if (
      select count(*) from public.table_of_contents_items
      where stable_id = any(referenced_stable_ids) and is_draft = false
    ) < array_length(referenced_stable_ids, 1) then
      raise exception 'This report references data layers that have not yet been published. Please publish the layer list first.';
    end if;

    -- Each referenced layer's draft source must also be the published one.
    -- Published copies keep the draft source's url.
    if exists (
      select 1
      from public.table_of_contents_items draft_item
      join public.data_layers draft_layer on draft_layer.id = draft_item.data_layer_id
      join public.data_sources draft_source on draft_source.id = draft_layer.data_source_id
      where draft_item.stable_id = any(referenced_stable_ids)
        and draft_item.is_draft = true
        and not exists (
          select 1
          from public.table_of_contents_items published_item
          join public.data_layers published_layer on published_layer.id = published_item.data_layer_id
          join public.data_sources published_source on published_source.id = published_layer.data_source_id
          where published_item.stable_id = draft_item.stable_id
            and published_item.is_draft = false
            and published_source.url is not distinct from draft_source.url
        )
    ) then
      raise exception 'This report references updated versions of data sources which have not yet been published. Please publish the data sources first.';
    end if;

    missing_outputs := public.verify_table_of_contents_items_have_report_outputs(
      (
        select array_agg(id)
        from public.table_of_contents_items
        where stable_id = any(referenced_stable_ids) and is_draft = true
      )
    );
    if array_length(missing_outputs, 1) > 0 then
      raise exception 'This report references table of contents items that have not yet been processed for reporting. Please review your report for errors and ensure all cards render correctly before publishing.';
    end if;

    stable_ids_missing_outputs := (
      select array_agg(stable_id)
      from public.table_of_contents_items
      where stable_id = any(referenced_stable_ids)
        and is_draft = false
        and public.table_of_contents_items_reporting_output(public.table_of_contents_items.*) is null
    );

    if array_length(stable_ids_missing_outputs, 1) > 0 then
      foreach sid in array stable_ids_missing_outputs loop
        insert into public.data_upload_outputs (
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
          (
            select data_source_id
            from public.data_layers
            where id = (
              select data_layer_id
              from public.table_of_contents_items
              where stable_id = sid and is_draft = false
            )
          ),
          d.project_id,
          d.type,
          d.url,
          d.remote,
          d.is_original,
          d.size,
          d.filename,
          d.original_filename,
          d.is_custom_upload,
          d.fgb_header_size,
          d.source_processing_job_key,
          d.epsg,
          d.num_features,
          d.num_invalid_features,
          d.num_repaired_features,
          d.was_repaired,
          d.contains_overlapping_features
        from public.data_upload_outputs d
        where d.data_source_id = (
            select data_source_id
            from public.data_layers
            where id = (
              select data_layer_id
              from public.table_of_contents_items
              where stable_id = sid and is_draft = true
            )
          )
          and public.is_reporting_type(d.type)
        order by d.created_at desc
        limit 1;
      end loop;
    end if;
  end if;

  insert into public.reports (
    project_id,
    sketch_class_id,
    title,
    version,
    draft_id,
    published_at
  )
  select
    r.project_id,
    coalesce(r.sketch_class_id, draft_sketch_class_id),
    coalesce(r.title, 'Untitled Report'),
    max_lineage_version + 1,
    draft_report_id,
    now()
  from public.reports r
  where r.id = draft_report_id
  returning * into new_report;

  new_report_id := new_report.id;

  -- Copy report tabs + cards preserving positions and language settings.
  for old_tab_id in
    select rt.id
    from public.report_tabs rt
    where rt.report_id = draft_report_id
    order by rt.position
  loop
    insert into public.report_tabs (
      report_id,
      title,
      position,
      alternate_language_settings,
      updated_at
    )
    select
      new_report_id,
      rt.title,
      rt.position,
      rt.alternate_language_settings,
      rt.updated_at
    from public.report_tabs rt
    where rt.id = old_tab_id
    returning id into new_tab_id;

    insert into public.report_cards (
      report_tab_id,
      body,
      position,
      alternate_language_settings,
      component_settings,
      updated_at,
      is_draft
    )
    select
      new_tab_id,
      rc.body,
      rc.position,
      rc.alternate_language_settings,
      rc.component_settings,
      rc.updated_at,
      false
    from public.report_cards rc
    where rc.report_tab_id = old_tab_id
    order by rc.position;
  end loop;

  select * into published_sketch_class
  from public.sketch_classes
  where id = draft_sketch_class_id;
  return published_sketch_class;
end;
$$;
