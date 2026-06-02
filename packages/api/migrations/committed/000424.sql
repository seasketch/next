--! Previous: sha1:bdd123a7a2d8ab05e0e058a5815968f6ed402bef
--! Hash: sha1:58eb158425b21877c5983afd0c8103548d6c7e0f

-- Enter migration here

create or replace function public.create_sketch_class_from_template(
  "projectId" integer,
  template_sketch_class_id integer
) returns public.sketch_classes
language plpgsql
security definer
as $$
declare
  base sketch_classes;
  created sketch_classes;
  num_similarly_named int;
  new_name text;
  default_report_id integer;
  default_clipping_geography_id integer;
  enable_geography_clipping boolean;
begin
  if session_is_admin("projectId") then
    select id into default_report_id from reports where project_id = "projectId";
    if default_report_id is null then
      select id into default_report_id from create_default_report("projectId"::integer);
    end if;
    select id into default_clipping_geography_id
    from project_geography
    where project_id = "projectId"
    order by (
      case
        when name like 'EEZ%' then 0
        when name like 'Exclusive Economic Zone%' then 0
        when client_template = 'eez' then 1
        else 2
      end
    )
    limit 1;

    select * into base from sketch_classes where id = template_sketch_class_id;
    if base is null then
      raise exception 'Sketch Class with id=% does not exist', template_sketch_class_id;
    end if;
    if base.is_template = false then
      raise exception 'Sketch Class with id=% is not a template', template_sketch_class_id;
    end if;

    -- Never enable clipping by default for non-polygon classes.
    enable_geography_clipping = base.geometry_type = 'POLYGON'
      and default_report_id is not null
      and default_clipping_geography_id is not null;

    -- TODO: add suffix to name if there are duplicates
    select count(*) into num_similarly_named
    from sketch_classes
    where project_id = "projectId"
      and form_element_id is null
      and name ~ (base.name || '( \(\d+\))?');
    new_name = base.name;
    if num_similarly_named > 0 then
      new_name = new_name || ' (' || num_similarly_named::text || ')';
    end if;

    insert into sketch_classes (
      project_id,
      name,
      geometry_type,
      allow_multi,
      geoprocessing_project_url,
      geoprocessing_client_name,
      geoprocessing_client_url,
      mapbox_gl_style,
      preprocessing_endpoint,
      preprocessing_project_url,
      is_geography_clipping_enabled
    ) values (
      "projectId",
      new_name,
      base.geometry_type,
      base.allow_multi,
      base.geoprocessing_project_url,
      base.geoprocessing_client_name,
      base.geoprocessing_client_url,
      base.mapbox_gl_style,
      base.preprocessing_endpoint,
      base.preprocessing_project_url,
      enable_geography_clipping
    ) returning * into created;

    perform initialize_sketch_class_form_from_template(
      created.id,
      (select id from forms where sketch_class_id = base.id)
    );
    if default_report_id is not null then
      perform set_primary_report_for_sketch_class(created.id, default_report_id);
    end if;
    if default_clipping_geography_id is not null then
      insert into sketch_class_geographies (sketch_class_id, geography_id)
      values (created.id, default_clipping_geography_id);
    end if;
    return created;
  else
    raise exception 'Permission denied';
  end if;
end;
$$;
