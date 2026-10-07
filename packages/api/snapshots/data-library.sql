-- Hardcoded data-library seed for the golden snapshot, copied from the
-- production templates: public tile URL, cartography, attribution, and the
-- data_upload_outputs that overlay analysis, geography clipping, and
-- downloads read. Seamounts also keeps its citation and click popup. The
-- geography templates are the ones the create-project form offers.
-- World Port Index is the World Ports library item (template id WORLD_PORTS).
--
-- Output remotes are production object keys. Outside production,
-- cleanupDeletedOverlayRecords never deletes objects owned by the superuser
-- project, so a developer deleting one of these layers cannot remove the
-- production file.
--
-- Inserts run as the snapshot superuser so row-level security does not apply.

do $$
declare
  pid int;
  source_id int;
  layer_id int;
  settings_id int;
  spec record;
begin
  select id into pid from projects where slug = 'superuser';
  if pid is null then
    raise exception 'superuser project is missing';
  end if;

  for spec in
    select *
    from (
      values
        (
          'SEAMOUNTS',
          'Seamounts',
          'smntsRef1',
          'https://tiles.seasketch.org/projects/superuser/public/ff106202-7ae5-48d8-83f6-2b424fe0bccb',
          'Seamounts',
          'Yesson et al. (2011)',
          '[{"type": "circle", "paint": {"circle-color": "rgb(212, 44, 44)", "circle-radius": 3, "circle-stroke-color": "rgb(218, 75, 75)", "circle-stroke-width": 2, "circle-stroke-opacity": 0.8}, "layout": {"visibility": "visible"}, "metadata": {"s:color-auto": true}}]'::jsonb,
          'POPUP'::public.interactivity_type,
          $popup$<h2>Seamount Properties</h2>
<dl>
  <div>
    <dt>Depth</dt>
    <dd>{{DEPTH}} m</dd>
  </div>
  <div>
    <dt>Height</dt>
    <dd>{{HEIGHT}} m</dd>
  </div>
  <div>
    <dt>Location</dt>
    <dd>({{LAT}},{{LONG}})</dd>
  </div>
  <div>
    <dt>Area</dt>
    <dd>{{AREA2D}} km2</dd>
  </div>
</dl>
$popup$,
          '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"text":"Seamounts","type":"text"}]},{"type":"paragraph","content":[{"text":"Data Citation: Yesson, Chris; Clark, Malcolm R; Taylor, M; Rogers, A D (2011): Lists of seamounts and knolls in different formats. PANGAEA, ","type":"text"},{"text":"https://doi.org/10.1594/PANGAEA.757564","type":"text","marks":[{"type":"link","attrs":{"href":"https://doi.org/10.1594/PANGAEA.757564","title":""}}]},{"text":". Supplement to Yesson, C et al. (2011): The global distribution of seamounts based on 30-second bathymetry data. Deep Sea Research Part I, 58(4), 442-453, ","type":"text"},{"text":"https://doi.org/10.1016/j.dsr.2011.02.004","type":"text","marks":[{"type":"link","attrs":{"href":"https://doi.org/10.1016/j.dsr.2011.02.004","title":""}}]}]}]}'::jsonb,
          '[
            {"type": "ZippedShapefile", "url": "https://uploads.seasketch.org/projects/superuser/public/ff106202-7ae5-48d8-83f6-2b424fe0bccb.zip", "remote": "r2://ssn-tiles/projects/superuser/public/ff106202-7ae5-48d8-83f6-2b424fe0bccb.zip", "filename": "ff106202-7ae5-48d8-83f6-2b424fe0bccb.zip", "original_filename": null, "size": 1295017, "is_original": true, "is_custom_upload": false},
            {"type": "FlatGeobuf", "url": "https://uploads.seasketch.org/projects/superuser/public/ff106202-7ae5-48d8-83f6-2b424fe0bccb.fgb", "remote": "r2://ssn-tiles/projects/superuser/public/ff106202-7ae5-48d8-83f6-2b424fe0bccb.fgb", "filename": "ff106202-7ae5-48d8-83f6-2b424fe0bccb.fgb", "original_filename": null, "size": 6245736, "is_original": false, "is_custom_upload": false},
            {"type": "PMTiles", "url": "https://tiles.seasketch.org/projects/superuser/public/ff106202-7ae5-48d8-83f6-2b424fe0bccb.pmtiles", "remote": "r2://ssn-tiles/projects/superuser/public/ff106202-7ae5-48d8-83f6-2b424fe0bccb.pmtiles", "filename": "ff106202-7ae5-48d8-83f6-2b424fe0bccb.pmtiles", "original_filename": null, "size": 3463798, "is_original": false, "is_custom_upload": false}
          ]'::jsonb
        ),
        (
          'DAYLIGHT_COASTLINE',
          'OpenStreetMap Coastline',
          'coastRef1',
          'https://tiles.seasketch.org/projects/superuser/public/9d779244-96a8-4010-8b7d-a89ef9bb78ac',
          'land',
          '<a href="https://daylightmap.org/coastlines.html">© OpenStreetMap</a>',
          '[{"type": "fill", "paint": {"fill-color": "rgba(0, 0, 0, 0.24)", "fill-opacity": 0.75}}, {"type": "line", "paint": {"line-color": "rgb(77, 77, 77)", "line-width": 1, "line-opacity": 1}, "layout": {"line-cap": "round", "line-join": "round", "visibility": "visible"}, "metadata": {"s:color-auto": false}}]'::jsonb,
          'NONE'::public.interactivity_type,
          null::text,
          '{"type":"doc","content":[{"type":"paragraph","content":[{"text":"OpenStreetMap coastline from the Daylight Map Distribution.","type":"text"}]}]}'::jsonb,
          '[
            {"type": "FlatGeobuf", "url": "https://uploads.seasketch.org/projects/superuser/public/9d779244-96a8-4010-8b7d-a89ef9bb78ac.fgb", "remote": "r2://ssn-tiles/projects/superuser/public/9d779244-96a8-4010-8b7d-a89ef9bb78ac.fgb", "filename": "9d779244-96a8-4010-8b7d-a89ef9bb78ac.fgb", "original_filename": "land.fgb", "size": 1350071072, "is_original": true, "is_custom_upload": false},
            {"type": "PMTiles", "url": "https://tiles.seasketch.org/projects/superuser/public/9d779244-96a8-4010-8b7d-a89ef9bb78ac.pmtiles", "remote": "r2://ssn-tiles/projects/superuser/public/9d779244-96a8-4010-8b7d-a89ef9bb78ac.pmtiles", "filename": "9d779244-96a8-4010-8b7d-a89ef9bb78ac.pmtiles", "original_filename": "land.fgb", "size": 265478256, "is_original": false, "is_custom_upload": false}
          ]'::jsonb
        ),
        (
          'MARINE_REGIONS_EEZ_LAND_JOINED',
          'Exclusive Economic Zones',
          'eezLayer1',
          'https://tiles.seasketch.org/projects/superuser/public/1c3fb604-9c42-4b9d-ab72-14de0d66c783',
          'EEZ_land_union_v3_202003',
          '<a href="https://www.marineregions.org/">marineregions.org</a>',
          '[{"type": "fill", "paint": {"fill-color": "rgb(102, 131, 255)", "fill-opacity": 0.15}}, {"type": "line", "paint": {"line-color": "rgba(255, 255, 255, 0.61)", "line-width": 1, "line-opacity": 0.3}, "layout": {"line-cap": "round", "line-join": "round", "visibility": "visible"}, "metadata": {"s:color-auto": false}}]'::jsonb,
          'NONE'::public.interactivity_type,
          null::text,
          '{"type":"doc","content":[{"type":"paragraph","content":[{"text":"Exclusive economic zones joined to land, from Marine Regions.","type":"text"}]}]}'::jsonb,
          '[
            {"type": "ZippedShapefile", "url": "https://uploads.seasketch.org/projects/superuser/public/1c3fb604-9c42-4b9d-ab72-14de0d66c783.zip", "remote": "r2://ssn-tiles/projects/superuser/public/1c3fb604-9c42-4b9d-ab72-14de0d66c783.zip", "filename": "1c3fb604-9c42-4b9d-ab72-14de0d66c783.zip", "original_filename": "EEZ_land_union_v3_202003.zip", "size": 19932478, "is_original": true, "is_custom_upload": false},
            {"type": "FlatGeobuf", "url": "https://uploads.seasketch.org/projects/superuser/public/1c3fb604-9c42-4b9d-ab72-14de0d66c783.fgb", "remote": "r2://ssn-tiles/projects/superuser/public/1c3fb604-9c42-4b9d-ab72-14de0d66c783.fgb", "filename": "1c3fb604-9c42-4b9d-ab72-14de0d66c783.fgb", "original_filename": "EEZ_land_union_v3_202003.zip", "size": 26024000, "is_original": false, "is_custom_upload": false},
            {"type": "PMTiles", "url": "https://tiles.seasketch.org/projects/superuser/public/1c3fb604-9c42-4b9d-ab72-14de0d66c783.pmtiles", "remote": "r2://ssn-tiles/projects/superuser/public/1c3fb604-9c42-4b9d-ab72-14de0d66c783.pmtiles", "filename": "1c3fb604-9c42-4b9d-ab72-14de0d66c783.pmtiles", "original_filename": "EEZ_land_union_v3_202003.zip", "size": 8562753, "is_original": false, "is_custom_upload": false}
          ]'::jsonb
        ),
        (
          'MARINE_REGIONS_TERRITORIAL_SEA',
          'Territorial Sea',
          'terrSea01',
          'https://tiles.seasketch.org/projects/superuser/public/a0028d3a-172b-41ae-be73-276e0a614d59',
          '12nm-terr-land-joined-v2',
          'MarineRegions',
          '[{"type": "fill", "paint": {"fill-color": "rgba(250, 0, 255, 0.13)", "fill-opacity": 0.5}}, {"type": "line", "paint": {"line-color": "rgba(255, 122, 211, 0.86)", "line-width": 1, "line-opacity": 1}, "layout": {"line-cap": "round", "line-join": "round", "visibility": "visible"}, "metadata": {"s:color-auto": false}}]'::jsonb,
          'ALL_PROPERTIES_POPUP'::public.interactivity_type,
          null::text,
          '{"type":"doc","content":[{"type":"paragraph","content":[{"text":"Territorial seas joined to land, from Marine Regions.","type":"text"}]}]}'::jsonb,
          '[
            {"type": "FlatGeobuf", "url": "https://uploads.seasketch.org/projects/superuser/public/a0028d3a-172b-41ae-be73-276e0a614d59.fgb", "remote": "r2://ssn-tiles/projects/superuser/public/a0028d3a-172b-41ae-be73-276e0a614d59.fgb", "filename": "a0028d3a-172b-41ae-be73-276e0a614d59.fgb", "original_filename": "12nm-terr-land-joined-v2.fgb", "size": 44065920, "is_original": true, "is_custom_upload": false},
            {"type": "PMTiles", "url": "https://tiles.seasketch.org/projects/superuser/public/a0028d3a-172b-41ae-be73-276e0a614d59.pmtiles", "remote": "r2://ssn-tiles/projects/superuser/public/a0028d3a-172b-41ae-be73-276e0a614d59.pmtiles", "filename": "a0028d3a-172b-41ae-be73-276e0a614d59.pmtiles", "original_filename": "12nm-terr-land-joined-v2.fgb", "size": 14485980, "is_original": false, "is_custom_upload": false}
          ]'::jsonb
        ),
        (
          'MARINE_REGIONS_HIGH_SEAS',
          'High Seas',
          'highSeas1',
          'https://tiles.seasketch.org/superuser/public/faba9918-aa55-4ad5-bf72-a99712c3bc74',
          'World_High_Seas_v2_20241010',
          '<a href="https://www.marineregions.org/">marineregions.org</a>',
          '[{"type": "fill", "paint": {"fill-color": "rgba(255, 244, 102, 0.23)", "fill-opacity": 0.5}}, {"type": "line", "paint": {"line-color": "rgba(255, 240, 25, 0.22)", "line-width": 1, "line-opacity": 1}, "layout": {"line-cap": "round", "line-join": "round", "visibility": "visible"}, "metadata": {"s:color-auto": false}}]'::jsonb,
          'NONE'::public.interactivity_type,
          null::text,
          '{"type":"doc","content":[{"type":"paragraph","content":[{"text":"Areas beyond national jurisdiction, from Marine Regions.","type":"text"}]}]}'::jsonb,
          '[
            {"type": "FlatGeobuf", "url": "https://uploads.seasketch.org/projects/superuser/public/5a04c2f7-a6c9-453a-a866-28bde4f44061.fgb", "remote": "r2://ssn-tiles/projects/superuser/public/5a04c2f7-a6c9-453a-a866-28bde4f44061.fgb", "filename": "5a04c2f7-a6c9-453a-a866-28bde4f44061.fgb", "original_filename": "high-seas (1).fgb", "size": 8416960, "is_original": true, "is_custom_upload": false},
            {"type": "PMTiles", "url": "https://tiles.seasketch.org/superuser/public/faba9918-aa55-4ad5-bf72-a99712c3bc74", "remote": "r2://ssn-tiles/superuser/public/faba9918-aa55-4ad5-bf72-a99712c3bc74.pmtiles", "filename": "faba9918-aa55-4ad5-bf72-a99712c3bc74", "original_filename": null, "size": 1188972, "is_original": false, "is_custom_upload": true}
          ]'::jsonb
        ),
        (
          'WORLD_PORTS',
          'World Port Index',
          '1TNhNALAq',
          'https://tiles.seasketch.org/projects/superuser/public/39e4dc3d-894c-4e88-bfb4-beaa5277b676',
          'WPI_Shapefile',
          '<a href="https://msi.nga.mil/Publications/WPI">National Geospatial-Intelligence Agency</a>',
          '[{"type": "circle", "paint": {"circle-color": ["match", ["get", "HARBORSIZE"], "L", "#e41a1c", "M", "#377eb8", "S", "#4daf4a", "V", "#984ea3", "transparent"], "circle-radius": 4, "circle-opacity": 0.95, "circle-stroke-color": ["match", ["get", "HARBORSIZE"], "L", "rgb(205, 23, 25)", "M", "rgb(47, 108, 158)", "S", "rgb(64, 147, 62)", "V", "rgb(131, 67, 141)", "transparent"], "circle-stroke-width": 1, "circle-stroke-opacity": 1}, "metadata": {"s:type": "Categorized Points", "s:palette": "schemeSet1", "s:reverse-palette": false}}, {"type": "symbol", "paint": {"text-color": "#000000", "text-halo-color": "rgba(255, 255, 255, 0.9)", "text-halo-width": 1.3}, "layout": {"text-size": 13, "text-field": ["get", "PORT_NAME"], "visibility": "visible", "text-anchor": "left", "text-offset": [0.5, 0.5], "symbol-placement": "point"}, "maxzoom": 24, "minzoom": 10}]'::jsonb,
          'ALL_PROPERTIES_POPUP'::public.interactivity_type,
          null::text,
          '{"type":"doc","content":[{"type":"paragraph","content":[{"text":"The World Port Index (Pub 150) is an on-line database of world-wide maritime port information which serves as a general reference and navigational planning tool for mariners. The WPI provides the general geographic location with over 100 key characteristics and services of thousands of ports around the globe. The principal sources of information in the WPI are the Sailing Directions and charts published by the National Geospatial-Intelligence Agency (NGA), but where information from those sources is lacking or incomplete, other authoritative sources, both domestic and foreign, are used. The WPI in no way replaces the charts and related publications which cover in detail the ports that are summarized herein. For detailed operational planning, reference should always be made to the latest charts and publications.","type":"text"}]},{"type":"paragraph"},{"type":"paragraph","content":[{"text":"https://msi.nga.mil/Publications/WPI","type":"text","marks":[{"type":"link","attrs":{"href":"https://msi.nga.mil/Publications/WPI","title":"World Port Index"}}]}]}]}'::jsonb,
          '[
            {"type": "ZippedShapefile", "url": "https://uploads.seasketch.org/projects/superuser/public/39e4dc3d-894c-4e88-bfb4-beaa5277b676.zip", "remote": "r2://ssn-tiles/projects/superuser/public/39e4dc3d-894c-4e88-bfb4-beaa5277b676.zip", "filename": "39e4dc3d-894c-4e88-bfb4-beaa5277b676.zip", "original_filename": "WPI_Shapefile.zip", "size": 1151082, "is_original": true, "is_custom_upload": false},
            {"type": "FlatGeobuf", "url": "https://uploads.seasketch.org/projects/superuser/public/39e4dc3d-894c-4e88-bfb4-beaa5277b676.fgb", "remote": "r2://ssn-tiles/projects/superuser/public/39e4dc3d-894c-4e88-bfb4-beaa5277b676.fgb", "filename": "39e4dc3d-894c-4e88-bfb4-beaa5277b676.fgb", "original_filename": "WPI_Shapefile.zip", "size": 2158992, "is_original": false, "is_custom_upload": false},
            {"type": "PMTiles", "url": "https://tiles.seasketch.org/projects/superuser/public/39e4dc3d-894c-4e88-bfb4-beaa5277b676.pmtiles", "remote": "r2://ssn-tiles/projects/superuser/public/39e4dc3d-894c-4e88-bfb4-beaa5277b676.pmtiles", "filename": "39e4dc3d-894c-4e88-bfb4-beaa5277b676.pmtiles", "original_filename": "WPI_Shapefile.zip", "size": 493305, "is_original": false, "is_custom_upload": false}
          ]'::jsonb
        )
    ) as v(
      template_id,
      title,
      stable_id,
      url,
      source_layer,
      attribution,
      styles,
      interactivity,
      popup,
      metadata,
      outputs
    )
  loop
    if exists (
      select 1
      from table_of_contents_items
      where data_library_template_id = spec.template_id
    ) then
      continue;
    end if;

    insert into interactivity_settings (type, long_template)
    values (spec.interactivity, spec.popup)
    returning id into settings_id;

    insert into data_sources (
      project_id,
      type,
      url,
      attribution,
      import_type,
      bounds
    ) values (
      pid,
      'seasketch-mvt',
      spec.url,
      spec.attribution,
      'upload',
      array[-180, -90, 180, 90]::numeric[]
    )
    returning id into source_id;

    insert into data_upload_outputs (
      data_source_id,
      project_id,
      type,
      url,
      remote,
      filename,
      original_filename,
      size,
      is_original,
      is_custom_upload
    )
    select
      source_id,
      pid,
      o.type::public.data_upload_output_type,
      o.url,
      o.remote,
      o.filename,
      o.original_filename,
      o.size,
      o.is_original,
      o.is_custom_upload
    from jsonb_to_recordset(spec.outputs) as o(
      type text,
      url text,
      remote text,
      filename text,
      original_filename text,
      size bigint,
      is_original boolean,
      is_custom_upload boolean
    );

    insert into data_layers (
      project_id,
      data_source_id,
      source_layer,
      mapbox_gl_styles,
      interactivity_settings_id
    ) values (
      pid,
      source_id,
      spec.source_layer,
      spec.styles,
      settings_id
    )
    returning id into layer_id;

    insert into table_of_contents_items (
      stable_id,
      project_id,
      title,
      is_folder,
      is_draft,
      data_layer_id,
      metadata,
      bounds
    ) values (
      spec.stable_id,
      pid,
      spec.title,
      false,
      true,
      layer_id,
      spec.metadata,
      array[-180, -90, 180, 90]::numeric[]
    );

    perform assign_data_library_template_id(spec.stable_id, spec.template_id);
  end loop;
end
$$;
