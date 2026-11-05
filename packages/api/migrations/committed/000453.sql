--! Previous: sha1:fec99f029baa5b60c5f7804f17cca2630ded296c
--! Hash: sha1:2896bb9d681c0ed7d7632729eea9c86e8fd7afad

-- A data source can have more than one FlatGeobuf output (the original upload
-- and the processed file, sometimes with the same URL). These helpers are used
-- as scalar expressions. Without a single-row limit, Postgres raises
-- "more than one row returned by a subquery used as an expression" and the
-- sketches sidebar query fails.
-- Prefer the processed file (is_original = false), then the newest row.

create or replace function public.clipping_layer_source(clipping_layer_id integer)
returns table(url text, fgb_url text)
language sql stable security definer
as $$
  select
    data_sources.url as url,
    (
      select duo.url
      from data_upload_outputs duo
      where duo.type = 'FlatGeobuf'
        and duo.data_source_id = data_layers.data_source_id
      order by duo.is_original asc, duo.id desc
      limit 1
    ) as fgb_url
  from geography_clipping_layers
  inner join data_layers on geography_clipping_layers.data_layer_id = data_layers.id
  inner join data_sources on data_layers.data_source_id = data_sources.id
  where geography_clipping_layers.id = clipping_layer_id;
$$;

create or replace function public.clipping_layers_for_geography(gid integer)
returns table(
  id integer,
  cql2_query jsonb,
  template_id text,
  fgb_url text,
  url text,
  operation_type public.geography_layer_operation
)
language sql stable security definer
as $$
  select
    gcl.id,
    gcl.cql2_query,
    gcl.template_id,
    (
      select duo.url
      from data_upload_outputs duo
      where duo.type = 'FlatGeobuf'
        and duo.data_source_id = data_layers.data_source_id
      order by duo.is_original asc, duo.id desc
      limit 1
    ) as fgb_url,
    data_sources.url as url,
    gcl.operation_type
  from geography_clipping_layers gcl
  inner join data_layers on gcl.data_layer_id = data_layers.id
  inner join data_sources on data_layers.data_source_id = data_sources.id
  where gcl.project_geography_id = gid;
$$;

create or replace function public.clipping_layers_for_sketch_class(pid integer, scid integer)
returns table(
  id integer,
  geography_id integer,
  fgb_url text,
  operation_type public.geography_layer_operation,
  cql2_query jsonb,
  template_id text,
  for_clipping boolean
)
language sql security definer
as $$
  select
    gcl.id,
    gcl.project_geography_id as geography_id,
    (
      select duo.url
      from data_upload_outputs duo
      where duo.type = 'FlatGeobuf'
        and duo.data_source_id = data_layers.data_source_id
      order by duo.is_original asc, duo.id desc
      limit 1
    ) as fgb_url,
    gcl.operation_type,
    gcl.cql2_query,
    gcl.template_id,
    exists(
      select 1
      from sketch_class_geographies scg
      where scg.geography_id = gcl.project_geography_id
        and scg.sketch_class_id = clipping_layers_for_sketch_class.scid
    ) as for_clipping
  from geography_clipping_layers gcl
  join data_layers on gcl.data_layer_id = data_layers.id
  join project_geography pg on gcl.project_geography_id = pg.id
  where pg.project_id = clipping_layers_for_sketch_class.pid;
$$;

create or replace function public.geography_clipping_layers_fgb_url(g public.geography_clipping_layers)
returns text
language sql stable security definer
as $$
  select duo.url
  from data_upload_outputs duo
  where duo.type = 'FlatGeobuf'
    and duo.data_source_id = (
      select data_source_id from data_layers where id = g.data_layer_id
    )
  order by duo.is_original asc, duo.id desc
  limit 1;
$$;

create or replace function public.geography_clipping_layers_object_key(g public.geography_clipping_layers)
returns text
language sql stable security definer
as $$
  select remote
  from data_upload_outputs
  where type = 'FlatGeobuf'
    and data_source_id = (
      select data_source_id from data_layers where id = g.data_layer_id
    )
  order by is_original asc, id desc
  limit 1;
$$;

create or replace function public.data_layers_vector_object_key(g public.data_layers)
returns text
language sql stable security definer
as $$
  select
    regexp_replace(
      regexp_replace(remote, '^[^:]+://[^/]+/', ''),
      '^/',
      ''
    )
  from data_upload_outputs
  where type = 'FlatGeobuf'
    and data_source_id = (
      select data_source_id from data_layers where id = g.id
    )
  order by is_original asc, id desc
  limit 1;
$$;
