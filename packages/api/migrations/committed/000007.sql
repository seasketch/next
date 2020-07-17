--! Previous: sha1:8ff11d96f9df8bec28d15e9c3e187b10260511d0
--! Hash: sha1:3d65159711ae83ef78f7dd05473065f17db3e757

-- Enter migration here
ALTER TABLE project_participants
  DROP COLUMN IF EXISTS approved;

ALTER TABLE project_participants
  ADD COLUMN approved boolean NOT NULL DEFAULT FALSE;

ALTER TABLE project_participants
  DROP COLUMN IF EXISTS requested_at;

ALTER TABLE project_participants
  ADD COLUMN requested_at timestamp WITH time zone DEFAULT (now() at time zone 'utc');

COMMENT ON COLUMN project_participants.approved IS E'Approval status for projects with access set to invite_only';

ALTER TABLE project_participants
  DROP COLUMN IF EXISTS share_profile;

ALTER TABLE project_participants
  ADD COLUMN share_profile boolean NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN project_participants.share_profile IS E'Whether user profile can be shared with project administrators, and other users if participating in the forum.';

DROP FUNCTION IF EXISTS users_is_approved;

CREATE OR REPLACE FUNCTION users_is_approved (u users, project int)
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
      AND project_participants.approved = TRUE
      AND project_participants.project_id = project);
END
$$;

-- TODO: Limit to admins. Also could a plugin be used to not require the project_id argument?
GRANT EXECUTE ON FUNCTION users_is_approved TO seasketch_user;
