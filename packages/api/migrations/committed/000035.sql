--! Previous: sha1:8652a041adeb02197a07140441748010d0c23e77
--! Hash: sha1:29d90e32fdb447d6d4ec6b9ec5218a695ec792e9

-- Enter migration here
drop table if exists basemap_interactivity_settings;
alter table interactivity_settings add column if not exists layers text[];

comment on column interactivity_settings.layers is '
Used only for basemap interactivity settings. Optional list of layer ids that this setting applies to.
';
alter table basemaps add column if not exists interactivity_settings_id integer not null references interactivity_settings(id) on delete cascade;
comment on column basemaps.interactivity_settings_id is '
@omit create
';
CREATE or replace FUNCTION public.before_basemap_insert_create_interactivity_settings_func() RETURNS trigger
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

drop trigger if exists before_basemap_insert_create_interactivity_settings on basemaps;

CREATE TRIGGER before_basemap_insert_create_interactivity_settings BEFORE INSERT ON public.basemaps FOR EACH ROW EXECUTE FUNCTION public.before_basemap_insert_create_interactivity_settings_func();
CREATE INDEX ON basemaps (interactivity_settings_id);


drop policy if exists interactivity_settings_select on interactivity_settings;
create policy interactivity_settings_select on interactivity_settings using (
  session_has_project_access(
    coalesce((select project_id from data_layers where interactivity_settings_id = id), (select project_id from basemaps where interactivity_settings_id = id))
  )
);

drop policy if exists interactivity_settings_admin on interactivity_settings;
create policy interactivity_settings_admin on interactivity_settings using (
  session_is_admin(
    coalesce((select project_id from data_layers where interactivity_settings_id = id), (select project_id from basemaps where interactivity_settings_id = id))
  )
) with check (
  session_is_admin(
    coalesce((select project_id from data_layers where interactivity_settings_id = id), (select project_id from basemaps where interactivity_settings_id = id))
  )
);
