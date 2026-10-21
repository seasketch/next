/**
 * SQL for Project.reportingLayers. Takes the project id as $1 and returns one
 * row per draft table of contents item whose source has a processing job.
 */
export function reportingLayersSql(wantGeostats: boolean) {
  return `
    select
      items.id as table_of_contents_item_id,
      items.stable_id as stable_id,
      ${wantGeostats ? "s.geostats as geostats," : ""}
      s.temporal as temporal,
      l.mapbox_gl_styles as mapbox_gl_styles,
      o.id as output_id,
      o.url as source_url,
      jobs.job_key as source_processing_job_id,
      o.contains_overlapping_features as contains_overlapping_features,
      s.column_details,
      s.raster_band_count,
      s.vector_geometry_type,
      s.feature_count,
      ai.best_label_column as ai_best_label_column,
      ai.best_category_column as ai_best_category_column,
      ai.best_numeric_column as ai_best_numeric_column
    from
      data_sources s
    inner join data_layers l on l.data_source_id = s.id
    inner join table_of_contents_items items on items.data_layer_id = l.id
    inner join source_processing_jobs jobs on jobs.data_source_id = s.id
    left join ai_data_analyst_notes ai on ai.data_source_id = s.id
    left join lateral (
      select
        o.id,
        o.url,
        o.contains_overlapping_features
      from
        data_upload_outputs o
      where
        o.data_source_id = s.id
        and is_reporting_type(o.type)
      order by
        o.id desc
      limit 1
    ) o on true
    where
      s.id  in (
        -- This part of the query seems more complex than it needs to be
        -- That's because project toc items and data layers can refer to
        -- data sources that belong to the superuser project if they are
        -- based on a data library template.
        select data_source_id from source_processing_jobs where data_source_id in (
          select data_source_id from data_layers where project_id = $1
        )
      ) and l.project_id = $1
      -- Published copies of data library layers share the draft's source (and
      -- its processing job), so without this filter they show up as
      -- duplicates with the same stable_id.
      and items.is_draft = true
  `;
}
