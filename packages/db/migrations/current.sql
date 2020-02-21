-- create projects
DROP TABLE IF EXISTS projects;

CREATE TABLE projects (
  id serial PRIMARY KEY,
  name text NOT NULL,
  legacy_id text UNIQUE,
  subdomain varchar(16) NOT NULL UNIQUE,
  is_private boolean DEFAULT TRUE
);

CREATE INDEX project_subdomains ON projects (subdomain);

CREATE INDEX project_ids ON projects (id);

COMMENT ON COLUMN projects.is_private IS E'Whether the project is visible to non-admins';

COMMENT ON COLUMN projects.legacy_id IS E'@omit';

