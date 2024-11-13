-- Enter migration here
alter table sketch_classes add column if not exists filter_api_version int not null default 1;
alter table sketch_classes add column if not exists filter_api_server_location text;

alter type sketch_geometry_type add value if not exists 'FILTERED_PLANNING_UNITS';

