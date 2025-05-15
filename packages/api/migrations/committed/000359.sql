--! Previous: sha1:73f29e75717c7504707ccdbb51789b49e1fee467
--! Hash: sha1:225b7cc3b691da25d56a687c5f8004ff15207444

-- Enter migration here
CREATE OR REPLACE FUNCTION public.search_overlays(lang text, query text, "projectId" integer, draft boolean, "limit" integer) RETURNS SETOF public.search_result
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      supported_languages jsonb := get_supported_languages();
      config regconfig;
      q tsquery;
    begin
      select key::regconfig into config from jsonb_each_text(get_supported_languages()) where value = lower(lang);
      
      -- Handle single word searches with prefix matching
      IF position(' ' in query) <= 0 THEN
        q := to_tsquery(config, query || ':*');
      ELSE
        -- For multi-word searches, use plainto_tsquery to match any of the words
        q := plainto_tsquery(config, query);
      end if;

      if config is null then
        q := plainto_tsquery('simple', query);
        IF position(' ' in query) <= 0 THEN
          q := to_tsquery('simple', query || ':*');
        end if;
        -- use the simple index
        return query select
          id, 
          stable_id, 
          ts_headline('simple', title, q, 'StartSel=<<<, StopSel=>>>') as title_headline,
          ts_headline('simple', jsonb_array_to_string(collect_prosemirror_text_nodes(metadata)), q, 'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<<, StopSel=>>>') as metadata_headline,
          is_folder
        from 
          table_of_contents_items 
        where 
          project_id = "projectId" and
          is_draft = draft and
          fts_simple @@ q
        limit
          coalesce("limit", 10);
      elsif config = 'english'::regconfig then
        return query select
          id, 
          stable_id, 
          ts_headline(config, coalesce(
            translated_props->lang->>'title'::text, title
          ), q, 'StartSel=<<<, StopSel=>>>') as title_headline,
          ts_headline(config, jsonb_array_to_string(collect_prosemirror_text_nodes(metadata)), q, 'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<<, StopSel=>>>') as metadata_headline,
          is_folder
        from 
          table_of_contents_items 
        where 
          project_id = "projectId" and
          is_draft = draft and
          fts_en @@ q
        limit
          coalesce("limit", 10);
      elsif lower(lang) = 'es' then
        return query select
          id, 
          stable_id, 
          ts_headline(config, coalesce(
            translated_props->lang->>'title'::text, title
          ), q, 'StartSel=<<<, StopSel=>>>') as title_headline,
          ts_headline(config, jsonb_array_to_string(collect_prosemirror_text_nodes(metadata)), q, 'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<<, StopSel=>>>') as metadata_headline,
          is_folder
        from 
          table_of_contents_items 
        where 
          project_id = "projectId" and
          is_draft = draft and
          fts_es @@ q
        limit
          coalesce("limit", 10);
      elsif lower(lang) = 'pt' then
        return query select
          id, 
          stable_id, 
          ts_headline(config, coalesce(
            translated_props->lang->>'title'::text, title
          ), q, 'StartSel=<<<, StopSel=>>>') as title_headline,
          ts_headline('portuguese', jsonb_array_to_string(collect_prosemirror_text_nodes(metadata)), q, 'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<<, StopSel=>>>') as metadata_headline,
          is_folder
        from
          table_of_contents_items 
        where 
          project_id = "projectId" and
          is_draft = draft and
          fts_pt @@ q
        limit
          coalesce("limit", 10);
      elsif lower(lang) = 'ar' then
        return query select
          id, 
          stable_id, 
          ts_headline(config, coalesce(
            translated_props->lang->>'title'::text, title
          ), q, 'StartSel=<<<, StopSel=>>>') as title_headline,
          ts_headline('arabic', jsonb_array_to_string(collect_prosemirror_text_nodes(metadata)), q, 'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<<, StopSel=>>>') as metadata_headline,
          is_folder
        from
          table_of_contents_items 
        where 
          project_id = "projectId" and
          is_draft = draft and
          fts_ar @@ q
        limit
          coalesce("limit", 10);
      elsif lower(lang) = 'da' then
        return query select
          id, 
          stable_id, 
          ts_headline(config, coalesce(
            translated_props->lang->>'title'::text, title
          ), q, 'StartSel=<<<, StopSel=>>>') as title_headline,
          ts_headline(config, jsonb_array_to_string(collect_prosemirror_text_nodes(metadata)), q, 'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<<, StopSel=>>>') as metadata_headline,
          is_folder
        from
          table_of_contents_items 
        where 
          project_id = "projectId" and
          is_draft = draft and
          fts_da @@ q
        limit
          coalesce("limit", 10);
      elsif lower(lang) = 'nl' then
        return query select
          id, 
          stable_id, 
          ts_headline(config, coalesce(
            translated_props->lang->>'title'::text, title
          ), q, 'StartSel=<<<, StopSel=>>>') as title_headline,
          ts_headline(config, jsonb_array_to_string(collect_prosemirror_text_nodes(metadata)), q, 'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<<, StopSel=>>>') as metadata_headline,
          is_folder
        from
          table_of_contents_items 
        where 
          project_id = "projectId" and
          is_draft = draft and
          fts_nl @@ q
        limit
          coalesce("limit", 10);
      elsif lower(lang) = 'fr' then
        return query select
          id, 
          stable_id, 
          ts_headline(config, coalesce(
            translated_props->lang->>'title'::text, title
          ), q, 'StartSel=<<<, StopSel=>>>') as title_headline,
          ts_headline(config, jsonb_array_to_string(collect_prosemirror_text_nodes(metadata)), q, 'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<<, StopSel=>>>') as metadata_headline,
          is_folder
        from
          table_of_contents_items 
        where 
          project_id = "projectId" and
          is_draft = draft and
          fts_fr @@ q
        limit
          coalesce("limit", 10);
      elsif lower(lang) = 'de' then
        return query select
          id, 
          stable_id, 
          ts_headline(config, coalesce(
            translated_props->lang->>'title'::text, title
          ), q, 'StartSel=<<<, StopSel=>>>') as title_headline,
          ts_headline(config, jsonb_array_to_string(collect_prosemirror_text_nodes(metadata)), q, 'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<<, StopSel=>>>') as metadata_headline,
          is_folder
        from
          table_of_contents_items 
        where 
          project_id = "projectId" and
          is_draft = draft and
          fts_de @@ q
        limit
          coalesce("limit", 10);
      elsif lower(lang) = 'el' then
        return query select
          id, 
          stable_id, 
          ts_headline(config, coalesce(
            translated_props->lang->>'title'::text, title
          ), q, 'StartSel=<<<, StopSel=>>>') as title_headline,
          ts_headline(config, jsonb_array_to_string(collect_prosemirror_text_nodes(metadata)), q, 'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<<, StopSel=>>>') as metadata_headline,
          is_folder
        from
          table_of_contents_items 
        where 
          project_id = "projectId" and
          is_draft = draft and
          fts_el @@ q
        limit
          coalesce("limit", 10);
      elsif lower(lang) = 'id' then
        return query select
          id, 
          stable_id, 
          ts_headline(config, coalesce(
            translated_props->lang->>'title'::text, title
          ), q, 'StartSel=<<<, StopSel=>>>') as title_headline,
          ts_headline(config, jsonb_array_to_string(collect_prosemirror_text_nodes(metadata)), q, 'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<<, StopSel=>>>') as metadata_headline,
          is_folder
        from
          table_of_contents_items 
        where 
          project_id = "projectId" and
          is_draft = draft and
          fts_id @@ q
        limit
          coalesce("limit", 10);
      elsif lower(lang) = 'it' then
        return query select
          id, 
          stable_id, 
          ts_headline(config, coalesce(
            translated_props->lang->>'title'::text, title
          ), q, 'StartSel=<<<, StopSel=>>>') as title_headline,
          ts_headline(config, jsonb_array_to_string(collect_prosemirror_text_nodes(metadata)), q, 'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<<, StopSel=>>>') as metadata_headline,
          is_folder
        from
          table_of_contents_items 
        where 
          project_id = "projectId" and
          is_draft = draft and
          fts_it @@ q
        limit
          coalesce("limit", 10);
      elsif lower(lang) = 'lt' then
        return query select
          id, 
          stable_id, 
          ts_headline(config, coalesce(
            translated_props->lang->>'title'::text, title
          ), q, 'StartSel=<<<, StopSel=>>>') as title_headline,
          ts_headline(config, jsonb_array_to_string(collect_prosemirror_text_nodes(metadata)), q, 'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<<, StopSel=>>>') as metadata_headline,
          is_folder
        from
          table_of_contents_items 
        where 
          project_id = "projectId" and
          is_draft = draft and
          fts_lt @@ q
        limit
          coalesce("limit", 10);
      elsif lower(lang) = 'no' then
        return query select
          id, 
          stable_id, 
          ts_headline(config, coalesce(
            translated_props->lang->>'title'::text, title
          ), q, 'StartSel=<<<, StopSel=>>>') as title_headline,
          ts_headline(config, jsonb_array_to_string(collect_prosemirror_text_nodes(metadata)), q, 'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<<, StopSel=>>>') as metadata_headline,
          is_folder
        from
          table_of_contents_items 
        where
          project_id = "projectId" and
          is_draft = draft and
          fts_no @@ q
        limit
          coalesce("limit", 10);
      elsif lower(lang) = 'ro' then
        return query select
          id, 
          stable_id, 
          ts_headline(config, coalesce(
            translated_props->lang->>'title'::text, title
          ), q, 'StartSel=<<<, StopSel=>>>') as title_headline,
          ts_headline(config, jsonb_array_to_string(collect_prosemirror_text_nodes(metadata)), q, 'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<<, StopSel=>>>') as metadata_headline,
          is_folder
        from
          table_of_contents_items 
        where
          project_id = "projectId" and
          is_draft = draft and
          fts_ro @@ q
        limit
          coalesce("limit", 10);
      elsif lower(lang) = 'ru' then
        return query select
          id, 
          stable_id, 
          ts_headline(config, coalesce(
            translated_props->lang->>'title'::text, title
          ), q, 'StartSel=<<<, StopSel=>>>') as title_headline,
          ts_headline(config, jsonb_array_to_string(collect_prosemirror_text_nodes(metadata)), q, 'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<<, StopSel=>>>') as metadata_headline,
          is_folder
        from
          table_of_contents_items 
        where
          project_id = "projectId" and
          is_draft = draft and
          fts_ru @@ q
        limit
          coalesce("limit", 10);
      elsif lower(lang) = 'sv' then
        return query select
          id, 
          stable_id, 
          ts_headline(config, coalesce(
            translated_props->lang->>'title'::text, title
          ), q, 'StartSel=<<<, StopSel=>>>') as title_headline,
          ts_headline(config, jsonb_array_to_string(collect_prosemirror_text_nodes(metadata)), q, 'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<<, StopSel=>>>') as metadata_headline,
          is_folder
        from
          table_of_contents_items 
        where
          project_id = "projectId" and
          is_draft = draft and
          fts_sv @@ q
        limit
          coalesce("limit", 10);
      else
        raise exception 'Unsupported language: %', lang;
      end if;
    end;
  $$;
