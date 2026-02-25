--! Previous: sha1:c1d6745848b06d2f78d8dd595a4eb2fd0a0d8bc1
--! Hash: sha1:c368e554d7649da0b8ac59aa803bd5f8b2ed5e0f

-- Enter migration here
alter table sketch_class_geographies
  drop constraint sketch_class_geographies_sketch_class_id_fkey,
  add constraint sketch_class_geographies_sketch_class_id_fkey
    foreign key (sketch_class_id) references sketch_classes(id) on delete cascade;
