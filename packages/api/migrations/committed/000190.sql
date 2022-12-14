--! Previous: sha1:5d2269c5bc547bcf2bc04a806a7250b4bf45014a
--! Hash: sha1:ce3bc28dd2d213d5cb86da35ac7b3d30d81f3bb0

-- Enter migration here
CREATE OR REPLACE FUNCTION public.create_sketch_class_from_template("projectId" integer, template_sketch_class_id integer) RETURNS public.sketch_classes
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare 
      base sketch_classes;
      created sketch_classes;
      num_similarly_named int;
      new_name text;
    begin
      if session_is_admin("projectId") then
        select * into base from sketch_classes where id = template_sketch_class_id;
        if base is null then
          raise exception 'Sketch Class with id=% does not exist', template_sketch_class_id;
        end if;
        if base.is_template = false then
          raise exception 'Sketch Class with id=% is not a template', template_sketch_class_id;
        end if;
        -- TODO: add suffix to name if there are duplicates
        select count(*) into num_similarly_named from sketch_classes where project_id = "projectId" and form_element_id is null and name ~ (base.name || '( \(\d+\))?');
        new_name = base.name;
        if num_similarly_named > 0 then
          new_name = new_name || ' (' || num_similarly_named::text || ')';
        end if;
        insert into sketch_classes (project_id, name, geometry_type, allow_multi, geoprocessing_project_url, geoprocessing_client_name, geoprocessing_client_url, mapbox_gl_style, preprocessing_endpoint, preprocessing_project_url) values ("projectId", new_name, base.geometry_type, base.allow_multi, base.geoprocessing_project_url, base.geoprocessing_client_name, base.geoprocessing_client_url, base.mapbox_gl_style, base.preprocessing_endpoint, base.preprocessing_project_url) returning * into created;
        perform initialize_sketch_class_form_from_template(created.id, (select id from forms where sketch_class_id = base.id));
        return created;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;
