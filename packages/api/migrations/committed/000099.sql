--! Previous: sha1:18575f50269f64c9f93bfb47260bd4e616428eec
--! Hash: sha1:cdc7d76f6715e8d551c3f1d9e48c52474df93e45

-- Enter migration here
delete from form_element_types where component_name = 'FeatureName';
insert into form_element_types (component_name, label, is_input, is_hidden, is_single_use_only, is_required_for_sketch_classes) values ('FeatureName', 'Feature Name', true, true, true, true);


-- create sketch class template
delete from forms where template_name = 'Basic Template' and template_type = 'SKETCHES';
delete from forms where template_name = 'SingleSpatialInputTemplate' and template_type = 'SKETCHES';

delete from sketch_classes where project_id = (select id from projects where slug = 'superuser') and name = 'SingleSpatialInputTemplate';
delete from sketch_classes where project_id = (select id from projects where slug = 'superuser') and name = 'BasicTemplate';
insert into sketch_classes (project_id, name, geometry_type) values ((select id from projects where slug = 'superuser'), 'SingleSpatialInputTemplate', 'POINT');
insert into sketch_classes (project_id, name) values ((select id from projects where slug = 'superuser'), 'BasicTemplate');

insert into form_element_types (component_name, label, is_input, sketch_class_template_id, is_spatial, allowed_layouts) values ('SingleSpatialInput', 'Spatial Input', true, (select id from sketch_classes where name = 'SingleSpatialInputTemplate' and project_id = (select id from projects where slug = 'superuser')), true, '{"MAP_STACKED"}'::form_element_layout[]);


-- initialize form for SingleSpatialInputTemplate and set is_template, template_name
insert into forms (sketch_class_id, is_template, template_name, template_type) values ((select id from sketch_classes where name = 'SingleSpatialInputTemplate' and project_id = (select id from projects where slug = 'superuser')), true, 'SingleSpatialInputTemplate', 'SKETCHES');
insert into forms (sketch_class_id, is_template, template_name, template_type) values ((select id from sketch_classes where name = 'Basic Template' and project_id = (select id from projects where slug = 'superuser')), true, 'Basic Template', 'SKETCHES');

insert into form_elements (form_id, is_required, export_id, component_settings, type_id, body) values ((select id from forms where template_name = 'Basic Template' and template_type = 'SKETCHES'), true, 'feature_name', '{"generatedNamePrefix": "Location"}'::jsonb, 'FeatureName', '{"type": "doc", "content": [{"type": "question", "attrs": {}, "content": [{"text": "Give this feature a name", "type": "text"}]}]}'::jsonb);

-- create function to create sketch classes from a template - make sure to copy all aspects, not just form


-- run unit tests again

-- write unit tests to verify creation of sketch classes from a template


-- TODO: Trigger - create sketch class from form_element_types.default_sketch_class_template if form_element is_spatial


-- TODO: allow access to sketch classes based on form_element_id (and add tests). can_digitize, sketch_class listing function?



delete from form_element_types where component_name = 'MultiSpatialInput';
delete from sketch_classes where project_id = (select id from projects where slug = 'superuser') and name = 'MultiSpatialInputTemplate';

insert into sketch_classes (project_id, name, geometry_type) values ((select id from projects where slug = 'superuser'), 'MultiSpatialInputTemplate', 'POLYGON');

insert into forms (sketch_class_id, is_template, template_name, template_type) values ((select id from sketch_classes where name = 'MultiSpatialInputTemplate' and project_id = (select id from projects where slug = 'superuser')), true, 'MultiSpatialInputTemplate', 'SKETCHES');

insert into form_elements (form_id, is_required, export_id, component_settings, type_id, body) values ((select id from forms where template_name = 'MultiSpatialInputTemplate'), true, 'feature_name', '{"generatedNamePrefix": "Location"}'::jsonb, 'FeatureName', '{"type": "doc", "content": [{"type": "question", "attrs": {}, "content": [{"text": "Location Name", "type": "text"}]}]}'::jsonb);

insert into form_element_types (component_name, label, is_input, sketch_class_template_id, is_spatial, allowed_layouts) values ('MultiSpatialInput', 'Multiple Location Input', true, (select id from sketch_classes where name = 'MultiSpatialInputTemplate' and project_id = (select id from projects where slug = 'superuser')), true, '{"MAP_SIDEBAR_LEFT", "MAP_SIDEBAR_RIGHT"}');


delete from form_element_types where component_name = 'SpatialAccessPriorityInput';
delete from sketch_classes where project_id = (select id from projects where slug = 'superuser') and name = 'SpatialAccessPriorityInputTemplate';

insert into sketch_classes (project_id, name, geometry_type) values ((select id from projects where slug = 'superuser'), 'SpatialAccessPriorityInputTemplate', 'POLYGON');

insert into forms (sketch_class_id, is_template, template_name, template_type) values ((select id from sketch_classes where name = 'SpatialAccessPriorityInputTemplate' and project_id = (select id from projects where slug = 'superuser')), true, 'SpatialAccessPriorityInputTemplate', 'SKETCHES');

insert into form_elements (form_id, is_required, export_id, component_settings, type_id, body) values ((select id from forms where template_name = 'SpatialAccessPriorityInputTemplate'), true, 'feature_name', '{"generatedNamePrefix": "Area"}'::jsonb, 'FeatureName', '{"type": "doc", "content": [{"type": "question", "attrs": {}, "content": [{"text": "Area Name", "type": "text"}]}]}'::jsonb);

insert into form_element_types (component_name, label, is_input, sketch_class_template_id, is_spatial, allowed_layouts) values ('SpatialAccessPriorityInput', 'Spatial Access Priority', true, (select id from sketch_classes where name = 'SpatialAccessPriorityInputTemplate' and project_id = (select id from projects where slug = 'superuser')), true, '{"MAP_SIDEBAR_LEFT", "MAP_SIDEBAR_RIGHT"}');


CREATE OR REPLACE FUNCTION public.clear_form_element_style(form_element_id integer) RETURNS public.form_elements
    LANGUAGE sql
    AS $$
    update form_elements set background_image = null, background_color = null, layout = null, background_palette = null, secondary_color = null, text_variant = 'DYNAMIC', unsplash_author_url = null, unsplash_author_name = null, background_width = null, background_height = null where form_elements.id = form_element_id returning *;
  $$;

CREATE OR REPLACE FUNCTION public.initialize_survey_form_from_template(survey_id integer, template_id integer) RETURNS public.forms
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      form forms;
    begin
      if session_is_admin((select project_id from surveys where id = survey_id)) = false then
        raise exception 'Must be project admin';
      end if;
      insert into forms (survey_id) values (survey_id) returning * into form;
      insert into 
        form_elements (
          form_id, 
          body, 
          type_id, 
          is_required, 
          export_id, 
          position, 
          component_settings,
          background_color,   
          background_image,     
          background_palette,   
          secondary_color,      
          unsplash_author_name, 
          unsplash_author_url,  
          background_width,     
          background_height,    
          text_variant,
          layout
        )
      select 
        form.id, 
        body, 
        type_id, 
        is_required, 
        export_id, 
        position, 
        component_settings,
        background_color,     
        background_image,     
        background_palette,   
        secondary_color,      
        unsplash_author_name, 
        unsplash_author_url,  
        background_width,     
        background_height,    
        text_variant,
        layout
      from
        form_elements
      where
        form_elements.form_id = template_id
      order by position asc;
      
      return form;
    end
  $$;
