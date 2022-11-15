--
-- PostgreSQL database dump
--

-- Dumped from database version 13.1 (Debian 13.1-1.pgdg100+1)
-- Dumped by pg_dump version 13.1 (Debian 13.1-1.pgdg100+1)

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
-- Name: graphile_worker; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphile_worker;


--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: ltree; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA public;


--
-- Name: EXTENSION ltree; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION ltree IS 'data type for hierarchical tree-like structures';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: access_control_list_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.access_control_list_type AS ENUM (
    'public',
    'admins_only',
    'group'
);


--
-- Name: basemap_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.basemap_type AS ENUM (
    'MAPBOX',
    'RASTER_URL_TEMPLATE'
);


--
-- Name: TYPE basemap_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.basemap_type IS 'SeaSketch supports multiple different basemap types. All must eventually be compiled down to a mapbox gl style.';


--
-- Name: cursor_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cursor_type AS ENUM (
    'AUTO',
    'DEFAULT',
    'POINTER',
    'CROSSHAIR'
);


--
-- Name: data_upload_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.data_upload_state AS ENUM (
    'awaiting_upload',
    'uploaded',
    'processing',
    'fetching',
    'validating',
    'requires_user_input',
    'converting_format',
    'tiling',
    'uploading_products',
    'complete',
    'failed',
    'failed_dismissed'
);


--
-- Name: data_upload_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.data_upload_type AS ENUM (
    'vector',
    'raster'
);


--
-- Name: email; Type: DOMAIN; Schema: public; Owner: -
--

CREATE DOMAIN public.email AS public.citext
	CONSTRAINT email_check CHECK ((VALUE OPERATOR(public.~) '^[a-zA-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'::public.citext));


--
-- Name: email_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.email_status AS ENUM (
    'QUEUED',
    'SENT',
    'DELIVERED',
    'BOUNCED',
    'COMPLAINT',
    'ERROR',
    'UNSUBSCRIBED'
);


--
-- Name: email_summary_frequency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.email_summary_frequency AS ENUM (
    'NEVER',
    'WEEKLY',
    'DAILY'
);


--
-- Name: field_rule_operator; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.field_rule_operator AS ENUM (
    '<',
    '>',
    '=',
    '!=',
    'is blank',
    'contains'
);


--
-- Name: form_element_layout; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.form_element_layout AS ENUM (
    'LEFT',
    'RIGHT',
    'TOP',
    'COVER',
    'MAP_STACKED',
    'MAP_SIDEBAR_LEFT',
    'MAP_SIDEBAR_RIGHT',
    'MAP_FULLSCREEN',
    'MAP_TOP'
);


--
-- Name: form_element_text_variant; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.form_element_text_variant AS ENUM (
    'LIGHT',
    'DARK',
    'DYNAMIC'
);


--
-- Name: form_field_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.form_field_type AS ENUM (
    'TEXTINPUT',
    'TEXTAREA',
    'SELECT',
    'SECTION'
);


--
-- Name: TYPE form_field_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.form_field_type IS 'In the future new field types can be added by using the command `alter type form_field_type add value ''NEW_TYPE'';`';


--
-- Name: form_logic_command; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.form_logic_command AS ENUM (
    'JUMP',
    'SHOW',
    'HIDE'
);


--
-- Name: form_logic_operator; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.form_logic_operator AS ENUM (
    'AND',
    'OR'
);


--
-- Name: form_template_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.form_template_type AS ENUM (
    'SURVEYS',
    'SKETCHES',
    'SURVEYS_AND_SKETCHES'
);


--
-- Name: TYPE form_template_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.form_template_type IS 'Indicates which features should use the form as a template';


--
-- Name: interactivity_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.interactivity_type AS ENUM (
    'BANNER',
    'TOOLTIP',
    'POPUP',
    'FIXED_BLOCK',
    'NONE'
);


--
-- Name: invite_order_by; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invite_order_by AS ENUM (
    'NAME',
    'EMAIL'
);


--
-- Name: invite_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invite_status AS ENUM (
    'UNSENT',
    'QUEUED',
    'SENT',
    'DELIVERED',
    'BOUNCED',
    'COMPLAINT',
    'UNCONFIRMED',
    'CONFIRMED',
    'TOKEN_EXPIRED',
    'ERROR',
    'UNSUBSCRIBED',
    'SURVEY_INVITE_QUEUED',
    'SURVEY_INVITE_SENT'
);


--
-- Name: TYPE invite_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.invite_status IS 'Invite status is derived from feedback notifications coming from the AWS SES email service and token expiration date. See the inviteEmails relation for more details.';


--
-- Name: invite_stats; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invite_stats AS (
	status public.invite_status,
	count integer
);


--
-- Name: offline_tile_package_source_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.offline_tile_package_source_type AS ENUM (
    'vector',
    'raster',
    'raster-dem'
);


--
-- Name: offline_tile_package_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.offline_tile_package_status AS ENUM (
    'QUEUED',
    'GENERATING',
    'UPLOADING',
    'COMPLETE',
    'FAILED'
);


--
-- Name: optional_basemap_layers_group_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.optional_basemap_layers_group_type AS ENUM (
    'NONE',
    'RADIO',
    'SELECT'
);


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
    'pending_approval',
    'participant_shared_profile',
    'participant_hidden_profile'
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
-- Name: project_access_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_access_status AS ENUM (
    'GRANTED',
    'DENIED_ANON',
    'DENIED_NOT_REQUESTED',
    'DENIED_NOT_APPROVED',
    'DENIED_ADMINS_ONLY',
    'DENIED_EMAIL_NOT_VERIFIED',
    'PROJECT_DOES_NOT_EXIST'
);


--
-- Name: project_invite_details; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_invite_details AS (
	admin boolean,
	fullname text,
	email text,
	project_id integer,
	state public.invite_status
);


--
-- Name: project_invite_options; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_invite_options AS (
	email public.email,
	fullname text
);


--
-- Name: public_project_details; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.public_project_details AS (
	id integer,
	name text,
	slug text,
	logo_url text,
	access_control public.project_access_control_setting,
	support_email text,
	access_status public.project_access_status
);


--
-- Name: raster_dem_encoding; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.raster_dem_encoding AS ENUM (
    'mapbox',
    'terrarium'
);


--
-- Name: render_under_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.render_under_type AS ENUM (
    'labels',
    'land',
    'none'
);


--
-- Name: sketch_geometry_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sketch_geometry_type AS ENUM (
    'POLYGON',
    'LINESTRING',
    'POINT',
    'COLLECTION',
    'CHOOSE_FEATURE'
);


--
-- Name: sort_by_direction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sort_by_direction AS ENUM (
    'ASC',
    'DESC'
);


--
-- Name: sprite_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sprite_type AS ENUM (
    'icon',
    'fill',
    'line'
);


--
-- Name: survey_access_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.survey_access_type AS ENUM (
    'PUBLIC',
    'INVITE_ONLY'
);


--
-- Name: survey_invite_options; Type: DOMAIN; Schema: public; Owner: -
--

CREATE DOMAIN public.survey_invite_options AS public.project_invite_options;


--
-- Name: survey_token_info; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.survey_token_info AS (
	token text,
	survey_id integer,
	project_id integer
);


--
-- Name: survey_validation_info_composite; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.survey_validation_info_composite AS (
	is_disabled boolean,
	limit_to_single_response boolean
);


--
-- Name: tile_scheme; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tile_scheme AS ENUM (
    'xyz',
    'tms'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: jobs; Type: TABLE; Schema: graphile_worker; Owner: -
--

CREATE TABLE graphile_worker.jobs (
    id bigint NOT NULL,
    queue_name text,
    task_identifier text NOT NULL,
    payload json DEFAULT '{}'::json NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    run_at timestamp with time zone DEFAULT now() NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 25 NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    key text,
    locked_at timestamp with time zone,
    locked_by text,
    revision integer DEFAULT 0 NOT NULL,
    flags jsonb,
    CONSTRAINT jobs_key_check CHECK ((length(key) > 0))
);


--
-- Name: add_job(text, json, text, timestamp with time zone, integer, text, integer, text[], text); Type: FUNCTION; Schema: graphile_worker; Owner: -
--

CREATE FUNCTION graphile_worker.add_job(identifier text, payload json DEFAULT NULL::json, queue_name text DEFAULT NULL::text, run_at timestamp with time zone DEFAULT NULL::timestamp with time zone, max_attempts integer DEFAULT NULL::integer, job_key text DEFAULT NULL::text, priority integer DEFAULT NULL::integer, flags text[] DEFAULT NULL::text[], job_key_mode text DEFAULT 'replace'::text) RETURNS graphile_worker.jobs
    LANGUAGE plpgsql
    AS $$
declare
  v_job "graphile_worker".jobs;
begin
  -- Apply rationality checks
  if length(identifier) > 128 then
    raise exception 'Task identifier is too long (max length: 128).' using errcode = 'GWBID';
  end if;
  if queue_name is not null and length(queue_name) > 128 then
    raise exception 'Job queue name is too long (max length: 128).' using errcode = 'GWBQN';
  end if;
  if job_key is not null and length(job_key) > 512 then
    raise exception 'Job key is too long (max length: 512).' using errcode = 'GWBJK';
  end if;
  if max_attempts < 1 then
    raise exception 'Job maximum attempts must be at least 1.' using errcode = 'GWBMA';
  end if;
  if job_key is not null and (job_key_mode is null or job_key_mode in ('replace', 'preserve_run_at')) then
    -- Upsert job if existing job isn't locked, but in the case of locked
    -- existing job create a new job instead as it must have already started
    -- executing (i.e. it's world state is out of date, and the fact add_job
    -- has been called again implies there's new information that needs to be
    -- acted upon).
    insert into "graphile_worker".jobs (
      task_identifier,
      payload,
      queue_name,
      run_at,
      max_attempts,
      key,
      priority,
      flags
    )
      values(
        identifier,
        coalesce(payload, '{}'::json),
        queue_name,
        coalesce(run_at, now()),
        coalesce(max_attempts, 25),
        job_key,
        coalesce(priority, 0),
        (
          select jsonb_object_agg(flag, true)
          from unnest(flags) as item(flag)
        )
      )
      on conflict (key) do update set
        task_identifier=excluded.task_identifier,
        payload=excluded.payload,
        queue_name=excluded.queue_name,
        max_attempts=excluded.max_attempts,
        run_at=(case
          when job_key_mode = 'preserve_run_at' and jobs.attempts = 0 then jobs.run_at
          else excluded.run_at
        end),
        priority=excluded.priority,
        revision=jobs.revision + 1,
        flags=excluded.flags,
        -- always reset error/retry state
        attempts=0,
        last_error=null
      where jobs.locked_at is null
      returning *
      into v_job;
    -- If upsert succeeded (insert or update), return early
    if not (v_job is null) then
      return v_job;
    end if;
    -- Upsert failed -> there must be an existing job that is locked. Remove
    -- existing key to allow a new one to be inserted, and prevent any
    -- subsequent retries of existing job by bumping attempts to the max
    -- allowed.
    update "graphile_worker".jobs
      set
        key = null,
        attempts = jobs.max_attempts
      where key = job_key;
  elsif job_key is not null and job_key_mode = 'unsafe_dedupe' then
    -- Insert job, but if one already exists then do nothing, even if the
    -- existing job has already started (and thus represents an out-of-date
    -- world state). This is dangerous because it means that whatever state
    -- change triggered this add_job may not be acted upon (since it happened
    -- after the existing job started executing, but no further job is being
    -- scheduled), but it is useful in very rare circumstances for
    -- de-duplication. If in doubt, DO NOT USE THIS.
    insert into "graphile_worker".jobs (
      task_identifier,
      payload,
      queue_name,
      run_at,
      max_attempts,
      key,
      priority,
      flags
    )
      values(
        identifier,
        coalesce(payload, '{}'::json),
        queue_name,
        coalesce(run_at, now()),
        coalesce(max_attempts, 25),
        job_key,
        coalesce(priority, 0),
        (
          select jsonb_object_agg(flag, true)
          from unnest(flags) as item(flag)
        )
      )
      on conflict (key)
      -- Bump the revision so that there's something to return
      do update set revision = jobs.revision + 1
      returning *
      into v_job;
    return v_job;
  elsif job_key is not null then
    raise exception 'Invalid job_key_mode value, expected ''replace'', ''preserve_run_at'' or ''unsafe_dedupe''.' using errcode = 'GWBKM';
  end if;
  -- insert the new job. Assume no conflicts due to the update above
  insert into "graphile_worker".jobs(
    task_identifier,
    payload,
    queue_name,
    run_at,
    max_attempts,
    key,
    priority,
    flags
  )
    values(
      identifier,
      coalesce(payload, '{}'::json),
      queue_name,
      coalesce(run_at, now()),
      coalesce(max_attempts, 25),
      job_key,
      coalesce(priority, 0),
      (
        select jsonb_object_agg(flag, true)
        from unnest(flags) as item(flag)
      )
    )
    returning *
    into v_job;
  return v_job;
end;
$$;


--
-- Name: complete_job(text, bigint); Type: FUNCTION; Schema: graphile_worker; Owner: -
--

CREATE FUNCTION graphile_worker.complete_job(worker_id text, job_id bigint) RETURNS graphile_worker.jobs
    LANGUAGE plpgsql
    AS $$
declare
  v_row "graphile_worker".jobs;
begin
  delete from "graphile_worker".jobs
    where id = job_id
    returning * into v_row;

  if v_row.queue_name is not null then
    update "graphile_worker".job_queues
      set locked_by = null, locked_at = null
      where queue_name = v_row.queue_name and locked_by = worker_id;
  end if;

  return v_row;
end;
$$;


--
-- Name: complete_jobs(bigint[]); Type: FUNCTION; Schema: graphile_worker; Owner: -
--

CREATE FUNCTION graphile_worker.complete_jobs(job_ids bigint[]) RETURNS SETOF graphile_worker.jobs
    LANGUAGE sql
    AS $$
  delete from "graphile_worker".jobs
    where id = any(job_ids)
    and (
      locked_by is null
    or
      locked_at < NOW() - interval '4 hours'
    )
    returning *;
$$;


--
-- Name: fail_job(text, bigint, text); Type: FUNCTION; Schema: graphile_worker; Owner: -
--

CREATE FUNCTION graphile_worker.fail_job(worker_id text, job_id bigint, error_message text) RETURNS graphile_worker.jobs
    LANGUAGE plpgsql STRICT
    AS $$
declare
  v_row "graphile_worker".jobs;
begin
  update "graphile_worker".jobs
    set
      last_error = error_message,
      run_at = greatest(now(), run_at) + (exp(least(attempts, 10))::text || ' seconds')::interval,
      locked_by = null,
      locked_at = null
    where id = job_id and locked_by = worker_id
    returning * into v_row;

  if v_row.queue_name is not null then
    update "graphile_worker".job_queues
      set locked_by = null, locked_at = null
      where queue_name = v_row.queue_name and locked_by = worker_id;
  end if;

  return v_row;
end;
$$;


--
-- Name: get_job(text, text[], interval, text[], timestamp with time zone); Type: FUNCTION; Schema: graphile_worker; Owner: -
--

CREATE FUNCTION graphile_worker.get_job(worker_id text, task_identifiers text[] DEFAULT NULL::text[], job_expiry interval DEFAULT '04:00:00'::interval, forbidden_flags text[] DEFAULT NULL::text[], now timestamp with time zone DEFAULT now()) RETURNS graphile_worker.jobs
    LANGUAGE plpgsql
    AS $$
declare
  v_job_id bigint;
  v_queue_name text;
  v_row "graphile_worker".jobs;
begin
  if worker_id is null or length(worker_id) < 10 then
    raise exception 'invalid worker id';
  end if;

  select jobs.queue_name, jobs.id into v_queue_name, v_job_id
    from "graphile_worker".jobs
    where (jobs.locked_at is null or jobs.locked_at < (now - job_expiry))
    and (
      jobs.queue_name is null
    or
      exists (
        select 1
        from "graphile_worker".job_queues
        where job_queues.queue_name = jobs.queue_name
        and (job_queues.locked_at is null or job_queues.locked_at < (now - job_expiry))
        for update
        skip locked
      )
    )
    and run_at <= now
    and attempts < max_attempts
    and (task_identifiers is null or task_identifier = any(task_identifiers))
    and (forbidden_flags is null or (flags ?| forbidden_flags) is not true)
    order by priority asc, run_at asc, id asc
    limit 1
    for update
    skip locked;

  if v_job_id is null then
    return null;
  end if;

  if v_queue_name is not null then
    update "graphile_worker".job_queues
      set
        locked_by = worker_id,
        locked_at = now
      where job_queues.queue_name = v_queue_name;
  end if;

  update "graphile_worker".jobs
    set
      attempts = attempts + 1,
      locked_by = worker_id,
      locked_at = now
    where id = v_job_id
    returning * into v_row;

  return v_row;
end;
$$;


--
-- Name: jobs__decrease_job_queue_count(); Type: FUNCTION; Schema: graphile_worker; Owner: -
--

CREATE FUNCTION graphile_worker.jobs__decrease_job_queue_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_new_job_count int;
begin
  update "graphile_worker".job_queues
    set job_count = job_queues.job_count - 1
    where queue_name = old.queue_name
    returning job_count into v_new_job_count;

  if v_new_job_count <= 0 then
    delete from "graphile_worker".job_queues where queue_name = old.queue_name and job_count <= 0;
  end if;

  return old;
end;
$$;


--
-- Name: jobs__increase_job_queue_count(); Type: FUNCTION; Schema: graphile_worker; Owner: -
--

CREATE FUNCTION graphile_worker.jobs__increase_job_queue_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  insert into "graphile_worker".job_queues(queue_name, job_count)
    values(new.queue_name, 1)
    on conflict (queue_name)
    do update
    set job_count = job_queues.job_count + 1;

  return new;
end;
$$;


--
-- Name: permanently_fail_jobs(bigint[], text); Type: FUNCTION; Schema: graphile_worker; Owner: -
--

CREATE FUNCTION graphile_worker.permanently_fail_jobs(job_ids bigint[], error_message text DEFAULT NULL::text) RETURNS SETOF graphile_worker.jobs
    LANGUAGE sql
    AS $$
  update "graphile_worker".jobs
    set
      last_error = coalesce(error_message, 'Manually marked as failed'),
      attempts = max_attempts
    where id = any(job_ids)
    and (
      locked_by is null
    or
      locked_at < NOW() - interval '4 hours'
    )
    returning *;
$$;


--
-- Name: remove_job(text); Type: FUNCTION; Schema: graphile_worker; Owner: -
--

CREATE FUNCTION graphile_worker.remove_job(job_key text) RETURNS graphile_worker.jobs
    LANGUAGE plpgsql STRICT
    AS $$
declare
  v_job "graphile_worker".jobs;
begin
  -- Delete job if not locked
  delete from "graphile_worker".jobs
    where key = job_key
    and locked_at is null
  returning * into v_job;
  if not (v_job is null) then
    return v_job;
  end if;
  -- Otherwise prevent job from retrying, and clear the key
  update "graphile_worker".jobs
    set attempts = max_attempts, key = null
    where key = job_key
  returning * into v_job;
  return v_job;
end;
$$;


--
-- Name: reschedule_jobs(bigint[], timestamp with time zone, integer, integer, integer); Type: FUNCTION; Schema: graphile_worker; Owner: -
--

CREATE FUNCTION graphile_worker.reschedule_jobs(job_ids bigint[], run_at timestamp with time zone DEFAULT NULL::timestamp with time zone, priority integer DEFAULT NULL::integer, attempts integer DEFAULT NULL::integer, max_attempts integer DEFAULT NULL::integer) RETURNS SETOF graphile_worker.jobs
    LANGUAGE sql
    AS $$
  update "graphile_worker".jobs
    set
      run_at = coalesce(reschedule_jobs.run_at, jobs.run_at),
      priority = coalesce(reschedule_jobs.priority, jobs.priority),
      attempts = coalesce(reschedule_jobs.attempts, jobs.attempts),
      max_attempts = coalesce(reschedule_jobs.max_attempts, jobs.max_attempts)
    where id = any(job_ids)
    and (
      locked_by is null
    or
      locked_at < NOW() - interval '4 hours'
    )
    returning *;
$$;


--
-- Name: tg__update_timestamp(); Type: FUNCTION; Schema: graphile_worker; Owner: -
--

CREATE FUNCTION graphile_worker.tg__update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = greatest(now(), old.updated_at + interval '1 millisecond');
  return new;
end;
$$;


--
-- Name: tg_jobs__notify_new_jobs(); Type: FUNCTION; Schema: graphile_worker; Owner: -
--

CREATE FUNCTION graphile_worker.tg_jobs__notify_new_jobs() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  perform pg_notify('jobs:insert', '');
  return new;
end;
$$;


--
-- Name: _001_unnest_survey_response_sketches(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._001_unnest_survey_response_sketches() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      f record;
      feature_data record;
      sketch_ids int[];
      sketch_id int;
      feature_name_element_id int;
    BEGIN
      if  (TG_OP = 'INSERT') then
        -- loop over spatial form elements in survey
        for f in select 
            form_elements.id::text as id,
            is_spatial,
            sketch_classes.id as sketch_class_id
          from 
            form_elements 
          inner join
            form_element_types
          on 
            form_element_types.component_name = form_elements.type_id
          inner join 
            sketch_classes
          on
            sketch_classes.form_element_id = form_elements.id
          where
            form_element_types.is_spatial = true
        loop
            select id into feature_name_element_id from form_elements where form_id = (select id from forms where sketch_class_id = f.sketch_class_id) and type_id = 'FeatureName';
            if NEW.data::jsonb ? f.id THEN
              sketch_ids = ARRAY[]::int[];
              set constraints sketches_response_id_fkey deferred;
              if NEW.data::jsonb #> ARRAY[f.id,'collection'::text, 'features'::text] is not null then
                for feature_data in select jsonb_array_elements(NEW.data::jsonb #> ARRAY[f.id,'collection'::text, 'features'::text]) as feature loop
                  insert into sketches (
                    response_id, 
                    form_element_id, 
                    sketch_class_id, 
                    user_id,
                    name, 
                    user_geom, 
                    properties
                  ) values (
                    NEW.id, 
                    f.id::int, 
                    f.sketch_class_id, 
                    NEW.user_id,
                    coalesce((feature_data.feature::jsonb #>> ARRAY['properties'::text,feature_name_element_id::text])::text, ''::text), 
                    st_geomfromgeojson(feature_data.feature::jsonb ->> 'geometry'::text),
                    feature_data.feature::jsonb -> 'properties'::text
                  ) returning id into sketch_id;
                  sketch_ids = sketch_ids || sketch_id;
                end loop;
                NEW.data = jsonb_set(NEW.data, ARRAY[f.id, 'collection'], to_json(sketch_ids)::jsonb);
              else
                raise exception 'Embedded sketches must be a FeatureCollection';
              end if;
            end if;
        end loop;
      end if;
      RETURN NEW;
    END;
  $$;


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
    geoprocessing_project_url text,
    geoprocessing_client_url text,
    geoprocessing_client_name text,
    mapbox_gl_style jsonb,
    form_element_id integer,
    CONSTRAINT sketch_classes_geoprocessing_client_url_check CHECK ((geoprocessing_client_url ~* 'https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,255}\.[a-z]{2,9}\y([-a-zA-Z0-9@:%_\+.~#?&//=]*)$'::text)),
    CONSTRAINT sketch_classes_geoprocessing_project_url_check CHECK ((geoprocessing_project_url ~* 'https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,255}\.[a-z]{2,9}\y([-a-zA-Z0-9@:%_\+.~#?&//=]*)$'::text))
);


--
-- Name: TABLE sketch_classes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sketch_classes IS '
@omit all,create
Sketch Classes act as a schema for sketches drawn by users.
';


--
-- Name: COLUMN sketch_classes.project_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketch_classes.project_id IS 'SketchClasses belong to a single project.';


--
-- Name: COLUMN sketch_classes.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketch_classes.name IS 'Label chosen by project admins that is shown to users.';


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
If set to true, a geometry_type of POLYGON would allow for both POLYGONs and 
MULTIPOLYGONs after preprocessing or on spatial file upload. Users will still 
digitize single features. 

Note that this feature should be used seldomly, since for planning purposes it 
is unlikely to have non-contiguous zones.

For CHOOSE_FEATURE geometry types, this field will enable the selction of 
multiple features.
';


--
-- Name: COLUMN sketch_classes.is_archived; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketch_classes.is_archived IS '
If set to true, (non-admin) users should not be able to digitize new features using this sketch class, but they should still be able to access the sketch class in order to render existing sketches of this type.
';


--
-- Name: COLUMN sketch_classes.geoprocessing_project_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketch_classes.geoprocessing_project_url IS '
Root endpoint of a [@seasketch/geoprocessing](https://github.com/seasketch/geoprocessing) project that should be used for reporting.
';


--
-- Name: COLUMN sketch_classes.geoprocessing_client_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketch_classes.geoprocessing_client_url IS '
Endpoint for the client javascript bundle.
';


--
-- Name: COLUMN sketch_classes.geoprocessing_client_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketch_classes.geoprocessing_client_name IS '
Name of the report to be displayed.
';


--
-- Name: COLUMN sketch_classes.mapbox_gl_style; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketch_classes.mapbox_gl_style IS '
[Mapbox GL Style](https://docs.mapbox.com/mapbox-gl-js/style-spec/) used to 
render features. Sketches can be styled based on attribute data by using 
[Expressions](https://docs.mapbox.com/help/glossary/expression/).
';


--
-- Name: COLUMN sketch_classes.form_element_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketch_classes.form_element_id IS '
If set, this sketch class is only for use in a survey indicated by the form_element.
';


--
-- Name: _create_sketch_class(text, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._create_sketch_class(name text, project_id integer, form_element_id integer DEFAULT NULL::integer, template_id integer DEFAULT NULL::integer) RETURNS public.sketch_classes
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      sc_id int;
      templateid int;
      sketch_class sketch_classes;
      geometrytype sketch_geometry_type;
      multi boolean;
      project_url text;
      client_name text;
      client_url text;
      gl_style jsonb;
    begin
      if template_id is null then
        select id, sketch_class_id into templateid, sc_id from forms where template_name = 'Basic Template' and template_type = 'SKETCHES';
        if templateid is null then
          raise exception 'Form template with name "Basic Template" has not been created!';
        end if;
      else
        templateid = template_id;
      end if;

      select geometry_type, is_multi, geoprocessing_project_url, geoprocessing_client_name, geoprocessing_client_url, mapbox_gl_style into geometrytype, multi, project_url, client_name, client_url, gl_style from sketch_classes where id = sc_id;

      if session_is_admin(project_id) then
        insert into sketch_classes (name, project_id, geometry_type, is_multi, geoprocessing_project_url, geoprocessing_client_name, geoprocessing_client_url, mapbox_gl_style, form_element_id) values ('generated_from_template', project_id, geometrytype, multi, project_url, client_name, client_url, gl_style, form_element_id) returning id into sc_id;
        perform initialize_sketch_class_form_from_template(sc_id, templateid);
        select * into sketch_class from sketch_classes where id = sc_id;
        return sketch_class;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;


--
-- Name: FUNCTION _create_sketch_class(name text, project_id integer, form_element_id integer, template_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public._create_sketch_class(name text, project_id integer, form_element_id integer, template_id integer) IS '@omit';


--
-- Name: surveys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.surveys (
    id integer NOT NULL,
    project_id integer NOT NULL,
    name text NOT NULL,
    is_disabled boolean DEFAULT true NOT NULL,
    access_type public.survey_access_type DEFAULT 'PUBLIC'::public.survey_access_type NOT NULL,
    limit_to_single_response boolean DEFAULT true NOT NULL,
    geofence public.geography(Polygon,4326) DEFAULT NULL::public.geography,
    show_social_media_buttons boolean DEFAULT true,
    show_progress boolean DEFAULT true NOT NULL,
    show_facilitation_option boolean DEFAULT true NOT NULL,
    supported_languages text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT namechk CHECK (((char_length(name) <= 200) AND (char_length(name) > 0))),
    CONSTRAINT surveys_name_check CHECK ((char_length(name) <= 255))
);


--
-- Name: TABLE surveys; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.surveys IS '
@simpleCollections only
@omit all,create
';


--
-- Name: COLUMN surveys.is_disabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.surveys.is_disabled IS '
Disabled surveys will not be accessible to non-admins. Invite email sending will
be paused.
';


--
-- Name: COLUMN surveys.access_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.surveys.access_type IS '
PUBLIC or INVITE_ONLY
';


--
-- Name: COLUMN surveys.limit_to_single_response; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.surveys.limit_to_single_response IS 'If set, there can only be one response with matching contact information. The app will also discourage multiple submissions from the same browser session.';


--
-- Name: COLUMN surveys.geofence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.surveys.geofence IS 'If set, responses that originate from an IP address outside this fence will be flagged.';


--
-- Name: COLUMN surveys.show_social_media_buttons; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.surveys.show_social_media_buttons IS '
Only applicable for public surveys. Show tools to respondants for sharing the 
survey on social media to encourage responses.
';


--
-- Name: _create_survey(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._create_survey(name text, project_id integer, template_id integer DEFAULT NULL::integer) RETURNS public.surveys
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      surveyid int;
      templateid int;
      survey surveys;
    begin
      if template_id is null then
        select id into templateid from forms where template_name = 'Basic Template' and template_type = 'SURVEYS';
        if templateid is null then
          raise exception 'Form template with name "Basic Template" has not been created!';
        end if;
      else
        templateid = template_id;
      end if;
      if session_is_admin(project_id) then
        insert into surveys (name, project_id) values (name, project_id) returning id into surveyid;
        perform initialize_survey_form_from_template(surveyid, templateid);
        select * into survey from surveys where id = surveyid;
        return survey;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;


--
-- Name: FUNCTION _create_survey(name text, project_id integer, template_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public._create_survey(name text, project_id integer, template_id integer) IS '@omit';


--
-- Name: _delete_table_of_contents_item(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._delete_table_of_contents_item(tid integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    layer_id int;
    source_id int;
    layer_count int;
  begin
    select data_layer_id into layer_id from table_of_contents_items where id = "tid";
    select data_source_id into source_id from data_layers where id = layer_id;
    delete from table_of_contents_items where id = "tid";
    delete from data_layers where id = layer_id;
    if source_id is not null then
      select count(id) into layer_count from data_layers where data_source_id = source_id;
      if layer_count = 0 then
        delete from data_sources where id = source_id;
      end if;
    end if;
    return;
  end;
$$;


--
-- Name: FUNCTION _delete_table_of_contents_item(tid integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public._delete_table_of_contents_item(tid integer) IS '@omit';


--
-- Name: _session_on_toc_item_acl(public.ltree); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._session_on_toc_item_acl(lpath public.ltree) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    with test (on_acl) as (select 
      bool_and(session_on_acl(access_control_lists.id)) as bool_and
    from
      access_control_lists
    where
      table_of_contents_item_id in (
        select id from table_of_contents_items where is_draft = false and table_of_contents_items.path @> lpath
      ) and
      type != 'public') select on_acl = true or (on_acl is null and lpath is not null) from test;
  $$;


--
-- Name: FUNCTION _session_on_toc_item_acl(lpath public.ltree); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public._session_on_toc_item_acl(lpath public.ltree) IS '@omit';


--
-- Name: access_control_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_control_lists (
    id integer NOT NULL,
    project_id integer NOT NULL,
    type public.access_control_list_type DEFAULT 'public'::public.access_control_list_type NOT NULL,
    sketch_class_id integer,
    forum_id_read integer,
    forum_id_write integer,
    table_of_contents_item_id integer,
    basemap_id integer,
    CONSTRAINT access_control_list_has_related_model CHECK ((((((((sketch_class_id IS NOT NULL))::integer + ((forum_id_read IS NOT NULL))::integer) + ((forum_id_write IS NOT NULL))::integer) + ((table_of_contents_item_id IS NOT NULL))::integer) + ((basemap_id IS NOT NULL))::integer) = 1))
);


--
-- Name: TABLE access_control_lists; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.access_control_lists IS '
@omit all,many
@name acl
Access Control Lists can be associated with SketchClasses, Forums, and 
potentially other application resources to allow admins to control access based
on admin privileges or group membership. The behavior of the system is primarily
driven by the `type` and `groups` settings.

The [AUTHORIZATION.md file](https://github.com/seasketch/next/blob/master/packages/db/AUTHORIZATION.md#content-managed-by-an-access-control-list)
details how ACL functionality was added to the Forums type, and can be used as a
template to add ACL features to new types if needed.
';


--
-- Name: COLUMN access_control_lists.project_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.access_control_lists.project_id IS '@omit';


--
-- Name: COLUMN access_control_lists.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.access_control_lists.type IS 'Control whether access control is PUBLIC, ADMINS_ONLY, or GROUP';


--
-- Name: project_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_groups (
    id integer NOT NULL,
    project_id integer NOT NULL,
    name text NOT NULL,
    CONSTRAINT namechk CHECK (((char_length(name) <= 32) AND (char_length(name) > 0)))
);


--
-- Name: TABLE project_groups; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.project_groups IS '@name groups
@omit all,filter
@simpleCollections only
User groups designated by the project administrators. User groups can be used to
assign access control privileges to users. 

Note that only admins have access to groups, or direct knowlege of what groups a
user belongs to. If an admin wanted to create an *Assholes* group they are 
free to do so.
';


--
-- Name: COLUMN project_groups.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_groups.name IS 'Label for the group.';


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
-- Name: account_exists(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.account_exists(email text) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    AS $$
    select case when exists (select
      1
    from
      users
    where
      canonical_email = email) 
    then true else false end;
  $$;


--
-- Name: FUNCTION account_exists(email text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.account_exists(email text) IS '@omit';


--
-- Name: add_group_to_acl(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_group_to_acl("aclId" integer, "groupId" integer) RETURNS public.access_control_lists
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      pid int;
      acl access_control_lists;
    BEGIN
      select project_id into pid from access_control_lists where id = "aclId";
      if session_is_admin(pid) then
        insert into access_control_list_groups (access_control_list_id, group_id) values ("aclId", "groupId");
      else
        raise exception 'Must be an administrator';
      end if;
      select * into acl from access_control_lists where id = "aclId";
      return acl;
    END
  $$;


--
-- Name: FUNCTION add_group_to_acl("aclId" integer, "groupId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.add_group_to_acl("aclId" integer, "groupId" integer) IS 'Add a group to a given access control list. Must be an administrator.';


--
-- Name: sprites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sprites (
    id integer NOT NULL,
    project_id integer,
    type public.sprite_type,
    md5 text NOT NULL,
    category text,
    deleted boolean DEFAULT false
);


--
-- Name: TABLE sprites; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sprites IS '
@omit all
@simpleCollections only
Image sprites for use in Mapbox GL Styles. The database holds metadata about the sprite, the actual images are in cloud storage referenced by the URL parameter. 
';


--
-- Name: COLUMN sprites.project_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sprites.project_id IS 'If unset, sprite will be available for use in all projects';


--
-- Name: COLUMN sprites.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sprites.type IS 'Optional. Indicates whether the image is intended for use with particular GL Styles';


--
-- Name: COLUMN sprites.md5; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sprites.md5 IS 'Hash of lowest-dpi image in the set (pixelRatio=1). Useful for de-duplicating symbols that have been imported multiple times';


--
-- Name: add_image_to_sprite(integer, integer, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_image_to_sprite("spriteId" integer, "pixelRatio" integer, width integer, height integer, image text) RETURNS public.sprites
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      sprite sprites;
    begin
    if session_is_admin((select project_id from sprites where id = "spriteId")) then
      insert into sprite_images (sprite_id, pixel_ratio, width, height, url) values ("spriteId", "pixelRatio", width, height, image);
      select * into sprite from sprites where id = "spriteId";
      return sprite;
    else
      raise 'Not authorized';
    end if;
    end;
$$;


--
-- Name: FUNCTION add_image_to_sprite("spriteId" integer, "pixelRatio" integer, width integer, height integer, image text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.add_image_to_sprite("spriteId" integer, "pixelRatio" integer, width integer, height integer, image text) IS '@omit';


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
-- Name: add_user_to_group_update_survey_invites_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_user_to_group_update_survey_invites_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Add survey invites for any surveys that are part of this group that they don't already have
  insert into survey_invites (
    user_id,
    was_added_from_group,
    survey_id
  ) select
    NEW.user_id,
    true,
    survey_id
  from
    survey_invited_groups
  where
    survey_invited_groups.group_id = NEW.group_id and
    not exists (
      select
        1
      from
        survey_invites
      where
        survey_invites.was_added_from_group = true and 
        survey_invites.survey_id = survey_invited_groups.survey_id and
        survey_invites.user_id = NEW.user_id
    );
	RETURN NEW;
END;
$$;


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
-- Name: FUNCTION add_valid_child_sketch_class(parent integer, child integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.add_valid_child_sketch_class(parent integer, child integer) IS '
Add a SketchClass to the list of valid children for a Collection-type SketchClass.
';


--
-- Name: after_deleted__data_sources(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_deleted__data_sources() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    if OLD.bucket_id is not null and OLD.object_key is not null and OLD.upload_task_id is null then
      insert into deleted_geojson_objects (object_key, bucket) values (OLD.object_key, OLD.bucket_id);
    end if;
    return OLD;
  END;
$$;


--
-- Name: after_insert_or_update_or_delete_project_invite_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_insert_or_update_or_delete_project_invite_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    pid int;
    iid int;
  begin
    if NEW is null then
      -- deleting
      select id, project_id into iid, pid from project_invites where id = OLD.project_invite_id;
      if pid is not null and iid is not null then
        perform pg_notify(concat('graphql:project:', pid, ':project_invite_status_change'), json_build_object('inviteId', iid)::text);
        return NEW;
      else
        -- Don't raise error to prevent issues with DELETE CASCADE on project_invites
        -- raise exception 'Could not find project_invite';
        return NEW;
      end if;
    elsif NEW.project_invite_id is null then
      -- surveys
      return NEW;
    elsif OLD.status != NEW.status then
      select id, project_id into iid, pid from project_invites where id = NEW.project_invite_id;
      if pid is not null and iid is not null then
        perform pg_notify(concat('graphql:project:', pid, ':project_invite_status_change'), json_build_object('inviteId', iid)::text);
        return NEW;
      else
        raise exception 'Could not find project_invite';
      end if;
    else
      return NEW;
    end if;
  end;
  $$;


--
-- Name: after_post_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_post_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    begin
      insert into pending_topic_notifications (
        user_id, 
        topic_id
      ) select distinct 
          posts.author_id, 
          NEW.topic_id
        from
          posts
        where
          posts.topic_id = NEW.topic_id and
          -- don't notify anyone who has unsubscribed from this topic
          posts.author_id not in (select user_id from topic_notification_unsubscribes where topic_id = NEW.topic_id) and
          -- don't notify self
          posts.author_id != NEW.author_id
      on conflict do nothing;
      return NEW;
    end;
  $$;


--
-- Name: after_response_submission(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_response_submission() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    begin
      update
        survey_invites
      set 
        was_used = true
      where
        survey_invites.survey_id = NEW.survey_id and (
          survey_invites.user_id = nullif(current_setting('session.user_id', TRUE), '')::int or
          survey_invites.email = nullif(current_setting('session.canonical_email', TRUE), '') or
          survey_invites.email = nullif(current_setting('session.survey_invite_email', TRUE), '')
        );
      return NEW;
    end;
  $$;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    legacy_id text,
    sub text,
    registered_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    onboarded timestamp with time zone,
    canonical_email text NOT NULL
);


--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS '
@omit all
The SeaSketch User type is quite sparse since authentication is handled by Auth0
and we store no personal information unless the user explicitly adds it to the
user `Profile`.

During operation of the system, users identify themselves using bearer tokens. 
These tokens contain ephemeral information like `canonical_email` which can be
used to accept project invite tokens.
';


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

COMMENT ON COLUMN public.users.onboarded IS '
Indicates whether the user has seen post-registration information. Can be 
updated with `confirmOnboarded()` mutation. 

Since this field is a date, it could
hypothetically be reset as terms of service are updated, though it may be better
to add a new property to track that.
';


--
-- Name: COLUMN users.canonical_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.canonical_email IS '@omit';


--
-- Name: approve_participant(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_participant("projectId" integer, "userId" integer) RETURNS public.users
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      user users;
    BEGIN
      IF session_is_admin("projectId") or session_is_superuser() THEN
        update project_participants set approved = true, denied_by = null, approved_by = nullif(current_setting('session.user_id', TRUE), '')::integer, approved_or_denied_on = now() where user_id = "userId" and project_id = "projectId";
        select * into user from users where users.id = "userId";
        return user;
      ELSE
        raise exception 'You must be a project administrator';
      END IF;
    END
  $$;


--
-- Name: survey_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_responses (
    id integer NOT NULL,
    survey_id integer NOT NULL,
    user_id integer,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_draft boolean DEFAULT false NOT NULL,
    is_duplicate_ip boolean DEFAULT false NOT NULL,
    is_duplicate_entry boolean DEFAULT false NOT NULL,
    is_unrecognized_user_agent boolean DEFAULT false NOT NULL,
    bypassed_duplicate_submission_control boolean DEFAULT false NOT NULL,
    outside_geofence boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone,
    is_facilitated boolean DEFAULT false NOT NULL,
    is_practice boolean DEFAULT false NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    last_updated_by_id integer,
    offline_id uuid,
    CONSTRAINT survey_responses_data_check CHECK ((char_length((data)::text) < 10000))
);


--
-- Name: TABLE survey_responses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.survey_responses IS '@omit create';


--
-- Name: COLUMN survey_responses.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.survey_responses.user_id IS 'User account that submitted the survey. Note that if isFacilitated is set, the account may not be who is represented by the response content.';


--
-- Name: COLUMN survey_responses.data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.survey_responses.data IS 'JSON representation of responses, keyed by the form field export_id';


--
-- Name: COLUMN survey_responses.is_draft; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.survey_responses.is_draft IS 'Users may save their responses for later editing before submission. After submission they can no longer edit them.';


--
-- Name: COLUMN survey_responses.is_duplicate_ip; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.survey_responses.is_duplicate_ip IS '
@omit create
Detected by comparing ip hashes from previous entries. IP hashes are not tied to particular responses, so only the second and subsequent entries are flagged.
';


--
-- Name: COLUMN survey_responses.is_duplicate_entry; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.survey_responses.is_duplicate_entry IS '
@omit create
Duplicate entries are detected by matching contact-information field values.
';


--
-- Name: COLUMN survey_responses.is_unrecognized_user_agent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.survey_responses.is_unrecognized_user_agent IS '
@omit create
Unusual or missing user-agent headers on submissions are flagged. May indicate scripting but does not necessarily imply malicious intent.
';


--
-- Name: COLUMN survey_responses.bypassed_duplicate_submission_control; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.survey_responses.bypassed_duplicate_submission_control IS '
Should be set by the client on submission and tracked by cookies or localStorage. Surveys that permit only a single entry enable users to bypass the limit for legitimate purposes, like entering responses on a shared computer.
';


--
-- Name: COLUMN survey_responses.outside_geofence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.survey_responses.outside_geofence IS '
@omit create
Checked on SUBMISSION, so adding or changing a survey geofence after responses have been submitted will not update values. GPS coordinates and IP addresses are not stored for privacy purposes.
';


--
-- Name: COLUMN survey_responses.is_facilitated; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.survey_responses.is_facilitated IS 'If true, a logged-in user entered information on behalf of another person, so userId is not as relevant.';


--
-- Name: COLUMN survey_responses.offline_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.survey_responses.offline_id IS 'Should be used by clients to uniquely identify responses that are collected offline. Survey facilitators can download their responses to disk as json so that they may be recovered/submitted in the case of the client machine being damaged or stolen. Tracking an offline uuid ensures that these responses are not somehow submitted in duplicate.';


--
-- Name: archive_responses(integer[], boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.archive_responses(ids integer[], "makeArchived" boolean) RETURNS SETOF public.survey_responses
    LANGUAGE sql
    AS $$
    update survey_responses set archived = "makeArchived" where id = any(ids) returning survey_responses.*;
$$;


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
-- Name: basemaps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.basemaps (
    id integer NOT NULL,
    project_id integer,
    name text NOT NULL,
    type public.basemap_type NOT NULL,
    url text NOT NULL,
    tile_size integer DEFAULT 256 NOT NULL,
    labels_layer_id text,
    thumbnail text NOT NULL,
    attribution text,
    terrain_url text,
    terrain_tile_size integer DEFAULT 512 NOT NULL,
    terrain_max_zoom integer DEFAULT 14 NOT NULL,
    terrain_optional boolean DEFAULT true NOT NULL,
    terrain_visibility_default boolean DEFAULT true NOT NULL,
    terrain_exaggeration numeric DEFAULT 1 NOT NULL,
    description text,
    interactivity_settings_id integer NOT NULL,
    is_disabled boolean DEFAULT false NOT NULL,
    surveys_only boolean DEFAULT false NOT NULL,
    use_default_offline_tile_settings boolean DEFAULT true NOT NULL
);


--
-- Name: COLUMN basemaps.project_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.basemaps.project_id IS 'If not set, the basemap will be considered a "Shared Basemap" that can be added to any project. Otherwise it is private to the given proejct. Only superusers can create Shared Basemaps.';


--
-- Name: COLUMN basemaps.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.basemaps.name IS 'Label shown in the basemap picker interface';


--
-- Name: COLUMN basemaps.url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.basemaps.url IS 'For MAPBOX types, this can be a mapbox://-style url or a link to a custom mapbox gl style. For RASTER_URL_TEMPLATE, it should be a url template conforming to the [raster source documetation](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#tiled-sources)';


--
-- Name: COLUMN basemaps.tile_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.basemaps.tile_size IS 'For use with RASTER_URL_TEMPLATE types. See the [raster source documetation](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#tiled-sources)';


--
-- Name: COLUMN basemaps.labels_layer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.basemaps.labels_layer_id IS 'Identify the labels layer lowest in the stack so that overlay layers may be placed underneath.';


--
-- Name: COLUMN basemaps.thumbnail; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.basemaps.thumbnail IS 'Square thumbnail will be used to identify the basemap';


--
-- Name: COLUMN basemaps.attribution; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.basemaps.attribution IS 'Optional attribution to show at the bottom of the map. Will be overriden by the attribution specified in the gl-style in the case of MAPBOX types.';


--
-- Name: COLUMN basemaps.terrain_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.basemaps.terrain_url IS 'Terrain data source url. Leave blank to disable 3d terrain. See [mapbox gl style terrain documentation](https://docs.mapbox.com/mapbox-gl-js/style-spec/terrain/).';


--
-- Name: COLUMN basemaps.terrain_optional; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.basemaps.terrain_optional IS 'If set to false, terrain will always be on. Otherwise the user will be given a toggle switch.';


--
-- Name: COLUMN basemaps.interactivity_settings_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.basemaps.interactivity_settings_id IS '
@omit create
';


--
-- Name: COLUMN basemaps.is_disabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.basemaps.is_disabled IS '
Used to indicate whether the basemap is included in the public basemap listing. Useful for hiding an option temporarily, or adding a basemap to the project which will only be used in surveys.
';


--
-- Name: form_elements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_elements (
    id integer NOT NULL,
    form_id integer NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    export_id text,
    "position" integer DEFAULT 1 NOT NULL,
    component_settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    type_id text NOT NULL,
    body jsonb NOT NULL,
    background_color text,
    secondary_color text,
    text_variant public.form_element_text_variant DEFAULT 'DYNAMIC'::public.form_element_text_variant NOT NULL,
    background_image text,
    layout public.form_element_layout,
    background_palette text[],
    unsplash_author_name text,
    unsplash_author_url text,
    background_width integer,
    background_height integer,
    jump_to_id integer,
    alternate_language_settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    subordinate_to integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    map_camera_options jsonb,
    map_basemaps integer[],
    CONSTRAINT form_fields_component_settings_check CHECK ((char_length((component_settings)::text) < 200000)),
    CONSTRAINT form_fields_position_check CHECK (("position" > 0))
);


--
-- Name: TABLE form_elements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.form_elements IS '
@omit all
*FormElements* represent input fields or read-only content in a form. Records contain fields to support
generic functionality like body, position, and isRequired. They 
also have a JSON `componentSettings` field that can have custom data to support
a particular input type, indicated by the `type` field.

Project administrators have full control over managing form elements through
graphile-generated CRUD mutations.
';


--
-- Name: COLUMN form_elements.form_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_elements.form_id IS 'Form this field belongs to.';


--
-- Name: COLUMN form_elements.is_required; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_elements.is_required IS 'Users must provide input for these fields before submission.';


--
-- Name: COLUMN form_elements.export_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_elements.export_id IS '
Column name used in csv export, property name in reporting tools. Keep stable to avoid breaking reports. If null, this value will be dynamically generated from the first several characters of the text in FormElement.body.
';


--
-- Name: COLUMN form_elements."position"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_elements."position" IS '
Determines order of field display. Clients should display fields in ascending 
order. Cannot be changed individually. Use `setFormElementOrder()` mutation to 
update.
';


--
-- Name: COLUMN form_elements.component_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_elements.component_settings IS 'Type-specific configuration. For example, a Choice field might have a list of valid choices.';


--
-- Name: COLUMN form_elements.body; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_elements.body IS '
[prosemirror](https://prosemirror.net/) document representing a rich-text question or informational content. Level 1 headers can be assumed to be the question for input-type fields, though formatting is up to the project administrators. Clients should provide a template that encourages this convention when building forms.
';


--
-- Name: COLUMN form_elements.background_color; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_elements.background_color IS '
Optional background color to transition the form to when this element is displayed.
';


--
-- Name: COLUMN form_elements.secondary_color; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_elements.secondary_color IS '
Color used to style navigation controls
';


--
-- Name: COLUMN form_elements.text_variant; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_elements.text_variant IS '
Indicates whether the form element should be displayed with dark or light text variants to match the background color. Admin interface should automatically set this value based on `background_color`, though admins may wish to manually override.
';


--
-- Name: COLUMN form_elements.background_image; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_elements.background_image IS '
@omit create,update
Optional background image to display when this form_element appears.
';


--
-- Name: COLUMN form_elements.layout; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_elements.layout IS '
Layout of image in relation to form_element content.
';


--
-- Name: COLUMN form_elements.unsplash_author_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_elements.unsplash_author_name IS '@omit create,update';


--
-- Name: COLUMN form_elements.unsplash_author_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_elements.unsplash_author_url IS '@omit create,update';


--
-- Name: COLUMN form_elements.jump_to_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_elements.jump_to_id IS '
Used only in surveys. If set, the survey will advance to the page of the specified form element. If null, the survey will simply advance to the next question in the list by `position`.
';


--
-- Name: COLUMN form_elements.subordinate_to; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_elements.subordinate_to IS '
Used for special elements like SpatialAccessPriorityInput to create a sort of sub-form that the parent element controls the rendering of. Will not appear in the form unless the client implementation utilizes something like FormElement.shouldDisplaySubordinateElement to control visibility.
';


--
-- Name: COLUMN form_elements.map_camera_options; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_elements.map_camera_options IS '
If using a map-based layout, can be used to set the default starting point of the map

See https://docs.mapbox.com/mapbox-gl-js/api/properties/#cameraoptions
```json
{
  "center": [-73.5804, 45.53483],
  "pitch": 60,
  "bearing": -60,
  "zoom": 10
}
```
';


--
-- Name: COLUMN form_elements.map_basemaps; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_elements.map_basemaps IS 'IDs for basemaps that should be included in the map view if a map layout is selected';


--
-- Name: basemaps_related_form_elements(public.basemaps); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.basemaps_related_form_elements(basemap public.basemaps) RETURNS SETOF public.form_elements
    LANGUAGE sql STABLE
    AS $$
    select * from form_elements where basemap.id = any(form_elements.map_basemaps);
  $$;


--
-- Name: FUNCTION basemaps_related_form_elements(basemap public.basemaps); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.basemaps_related_form_elements(basemap public.basemaps) IS '@simpleCollections only';


--
-- Name: before_basemap_insert_create_interactivity_settings_func(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_basemap_insert_create_interactivity_settings_func() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      iid int;
    begin
      if new.interactivity_settings_id is null then
        insert into interactivity_settings (type) values ('NONE') returning id into iid;
        new.interactivity_settings_id = iid;
      end if;
      return new;
    end;
  $$;


--
-- Name: before_delete_sketch_class_check_form_element_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_delete_sketch_class_check_form_element_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  begin
    if (OLD.form_element_id is not null and (select count(*) from form_elements where id = OLD.form_element_id) > 0) then
      raise exception 'Sketch Class is associated with a form element. Delete form element first';
    end if;
    return OLD;
    end;
  $$;


--
-- Name: before_deleted__data_layers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_deleted__data_layers() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    insert into deleted_data_layers (
      data_source_id,
      data_layer_id,
      project_id,
      data_upload_task_id,
      bucket_id,
      object_key,
      outputs
    ) select 
        OLD.data_source_id,
        data_layers.id, 
        data_layers.project_id, 
        data_sources.upload_task_id, 
        data_sources.bucket_id, 
        data_sources.object_key, 
        data_upload_tasks.outputs
      from data_layers 
      inner join data_sources on data_sources.id = OLD.data_source_id 
      inner join data_upload_tasks on data_upload_tasks.id = data_sources.upload_task_id 
      where data_layers.id = OLD.id;
      return OLD;
    END;
  $$;


--
-- Name: before_insert_form_elements_func(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_insert_form_elements_func() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    begin
      new.position = (select coalesce(max(position), 0) + 1 from form_elements where form_id = new.form_id);
      return new;
    end;
  $$;


--
-- Name: before_insert_or_update_data_layers_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_insert_or_update_data_layers_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  declare
    source_type text;
    max_z int;
  begin
    select type into source_type from data_sources where id = new.data_source_id;
    if source_type is null then
      raise 'Unknown source type. %', (new.data_source_id);
    end if;
    if new.sublayer is not null and source_type != 'arcgis-dynamic-mapserver' then
      raise 'sublayer property can only be specified for layers associated with a arcgis-dynamic-mapserver source';
    end if;
    if source_type = 'vector' then
      if new.source_layer is null then
        raise 'Layers with "vector" data sources must specify a source_layer';
      end if;
    elsif source_type != 'seasketch-mvt' then
      if new.source_layer is not null then
        raise 'Only Layers with data_sources of type "vector" or "seasketch-mvt should specify a source_layer';
      end if;
    end if;
    if (source_type = 'vector' or source_type = 'geojson' or source_type = 'seasketch-vector' or source_type = 'seasketch-mvt') then
      if new.mapbox_gl_styles is null then
        raise 'Vector layers must specify mapbox_gl_styles';
      end if;
    else
      if new.mapbox_gl_styles is not null then
        raise 'Layers with data_sources of type % should not specify mapbox_gl_styles', (source_type);
      end if;
    end if;
    if old is null then
      -- assign a z-index
      select max(z_index) + 1 into max_z from data_layers where project_id = new.project_id;
      if max_z is null then
        max_z = 0;
      end if;
      new.z_index = max_z;
    end if;
    return new;
  end;
$$;


--
-- Name: before_insert_or_update_data_sources_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_insert_or_update_data_sources_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  declare
    bucket_id text;
  begin
    if new.minzoom is not null and (new.type != 'vector' and new.type != 'raster' and new.type != 'raster-dem' and new.type != 'seasketch-mvt' ) then
      raise 'minzoom may only be set for tiled sources (vector, raster, raster-dem)';
    end if;
    if new.coordinates is null and (new.type = 'video' or new.type = 'image') then
      raise 'coordinates must be set on image and video sources';
    end if;
    if new.coordinates is not null and (new.type != 'video' and new.type != 'image') then
      raise 'coordinates property can only be set on image and video sources';
    end if;
    if new.maxzoom is not null and (new.type = 'image' or new.type = 'video') then
      raise 'maxzoom cannot be set for image and video sources';
    end if;
    if new.url is null and (new.type = 'geojson' or new.type = 'image' or new.type = 'arcgis-dynamic-mapserver' or new.type = 'arcgis-vector' or new.type = 'seasketch-mvt') then
      raise 'url must be set for "%" sources', (new.type);
    end if;
    if new.scheme is not null and (new.type != 'raster' and new.type != 'raster-dem' and new.type != 'vector' and new.type != 'seasketch-mvt') then
      raise 'scheme property is not allowed for "%" sources', (new.type);
    end if;
    if new.tiles is not null and (new.type != 'raster' and new.type != 'raster-dem' and new.type != 'vector' and new.type != 'seasketch-vector') then
      raise 'tiles property is not allowed for "%" sources', (new.type);
    end if;
    if new.encoding is not null and new.type != 'raster-dem' then
      raise 'encoding property only allowed on raster-dem sources';
    end if;
    if new.tile_size is not null and (new.type != 'raster' and new.type != 'raster-dem' and new.type != 'vector' and new.type != 'seasketch-mvt') then
      raise 'tile_size property is not allowed for "%" sources', (new.type);
    end if;
    if (new.type != 'geojson' and new.type != 'seasketch-vector') and (new.buffer is not null or new.cluster is not null or new.cluster_max_zoom is not null or new.cluster_properties is not null or new.cluster_radius is not null or new.generate_id is not null or new.line_metrics is not null or new.promote_id is not null or new.tolerance is not null) then
      raise 'geojson props such as buffer, cluster, generate_id, etc not allowed on % sources', (new.type);
    end if;
    if (new.byte_length is not null and new.type != 'seasketch-vector' and new.type != 'seasketch-mvt') then
      raise 'byte_length can only be set on seasketch-vector sources';
    end if;
    if (new.type = 'seasketch-vector' and new.type != 'seasketch-mvt' and new.byte_length is null) then
      raise 'seasketch-vector and mvt sources must have byte_length set to an approximate value';
    end if;
    if new.urls is not null and new.type != 'video' then
      raise 'urls property not allowed on % sources', (new.type);
    end if;
    if new.query_parameters is not null and (new.type != 'arcgis-vector' and new.type != 'arcgis-dynamic-mapserver') then
      raise 'query_parameters property not allowed on % sources', (new.type);
    end if;
    if new.use_device_pixel_ratio is not null and new.type != 'arcgis-dynamic-mapserver' then
      raise 'use_device_pixel_ratio property not allowed on % sources', (new.type);
    end if;
    if new.import_type is not null and new.type != 'seasketch-vector' and new.type != 'seasketch-mvt' then
      raise 'import_type property is only allowed for seasketch-vector sources';
    end if;
    if new.import_type is null and (new.type = 'seasketch-vector' or new.type = 'seasketch-mvt') then
      raise 'import_type property is required for seasketch-vector sources';
    end if;
    if new.original_source_url is not null and new.type != 'seasketch-vector' then
      raise 'original_source_url may only be set on seasketch-vector sources';
    end if;
    if new.enhanced_security is not null and new.type != 'seasketch-vector' then
      raise 'enhanced_security may only be set on seasketch-vector sources';
    end if;
    if old is null and new.type = 'seasketch-vector' then
      if new.bucket_id is null then
        new.bucket_id = (select data_sources_bucket_id from projects where id = new.project_id);
      end if;
      if new.object_key is null then
        new.object_key = (select gen_random_uuid());
      end if;
      new.tiles = null;
      new.url = null;
    end if;
    return new;
  end;
$$;


--
-- Name: before_insert_or_update_form_logic_conditions_100(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_insert_or_update_form_logic_conditions_100() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    form_element_type_id text;
    is_supported boolean;
  begin
    select type_id into form_element_type_id from form_elements where id = NEW.subject_id;
    select ARRAY[NEW.operator] && supported_operators into is_supported from form_element_types where component_name = form_element_type_id limit 1;
    if is_supported = false then
      raise exception 'Unsupported operator "%" for type %', NEW.operator, form_element_type_id;
    end if;
    return NEW;
  end;
$$;


--
-- Name: before_insert_or_update_form_logic_rules_100(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_insert_or_update_form_logic_rules_100() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  begin
    IF NEW.command = 'JUMP' THEN
      IF NEW.jump_to_id is null THEN
        raise exception 'jump_to_id must be set if command=JUMP';
      END IF;
    ELSE
      IF NEW.jump_to_id is not null then
        raise exception 'jump_to_id must be null if command != JUMP';
      end if;
    END IF;
    IF NEW.position is null then
      NEW.position = (select coalesce(max(position), 0) + 1 from form_logic_rules where form_element_id in (select id from form_elements where form_id = (select form_id from form_elements where id = NEW.form_element_id)));
      -- raise exception 'position is null %', NEW.position;
    end if;
    return NEW;
  end;
$$;


--
-- Name: before_insert_or_update_table_of_contents_items_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_insert_or_update_table_of_contents_items_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  begin
    if old.is_folder != new.is_folder then
      raise 'Cannot change is_folder. Create a new table of contents item';
    end if;
    if old.is_draft = false then
      raise 'Cannot alter table of contents items after they are published';
    end if;
    if new.sort_index is null then
      new.sort_index = (select coalesce(max(sort_index), -1) + 1 from table_of_contents_items where is_draft = true and project_id = new.project_id and parent_stable_id = new.parent_stable_id or (parent_stable_id is null and new.parent_stable_id is null));
    end if;
    if old is null and new.is_draft = true then -- inserting
      -- verify that stable_id is unique among draft items
      if (select count(id) from table_of_contents_items where stable_id = new.stable_id and is_draft = true) > 0 then
        raise '% is not a unique stable_id.', new.stable_id;
      end if;
      -- set path
      if new.parent_stable_id is null then
        new.path = new.stable_id;
      else
        if (select count(id) from table_of_contents_items where is_draft = true and stable_id = new.parent_stable_id) > 0 then
          -- set path, finding path of parent and appending to it
          new.path = (select path from table_of_contents_items where is_draft = true and stable_id = new.parent_stable_id) || new.stable_id;
        else
          raise 'Cannot find parent item with stable_id=%', new.parent_stable_id;
        end if;
      end if;
    end if;
    if new.is_folder then
      if new.data_layer_id is not null then
        raise 'Folders cannot have data_layer_id set';
      end if;
      if new.metadata is not null then
        raise 'Folders cannot have metadata set';
      end if;
      if new.bounds is not null then
        raise 'Folders cannot have bounds set';
      end if;
    else
      if new.data_layer_id is null then
        raise 'data_layer_id must be set if is_folder=false';
      end if;
      if new.show_radio_children then
        raise 'show_radio_children must be false if is_folder=false';
      end if;
      if new.is_click_off_only then
        raise 'is_click_off_only must be false if is_folder=false';
      end if;
    end if;
    return new;
  end;
$$;


--
-- Name: before_invite_emails_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_invite_emails_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  begin
    -- assigning to_address
    if NEW.project_invite_id is not null then
      NEW.to_address = (select email from project_invites where id = NEW.project_invite_id);
    end if;

    -- check if user has compained in any other emails
    if exists (
      select 
        1
      from 
        invite_emails
      where
        to_address = NEW.to_address and
        status = 'COMPLAINT'
    ) then
      return NULL;
    end if;

    if NEW.project_invite_id is not null then
      if exists (
        select 1 from invite_emails 
        where project_invite_id = new.project_invite_id and
        status = 'QUEUED'
      ) then
        return NULL;
      end if;
    end if;
    if NEW.survey_invite_id is not null then
      if exists (
        select 1 from invite_emails where 
        survey_invite_id = new.survey_invite_id and
        status = 'QUEUED'
      ) then
        return NULL;
      end if;
    end if;
    return new;
  end;
$$;


--
-- Name: before_invite_emails_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_invite_emails_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  begin
    NEW.updated_at = now();
    return new;
  end;
$$;


--
-- Name: before_layer_insert_create_interactivity_settings_func(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_layer_insert_create_interactivity_settings_func() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      iid int;
    begin
      if new.interactivity_settings_id is null then
        insert into interactivity_settings (type) values ('NONE') returning id into iid;
        new.interactivity_settings_id = iid;
      end if;
      return new;
    end;
  $$;


--
-- Name: before_response_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_response_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  begin
    NEW.updated_at = now();
    if OLD.user_id != NEW.user_id then
      raise exception 'Cannot change userid';
    end if;
    if it_me(OLD.user_id) and not session_is_admin((select project_id from surveys where surveys.id = OLD.survey_id)) then
      if OLD.is_draft = false then
        raise exception 'Cannot edit submitted responses. Contact an admin and ask them to put your response into draft mode';
      end if;
    else
      if not session_is_admin((select project_id from surveys where surveys.id = OLD.survey_id)) then
        raise exception 'Must be a project administrator';
      -- else
      --   if OLD.is_draft != false or NEW.is_draft != true then
      --     raise exception 'Admins can only put responses back into draft mode';
      --   end if;
      end if;
    end if;
    return NEW;
  end;
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
        select geometrytype(NEW.user_geom) into new_geometry_type;
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
-- Name: before_survey_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_survey_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    num int;
  begin
    select count(*)::int from survey_responses into num where survey_id = OLD.id and (user_id is null or user_id != current_setting('session.user_id', TRUE)::integer);
    if num >= 5 then
      raise exception 'Preventing deletion. Survey has 5 or more responses from other users. Contact support@seasketch.org or simply disable survey.';
    end if;
    return OLD;
  end;
$$;


--
-- Name: before_survey_invited_groups_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_survey_invited_groups_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  begin
    if not exists (select id from project_groups where id = NEW.group_id and project_id = (select project_id from surveys where id = NEW.survey_id)) then
      raise exception 'Surveys may only invite participant groups from the same project';
    end if;
    return new;
  end;
$$;


--
-- Name: before_survey_response_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_survey_response_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    existing survey_response_network_addresses;
  begin
    if current_setting('session.request_ip', true) is not null then
      update
        survey_response_network_addresses
      set num_responses = num_responses + 1
      where
        ip_hash = crypt(
          current_setting('session.request_ip', true) || NEW.survey_id::text, 
          ip_hash
        )
      returning
        *
      into 
        existing;
      if existing is not null then
        NEW.is_duplicate_ip = true;
      else
        insert into survey_response_network_addresses (
          survey_id, 
          ip_hash
        ) values (
          NEW.survey_id,
          crypt(
            current_setting('session.request_ip', true) || NEW.survey_id::text, 
            gen_salt('bf')
          )
        );
      end if;
    end if;
    return NEW;
  end;
$$;


--
-- Name: before_survey_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_survey_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  begin
    if NEW.is_disabled = false and not exists(select * from forms where survey_id = NEW.id) then
      raise exception 'A blank or template form must be assigned to this survey before publishing.';
    end if;
    return new;
  end;
$$;


--
-- Name: before_update_sketch_class_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.before_update_sketch_class_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    begin
      if NEW.geometry_type != OLD.geometry_type then
        raise exception 'Cannot change geometry type of a sketch class';
      end if;
      return NEW;
    end;
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
-- Name: FUNCTION can_digitize(scid integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.can_digitize(scid integer) IS '@omit';


--
-- Name: cancel_data_upload(integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_data_upload(project_id integer, upload_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    begin
      if session_is_admin(project_id) then
        delete from data_upload_tasks where id = upload_id and state = 'awaiting_upload';
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;


--
-- Name: check_allowed_layouts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_allowed_layouts() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
        if (select NEW.layout is null or allowed_layouts is null or NEW.layout = any(allowed_layouts) from form_element_types where component_name = NEW.type_id) then
          return NEW;
        else
          raise exception '% is not an allowed layout for this component', NEW.layout;
        end if;
    END;
$$;


--
-- Name: check_element_type(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_element_type() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    is_required boolean;
  BEGIN
    -- skip if the deletion is caused by a cascade from the form being deleted
    if (select count(id) from forms where id = OLD.form_id) > 0 then
      select is_required_for_surveys into is_required from form_element_types where component_name = OLD.type_id;
      if is_required then
        raise exception 'Cannot delete elements of type %', OLD.type_id;
      else
        return OLD;
      end if;
    else
      return OLD;
    end if;
  END;
$$;


--
-- Name: check_optional_basemap_layers_columns(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_optional_basemap_layers_columns() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  begin
    if new.group_type != 'NONE'::optional_basemap_layers_group_type and new.group_label is null then
      raise 'group_label must be set unless group_type is NONE';
    end if;
    return new;
  end;
$$;


--
-- Name: cleanup_tile_package(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_tile_package() RETURNS trigger
    LANGUAGE plpgsql
    AS $$BEGIN
  PERFORM graphile_worker.add_job('cleanupDeletedTilePackage', json_build_object('packageId', OLD.id));
  RETURN OLD;
END;$$;


--
-- Name: clear_form_element_style(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clear_form_element_style(form_element_id integer) RETURNS public.form_elements
    LANGUAGE sql
    AS $$
    update form_elements set background_image = null, background_color = null, layout = null, background_palette = null, secondary_color = null, text_variant = 'DYNAMIC', unsplash_author_url = null, unsplash_author_name = null, background_width = null, background_height = null where form_elements.id = form_element_id returning *;
  $$;


--
-- Name: confirm_onboarded(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_onboarded() RETURNS public.users
    LANGUAGE sql SECURITY DEFINER
    AS $$
    update users set onboarded = now() where it_me(id) = true returning *;
$$;


--
-- Name: FUNCTION confirm_onboarded(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.confirm_onboarded() IS '
Confirm that a new user has seen any onboarding materials. Updates User.onboarded date.
';


--
-- Name: confirm_project_invite(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_project_invite(invite_id integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      userid int;
      project_invite project_invites;
    begin
      select current_setting('session.user_id')::int into userid;
      if userid is null then
        raise exception 'Not signed in';
      end if;
      if (select current_setting('session.escalate_privileges', true)) != 'on' then
        raise exception 'Permission denied';
      end if;
      if exists (select id from project_invites where id = invite_id and was_used = true) then
        raise exception 'Invite has already been used';
      end if;
      -- set was_used to true
      -- set user_id on project_invite
      update project_invites set user_id = userid, was_used = true where id = invite_id returning * into project_invite;
      if project_invite is null then
        raise exception 'Cannot find invite with id %', invite_id;
      end if;
      -- create project participant record, respecting make_admin setting
      insert into project_participants (
        user_id, 
        project_id, 
        is_admin, 
        approved,
        share_profile,
        requested_at
      ) values (
        userid,
        project_invite.project_id,
        project_invite.make_admin,
        true,
        false,
        now()
      ) on conflict on constraint project_participants_pkey
      do update
        set approved = true,
        is_admin = (project_participants.is_admin or project_invite.make_admin);
      -- add any group access permissions
      insert into project_group_members (group_id, user_id)
      select group_id, userid from 
        project_invite_groups
      where
        project_invite_groups.invite_id = project_invite.id
      on conflict do nothing;
      return userid;
    end;
  $$;


--
-- Name: FUNCTION confirm_project_invite(invite_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.confirm_project_invite(invite_id integer) IS '@omit';


--
-- Name: confirm_project_invite_with_survey_token(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_project_invite_with_survey_token("projectId" integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    begin
      -- check that there is a user logged in with a verified email
      if nullif(current_setting('session.user_id', TRUE), '')::int is not null and nullif(current_setting('session.survey_invite_email', TRUE), '')::text is not null then
        -- check if there is an invite that matches that email
        if exists(select 1 from project_invites where email = nullif(current_setting('session.survey_invite_email', TRUE), '')) then
          -- if so, run confirm_project_invite(invite_id)
          return (
            select confirm_project_invite((
              select id from project_invites where email = nullif(current_setting('session.survey_invite_email', TRUE), '')
            ))
          );
        else
          raise exception 'No sent invite matching your email found';
        end if;
      else
        raise exception 'Must be logged in with a verified email and have x-ss-survey-invite-token header set';
      end if;
    end;
  $$;


--
-- Name: FUNCTION confirm_project_invite_with_survey_token("projectId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.confirm_project_invite_with_survey_token("projectId" integer) IS '
Project invites can be paired with survey invites so that users can be sent an
email inviting them to a survey, then use that survey invite to confirm a 
project invitation. This way there are no duplicative emails sent.

Clients must set x-ss-survey-invite-token header before calling this mutation.
';


--
-- Name: confirm_project_invite_with_verified_email(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_project_invite_with_verified_email("projectId" integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    begin
      -- check that there is a user logged in with a verified email
      if nullif(current_setting('session.user_id', TRUE), '')::int is not null and nullif(current_setting('session.canonical_email', TRUE), '')::text is not null and nullif(current_setting('session.email_verified', TRUE), '')::boolean is true then
        -- check if there is an invite that matches that email
        if exists(select 1 from project_invites where email = current_setting('session.canonical_email', TRUE) and exists(select 1 from invite_emails where status != 'QUEUED' and project_invite_id = project_invites.id)) then
          -- if so, run confirm_project_invite(invite_id)
          return (select confirm_project_invite((select id from project_invites where email = current_setting('session.canonical_email', TRUE))));
        else
          raise exception 'No sent invite matching your email found';
        end if;
      else
        raise exception 'Must be logged in with a verified email';
      end if;
    end;
  $$;


--
-- Name: FUNCTION confirm_project_invite_with_verified_email("projectId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.confirm_project_invite_with_verified_email("projectId" integer) IS '
Users can confirm project invites without clicking thru an email if they are 
registered for SeaSketch and their verified email matches that of a project 
invite. Outstanding (or confirmed) invites can be accessed via the 
`currentProject.invite` query.

More details on how to handle invites can be found [on the wiki](https://github.com/seasketch/next/wiki/User-Ingress#project-invites).
';


--
-- Name: copy_appearance(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.copy_appearance(form_element_id integer, copy_from_id integer) RETURNS public.form_elements
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      return_value form_elements;
    begin
      if true or session_is_admin((project_id_for_form_id((select form_id from form_elements where id = form_element_id)))) then
        update 
          form_elements dst
        set background_image = f.background_image,
        background_color = f.background_color,
        secondary_color = f.secondary_color,
        background_palette = f.background_palette,
        unsplash_author_name = f.unsplash_author_name,
        unsplash_author_url = f.unsplash_author_url,
        background_height = f.background_height,
        background_width = f.background_width,
        layout = f.layout,
        text_variant = f.text_variant
        from
          form_elements f
        where
          f.id = copy_from_id and
          dst.id = form_element_id
        returning
          *
        into return_value;
        
        return return_value;      
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;


--
-- Name: FUNCTION copy_appearance(form_element_id integer, copy_from_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.copy_appearance(form_element_id integer, copy_from_id integer) IS 'Copies appearance settings like layout and background_image from one form element to another. Useful when initializing custom appearance on an element from the defaults set by a previous question.';


--
-- Name: create_basemap_acl(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_basemap_acl() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if new.project_id is not null then
  insert into
    access_control_lists(project_id, basemap_id, type)
    values(new.project_id, new.id, 'public'::access_control_list_type);
  end if;
  return new;
end;
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
-- Name: FUNCTION create_bbox(geom public.geometry); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_bbox(geom public.geometry) IS '@omit';


--
-- Name: create_consent_document(integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_consent_document(fid integer, version integer, url text) RETURNS public.form_elements
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      doc survey_consent_documents;
      element form_elements;
    begin
      if session_is_admin(project_id_from_field_id(fid)) = false then
        raise exception 'Must be project admin';
      end if;
      insert into survey_consent_documents (form_element_id, version, url) values (fid, version, url) returning * into doc;
      -- update form element component_settings with new values
      update form_elements
        set component_settings = jsonb_set(jsonb_set(component_settings, '{documentVersion}'::text[], to_jsonb(version)), '{documentUrl}'::text[], to_jsonb(url))
      where id = fid returning * into element;
      return element;
    end
  $$;


--
-- Name: FUNCTION create_consent_document(fid integer, version integer, url text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_consent_document(fid integer, version integer, url text) IS '@omit';


--
-- Name: data_upload_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_upload_tasks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    started_at timestamp with time zone,
    state public.data_upload_state DEFAULT 'awaiting_upload'::public.data_upload_state NOT NULL,
    progress numeric,
    filename text NOT NULL,
    content_type text NOT NULL,
    error_message text,
    outputs jsonb,
    user_id integer NOT NULL,
    CONSTRAINT data_upload_tasks_progress_check CHECK (((progress <= 1.0) AND (progress >= 0.0)))
);


--
-- Name: COLUMN data_upload_tasks.progress; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_upload_tasks.progress IS '0.0 to 1.0 scale, applies to tiling process.';


--
-- Name: COLUMN data_upload_tasks.filename; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_upload_tasks.filename IS 'Original name of file as uploaded by the user.';


--
-- Name: COLUMN data_upload_tasks.content_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_upload_tasks.content_type IS 'Content-Type of the original upload.';


--
-- Name: create_data_upload(text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_data_upload(filename text, project_id integer, content_type text) RETURNS public.data_upload_tasks
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      upload data_upload_tasks;
      used bigint;
      quota bigint;
    begin
      if session_is_admin(project_id) then
        select projects_data_hosting_quota_used(projects.*), projects_data_hosting_quota(projects.*) into used, quota from projects where id = project_id;
        if quota - used > 0 then
          insert into data_upload_tasks(project_id, filename, content_type, user_id) values (create_data_upload.project_id, create_data_upload.filename, create_data_upload.content_type, nullif(current_setting('session.user_id', TRUE), '')::integer) returning * into upload;
          return upload;
        else
          raise exception 'data hosting quota exceeded';
        end if;
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;


--
-- Name: create_form_element_associated_sketch_class(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_form_element_associated_sketch_class() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      pid int;
      template_id int;
      s boolean;
      sc sketch_classes;
    begin
      select sketch_class_template_id, form_element_types.is_spatial into template_id, s from form_element_types where component_name = NEW.type_id;
      if s = true then
        select project_id into pid from surveys where id = (
          select survey_id from forms where id = NEW.form_id limit 1
        );
        if pid is null then
          raise exception 'project_id is null %, %', NEW.form_id, NEW;
        end if;
        -- raise log 'template %, %', (select allow_multi from sketch_classes where sketch_classes.id = template_id), template_id;
        -- raise log 'results % - %', template_id, (select row_to_json(T.*) from (select
        --   pid,
        --   'generated',
        --   NEW.id,
        --   geometry_type,
        --   allow_multi,
        --   geoprocessing_project_url, 
        --   geoprocessing_client_url, 
        --   geoprocessing_client_name, 
        --   mapbox_gl_style
        -- from sketch_classes
        -- where sketch_classes.id = template_id) as T);
        insert into sketch_classes (
          project_id, 
          name, 
          form_element_id,
          geometry_type, 
          allow_multi, 
          geoprocessing_project_url, 
          geoprocessing_client_url, 
          geoprocessing_client_name, 
          mapbox_gl_style
        ) (select
            pid,
            format('generated-form-element-%s', NEW.id),
            NEW.id,
            geometry_type,
            allow_multi,
            geoprocessing_project_url, 
            geoprocessing_client_url, 
            geoprocessing_client_name, 
            mapbox_gl_style
          from sketch_classes
          where sketch_classes.id = template_id)
          returning * into sc;
          perform initialize_sketch_class_form_from_template(sc.id, (
            select id from forms where sketch_class_id = template_id
          ));
      end if;
      return NEW;
    end;
  $$;


--
-- Name: forms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forms (
    id integer NOT NULL,
    sketch_class_id integer,
    survey_id integer,
    is_template boolean DEFAULT false NOT NULL,
    template_type public.form_template_type,
    template_name text,
    CONSTRAINT must_have_template_name_if_is_template CHECK (((template_name IS NOT NULL) OR (is_template = false))),
    CONSTRAINT template_types_only_if_is_template CHECK (((template_type IS NULL) OR (is_template = true)))
);


--
-- Name: TABLE forms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.forms IS '
@omit all
Custom user-input Forms are used in two places in SeaSketch. For SketchClasses,
Forms are used to add attributes to spatial features. In Surveys, Forms are used
in support of gathering response data.

Forms have any number of *FormElements* ordered by a `position` field, and form 
contents may be hidden depending on the evaluation of *FormConditionalRenderingRules*.

Forms typically belong to either a *Survey* or *SketchClass* exclusively. Some
Forms may be designated as a template, in which case they belong to neither. 
Only superusers can create form templates, and clients should provide templates
as an option when creating new forms.
';


--
-- Name: COLUMN forms.sketch_class_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.forms.sketch_class_id IS 'Related *SketchClass*';


--
-- Name: COLUMN forms.survey_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.forms.survey_id IS 'Related *Survey*';


--
-- Name: COLUMN forms.is_template; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.forms.is_template IS '
SeaSetch superusers can create template forms than can be used when creating 
SketchClasses or Surveys. These templates can be created using the 
`createFormTemplateFromSketchClass` and `createFormTemplateFromSurvey` 
mutations. Template forms can be listed with the root-level `templateForms` 
query.
';


--
-- Name: COLUMN forms.template_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.forms.template_type IS 'Indicates which features should use this form as a template';


--
-- Name: COLUMN forms.template_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.forms.template_name IS 'Chosen by superusers upon template creation';


--
-- Name: create_form_template_from_sketch_class(integer, text, public.form_template_type); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_form_template_from_sketch_class("sketchClassId" integer, "templateName" text, template_type public.form_template_type) RETURNS public.forms
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      form forms;
      original_id int;
    begin
      select id into original_id from forms where sketch_class_id = "sketchClassId";
      insert into forms (sketch_class_id, is_template, template_name, template_type) values (null, true, "templateName", template_type) returning * into form;
      insert into 
        form_elements (
          form_id, 
          body, 
          type_id, 
          is_required, 
          export_id, 
          position, 
          component_settings
        ) 
      select 
        form.id, 
        body, 
        type_id, 
        is_required, 
        export_id, 
        position, 
        component_settings
      from
        form_elements
      where
        form_id = original_id;
      return form;
    end
  $$;


--
-- Name: create_form_template_from_survey(integer, text, public.form_template_type); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_form_template_from_survey("surveyId" integer, "templateName" text, template_type public.form_template_type) RETURNS public.forms
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      form forms;
      original_id int;
    begin
      select id into original_id from forms where survey_id = "surveyId";
      insert into forms (survey_id, is_template, template_name, template_type) values (null, true, "templateName", template_type) returning * into form;
      insert into 
        form_elements (
          form_id, 
          body,
          type_id, 
          is_required, 
          export_id, 
          position, 
          component_settings
        ) 
      select 
        form.id, 
        body, 
        type_id, 
        is_required, 
        export_id, 
        position, 
        component_settings
      from
        form_elements
      where
        form_id = original_id;
      return form;
    end
  $$;


--
-- Name: create_forum_acl(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_forum_acl() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into
    access_control_lists(project_id, forum_id_read, type)
    values(new.project_id, new.id, 'public'::access_control_list_type);

  insert into
    access_control_lists(project_id, forum_id_write, type)
    values(new.project_id, new.id, 'public'::access_control_list_type);
  return new;
end;
$$;


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id integer NOT NULL,
    topic_id integer NOT NULL,
    author_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    message_contents jsonb DEFAULT '{}'::jsonb NOT NULL,
    hidden_by_moderator boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE posts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.posts IS '@omit create,update';


--
-- Name: COLUMN posts.message_contents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.posts.message_contents IS '@omit';


--
-- Name: COLUMN posts.hidden_by_moderator; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.posts.hidden_by_moderator IS 'If set, the post has been hidden by a project admin. Contents of the post will not be available to the client. Admins should update this field using `setPostHiddenByModerator()`.';


--
-- Name: create_post(jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_post(message jsonb, "topicId" integer) RETURNS public.posts
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      post posts;
      pid int;
      is_archived boolean;
      locked boolean;
      is_admin boolean;
    begin
      select
        project_id,
        archived,
        topics.locked,
        session_is_admin(project_id)
      from
        forums
      into
        pid,
        is_archived,
        locked,
        is_admin
      inner join
        topics
      on
        topics.id = "topicId"
      where
        forums.id = topics.forum_id;
      if session_has_project_access(pid) = false then
        raise exception 'Project access permission denied';
      end if;
      if session_on_acl((select id from access_control_lists where forum_id_write = (select forum_id from topics where id = "topicId"))) = false then
        raise exception 'Permission denied';
      end if;
      if not exists(select 1 from project_participants where it_me(user_id) and project_id = pid and share_profile = true) then
        raise exception 'User profile must be shared in order to post in the forum';
      end if;
      if session_is_banned_from_posting(pid) then
        raise exception 'Forum posts have been disabled for this user';
      end if;
      if is_admin = false and locked = true then
        raise exception 'Cannot post to a locked topic';
      end if;
      if is_admin = false and is_archived = true then
        raise exception 'Cannot post to archived forums';
      end if;
      insert into posts (message_contents, topic_id, author_id) values (message, "topicId", current_setting('session.user_id', TRUE)::int) returning * into post;
      return post;
    end;
  $$;


--
-- Name: FUNCTION create_post(message jsonb, "topicId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_post(message jsonb, "topicId" integer) IS '
Must have write permission for the specified forum. Create reply to a discussion topic. `message` must be JSON, something like the output of DraftJS.
';


--
-- Name: get_default_data_sources_bucket(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_default_data_sources_bucket() RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
  declare
    bucket_id text;
  begin
    select url into bucket_id from data_sources_buckets where region = 'us-west-2';
    if bucket_id is null then
      select url into bucket_id from data_sources_buckets limit 1;
    end if;
    return bucket_id;
  end
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
    access_control public.project_access_control_setting DEFAULT 'admins_only'::public.project_access_control_setting NOT NULL,
    is_listed boolean DEFAULT true NOT NULL,
    logo_url text,
    logo_link text,
    is_featured boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    region public.geometry(Polygon) DEFAULT public.st_geomfromgeojson('{"coordinates":[[[-157.05324470015358,69.74201326987497],[135.18377661193057,69.74201326987497],[135.18377661193057,-43.27449014737426],[-157.05324470015358,-43.27449014737426],[-157.05324470015358,69.74201326987497]]],"type":"Polygon"}'::text) NOT NULL,
    data_sources_bucket_id text DEFAULT public.get_default_data_sources_bucket(),
    invite_email_subject text DEFAULT 'You have been invited to a SeaSketch project'::text NOT NULL,
    support_email text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    creator_id integer NOT NULL,
    mapbox_secret_key text,
    mapbox_public_key text,
    is_offline_enabled boolean DEFAULT false,
    data_hosting_quota bigint DEFAULT 524288000 NOT NULL,
    CONSTRAINT disallow_unlisted_public_projects CHECK (((access_control <> 'public'::public.project_access_control_setting) OR (is_listed = true))),
    CONSTRAINT is_public_key CHECK (((mapbox_public_key IS NULL) OR (mapbox_public_key ~* '^pk\..+'::text))),
    CONSTRAINT is_secret CHECK (((mapbox_secret_key IS NULL) OR (mapbox_secret_key ~* '^sk\..+'::text))),
    CONSTRAINT name_min_length CHECK ((length(name) >= 4))
);


--
-- Name: TABLE projects; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.projects IS '
@omit create,delete
SeaSketch Project type. This root type contains most of the fields and queries
needed to drive the application.
';


--
-- Name: COLUMN projects.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.description IS 'Should be a short length in order to fit in the project header.';


--
-- Name: COLUMN projects.legacy_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.legacy_id IS '@omit';


--
-- Name: COLUMN projects.slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.slug IS 'Short identifier for the project used in the url. This property cannot be changed after project creation.';


--
-- Name: COLUMN projects.access_control; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.access_control IS 'Admins can control whether a project is public, invite-only, or admins-only.';


--
-- Name: COLUMN projects.is_listed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.is_listed IS 'Project admins can decide whether their project will be displayed on the public project listing via Query.projectsConnection.';


--
-- Name: COLUMN projects.logo_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.logo_url IS 'URL referencing an image that will be used to represent the project. Will be displayed at 48x48 pixels and must be a public url.';


--
-- Name: COLUMN projects.logo_link; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.logo_link IS 'If a logoUrl is provided, it will link to this url in a new window if provided.';


--
-- Name: COLUMN projects.is_featured; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.is_featured IS 'Featured projects may be given prominent placement on the homepage. This property can only be modified by superusers.';


--
-- Name: COLUMN projects.is_deleted; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.is_deleted IS '@omit';


--
-- Name: COLUMN projects.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.deleted_at IS '@omit';


--
-- Name: COLUMN projects.mapbox_secret_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.mapbox_secret_key IS '
@omit
';


--
-- Name: COLUMN projects.data_hosting_quota; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.data_hosting_quota IS '@omit';


--
-- Name: create_project(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_project(name text, slug text, OUT project public.projects) RETURNS public.projects
    LANGUAGE plpgsql STRICT SECURITY DEFINER
    AS $$
  begin
    if current_setting('session.email_verified', true) = 'true' then
      insert into projects (name, slug, is_listed, creator_id, support_email) 
        values (name, slug, false, current_setting('session.user_id', true)::int, current_setting('session.canonical_email', true)) returning * into project;
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
-- Name: project_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_invites (
    id integer NOT NULL,
    project_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id integer,
    was_used boolean DEFAULT false NOT NULL,
    fullname text,
    email public.email NOT NULL,
    make_admin boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE project_invites; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.project_invites IS '
@omit all,update
@simpleCollections only
Admins can invite users to their project, adding them to user groups and 
distributing admin privileges as needed. Invitations can be immediately sent via
email or they can be sent out later in batches. 

Use the `createProjectInvites()`
mutation to create one or more invitations and then use graphile generated 
mutations to update and delete them.

Details on [handling user ingress with invitation tokens](https://github.com/seasketch/next/wiki/User-Ingress#project-invites) and [the mailer subsystem](https://github.com/seasketch/next/wiki/User-and-Survey-Invite-Management) can be found on the wiki.
';


--
-- Name: COLUMN project_invites.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_invites.user_id IS 'Is set upon invite acceptance.';


--
-- Name: COLUMN project_invites.was_used; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_invites.was_used IS 'Project invite has already been accepted.';


--
-- Name: COLUMN project_invites.fullname; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_invites.fullname IS 'Specified by admin when invite was created.';


--
-- Name: COLUMN project_invites.email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_invites.email IS 'Specified by admin when invite was created.';


--
-- Name: COLUMN project_invites.make_admin; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_invites.make_admin IS 'User will be made an admin of the project if true. They will not be given special access until their email is verified.';


--
-- Name: create_project_invites(integer, boolean, boolean, text[], public.project_invite_options[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_project_invites("projectId" integer, "sendEmailNow" boolean, "makeAdmin" boolean, "groupNames" text[], "projectInviteOptions" public.project_invite_options[]) RETURNS SETOF public.project_invites
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      invite_ids int[];
      invite_id int;
      options project_invite_options;
      i_id int;
      invites project_invites[];
      existing_participants project_participants[];
    begin
      if (select session_is_admin("projectId")) = false then
        raise exception 'Must be project administrator';
      end if;

      with ins as (
        insert into project_invites (
          project_id,
          make_admin,
          email,
          fullname
        ) 
        select 
          "projectId",
          "makeAdmin",
          email, 
          fullname 
        from 
          unnest("projectInviteOptions")
        on conflict do nothing
        returning id
      )
      select array_agg(id) into invite_ids from ins;

      -- add to groups if exists
      if "groupNames" is not null and array_length("groupNames", 1) > 0 then
          insert into
            project_invite_groups (
              invite_id,
              group_id
            )
          select
            unnest(invite_ids),
            project_groups.id
          from
            project_groups
          where
            project_groups.name = any("groupNames") and
            project_id = "projectId"
          ;
      end if;
      -- afterwards, create invite_emails records if "sendEmailsNow" is true
      if "sendEmailNow" = true then
        perform send_project_invites((
          select
            array_agg(id)
          from
            project_invites
          where
            email in (select email from unnest("projectInviteOptions"))
        ));
      end if;
      return query select * from project_invites where project_id = "projectId" and email in (select email from unnest("projectInviteOptions"));
    end;
  $$;


--
-- Name: FUNCTION create_project_invites("projectId" integer, "sendEmailNow" boolean, "makeAdmin" boolean, "groupNames" text[], "projectInviteOptions" public.project_invite_options[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_project_invites("projectId" integer, "sendEmailNow" boolean, "makeAdmin" boolean, "groupNames" text[], "projectInviteOptions" public.project_invite_options[]) IS '
Create a set of project invites from a set of emails and optional names. Clients
should implement this feature as a simple textarea where admins can copy and 
paste a set of names and emails from a spreadsheet.#

Invites can be assigned to a list of groups and optional admin permission. The
function can either send these invite emails immediately or they can be manually
sent later.

More details on project invite management [can be found in the wiki](https://github.com/seasketch/next/wiki/User-and-Survey-Invite-Management).
';


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
-- Name: create_sprite(integer, text, public.sprite_type, integer, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_sprite("projectId" integer, _md5 text, _type public.sprite_type, _pixel_ratio integer, _width integer, _height integer, _url text) RETURNS public.sprites
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    sprite sprites;
  begin
    if session_is_admin("projectId") = false then
      raise 'Not authorized';
    end if;
    -- if _pixel_ratio != 1 then
    --   raise 'New sprites can only be created with an image with a pixel_ratio of 1';
    -- end if;
    if _url is null then
      raise 'Must be called with a url';
    end if;
    if _md5 is null then
      raise 'Must be called with an md5 hash';
    end if;
    select * into sprite from sprites where project_id = "projectId" and sprites.md5 = _md5 and deleted = false limit 1;
    if sprite is null then
      insert into sprites (project_id, type, md5) values ("projectId", _type, _md5) returning * into sprite;
    end if;
    insert into sprite_images (sprite_id, pixel_ratio, width, height, url) values (sprite.id, _pixel_ratio, _width, _height, _url);
    return sprite;
  end;
$$;


--
-- Name: FUNCTION create_sprite("projectId" integer, _md5 text, _type public.sprite_type, _pixel_ratio integer, _width integer, _height integer, _url text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_sprite("projectId" integer, _md5 text, _type public.sprite_type, _pixel_ratio integer, _width integer, _height integer, _url text) IS '@omit';


--
-- Name: survey_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_invites (
    id integer NOT NULL,
    survey_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    was_used boolean DEFAULT false NOT NULL,
    fullname text,
    email public.email,
    was_added_from_group boolean DEFAULT false NOT NULL,
    user_id integer
);


--
-- Name: TABLE survey_invites; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.survey_invites IS '@omit all';


--
-- Name: COLUMN survey_invites.was_added_from_group; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.survey_invites.was_added_from_group IS '
@omit
Indicates that the invite was created due to user membership of a group and not manually added. Manually added users are not removed by group membership-related triggers
';


--
-- Name: create_survey_invites(integer, boolean, boolean, text[], public.survey_invite_options[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_survey_invites("surveyId" integer, "includeProjectInvite" boolean, "makeAdmin" boolean, "groupNames" text[], "surveyInviteOptions" public.survey_invite_options[]) RETURNS SETOF public.survey_invites
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    invite_ids int[];
    pid int;
  begin
    select project_id into pid from surveys where id = "surveyId";
    if (select session_is_admin(pid)) = false then
      raise exception 'Must be project administrator';
    end if;

    
    with ins as (
    insert into survey_invites (
      survey_id,
      email,
      fullname
    ) 
    select 
      "surveyId",
      email, 
      fullname 
    from 
      unnest("surveyInviteOptions")
    on conflict do nothing
    returning id
     ) select array_agg(id) into invite_ids from ins;

    if "includeProjectInvite" is true then
      perform create_project_invites(pid, false, "makeAdmin", "groupNames", "surveyInviteOptions");
    end if;
    return query select * from survey_invites where id = any(invite_ids);
  end;
$$;


--
-- Name: form_logic_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_logic_rules (
    id integer NOT NULL,
    form_element_id integer NOT NULL,
    boolean_operator public.form_logic_operator DEFAULT 'OR'::public.form_logic_operator NOT NULL,
    command public.form_logic_command NOT NULL,
    jump_to_id integer,
    "position" integer NOT NULL
);


--
-- Name: TABLE form_logic_rules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.form_logic_rules IS '
@omit all
Form logic rules can be used to hide or show FormElements based on the values of 
preceeding fields in a SketchClass. They can also define page jump logic within a Survey.
';


--
-- Name: create_survey_jump_rule(integer, integer, public.form_logic_operator, public.field_rule_operator); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_survey_jump_rule("formElementId" integer, "jumpToId" integer, "booleanOperator" public.form_logic_operator, operator public.field_rule_operator) RETURNS public.form_logic_rules
    LANGUAGE plpgsql
    AS $$
    declare
      logic_rule form_logic_rules;
    begin
      insert into form_logic_rules (form_element_id, boolean_operator, command, jump_to_id) values ("formElementId", 'OR', 'JUMP', "jumpToId") returning * into logic_rule;
      insert into form_logic_conditions (rule_id, subject_id, operator) values (logic_rule.id, "formElementId", "operator");
      return logic_rule;
    end;
  $$;


--
-- Name: FUNCTION create_survey_jump_rule("formElementId" integer, "jumpToId" integer, "booleanOperator" public.form_logic_operator, operator public.field_rule_operator); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_survey_jump_rule("formElementId" integer, "jumpToId" integer, "booleanOperator" public.form_logic_operator, operator public.field_rule_operator) IS '
Initializes a new FormLogicRule with a single condition and command=JUMP.
';


--
-- Name: create_survey_response(integer, json, boolean, boolean, boolean, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_survey_response("surveyId" integer, response_data json, facilitated boolean, draft boolean, bypassed_submission_control boolean, practice boolean, offline_id uuid) RETURNS public.survey_responses
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      access_type survey_access_type;
      is_disabled boolean;
      pid int;
      response survey_responses;
    begin
      select 
        surveys.project_id, 
        surveys.access_type, 
        surveys.is_disabled 
      into 
        pid, 
        access_type, 
        is_disabled 
      from 
        surveys 
      where 
        surveys.id = "surveyId";
      -- TODO: improve access control to consider group membership
      if session_is_admin(pid) or (is_disabled = false and (access_type = 'PUBLIC'::survey_access_type) or (access_type = 'INVITE_ONLY'::survey_access_type and session_member_of_group((select array_agg(group_id) from survey_invited_groups where survey_id = "surveyId")))) then
        insert into survey_responses (survey_id, data, user_id, is_draft, is_facilitated, bypassed_duplicate_submission_control, is_practice, offline_id) values ("surveyId", response_data, nullif(current_setting('session.user_id', TRUE), '')::int, draft, facilitated, bypassed_submission_control, practice, offline_id) returning * into response;
        return response;
      else
        raise exception 'Access denied to % survey. is_disabled = %', access_type, is_disabled;
      end if;
    end;
  $$;


--
-- Name: create_table_of_contents_item_acl(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_table_of_contents_item_acl() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into
    access_control_lists(project_id, table_of_contents_item_id, type)
    values(new.project_id, new.id, 'public'::access_control_list_type);
      return new;
end;
$$;


--
-- Name: topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topics (
    id integer NOT NULL,
    title text NOT NULL,
    forum_id integer NOT NULL,
    author_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    sticky boolean DEFAULT false NOT NULL,
    locked boolean DEFAULT false NOT NULL,
    CONSTRAINT titlechk CHECK ((char_length(title) <= 80))
);


--
-- Name: TABLE topics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.topics IS '@omit create';


--
-- Name: COLUMN topics.title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.topics.title IS 'Title displayed in the topics listing. Can be updated in the first 5 minutes after creation.';


--
-- Name: COLUMN topics.sticky; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.topics.sticky IS '
Sticky topics will be listed at the topic of the forum.

Can be toggled by project admins using `setTopicSticky()` mutation.
';


--
-- Name: COLUMN topics.locked; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.topics.locked IS '
Locked topics can only be posted to by project admins and will display a lock symbol.

Can be toggled by project admins using `setTopicLocked()` mutation.
';


--
-- Name: create_topic(integer, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_topic("forumId" integer, title text, message jsonb) RETURNS public.topics
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      topic topics;
      pid int;
    begin
      select project_id into pid from forums where id = "forumId";
      if session_has_project_access(pid) = false then
        raise exception 'Project access permission denied';
      end if;
      if not exists(select 1 from project_participants where it_me(user_id) and project_id = pid and share_profile = true) then
        raise exception 'User profile must be shared in order to post in the forum';
      end if;
      if session_is_banned_from_posting(pid) then
        raise exception 'Forum posts have been disabled for this user';
      end if;
      if session_on_acl((select id from access_control_lists where forum_id_write = "forumId")) = false then
        raise exception 'Permission denied';
      elsif exists(select 1 from forums where id = "forumId" and archived = true) then
        raise exception 'Cannot post to archived forums';
      else
        insert into topics (title, forum_id, author_id) values (title, "forumId", current_setting('session.user_id', TRUE)::int) returning * into topic;
        insert into posts (topic_id, author_id, message_contents) values (topic.id, current_setting('session.user_id', TRUE)::int, message);
        return topic;
      end if;
    end;
  $$;


--
-- Name: FUNCTION create_topic("forumId" integer, title text, message jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_topic("forumId" integer, title text, message jsonb) IS '
Must have write permission for the specified forum. Create a new discussion topic, including the first post. `message` must be JSON, something like the output of DraftJS.
';


--
-- Name: create_upload_task_job(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_upload_task_job() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    perform graphile_worker.add_job('processDataUpload', json_build_object('uploadId', NEW.id), max_attempts := 1);
    RETURN NEW;
END;
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
-- Name: FUNCTION current_project(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.current_project() IS '@deprecated Use projectBySlug() instead';


--
-- Name: current_project_access_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_project_access_status() RETURNS public.project_access_status
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      access_control_setting project_access_control_setting;
      approved_request boolean;
      uid int;
      admin_bit boolean;
      pid int;
      email_verified boolean;
    begin
      select nullif (current_setting('session.project_id', TRUE), '')::integer into pid;
      select nullif (current_setting('session.user_id', TRUE), '')::integer into 
      uid;
      select is_admin(pid, uid) into admin_bit;
      if current_setting('session.email_verified', TRUE) = 'true' then
        email_verified = true;
      else
        email_verified = false;
      end if;
      SELECT
        access_control
      into
        access_control_setting
      FROM
        projects
      WHERE
        id = pid;
      if access_control_setting is null then
        return 'PROJECT_DOES_NOT_EXIST'::project_access_status;
      end if;
      if session_has_project_access(pid) then
        return 'GRANTED'::project_access_status;
      end if;
      if uid is null then
        return 'DENIED_ANON'::project_access_status;
      end if;
      if access_control_setting = 'admins_only'::project_access_control_setting then
        if admin_bit and email_verified = false then
          return 'DENIED_EMAIL_NOT_VERIFIED'::project_access_status;
        else
          return 'DENIED_ADMINS_ONLY'::project_access_status;
        end if;
      end if;
      -- access control setting must be invite_only
      select 
        approved into approved_request 
      from 
        project_participants 
      where 
        user_id = uid and project_id = pid;
      if approved_request is null then
        return 'DENIED_NOT_REQUESTED'::project_access_status;
      elsif approved_request is false then
        return 'DENIED_NOT_APPROVED'::project_access_status;
      elsif email_verified is false then
        return 'DENIED_EMAIL_NOT_VERIFIED'::project_access_status;
      end if;
      raise exception 'Unknown reason for denying project access. userid = %, project_id = %', uid, pid;
    end;
$$;


--
-- Name: FUNCTION current_project_access_status(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.current_project_access_status() IS '@deprecated Use project_access_status(slug) instead';


--
-- Name: data_hosting_quota_left(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.data_hosting_quota_left(pid integer) RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      sum_bytes bigint;
      quota int;
    begin
      select coalesce(sum(byte_length), 0) into sum_bytes from data_sources where project_id = pid;
      return 524288000 - sum_bytes;
    end;
  $$;


--
-- Name: FUNCTION data_hosting_quota_left(pid integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.data_hosting_quota_left(pid integer) IS '@omit';


--
-- Name: extract_sprite_ids(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.extract_sprite_ids(t text) RETURNS integer[]
    LANGUAGE sql IMMUTABLE
    AS $$
      select array(select i::int from (
        select 
          unnest(regexp_matches(t, 'seasketch://sprites/([^"]+)', 'g')) i 
      ) t)
  $$;


--
-- Name: data_layers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_layers (
    id integer NOT NULL,
    project_id integer NOT NULL,
    data_source_id integer NOT NULL,
    source_layer text,
    sublayer text,
    render_under public.render_under_type DEFAULT 'labels'::public.render_under_type NOT NULL,
    mapbox_gl_styles jsonb,
    z_index integer DEFAULT 0 NOT NULL,
    interactivity_settings_id integer NOT NULL,
    sprite_ids integer[] GENERATED ALWAYS AS (public.extract_sprite_ids((mapbox_gl_styles)::text)) STORED
);


--
-- Name: TABLE data_layers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.data_layers IS '
@omit all
Data layers represent multiple MapBox GL Style layers tied to a single source. 
These layers could also be called "operational layers" in that they are meant to
be overlaid on a basemap.

The layers can appear tied to a TableOfContentsItem or be part of rich features 
associated with a basemap.
';


--
-- Name: COLUMN data_layers.source_layer; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_layers.source_layer IS 'For vector tile sources (VECTOR), references the layer inside the vector tiles that this layer applies to.';


--
-- Name: COLUMN data_layers.sublayer; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_layers.sublayer IS 'For ARCGIS_MAPSERVER and eventually WMS sources. In this case mapbox_gl_styles is blank and this layer merely controls the display of a single sublayer when making image requests.';


--
-- Name: COLUMN data_layers.render_under; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_layers.render_under IS 'Determines z-ordering of layer in relation to layers in the basemap. For this functionality to work, layers must be identified in the basemap configuration.';


--
-- Name: COLUMN data_layers.mapbox_gl_styles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_layers.mapbox_gl_styles IS '
@name mapboxGLStyles
JSON array of MapBox GL Style layers. Layers should not specify an id or sourceId. These will be automatically generated at runtime.
';


--
-- Name: COLUMN data_layers.interactivity_settings_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_layers.interactivity_settings_id IS '@omit create';


--
-- Name: data_layers_sprites(public.data_layers); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.data_layers_sprites(l public.data_layers) RETURNS SETOF public.sprites
    LANGUAGE sql STABLE
    AS $$
  select * from sprites where id in (
      select i::int from (
        select 
          unnest(l.sprite_ids) i 
      ) t)
    ;
$$;


--
-- Name: FUNCTION data_layers_sprites(l public.data_layers); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.data_layers_sprites(l public.data_layers) IS '@simpleCollections only';


--
-- Name: data_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_sources (
    id integer NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    project_id integer NOT NULL,
    type text NOT NULL,
    attribution text,
    bounds numeric[],
    maxzoom integer,
    minzoom integer,
    url text,
    scheme public.tile_scheme,
    tiles text[],
    tile_size integer,
    encoding public.raster_dem_encoding,
    buffer integer,
    cluster boolean,
    cluster_max_zoom integer,
    cluster_properties jsonb,
    cluster_radius integer,
    generate_id boolean,
    line_metrics boolean,
    promote_id boolean,
    tolerance numeric,
    coordinates numeric[],
    urls text[],
    query_parameters jsonb,
    use_device_pixel_ratio boolean,
    import_type text,
    original_source_url text,
    enhanced_security boolean,
    bucket_id text,
    object_key uuid,
    byte_length integer,
    supports_dynamic_layers boolean DEFAULT true NOT NULL,
    uploaded_source_filename text,
    uploaded_source_layername text,
    normalized_source_object_key text,
    normalized_source_bytes integer,
    geostats jsonb,
    upload_task_id uuid,
    CONSTRAINT data_sources_buffer_check CHECK (((buffer >= 0) AND (buffer <= 512))),
    CONSTRAINT data_sources_tile_size_check CHECK (((tile_size = 128) OR (tile_size = 256) OR (tile_size = 512)))
);


--
-- Name: TABLE data_sources; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.data_sources IS '
@omit all
SeaSketch DataSources are analogous to MapBox GL Style sources but are extended
to include new types to support services such as ArcGIS MapServers and content
hosted on the SeaSketch CDN.

When documentation is lacking for any of these properties, consult the [MapBox GL Style docs](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson-promoteId)
';


--
-- Name: COLUMN data_sources.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.id IS 'Should be used as sourceId in stylesheets.';


--
-- Name: COLUMN data_sources.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.type IS 'MapBox GL source type or custom seasketch type.';


--
-- Name: COLUMN data_sources.attribution; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.attribution IS 'Contains an attribution to be displayed when the map is shown to a user.';


--
-- Name: COLUMN data_sources.bounds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.bounds IS 'An array containing the longitude and latitude of the southwest and northeast corners of the source bounding box in the following order: `[sw.lng, sw.lat, ne.lng, ne.lat]`. When this property is included in a source, no tiles outside of the given bounds are requested by Mapbox GL. This property can also be used as metadata for non-tiled sources.';


--
-- Name: COLUMN data_sources.maxzoom; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.maxzoom IS 'For Vector, Raster, GeoJSON and Raster DEM sources. Maximum zoom level for which tiles are available, as in the TileJSON spec. Data from tiles at the maxzoom are used when displaying the map at higher zoom levels.';


--
-- Name: COLUMN data_sources.minzoom; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.minzoom IS 'For Vector, Raster, and Raster DEM sources. Minimum zoom level for which tiles are available, as in the TileJSON spec.';


--
-- Name: COLUMN data_sources.url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.url IS 'A URL to a TileJSON resource for tiled sources. For GeoJSON or SEASKETCH_VECTOR sources, use this to fill in the data property of the source. Also used by ARCGIS_DYNAMIC_MAPSERVER and ARCGIS_VECTOR';


--
-- Name: COLUMN data_sources.scheme; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.scheme IS 'For MapBox Vector and Raster sources. Influences the y direction of the tile coordinates. The global-mercator (aka Spherical Mercator) profile is assumed.';


--
-- Name: COLUMN data_sources.tiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.tiles IS 'For tiled sources, a list of endpoints that can be used to retrieve tiles.';


--
-- Name: COLUMN data_sources.tile_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.tile_size IS 'The minimum visual size to display tiles for this layer. Only configurable for raster layers.';


--
-- Name: COLUMN data_sources.encoding; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.encoding IS 'Raster-DEM only. The encoding used by this source. Mapbox Terrain RGB is used by default';


--
-- Name: COLUMN data_sources.buffer; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.buffer IS 'GeoJSON only. Size of the tile buffer on each side. A value of 0 produces no buffer. A value of 512 produces a buffer as wide as the tile itself. Larger values produce fewer rendering artifacts near tile edges and slower performance.';


--
-- Name: COLUMN data_sources.cluster; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.cluster IS '
GeoJSON only.

If the data is a collection of point features, setting this to true clusters the points by radius into groups. Cluster groups become new Point features in the source with additional properties:

  * cluster Is true if the point is a cluster
  * cluster_id A unqiue id for the cluster to be used in conjunction with the [cluster inspection methods](https://docs.mapbox.com/mapbox-gl-js/api/#geojsonsource#getclusterexpansionzoom)
  * point_count Number of original points grouped into this cluster
  * point_count_abbreviated An abbreviated point count
';


--
-- Name: COLUMN data_sources.cluster_max_zoom; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.cluster_max_zoom IS 'GeoJSON only. Max zoom on which to cluster points if clustering is enabled. Defaults to one zoom less than maxzoom (so that last zoom features are not clustered).';


--
-- Name: COLUMN data_sources.cluster_properties; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.cluster_properties IS 'See [MapBox GL Style docs](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson-clusterProperties).';


--
-- Name: COLUMN data_sources.cluster_radius; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.cluster_radius IS 'GeoJSON only. Radius of each cluster if clustering is enabled. A value of 512 indicates a radius equal to the width of a tile.';


--
-- Name: COLUMN data_sources.generate_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.generate_id IS 'GeoJSON only. Whether to generate ids for the geojson features. When enabled, the feature.id property will be auto assigned based on its index in the features array, over-writing any previous values.';


--
-- Name: COLUMN data_sources.line_metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.line_metrics IS 'GeoJSON only. Whether to calculate line distance metrics. This is required for line layers that specify line-gradient values.';


--
-- Name: COLUMN data_sources.promote_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.promote_id IS 'GeoJSON only. A property to use as a feature id (for feature state). Either a property name, or an object of the form `{<sourceLayer>: <propertyName>}.`';


--
-- Name: COLUMN data_sources.tolerance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.tolerance IS 'GeoJSON only. Douglas-Peucker simplification tolerance (higher means simpler geometries and faster performance).';


--
-- Name: COLUMN data_sources.coordinates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.coordinates IS 'Image sources only. Corners of image specified in longitude, latitude pairs.';


--
-- Name: COLUMN data_sources.urls; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.urls IS 'Video sources only. URLs to video content in order of preferred format.';


--
-- Name: COLUMN data_sources.query_parameters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.query_parameters IS 'ARCGIS_DYNAMIC_MAPSERVER and ARCGIS_VECTOR only. Key-Value object with querystring parameters that will be added to requests.';


--
-- Name: COLUMN data_sources.use_device_pixel_ratio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.use_device_pixel_ratio IS 'ARCGIS_DYNAMIC_MAPSERVER only. When using a high-dpi screen, request higher resolution images.';


--
-- Name: COLUMN data_sources.import_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.import_type IS 'For SeaSketchVector sources, identifies whether the original source comes from a direct upload or a service location like ArcGIS server';


--
-- Name: COLUMN data_sources.original_source_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.original_source_url IS 'For SeaSketchVector sources, identifies location of original service that hosted the data, if any. This can be used to update a layer with an updated copy of the data source if necessary.';


--
-- Name: COLUMN data_sources.enhanced_security; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.enhanced_security IS 'SEASKETCH_VECTOR sources only. When enabled, uploads will be placed in a different class of storage that requires a temporary security credential to access. Set during creation and cannot be changed.';


--
-- Name: COLUMN data_sources.bucket_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.bucket_id IS 'SEASKETCH_VECTOR sources only. S3 bucket where data are stored. Populated from Project.data_sources_bucket on creation.';


--
-- Name: COLUMN data_sources.object_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.object_key IS 'SEASKETCH_VECTOR sources only. S3 object key where data are stored';


--
-- Name: COLUMN data_sources.byte_length; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.byte_length IS 'SEASKETCH_VECTOR sources only. Approximate size of the geojson source';


--
-- Name: COLUMN data_sources.supports_dynamic_layers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.supports_dynamic_layers IS 'ArcGIS map service setting. If enabled, client can reorder layers and apply layer-specific opacity settings.';


--
-- Name: COLUMN data_sources.uploaded_source_layername; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.uploaded_source_layername IS 'If uploaded using a multi-layer file format (gdb), includes the layer ID. SEASKETCH_VECTOR sources only.';


--
-- Name: COLUMN data_sources.normalized_source_object_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.normalized_source_object_key IS 'Sources are converted to flatgeobuf (vector, 4326) or geotif (raster) and store indefinitely so they may be processed into tilesets and to support the download function. SEASKETCH_VECTOR sources only.';


--
-- Name: COLUMN data_sources.normalized_source_bytes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.normalized_source_bytes IS 'Size of the normalized file. SEASKETCH_VECTOR sources only.';


--
-- Name: COLUMN data_sources.geostats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.geostats IS 'mapbox-geostats summary information for vector sources. Useful for cartographic tools and authoring popups. SEASKETCH_VECTOR sources only.';


--
-- Name: COLUMN data_sources.upload_task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources.upload_task_id IS 'UUID of the upload processing job associated with a SEASKETCH_VECTOR source.';


--
-- Name: data_sources_uploaded_by(public.data_sources); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.data_sources_uploaded_by(data_source public.data_sources) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
  declare
    uid int;
    author text;
  begin
    if session_is_admin(data_source.project_id) then
      select user_id into uid from data_upload_tasks where id = data_source.upload_task_id;
      if uid is null then
        return null;
      else
        select coalesce(fullname, nickname, email) into author from user_profiles where user_id = uid;
        if author is null then
          select canonical_email into author from users where id = uid;
        end if;
        return author;
      end if;
    else
      raise exception 'Permission denied';
    end if;
  end
  $$;


--
-- Name: data_upload_tasks_layers(public.data_upload_tasks); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.data_upload_tasks_layers(upload public.data_upload_tasks) RETURNS SETOF public.data_layers
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select * from data_layers where data_source_id in ((select id from data_sources where upload_task_id = upload.id));
  $$;


--
-- Name: FUNCTION data_upload_tasks_layers(upload public.data_upload_tasks); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.data_upload_tasks_layers(upload public.data_upload_tasks) IS '@simpleCollections only';


--
-- Name: offline_tile_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offline_tile_packages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id integer NOT NULL,
    data_source_url text NOT NULL,
    is_mapbox_hosted boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status public.offline_tile_package_status DEFAULT 'QUEUED'::public.offline_tile_package_status NOT NULL,
    total_tiles integer DEFAULT 0 NOT NULL,
    tiles_fetched integer DEFAULT 0 NOT NULL,
    bytes integer DEFAULT 0 NOT NULL,
    region public.geometry(Polygon,4326) NOT NULL,
    max_z integer DEFAULT 11 NOT NULL,
    max_shoreline_z integer,
    source_type public.offline_tile_package_source_type NOT NULL,
    error text,
    original_url_template text NOT NULL,
    CONSTRAINT offline_tile_packages_check CHECK (((max_shoreline_z > max_z) AND (max_shoreline_z <= 16))),
    CONSTRAINT offline_tile_packages_max_z_check CHECK (((max_z >= 6) AND (max_z <= 16)))
);


--
-- Name: TABLE offline_tile_packages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.offline_tile_packages IS '@simpleConnections only';


--
-- Name: COLUMN offline_tile_packages.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offline_tile_packages.status IS '@deprecated Use jobStatus instead';


--
-- Name: COLUMN offline_tile_packages.error; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.offline_tile_packages.error IS '@deprecated Use jobErrors instead';


--
-- Name: delete_offline_tile_package(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_offline_tile_package(id uuid) RETURNS public.offline_tile_packages
    LANGUAGE sql SECURITY DEFINER
    AS $$
    delete from offline_tile_packages where offline_tile_packages.id = delete_offline_tile_package.id and session_is_admin(offline_tile_packages.project_id) returning *;
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
-- Name: delete_table_of_contents_branch(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_table_of_contents_branch("tableOfContentsItemId" integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      toc_id int;
      root_path ltree;
    begin
      if session_is_admin((select project_id from table_of_contents_items where table_of_contents_items.id = "tableOfContentsItemId")) = false then
        raise 'Permission denied. Must be a project admin';
      end if;
      if (select is_draft from table_of_contents_items where table_of_contents_items.id = "tableOfContentsItemId") = false then
        raise 'Cannot delete published table of contents items';
      end if;
      select path into root_path from table_of_contents_items where table_of_contents_items.id = "tableOfContentsItemId";
      for toc_id in
        select table_of_contents_items.id from table_of_contents_items where root_path @> path and is_draft = true
      loop
        execute _delete_table_of_contents_item(toc_id);
      end loop;
      return;
    end;
  $$;


--
-- Name: FUNCTION delete_table_of_contents_branch("tableOfContentsItemId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.delete_table_of_contents_branch("tableOfContentsItemId" integer) IS 'Deletes an item from the draft table of contents, as well as all child items if it is a folder. This action will also delete all related layers and sources (if no other layers reference the source).';


--
-- Name: deny_participant(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.deny_participant("projectId" integer, "userId" integer) RETURNS public.users
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      user users;
    BEGIN
      IF session_is_admin("projectId") or session_is_superuser() THEN
        update project_participants set approved = false, approved_by = null, denied_by = nullif(current_setting('session.user_id', TRUE), '')::integer, approved_or_denied_on = now() where user_id = "userId" and project_id = "projectId";
        select * into user from users where users.id = "userId";
        return user;
      ELSE
        raise exception 'You must be a project administrator';
      END IF;
    END
  $$;


--
-- Name: disable_forum_posting(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.disable_forum_posting("userId" integer, "projectId" integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    begin
      if session_is_admin("projectId") then
        update project_participants set is_banned_from_forums = true where project_id = "projectId" and user_id = "userId";
        return;
      else
        raise exception 'Must be project admin';
      end if;
    end;
  $$;


--
-- Name: FUNCTION disable_forum_posting("userId" integer, "projectId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.disable_forum_posting("userId" integer, "projectId" integer) IS 'Ban a user from posting in the discussion forum';


--
-- Name: dismiss_failed_upload(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dismiss_failed_upload(id uuid) RETURNS public.data_upload_tasks
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      upload data_upload_tasks;
    begin
      if session_is_admin((select project_id from data_upload_tasks where data_upload_tasks.id = dismiss_failed_upload.id)) then
        update data_upload_tasks set state = 'failed_dismissed' where data_upload_tasks.id = dismiss_failed_upload.id returning * into upload;
        return upload;
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;


--
-- Name: email_unsubscribed(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_unsubscribed(email text) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    AS $$
    select case when exists (select
      users.canonical_email,
      email_notification_preferences.unsubscribe_all
    from
      users
    inner join
      email_notification_preferences
    on
      email_notification_preferences.user_id = users.id
    where
      canonical_email = email and
      email_notification_preferences.unsubscribe_all = true
    ) then true else false end;
  $$;


--
-- Name: FUNCTION email_unsubscribed(email text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.email_unsubscribed(email text) IS '@omit';


--
-- Name: enable_forum_posting(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enable_forum_posting("userId" integer, "projectId" integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    begin
      if session_is_admin("projectId") then
        update project_participants set is_banned_from_forums = false where project_id = "projectId" and user_id = "userId";
        return;
      else
        raise exception 'Must be project admin';
      end if;
    end;
  $$;


--
-- Name: FUNCTION enable_forum_posting("userId" integer, "projectId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.enable_forum_posting("userId" integer, "projectId" integer) IS 'Re-enable discussion forum posting for a user that was previously banned.';


--
-- Name: enable_offline_support(integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enable_offline_support(project_id integer, enable boolean) RETURNS public.projects
    LANGUAGE sql SECURITY DEFINER
    AS $$
    update projects set is_offline_enabled = enable where projects.id = project_id and session_is_superuser() returning *; 
  $$;


--
-- Name: export_spatial_responses(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.export_spatial_responses(fid integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      output json;
    begin
    if (session_is_admin(project_id_from_field_id(fid))) then
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', json_agg(jsonb_build_object(
            'type',       'Feature',
            'id',         sketches.id,
            'geometry',   ST_AsGeoJSON(coalesce(geom, user_geom))::jsonb,
            'properties', 
              sketches.properties::jsonb || 
              to_jsonb(
                json_build_object(
                  'response_id', sketches.response_id, 
                  'name', sketches.name, 
                  'area_sq_meters', round(st_area(coalesce(sketches.geom, sketches.user_geom)::geography)),
                  'response_data', survey_responses.data::json->fid::text
                )
              )
          ))
        ) 
        FROM sketches
        INNER JOIN survey_responses
        ON survey_responses.id = sketches.response_id
        where form_element_id = fid 
        into output;
        return output;
    else 
      raise exception 'Not authorized';
    end if;
    end;
  $$;


--
-- Name: FUNCTION export_spatial_responses(fid integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.export_spatial_responses(fid integer) IS '@omit';


--
-- Name: fail_data_upload(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fail_data_upload(id uuid, msg text) RETURNS public.data_upload_tasks
    LANGUAGE sql SECURITY DEFINER
    AS $$
    update data_upload_tasks set state = 'failed', error_message = msg where id = fail_data_upload.id and session_is_admin(project_id) returning *;
  $$;


--
-- Name: form_elements_is_input(public.form_elements); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.form_elements_is_input(el public.form_elements) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    select is_input from form_element_types where form_element_types.component_name = el.type_id;
  $$;


--
-- Name: form_elements_sketch_class(public.form_elements); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.form_elements_sketch_class(form_element public.form_elements) RETURNS public.sketch_classes
    LANGUAGE sql STABLE
    AS $$
    select * from sketch_classes where sketch_classes.form_element_id = form_element.id limit 1;
$$;


--
-- Name: FUNCTION form_elements_sketch_class(form_element public.form_elements); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.form_elements_sketch_class(form_element public.form_elements) IS '
Sketch Class to be used in conjuction with a form element that supports spatial feature input.
';


--
-- Name: form_element_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_element_types (
    component_name text NOT NULL,
    label text NOT NULL,
    is_input boolean DEFAULT false NOT NULL,
    is_surveys_only boolean DEFAULT false NOT NULL,
    is_hidden boolean DEFAULT false NOT NULL,
    is_single_use_only boolean DEFAULT false NOT NULL,
    is_required_for_surveys boolean DEFAULT false NOT NULL,
    supported_operators public.field_rule_operator[] DEFAULT '{}'::public.field_rule_operator[] NOT NULL,
    allowed_layouts public.form_element_layout[],
    is_spatial boolean DEFAULT false NOT NULL,
    sketch_class_template_id integer,
    is_required_for_sketch_classes boolean DEFAULT false NOT NULL,
    allow_admin_updates boolean DEFAULT true NOT NULL
);


--
-- Name: TABLE form_element_types; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.form_element_types IS '
@simpleCollections only
Identifies the type of element in a form, including metadata about that element type.
';


--
-- Name: COLUMN form_element_types.label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_element_types.label IS 'Control form element deployment with feature-flags. If this flag is enabled, the form element should only appear as an option for addition to superuser roles. Once added to a form however, it is visible to all users. No access-control is enforced other than hiding the option in the client.';


--
-- Name: COLUMN form_element_types.is_input; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_element_types.is_input IS 'Whether the element is an input that collects information from users or contains presentational content like a Welcome Message component.';


--
-- Name: COLUMN form_element_types.is_surveys_only; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_element_types.is_surveys_only IS 'If true, the element type should only be added to forms related to a survey.';


--
-- Name: COLUMN form_element_types.is_single_use_only; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_element_types.is_single_use_only IS 'These elements can only be added to a form once.';


--
-- Name: COLUMN form_element_types.is_spatial; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.form_element_types.is_spatial IS 'Indicates if the element type is a spatial data input. Components that implement these types are expected to render their own map (in contrast with elements that simply have their layout set to MAP_SIDEBAR_RIGHT|LEFT, which expect the SurveyApp component to render a map for them.';


--
-- Name: form_elements_type(public.form_elements); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.form_elements_type(e public.form_elements) RETURNS public.form_element_types
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select * from form_element_types where e.type_id = form_element_types.component_name;
$$;


--
-- Name: form_logic_conditions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_logic_conditions (
    id integer NOT NULL,
    rule_id integer NOT NULL,
    subject_id integer NOT NULL,
    operator public.field_rule_operator DEFAULT '='::public.field_rule_operator NOT NULL,
    value jsonb
);


--
-- Name: TABLE form_logic_conditions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.form_logic_conditions IS '
@omit all
Conditions are nested within FormLogicRules. In many cases there may be
only a single condition, but in others the FormLogicRule.booleanOperator
property defines how they are applied.
';


--
-- Name: form_logic_rules_conditions(public.form_logic_rules); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.form_logic_rules_conditions(rule public.form_logic_rules) RETURNS SETOF public.form_logic_conditions
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select * from form_logic_conditions where rule_id = rule.id;
  $$;


--
-- Name: FUNCTION form_logic_rules_conditions(rule public.form_logic_rules); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.form_logic_rules_conditions(rule public.form_logic_rules) IS '
@simpleCollections only
';


--
-- Name: forms_form_elements(public.forms); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forms_form_elements(f public.forms) RETURNS SETOF public.form_elements
    LANGUAGE sql STABLE
    AS $$
    select * from form_elements where form_elements.form_id = f.id order by position asc;
  $$;


--
-- Name: FUNCTION forms_form_elements(f public.forms); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.forms_form_elements(f public.forms) IS '
@simpleCollections only
Lists FormElements in order for rendering
';


--
-- Name: forms_logic_rules(public.forms); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forms_logic_rules(form public.forms) RETURNS SETOF public.form_logic_rules
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select * from form_logic_rules where form_element_id in (
      select id from form_elements where form_id = form.id
    ) order by position asc;
  $$;


--
-- Name: FUNCTION forms_logic_rules(form public.forms); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.forms_logic_rules(form public.forms) IS '
@simpleCollections only
';


--
-- Name: generate_offline_tile_package(integer, text, integer, integer, public.offline_tile_package_source_type, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_offline_tile_package("projectId" integer, "dataSourceUrl" text, "maxZ" integer, "maxShorelineZ" integer, "sourceType" public.offline_tile_package_source_type, "originalUrlTemplate" text) RETURNS public.offline_tile_packages
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      pkg offline_tile_packages;
    begin
      if session_is_admin("projectId") and (select is_offline_enabled from projects where id = "projectId") = true then
        insert into offline_tile_packages (project_id, region, data_source_url, is_mapbox_hosted, max_z, max_shoreline_z, source_type, original_url_template) values (
          "projectId",
          (select region from projects where id = "projectId"),
          "dataSourceUrl",
          true,
          "maxZ",
          "maxShorelineZ",
          "sourceType",
          "originalUrlTemplate"
        ) returning * into pkg;
        return pkg;
      else
        raise exception 'Permission denied';  
      end if;
      return pkg;
    end;
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
-- Name: get_or_create_user_by_sub(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_user_by_sub(_sub text, _email text, OUT user_id integer) RETURNS integer
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  WITH ins AS (
INSERT INTO users (sub, canonical_email)
      VALUES (_sub, _email)
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
-- Name: get_project_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_project_id(_slug text) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select id from projects where projects.slug = _slug;
$$;


--
-- Name: FUNCTION get_project_id(_slug text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_project_id(_slug text) IS '@omit';


--
-- Name: get_public_jwk(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_jwk(id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select public_pem from jwks where kid = id
  $$;


--
-- Name: FUNCTION get_public_jwk(id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_public_jwk(id uuid) IS '@omit';


--
-- Name: get_surveys(integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_surveys(ids integer[]) RETURNS SETOF public.surveys
    LANGUAGE sql STABLE
    AS $$
    select * from surveys where id = any(ids);
$$;


--
-- Name: FUNCTION get_surveys(ids integer[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_surveys(ids integer[]) IS '@simpleCollections only';


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
-- Name: initialize_blank_sketch_class_form(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_blank_sketch_class_form(sketch_class_id integer) RETURNS public.forms
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      form forms;
    begin
      if session_is_admin((select project_id from sketch_classes where id = sketch_class_id)) = false then
        raise exception 'Must be project admin';
      end if;
      insert into forms (sketch_class_id) values (sketch_class_id) returning * into form;
      return form;
    end
  $$;


--
-- Name: FUNCTION initialize_blank_sketch_class_form(sketch_class_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.initialize_blank_sketch_class_form(sketch_class_id integer) IS '@omit';


--
-- Name: initialize_blank_survey_form(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_blank_survey_form(survey_id integer) RETURNS public.forms
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      form forms;
    begin
      if session_is_admin((select project_id from surveys where id = survey_id)) = false then
        raise exception 'Must be project admin';
      end if;
      insert into forms (survey_id) values (survey_id) returning * into form;
      return form;
    end
  $$;


--
-- Name: FUNCTION initialize_blank_survey_form(survey_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.initialize_blank_survey_form(survey_id integer) IS '@omit';


--
-- Name: initialize_sketch_class_form_from_template(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_sketch_class_form_from_template(sketch_class_id integer, template_id integer) RETURNS public.forms
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      form forms;
    begin
      if session_is_admin((select project_id from sketch_classes where id = sketch_class_id)) = false then
        raise exception 'Must be project admin';
      end if;
      insert into forms (sketch_class_id) values (sketch_class_id) returning * into form;
      insert into 
        form_elements (
          form_id, 
          body, 
          type_id, 
          is_required, 
          export_id, 
          position, 
          component_settings
        )
      select 
        form.id, 
        body, 
        type_id, 
        is_required, 
        export_id, 
        position, 
        component_settings
      from
        form_elements
      where
        form_elements.form_id = template_id;
      return form;
    end
  $$;


--
-- Name: FUNCTION initialize_sketch_class_form_from_template(sketch_class_id integer, template_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.initialize_sketch_class_form_from_template(sketch_class_id integer, template_id integer) IS '@omit';


--
-- Name: initialize_survey_form_from_template(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_survey_form_from_template(survey_id integer, template_id integer) RETURNS public.forms
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      form forms;
    begin
      if session_is_admin((select project_id from surveys where id = survey_id)) = false then
        raise exception 'Must be project admin';
      end if;
      insert into forms (survey_id) values (survey_id) returning * into form;
      insert into 
        form_elements (
          form_id, 
          body, 
          type_id, 
          is_required, 
          export_id, 
          position, 
          component_settings,
          background_color,   
          background_image,     
          background_palette,   
          secondary_color,      
          unsplash_author_name, 
          unsplash_author_url,  
          background_width,     
          background_height,    
          text_variant,
          layout
        )
      select 
        form.id, 
        body, 
        type_id, 
        is_required, 
        export_id, 
        position, 
        component_settings,
        background_color,     
        background_image,     
        background_palette,   
        secondary_color,      
        unsplash_author_name, 
        unsplash_author_url,  
        background_width,     
        background_height,    
        text_variant,
        layout
      from
        form_elements
      where
        form_elements.form_id = template_id
      order by position asc;
      
      return form;
    end
  $$;


--
-- Name: FUNCTION initialize_survey_form_from_template(survey_id integer, template_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.initialize_survey_form_from_template(survey_id integer, template_id integer) IS '@omit';


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
    insert into project_participants (user_id, project_id, share_profile, approved) values (current_setting('session.user_id', true)::integer, project_id, true, session_is_superuser()) on conflict on constraint project_participants_pkey do update set share_profile = true;
  $$;


--
-- Name: FUNCTION join_project(project_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.join_project(project_id integer) IS '
Adds current user to the list of participants for a project, sharing their 
profile with administrators in user listings. Their profile will also be shared 
in public or group discussion forum posts.

Clients will need to determine when/how to show prompts to join a project based
on activity that minimizes annoyance when browsing among projects but also makes
sure users are visible to admins so that they may gain user group permissions.
';


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

COMMENT ON FUNCTION public.leave_project(project_id integer) IS '
Turns off profile sharing in this project. User privacy choices should be 
respected, and profile information should disappear from the admin users lists,
forum posts, and any other shared content. In the forum a balance will need to 
be made to hide their posts entirely since anonymous content could be malicious, 
and maintain a historical record of discussions.
';


--
-- Name: make_response_draft(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.make_response_draft("responseId" integer) RETURNS public.survey_responses
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      r survey_responses;
    begin
      if session_is_admin((select project_id from surveys where id = (select survey_id from survey_responses where id = "responseId"))) then
        update survey_responses set is_draft = true where id = "responseId" returning * into r;
        return r;
      else
        raise exception 'Must be a project admin';
      end if;
    end;
$$;


--
-- Name: FUNCTION make_response_draft("responseId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.make_response_draft("responseId" integer) IS '
Project administrators cannot edit survey responses and survey respondants 
cannot edit responses after they have been submitted. Admins can use this 
mutation to put a response into draft mode so that they can be updated and 
resubmitted by the respondant.
';


--
-- Name: make_responses_not_practice(integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.make_responses_not_practice(ids integer[]) RETURNS SETOF public.survey_responses
    LANGUAGE sql
    AS $$
    update survey_responses set is_practice = false where id = any(ids) returning survey_responses.*;
$$;


--
-- Name: make_responses_practice(integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.make_responses_practice(ids integer[]) RETURNS public.survey_responses
    LANGUAGE sql
    AS $$
    update survey_responses set is_practice = true where id = any(ids) returning survey_responses.*;
$$;


--
-- Name: make_sketch_class(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.make_sketch_class(name text, project_id integer, template_id integer) RETURNS public.sketch_classes
    LANGUAGE sql SECURITY DEFINER
    AS $$
    select _create_sketch_class(name, project_id, null, template_id);
$$;


--
-- Name: make_survey(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.make_survey(name text, project_id integer, template_id integer) RETURNS public.surveys
    LANGUAGE sql SECURITY DEFINER
    AS $$
    select _create_survey(name, project_id, template_id);
$$;


--
-- Name: mark_topic_as_read(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_topic_as_read("topicId" integer) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    AS $$
    delete from pending_topic_notifications where it_me(user_id) and topic_id = "topicId" returning true;
  $$;


--
-- Name: FUNCTION mark_topic_as_read("topicId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.mark_topic_as_read("topicId" integer) IS '
Mark the topic as read by the current session user. Used to avoid sending email
notifications to users who have already read a topic. Call when loading a topic, 
and whenever new posts are shown.
';


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
-- Name: FUNCTION me(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.me() IS 'Access the current session''s User. The user is determined by the access token embedded in the `Authorization` header.';


--
-- Name: modify_survey_answers(integer[], jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.modify_survey_answers(response_ids integer[], answers jsonb) RETURNS SETOF public.survey_responses
    LANGUAGE sql
    AS $$
    update 
      survey_responses 
    set data = data || answers - (
      select 
        array_agg(form_elements.id::text)
      from form_elements
      inner join
        form_element_types
      on
        form_element_types.component_name = form_elements.type_id
      where
        (
          form_element_types.allow_admin_updates = false or 
          form_element_types.is_input = false
        ) and
        form_elements.form_id = (
          select 
            id 
          from 
            forms 
          where 
            forms.survey_id = (
              select survey_id from survey_responses where survey_responses.id = any(response_ids) limit 1
            )
          limit 1
        )
    )
    where survey_responses.id = any(response_ids)
    returning survey_responses.*;
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
SketchFolders can be used by users to organize their sketches. Collection-type
sketches can be used to organize sketches as well, but they are limited in that 
they cannot be nested, and also represent specific management semantics. Folders
can be used by users to arbitrarily organize their Sketches.
';


--
-- Name: COLUMN sketch_folders.project_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketch_folders.project_id IS '@omit many';


--
-- Name: COLUMN sketch_folders.folder_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketch_folders.folder_id IS 'The parent folder, if any.';


--
-- Name: COLUMN sketch_folders.collection_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketch_folders.collection_id IS 'The parent sketch collection, if any. Folders can only have a single parent entity.';


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

COMMENT ON FUNCTION public.my_folders("projectId" integer) IS '
@omit
';


--
-- Name: sketches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sketches (
    id integer NOT NULL,
    name text NOT NULL,
    sketch_class_id integer NOT NULL,
    user_id integer,
    collection_id integer,
    copy_of integer,
    user_geom public.geometry(Geometry,4326),
    geom public.geometry(Geometry,4326),
    folder_id integer,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    bbox real[] GENERATED ALWAYS AS (public.create_bbox(COALESCE(geom, user_geom))) STORED,
    num_vertices integer GENERATED ALWAYS AS (public.st_npoints(COALESCE(geom, user_geom))) STORED,
    form_element_id integer,
    response_id integer,
    mercator_geometry public.geometry(Geometry,3857) GENERATED ALWAYS AS (public.st_transform(COALESCE(geom, user_geom), 3857)) STORED,
    CONSTRAINT has_single_or_no_parent_folder_or_collection CHECK (((folder_id = NULL::integer) OR (collection_id = NULL::integer)))
);


--
-- Name: TABLE sketches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sketches IS '
@omit all,many
A *Sketch* is a spatial feature that matches the schema defined by the related 
*SketchClass*. User *Sketches* appears in the user''s "My Plans" tab and can be
shared in the discussion forum. They are also the gateway to analytical reports.

Sketches are completely owned by individual users, so access control rules 
ensure that only the owner of a sketch can perform CRUD operations on them. 
Admins have no special access. Use the graphile-generated mutations to manage 
these records.
';


--
-- Name: COLUMN sketches.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketches.name IS 'User provided name for the sketch.';


--
-- Name: COLUMN sketches.sketch_class_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketches.sketch_class_id IS 'SketchClass that defines the behavior of this type of sketch.';


--
-- Name: COLUMN sketches.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketches.user_id IS 'Owner of the sketch.';


--
-- Name: COLUMN sketches.collection_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketches.collection_id IS 'If the sketch is not a collection, it can belong to a collection (collections cannot be nested).';


--
-- Name: COLUMN sketches.copy_of; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketches.copy_of IS 'If this Sketch started as a copy of another it is tracked here. Eventually SeaSketch may have a means of visualizing how plans are iterated on over time.';


--
-- Name: COLUMN sketches.user_geom; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketches.user_geom IS 'Spatial feature the user directly digitized, without preprocessing. This is the feature that should be used if the Sketch is later edited.';


--
-- Name: COLUMN sketches.geom; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketches.geom IS 'The geometry of the Sketch **after** it has been preprocessed. This is the geometry that is used for reporting. Preprocessed geometries may be extremely large and complex, so it may be necessary to access them through a vector tile service or some other optimization.';


--
-- Name: COLUMN sketches.folder_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sketches.folder_id IS 'Parent folder. Both regular sketches and collections may be nested within folders for organization purposes.';


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

COMMENT ON FUNCTION public.my_sketches("projectId" integer) IS '
@omit
';


--
-- Name: offline_tile_packages_insert_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.offline_tile_packages_insert_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM graphile_worker.add_job('createTilePackage', json_build_object('packageId', NEW.id), queue_name := 'create-tile-package', max_attempts := 1);
  RETURN NEW;
END;
$$;


--
-- Name: offline_tile_packages_job_errors(public.offline_tile_packages); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.offline_tile_packages_job_errors(pkg public.offline_tile_packages) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      job_error text;
    begin
      select last_error into job_error from graphile_worker.jobs where payload->>'packageId' = pkg.id::text;
      if pkg.error is null then
        return job_error;
      end if;
      return pkg.error;
    end;
  $$;


--
-- Name: offline_tile_packages_job_status(public.offline_tile_packages); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.offline_tile_packages_job_status(pkg public.offline_tile_packages) RETURNS public.offline_tile_package_status
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      job_error text;
    begin
      select last_error into job_error from graphile_worker.jobs where payload->>'packageId' = pkg.id::text;
      if job_error is null then
        return pkg.status;
      else
        return 'FAILED';
      end if;
    end;
  $$;


--
-- Name: on_user_insert_create_notification_preferences(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_user_insert_create_notification_preferences() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      insert into email_notification_preferences (user_id) values (NEW.id);
      return NEW;
    END;
$$;


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

COMMENT ON FUNCTION public.onboarded() IS '@omit';


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
    CONSTRAINT user_profiles_picture_check CHECK ((picture ~* 'https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,255}\.[a-z]{2,9}\y([-a-zA-Z0-9@:%_\+.~#?&//=]*)$'::text))
);


--
-- Name: TABLE user_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_profiles IS '@omit all
@name profile
Personal information that users have contributed. This information is only 
accessible directly to admins on projects where the user has chosen to share the
information (via the `joinProject()` mutation).

Regular SeaSketch users can access user profiles thru accessor fields on shared
content like forum posts if they have been shared, but regular users have no 
means of listing out all profiles in bulk.
';


--
-- Name: posts_author_profile(public.posts); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.posts_author_profile(post public.posts) RETURNS public.user_profiles
    LANGUAGE sql STABLE
    AS $$
    select
      user_profiles.*
    from
      user_profiles
    inner join
      project_participants
    on
      project_participants.user_id = post.author_id
    where
      project_participants.share_profile = true
    limit 1;
  $$;


--
-- Name: FUNCTION posts_author_profile(post public.posts); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.posts_author_profile(post public.posts) IS '
User Profile of the author. If a user has not shared their profile the post message will be hidden.
';


--
-- Name: posts_message(public.posts); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.posts_message(post public.posts) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select
      message_contents
    from
      posts
    inner join
      topics
    on
      topics.id = post.topic_id
    inner join
      forums
    on
      forums.id = topics.forum_id
    inner join
      project_participants
    on
      project_participants.user_id = post.author_id
    where
      posts.id = post.id and
      post.hidden_by_moderator = false and
      project_participants.share_profile = true and
      project_participants.project_id = forums.project_id
  $$;


--
-- Name: FUNCTION posts_message(post public.posts); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.posts_message(post public.posts) IS '
Message contents of the post as JSON for use with DraftJS. 

Message may be null if user is not currently sharing their profile, in which 
case the client should explain such. 

Message could also be null if `hiddenByModerator` is set. In that case the 
client should explain that the post violated the `CommunityGuidelines`, if set.
';


--
-- Name: project_access_status(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.project_access_status(pid integer) RETURNS public.project_access_status
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      access_control_setting project_access_control_setting;
      approved_request boolean;
      uid int;
      admin_bit boolean;
      email_verified boolean;
    begin
      select nullif (current_setting('session.user_id', TRUE), '')::integer into 
      uid;
      select is_admin(pid, uid) into admin_bit;
      if current_setting('session.email_verified', TRUE) = 'true' then
        email_verified = true;
      else
        email_verified = false;
      end if;
      SELECT
        access_control
      into
        access_control_setting
      FROM
        projects
      WHERE
        id = pid;
      if access_control_setting is null then
        return 'PROJECT_DOES_NOT_EXIST'::project_access_status;
      end if;
      if session_has_project_access(pid) then
        return 'GRANTED'::project_access_status;
      end if;
      if uid is null then
        return 'DENIED_ANON'::project_access_status;
      end if;
      if access_control_setting = 'admins_only'::project_access_control_setting then
        if admin_bit and email_verified = false then
          return 'DENIED_EMAIL_NOT_VERIFIED'::project_access_status;
        else
          return 'DENIED_ADMINS_ONLY'::project_access_status;
        end if;
      end if;
      -- access control setting must be invite_only
      select 
        approved into approved_request 
      from 
        project_participants 
      where 
        user_id = uid and project_id = pid;
      if approved_request is null then
        return 'DENIED_NOT_REQUESTED'::project_access_status;
      elsif approved_request is false then
        return 'DENIED_NOT_APPROVED'::project_access_status;
      elsif email_verified is false then
        return 'DENIED_EMAIL_NOT_VERIFIED'::project_access_status;
      end if;
      raise exception 'Unknown reason for denying project access. userid = %, project_id = %', uid, pid;
    end;
$$;


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
-- Name: project_id_for_form_id(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.project_id_for_form_id(fid integer) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select project_id from (
      select 
        sketch_classes.project_id 
      from 
        sketch_classes 
      where 
        sketch_classes.id = (select sketch_class_id from forms where forms.id = fid)
      union
        select
          surveys.project_id
        from
          surveys
        where
          surveys.id = (select survey_id from forms where forms.id = fid)
    ) as foo where project_id is not null
  $$;


--
-- Name: FUNCTION project_id_for_form_id(fid integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.project_id_for_form_id(fid integer) IS '@omit';


--
-- Name: project_id_from_field_id(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.project_id_from_field_id(fid integer) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    select project_id_for_form_id((select form_id from form_elements where form_elements.id = fid))
  $$;


--
-- Name: FUNCTION project_id_from_field_id(fid integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.project_id_from_field_id(fid integer) IS '@omit';


--
-- Name: project_invite_was_used(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.project_invite_was_used(invite_id integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select was_used from project_invites where id = invite_id;
  $$;


--
-- Name: FUNCTION project_invite_was_used(invite_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.project_invite_was_used(invite_id integer) IS '@omit';


--
-- Name: project_invites_groups(public.project_invites); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.project_invites_groups(invite public.project_invites) RETURNS SETOF public.project_groups
    LANGUAGE sql STABLE
    AS $$
    select * from project_groups where id = any (select group_id from project_invite_groups where invite_id = invite.id);
  $$;


--
-- Name: FUNCTION project_invites_groups(invite public.project_invites); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.project_invites_groups(invite public.project_invites) IS '@simpleCollections only';


--
-- Name: project_invites_participation_status(public.project_invites); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.project_invites_participation_status(invite public.project_invites) RETURNS public.participation_status
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select users_participation_status(users.*, invite.project_id) from users where users.id = invite.user_id and session_is_admin(invite.project_id);
  $$;


--
-- Name: project_invites_status(public.project_invites); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.project_invites_status(invite public.project_invites) RETURNS public.invite_status
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      email_status invite_status;
      expired boolean;
      has_complaint boolean;
      survey_invite_status invite_status;
    begin
      select exists(select 1 from invite_emails where to_address = invite.email and status = 'COMPLAINT') into has_complaint;
      -- check for sent survey invites
      select 
        status 
      into
        survey_invite_status
      from 
        invite_emails 
      where 
        invite_emails.to_address = invite.email and
        invite_emails.survey_invite_id = any(select id from surveys where surveys.project_id = invite.project_id);
      if survey_invite_status is not null then
        if survey_invite_status in ('SENT', 'DELIVERED', 'CONFIRMED') then
          return 'SURVEY_INVITE_SENT';
        else
          return survey_invite_status;
        end if;
      elseif exists(
        select
          1
        from
          survey_invites
        inner join
          surveys
        on
          survey_invites.survey_id = surveys.id
        where
          survey_invites.email = invite.email and
          surveys.project_id = invite.project_id
      ) then
        return 'SURVEY_INVITE_QUEUED';
      elseif invite.was_used = true then 
        return 'CONFIRMED';
      elseif has_complaint then
        return 'COMPLAINT';
      else
        select
          now() > token_expires_at as expired,
          status
        into
          expired,
          email_status
        from
          invite_emails
        where
          project_invite_id = invite.id
        order by
          created_at desc
        limit 1;
        if expired = true then
          return 'TOKEN_EXPIRED';
        elsif email_status is null then
          return 'UNSENT';
        else
          return email_status::invite_status;
        end if;
      end if;
    end;      
  $$;


--
-- Name: project_public_details(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.project_public_details(slug text) RETURNS public.public_project_details
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    id,
    name,
    slug,
    logo_url,
    access_control,
    support_email,
    project_access_status(id) as access_status
  FROM
    projects
  WHERE
    projects.slug = project_public_details.slug
$$;


--
-- Name: projects_access_requests(public.projects, public.participant_sort_by, public.sort_by_direction); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_access_requests(p public.projects, order_by public.participant_sort_by DEFAULT 'NAME'::public.participant_sort_by, direction public.sort_by_direction DEFAULT 'ASC'::public.sort_by_direction) RETURNS SETOF public.users
    LANGUAGE sql STABLE
    AS $$
  SELECT
    users.*
  FROM
    users
    INNER JOIN project_participants ON (project_participants.user_id = users.id)
    INNER JOIN user_profiles ON (user_profiles.user_id = users.id)
  WHERE
    session_is_admin(p.id) and
    project_participants.project_id = p.id and
    (project_participants.share_profile = true and project_participants.approved = false and p.access_control != 'public'::project_access_control_setting)
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
-- Name: projects_active_data_uploads(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_active_data_uploads(p public.projects) RETURNS SETOF public.data_upload_tasks
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select 
      * 
    from 
      data_upload_tasks 
    where 
      session_is_admin(p.id) and
      project_id = p.id and
      (
        (state = 'complete' and created_at > now() - interval '1 hour')
        or
        (state = 'failed' and created_at > now() - interval '3 days')
        or
        (state != 'failed' and state != 'complete' and state != 'failed_dismissed' and (state != 'awaiting_upload' or user_id = nullif(current_setting('session.user_id', TRUE), '')::integer))
      )
  $$;


--
-- Name: FUNCTION projects_active_data_uploads(p public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_active_data_uploads(p public.projects) IS '@simpleCollections only';


--
-- Name: projects_admin_count(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_admin_count(p public.projects) RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    begin
      if session_is_admin(p.id) then
        return (select
            count(*) as count
          from
            project_participants
          where
            project_id = p.id and is_admin = true
        );
      else
        raise exception 'Must be project admin';
      end if;
    end;
  $$;


--
-- Name: projects_admins(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_admins(p public.projects) RETURNS SETOF public.users
    LANGUAGE sql STABLE
    AS $$
    select 
      users.* 
    from 
      project_participants
    inner join
      users
    on
      project_participants.user_id = users.id
    where
      project_participants.is_admin = true and
      (
        project_participants.approved = true or
        exists(select 1 from projects where id = project_participants.project_id and projects.access_control = 'public')
      )
    ;
  $$;


--
-- Name: FUNCTION projects_admins(p public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_admins(p public.projects) IS '@simpleCollections only';


--
-- Name: projects_basemaps(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_basemaps(project public.projects) RETURNS SETOF public.basemaps
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select 
      * 
    from 
      basemaps 
    where 
      session_has_project_access(project.id) and 
      (
        (basemaps.project_id = project.id and (basemaps.surveys_only = false)) or 
        basemaps.id in (
          select 
            basemap_id 
          from 
            projects_shared_basemaps 
          where 
            projects_shared_basemaps.project_id = project.id
        )
      );
  $$;


--
-- Name: FUNCTION projects_basemaps(project public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_basemaps(project public.projects) IS '
@simpleCollections only
';


--
-- Name: projects_data_hosting_quota(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_data_hosting_quota(p public.projects) RETURNS bigint
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    begin
    if session_is_admin(p.id) != true then
      raise 'Permission denied';
    end if;
    return (select data_hosting_quota from projects where id = p.id);
    end;
  $$;


--
-- Name: projects_data_hosting_quota_used(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_data_hosting_quota_used(p public.projects) RETURNS bigint
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      sum_bytes bigint;
      quota bigint;
    begin
    if session_is_admin(p.id) != true then
      raise 'Permission denied';
    end if;
    select sum(byte_length) into sum_bytes from data_sources where project_id = p.id;
    select projects_data_hosting_quota(p) into quota;
    if sum_bytes < quota then
      return sum_bytes;
    end if;
    if sum_bytes is null then
      return 0;
    end if;
    return quota;
    end;
  $$;


--
-- Name: projects_data_layers_for_items(public.projects, integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_data_layers_for_items(p public.projects, table_of_contents_item_ids integer[]) RETURNS SETOF public.data_layers
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      layer_ids int[];
    begin
      if session_is_admin(p.id) then
        select array_agg(data_layer_id) into layer_ids from table_of_contents_items where project_id = p.id and id = any(table_of_contents_item_ids);
      else
        if session_has_project_access(p.id) then
          select array_agg(data_layer_id) into layer_ids from table_of_contents_items where project_id = p.id and id = any(table_of_contents_item_ids) and _session_on_toc_item_acl(table_of_contents_items.path);
        else
          raise 'Access denied';
        end if;
      end if;
      return query select
        *
      from
        data_layers
      where
        id = any(layer_ids);
    end;
  $$;


--
-- Name: FUNCTION projects_data_layers_for_items(p public.projects, table_of_contents_item_ids integer[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_data_layers_for_items(p public.projects, table_of_contents_item_ids integer[]) IS '@simpleCollections only
Retrieve DataLayers for a given set of TableOfContentsItem IDs. Should be used
in conjuction with `dataSourcesForItems` to progressively load layer information
when users request layers be displayed on the map.
';


--
-- Name: projects_data_sources_for_items(public.projects, integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_data_sources_for_items(p public.projects, table_of_contents_item_ids integer[]) RETURNS SETOF public.data_sources
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      layer_ids int[];
      source_ids int[];
    begin
      if session_is_admin(p.id) then
        select array_agg(data_layer_id) into layer_ids from table_of_contents_items where project_id = p.id and id = any("table_of_contents_item_ids");
      else
        if session_has_project_access(p.id) then
          select array_agg(data_layer_id) into layer_ids from table_of_contents_items where project_id = p.id and id = any(table_of_contents_item_ids) and _session_on_toc_item_acl(table_of_contents_items.path);
        else
          raise 'Access denied';
        end if;
      end if;
      select array_agg(distinct(data_source_id)) into source_ids from data_layers where id = any(layer_ids);
      return query select
        *
      from
        data_sources
      where
        id = any(source_ids);
    end;
  $$;


--
-- Name: FUNCTION projects_data_sources_for_items(p public.projects, table_of_contents_item_ids integer[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_data_sources_for_items(p public.projects, table_of_contents_item_ids integer[]) IS '@simpleCollections only
Retrieve DataSources for a given set of TableOfContentsItem IDs. Should be used
in conjuction with `dataLayersForItems` to progressively load layer information
when users request layers be displayed on the map.
';


--
-- Name: table_of_contents_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_of_contents_items (
    id integer NOT NULL,
    path public.ltree NOT NULL,
    stable_id text NOT NULL,
    parent_stable_id text,
    is_draft boolean DEFAULT true NOT NULL,
    project_id integer NOT NULL,
    title text NOT NULL,
    is_folder boolean DEFAULT true NOT NULL,
    show_radio_children boolean DEFAULT false NOT NULL,
    is_click_off_only boolean DEFAULT false NOT NULL,
    metadata jsonb,
    bounds numeric[],
    data_layer_id integer,
    sort_index integer NOT NULL,
    hide_children boolean DEFAULT false NOT NULL,
    enable_download boolean DEFAULT true NOT NULL,
    CONSTRAINT table_of_contents_items_metadata_check CHECK (((metadata IS NULL) OR (char_length((metadata)::text) < 100000))),
    CONSTRAINT titlechk CHECK ((char_length(title) > 0))
);


--
-- Name: TABLE table_of_contents_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.table_of_contents_items IS '
@omit all
TableOfContentsItems represent a tree-view of folders and operational layers 
that can be added to the map. Both layers and folders may be nested into other 
folders for organization, and each folder has its own access control list.

Items that represent data layers have a `DataLayer` relation, which in turn has
a reference to a `DataSource`. Usually these relations should be fetched in 
batch only once the layer is turned on, using the 
`dataLayersAndSourcesByLayerId` query.
';


--
-- Name: COLUMN table_of_contents_items.path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_of_contents_items.path IS '
@omit
ltree-compatible, period delimited list of ancestor stable_ids
';


--
-- Name: COLUMN table_of_contents_items.stable_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_of_contents_items.stable_id IS '
The stable_id property must be set by clients when creating new items. [Nanoid](https://github.com/ai/nanoid#readme) 
should be used with a custom alphabet that excludes dashes and has a lenght of 
9. The purpose of the stable_id is to control the nesting arrangement of items
and provide a stable reference for layer visibility settings and map bookmarks.
When published, the id primary key property of the item will change but not the 
stable_id.
';


--
-- Name: COLUMN table_of_contents_items.parent_stable_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_of_contents_items.parent_stable_id IS '
stable_id of the parent folder, if any. This property cannot be changed 
directly. To rearrange items into folders, use the 
`updateTableOfContentsItemParent` mutation.
';


--
-- Name: COLUMN table_of_contents_items.is_draft; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_of_contents_items.is_draft IS 'Identifies whether this item is part of the draft table of contents edited by admin or the static public version. This property cannot be changed. Rather, use the `publishTableOfContents()` mutation';


--
-- Name: COLUMN table_of_contents_items.title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_of_contents_items.title IS 'Name used in the table of contents rendering';


--
-- Name: COLUMN table_of_contents_items.is_folder; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_of_contents_items.is_folder IS 'If not a folder, the item is a layer-type and must have a data_layer_id';


--
-- Name: COLUMN table_of_contents_items.show_radio_children; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_of_contents_items.show_radio_children IS 'If set, children of this folder will appear as radio options so that only one may be toggle at a time';


--
-- Name: COLUMN table_of_contents_items.is_click_off_only; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_of_contents_items.is_click_off_only IS 'If set, folders with this property cannot be toggled in order to activate all their children. Toggles can only be used to toggle children off';


--
-- Name: COLUMN table_of_contents_items.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_of_contents_items.metadata IS 'DraftJS compatible representation of text content to display when a user requests layer metadata. Not valid for Folders';


--
-- Name: COLUMN table_of_contents_items.bounds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_of_contents_items.bounds IS 'If set, users will be able to zoom to the bounds of this item. [minx, miny, maxx, maxy]';


--
-- Name: COLUMN table_of_contents_items.data_layer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_of_contents_items.data_layer_id IS 'If is_folder=false, a DataLayers visibility will be controlled by this item';


--
-- Name: COLUMN table_of_contents_items.sort_index; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_of_contents_items.sort_index IS 'Position in the layer list';


--
-- Name: projects_draft_table_of_contents_items(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_draft_table_of_contents_items(p public.projects) RETURNS SETOF public.table_of_contents_items
    LANGUAGE sql STABLE
    AS $$
    select
      table_of_contents_items.*
    from
      table_of_contents_items
    where
      table_of_contents_items.project_id = p.id and table_of_contents_items.is_draft = true;
  $$;


--
-- Name: FUNCTION projects_draft_table_of_contents_items(p public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_draft_table_of_contents_items(p public.projects) IS '
@simpleCollections only
Draft layer lists, accessible only to admins. Make edits to the layer list and
then use the `publishTableOfContents` mutation when it is ready for end-users.
';


--
-- Name: projects_invite(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_invite(p public.projects) RETURNS public.project_invites
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select 
      *
    from 
      project_invites 
    where 
      project_id = p.id and ((
        email = current_setting('session.canonical_email', TRUE)::email and
        exists(
          select 1 from invite_emails 
          where status != 'QUEUED' and 
          project_invite_id = project_invites.id
        )
      ) or (
        email = current_setting('session.survey_invite_email', TRUE)::email
      ))
    limit 1;
  $$;


--
-- Name: FUNCTION projects_invite(p public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_invite(p public.projects) IS '
Returns the project invitation for the current user session, if any. Will not appear until the invite has been sent. The system determines the relevant invite using the `canonical_email` claim in the user access token.

If the invite status is unconfirmed the client should accept it using the `confirmProjectInviteWithVerifiedEmail()` mutation. Details on how to work with user ingress and project invites [can be found on the wiki](https://github.com/seasketch/next/wiki/User-Ingress).
';


--
-- Name: projects_invite_counts(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_invite_counts(p public.projects) RETURNS SETOF public.invite_stats
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select t::invite_stats from (
    select
        project_invites_status(project_invites.*)::invite_status as status,
        count(*) as count
      from
        project_invites
      where
        project_id = p.id and session_is_admin(p.id)
      group by
        status) as t;
  $$;


--
-- Name: FUNCTION projects_invite_counts(p public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_invite_counts(p public.projects) IS '
@simpleCollections only
Breakdown of number of invites per status. Used to display counts in overview listing of users, groups, and invites in the user administration dashboard.
';


--
-- Name: projects_invites(public.projects, public.invite_status[], public.invite_order_by, public.sort_by_direction); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_invites(p public.projects, statuses public.invite_status[], "orderBy" public.invite_order_by, direction public.sort_by_direction) RETURNS SETOF public.project_invites
    LANGUAGE sql STABLE
    AS $$
    select 
      * 
    from 
      project_invites 
    where 
      session_is_admin(p.id) and 
      project_id = p.id and 
      (array_length(statuses, 1) is null or project_invites_status(project_invites.*) = any (statuses))
    order by
      (CASE WHEN "orderBy" = 'EMAIL' and "direction" = 'ASC' THEN email
            WHEN "orderBy" = 'NAME' and "direction" = 'ASC' THEN fullname
            else fullname
      END) ASC,
      (CASE WHEN "orderBy" = 'EMAIL' and "direction" = 'DESC' THEN email
            WHEN "orderBy" = 'NAME' and "direction" = 'DESC' THEN fullname
            ELSE fullname
      END) DESC
  $$;


--
-- Name: FUNCTION projects_invites(p public.projects, statuses public.invite_status[], "orderBy" public.invite_order_by, direction public.sort_by_direction); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_invites(p public.projects, statuses public.invite_status[], "orderBy" public.invite_order_by, direction public.sort_by_direction) IS 'List project invites by status';


--
-- Name: projects_is_admin(public.projects, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_is_admin(p public.projects, "userId" integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select coalesce(is_admin, false) from project_participants where user_id = "userId" and project_id = p.id and session_is_admin(p.id);
  $$;


--
-- Name: FUNCTION projects_is_admin(p public.projects, "userId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_is_admin(p public.projects, "userId" integer) IS '
Returns true if the given user is an administrator of the project. Informaiton is only available administrators of the project and will otherwise always return false.
';


--
-- Name: projects_mapbox_secret_key(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_mapbox_secret_key(p public.projects) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    -- begin
      select mapbox_secret_key from projects where projects.id = p.id and session_is_admin(p.id);
      -- if session_is_admin(p.id) then
      --   return (select mapbox_secret_key from projects where projects.id = project.id and session_is_admin(project.id));
      -- else
      --   return '*********'::text;
      --   -- raise exception 'Must be project admin';
      -- end if;
    -- end;
  $$;


--
-- Name: FUNCTION projects_mapbox_secret_key(p public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_mapbox_secret_key(p public.projects) IS '@fieldName mapboxSecretKey';


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
      project_id = p.id and (project_participants.approved = true or p.access_control = 'public'::project_access_control_setting)), 0)
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
    project_participants.project_id = p.id and
    (project_participants.approved = true or p.access_control = 'public'::project_access_control_setting)
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

COMMENT ON FUNCTION public.projects_participants(p public.projects, order_by public.participant_sort_by, direction public.sort_by_direction) IS '
@simpleCollections only
All users who have opted into participating in the project, sharing 
their profile with project administrators.

If the project is invite-only, users who have not been approved will not appear
in this list. Those users can be accessed via `unapprovedParticipants()`
';


--
-- Name: projects_session_has_posts(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_session_has_posts(project public.projects) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select exists(
      select 
        1 
      from 
        posts 
      inner join
        topics
      on
        posts.topic_id = topics.id
      inner join
        forums
      on
        forums.id = topics.forum_id
      where
        forums.project_id = project.id and
        it_me(posts.author_id)
    );
  $$;


--
-- Name: FUNCTION projects_session_has_posts(project public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_session_has_posts(project public.projects) IS 'Whether the current user has any discussion forum posts in this project. Use this to determine whether `project.communityGuidelines` should be shown to the user before their first post.';


--
-- Name: projects_session_has_privileged_access(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_session_has_privileged_access(p public.projects) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select exists (
      select project_id from project_participants where user_id = nullif(current_setting('session.user_id', TRUE), '')::integer and project_id = p.id and is_admin = true
    ) or (
      select count(*) > 0 from project_group_members where user_id = nullif(current_setting('session.user_id', TRUE), '')::integer and project_group_members.group_id in (select id from project_groups where project_id = p.id)
    ) or (
      select count(*) > 0 from project_invites where project_id = p.id and user_id = nullif(current_setting('session.user_id', TRUE), '')::integer and make_admin = true
    ) or session_is_superuser()
  $$;


--
-- Name: FUNCTION projects_session_has_privileged_access(p public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_session_has_privileged_access(p public.projects) IS '
Indicates whether current session should have special access or group privileges. These grants will not be active if the user does not have a verified email address.

Clients should check for situations where a user access token has a false `email_verified` cliam paired with privileged access. If that is the case they should prompt users to confirm their email address.
';


--
-- Name: projects_session_is_admin(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_session_is_admin(p public.projects) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select EXISTS (
      SELECT
        user_id
      FROM
        project_participants
      WHERE
        it_me(user_id)
        AND project_participants.is_admin = TRUE
        AND project_participants.project_id = p.id) or session_is_superuser()
  $$;


--
-- Name: FUNCTION projects_session_is_admin(p public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_session_is_admin(p public.projects) IS 'Returns true if the user has admin privileges on this project. Will return true even if the session email is not verified, but permissions will not work until it is.';


--
-- Name: projects_session_outstanding_survey_invites(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_session_outstanding_survey_invites(project public.projects) RETURNS SETOF public.survey_token_info
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select 
      invite_emails.token, 
      survey_invites.survey_id,
      surveys.project_id
    from
      invite_emails
    inner join
      survey_invites
    on
      survey_invites.id = invite_emails.survey_invite_id
    inner join
      surveys
    on
      surveys.id = survey_invites.survey_id
    where
      surveys.project_id = project.id and
      survey_invites.was_used = false and 
      invite_emails.token_expires_at > now() and
      (
        invite_emails.to_address = nullif(current_setting('session.canonical_email', TRUE), '') or
        it_me(survey_invites.user_id)
      )
  $$;


--
-- Name: FUNCTION projects_session_outstanding_survey_invites(project public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_session_outstanding_survey_invites(project public.projects) IS '
@simpleCollections only
Invites (and related tokens) for surveys which this user has not yet responded
to. Details on how to handle survey invites [can be found on the wiki](https://github.com/seasketch/next/wiki/User-Ingress#survey-invites).
';


--
-- Name: projects_session_participation_status(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_session_participation_status(p public.projects) RETURNS public.participation_status
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select users_participation_status(users.*, p.id) from users where it_me(users.id);
$$;


--
-- Name: projects_sprites(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_sprites(p public.projects) RETURNS SETOF public.sprites
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      sprites sprites;
    begin
      if session_is_admin(p.id) then
        return query select * from sprites where project_id = p.id and deleted = false;
      else 
        raise exception 'Permission denied.';
      end if;
    end;
  $$;


--
-- Name: FUNCTION projects_sprites(p public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_sprites(p public.projects) IS '@simpleCollections only';


--
-- Name: projects_survey_basemaps(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_survey_basemaps(project public.projects) RETURNS SETOF public.basemaps
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select 
      * 
    from 
      basemaps 
    where 
      session_has_project_access(project.id) and 
      (
        basemaps.project_id = project.id and basemaps.surveys_only = true
      );
  $$;


--
-- Name: FUNCTION projects_survey_basemaps(project public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_survey_basemaps(project public.projects) IS '
@simpleCollections only
';


--
-- Name: projects_table_of_contents_items(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_table_of_contents_items(p public.projects) RETURNS SETOF public.table_of_contents_items
    LANGUAGE sql STABLE
    AS $$
    select
      table_of_contents_items.*
    from
      table_of_contents_items
    where
      table_of_contents_items.project_id = p.id and table_of_contents_items.is_draft = false;
  $$;


--
-- Name: FUNCTION projects_table_of_contents_items(p public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_table_of_contents_items(p public.projects) IS '
@simpleCollections only
Public layer list. Cannot be edited directly.
';


--
-- Name: projects_unapproved_participant_count(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_unapproved_participant_count(p public.projects) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    select count(*)::int from project_participants where project_id = p.id and approved = false and share_profile = true and p.access_control != 'public'::project_access_control_setting;
$$;


--
-- Name: FUNCTION projects_unapproved_participant_count(p public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_unapproved_participant_count(p public.projects) IS '
Number of users who have outstanding access requests. Only relevant for invite-only projects.
';


--
-- Name: projects_unapproved_participants(public.projects, public.participant_sort_by, public.sort_by_direction); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_unapproved_participants(p public.projects, order_by public.participant_sort_by DEFAULT 'NAME'::public.participant_sort_by, direction public.sort_by_direction DEFAULT 'ASC'::public.sort_by_direction) RETURNS SETOF public.users
    LANGUAGE sql STABLE
    AS $$
  SELECT
    users.*
  FROM
    users
    INNER JOIN project_participants ON (project_participants.user_id = users.id)
    INNER JOIN user_profiles ON (user_profiles.user_id = users.id)
  WHERE
    project_participants.project_id = p.id and
    project_participants.share_profile = true and
    project_participants.approved = false and 
    p.access_control != 'public'::project_access_control_setting
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
-- Name: FUNCTION projects_unapproved_participants(p public.projects, order_by public.participant_sort_by, direction public.sort_by_direction); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_unapproved_participants(p public.projects, order_by public.participant_sort_by, direction public.sort_by_direction) IS '
@simpleCollections only
For invite-only projects. List all pending participation requests.

Users can be approved using the `approveParticipant()` mutation.
';


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
-- Name: FUNCTION projects_url(p public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_url(p public.projects) IS 'Project url will resolve to `https://seasketch.org/{slug}/`';


--
-- Name: projects_users_banned_from_forums(public.projects); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_users_banned_from_forums(project public.projects) RETURNS SETOF public.users
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    begin
      if session_is_admin(project.id) then
        return query select users.* from users
        inner join
          project_participants
        on
          project_participants.user_id = users.id
        where
          project_participants.project_id = project.id and
          project_participants.is_banned_from_forums = true;
      else
        raise exception 'Must be a project admin';
      end if;
    end;
$$;


--
-- Name: FUNCTION projects_users_banned_from_forums(project public.projects); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.projects_users_banned_from_forums(project public.projects) IS '
@simpleCollections only
List of all banned users. Listing only accessible to admins.
';


--
-- Name: public_sprites(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.public_sprites() RETURNS SETOF public.sprites
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select * from sprites where project_id is null and deleted = false;
  $$;


--
-- Name: FUNCTION public_sprites(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.public_sprites() IS '
@simpleCollections only
Used by project administrators to access a list of public sprites promoted by the SeaSketch development team.
';


--
-- Name: publish_table_of_contents(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.publish_table_of_contents("projectId" integer) RETURNS SETOF public.table_of_contents_items
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      lid int;
      item table_of_contents_items;
      source_id int;
      copied_source_id int;
      acl_type access_control_list_type;
      acl_id int;
      orig_acl_id int;
      new_toc_id int;
      new_interactivity_settings_id int;
    begin
      -- check permissions
      if session_is_admin("projectId") = false then
        raise 'Permission denied. Must be a project admin';
      end if;
      -- delete existing published table of contents items, layers, sources, and interactivity settings
      delete from 
        interactivity_settings 
      where
        id in (
          select 
            data_layers.interactivity_settings_id
          from
            data_layers
          inner JOIN
            table_of_contents_items
          on
            data_layers.id = table_of_contents_items.data_layer_id
          where
            table_of_contents_items.project_id = "projectId" and
            is_draft = false
        );

      delete from data_sources where data_sources.id in (
        select 
          data_source_id 
        from
          data_layers
        inner JOIN
          table_of_contents_items
        on
          data_layers.id = table_of_contents_items.data_layer_id
        where
          table_of_contents_items.project_id = "projectId" and
          is_draft = false
      );
      delete from data_layers where id in (
        select 
          data_layer_id 
        from 
          table_of_contents_items 
        where 
          project_id = "projectId" and
          is_draft = false
      );
      delete from 
        table_of_contents_items 
      where 
        project_id = "projectId" and 
        is_draft = false;

      -- one-by-one, copy related layers and link table of contents items
      for item in 
        select 
          * 
        from 
          table_of_contents_items 
        where 
          is_draft = true and 
          project_id = "projectId"
      loop
        if item.is_folder = false then
          -- copy interactivity settings first
          insert into interactivity_settings (
            type,
            short_template,
            long_template,
            cursor
          ) select
              type,
              short_template,
              long_template,
              cursor
            from
              interactivity_settings
            where
              interactivity_settings.id = (
                select interactivity_settings_id from data_layers where data_layers.id = item.data_layer_id
              )
            returning
              id
            into
              new_interactivity_settings_id;

          insert into data_layers (
            project_id,
            data_source_id,
            source_layer,
            sublayer,
            render_under,
            mapbox_gl_styles,
            interactivity_settings_id
          )
          select "projectId", 
            data_source_id, 
            source_layer, 
            sublayer, 
            render_under, 
            mapbox_gl_styles,
            new_interactivity_settings_id
          from 
            data_layers
          where 
            id = item.data_layer_id
          returning id into lid;
        else
          lid = item.data_layer_id;
        end if;
        -- TODO: this will have to be modified with the addition of any columns
        insert into table_of_contents_items (
          is_draft,
          project_id,
          path,
          stable_id,
          parent_stable_id,
          title,
          is_folder,
          show_radio_children,
          is_click_off_only,
          metadata,
          bounds,
          data_layer_id
        ) values (
          false,
          "projectId",
          item.path,
          item.stable_id,
          item.parent_stable_id,
          item.title,
          item.is_folder,
          item.show_radio_children,
          item.is_click_off_only,
          item.metadata,
          item.bounds,
          lid
        ) returning id into new_toc_id;
        select 
          type, id into acl_type, orig_acl_id 
        from 
          access_control_lists 
        where 
          table_of_contents_item_id = (
            select 
              id 
            from 
              table_of_contents_items 
            where is_draft = true and stable_id = item.stable_id
          );
        -- copy access control list settings
        if acl_type != 'public' then
          update 
            access_control_lists 
          set type = acl_type 
          where table_of_contents_item_id = new_toc_id 
          returning id into acl_id;
          if acl_type = 'group' then
            insert into 
              access_control_list_groups (
                access_control_list_id, 
                group_id
              ) 
            select 
              acl_id, 
              group_id 
            from 
              access_control_list_groups 
            where 
              access_control_list_id = orig_acl_id;
          end if;
        end if;
      end loop;
      -- one-by-one, copy related sources and update foreign keys of layers
      for source_id in
        select distinct(data_source_id) from data_layers where id in (
          select 
            data_layer_id 
          from 
            table_of_contents_items 
          where 
            is_draft = false and 
            project_id = "projectId" and 
            is_folder = false
        )
      loop
        -- TODO: This function will have to be updated whenever the schema 
        -- changes since these columns are hard coded... no way around it.
        insert into data_sources (
          project_id,
          type,
          attribution,
          bounds,
          maxzoom,
          minzoom,
          url,
          scheme,
          tiles,
          tile_size,
          encoding,
          buffer,
          cluster,
          cluster_max_zoom,
          cluster_properties,
          cluster_radius,
          generate_id,
          line_metrics,
          promote_id,
          tolerance,
          coordinates,
          urls,
          query_parameters,
          use_device_pixel_ratio,
          import_type,
          original_source_url,
          enhanced_security,
          bucket_id,
          object_key,
          byte_length,
          supports_dynamic_layers,
          uploaded_source_filename,
          uploaded_source_layername,
          normalized_source_object_key,
          normalized_source_bytes,
          geostats,
          upload_task_id
        )
          select 
            "projectId", 
          type,
          attribution,
          bounds,
          maxzoom,
          minzoom,
          url,
          scheme,
          tiles,
          tile_size,
          encoding,
          buffer,
          cluster,
          cluster_max_zoom,
          cluster_properties,
          cluster_radius,
          generate_id,
          line_metrics,
          promote_id,
          tolerance,
          coordinates,
          urls,
          query_parameters,
          use_device_pixel_ratio,
          import_type,
          original_source_url,
          enhanced_security,
          bucket_id,
          object_key,
          byte_length,
          supports_dynamic_layers,
          uploaded_source_filename,
          uploaded_source_layername,
          normalized_source_object_key,
          normalized_source_bytes,
          geostats,
          upload_task_id
          from 
            data_sources 
          where
            id = source_id
          returning id into copied_source_id;
        -- update data_layers that should now reference the copy
        update 
          data_layers 
        set data_source_id = copied_source_id 
        where 
          data_source_id = source_id and
          data_layers.id in ((
            select distinct(data_layer_id) from table_of_contents_items where is_draft = false and 
            project_id = "projectId" and 
            is_folder = false
          ));
      end loop;
      -- return items
      return query select * from table_of_contents_items 
        where project_id = "projectId" and is_draft = false;
    end;
  $$;


--
-- Name: FUNCTION publish_table_of_contents("projectId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.publish_table_of_contents("projectId" integer) IS 'Copies all table of contents items, related layers, sources, and access control lists to create a new table of contents that will be displayed to project users.';


--
-- Name: remove_group_from_acl(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_group_from_acl("aclId" integer, "groupId" integer) RETURNS public.access_control_lists
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      pid int;
      acl access_control_lists;
    BEGIN
      select project_id into pid from access_control_lists where id = "aclId";
      if session_is_admin(pid) then
        delete from access_control_list_groups where access_control_list_id = "aclId" and group_id = "groupId";
      else
        raise exception 'Must be an administrator';
      end if;
      select * into acl from access_control_lists where id = "aclId";
      return acl;
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
-- Name: remove_user_from_group_update_survey_invites_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_user_from_group_update_survey_invites_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Remove survey invites where was_added_from_group but user is no longer in relevant groups
  with for_deletion as (
    select
      survey_invites.*
    from
      survey_invites
    inner join
      surveys
    on
      surveys.id = survey_invites.survey_id
    where
      survey_invites.user_id = OLD.user_id and
      was_added_from_group = true and
      surveys.project_id = (
        select
          project_id
        from
          project_groups
        where
          project_groups.id = OLD.group_id
        limit 1
      ) and 
      -- user isn't in any acceptible group
      not exists (
        select 1 from
          survey_invited_groups
        where
          survey_invited_groups.group_id = any (select group_id from project_group_members where user_id = OLD.user_id) and
          survey_invited_groups.survey_id = survey_invites.survey_id
      )
  )
  delete from
    survey_invites
  where
    survey_invites.id in (select id from for_deletion);
	RETURN OLD;
END;
$$;


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
-- Name: FUNCTION remove_valid_child_sketch_class(parent integer, child integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.remove_valid_child_sketch_class(parent integer, child integer) IS '
Remove a SketchClass from the list of valid children for a Collection.
';


--
-- Name: revoke_admin_access(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_admin_access("projectId" integer, "userId" integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    BEGIN
      IF session_is_admin("projectId") or session_is_superuser() THEN
        IF exists(select 1 from project_participants where user_id = "userId" and project_id = "projectId" and share_profile = true) THEN
          update project_participants set is_admin = false where user_id = "userId" and project_id = "projectId";
        ELSE
          raise exception 'Participant not found.';
        END IF;
      ELSE
        raise exception 'You must be a project administrator';
      END IF;
    END
  $$;


--
-- Name: FUNCTION revoke_admin_access("projectId" integer, "userId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.revoke_admin_access("projectId" integer, "userId" integer) IS '
Remove participant admin privileges.
';


--
-- Name: invite_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invite_emails (
    id integer NOT NULL,
    to_address public.email NOT NULL,
    project_invite_id integer,
    survey_invite_id integer,
    message_id text,
    status public.email_status DEFAULT 'QUEUED'::public.email_status NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone,
    token_expires_at timestamp with time zone,
    token text,
    error text,
    CONSTRAINT invite_email_has_related_model CHECK (((((survey_invite_id IS NOT NULL))::integer + ((project_invite_id IS NOT NULL))::integer) = 1))
);


--
-- Name: TABLE invite_emails; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.invite_emails IS '
@omit all
Invite emails can be associated with either a project or survey invitation. 
Project invite emails are sent by direct admin action, going into a QUEUED state
and eventually sent out by a backend emailing process. Survey invites are 
automatically created whenever a survey is published.

[More details on the mailing process can be found on the wiki](https://github.com/seasketch/next/wiki/User-and-Survey-Invite-Management).
';


--
-- Name: COLUMN invite_emails.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.invite_emails.status IS '
Updated by the mailer processes and SES notifications.
';


--
-- Name: COLUMN invite_emails.token_expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.invite_emails.token_expires_at IS '
Emails contain a link with an embedded JSON Web Token that is used to authorize 
access. These tokens have an expiration that is both embedded in the token and 
tracked in the database. Each email has its own token and expiration.
';


--
-- Name: send_all_project_invites(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_all_project_invites("projectId" integer) RETURNS SETOF public.invite_emails
    LANGUAGE plpgsql
    AS $$
    begin
      if session_is_admin("projectId") = false then
        raise exception 'Must be project administrator';
      end if;
      return query select * from send_project_invites((select array_agg(id) from project_invites where project_id = "projectId"));
    end;
  $$;


--
-- Name: FUNCTION send_all_project_invites("projectId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.send_all_project_invites("projectId" integer) IS '
Send all UNSENT invites in the current project.
';


--
-- Name: send_project_invites(integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_project_invites("inviteIds" integer[]) RETURNS SETOF public.invite_emails
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      emails int[];
    begin
      if exists(
        select 1 from projects where id = any(
          select distinct(project_id) from project_invites where project_invites.id = any("inviteIds")
        ) and session_is_admin(id) = false
      ) then
        raise exception 'Must be project administrator';
      end if;
      with new_emails (id) as (
        insert into invite_emails (project_invite_id) select unnest("inviteIds") returning *
      ) select array_agg(id) into emails from new_emails;
      perform graphile_worker.add_job('sendProjectInviteEmail', json_build_object('emailId', id), max_attempts := 13, job_key := concat('project_invite_', invite_emails.project_invite_id)) from invite_emails where id = any(emails);
      return query select * from invite_emails where id = any(emails);
    end;
  $$;


--
-- Name: FUNCTION send_project_invites("inviteIds" integer[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.send_project_invites("inviteIds" integer[]) IS '
Send a list of project invites identified by their id.
';


--
-- Name: session_can_access_form(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.session_can_access_form(fid integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select session_is_admin((select project_id_for_form_id(fid))) or 
    session_has_survey_invite((select survey_id from forms where id = fid)) or
    (
      session_has_project_access((select project_id_for_form_id(fid))) and (
        session_on_acl((
          select 
            id 
          from 
            access_control_lists 
          where 
            access_control_lists.sketch_class_id is not null and
            access_control_lists.sketch_class_id = (select sketch_class_id from forms where id = fid)
        )) or (
          exists(
            select
              id
            from
              surveys
            where
              id = (select survey_id from forms where forms.id = fid) and
              (
                is_disabled = false and (
                  access_type = 'PUBLIC' or session_in_group(survey_group_ids(surveys.id))
                )
              )
          )
        )
      )
    )
  $$;


--
-- Name: FUNCTION session_can_access_form(fid integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.session_can_access_form(fid integer) IS '@omit';


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
    session_is_approved_participant(pid) or  
    -- session has a survey invite token with matching projectId
    exists(
      select
        1
      from
        survey_invites
      inner join
        surveys
      on
        surveys.id = survey_invites.survey_id
      where
        surveys.project_id = pid and 
        (
          survey_invites.user_id = nullif(current_setting('session.user_id', TRUE), '')::int or
          (
            survey_invites.email = nullif(current_setting('session.canonical_email', TRUE), '') and
            current_setting('session.email_verified', true) = 'true'
          ) or
          survey_invites.email = nullif(current_setting('session.survey_invite_email', TRUE), '')
        )            
    )
  $$;


--
-- Name: FUNCTION session_has_project_access(pid integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.session_has_project_access(pid integer) IS '@omit';


--
-- Name: session_has_survey_invite(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.session_has_survey_invite(survey_id integer) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    AS $$
    select exists (
      select
        1
      from
        survey_invites
      where
        survey_invites.survey_id = survey_id and (
          survey_invites.user_id = nullif(current_setting('session.user_id', TRUE), '')::int or
          (
            survey_invites.email = nullif(current_setting('session.canonical_email', TRUE), '') and
            current_setting('session.email_verified', true) = 'true'
          ) or
          survey_invites.email = nullif(current_setting('session.survey_invite_email', TRUE), '')
        )
    )
  $$;


--
-- Name: FUNCTION session_has_survey_invite(survey_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.session_has_survey_invite(survey_id integer) IS '@omit';


--
-- Name: session_in_group(integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.session_in_group("groupIds" integer[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select exists (
      select 1 from project_group_members where it_me(user_id) and group_id = any("groupIds")
    )
$$;


--
-- Name: FUNCTION session_in_group("groupIds" integer[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.session_in_group("groupIds" integer[]) IS '@omit';


--
-- Name: session_is_admin(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.session_is_admin("projectId" integer) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    AS $$
    select session_is_superuser() or (
      current_setting('session.email_verified', true) = 'true' and
      is_admin("projectId", nullif(current_setting('session.user_id', TRUE), '')::integer));
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
      ) AND project_participants.approved = TRUE AND
      current_setting('session.email_verified', true) = 'true'
    )
  $$;


--
-- Name: FUNCTION session_is_approved_participant(pid integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.session_is_approved_participant(pid integer) IS '@omit';


--
-- Name: session_is_banned_from_posting(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.session_is_banned_from_posting(pid integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select is_banned_from_forums from project_participants where project_id = pid and user_id = nullif(current_setting('session.user_id', TRUE), '')::int;
  $$;


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
-- Name: session_member_of_group(integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.session_member_of_group(groups integer[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select (select count(group_id) from project_group_members where user_id = nullif(current_setting('session.user_id', TRUE), '')::integer and group_id = any(groups)) > 0;
$$;


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
      current_setting('session.email_verified', true) = 'true' and
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
-- Name: set_form_element_order(integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_form_element_order("elementIds" integer[]) RETURNS SETOF public.form_elements
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      project_id int;
      sketch_class_id int;
      survey_id int;
      formid int;
      pos int;
      field record;
    begin
      select
        form_elements.form_id
      into
        formid
      from
        form_elements
      where
        id = any("elementIds")
      limit 1;
      -- raise exception if session is not an admin
      select
        forms.sketch_class_id
        , forms.survey_id
      into
        sketch_class_id
        , survey_id
      from
        forms
      where
        forms.id = formid;
      if sketch_class_id is not null then
        select
          sketch_classes.project_id
        into
          project_id
        from
          sketch_classes
        where
          id = sketch_class_id;
      end if;
      if survey_id is not null then
        select
          surveys.project_id
        into
          project_id
        from
          surveys
        where
          id = survey_id;
      end if;
      if session_is_admin(project_id) = false then
        raise exception 'Must be project admin';
      end if;
      pos = 1;
      -- select fields in order of fieldIDs
      -- loop through each, setting a position
      for field in select * from form_elements where form_id = formid order by array_position("elementIds", id) loop
        update form_elements set position = pos where id = field.id;
        pos = pos + 1;
      end loop;
      -- return all the fields in this form
      return query select * from form_elements where form_elements.form_id = formid order by position asc;
    end
  $$;


--
-- Name: FUNCTION set_form_element_order("elementIds" integer[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_form_element_order("elementIds" integer[]) IS '
Sets the positions of all elements in a form at once. Any missing element ids from
the input will be positioned at the end of the form.

Use this instead of trying to manage the position of form elements individually.
';


--
-- Name: set_form_logic_rule_order(integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_form_logic_rule_order("ruleIds" integer[]) RETURNS SETOF public.form_logic_rules
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    form_ids int[];
    form_elementid int;
    pos int;
    rule record;
  begin
    select array_agg(form_id) into form_ids from form_elements where id in (
      select form_element_id from form_logic_rules where id = any("ruleIds")
    );
    if array_length(form_ids, 1) > 1 then
      raise exception 'Can only change rule order for a single form at one time';
    end if;
    select form_element_id into form_elementid from form_logic_rules where id = any("ruleIds") limit 1;
    
    if session_is_admin(project_id_from_field_id(form_elementid)) then
      pos = 1;
      -- select rules in order of ruleIds
      -- loop through each, setting a position
      for rule in select * from form_logic_rules where form_element_id in (select id from form_elements where form_id = any(form_ids)) order by array_position("ruleIds", id) loop
        update form_logic_rules set position = pos where id = rule.id;
        pos = pos + 1;
      end loop;
      -- return all the fields in this form
      return query select * from form_logic_rules where form_logic_rules.form_element_id in (select id from form_elements where form_id = any(form_ids)) order by position asc;
    else
      raise exception 'Permission denied';
    end if;
  end
$$;


--
-- Name: forums; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forums (
    id integer NOT NULL,
    project_id integer NOT NULL,
    name text NOT NULL,
    "position" integer DEFAULT 0,
    description text,
    archived boolean DEFAULT false
);


--
-- Name: TABLE forums; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.forums IS '
@omit all
Discussion forums are the highest level organizing unit of the discussion forums
for a project. Each forum can have many topics (threads), which then contain
posts. Only project administrators can create and configure forums.
';


--
-- Name: COLUMN forums.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.forums.name IS 'Title displayed for the forum.';


--
-- Name: COLUMN forums."position"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.forums."position" IS 'Sets position of this forum in the listing. Forums should be listed by position in ascending order. Set using `setForumOrder()`';


--
-- Name: COLUMN forums.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.forums.description IS 'Optional description of the forum to be displayed to project users.';


--
-- Name: COLUMN forums.archived; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.forums.archived IS 'Archived forums will only be accessible by project administrators from the admin dashboard. This is an alternative to deleting a forum.';


--
-- Name: set_forum_order(integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_forum_order("forumIds" integer[]) RETURNS SETOF public.forums
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      pid int;
      pos int;
      forum record;
    begin
      select 
        forums.project_id
      into
        pid
      from
        forums
      where
        forums.id = any ("forumIds")
      limit 1;
      if session_is_admin(pid) = false then
        raise exception 'Must be project admin';
      end if;
      pos = 1;
      for forum in (select * from forums where forums.project_id = pid order by array_position("forumIds", id)) loop
        update forums set position = pos where id = forum.id;
        pos = pos + 1;
      end loop;
      return query select * from forums where forums.project_id = pid order by position asc;
    end
  $$;


--
-- Name: FUNCTION set_forum_order("forumIds" integer[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_forum_order("forumIds" integer[]) IS '
Set the order in which discussion forums will be displayed. Provide a list of forum IDs in the correct order. Missing ids will be added to the end of the list.
';


--
-- Name: set_post_hidden_by_moderator(integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_post_hidden_by_moderator("postId" integer, value boolean) RETURNS public.posts
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      pid int;
      post posts;
    begin
      select
        forums.project_id
      from
        posts
      into
        pid
      inner join
        topics
      on
        posts.topic_id = topics.id
      inner join
        forums
      on
        forums.id = topics.forum_id
      where
        posts.id = "postId";
      if session_is_admin(pid) = false then
        raise exception 'Permission denied';
      end if;
      update posts set hidden_by_moderator = "value" where id = "postId" returning * into post;
      return post;
    end;
  $$;


--
-- Name: FUNCTION set_post_hidden_by_moderator("postId" integer, value boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_post_hidden_by_moderator("postId" integer, value boolean) IS '
Admins can use this function to hide the contents of a message. Message will still appear in the client with the missing content, and should link to the Community Guidelines for why the post may have been hidden. If admins want all evidence of the post removed they must delete it.
';


--
-- Name: set_survey_response_last_updated_by(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_survey_response_last_updated_by() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    NEW.last_updated_by_id = nullif(current_setting('session.user_id', TRUE), '')::integer;
    RETURN NEW;
  END
$$;


--
-- Name: set_topic_locked(integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_topic_locked("topicId" integer, value boolean) RETURNS public.topics
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      pid int;
      topic topics;
    begin
      select
        forums.project_id
      from
        topics
      into
        pid
      inner join
        forums
      on
        forums.id = topics.forum_id
      where
        topics.id = "topicId";
      if session_is_admin(pid) then
        update topics set locked = value where id = "topicId" returning * into topic;
        return topic;
      end if;
      raise exception 'Must be project admin';
    end;
  $$;


--
-- Name: FUNCTION set_topic_locked("topicId" integer, value boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_topic_locked("topicId" integer, value boolean) IS 'Lock a topic so that it can no longer be responded to. Past discussion will still be visible. This mutation is only available to project admins.';


--
-- Name: set_topic_sticky(integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_topic_sticky("topicId" integer, value boolean) RETURNS public.topics
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      pid int;
      topic topics;
    begin
      select
        forums.project_id
      from
        topics
      into
        pid
      inner join
        forums
      on
        forums.id = topics.forum_id
      where
        topics.id = "topicId";
      if session_is_admin(pid) then
        update topics set sticky = value where id = "topicId" returning * into topic;
        return topic;
      end if;
      raise exception 'Must be project admin';
    end;
  $$;


--
-- Name: FUNCTION set_topic_sticky("topicId" integer, value boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_topic_sticky("topicId" integer, value boolean) IS '
Admins can use this mutation to place topics at the top of the forum listing.
';


--
-- Name: set_user_groups(integer, integer, integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_groups("userId" integer, "projectId" integer, groups integer[]) RETURNS integer[]
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    begin 
      if session_is_admin("projectId") or session_is_superuser() THEN
        delete from project_group_members where user_id = "userId" and group_id in (select id from project_groups where project_id = "projectId");
        for i IN 1 ..coalesce(array_upper(groups, 1), 0) loop
          insert into project_group_members (user_id, group_id) values ("userId", groups[i]);
        end loop;
        return groups;
      else
        raise exception 'Permission denied';
      end if;
    end
  $$;


--
-- Name: FUNCTION set_user_groups("userId" integer, "projectId" integer, groups integer[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_user_groups("userId" integer, "projectId" integer, groups integer[]) IS '
Sets the list of groups that the given user belongs to. Will clear all other group memberships in the project. Available only to admins.
';


--
-- Name: share_sprite(integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.share_sprite(sprite_id integer, category text) RETURNS public.sprites
    LANGUAGE sql SECURITY DEFINER
    AS $$
    update sprites set project_id = null, category = share_sprite.category where id = sprite_id and session_is_superuser() returning *;
  $$;


--
-- Name: FUNCTION share_sprite(sprite_id integer, category text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.share_sprite(sprite_id integer, category text) IS 'Superusers only. Promote a sprite to be globally available.';


--
-- Name: shared_basemaps(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shared_basemaps() RETURNS public.basemaps
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select * from basemaps where project_id is null;
  $$;


--
-- Name: FUNCTION shared_basemaps(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.shared_basemaps() IS '
@simpleCollections only
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

COMMENT ON FUNCTION public.sketch_classes_can_digitize(sketch_class public.sketch_classes) IS 'Whether the current user session is allowed to digitize sketches of this type. Digitizing is controlled by admins via access control lists, and archived sketch classes can only be digitized by admins.';


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
-- Name: slugify(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slugify(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$SELECT slugify($1, false)$_$;


--
-- Name: slugify(text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slugify(value text, allow_unicode boolean) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$

  WITH "normalized" AS (
    SELECT CASE
      WHEN "allow_unicode" THEN "value"
      ELSE unaccent("value")
    END AS "value"
  )
  SELECT regexp_replace(
    trim(
      lower(
        regexp_replace(
          "value",
          E'[^\\w\\s-]',
          '',
          'gi'
        )
      )
    ),
    E'[-\\s]+', '-', 'gi'
  ) FROM "normalized";

$$;


--
-- Name: soft_delete_sprite(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.soft_delete_sprite(id integer) RETURNS public.sprites
    LANGUAGE sql SECURITY DEFINER
    AS $$
    update sprites set deleted = true where sprites.id = soft_delete_sprite.id and session_is_superuser() returning *;
  $$;


--
-- Name: FUNCTION soft_delete_sprite(id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.soft_delete_sprite(id integer) IS 'Superusers only. "Deletes" a sprite but keeps it in the DB in case layers are already referencing it.';


--
-- Name: submit_data_upload(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_data_upload(id uuid) RETURNS public.data_upload_tasks
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      upload data_upload_tasks;
    begin
      if session_is_admin((select project_id from data_upload_tasks where data_upload_tasks.id = submit_data_upload.id)) then
        update data_upload_tasks set state = 'uploaded' where data_upload_tasks.id = submit_data_upload.id returning * into upload;
        return upload;
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;


--
-- Name: survey_group_ids(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.survey_group_ids(id integer) RETURNS integer[]
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select array_agg(group_id) from survey_invited_groups where survey_id = id
$$;


--
-- Name: FUNCTION survey_group_ids(id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.survey_group_ids(id integer) IS '@omit';


--
-- Name: survey_invite_before_insert_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.survey_invite_before_insert_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    begin
      if NEW.user_id is null and NEW.email is null then
        raise exception 'Must specific either user_id or email';
      end if;
      if NEW.user_id is not null and (NEW.email is not null or NEW.fullname is not null) then
        raise exception 'Invites created from group lists should not have an email or fullname';
      end if;
      if NEW.email is null and NEW.was_added_from_group = false then
        raise exception 'was_added_from_group should be true if email is blank';
      end if;
      return NEW;
    end;
  $$;


--
-- Name: survey_invite_before_update_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.survey_invite_before_update_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    begin
      if NEW.user_id is null and NEW.email is null then
        raise exception 'Must specific either user_id or email';
      end if;
      if NEW.email is null and NEW.was_added_from_group = false then
        raise exception 'was_added_from_group should be true if email is blank';
      end if;
      return NEW;
    end;
  $$;


--
-- Name: survey_invite_was_used(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.survey_invite_was_used(invite_id integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select was_used from survey_invites where id = invite_id;
  $$;


--
-- Name: FUNCTION survey_invite_was_used(invite_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.survey_invite_was_used(invite_id integer) IS '@omit';


--
-- Name: survey_invites_status(public.survey_invites); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.survey_invites_status(invite public.survey_invites) RETURNS public.invite_status
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      email_status invite_status;
      expired boolean;
      has_complaint boolean;
      has_responded boolean;
    begin
      select exists(select 1 from invite_emails where to_address = invite.email and status = 'COMPLAINT') into has_complaint;
      select exists(select 1 from survey_responses where user_id = invite.user_id and survey_id = invite.survey_id) into has_responded;
      if invite.was_used = true or has_responded = true then 
        return 'CONFIRMED';
      end if;
      if has_complaint then
        return 'COMPLAINT';
      else
        select
          now() > token_expires_at as expired,
          status
        into
          expired,
          email_status
        from
          invite_emails
        where
          survey_invite_id = invite.id
        order by
          created_at desc
        limit 1;
        if expired = true then
          return 'TOKEN_EXPIRED';
        elsif email_status is null then
          return 'QUEUED';
        else
          return email_status::invite_status;
        end if;
      end if;
    end;      
  $$;


--
-- Name: FUNCTION survey_invites_status(invite public.survey_invites); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.survey_invites_status(invite public.survey_invites) IS 'Indicates the status of the invite, e.g. whether an invite email has been sent, status of those emails, and whether a response has been submitted.';


--
-- Name: survey_response_mvt(integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.survey_response_mvt("formElementId" integer, x integer, y integer, z integer) RETURNS bytea
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
  declare
    tile bytea;
  begin
  if session_is_admin(project_id_from_field_id("formElementId")) then
    SELECT ST_AsMVT(q, 'sketches', 4096, 'geom', 'id') into tile
    FROM (
      SELECT
          sketches.id as id,
          sketches.name as name,
          sketches.response_id as response_id,
          survey_responses.is_practice as practice,
          survey_responses.archived as archived,
          ST_AsMVTGeom(
              sketches.mercator_geometry,
              TileBBox(z, x, y, 3857),
              4096,
              256,
              true
          ) geom
      FROM sketches
      inner join
        survey_responses
      on
        survey_responses.id = sketches.response_id
      where sketches.form_element_id = $1
    ) q;
    return tile;
  end if;
  raise exception 'Permission denied';
  end;
$_$;


--
-- Name: FUNCTION survey_response_mvt("formElementId" integer, x integer, y integer, z integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.survey_response_mvt("formElementId" integer, x integer, y integer, z integer) IS '@omit';


--
-- Name: survey_responses_account_email(public.survey_responses); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.survey_responses_account_email(r public.survey_responses) RETURNS text
    LANGUAGE sql STABLE
    AS $$
    select canonical_email from users where id = r.user_id; 
  $$;


--
-- Name: survey_responses_last_updated_by_email(public.survey_responses); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.survey_responses_last_updated_by_email(r public.survey_responses) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select canonical_email from users where users.id = r.last_updated_by_id;
$$;


--
-- Name: survey_validation_info(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.survey_validation_info(survey_id integer) RETURNS public.survey_validation_info_composite
    LANGUAGE sql SECURITY DEFINER
    AS $$
    select is_disabled, limit_to_single_response from surveys where id = survey_id;
  $$;


--
-- Name: FUNCTION survey_validation_info(survey_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.survey_validation_info(survey_id integer) IS '@omit';


--
-- Name: surveys_archived_response_count(public.surveys); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.surveys_archived_response_count(survey public.surveys) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    select count(*)::int from survey_responses where survey_id = survey.id and is_draft = false and archived = true;
$$;


--
-- Name: surveys_basemaps(public.surveys); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.surveys_basemaps(survey public.surveys) RETURNS SETOF public.basemaps
    LANGUAGE sql STABLE
    AS $$
    select * from basemaps where id = any(select distinct(unnest(array_cat(
      (select array_agg(c) from (
        select unnest(map_basemaps) from form_elements where form_id = (
          select id from forms where survey_id = survey.id) and layout = any('{MAP_STACKED,MAP_SIDEBAR_LEFT,MAP_SIDEBAR_RIGHT,MAP_FULLSCREEN,MAP_TOP}')
        ) as dt(c)
      ),
      (select array_agg(basemaps) from (
        select jsonb_array_elements(component_settings->'basemaps') as basemaps from form_elements where form_id = (
          select id from forms where survey_id = survey.id
        ) and component_settings->'basemaps' is not null
      ) as f)::int[]
    ))));
  $$;


--
-- Name: FUNCTION surveys_basemaps(survey public.surveys); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.surveys_basemaps(survey public.surveys) IS '@simpleCollections only';


--
-- Name: surveys_invited_groups(public.surveys); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.surveys_invited_groups(survey public.surveys) RETURNS SETOF public.project_groups
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    begin
      if session_is_admin(survey.project_id) = false then
        raise exception 'Must be project admin';
      end if;
      return query select 
        * 
      from 
        project_groups
      where
        id = any( select group_id from survey_invited_groups where survey_id = survey.id);
    end;
  $$;


--
-- Name: FUNCTION surveys_invited_groups(survey public.surveys); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.surveys_invited_groups(survey public.surveys) IS '
@simpleCollections only
';


--
-- Name: surveys_is_spatial(public.surveys); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.surveys_is_spatial(s public.surveys) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    select count(id) > 0 from form_elements inner join form_element_types on form_element_types.component_name = form_elements.type_id where form_id = (select id from forms where survey_id = s.id) and form_element_types.is_spatial = true
  $$;


--
-- Name: surveys_is_template(public.surveys); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.surveys_is_template(survey public.surveys) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select is_template from forms where survey_id = survey.id;
  $$;


--
-- Name: surveys_practice_response_count(public.surveys); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.surveys_practice_response_count(survey public.surveys) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    select count(*)::int from survey_responses where survey_id = survey.id and is_draft = false and is_practice = true and archived = false;
$$;


--
-- Name: surveys_responses_spatial_extent(public.surveys); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.surveys_responses_spatial_extent(survey public.surveys) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      bbox text;
    begin
      if (session_is_admin(survey.project_id)) then
        select st_asgeojson(st_extent(user_geom)) into bbox from sketches where response_id in (
          select id from survey_responses where survey_id = survey.id
        );
        return bbox;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;


--
-- Name: surveys_submitted_response_count(public.surveys); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.surveys_submitted_response_count(survey public.surveys) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    select count(*)::int from survey_responses where survey_id = survey.id and is_draft = false and is_practice = false and archived = false;
$$;


--
-- Name: template_forms(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.template_forms() RETURNS SETOF public.forms
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select * from forms where is_template = true;
  $$;


--
-- Name: FUNCTION template_forms(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.template_forms() IS '@simpleCollections only';


--
-- Name: tilebbox(integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tilebbox(z integer, x integer, y integer, srid integer DEFAULT 3857) RETURNS public.geometry
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
    max numeric := 20037508.34;
    res numeric := (max*2)/(2^z);
    bbox geometry;
begin
    bbox := ST_MakeEnvelope(
        -max + (x * res),
        max - (y * res),
        -max + (x * res) + res,
        max - (y * res) - res,
        3857
    );
    if srid = 3857 then
        return bbox;
    else
        return ST_Transform(bbox, srid);
    end if;
end;
$$;


--
-- Name: toggle_admin_access(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_admin_access("projectId" integer, "userId" integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      already_admin boolean;
    BEGIN
      IF session_is_admin("projectId") or session_is_superuser() THEN
        IF exists(select 1 from project_participants where user_id = "userId" and project_id = "projectId" and share_profile = true) THEN
          select is_admin into already_admin from project_participants where user_id = "userId" and project_id = "projectId";
          update project_participants set is_admin = not(already_admin) where user_id = "userId" and project_id = "projectId";
          return not(already_admin);
        ELSE
          raise exception 'User must join the project and share their user profile first.';
        END IF;
      ELSE
        raise exception 'You must be a project administrator';
      END IF;
    END
  $$;


--
-- Name: FUNCTION toggle_admin_access("projectId" integer, "userId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.toggle_admin_access("projectId" integer, "userId" integer) IS 'Toggle admin access for the given project and user. User must have already joined the project and shared their user profile.';


--
-- Name: toggle_forum_posting_ban(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_forum_posting_ban("userId" integer, "projectId" integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      is_banned boolean;
    begin
      if session_is_admin("projectId") then
        select is_banned_from_forums into is_banned from project_participants where project_id = "projectId" and user_id = "userId";
        update project_participants set is_banned_from_forums = not(is_banned) where project_id = "projectId" and user_id = "userId";
        return not(is_banned);
      else
        raise exception 'Must be project admin';
      end if;
    end;
  $$;


--
-- Name: FUNCTION toggle_forum_posting_ban("userId" integer, "projectId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.toggle_forum_posting_ban("userId" integer, "projectId" integer) IS 'Ban a user from posting in the discussion forum';


--
-- Name: toggle_responses_practice(integer[], boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_responses_practice(ids integer[], "isPractice" boolean) RETURNS SETOF public.survey_responses
    LANGUAGE sql
    AS $$
    update survey_responses set is_practice = "isPractice" where id = any(ids) returning survey_responses.*;
$$;


--
-- Name: topics_author_profile(public.topics); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.topics_author_profile(topic public.topics) RETURNS public.user_profiles
    LANGUAGE sql STABLE
    AS $$
    select
      user_profiles.*
    from
      user_profiles
    inner join
      topics
    on
      topics.id = topic.id
    inner join
      project_participants
    on
      project_participants.user_id = topic.author_id
    where
      project_participants.share_profile = true
    limit 1;
  $$;


--
-- Name: FUNCTION topics_author_profile(topic public.topics); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.topics_author_profile(topic public.topics) IS '
User Profile of the author. If a user has not shared their profile the first post contents will be hidden.
';


--
-- Name: unsubscribed(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unsubscribed("userId" integer) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    AS $$
    select exists(select 1 from email_notification_preferences where user_id = "userId" and unsubscribe_all = true)
$$;


--
-- Name: FUNCTION unsubscribed("userId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.unsubscribed("userId" integer) IS '@omit';


--
-- Name: update_basemap_offline_tile_settings(integer, integer, boolean, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_basemap_offline_tile_settings("projectId" integer, "basemapId" integer, use_default boolean, "maxZ" integer, "maxShorelineZ" integer) RETURNS public.basemaps
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      existing_settings_id int;
      return_value basemaps;
    begin
      if session_is_admin("projectId") then
        update basemaps set use_default_offline_tile_settings = use_default where id = "basemapId";
        if use_default then
          select id into existing_settings_id from offline_tile_settings where project_id = "projectId" and basemap_id is null;
          if existing_settings_id is null then
            insert into offline_tile_settings (project_id, max_z, max_shoreline_z, region) values ("projectId", "maxZ", "maxShorelineZ", (select region from projects where id = "projectId"));
          else
            update offline_tile_settings set max_z = "maxZ", max_shoreline_z = "maxShorelineZ" where id = existing_settings_id;
          end if;
        else
          select id into existing_settings_id from offline_tile_settings where project_id = "projectId" and basemap_id = "basemapId";
          if existing_settings_id is null then
            insert into offline_tile_settings (project_id, basemap_id, max_z, max_shoreline_z, region) values ("projectId", "basemapId", "maxZ", "maxShorelineZ", (select region from projects where id = "projectId"));
          else
            update offline_tile_settings set max_z = "maxZ", max_shoreline_z = "maxShorelineZ" where id = existing_settings_id;
          end if;
        end if;
        select * into return_value from basemaps where id = "basemapId" and session_is_admin(basemaps.project_id);
        return return_value;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;


--
-- Name: update_mapbox_secret_key(integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_mapbox_secret_key(project_id integer, secret text) RETURNS public.projects
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      p projects;
    begin
      if session_is_admin(project_id) then
        update projects set mapbox_secret_key = secret where projects.id = project_id returning * into p;
        return p;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;


--
-- Name: update_post(integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_post("postId" integer, message jsonb) RETURNS public.posts
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      pid int;
      tid int;
      post posts;
    begin
      select
        topics.id,
        forums.project_id
      from
        posts
      into
        tid,
        pid
      inner join
        topics
      on
        posts.topic_id = topics.id
      inner join
        forums
      on
        forums.id = topics.forum_id
      where
        posts.id = "postId";

      if session_is_admin(pid) then
        update 
          posts 
        set 
          message_contents = message
        where
          id = "postId"
        returning
          *
        into
          post;
        return post;
      else
        if not exists(select 1 from posts where id = "postId" and author_id = current_setting('session.user_id', TRUE)::int) then
          raise exception 'Permission denied';
        end if;
        if not exists(select 1 from posts where id = "postId" and created_at > now() - interval '5 minutes') then
          raise exception 'Posts can only be edited in the first 5 minutes after posting.';
        end if;
        update 
          posts 
        set 
          message_contents = message
        where
          id = "postId"
        returning
          *
        into
          post;
        return post;
      end if;
    end;
  $$;


--
-- Name: FUNCTION update_post("postId" integer, message jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_post("postId" integer, message jsonb) IS '
Updates the contents of the post. Can only be used by the author for 5 minutes after posting.
';


--
-- Name: update_project_invite(integer, boolean, text, text, integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_project_invite("inviteId" integer, make_admin boolean, email text, fullname text, groups integer[]) RETURNS public.project_invites
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      pid int;
      status invite_status;
      current_email text;
      used boolean;
      _email text;
      _make_admin boolean;
      _fullname text;
      invite project_invites;
    begin
      select "email", "make_admin", "fullname" into _email, _make_admin, _fullname;
      select project_id, project_invites_status(project_invites.*), project_invites.email, was_used into pid, status, current_email, used from project_invites where project_invites.id = "inviteId";
      if session_is_admin(pid) then
        if status != 'UNSENT'::invite_status and current_email != _email then
          raise exception 'Cannot change email if invite has already been sent.';
        end if;
        if used is true then
          raise exception 'Cannot update invite if it has already been used.';
        end if;
        update project_invites set email = _email, fullname = _fullname, make_admin = _make_admin where id = "inviteId";
        delete from project_invite_groups where invite_id = "inviteId";
        for i IN 1 ..coalesce(array_upper(groups, 1), 0) loop
          insert into project_invite_groups (invite_id, group_id) values ("inviteId", "groups"[i]);
        end loop;
        select * into invite from project_invites where project_invites.id = "inviteId";
        return invite;
      else
        raise exception 'Must be a project admin';
      end if;
    end;
  $$;


--
-- Name: update_survey_group_invites(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_survey_group_invites(surveyid integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    begin
      -- delete group-related invites for users that do not belong to any of the groups
      delete from
        survey_invites
      where
        survey_invites.was_added_from_group = true and
        survey_invites.survey_id = surveyid and
        not exists (
          select 
            1 
          from 
            project_group_members 
          where
            project_group_members.user_id = survey_invites.user_id and
            project_group_members.group_id = any (
              select
                group_id
              from
                survey_invited_groups
              where
                survey_invited_groups.survey_id = surveyid
              
            )
        );
      -- find users in related groups who are lacking an invite and add them
      insert into survey_invites (
        user_id,
        survey_id,
        was_added_from_group
      ) select
        distinct user_id,
        surveyid,
        true
      from
        project_group_members
      where
        project_group_members.group_id = any (
          select
            group_id
          from
            survey_invited_groups
          where
            survey_invited_groups.survey_id = surveyid
        ) and not exists (
          select 1 from 
            survey_invites
          where
            survey_id = surveyid and
            user_id = project_group_members.user_id
        );
    end;
$$;


--
-- Name: FUNCTION update_survey_group_invites(surveyid integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_survey_group_invites(surveyid integer) IS '
Not for use in graphql api. Is called by update functions and triggers related
to group membership and survey invited groups to update the list of invitations.
';


--
-- Name: update_survey_invited_groups(integer, integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_survey_invited_groups("surveyId" integer, "groupIds" integer[]) RETURNS SETOF public.project_groups
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      pid int;
    begin
      select project_id into pid from surveys where id = "surveyId";
      if session_is_admin(pid) = false then
        raise exception 'Must be project admin';
      end if;
      delete from survey_invited_groups where survey_id = "surveyId";
      insert into survey_invited_groups (survey_id, group_id) select "surveyId", id from project_groups where project_id = pid and id = any("groupIds");
      perform update_survey_group_invites("surveyId");
      return query select * from project_groups where id = any("groupIds");
    end;
  $$;


--
-- Name: FUNCTION update_survey_invited_groups("surveyId" integer, "groupIds" integer[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_survey_invited_groups("surveyId" integer, "groupIds" integer[]) IS '
Updates the list of groups that should have access to the given survey. Users
in any added groups will get an invite, and the system will create an invite for
any users that are added to the group. When removing a group, the system will
delete invites for any user that is no longer in an invited group. *Clients
should warn admins of this behavior when removing groups for an active survey*.

The list of invited groups can be accessed via `Survey.invitedGroups`.
';


--
-- Name: update_table_of_contents_item_children(integer, integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_table_of_contents_item_children("parentId" integer, "childIds" integer[]) RETURNS SETOF public.table_of_contents_items
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      "parentStableId" text;
      "maxRootSortIndex" int;
      "projectId" int;
      item table_of_contents_items;
    begin
      select project_id into "projectId" from table_of_contents_items where id = "parentId" or id = "childIds"[1] limit 1;
      if "projectId" is null then
        raise 'Could not find draft item with id = %', "parentId";
      end if;
      if session_is_admin("projectId") = false then
        raise 'Permission denied';
      end if;
      if (select count(id) from table_of_contents_items where project_id != "projectId" and id = any("childIds")) > 0 then
        raise 'Permission denied. Not all items in project';
      end if;
      select stable_id into "parentStableId" from table_of_contents_items where id = "parentId";
      -- clear any parent id associations for children that are no longer in the list (unrooted)
      select max(sort_index) into "maxRootSortIndex" from table_of_contents_items where is_draft = true and project_id = "projectId" and parent_stable_id = null;
      -- update paths, sort index of "unrooted" items
      for item in select * from table_of_contents_items where parent_stable_id = "parentStableId" and is_draft = true and id != any("childIds") loop
        "maxRootSortIndex" = "maxRootSortIndex" + 1;
        perform update_table_of_contents_item_position(item.id, null, "maxRootSortIndex");
      end loop;
      -- Update position (parent & sort_index) of listed children
      for i in array_lower("childIds", 1)..array_upper("childIds", 1) loop
        perform update_table_of_contents_item_position("childIds"[i], "parentStableId", i - 1);
      end loop;
      -- select * into children from table_of_contents_items where id = any("childIds");
      -- return children;
      return query select * from table_of_contents_items where id = any("childIds");
    end;
$$;


--
-- Name: update_table_of_contents_item_parent(integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_table_of_contents_item_parent("itemId" integer, "parentStableId" text) RETURNS public.table_of_contents_items
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    begin
      return update_table_of_contents_item_position("itemId", "parentStableId", 0);
    end;
  $$;


--
-- Name: FUNCTION update_table_of_contents_item_parent("itemId" integer, "parentStableId" text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_table_of_contents_item_parent("itemId" integer, "parentStableId" text) IS '@omit';


--
-- Name: update_table_of_contents_item_position(integer, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_table_of_contents_item_position("itemId" integer, "parentStableId" text, "sortIndex" integer) RETURNS public.table_of_contents_items
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      pid int;
      parent_path ltree;
      current_path ltree;
      item table_of_contents_items;
    begin
      select project_id into pid from table_of_contents_items where id = "itemId" and is_draft = true;
      if pid is null then
        raise 'Could not find draft item with id = %', "itemId";
      end if;
      if session_is_admin(pid) = false then
        raise 'Permission denied';
      end if;
      select path into current_path from table_of_contents_items where id = "itemId" and is_draft = true;

      update table_of_contents_items set parent_stable_id = "parentStableId", sort_index = "sortIndex" where id = "itemId";
      -- TODO: handle movement of item into the root
      if "parentStableId" is not null then
        select path into parent_path from table_of_contents_items where is_draft = true and project_id = pid and stable_id = "parentStableId";
        if parent_path is null then
          raise 'Could not find valid parent with stable_id=%', "parentStableId";
        else
          update 
            table_of_contents_items 
          set path = parent_path || subpath(path, nlevel(current_path)-1) 
          where 
            is_draft = true and
            path <@ current_path;
        end if;
      else
        update 
          table_of_contents_items 
        set path = subpath(path, nlevel(current_path)-1) 
        where 
          is_draft = true and
          path <@ current_path;
      end if;
      select * into item from table_of_contents_items where id = "itemId";
      return item;
    end;
  $$;


--
-- Name: FUNCTION update_table_of_contents_item_position("itemId" integer, "parentStableId" text, "sortIndex" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_table_of_contents_item_position("itemId" integer, "parentStableId" text, "sortIndex" integer) IS '@omit';


--
-- Name: update_z_indexes(integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_z_indexes("dataLayerIds" integer[]) RETURNS SETOF public.data_layers
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    z int;
    pid int;
  begin
    if (select count(distinct(project_id)) from data_layers where id = any("dataLayerIds")) > 1 then
      raise 'Denied. Attempting to modify more than one project.';
    end if;
    if (session_is_admin((select project_id from data_layers where id = any("dataLayerIds") limit 1))) != true then
      raise 'Unauthorized';
    end if;
    z = 0;
    for i in array_lower("dataLayerIds", 1)..array_upper("dataLayerIds", 1) loop
      z = z + 1;
      update data_layers set z_index = z where id = "dataLayerIds"[i];
    end loop;
    return query (select * from data_layers where id = any("dataLayerIds"));
  end
$$;


--
-- Name: users_access_request_denied(public.users, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.users_access_request_denied(u public.users, slug text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    select exists (
      select 
        1 
      from 
        project_participants 
      where 
        project_participants.user_id = u.id and 
        project_participants.approved = false and 
        project_participants.denied_by is not null and
        project_participants.project_id = (
          select id from projects where projects.slug = users_access_request_denied.slug and projects.access_control != 'public'
        )
      )
  $$;


--
-- Name: users_approved_by(public.users, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.users_approved_by(u public.users, project_id integer) RETURNS public.users
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select 
      * 
    from 
      users 
    where 
      session_is_admin(project_id) and 
      id = (
        select 
          approved_by 
        from 
          project_participants 
        where 
          project_participants.project_id = users_approved_by.project_id and
          project_participants.user_id = u.id
      )
  $$;


--
-- Name: users_approved_or_denied_on(public.users, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.users_approved_or_denied_on(u public.users, project_id integer) RETURNS timestamp with time zone
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select approved_or_denied_on from project_participants where user_id = u.id and project_participants.project_id = users_approved_or_denied_on.project_id and session_is_admin(users_approved_or_denied_on.project_id);
  $$;


--
-- Name: users_banned_from_forums(public.users); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.users_banned_from_forums(u public.users) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      is_banned boolean;
    begin
      if session_is_admin(current_setting('session.project_id', true)::int) then
        select is_banned_from_forums into is_banned from project_participants where project_id = current_setting('session.project_id', true)::int and user_id = u.id;
        return is_banned;
      else
        raise exception 'Must be a project admin';
      end if;
    end;
  $$;


--
-- Name: FUNCTION users_banned_from_forums(u public.users); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.users_banned_from_forums(u public.users) IS 'Whether the user has been banned from the forums. Use `disableForumPosting()` and `enableForumPosting()` mutations to modify this state. Accessible only to admins.';


--
-- Name: users_canonical_email(public.users); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.users_canonical_email(_user public.users) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select canonical_email from users where id in (select user_id from project_participants where project_participants.user_id = _user.id and session_is_admin(project_participants.project_id))
  $$;


--
-- Name: FUNCTION users_canonical_email(_user public.users); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.users_canonical_email(_user public.users) IS '
Only visible to admins of projects a user has joined. Can be used for identification purposes since users will not gain any access control privileges until this email has been confirmed.
';


--
-- Name: users_denied_by(public.users, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.users_denied_by(u public.users, project_id integer) RETURNS public.users
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select * from users where session_is_admin(project_id) and id = (select denied_by from project_participants where project_participants.project_id = users_denied_by.project_id and project_participants.user_id = u.id)
  $$;


--
-- Name: users_groups(public.users); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.users_groups(u public.users) RETURNS SETOF public.project_groups
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select 
      * 
    from 
      project_groups 
    where 
      project_id = (
        current_setting('session.project_id', true)::int
      ) and 
      session_is_admin(current_setting('session.project_id', true)::int) and
      id = any((
        select group_id from project_group_members where user_id = u.id
      ))
  $$;


--
-- Name: FUNCTION users_groups(u public.users); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.users_groups(u public.users) IS '
@simpleCollections only
List of groups for the given project and user. Only available to project admins.
';


--
-- Name: users_is_admin(public.users); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.users_is_admin(u public.users) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      "isAdmin" boolean;
    begin
      select coalesce(is_admin, session_is_superuser(), false) into "isAdmin" from project_participants where user_id = u.id and project_id = current_setting('session.project_id', true)::int and session_is_admin(current_setting('session.project_id', true)::int);
      return coalesce("isAdmin", false);
    end;
  $$;


--
-- Name: FUNCTION users_is_admin(u public.users); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.users_is_admin(u public.users) IS '
Indicates if user is admin on the current project, indicated by the `x-ss-slug` header.
';


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
-- Name: FUNCTION users_is_approved(u public.users, project integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.users_is_approved(u public.users, project integer) IS '@omit';


--
-- Name: users_needs_access_request_approval(public.users, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.users_needs_access_request_approval(u public.users, slug text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    select exists (select 1 from project_participants where project_participants.user_id = u.id and project_participants.approved = false and project_participants.project_id = (select id from projects where projects.slug = users_needs_access_request_approval.slug and projects.access_control != 'public'))
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
      case when exists (
        select 1 from project_participants where user_id = u.id and project_id = "projectId" and share_profile = true
      ) then
        'participant_shared_profile'::participation_status
      else
        'participant_hidden_profile'::participation_status
      end
    else
      'pending_approval'::participation_status
    end
  else
    'none'::participation_status
  end
$$;


--
-- Name: job_queues; Type: TABLE; Schema: graphile_worker; Owner: -
--

CREATE TABLE graphile_worker.job_queues (
    queue_name text NOT NULL,
    job_count integer NOT NULL,
    locked_at timestamp with time zone,
    locked_by text
);


--
-- Name: jobs_id_seq; Type: SEQUENCE; Schema: graphile_worker; Owner: -
--

CREATE SEQUENCE graphile_worker.jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: graphile_worker; Owner: -
--

ALTER SEQUENCE graphile_worker.jobs_id_seq OWNED BY graphile_worker.jobs.id;


--
-- Name: known_crontabs; Type: TABLE; Schema: graphile_worker; Owner: -
--

CREATE TABLE graphile_worker.known_crontabs (
    identifier text NOT NULL,
    known_since timestamp with time zone NOT NULL,
    last_execution timestamp with time zone
);


--
-- Name: migrations; Type: TABLE; Schema: graphile_worker; Owner: -
--

CREATE TABLE graphile_worker.migrations (
    id integer NOT NULL,
    ts timestamp with time zone DEFAULT now() NOT NULL
);


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
-- Name: basemaps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.basemaps ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.basemaps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: bbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bbox (
    st_extent public.box2d
);


--
-- Name: community_guidelines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.community_guidelines (
    project_id integer NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: TABLE community_guidelines; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.community_guidelines IS '
@omit many,all
Community guidelines can be set by project admins with standards for using the 
discussion forums. Users will be shown this content before making their first
post, and they will be shown when posts are hidden by moderators for violating
community standards.
';


--
-- Name: COLUMN community_guidelines.content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.community_guidelines.content IS '
JSON contents are expected to be used with a system like DraftJS on the client.
';


--
-- Name: data_layers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.data_layers ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.data_layers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: data_source_import_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_source_import_types (
    type text NOT NULL,
    description text
);


--
-- Name: TABLE data_source_import_types; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.data_source_import_types IS '@enum';


--
-- Name: data_source_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_source_types (
    type text NOT NULL,
    description text
);


--
-- Name: TABLE data_source_types; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.data_source_types IS '@enum';


--
-- Name: data_sources_buckets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_sources_buckets (
    url text NOT NULL,
    name text NOT NULL,
    region text NOT NULL,
    location public.geometry(Point,4326) NOT NULL,
    offline boolean DEFAULT false NOT NULL,
    bucket text
);


--
-- Name: COLUMN data_sources_buckets.url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources_buckets.url IS 'Base url for this point-of-presence.';


--
-- Name: COLUMN data_sources_buckets.offline; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.data_sources_buckets.offline IS 'Indicates the DataHostingStack for this region has been deleted';


--
-- Name: data_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.data_sources ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.data_sources_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: deleted_geojson_objects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deleted_geojson_objects (
    id integer NOT NULL,
    object_key text NOT NULL,
    bucket text NOT NULL
);


--
-- Name: deleted_geojson_objects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.deleted_geojson_objects ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.deleted_geojson_objects_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: email_notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_notification_preferences (
    user_id integer NOT NULL,
    unsubscribe_all boolean DEFAULT false NOT NULL,
    frequency public.email_summary_frequency DEFAULT 'WEEKLY'::public.email_summary_frequency NOT NULL,
    notify_on_reply boolean DEFAULT true NOT NULL
);


--
-- Name: TABLE email_notification_preferences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.email_notification_preferences IS '
Email notification preferences can be read and set by the current user session.
These settings cannot be accessed by other users or SeaSketch project admins.
';


--
-- Name: COLUMN email_notification_preferences.unsubscribe_all; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_notification_preferences.unsubscribe_all IS '
If selected, users should receive absolutely no email from SeaSketch. Invite 
emails should not be sent and their status should be set to UNSUBSCRIBED.
';


--
-- Name: COLUMN email_notification_preferences.frequency; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_notification_preferences.frequency IS '
How often users should be notified of SeaSketch project activity.
';


--
-- Name: COLUMN email_notification_preferences.notify_on_reply; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_notification_preferences.notify_on_reply IS '
If set, users should receive realtime notifications of responses to discussion
forum threads for which they are a participant.
';


--
-- Name: form_fields_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.form_elements ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.form_fields_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: form_logic_conditions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.form_logic_conditions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.form_logic_conditions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: form_logic_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.form_logic_rules ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.form_logic_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: forms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.forms ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.forms_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
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
-- Name: interactivity_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interactivity_settings (
    id integer NOT NULL,
    type public.interactivity_type DEFAULT 'NONE'::public.interactivity_type NOT NULL,
    short_template text,
    long_template text,
    cursor public.cursor_type DEFAULT 'AUTO'::public.cursor_type NOT NULL,
    layers text[]
);


--
-- Name: TABLE interactivity_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.interactivity_settings IS '
@simpleCollections only
@omit all
';


--
-- Name: COLUMN interactivity_settings.layers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.interactivity_settings.layers IS '
Used only for basemap interactivity settings. Optional list of layer ids that this setting applies to.
';


--
-- Name: interactivity_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.interactivity_settings ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.interactivity_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: invite_emails_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.invite_emails ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.invite_emails_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: jwks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jwks (
    kid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    kty text DEFAULT 'RSA'::text NOT NULL,
    e text NOT NULL,
    use text DEFAULT 'sig'::text NOT NULL,
    alg text DEFAULT 'RS256'::text NOT NULL,
    n text NOT NULL,
    private_pem text NOT NULL,
    public_pem text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at timestamp with time zone DEFAULT timezone('utc'::text, (now() + '120 days'::interval)) NOT NULL
);


--
-- Name: TABLE jwks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.jwks IS '
@omit
JSON web key set table. Design guided by https://tools.ietf.org/html/rfc7517
';


--
-- Name: offline_tile_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offline_tile_settings (
    id integer NOT NULL,
    project_id integer NOT NULL,
    basemap_id integer,
    region public.geometry(Polygon,4326) NOT NULL,
    max_z integer DEFAULT 11 NOT NULL,
    max_shoreline_z integer DEFAULT 14,
    CONSTRAINT offline_tile_settings_check CHECK (((max_shoreline_z > max_z) AND (max_shoreline_z <= 16))),
    CONSTRAINT offline_tile_settings_max_z_check CHECK (((max_z >= 6) AND (max_z <= 16)))
);


--
-- Name: TABLE offline_tile_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.offline_tile_settings IS '@simpleCollections only';


--
-- Name: offline_tile_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.offline_tile_settings ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.offline_tile_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: optional_basemap_layers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.optional_basemap_layers (
    id integer NOT NULL,
    basemap_id integer NOT NULL,
    layers text[] DEFAULT ARRAY[]::text[] NOT NULL,
    default_visibility boolean DEFAULT true NOT NULL,
    name text NOT NULL,
    description text,
    group_type public.optional_basemap_layers_group_type DEFAULT 'NONE'::public.optional_basemap_layers_group_type NOT NULL,
    metadata jsonb,
    options jsonb
);


--
-- Name: TABLE optional_basemap_layers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.optional_basemap_layers IS '
@omit all
@simpleCollections only
Available only for MapBox GL Style-based basemaps. Specifies optional components of the basemap that can be shown or hidden.
';


--
-- Name: COLUMN optional_basemap_layers.layers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.optional_basemap_layers.layers IS 'IDs for layers in the gl style that will be toggled by this option.';


--
-- Name: COLUMN optional_basemap_layers.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.optional_basemap_layers.name IS 'Label that will be given in the UI';


--
-- Name: COLUMN optional_basemap_layers.group_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.optional_basemap_layers.group_type IS 'Specify RADIO or SELECT if this option should be presented as a group of options. Useful for mutually exclusive views like different years for the same dataset, or a heatmap display of density for multiple species where a single species must be chosen from a list. If left null, the option will be treated as standalone.';


--
-- Name: COLUMN optional_basemap_layers.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.optional_basemap_layers.metadata IS 'JSON representation of a ProseMirror document with layer metadata.';


--
-- Name: optional_basemap_layers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.optional_basemap_layers ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.optional_basemap_layers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: pending_topic_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_topic_notifications (
    id integer NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    topic_id integer NOT NULL,
    user_id integer NOT NULL
);


--
-- Name: TABLE pending_topic_notifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.pending_topic_notifications IS '
Created by trigger whenever a new message is posted to a topic, for each user who has 
replied to that topic. A backend process will need to periodically check this 
table and delete records.
';


--
-- Name: pending_topic_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.pending_topic_notifications ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.pending_topic_notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: posts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.posts ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.posts_id_seq
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
-- Name: project_invite_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_invite_groups (
    invite_id integer NOT NULL,
    group_id integer NOT NULL
);


--
-- Name: project_invites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.project_invites ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.project_invites_id_seq
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
    share_profile boolean DEFAULT false NOT NULL,
    is_banned_from_forums boolean DEFAULT false NOT NULL,
    approved_by integer,
    denied_by integer,
    approved_or_denied_on timestamp with time zone
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
-- Name: projects_shared_basemaps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects_shared_basemaps (
    basemap_id integer NOT NULL,
    project_id integer NOT NULL
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
-- Name: sprite_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sprite_images (
    sprite_id integer NOT NULL,
    pixel_ratio integer DEFAULT 1 NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    url text NOT NULL,
    CONSTRAINT sprite_images_height_check CHECK (((height > 0) AND (height <= 1024))),
    CONSTRAINT sprite_images_width_check CHECK (((width > 0) AND (width <= 1024)))
);


--
-- Name: TABLE sprite_images; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sprite_images IS '
@omit all
@simpleCollections only
';


--
-- Name: COLUMN sprite_images.pixel_ratio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sprite_images.pixel_ratio IS 'Device pixel ratio a copy of this image supports. 2x would be for "retina" devices. Multiple records may point to the same sprite id, but each must have a unique combination of id, pixel_ratio, and data_layer_id.';


--
-- Name: COLUMN sprite_images.width; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sprite_images.width IS 'Must be <= 1024';


--
-- Name: COLUMN sprite_images.height; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sprite_images.height IS 'Must be <= 1024';


--
-- Name: COLUMN sprite_images.url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sprite_images.url IS 'Supports multipart Upload operations';


--
-- Name: sprites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.sprites ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.sprites_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: style_template_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.style_template_groups (
    id integer NOT NULL,
    name text NOT NULL,
    CONSTRAINT style_template_groups_name_check CHECK (((char_length(name) <= 32) AND (char_length(name) >= 0)))
);


--
-- Name: style_template_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.style_template_groups ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.style_template_groups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: style_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.style_templates (
    id integer NOT NULL,
    project_id integer,
    group_id integer,
    mapbox_gl_styles jsonb NOT NULL,
    sprite_ids integer[] GENERATED ALWAYS AS (public.extract_sprite_ids((mapbox_gl_styles)::text)) STORED,
    render_under public.render_under_type DEFAULT 'labels'::public.render_under_type NOT NULL,
    keywords text DEFAULT ''::text NOT NULL
);


--
-- Name: style_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.style_templates ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.style_templates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: survey_consent_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_consent_documents (
    id integer NOT NULL,
    form_element_id integer NOT NULL,
    version integer NOT NULL,
    url text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: survey_consent_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.survey_consent_documents ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.survey_consent_documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: survey_invited_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_invited_groups (
    survey_id integer NOT NULL,
    group_id integer NOT NULL
);


--
-- Name: TABLE survey_invited_groups; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.survey_invited_groups IS '
@omit all
@simpleCollections only
';


--
-- Name: survey_invites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.survey_invites ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.survey_invites_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: survey_response_network_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_response_network_addresses (
    survey_id integer NOT NULL,
    ip_hash text NOT NULL,
    num_responses integer DEFAULT 1 NOT NULL
);


--
-- Name: survey_responses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.survey_responses ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.survey_responses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: surveys_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.surveys ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.surveys_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: table_of_contents_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.table_of_contents_items ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.table_of_contents_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: topic_notification_unsubscribes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topic_notification_unsubscribes (
    id integer NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    topic_id integer NOT NULL,
    user_id integer NOT NULL
);


--
-- Name: TABLE topic_notification_unsubscribes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.topic_notification_unsubscribes IS '
Users are emailed notifications when there is a response to discussion topics 
they have replied to. These could get annoying for very chatty threads, so users
have the option to unsubscribe to a single topic by clicking a link in their 
email. This link should include a jwt token that identifies the project, topic, 
and user.
';


--
-- Name: topic_notification_unsubscribes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.topic_notification_unsubscribes ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.topic_notification_unsubscribes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: topics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.topics ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.topics_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


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
-- Name: jobs id; Type: DEFAULT; Schema: graphile_worker; Owner: -
--

ALTER TABLE ONLY graphile_worker.jobs ALTER COLUMN id SET DEFAULT nextval('graphile_worker.jobs_id_seq'::regclass);


--
-- Name: job_queues job_queues_pkey; Type: CONSTRAINT; Schema: graphile_worker; Owner: -
--

ALTER TABLE ONLY graphile_worker.job_queues
    ADD CONSTRAINT job_queues_pkey PRIMARY KEY (queue_name);


--
-- Name: jobs jobs_key_key; Type: CONSTRAINT; Schema: graphile_worker; Owner: -
--

ALTER TABLE ONLY graphile_worker.jobs
    ADD CONSTRAINT jobs_key_key UNIQUE (key);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: graphile_worker; Owner: -
--

ALTER TABLE ONLY graphile_worker.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: known_crontabs known_crontabs_pkey; Type: CONSTRAINT; Schema: graphile_worker; Owner: -
--

ALTER TABLE ONLY graphile_worker.known_crontabs
    ADD CONSTRAINT known_crontabs_pkey PRIMARY KEY (identifier);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: graphile_worker; Owner: -
--

ALTER TABLE ONLY graphile_worker.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: access_control_list_groups access_control_list_groups_access_control_list_id_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_control_list_groups
    ADD CONSTRAINT access_control_list_groups_access_control_list_id_group_id_key UNIQUE (access_control_list_id, group_id);


--
-- Name: access_control_lists access_control_lists_basemap_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_control_lists
    ADD CONSTRAINT access_control_lists_basemap_id_key UNIQUE (basemap_id);


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
-- Name: access_control_lists access_control_lists_table_of_contents_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_control_lists
    ADD CONSTRAINT access_control_lists_table_of_contents_item_id_key UNIQUE (table_of_contents_item_id);


--
-- Name: basemaps basemaps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.basemaps
    ADD CONSTRAINT basemaps_pkey PRIMARY KEY (id);


--
-- Name: community_guidelines community_guidelines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_guidelines
    ADD CONSTRAINT community_guidelines_pkey PRIMARY KEY (project_id);


--
-- Name: data_layers data_layers_interactivity_settings_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_layers
    ADD CONSTRAINT data_layers_interactivity_settings_id_key UNIQUE (interactivity_settings_id);


--
-- Name: data_layers data_layers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_layers
    ADD CONSTRAINT data_layers_pkey PRIMARY KEY (id);


--
-- Name: data_source_import_types data_source_import_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_source_import_types
    ADD CONSTRAINT data_source_import_types_pkey PRIMARY KEY (type);


--
-- Name: data_source_types data_source_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_source_types
    ADD CONSTRAINT data_source_types_pkey PRIMARY KEY (type);


--
-- Name: data_sources_buckets data_sources_buckets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_sources_buckets
    ADD CONSTRAINT data_sources_buckets_pkey PRIMARY KEY (url);


--
-- Name: data_sources data_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_sources
    ADD CONSTRAINT data_sources_pkey PRIMARY KEY (id);


--
-- Name: data_upload_tasks data_upload_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_upload_tasks
    ADD CONSTRAINT data_upload_tasks_pkey PRIMARY KEY (id);


--
-- Name: deleted_geojson_objects deleted_geojson_objects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deleted_geojson_objects
    ADD CONSTRAINT deleted_geojson_objects_pkey PRIMARY KEY (id);


--
-- Name: email_notification_preferences email_notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_notification_preferences
    ADD CONSTRAINT email_notification_preferences_user_id_key UNIQUE (user_id);


--
-- Name: survey_invites email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_invites
    ADD CONSTRAINT email_unique UNIQUE (email);


--
-- Name: form_element_types form_element_types_label_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_element_types
    ADD CONSTRAINT form_element_types_label_key UNIQUE (label);


--
-- Name: form_element_types form_element_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_element_types
    ADD CONSTRAINT form_element_types_pkey PRIMARY KEY (component_name);


--
-- Name: form_elements form_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_elements
    ADD CONSTRAINT form_fields_pkey PRIMARY KEY (id);


--
-- Name: form_logic_conditions form_logic_conditions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_logic_conditions
    ADD CONSTRAINT form_logic_conditions_pkey PRIMARY KEY (id);


--
-- Name: form_logic_rules form_logic_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_logic_rules
    ADD CONSTRAINT form_logic_rules_pkey PRIMARY KEY (id);


--
-- Name: forms forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms
    ADD CONSTRAINT forms_pkey PRIMARY KEY (id);


--
-- Name: forms forms_sketch_class_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms
    ADD CONSTRAINT forms_sketch_class_id_key UNIQUE (sketch_class_id);


--
-- Name: forms forms_survey_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms
    ADD CONSTRAINT forms_survey_id_key UNIQUE (survey_id);


--
-- Name: forums forums_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forums
    ADD CONSTRAINT forums_pkey PRIMARY KEY (id);


--
-- Name: interactivity_settings interactivity_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactivity_settings
    ADD CONSTRAINT interactivity_settings_pkey PRIMARY KEY (id);


--
-- Name: invite_emails invite_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_emails
    ADD CONSTRAINT invite_emails_pkey PRIMARY KEY (id);


--
-- Name: jwks jwks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jwks
    ADD CONSTRAINT jwks_pkey PRIMARY KEY (kid);


--
-- Name: offline_tile_packages offline_tile_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offline_tile_packages
    ADD CONSTRAINT offline_tile_packages_pkey PRIMARY KEY (id);


--
-- Name: offline_tile_settings offline_tile_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offline_tile_settings
    ADD CONSTRAINT offline_tile_settings_pkey PRIMARY KEY (id);


--
-- Name: offline_tile_settings offline_tile_settings_project_id_basemap_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offline_tile_settings
    ADD CONSTRAINT offline_tile_settings_project_id_basemap_id_key UNIQUE (project_id, basemap_id);


--
-- Name: optional_basemap_layers optional_basemap_layers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.optional_basemap_layers
    ADD CONSTRAINT optional_basemap_layers_pkey PRIMARY KEY (id);


--
-- Name: pending_topic_notifications pending_topic_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_topic_notifications
    ADD CONSTRAINT pending_topic_notifications_pkey PRIMARY KEY (id);


--
-- Name: pending_topic_notifications pending_topic_notifications_topic_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_topic_notifications
    ADD CONSTRAINT pending_topic_notifications_topic_id_user_id_key UNIQUE (topic_id, user_id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


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
-- Name: project_invite_groups project_invite_groups_invite_id_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_invite_groups
    ADD CONSTRAINT project_invite_groups_invite_id_group_id_key UNIQUE (invite_id, group_id);


--
-- Name: project_invites project_invites_email_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_invites
    ADD CONSTRAINT project_invites_email_project_id_key UNIQUE (email, project_id);


--
-- Name: project_invites project_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_invites
    ADD CONSTRAINT project_invites_pkey PRIMARY KEY (id);


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
-- Name: projects_shared_basemaps projects_shared_basemaps_basemap_id_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects_shared_basemaps
    ADD CONSTRAINT projects_shared_basemaps_basemap_id_project_id_key UNIQUE (basemap_id, project_id);


--
-- Name: projects projects_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_slug_key UNIQUE (slug);


--
-- Name: sketch_classes sketch_classes_form_element_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketch_classes
    ADD CONSTRAINT sketch_classes_form_element_id_key UNIQUE (form_element_id);


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
-- Name: sprite_images sprite_images_sprite_id_pixel_ratio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sprite_images
    ADD CONSTRAINT sprite_images_sprite_id_pixel_ratio_key UNIQUE (sprite_id, pixel_ratio);


--
-- Name: sprites sprites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sprites
    ADD CONSTRAINT sprites_pkey PRIMARY KEY (id);


--
-- Name: style_template_groups style_template_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.style_template_groups
    ADD CONSTRAINT style_template_groups_pkey PRIMARY KEY (id);


--
-- Name: style_templates style_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.style_templates
    ADD CONSTRAINT style_templates_pkey PRIMARY KEY (id);


--
-- Name: survey_consent_documents survey_consent_documents_form_element_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_consent_documents
    ADD CONSTRAINT survey_consent_documents_form_element_id_version_key UNIQUE (form_element_id, version);


--
-- Name: survey_consent_documents survey_consent_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_consent_documents
    ADD CONSTRAINT survey_consent_documents_pkey PRIMARY KEY (id);


--
-- Name: survey_invited_groups survey_invited_groups_survey_id_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_invited_groups
    ADD CONSTRAINT survey_invited_groups_survey_id_group_id_key UNIQUE (survey_id, group_id);


--
-- Name: survey_invites survey_invites_email_survey_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_invites
    ADD CONSTRAINT survey_invites_email_survey_id_key UNIQUE (email, survey_id);


--
-- Name: survey_invites survey_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_invites
    ADD CONSTRAINT survey_invites_pkey PRIMARY KEY (id);


--
-- Name: survey_responses survey_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_pkey PRIMARY KEY (id);


--
-- Name: surveys surveys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_pkey PRIMARY KEY (id);


--
-- Name: table_of_contents_items table_of_contents_items_data_layer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_of_contents_items
    ADD CONSTRAINT table_of_contents_items_data_layer_id_key UNIQUE (data_layer_id);


--
-- Name: table_of_contents_items table_of_contents_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_of_contents_items
    ADD CONSTRAINT table_of_contents_items_pkey PRIMARY KEY (id);


--
-- Name: topic_notification_unsubscribes topic_notification_unsubscribes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_notification_unsubscribes
    ADD CONSTRAINT topic_notification_unsubscribes_pkey PRIMARY KEY (id);


--
-- Name: topic_notification_unsubscribes topic_notification_unsubscribes_topic_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_notification_unsubscribes
    ADD CONSTRAINT topic_notification_unsubscribes_topic_id_user_id_key UNIQUE (topic_id, user_id);


--
-- Name: topics topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_pkey PRIMARY KEY (id);


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
-- Name: jobs_priority_run_at_id_locked_at_without_failures_idx; Type: INDEX; Schema: graphile_worker; Owner: -
--

CREATE INDEX jobs_priority_run_at_id_locked_at_without_failures_idx ON graphile_worker.jobs USING btree (priority, run_at, id, locked_at) WHERE (attempts < max_attempts);


--
-- Name: access_control_list_groups_access_control_list_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX access_control_list_groups_access_control_list_id_idx ON public.access_control_list_groups USING btree (access_control_list_id);


--
-- Name: access_control_list_groups_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX access_control_list_groups_group_id_idx ON public.access_control_list_groups USING btree (group_id);


--
-- Name: access_control_lists_basemap_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX access_control_lists_basemap_id_idx ON public.access_control_lists USING btree (basemap_id) WHERE (basemap_id IS NOT NULL);


--
-- Name: access_control_lists_forum_id_read_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX access_control_lists_forum_id_read_idx ON public.access_control_lists USING btree (forum_id_read) WHERE (forum_id_read IS NOT NULL);


--
-- Name: access_control_lists_forum_id_write_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX access_control_lists_forum_id_write_idx ON public.access_control_lists USING btree (forum_id_write) WHERE (forum_id_write IS NOT NULL);


--
-- Name: access_control_lists_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX access_control_lists_project_id_idx ON public.access_control_lists USING btree (project_id);


--
-- Name: access_control_lists_sketch_class_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX access_control_lists_sketch_class_id_idx ON public.access_control_lists USING btree (sketch_class_id) WHERE (sketch_class_id IS NOT NULL);


--
-- Name: access_control_lists_table_of_contents_item_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX access_control_lists_table_of_contents_item_id_idx ON public.access_control_lists USING btree (table_of_contents_item_id) WHERE (table_of_contents_item_id IS NOT NULL);


--
-- Name: basemap_project_id_and_surveys_only; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX basemap_project_id_and_surveys_only ON public.basemaps USING btree (project_id, surveys_only);


--
-- Name: basemaps_interactivity_settings_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX basemaps_interactivity_settings_id_idx ON public.basemaps USING btree (interactivity_settings_id);


--
-- Name: basemaps_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX basemaps_project_id_idx ON public.basemaps USING btree (project_id);


--
-- Name: data_layers_data_source_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX data_layers_data_source_id_idx ON public.data_layers USING btree (data_source_id);


--
-- Name: data_layers_interactivity_settings_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX data_layers_interactivity_settings_id_idx ON public.data_layers USING btree (interactivity_settings_id);


--
-- Name: data_layers_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX data_layers_project_id_idx ON public.data_layers USING btree (project_id);


--
-- Name: data_sources_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX data_sources_project_id_idx ON public.data_sources USING btree (project_id);


--
-- Name: data_upload_tasks_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX data_upload_tasks_project_id_idx ON public.data_upload_tasks USING btree (project_id);


--
-- Name: data_upload_tasks_state_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX data_upload_tasks_state_project_id_idx ON public.data_upload_tasks USING btree (state, project_id);


--
-- Name: email_notification_preferences_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_notification_preferences_user_id_idx ON public.email_notification_preferences USING btree (user_id);


--
-- Name: form_elements_basemap_ids; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX form_elements_basemap_ids ON public.form_elements USING btree (map_basemaps);


--
-- Name: form_fields_form_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX form_fields_form_id_idx ON public.form_elements USING btree (form_id);


--
-- Name: forms_is_template_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forms_is_template_idx ON public.forms USING btree (is_template);


--
-- Name: forms_sketch_class_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forms_sketch_class_id_idx ON public.forms USING btree (sketch_class_id);


--
-- Name: forums_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forums_project_id_idx ON public.forums USING btree (project_id);


--
-- Name: idx_sprites_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sprites_deleted ON public.sprites USING btree (deleted);


--
-- Name: interactivity_settings_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX interactivity_settings_type ON public.interactivity_settings USING btree (type);


--
-- Name: invite_emails_project_invite_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invite_emails_project_invite_id_idx ON public.invite_emails USING btree (project_invite_id);


--
-- Name: invite_emails_project_invite_id_to_address_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invite_emails_project_invite_id_to_address_idx ON public.invite_emails USING btree (project_invite_id, to_address);


--
-- Name: invite_emails_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invite_emails_status_idx ON public.invite_emails USING btree (status);


--
-- Name: invite_emails_survey_invite_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invite_emails_survey_invite_id_idx ON public.invite_emails USING btree (survey_invite_id);


--
-- Name: invite_emails_survey_invite_id_to_address_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invite_emails_survey_invite_id_to_address_idx ON public.invite_emails USING btree (survey_invite_id, to_address);


--
-- Name: invite_emails_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invite_emails_token_idx ON public.invite_emails USING btree (token);


--
-- Name: offline_tile_packages_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_packages_project_id_idx ON public.offline_tile_packages USING btree (project_id);


--
-- Name: offline_tile_settings_basemap_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx1 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx10; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx10 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx11; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx11 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx12; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx12 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx13; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx13 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx14; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx14 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx15; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx15 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx16; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx16 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx17; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx17 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx18; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx18 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx19; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx19 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx2 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx20; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx20 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx21; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx21 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx22; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx22 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx23; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx23 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx24; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx24 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx25; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx25 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx26; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx26 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx27; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx27 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx28; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx28 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx29; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx29 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx3 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx4 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx5; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx5 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx6 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx7 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx8 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_basemap_id_idx9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_basemap_id_idx9 ON public.offline_tile_settings USING btree (basemap_id);


--
-- Name: offline_tile_settings_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx1 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx10; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx10 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx11; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx11 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx12; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx12 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx13; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx13 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx14; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx14 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx15; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx15 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx16; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx16 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx17; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx17 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx18; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx18 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx19; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx19 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx2 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx20; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx20 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx21; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx21 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx22; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx22 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx23; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx23 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx24; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx24 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx25; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx25 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx26; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx26 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx27; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx27 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx28; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx28 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx29; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx29 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx3 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx4 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx5; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx5 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx6 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx7 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx8 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_project_id_idx9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offline_tile_settings_project_id_idx9 ON public.offline_tile_settings USING btree (project_id);


--
-- Name: offline_tile_settings_unique_project_default; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX offline_tile_settings_unique_project_default ON public.offline_tile_settings USING btree (project_id, ((basemap_id IS NULL))) WHERE (basemap_id IS NULL);


--
-- Name: optional_basemap_layers_basemap_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX optional_basemap_layers_basemap_id_idx ON public.optional_basemap_layers USING btree (basemap_id);


--
-- Name: posts_topic_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_topic_id_idx ON public.posts USING btree (topic_id);


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
-- Name: project_invite_groups_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_invite_groups_group_id_idx ON public.project_invite_groups USING btree (group_id);


--
-- Name: project_invites_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_invites_project_id ON public.project_invites USING btree (project_id);


--
-- Name: project_invites_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_invites_project_id_idx ON public.project_invites USING btree (project_id);


--
-- Name: project_invites_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_invites_user_id_idx ON public.project_invites USING btree (user_id);


--
-- Name: project_invites_user_id_idx1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_invites_user_id_idx1 ON public.project_invites USING btree (user_id);


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
-- Name: projects_data_sources_bucket_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX projects_data_sources_bucket_id_idx ON public.projects USING btree (data_sources_bucket_id);


--
-- Name: sketch_classes_form_element_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sketch_classes_form_element_id_idx ON public.sketch_classes USING btree (form_element_id);


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
-- Name: sketches_form_element_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sketches_form_element_id ON public.sketches USING btree (form_element_id);


--
-- Name: sketches_mercator_geometry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sketches_mercator_geometry_idx ON public.sketches USING gist (mercator_geometry);


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
-- Name: sprite_images_sprite_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sprite_images_sprite_id_idx ON public.sprite_images USING btree (sprite_id);


--
-- Name: sprites_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sprites_group_idx ON public.sprites USING btree (category);


--
-- Name: sprites_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sprites_project_id_idx ON public.sprites USING btree (project_id);


--
-- Name: survey_invited_groups_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX survey_invited_groups_group_id_idx ON public.survey_invited_groups USING btree (group_id);


--
-- Name: survey_invites_survey_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX survey_invites_survey_id_idx ON public.survey_invites USING btree (survey_id);


--
-- Name: survey_response_network_addresses_ip_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX survey_response_network_addresses_ip_hash_idx ON public.survey_response_network_addresses USING hash (ip_hash);


--
-- Name: survey_response_network_addresses_survey_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX survey_response_network_addresses_survey_id_idx ON public.survey_response_network_addresses USING btree (survey_id);


--
-- Name: survey_responses_survey_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX survey_responses_survey_id_idx ON public.survey_responses USING btree (survey_id);


--
-- Name: survey_responses_survey_id_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX survey_responses_survey_id_user_id_idx ON public.survey_responses USING btree (survey_id, user_id);


--
-- Name: survey_responses_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX survey_responses_user_id_idx ON public.survey_responses USING btree (user_id);


--
-- Name: surveys_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX surveys_project_id_idx ON public.surveys USING btree (project_id);


--
-- Name: table_of_contents_items_is_draft_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_of_contents_items_is_draft_idx ON public.table_of_contents_items USING btree (is_draft);


--
-- Name: table_of_contents_items_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_of_contents_items_project_id_idx ON public.table_of_contents_items USING btree (project_id);


--
-- Name: topic_notification_unsubscribes_topic_id_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX topic_notification_unsubscribes_topic_id_user_id_idx ON public.topic_notification_unsubscribes USING btree (topic_id, user_id);


--
-- Name: topics_forum_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX topics_forum_id_idx ON public.topics USING btree (forum_id);


--
-- Name: user_profiles_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_profiles_user_id_idx ON public.user_profiles USING btree (user_id);


--
-- Name: users_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_sub ON public.users USING btree (sub);


--
-- Name: jobs _100_timestamps; Type: TRIGGER; Schema: graphile_worker; Owner: -
--

CREATE TRIGGER _100_timestamps BEFORE UPDATE ON graphile_worker.jobs FOR EACH ROW EXECUTE FUNCTION graphile_worker.tg__update_timestamp();


--
-- Name: jobs _500_decrease_job_queue_count; Type: TRIGGER; Schema: graphile_worker; Owner: -
--

CREATE TRIGGER _500_decrease_job_queue_count AFTER DELETE ON graphile_worker.jobs FOR EACH ROW WHEN ((old.queue_name IS NOT NULL)) EXECUTE FUNCTION graphile_worker.jobs__decrease_job_queue_count();


--
-- Name: jobs _500_decrease_job_queue_count_update; Type: TRIGGER; Schema: graphile_worker; Owner: -
--

CREATE TRIGGER _500_decrease_job_queue_count_update AFTER UPDATE OF queue_name ON graphile_worker.jobs FOR EACH ROW WHEN (((new.queue_name IS DISTINCT FROM old.queue_name) AND (old.queue_name IS NOT NULL))) EXECUTE FUNCTION graphile_worker.jobs__decrease_job_queue_count();


--
-- Name: jobs _500_increase_job_queue_count; Type: TRIGGER; Schema: graphile_worker; Owner: -
--

CREATE TRIGGER _500_increase_job_queue_count AFTER INSERT ON graphile_worker.jobs FOR EACH ROW WHEN ((new.queue_name IS NOT NULL)) EXECUTE FUNCTION graphile_worker.jobs__increase_job_queue_count();


--
-- Name: jobs _500_increase_job_queue_count_update; Type: TRIGGER; Schema: graphile_worker; Owner: -
--

CREATE TRIGGER _500_increase_job_queue_count_update AFTER UPDATE OF queue_name ON graphile_worker.jobs FOR EACH ROW WHEN (((new.queue_name IS DISTINCT FROM old.queue_name) AND (new.queue_name IS NOT NULL))) EXECUTE FUNCTION graphile_worker.jobs__increase_job_queue_count();


--
-- Name: jobs _900_notify_worker; Type: TRIGGER; Schema: graphile_worker; Owner: -
--

CREATE TRIGGER _900_notify_worker AFTER INSERT ON graphile_worker.jobs FOR EACH STATEMENT EXECUTE FUNCTION graphile_worker.tg_jobs__notify_new_jobs();


--
-- Name: survey_responses _001_unnest_survey_response_sketches_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER _001_unnest_survey_response_sketches_trigger BEFORE INSERT OR UPDATE ON public.survey_responses FOR EACH ROW EXECUTE FUNCTION public._001_unnest_survey_response_sketches();


--
-- Name: survey_responses _002_set_survey_response_last_updated_by; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER _002_set_survey_response_last_updated_by BEFORE UPDATE ON public.survey_responses FOR EACH ROW EXECUTE FUNCTION public.set_survey_response_last_updated_by();


--
-- Name: data_sources _500_gql_after_deleted__data_sources; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER _500_gql_after_deleted__data_sources AFTER DELETE ON public.data_sources FOR EACH ROW EXECUTE FUNCTION public.after_deleted__data_sources();


--
-- Name: invite_emails _500_gql_insert_or_update_or_delete_project_invite_email; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER _500_gql_insert_or_update_or_delete_project_invite_email AFTER INSERT OR DELETE OR UPDATE ON public.invite_emails FOR EACH ROW EXECUTE FUNCTION public.after_insert_or_update_or_delete_project_invite_email();


--
-- Name: project_group_members after_add_user_to_group_update_survey_invites; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_add_user_to_group_update_survey_invites AFTER INSERT ON public.project_group_members FOR EACH ROW EXECUTE FUNCTION public.add_user_to_group_update_survey_invites_trigger();


--
-- Name: posts after_post_insert_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_post_insert_trigger AFTER INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION public.after_post_insert();


--
-- Name: project_group_members after_remove_user_from_group_update_survey_invites; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_remove_user_from_group_update_survey_invites AFTER DELETE ON public.project_group_members FOR EACH ROW EXECUTE FUNCTION public.remove_user_from_group_update_survey_invites_trigger();


--
-- Name: survey_responses after_response_submission; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_response_submission AFTER INSERT OR UPDATE ON public.survey_responses FOR EACH ROW EXECUTE FUNCTION public.after_response_submission();


--
-- Name: basemaps before_basemap_insert_create_interactivity_settings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_basemap_insert_create_interactivity_settings BEFORE INSERT ON public.basemaps FOR EACH ROW EXECUTE FUNCTION public.before_basemap_insert_create_interactivity_settings_func();


--
-- Name: form_elements before_delete_on_form_elements_001; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_delete_on_form_elements_001 BEFORE DELETE ON public.form_elements FOR EACH ROW EXECUTE FUNCTION public.check_element_type();


--
-- Name: sketch_classes before_delete_sketch_class_001; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_delete_sketch_class_001 BEFORE DELETE ON public.sketch_classes FOR EACH ROW EXECUTE FUNCTION public.before_delete_sketch_class_check_form_element_id();


--
-- Name: form_elements before_insert_form_elements; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_insert_form_elements BEFORE INSERT ON public.form_elements FOR EACH ROW EXECUTE FUNCTION public.before_insert_form_elements_func();


--
-- Name: data_layers before_insert_or_update_data_layers; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_insert_or_update_data_layers BEFORE INSERT OR UPDATE ON public.data_layers FOR EACH ROW EXECUTE FUNCTION public.before_insert_or_update_data_layers_trigger();


--
-- Name: data_sources before_insert_or_update_data_sources; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_insert_or_update_data_sources BEFORE INSERT OR UPDATE ON public.data_sources FOR EACH ROW EXECUTE FUNCTION public.before_insert_or_update_data_sources_trigger();


--
-- Name: form_logic_conditions before_insert_or_update_form_logic_conditions_100_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_insert_or_update_form_logic_conditions_100_trigger BEFORE INSERT OR UPDATE ON public.form_logic_conditions FOR EACH ROW EXECUTE FUNCTION public.before_insert_or_update_form_logic_conditions_100();


--
-- Name: form_logic_rules before_insert_or_update_form_logic_rules_100_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_insert_or_update_form_logic_rules_100_trigger BEFORE INSERT OR UPDATE ON public.form_logic_rules FOR EACH ROW EXECUTE FUNCTION public.before_insert_or_update_form_logic_rules_100();


--
-- Name: table_of_contents_items before_insert_or_update_table_of_contents_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_insert_or_update_table_of_contents_items BEFORE INSERT OR UPDATE ON public.table_of_contents_items FOR EACH ROW EXECUTE FUNCTION public.before_insert_or_update_table_of_contents_items_trigger();


--
-- Name: invite_emails before_invite_emails_insert_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_invite_emails_insert_trigger BEFORE INSERT ON public.invite_emails FOR EACH ROW EXECUTE FUNCTION public.before_invite_emails_insert();


--
-- Name: invite_emails before_invite_emails_update_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_invite_emails_update_trigger BEFORE UPDATE ON public.invite_emails FOR EACH ROW EXECUTE FUNCTION public.before_invite_emails_update();


--
-- Name: data_layers before_layer_insert_create_interactivity_settings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_layer_insert_create_interactivity_settings BEFORE INSERT ON public.data_layers FOR EACH ROW EXECUTE FUNCTION public.before_layer_insert_create_interactivity_settings_func();


--
-- Name: survey_responses before_response_update_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_response_update_trigger BEFORE UPDATE ON public.survey_responses FOR EACH ROW EXECUTE FUNCTION public.before_response_update();


--
-- Name: sketch_folders before_sketch_folders_insert_or_update_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_sketch_folders_insert_or_update_trigger BEFORE INSERT OR UPDATE ON public.sketch_folders FOR EACH ROW EXECUTE FUNCTION public.before_sketch_folders_insert_or_update();


--
-- Name: sketches before_sketch_insert_or_update_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_sketch_insert_or_update_trigger BEFORE INSERT OR UPDATE ON public.sketches FOR EACH ROW EXECUTE FUNCTION public.before_sketch_insert_or_update();


--
-- Name: surveys before_survey_delete_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_survey_delete_trigger BEFORE DELETE ON public.surveys FOR EACH ROW EXECUTE FUNCTION public.before_survey_delete();


--
-- Name: survey_invited_groups before_survey_invited_groups_insert_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_survey_invited_groups_insert_trigger BEFORE INSERT ON public.survey_invited_groups FOR EACH ROW EXECUTE FUNCTION public.before_survey_invited_groups_insert();


--
-- Name: survey_responses before_survey_response_insert_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_survey_response_insert_trigger BEFORE INSERT ON public.survey_responses FOR EACH ROW EXECUTE FUNCTION public.before_survey_response_insert();


--
-- Name: surveys before_survey_update_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_survey_update_trigger BEFORE INSERT OR UPDATE ON public.surveys FOR EACH ROW EXECUTE FUNCTION public.before_survey_update();


--
-- Name: sketch_classes_valid_children before_valid_children_insert_or_update_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_valid_children_insert_or_update_trigger BEFORE INSERT OR UPDATE ON public.sketch_classes_valid_children FOR EACH ROW EXECUTE FUNCTION public.before_valid_children_insert_or_update();


--
-- Name: form_elements form_element_associated_sketch_class; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER form_element_associated_sketch_class AFTER INSERT ON public.form_elements FOR EACH ROW EXECUTE FUNCTION public.create_form_element_associated_sketch_class();


--
-- Name: form_elements form_elements_check_allowed_layouts_002; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER form_elements_check_allowed_layouts_002 BEFORE INSERT OR UPDATE ON public.form_elements FOR EACH ROW EXECUTE FUNCTION public.check_allowed_layouts();


--
-- Name: offline_tile_packages offline_tile_packages_on_insert_1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER offline_tile_packages_on_insert_1 AFTER INSERT ON public.offline_tile_packages FOR EACH ROW EXECUTE FUNCTION public.offline_tile_packages_insert_trigger();


--
-- Name: offline_tile_packages on_delete_offline_tile_package_001; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_delete_offline_tile_package_001 AFTER DELETE ON public.offline_tile_packages FOR EACH ROW EXECUTE FUNCTION public.cleanup_tile_package();


--
-- Name: sketch_classes sketch_classes_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sketch_classes_before_update BEFORE UPDATE ON public.sketch_classes FOR EACH ROW EXECUTE FUNCTION public.before_update_sketch_class_trigger();


--
-- Name: sketch_classes sketch_classes_prohibit_delete_t; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sketch_classes_prohibit_delete_t BEFORE DELETE ON public.sketch_classes FOR EACH ROW EXECUTE FUNCTION public.sketch_classes_prohibit_delete();


--
-- Name: survey_invites survey_invites_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER survey_invites_before_insert BEFORE INSERT ON public.survey_invites FOR EACH ROW EXECUTE FUNCTION public.survey_invite_before_insert_trigger();


--
-- Name: survey_invites survey_invites_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER survey_invites_before_update BEFORE UPDATE ON public.survey_invites FOR EACH ROW EXECUTE FUNCTION public.survey_invite_before_update_trigger();


--
-- Name: users trig_auto_create_notification_preferences; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trig_auto_create_notification_preferences AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.on_user_insert_create_notification_preferences();


--
-- Name: users trig_auto_create_profile; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trig_auto_create_profile AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.auto_create_profile();


--
-- Name: basemaps trig_create_basemap_acl; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trig_create_basemap_acl AFTER INSERT ON public.basemaps FOR EACH ROW EXECUTE FUNCTION public.create_basemap_acl();


--
-- Name: forums trig_create_forum_acl; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trig_create_forum_acl AFTER INSERT ON public.forums FOR EACH ROW EXECUTE FUNCTION public.create_forum_acl();


--
-- Name: sketch_classes trig_create_sketch_class_acl; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trig_create_sketch_class_acl AFTER INSERT ON public.sketch_classes FOR EACH ROW EXECUTE FUNCTION public.create_sketch_class_acl();


--
-- Name: table_of_contents_items trig_create_table_of_contents_item_acl; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trig_create_table_of_contents_item_acl AFTER INSERT ON public.table_of_contents_items FOR EACH ROW EXECUTE FUNCTION public.create_table_of_contents_item_acl();


--
-- Name: data_upload_tasks trigger_data_upload_ready; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_data_upload_ready AFTER UPDATE ON public.data_upload_tasks FOR EACH ROW WHEN (((old.state = 'awaiting_upload'::public.data_upload_state) AND (new.state = 'uploaded'::public.data_upload_state))) EXECUTE FUNCTION public.create_upload_task_job();


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
-- Name: access_control_lists access_control_lists_basemap_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_control_lists
    ADD CONSTRAINT access_control_lists_basemap_id_fkey FOREIGN KEY (basemap_id) REFERENCES public.basemaps(id) ON DELETE CASCADE;


--
-- Name: access_control_lists access_control_lists_forum_id_read_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_control_lists
    ADD CONSTRAINT access_control_lists_forum_id_read_fkey FOREIGN KEY (forum_id_read) REFERENCES public.forums(id) ON DELETE CASCADE;


--
-- Name: access_control_lists access_control_lists_forum_id_write_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_control_lists
    ADD CONSTRAINT access_control_lists_forum_id_write_fkey FOREIGN KEY (forum_id_write) REFERENCES public.forums(id) ON DELETE CASCADE;


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
-- Name: access_control_lists access_control_lists_table_of_contents_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_control_lists
    ADD CONSTRAINT access_control_lists_table_of_contents_item_id_fkey FOREIGN KEY (table_of_contents_item_id) REFERENCES public.table_of_contents_items(id) ON DELETE CASCADE;


--
-- Name: basemaps basemaps_interactivity_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.basemaps
    ADD CONSTRAINT basemaps_interactivity_settings_id_fkey FOREIGN KEY (interactivity_settings_id) REFERENCES public.interactivity_settings(id) ON DELETE CASCADE;


--
-- Name: basemaps basemaps_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.basemaps
    ADD CONSTRAINT basemaps_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: community_guidelines community_guidelines_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_guidelines
    ADD CONSTRAINT community_guidelines_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: CONSTRAINT community_guidelines_project_id_fkey ON community_guidelines; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT community_guidelines_project_id_fkey ON public.community_guidelines IS '
@foreignFieldName communityGuidelines
Community Guidelines for this project when using the discussion forums.
';


--
-- Name: data_layers data_layers_data_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_layers
    ADD CONSTRAINT data_layers_data_source_id_fkey FOREIGN KEY (data_source_id) REFERENCES public.data_sources(id);


--
-- Name: data_layers data_layers_interactivity_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_layers
    ADD CONSTRAINT data_layers_interactivity_settings_id_fkey FOREIGN KEY (interactivity_settings_id) REFERENCES public.interactivity_settings(id) ON DELETE CASCADE;


--
-- Name: data_layers data_layers_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_layers
    ADD CONSTRAINT data_layers_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT data_layers_project_id_fkey ON data_layers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT data_layers_project_id_fkey ON public.data_layers IS '@omit';


--
-- Name: data_sources data_sources_bucket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_sources
    ADD CONSTRAINT data_sources_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES public.data_sources_buckets(url) ON DELETE CASCADE;


--
-- Name: data_sources data_sources_import_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_sources
    ADD CONSTRAINT data_sources_import_type_fkey FOREIGN KEY (import_type) REFERENCES public.data_source_import_types(type) ON DELETE CASCADE;


--
-- Name: data_sources data_sources_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_sources
    ADD CONSTRAINT data_sources_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT data_sources_project_id_fkey ON data_sources; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT data_sources_project_id_fkey ON public.data_sources IS '@omit';


--
-- Name: data_sources data_sources_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_sources
    ADD CONSTRAINT data_sources_type_fkey FOREIGN KEY (type) REFERENCES public.data_source_types(type) ON DELETE CASCADE;


--
-- Name: data_sources data_sources_upload_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_sources
    ADD CONSTRAINT data_sources_upload_task_id_fkey FOREIGN KEY (upload_task_id) REFERENCES public.data_upload_tasks(id) ON DELETE SET NULL;


--
-- Name: data_upload_tasks data_upload_tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_upload_tasks
    ADD CONSTRAINT data_upload_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: data_upload_tasks data_upload_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_upload_tasks
    ADD CONSTRAINT data_upload_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: email_notification_preferences email_notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_notification_preferences
    ADD CONSTRAINT email_notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: form_element_types form_element_types_sketch_class_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_element_types
    ADD CONSTRAINT form_element_types_sketch_class_template_id_fkey FOREIGN KEY (sketch_class_template_id) REFERENCES public.sketch_classes(id) ON DELETE CASCADE;


--
-- Name: form_elements form_elements_jump_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_elements
    ADD CONSTRAINT form_elements_jump_to_id_fkey FOREIGN KEY (jump_to_id) REFERENCES public.form_elements(id) ON DELETE SET NULL;


--
-- Name: form_elements form_elements_subordinate_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_elements
    ADD CONSTRAINT form_elements_subordinate_to_fkey FOREIGN KEY (subordinate_to) REFERENCES public.form_elements(id) ON DELETE CASCADE;


--
-- Name: form_elements form_elements_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_elements
    ADD CONSTRAINT form_elements_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.form_element_types(component_name) ON DELETE CASCADE;


--
-- Name: form_elements form_fields_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_elements
    ADD CONSTRAINT form_fields_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.forms(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT form_fields_form_id_fkey ON form_elements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT form_fields_form_id_fkey ON public.form_elements IS '@omit';


--
-- Name: form_logic_conditions form_logic_conditions_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_logic_conditions
    ADD CONSTRAINT form_logic_conditions_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.form_logic_rules(id) ON DELETE CASCADE;


--
-- Name: form_logic_conditions form_logic_conditions_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_logic_conditions
    ADD CONSTRAINT form_logic_conditions_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.form_elements(id) ON DELETE CASCADE;


--
-- Name: form_logic_rules form_logic_rules_form_element_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_logic_rules
    ADD CONSTRAINT form_logic_rules_form_element_id_fkey FOREIGN KEY (form_element_id) REFERENCES public.form_elements(id) ON DELETE CASCADE;


--
-- Name: form_logic_rules form_logic_rules_jump_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_logic_rules
    ADD CONSTRAINT form_logic_rules_jump_to_id_fkey FOREIGN KEY (jump_to_id) REFERENCES public.form_elements(id) ON DELETE CASCADE;


--
-- Name: forms forms_sketch_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms
    ADD CONSTRAINT forms_sketch_class_id_fkey FOREIGN KEY (sketch_class_id) REFERENCES public.sketch_classes(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT forms_sketch_class_id_fkey ON forms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT forms_sketch_class_id_fkey ON public.forms IS '
@simpleCollections only
';


--
-- Name: forms forms_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms
    ADD CONSTRAINT forms_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- Name: forums forums_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forums
    ADD CONSTRAINT forums_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT forums_project_id_fkey ON forums; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT forums_project_id_fkey ON public.forums IS '@simpleCollections only';


--
-- Name: invite_emails invite_emails_project_invite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_emails
    ADD CONSTRAINT invite_emails_project_invite_id_fkey FOREIGN KEY (project_invite_id) REFERENCES public.project_invites(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT invite_emails_project_invite_id_fkey ON invite_emails; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT invite_emails_project_invite_id_fkey ON public.invite_emails IS '@simpleCollections only';


--
-- Name: invite_emails invite_emails_survey_invite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_emails
    ADD CONSTRAINT invite_emails_survey_invite_id_fkey FOREIGN KEY (survey_invite_id) REFERENCES public.survey_invites(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT invite_emails_survey_invite_id_fkey ON invite_emails; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT invite_emails_survey_invite_id_fkey ON public.invite_emails IS '
@simpleCollections only
';


--
-- Name: offline_tile_packages offline_tile_packages_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offline_tile_packages
    ADD CONSTRAINT offline_tile_packages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: offline_tile_settings offline_tile_settings_basemap_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offline_tile_settings
    ADD CONSTRAINT offline_tile_settings_basemap_id_fkey FOREIGN KEY (basemap_id) REFERENCES public.basemaps(id) ON DELETE CASCADE;


--
-- Name: offline_tile_settings offline_tile_settings_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offline_tile_settings
    ADD CONSTRAINT offline_tile_settings_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: optional_basemap_layers optional_basemap_layers_basemap_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.optional_basemap_layers
    ADD CONSTRAINT optional_basemap_layers_basemap_id_fkey FOREIGN KEY (basemap_id) REFERENCES public.basemaps(id) ON DELETE CASCADE;


--
-- Name: pending_topic_notifications pending_topic_notifications_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_topic_notifications
    ADD CONSTRAINT pending_topic_notifications_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id);


--
-- Name: pending_topic_notifications pending_topic_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_topic_notifications
    ADD CONSTRAINT pending_topic_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: posts posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: posts posts_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE CASCADE;


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
-- Name: project_invite_groups project_invite_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_invite_groups
    ADD CONSTRAINT project_invite_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.project_groups(id) ON DELETE CASCADE;


--
-- Name: project_invite_groups project_invite_groups_invite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_invite_groups
    ADD CONSTRAINT project_invite_groups_invite_id_fkey FOREIGN KEY (invite_id) REFERENCES public.project_invites(id) ON DELETE CASCADE;


--
-- Name: project_invites project_invites_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_invites
    ADD CONSTRAINT project_invites_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT project_invites_project_id_fkey ON project_invites; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT project_invites_project_id_fkey ON public.project_invites IS '@omit';


--
-- Name: project_invites project_invites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_invites
    ADD CONSTRAINT project_invites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT project_invites_user_id_fkey ON project_invites; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT project_invites_user_id_fkey ON public.project_invites IS '@omit';


--
-- Name: project_participants project_participants_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_participants
    ADD CONSTRAINT project_participants_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_participants project_participants_denied_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_participants
    ADD CONSTRAINT project_participants_denied_by_fkey FOREIGN KEY (denied_by) REFERENCES public.users(id) ON DELETE CASCADE;


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
-- Name: projects projects_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id);


--
-- Name: projects projects_data_sources_bucket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_data_sources_bucket_id_fkey FOREIGN KEY (data_sources_bucket_id) REFERENCES public.data_sources_buckets(url);


--
-- Name: projects_shared_basemaps projects_shared_basemaps_basemap_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects_shared_basemaps
    ADD CONSTRAINT projects_shared_basemaps_basemap_id_fkey FOREIGN KEY (basemap_id) REFERENCES public.basemaps(id) ON DELETE CASCADE;


--
-- Name: projects_shared_basemaps projects_shared_basemaps_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects_shared_basemaps
    ADD CONSTRAINT projects_shared_basemaps_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: sketch_classes sketch_classes_form_element_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketch_classes
    ADD CONSTRAINT sketch_classes_form_element_id_fkey FOREIGN KEY (form_element_id) REFERENCES public.form_elements(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT sketch_classes_form_element_id_fkey ON sketch_classes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT sketch_classes_form_element_id_fkey ON public.sketch_classes IS '
@foreignSingleFieldName sketchClassFk
@omit many
';


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
-- Name: CONSTRAINT sketch_folders_user_id_fkey ON sketch_folders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT sketch_folders_user_id_fkey ON public.sketch_folders IS '@omit';


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
-- Name: sketches sketches_form_element_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketches
    ADD CONSTRAINT sketches_form_element_id_fkey FOREIGN KEY (form_element_id) REFERENCES public.form_elements(id) ON DELETE CASCADE;


--
-- Name: sketches sketches_response_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sketches
    ADD CONSTRAINT sketches_response_id_fkey FOREIGN KEY (response_id) REFERENCES public.survey_responses(id) DEFERRABLE;


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
-- Name: sprite_images sprite_images_sprite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sprite_images
    ADD CONSTRAINT sprite_images_sprite_id_fkey FOREIGN KEY (sprite_id) REFERENCES public.sprites(id) ON DELETE CASCADE;


--
-- Name: sprites sprites_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sprites
    ADD CONSTRAINT sprites_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT sprites_project_id_fkey ON sprites; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT sprites_project_id_fkey ON public.sprites IS '@omit';


--
-- Name: style_templates style_templates_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.style_templates
    ADD CONSTRAINT style_templates_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.style_template_groups(id) ON DELETE SET NULL;


--
-- Name: style_templates style_templates_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.style_templates
    ADD CONSTRAINT style_templates_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: survey_consent_documents survey_consent_documents_form_element_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_consent_documents
    ADD CONSTRAINT survey_consent_documents_form_element_id_fkey FOREIGN KEY (form_element_id) REFERENCES public.form_elements(id) ON DELETE CASCADE;


--
-- Name: survey_invited_groups survey_invited_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_invited_groups
    ADD CONSTRAINT survey_invited_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.project_groups(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT survey_invited_groups_group_id_fkey ON survey_invited_groups; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT survey_invited_groups_group_id_fkey ON public.survey_invited_groups IS '@omit';


--
-- Name: survey_invited_groups survey_invited_groups_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_invited_groups
    ADD CONSTRAINT survey_invited_groups_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- Name: survey_invites survey_invites_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_invites
    ADD CONSTRAINT survey_invites_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT survey_invites_survey_id_fkey ON survey_invites; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT survey_invites_survey_id_fkey ON public.survey_invites IS '
@simpleCollections only
';


--
-- Name: survey_invites survey_invites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_invites
    ADD CONSTRAINT survey_invites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: survey_response_network_addresses survey_response_network_addresses_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_response_network_addresses
    ADD CONSTRAINT survey_response_network_addresses_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_last_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_last_updated_by_id_fkey FOREIGN KEY (last_updated_by_id) REFERENCES public.users(id);


--
-- Name: survey_responses survey_responses_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT survey_responses_user_id_fkey ON survey_responses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT survey_responses_user_id_fkey ON public.survey_responses IS '@omit';


--
-- Name: surveys surveys_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: table_of_contents_items table_of_contents_items_data_layer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_of_contents_items
    ADD CONSTRAINT table_of_contents_items_data_layer_id_fkey FOREIGN KEY (data_layer_id) REFERENCES public.data_layers(id) ON DELETE CASCADE;


--
-- Name: table_of_contents_items table_of_contents_items_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_of_contents_items
    ADD CONSTRAINT table_of_contents_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT table_of_contents_items_project_id_fkey ON table_of_contents_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT table_of_contents_items_project_id_fkey ON public.table_of_contents_items IS '@omit';


--
-- Name: topic_notification_unsubscribes topic_notification_unsubscribes_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_notification_unsubscribes
    ADD CONSTRAINT topic_notification_unsubscribes_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id);


--
-- Name: topic_notification_unsubscribes topic_notification_unsubscribes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_notification_unsubscribes
    ADD CONSTRAINT topic_notification_unsubscribes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: topics topics_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: topics topics_forum_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_forum_id_fkey FOREIGN KEY (forum_id) REFERENCES public.forums(id) ON DELETE CASCADE;


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
-- Name: job_queues; Type: ROW SECURITY; Schema: graphile_worker; Owner: -
--

ALTER TABLE graphile_worker.job_queues ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs; Type: ROW SECURITY; Schema: graphile_worker; Owner: -
--

ALTER TABLE graphile_worker.jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: known_crontabs; Type: ROW SECURITY; Schema: graphile_worker; Owner: -
--

ALTER TABLE graphile_worker.known_crontabs ENABLE ROW LEVEL SECURITY;

--
-- Name: access_control_lists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.access_control_lists ENABLE ROW LEVEL SECURITY;

--
-- Name: access_control_lists access_control_lists_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY access_control_lists_select ON public.access_control_lists FOR SELECT TO anon USING (true);


--
-- Name: access_control_lists access_control_lists_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY access_control_lists_update ON public.access_control_lists FOR UPDATE TO seasketch_user USING ((public.session_is_admin(( SELECT sketch_classes.project_id
   FROM public.sketch_classes
  WHERE (sketch_classes.id = access_control_lists.sketch_class_id))) OR public.session_is_admin(( SELECT forums.project_id
   FROM public.forums
  WHERE ((forums.id = access_control_lists.forum_id_read) OR (forums.id = access_control_lists.forum_id_write)))) OR public.session_is_admin(( SELECT table_of_contents_items.project_id
   FROM public.table_of_contents_items
  WHERE (table_of_contents_items.id = access_control_lists.table_of_contents_item_id))) OR public.session_is_admin(( SELECT basemaps.project_id
   FROM public.basemaps
  WHERE (basemaps.id = access_control_lists.basemap_id))))) WITH CHECK ((public.session_is_admin(( SELECT sketch_classes.project_id
   FROM public.sketch_classes
  WHERE (sketch_classes.id = access_control_lists.sketch_class_id))) OR public.session_is_admin(( SELECT forums.project_id
   FROM public.forums
  WHERE ((forums.id = access_control_lists.forum_id_read) OR (forums.id = access_control_lists.forum_id_write)))) OR public.session_is_admin(( SELECT table_of_contents_items.project_id
   FROM public.table_of_contents_items
  WHERE (table_of_contents_items.id = access_control_lists.table_of_contents_item_id))) OR public.session_is_admin(( SELECT basemaps.project_id
   FROM public.basemaps
  WHERE (basemaps.id = access_control_lists.basemap_id)))));


--
-- Name: basemaps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.basemaps ENABLE ROW LEVEL SECURITY;

--
-- Name: basemaps basemaps_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY basemaps_admin ON public.basemaps USING (public.session_is_admin(project_id)) WITH CHECK (public.session_is_admin(project_id));


--
-- Name: basemaps basemaps_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY basemaps_select ON public.basemaps FOR SELECT USING (((project_id IS NULL) OR (public.session_has_project_access(project_id) AND public.session_on_acl(( SELECT access_control_lists.id
   FROM public.access_control_lists
  WHERE (access_control_lists.basemap_id = basemaps.id))))));


--
-- Name: community_guidelines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.community_guidelines ENABLE ROW LEVEL SECURITY;

--
-- Name: community_guidelines community_guidelines_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY community_guidelines_admin ON public.community_guidelines TO seasketch_user USING (public.session_is_admin(project_id)) WITH CHECK (public.session_is_admin(project_id));


--
-- Name: community_guidelines community_guidelines_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY community_guidelines_select ON public.community_guidelines FOR SELECT TO seasketch_user USING (public.session_has_project_access(project_id));


--
-- Name: data_layers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_layers ENABLE ROW LEVEL SECURITY;

--
-- Name: data_layers data_layers_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_layers_delete ON public.data_layers FOR DELETE USING (public.session_is_admin(project_id));


--
-- Name: data_layers data_layers_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_layers_insert ON public.data_layers FOR INSERT WITH CHECK (public.session_is_admin(project_id));


--
-- Name: data_layers data_layers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_layers_select ON public.data_layers FOR SELECT USING ((public.session_is_admin(project_id) OR public._session_on_toc_item_acl(( SELECT table_of_contents_items.path
   FROM public.table_of_contents_items
  WHERE ((table_of_contents_items.is_draft = false) AND (table_of_contents_items.data_layer_id = data_layers.id))))));


--
-- Name: data_layers data_layers_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_layers_update ON public.data_layers FOR UPDATE USING ((public.session_is_admin(project_id) AND ( SELECT (( SELECT 1
           FROM public.table_of_contents_items
          WHERE ((table_of_contents_items.data_layer_id = data_layers.id) AND (table_of_contents_items.is_draft = false))) IS NULL)))) WITH CHECK (public.session_is_admin(project_id));


--
-- Name: data_sources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: data_sources data_sources_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_sources_delete ON public.data_sources FOR DELETE USING (public.session_is_admin(project_id));


--
-- Name: data_sources data_sources_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_sources_insert ON public.data_sources FOR INSERT WITH CHECK ((public.session_is_admin(project_id) AND (public.data_hosting_quota_left(project_id) > 0)));


--
-- Name: data_sources data_sources_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_sources_select ON public.data_sources FOR SELECT USING ((public.session_is_admin(project_id) OR public._session_on_toc_item_acl(( SELECT table_of_contents_items.path
   FROM public.table_of_contents_items
  WHERE ((table_of_contents_items.is_draft = false) AND (table_of_contents_items.data_layer_id = ( SELECT data_layers.id
           FROM public.data_layers
          WHERE (data_layers.data_source_id = data_sources.id))))))));


--
-- Name: data_sources data_sources_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_sources_update ON public.data_sources FOR UPDATE USING ((public.session_is_admin(project_id) AND ( SELECT (( SELECT 1
           FROM public.table_of_contents_items
          WHERE ((table_of_contents_items.data_layer_id = ( SELECT data_layers.id
                   FROM public.data_layers
                  WHERE (data_layers.data_source_id = data_sources.id))) AND (table_of_contents_items.is_draft = false))) IS NULL)))) WITH CHECK (public.session_is_admin(project_id));


--
-- Name: data_upload_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_upload_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: data_upload_tasks data_upload_tasks_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_upload_tasks_select ON public.data_upload_tasks USING (public.session_is_admin(project_id));


--
-- Name: email_notification_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: email_notification_preferences email_notification_preferences_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_notification_preferences_owner ON public.email_notification_preferences TO seasketch_user USING (public.it_me(user_id)) WITH CHECK (public.it_me(user_id));


--
-- Name: form_elements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_elements ENABLE ROW LEVEL SECURITY;

--
-- Name: form_elements form_fields_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_fields_admin ON public.form_elements TO seasketch_user USING (public.session_is_admin(public.project_id_for_form_id(form_id))) WITH CHECK (public.session_is_admin(public.project_id_for_form_id(form_id)));


--
-- Name: form_logic_conditions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_logic_conditions ENABLE ROW LEVEL SECURITY;

--
-- Name: form_logic_conditions form_logic_conditions_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_logic_conditions_admin ON public.form_logic_conditions TO seasketch_user USING (public.session_is_admin(public.project_id_from_field_id(( SELECT form_logic_rules.form_element_id
   FROM public.form_logic_rules
  WHERE (form_logic_rules.id = form_logic_conditions.rule_id))))) WITH CHECK (public.session_is_admin(public.project_id_from_field_id(( SELECT form_logic_rules.form_element_id
   FROM public.form_logic_rules
  WHERE (form_logic_rules.id = form_logic_conditions.rule_id)))));


--
-- Name: form_logic_conditions form_logic_conditions_unprivileged; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_logic_conditions_unprivileged ON public.form_logic_conditions FOR SELECT USING (true);


--
-- Name: form_logic_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_logic_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: form_logic_rules form_logic_rules_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_logic_rules_admin ON public.form_logic_rules TO seasketch_user USING (public.session_is_admin(public.project_id_from_field_id(form_element_id))) WITH CHECK (public.session_is_admin(public.project_id_from_field_id(form_element_id)));


--
-- Name: form_logic_rules form_logic_rules_unprivileged; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_logic_rules_unprivileged ON public.form_logic_rules FOR SELECT USING (true);


--
-- Name: forms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

--
-- Name: forms forms_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forms_admin ON public.forms TO seasketch_user USING (public.session_is_admin(( SELECT sketch_classes.project_id
   FROM public.sketch_classes
  WHERE ((sketch_classes.id = forms.sketch_class_id) OR (sketch_classes.id = forms.survey_id))))) WITH CHECK (public.session_is_admin(( SELECT sketch_classes.project_id
   FROM public.sketch_classes
  WHERE ((sketch_classes.id = forms.sketch_class_id) OR (sketch_classes.id = forms.survey_id)))));


--
-- Name: form_elements forms_fields_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forms_fields_select ON public.form_elements FOR SELECT TO anon USING (public.session_can_access_form(form_id));


--
-- Name: forms forms_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forms_user_select ON public.forms FOR SELECT TO anon USING (public.session_can_access_form(id));


--
-- Name: forums forum_access_admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_access_admins ON public.forums TO seasketch_user USING (public.session_is_admin(project_id)) WITH CHECK (public.session_is_admin(project_id));


--
-- Name: forums; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forums ENABLE ROW LEVEL SECURITY;

--
-- Name: forums forums_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forums_select ON public.forums FOR SELECT USING ((public.session_has_project_access(project_id) AND public.session_on_acl(( SELECT access_control_lists.id
   FROM public.access_control_lists
  WHERE (access_control_lists.forum_id_read = forums.id)))));


--
-- Name: interactivity_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interactivity_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: interactivity_settings interactivity_settings_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY interactivity_settings_admin ON public.interactivity_settings USING (public.session_is_admin(COALESCE(( SELECT data_layers.project_id
   FROM public.data_layers
  WHERE (data_layers.interactivity_settings_id = data_layers.id)), ( SELECT basemaps.project_id
   FROM public.basemaps
  WHERE (basemaps.interactivity_settings_id = basemaps.id))))) WITH CHECK (public.session_is_admin(COALESCE(( SELECT data_layers.project_id
   FROM public.data_layers
  WHERE (data_layers.interactivity_settings_id = data_layers.id)), ( SELECT basemaps.project_id
   FROM public.basemaps
  WHERE (basemaps.interactivity_settings_id = basemaps.id)))));


--
-- Name: interactivity_settings interactivity_settings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY interactivity_settings_select ON public.interactivity_settings USING (true);


--
-- Name: invite_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invite_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: invite_emails invite_emails_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invite_emails_admin ON public.invite_emails FOR SELECT TO seasketch_user USING ((public.session_is_admin(( SELECT project_invites.project_id
   FROM public.project_invites
  WHERE (project_invites.id = invite_emails.project_invite_id))) OR public.session_is_admin(( SELECT surveys.project_id
   FROM (public.survey_invites
     JOIN public.surveys ON ((surveys.id = survey_invites.survey_id)))
  WHERE (survey_invites.id = invite_emails.survey_invite_id)))));


--
-- Name: offline_tile_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offline_tile_packages ENABLE ROW LEVEL SECURITY;

--
-- Name: offline_tile_packages offline_tile_packages_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offline_tile_packages_admin ON public.offline_tile_packages FOR SELECT USING (public.session_is_admin(project_id));


--
-- Name: offline_tile_packages offline_tile_packages_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offline_tile_packages_user ON public.offline_tile_packages FOR SELECT USING (('seasketch_user'::text = current_setting('role'::text, true)));


--
-- Name: offline_tile_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offline_tile_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: offline_tile_settings offline_tile_settings_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offline_tile_settings_admin ON public.offline_tile_settings USING (public.session_is_admin(project_id)) WITH CHECK (public.session_is_admin(project_id));


--
-- Name: optional_basemap_layers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.optional_basemap_layers ENABLE ROW LEVEL SECURITY;

--
-- Name: optional_basemap_layers optional_basemap_layers_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY optional_basemap_layers_admin ON public.optional_basemap_layers USING ((public.session_is_admin(( SELECT basemaps.project_id
   FROM public.basemaps
  WHERE (basemaps.id = optional_basemap_layers.basemap_id))) OR public.session_is_superuser())) WITH CHECK ((public.session_is_admin(( SELECT basemaps.project_id
   FROM public.basemaps
  WHERE (basemaps.id = optional_basemap_layers.basemap_id))) OR public.session_is_superuser()));


--
-- Name: optional_basemap_layers optional_basemap_layers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY optional_basemap_layers_select ON public.optional_basemap_layers FOR SELECT USING (true);


--
-- Name: posts posts_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY posts_delete ON public.posts FOR DELETE USING (((public.it_me(author_id) AND (now() < (created_at + '00:05:00'::interval))) OR public.session_is_admin(( SELECT forums.project_id
   FROM (public.forums
     JOIN public.topics ON ((topics.id = posts.topic_id)))
  WHERE (forums.id = topics.forum_id)))));


--
-- Name: posts posts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY posts_select ON public.posts FOR SELECT TO anon USING ((public.session_has_project_access(( SELECT forums.project_id
   FROM (public.forums
     JOIN public.topics ON ((topics.id = posts.topic_id)))
  WHERE (forums.id = topics.forum_id))) AND public.session_on_acl(( SELECT access_control_lists.id
   FROM ((public.access_control_lists
     JOIN public.topics ON ((topics.id = posts.topic_id)))
     JOIN public.forums ON ((forums.id = topics.forum_id)))
  WHERE (access_control_lists.forum_id_read = forums.id)))));


--
-- Name: project_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: project_groups project_groups_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_groups_admin ON public.project_groups USING (public.session_is_admin(project_id)) WITH CHECK (public.session_is_admin(project_id));


--
-- Name: project_invite_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_invite_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: project_invite_groups project_invite_groups_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_invite_groups_admin ON public.project_invite_groups TO seasketch_user USING (public.session_is_admin(( SELECT project_invites.project_id
   FROM public.project_invites
  WHERE (project_invites.id = project_invite_groups.invite_id)))) WITH CHECK (public.session_is_admin(( SELECT project_invites.project_id
   FROM public.project_invites
  WHERE (project_invites.id = project_invite_groups.invite_id))));


--
-- Name: project_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: project_invites project_invites_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_invites_admin ON public.project_invites TO seasketch_user USING (public.session_is_admin(project_id)) WITH CHECK (public.session_is_admin(project_id));


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
-- Name: projects_shared_basemaps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects_shared_basemaps ENABLE ROW LEVEL SECURITY;

--
-- Name: projects_shared_basemaps projects_shared_basemaps_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_shared_basemaps_admin ON public.projects_shared_basemaps USING (true) WITH CHECK (public.session_is_admin(project_id));


--
-- Name: projects_shared_basemaps projects_shared_basemaps_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_shared_basemaps_select ON public.projects_shared_basemaps FOR SELECT USING (true);


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

CREATE POLICY sketches_select ON public.sketches FOR SELECT USING ((public.it_me(user_id) OR public.session_is_admin(public.project_id_from_field_id(form_element_id))));


--
-- Name: sketches sketches_updated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sketches_updated ON public.sketches FOR UPDATE USING (public.it_me(user_id)) WITH CHECK (public.it_me(user_id));


--
-- Name: sprite_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sprite_images ENABLE ROW LEVEL SECURITY;

--
-- Name: sprite_images sprite_images_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sprite_images_read ON public.sprite_images FOR SELECT USING (true);


--
-- Name: sprites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sprites ENABLE ROW LEVEL SECURITY;

--
-- Name: sprites sprites_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sprites_read ON public.sprites FOR SELECT USING (true);


--
-- Name: survey_consent_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.survey_consent_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: survey_consent_documents survey_consent_documents_admin_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY survey_consent_documents_admin_access ON public.survey_consent_documents USING (public.session_is_admin(public.project_id_from_field_id(form_element_id)));


--
-- Name: survey_invited_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.survey_invited_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: survey_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.survey_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: survey_invites survey_invites_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY survey_invites_admin_delete ON public.survey_invites FOR DELETE TO seasketch_user USING (public.session_is_admin(( SELECT surveys.project_id
   FROM public.surveys
  WHERE (surveys.id = survey_invites.survey_id))));


--
-- Name: survey_invites survey_invites_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY survey_invites_admin_select ON public.survey_invites FOR SELECT TO seasketch_user USING (public.session_is_admin(( SELECT surveys.project_id
   FROM public.surveys
  WHERE (surveys.id = survey_invites.survey_id))));


--
-- Name: survey_invites survey_invites_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY survey_invites_admin_update ON public.survey_invites FOR UPDATE TO seasketch_user USING (public.session_is_admin(( SELECT surveys.project_id
   FROM public.surveys
  WHERE (surveys.id = survey_invites.survey_id)))) WITH CHECK (public.session_is_admin(( SELECT surveys.project_id
   FROM public.surveys
  WHERE (surveys.id = survey_invites.survey_id))));


--
-- Name: survey_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: survey_responses survey_responses_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY survey_responses_delete ON public.survey_responses FOR DELETE TO seasketch_user USING ((public.it_me(user_id) OR public.session_is_admin(( SELECT surveys.project_id
   FROM public.surveys
  WHERE (surveys.id = survey_responses.survey_id)))));


--
-- Name: survey_responses survey_responses_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY survey_responses_select ON public.survey_responses FOR SELECT TO seasketch_user USING ((public.it_me(user_id) OR ((is_draft = false) AND public.session_is_admin(( SELECT surveys.project_id
   FROM public.surveys
  WHERE (surveys.id = survey_responses.survey_id))))));


--
-- Name: survey_responses survey_responses_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY survey_responses_update ON public.survey_responses FOR UPDATE TO seasketch_user USING ((public.it_me(user_id) OR public.session_is_admin(( SELECT surveys.project_id
   FROM public.surveys
  WHERE (surveys.id = survey_responses.survey_id))))) WITH CHECK ((public.it_me(user_id) OR public.session_is_admin(( SELECT surveys.project_id
   FROM public.surveys
  WHERE (surveys.id = survey_responses.survey_id)))));


--
-- Name: surveys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

--
-- Name: surveys surveys_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY surveys_admin ON public.surveys TO seasketch_user USING (public.session_is_admin(project_id)) WITH CHECK (public.session_is_admin(project_id));


--
-- Name: survey_invited_groups surveys_invited_groups_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY surveys_invited_groups_admin ON public.survey_invited_groups TO seasketch_user USING (public.session_is_admin(( SELECT surveys.project_id
   FROM public.surveys
  WHERE (surveys.id = survey_invited_groups.survey_id)))) WITH CHECK (public.session_is_admin(( SELECT surveys.project_id
   FROM public.surveys
  WHERE (surveys.id = survey_invited_groups.survey_id))));


--
-- Name: surveys surveys_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY surveys_select ON public.surveys FOR SELECT TO anon USING ((public.session_is_admin(project_id) OR public.session_has_survey_invite(id) OR (public.session_has_project_access(project_id) AND (is_disabled = false) AND ((access_type = 'PUBLIC'::public.survey_access_type) OR public.session_in_group(public.survey_group_ids(id))))));


--
-- Name: table_of_contents_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_of_contents_items ENABLE ROW LEVEL SECURITY;

--
-- Name: table_of_contents_items table_of_contents_items_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY table_of_contents_items_admin ON public.table_of_contents_items USING (public.session_is_admin(project_id)) WITH CHECK (public.session_is_admin(project_id));


--
-- Name: table_of_contents_items table_of_contents_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY table_of_contents_items_select ON public.table_of_contents_items FOR SELECT TO anon USING ((public.session_has_project_access(project_id) AND (is_draft = false) AND public._session_on_toc_item_acl(path)));


--
-- Name: topics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

--
-- Name: topics topics_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY topics_delete ON public.topics FOR DELETE USING ((public.session_is_admin(( SELECT forums.project_id
   FROM public.forums
  WHERE (forums.id = topics.forum_id))) OR (public.it_me(author_id) AND (now() < (created_at + '00:05:00'::interval)) AND (NOT (EXISTS ( SELECT 1
   FROM public.posts
  WHERE ((posts.topic_id = posts.id) AND (posts.author_id <> posts.author_id))))))));


--
-- Name: topics topics_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY topics_select ON public.topics FOR SELECT TO seasketch_user USING ((public.session_has_project_access(( SELECT forums.project_id
   FROM public.forums
  WHERE (forums.id = topics.forum_id))) AND public.session_on_acl(( SELECT access_control_lists.id
   FROM public.access_control_lists
  WHERE (access_control_lists.forum_id_read = topics.forum_id)))));


--
-- Name: topics topics_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY topics_update ON public.topics FOR UPDATE USING ((public.session_is_admin(( SELECT forums.project_id
   FROM public.forums
  WHERE (forums.id = topics.forum_id))) OR (public.it_me(author_id) AND (now() < (created_at + '00:05:00'::interval))))) WITH CHECK ((public.session_is_admin(( SELECT forums.project_id
   FROM public.forums
  WHERE (forums.id = topics.forum_id))) OR (public.it_me(author_id) AND (now() < (created_at + '00:05:00'::interval)))));


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
GRANT ALL ON FUNCTION public.texticregexeq(public.citext, public.citext) TO anon;


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
-- Name: FUNCTION lquery_in(cstring); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lquery_in(cstring) FROM PUBLIC;


--
-- Name: FUNCTION lquery_out(public.lquery); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lquery_out(public.lquery) FROM PUBLIC;


--
-- Name: FUNCTION lquery_recv(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lquery_recv(internal) FROM PUBLIC;


--
-- Name: FUNCTION lquery_send(public.lquery); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lquery_send(public.lquery) FROM PUBLIC;


--
-- Name: FUNCTION ltree_in(cstring); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_in(cstring) FROM PUBLIC;


--
-- Name: FUNCTION ltree_out(public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_out(public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION ltree_recv(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_recv(internal) FROM PUBLIC;


--
-- Name: FUNCTION ltree_send(public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_send(public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION ltree_gist_in(cstring); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_gist_in(cstring) FROM PUBLIC;


--
-- Name: FUNCTION ltree_gist_out(public.ltree_gist); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_gist_out(public.ltree_gist) FROM PUBLIC;


--
-- Name: FUNCTION ltxtq_in(cstring); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltxtq_in(cstring) FROM PUBLIC;


--
-- Name: FUNCTION ltxtq_out(public.ltxtquery); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltxtq_out(public.ltxtquery) FROM PUBLIC;


--
-- Name: FUNCTION ltxtq_recv(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltxtq_recv(internal) FROM PUBLIC;


--
-- Name: FUNCTION ltxtq_send(public.ltxtquery); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltxtq_send(public.ltxtquery) FROM PUBLIC;


--
-- Name: FUNCTION spheroid_in(cstring); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.spheroid_in(cstring) FROM PUBLIC;


--
-- Name: FUNCTION spheroid_out(public.spheroid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.spheroid_out(public.spheroid) FROM PUBLIC;


--
-- Name: FUNCTION add_job(identifier text, payload json, queue_name text, run_at timestamp with time zone, max_attempts integer, job_key text, priority integer, flags text[], job_key_mode text); Type: ACL; Schema: graphile_worker; Owner: -
--

REVOKE ALL ON FUNCTION graphile_worker.add_job(identifier text, payload json, queue_name text, run_at timestamp with time zone, max_attempts integer, job_key text, priority integer, flags text[], job_key_mode text) FROM PUBLIC;


--
-- Name: FUNCTION complete_job(worker_id text, job_id bigint); Type: ACL; Schema: graphile_worker; Owner: -
--

REVOKE ALL ON FUNCTION graphile_worker.complete_job(worker_id text, job_id bigint) FROM PUBLIC;


--
-- Name: FUNCTION complete_jobs(job_ids bigint[]); Type: ACL; Schema: graphile_worker; Owner: -
--

REVOKE ALL ON FUNCTION graphile_worker.complete_jobs(job_ids bigint[]) FROM PUBLIC;


--
-- Name: FUNCTION fail_job(worker_id text, job_id bigint, error_message text); Type: ACL; Schema: graphile_worker; Owner: -
--

REVOKE ALL ON FUNCTION graphile_worker.fail_job(worker_id text, job_id bigint, error_message text) FROM PUBLIC;


--
-- Name: FUNCTION get_job(worker_id text, task_identifiers text[], job_expiry interval, forbidden_flags text[], now timestamp with time zone); Type: ACL; Schema: graphile_worker; Owner: -
--

REVOKE ALL ON FUNCTION graphile_worker.get_job(worker_id text, task_identifiers text[], job_expiry interval, forbidden_flags text[], now timestamp with time zone) FROM PUBLIC;


--
-- Name: FUNCTION jobs__decrease_job_queue_count(); Type: ACL; Schema: graphile_worker; Owner: -
--

REVOKE ALL ON FUNCTION graphile_worker.jobs__decrease_job_queue_count() FROM PUBLIC;


--
-- Name: FUNCTION jobs__increase_job_queue_count(); Type: ACL; Schema: graphile_worker; Owner: -
--

REVOKE ALL ON FUNCTION graphile_worker.jobs__increase_job_queue_count() FROM PUBLIC;


--
-- Name: FUNCTION permanently_fail_jobs(job_ids bigint[], error_message text); Type: ACL; Schema: graphile_worker; Owner: -
--

REVOKE ALL ON FUNCTION graphile_worker.permanently_fail_jobs(job_ids bigint[], error_message text) FROM PUBLIC;


--
-- Name: FUNCTION remove_job(job_key text); Type: ACL; Schema: graphile_worker; Owner: -
--

REVOKE ALL ON FUNCTION graphile_worker.remove_job(job_key text) FROM PUBLIC;


--
-- Name: FUNCTION reschedule_jobs(job_ids bigint[], run_at timestamp with time zone, priority integer, attempts integer, max_attempts integer); Type: ACL; Schema: graphile_worker; Owner: -
--

REVOKE ALL ON FUNCTION graphile_worker.reschedule_jobs(job_ids bigint[], run_at timestamp with time zone, priority integer, attempts integer, max_attempts integer) FROM PUBLIC;


--
-- Name: FUNCTION tg__update_timestamp(); Type: ACL; Schema: graphile_worker; Owner: -
--

REVOKE ALL ON FUNCTION graphile_worker.tg__update_timestamp() FROM PUBLIC;


--
-- Name: FUNCTION tg_jobs__notify_new_jobs(); Type: ACL; Schema: graphile_worker; Owner: -
--

REVOKE ALL ON FUNCTION graphile_worker.tg_jobs__notify_new_jobs() FROM PUBLIC;


--
-- Name: FUNCTION gen_random_uuid(); Type: ACL; Schema: pg_catalog; Owner: -
--

GRANT ALL ON FUNCTION pg_catalog.gen_random_uuid() TO anon;


--
-- Name: FUNCTION texticregexeq(text, text); Type: ACL; Schema: pg_catalog; Owner: -
--

GRANT ALL ON FUNCTION pg_catalog.texticregexeq(text, text) TO anon;


--
-- Name: FUNCTION _001_unnest_survey_response_sketches(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._001_unnest_survey_response_sketches() FROM PUBLIC;


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
-- Name: COLUMN sketch_classes.geometry_type; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(geometry_type) ON TABLE public.sketch_classes TO seasketch_user;


--
-- Name: COLUMN sketch_classes.allow_multi; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(allow_multi) ON TABLE public.sketch_classes TO seasketch_user;


--
-- Name: COLUMN sketch_classes.is_archived; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(is_archived) ON TABLE public.sketch_classes TO seasketch_user;


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
-- Name: COLUMN sketch_classes.mapbox_gl_style; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(mapbox_gl_style) ON TABLE public.sketch_classes TO seasketch_user;


--
-- Name: FUNCTION _create_sketch_class(name text, project_id integer, form_element_id integer, template_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._create_sketch_class(name text, project_id integer, form_element_id integer, template_id integer) FROM PUBLIC;


--
-- Name: FUNCTION geography(public.geography, integer, boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geography(public.geography, integer, boolean) FROM PUBLIC;


--
-- Name: TABLE surveys; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.surveys TO anon;
GRANT ALL ON TABLE public.surveys TO seasketch_user;


--
-- Name: FUNCTION _create_survey(name text, project_id integer, template_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._create_survey(name text, project_id integer, template_id integer) FROM PUBLIC;


--
-- Name: FUNCTION _delete_table_of_contents_item(tid integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._delete_table_of_contents_item(tid integer) FROM PUBLIC;


--
-- Name: FUNCTION _lt_q_regex(public.ltree[], public.lquery[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._lt_q_regex(public.ltree[], public.lquery[]) FROM PUBLIC;


--
-- Name: FUNCTION _lt_q_rregex(public.lquery[], public.ltree[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._lt_q_rregex(public.lquery[], public.ltree[]) FROM PUBLIC;


--
-- Name: FUNCTION _ltq_extract_regex(public.ltree[], public.lquery); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ltq_extract_regex(public.ltree[], public.lquery) FROM PUBLIC;


--
-- Name: FUNCTION _ltq_regex(public.ltree[], public.lquery); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ltq_regex(public.ltree[], public.lquery) FROM PUBLIC;


--
-- Name: FUNCTION _ltq_rregex(public.lquery, public.ltree[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ltq_rregex(public.lquery, public.ltree[]) FROM PUBLIC;


--
-- Name: FUNCTION _ltree_compress(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ltree_compress(internal) FROM PUBLIC;


--
-- Name: FUNCTION _ltree_consistent(internal, public.ltree[], smallint, oid, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ltree_consistent(internal, public.ltree[], smallint, oid, internal) FROM PUBLIC;


--
-- Name: FUNCTION _ltree_extract_isparent(public.ltree[], public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ltree_extract_isparent(public.ltree[], public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION _ltree_extract_risparent(public.ltree[], public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ltree_extract_risparent(public.ltree[], public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION _ltree_gist_options(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ltree_gist_options(internal) FROM PUBLIC;


--
-- Name: FUNCTION _ltree_isparent(public.ltree[], public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ltree_isparent(public.ltree[], public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION _ltree_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ltree_penalty(internal, internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION _ltree_picksplit(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ltree_picksplit(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION _ltree_r_isparent(public.ltree, public.ltree[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ltree_r_isparent(public.ltree, public.ltree[]) FROM PUBLIC;


--
-- Name: FUNCTION _ltree_r_risparent(public.ltree, public.ltree[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ltree_r_risparent(public.ltree, public.ltree[]) FROM PUBLIC;


--
-- Name: FUNCTION _ltree_risparent(public.ltree[], public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ltree_risparent(public.ltree[], public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION _ltree_same(public.ltree_gist, public.ltree_gist, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ltree_same(public.ltree_gist, public.ltree_gist, internal) FROM PUBLIC;


--
-- Name: FUNCTION _ltree_union(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ltree_union(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION _ltxtq_exec(public.ltree[], public.ltxtquery); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ltxtq_exec(public.ltree[], public.ltxtquery) FROM PUBLIC;


--
-- Name: FUNCTION _ltxtq_extract_exec(public.ltree[], public.ltxtquery); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ltxtq_extract_exec(public.ltree[], public.ltxtquery) FROM PUBLIC;


--
-- Name: FUNCTION _ltxtq_rexec(public.ltxtquery, public.ltree[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._ltxtq_rexec(public.ltxtquery, public.ltree[]) FROM PUBLIC;


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
-- Name: FUNCTION _session_on_toc_item_acl(lpath public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._session_on_toc_item_acl(lpath public.ltree) FROM PUBLIC;
GRANT ALL ON FUNCTION public._session_on_toc_item_acl(lpath public.ltree) TO anon;


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
-- Name: FUNCTION _st_sortablehash(geom public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._st_sortablehash(geom public.geometry) FROM PUBLIC;


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
-- Name: TABLE access_control_lists; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.access_control_lists TO anon;


--
-- Name: COLUMN access_control_lists.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.access_control_lists TO seasketch_user;


--
-- Name: COLUMN access_control_lists.type; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(type),UPDATE(type) ON TABLE public.access_control_lists TO seasketch_user;


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
-- Name: FUNCTION account_exists(email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.account_exists(email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.account_exists(email text) TO anon;


--
-- Name: FUNCTION add_group_to_acl("aclId" integer, "groupId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_group_to_acl("aclId" integer, "groupId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_group_to_acl("aclId" integer, "groupId" integer) TO seasketch_user;


--
-- Name: TABLE sprites; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.sprites TO anon;


--
-- Name: FUNCTION add_image_to_sprite("spriteId" integer, "pixelRatio" integer, width integer, height integer, image text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_image_to_sprite("spriteId" integer, "pixelRatio" integer, width integer, height integer, image text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_image_to_sprite("spriteId" integer, "pixelRatio" integer, width integer, height integer, image text) TO seasketch_user;


--
-- Name: FUNCTION add_user_to_group("groupId" integer, "userId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_user_to_group("groupId" integer, "userId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_user_to_group("groupId" integer, "userId" integer) TO seasketch_user;


--
-- Name: FUNCTION add_user_to_group_update_survey_invites_trigger(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_user_to_group_update_survey_invites_trigger() FROM PUBLIC;


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
-- Name: FUNCTION after_deleted__data_sources(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.after_deleted__data_sources() FROM PUBLIC;


--
-- Name: FUNCTION after_insert_or_update_or_delete_project_invite_email(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.after_insert_or_update_or_delete_project_invite_email() FROM PUBLIC;


--
-- Name: FUNCTION after_post_insert(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.after_post_insert() FROM PUBLIC;


--
-- Name: FUNCTION after_response_submission(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.after_response_submission() FROM PUBLIC;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.users TO seasketch_user;


--
-- Name: COLUMN users.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.users TO anon;


--
-- Name: FUNCTION approve_participant("projectId" integer, "userId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.approve_participant("projectId" integer, "userId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.approve_participant("projectId" integer, "userId" integer) TO seasketch_user;


--
-- Name: TABLE survey_responses; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,DELETE ON TABLE public.survey_responses TO seasketch_user;


--
-- Name: COLUMN survey_responses.data; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(data) ON TABLE public.survey_responses TO seasketch_user;


--
-- Name: COLUMN survey_responses.is_draft; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(is_draft) ON TABLE public.survey_responses TO seasketch_user;


--
-- Name: COLUMN survey_responses.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(updated_at) ON TABLE public.survey_responses TO seasketch_user;


--
-- Name: COLUMN survey_responses.is_practice; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(is_practice) ON TABLE public.survey_responses TO seasketch_user;


--
-- Name: COLUMN survey_responses.archived; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(archived) ON TABLE public.survey_responses TO seasketch_user;


--
-- Name: FUNCTION archive_responses(ids integer[], "makeArchived" boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.archive_responses(ids integer[], "makeArchived" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.archive_responses(ids integer[], "makeArchived" boolean) TO seasketch_user;


--
-- Name: FUNCTION auto_create_profile(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.auto_create_profile() FROM PUBLIC;


--
-- Name: TABLE basemaps; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.basemaps TO seasketch_user;
GRANT SELECT ON TABLE public.basemaps TO anon;


--
-- Name: TABLE form_elements; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.form_elements TO anon;
GRANT ALL ON TABLE public.form_elements TO seasketch_user;


--
-- Name: COLUMN form_elements.is_required; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(is_required) ON TABLE public.form_elements TO seasketch_user;


--
-- Name: COLUMN form_elements.export_id; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(export_id) ON TABLE public.form_elements TO seasketch_user;


--
-- Name: COLUMN form_elements."position"; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE("position") ON TABLE public.form_elements TO seasketch_user;


--
-- Name: COLUMN form_elements.component_settings; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(component_settings) ON TABLE public.form_elements TO seasketch_user;


--
-- Name: COLUMN form_elements.type_id; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(type_id) ON TABLE public.form_elements TO seasketch_user;


--
-- Name: COLUMN form_elements.body; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(body) ON TABLE public.form_elements TO seasketch_user;


--
-- Name: COLUMN form_elements.background_color; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(background_color) ON TABLE public.form_elements TO seasketch_user;


--
-- Name: COLUMN form_elements.secondary_color; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(secondary_color) ON TABLE public.form_elements TO seasketch_user;


--
-- Name: COLUMN form_elements.text_variant; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(text_variant) ON TABLE public.form_elements TO seasketch_user;


--
-- Name: COLUMN form_elements.background_image; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(background_image) ON TABLE public.form_elements TO seasketch_user;


--
-- Name: COLUMN form_elements.layout; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(layout) ON TABLE public.form_elements TO seasketch_user;


--
-- Name: COLUMN form_elements.background_palette; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(background_palette) ON TABLE public.form_elements TO seasketch_user;


--
-- Name: COLUMN form_elements.unsplash_author_name; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(unsplash_author_name) ON TABLE public.form_elements TO seasketch_user;


--
-- Name: COLUMN form_elements.unsplash_author_url; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(unsplash_author_url) ON TABLE public.form_elements TO seasketch_user;


--
-- Name: COLUMN form_elements.background_width; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(background_width) ON TABLE public.form_elements TO seasketch_user;


--
-- Name: COLUMN form_elements.background_height; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(background_height) ON TABLE public.form_elements TO seasketch_user;


--
-- Name: FUNCTION basemaps_related_form_elements(basemap public.basemaps); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.basemaps_related_form_elements(basemap public.basemaps) FROM PUBLIC;
GRANT ALL ON FUNCTION public.basemaps_related_form_elements(basemap public.basemaps) TO seasketch_user;


--
-- Name: FUNCTION before_basemap_insert_create_interactivity_settings_func(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_basemap_insert_create_interactivity_settings_func() FROM PUBLIC;


--
-- Name: FUNCTION before_delete_sketch_class_check_form_element_id(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_delete_sketch_class_check_form_element_id() FROM PUBLIC;


--
-- Name: FUNCTION before_deleted__data_layers(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_deleted__data_layers() FROM PUBLIC;


--
-- Name: FUNCTION before_insert_form_elements_func(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_insert_form_elements_func() FROM PUBLIC;


--
-- Name: FUNCTION before_insert_or_update_data_layers_trigger(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_insert_or_update_data_layers_trigger() FROM PUBLIC;


--
-- Name: FUNCTION before_insert_or_update_data_sources_trigger(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_insert_or_update_data_sources_trigger() FROM PUBLIC;


--
-- Name: FUNCTION before_insert_or_update_form_logic_conditions_100(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_insert_or_update_form_logic_conditions_100() FROM PUBLIC;


--
-- Name: FUNCTION before_insert_or_update_form_logic_rules_100(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_insert_or_update_form_logic_rules_100() FROM PUBLIC;


--
-- Name: FUNCTION before_insert_or_update_table_of_contents_items_trigger(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_insert_or_update_table_of_contents_items_trigger() FROM PUBLIC;


--
-- Name: FUNCTION before_invite_emails_insert(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_invite_emails_insert() FROM PUBLIC;


--
-- Name: FUNCTION before_invite_emails_update(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_invite_emails_update() FROM PUBLIC;


--
-- Name: FUNCTION before_layer_insert_create_interactivity_settings_func(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_layer_insert_create_interactivity_settings_func() FROM PUBLIC;


--
-- Name: FUNCTION before_response_update(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_response_update() FROM PUBLIC;


--
-- Name: FUNCTION before_sketch_folders_insert_or_update(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_sketch_folders_insert_or_update() FROM PUBLIC;


--
-- Name: FUNCTION before_sketch_insert_or_update(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_sketch_insert_or_update() FROM PUBLIC;


--
-- Name: FUNCTION before_survey_delete(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_survey_delete() FROM PUBLIC;


--
-- Name: FUNCTION before_survey_invited_groups_insert(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_survey_invited_groups_insert() FROM PUBLIC;


--
-- Name: FUNCTION before_survey_response_insert(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_survey_response_insert() FROM PUBLIC;


--
-- Name: FUNCTION before_survey_update(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_survey_update() FROM PUBLIC;


--
-- Name: FUNCTION before_update_sketch_class_trigger(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.before_update_sketch_class_trigger() FROM PUBLIC;


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
GRANT ALL ON FUNCTION public.box2d(public.box3d) TO anon;


--
-- Name: FUNCTION box2d(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.box2d(public.geometry) FROM PUBLIC;
GRANT ALL ON FUNCTION public.box2d(public.geometry) TO anon;


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
-- Name: FUNCTION cancel_data_upload(project_id integer, upload_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cancel_data_upload(project_id integer, upload_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cancel_data_upload(project_id integer, upload_id uuid) TO seasketch_user;


--
-- Name: FUNCTION check_allowed_layouts(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_allowed_layouts() FROM PUBLIC;


--
-- Name: FUNCTION check_element_type(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_element_type() FROM PUBLIC;


--
-- Name: FUNCTION check_optional_basemap_layers_columns(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_optional_basemap_layers_columns() FROM PUBLIC;


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
GRANT ALL ON FUNCTION public.citext_eq(public.citext, public.citext) TO anon;


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
-- Name: FUNCTION cleanup_tile_package(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cleanup_tile_package() FROM PUBLIC;


--
-- Name: FUNCTION clear_form_element_style(form_element_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.clear_form_element_style(form_element_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.clear_form_element_style(form_element_id integer) TO seasketch_user;


--
-- Name: FUNCTION confirm_onboarded(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.confirm_onboarded() FROM PUBLIC;
GRANT ALL ON FUNCTION public.confirm_onboarded() TO seasketch_user;


--
-- Name: FUNCTION confirm_project_invite(invite_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.confirm_project_invite(invite_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.confirm_project_invite(invite_id integer) TO anon;


--
-- Name: FUNCTION confirm_project_invite_with_survey_token("projectId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.confirm_project_invite_with_survey_token("projectId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.confirm_project_invite_with_survey_token("projectId" integer) TO seasketch_user;


--
-- Name: FUNCTION confirm_project_invite_with_verified_email("projectId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.confirm_project_invite_with_verified_email("projectId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.confirm_project_invite_with_verified_email("projectId" integer) TO seasketch_user;


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
-- Name: FUNCTION copy_appearance(form_element_id integer, copy_from_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.copy_appearance(form_element_id integer, copy_from_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.copy_appearance(form_element_id integer, copy_from_id integer) TO seasketch_user;


--
-- Name: FUNCTION create_basemap_acl(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_basemap_acl() FROM PUBLIC;


--
-- Name: FUNCTION create_bbox(geom public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_bbox(geom public.geometry) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_bbox(geom public.geometry) TO anon;


--
-- Name: FUNCTION create_consent_document(fid integer, version integer, url text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_consent_document(fid integer, version integer, url text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_consent_document(fid integer, version integer, url text) TO seasketch_user;


--
-- Name: FUNCTION uuid_generate_v4(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.uuid_generate_v4() FROM PUBLIC;
GRANT ALL ON FUNCTION public.uuid_generate_v4() TO graphile;


--
-- Name: COLUMN data_upload_tasks.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.data_upload_tasks TO seasketch_user;


--
-- Name: COLUMN data_upload_tasks.project_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(project_id) ON TABLE public.data_upload_tasks TO seasketch_user;


--
-- Name: COLUMN data_upload_tasks.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.data_upload_tasks TO seasketch_user;


--
-- Name: COLUMN data_upload_tasks.state; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(state) ON TABLE public.data_upload_tasks TO seasketch_user;


--
-- Name: COLUMN data_upload_tasks.progress; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(progress) ON TABLE public.data_upload_tasks TO seasketch_user;


--
-- Name: COLUMN data_upload_tasks.filename; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(filename) ON TABLE public.data_upload_tasks TO seasketch_user;


--
-- Name: COLUMN data_upload_tasks.content_type; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(content_type) ON TABLE public.data_upload_tasks TO seasketch_user;


--
-- Name: COLUMN data_upload_tasks.error_message; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(error_message) ON TABLE public.data_upload_tasks TO seasketch_user;


--
-- Name: FUNCTION create_data_upload(filename text, project_id integer, content_type text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_data_upload(filename text, project_id integer, content_type text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_data_upload(filename text, project_id integer, content_type text) TO seasketch_user;


--
-- Name: FUNCTION create_form_element_associated_sketch_class(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_form_element_associated_sketch_class() FROM PUBLIC;


--
-- Name: TABLE forms; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.forms TO anon;
GRANT DELETE ON TABLE public.forms TO seasketch_user;
GRANT UPDATE ON TABLE public.forms TO seasketch_superuser;


--
-- Name: FUNCTION create_form_template_from_sketch_class("sketchClassId" integer, "templateName" text, template_type public.form_template_type); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_form_template_from_sketch_class("sketchClassId" integer, "templateName" text, template_type public.form_template_type) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_form_template_from_sketch_class("sketchClassId" integer, "templateName" text, template_type public.form_template_type) TO seasketch_superuser;


--
-- Name: FUNCTION create_form_template_from_survey("surveyId" integer, "templateName" text, template_type public.form_template_type); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_form_template_from_survey("surveyId" integer, "templateName" text, template_type public.form_template_type) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_form_template_from_survey("surveyId" integer, "templateName" text, template_type public.form_template_type) TO seasketch_superuser;


--
-- Name: FUNCTION create_forum_acl(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_forum_acl() FROM PUBLIC;


--
-- Name: TABLE posts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.posts TO anon;
GRANT DELETE ON TABLE public.posts TO seasketch_user;


--
-- Name: FUNCTION create_post(message jsonb, "topicId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_post(message jsonb, "topicId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_post(message jsonb, "topicId" integer) TO seasketch_user;


--
-- Name: FUNCTION geometry(public.geometry, integer, boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry(public.geometry, integer, boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.geometry(public.geometry, integer, boolean) TO anon;


--
-- Name: FUNCTION get_default_data_sources_bucket(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_default_data_sources_bucket() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_default_data_sources_bucket() TO anon;


--
-- Name: FUNCTION st_geomfromgeojson(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_geomfromgeojson(text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.st_geomfromgeojson(text) TO anon;


--
-- Name: TABLE projects; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.name; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(name) ON TABLE public.projects TO seasketch_superuser;
GRANT UPDATE(name) ON TABLE public.projects TO seasketch_user;
GRANT SELECT(name) ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.description; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(description) ON TABLE public.projects TO seasketch_superuser;
GRANT UPDATE(description) ON TABLE public.projects TO seasketch_user;
GRANT SELECT(description) ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.legacy_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(legacy_id) ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.slug; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(slug) ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.access_control; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(access_control) ON TABLE public.projects TO seasketch_superuser;
GRANT UPDATE(access_control) ON TABLE public.projects TO seasketch_user;
GRANT SELECT(access_control) ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.is_listed; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(is_listed) ON TABLE public.projects TO seasketch_superuser;
GRANT UPDATE(is_listed) ON TABLE public.projects TO seasketch_user;
GRANT SELECT(is_listed) ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.logo_url; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(logo_url) ON TABLE public.projects TO seasketch_superuser;
GRANT UPDATE(logo_url) ON TABLE public.projects TO seasketch_user;
GRANT SELECT(logo_url) ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.logo_link; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(logo_link) ON TABLE public.projects TO seasketch_superuser;
GRANT UPDATE(logo_link) ON TABLE public.projects TO seasketch_user;
GRANT SELECT(logo_link) ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.is_featured; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(is_featured) ON TABLE public.projects TO seasketch_superuser;
GRANT SELECT(is_featured) ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.is_deleted; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(is_deleted) ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.deleted_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(deleted_at) ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.region; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(region) ON TABLE public.projects TO seasketch_superuser;
GRANT UPDATE(region) ON TABLE public.projects TO seasketch_user;
GRANT SELECT(region) ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.data_sources_bucket_id; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(data_sources_bucket_id) ON TABLE public.projects TO seasketch_superuser;
GRANT UPDATE(data_sources_bucket_id) ON TABLE public.projects TO seasketch_user;
GRANT SELECT(data_sources_bucket_id) ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.invite_email_subject; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(invite_email_subject),UPDATE(invite_email_subject) ON TABLE public.projects TO seasketch_user;
GRANT SELECT(invite_email_subject) ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.support_email; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(support_email) ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.creator_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(creator_id) ON TABLE public.projects TO anon;


--
-- Name: COLUMN projects.mapbox_secret_key; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(mapbox_secret_key),UPDATE(mapbox_secret_key) ON TABLE public.projects TO seasketch_user;


--
-- Name: COLUMN projects.mapbox_public_key; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(mapbox_public_key) ON TABLE public.projects TO seasketch_user;
GRANT SELECT(mapbox_public_key) ON TABLE public.projects TO anon;


--
-- Name: FUNCTION create_project(name text, slug text, OUT project public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_project(name text, slug text, OUT project public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_project(name text, slug text, OUT project public.projects) TO seasketch_user;


--
-- Name: TABLE project_invites; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,DELETE ON TABLE public.project_invites TO seasketch_user;


--
-- Name: COLUMN project_invites.fullname; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(fullname) ON TABLE public.project_invites TO seasketch_user;


--
-- Name: COLUMN project_invites.email; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(email) ON TABLE public.project_invites TO seasketch_user;


--
-- Name: COLUMN project_invites.make_admin; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(make_admin) ON TABLE public.project_invites TO seasketch_user;


--
-- Name: FUNCTION create_project_invites("projectId" integer, "sendEmailNow" boolean, "makeAdmin" boolean, "groupNames" text[], "projectInviteOptions" public.project_invite_options[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_project_invites("projectId" integer, "sendEmailNow" boolean, "makeAdmin" boolean, "groupNames" text[], "projectInviteOptions" public.project_invite_options[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_project_invites("projectId" integer, "sendEmailNow" boolean, "makeAdmin" boolean, "groupNames" text[], "projectInviteOptions" public.project_invite_options[]) TO seasketch_user;


--
-- Name: FUNCTION create_sketch_class_acl(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_sketch_class_acl() FROM PUBLIC;


--
-- Name: FUNCTION create_sprite("projectId" integer, _md5 text, _type public.sprite_type, _pixel_ratio integer, _width integer, _height integer, _url text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_sprite("projectId" integer, _md5 text, _type public.sprite_type, _pixel_ratio integer, _width integer, _height integer, _url text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_sprite("projectId" integer, _md5 text, _type public.sprite_type, _pixel_ratio integer, _width integer, _height integer, _url text) TO seasketch_user;


--
-- Name: TABLE survey_invites; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,DELETE ON TABLE public.survey_invites TO seasketch_user;


--
-- Name: COLUMN survey_invites.fullname; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(fullname) ON TABLE public.survey_invites TO seasketch_user;


--
-- Name: FUNCTION create_survey_invites("surveyId" integer, "includeProjectInvite" boolean, "makeAdmin" boolean, "groupNames" text[], "surveyInviteOptions" public.survey_invite_options[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_survey_invites("surveyId" integer, "includeProjectInvite" boolean, "makeAdmin" boolean, "groupNames" text[], "surveyInviteOptions" public.survey_invite_options[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_survey_invites("surveyId" integer, "includeProjectInvite" boolean, "makeAdmin" boolean, "groupNames" text[], "surveyInviteOptions" public.survey_invite_options[]) TO seasketch_user;


--
-- Name: TABLE form_logic_rules; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.form_logic_rules TO anon;
GRANT ALL ON TABLE public.form_logic_rules TO seasketch_user;


--
-- Name: FUNCTION create_survey_jump_rule("formElementId" integer, "jumpToId" integer, "booleanOperator" public.form_logic_operator, operator public.field_rule_operator); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_survey_jump_rule("formElementId" integer, "jumpToId" integer, "booleanOperator" public.form_logic_operator, operator public.field_rule_operator) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_survey_jump_rule("formElementId" integer, "jumpToId" integer, "booleanOperator" public.form_logic_operator, operator public.field_rule_operator) TO seasketch_user;


--
-- Name: FUNCTION create_survey_response("surveyId" integer, response_data json, facilitated boolean, draft boolean, bypassed_submission_control boolean, practice boolean, offline_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_survey_response("surveyId" integer, response_data json, facilitated boolean, draft boolean, bypassed_submission_control boolean, practice boolean, offline_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_survey_response("surveyId" integer, response_data json, facilitated boolean, draft boolean, bypassed_submission_control boolean, practice boolean, offline_id uuid) TO anon;


--
-- Name: FUNCTION create_table_of_contents_item_acl(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_table_of_contents_item_acl() FROM PUBLIC;


--
-- Name: TABLE topics; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.topics TO anon;
GRANT DELETE ON TABLE public.topics TO seasketch_user;


--
-- Name: COLUMN topics.title; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(title) ON TABLE public.topics TO seasketch_user;


--
-- Name: COLUMN topics.sticky; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(sticky) ON TABLE public.topics TO seasketch_user;


--
-- Name: COLUMN topics.locked; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(locked) ON TABLE public.topics TO seasketch_user;


--
-- Name: FUNCTION create_topic("forumId" integer, title text, message jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_topic("forumId" integer, title text, message jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_topic("forumId" integer, title text, message jsonb) TO seasketch_user;


--
-- Name: FUNCTION create_upload_task_job(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_upload_task_job() FROM PUBLIC;


--
-- Name: FUNCTION current_project(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.current_project() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_project() TO anon;


--
-- Name: FUNCTION current_project_access_status(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.current_project_access_status() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_project_access_status() TO anon;


--
-- Name: FUNCTION data_hosting_quota_left(pid integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.data_hosting_quota_left(pid integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.data_hosting_quota_left(pid integer) TO anon;


--
-- Name: FUNCTION extract_sprite_ids(t text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.extract_sprite_ids(t text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.extract_sprite_ids(t text) TO anon;


--
-- Name: TABLE data_layers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.data_layers TO anon;
GRANT ALL ON TABLE public.data_layers TO seasketch_user;


--
-- Name: COLUMN data_layers.z_index; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(z_index) ON TABLE public.data_layers TO anon;
GRANT UPDATE(z_index) ON TABLE public.data_layers TO seasketch_user;


--
-- Name: COLUMN data_layers.sprite_ids; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(sprite_ids) ON TABLE public.data_layers TO anon;


--
-- Name: FUNCTION data_layers_sprites(l public.data_layers); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.data_layers_sprites(l public.data_layers) FROM PUBLIC;
GRANT ALL ON FUNCTION public.data_layers_sprites(l public.data_layers) TO anon;


--
-- Name: TABLE data_sources; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.data_sources TO anon;
GRANT SELECT,INSERT,DELETE ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.attribution; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(attribution) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.maxzoom; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(maxzoom) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.minzoom; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(minzoom) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.url; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(url) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.scheme; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(scheme) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.tiles; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(tiles) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.tile_size; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(tile_size) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.encoding; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(encoding) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.buffer; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(buffer) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.cluster; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(cluster) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.cluster_max_zoom; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(cluster_max_zoom) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.cluster_properties; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(cluster_properties) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.cluster_radius; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(cluster_radius) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.generate_id; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(generate_id) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.line_metrics; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(line_metrics) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.promote_id; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(promote_id) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.tolerance; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(tolerance) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.coordinates; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(coordinates) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.urls; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(urls) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.query_parameters; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(query_parameters) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.use_device_pixel_ratio; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(use_device_pixel_ratio) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.supports_dynamic_layers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(supports_dynamic_layers) ON TABLE public.data_sources TO anon;
GRANT INSERT(supports_dynamic_layers),UPDATE(supports_dynamic_layers) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: COLUMN data_sources.uploaded_source_filename; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(uploaded_source_filename) ON TABLE public.data_sources TO seasketch_user;


--
-- Name: FUNCTION data_sources_uploaded_by(data_source public.data_sources); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.data_sources_uploaded_by(data_source public.data_sources) FROM PUBLIC;
GRANT ALL ON FUNCTION public.data_sources_uploaded_by(data_source public.data_sources) TO seasketch_user;


--
-- Name: FUNCTION data_upload_tasks_layers(upload public.data_upload_tasks); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.data_upload_tasks_layers(upload public.data_upload_tasks) FROM PUBLIC;
GRANT ALL ON FUNCTION public.data_upload_tasks_layers(upload public.data_upload_tasks) TO seasketch_user;


--
-- Name: TABLE offline_tile_packages; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.offline_tile_packages TO anon;


--
-- Name: FUNCTION delete_offline_tile_package(id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_offline_tile_package(id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_offline_tile_package(id uuid) TO seasketch_user;


--
-- Name: FUNCTION delete_project(project_id integer, OUT project public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_project(project_id integer, OUT project public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_project(project_id integer, OUT project public.projects) TO seasketch_user;


--
-- Name: FUNCTION delete_table_of_contents_branch("tableOfContentsItemId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_table_of_contents_branch("tableOfContentsItemId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_table_of_contents_branch("tableOfContentsItemId" integer) TO seasketch_user;


--
-- Name: FUNCTION deny_participant("projectId" integer, "userId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.deny_participant("projectId" integer, "userId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.deny_participant("projectId" integer, "userId" integer) TO seasketch_user;


--
-- Name: FUNCTION disable_forum_posting("userId" integer, "projectId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.disable_forum_posting("userId" integer, "projectId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.disable_forum_posting("userId" integer, "projectId" integer) TO seasketch_user;


--
-- Name: FUNCTION disablelongtransactions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.disablelongtransactions() FROM PUBLIC;


--
-- Name: FUNCTION dismiss_failed_upload(id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.dismiss_failed_upload(id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.dismiss_failed_upload(id uuid) TO seasketch_user;


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
-- Name: FUNCTION email_unsubscribed(email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.email_unsubscribed(email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.email_unsubscribed(email text) TO anon;


--
-- Name: FUNCTION enable_forum_posting("userId" integer, "projectId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enable_forum_posting("userId" integer, "projectId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.enable_forum_posting("userId" integer, "projectId" integer) TO seasketch_user;


--
-- Name: FUNCTION enable_offline_support(project_id integer, enable boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enable_offline_support(project_id integer, enable boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.enable_offline_support(project_id integer, enable boolean) TO seasketch_user;


--
-- Name: FUNCTION enablelongtransactions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enablelongtransactions() FROM PUBLIC;


--
-- Name: FUNCTION equals(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.equals(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION export_spatial_responses(fid integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.export_spatial_responses(fid integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.export_spatial_responses(fid integer) TO seasketch_user;


--
-- Name: FUNCTION fail_data_upload(id uuid, msg text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fail_data_upload(id uuid, msg text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fail_data_upload(id uuid, msg text) TO seasketch_user;


--
-- Name: FUNCTION find_srid(character varying, character varying, character varying); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.find_srid(character varying, character varying, character varying) FROM PUBLIC;


--
-- Name: FUNCTION form_elements_is_input(el public.form_elements); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.form_elements_is_input(el public.form_elements) FROM PUBLIC;
GRANT ALL ON FUNCTION public.form_elements_is_input(el public.form_elements) TO anon;


--
-- Name: FUNCTION form_elements_sketch_class(form_element public.form_elements); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.form_elements_sketch_class(form_element public.form_elements) FROM PUBLIC;
GRANT ALL ON FUNCTION public.form_elements_sketch_class(form_element public.form_elements) TO anon;


--
-- Name: TABLE form_element_types; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.form_element_types TO anon;


--
-- Name: FUNCTION form_elements_type(e public.form_elements); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.form_elements_type(e public.form_elements) FROM PUBLIC;
GRANT ALL ON FUNCTION public.form_elements_type(e public.form_elements) TO anon;


--
-- Name: TABLE form_logic_conditions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.form_logic_conditions TO anon;
GRANT ALL ON TABLE public.form_logic_conditions TO seasketch_user;


--
-- Name: FUNCTION form_logic_rules_conditions(rule public.form_logic_rules); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.form_logic_rules_conditions(rule public.form_logic_rules) FROM PUBLIC;
GRANT ALL ON FUNCTION public.form_logic_rules_conditions(rule public.form_logic_rules) TO anon;


--
-- Name: FUNCTION forms_form_elements(f public.forms); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.forms_form_elements(f public.forms) FROM PUBLIC;
GRANT ALL ON FUNCTION public.forms_form_elements(f public.forms) TO anon;


--
-- Name: FUNCTION forms_logic_rules(form public.forms); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.forms_logic_rules(form public.forms) FROM PUBLIC;
GRANT ALL ON FUNCTION public.forms_logic_rules(form public.forms) TO anon;


--
-- Name: FUNCTION generate_offline_tile_package("projectId" integer, "dataSourceUrl" text, "maxZ" integer, "maxShorelineZ" integer, "sourceType" public.offline_tile_package_source_type, "originalUrlTemplate" text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.generate_offline_tile_package("projectId" integer, "dataSourceUrl" text, "maxZ" integer, "maxShorelineZ" integer, "sourceType" public.offline_tile_package_source_type, "originalUrlTemplate" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_offline_tile_package("projectId" integer, "dataSourceUrl" text, "maxZ" integer, "maxShorelineZ" integer, "sourceType" public.offline_tile_package_source_type, "originalUrlTemplate" text) TO seasketch_user;


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
GRANT ALL ON FUNCTION public.geometry(polygon) TO anon;


--
-- Name: FUNCTION geometry(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry(text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.geometry(text) TO anon;


--
-- Name: FUNCTION geometry(public.box2d); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry(public.box2d) FROM PUBLIC;
GRANT ALL ON FUNCTION public.geometry(public.box2d) TO anon;


--
-- Name: FUNCTION geometry(public.box3d); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry(public.box3d) FROM PUBLIC;
GRANT ALL ON FUNCTION public.geometry(public.box3d) TO anon;


--
-- Name: FUNCTION geometry(public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.geometry(public.geography) FROM PUBLIC;


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
-- Name: FUNCTION get_or_create_user_by_sub(_sub text, _email text, OUT user_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_or_create_user_by_sub(_sub text, _email text, OUT user_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_or_create_user_by_sub(_sub text, _email text, OUT user_id integer) TO anon;


--
-- Name: FUNCTION get_proj4_from_srid(integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_proj4_from_srid(integer) FROM PUBLIC;


--
-- Name: FUNCTION get_project_id(_slug text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_project_id(_slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_project_id(_slug text) TO anon;


--
-- Name: FUNCTION get_public_jwk(id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_public_jwk(id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_public_jwk(id uuid) TO anon;


--
-- Name: FUNCTION get_surveys(ids integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_surveys(ids integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_surveys(ids integer[]) TO anon;


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
-- Name: FUNCTION index(public.ltree, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.index(public.ltree, public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION index(public.ltree, public.ltree, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.index(public.ltree, public.ltree, integer) FROM PUBLIC;


--
-- Name: FUNCTION initialize_blank_sketch_class_form(sketch_class_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.initialize_blank_sketch_class_form(sketch_class_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.initialize_blank_sketch_class_form(sketch_class_id integer) TO seasketch_user;


--
-- Name: FUNCTION initialize_blank_survey_form(survey_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.initialize_blank_survey_form(survey_id integer) FROM PUBLIC;


--
-- Name: FUNCTION initialize_sketch_class_form_from_template(sketch_class_id integer, template_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.initialize_sketch_class_form_from_template(sketch_class_id integer, template_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.initialize_sketch_class_form_from_template(sketch_class_id integer, template_id integer) TO seasketch_user;


--
-- Name: FUNCTION initialize_survey_form_from_template(survey_id integer, template_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.initialize_survey_form_from_template(survey_id integer, template_id integer) FROM PUBLIC;


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
-- Name: FUNCTION lca(public.ltree[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lca(public.ltree[]) FROM PUBLIC;


--
-- Name: FUNCTION lca(public.ltree, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lca(public.ltree, public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION lca(public.ltree, public.ltree, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lca(public.ltree, public.ltree, public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION lca(public.ltree, public.ltree, public.ltree, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lca(public.ltree, public.ltree, public.ltree, public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION lca(public.ltree, public.ltree, public.ltree, public.ltree, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lca(public.ltree, public.ltree, public.ltree, public.ltree, public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION lca(public.ltree, public.ltree, public.ltree, public.ltree, public.ltree, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lca(public.ltree, public.ltree, public.ltree, public.ltree, public.ltree, public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION lca(public.ltree, public.ltree, public.ltree, public.ltree, public.ltree, public.ltree, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lca(public.ltree, public.ltree, public.ltree, public.ltree, public.ltree, public.ltree, public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION lca(public.ltree, public.ltree, public.ltree, public.ltree, public.ltree, public.ltree, public.ltree, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lca(public.ltree, public.ltree, public.ltree, public.ltree, public.ltree, public.ltree, public.ltree, public.ltree) FROM PUBLIC;


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
-- Name: FUNCTION lt_q_regex(public.ltree, public.lquery[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lt_q_regex(public.ltree, public.lquery[]) FROM PUBLIC;


--
-- Name: FUNCTION lt_q_rregex(public.lquery[], public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lt_q_rregex(public.lquery[], public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION ltq_regex(public.ltree, public.lquery); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltq_regex(public.ltree, public.lquery) FROM PUBLIC;


--
-- Name: FUNCTION ltq_rregex(public.lquery, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltq_rregex(public.lquery, public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION ltree2text(public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree2text(public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION ltree_addltree(public.ltree, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_addltree(public.ltree, public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION ltree_addtext(public.ltree, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_addtext(public.ltree, text) FROM PUBLIC;


--
-- Name: FUNCTION ltree_cmp(public.ltree, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_cmp(public.ltree, public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION ltree_compress(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_compress(internal) FROM PUBLIC;


--
-- Name: FUNCTION ltree_consistent(internal, public.ltree, smallint, oid, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_consistent(internal, public.ltree, smallint, oid, internal) FROM PUBLIC;


--
-- Name: FUNCTION ltree_decompress(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_decompress(internal) FROM PUBLIC;


--
-- Name: FUNCTION ltree_eq(public.ltree, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_eq(public.ltree, public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION ltree_ge(public.ltree, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_ge(public.ltree, public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION ltree_gist_options(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_gist_options(internal) FROM PUBLIC;


--
-- Name: FUNCTION ltree_gt(public.ltree, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_gt(public.ltree, public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION ltree_isparent(public.ltree, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_isparent(public.ltree, public.ltree) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ltree_isparent(public.ltree, public.ltree) TO anon;


--
-- Name: FUNCTION ltree_le(public.ltree, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_le(public.ltree, public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION ltree_lt(public.ltree, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_lt(public.ltree, public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION ltree_ne(public.ltree, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_ne(public.ltree, public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION ltree_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_penalty(internal, internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION ltree_picksplit(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_picksplit(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION ltree_risparent(public.ltree, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_risparent(public.ltree, public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION ltree_same(public.ltree_gist, public.ltree_gist, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_same(public.ltree_gist, public.ltree_gist, internal) FROM PUBLIC;


--
-- Name: FUNCTION ltree_textadd(text, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_textadd(text, public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION ltree_union(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltree_union(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION ltreeparentsel(internal, oid, internal, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltreeparentsel(internal, oid, internal, integer) FROM PUBLIC;


--
-- Name: FUNCTION ltxtq_exec(public.ltree, public.ltxtquery); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltxtq_exec(public.ltree, public.ltxtquery) FROM PUBLIC;


--
-- Name: FUNCTION ltxtq_rexec(public.ltxtquery, public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ltxtq_rexec(public.ltxtquery, public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION make_response_draft("responseId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.make_response_draft("responseId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.make_response_draft("responseId" integer) TO seasketch_user;


--
-- Name: FUNCTION make_responses_not_practice(ids integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.make_responses_not_practice(ids integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.make_responses_not_practice(ids integer[]) TO seasketch_user;


--
-- Name: FUNCTION make_responses_practice(ids integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.make_responses_practice(ids integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.make_responses_practice(ids integer[]) TO seasketch_user;


--
-- Name: FUNCTION make_sketch_class(name text, project_id integer, template_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.make_sketch_class(name text, project_id integer, template_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.make_sketch_class(name text, project_id integer, template_id integer) TO seasketch_user;


--
-- Name: FUNCTION make_survey(name text, project_id integer, template_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.make_survey(name text, project_id integer, template_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.make_survey(name text, project_id integer, template_id integer) TO seasketch_user;


--
-- Name: FUNCTION mark_topic_as_read("topicId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_topic_as_read("topicId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_topic_as_read("topicId" integer) TO seasketch_user;


--
-- Name: FUNCTION me(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.me() FROM PUBLIC;
GRANT ALL ON FUNCTION public.me() TO anon;


--
-- Name: FUNCTION modify_survey_answers(response_ids integer[], answers jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.modify_survey_answers(response_ids integer[], answers jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.modify_survey_answers(response_ids integer[], answers jsonb) TO seasketch_user;


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
-- Name: FUNCTION st_transform(public.geometry, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_transform(public.geometry, integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.st_transform(public.geometry, integer) TO anon;


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
-- Name: FUNCTION nlevel(public.ltree); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.nlevel(public.ltree) FROM PUBLIC;


--
-- Name: FUNCTION offline_tile_packages_insert_trigger(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.offline_tile_packages_insert_trigger() FROM PUBLIC;


--
-- Name: FUNCTION offline_tile_packages_job_errors(pkg public.offline_tile_packages); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.offline_tile_packages_job_errors(pkg public.offline_tile_packages) FROM PUBLIC;
GRANT ALL ON FUNCTION public.offline_tile_packages_job_errors(pkg public.offline_tile_packages) TO anon;


--
-- Name: FUNCTION offline_tile_packages_job_status(pkg public.offline_tile_packages); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.offline_tile_packages_job_status(pkg public.offline_tile_packages) FROM PUBLIC;
GRANT ALL ON FUNCTION public.offline_tile_packages_job_status(pkg public.offline_tile_packages) TO anon;


--
-- Name: FUNCTION on_user_insert_create_notification_preferences(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.on_user_insert_create_notification_preferences() FROM PUBLIC;


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
-- Name: FUNCTION postgis_lib_revision(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.postgis_lib_revision() FROM PUBLIC;


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
GRANT ALL ON FUNCTION public.postgis_type_name(geomname character varying, coord_dimension integer, use_new_name boolean) TO anon;


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
-- Name: TABLE user_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.user_profiles TO anon;
GRANT UPDATE ON TABLE public.user_profiles TO seasketch_user;


--
-- Name: FUNCTION posts_author_profile(post public.posts); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.posts_author_profile(post public.posts) FROM PUBLIC;
GRANT ALL ON FUNCTION public.posts_author_profile(post public.posts) TO anon;


--
-- Name: FUNCTION posts_message(post public.posts); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.posts_message(post public.posts) FROM PUBLIC;
GRANT ALL ON FUNCTION public.posts_message(post public.posts) TO anon;


--
-- Name: FUNCTION project_access_status(pid integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.project_access_status(pid integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.project_access_status(pid integer) TO anon;


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
-- Name: FUNCTION project_id_for_form_id(fid integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.project_id_for_form_id(fid integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.project_id_for_form_id(fid integer) TO anon;


--
-- Name: FUNCTION project_id_from_field_id(fid integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.project_id_from_field_id(fid integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.project_id_from_field_id(fid integer) TO anon;


--
-- Name: FUNCTION project_invite_was_used(invite_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.project_invite_was_used(invite_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.project_invite_was_used(invite_id integer) TO anon;


--
-- Name: FUNCTION project_invites_groups(invite public.project_invites); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.project_invites_groups(invite public.project_invites) FROM PUBLIC;
GRANT ALL ON FUNCTION public.project_invites_groups(invite public.project_invites) TO seasketch_user;


--
-- Name: FUNCTION project_invites_participation_status(invite public.project_invites); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.project_invites_participation_status(invite public.project_invites) FROM PUBLIC;
GRANT ALL ON FUNCTION public.project_invites_participation_status(invite public.project_invites) TO seasketch_user;


--
-- Name: FUNCTION project_invites_status(invite public.project_invites); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.project_invites_status(invite public.project_invites) FROM PUBLIC;
GRANT ALL ON FUNCTION public.project_invites_status(invite public.project_invites) TO seasketch_user;


--
-- Name: FUNCTION project_public_details(slug text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.project_public_details(slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.project_public_details(slug text) TO anon;


--
-- Name: FUNCTION projects_access_requests(p public.projects, order_by public.participant_sort_by, direction public.sort_by_direction); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_access_requests(p public.projects, order_by public.participant_sort_by, direction public.sort_by_direction) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_access_requests(p public.projects, order_by public.participant_sort_by, direction public.sort_by_direction) TO seasketch_user;


--
-- Name: FUNCTION projects_active_data_uploads(p public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_active_data_uploads(p public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_active_data_uploads(p public.projects) TO seasketch_user;


--
-- Name: FUNCTION projects_admin_count(p public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_admin_count(p public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_admin_count(p public.projects) TO seasketch_user;


--
-- Name: FUNCTION projects_admins(p public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_admins(p public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_admins(p public.projects) TO seasketch_user;


--
-- Name: FUNCTION projects_basemaps(project public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_basemaps(project public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_basemaps(project public.projects) TO anon;


--
-- Name: FUNCTION projects_data_hosting_quota(p public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_data_hosting_quota(p public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_data_hosting_quota(p public.projects) TO seasketch_user;


--
-- Name: FUNCTION projects_data_hosting_quota_used(p public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_data_hosting_quota_used(p public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_data_hosting_quota_used(p public.projects) TO seasketch_user;


--
-- Name: FUNCTION projects_data_layers_for_items(p public.projects, table_of_contents_item_ids integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_data_layers_for_items(p public.projects, table_of_contents_item_ids integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_data_layers_for_items(p public.projects, table_of_contents_item_ids integer[]) TO anon;


--
-- Name: FUNCTION projects_data_sources_for_items(p public.projects, table_of_contents_item_ids integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_data_sources_for_items(p public.projects, table_of_contents_item_ids integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_data_sources_for_items(p public.projects, table_of_contents_item_ids integer[]) TO anon;


--
-- Name: TABLE table_of_contents_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.table_of_contents_items TO anon;


--
-- Name: COLUMN table_of_contents_items.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.table_of_contents_items TO anon;


--
-- Name: COLUMN table_of_contents_items.path; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(path) ON TABLE public.table_of_contents_items TO anon;


--
-- Name: COLUMN table_of_contents_items.stable_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(stable_id) ON TABLE public.table_of_contents_items TO seasketch_user;
GRANT SELECT(stable_id) ON TABLE public.table_of_contents_items TO anon;


--
-- Name: COLUMN table_of_contents_items.parent_stable_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(parent_stable_id) ON TABLE public.table_of_contents_items TO seasketch_user;
GRANT SELECT(parent_stable_id) ON TABLE public.table_of_contents_items TO anon;


--
-- Name: COLUMN table_of_contents_items.is_draft; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(is_draft) ON TABLE public.table_of_contents_items TO anon;


--
-- Name: COLUMN table_of_contents_items.project_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(project_id) ON TABLE public.table_of_contents_items TO seasketch_user;
GRANT SELECT(project_id) ON TABLE public.table_of_contents_items TO anon;


--
-- Name: COLUMN table_of_contents_items.title; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(title),UPDATE(title) ON TABLE public.table_of_contents_items TO seasketch_user;
GRANT SELECT(title) ON TABLE public.table_of_contents_items TO anon;


--
-- Name: COLUMN table_of_contents_items.is_folder; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(is_folder) ON TABLE public.table_of_contents_items TO seasketch_user;
GRANT SELECT(is_folder) ON TABLE public.table_of_contents_items TO anon;


--
-- Name: COLUMN table_of_contents_items.show_radio_children; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(show_radio_children),UPDATE(show_radio_children) ON TABLE public.table_of_contents_items TO seasketch_user;
GRANT SELECT(show_radio_children) ON TABLE public.table_of_contents_items TO anon;


--
-- Name: COLUMN table_of_contents_items.is_click_off_only; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(is_click_off_only),UPDATE(is_click_off_only) ON TABLE public.table_of_contents_items TO seasketch_user;
GRANT SELECT(is_click_off_only) ON TABLE public.table_of_contents_items TO anon;


--
-- Name: COLUMN table_of_contents_items.metadata; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(metadata),UPDATE(metadata) ON TABLE public.table_of_contents_items TO seasketch_user;
GRANT SELECT(metadata) ON TABLE public.table_of_contents_items TO anon;


--
-- Name: COLUMN table_of_contents_items.bounds; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(bounds),UPDATE(bounds) ON TABLE public.table_of_contents_items TO seasketch_user;
GRANT SELECT(bounds) ON TABLE public.table_of_contents_items TO anon;


--
-- Name: COLUMN table_of_contents_items.data_layer_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(data_layer_id),UPDATE(data_layer_id) ON TABLE public.table_of_contents_items TO seasketch_user;
GRANT SELECT(data_layer_id) ON TABLE public.table_of_contents_items TO anon;


--
-- Name: COLUMN table_of_contents_items.sort_index; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(sort_index) ON TABLE public.table_of_contents_items TO anon;


--
-- Name: COLUMN table_of_contents_items.hide_children; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(hide_children),INSERT(hide_children),UPDATE(hide_children) ON TABLE public.table_of_contents_items TO seasketch_user;


--
-- Name: COLUMN table_of_contents_items.enable_download; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(enable_download) ON TABLE public.table_of_contents_items TO anon;
GRANT INSERT(enable_download),UPDATE(enable_download) ON TABLE public.table_of_contents_items TO seasketch_user;


--
-- Name: FUNCTION projects_draft_table_of_contents_items(p public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_draft_table_of_contents_items(p public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_draft_table_of_contents_items(p public.projects) TO anon;


--
-- Name: FUNCTION projects_invite(p public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_invite(p public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_invite(p public.projects) TO anon;


--
-- Name: FUNCTION projects_invite_counts(p public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_invite_counts(p public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_invite_counts(p public.projects) TO seasketch_user;


--
-- Name: FUNCTION projects_invites(p public.projects, statuses public.invite_status[], "orderBy" public.invite_order_by, direction public.sort_by_direction); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_invites(p public.projects, statuses public.invite_status[], "orderBy" public.invite_order_by, direction public.sort_by_direction) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_invites(p public.projects, statuses public.invite_status[], "orderBy" public.invite_order_by, direction public.sort_by_direction) TO seasketch_user;


--
-- Name: FUNCTION projects_is_admin(p public.projects, "userId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_is_admin(p public.projects, "userId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_is_admin(p public.projects, "userId" integer) TO seasketch_user;


--
-- Name: FUNCTION projects_mapbox_secret_key(p public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_mapbox_secret_key(p public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_mapbox_secret_key(p public.projects) TO anon;


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
-- Name: FUNCTION projects_session_has_posts(project public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_session_has_posts(project public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_session_has_posts(project public.projects) TO seasketch_user;


--
-- Name: FUNCTION projects_session_has_privileged_access(p public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_session_has_privileged_access(p public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_session_has_privileged_access(p public.projects) TO seasketch_user;
GRANT ALL ON FUNCTION public.projects_session_has_privileged_access(p public.projects) TO anon;


--
-- Name: FUNCTION projects_session_is_admin(p public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_session_is_admin(p public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_session_is_admin(p public.projects) TO seasketch_user;
GRANT ALL ON FUNCTION public.projects_session_is_admin(p public.projects) TO anon;


--
-- Name: FUNCTION projects_session_outstanding_survey_invites(project public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_session_outstanding_survey_invites(project public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_session_outstanding_survey_invites(project public.projects) TO anon;


--
-- Name: FUNCTION projects_session_participation_status(p public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_session_participation_status(p public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_session_participation_status(p public.projects) TO seasketch_user;
GRANT ALL ON FUNCTION public.projects_session_participation_status(p public.projects) TO anon;


--
-- Name: FUNCTION projects_sprites(p public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_sprites(p public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_sprites(p public.projects) TO seasketch_user;


--
-- Name: FUNCTION projects_survey_basemaps(project public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_survey_basemaps(project public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_survey_basemaps(project public.projects) TO seasketch_user;
GRANT ALL ON FUNCTION public.projects_survey_basemaps(project public.projects) TO anon;


--
-- Name: FUNCTION projects_table_of_contents_items(p public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_table_of_contents_items(p public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_table_of_contents_items(p public.projects) TO anon;


--
-- Name: FUNCTION projects_unapproved_participant_count(p public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_unapproved_participant_count(p public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_unapproved_participant_count(p public.projects) TO seasketch_user;


--
-- Name: FUNCTION projects_unapproved_participants(p public.projects, order_by public.participant_sort_by, direction public.sort_by_direction); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_unapproved_participants(p public.projects, order_by public.participant_sort_by, direction public.sort_by_direction) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_unapproved_participants(p public.projects, order_by public.participant_sort_by, direction public.sort_by_direction) TO seasketch_user;


--
-- Name: FUNCTION projects_url(p public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_url(p public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_url(p public.projects) TO anon;


--
-- Name: FUNCTION projects_users_banned_from_forums(project public.projects); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.projects_users_banned_from_forums(project public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_users_banned_from_forums(project public.projects) TO seasketch_user;


--
-- Name: FUNCTION public_sprites(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.public_sprites() FROM PUBLIC;
GRANT ALL ON FUNCTION public.public_sprites() TO seasketch_user;


--
-- Name: FUNCTION publish_table_of_contents("projectId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.publish_table_of_contents("projectId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.publish_table_of_contents("projectId" integer) TO seasketch_user;


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
-- Name: FUNCTION remove_user_from_group_update_survey_invites_trigger(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remove_user_from_group_update_survey_invites_trigger() FROM PUBLIC;


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
-- Name: FUNCTION revoke_admin_access("projectId" integer, "userId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.revoke_admin_access("projectId" integer, "userId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.revoke_admin_access("projectId" integer, "userId" integer) TO seasketch_user;


--
-- Name: COLUMN invite_emails.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.invite_emails TO seasketch_user;


--
-- Name: COLUMN invite_emails.to_address; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(to_address) ON TABLE public.invite_emails TO seasketch_user;


--
-- Name: COLUMN invite_emails.project_invite_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(project_invite_id) ON TABLE public.invite_emails TO seasketch_user;


--
-- Name: COLUMN invite_emails.survey_invite_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(survey_invite_id) ON TABLE public.invite_emails TO seasketch_user;


--
-- Name: COLUMN invite_emails.status; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(status) ON TABLE public.invite_emails TO seasketch_user;


--
-- Name: COLUMN invite_emails.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.invite_emails TO seasketch_user;


--
-- Name: COLUMN invite_emails.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(updated_at) ON TABLE public.invite_emails TO seasketch_user;


--
-- Name: COLUMN invite_emails.token_expires_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(token_expires_at) ON TABLE public.invite_emails TO seasketch_user;


--
-- Name: COLUMN invite_emails.error; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(error) ON TABLE public.invite_emails TO seasketch_user;


--
-- Name: FUNCTION send_all_project_invites("projectId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.send_all_project_invites("projectId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.send_all_project_invites("projectId" integer) TO seasketch_user;


--
-- Name: FUNCTION send_project_invites("inviteIds" integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.send_project_invites("inviteIds" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.send_project_invites("inviteIds" integer[]) TO seasketch_user;


--
-- Name: FUNCTION session_can_access_form(fid integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.session_can_access_form(fid integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.session_can_access_form(fid integer) TO anon;


--
-- Name: FUNCTION session_has_project_access(pid integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.session_has_project_access(pid integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.session_has_project_access(pid integer) TO anon;


--
-- Name: FUNCTION session_has_survey_invite(survey_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.session_has_survey_invite(survey_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.session_has_survey_invite(survey_id integer) TO anon;


--
-- Name: FUNCTION session_in_group("groupIds" integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.session_in_group("groupIds" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.session_in_group("groupIds" integer[]) TO anon;


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
-- Name: FUNCTION session_is_banned_from_posting(pid integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.session_is_banned_from_posting(pid integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.session_is_banned_from_posting(pid integer) TO anon;


--
-- Name: FUNCTION session_is_superuser(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.session_is_superuser() FROM PUBLIC;
GRANT ALL ON FUNCTION public.session_is_superuser() TO seasketch_user;


--
-- Name: FUNCTION session_member_of_group(groups integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.session_member_of_group(groups integer[]) FROM PUBLIC;


--
-- Name: FUNCTION session_on_acl(acl_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.session_on_acl(acl_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.session_on_acl(acl_id integer) TO anon;


--
-- Name: FUNCTION set_form_element_order("elementIds" integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_form_element_order("elementIds" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_form_element_order("elementIds" integer[]) TO seasketch_user;


--
-- Name: FUNCTION set_form_logic_rule_order("ruleIds" integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_form_logic_rule_order("ruleIds" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_form_logic_rule_order("ruleIds" integer[]) TO seasketch_user;


--
-- Name: TABLE forums; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.forums TO anon;
GRANT INSERT,DELETE ON TABLE public.forums TO seasketch_user;


--
-- Name: COLUMN forums.name; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(name) ON TABLE public.forums TO seasketch_user;


--
-- Name: COLUMN forums."position"; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE("position") ON TABLE public.forums TO seasketch_user;


--
-- Name: COLUMN forums.description; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(description) ON TABLE public.forums TO seasketch_user;


--
-- Name: COLUMN forums.archived; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(archived) ON TABLE public.forums TO seasketch_user;


--
-- Name: FUNCTION set_forum_order("forumIds" integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_forum_order("forumIds" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_forum_order("forumIds" integer[]) TO seasketch_user;


--
-- Name: FUNCTION set_post_hidden_by_moderator("postId" integer, value boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_post_hidden_by_moderator("postId" integer, value boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_post_hidden_by_moderator("postId" integer, value boolean) TO seasketch_user;


--
-- Name: FUNCTION set_survey_response_last_updated_by(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_survey_response_last_updated_by() FROM PUBLIC;


--
-- Name: FUNCTION set_topic_locked("topicId" integer, value boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_topic_locked("topicId" integer, value boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_topic_locked("topicId" integer, value boolean) TO seasketch_user;


--
-- Name: FUNCTION set_topic_sticky("topicId" integer, value boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_topic_sticky("topicId" integer, value boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_topic_sticky("topicId" integer, value boolean) TO seasketch_user;


--
-- Name: FUNCTION set_user_groups("userId" integer, "projectId" integer, groups integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_user_groups("userId" integer, "projectId" integer, groups integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_user_groups("userId" integer, "projectId" integer, groups integer[]) TO seasketch_user;


--
-- Name: FUNCTION share_sprite(sprite_id integer, category text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.share_sprite(sprite_id integer, category text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.share_sprite(sprite_id integer, category text) TO seasketch_user;


--
-- Name: FUNCTION shared_basemaps(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.shared_basemaps() FROM PUBLIC;
GRANT ALL ON FUNCTION public.shared_basemaps() TO anon;


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
-- Name: FUNCTION slugify(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slugify(text) FROM PUBLIC;


--
-- Name: FUNCTION slugify(value text, allow_unicode boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slugify(value text, allow_unicode boolean) FROM PUBLIC;


--
-- Name: FUNCTION soft_delete_sprite(id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.soft_delete_sprite(id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.soft_delete_sprite(id integer) TO seasketch_user;


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
-- Name: FUNCTION st_asewkt(public.geography, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asewkt(public.geography, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_asewkt(public.geometry, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asewkt(public.geometry, integer) FROM PUBLIC;


--
-- Name: FUNCTION st_asgeojson(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asgeojson(text) FROM PUBLIC;


--
-- Name: FUNCTION st_asgeojson(geog public.geography, maxdecimaldigits integer, options integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asgeojson(geog public.geography, maxdecimaldigits integer, options integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.st_asgeojson(geog public.geography, maxdecimaldigits integer, options integer) TO anon;


--
-- Name: FUNCTION st_asgeojson(geom public.geometry, maxdecimaldigits integer, options integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asgeojson(geom public.geometry, maxdecimaldigits integer, options integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.st_asgeojson(geom public.geometry, maxdecimaldigits integer, options integer) TO anon;


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
GRANT ALL ON FUNCTION public.st_asmvtgeom(geom public.geometry, bounds public.box2d, extent integer, buffer integer, clip_geom boolean) TO anon;


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
-- Name: FUNCTION st_collectionextract(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_collectionextract(public.geometry) FROM PUBLIC;


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
GRANT ALL ON FUNCTION public.st_coorddim(geometry public.geometry) TO anon;


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
-- Name: FUNCTION st_difference(geom1 public.geometry, geom2 public.geometry, gridsize double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_difference(geom1 public.geometry, geom2 public.geometry, gridsize double precision) FROM PUBLIC;


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
-- Name: FUNCTION st_force3d(geom public.geometry, zvalue double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_force3d(geom public.geometry, zvalue double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_force3dm(geom public.geometry, mvalue double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_force3dm(geom public.geometry, mvalue double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_force3dz(geom public.geometry, zvalue double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_force3dz(geom public.geometry, zvalue double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_force4d(geom public.geometry, zvalue double precision, mvalue double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_force4d(geom public.geometry, zvalue double precision, mvalue double precision) FROM PUBLIC;


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
-- Name: FUNCTION st_hexagon(size double precision, cell_i integer, cell_j integer, origin public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_hexagon(size double precision, cell_i integer, cell_j integer, origin public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_hexagongrid(size double precision, bounds public.geometry, OUT geom public.geometry, OUT i integer, OUT j integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_hexagongrid(size double precision, bounds public.geometry, OUT geom public.geometry, OUT i integer, OUT j integer) FROM PUBLIC;


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
-- Name: FUNCTION st_intersection(geom1 public.geometry, geom2 public.geometry, gridsize double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_intersection(geom1 public.geometry, geom2 public.geometry, gridsize double precision) FROM PUBLIC;


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
GRANT ALL ON FUNCTION public.st_makeenvelope(double precision, double precision, double precision, double precision, integer) TO anon;


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
-- Name: FUNCTION st_maximuminscribedcircle(public.geometry, OUT center public.geometry, OUT nearest public.geometry, OUT radius double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_maximuminscribedcircle(public.geometry, OUT center public.geometry, OUT nearest public.geometry, OUT radius double precision) FROM PUBLIC;


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
-- Name: FUNCTION st_reduceprecision(geom public.geometry, gridsize double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_reduceprecision(geom public.geometry, gridsize double precision) FROM PUBLIC;


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
-- Name: FUNCTION st_square(size double precision, cell_i integer, cell_j integer, origin public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_square(size double precision, cell_i integer, cell_j integer, origin public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_squaregrid(size double precision, bounds public.geometry, OUT geom public.geometry, OUT i integer, OUT j integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_squaregrid(size double precision, bounds public.geometry, OUT geom public.geometry, OUT i integer, OUT j integer) FROM PUBLIC;


--
-- Name: FUNCTION st_srid(geog public.geography); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_srid(geog public.geography) FROM PUBLIC;
GRANT ALL ON FUNCTION public.st_srid(geog public.geography) TO anon;


--
-- Name: FUNCTION st_srid(geom public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_srid(geom public.geometry) FROM PUBLIC;
GRANT ALL ON FUNCTION public.st_srid(geom public.geometry) TO anon;


--
-- Name: FUNCTION st_startpoint(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_startpoint(public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_subdivide(geom public.geometry, maxvertices integer, gridsize double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_subdivide(geom public.geometry, maxvertices integer, gridsize double precision) FROM PUBLIC;


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
-- Name: FUNCTION st_symdifference(geom1 public.geometry, geom2 public.geometry, gridsize double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_symdifference(geom1 public.geometry, geom2 public.geometry, gridsize double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_symmetricdifference(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_symmetricdifference(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_tileenvelope(zoom integer, x integer, y integer, bounds public.geometry, margin double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_tileenvelope(zoom integer, x integer, y integer, bounds public.geometry, margin double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_touches(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_touches(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_transform(geom public.geometry, to_proj text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_transform(geom public.geometry, to_proj text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.st_transform(geom public.geometry, to_proj text) TO anon;


--
-- Name: FUNCTION st_transform(geom public.geometry, from_proj text, to_srid integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_transform(geom public.geometry, from_proj text, to_srid integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.st_transform(geom public.geometry, from_proj text, to_srid integer) TO anon;


--
-- Name: FUNCTION st_transform(geom public.geometry, from_proj text, to_proj text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_transform(geom public.geometry, from_proj text, to_proj text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.st_transform(geom public.geometry, from_proj text, to_proj text) TO anon;


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
-- Name: FUNCTION st_unaryunion(public.geometry, gridsize double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_unaryunion(public.geometry, gridsize double precision) FROM PUBLIC;


--
-- Name: FUNCTION st_union(public.geometry[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_union(public.geometry[]) FROM PUBLIC;


--
-- Name: FUNCTION st_union(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_union(geom1 public.geometry, geom2 public.geometry) FROM PUBLIC;


--
-- Name: FUNCTION st_union(geom1 public.geometry, geom2 public.geometry, gridsize double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_union(geom1 public.geometry, geom2 public.geometry, gridsize double precision) FROM PUBLIC;


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
-- Name: FUNCTION subltree(public.ltree, integer, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.subltree(public.ltree, integer, integer) FROM PUBLIC;


--
-- Name: FUNCTION submit_data_upload(id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_data_upload(id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_data_upload(id uuid) TO seasketch_user;


--
-- Name: FUNCTION subpath(public.ltree, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.subpath(public.ltree, integer) FROM PUBLIC;


--
-- Name: FUNCTION subpath(public.ltree, integer, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.subpath(public.ltree, integer, integer) FROM PUBLIC;


--
-- Name: FUNCTION survey_group_ids(id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.survey_group_ids(id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.survey_group_ids(id integer) TO anon;


--
-- Name: FUNCTION survey_invite_before_insert_trigger(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.survey_invite_before_insert_trigger() FROM PUBLIC;


--
-- Name: FUNCTION survey_invite_before_update_trigger(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.survey_invite_before_update_trigger() FROM PUBLIC;


--
-- Name: FUNCTION survey_invite_was_used(invite_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.survey_invite_was_used(invite_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.survey_invite_was_used(invite_id integer) TO anon;


--
-- Name: FUNCTION survey_invites_status(invite public.survey_invites); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.survey_invites_status(invite public.survey_invites) FROM PUBLIC;
GRANT ALL ON FUNCTION public.survey_invites_status(invite public.survey_invites) TO seasketch_user;


--
-- Name: FUNCTION survey_response_mvt("formElementId" integer, x integer, y integer, z integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.survey_response_mvt("formElementId" integer, x integer, y integer, z integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.survey_response_mvt("formElementId" integer, x integer, y integer, z integer) TO seasketch_user;


--
-- Name: FUNCTION survey_responses_account_email(r public.survey_responses); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.survey_responses_account_email(r public.survey_responses) FROM PUBLIC;
GRANT ALL ON FUNCTION public.survey_responses_account_email(r public.survey_responses) TO seasketch_user;


--
-- Name: FUNCTION survey_responses_last_updated_by_email(r public.survey_responses); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.survey_responses_last_updated_by_email(r public.survey_responses) FROM PUBLIC;
GRANT ALL ON FUNCTION public.survey_responses_last_updated_by_email(r public.survey_responses) TO seasketch_user;


--
-- Name: FUNCTION survey_validation_info(survey_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.survey_validation_info(survey_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.survey_validation_info(survey_id integer) TO anon;


--
-- Name: FUNCTION surveys_archived_response_count(survey public.surveys); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.surveys_archived_response_count(survey public.surveys) FROM PUBLIC;
GRANT ALL ON FUNCTION public.surveys_archived_response_count(survey public.surveys) TO seasketch_user;


--
-- Name: FUNCTION surveys_basemaps(survey public.surveys); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.surveys_basemaps(survey public.surveys) FROM PUBLIC;
GRANT ALL ON FUNCTION public.surveys_basemaps(survey public.surveys) TO anon;


--
-- Name: FUNCTION surveys_invited_groups(survey public.surveys); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.surveys_invited_groups(survey public.surveys) FROM PUBLIC;
GRANT ALL ON FUNCTION public.surveys_invited_groups(survey public.surveys) TO seasketch_user;


--
-- Name: FUNCTION surveys_is_spatial(s public.surveys); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.surveys_is_spatial(s public.surveys) FROM PUBLIC;
GRANT ALL ON FUNCTION public.surveys_is_spatial(s public.surveys) TO anon;


--
-- Name: FUNCTION surveys_is_template(survey public.surveys); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.surveys_is_template(survey public.surveys) FROM PUBLIC;
GRANT ALL ON FUNCTION public.surveys_is_template(survey public.surveys) TO anon;


--
-- Name: FUNCTION surveys_practice_response_count(survey public.surveys); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.surveys_practice_response_count(survey public.surveys) FROM PUBLIC;
GRANT ALL ON FUNCTION public.surveys_practice_response_count(survey public.surveys) TO seasketch_user;


--
-- Name: FUNCTION surveys_responses_spatial_extent(survey public.surveys); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.surveys_responses_spatial_extent(survey public.surveys) FROM PUBLIC;
GRANT ALL ON FUNCTION public.surveys_responses_spatial_extent(survey public.surveys) TO seasketch_user;


--
-- Name: FUNCTION surveys_submitted_response_count(survey public.surveys); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.surveys_submitted_response_count(survey public.surveys) FROM PUBLIC;
GRANT ALL ON FUNCTION public.surveys_submitted_response_count(survey public.surveys) TO seasketch_user;


--
-- Name: FUNCTION template_forms(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.template_forms() FROM PUBLIC;
GRANT ALL ON FUNCTION public.template_forms() TO anon;


--
-- Name: FUNCTION text(public.geometry); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.text(public.geometry) FROM PUBLIC;
GRANT ALL ON FUNCTION public.text(public.geometry) TO anon;


--
-- Name: FUNCTION text2ltree(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.text2ltree(text) FROM PUBLIC;


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
-- Name: FUNCTION tilebbox(z integer, x integer, y integer, srid integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tilebbox(z integer, x integer, y integer, srid integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tilebbox(z integer, x integer, y integer, srid integer) TO anon;


--
-- Name: FUNCTION toggle_admin_access("projectId" integer, "userId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.toggle_admin_access("projectId" integer, "userId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.toggle_admin_access("projectId" integer, "userId" integer) TO seasketch_user;


--
-- Name: FUNCTION toggle_forum_posting_ban("userId" integer, "projectId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.toggle_forum_posting_ban("userId" integer, "projectId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.toggle_forum_posting_ban("userId" integer, "projectId" integer) TO seasketch_user;


--
-- Name: FUNCTION toggle_responses_practice(ids integer[], "isPractice" boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.toggle_responses_practice(ids integer[], "isPractice" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.toggle_responses_practice(ids integer[], "isPractice" boolean) TO seasketch_user;


--
-- Name: FUNCTION topics_author_profile(topic public.topics); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.topics_author_profile(topic public.topics) FROM PUBLIC;
GRANT ALL ON FUNCTION public.topics_author_profile(topic public.topics) TO anon;


--
-- Name: FUNCTION translate(public.citext, public.citext, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.translate(public.citext, public.citext, text) FROM PUBLIC;


--
-- Name: FUNCTION unaccent(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.unaccent(text) FROM PUBLIC;


--
-- Name: FUNCTION unaccent(regdictionary, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.unaccent(regdictionary, text) FROM PUBLIC;


--
-- Name: FUNCTION unaccent_init(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.unaccent_init(internal) FROM PUBLIC;


--
-- Name: FUNCTION unaccent_lexize(internal, internal, internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.unaccent_lexize(internal, internal, internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION unlockrows(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.unlockrows(text) FROM PUBLIC;


--
-- Name: FUNCTION unsubscribed("userId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.unsubscribed("userId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.unsubscribed("userId" integer) TO graphile;


--
-- Name: FUNCTION update_basemap_offline_tile_settings("projectId" integer, "basemapId" integer, use_default boolean, "maxZ" integer, "maxShorelineZ" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_basemap_offline_tile_settings("projectId" integer, "basemapId" integer, use_default boolean, "maxZ" integer, "maxShorelineZ" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_basemap_offline_tile_settings("projectId" integer, "basemapId" integer, use_default boolean, "maxZ" integer, "maxShorelineZ" integer) TO seasketch_user;


--
-- Name: FUNCTION update_mapbox_secret_key(project_id integer, secret text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_mapbox_secret_key(project_id integer, secret text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_mapbox_secret_key(project_id integer, secret text) TO seasketch_user;


--
-- Name: FUNCTION update_post("postId" integer, message jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_post("postId" integer, message jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_post("postId" integer, message jsonb) TO seasketch_user;


--
-- Name: FUNCTION update_project_invite("inviteId" integer, make_admin boolean, email text, fullname text, groups integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_project_invite("inviteId" integer, make_admin boolean, email text, fullname text, groups integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_project_invite("inviteId" integer, make_admin boolean, email text, fullname text, groups integer[]) TO seasketch_user;


--
-- Name: FUNCTION update_survey_group_invites(surveyid integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_survey_group_invites(surveyid integer) FROM PUBLIC;


--
-- Name: FUNCTION update_survey_invited_groups("surveyId" integer, "groupIds" integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_survey_invited_groups("surveyId" integer, "groupIds" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_survey_invited_groups("surveyId" integer, "groupIds" integer[]) TO seasketch_user;


--
-- Name: FUNCTION update_table_of_contents_item_children("parentId" integer, "childIds" integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_table_of_contents_item_children("parentId" integer, "childIds" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_table_of_contents_item_children("parentId" integer, "childIds" integer[]) TO seasketch_user;


--
-- Name: FUNCTION update_table_of_contents_item_parent("itemId" integer, "parentStableId" text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_table_of_contents_item_parent("itemId" integer, "parentStableId" text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_table_of_contents_item_parent("itemId" integer, "parentStableId" text) TO seasketch_user;


--
-- Name: FUNCTION update_table_of_contents_item_position("itemId" integer, "parentStableId" text, "sortIndex" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_table_of_contents_item_position("itemId" integer, "parentStableId" text, "sortIndex" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_table_of_contents_item_position("itemId" integer, "parentStableId" text, "sortIndex" integer) TO seasketch_user;


--
-- Name: FUNCTION update_z_indexes("dataLayerIds" integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_z_indexes("dataLayerIds" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_z_indexes("dataLayerIds" integer[]) TO seasketch_user;


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
-- Name: FUNCTION users_access_request_denied(u public.users, slug text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.users_access_request_denied(u public.users, slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.users_access_request_denied(u public.users, slug text) TO seasketch_user;


--
-- Name: FUNCTION users_approved_by(u public.users, project_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.users_approved_by(u public.users, project_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.users_approved_by(u public.users, project_id integer) TO seasketch_user;


--
-- Name: FUNCTION users_approved_or_denied_on(u public.users, project_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.users_approved_or_denied_on(u public.users, project_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.users_approved_or_denied_on(u public.users, project_id integer) TO seasketch_user;


--
-- Name: FUNCTION users_banned_from_forums(u public.users); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.users_banned_from_forums(u public.users) FROM PUBLIC;
GRANT ALL ON FUNCTION public.users_banned_from_forums(u public.users) TO anon;


--
-- Name: FUNCTION users_canonical_email(_user public.users); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.users_canonical_email(_user public.users) FROM PUBLIC;
GRANT ALL ON FUNCTION public.users_canonical_email(_user public.users) TO seasketch_user;


--
-- Name: FUNCTION users_denied_by(u public.users, project_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.users_denied_by(u public.users, project_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.users_denied_by(u public.users, project_id integer) TO seasketch_user;


--
-- Name: FUNCTION users_groups(u public.users); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.users_groups(u public.users) FROM PUBLIC;
GRANT ALL ON FUNCTION public.users_groups(u public.users) TO seasketch_user;


--
-- Name: FUNCTION users_is_admin(u public.users); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.users_is_admin(u public.users) FROM PUBLIC;
GRANT ALL ON FUNCTION public.users_is_admin(u public.users) TO anon;


--
-- Name: FUNCTION users_is_approved(u public.users, project integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.users_is_approved(u public.users, project integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.users_is_approved(u public.users, project integer) TO seasketch_user;


--
-- Name: FUNCTION users_needs_access_request_approval(u public.users, slug text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.users_needs_access_request_approval(u public.users, slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.users_needs_access_request_approval(u public.users, slug text) TO seasketch_user;


--
-- Name: FUNCTION users_participation_status(u public.users, "projectId" integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.users_participation_status(u public.users, "projectId" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.users_participation_status(u public.users, "projectId" integer) TO seasketch_user;


--
-- Name: FUNCTION uuid_generate_v1(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.uuid_generate_v1() FROM PUBLIC;


--
-- Name: FUNCTION uuid_generate_v1mc(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.uuid_generate_v1mc() FROM PUBLIC;


--
-- Name: FUNCTION uuid_generate_v3(namespace uuid, name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.uuid_generate_v3(namespace uuid, name text) FROM PUBLIC;


--
-- Name: FUNCTION uuid_generate_v5(namespace uuid, name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.uuid_generate_v5(namespace uuid, name text) FROM PUBLIC;


--
-- Name: FUNCTION uuid_nil(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.uuid_nil() FROM PUBLIC;


--
-- Name: FUNCTION uuid_ns_dns(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.uuid_ns_dns() FROM PUBLIC;


--
-- Name: FUNCTION uuid_ns_oid(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.uuid_ns_oid() FROM PUBLIC;


--
-- Name: FUNCTION uuid_ns_url(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.uuid_ns_url() FROM PUBLIC;


--
-- Name: FUNCTION uuid_ns_x500(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.uuid_ns_x500() FROM PUBLIC;


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
GRANT ALL ON FUNCTION public.st_asmvt(anyelement) TO anon;


--
-- Name: FUNCTION st_asmvt(anyelement, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asmvt(anyelement, text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text) TO anon;


--
-- Name: FUNCTION st_asmvt(anyelement, text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asmvt(anyelement, text, integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text, integer) TO anon;


--
-- Name: FUNCTION st_asmvt(anyelement, text, integer, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asmvt(anyelement, text, integer, text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text, integer, text) TO anon;


--
-- Name: FUNCTION st_asmvt(anyelement, text, integer, text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_asmvt(anyelement, text, integer, text, text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text, integer, text, text) TO anon;


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
-- Name: FUNCTION st_union(public.geometry, double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.st_union(public.geometry, double precision) FROM PUBLIC;


--
-- Name: TABLE access_control_list_groups; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.access_control_list_groups TO seasketch_user;


--
-- Name: TABLE community_guidelines; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.community_guidelines TO anon;
GRANT INSERT,DELETE ON TABLE public.community_guidelines TO seasketch_user;


--
-- Name: COLUMN community_guidelines.content; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(content) ON TABLE public.community_guidelines TO seasketch_user;


--
-- Name: TABLE data_source_import_types; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.data_source_import_types TO anon;


--
-- Name: TABLE data_source_types; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.data_source_types TO anon;


--
-- Name: TABLE data_sources_buckets; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.data_sources_buckets TO anon;


--
-- Name: COLUMN data_sources_buckets.bucket; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(bucket) ON TABLE public.data_sources_buckets TO seasketch_user;


--
-- Name: TABLE email_notification_preferences; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,UPDATE ON TABLE public.email_notification_preferences TO seasketch_user;


--
-- Name: TABLE interactivity_settings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.interactivity_settings TO anon;
GRANT INSERT,UPDATE ON TABLE public.interactivity_settings TO seasketch_user;


--
-- Name: TABLE jwks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.jwks TO graphile;


--
-- Name: TABLE offline_tile_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.offline_tile_settings TO seasketch_user;


--
-- Name: TABLE optional_basemap_layers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.optional_basemap_layers TO seasketch_user;
GRANT SELECT ON TABLE public.optional_basemap_layers TO anon;


--
-- Name: TABLE project_group_members; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.project_group_members TO seasketch_user;


--
-- Name: TABLE project_invite_groups; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.project_invite_groups TO seasketch_user;


--
-- Name: TABLE project_participants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.project_participants TO seasketch_user;


--
-- Name: TABLE projects_shared_basemaps; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.projects_shared_basemaps TO anon;
GRANT ALL ON TABLE public.projects_shared_basemaps TO seasketch_user;


--
-- Name: TABLE sprite_images; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.sprite_images TO anon;


--
-- Name: TABLE survey_consent_documents; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.survey_consent_documents TO seasketch_user;


--
-- Name: TABLE survey_invited_groups; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE ON TABLE public.survey_invited_groups TO seasketch_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: -; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON FUNCTIONS  FROM PUBLIC;


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
-- PostgreSQL database dump complete
--

