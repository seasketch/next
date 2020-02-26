-- DROP all the things so that current.sql can be re-run idempotently
DROP FUNCTION IF EXISTS projects_url (projects projects);

DROP POLICY IF EXISTS update_projects_superuser ON projects;

DROP POLICY IF EXISTS select_projects_superuser ON projects;

DROP TABLE IF EXISTS projects, app_private.users, GROUPS, project_members;

DROP TABLE IF EXISTS supported_locales;

DROP SCHEMA IF EXISTS app_private;

-- Done dropping things
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON functions FROM PUBLIC;

CREATE SCHEMA app_private;

-- GRANT usage ON SCHEMA public TO seasketch_user, seasketch_superuser, anon;
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
  NAME text NOT NULL,
  description text,
  legacy_id text UNIQUE,
  subdomain varchar(16) NOT NULL UNIQUE,
  is_published boolean DEFAULT FALSE,
  logo_url text CHECK (logo_url::text ~* 'https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,255}\.[a-z]{2,9}\y([-a-zA-Z0-9@:%_\+.~#?&//=]*)$'::text),
  logo_link text CHECK (logo_link::text ~* 'https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,255}\.[a-z]{2,9}\y([-a-zA-Z0-9@:%_\+.~#?&//=]*)$'::text),
  is_featured boolean DEFAULT FALSE,
  default_locale varchar(8) REFERENCES supported_locales (code) ON DELETE SET NULL DEFAULT 'en',
  is_deleted boolean DEFAULT FALSE,
  deleted_at timestamp WITH time zone -- deleted_by integer references users(id)
);

GRANT SELECT, INSERT, UPDATE ON TABLE projects TO seasketch_superuser;

GRANT SELECT ON TABLE projects TO anon;

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE TABLE app_private.users (
  id serial PRIMARY KEY,
  email text UNIQUE
);

CREATE TABLE GROUPS (
  project_id integer REFERENCES projects (id) ON DELETE CASCADE,
  NAME text NOT NULL CHECK (char_length(NAME) > 1) UNIQUE
);

COMMENT ON TABLE GROUPS IS E'@simpleCollections only';

CREATE TABLE project_members (
  id serial PRIMARY KEY,
  user_id integer REFERENCES app_private.users (id) ON DELETE CASCADE,
  project_id integer REFERENCES projects (id) ON DELETE CASCADE,
  is_admin boolean DEFAULT FALSE
);

GRANT SELECT ON project_members TO anon;

-- seasketch_superusers should be able to see and modify all projects
CREATE POLICY select_projects_superuser ON projects FOR SELECT TO seasketch_superuser USING (TRUE);

CREATE POLICY update_projects_superuser ON projects FOR UPDATE TO seasketch_superuser USING (TRUE);

-- anons should only be able to see public projects
CREATE POLICY select_projects_unpriviledged ON projects FOR SELECT TO anon USING (is_published IS TRUE
  AND deleted_at IS NULL);

-- seasketch_users who have an admin role on the project should be able to see and update projects
CREATE POLICY select_projects_admin ON projects FOR SELECT TO seasketch_admin USING (id = nullif (current_setting('session.project_id', TRUE), '')::integer
  AND is_deleted = FALSE);

CREATE INDEX project_subdomains ON projects (subdomain);

CREATE INDEX project_ids ON projects (id);

CREATE INDEX project_is_published ON projects (is_published);

CREATE INDEX project_is_deleted ON projects (is_deleted);

CREATE INDEX project_is_features ON projects (is_featured);

CREATE FUNCTION projects_url (p projects)
  RETURNS text
  AS $$
  SELECT
    'https://' || p.subdomain || '.seasketch.org'
$$
LANGUAGE SQL
STABLE;

GRANT EXECUTE ON FUNCTION projects_url (projects) TO anon;

COMMENT ON COLUMN projects.is_published IS E'Whether the project is visible to non-admins. Projects that are unpublished can be thought of as in a staging state before the admin has chosen to invite end-users.';

COMMENT ON COLUMN projects.legacy_id IS E'MongoDB ObjectId from previous database';

COMMENT ON COLUMN projects.legacy_id IS E'@omit';

COMMENT ON COLUMN projects.logo_url IS E'URL referencing an image that will be used to represent the project. Will be displayed at 48x48 pixels';

COMMENT ON COLUMN projects.logo_link IS E'If a logoUrl is provided, it will link to this url in a new window if provided.';

COMMENT ON COLUMN projects.is_featured IS E'Featured projects may be given prominent placement on the homepage.';

