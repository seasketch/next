--! Previous: sha1:2c7147ffaa54361c0911bd614b46b43a6be106ee
--! Hash: sha1:bd8902de3b220ac9581d5b10d4c116386ba4970b

-- Enter migration here
grant execute on function st_makeenvelope to anon;
grant execute on function box2d(box3d) to anon;
grant execute on function box2d(geometry) to anon;
grant execute on function st_asmvt(anyelement) to anon;
grant execute on function st_asmvt(anyelement, text) to anon;
grant execute on function st_asmvt(anyelement, text, integer) to anon;
grant execute on function st_asmvt(anyelement, text, integer, text) to anon;
grant execute on function st_asmvt(anyelement, text, integer, text, text) to anon;
grant execute on function st_asmvtgeom to anon;

-- thanks to https://github.com/chargetrip/clusterbuster/blob/a47d2469e208a730b8e06dd4d189cce3a1b9059a/sql/TileBBox.sql
create or replace function TileBBox (z int, x int, y int, srid int = 3857)
    returns geometry
    language plpgsql immutable as
$func$
declare
    max numeric := 20037508.34;
    res numeric := (max*2)/(2^z);
    bbox geometry;
begin
    bbox := ST_MakeEnvelope(
        -max + (x * res),
        max - (y * res),
        -max + (x * res) + res,
        max - (y * res) - res,
        3857
    );
    if srid = 3857 then
        return bbox;
    else
        return ST_Transform(bbox, srid);
    end if;
end;
$func$;

grant execute on function tilebbox to anon;
grant execute on function ST_Transform(geometry, integer) to anon;
grant execute on function ST_Transform(geom geometry, from_proj text, to_proj text) to anon;
grant execute on function ST_Transform(geom geometry, from_proj text, to_srid integer) to anon;
grant execute on function ST_Transform(geom geometry, to_proj text) to anon;

create index if not exists sketches_form_element_id on sketches (form_element_id);
