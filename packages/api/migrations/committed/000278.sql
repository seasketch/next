--! Previous: sha1:acd2eb02f23d791fc4ea756a1a10237ad922559b
--! Hash: sha1:c03348f526a26b2f96d8c2a454f6a03514cfd57d

insert into data_source_types (
  type,
  description
) values ('arcgis-raster-tiles', 'Tiled ArcGIS Map Service') on conflict do nothing;

alter table data_sources drop column if exists arcgis_fetch_strategy;

drop type if exists arcgis_feature_layer_fetch_strategy;
create type arcgis_feature_layer_fetch_strategy as enum (
  'auto',
  'raw',
  'tiled'
);

alter table data_sources add column if not exists arcgis_fetch_strategy arcgis_feature_layer_fetch_strategy not null default 'tiled';


alter table basemaps add column if not exists is_arcgis_tiled_mapservice boolean not null default false;


create or replace function projects_imported_arcgis_services(p projects)
  returns text[]
  language plpgsql
  security definer
  stable
  as $$
    declare
      services text[];
    begin
      if session_is_admin(p.id) then
        select 
          coalesce(url, original_source_url) as url 
        into
          services
        from
        (
          select
            basemaps.url, data_sources.original_source_url
          from basemaps, data_sources
          where 
          (
            basemaps.project_id = p.id and
            basemaps.is_arcgis_tiled_mapservice = true
          ) or
          (
            data_sources.project_id = p.id and
            (
              data_sources.type = 'arcgis-raster-tiles' or 
              data_sources.type = 'arcgis-vector' or 
              data_sources.type = 'arcgis-dynamic-mapserver'
            )
          )
        ) q;
        return services;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

grant execute on function projects_imported_arcgis_services to anon;
