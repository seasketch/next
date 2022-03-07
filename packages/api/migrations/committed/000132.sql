--! Previous: sha1:48f5cb7684cbb38134c9524928aa3ff4c3860f67
--! Hash: sha1:33781cfdea6e48560c2cefb8efcf763d9003f33e

-- Enter migration here
alter table form_elements add column if not exists map_camera_options jsonb;

comment on column form_elements.map_camera_options is '
If using a map-based layout, can be used to set the default starting point of the map

See https://docs.mapbox.com/mapbox-gl-js/api/properties/#cameraoptions
```json
{
  "center": [-73.5804, 45.53483],
  "pitch": 60,
  "bearing": -60,
  "zoom": 10
}
```
';

alter table form_elements add column if not exists map_basemaps int[];

comment on column form_elements.map_basemaps is 'IDs for basemaps that should be included in the map view if a map layout is selected';
