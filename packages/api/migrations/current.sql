-- Enter migration here
drop policy if exists reports_admin on reports;
drop policy if exists reports_select on reports;
drop table if exists reports cascade;
drop table if exists report_cards cascade;
drop table if exists report_tabs cascade;

create table if not exists reports (
  id int generated always as identity primary key,
  project_id int not null references projects(id) on delete cascade,
  sketch_class_id int not null references sketch_classes(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists reports_sketch_class_id_idx on reports (sketch_class_id);

alter table sketch_classes drop column if exists draft_report_id;
alter table sketch_classes add column if not exists draft_report_id int references reports(id) on delete set null;

drop function if exists sketch_classes_draft_report;
-- Alternative: Create a computed field function
create or replace function sketch_classes_draft_report(sc sketch_classes)
  returns reports
  language sql
  stable
  security definer
  as $$
    select * from reports where id = sc.draft_report_id limit 1;
  $$;

grant execute on function sketch_classes_draft_report to anon;

alter table reports enable row level security;

create policy reports_admin on reports for all using (
  session_is_admin((select project_id from sketch_classes where sketch_classes.id = sketch_class_id))
) with check (
  session_is_admin((select project_id from sketch_classes where sketch_classes.id = sketch_class_id))
);

create policy reports_select on reports for select using (
  session_on_acl((select id from access_control_lists where access_control_lists.sketch_class_id = sketch_class_id))
);

grant select on reports to anon;
grant all on reports to seasketch_user;

create table if not exists report_tabs (
  id int generated always as identity primary key,
  report_id int not null references reports(id) on delete cascade,
  title text not null,
  position int not null,
  alternate_language_settings jsonb not null default '{}'
);

create index if not exists report_tabs_report_id_idx on report_tabs (report_id);

create or replace function reports_tabs(report reports)
  returns setof report_tabs
  language sql
  stable
  security definer
  as $$
    select * from report_tabs where report_id = report.id order by position asc;
  $$;

grant execute on function reports_tabs to anon;

comment on function reports_tabs is '@simpleCollections only';

create table if not exists report_cards (
  id int generated always as identity primary key,
  report_tab_id int not null references report_tabs(id) on delete cascade,
  title text not null,
  body jsonb not null default '{}',
  position int not null,
  alternate_language_settings jsonb not null default '{}',
  component_settings jsonb not null default '{}',
  type text not null,
  tint text,
  icon text
);

create index if not exists report_cards_report_tab_id_idx on report_cards (report_tab_id);

create or replace function report_tabs_cards(report_tab report_tabs)
  returns setof report_cards
  language sql
  stable
  security definer
  as $$
    select * from report_cards where report_tab_id = report_tab.id order by position asc;
  $$;

grant execute on function report_tabs_cards to anon;

comment on function report_tabs_cards is '@simpleCollections only';

create or replace function create_draft_report(sketch_class_id int)
  returns reports
  language plpgsql
  security definer
  as $$
    declare
      dr_report_id int;
      dr_report_tab_id int;
      pid int;
      report reports;
    begin
      select (select project_id into pid from sketch_classes where sketch_classes.id = sketch_class_id limit 1);
      if session_is_admin(pid) then
        if ((select draft_report_id from sketch_classes where id = sketch_class_id)) is not null then
          raise exception 'A draft report already exists for this sketch class';
        end if;
        insert into reports (
          project_id, 
          sketch_class_id
        ) values (
          pid,
          create_draft_report.sketch_class_id
        ) returning * into report;
        insert into report_tabs (
          report_id,
          title,
          position
        ) values (
          report.id,
          'Attributes',
          0
        ) returning id into dr_report_tab_id;
        insert into report_cards (
          report_tab_id,
          title,
          body,
          position,
          alternate_language_settings,
          component_settings,
          type
        ) values (
          dr_report_tab_id,
          'Attributes',
          '{}',
          0,
          '{}',
          '{}',
          'Attributes'
        );
        -- raise exception 'report id: %, sketch class id: %, report %', report.id, sketch_class_id, report;
        update sketch_classes set draft_report_id = report.id where sketch_classes.id = create_draft_report.sketch_class_id;
        return report;
      else
        raise exception 'You are not authorized to create a draft report for this sketch class';
      end if;
    end;
  $$;

grant execute on function create_draft_report to seasketch_user;

create or replace function add_report_tab(report_id int, title text, tab_position int)
  returns report_tabs
  language plpgsql
  security definer
  as $$
    declare
      new_tab report_tabs;
    begin
      if session_is_admin((select project_id from reports where id = report_id)) then
        insert into report_tabs (report_id, title, position) values (report_id, title, tab_position) returning * into new_tab;
        return new_tab;
      else
        raise exception 'You are not authorized to add a tab to this report';
      end if;
    end;
  $$;

grant execute on function add_report_tab to seasketch_user;

drop function if exists delete_report_tab;
create or replace function delete_report_tab(tab_id int, move_cards_to_tab_id int)
  returns boolean
  language plpgsql
  security definer
  as $$
    declare
      tab_to_delete report_tabs;
    begin
      if session_is_admin((select project_id from reports where id = (select report_id from report_tabs where id = tab_id))) then
        select * from report_tabs where id = tab_id into tab_to_delete;
        if move_cards_to_tab_id is not null then
          -- increment the postion of related cards by the max position of that
          -- cards in the tab to move to
          update report_cards set position = position + (select max(position) from report_cards where report_tab_id = move_cards_to_tab_id) where report_tab_id = tab_id;
          -- move the cards to the new tab
          update report_cards set report_tab_id = move_cards_to_tab_id where report_tab_id = tab_id;
        end if;
        -- delete the tab. If cards are still remaining, they will be deleted by
        -- cascade
        delete from report_tabs where id = tab_id;
      else
        raise exception 'You are not authorized to delete this tab';
      end if;
      return true;
    end;
  $$;

grant execute on function delete_report_tab to seasketch_user;

create or replace function rename_report_tab(tab_id int, title text)
  returns report_tabs
  language plpgsql
  security definer
  as $$
    declare
      tab_to_rename report_tabs;
    begin
      if session_is_admin((select project_id from reports where id = (select report_id from report_tabs where id = tab_id))) then
        update report_tabs set title = rename_report_tab.title where id = tab_id returning * into tab_to_rename;
        return tab_to_rename;
      else
        raise exception 'You are not authorized to rename this tab';
      end if;
    end;
  $$;

grant execute on function rename_report_tab to seasketch_user;

create or replace function reorder_report_tabs(report_id int, tab_ids int[])
  returns setof report_tabs
  language plpgsql
  security definer
  as $$
    begin
      -- check auth
      if session_is_admin((select project_id from reports where id = report_id)) then
        -- check that all tab ids are valid
        if not exists (select 1 from report_tabs where id = any(tab_ids) and report_tabs.report_id = reorder_report_tabs.report_id) then
          raise exception 'Invalid tab ids';
        end if;
        -- reorder the tabs. Start at zero, and loop through the tab ids, 
        -- setting the position of the tab to the current index.
        for i in 0..array_length(tab_ids, 1) loop
          update report_tabs set position = i where id = tab_ids[i];
        end loop;
        -- return the tabs in the new order
        return query select * from report_tabs where id = any(tab_ids) order by position asc;
      else
        raise exception 'You are not authorized to reorder tabs for this report';
      end if;
    end;
  $$;

grant execute on function reorder_report_tabs to seasketch_user;