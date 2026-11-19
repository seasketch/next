--! Previous: sha1:124f40b84abc1c39c3abd5a1f262c7b02642ec76
--! Hash: sha1:df1ae237b2a463b22689240cdfbdcedf2578188d
--! Message: Default new Collection sketch classes to authored reports

-- Enter migration here

-- New sketch classes do not copy is_geography_clipping_enabled from the
-- template row (including the superuser project's Collection template).
-- That flag is the authored-reports switch: false means "Enable Geoprocessing
-- Services". Polygons turn it on only when the project has a report and a
-- clipping geography. Collections also use authored reports, but they do not
-- clip, so they get the flag without a sketch_class_geographies row.
-- Points, lines, and other types stay on legacy geoprocessing.
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
    select id into default_report_id
      from reports
      where project_id = "projectId" and version = 0
      order by
        case
          when title ilike '%default' then 1
          else 0
        end;
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

    enable_geography_clipping = case
      when base.geometry_type = 'POLYGON' then
        default_report_id is not null
        and default_clipping_geography_id is not null
      when base.geometry_type = 'COLLECTION' then
        default_report_id is not null
      else
        false
    end;

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
      is_geography_clipping_enabled,
      preview_new_reports
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
      enable_geography_clipping,
      false
    ) returning * into created;

    perform initialize_sketch_class_form_from_template(
      created.id,
      (select id from forms where sketch_class_id = base.id)
    );
    if default_report_id is not null then
      perform set_primary_report_for_sketch_class(created.id, default_report_id);
    end if;
    -- A geography row plus is_geography_clipping_enabled makes
    -- sketch_classes_use_geography_clipping true. Collections do not clip.
    if default_clipping_geography_id is not null
      and base.geometry_type is distinct from 'COLLECTION' then
      insert into sketch_class_geographies (sketch_class_id, geography_id)
      values (created.id, default_clipping_geography_id);
    end if;
    return created;
  else
    raise exception 'Permission denied';
  end if;
end;
$$;
