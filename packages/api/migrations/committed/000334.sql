--! Previous: sha1:4ea962dffa449fff61823af90b43bbd2540b49ca
--! Hash: sha1:b29221121218a7daf08c79f2e2580f66236bfdfc

-- Enter migration here
alter table data_sources drop column if exists raster_representative_colors;
CREATE OR REPLACE FUNCTION get_representative_colors(geostats jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE
           WHEN geostats ? 'representativeColorsForRGB' 
                AND jsonb_typeof(geostats->'representativeColorsForRGB') = 'array' THEN
               geostats->'representativeColorsForRGB'
           ELSE null
       END
$$;

grant execute on function get_representative_colors(jsonb) to anon;

alter table data_sources add column if not exists raster_representative_colors jsonb generated always as (get_representative_colors(geostats)) stored;


CREATE OR REPLACE FUNCTION get_first_band_offset(geostats jsonb)
RETURNS real
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE
           WHEN geostats->'bands' IS NOT NULL
                AND jsonb_typeof(geostats->'bands') = 'array'
                AND jsonb_array_length(geostats->'bands') > 0
                AND (geostats->'bands'->0)->>'offset' IS NOT NULL THEN
               ((geostats->'bands'->0)->>'offset')::real
           ELSE NULL
       END
$$;

grant execute on function get_first_band_offset(jsonb) to anon;


CREATE OR REPLACE FUNCTION get_first_band_scale(geostats jsonb)
RETURNS real
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE
           WHEN geostats->'bands' IS NOT NULL
                AND jsonb_typeof(geostats->'bands') = 'array'
                AND jsonb_array_length(geostats->'bands') > 0
                AND (geostats->'bands'->0)->>'scale' IS NOT NULL THEN
               ((geostats->'bands'->0)->>'scale')::real
           ELSE NULL
       END
$$;

grant execute on function get_first_band_scale(jsonb) to anon;

alter table data_sources add column if not exists raster_offset real generated always as (get_first_band_offset(geostats)) stored;

alter table data_sources add column if not exists raster_scale real generated always as (get_first_band_scale(geostats)) stored;
