-- Curated rows for the golden snapshot. Applied only while building the dump,
-- never against a developer's existing database.
--
-- Owners are synthetic users. Nobody logs in as them.
-- e2e|member and e2e|admin exist in no Auth0 tenant; automated tests sign in as
-- them later through E2E_TEST_MODE. Journeys must not write to demo-* or superuser.
--
-- Replica role skips the user-insert trigger that would queue a verification
-- email. These accounts are not people, and the snapshot should not contain jobs.

set session_replication_role = replica;

insert into users (sub, canonical_email) values
  ('e2e|member', 'member@example.test'),
  ('e2e|admin', 'admin@example.test')
on conflict (sub) do nothing;

insert into projects (name, slug, creator_id, support_email, is_listed, access_control)
values (
  'Demo Public',
  'demo-public',
  (select id from users where sub = 'seasketch|root'),
  'admin@seasketch.org',
  true,
  'public'
)
on conflict (slug) do nothing;

insert into project_participants (user_id, project_id, is_admin, approved)
select u.id, p.id, true, true
from users u
join projects p on p.slug = 'demo-public'
where u.sub = 'e2e|admin'
on conflict on constraint project_participants_pkey do nothing;

set session_replication_role = default;
