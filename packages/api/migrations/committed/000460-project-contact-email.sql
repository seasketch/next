--! Previous: sha1:379a46ca6f4c70925dc45522d4217dd50798f095
--! Hash: sha1:8c2dd32d04257865407a51a15ae8b9440023801c
--! Message: project contact email

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
