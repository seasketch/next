--! Previous: sha1:22ef487163b67fd6873eba449f2c8706c413b7d3
--! Hash: sha1:8ff11d96f9df8bec28d15e9c3e187b10260511d0

-- Remove email field from users table. We don't need it
ALTER TABLE users
  DROP COLUMN IF EXISTS email;

-- Store this in Auth0
ALTER TABLE users
  DROP COLUMN IF EXISTS accepted_privacy_policy;

-- Need to know if user needs to be shown any onboarding steps
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarded timestamp WITH time zone;

CREATE OR REPLACE FUNCTION get_or_create_user_by_sub (_sub text, OUT user_id int)
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
  WITH ins AS (
INSERT INTO users (sub)
      VALUES (_sub)
    ON CONFLICT (sub)
      DO NOTHING
    RETURNING
      users.id)
    SELECT
      id
    FROM
      ins
    UNION ALL
    SELECT
      users.id
    FROM
      users
    WHERE
      sub = _sub
    LIMIT 1
$func$
LANGUAGE sql;

GRANT EXECUTE ON FUNCTION get_or_create_user_by_sub TO anon;

COMMENT ON FUNCTION get_or_create_user_by_sub IS E'@omit\nIncoming users from Auth0 need to be represented in our database. This function runs whenever a user with an unrecognized token calls the api.';

-- Retrieve ID from a project slug. This should likely be cached in the app
CREATE OR REPLACE FUNCTION get_project_id (slug text)
  RETURNS int
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
  SELECT
    id
  FROM
    projects
  WHERE
    projects.slug = slug
  LIMIT 1;

$$;

GRANT EXECUTE ON FUNCTION get_project_id TO anon;

COMMENT ON FUNCTION get_project_id IS E'@omit\nEnables app to determine current project from url slug or x-ss-slug header';

DROP FUNCTION IF EXISTS me;

CREATE OR REPLACE FUNCTION me ()
  RETURNS users
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
  SELECT
    *
  FROM
    users
  WHERE
    id = nullif (current_setting('session.user_id', TRUE), '')::integer
$$;

GRANT EXECUTE ON FUNCTION me TO anon;

-- Have to grant access to entire schema for relations to be traversed properly
GRANT SELECT ON users TO seasketch_user;

-- These columns aren't a security issue if accessed but they should be hidden
COMMENT ON COLUMN users.legacy_id IS E'@omit';

COMMENT ON COLUMN users.registered_at IS E'@omit';

COMMENT ON COLUMN users.sub IS E'@omit';

DROP FUNCTION IF EXISTS current_project;

CREATE OR REPLACE FUNCTION current_project ()
  RETURNS projects
  LANGUAGE sql
  STABLE
  SET search_path = public, pg_temp
  AS $$
  SELECT
    *
  FROM
    projects
  WHERE
    id = nullif (current_setting('session.project_id', TRUE), '')::integer
$$;

GRANT EXECUTE ON FUNCTION current_project TO anon;

-- Replacing this function from earlier migration to fix ambiguous project_id var
DROP FUNCTION IF EXISTS users_is_admin;

CREATE OR REPLACE FUNCTION users_is_admin (u users, project int)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  AS $$
BEGIN
  RETURN EXISTS (
    SELECT
      user_id
    FROM
      project_participants
    WHERE
      project_participants.user_id = u.id
      AND project_participants.is_admin = TRUE
      AND project_participants.project_id = project);
END
$$;

GRANT EXECUTE ON FUNCTION users_is_admin TO seasketch_user;
