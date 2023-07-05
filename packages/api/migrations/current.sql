-- Enter migration here
grant insert on table map_bookmarks to seasketch_superuser;
COMMENT ON TABLE "public"."map_bookmarks" IS E'@omit create';
COMMENT ON FUNCTION get_sprite_data_for_screenshot IS E'@arg0variant base @omit';
grant execute on function bookmark_by_id to anon;
drop trigger if exists assign_file_upload_attachment_post_ids_from_message_contents on posts;
drop function if exists assign_file_upload_node_post_ids;
drop function if exists assign_post_id_to_attached_file_uploads;
drop function if exists collect_file_upload_ids_from_prosemirror_body;
drop function if exists posts_file_uploads;
drop function if exists create_file_upload;
drop table if exists file_uploads;


drop type if exists file_upload_usage;
create type file_upload_usage as enum ('forum_attachment', 'survey_response');
COMMENT ON TYPE file_upload_usage IS E'@enum';

drop type if exists file_upload_location;
create type file_upload_location as enum ('r2', 'cloudflare_images');

create table file_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  content_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  post_id int references posts(id) on delete cascade,
  user_id int not null references users(id) on delete cascade,
  usage file_upload_usage not null,
  project_id int not null references projects(id) on delete cascade,
  is_spatial boolean not null default false,
  tilejson_endpoint text,
  cloudflare_images_id text
);

grant insert on table file_uploads to seasketch_superuser;
COMMENT ON TABLE "public"."file_uploads" IS E'@omit create';

comment on column file_uploads.content_type is 'Use a listed media type from https://www.iana.org/assignments/media-types/media-types.xhtml';

create index on file_uploads (post_id);
create or replace function posts_file_uploads(p posts)
  returns setof file_uploads 
  language sql
  stable
  security definer
  as $$
    select * from file_uploads where post_id = p.id;
  $$;

comment on function posts_file_uploads is '@simpleCollections only';

grant execute on function posts_file_uploads to anon;

grant select on file_uploads to anon;

CREATE OR REPLACE FUNCTION public.collect_attachment_ids_from_prosemirror_body(body jsonb, type text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      output text[];
      i jsonb;
      attachment jsonb;
    begin
      output = '{}';
      if body ? 'attrs' and (body -> 'attrs') ? 'type' then
        if type is null or (body -> 'attrs') ->> 'type' = type then
          select body ->> 'attrs' into attachment;
          if attachment is not null and attachment->>'id' is not null then
            output = (attachment->>'id')::text || output;
          end if;
        end if;
      end if;
      if body ? 'content' and (body ->> 'type' = 'attachments' or body ->> 'type' = 'doc') then
        for i in (select * from jsonb_array_elements((body->'content')))
        loop
          output = output || collect_attachment_ids_from_prosemirror_body(i, type);
        end loop;
      end if;
      return output;
    end;
  $$;

grant execute on function collect_attachment_ids_from_prosemirror_body to anon;

CREATE FUNCTION public.assign_post_id_to_attached_file_uploads(body jsonb, post_id integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      file_upload_ids text[];
    begin
      select collect_attachment_ids_from_prosemirror_body(body, 'FileUpload') into file_upload_ids;
      update file_uploads set post_id = assign_post_id_to_attached_file_uploads.post_id where id::text = any(file_upload_ids);
      return true;
    end;
  $$;


CREATE FUNCTION public.assign_file_upload_node_post_ids() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  perform assign_post_id_to_attached_file_uploads(NEW.message_contents, NEW.id);
	RETURN NEW;
END;
$$;

CREATE TRIGGER assign_file_upload_attachment_post_ids_from_message_contents AFTER INSERT OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.assign_file_upload_node_post_ids();

alter table posts add column if not exists ordered_attachment_ids text[] generated always as (collect_attachment_ids_from_prosemirror_body(message_contents, null)) stored;

grant select on table file_uploads to seasketch_user;
