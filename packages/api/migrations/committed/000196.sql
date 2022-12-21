--! Previous: sha1:11d2b3bee1ca632120c91e69eec19564a1a4c9bb
--! Hash: sha1:9303dd949ddda589082594d22075ec9cc7609ede

-- Enter migration here
drop function if exists get_children_of_collection;
drop function if exists get_children_of_folder;
drop function if exists get_children_recursive;
drop function if exists get_child_sketches_recursive;
DROP TYPE IF EXISTS sketch_child_type;
DROP TYPE IF EXISTS sketch_child_identifier;
CREATE TYPE sketch_child_type AS ENUM ('sketch', 'sketch_folder');

create or replace function is_collection(sketch_class_id int)
  returns boolean
  language sql
  stable
  as $$
    select geometry_type = 'COLLECTION' from sketch_classes where id = sketch_class_id;
  $$;


create or replace function get_children_of_collection("collectionId" int)
  returns table (id int, type sketch_child_type, name text, is_leaf boolean)
  language plpgsql
  as $$
  begin
    return query select
      sketches.id as id,
      'sketch'::sketch_child_type as type,
      sketches.name,
      is_collection(sketches.sketch_class_id) = false as is_leaf
    from sketches
    where
      collection_id = "collectionId"
    union ALL
    select
      sketch_folders.id as id,
      'sketch_folder'::sketch_child_type as type,
      sketch_folders.name,
      false as is_leaf
    from sketch_folders
    where
      collection_id = "collectionId";
  end;
  $$;

create or replace function get_children_of_folder("folderId" int)
  returns table (id int, type sketch_child_type, name text, is_leaf boolean)
  language plpgsql
  as $$
  begin
    return query select
      sketches.id as id,
      'sketch'::sketch_child_type as type,
      sketches.name,
      is_collection(sketches.sketch_class_id) = false as is_leaf
    from sketches
    where
      folder_id = "folderId"
    union ALL
    select
      sketch_folders.id,
      'sketch_folder'::sketch_child_type as type,
      sketch_folders.name,
      false as is_leaf
    from sketch_folders
    where
      folder_id = "folderId";
  end;
  $$;



create or replace function get_child_sketches_recursive(parent_id int, child_type sketch_child_type)
  returns int[]
  language plpgsql
  as $$
  declare
    ids int[] = '{}';
    child_ids int[];
    child record;
  begin
    if child_type = 'sketch' then
      FOR child IN SELECT * FROM get_children_of_collection(parent_id)
      LOOP
      if child.type = 'sketch' and child.is_leaf then
        ids := ids || child.id;
      end if;
      if child.is_leaf = false then
        select get_child_sketches_recursive(child.id, child.type) into child_ids;
        ids := ids || child_ids;
      end if;
      END LOOP;
    else
      FOR child IN SELECT * FROM get_children_of_folder(parent_id)
      LOOP
      if child.type = 'sketch' and child.is_leaf then
        ids := ids || child.id;
      end if;
      if child.is_leaf = false then
        select get_child_sketches_recursive(child.id, child.type) into child_ids;
        ids := ids || child_ids;
      end if;
      END LOOP;
    end if;
    return ids;
  end;
  $$;

CREATE OR REPLACE FUNCTION public.sketch_as_geojson(id integer) RETURNS jsonb
    LANGUAGE sql
    AS $$
    SELECT json_build_object(
      'type', 'Feature',
      'id',         sketches.id,
      'geometry',   ST_AsGeoJSON(coalesce(geom, user_geom))::jsonb,
      'bbox', sketches.bbox,
      'properties', sketches_geojson_properties(sketches.*)
    ) 
    FROM sketches
    where sketches.id = sketch_as_geojson.id;
$$;

CREATE OR REPLACE FUNCTION public.collection_as_geojson(id integer) returns jsonb
  language sql
  as $$
    select jsonb_build_object(
      'type', 'FeatureCollection',
      'id', sketches.id,
      'properties', sketches_geojson_properties(sketches.*),
      'features', (select jsonb_agg(sketch_as_geojson(sketches.id)) from sketches where id = any(
        (select unnest(get_child_sketches_recursive(collection_as_geojson.id, 'sketch')))
      ))
    ) from sketches
    where sketches.id = collection_as_geojson.id;
  $$;

create or replace function sketch_or_collection_as_geojson(id integer) returns jsonb
  language plpgsql
  as $$
    declare
      output jsonb;
    begin
      if (select is_collection(sketches.sketch_class_id) from sketches where sketches.id = sketch_or_collection_as_geojson.id) then
        select collection_as_geojson(sketch_or_collection_as_geojson.id) into output;
      else
        select sketch_as_geojson(sketch_or_collection_as_geojson.id) into output;
      end if;
      return output;
    end
  $$;

grant execute on function is_collection to anon;
grant execute on function get_children_of_collection to anon;
grant execute on function get_children_of_folder to anon;
grant execute on function get_child_sketches_recursive to anon;
grant execute on function sketch_as_geojson to anon;
grant execute on function collection_as_geojson to anon;
grant execute on function sketch_or_collection_as_geojson to anon;

comment on function is_collection is '@omit';
comment on function get_children_of_collection is '@omit';
comment on function get_children_of_folder is '@omit';
comment on function get_child_sketches_recursive is '@omit';
comment on function sketch_as_geojson is '@omit';
comment on function collection_as_geojson is '@omit';
comment on function sketch_or_collection_as_geojson is '@omit';

CREATE OR REPLACE FUNCTION public.sketches_user_attributes(sketch public.sketches) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
    select jsonb_agg(jsonb_build_object(
                'label', form_elements.generated_label,
                'value', sketch.properties->form_elements.id::text,
                'exportId', form_elements.generated_export_id,
                'fieldType', form_elements.type_id
              )) from form_elements where form_id = (
                select id from forms where sketch_class_id = sketch.sketch_class_id
              );
  $$;


CREATE OR REPLACE FUNCTION public.sketches_geojson_properties(sketch public.sketches) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
    select sketches.properties || jsonb_build_object(
            'userId', sketches.user_id, 
            'createdAt', sketches.created_at,
            'updatedAt', sketches.updated_at,
            'sketchClassId', sketches.sketch_class_id,
            'user_slug', coalesce(nullif(user_profiles.nickname, ''), nullif(user_profiles.fullname, ''), nullif(user_profiles.email, '')),
            'collectionId', sketches.collection_id, 
            'isCollection', (select geometry_type = 'COLLECTION' from sketch_classes where id = sketches.sketch_class_id),
            'name', sketches.name,
            'userAttributes', sketches_user_attributes(sketch)) || (
            select 
              jsonb_object_agg(generated_export_id, sketches.properties->form_elements.id::text) 
              from form_elements 
              where form_id = (
                select id from forms where sketch_class_id = sketches.sketch_class_id
              )
          ) 
    from sketches
    inner join user_profiles
    on user_profiles.user_id = sketches.user_id
    where sketches.id = sketch.id;
  $$;

grant execute on function sketches_user_attributes to anon;
