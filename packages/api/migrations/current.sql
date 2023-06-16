-- Enter migration here
drop function if exists posts_file_uploads;
drop function if exists create_file_upload;
drop table if exists file_uploads;

drop type if exists file_upload_type;
create type file_upload_type as enum ('forum_attachment', 'survey_response');
COMMENT ON TYPE file_upload_type IS E'@enum\n@enumName FileUploadType';

create table file_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location TEXT NOT NULL default 'r2',
  filename TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  content_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  post_id int references posts(id) on delete cascade,
  user_id int not null references users(id) on delete cascade,
  type file_upload_type not null,
  project_id int not null references projects(id) on delete cascade
);

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

create or replace function create_file_upload(
  filename text,
  file_size_bytes bigint,
  content_type text,
  type file_upload_type,
  project_id int
) returns file_uploads
  language sql
  security definer
  as $$
    insert into file_uploads (filename, file_size_bytes, content_type, type, project_id, user_id)
    values (create_file_upload.filename, create_file_upload.file_size_bytes, create_file_upload.content_type, create_file_upload.type, create_file_upload.project_id, nullif(current_setting('session.user_id', TRUE), '')::integer)
    returning *;
  $$;

grant execute on function create_file_upload to seasketch_user;

comment on function create_file_upload is 'Use to upload files to cloud storage (POST). Creates a new FileUpload record. Be sure to include the presignedUploadUrl field in your query selection so that you can perform the actual file upload.';