--! Previous: sha1:c5bf77a191b9811a12793b58bf083d9a27b72019
--! Hash: sha1:4ba9cc54392b0f6c94c604f55a51a81b5de508ec

-- Enter migration here
drop function if exists survey_response_mvt;
create or replace function survey_response_mvt("formElementId" int, x int, y int, z int)
  returns bytea
  security definer
  language plpgsql
  as $$
  declare
    tile bytea;
  begin
  if session_is_admin(project_id_from_field_id("formElementId")) then
    SELECT ST_AsMVT(q, 'sketches', 4096, 'geom') into tile
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
    ) q;
    return tile;
  end if;
  raise exception 'Permission denied';
  end;
$$;

comment on function survey_response_mvt is '@omit';
grant execute on function survey_response_mvt to seasketch_user;
