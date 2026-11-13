--! Previous: sha1:986896581bd028cf7ac5a35ff3f9d67d388ed3a5
--! Hash: sha1:ea5df722213b0672c01c7cbaaba352b1d84fb4df
--! Message: Let admins update the project contact email

-- Project admins can correct the contact address that was copied from the
-- creator's account email at project creation. PostGraphile only exposes
-- columns in ProjectPatch when seasketch_user has UPDATE, and row security
-- already limits that update to project admins (and superusers, who pass
-- session_is_admin).

comment on column public.projects.support_email is
  'Inbox for questions about this project. Shown when access is denied or pending, included in invitation emails, and offered as the project administrator contact. This is not the SeaSketch software support address.';

grant update (support_email) on table public.projects to seasketch_user;

alter table public.projects drop constraint if exists support_email_format;
alter table public.projects
  add constraint support_email_format
  check (support_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
