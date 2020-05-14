--! Previous: sha1:93e8475ca1be3c6a051674eb1a31cfe6322c0f57
--! Hash: sha1:22ef487163b67fd6873eba449f2c8706c413b7d3

-- # Clean up GraphQL schema using "smart comments"
-- ## remove "all" type listing that aren't necessary
-- if these comments are overriden their statements will have to be included

COMMENT ON TABLE project_groups IS E'@name groups\n@omit all';

COMMENT ON TABLE project_participants IS E'@omit all';

COMMENT ON TABLE project_group_members IS E'@omit all';

COMMENT ON TABLE users IS E'@omit all';

COMMENT ON TABLE user_profiles IS E'@omit all\n@name profile\nPersonal information that users have contributed. Note that access to PII must be handle carefully to respect sharing preferences';

-- # Groups and Group Members
-- We just need a simple collection on groups

COMMENT ON TABLE project_groups IS E'@name groups\n@omit all,filter\n@simpleCollections only\nUser groups designated by the project administrators';

-- Don't show out of the box relay connections because they lack appropriate sorting
COMMENT ON TABLE "project_group_members" IS E'@omit';

DROP FUNCTION IF EXISTS project_groups_members;

DROP FUNCTION IF EXISTS projects_participants;

DROP TYPE IF EXISTS participant_sort_by;

CREATE TYPE participant_sort_by AS ENUM (
  'NAME',
  'EMAIL'
);

DROP TYPE IF EXISTS sort_by_direction;

CREATE TYPE sort_by_direction AS enum (
  'ASC',
  'DESC'
);

-- Custom query to list and sort participants in a group
CREATE FUNCTION project_groups_members (g project_groups, order_by participant_sort_by DEFAULT 'NAME', direction sort_by_direction DEFAULT 'ASC')
  RETURNS SETOF users
  AS $$
  SELECT
    users.*
  FROM
    users
    INNER JOIN project_group_members ON (project_group_members.user_id = users.id)
    INNER JOIN user_profiles ON (user_profiles.user_id = users.id)
  WHERE
    project_group_members.group_id = g.id
  ORDER BY
    CASE WHEN direction = 'ASC' THEN
      CASE order_by
      WHEN 'NAME' THEN
        user_profiles.fullname
      WHEN 'EMAIL' THEN
        user_profiles.email
      END
    END ASC,
    CASE WHEN direction = 'DESC' THEN
      CASE order_by
      WHEN 'NAME' THEN
        user_profiles.fullname
      WHEN 'EMAIL' THEN
        user_profiles.email
      END
    END DESC
$$
LANGUAGE sql
STABLE;

GRANT EXECUTE ON FUNCTION project_groups_members (project_groups, participant_sort_by, sort_by_direction) TO seasketch_user;

COMMENT ON FUNCTION project_groups_members IS E'@name members\n@simpleCollections only';

DROP FUNCTION IF EXISTS project_groups_member_count;

-- Add a custom function to add a member count since relay connections aren't supported
CREATE OR REPLACE FUNCTION project_groups_member_count (g project_groups)
  RETURNS int
  LANGUAGE sql
  STABLE
  AS $$
  SELECT
    COALESCE((
      SELECT
        count(*)::int FROM project_group_members
    WHERE
      group_id = g.id), 0)
$$;

GRANT EXECUTE ON FUNCTION project_groups_member_count TO seasketch_user;

-- # Project Participants
-- Add a custom count column

DROP FUNCTION IF EXISTS projects_participant_count;

CREATE OR REPLACE FUNCTION projects_participant_count (p projects)
  RETURNS int
  LANGUAGE sql
  STABLE
  AS $$
  SELECT
    COALESCE((
      SELECT
        count(*)::int FROM project_participants
    WHERE
      project_id = p.id), 0)
$$;

GRANT EXECUTE ON FUNCTION projects_participant_count TO seasketch_user;

COMMENT ON FUNCTION projects_participant_count IS E'Count of all users who have opted into participating in the project, sharing their profile with project administrators.';

COMMENT ON TABLE "project_participants" IS E'@omit';

-- Custom query to list and sort participants in a project
CREATE OR REPLACE FUNCTION projects_participants (p projects, order_by participant_sort_by DEFAULT 'NAME', direction sort_by_direction DEFAULT 'ASC')
  RETURNS SETOF users
  AS $$
  SELECT
    users.*
  FROM
    users
    INNER JOIN project_participants ON (project_participants.user_id = users.id)
    INNER JOIN user_profiles ON (user_profiles.user_id = users.id)
  WHERE
    project_participants.project_id = p.id
  ORDER BY
    CASE WHEN direction = 'ASC' THEN
      CASE order_by
      WHEN 'NAME' THEN
        user_profiles.fullname
      WHEN 'EMAIL' THEN
        user_profiles.email
      END
    END ASC,
    CASE WHEN direction = 'DESC' THEN
      CASE order_by
      WHEN 'NAME' THEN
        user_profiles.fullname
      WHEN 'EMAIL' THEN
        user_profiles.email
      END
    END DESC
$$
LANGUAGE sql
STABLE;

GRANT EXECUTE ON FUNCTION projects_participants (projects, participant_sort_by, sort_by_direction) TO seasketch_user;

COMMENT ON FUNCTION projects_participants IS E'@simpleCollections only\nAll users who have opted into participating in the project, sharing their profile with project administrators.';

CREATE OR REPLACE FUNCTION users_is_admin (u users, project_id int)
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
      AND project_participants.project_id = project_id);
END
$$;

-- TODO: will need RBAC to enforce limitation to the current project
GRANT EXECUTE ON FUNCTION users_is_admin TO seasketch_user;
