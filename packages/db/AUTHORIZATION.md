# Authentication and Authorization

## Overview

SeaSketch Next's GraphQL API is built upon [postgraphile](https://www.graphile.org/), which auto-generates a GraphQL schema based on the postgres database schema. That means there's no nodejs app with models and controllers that can be used to authenticate users and authorize access to different resources. It all has to be done in the database. While unconventional, this has some major benefits.

  1. There's less mundane work to be done creating and maintaing various CRUD operations for all the application data types.
  2. Authorization is enforced in a single place and at the lowest level of the stack, leaving less surface area for bugs to be introduced.
  3. As the application grows and various microservices are added to support features like email notifications and data export, these services won't need to replicate access control rules.

Authentication and authorization build on PostgreSQL's [role based priviledges](https://www.postgresql.org/docs/12/ddl-priv.html) system and the new(ish) [row security policies](https://www.postgresql.org/docs/12/ddl-rowsecurity.html). These tools control access at the table level for different roles and can even enforce rules at the row-level. Postgraphile inspects these roles to determine what database content should be visible in the GraphQL API, but these rules are also enforced when accessing the database directly as well. Postgraphile include [good documentation](https://www.graphile.org/postgraphile/postgresql-schema-design/#authentication-and-authorization) on how to design a schema using these tools. What follows here are details on how the system is used specifically in SeaSketch Next.

## Authentication

Users are authenticated when they provide bearer tokens using the `Authorization` header. The `/auth-helper` endpoint can be used to generate these tokens using Auth0. During the request, the authentication functions validate the token and populate a few relevant details on the database transaction used in servicing the request.

```sql
set local role = 'seasketch_user'; -- may be "anon", "seasketch_user", or "seasketch_superuser"
set local session.user_id to '1'; -- set to users.id if logged in
set local session.project_id to '1'; -- determined using origin of request or x-ss-slug header
set local session.email_verified to 'true'; -- managed by auth0
```

This process is managed in `src/auth/index`. If accessing the database directly you may set these variables manually to support debugging.

## Policy helper functions

When developing the schema, row level security policies often have to make repeated queries to evaluate whether the current session should have access to a given project resource, or whether they are an admin that should have enhanced priviledges. To reduce boilerplate and the chance of errors there are multiple helper functions that can be used.

#### `has_session()`

Returns true if session variables have been set for a logged-in user. Will return false for anonymous users.

#### `it_me(user_id int)`

Identifies whether the given user_id is the same user as the session. Useful for enforcing policies on user-owned resources.

#### `session_is_admin(project_id int)`

Whether the current user should be able to access admin functions of the given project. Note that this will also return true if the session is a superuser.

#### `session_is_approved_participant(project_id int)`

Project access_control may be set to invite_only, in which case some users may request and then be granted access by an administrator. This function will test for an approved participation request. Note that it does not test the value of projects.access_control, nor does it specially treat administrators, so often it should be combined with `session_is_admin` and other tests.

#### `session_on_acl(acl_id int)`

Given the ID of an access_control_list, it will evaluate whether the current session should have access to a resource. This is used to secure access to protected SketchClasses, Forums, and Surveys. It *will* give special access to administrators and superusers regardless of group membership and access_control_list_type. See the example of a group access control policy below for usage details.

#### Writing custom policies

These policies may not cover all the needs of the application or may not perform adequately in certain situations. When writing custom policy constraints keep in mind that SeaSketch is a complex, multi-tenant system with a variety of access control concerns that need to be carefully controlled. Here are a few details to be mindfull of:

  * Projects may be set to `public`, `invite_only`, or `admins_only`
  * Certain operations, like project creation mutations, should be limited to users with confirmed email addresses.
  * Admins can add users to groups, which control access to resources such as data layers, forums, sketch classes, and surveys. These group names and members are *not intended to be public*. Admins should be free to group troublesome users into an "Assholes" group without consequence.
  * In accordance with PII related legislation such as GDPR, users should have complete control over how their user profiles are shared. Users without a shared profile should not appear to other users, including administrators.

**Comprehensive unit tests should be provided with all schema changes to ensure access control rules are followed.**

## Example policies and scenarios

*Note that these are just examples and have not been tested*.

### Admin editable, publically viewable information

Here's a simple hypothetical case, where administrators may need to create and edit content related to a project, and anyone with access to that project should be able to read it. 

```sql

drop table if exists uploaded_documents;
create table uploaded_documents (
  id int generated by default as identity primary key,
  project_id integer not null unique references projects (id) on delete cascade,
  location text not null
);
create index on uploaded_documents (project_id);

-- Grant access to the table for the relevant roles. Note that this is 
-- insufficient but still is a necessary step.
grant select on uploaded_documents to anon;
grant all on uploaded_docuemnts to seasketch_user;

-- This will disallow access to everyone until policies are created
alter table uploaded_documents enable row level security;

drop policy if exists uploaded_documents_access on uploaded_documents;
create policy uploaded_documents_access on uploaded_documents 
  for select to anon using (
    -- `using` will be checked whenever selecting these documents
    -- Here we give access if the project is public, if the session is an admin,
    -- or if the session belongs to an approved participant
    exists(
      select
        1
      from 
        projects 
      where 
        projects.project_id = project_id and 
        access_control = 'public'
    ) or 
    session_is_admin(project_id) or 
    session_is_approved_participant(project_id)
  );

drop policy if exists uploaded_documents_admin on uploaded_documents;
create policy uploaded_documents_admin on uploaded_documents 
  for all to seasketch_user using (
    -- again, will apply to select queries
    session_is_admin(project_id)
  ) with check (
    -- `check` will be applied whenever performing an update or insert
    session_is_admin(project_id)
  );

-- Add some smart comments to change the model name in the graphql schema and
-- omit tools to list all documents in the system. Documents will still be
-- accessible via the project.documents relation.
comment on table uploaded_documents is '
@name documents
@omit all
Uploaded documents related to the project are accessible by all members.
'
```

### Content managed by an access control list

A good example of this are Forums. Administrators can create forums and give access to everyone, just admins, or one or more user groups. As this sort of access control is also used in sketch classes, surveys, and table of contents items (data layers). There are some general purpose tables and functions to support this pattern.

```sql
drop table if exists forums;
create table forums (
  id int generated by default as identity primary key,
  project_id integer not null unique references projects (id) on delete cascade,
  name text not null
  -- ...simplified
);
create index on forums (project_id);

-- Add forum model to access_control_lists table
alter table access_control_lists add column forum_id int unique 
  references forums (id) on delete cascade;

-- Update related model constraints. Note you need to make sure not to clobber
-- the checks for other models in the process of adding this new one
alter table access_control_lists add constraint 
  access_control_list_has_related_model check (
    (
        (survey_id is not null)::integer +
        (sketch_class_id is not null)::integer +
        (forum_id is not null)::integer
    ) = 1
  );

-- Add an index to make acl lookups by forum_id efficient
create unique index on access_control_lists (forum_id) 
  where forum_id is not null;

-- Triggers should be added for all models to create acls with defaults
create or replace function create_forum_acl() returns trigger
    security definer
    language plpgsql
    AS $$
begin
  insert into
    access_control_lists(project_id, forum_id, type)
    values(new.project_id, new.id, 'public'::access_control_list_type);
      return new;
end;
$$;

-- Enable the trigger function
create trigger trig_create_forum_acl after insert on forums 
  for each row execute function create_forum_acl();

-- Now start setting up security policies

grant select on forums to anon;
grant all on forums to seasketch_user;

alter table forums enable row level security;

drop policy if exists forums_access on forums;
create policy forums_access on forums for select to anon using (
  -- session_on_acl will check the access control list, taking into account 
  -- special priviledges of admins and superusers. Note we need to select the 
  -- acl id
  session_on_acl(
    (select id from access_control_lists where forum_id = forums.id)
  )
);

drop policy if exists forums_admin on forums;
-- Edit only if the session is an admin for the related project
create policy forums_admin on forums for all to seasketch_user 
  using ( session_is_admin(project_id) ) 
  with check ( session_is_admin(project_id) );
```

### Content managed exclusively by individual users

An example of this type of content would be user sketches. They are wholely managed by the user and only accessible to themselves except for special circumstances (sharing in the forum).

```sql
drop table if exists forums;
create table sketches (
  id int generated by default as identity primary key,
  project_id integer not null unique references projects (id) on delete cascade,
  user_id integer not null unique references users (id) on delete cascade,
  name text not null
  -- ...simplified
);
create index on sketches (user_id);
create index on sketches (project_id);

grant all on sketches to seasketch_user;
alter table sketches enable row level security;

-- Owners, and only owners, can see and edit their sketches
create policy sketches_owner on sketches for all to seasketch_user 
  using ( it_me(user_id) ) with check ( it_me(user_id) );
```

To enable the case where a user shares their sketch in the forum there are some special details. We don't want to enable arbitrary listing, just access via the related forum message. We also don't want users editing these sketches after posting. This isn't in the production app yet, but we'd want to do something like the following.

```sql
alter table sketches add column shared boolean default false;

-- Replace the policy with a new one that prevents editing shared sketches
drop policy if exists sketches_owner on sketches;
create policy sketches_owner on sketches for all to seasketch_user 
  using ( it_me(user_id) ) with check ( it_me(user_id) and shared = false );

-- Add a function that copies and shares sketches as part of posting to the 
-- forum ... (not included)

-- Remove the default relation that exposes sketches from a post, since it won't
-- pass rls policies
comment on table message_sketches is '@omit';

-- Add a custom query (https://www.graphile.org/postgraphile/custom-queries/) 
-- to messages that bypasses rls policies via SECURITY DEFINER. Note that this
-- function then needs to perform it's own security checks
create or replace function messages_sketches (message messages)
  returns setof sketches
  language plpgsql
  stable
  security definer
  as $$
    define
      results setof sketches;
    begin
      if session_on_acl(message.forum_id) then
        select * into results from sketches 
          inner join message_sketches where message_id = message.id;
        return results;
      else
        raise exception 'Access denied';
      end if;
    end
  $$;

grant execute on function messages_sketches;
-- Disable pagination since this is a small list
comment on function messages_sketches is '
@simpleCollections only
';
```