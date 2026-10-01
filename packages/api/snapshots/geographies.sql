-- Applied after snapshots/data-library.sql. These are the same steps
-- createProjectWithGeographies takes for one EEZ with offshore and nearshore
-- zones turned on: clone the public templates into the project, filter them
-- to Samoa, nest the drafts under "Geography layers", publish that list, and
-- store the EEZ bounds as the project region.
--
-- Samoa's Marine Regions id is MRGID_EEZ 8445. The region envelope is the
-- overlay bbox for that EEZ feature. Snapshot creation does not call the
-- overlay service, so the envelope is recorded here.

set role seasketch_superuser;
select set_config(
  'session.user_id',
  (select id::text from users where sub = 'seasketch|root'),
  false
);

do $$
declare
  pid int;
  spec record;
  toc public.table_of_contents_items;
  eez_layer int;
  land_layer int;
  sea_layer int;
  geo_id int;
  samoa_filter jsonb := '["==", ["get", "MRGID_EEZ"], 8445]'::jsonb;
  samoa_cql jsonb := '{"op": "=", "args": [{"property": "MRGID_EEZ"}, 8445]}'::jsonb;
begin
  select id into pid from projects where slug = 'demo-samoa';
  if pid is null then
    raise exception 'demo-samoa is missing';
  end if;

  for spec in
    select *
    from (
      values
        ('MARINE_REGIONS_EEZ_LAND_JOINED', 'Exclusive Economic Zone', samoa_filter),
        ('DAYLIGHT_COASTLINE', 'Land', null::jsonb),
        ('MARINE_REGIONS_TERRITORIAL_SEA', 'Territorial Seas', samoa_filter)
    ) as v(template_id, title, style_filter)
  loop
    if exists (
      select 1
      from table_of_contents_items t
      where t.project_id = pid
        and t.is_draft
        and t.copied_from_data_library_template_id = spec.template_id
    ) then
      continue;
    end if;

    toc := copy_data_library_template_item(spec.template_id, 'demo-samoa');

    update data_layers
    set mapbox_gl_styles = (
      select jsonb_agg(
        case
          when spec.style_filter is null then
            elem || jsonb_build_object(
              'metadata',
              coalesce(elem->'metadata', '{}'::jsonb) || '{"label":" "}'::jsonb
            )
          else
            elem || jsonb_build_object(
              'filter', spec.style_filter,
              'metadata',
              coalesce(elem->'metadata', '{}'::jsonb) || '{"label":" "}'::jsonb
            )
        end
        order by ord
      )
      from jsonb_array_elements(mapbox_gl_styles) with ordinality as styles(elem, ord)
    )
    where id = toc.data_layer_id;

    update table_of_contents_items
    set title = spec.title
    where id = toc.id;
  end loop;

  select t.data_layer_id into eez_layer
  from table_of_contents_items t
  where t.project_id = pid
    and t.is_draft
    and t.copied_from_data_library_template_id = 'MARINE_REGIONS_EEZ_LAND_JOINED';

  select t.data_layer_id into land_layer
  from table_of_contents_items t
  where t.project_id = pid
    and t.is_draft
    and t.copied_from_data_library_template_id = 'DAYLIGHT_COASTLINE';

  select t.data_layer_id into sea_layer
  from table_of_contents_items t
  where t.project_id = pid
    and t.is_draft
    and t.copied_from_data_library_template_id = 'MARINE_REGIONS_TERRITORIAL_SEA';

  if eez_layer is null or land_layer is null or sea_layer is null then
    raise exception 'demo-samoa is missing a cloned geography layer';
  end if;

  -- Core EEZ first. Its bounds become the project region because it clips
  -- the EEZ and does not also clip the territorial sea.
  if not exists (
    select 1 from project_geography g
    where g.project_id = pid and g.name = 'Exclusive Economic Zone'
  ) then
    insert into project_geography (project_id, name, client_template)
    values (pid, 'Exclusive Economic Zone', 'eez')
    returning id into geo_id;

    insert into geography_clipping_layers (
      project_geography_id, data_layer_id, operation_type, cql2_query, template_id
    ) values
      (geo_id, eez_layer, 'intersect', samoa_cql, 'MARINE_REGIONS_EEZ_LAND_JOINED'),
      (geo_id, land_layer, 'difference', null, 'DAYLIGHT_COASTLINE');
  end if;

  if not exists (
    select 1 from project_geography g
    where g.project_id = pid and g.name = 'Territorial Seas'
  ) then
    insert into project_geography (project_id, name, client_template)
    values (pid, 'Territorial Seas', 'territorial_sea')
    returning id into geo_id;

    insert into geography_clipping_layers (
      project_geography_id, data_layer_id, operation_type, cql2_query, template_id
    ) values
      (geo_id, sea_layer, 'intersect', samoa_cql, 'MARINE_REGIONS_TERRITORIAL_SEA'),
      (geo_id, land_layer, 'difference', null, 'DAYLIGHT_COASTLINE');
  end if;

  if not exists (
    select 1 from project_geography g
    where g.project_id = pid and g.name = 'Offshore'
  ) then
    insert into project_geography (project_id, name, client_template)
    values (pid, 'Offshore', 'eez')
    returning id into geo_id;

    insert into geography_clipping_layers (
      project_geography_id, data_layer_id, operation_type, cql2_query, template_id
    ) values
      (geo_id, eez_layer, 'intersect', samoa_cql, 'MARINE_REGIONS_EEZ_LAND_JOINED'),
      (geo_id, sea_layer, 'difference', samoa_cql, 'MARINE_REGIONS_TERRITORIAL_SEA');
  end if;

  perform nest_new_project_geography_draft_toc_under_folder(pid);
  perform publish_table_of_contents(pid);

  -- Overlay bbox for MRGID_EEZ 8445 on the EEZ template, October 2026.
  perform set_project_region_bounds(
    pid,
    -174.51139447157757,
    -15.878383591829206,
    -170.54265693017294,
    -10.960825304544073
  );
end
$$;

reset role;
