-- S-57 nautical chart basemaps (spike). ENC basemaps are public.
-- The new enum value is not used in this migration; inserts happen later,
-- after this statement has committed.

do $$ begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'basemap_type' and e.enumlabel = 'ENC'
  ) then
    alter type public.basemap_type add value 'ENC';
  end if;
end $$;

create table if not exists public.enc_basemaps (
  basemap_id integer primary key references public.basemaps(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  catalog jsonb not null default '[]'::jsonb,
  bounds real[],
  created_at timestamp with time zone not null default timezone('utc', now())
);

comment on table public.enc_basemaps is
  '@omit create,update,delete
Chart catalogue and display settings for an ENC basemap. Tiles are public in this spike.';

comment on column public.enc_basemaps.bounds is
  'West, south, east, north of the chart, in WGS84 degrees.';

create table if not exists public.enc_basemap_uploads (
  job_id uuid primary key references public.project_background_jobs(id) on delete cascade,
  project_id integer not null references public.projects(id),
  name text not null,
  object_keys text[] not null,
  basemap_id integer references public.basemaps(id),
  created_at timestamp with time zone not null default timezone('utc', now())
);

comment on table public.enc_basemap_uploads is '@omit';
-- Named constraints so the spike can omit the backward relations. The table
-- comment alone does not stop PostGraphile from building the row type.
do $$ begin
  if exists (
    select 1 from pg_constraint
    where conname = 'enc_basemap_uploads_basemap_id_fkey'
  ) then
    execute 'comment on constraint enc_basemap_uploads_basemap_id_fkey on public.enc_basemap_uploads is ''@omit''';
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'enc_basemap_uploads_project_id_fkey'
  ) then
    execute 'comment on constraint enc_basemap_uploads_project_id_fkey on public.enc_basemap_uploads is ''@omit''';
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'enc_basemap_uploads_job_id_fkey'
  ) then
    execute 'comment on constraint enc_basemap_uploads_job_id_fkey on public.enc_basemap_uploads is ''@omit''';
  end if;
end $$;

alter table public.enc_basemaps enable row level security;
drop policy if exists enc_basemaps_select on public.enc_basemaps;
create policy enc_basemaps_select on public.enc_basemaps
  for select using (
    exists (
      select 1 from public.basemaps b
      where b.id = enc_basemaps.basemap_id
        and public.session_has_project_access(b.project_id)
    )
  );

grant select on public.enc_basemaps to seasketch_user;
grant select on public.enc_basemaps to anon;
grant select on public.enc_basemap_uploads to seasketch_user;

alter table public.enc_basemap_uploads enable row level security;
drop policy if exists enc_basemap_uploads_select on public.enc_basemap_uploads;
create policy enc_basemap_uploads_select on public.enc_basemap_uploads
  for select using (session_is_admin(project_id));
