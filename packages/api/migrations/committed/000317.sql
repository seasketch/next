--! Previous: sha1:5aeaa1d0852a80c50ec3a257279c2e64623ad0a7
--! Hash: sha1:d0bf8535ff626e18c3341bda495d1df1361969c5

-- Enter migration here
drop function if exists summary_stats;


-- CREATE OR REPLACE FUNCTION summary_stats(
--   time_interval summary_stats_interval,
--   start_date date
-- )
-- RETURNS SETOF summary_daily_stats 
-- security definer
-- language plpgsql
-- AS
-- $$
-- DECLARE
--   endDate date := current_date; -- Assuming we want to aggregate up to the current date
-- BEGIN
--   if true or session_is_superuser() then
--     RETURN QUERY
--     WITH date_series AS (
--       SELECT generate_series(start_date, endDate, '1 day'::interval)::date AS date
--     ),
--     aggregated_data AS (
--       SELECT
--         MIN(id) as id, -- Since we're aggregating, we need to decide how to handle the id. Using MIN() as an example.
--         array_agg(DISTINCT slugs) as slugs, -- Aggregating arrays might require more specific handling based on your needs
--         date_series.date,
--         SUM(visitors)::int as visitors,
--         SUM(map_tile_requests)::int as map_tile_requests,
--         array_agg(DISTINCT countries) as countries,
--         MAX(registered_users) as registered_users,
--         MAX(spatial_uploads_storage) as spatial_uploads_storage,
--         SUM(forum_posts_created)::int as forum_posts_created,
--         MAX(total_forum_posts) as total_forum_posts,
--         SUM(sketches_created)::int as sketches_created,
--         MAX(total_sketches) as total_sketches,
--         SUM(data_layers_created)::int as data_layers_created,
--         MAX(total_data_layers) as total_data_layers,
--         SUM(uploaded_layers)::int as uploaded_layers,
--         MAX(total_uploaded_layers) as total_uploaded_layers
--       FROM summary_daily_stats
--       RIGHT JOIN date_series ON summary_daily_stats.date = date_series.date
--       GROUP BY date_series.date
--     )
--     SELECT * FROM aggregated_data
--     WHERE
--       CASE
--         WHEN time_interval = 'day' THEN TRUE
--         WHEN time_interval = 'week' AND EXTRACT(DOW FROM date) = 1 THEN TRUE -- Assuming week starts on Monday
--         WHEN time_interval = 'month' AND EXTRACT(DAY FROM date) = 1 THEN TRUE
--         ELSE FALSE
--       END
--     ORDER BY date;
--   else 
--     raise exception 'Permission denied';
--   end if;
-- END;
-- $$;


CREATE OR REPLACE FUNCTION public.before_insert_or_update_data_layers_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  declare
    source_type text;
    max_z int;
  begin
    select type into source_type from data_sources where id = new.data_source_id;
    if source_type is null then
      raise 'Unknown source type. %', (new.data_source_id);
    end if;
    if new.sublayer is not null and source_type != 'arcgis-dynamic-mapserver' then
      raise 'sublayer property can only be specified for layers associated with a arcgis-dynamic-mapserver source';
    end if;
    if source_type = 'vector' then
      if new.source_layer is null then
        raise 'Layers with "vector" data sources must specify a source_layer';
      end if;
    elsif source_type != 'seasketch-mvt' and source_type != 'seasketch-raster' then
      if new.source_layer is not null then
        raise 'Only Layers with data_sources of type "vector", "seasketch-mvt", or "seasketch-raster" should specify a source_layer';
      end if;
    end if;
    if (source_type = 'vector' or source_type = 'geojson' or source_type = 'seasketch-vector' or source_type = 'seasketch-mvt') then
      if new.mapbox_gl_styles is null then
        raise 'Vector layers must specify mapbox_gl_styles';
      end if;
    else
      if new.mapbox_gl_styles is not null and source_type != 'seasketch-raster' and source_type != 'raster' then
        raise 'Layers with data_sources of type % should not specify mapbox_gl_styles', (source_type);
      end if;
    end if;
    if old is null and NEW.z_index = 0 then
      -- assign a z-index
      select max(z_index) + 1 into max_z from data_layers where project_id = new.project_id;
      if max_z is null then
        max_z = 0;
      end if;
      new.z_index = max_z;
    end if;
    return new;
  end;
$$;


drop table if exists daily_activity_stats;
drop table if exists global_activity_stats;
drop table if exists activity_stats;
drop table if exists project_activity_stats;
drop type if exists activity_interval;
create table activity_stats (
  id int GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  project_id int references projects(id),
  start TIMESTAMPTZ NOT NULL,
  interval interval not null,
  registered_users int not null,
  uploads_storage_used bigint not null,
  total_forum_posts int not null,
  total_sketches int not null,
  total_data_sources int not null,
  total_uploaded_layers int not null,
  new_users int not null,
  new_sketches int not null,
  new_data_sources int not null,
  new_forum_posts int not null,
  new_uploaded_bytes bigint not null
);

grant select on activity_stats to seasketch_user;
alter table activity_stats enable row level security;
create policy select_activity_stats_policy on activity_stats for select using (session_is_superuser() or (project_id is not null and session_is_admin(project_id)));

create index on activity_stats (project_id, start);