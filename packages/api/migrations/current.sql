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

grant execute on function collect_prosemirror_text_nodes to anon;
grant execute on function traverse_prosemirror_nodes to anon;
grant execute on function extract_title to anon;
grant execute on function extract_all_titles to anon;

drop table if exists supported_search_languages;

create table supported_search_languages (
  code text primary key not null
);

insert into supported_search_languages (code) values ('EN') on conflict do nothing;
insert into supported_search_languages (code) values ('es') on conflict do nothing;
insert into supported_search_languages (code) values ('pt') on conflict do nothing;
insert into supported_search_languages (code) values ('ar') on conflict do nothing;
insert into supported_search_languages (code) values ('da') on conflict do nothing;
insert into supported_search_languages (code) values ('nl') on conflict do nothing;
insert into supported_search_languages (code) values ('fr') on conflict do nothing;
insert into supported_search_languages (code) values ('de') on conflict do nothing;
insert into supported_search_languages (code) values ('el') on conflict do nothing;
insert into supported_search_languages (code) values ('id') on conflict do nothing;
insert into supported_search_languages (code) values ('it') on conflict do nothing;
insert into supported_search_languages (code) values ('lt') on conflict do nothing;
insert into supported_search_languages (code) values ('no') on conflict do nothing;
insert into supported_search_languages (code) values ('ro') on conflict do nothing;
insert into supported_search_languages (code) values ('ru') on conflict do nothing;
insert into supported_search_languages (code) values ('sv') on conflict do nothing;



create or replace function toc_to_tsvector(lang text, title text, metadata jsonb, translated_props jsonb)
  returns tsvector
  language plpgsql
  immutable
  as $$
    DECLARE
      title_translated_prop_is_filled_in boolean;
      supported_languages jsonb := '{"simple": "simple", "english": "EN", "spanish": "es", "portuguese": "pt", "arabic": "ar", "danish": "da", "dutch": "nl", "french": "fr", "german": "de", "greek": "el", "indonesian": "id", "italian": "it", "lithuanian": "lt", "norwegian": "no", "romanian": "ro", "russian": "ru", "swedish": "sv"}';
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
              to_tsvector(conf, translated_props->langkey->>'title'), 
            'A') ||
            setweight(
              jsonb_to_tsvector(conf, collect_prosemirror_text_nodes(metadata), '["string"]'), 
            'B')
          );
      else
        return (
          setweight(
              to_tsvector(conf, translated_props->langkey->>'title'), 
            'A') ||
            setweight(
              jsonb_to_tsvector(conf, collect_prosemirror_text_nodes(metadata), '["string"]'), 
            'B')
        );
      end if;
    end;
  $$;


comment on function toc_to_tsvector is '@omit';
grant execute on function toc_to_tsvector to anon;

-- Simple
DROP INDEX IF EXISTS fts_simple_idx;
DROP INDEX IF EXISTS fts_en_idx;
DROP INDEX IF EXISTS fts_es_idx;
alter table table_of_contents_items drop column if exists fts_simple;
alter table table_of_contents_items drop column if exists fts_en;
alter table table_of_contents_items drop column if exists fts_es;

ALTER TABLE table_of_contents_items ADD COLUMN fts_simple tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('simple', title, metadata, translated_props)) STORED;

CREATE INDEX fts_simple_idx ON table_of_contents_items USING GIN (fts_simple);

-- English
DROP INDEX IF EXISTS fts_en_idx;
alter table table_of_contents_items drop column if exists fts_en;

ALTER TABLE table_of_contents_items ADD COLUMN fts_en tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('english', title, metadata, translated_props)) STORED;

CREATE INDEX fts_en_idx ON table_of_contents_items USING GIN (fts_en);

-- Spanish
DROP INDEX IF EXISTS fts_es_idx;
alter table table_of_contents_items drop column if exists fts_es;

ALTER TABLE table_of_contents_items ADD COLUMN fts_es tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('spanish', title, metadata, translated_props)) STORED;

CREATE INDEX fts_es_idx ON table_of_contents_items USING GIN (fts_es);


-- portuguese
DROP INDEX IF EXISTS fts_pt_idx;
alter table table_of_contents_items drop column if exists fts_pt;

ALTER TABLE table_of_contents_items ADD COLUMN fts_pt tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('portuguese', title, metadata, translated_props)) STORED;

CREATE INDEX fts_pt_idx ON table_of_contents_items USING GIN (fts_pt);


-- arabic
DROP INDEX IF EXISTS fts_ar_idx;
alter table table_of_contents_items drop column if exists fts_ar;
ALTER TABLE table_of_contents_items ADD COLUMN fts_ar tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('arabic', title, metadata, translated_props)) STORED;
CREATE INDEX fts_ar_idx ON table_of_contents_items USING GIN (fts_ar);

-- danish
DROP INDEX IF EXISTS fts_da_idx;
alter table table_of_contents_items drop column if exists fts_da;
ALTER TABLE table_of_contents_items ADD COLUMN fts_da tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('danish', title, metadata, translated_props)) STORED;
CREATE INDEX fts_da_idx ON table_of_contents_items USING GIN (fts_da);

-- dutch
DROP INDEX IF EXISTS fts_nl_idx;
alter table table_of_contents_items drop column if exists fts_nl;
ALTER TABLE table_of_contents_items ADD COLUMN fts_nl tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('dutch', title, metadata, translated_props)) STORED;
CREATE INDEX fts_nl_idx ON table_of_contents_items USING GIN (fts_nl);

-- french
DROP INDEX IF EXISTS fts_fr_idx;
alter table table_of_contents_items drop column if exists fts_fr;
ALTER TABLE table_of_contents_items ADD COLUMN fts_fr tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('french', title, metadata, translated_props)) STORED;
CREATE INDEX fts_fr_idx ON table_of_contents_items USING GIN (fts_fr);

-- german
DROP INDEX IF EXISTS fts_de_idx;
alter table table_of_contents_items drop column if exists fts_de;
ALTER TABLE table_of_contents_items ADD COLUMN fts_de tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('german', title, metadata, translated_props)) STORED;
CREATE INDEX fts_de_idx ON table_of_contents_items USING GIN (fts_de);

-- greek
DROP INDEX IF EXISTS fts_el_idx;
alter table table_of_contents_items drop column if exists fts_el;
ALTER TABLE table_of_contents_items ADD COLUMN fts_el tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('greek', title, metadata, translated_props)) STORED;
CREATE INDEX fts_el_idx ON table_of_contents_items USING GIN (fts_el);

-- indonesian
DROP INDEX IF EXISTS fts_id_idx;
alter table table_of_contents_items drop column if exists fts_id;
ALTER TABLE table_of_contents_items ADD COLUMN fts_id tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('indonesian', title, metadata, translated_props)) STORED;
CREATE INDEX fts_id_idx ON table_of_contents_items USING GIN (fts_id);

-- italian
DROP INDEX IF EXISTS fts_it_idx;
alter table table_of_contents_items drop column if exists fts_it;
ALTER TABLE table_of_contents_items ADD COLUMN fts_it tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('italian', title, metadata, translated_props)) STORED;
CREATE INDEX fts_it_idx ON table_of_contents_items USING GIN (fts_it);

-- lithuanian
DROP INDEX IF EXISTS fts_lt_idx;
alter table table_of_contents_items drop column if exists fts_lt;
ALTER TABLE table_of_contents_items ADD COLUMN fts_lt tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('lithuanian', title, metadata, translated_props)) STORED;
CREATE INDEX fts_lt_idx ON table_of_contents_items USING GIN (fts_lt);

-- norwegian
DROP INDEX IF EXISTS fts_no_idx;
alter table table_of_contents_items drop column if exists fts_no;
ALTER TABLE table_of_contents_items ADD COLUMN fts_no tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('norwegian', title, metadata, translated_props)) STORED;
CREATE INDEX fts_no_idx ON table_of_contents_items USING GIN (fts_no);

-- romanian
DROP INDEX IF EXISTS fts_ro_idx;
alter table table_of_contents_items drop column if exists fts_ro;
ALTER TABLE table_of_contents_items ADD COLUMN fts_ro tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('romanian', title, metadata, translated_props)) STORED;
CREATE INDEX fts_ro_idx ON table_of_contents_items USING GIN (fts_ro);

-- russian
DROP INDEX IF EXISTS fts_ru_idx;
alter table table_of_contents_items drop column if exists fts_ru;
ALTER TABLE table_of_contents_items ADD COLUMN fts_ru tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('russian', title, metadata, translated_props)) STORED;
CREATE INDEX fts_ru_idx ON table_of_contents_items USING GIN (fts_ru);

-- swedish
DROP INDEX IF EXISTS fts_sv_idx;
alter table table_of_contents_items drop column if exists fts_sv;
ALTER TABLE table_of_contents_items ADD COLUMN fts_sv tsvector
    GENERATED ALWAYS AS (toc_to_tsvector('swedish', title, metadata, translated_props)) STORED;
CREATE INDEX fts_sv_idx ON table_of_contents_items USING GIN (fts_sv);
