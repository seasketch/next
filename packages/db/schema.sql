--
-- PostgreSQL database dump
--

-- Dumped from database version 12.2
-- Dumped by pg_dump version 12.2

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
-- Name: project_access_control_setting; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_access_control_setting AS ENUM (
    'admins_only',
    'invite_only',
    'public'
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
-- Name: is_ss_admin(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_ss_admin(project_id integer, user_id integer) RETURNS boolean
    LANGUAGE sql
    AS $$
  select exists (
    select 
      1 
    from 
      project_participants 
    where 
      project_participants.user_id = user_id and 
      project_participants.project_id = project_id and 
      project_participants.is_admin = true
  );
$$;


--
-- Name: is_superuser(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_superuser() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select 'seasketch_superuser' = current_setting('role', true);
$$;


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
-- Name: INDEX project_slugs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.project_slugs IS '@omit update';


--
-- Name: INDEX projects_slug_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.projects_slug_key IS '@omit update';


--
-- Name: user_profiles_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_profiles_user_id_idx ON public.user_profiles USING btree (user_id);


--
-- Name: users_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_sub ON public.users USING btree (sub);


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
-- Name: user_profiles user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT user_profiles_user_id_fkey ON user_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT user_profiles_user_id_fkey ON public.user_profiles IS '@omit many';


--
-- Name: postgraphile_watch_ddl; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER postgraphile_watch_ddl ON ddl_command_end
         WHEN TAG IN ('ALTER AGGREGATE', 'ALTER DOMAIN', 'ALTER EXTENSION', 'ALTER FOREIGN TABLE', 'ALTER FUNCTION', 'ALTER POLICY', 'ALTER SCHEMA', 'ALTER TABLE', 'ALTER TYPE', 'ALTER VIEW', 'COMMENT', 'CREATE AGGREGATE', 'CREATE DOMAIN', 'CREATE EXTENSION', 'CREATE FOREIGN TABLE', 'CREATE FUNCTION', 'CREATE INDEX', 'CREATE POLICY', 'CREATE RULE', 'CREATE SCHEMA', 'CREATE TABLE', 'CREATE TABLE AS', 'CREATE VIEW', 'DROP AGGREGATE', 'DROP DOMAIN', 'DROP EXTENSION', 'DROP FOREIGN TABLE', 'DROP FUNCTION', 'DROP INDEX', 'DROP OWNED', 'DROP POLICY', 'DROP RULE', 'DROP SCHEMA', 'DROP TABLE', 'DROP TYPE', 'DROP VIEW', 'GRANT', 'REVOKE', 'SELECT INTO')
   EXECUTE FUNCTION postgraphile_watch.notify_watchers_ddl();


--
-- Name: postgraphile_watch_drop; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER postgraphile_watch_drop ON sql_drop
   EXECUTE FUNCTION postgraphile_watch.notify_watchers_drop();


--
-- Name: projects admin_update_projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_update_projects ON public.projects FOR UPDATE TO seasketch_user USING ((EXISTS ( SELECT projects.id
   FROM public.project_participants
  WHERE ((project_participants.user_id = (current_setting('session.user_id'::text, true))::integer) AND (project_participants.project_id = projects.id) AND (project_participants.is_admin = true)))));


--
-- Name: projects anon_projects_select_listed; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_projects_select_listed ON public.projects FOR SELECT TO anon USING (((is_listed = true) AND (is_deleted = false)));


--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: projects seasketch_user_select_projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY seasketch_user_select_projects ON public.projects FOR SELECT TO seasketch_user USING (((is_deleted = false) AND ((is_listed = true) OR (EXISTS ( SELECT projects.id
   FROM public.project_participants
  WHERE ((project_participants.user_id = (current_setting('session.user_id'::text, true))::integer) AND (project_participants.project_id = projects.id) AND ((project_participants.approved = true) OR (project_participants.is_admin = true))))))));


--
-- Name: projects superuser_projects_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superuser_projects_select ON public.projects FOR SELECT TO seasketch_superuser USING ((is_deleted = false));


--
-- Name: projects superuser_update_projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superuser_update_projects ON public.projects FOR UPDATE TO seasketch_superuser USING (true);


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
-- Name: FUNCTION get_or_create_user_by_sub(_sub text, OUT user_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_or_create_user_by_sub(_sub text, OUT user_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_or_create_user_by_sub(_sub text, OUT user_id integer) TO anon;


--
-- Name: FUNCTION get_project_id(slug text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_project_id(slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_project_id(slug text) TO anon;


--
-- Name: FUNCTION is_admin(_project_id integer, _user_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_admin(_project_id integer, _user_id integer) FROM PUBLIC;


--
-- Name: FUNCTION is_ss_admin(project_id integer, user_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_ss_admin(project_id integer, user_id integer) FROM PUBLIC;


--
-- Name: FUNCTION is_superuser(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_superuser() FROM PUBLIC;


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
-- Name: TABLE project_groups; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.project_groups TO seasketch_user;


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
-- Name: FUNCTION replace(public.citext, public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.replace(public.citext, public.citext, public.citext) FROM PUBLIC;


--
-- Name: FUNCTION split_part(public.citext, public.citext, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.split_part(public.citext, public.citext, integer) FROM PUBLIC;


--
-- Name: FUNCTION strpos(public.citext, public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.strpos(public.citext, public.citext) FROM PUBLIC;


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
-- Name: FUNCTION max(public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.max(public.citext) FROM PUBLIC;


--
-- Name: FUNCTION min(public.citext); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.min(public.citext) FROM PUBLIC;


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


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: -; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON FUNCTIONS  FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

