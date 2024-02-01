--! AllowInvalidHash
--! Previous: sha1:a39327252c79d7c4093213cfa1f7c74b411ae2c3
--! Hash: sha1:be6ac92128bee9ab4257045f4e2142198b2bf936


-- Enter migration here

-- Recursive function to traverse and collect text from nodes
CREATE OR REPLACE FUNCTION traverse_prosemirror_nodes(node jsonb)
RETURNS jsonb 
AS $$
DECLARE
    result jsonb := '[]'::jsonb;
    child jsonb;
    children jsonb[];
BEGIN
    -- Check if the node is a text node
    IF node->>'type' = 'text' THEN
        result := result || jsonb_build_array(node->>'text');
    END IF;

    -- Process child nodes recursively
    IF jsonb_typeof(node->'content') = 'array' THEN
        children := array(SELECT jsonb_array_elements(node->'content'));

        FOR i IN 1..array_length(children, 1)
        LOOP
            child := children[i];
            result := result || traverse_prosemirror_nodes(child);
        END LOOP;
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION jsonb_array_to_string(jsonb_array jsonb)
RETURNS text AS $$
DECLARE
    element jsonb;
    result_text text := '';
BEGIN
    -- Iterate over each element in the JSONB array
    FOR element IN SELECT * FROM jsonb_array_elements(jsonb_array)
    LOOP
        -- Cast the JSONB element to text and trim the double quotes
        -- Add a space separator if it's not the first element
        IF result_text <> '' THEN
            result_text := result_text || ' ' || trim(both '"' from element::text);
        ELSE
            result_text := trim(both '"' from element::text);
        END IF;
    END LOOP;

    RETURN result_text;
END;
$$ LANGUAGE plpgsql;


-- Main function to collect text nodes from a ProseMirror document
CREATE OR REPLACE FUNCTION collect_prosemirror_text_nodes(doc jsonb)
RETURNS jsonb 
immutable
AS $$
BEGIN
    RETURN traverse_prosemirror_nodes(doc);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION extract_title(lang text, doc jsonb)
RETURNS text 
immutable
AS $$
BEGIN
    -- Extract and return the title for the specified language
    RETURN (doc->lang)->>'title';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION extract_all_titles(doc jsonb)
RETURNS text 
immutable
AS $$
DECLARE
    lang text;
    title text;
    all_titles text := '';
BEGIN
    FOR lang IN SELECT jsonb_object_keys(doc)
    LOOP
        -- Extract title for the current language
        title := doc->lang->>'title';

        -- Skip if the title is empty
        IF title IS NOT NULL AND title <> '' THEN
            -- Concatenate with a space if not the first title
            IF all_titles <> '' THEN
                all_titles := all_titles || ' ';
            END IF;

            all_titles := all_titles || title;
        END IF;
    END LOOP;

    -- Return NULL if no valid titles were found
    IF all_titles = '' THEN
        RETURN NULL;
    END IF;

    RETURN all_titles;
END;
$$ LANGUAGE plpgsql;


comment on function collect_prosemirror_text_nodes is '@omit';
comment on function traverse_prosemirror_nodes is '@omit';
comment on function extract_title is '@omit';
comment on function extract_all_titles is '@omit';
comment on function jsonb_array_to_string is '@omit';

grant execute on function collect_prosemirror_text_nodes to anon;
grant execute on function traverse_prosemirror_nodes to anon;
grant execute on function extract_title to anon;
grant execute on function extract_all_titles to anon;
grant execute on function jsonb_array_to_string to anon;

create or replace function get_supported_languages()
  returns jsonb
  language sql
  immutable
  as $$
    select '{"simple": "simple", "english": "EN", "spanish": "es", "portuguese": "pt", "arabic": "ar", "danish": "da", "dutch": "nl", "french": "fr", "german": "de", "indonesian": "id", "italian": "it", "lithuanian": "lt", "norwegian": "no", "romanian": "ro", "russian": "ru", "swedish": "sv"}'::jsonb;
  $$;

create or replace function toc_to_tsvector(lang text, title text, metadata jsonb, translated_props jsonb)
  returns tsvector
  language plpgsql
  immutable
  as $$
    DECLARE
      title_translated_prop_is_filled_in boolean;
      supported_languages jsonb := get_supported_languages();
      langkey text := supported_languages->>lang;
      conf regconfig := lang::regconfig;
    BEGIN
      title_translated_prop_is_filled_in = (translated_props->lang->>'title') is not null and (translated_props->lang->>'title') <> '';
      if supported_languages->>lang is null then
        raise exception 'Language % not supported', lang;
      end if;
      -- TODO: add support for translating metadata
      if lang = 'simple' THEN
        -- The simple index matches against absolutely everything in
        -- all languages. It's a fallback that can be used when you
        -- aren't getting any matches from the language-specific
        -- indexes.
        return (
          setweight(to_tsvector(conf, title), 'A') || 
          setweight(
            to_tsvector(conf, extract_all_titles(translated_props)),  
          'A') ||
          setweight(
            jsonb_to_tsvector(conf, collect_prosemirror_text_nodes(metadata), '["string"]'
          ), 'B')
        );
      elsif lang = 'english' THEN
          return (
            setweight(to_tsvector(conf, title), 'A') ||
            setweight(
              to_tsvector(conf, coalesce(translated_props->langkey->>'title'::text, ''::text)), 
            'A') ||
            setweight(
              jsonb_to_tsvector(conf, collect_prosemirror_text_nodes(metadata), '["string"]'), 
            'B')
          );
      else
        return (
          setweight(
              to_tsvector(conf, coalesce(translated_props->langkey->>'title'::text, ''::text)), 
            'A') ||
            setweight(
              jsonb_to_tsvector(conf, collect_prosemirror_text_nodes(metadata), '["string"]'), 
            'B') ||
            setweight(to_tsvector(conf, title), 'C')
        );
      end if;
    end;
  $$;


comment on function toc_to_tsvector is '@omit';
grant execute on function toc_to_tsvector to anon;

ALTER TABLE table_of_contents_items ADD COLUMN if not exists fts_simple tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('simple', title, metadata, translated_props)) STORED;

CREATE INDEX if not exists fts_simple_idx ON table_of_contents_items USING GIN (fts_simple);

-- English
ALTER TABLE table_of_contents_items ADD COLUMN if not exists fts_en tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('english', title, metadata, translated_props)) STORED;

CREATE INDEX if not exists fts_en_idx ON table_of_contents_items USING GIN (fts_en);

-- Spanish
ALTER TABLE table_of_contents_items ADD COLUMN if not exists fts_es tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('spanish', title, metadata, translated_props)) STORED;

CREATE INDEX if not exists fts_es_idx ON table_of_contents_items USING GIN (fts_es);


-- portuguese
ALTER TABLE table_of_contents_items ADD COLUMN if not exists fts_pt tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('portuguese', title, metadata, translated_props)) STORED;

CREATE INDEX if not exists fts_pt_idx ON table_of_contents_items USING GIN (fts_pt);


-- arabic
ALTER TABLE table_of_contents_items ADD COLUMN if not exists fts_ar tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('arabic', title, metadata, translated_props)) STORED;
CREATE INDEX if not exists fts_ar_idx ON table_of_contents_items USING GIN (fts_ar);

-- danish
ALTER TABLE table_of_contents_items ADD COLUMN if not exists fts_da tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('danish', title, metadata, translated_props)) STORED;
CREATE INDEX if not exists fts_da_idx ON table_of_contents_items USING GIN (fts_da);

-- dutch
ALTER TABLE table_of_contents_items ADD COLUMN if not exists fts_nl tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('dutch', title, metadata, translated_props)) STORED;
CREATE INDEX if not exists fts_nl_idx ON table_of_contents_items USING GIN (fts_nl);

-- french
ALTER TABLE table_of_contents_items ADD COLUMN if not exists fts_fr tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('french', title, metadata, translated_props)) STORED;
CREATE INDEX if not exists fts_fr_idx ON table_of_contents_items USING GIN (fts_fr);

-- german
ALTER TABLE table_of_contents_items ADD COLUMN if not exists fts_de tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('german', title, metadata, translated_props)) STORED;
CREATE INDEX if not exists fts_de_idx ON table_of_contents_items USING GIN (fts_de);

-- indonesian
ALTER TABLE table_of_contents_items ADD COLUMN if not exists fts_id tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('indonesian', title, metadata, translated_props)) STORED;
CREATE INDEX if not exists fts_id_idx ON table_of_contents_items USING GIN (fts_id);

-- italian
ALTER TABLE table_of_contents_items ADD COLUMN if not exists fts_it tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('italian', title, metadata, translated_props)) STORED;
CREATE INDEX if not exists fts_it_idx ON table_of_contents_items USING GIN (fts_it);

-- lithuanian
ALTER TABLE table_of_contents_items ADD COLUMN if not exists fts_lt tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('lithuanian', title, metadata, translated_props)) STORED;
CREATE INDEX if not exists fts_lt_idx ON table_of_contents_items USING GIN (fts_lt);

-- norwegian
ALTER TABLE table_of_contents_items ADD COLUMN if not exists fts_no tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('norwegian', title, metadata, translated_props)) STORED;
CREATE INDEX if not exists fts_no_idx ON table_of_contents_items USING GIN (fts_no);

-- romanian
ALTER TABLE table_of_contents_items ADD COLUMN if not exists fts_ro tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('romanian', title, metadata, translated_props)) STORED;
CREATE INDEX if not exists fts_ro_idx ON table_of_contents_items USING GIN (fts_ro);

-- russian
ALTER TABLE table_of_contents_items ADD COLUMN if not exists fts_ru tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('russian', title, metadata, translated_props)) STORED;
CREATE INDEX if not exists fts_ru_idx ON table_of_contents_items USING GIN (fts_ru);

-- swedish
ALTER TABLE table_of_contents_items ADD COLUMN if not exists fts_sv tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('swedish', title, metadata, translated_props)) STORED;
CREATE INDEX if not exists fts_sv_idx ON table_of_contents_items USING GIN (fts_sv);

drop type if exists search_result;

create type search_result as (
  id int,
  stable_id text,
  title_headline text,
  metadata_headline text,
  is_folder boolean
);

create or replace function search_overlays(lang text, query text, "projectId" int, draft boolean, "limit" integer)
  returns setof search_result
  language plpgsql
  security definer
  stable
  as $$
    declare
      q tsquery := websearch_to_tsquery('english'::regconfig, query);
    begin
      IF position(' ' in query) <= 0 THEN
        q := to_tsquery('english'::regconfig, query || ':*');
      end if;
      return query select
        id, 
        stable_id, 
        ts_headline('english', title, q, 'StartSel=<<<, StopSel=>>>') as title_headline,
        ts_headline('english', jsonb_array_to_string(collect_prosemirror_text_nodes(metadata)), q, 'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<<, StopSel=>>>') as metadata_headline,
        is_folder
      from 
        table_of_contents_items 
      where 
        project_id = "projectId" and
        is_draft = draft and
        fts_en @@ q
      limit
        coalesce("limit", 10);
    end;
  $$;

grant execute on function search_overlays to anon;

comment on function search_overlays is '@simpleCollections only';

grant execute on function get_supported_languages to anon;
comment on function get_supported_languages is '@omit';
