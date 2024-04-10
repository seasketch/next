--! Previous: sha1:a4e551bebb1a43ad4c948d0a479f7ef209a4d814
--! Hash: sha1:b312fe5e6e7f890462ce77f2179bd202b90837ed

-- Enter migration here

drop table if exists activity_stats;
create table if not exists global_activity (
  date date not null primary key,
  registered_users integer not null,
  uploads_storage_used bigint not null,
  forum_posts int not null,
  sketches int not null,
  survey_responses int not null,
  uploaded_layers int not null,
  data_sources int not null,
  new_users int not null,
  new_sketches int not null,
  new_data_sources int not null,
  new_forum_posts int not null,
  new_survey_responses int not null,
  new_uploaded_layers int not null,
  new_uploaded_bytes bigint not null
);

create or replace function record_global_activity()
  returns date
  language sql
  security definer
  as $$
    insert into global_activity (
      date,
      registered_users,
      uploads_storage_used,
      forum_posts,
      sketches,
      survey_responses,
      uploaded_layers,
      data_sources,
      new_users,
      new_sketches,
      new_data_sources,
      new_forum_posts,
      new_survey_responses,
      new_uploaded_layers,
      new_uploaded_bytes
    )
    select
      current_date,
      (select count(*)::int from users),
      (select coalesce(sum(size), 0) from data_upload_outputs),
      (select count(*)::int from posts),
      (select count(*)::int from sketches where response_id is null),
      (select count(*)::int from survey_responses),
      (select count(*)::int from data_sources where type in (
      'seasketch-vector', 'seasketch-raster', 'seasketch-mvt'
      )),
      (select count(*)::int from data_sources),
      (select count(*)::int from users where registered_at >= current_date),
      (select count(*)::int from sketches where created_at >= current_date and response_id is null),
      (select count(*)::int from data_sources where created_at >= current_date),
      (select count(*)::int from posts where created_at >= current_date),
      (select count(*)::int from survey_responses where created_at >= current_date),
      (select count(*)::int from data_sources where created_at >= current_date and type in (
      'seasketch-vector', 'seasketch-raster', 'seasketch-mvt'
      )),
      (select coalesce(sum(size)::bigint, 0) from data_upload_outputs where created_at >= current_date) 
      on conflict(date) do update
      set
        registered_users = excluded.registered_users,
        uploads_storage_used = excluded.uploads_storage_used,
        forum_posts = excluded.forum_posts,
        sketches = excluded.sketches,
        survey_responses = excluded.survey_responses,
        uploaded_layers = excluded.uploaded_layers,
        data_sources = excluded.data_sources,
        new_users = excluded.new_users,
        new_sketches = excluded.new_sketches,
        new_data_sources = excluded.new_data_sources,
        new_forum_posts = excluded.new_forum_posts,
        new_survey_responses = excluded.new_survey_responses,
        new_uploaded_layers = excluded.new_uploaded_layers,
        new_uploaded_bytes = excluded.new_uploaded_bytes
    returning current_date;
  $$;

create table if not exists project_activity (
  project_id int references projects(id),
  date date not null,
  registered_users integer not null,
  uploads_storage_used bigint not null,
  forum_posts int not null,
  sketches int not null,
  survey_responses int not null,
  uploaded_layers int not null,
  data_sources int not null,
  new_users int not null,
  new_sketches int not null,
  new_data_sources int not null,
  new_forum_posts int not null,
  new_survey_responses int not null,
  new_uploaded_layers int not null,
  new_uploaded_bytes bigint not null,
  primary key (project_id, date)
);

drop function if exists record_project_activity;
create or replace function record_project_activity(pid int)
  returns project_activity
  security definer
  language sql
  as $$
    insert into project_activity (
      project_id,
      date,
      registered_users,
      uploads_storage_used,
      forum_posts,
      sketches,
      survey_responses,
      uploaded_layers,
      data_sources,
      new_users,
      new_sketches,
      new_data_sources,
      new_forum_posts,
      new_survey_responses,
      new_uploaded_layers,
      new_uploaded_bytes
    )
    select
      pid,
      current_date,
      (select count(*)::int from project_participants where project_id = pid),
      (select coalesce(sum(size), 0) from data_upload_outputs where project_id = pid),
      (select count(*)::int from posts where topic_id = any (
        select id from topics where forum_id = any (
          select id from forums where project_id = pid
        )
      )),
      (select count(*)::int from sketches where response_id is null and sketch_class_id = any (
        select id from sketch_classes where project_id = pid
      )),
      (select count(*)::int from survey_responses where survey_id = any (
        select id from surveys where project_id = pid
      )),
      (select count(*)::int from data_sources where project_id = pid and type in (
      'seasketch-vector', 'seasketch-raster', 'seasketch-mvt'
      )),
      (select count(*)::int from data_sources where project_id = pid),
      (select count(*)::int from project_participants where project_id = pid and requested_at >= current_date),
      (
        select count(*)::int from sketches where created_at >= current_date and response_id is null and sketch_class_id = any (
          select id from sketch_classes where project_id = pid
        )
      ),
      (select count(*)::int from data_sources where project_id = pid and created_at >= current_date),
      (select count(*)::int from posts where created_at >= current_date and topic_id = any (
        select id from topics where forum_id = any (
          select id from forums where project_id = pid
        )
      )),
      (select count(*)::int from survey_responses where created_at >= current_date and survey_id = any (
        select id from surveys where project_id = pid
      )),
      (select count(*)::int from data_sources where project_id = pid and created_at >= current_date and type in (
      'seasketch-vector', 'seasketch-raster', 'seasketch-mvt'
      )),
      (select coalesce(sum(size)::bigint, 0) from data_upload_outputs where project_id = pid and created_at >= current_date)
      on conflict(project_id, date) do update
      set
        registered_users = excluded.registered_users,
        uploads_storage_used = excluded.uploads_storage_used,
        forum_posts = excluded.forum_posts,
        sketches = excluded.sketches,
        survey_responses = excluded.survey_responses,
        uploaded_layers = excluded.uploaded_layers,
        data_sources = excluded.data_sources,
        new_users = excluded.new_users,
        new_sketches = excluded.new_sketches,
        new_data_sources = excluded.new_data_sources,
        new_forum_posts = excluded.new_forum_posts,
        new_survey_responses = excluded.new_survey_responses,
        new_uploaded_layers = excluded.new_uploaded_layers,
        new_uploaded_bytes = excluded.new_uploaded_bytes
    returning *;
  $$;

create or replace function get_projects_with_recent_activity()
  returns int[]
  language sql
  security definer
  as $$
    select array_agg(distinct(project_id)) from (
      select distinct(project_id) from data_upload_outputs where created_at >= current_date
      union
      select distinct(project_id) from project_participants where requested_at >= current_date
      union
      select distinct(project_id) from sketch_classes where id = any (select sketch_class_id from sketches  where created_at >= current_date)
      union
      select distinct(project_id) from surveys where id = any (select survey_id from survey_responses where created_at >= current_date)
      union
      select distinct(project_id) from forums where id = any (select forum_id from topics where id = any (
        select topic_id from posts where created_at >= current_date
      ))
      union
      select distinct(project_id) from data_sources where created_at >= current_date
    ) as foo;
  $$;


CREATE OR REPLACE FUNCTION public.active_projects(period public.activity_stats_period, "limit" integer DEFAULT 10) RETURNS SETOF public.projects
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select
      *
    from projects
    where id = any(
      select
        distinct(project_id)
      from project_activity
      where date >= (
        case period
          when '24hrs' then current_date - interval '24 hours'
          when '7-days' then current_date - interval '7 days'
          when '30-days' then current_date - interval '30 days'
          when '6-months' then current_date - interval '6 months'
          when '1-year' then current_date - interval '1 year'
          else current_date - interval '1 year'
        end
      )
    )
  $$;

-- trigger a run of record_project_activity whenever a table_of_contents_item is deleted
create or replace function record_project_activity_on_delete()
  returns trigger
  language plpgsql
  as $$
  begin
    perform graphile_worker.add_job(
      'recordProjectActivity',
      payload := json_build_object(
        'projectId', old.project_id
      ),
      run_at := NOW() + '10 seconds',
      queue_name := 'recordProjectActivity',
      job_key := 'recordProjectActivity:' || old.project_id
    );
    return old;
  end;
  $$;


drop trigger if exists record_project_activity_on_delete on table_of_contents_items;

create trigger record_project_activity_on_delete
  after delete on table_of_contents_items
  for each row
  execute procedure record_project_activity_on_delete();

-- trigger a run of record_project_activity whenever a data_upload_output is deleted
drop trigger if exists record_project_activity_on_delete on data_upload_outputs;
create trigger record_project_activity_on_delete
  after delete on data_upload_outputs
  for each row
  execute procedure record_project_activity_on_delete();

drop function if exists projects_activity;
drop type if exists project_activity_stats;

CREATE TYPE public.project_activity_stats AS (
	registered_users integer,
	uploads_storage_used bigint,
	forum_posts integer,
	sketches integer,
  survey_responses integer,
	uploaded_layers integer,
	data_sources integer,

	new_users integer,
	new_sketches integer,
	new_data_sources integer,
	new_forum_posts integer,
  new_survey_responses integer,
  new_uploaded_layers integer,
	new_uploaded_bytes bigint
);


CREATE OR REPLACE FUNCTION public.projects_activity(p public.projects, period public.activity_stats_period) RETURNS public.project_activity_stats
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      stats project_activity_stats;
    begin
      select 
        coalesce(sum(registered_users), 0)::integer, 
        coalesce(sum(uploads_storage_used), 0)::bigint, 
        coalesce(sum(forum_posts), 0)::integer, 
        coalesce(sum(sketches), 0)::integer, 
        coalesce(sum(survey_responses), 0)::integer, 
        coalesce(sum(uploaded_layers), 0)::integer, 
        coalesce(sum(data_sources), 0)::integer,

        coalesce(sum(new_users), 0)::integer, 
        coalesce(sum(new_sketches), 0)::integer, 
        coalesce(sum(new_data_sources), 0)::integer, 
        coalesce(sum(new_forum_posts), 0)::integer, 
        coalesce(sum(new_survey_responses), 0)::integer, 
        coalesce(sum(new_uploaded_layers), 0)::integer, 
        coalesce(sum(new_uploaded_bytes), 0)::bigint
      into stats
      from 
        project_activity
      where project_activity.project_id = p.id and 
      date >= now() - (
        case period
          when '24hrs' then '24 hours'::interval
          when '7-days' then '7 days'::interval
          when '30-days' then '30 days'::interval
          when '6-months' then '6 months'::interval
          when '1-year' then '1 year'::interval
          else '1 day'::interval
        end
      ) and
      (session_is_admin(p.id) or p.access_control = 'public');
      return stats;
    end;
  $$;

grant execute on function projects_activity to seasketch_user;
