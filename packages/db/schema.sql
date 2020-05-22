--
-- PostgreSQL database dump
--

-- Dumped from database version 12.0 (Debian 12.0-2.pgdg100+1)
-- Dumped by pg_dump version 12.0 (Debian 12.0-2.pgdg100+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app_private;


--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry, geography, and raster spatial types and functions';


--
-- Name: access_control_list_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.access_control_list_type AS ENUM (
    'public',
    'admins_only',
    'group'
);


--
-- Name: email; Type: DOMAIN; Schema: public; Owner: -
--

CREATE DOMAIN public.email AS public.citext
	CONSTRAINT email_check CHECK ((VALUE OPERATOR(public.~) '^[a-zA-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'::public.citext));


--
-- Name: participant_sort_by; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.participant_sort_by AS ENUM (
    'NAME',
    'EMAIL'
);


--
-- Name: participation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.participation_status AS ENUM (
    'none',
    'participant',
    'pending_approval'
);


--
-- Name: project_access_control_setting; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_access_control_setting AS ENUM (
    'admins_only',
    'invite_only',
    'public'
);


--
-- Name: sketch_geometry_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sketch_geometry_type AS ENUM (
    'POLYGON',
    'LINESTRING',
    'POINT',
    'COLLECTION'
);


--
-- Name: sort_by_direction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sort_by_direction AS ENUM (
    'ASC',
    'DESC'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: access_control_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_control_lists (
    id integer NOT NULL,
    project_id integer NOT NULL,
    type public.access_control_list_type DEFAULT 'public'::public.access_control_list_type NOT NULL,
    forum_id integer,
    sketch_class_id integer,
    CONSTRAINT access_control_list_has_related_model CHECK (((((sketch_class_id IS NOT NULL))::integer + ((forum_id IS NOT NULL))::integer) = 1))
);


--
-- Name: TABLE access_control_lists; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.access_control_lists IS '@omit all,many
@name acl';


--
-- Name: COLUMN access_control_lists.project_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.access_control_lists.project_id IS '@omit';


--
-- Name: project_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_groups (
    id integer NOT NULL,
    project_id integer NOT NULL,
    name text,
    CONSTRAINT namechk CHECK ((char_length(name) <= 32))
);


--
-- Name: TABLE project_groups; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.project_groups IS '@name groups
@omit all,filter
@simpleCollections only
User groups designated by the project administrators';


--
-- Name: access_control_lists_groups(public.access_control_lists); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.access_control_lists_groups(acl public.access_control_lists) RETURNS SETOF public.project_groups
    LANGUAGE sql STABLE
    AS $$
    select * from project_groups where id in (select group_id from access_control_list_groups where access_control_list_id = acl.id)
  $$;


--
-- Name: FUNCTION access_control_lists_groups(acl public.access_control_lists); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.access_control_lists_groups(acl public.access_control_lists) IS '@simpleCollections only';


--
-- Name: add_group_to_acl(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_group_to_acl("aclId" integer, "groupId" integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      pid int;
    BEGIN
      select project_id into pid from access_control_lists where id = "aclId";
      if session_is_admin(pid) then
        insert into access_control_list_groups (access_control_list_id, group_id) values ("aclId", "groupId");
      else
        raise exception 'Must be an administrator';
      end if;
    END
  $$;


--
-- Name: FUNCTION add_group_to_acl("aclId" integer, "groupId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.add_group_to_acl("aclId" integer, "groupId" integer) IS 'Add a group to a given access control list. Must be an administrator.';


--
-- Name: add_user_to_group(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_user_to_group("groupId" integer, "userId" integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    Declare
      pid int;
    BEGIN
      select project_id into pid from project_groups where id = "groupId";
      IF session_is_admin(pid) or session_is_superuser() THEN
        insert into project_group_members (group_id, user_id) values ("groupId", "userId");
      ELSE
        raise exception 'You must be a project administrator';
      END IF;
    END
  $$;


--
-- Name: FUNCTION add_user_to_group("groupId" integer, "userId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.add_user_to_group("groupId" integer, "userId" integer) IS 'Add the given user to a group. Must be an administrator of the project.';


--
-- Name: add_valid_child_sketch_class(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_valid_child_sketch_class(parent integer, child integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    begin
      if session_is_admin((select project_id from sketch_classes where id = parent)) then
        if exists(select project_id from sketch_classes where id = child and project_id in (select project_id from sketch_classes where id = parent)) then
          insert into sketch_classes_valid_children (parent_id, child_id) values (parent, child);
        else
          raise exception 'Sketch classes must be in the same project.';
        end if;
      else
        raise exception 'Must be an admin for the project.';
      end if;
    end
  $$;


--
-- Name: approve_participant(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_participant("projectId" integer, "userId" integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    BEGIN
      IF session_is_admin("projectId") or session_is_superuser() THEN
        update project_participants set approved = true where user_id = "userId" and project_id = "projectId";
      ELSE
        raise exception 'You must be a project administrator';
      END IF;
    END
  $$;


--
-- Name: FUNCTION approve_participant("projectId" integer, "userId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.approve_participant("projectId" integer, "userId" integer) IS 'For invite_only projects. Approve access request by a user. Must be an administrator of the project.';


--
-- Name: auto_create_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_create_profile() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO
    user_profiles(user_id)
    VALUES(new.id);
      RETURN new;
END;
$$;


--
-- Name: before_sketch_folders_insert_or_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_sketch_folders_insert_or_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    declare
      parent_project_id int;
    begin
      if NEW.folder_id is null and NEW.collection_id is null then
        return NEW;
      else
        if NEW.folder_id is not null then
          select 
            project_id 
          into 
            parent_project_id 
          from 
            sketch_folders 
          where 
            id = NEW.folder_id;
        end if;
        if NEW.collection_id is not null then
          select 
            project_id 
          into 
            parent_project_id 
          from 
            sketch_classes 
          where 
            id in (
              select 
                sketch_class_id 
              from 
                sketches 
              where 
                id = NEW.collection_id
            );
        end if;
        if NEW.project_id is null or NEW.project_id = parent_project_id then
          return NEW;
        else
          raise exception 'project_id of parent does not match % %', NEW.project_id, parent_project_id;
        end if;
      end if;
    end
  $$;


--
-- Name: before_sketch_insert_or_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_sketch_insert_or_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      class_geometry_type sketch_geometry_type;
      allow_multi boolean;
      incoming_geometry_type text;
      new_geometry_type text;
    begin
      select 
        geometry_type, 
        sketch_classes.allow_multi
      into 
        class_geometry_type, 
        allow_multi, 
        incoming_geometry_type 
      from 
        sketch_classes 
      where 
        id = NEW.sketch_class_id;
      if NEW.folder_id is not null and NEW.collection_id is not null then
        raise exception 'Parent cannot be to both folder and collection';
      end if;
      if class_geometry_type = 'COLLECTION' then
        -- geom must be present unless a collection
        if NEW.geom is not null or NEW.user_geom is not null then
          raise exception 'Collections should not have geometry';
        else
          -- no nested collections
          if NEW.collection_id is not null then
            raise exception 'Nested collections are not allowed';
          else
            return NEW;
          end if;
        end if;
      else
        select geometrytype(NEW.geom) into new_geometry_type;
        -- geometry type must match sketch_class.geometry_type and sketch_class.allow_multi
        if (new_geometry_type = class_geometry_type::text) or (allow_multi and new_geometry_type like '%' || class_geometry_type::text) then
          -- if specifying a collection_id, must be in it's valid_children
          if NEW.collection_id is null or not exists(select 1 from sketch_classes_valid_children where parent_id in (select sketch_class_id from sketches where id = NEW.collection_id)) or exists(select 1 from sketch_classes_valid_children where parent_id in (select sketch_class_id from sketches where id = NEW.collection_id) and child_id = NEW.sketch_class_id) then
            return NEW;
          else
            raise exception 'Sketch is not a valid child of collection';
          end if;
        else
          raise exception 'Geometry type does not match sketch class';
        end if;
      end if;
    end
  $$;


--
-- Name: before_valid_children_insert_or_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_valid_children_insert_or_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    declare
      child_geometry_type sketch_geometry_type;
      parent_geometry_type sketch_geometry_type;
    begin
      select geometry_type into parent_geometry_type from sketch_classes where id = NEW.parent_id;
      select geometry_type into child_geometry_type from sketch_classes where id = NEW.child_id;
      if parent_geometry_type = 'COLLECTION'::sketch_geometry_type then
        if child_geometry_type = 'COLLECTION'::sketch_geometry_type then
          raise exception 'Nested collections are not allowed.';
        else
          return NEW;
        end if;
      else
        raise exception 'Valid children can only be specified for collections.';
      end if;
    end
  $$;


--
-- Name: can_digitize(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_digitize(scid integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    with acl as (
      select id, type, project_id from access_control_lists where sketch_class_id = scid
    )
    select 
      (
        exists(select 1 from sketch_classes where id = scid and is_archived = false) and
        exists(select 1 from acl where type = 'public') or 
        (
          exists(select 1 from acl where type = 'group') and 
          current_setting('session.user_id', TRUE) != '' and 
          exists (
            select 1 from access_control_list_groups 
              where access_control_list_id = (select id from acl) and group_id in (
                select group_id from project_group_members where user_id = nullif(current_setting('session.user_id', TRUE), '')::integer
              )
          )
        )
      ) or session_is_admin((select project_id from acl))
  $$;


--
-- Name: create_bbox(public.geometry); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_bbox(geom public.geometry) RETURNS real[]
    LANGUAGE sql IMMUTABLE SECURITY DEFINER
    AS $$
    select array[st_xmin(geom)::real, st_ymin(geom)::real, st_xmax(geom)::real, st_ymax(geom)::real];
  $$;


--
-- Name: create_forum_acl(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_forum_acl() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO
    access_control_lists(project_id, forum_id, type)
    VALUES(new.project_id, new.id, 'public'::access_control_list_type);
      RETURN new;
END;
$$;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    legacy_id text,
    slug character varying(16) NOT NULL,
    access_control public.project_access_control_setting DEFAULT 'admins_only'::public.project_access_control_setting,
    is_listed boolean DEFAULT true,
    logo_url text,
    logo_link text,
    is_featured boolean DEFAULT false,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    CONSTRAINT disallow_unlisted_public_projects CHECK (((access_control <> 'public'::public.project_access_control_setting) OR (is_listed = true))),
    CONSTRAINT projects_logo_link_check CHECK ((logo_link ~* 'https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,255}\.[a-z]{2,9}\y([-a-zA-Z0-9@:%_\+.~#?&//=]*)$'::text)),
    CONSTRAINT projects_logo_url_check CHECK ((logo_url ~* 'https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,255}\.[a-z]{2,9}\y([-a-zA-Z0-9@:%_\+.~#?&//=]*)$'::text))
);


--
-- Name: TABLE projects; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.projects IS '@omit delete';


--
-- Name: COLUMN projects.legacy_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.legacy_id IS '@omit';


--
-- Name: COLUMN projects.slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.slug IS 'Will resolve to https://seasketch.org/{slug}/ and cannot be changed';


--
-- Name: COLUMN projects.logo_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.logo_url IS 'URL referencing an image that will be used to represent the project. Will be displayed at 48x48 pixels';


--
-- Name: COLUMN projects.logo_link; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.logo_link IS 'If a logoUrl is provided, it will link to this url in a new window if provided.';


--
-- Name: COLUMN projects.is_featured; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.is_featured IS 'Featured projects may be given prominent placement on the homepage.';


--
-- Name: COLUMN projects.is_deleted; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.is_deleted IS '@omit';


--
-- Name: COLUMN projects.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.deleted_at IS '@omit';


--
-- Name: create_project(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_project(name text, slug text, OUT project public.projects) RETURNS public.projects
    LANGUAGE plpgsql STRICT SECURITY DEFINER
    AS $$
  begin
    if current_setting('session.email_verified', true) = 'true' then
      insert into projects (name, slug, is_listed) 
        values (name, slug, false) returning * into project;
      insert into project_participants (
        user_id, 
        project_id, 
        is_admin, 
        approved, 
        share_profile
      ) values (
        current_setting('session.user_id', true)::int, 
        project.id, 
        true, 
        true, 
        true
      );
    else
      raise exception 'Email must be verified to create a project';
    end if;
  end
$$;


--
-- Name: FUNCTION create_project(name text, slug text, OUT project public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_project(name text, slug text, OUT project public.projects) IS 'Users with verified emails can create new projects by choosing a unique name and url slug. This project will be unlisted with admin_only access and the user will be automatically added to the list of admins.';


--
-- Name: create_sketch_class_acl(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_sketch_class_acl() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into
    access_control_lists(project_id, sketch_class_id, type)
    values(new.project_id, new.id, 'public'::access_control_list_type);
      return new;
end;
$$;


--
-- Name: current_project(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_project() RETURNS public.projects
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT
    *
  FROM
    projects
  WHERE
    id = nullif (current_setting('session.project_id', TRUE), '')::integer
$$;


--
-- Name: delete_project(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_project(project_id integer, OUT project public.projects) RETURNS public.projects
    LANGUAGE plpgsql STRICT SECURITY DEFINER
    AS $$
  begin
    if is_superuser() or is_admin(project_id, current_setting('session.user_id', true)::int) then
      update projects set deleted_at = now(), is_deleted = true where projects.id = project_id returning * into project;
    else
      raise exception 'You do not administer this project';
    end if;
  end
$$;


--
-- Name: FUNCTION delete_project(project_id integer, OUT project public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.delete_project(project_id integer, OUT project public.projects) IS 'Marks project as deleted. Will remain in database but not accessible to anyone. Function can only be accessed by project administrators.';


--
-- Name: get_or_create_user_by_sub(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_user_by_sub(_sub text, OUT user_id integer) RETURNS integer
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
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
$$;


--
-- Name: FUNCTION get_or_create_user_by_sub(_sub text, OUT user_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_or_create_user_by_sub(_sub text, OUT user_id integer) IS '@omit
Incoming users from Auth0 need to be represented in our database. This function runs whenever a user with an unrecognized token calls the api.';


--
-- Name: get_project_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_project_id(slug text) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT
    id
  FROM
    projects
  WHERE
    projects.slug = slug
  LIMIT 1;

$$;


--
-- Name: FUNCTION get_project_id(slug text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_project_id(slug text) IS '@omit
Enables app to determine current project from url slug or x-ss-slug header';


--
-- Name: grant_admin_access(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_admin_access("projectId" integer, "userId" integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    BEGIN
      IF session_is_admin("projectId") or session_is_superuser() THEN
        IF exists(select 1 from project_participants where user_id = "userId" and project_id = "projectId" and share_profile = true) THEN
          update project_participants set is_admin = true where user_id = "userId" and project_id = "projectId";
        ELSE
          raise exception 'User must join the project and share their user profile first.';
        END IF;
      ELSE
        raise exception 'You must be a project administrator';
      END IF;
    END
  $$;


--
-- Name: FUNCTION grant_admin_access("projectId" integer, "userId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.grant_admin_access("projectId" integer, "userId" integer) IS 'Give a user admin access to a project. User must have already joined the project and shared their user profile.';


--
-- Name: has_session(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_session() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select nullif(current_setting('session.user_id', TRUE), '')::integer is not null
  $$;


--
-- Name: FUNCTION has_session(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.has_session() IS '@omit';


--
-- Name: is_admin(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin(_project_id integer, _user_id integer) RETURNS boolean
    LANGUAGE sql
    AS $$
    select exists (
      select 
        1 
      from 
        project_participants 
      where 
        project_participants.user_id = _user_id and 
        project_participants.project_id = _project_id and 
        project_participants.is_admin = true
    );
$$;


--
-- Name: FUNCTION is_admin(_project_id integer, _user_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_admin(_project_id integer, _user_id integer) IS '@omit';


--
-- Name: is_superuser(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_superuser() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select 'seasketch_superuser' = current_setting('role', true);
$$;


--
-- Name: it_me(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.it_me("userId" integer) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    AS $$
  select nullif(current_setting('session.user_id', TRUE), '')::integer = "userId";
$$;


--
-- Name: FUNCTION it_me("userId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.it_me("userId" integer) IS '@omit';


--
-- Name: join_project(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_project(project_id integer) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    AS $$
    insert into project_participants (user_id, project_id, share_profile) values (current_setting('session.user_id', true)::integer, project_id, true) on conflict on constraint project_participants_pkey do update set share_profile = true;
  $$;


--
-- Name: FUNCTION join_project(project_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.join_project(project_id integer) IS 'Adds current user to the list of participants for a project, sharing their profile with administrators. Their profile will also be shared in public or group discussion forum posts.';


--
-- Name: leave_project(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.leave_project(project_id integer) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    AS $$
    insert into project_participants (user_id, project_id, share_profile) values (current_setting('session.user_id', true)::integer, project_id, false) on conflict on constraint project_participants_pkey do update set share_profile = false;
  $$;


--
-- Name: FUNCTION leave_project(project_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.leave_project(project_id integer) IS 'Approve a user for use of an invite_only project.';


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    legacy_id text,
    sub text,
    registered_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    onboarded timestamp with time zone
);


--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS '@omit all';


--
-- Name: COLUMN users.legacy_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.legacy_id IS '@omit';


--
-- Name: COLUMN users.sub; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.sub IS '@omit';


--
-- Name: COLUMN users.registered_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.registered_at IS '@omit';


--
-- Name: COLUMN users.onboarded; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.onboarded IS 'Indicates whether the user has seen post-registration information. Mostly a tool for the client UI to use if needed.';


--
-- Name: me(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.me() RETURNS public.users
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT
    *
  FROM
    users
  WHERE
    id = nullif (current_setting('session.user_id', TRUE), '')::integer
$$;


--
-- Name: sketch_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sketch_folders (
    id integer NOT NULL,
    name text NOT NULL,
    user_id integer NOT NULL,
    project_id integer NOT NULL,
    folder_id integer,
    collection_id integer,
    CONSTRAINT has_single_or_no_parent_folder_or_collection CHECK (((folder_id = NULL::integer) OR (collection_id = NULL::integer)))
);


--
-- Name: TABLE sketch_folders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sketch_folders IS '
@omit all
';


--
-- Name: COLUMN sketch_folders.project_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketch_folders.project_id IS '@omit many';


--
-- Name: my_folders(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_folders("projectId" integer) RETURNS SETOF public.sketch_folders
    LANGUAGE sql STABLE
    AS $$
    select * from sketch_folders where sketch_folders.project_id = "projectId" and it_me(sketch_folders.user_id);
  $$;


--
-- Name: FUNCTION my_folders("projectId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.my_folders("projectId" integer) IS '@simpleCollections only';


--
-- Name: sketches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sketches (
    id integer NOT NULL,
    name text NOT NULL,
    sketch_class_id integer NOT NULL,
    user_id integer NOT NULL,
    collection_id integer,
    copy_of integer,
    user_geom public.geometry(Geometry,4326),
    geom public.geometry(Geometry,4326),
    bbox real[] GENERATED ALWAYS AS (public.create_bbox(geom)) STORED,
    num_vertices integer GENERATED ALWAYS AS (public.st_npoints(geom)) STORED,
    folder_id integer,
    CONSTRAINT has_single_or_no_parent_folder_or_collection CHECK (((folder_id = NULL::integer) OR (collection_id = NULL::integer)))
);


--
-- Name: TABLE sketches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sketches IS '
@omit many
';


--
-- Name: COLUMN sketches.copy_of; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketches.copy_of IS '@omit create';


--
-- Name: COLUMN sketches.bbox; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketches.bbox IS '@omit create';


--
-- Name: COLUMN sketches.num_vertices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketches.num_vertices IS '@omit create';


--
-- Name: my_sketches(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_sketches("projectId" integer) RETURNS SETOF public.sketches
    LANGUAGE sql STABLE
    AS $$
    select
      *
    from
      sketches
    where
      it_me(user_id) and sketch_class_id in (
        select id from sketch_classes where project_id = "projectId");
  $$;


--
-- Name: FUNCTION my_sketches("projectId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.my_sketches("projectId" integer) IS '@simpleCollections only';


--
-- Name: onboarded(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.onboarded() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF current_setting('session.user_id', true)::int > 0 THEN
    update public.users set onboarded = now() where users.id = current_setting('session.user_id', true)::int;
  else
    raise exception 'session.user_id must be set';
  end if;
END;
$$;


--
-- Name: FUNCTION onboarded(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.onboarded() IS 'Mark that the user represented in the current session has been shown post-user-registration content.';


--
-- Name: project_groups_member_count(public.project_groups); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.project_groups_member_count(g public.project_groups) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
  SELECT
    COALESCE((
      SELECT
        count(*)::int FROM project_group_members
    WHERE
      group_id = g.id), 0)
$$;


--
-- Name: project_groups_members(public.project_groups, public.participant_sort_by, public.sort_by_direction); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.project_groups_members(g public.project_groups, order_by public.participant_sort_by DEFAULT 'NAME'::public.participant_sort_by, direction public.sort_by_direction DEFAULT 'ASC'::public.sort_by_direction) RETURNS SETOF public.users
    LANGUAGE sql STABLE
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
$$;


--
-- Name: FUNCTION project_groups_members(g public.project_groups, order_by public.participant_sort_by, direction public.sort_by_direction); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.project_groups_members(g public.project_groups, order_by public.participant_sort_by, direction public.sort_by_direction) IS '@name members
@simpleCollections only';


--
-- Name: projects_my_folders(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_my_folders(project public.projects) RETURNS SETOF public.sketch_folders
    LANGUAGE sql STABLE
    AS $$
  select my_folders(project.id)
$$;


--
-- Name: FUNCTION projects_my_folders(project public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_my_folders(project public.projects) IS '
@simpleCollections only
List of all folders created by this user.
';


--
-- Name: projects_my_sketches(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_my_sketches(project public.projects) RETURNS SETOF public.sketches
    LANGUAGE sql STABLE
    AS $$
  select my_sketches(project.id)
$$;


--
-- Name: FUNCTION projects_my_sketches(project public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_my_sketches(project public.projects) IS '
@simpleCollections only
A list of all sketches for this project and the current user session
';


--
-- Name: projects_participant_count(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_participant_count(p public.projects) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
  SELECT
    COALESCE((
      SELECT
        count(*)::int FROM project_participants
    WHERE
      project_id = p.id), 0)
$$;


--
-- Name: FUNCTION projects_participant_count(p public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_participant_count(p public.projects) IS 'Count of all users who have opted into participating in the project, sharing their profile with project administrators.';


--
-- Name: projects_participants(public.projects, public.participant_sort_by, public.sort_by_direction); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_participants(p public.projects, order_by public.participant_sort_by DEFAULT 'NAME'::public.participant_sort_by, direction public.sort_by_direction DEFAULT 'ASC'::public.sort_by_direction) RETURNS SETOF public.users
    LANGUAGE sql STABLE
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
$$;


--
-- Name: FUNCTION projects_participants(p public.projects, order_by public.participant_sort_by, direction public.sort_by_direction); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_participants(p public.projects, order_by public.participant_sort_by, direction public.sort_by_direction) IS '@simpleCollections only
All users who have opted into participating in the project, sharing their profile with project administrators.';


--
-- Name: projects_url(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_url(p public.projects) RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT
    'https://seasketch.org/' || p.slug || '/'
$$;


--
-- Name: remove_group_from_acl(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_group_from_acl("aclId" integer, "groupId" integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      pid int;
    BEGIN
      select project_id into pid from access_control_lists where id = "aclId";
      if session_is_admin(pid) then
        delete from access_control_list_groups where access_control_list_id = "aclId" and group_id = "groupId";
      else
        raise exception 'Must be an administrator';
      end if;
    END
  $$;


--
-- Name: FUNCTION remove_group_from_acl("aclId" integer, "groupId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.remove_group_from_acl("aclId" integer, "groupId" integer) IS 'Remove a group from a given access control list. Must be an administrator.';


--
-- Name: remove_user_from_group(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_user_from_group("groupId" integer, "userId" integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    Declare
      pid int;
    BEGIN
      select project_id into pid from project_groups where id = "groupId";
      IF session_is_admin(pid) or session_is_superuser() THEN
        delete from project_group_members where group_id = "groupId" and user_id = "userId";
      ELSE
        raise exception 'You must be a project administrator';
      END IF;
    END
  $$;


--
-- Name: FUNCTION remove_user_from_group("groupId" integer, "userId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.remove_user_from_group("groupId" integer, "userId" integer) IS 'Remove the given user from a group. Must be an administrator of the project.';


--
-- Name: remove_valid_child_sketch_class(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_valid_child_sketch_class(parent integer, child integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    begin
      if session_is_admin((select project_id from sketch_classes where id = parent)) then
        delete from sketch_classes_valid_children where parent_id = parent and child_id = child;
      else
        raise exception 'Must be an admin for the project.';
      end if;
    end
  $$;


--
-- Name: session_has_project_access(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.session_has_project_access(pid integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    -- Here we give access if the project is public, if the session is an admin,
    -- or if the session belongs to an approved participant
    select exists(
      select
        1
      from 
        projects 
      where 
        projects.id = pid and 
        access_control = 'public'
    ) or 
    session_is_admin(pid) or 
    session_is_approved_participant(pid)
  $$;


--
-- Name: FUNCTION session_has_project_access(pid integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.session_has_project_access(pid integer) IS '@omit';


--
-- Name: session_is_admin(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.session_is_admin("projectId" integer) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    AS $$
    select session_is_superuser() or is_admin("projectId", nullif(current_setting('session.user_id', TRUE), '')::integer);
$$;


--
-- Name: FUNCTION session_is_admin("projectId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.session_is_admin("projectId" integer) IS '@omit';


--
-- Name: session_is_approved_participant(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.session_is_approved_participant(pid integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select has_session() and EXISTS (
      SELECT 
        1
      FROM
        project_participants
      WHERE (
        it_me(project_participants.user_id) and
        project_participants.project_id = pid
      ) AND project_participants.approved = TRUE
    )
  $$;


--
-- Name: FUNCTION session_is_approved_participant(pid integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.session_is_approved_participant(pid integer) IS '@omit';


--
-- Name: session_is_superuser(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.session_is_superuser() RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    AS $$
    select is_superuser();
$$;


--
-- Name: FUNCTION session_is_superuser(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.session_is_superuser() IS '@omit';


--
-- Name: session_on_acl(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.session_on_acl(acl_id integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    with acl as (
      select type, project_id from access_control_lists where id = acl_id
    )
    select exists(select 1 from acl where type = 'public') or
    session_is_admin((select project_id from access_control_lists where id = acl_id)) or
    (
      exists(select 1 from acl where type = 'group') and 
      current_setting('session.user_id', TRUE) != '' and 
      exists (
        select 1 from access_control_list_groups 
          where access_control_list_id = acl_id and group_id in (
            select group_id from project_group_members where user_id = nullif(current_setting('session.user_id', TRUE), '')::integer
          )
      )
    )
  $$;


--
-- Name: FUNCTION session_on_acl(acl_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.session_on_acl(acl_id integer) IS '@omit';


--
-- Name: sketch_classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sketch_classes (
    id integer NOT NULL,
    project_id integer NOT NULL,
    name text NOT NULL,
    geometry_type public.sketch_geometry_type DEFAULT 'POLYGON'::public.sketch_geometry_type NOT NULL,
    allow_multi boolean DEFAULT false NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    mapbox_gl_style text,
    is_my_plans_option boolean DEFAULT true NOT NULL,
    geoprocessing_project_url text,
    geoprocessing_client_url text,
    geoprocessing_client_name text,
    CONSTRAINT sketch_classes_geoprocessing_client_url_check CHECK ((geoprocessing_client_url ~* 'https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,255}\.[a-z]{2,9}\y([-a-zA-Z0-9@:%_\+.~#?&//=]*)$'::text)),
    CONSTRAINT sketch_classes_geoprocessing_project_url_check CHECK ((geoprocessing_project_url ~* 'https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,255}\.[a-z]{2,9}\y([-a-zA-Z0-9@:%_\+.~#?&//=]*)$'::text))
);


--
-- Name: TABLE sketch_classes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sketch_classes IS '
@omit all
Sketch Classes act as a schema for sketches drawn by users.
';


--
-- Name: COLUMN sketch_classes.geometry_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketch_classes.geometry_type IS '
Geometry type users digitize. COLLECTION types act as a feature collection and have no drawn geometry.
';


--
-- Name: COLUMN sketch_classes.allow_multi; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketch_classes.allow_multi IS '
If set to try, a geometry_type of POLYGON would allow for both POLYGONs and MULTIPOLYGONs after preprocessing or on spatial file upload. Users will still digitize single features. Note that this feature should be used seldomly, since for planning purposes it is unlikely to have non-contiguous zones.
';


--
-- Name: COLUMN sketch_classes.is_archived; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketch_classes.is_archived IS '
If set to true, (non-admin) users should not be able to digitize new features using this sketch class, but they should still be able to access the sketch class in order to render existing sketches of this type.
';


--
-- Name: COLUMN sketch_classes.mapbox_gl_style; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketch_classes.mapbox_gl_style IS '
Style used to render sketches of this type.
';


--
-- Name: COLUMN sketch_classes.is_my_plans_option; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketch_classes.is_my_plans_option IS '
If set to true, show as an option in the digitizing tools. If set to false, this sketch class may be solely for survey responses.
';


--
-- Name: sketch_classes_can_digitize(public.sketch_classes); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sketch_classes_can_digitize(sketch_class public.sketch_classes) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    select can_digitize(sketch_class.id);
  $$;


--
-- Name: FUNCTION sketch_classes_can_digitize(sketch_class public.sketch_classes); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.sketch_classes_can_digitize(sketch_class public.sketch_classes) IS '
Whether the user is allowed to digitize sketches of this type. Digitizing is controlled by admins via access control lists, and archived sketch classes can only be digitized by admins.
';


--
-- Name: sketch_classes_prohibit_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sketch_classes_prohibit_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      count int;
    begin
      select count(*) into count from sketches where sketch_class_id = OLD.id;
      if count > 10 then
        raise exception 'Has > 10 related sketches. Try archiving instead.';
      else
        return OLD;
      end if;
    end
  $$;


--
-- Name: sketch_classes_sketch_count(public.sketch_classes); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sketch_classes_sketch_count(sketch_class public.sketch_classes) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select count(*) from sketches where sketch_class_id = sketch_class.id
  $$;


--
-- Name: FUNCTION sketch_classes_sketch_count(sketch_class public.sketch_classes); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.sketch_classes_sketch_count(sketch_class public.sketch_classes) IS 'Number of sketches created with this sketch class';


--
-- Name: sketch_classes_valid_children(public.sketch_classes); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sketch_classes_valid_children(sketch_class public.sketch_classes) RETURNS SETOF public.sketch_classes
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select
      sketch_classes.*
    from
      sketch_classes
    where
      id in (
        select 
          child_id 
        from 
          sketch_classes_valid_children 
        where
          parent_id = sketch_class.id
      )
  $$;


--
-- Name: FUNCTION sketch_classes_valid_children(sketch_class public.sketch_classes); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.sketch_classes_valid_children(sketch_class public.sketch_classes) IS '
@simpleCollections only
';


--
-- Name: users_is_admin(public.users, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.users_is_admin(u public.users, project integer) RETURNS boolean
    LANGUAGE plpgsql STABLE
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


--
-- Name: users_is_approved(public.users, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.users_is_approved(u public.users, project integer) RETURNS boolean
    LANGUAGE plpgsql STABLE
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


--
-- Name: users_participation_status(public.users, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.users_participation_status(u public.users, "projectId" integer) RETURNS public.participation_status
    LANGUAGE sql STABLE
    AS $$
  select case when exists(
    select 
      1 
    from 
      project_participants 
    where 
      project_participants.user_id = u.id and 
      project_participants.project_id = "projectId"
  ) then 
    case when exists(
      select
        project_participants.approved,
        projects.access_control
      from 
        project_participants
      inner join
        projects
      on
        project_participants.project_id = projects.id
      where
        project_participants.user_id = u.id and
        project_participants.project_id = "projectId" and
        (project_participants.approved = true or access_control = 'public')
    ) then 
      'participant'::participation_status
    else
      'pending_approval'::participation_status
    end
  else
    'none'::participation_status
  end
$$;


--
-- Name: access_control_list_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_control_list_groups (
    access_control_list_id integer NOT NULL,
    group_id integer NOT NULL
);


--
-- Name: TABLE access_control_list_groups; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.access_control_list_groups IS '@omit';


--
-- Name: access_control_lists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.access_control_lists ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.access_control_lists_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: forums; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forums (
    id integer NOT NULL,
    project_id integer NOT NULL,
    name text NOT NULL
);


--
-- Name: forums_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.forums ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.forums_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: project_group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_group_members (
    group_id integer NOT NULL,
    user_id integer NOT NULL
);


--
-- Name: TABLE project_group_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.project_group_members IS '@omit';


--
-- Name: project_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.project_groups ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.project_groups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: project_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_participants (
    user_id integer NOT NULL,
    project_id integer NOT NULL,
    is_admin boolean DEFAULT false,
    approved boolean DEFAULT false NOT NULL,
    requested_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    share_profile boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE project_participants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.project_participants IS '@omit';


--
-- Name: COLUMN project_participants.approved; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_participants.approved IS 'Approval status for projects with access set to invite_only';


--
-- Name: COLUMN project_participants.share_profile; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_participants.share_profile IS 'Whether user profile can be shared with project administrators, and other users if participating in the forum.';


--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.projects ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.projects_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sketch_classes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.sketch_classes ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.sketch_classes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sketch_classes_valid_children; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sketch_classes_valid_children (
    parent_id integer NOT NULL,
    child_id integer NOT NULL
);


--
-- Name: TABLE sketch_classes_valid_children; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sketch_classes_valid_children IS '@omit';


--
-- Name: sketch_folders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.sketch_folders ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.sketch_folders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sketches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.sketches ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.sketches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    user_id integer NOT NULL,
    fullname text,
    nickname text,
    picture text,
    email public.email,
    affiliations text,
    bio text,
    CONSTRAINT user_profiles_picture_check CHECK ((picture ~* 'https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,255}\.[a-z]{2,9}\y([-a-zA-Z0-9@:%_\+.~#?&//=]*)$'::text))
);


--
-- Name: TABLE user_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_profiles IS '@omit all
@name profile
Personal information that users have contributed. Note that access to PII must be handle carefully to respect sharing preferences';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.users ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: access_control_list_groups access_control_list_groups_access_control_list_id_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_control_list_groups
    ADD CONSTRAINT access_control_list_groups_access_control_list_id_group_id_key UNIQUE (access_control_list_id, group_id);


--
-- Name: access_control_lists access_control_lists_forum_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_control_lists
    ADD CONSTRAINT access_control_lists_forum_id_key UNIQUE (forum_id);


--
-- Name: access_control_lists access_control_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_control_lists
    ADD CONSTRAINT access_control_lists_pkey PRIMARY KEY (id);


--
-- Name: access_control_lists access_control_lists_sketch_class_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_control_lists
    ADD CONSTRAINT access_control_lists_sketch_class_id_key UNIQUE (sketch_class_id);


--
-- Name: forums forums_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forums
    ADD CONSTRAINT forums_pkey PRIMARY KEY (id);


--
-- Name: project_group_members project_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_group_members
    ADD CONSTRAINT project_group_members_pkey PRIMARY KEY (group_id, user_id);


--
-- Name: project_groups project_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_groups
    ADD CONSTRAINT project_groups_pkey PRIMARY KEY (id);


--
-- Name: project_groups project_groups_unique_name_project_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_groups
    ADD CONSTRAINT project_groups_unique_name_project_id UNIQUE (project_id, name);


--
-- Name: project_participants project_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_participants
    ADD CONSTRAINT project_participants_pkey PRIMARY KEY (user_id, project_id);


--
-- Name: projects projects_legacy_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_legacy_id_key UNIQUE (legacy_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: projects projects_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_slug_key UNIQUE (slug);


--
-- Name: sketch_classes sketch_classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketch_classes
    ADD CONSTRAINT sketch_classes_pkey PRIMARY KEY (id);


--
-- Name: sketch_classes sketch_classes_project_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketch_classes
    ADD CONSTRAINT sketch_classes_project_id_name_key UNIQUE (project_id, name);


--
-- Name: CONSTRAINT sketch_classes_project_id_name_key ON sketch_classes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT sketch_classes_project_id_name_key ON public.sketch_classes IS '@omit';


--
-- Name: sketch_classes_valid_children sketch_classes_valid_children_parent_id_child_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketch_classes_valid_children
    ADD CONSTRAINT sketch_classes_valid_children_parent_id_child_id_key UNIQUE (parent_id, child_id);


--
-- Name: sketch_folders sketch_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketch_folders
    ADD CONSTRAINT sketch_folders_pkey PRIMARY KEY (id);


--
-- Name: sketches sketches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketches
    ADD CONSTRAINT sketches_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);


--
-- Name: users users_legacy_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_legacy_id_key UNIQUE (legacy_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_sub_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_sub_key UNIQUE (sub);


--
-- Name: access_control_list_groups_access_control_list_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX access_control_list_groups_access_control_list_id_idx ON public.access_control_list_groups USING btree (access_control_list_id);


--
-- Name: access_control_list_groups_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX access_control_list_groups_group_id_idx ON public.access_control_list_groups USING btree (group_id);


--
-- Name: access_control_lists_forum_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX access_control_lists_forum_id_idx ON public.access_control_lists USING btree (forum_id) WHERE (forum_id IS NOT NULL);


--
-- Name: access_control_lists_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX access_control_lists_project_id_idx ON public.access_control_lists USING btree (project_id);


--
-- Name: access_control_lists_sketch_class_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX access_control_lists_sketch_class_id_idx ON public.access_control_lists USING btree (sketch_class_id) WHERE (sketch_class_id IS NOT NULL);


--
-- Name: forums_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forums_project_id_idx ON public.forums USING btree (project_id);


--
-- Name: project_access_control; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_access_control ON public.projects USING btree (access_control);


--
-- Name: project_group_members_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_group_members_group_id ON public.project_group_members USING btree (group_id);


--
-- Name: project_group_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_group_members_user_id ON public.project_group_members USING btree (user_id);


--
-- Name: project_groups_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_groups_project_id ON public.project_groups USING btree (project_id);


--
-- Name: project_ids; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_ids ON public.projects USING btree (id);


--
-- Name: project_is_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_is_deleted ON public.projects USING btree (is_deleted);


--
-- Name: project_is_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_is_featured ON public.projects USING btree (is_featured);


--
-- Name: project_participants_is_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_participants_is_admin ON public.project_participants USING btree (is_admin);


--
-- Name: project_participants_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_participants_project_id ON public.project_participants USING btree (project_id);


--
-- Name: project_participants_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_participants_user_id ON public.project_participants USING btree (user_id);


--
-- Name: project_slugs; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_slugs ON public.projects USING btree (slug);


--
-- Name: sketch_classes_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sketch_classes_project_id_idx ON public.sketch_classes USING btree (project_id);


--
-- Name: sketch_classes_valid_children_child_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sketch_classes_valid_children_child_id_idx ON public.sketch_classes_valid_children USING btree (child_id);


--
-- Name: sketch_classes_valid_children_parent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sketch_classes_valid_children_parent_id_idx ON public.sketch_classes_valid_children USING btree (parent_id);


--
-- Name: sketch_folders_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sketch_folders_user_id_idx ON public.sketch_folders USING btree (user_id);


--
-- Name: sketch_folders_user_id_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sketch_folders_user_id_project_id_idx ON public.sketch_folders USING btree (user_id, project_id);


--
-- Name: sketches_collection_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sketches_collection_id_idx ON public.sketches USING btree (collection_id);


--
-- Name: sketches_copy_of_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sketches_copy_of_idx ON public.sketches USING btree (copy_of);


--
-- Name: sketches_sketch_class_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sketches_sketch_class_id_idx ON public.sketches USING btree (sketch_class_id);


--
-- Name: sketches_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sketches_user_id_idx ON public.sketches USING btree (user_id);


--
-- Name: sketches_user_id_sketch_class_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sketches_user_id_sketch_class_id_idx ON public.sketches USING btree (user_id, sketch_class_id);


--
-- Name: user_profiles_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_profiles_user_id_idx ON public.user_profiles USING btree (user_id);


--
-- Name: users_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_sub ON public.users USING btree (sub);


--
-- Name: sketch_folders before_sketch_folders_insert_or_update_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_sketch_folders_insert_or_update_trigger BEFORE INSERT OR UPDATE ON public.sketch_folders FOR EACH ROW EXECUTE FUNCTION public.before_sketch_folders_insert_or_update();


--
-- Name: sketches before_sketch_insert_or_update_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_sketch_insert_or_update_trigger BEFORE INSERT OR UPDATE ON public.sketches FOR EACH ROW EXECUTE FUNCTION public.before_sketch_insert_or_update();


--
-- Name: sketch_classes_valid_children before_valid_children_insert_or_update_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_valid_children_insert_or_update_trigger BEFORE INSERT OR UPDATE ON public.sketch_classes_valid_children FOR EACH ROW EXECUTE FUNCTION public.before_valid_children_insert_or_update();


--
-- Name: sketch_classes sketch_classes_prohibit_delete_t; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sketch_classes_prohibit_delete_t BEFORE DELETE ON public.sketch_classes FOR EACH ROW EXECUTE FUNCTION public.sketch_classes_prohibit_delete();


--
-- Name: users trig_auto_create_profile; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trig_auto_create_profile AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.auto_create_profile();


--
-- Name: forums trig_create_forum_acl; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trig_create_forum_acl AFTER INSERT ON public.forums FOR EACH ROW EXECUTE FUNCTION public.create_forum_acl();


--
-- Name: sketch_classes trig_create_sketch_class_acl; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trig_create_sketch_class_acl AFTER INSERT ON public.sketch_classes FOR EACH ROW EXECUTE FUNCTION public.create_sketch_class_acl();


--
-- Name: access_control_list_groups access_control_list_groups_access_control_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_control_list_groups
    ADD CONSTRAINT access_control_list_groups_access_control_list_id_fkey FOREIGN KEY (access_control_list_id) REFERENCES public.access_control_lists(id) ON DELETE CASCADE;


--
-- Name: access_control_list_groups access_control_list_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_control_list_groups
    ADD CONSTRAINT access_control_list_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.project_groups(id) ON DELETE CASCADE;


--
-- Name: access_control_lists access_control_lists_forum_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_control_lists
    ADD CONSTRAINT access_control_lists_forum_id_fkey FOREIGN KEY (forum_id) REFERENCES public.forums(id) ON DELETE CASCADE;


--
-- Name: access_control_lists access_control_lists_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_control_lists
    ADD CONSTRAINT access_control_lists_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: access_control_lists access_control_lists_sketch_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_control_lists
    ADD CONSTRAINT access_control_lists_sketch_class_id_fkey FOREIGN KEY (sketch_class_id) REFERENCES public.sketch_classes(id) ON DELETE CASCADE;


--
-- Name: forums forums_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forums
    ADD CONSTRAINT forums_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_group_members project_group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_group_members
    ADD CONSTRAINT project_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.project_groups(id) ON DELETE CASCADE;


--
-- Name: project_group_members project_group_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_group_members
    ADD CONSTRAINT project_group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_groups project_groups_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_groups
    ADD CONSTRAINT project_groups_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_participants project_participants_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_participants
    ADD CONSTRAINT project_participants_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_participants project_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_participants
    ADD CONSTRAINT project_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sketch_classes sketch_classes_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketch_classes
    ADD CONSTRAINT sketch_classes_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT sketch_classes_project_id_fkey ON sketch_classes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT sketch_classes_project_id_fkey ON public.sketch_classes IS '@simpleCollections only';


--
-- Name: sketch_classes_valid_children sketch_classes_valid_children_child_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketch_classes_valid_children
    ADD CONSTRAINT sketch_classes_valid_children_child_id_fkey FOREIGN KEY (child_id) REFERENCES public.sketch_classes(id) ON DELETE CASCADE;


--
-- Name: sketch_classes_valid_children sketch_classes_valid_children_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketch_classes_valid_children
    ADD CONSTRAINT sketch_classes_valid_children_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.sketch_classes(id) ON DELETE CASCADE;


--
-- Name: sketch_folders sketch_folders_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketch_folders
    ADD CONSTRAINT sketch_folders_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.sketches(id) ON DELETE CASCADE;


--
-- Name: sketch_folders sketch_folders_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketch_folders
    ADD CONSTRAINT sketch_folders_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.sketch_folders(id) ON DELETE CASCADE;


--
-- Name: sketch_folders sketch_folders_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketch_folders
    ADD CONSTRAINT sketch_folders_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: sketch_folders sketch_folders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketch_folders
    ADD CONSTRAINT sketch_folders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sketches sketches_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketches
    ADD CONSTRAINT sketches_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.sketches(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT sketches_collection_id_fkey ON sketches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT sketches_collection_id_fkey ON public.sketches IS '@omit many';


--
-- Name: sketches sketches_copy_of_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketches
    ADD CONSTRAINT sketches_copy_of_fkey FOREIGN KEY (copy_of) REFERENCES public.sketches(id) ON DELETE SET NULL;


--
-- Name: CONSTRAINT sketches_copy_of_fkey ON sketches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT sketches_copy_of_fkey ON public.sketches IS '
@omit many
@fieldName copiedFrom
';


--
-- Name: sketches sketches_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketches
    ADD CONSTRAINT sketches_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.sketch_folders(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT sketches_folder_id_fkey ON sketches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT sketches_folder_id_fkey ON public.sketches IS '@omit many';


--
-- Name: sketches sketches_sketch_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketches
    ADD CONSTRAINT sketches_sketch_class_id_fkey FOREIGN KEY (sketch_class_id) REFERENCES public.sketch_classes(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT sketches_sketch_class_id_fkey ON sketches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT sketches_sketch_class_id_fkey ON public.sketches IS '@omit many';


--
-- Name: sketches sketches_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketches
    ADD CONSTRAINT sketches_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT user_profiles_user_id_fkey ON user_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT user_profiles_user_id_fkey ON public.user_profiles IS '@omit many';


--
-- Name: forums forum_access_admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_access_admins ON public.forums TO seasketch_user USING (public.session_is_admin(project_id)) WITH CHECK (public.session_is_admin(project_id));


--
-- Name: forums forum_access_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_access_select ON public.forums FOR SELECT TO anon USING (public.session_on_acl(( SELECT access_control_lists.id
   FROM public.access_control_lists
  WHERE (access_control_lists.forum_id = forums.id))));


--
-- Name: forums; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forums ENABLE ROW LEVEL SECURITY;

--
-- Name: project_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: project_groups project_groups_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_groups_admin ON public.project_groups USING (public.session_is_admin(project_id)) WITH CHECK (public.session_is_admin(project_id));


--
-- Name: project_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: projects projects_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_select ON public.projects FOR SELECT TO anon USING (((is_deleted = false) AND ((is_listed = true) OR (access_control = 'public'::public.project_access_control_setting) OR (public.session_is_admin(id) OR ((access_control = 'invite_only'::public.project_access_control_setting) AND public.session_is_approved_participant(id))))));


--
-- Name: projects projects_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_update ON public.projects FOR UPDATE TO seasketch_user USING (public.session_is_admin(id)) WITH CHECK (public.session_is_admin(id));


--
-- Name: project_participants select_project_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_project_participants ON public.project_participants USING ((public.it_me(user_id) OR public.session_is_admin(project_id)));


--
-- Name: user_profiles select_user_profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_user_profile ON public.user_profiles FOR SELECT TO seasketch_user USING ((public.it_me(user_id) OR (EXISTS ( SELECT 1
   FROM public.project_participants
  WHERE ((project_participants.user_id = user_profiles.user_id) AND (project_participants.share_profile = true) AND public.session_is_admin(project_participants.project_id))))));


--
-- Name: sketch_classes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sketch_classes ENABLE ROW LEVEL SECURITY;

--
-- Name: sketch_classes sketch_classes_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sketch_classes_admin ON public.sketch_classes USING (public.session_is_admin(project_id)) WITH CHECK (public.session_is_admin(project_id));


--
-- Name: sketch_classes sketch_classes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sketch_classes_select ON public.sketch_classes FOR SELECT USING (public.session_has_project_access(project_id));


--
-- Name: sketch_folders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sketch_folders ENABLE ROW LEVEL SECURITY;

--
-- Name: sketch_folders sketch_folders_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sketch_folders_policy ON public.sketch_folders TO seasketch_user USING (public.it_me(user_id)) WITH CHECK (public.it_me(user_id));


--
-- Name: sketches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sketches ENABLE ROW LEVEL SECURITY;

--
-- Name: sketches sketches_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sketches_delete ON public.sketches FOR DELETE USING (public.it_me(user_id));


--
-- Name: sketches sketches_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sketches_insert ON public.sketches FOR INSERT WITH CHECK ((public.it_me(user_id) AND public.can_digitize(sketch_class_id)));


--
-- Name: sketches sketches_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sketches_select ON public.sketches FOR SELECT USING (public.it_me(user_id));


--
-- Name: sketches sketches_updated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sketches_updated ON public.sketches FOR UPDATE USING (public.it_me(user_id)) WITH CHECK (public.it_me(user_id));


--
-- Name: user_profiles user_profile_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profile_update ON public.user_profiles FOR UPDATE USING (public.it_me(user_id)) WITH CHECK (public.it_me(user_id));


--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: FUNCTION box2d_in(cstring); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.box2d_in(cstring) FROM PUBLIC;


--
-- Name: FUNCTION box2d_out(public.box2d); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.box2d_out(public.box2d) FROM PUBLIC;


--
-- Name: FUNCTION box2df_in(cstring); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.box2df_in(cstring) FROM PUBLIC;


--
-- Name: FUNCTION box2df_out(public.box2df); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.box2df_out(public.box2df) FROM PUBLIC;


--
-- Name: FUNCTION box3d_in(cstring); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.box3d_in(cstring) FROM PUBLIC;


--
-- Name: FUNCTION box3d_out(public.box3d); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.box3d_out(public.box3d) FROM PUBLIC;


--
-- Name: FUNCTION citextin(cstring); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citextin(cstring) FROM PUBLIC;


--
-- Name: FUNCTION citextout(public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citextout(public.citext) FROM PUBLIC;


--
-- Name: FUNCTION citextrecv(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citextrecv(internal) FROM PUBLIC;


--
-- Name: FUNCTION citextsend(public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citextsend(public.citext) FROM PUBLIC;


--
-- Name: FUNCTION texticregexeq(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.texticregexeq(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION geography_analyze(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_analyze(internal) FROM PUBLIC;


--
-- Name: FUNCTION geography_in(cstring, oid, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_in(cstring, oid, integer) FROM PUBLIC;


--
-- Name: FUNCTION geography_out(public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_out(public.geography) FROM PUBLIC;


--
-- Name: FUNCTION geography_recv(internal, oid, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_recv(internal, oid, integer) FROM PUBLIC;


--
-- Name: FUNCTION geography_send(public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_send(public.geography) FROM PUBLIC;


--
-- Name: FUNCTION geography_typmod_in(cstring[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_typmod_in(cstring[]) FROM PUBLIC;


--
-- Name: FUNCTION geography_typmod_out(integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_typmod_out(integer) FROM PUBLIC;


--
-- Name: FUNCTION geometry_analyze(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_analyze(internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_in(cstring); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_in(cstring) FROM PUBLIC;


--
-- Name: FUNCTION geometry_out(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_out(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_recv(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_recv(internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_send(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_send(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_typmod_in(cstring[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_typmod_in(cstring[]) FROM PUBLIC;


--
-- Name: FUNCTION geometry_typmod_out(integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_typmod_out(integer) FROM PUBLIC;


--
-- Name: FUNCTION gidx_in(cstring); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gidx_in(cstring) FROM PUBLIC;


--
-- Name: FUNCTION gidx_out(public.gidx); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gidx_out(public.gidx) FROM PUBLIC;


--
-- Name: FUNCTION spheroid_in(cstring); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.spheroid_in(cstring) FROM PUBLIC;


--
-- Name: FUNCTION spheroid_out(public.spheroid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.spheroid_out(public.spheroid) FROM PUBLIC;


--
-- Name: FUNCTION _postgis_deprecate(oldname text, newname text, version text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._postgis_deprecate(oldname text, newname text, version text) FROM PUBLIC;


--
-- Name: FUNCTION _postgis_index_extent(tbl regclass, col text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._postgis_index_extent(tbl regclass, col text) FROM PUBLIC;


--
-- Name: FUNCTION _postgis_join_selectivity(regclass, text, regclass, text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._postgis_join_selectivity(regclass, text, regclass, text, text) FROM PUBLIC;


--
-- Name: FUNCTION _postgis_pgsql_version(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._postgis_pgsql_version() FROM PUBLIC;


--
-- Name: FUNCTION _postgis_scripts_pgsql_version(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._postgis_scripts_pgsql_version() FROM PUBLIC;


--
-- Name: FUNCTION _postgis_selectivity(tbl regclass, att_name text, geom public.geometry, mode text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._postgis_selectivity(tbl regclass, att_name text, geom public.geometry, mode text) FROM PUBLIC;


--
-- Name: FUNCTION _postgis_stats(tbl regclass, att_name text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._postgis_stats(tbl regclass, att_name text, text) FROM PUBLIC;


--
-- Name: FUNCTION _st_3ddfullywithin(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_3ddfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION _st_3ddwithin(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_3ddwithin(geom1 public.geometry, geom2 public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION _st_3dintersects(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_3dintersects(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION _st_asgml(integer, public.geometry, integer, integer, text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_asgml(integer, public.geometry, integer, integer, text, text) FROM PUBLIC;


--
-- Name: FUNCTION _st_asx3d(integer, public.geometry, integer, integer, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_asx3d(integer, public.geometry, integer, integer, text) FROM PUBLIC;


--
-- Name: FUNCTION _st_bestsrid(public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_bestsrid(public.geography) FROM PUBLIC;


--
-- Name: FUNCTION _st_bestsrid(public.geography, public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_bestsrid(public.geography, public.geography) FROM PUBLIC;


--
-- Name: FUNCTION _st_concavehull(param_inputgeom public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_concavehull(param_inputgeom public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION _st_contains(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_contains(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION _st_containsproperly(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_containsproperly(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION _st_coveredby(geog1 public.geography, geog2 public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_coveredby(geog1 public.geography, geog2 public.geography) FROM PUBLIC;


--
-- Name: FUNCTION _st_coveredby(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_coveredby(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION _st_covers(geog1 public.geography, geog2 public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_covers(geog1 public.geography, geog2 public.geography) FROM PUBLIC;


--
-- Name: FUNCTION _st_covers(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_covers(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION _st_crosses(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_crosses(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION _st_dfullywithin(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_dfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION _st_distancetree(public.geography, public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_distancetree(public.geography, public.geography) FROM PUBLIC;


--
-- Name: FUNCTION _st_distancetree(public.geography, public.geography, double precision, boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_distancetree(public.geography, public.geography, double precision, boolean) FROM PUBLIC;


--
-- Name: FUNCTION _st_distanceuncached(public.geography, public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_distanceuncached(public.geography, public.geography) FROM PUBLIC;


--
-- Name: FUNCTION _st_distanceuncached(public.geography, public.geography, boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_distanceuncached(public.geography, public.geography, boolean) FROM PUBLIC;


--
-- Name: FUNCTION _st_distanceuncached(public.geography, public.geography, double precision, boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_distanceuncached(public.geography, public.geography, double precision, boolean) FROM PUBLIC;


--
-- Name: FUNCTION _st_dwithin(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_dwithin(geom1 public.geometry, geom2 public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION _st_dwithin(geog1 public.geography, geog2 public.geography, tolerance double precision, use_spheroid boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_dwithin(geog1 public.geography, geog2 public.geography, tolerance double precision, use_spheroid boolean) FROM PUBLIC;


--
-- Name: FUNCTION _st_dwithinuncached(public.geography, public.geography, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_dwithinuncached(public.geography, public.geography, double precision) FROM PUBLIC;


--
-- Name: FUNCTION _st_dwithinuncached(public.geography, public.geography, double precision, boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_dwithinuncached(public.geography, public.geography, double precision, boolean) FROM PUBLIC;


--
-- Name: FUNCTION _st_equals(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_equals(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION _st_expand(public.geography, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_expand(public.geography, double precision) FROM PUBLIC;


--
-- Name: FUNCTION _st_geomfromgml(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_geomfromgml(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION _st_intersects(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_intersects(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION _st_linecrossingdirection(line1 public.geometry, line2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_linecrossingdirection(line1 public.geometry, line2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION _st_longestline(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_longestline(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION _st_maxdistance(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_maxdistance(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION _st_orderingequals(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_orderingequals(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION _st_overlaps(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_overlaps(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION _st_pointoutside(public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_pointoutside(public.geography) FROM PUBLIC;


--
-- Name: FUNCTION _st_touches(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_touches(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION _st_voronoi(g1 public.geometry, clip public.geometry, tolerance double precision, return_polygons boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_voronoi(g1 public.geometry, clip public.geometry, tolerance double precision, return_polygons boolean) FROM PUBLIC;


--
-- Name: FUNCTION _st_within(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_within(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: COLUMN access_control_lists.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.access_control_lists TO seasketch_user;


--
-- Name: COLUMN access_control_lists.type; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(type),UPDATE(type) ON TABLE public.access_control_lists TO seasketch_user;


--
-- Name: COLUMN access_control_lists.forum_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(forum_id) ON TABLE public.access_control_lists TO seasketch_user;


--
-- Name: TABLE project_groups; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.project_groups TO seasketch_user;


--
-- Name: FUNCTION access_control_lists_groups(acl public.access_control_lists); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.access_control_lists_groups(acl public.access_control_lists) FROM PUBLIC;
GRANT ALL ON FUNCTION public.access_control_lists_groups(acl public.access_control_lists) TO seasketch_user;


--
-- Name: FUNCTION add_group_to_acl("aclId" integer, "groupId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_group_to_acl("aclId" integer, "groupId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_group_to_acl("aclId" integer, "groupId" integer) TO seasketch_user;


--
-- Name: FUNCTION add_user_to_group("groupId" integer, "userId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_user_to_group("groupId" integer, "userId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_user_to_group("groupId" integer, "userId" integer) TO seasketch_user;


--
-- Name: FUNCTION add_valid_child_sketch_class(parent integer, child integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_valid_child_sketch_class(parent integer, child integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_valid_child_sketch_class(parent integer, child integer) TO seasketch_user;


--
-- Name: FUNCTION addauth(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.addauth(text) FROM PUBLIC;


--
-- Name: FUNCTION addgeometrycolumn(table_name character varying, column_name character varying, new_srid integer, new_type character varying, new_dim integer, use_typmod boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.addgeometrycolumn(table_name character varying, column_name character varying, new_srid integer, new_type character varying, new_dim integer, use_typmod boolean) FROM PUBLIC;


--
-- Name: FUNCTION addgeometrycolumn(schema_name character varying, table_name character varying, column_name character varying, new_srid integer, new_type character varying, new_dim integer, use_typmod boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.addgeometrycolumn(schema_name character varying, table_name character varying, column_name character varying, new_srid integer, new_type character varying, new_dim integer, use_typmod boolean) FROM PUBLIC;


--
-- Name: FUNCTION addgeometrycolumn(catalog_name character varying, schema_name character varying, table_name character varying, column_name character varying, new_srid_in integer, new_type character varying, new_dim integer, use_typmod boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.addgeometrycolumn(catalog_name character varying, schema_name character varying, table_name character varying, column_name character varying, new_srid_in integer, new_type character varying, new_dim integer, use_typmod boolean) FROM PUBLIC;


--
-- Name: FUNCTION approve_participant("projectId" integer, "userId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.approve_participant("projectId" integer, "userId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.approve_participant("projectId" integer, "userId" integer) TO seasketch_user;


--
-- Name: FUNCTION auto_create_profile(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.auto_create_profile() FROM PUBLIC;


--
-- Name: FUNCTION before_sketch_folders_insert_or_update(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_sketch_folders_insert_or_update() FROM PUBLIC;


--
-- Name: FUNCTION before_sketch_insert_or_update(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_sketch_insert_or_update() FROM PUBLIC;


--
-- Name: FUNCTION before_valid_children_insert_or_update(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_valid_children_insert_or_update() FROM PUBLIC;


--
-- Name: FUNCTION box(public.box3d); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.box(public.box3d) FROM PUBLIC;


--
-- Name: FUNCTION box(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.box(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION box2d(public.box3d); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.box2d(public.box3d) FROM PUBLIC;


--
-- Name: FUNCTION box2d(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.box2d(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION box3d(public.box2d); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.box3d(public.box2d) FROM PUBLIC;


--
-- Name: FUNCTION box3d(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.box3d(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION box3dtobox(public.box3d); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.box3dtobox(public.box3d) FROM PUBLIC;


--
-- Name: FUNCTION bytea(public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.bytea(public.geography) FROM PUBLIC;


--
-- Name: FUNCTION bytea(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.bytea(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION can_digitize(scid integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_digitize(scid integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_digitize(scid integer) TO anon;


--
-- Name: FUNCTION checkauth(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.checkauth(text, text) FROM PUBLIC;


--
-- Name: FUNCTION checkauth(text, text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.checkauth(text, text, text) FROM PUBLIC;


--
-- Name: FUNCTION checkauthtrigger(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.checkauthtrigger() FROM PUBLIC;


--
-- Name: FUNCTION citext(boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citext(boolean) FROM PUBLIC;


--
-- Name: FUNCTION citext(character); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citext(character) FROM PUBLIC;


--
-- Name: FUNCTION citext(inet); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citext(inet) FROM PUBLIC;


--
-- Name: FUNCTION citext_cmp(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citext_cmp(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION citext_eq(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citext_eq(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION citext_ge(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citext_ge(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION citext_gt(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citext_gt(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION citext_hash(public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citext_hash(public.citext) FROM PUBLIC;


--
-- Name: FUNCTION citext_hash_extended(public.citext, bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citext_hash_extended(public.citext, bigint) FROM PUBLIC;


--
-- Name: FUNCTION citext_larger(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citext_larger(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION citext_le(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citext_le(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION citext_lt(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citext_lt(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION citext_ne(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citext_ne(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION citext_pattern_cmp(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citext_pattern_cmp(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION citext_pattern_ge(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citext_pattern_ge(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION citext_pattern_gt(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citext_pattern_gt(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION citext_pattern_le(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citext_pattern_le(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION citext_pattern_lt(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citext_pattern_lt(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION citext_smaller(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.citext_smaller(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION contains_2d(public.box2df, public.box2df); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.contains_2d(public.box2df, public.box2df) FROM PUBLIC;


--
-- Name: FUNCTION contains_2d(public.box2df, public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.contains_2d(public.box2df, public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION contains_2d(public.geometry, public.box2df); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.contains_2d(public.geometry, public.box2df) FROM PUBLIC;


--
-- Name: FUNCTION create_bbox(geom public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_bbox(geom public.geometry) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_bbox(geom public.geometry) TO anon;


--
-- Name: FUNCTION create_forum_acl(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_forum_acl() FROM PUBLIC;


--
-- Name: TABLE projects; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.name; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(name) ON TABLE public.projects TO seasketch_superuser;
GRANT UPDATE(name) ON TABLE public.projects TO seasketch_user;


--
-- Name: COLUMN projects.description; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(description) ON TABLE public.projects TO seasketch_superuser;
GRANT UPDATE(description) ON TABLE public.projects TO seasketch_user;


--
-- Name: COLUMN projects.access_control; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(access_control) ON TABLE public.projects TO seasketch_superuser;
GRANT UPDATE(access_control) ON TABLE public.projects TO seasketch_user;


--
-- Name: COLUMN projects.is_listed; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(is_listed) ON TABLE public.projects TO seasketch_superuser;
GRANT UPDATE(is_listed) ON TABLE public.projects TO seasketch_user;


--
-- Name: COLUMN projects.logo_url; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(logo_url) ON TABLE public.projects TO seasketch_superuser;
GRANT UPDATE(logo_url) ON TABLE public.projects TO seasketch_user;


--
-- Name: COLUMN projects.logo_link; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(logo_link) ON TABLE public.projects TO seasketch_superuser;
GRANT UPDATE(logo_link) ON TABLE public.projects TO seasketch_user;


--
-- Name: COLUMN projects.is_featured; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(is_featured) ON TABLE public.projects TO seasketch_superuser;


--
-- Name: FUNCTION create_project(name text, slug text, OUT project public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_project(name text, slug text, OUT project public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_project(name text, slug text, OUT project public.projects) TO seasketch_user;


--
-- Name: FUNCTION create_sketch_class_acl(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_sketch_class_acl() FROM PUBLIC;


--
-- Name: FUNCTION current_project(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.current_project() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_project() TO anon;


--
-- Name: FUNCTION delete_project(project_id integer, OUT project public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_project(project_id integer, OUT project public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_project(project_id integer, OUT project public.projects) TO seasketch_user;


--
-- Name: FUNCTION disablelongtransactions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.disablelongtransactions() FROM PUBLIC;


--
-- Name: FUNCTION dropgeometrycolumn(table_name character varying, column_name character varying); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.dropgeometrycolumn(table_name character varying, column_name character varying) FROM PUBLIC;


--
-- Name: FUNCTION dropgeometrycolumn(schema_name character varying, table_name character varying, column_name character varying); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.dropgeometrycolumn(schema_name character varying, table_name character varying, column_name character varying) FROM PUBLIC;


--
-- Name: FUNCTION dropgeometrycolumn(catalog_name character varying, schema_name character varying, table_name character varying, column_name character varying); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.dropgeometrycolumn(catalog_name character varying, schema_name character varying, table_name character varying, column_name character varying) FROM PUBLIC;


--
-- Name: FUNCTION dropgeometrytable(table_name character varying); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.dropgeometrytable(table_name character varying) FROM PUBLIC;


--
-- Name: FUNCTION dropgeometrytable(schema_name character varying, table_name character varying); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.dropgeometrytable(schema_name character varying, table_name character varying) FROM PUBLIC;


--
-- Name: FUNCTION dropgeometrytable(catalog_name character varying, schema_name character varying, table_name character varying); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.dropgeometrytable(catalog_name character varying, schema_name character varying, table_name character varying) FROM PUBLIC;


--
-- Name: FUNCTION enablelongtransactions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enablelongtransactions() FROM PUBLIC;


--
-- Name: FUNCTION equals(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.equals(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION find_srid(character varying, character varying, character varying); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.find_srid(character varying, character varying, character varying) FROM PUBLIC;


--
-- Name: FUNCTION geog_brin_inclusion_add_value(internal, internal, internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geog_brin_inclusion_add_value(internal, internal, internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geography(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography(bytea) FROM PUBLIC;


--
-- Name: FUNCTION geography(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geography(public.geography, integer, boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography(public.geography, integer, boolean) FROM PUBLIC;


--
-- Name: FUNCTION geography_cmp(public.geography, public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_cmp(public.geography, public.geography) FROM PUBLIC;


--
-- Name: FUNCTION geography_distance_knn(public.geography, public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_distance_knn(public.geography, public.geography) FROM PUBLIC;


--
-- Name: FUNCTION geography_eq(public.geography, public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_eq(public.geography, public.geography) FROM PUBLIC;


--
-- Name: FUNCTION geography_ge(public.geography, public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_ge(public.geography, public.geography) FROM PUBLIC;


--
-- Name: FUNCTION geography_gist_compress(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_gist_compress(internal) FROM PUBLIC;


--
-- Name: FUNCTION geography_gist_consistent(internal, public.geography, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_gist_consistent(internal, public.geography, integer) FROM PUBLIC;


--
-- Name: FUNCTION geography_gist_decompress(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_gist_decompress(internal) FROM PUBLIC;


--
-- Name: FUNCTION geography_gist_distance(internal, public.geography, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_gist_distance(internal, public.geography, integer) FROM PUBLIC;


--
-- Name: FUNCTION geography_gist_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_gist_penalty(internal, internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geography_gist_picksplit(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_gist_picksplit(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geography_gist_same(public.box2d, public.box2d, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_gist_same(public.box2d, public.box2d, internal) FROM PUBLIC;


--
-- Name: FUNCTION geography_gist_union(bytea, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_gist_union(bytea, internal) FROM PUBLIC;


--
-- Name: FUNCTION geography_gt(public.geography, public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_gt(public.geography, public.geography) FROM PUBLIC;


--
-- Name: FUNCTION geography_le(public.geography, public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_le(public.geography, public.geography) FROM PUBLIC;


--
-- Name: FUNCTION geography_lt(public.geography, public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_lt(public.geography, public.geography) FROM PUBLIC;


--
-- Name: FUNCTION geography_overlaps(public.geography, public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_overlaps(public.geography, public.geography) FROM PUBLIC;


--
-- Name: FUNCTION geography_spgist_choose_nd(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_spgist_choose_nd(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geography_spgist_compress_nd(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_spgist_compress_nd(internal) FROM PUBLIC;


--
-- Name: FUNCTION geography_spgist_config_nd(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_spgist_config_nd(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geography_spgist_inner_consistent_nd(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_spgist_inner_consistent_nd(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geography_spgist_leaf_consistent_nd(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_spgist_leaf_consistent_nd(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geography_spgist_picksplit_nd(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography_spgist_picksplit_nd(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geom2d_brin_inclusion_add_value(internal, internal, internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geom2d_brin_inclusion_add_value(internal, internal, internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geom3d_brin_inclusion_add_value(internal, internal, internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geom3d_brin_inclusion_add_value(internal, internal, internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geom4d_brin_inclusion_add_value(internal, internal, internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geom4d_brin_inclusion_add_value(internal, internal, internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry(bytea) FROM PUBLIC;


--
-- Name: FUNCTION geometry(path); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry(path) FROM PUBLIC;


--
-- Name: FUNCTION geometry(point); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry(point) FROM PUBLIC;


--
-- Name: FUNCTION geometry(polygon); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry(polygon) FROM PUBLIC;


--
-- Name: FUNCTION geometry(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry(text) FROM PUBLIC;


--
-- Name: FUNCTION geometry(public.box2d); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry(public.box2d) FROM PUBLIC;


--
-- Name: FUNCTION geometry(public.box3d); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry(public.box3d) FROM PUBLIC;


--
-- Name: FUNCTION geometry(public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry(public.geography) FROM PUBLIC;


--
-- Name: FUNCTION geometry(public.geometry, integer, boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry(public.geometry, integer, boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.geometry(public.geometry, integer, boolean) TO anon;


--
-- Name: FUNCTION geometry_above(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_above(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_below(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_below(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_cmp(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_cmp(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_contained_3d(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_contained_3d(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_contains(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_contains(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_contains_3d(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_contains_3d(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_contains_nd(public.geometry, public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_contains_nd(public.geometry, public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_distance_box(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_distance_box(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_distance_centroid(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_distance_centroid(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_distance_centroid_nd(public.geometry, public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_distance_centroid_nd(public.geometry, public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_distance_cpa(public.geometry, public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_distance_cpa(public.geometry, public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_eq(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_eq(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_ge(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_ge(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_gist_compress_2d(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_gist_compress_2d(internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_gist_compress_nd(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_gist_compress_nd(internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_gist_consistent_2d(internal, public.geometry, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_gist_consistent_2d(internal, public.geometry, integer) FROM PUBLIC;


--
-- Name: FUNCTION geometry_gist_consistent_nd(internal, public.geometry, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_gist_consistent_nd(internal, public.geometry, integer) FROM PUBLIC;


--
-- Name: FUNCTION geometry_gist_decompress_2d(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_gist_decompress_2d(internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_gist_decompress_nd(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_gist_decompress_nd(internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_gist_distance_2d(internal, public.geometry, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_gist_distance_2d(internal, public.geometry, integer) FROM PUBLIC;


--
-- Name: FUNCTION geometry_gist_distance_nd(internal, public.geometry, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_gist_distance_nd(internal, public.geometry, integer) FROM PUBLIC;


--
-- Name: FUNCTION geometry_gist_penalty_2d(internal, internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_gist_penalty_2d(internal, internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_gist_penalty_nd(internal, internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_gist_penalty_nd(internal, internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_gist_picksplit_2d(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_gist_picksplit_2d(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_gist_picksplit_nd(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_gist_picksplit_nd(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_gist_same_2d(geom1 public.geometry, geom2 public.geometry, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_gist_same_2d(geom1 public.geometry, geom2 public.geometry, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_gist_same_nd(public.geometry, public.geometry, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_gist_same_nd(public.geometry, public.geometry, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_gist_union_2d(bytea, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_gist_union_2d(bytea, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_gist_union_nd(bytea, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_gist_union_nd(bytea, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_gt(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_gt(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_hash(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_hash(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_le(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_le(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_left(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_left(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_lt(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_lt(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_overabove(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_overabove(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_overbelow(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_overbelow(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_overlaps(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_overlaps(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_overlaps_3d(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_overlaps_3d(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_overlaps_nd(public.geometry, public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_overlaps_nd(public.geometry, public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_overleft(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_overleft(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_overright(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_overright(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_right(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_right(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_same(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_same(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_same_3d(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_same_3d(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_same_nd(public.geometry, public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_same_nd(public.geometry, public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_sortsupport(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_sortsupport(internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_spgist_choose_2d(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_spgist_choose_2d(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_spgist_choose_3d(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_spgist_choose_3d(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_spgist_choose_nd(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_spgist_choose_nd(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_spgist_compress_2d(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_spgist_compress_2d(internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_spgist_compress_3d(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_spgist_compress_3d(internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_spgist_compress_nd(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_spgist_compress_nd(internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_spgist_config_2d(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_spgist_config_2d(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_spgist_config_3d(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_spgist_config_3d(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_spgist_config_nd(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_spgist_config_nd(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_spgist_inner_consistent_2d(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_spgist_inner_consistent_2d(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_spgist_inner_consistent_3d(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_spgist_inner_consistent_3d(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_spgist_inner_consistent_nd(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_spgist_inner_consistent_nd(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_spgist_leaf_consistent_2d(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_spgist_leaf_consistent_2d(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_spgist_leaf_consistent_3d(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_spgist_leaf_consistent_3d(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_spgist_leaf_consistent_nd(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_spgist_leaf_consistent_nd(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_spgist_picksplit_2d(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_spgist_picksplit_2d(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_spgist_picksplit_3d(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_spgist_picksplit_3d(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_spgist_picksplit_nd(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_spgist_picksplit_nd(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION geometry_within(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_within(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometry_within_nd(public.geometry, public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry_within_nd(public.geometry, public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION geometrytype(public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometrytype(public.geography) FROM PUBLIC;


--
-- Name: FUNCTION geometrytype(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometrytype(public.geometry) FROM PUBLIC;
GRANT ALL ON FUNCTION public.geometrytype(public.geometry) TO anon;


--
-- Name: FUNCTION geomfromewkb(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geomfromewkb(bytea) FROM PUBLIC;


--
-- Name: FUNCTION geomfromewkt(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geomfromewkt(text) FROM PUBLIC;


--
-- Name: FUNCTION get_or_create_user_by_sub(_sub text, OUT user_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_or_create_user_by_sub(_sub text, OUT user_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_or_create_user_by_sub(_sub text, OUT user_id integer) TO anon;


--
-- Name: FUNCTION get_proj4_from_srid(integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_proj4_from_srid(integer) FROM PUBLIC;


--
-- Name: FUNCTION get_project_id(slug text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_project_id(slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_project_id(slug text) TO anon;


--
-- Name: FUNCTION gettransactionid(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gettransactionid() FROM PUBLIC;


--
-- Name: FUNCTION grant_admin_access("projectId" integer, "userId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.grant_admin_access("projectId" integer, "userId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.grant_admin_access("projectId" integer, "userId" integer) TO seasketch_user;


--
-- Name: FUNCTION gserialized_gist_joinsel_2d(internal, oid, internal, smallint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gserialized_gist_joinsel_2d(internal, oid, internal, smallint) FROM PUBLIC;


--
-- Name: FUNCTION gserialized_gist_joinsel_nd(internal, oid, internal, smallint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gserialized_gist_joinsel_nd(internal, oid, internal, smallint) FROM PUBLIC;


--
-- Name: FUNCTION gserialized_gist_sel_2d(internal, oid, internal, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gserialized_gist_sel_2d(internal, oid, internal, integer) FROM PUBLIC;


--
-- Name: FUNCTION gserialized_gist_sel_nd(internal, oid, internal, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gserialized_gist_sel_nd(internal, oid, internal, integer) FROM PUBLIC;


--
-- Name: FUNCTION has_session(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_session() FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_session() TO anon;


--
-- Name: FUNCTION is_admin(_project_id integer, _user_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_admin(_project_id integer, _user_id integer) FROM PUBLIC;


--
-- Name: FUNCTION is_contained_2d(public.box2df, public.box2df); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_contained_2d(public.box2df, public.box2df) FROM PUBLIC;


--
-- Name: FUNCTION is_contained_2d(public.box2df, public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_contained_2d(public.box2df, public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION is_contained_2d(public.geometry, public.box2df); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_contained_2d(public.geometry, public.box2df) FROM PUBLIC;


--
-- Name: FUNCTION is_superuser(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_superuser() FROM PUBLIC;


--
-- Name: FUNCTION it_me("userId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.it_me("userId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.it_me("userId" integer) TO anon;


--
-- Name: FUNCTION join_project(project_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.join_project(project_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.join_project(project_id integer) TO seasketch_user;


--
-- Name: FUNCTION json(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.json(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION jsonb(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.jsonb(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION leave_project(project_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.leave_project(project_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.leave_project(project_id integer) TO seasketch_user;


--
-- Name: FUNCTION lockrow(text, text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lockrow(text, text, text) FROM PUBLIC;


--
-- Name: FUNCTION lockrow(text, text, text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lockrow(text, text, text, text) FROM PUBLIC;


--
-- Name: FUNCTION lockrow(text, text, text, timestamp without time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lockrow(text, text, text, timestamp without time zone) FROM PUBLIC;


--
-- Name: FUNCTION lockrow(text, text, text, text, timestamp without time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lockrow(text, text, text, text, timestamp without time zone) FROM PUBLIC;


--
-- Name: FUNCTION longtransactionsenabled(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.longtransactionsenabled() FROM PUBLIC;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.users TO seasketch_user;


--
-- Name: COLUMN users.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.users TO anon;


--
-- Name: FUNCTION me(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.me() FROM PUBLIC;
GRANT ALL ON FUNCTION public.me() TO anon;


--
-- Name: TABLE sketch_folders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sketch_folders TO seasketch_user;


--
-- Name: FUNCTION my_folders("projectId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_folders("projectId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_folders("projectId" integer) TO seasketch_user;


--
-- Name: FUNCTION st_npoints(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_npoints(public.geometry) FROM PUBLIC;
GRANT ALL ON FUNCTION public.st_npoints(public.geometry) TO anon;


--
-- Name: TABLE sketches; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE ON TABLE public.sketches TO seasketch_user;


--
-- Name: COLUMN sketches.name; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(name) ON TABLE public.sketches TO seasketch_user;


--
-- Name: COLUMN sketches.collection_id; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(collection_id) ON TABLE public.sketches TO seasketch_user;


--
-- Name: COLUMN sketches.user_geom; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(user_geom) ON TABLE public.sketches TO seasketch_user;


--
-- Name: COLUMN sketches.geom; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(geom) ON TABLE public.sketches TO seasketch_user;


--
-- Name: FUNCTION my_sketches("projectId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_sketches("projectId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_sketches("projectId" integer) TO seasketch_user;


--
-- Name: FUNCTION onboarded(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.onboarded() FROM PUBLIC;
GRANT ALL ON FUNCTION public.onboarded() TO seasketch_user;


--
-- Name: FUNCTION overlaps_2d(public.box2df, public.box2df); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.overlaps_2d(public.box2df, public.box2df) FROM PUBLIC;


--
-- Name: FUNCTION overlaps_2d(public.box2df, public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.overlaps_2d(public.box2df, public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION overlaps_2d(public.geometry, public.box2df); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.overlaps_2d(public.geometry, public.box2df) FROM PUBLIC;


--
-- Name: FUNCTION overlaps_geog(public.geography, public.gidx); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.overlaps_geog(public.geography, public.gidx) FROM PUBLIC;


--
-- Name: FUNCTION overlaps_geog(public.gidx, public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.overlaps_geog(public.gidx, public.geography) FROM PUBLIC;


--
-- Name: FUNCTION overlaps_geog(public.gidx, public.gidx); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.overlaps_geog(public.gidx, public.gidx) FROM PUBLIC;


--
-- Name: FUNCTION overlaps_nd(public.geometry, public.gidx); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.overlaps_nd(public.geometry, public.gidx) FROM PUBLIC;


--
-- Name: FUNCTION overlaps_nd(public.gidx, public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.overlaps_nd(public.gidx, public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION overlaps_nd(public.gidx, public.gidx); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.overlaps_nd(public.gidx, public.gidx) FROM PUBLIC;


--
-- Name: FUNCTION path(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.path(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION pgis_asgeobuf_finalfn(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_asgeobuf_finalfn(internal) FROM PUBLIC;


--
-- Name: FUNCTION pgis_asgeobuf_transfn(internal, anyelement); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_asgeobuf_transfn(internal, anyelement) FROM PUBLIC;


--
-- Name: FUNCTION pgis_asgeobuf_transfn(internal, anyelement, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_asgeobuf_transfn(internal, anyelement, text) FROM PUBLIC;


--
-- Name: FUNCTION pgis_asmvt_combinefn(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_asmvt_combinefn(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION pgis_asmvt_deserialfn(bytea, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_asmvt_deserialfn(bytea, internal) FROM PUBLIC;


--
-- Name: FUNCTION pgis_asmvt_finalfn(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_asmvt_finalfn(internal) FROM PUBLIC;


--
-- Name: FUNCTION pgis_asmvt_serialfn(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_asmvt_serialfn(internal) FROM PUBLIC;


--
-- Name: FUNCTION pgis_asmvt_transfn(internal, anyelement); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement) FROM PUBLIC;


--
-- Name: FUNCTION pgis_asmvt_transfn(internal, anyelement, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text) FROM PUBLIC;


--
-- Name: FUNCTION pgis_asmvt_transfn(internal, anyelement, text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text, integer) FROM PUBLIC;


--
-- Name: FUNCTION pgis_asmvt_transfn(internal, anyelement, text, integer, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text, integer, text) FROM PUBLIC;


--
-- Name: FUNCTION pgis_asmvt_transfn(internal, anyelement, text, integer, text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text, integer, text, text) FROM PUBLIC;


--
-- Name: FUNCTION pgis_geometry_accum_transfn(internal, public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_geometry_accum_transfn(internal, public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION pgis_geometry_accum_transfn(internal, public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_geometry_accum_transfn(internal, public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION pgis_geometry_accum_transfn(internal, public.geometry, double precision, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_geometry_accum_transfn(internal, public.geometry, double precision, integer) FROM PUBLIC;


--
-- Name: FUNCTION pgis_geometry_clusterintersecting_finalfn(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_geometry_clusterintersecting_finalfn(internal) FROM PUBLIC;


--
-- Name: FUNCTION pgis_geometry_clusterwithin_finalfn(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_geometry_clusterwithin_finalfn(internal) FROM PUBLIC;


--
-- Name: FUNCTION pgis_geometry_collect_finalfn(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_geometry_collect_finalfn(internal) FROM PUBLIC;


--
-- Name: FUNCTION pgis_geometry_makeline_finalfn(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_geometry_makeline_finalfn(internal) FROM PUBLIC;


--
-- Name: FUNCTION pgis_geometry_polygonize_finalfn(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_geometry_polygonize_finalfn(internal) FROM PUBLIC;


--
-- Name: FUNCTION pgis_geometry_union_finalfn(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgis_geometry_union_finalfn(internal) FROM PUBLIC;


--
-- Name: FUNCTION point(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.point(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION polygon(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.polygon(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION populate_geometry_columns(use_typmod boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.populate_geometry_columns(use_typmod boolean) FROM PUBLIC;


--
-- Name: FUNCTION populate_geometry_columns(tbl_oid oid, use_typmod boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.populate_geometry_columns(tbl_oid oid, use_typmod boolean) FROM PUBLIC;


--
-- Name: FUNCTION postgis_addbbox(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_addbbox(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION postgis_cache_bbox(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_cache_bbox() FROM PUBLIC;


--
-- Name: FUNCTION postgis_constraint_dims(geomschema text, geomtable text, geomcolumn text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_constraint_dims(geomschema text, geomtable text, geomcolumn text) FROM PUBLIC;


--
-- Name: FUNCTION postgis_constraint_srid(geomschema text, geomtable text, geomcolumn text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_constraint_srid(geomschema text, geomtable text, geomcolumn text) FROM PUBLIC;


--
-- Name: FUNCTION postgis_constraint_type(geomschema text, geomtable text, geomcolumn text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_constraint_type(geomschema text, geomtable text, geomcolumn text) FROM PUBLIC;


--
-- Name: FUNCTION postgis_dropbbox(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_dropbbox(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION postgis_extensions_upgrade(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_extensions_upgrade() FROM PUBLIC;


--
-- Name: FUNCTION postgis_full_version(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_full_version() FROM PUBLIC;


--
-- Name: FUNCTION postgis_geos_noop(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_geos_noop(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION postgis_geos_version(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_geos_version() FROM PUBLIC;


--
-- Name: FUNCTION postgis_getbbox(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_getbbox(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION postgis_hasbbox(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_hasbbox(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION postgis_index_supportfn(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_index_supportfn(internal) FROM PUBLIC;


--
-- Name: FUNCTION postgis_lib_build_date(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_lib_build_date() FROM PUBLIC;


--
-- Name: FUNCTION postgis_lib_version(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_lib_version() FROM PUBLIC;


--
-- Name: FUNCTION postgis_libjson_version(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_libjson_version() FROM PUBLIC;


--
-- Name: FUNCTION postgis_liblwgeom_version(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_liblwgeom_version() FROM PUBLIC;


--
-- Name: FUNCTION postgis_libprotobuf_version(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_libprotobuf_version() FROM PUBLIC;


--
-- Name: FUNCTION postgis_libxml_version(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_libxml_version() FROM PUBLIC;


--
-- Name: FUNCTION postgis_noop(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_noop(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION postgis_proj_version(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_proj_version() FROM PUBLIC;


--
-- Name: FUNCTION postgis_scripts_build_date(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_scripts_build_date() FROM PUBLIC;


--
-- Name: FUNCTION postgis_scripts_installed(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_scripts_installed() FROM PUBLIC;


--
-- Name: FUNCTION postgis_scripts_released(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_scripts_released() FROM PUBLIC;


--
-- Name: FUNCTION postgis_svn_version(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_svn_version() FROM PUBLIC;


--
-- Name: FUNCTION postgis_transform_geometry(geom public.geometry, text, text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_transform_geometry(geom public.geometry, text, text, integer) FROM PUBLIC;


--
-- Name: FUNCTION postgis_type_name(geomname character varying, coord_dimension integer, use_new_name boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_type_name(geomname character varying, coord_dimension integer, use_new_name boolean) FROM PUBLIC;


--
-- Name: FUNCTION postgis_typmod_dims(integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_typmod_dims(integer) FROM PUBLIC;


--
-- Name: FUNCTION postgis_typmod_srid(integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_typmod_srid(integer) FROM PUBLIC;


--
-- Name: FUNCTION postgis_typmod_type(integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_typmod_type(integer) FROM PUBLIC;


--
-- Name: FUNCTION postgis_version(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_version() FROM PUBLIC;


--
-- Name: FUNCTION postgis_wagyu_version(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_wagyu_version() FROM PUBLIC;


--
-- Name: FUNCTION project_groups_member_count(g public.project_groups); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.project_groups_member_count(g public.project_groups) FROM PUBLIC;
GRANT ALL ON FUNCTION public.project_groups_member_count(g public.project_groups) TO seasketch_user;


--
-- Name: FUNCTION project_groups_members(g public.project_groups, order_by public.participant_sort_by, direction public.sort_by_direction); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.project_groups_members(g public.project_groups, order_by public.participant_sort_by, direction public.sort_by_direction) FROM PUBLIC;
GRANT ALL ON FUNCTION public.project_groups_members(g public.project_groups, order_by public.participant_sort_by, direction public.sort_by_direction) TO seasketch_user;


--
-- Name: FUNCTION projects_my_folders(project public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_my_folders(project public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_my_folders(project public.projects) TO seasketch_user;


--
-- Name: FUNCTION projects_my_sketches(project public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_my_sketches(project public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_my_sketches(project public.projects) TO seasketch_user;


--
-- Name: FUNCTION projects_participant_count(p public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_participant_count(p public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_participant_count(p public.projects) TO seasketch_user;


--
-- Name: FUNCTION projects_participants(p public.projects, order_by public.participant_sort_by, direction public.sort_by_direction); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_participants(p public.projects, order_by public.participant_sort_by, direction public.sort_by_direction) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_participants(p public.projects, order_by public.participant_sort_by, direction public.sort_by_direction) TO seasketch_user;


--
-- Name: FUNCTION projects_url(p public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_url(p public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_url(p public.projects) TO anon;


--
-- Name: FUNCTION regexp_match(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.regexp_match(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION regexp_match(public.citext, public.citext, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.regexp_match(public.citext, public.citext, text) FROM PUBLIC;


--
-- Name: FUNCTION regexp_matches(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.regexp_matches(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION regexp_matches(public.citext, public.citext, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.regexp_matches(public.citext, public.citext, text) FROM PUBLIC;


--
-- Name: FUNCTION regexp_replace(public.citext, public.citext, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.regexp_replace(public.citext, public.citext, text) FROM PUBLIC;


--
-- Name: FUNCTION regexp_replace(public.citext, public.citext, text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.regexp_replace(public.citext, public.citext, text, text) FROM PUBLIC;


--
-- Name: FUNCTION regexp_split_to_array(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.regexp_split_to_array(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION regexp_split_to_array(public.citext, public.citext, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.regexp_split_to_array(public.citext, public.citext, text) FROM PUBLIC;


--
-- Name: FUNCTION regexp_split_to_table(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.regexp_split_to_table(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION regexp_split_to_table(public.citext, public.citext, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.regexp_split_to_table(public.citext, public.citext, text) FROM PUBLIC;


--
-- Name: FUNCTION remove_group_from_acl("aclId" integer, "groupId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remove_group_from_acl("aclId" integer, "groupId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_group_from_acl("aclId" integer, "groupId" integer) TO seasketch_user;


--
-- Name: FUNCTION remove_user_from_group("groupId" integer, "userId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remove_user_from_group("groupId" integer, "userId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_user_from_group("groupId" integer, "userId" integer) TO seasketch_user;


--
-- Name: FUNCTION remove_valid_child_sketch_class(parent integer, child integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remove_valid_child_sketch_class(parent integer, child integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_valid_child_sketch_class(parent integer, child integer) TO seasketch_user;


--
-- Name: FUNCTION replace(public.citext, public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.replace(public.citext, public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION session_has_project_access(pid integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.session_has_project_access(pid integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.session_has_project_access(pid integer) TO anon;


--
-- Name: FUNCTION session_is_admin("projectId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.session_is_admin("projectId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.session_is_admin("projectId" integer) TO seasketch_user;
GRANT ALL ON FUNCTION public.session_is_admin("projectId" integer) TO anon;


--
-- Name: FUNCTION session_is_approved_participant(pid integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.session_is_approved_participant(pid integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.session_is_approved_participant(pid integer) TO anon;


--
-- Name: FUNCTION session_is_superuser(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.session_is_superuser() FROM PUBLIC;
GRANT ALL ON FUNCTION public.session_is_superuser() TO seasketch_user;


--
-- Name: FUNCTION session_on_acl(acl_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.session_on_acl(acl_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.session_on_acl(acl_id integer) TO anon;


--
-- Name: TABLE sketch_classes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.sketch_classes TO anon;
GRANT INSERT,DELETE ON TABLE public.sketch_classes TO seasketch_user;


--
-- Name: COLUMN sketch_classes.name; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(name) ON TABLE public.sketch_classes TO seasketch_user;


--
-- Name: COLUMN sketch_classes.allow_multi; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(allow_multi) ON TABLE public.sketch_classes TO seasketch_user;


--
-- Name: COLUMN sketch_classes.is_archived; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(is_archived) ON TABLE public.sketch_classes TO seasketch_user;


--
-- Name: COLUMN sketch_classes.mapbox_gl_style; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(mapbox_gl_style) ON TABLE public.sketch_classes TO seasketch_user;


--
-- Name: COLUMN sketch_classes.geoprocessing_project_url; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(geoprocessing_project_url) ON TABLE public.sketch_classes TO seasketch_user;


--
-- Name: COLUMN sketch_classes.geoprocessing_client_url; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(geoprocessing_client_url) ON TABLE public.sketch_classes TO seasketch_user;


--
-- Name: COLUMN sketch_classes.geoprocessing_client_name; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(geoprocessing_client_name) ON TABLE public.sketch_classes TO seasketch_user;


--
-- Name: FUNCTION sketch_classes_can_digitize(sketch_class public.sketch_classes); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sketch_classes_can_digitize(sketch_class public.sketch_classes) FROM PUBLIC;
GRANT ALL ON FUNCTION public.sketch_classes_can_digitize(sketch_class public.sketch_classes) TO anon;


--
-- Name: FUNCTION sketch_classes_prohibit_delete(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sketch_classes_prohibit_delete() FROM PUBLIC;


--
-- Name: FUNCTION sketch_classes_sketch_count(sketch_class public.sketch_classes); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sketch_classes_sketch_count(sketch_class public.sketch_classes) FROM PUBLIC;
GRANT ALL ON FUNCTION public.sketch_classes_sketch_count(sketch_class public.sketch_classes) TO anon;


--
-- Name: FUNCTION sketch_classes_valid_children(sketch_class public.sketch_classes); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sketch_classes_valid_children(sketch_class public.sketch_classes) FROM PUBLIC;
GRANT ALL ON FUNCTION public.sketch_classes_valid_children(sketch_class public.sketch_classes) TO anon;


--
-- Name: FUNCTION split_part(public.citext, public.citext, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.split_part(public.citext, public.citext, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_3dclosestpoint(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_3dclosestpoint(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_3ddfullywithin(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_3ddfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_3ddistance(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_3ddistance(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_3ddwithin(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_3ddwithin(geom1 public.geometry, geom2 public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_3dintersects(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_3dintersects(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_3dlength(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_3dlength(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_3dlineinterpolatepoint(public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_3dlineinterpolatepoint(public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_3dlongestline(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_3dlongestline(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_3dmakebox(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_3dmakebox(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_3dmaxdistance(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_3dmaxdistance(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_3dperimeter(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_3dperimeter(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_3dshortestline(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_3dshortestline(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_addmeasure(public.geometry, double precision, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_addmeasure(public.geometry, double precision, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_addpoint(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_addpoint(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_addpoint(geom1 public.geometry, geom2 public.geometry, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_addpoint(geom1 public.geometry, geom2 public.geometry, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_affine(public.geometry, double precision, double precision, double precision, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_affine(public.geometry, double precision, double precision, double precision, double precision, double precision, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_affine(public.geometry, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_affine(public.geometry, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_angle(line1 public.geometry, line2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_angle(line1 public.geometry, line2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_angle(pt1 public.geometry, pt2 public.geometry, pt3 public.geometry, pt4 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_angle(pt1 public.geometry, pt2 public.geometry, pt3 public.geometry, pt4 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_area(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_area(text) FROM PUBLIC;


--
-- Name: FUNCTION st_area(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_area(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_area(geog public.geography, use_spheroid boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_area(geog public.geography, use_spheroid boolean) FROM PUBLIC;


--
-- Name: FUNCTION st_area2d(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_area2d(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_asbinary(public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asbinary(public.geography) FROM PUBLIC;


--
-- Name: FUNCTION st_asbinary(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asbinary(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_asbinary(public.geography, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asbinary(public.geography, text) FROM PUBLIC;


--
-- Name: FUNCTION st_asbinary(public.geometry, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asbinary(public.geometry, text) FROM PUBLIC;


--
-- Name: FUNCTION st_asencodedpolyline(geom public.geometry, nprecision integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asencodedpolyline(geom public.geometry, nprecision integer) FROM PUBLIC;


--
-- Name: FUNCTION st_asewkb(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asewkb(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_asewkb(public.geometry, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asewkb(public.geometry, text) FROM PUBLIC;


--
-- Name: FUNCTION st_asewkt(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asewkt(text) FROM PUBLIC;


--
-- Name: FUNCTION st_asewkt(public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asewkt(public.geography) FROM PUBLIC;


--
-- Name: FUNCTION st_asewkt(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asewkt(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_asgeojson(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asgeojson(text) FROM PUBLIC;


--
-- Name: FUNCTION st_asgeojson(geog public.geography, maxdecimaldigits integer, options integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asgeojson(geog public.geography, maxdecimaldigits integer, options integer) FROM PUBLIC;


--
-- Name: FUNCTION st_asgeojson(geom public.geometry, maxdecimaldigits integer, options integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asgeojson(geom public.geometry, maxdecimaldigits integer, options integer) FROM PUBLIC;


--
-- Name: FUNCTION st_asgeojson(r record, geom_column text, maxdecimaldigits integer, pretty_bool boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asgeojson(r record, geom_column text, maxdecimaldigits integer, pretty_bool boolean) FROM PUBLIC;


--
-- Name: FUNCTION st_asgml(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asgml(text) FROM PUBLIC;


--
-- Name: FUNCTION st_asgml(geom public.geometry, maxdecimaldigits integer, options integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asgml(geom public.geometry, maxdecimaldigits integer, options integer) FROM PUBLIC;


--
-- Name: FUNCTION st_asgml(geog public.geography, maxdecimaldigits integer, options integer, nprefix text, id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asgml(geog public.geography, maxdecimaldigits integer, options integer, nprefix text, id text) FROM PUBLIC;


--
-- Name: FUNCTION st_asgml(version integer, geog public.geography, maxdecimaldigits integer, options integer, nprefix text, id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asgml(version integer, geog public.geography, maxdecimaldigits integer, options integer, nprefix text, id text) FROM PUBLIC;


--
-- Name: FUNCTION st_asgml(version integer, geom public.geometry, maxdecimaldigits integer, options integer, nprefix text, id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asgml(version integer, geom public.geometry, maxdecimaldigits integer, options integer, nprefix text, id text) FROM PUBLIC;


--
-- Name: FUNCTION st_ashexewkb(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_ashexewkb(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_ashexewkb(public.geometry, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_ashexewkb(public.geometry, text) FROM PUBLIC;


--
-- Name: FUNCTION st_askml(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_askml(text) FROM PUBLIC;


--
-- Name: FUNCTION st_askml(geog public.geography, maxdecimaldigits integer, nprefix text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_askml(geog public.geography, maxdecimaldigits integer, nprefix text) FROM PUBLIC;


--
-- Name: FUNCTION st_askml(geom public.geometry, maxdecimaldigits integer, nprefix text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_askml(geom public.geometry, maxdecimaldigits integer, nprefix text) FROM PUBLIC;


--
-- Name: FUNCTION st_aslatlontext(geom public.geometry, tmpl text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_aslatlontext(geom public.geometry, tmpl text) FROM PUBLIC;


--
-- Name: FUNCTION st_asmvtgeom(geom public.geometry, bounds public.box2d, extent integer, buffer integer, clip_geom boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asmvtgeom(geom public.geometry, bounds public.box2d, extent integer, buffer integer, clip_geom boolean) FROM PUBLIC;


--
-- Name: FUNCTION st_assvg(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_assvg(text) FROM PUBLIC;


--
-- Name: FUNCTION st_assvg(geog public.geography, rel integer, maxdecimaldigits integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_assvg(geog public.geography, rel integer, maxdecimaldigits integer) FROM PUBLIC;


--
-- Name: FUNCTION st_assvg(geom public.geometry, rel integer, maxdecimaldigits integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_assvg(geom public.geometry, rel integer, maxdecimaldigits integer) FROM PUBLIC;


--
-- Name: FUNCTION st_astext(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_astext(text) FROM PUBLIC;


--
-- Name: FUNCTION st_astext(public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_astext(public.geography) FROM PUBLIC;


--
-- Name: FUNCTION st_astext(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_astext(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_astext(public.geography, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_astext(public.geography, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_astext(public.geometry, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_astext(public.geometry, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_astwkb(geom public.geometry, prec integer, prec_z integer, prec_m integer, with_sizes boolean, with_boxes boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_astwkb(geom public.geometry, prec integer, prec_z integer, prec_m integer, with_sizes boolean, with_boxes boolean) FROM PUBLIC;


--
-- Name: FUNCTION st_astwkb(geom public.geometry[], ids bigint[], prec integer, prec_z integer, prec_m integer, with_sizes boolean, with_boxes boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_astwkb(geom public.geometry[], ids bigint[], prec integer, prec_z integer, prec_m integer, with_sizes boolean, with_boxes boolean) FROM PUBLIC;


--
-- Name: FUNCTION st_asx3d(geom public.geometry, maxdecimaldigits integer, options integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asx3d(geom public.geometry, maxdecimaldigits integer, options integer) FROM PUBLIC;


--
-- Name: FUNCTION st_azimuth(geog1 public.geography, geog2 public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_azimuth(geog1 public.geography, geog2 public.geography) FROM PUBLIC;


--
-- Name: FUNCTION st_azimuth(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_azimuth(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_bdmpolyfromtext(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_bdmpolyfromtext(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_bdpolyfromtext(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_bdpolyfromtext(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_boundary(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_boundary(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_boundingdiagonal(geom public.geometry, fits boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_boundingdiagonal(geom public.geometry, fits boolean) FROM PUBLIC;


--
-- Name: FUNCTION st_box2dfromgeohash(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_box2dfromgeohash(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_buffer(text, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_buffer(text, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_buffer(public.geography, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_buffer(public.geography, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_buffer(text, double precision, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_buffer(text, double precision, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_buffer(text, double precision, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_buffer(text, double precision, text) FROM PUBLIC;


--
-- Name: FUNCTION st_buffer(public.geography, double precision, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_buffer(public.geography, double precision, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_buffer(public.geography, double precision, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_buffer(public.geography, double precision, text) FROM PUBLIC;


--
-- Name: FUNCTION st_buffer(geom public.geometry, radius double precision, quadsegs integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_buffer(geom public.geometry, radius double precision, quadsegs integer) FROM PUBLIC;


--
-- Name: FUNCTION st_buffer(geom public.geometry, radius double precision, options text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_buffer(geom public.geometry, radius double precision, options text) FROM PUBLIC;


--
-- Name: FUNCTION st_buildarea(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_buildarea(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_centroid(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_centroid(text) FROM PUBLIC;


--
-- Name: FUNCTION st_centroid(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_centroid(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_centroid(public.geography, use_spheroid boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_centroid(public.geography, use_spheroid boolean) FROM PUBLIC;


--
-- Name: FUNCTION st_chaikinsmoothing(public.geometry, integer, boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_chaikinsmoothing(public.geometry, integer, boolean) FROM PUBLIC;


--
-- Name: FUNCTION st_cleangeometry(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_cleangeometry(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_clipbybox2d(geom public.geometry, box public.box2d); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_clipbybox2d(geom public.geometry, box public.box2d) FROM PUBLIC;


--
-- Name: FUNCTION st_closestpoint(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_closestpoint(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_closestpointofapproach(public.geometry, public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_closestpointofapproach(public.geometry, public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_clusterdbscan(public.geometry, eps double precision, minpoints integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_clusterdbscan(public.geometry, eps double precision, minpoints integer) FROM PUBLIC;


--
-- Name: FUNCTION st_clusterintersecting(public.geometry[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_clusterintersecting(public.geometry[]) FROM PUBLIC;


--
-- Name: FUNCTION st_clusterkmeans(geom public.geometry, k integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_clusterkmeans(geom public.geometry, k integer) FROM PUBLIC;


--
-- Name: FUNCTION st_clusterwithin(public.geometry[], double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_clusterwithin(public.geometry[], double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_collect(public.geometry[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_collect(public.geometry[]) FROM PUBLIC;


--
-- Name: FUNCTION st_collect(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_collect(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_collectionextract(public.geometry, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_collectionextract(public.geometry, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_collectionhomogenize(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_collectionhomogenize(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_combinebbox(public.box2d, public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_combinebbox(public.box2d, public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_combinebbox(public.box3d, public.box3d); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_combinebbox(public.box3d, public.box3d) FROM PUBLIC;


--
-- Name: FUNCTION st_combinebbox(public.box3d, public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_combinebbox(public.box3d, public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_concavehull(param_geom public.geometry, param_pctconvex double precision, param_allow_holes boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_concavehull(param_geom public.geometry, param_pctconvex double precision, param_allow_holes boolean) FROM PUBLIC;


--
-- Name: FUNCTION st_contains(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_contains(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_containsproperly(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_containsproperly(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_convexhull(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_convexhull(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_coorddim(geometry public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_coorddim(geometry public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_coveredby(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_coveredby(text, text) FROM PUBLIC;


--
-- Name: FUNCTION st_coveredby(geog1 public.geography, geog2 public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_coveredby(geog1 public.geography, geog2 public.geography) FROM PUBLIC;


--
-- Name: FUNCTION st_coveredby(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_coveredby(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_covers(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_covers(text, text) FROM PUBLIC;


--
-- Name: FUNCTION st_covers(geog1 public.geography, geog2 public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_covers(geog1 public.geography, geog2 public.geography) FROM PUBLIC;


--
-- Name: FUNCTION st_covers(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_covers(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_cpawithin(public.geometry, public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_cpawithin(public.geometry, public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_crosses(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_crosses(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_curvetoline(geom public.geometry, tol double precision, toltype integer, flags integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_curvetoline(geom public.geometry, tol double precision, toltype integer, flags integer) FROM PUBLIC;


--
-- Name: FUNCTION st_delaunaytriangles(g1 public.geometry, tolerance double precision, flags integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_delaunaytriangles(g1 public.geometry, tolerance double precision, flags integer) FROM PUBLIC;


--
-- Name: FUNCTION st_dfullywithin(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_dfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_difference(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_difference(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_dimension(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_dimension(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_disjoint(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_disjoint(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_distance(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_distance(text, text) FROM PUBLIC;


--
-- Name: FUNCTION st_distance(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_distance(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_distance(geog1 public.geography, geog2 public.geography, use_spheroid boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_distance(geog1 public.geography, geog2 public.geography, use_spheroid boolean) FROM PUBLIC;


--
-- Name: FUNCTION st_distancecpa(public.geometry, public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_distancecpa(public.geometry, public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_distancesphere(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_distancesphere(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_distancespheroid(geom1 public.geometry, geom2 public.geometry, public.spheroid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_distancespheroid(geom1 public.geometry, geom2 public.geometry, public.spheroid) FROM PUBLIC;


--
-- Name: FUNCTION st_dump(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_dump(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_dumppoints(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_dumppoints(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_dumprings(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_dumprings(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_dwithin(text, text, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_dwithin(text, text, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_dwithin(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_dwithin(geom1 public.geometry, geom2 public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_dwithin(geog1 public.geography, geog2 public.geography, tolerance double precision, use_spheroid boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_dwithin(geog1 public.geography, geog2 public.geography, tolerance double precision, use_spheroid boolean) FROM PUBLIC;


--
-- Name: FUNCTION st_endpoint(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_endpoint(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_envelope(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_envelope(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_equals(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_equals(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_estimatedextent(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_estimatedextent(text, text) FROM PUBLIC;


--
-- Name: FUNCTION st_estimatedextent(text, text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_estimatedextent(text, text, text) FROM PUBLIC;


--
-- Name: FUNCTION st_estimatedextent(text, text, text, boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_estimatedextent(text, text, text, boolean) FROM PUBLIC;


--
-- Name: FUNCTION st_expand(public.box2d, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_expand(public.box2d, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_expand(public.box3d, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_expand(public.box3d, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_expand(public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_expand(public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_expand(box public.box2d, dx double precision, dy double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_expand(box public.box2d, dx double precision, dy double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_expand(box public.box3d, dx double precision, dy double precision, dz double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_expand(box public.box3d, dx double precision, dy double precision, dz double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_expand(geom public.geometry, dx double precision, dy double precision, dz double precision, dm double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_expand(geom public.geometry, dx double precision, dy double precision, dz double precision, dm double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_exteriorring(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_exteriorring(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_filterbym(public.geometry, double precision, double precision, boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_filterbym(public.geometry, double precision, double precision, boolean) FROM PUBLIC;


--
-- Name: FUNCTION st_findextent(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_findextent(text, text) FROM PUBLIC;


--
-- Name: FUNCTION st_findextent(text, text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_findextent(text, text, text) FROM PUBLIC;


--
-- Name: FUNCTION st_flipcoordinates(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_flipcoordinates(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_force2d(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_force2d(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_force3d(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_force3d(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_force3dm(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_force3dm(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_force3dz(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_force3dz(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_force4d(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_force4d(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_forcecollection(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_forcecollection(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_forcecurve(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_forcecurve(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_forcepolygonccw(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_forcepolygonccw(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_forcepolygoncw(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_forcepolygoncw(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_forcerhr(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_forcerhr(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_forcesfs(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_forcesfs(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_forcesfs(public.geometry, version text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_forcesfs(public.geometry, version text) FROM PUBLIC;


--
-- Name: FUNCTION st_frechetdistance(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_frechetdistance(geom1 public.geometry, geom2 public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_generatepoints(area public.geometry, npoints integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_generatepoints(area public.geometry, npoints integer) FROM PUBLIC;


--
-- Name: FUNCTION st_generatepoints(area public.geometry, npoints integer, seed integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_generatepoints(area public.geometry, npoints integer, seed integer) FROM PUBLIC;


--
-- Name: FUNCTION st_geogfromtext(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geogfromtext(text) FROM PUBLIC;


--
-- Name: FUNCTION st_geogfromwkb(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geogfromwkb(bytea) FROM PUBLIC;


--
-- Name: FUNCTION st_geographyfromtext(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geographyfromtext(text) FROM PUBLIC;


--
-- Name: FUNCTION st_geohash(geog public.geography, maxchars integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geohash(geog public.geography, maxchars integer) FROM PUBLIC;


--
-- Name: FUNCTION st_geohash(geom public.geometry, maxchars integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geohash(geom public.geometry, maxchars integer) FROM PUBLIC;


--
-- Name: FUNCTION st_geomcollfromtext(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geomcollfromtext(text) FROM PUBLIC;


--
-- Name: FUNCTION st_geomcollfromtext(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geomcollfromtext(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_geomcollfromwkb(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geomcollfromwkb(bytea) FROM PUBLIC;


--
-- Name: FUNCTION st_geomcollfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geomcollfromwkb(bytea, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_geometricmedian(g public.geometry, tolerance double precision, max_iter integer, fail_if_not_converged boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geometricmedian(g public.geometry, tolerance double precision, max_iter integer, fail_if_not_converged boolean) FROM PUBLIC;


--
-- Name: FUNCTION st_geometryfromtext(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geometryfromtext(text) FROM PUBLIC;


--
-- Name: FUNCTION st_geometryfromtext(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geometryfromtext(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_geometryn(public.geometry, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geometryn(public.geometry, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_geometrytype(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geometrytype(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_geomfromewkb(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geomfromewkb(bytea) FROM PUBLIC;


--
-- Name: FUNCTION st_geomfromewkt(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geomfromewkt(text) FROM PUBLIC;


--
-- Name: FUNCTION st_geomfromgeohash(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geomfromgeohash(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_geomfromgeojson(json); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geomfromgeojson(json) FROM PUBLIC;


--
-- Name: FUNCTION st_geomfromgeojson(jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geomfromgeojson(jsonb) FROM PUBLIC;


--
-- Name: FUNCTION st_geomfromgeojson(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geomfromgeojson(text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.st_geomfromgeojson(text) TO anon;


--
-- Name: FUNCTION st_geomfromgml(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geomfromgml(text) FROM PUBLIC;


--
-- Name: FUNCTION st_geomfromgml(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geomfromgml(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_geomfromkml(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geomfromkml(text) FROM PUBLIC;


--
-- Name: FUNCTION st_geomfromtext(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geomfromtext(text) FROM PUBLIC;


--
-- Name: FUNCTION st_geomfromtext(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geomfromtext(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_geomfromtwkb(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geomfromtwkb(bytea) FROM PUBLIC;


--
-- Name: FUNCTION st_geomfromwkb(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geomfromwkb(bytea) FROM PUBLIC;


--
-- Name: FUNCTION st_geomfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geomfromwkb(bytea, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_gmltosql(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_gmltosql(text) FROM PUBLIC;


--
-- Name: FUNCTION st_gmltosql(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_gmltosql(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_hasarc(geometry public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_hasarc(geometry public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_hausdorffdistance(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_hausdorffdistance(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_hausdorffdistance(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_hausdorffdistance(geom1 public.geometry, geom2 public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_interiorringn(public.geometry, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_interiorringn(public.geometry, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_interpolatepoint(line public.geometry, point public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_interpolatepoint(line public.geometry, point public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_intersection(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_intersection(text, text) FROM PUBLIC;


--
-- Name: FUNCTION st_intersection(public.geography, public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_intersection(public.geography, public.geography) FROM PUBLIC;


--
-- Name: FUNCTION st_intersection(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_intersection(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_intersects(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_intersects(text, text) FROM PUBLIC;


--
-- Name: FUNCTION st_intersects(geog1 public.geography, geog2 public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_intersects(geog1 public.geography, geog2 public.geography) FROM PUBLIC;


--
-- Name: FUNCTION st_intersects(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_intersects(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_isclosed(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_isclosed(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_iscollection(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_iscollection(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_isempty(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_isempty(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_ispolygonccw(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_ispolygonccw(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_ispolygoncw(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_ispolygoncw(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_isring(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_isring(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_issimple(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_issimple(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_isvalid(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_isvalid(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_isvalid(public.geometry, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_isvalid(public.geometry, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_isvaliddetail(geom public.geometry, flags integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_isvaliddetail(geom public.geometry, flags integer) FROM PUBLIC;


--
-- Name: FUNCTION st_isvalidreason(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_isvalidreason(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_isvalidreason(public.geometry, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_isvalidreason(public.geometry, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_isvalidtrajectory(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_isvalidtrajectory(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_length(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_length(text) FROM PUBLIC;


--
-- Name: FUNCTION st_length(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_length(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_length(geog public.geography, use_spheroid boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_length(geog public.geography, use_spheroid boolean) FROM PUBLIC;


--
-- Name: FUNCTION st_length2d(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_length2d(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_length2dspheroid(public.geometry, public.spheroid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_length2dspheroid(public.geometry, public.spheroid) FROM PUBLIC;


--
-- Name: FUNCTION st_lengthspheroid(public.geometry, public.spheroid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_lengthspheroid(public.geometry, public.spheroid) FROM PUBLIC;


--
-- Name: FUNCTION st_linecrossingdirection(line1 public.geometry, line2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_linecrossingdirection(line1 public.geometry, line2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_linefromencodedpolyline(txtin text, nprecision integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_linefromencodedpolyline(txtin text, nprecision integer) FROM PUBLIC;


--
-- Name: FUNCTION st_linefrommultipoint(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_linefrommultipoint(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_linefromtext(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_linefromtext(text) FROM PUBLIC;


--
-- Name: FUNCTION st_linefromtext(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_linefromtext(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_linefromwkb(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_linefromwkb(bytea) FROM PUBLIC;


--
-- Name: FUNCTION st_linefromwkb(bytea, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_linefromwkb(bytea, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_lineinterpolatepoint(public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_lineinterpolatepoint(public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_lineinterpolatepoints(public.geometry, double precision, repeat boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_lineinterpolatepoints(public.geometry, double precision, repeat boolean) FROM PUBLIC;


--
-- Name: FUNCTION st_linelocatepoint(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_linelocatepoint(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_linemerge(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_linemerge(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_linestringfromwkb(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_linestringfromwkb(bytea) FROM PUBLIC;


--
-- Name: FUNCTION st_linestringfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_linestringfromwkb(bytea, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_linesubstring(public.geometry, double precision, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_linesubstring(public.geometry, double precision, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_linetocurve(geometry public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_linetocurve(geometry public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_locatealong(geometry public.geometry, measure double precision, leftrightoffset double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_locatealong(geometry public.geometry, measure double precision, leftrightoffset double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_locatebetween(geometry public.geometry, frommeasure double precision, tomeasure double precision, leftrightoffset double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_locatebetween(geometry public.geometry, frommeasure double precision, tomeasure double precision, leftrightoffset double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_locatebetweenelevations(geometry public.geometry, fromelevation double precision, toelevation double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_locatebetweenelevations(geometry public.geometry, fromelevation double precision, toelevation double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_longestline(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_longestline(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_m(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_m(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_makebox2d(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_makebox2d(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_makeenvelope(double precision, double precision, double precision, double precision, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_makeenvelope(double precision, double precision, double precision, double precision, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_makeline(public.geometry[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_makeline(public.geometry[]) FROM PUBLIC;


--
-- Name: FUNCTION st_makeline(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_makeline(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_makepoint(double precision, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_makepoint(double precision, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_makepoint(double precision, double precision, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_makepoint(double precision, double precision, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_makepoint(double precision, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_makepoint(double precision, double precision, double precision, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_makepointm(double precision, double precision, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_makepointm(double precision, double precision, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_makepolygon(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_makepolygon(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_makepolygon(public.geometry, public.geometry[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_makepolygon(public.geometry, public.geometry[]) FROM PUBLIC;


--
-- Name: FUNCTION st_makevalid(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_makevalid(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_maxdistance(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_maxdistance(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_memsize(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_memsize(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_minimumboundingcircle(inputgeom public.geometry, segs_per_quarter integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_minimumboundingcircle(inputgeom public.geometry, segs_per_quarter integer) FROM PUBLIC;


--
-- Name: FUNCTION st_minimumboundingradius(public.geometry, OUT center public.geometry, OUT radius double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_minimumboundingradius(public.geometry, OUT center public.geometry, OUT radius double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_minimumclearance(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_minimumclearance(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_minimumclearanceline(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_minimumclearanceline(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_mlinefromtext(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_mlinefromtext(text) FROM PUBLIC;


--
-- Name: FUNCTION st_mlinefromtext(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_mlinefromtext(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_mlinefromwkb(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_mlinefromwkb(bytea) FROM PUBLIC;


--
-- Name: FUNCTION st_mlinefromwkb(bytea, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_mlinefromwkb(bytea, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_mpointfromtext(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_mpointfromtext(text) FROM PUBLIC;


--
-- Name: FUNCTION st_mpointfromtext(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_mpointfromtext(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_mpointfromwkb(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_mpointfromwkb(bytea) FROM PUBLIC;


--
-- Name: FUNCTION st_mpointfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_mpointfromwkb(bytea, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_mpolyfromtext(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_mpolyfromtext(text) FROM PUBLIC;


--
-- Name: FUNCTION st_mpolyfromtext(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_mpolyfromtext(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_mpolyfromwkb(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_mpolyfromwkb(bytea) FROM PUBLIC;


--
-- Name: FUNCTION st_mpolyfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_mpolyfromwkb(bytea, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_multi(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_multi(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_multilinefromwkb(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_multilinefromwkb(bytea) FROM PUBLIC;


--
-- Name: FUNCTION st_multilinestringfromtext(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_multilinestringfromtext(text) FROM PUBLIC;


--
-- Name: FUNCTION st_multilinestringfromtext(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_multilinestringfromtext(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_multipointfromtext(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_multipointfromtext(text) FROM PUBLIC;


--
-- Name: FUNCTION st_multipointfromwkb(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_multipointfromwkb(bytea) FROM PUBLIC;


--
-- Name: FUNCTION st_multipointfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_multipointfromwkb(bytea, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_multipolyfromwkb(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_multipolyfromwkb(bytea) FROM PUBLIC;


--
-- Name: FUNCTION st_multipolyfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_multipolyfromwkb(bytea, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_multipolygonfromtext(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_multipolygonfromtext(text) FROM PUBLIC;


--
-- Name: FUNCTION st_multipolygonfromtext(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_multipolygonfromtext(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_ndims(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_ndims(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_node(g public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_node(g public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_normalize(geom public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_normalize(geom public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_nrings(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_nrings(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_numgeometries(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_numgeometries(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_numinteriorring(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_numinteriorring(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_numinteriorrings(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_numinteriorrings(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_numpatches(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_numpatches(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_numpoints(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_numpoints(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_offsetcurve(line public.geometry, distance double precision, params text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_offsetcurve(line public.geometry, distance double precision, params text) FROM PUBLIC;


--
-- Name: FUNCTION st_orderingequals(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_orderingequals(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_orientedenvelope(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_orientedenvelope(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_overlaps(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_overlaps(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_patchn(public.geometry, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_patchn(public.geometry, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_perimeter(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_perimeter(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_perimeter(geog public.geography, use_spheroid boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_perimeter(geog public.geography, use_spheroid boolean) FROM PUBLIC;


--
-- Name: FUNCTION st_perimeter2d(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_perimeter2d(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_point(double precision, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_point(double precision, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_pointfromgeohash(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_pointfromgeohash(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_pointfromtext(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_pointfromtext(text) FROM PUBLIC;


--
-- Name: FUNCTION st_pointfromtext(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_pointfromtext(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_pointfromwkb(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_pointfromwkb(bytea) FROM PUBLIC;


--
-- Name: FUNCTION st_pointfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_pointfromwkb(bytea, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_pointinsidecircle(public.geometry, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_pointinsidecircle(public.geometry, double precision, double precision, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_pointn(public.geometry, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_pointn(public.geometry, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_pointonsurface(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_pointonsurface(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_points(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_points(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_polyfromtext(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_polyfromtext(text) FROM PUBLIC;


--
-- Name: FUNCTION st_polyfromtext(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_polyfromtext(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_polyfromwkb(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_polyfromwkb(bytea) FROM PUBLIC;


--
-- Name: FUNCTION st_polyfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_polyfromwkb(bytea, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_polygon(public.geometry, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_polygon(public.geometry, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_polygonfromtext(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_polygonfromtext(text) FROM PUBLIC;


--
-- Name: FUNCTION st_polygonfromtext(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_polygonfromtext(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_polygonfromwkb(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_polygonfromwkb(bytea) FROM PUBLIC;


--
-- Name: FUNCTION st_polygonfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_polygonfromwkb(bytea, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_polygonize(public.geometry[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_polygonize(public.geometry[]) FROM PUBLIC;


--
-- Name: FUNCTION st_project(geog public.geography, distance double precision, azimuth double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_project(geog public.geography, distance double precision, azimuth double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_quantizecoordinates(g public.geometry, prec_x integer, prec_y integer, prec_z integer, prec_m integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_quantizecoordinates(g public.geometry, prec_x integer, prec_y integer, prec_z integer, prec_m integer) FROM PUBLIC;


--
-- Name: FUNCTION st_relate(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_relate(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_relate(geom1 public.geometry, geom2 public.geometry, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_relate(geom1 public.geometry, geom2 public.geometry, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_relate(geom1 public.geometry, geom2 public.geometry, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_relate(geom1 public.geometry, geom2 public.geometry, text) FROM PUBLIC;


--
-- Name: FUNCTION st_relatematch(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_relatematch(text, text) FROM PUBLIC;


--
-- Name: FUNCTION st_removepoint(public.geometry, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_removepoint(public.geometry, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_removerepeatedpoints(geom public.geometry, tolerance double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_removerepeatedpoints(geom public.geometry, tolerance double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_reverse(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_reverse(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_rotate(public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_rotate(public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_rotate(public.geometry, double precision, public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_rotate(public.geometry, double precision, public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_rotate(public.geometry, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_rotate(public.geometry, double precision, double precision, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_rotatex(public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_rotatex(public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_rotatey(public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_rotatey(public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_rotatez(public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_rotatez(public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_scale(public.geometry, public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_scale(public.geometry, public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_scale(public.geometry, double precision, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_scale(public.geometry, double precision, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_scale(public.geometry, public.geometry, origin public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_scale(public.geometry, public.geometry, origin public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_scale(public.geometry, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_scale(public.geometry, double precision, double precision, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_segmentize(geog public.geography, max_segment_length double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_segmentize(geog public.geography, max_segment_length double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_segmentize(public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_segmentize(public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_seteffectivearea(public.geometry, double precision, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_seteffectivearea(public.geometry, double precision, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_setpoint(public.geometry, integer, public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_setpoint(public.geometry, integer, public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_setsrid(geog public.geography, srid integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_setsrid(geog public.geography, srid integer) FROM PUBLIC;


--
-- Name: FUNCTION st_setsrid(geom public.geometry, srid integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_setsrid(geom public.geometry, srid integer) FROM PUBLIC;


--
-- Name: FUNCTION st_sharedpaths(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_sharedpaths(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_shiftlongitude(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_shiftlongitude(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_shortestline(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_shortestline(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_simplify(public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_simplify(public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_simplify(public.geometry, double precision, boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_simplify(public.geometry, double precision, boolean) FROM PUBLIC;


--
-- Name: FUNCTION st_simplifypreservetopology(public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_simplifypreservetopology(public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_simplifyvw(public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_simplifyvw(public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_snap(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_snap(geom1 public.geometry, geom2 public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_snaptogrid(public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_snaptogrid(public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_snaptogrid(public.geometry, double precision, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_snaptogrid(public.geometry, double precision, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_snaptogrid(public.geometry, double precision, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_snaptogrid(public.geometry, double precision, double precision, double precision, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_snaptogrid(geom1 public.geometry, geom2 public.geometry, double precision, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_snaptogrid(geom1 public.geometry, geom2 public.geometry, double precision, double precision, double precision, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_split(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_split(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_srid(geog public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_srid(geog public.geography) FROM PUBLIC;


--
-- Name: FUNCTION st_srid(geom public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_srid(geom public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_startpoint(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_startpoint(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_subdivide(geom public.geometry, maxvertices integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_subdivide(geom public.geometry, maxvertices integer) FROM PUBLIC;


--
-- Name: FUNCTION st_summary(public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_summary(public.geography) FROM PUBLIC;


--
-- Name: FUNCTION st_summary(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_summary(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_swapordinates(geom public.geometry, ords cstring); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_swapordinates(geom public.geometry, ords cstring) FROM PUBLIC;


--
-- Name: FUNCTION st_symdifference(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_symdifference(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_symmetricdifference(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_symmetricdifference(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_tileenvelope(zoom integer, x integer, y integer, bounds public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_tileenvelope(zoom integer, x integer, y integer, bounds public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_touches(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_touches(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_transform(public.geometry, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_transform(public.geometry, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_transform(geom public.geometry, to_proj text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_transform(geom public.geometry, to_proj text) FROM PUBLIC;


--
-- Name: FUNCTION st_transform(geom public.geometry, from_proj text, to_srid integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_transform(geom public.geometry, from_proj text, to_srid integer) FROM PUBLIC;


--
-- Name: FUNCTION st_transform(geom public.geometry, from_proj text, to_proj text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_transform(geom public.geometry, from_proj text, to_proj text) FROM PUBLIC;


--
-- Name: FUNCTION st_translate(public.geometry, double precision, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_translate(public.geometry, double precision, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_translate(public.geometry, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_translate(public.geometry, double precision, double precision, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_transscale(public.geometry, double precision, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_transscale(public.geometry, double precision, double precision, double precision, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_unaryunion(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_unaryunion(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_union(public.geometry[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_union(public.geometry[]) FROM PUBLIC;


--
-- Name: FUNCTION st_union(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_union(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_voronoilines(g1 public.geometry, tolerance double precision, extend_to public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_voronoilines(g1 public.geometry, tolerance double precision, extend_to public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_voronoipolygons(g1 public.geometry, tolerance double precision, extend_to public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_voronoipolygons(g1 public.geometry, tolerance double precision, extend_to public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_within(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_within(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_wkbtosql(wkb bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_wkbtosql(wkb bytea) FROM PUBLIC;


--
-- Name: FUNCTION st_wkttosql(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_wkttosql(text) FROM PUBLIC;


--
-- Name: FUNCTION st_wrapx(geom public.geometry, wrap double precision, move double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_wrapx(geom public.geometry, wrap double precision, move double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_x(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_x(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_xmax(public.box3d); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_xmax(public.box3d) FROM PUBLIC;


--
-- Name: FUNCTION st_xmin(public.box3d); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_xmin(public.box3d) FROM PUBLIC;


--
-- Name: FUNCTION st_y(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_y(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_ymax(public.box3d); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_ymax(public.box3d) FROM PUBLIC;


--
-- Name: FUNCTION st_ymin(public.box3d); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_ymin(public.box3d) FROM PUBLIC;


--
-- Name: FUNCTION st_z(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_z(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_zmax(public.box3d); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_zmax(public.box3d) FROM PUBLIC;


--
-- Name: FUNCTION st_zmflag(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_zmflag(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_zmin(public.box3d); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_zmin(public.box3d) FROM PUBLIC;


--
-- Name: FUNCTION strpos(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.strpos(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION text(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.text(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION texticlike(public.citext, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.texticlike(public.citext, text) FROM PUBLIC;


--
-- Name: FUNCTION texticlike(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.texticlike(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION texticnlike(public.citext, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.texticnlike(public.citext, text) FROM PUBLIC;


--
-- Name: FUNCTION texticnlike(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.texticnlike(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION texticregexeq(public.citext, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.texticregexeq(public.citext, text) FROM PUBLIC;


--
-- Name: FUNCTION texticregexne(public.citext, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.texticregexne(public.citext, text) FROM PUBLIC;


--
-- Name: FUNCTION texticregexne(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.texticregexne(public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION translate(public.citext, public.citext, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.translate(public.citext, public.citext, text) FROM PUBLIC;


--
-- Name: FUNCTION unlockrows(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.unlockrows(text) FROM PUBLIC;


--
-- Name: FUNCTION updategeometrysrid(character varying, character varying, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.updategeometrysrid(character varying, character varying, integer) FROM PUBLIC;


--
-- Name: FUNCTION updategeometrysrid(character varying, character varying, character varying, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.updategeometrysrid(character varying, character varying, character varying, integer) FROM PUBLIC;


--
-- Name: FUNCTION updategeometrysrid(catalogn_name character varying, schema_name character varying, table_name character varying, column_name character varying, new_srid_in integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.updategeometrysrid(catalogn_name character varying, schema_name character varying, table_name character varying, column_name character varying, new_srid_in integer) FROM PUBLIC;


--
-- Name: FUNCTION users_is_admin(u public.users, project integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.users_is_admin(u public.users, project integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.users_is_admin(u public.users, project integer) TO seasketch_user;


--
-- Name: FUNCTION users_is_approved(u public.users, project integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.users_is_approved(u public.users, project integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.users_is_approved(u public.users, project integer) TO seasketch_user;


--
-- Name: FUNCTION users_participation_status(u public.users, "projectId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.users_participation_status(u public.users, "projectId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.users_participation_status(u public.users, "projectId" integer) TO seasketch_user;


--
-- Name: FUNCTION max(public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.max(public.citext) FROM PUBLIC;


--
-- Name: FUNCTION min(public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.min(public.citext) FROM PUBLIC;


--
-- Name: FUNCTION st_3dextent(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_3dextent(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_asgeobuf(anyelement); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asgeobuf(anyelement) FROM PUBLIC;


--
-- Name: FUNCTION st_asgeobuf(anyelement, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asgeobuf(anyelement, text) FROM PUBLIC;


--
-- Name: FUNCTION st_asmvt(anyelement); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asmvt(anyelement) FROM PUBLIC;


--
-- Name: FUNCTION st_asmvt(anyelement, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asmvt(anyelement, text) FROM PUBLIC;


--
-- Name: FUNCTION st_asmvt(anyelement, text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asmvt(anyelement, text, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_asmvt(anyelement, text, integer, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asmvt(anyelement, text, integer, text) FROM PUBLIC;


--
-- Name: FUNCTION st_asmvt(anyelement, text, integer, text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asmvt(anyelement, text, integer, text, text) FROM PUBLIC;


--
-- Name: FUNCTION st_clusterintersecting(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_clusterintersecting(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_clusterwithin(public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_clusterwithin(public.geometry, double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_collect(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_collect(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_extent(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_extent(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_makeline(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_makeline(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_memcollect(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_memcollect(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_memunion(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_memunion(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_polygonize(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_polygonize(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_union(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_union(public.geometry) FROM PUBLIC;


--
-- Name: TABLE access_control_list_groups; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.access_control_list_groups TO seasketch_user;


--
-- Name: TABLE forums; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.forums TO anon;
GRANT ALL ON TABLE public.forums TO seasketch_user;


--
-- Name: TABLE project_group_members; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.project_group_members TO seasketch_user;


--
-- Name: TABLE project_participants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.project_participants TO seasketch_user;


--
-- Name: TABLE user_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.user_profiles TO anon;
GRANT UPDATE ON TABLE public.user_profiles TO seasketch_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: -; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON FUNCTIONS  FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

