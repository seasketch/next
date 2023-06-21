-- Enter migration here
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
