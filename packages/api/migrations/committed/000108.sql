--! Previous: sha1:63cf405e9783f8ab23cd111a2c6462eb3ca8dff2
--! Hash: sha1:0116bf55da836c8e9ceaa653169fa082ef183391

-- Enter migration here
alter type form_element_layout add value if not exists 'MAP_TOP';
