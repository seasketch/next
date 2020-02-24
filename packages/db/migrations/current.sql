DROP FUNCTION IF EXISTS projects_url (projects projects);

DROP TABLE IF EXISTS projects;

DROP TABLE IF EXISTS supported_locales;

DROP OWNED BY seasketch_superuser;

DROP OWNED BY anon;

DROP OWNED BY seasketch_user;

DROP ROLE IF EXISTS seasketch_superuser;

DROP ROLE IF EXISTS anon;

DROP ROLE IF EXISTS seasketch_user;

DROP SCHEMA IF EXISTS private;

CREATE SCHEMA private;

CREATE ROLE anon;

CREATE ROLE seasketch_user;

CREATE ROLE seasketch_superuser;

GRANT anon TO postgres;

GRANT seasketch_user TO postgres;

GRANT seasketch_superuser TO postgres;

ALTER DEFAULT privileges REVOKE EXECUTE ON functions FROM public;

GRANT usage ON SCHEMA public TO seasketch_user, seasketch_superuser, anon;

CREATE TABLE supported_locales (
  code varchar(8) NOT NULL PRIMARY KEY,
  label text NOT NULL
);

GRANT SELECT ON TABLE supported_locales TO seasketch_user, seasketch_superuser, anon;

INSERT INTO supported_locales (code, label)
  VALUES ('en', 'English');

COMMENT ON TABLE supported_locales IS E'@simpleCollections only\n@omit update,delete';

CREATE TABLE projects (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  legacy_id text UNIQUE,
  subdomain varchar(16) NOT NULL UNIQUE,
  is_private boolean DEFAULT TRUE,
  logo_url text CHECK (logo_url::text ~* 'https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,255}\.[a-z]{2,9}\y([-a-zA-Z0-9@:%_\+.~#?&//=]*)$'::text),
  logo_link text CHECK (logo_link::text ~* 'https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,255}\.[a-z]{2,9}\y([-a-zA-Z0-9@:%_\+.~#?&//=]*)$'::text),
  is_featured boolean DEFAULT FALSE,
  default_locale varchar(8) REFERENCES supported_locales (code) ON DELETE SET NULL DEFAULT 'en',
  deleted_at timestamp with time zone
  -- deleted_by integer references users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE projects TO seasketch_superuser;
GRANT SELECT ON TABLE projects TO anon;

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- seasketch_superusers should be able to see and modify all projects
-- anons should only be able to see public projects
create policy select_projects_anon on projects for select to anon
  using (is_private is false and deleted_at is NULL);

-- seasketch_users who have an admin role on the project should be able to see and update projects



CREATE INDEX project_subdomains ON projects (subdomain);

CREATE INDEX project_ids ON projects (id);

CREATE INDEX project_is_features ON projects (is_featured);

CREATE FUNCTION projects_url (p projects)
  RETURNS text
  AS $$
  SELECT
    'https://' || p.subdomain || '.seasketch.org'
$$
LANGUAGE sql
STABLE;

GRANT EXECUTE ON function projects_url(projects) TO anon;

COMMENT ON COLUMN projects.is_private IS E'Whether the project is visible to non-admins. Projects that are private can be thought of as in a staging state before the admin has chosen to invite end-users.';

COMMENT ON COLUMN projects.legacy_id IS E'MongoDB ObjectId from previous database';

COMMENT ON COLUMN projects.legacy_id IS E'@omit';

COMMENT ON COLUMN projects.logo_url IS E'URL referencing an image that will be used to represent the project. Will be displayed at 48x48 pixels';

COMMENT ON COLUMN projects.logo_link IS E'If a logoUrl is provided, it will link to this url in a new window if provided.';

COMMENT ON COLUMN projects.is_featured IS E'Featured projects may be given prominent placement on the homepage.';

