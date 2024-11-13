--! Previous: sha1:1683d85c546802a54a712150f5991ca9f6b7655a
--! Hash: sha1:9bc19cbc712fb81e17c7a84ccee62a3facdf5ea5

-- Enter migration here
alter table sketch_classes add column if not exists filter_api_version int not null default 1;
alter table sketch_classes add column if not exists filter_api_server_location text;

alter type sketch_geometry_type add value if not exists 'FILTERED_PLANNING_UNITS';
