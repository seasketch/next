-- Curated rows for the golden snapshot. Applied only while building the dump,
-- never against a developer's existing database.
--
-- e2e|member and e2e|admin exist in no Auth0 tenant; automated tests sign in as
-- them later through E2E_TEST_MODE. e2e|member is not a participant of
-- demo-samoa. The forum journey joins that project in the browser, then
-- leaves its reply in place. The next run restores a fresh snapshot.
--
-- Replica role skips the user-insert trigger that would queue a verification
-- email. These accounts are not people, and the snapshot should not contain jobs.

set session_replication_role = replica;

insert into users (sub, canonical_email) values
  ('e2e|member', 'member@example.test'),
  ('e2e|admin', 'admin@example.test')
on conflict (sub) do nothing;

set session_replication_role = default;

-- The replica insert above skips auto_create_profile. Join Project updates this
-- row, and an update with no row matches nothing.
insert into user_profiles (user_id)
select u.id
from users u
where u.sub in ('e2e|member', 'e2e|admin')
  and not exists (
    select 1 from user_profiles up where up.user_id = u.id
  );

-- Fixture projects are created by e2e|admin through create_project, the same
-- function the new-project form calls, so they get the creator's admin
-- membership, default basemaps, and default report that every real project
-- starts with.
select
  set_config('session.user_id', (select id::text from users where sub = 'e2e|admin'), false),
  set_config('session.canonical_email', 'admin@example.test', false),
  set_config('session.email_verified', 'true', false);

select create_project(v.name, v.slug)
from (values
  ('Demo Samoa', 'demo-samoa'),
  ('E2E Private', 'e2e-private'),
  ('Maldives Demo', 'demo-maldives'),
  ('Demo Palawan', 'demo-palawan')
) as v(name, slug)
where not exists (select 1 from projects p where p.slug = v.slug);

-- create_project starts every project unlisted and admin-only.
-- demo-maldives is the public ocean-use survey example.
-- demo-palawan is the single-sector coral survey example.
update projects
set is_listed = true, access_control = 'public'
where slug in ('demo-samoa', 'demo-maldives', 'demo-palawan');

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

-- create_forum_acl makes a new forum public to read and to post. The topic
-- is what an anonymous visitor opens. e2e|member joins before they can reply.
insert into forums (project_id, name)
select p.id, 'Public Forum'
from projects p
where p.slug = 'demo-samoa'
  and not exists (
    select 1 from forums f where f.project_id = p.id and f.name = 'Public Forum'
  );

insert into topics (title, forum_id, author_id)
select 'Welcome to the project', f.id, u.id
from forums f
join projects p on p.id = f.project_id
join users u on u.sub = 'e2e|admin'
where p.slug = 'demo-samoa'
  and f.name = 'Public Forum'
  and not exists (
    select 1 from topics t
    where t.forum_id = f.id and t.title = 'Welcome to the project'
  );

insert into posts (topic_id, author_id, message_contents, html)
select
  t.id,
  u.id,
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"This forum is open for anyone who has joined the project."}]}]}'::jsonb,
  '<p>This forum is open for anyone who has joined the project.</p>'
from topics t
join forums f on f.id = t.forum_id
join projects p on p.id = f.project_id
join users u on u.sub = 'e2e|admin'
where p.slug = 'demo-samoa'
  and f.name = 'Public Forum'
  and t.title = 'Welcome to the project'
  and not exists (select 1 from posts po where po.topic_id = t.id);

-- The survey Basic Template is created by a migration with no appearance.
-- Production sets the welcome page in the superuser survey editor, and new
-- surveys copy those columns. A migration must not write them: production
-- already has its own copy. This is the production welcome page
-- (survey 13, form element 23). Later pages stay unstyled and inherit it.
update form_elements fe
set
  background_color = 'rgb(29, 72, 84)',
  secondary_color = 'rgb(211, 217, 219)',
  background_image = 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?ixid=MnwyNjEyMzN8MHwxfHNlYXJjaHwzfHxPQ2VhbnxlbnwwfHx8fDE2Mzk1OTE4NDA&ixlib=rb-1.2.1',
  background_palette = array[
    'rgb(29, 72, 84)',
    'rgb(211, 217, 219)',
    'rgb(62, 105, 120)',
    'rgb(95, 134, 151)',
    'rgb(146, 172, 184)',
    'rgb(132, 156, 172)',
    'rgb(74, 116, 116)',
    'rgb(52, 112, 140)',
    'rgb(142, 164, 161)',
    'rgb(52, 124, 148)'
  ]::text[],
  background_width = 6000,
  background_height = 4000,
  layout = 'TOP',
  text_variant = 'DYNAMIC',
  unsplash_author_name = 'Matt Hardy',
  unsplash_author_url = 'https://unsplash.com/@matthardy'
from forms f
where fe.form_id = f.id
  and f.template_name = 'Basic Template'
  and f.template_type = 'SURVEYS'
  and fe.type_id = 'WelcomeMessage';
