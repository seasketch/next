--! Previous: sha1:8857761d763e890f92911797f876edd8ef6b7301
--! Hash: sha1:40320028379029cf90d5ef229f2ec8fa542976b4

-- Enter migration here

create or replace function collect_text_from_prosemirror_body_for_label(body jsonb)
  returns text
  language plpgsql
  immutable
  as $$
    declare
      output text;
      i jsonb;
    begin
      output = '';
      if body ? 'text' then
        output = concat(output, body->>'text');
      end if;
      if body ? 'type' and body->>'type' != 'paragraph' and body ? 'content' then
        for i in (select * from jsonb_array_elements((body->'content')))
        loop
          if length(output) > 32 then
            return output;
          elsif i ? 'type' and i->>'type' != 'paragraph' then
            output = concat(output, collect_text_from_prosemirror_body(i));
          end if;
        end loop;
      end if;
      return output;
    end;
  $$;


create or replace function generate_label(id int, body jsonb)
  returns text
  language plpgsql
  immutable
  as $$
    declare
      collected_text text;
    begin
      collected_text = collect_text_from_prosemirror_body_for_label(body);
      if length(collected_text) < 2 then
        return concat('Form Element ', id::text);
      end if;
      return collected_text;
    end;
  $$;

create or replace function generate_export_id(id int, export_id text, body jsonb)
  returns text
  language plpgsql
  immutable
  as $$
    declare
      collected_text text;
    begin
      if export_id is not null then
        return export_id;
      end if;
      collected_text = collect_text_from_prosemirror_body(body);
      if length(collected_text) < 2 then
        return concat('form_element_', id::text);
      end if;
      return substring(slugify(collected_text), 0, 32);
    end;
  $$;

grant execute on function generate_label to anon;

grant execute on function generate_export_id to anon;

alter table form_elements drop column if exists generated_export_id;
alter table form_elements drop column if exists generated_label;

alter table form_elements add column if not exists generated_export_id text not null generated always as (generate_export_id(id, export_id, body)) stored;

alter table form_elements add column if not exists generated_label text not null generated always as (generate_label(id, body)) stored;

grant execute on function collect_text_from_prosemirror_body_for_label to anon;

grant execute on function collect_text_from_prosemirror_body to anon;

CREATE OR REPLACE FUNCTION public.sketches_geojson_properties(sketch public.sketches) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
    select jsonb_build_object(
            'userId', sketches.user_id, 
            'createdAt', sketches.created_at,
            'updatedAt', sketches.updated_at,
            'sketchClassId', sketches.sketch_class_id,
            'user_slug', coalesce(nullif(user_profiles.nickname, ''), nullif(user_profiles.fullname, ''), nullif(user_profiles.email, '')),
            'collectionId', sketches.collection_id, 
            'isCollection', (select geometry_type = 'COLLECTION' from sketch_classes where id = sketches.sketch_class_id),
            'name', sketches.name,
            'userAttributes', (
              select array_agg(jsonb_build_object(
                'label', form_elements.generated_label,
                'value', sketches.properties->form_elements.id::text,
                'exportId', form_elements.generated_export_id,
                'fieldType', form_elements.type_id
              )) from form_elements where form_id = (
                select id from forms where sketch_class_id = sketches.sketch_class_id
              )
            )
          ) || (
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
