-- Hardcoded data-library seed for the golden snapshot.
-- Seamounts is one static template, copied from the production reference
-- (public tile URL, cartography, citation, and click popup). The three
-- geography templates are the ones create-project and demo-samoa clone.
-- These rows point at public URLs and do not insert data_upload_outputs, so
-- the snapshot does not store production object keys.
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
          '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"text":"Seamounts","type":"text"}]},{"type":"paragraph","content":[{"text":"Data Citation: Yesson, Chris; Clark, Malcolm R; Taylor, M; Rogers, A D (2011): Lists of seamounts and knolls in different formats. PANGAEA, ","type":"text"},{"text":"https://doi.org/10.1594/PANGAEA.757564","type":"text","marks":[{"type":"link","attrs":{"href":"https://doi.org/10.1594/PANGAEA.757564","title":""}}]},{"text":". Supplement to Yesson, C et al. (2011): The global distribution of seamounts based on 30-second bathymetry data. Deep Sea Research Part I, 58(4), 442-453, ","type":"text"},{"text":"https://doi.org/10.1016/j.dsr.2011.02.004","type":"text","marks":[{"type":"link","attrs":{"href":"https://doi.org/10.1016/j.dsr.2011.02.004","title":""}}]}]}]}'::jsonb
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
          '{"type":"doc","content":[{"type":"paragraph","content":[{"text":"OpenStreetMap coastline from the Daylight Map Distribution.","type":"text"}]}]}'::jsonb
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
          '{"type":"doc","content":[{"type":"paragraph","content":[{"text":"Exclusive economic zones joined to land, from Marine Regions.","type":"text"}]}]}'::jsonb
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
          '{"type":"doc","content":[{"type":"paragraph","content":[{"text":"Territorial seas joined to land, from Marine Regions.","type":"text"}]}]}'::jsonb
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
      metadata
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
