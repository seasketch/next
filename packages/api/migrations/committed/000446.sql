--! Previous: sha1:c2c4158622c68705929b8521bf3ed21f0f88d14b
--! Hash: sha1:a4be9eccf6cc215bc0b3dafba9044b513d1a3cb1

-- These functions are the expressions of stored generated columns, so pg_restore
-- evaluates them while loading rows, with the session search_path empty and
-- with triggers disabled. Without a search_path of their own they cannot
-- resolve slugify, st_xmin, get_supported_languages, or regconfig, and the
-- restore stops mid-COPY.
--
-- CREATE OR REPLACE drops this setting. A later migration that replaces one
-- of these functions has to set it again.

alter function public.changelog_row_net_zero_changes(p_field_group public.change_log_field_group, p_from_summary jsonb, p_to_summary jsonb, p_from_blob jsonb, p_to_blob jsonb) set search_path = public, pg_catalog;
alter function public.create_bbox(geom public.geometry) set search_path = public, pg_catalog;
alter function public.create_bbox(geom public.geometry, sketch_id integer) set search_path = public, pg_catalog;
alter function public.generate_export_id(id integer, export_id text, body jsonb) set search_path = public, pg_catalog;
alter function public.generate_label(id integer, body jsonb) set search_path = public, pg_catalog;
alter function public.toc_to_tsvector(lang text, title text, metadata jsonb, translated_props jsonb) set search_path = public, pg_catalog;
