--! Previous: sha1:17a7e1d602f92153189ea3e4751f193a0ab5b0ff
--! Hash: sha1:fbf3e2fcfe4be13288cdb92e065686f506dd185f

-- Enter migration here

-- Geography admin layer picker: return only draft polygon overlays that can
-- actually be used (Polygon/MultiPolygon + FlatGeobuf). Avoids loading every
-- TOC item and its geostats just to populate the dropdown.
create or replace function projects_polygon_overlays_for_geography(p public.projects)
returns setof public.table_of_contents_items
language sql
stable
as $$
  select toc.*
  from table_of_contents_items toc
  inner join data_layers dl on dl.id = toc.data_layer_id
  inner join data_sources ds on ds.id = dl.data_source_id
  where toc.project_id = p.id
    and toc.is_draft is true
    and lower(ds.vector_geometry_type) in ('polygon', 'multipolygon')
    and exists (
      select 1
      from data_upload_outputs o
      where o.data_source_id = ds.id
        and o.type = 'FlatGeobuf'
    )
  order by ds.created_at desc nulls last, toc.id desc;
$$;

grant execute on function projects_polygon_overlays_for_geography(public.projects) to anon;

comment on function projects_polygon_overlays_for_geography(public.projects) is '
@simpleCollections only
Draft polygon overlays that can be used as a Geography base or clipping layer.
Limited to layers with Polygon/MultiPolygon geometry and a FlatGeobuf output.
';
