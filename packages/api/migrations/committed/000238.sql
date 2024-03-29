--! Previous: sha1:cb3a2860791adbd0ae51a846baeeeeb97be569c5
--! Hash: sha1:d2c24bb5aaf24b83d77f7cd0c879730cc03cbe20

-- Enter migration here

-- merge_translated_props
-- This function is used to merge translated props into the existing jsonb object
-- @param existing jsonb - the existing translated_props object
-- @param prop_name text - the name of the prop to merge
-- @param prop_translations jsonb - the translations to merge into the existing object. 
--  This should be an object with the following structure:
--  {
--    "en": "English translation",
--    "fr": "French translation"
--  }
create or replace function merge_translated_props(existing jsonb, prop_name text, prop_translations jsonb) 
  returns jsonb
  language plpgsql
  as $$
  declare
    lang text;
  begin
    for lang in select jsonb_object_keys(prop_translations) as lang
      loop
        RAISE notice 'lang: %, %', lang, existing->lang;
        if existing ? lang then
          existing := jsonb_set(existing, string_to_array(lang, ' '), existing->lang || jsonb_build_object(prop_name, prop_translations->lang));
          RAISE notice 'changed to: %', existing;
        else
          existing := jsonb_set(existing, string_to_array(lang, ' '), jsonb_build_object(prop_name, prop_translations->lang));
        end if;
      end loop;
    return existing;
  end;
$$;

grant execute on function merge_translated_props(jsonb, text, jsonb) to anon;
grant update(translated_props) on projects to seasketch_user;

alter table forums add column if not exists translated_props jsonb not null default '{}'::jsonb;
grant select(translated_props) on forums to anon;
