--! Previous: sha1:16db90df4dc18767a3f092f7846df55e23dae257
--! Hash: sha1:a494c507dfb3695bc11fbfdf3b6dade0911ba401

-- Enter migration here
grant execute on function bookmark_by_id to anon;
grant insert on table map_bookmarks to seasketch_superuser;
COMMENT ON TABLE "public"."map_bookmarks" IS E'@omit create';
COMMENT ON FUNCTION get_sprite_data_for_screenshot IS E'@omit';
