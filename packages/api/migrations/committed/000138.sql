--! Previous: sha1:2eb7a66616b330a040e83062683185834e71b316
--! Hash: sha1:c5bf77a191b9811a12793b58bf083d9a27b72019

-- Enter migration here
alter table sketches add column if not exists mercator_geometry geometry(Geometry,3857) GENERATED ALWAYS AS (ST_Transform(coalesce(geom, user_geom), 3857)) STORED;
CREATE INDEX if not exists sketches_mercator_geometry_idx
  ON sketches
  USING GIST (mercator_geometry);

create or replace function survey_response_mvt(form_element_id int, x int, y int, z int)
  returns bytea
  security definer
  language sql
  as $$
  SELECT ST_AsMVT(q, 'sketches', 4096, 'geom')
  FROM (
    SELECT
        id,
        name,
        response_id,
        ST_AsMVTGeom(
            mercator_geometry,
            TileBBox(z, x, y, 3857),
            4096,
            256,
            true
        ) geom
    FROM sketches c
    where form_element_id = $1
    and session_is_admin(project_id_from_field_id(form_element_id))
  ) q
  $$;

comment on function survey_response_mvt is '@omit';
grant execute on function survey_response_mvt to seasketch_user;
