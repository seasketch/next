--! Previous: sha1:98850f8016e351e9d23343a9f4074475669751d3
--! Hash: sha1:5bf77d2e5979e5ac832d94e3e2527d3d4d220ca8

-- Enter migration here
create or replace function survey_response_mvt("formElementId" int, x int, y int, z int)
  returns bytea
  security definer
  language plpgsql
  as $$
  declare
    tile bytea;
  begin
  if session_is_admin(project_id_from_field_id("formElementId")) then
    SELECT ST_AsMVT(q, 'sketches', 4096, 'geom', 'id') into tile
    FROM (
      SELECT
          sketches.id as id,
          sketches.name as name,
          sketches.response_id as response_id,
          survey_responses.is_practice as practice,
          survey_responses.archived as archived,
          ST_AsMVTGeom(
              sketches.mercator_geometry,
              TileBBox(z, x, y, 3857),
              4096,
              256,
              true
          ) geom
      FROM sketches
      inner join
        survey_responses
      on
        survey_responses.id = sketches.response_id
      where sketches.form_element_id = $1
    ) q;
    return tile;
  end if;
  raise exception 'Permission denied';
  end;
$$;
