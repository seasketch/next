-- Curated rows for the golden snapshot. Applied only while building the dump,
-- never against a developer's existing database.
--
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

set session_replication_role = default;

-- Fixture projects are created by e2e|admin through create_project, the same
-- function the new-project form calls, so they get the creator's admin
-- membership, default basemaps, and default report that every real project
-- starts with.
select
  set_config('session.user_id', (select id::text from users where sub = 'e2e|admin'), false),
  set_config('session.canonical_email', 'admin@example.test', false),
  set_config('session.email_verified', 'true', false);

select create_project(v.name, v.slug)
from (values ('Demo Samoa', 'demo-samoa'), ('E2E Private', 'e2e-private')) as v(name, slug)
where not exists (select 1 from projects p where p.slug = v.slug);

-- create_project starts every project unlisted and admin-only.
update projects
set is_listed = true, access_control = 'public'
where slug = 'demo-samoa';

update projects
set access_control = 'invite_only'
where slug = 'e2e-private';

-- The Supported Languages switch calls toggle_language_support. English is
-- always available and is not stored in this array.
set role seasketch_superuser;
select toggle_language_support('demo-samoa', 'sm', true);
reset role;

-- e2e-private is unlisted and invite-only. Group membership does not grant
-- project entry, so e2e|member is an approved participant and not an admin.
-- The forum they can see is the one whose read list is their group. An
-- admins-only forum in the same project stays hidden.
insert into project_participants (user_id, project_id, is_admin, approved, share_profile)
select u.id, p.id, false, true, true
from users u
join projects p on p.slug = 'e2e-private'
where u.sub = 'e2e|member'
on conflict on constraint project_participants_pkey do nothing;

insert into project_groups (project_id, name)
select p.id, 'Members'
from projects p
where p.slug = 'e2e-private'
  and not exists (
    select 1 from project_groups g
    where g.project_id = p.id and g.name = 'Members'
  );

insert into project_group_members (group_id, user_id)
select g.id, u.id
from project_groups g
join projects p on p.id = g.project_id
join users u on u.sub = 'e2e|member'
where p.slug = 'e2e-private'
  and g.name = 'Members'
on conflict on constraint project_group_members_pkey do nothing;

insert into forums (project_id, name)
select p.id, forum.name
from projects p
cross join (values ('Members Forum'), ('Admins Forum')) as forum(name)
where p.slug = 'e2e-private'
  and not exists (
    select 1 from forums f where f.project_id = p.id and f.name = forum.name
  );

update access_control_lists acl
set type = 'group'
from forums f
join projects p on p.id = f.project_id
where p.slug = 'e2e-private'
  and f.name = 'Members Forum'
  and acl.forum_id_read = f.id;

update access_control_lists acl
set type = 'admins_only'
from forums f
join projects p on p.id = f.project_id
where p.slug = 'e2e-private'
  and f.name = 'Admins Forum'
  and acl.forum_id_read = f.id;

insert into access_control_list_groups (access_control_list_id, group_id)
select acl.id, g.id
from access_control_lists acl
join forums f on f.id = acl.forum_id_read
join projects p on p.id = f.project_id
join project_groups g on g.project_id = p.id and g.name = 'Members'
where p.slug = 'e2e-private'
  and f.name = 'Members Forum'
  and not exists (
    select 1 from access_control_list_groups ag
    where ag.access_control_list_id = acl.id and ag.group_id = g.id
  );
