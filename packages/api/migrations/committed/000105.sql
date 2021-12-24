--! Previous: sha1:4c2a8f271a7c9dc5e4a0dee6d1cbfed1824aaa9e
--! Hash: sha1:1484858d84a24cef0e0d2ec6061fcfb24d8f759b

-- Enter migration here
ALTER TYPE form_element_layout ADD VALUE if not exists 'MAP_FULLSCREEN';

delete from form_element_types where component_name = 'SAPRange';

insert into form_element_types (component_name, label, is_input, is_hidden, is_single_use_only) values ('SAPRange', 'Spatial Access Priority Range Input', true, true, true);

insert into form_elements (
  form_id, 
  is_required, 
  export_id, 
  component_settings, 
  type_id, 
  body
) values (
  (select id from forms where template_name = 'SpatialAccessPriorityInputTemplate'), 
  true, 
  'priority', 
  '{"lowText": "Low", "averageText": "Average", "highText": "High"}'::jsonb, 
  'SAPRange', 
  '{"type": "doc", "content": [{"type": "question", "attrs": {}, "content": [{"text": "How important is this area?", "type": "text"}]}]}'::jsonb
);
