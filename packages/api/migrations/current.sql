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
          body,
          position,
          alternate_language_settings,
          component_settings,
          type
        ) values (
          dr_report_tab_id,
          '{"type": "doc", "content": [{"type": "reportTitle", "content": [{"type": "text", "text": "Attributes"}]}]}'::jsonb,
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
          update report_cards set position = position + (select coalesce(max(position), 0) from report_cards where report_tab_id = move_cards_to_tab_id) where report_tab_id = tab_id;
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

drop function if exists rename_report_tab;
create or replace function rename_report_tab(tab_id int, title text, alternate_language_settings jsonb)
  returns report_tabs
  language plpgsql
  security definer
  as $$
    declare
      tab_to_rename report_tabs;
    begin
      if session_is_admin((select project_id from reports where id = (select report_id from report_tabs where id = tab_id))) then
        update report_tabs set title = rename_report_tab.title, alternate_language_settings = rename_report_tab.alternate_language_settings where id = tab_id returning * into tab_to_rename;
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

drop function if exists add_report_card;
create or replace function add_report_card(report_tab_id int, component_settings jsonb, card_type text, body jsonb)
  returns report_cards
  language plpgsql
  security definer
  as $$
    declare
      new_card report_cards;
    begin
      if session_is_admin((select project_id from reports where id = (select report_id from report_tabs where id = add_report_card.report_tab_id))) then
        insert into report_cards (
          report_tab_id, 
          position, 
          component_settings, 
          type,
          body
        ) values (
          add_report_card.report_tab_id, 
          coalesce((select max(position) from report_cards where report_cards.report_tab_id = add_report_card.report_tab_id), 0) + 1,
          add_report_card.component_settings, 
          add_report_card.card_type,
          add_report_card.body
        ) returning * into new_card;
        return new_card;
      else
        raise exception 'You are not authorized to add a card to this report';
      end if;
    end;
  $$;

grant execute on function add_report_card to seasketch_user;

drop function if exists reorder_report_tab_cards;

create or replace function reorder_report_tab_cards(report_tab_id int, card_ids int[])
  returns setof report_cards
  language plpgsql
  security definer
  as $$
    begin
      -- check auth
      if session_is_admin((select project_id from reports where id = (select report_id from report_tabs where id = report_tab_id))) then
        -- check that all card ids are valid
        if not exists (select 1 from report_cards where id = any(card_ids) and report_cards.report_tab_id = reorder_report_tab_cards.report_tab_id) then
          raise exception 'Invalid card ids';
        end if;
        -- reorder the cards. Start at zero, and loop through the card ids, 
        -- setting the position of the card to the current index.
        for i in 0..array_length(card_ids, 1) loop
          update report_cards set position = i where id = card_ids[i];
        end loop;
        -- return the cards in the new order
        return query select * from report_cards where id = any(card_ids) order by position asc;
      else
        raise exception 'You are not authorized to reorder cards for this report';
      end if;
    end;
  $$;

grant execute on function reorder_report_tab_cards to seasketch_user;

create or replace function update_report_card(card_id int, component_settings jsonb, body jsonb, alternate_language_settings jsonb, tint text, icon text, card_type text)
  returns report_cards
  language plpgsql
  security definer
  as $$
    declare
      updated_card report_cards;
      tab_id int;
    begin
      select report_tab_id from report_cards where id = card_id into tab_id;
      if session_is_admin((select project_id from reports where id = (select report_id from report_tabs where id = tab_id))) then
        update report_cards set component_settings = update_report_card.component_settings, body = update_report_card.body, alternate_language_settings = update_report_card.alternate_language_settings, tint = update_report_card.tint, icon = update_report_card.icon, type = update_report_card.card_type where id = update_report_card.card_id returning * into updated_card;
        return updated_card;
      else
        raise exception 'You are not authorized to update this card';
      end if;
    end;
  $$;

grant execute on function update_report_card to seasketch_user;

create or replace function delete_report_card(card_id int)
  returns boolean
  language plpgsql
  security definer
  as $$
    begin
      if session_is_admin((select project_id from reports where id = (select report_id from report_tabs where id = (select report_tab_id from report_cards where id = card_id)))) then
        delete from report_cards where id = card_id;
        return true;
      else
        raise exception 'You are not authorized to delete this card';
      end if;
    end;
  $$;

grant execute on function delete_report_card to seasketch_user;

create or replace function move_card_to_tab(card_id int, tab_id int)
  returns report_cards
  language plpgsql
  security definer
  as $$
    declare
      moved_card report_cards;
      old_tab_id int;
      report_id int;
      new_tab_report_id int;
    begin
      -- Get the old tab id and report id
      select report_tab_id, (select report_tabs.report_id from report_tabs where id = report_tab_id)
      from report_cards 
      where id = card_id 
      into old_tab_id, report_id;

      -- Check if user is admin on the report
      if not session_is_admin((select project_id from reports where id = report_id)) then
        raise exception 'You are not authorized to move cards in this report';
      end if;

      -- Get the report id for the new tab
      select report_tabs.report_id from report_tabs where id = tab_id into new_tab_report_id;

      -- Check if new tab is in same report
      if report_id != new_tab_report_id then
        raise exception 'Cannot move card to tab in different report';
      end if;

      -- Move card to new tab and set position
      update report_cards 
      set 
        report_tab_id = tab_id,
        position = (select coalesce(min(position), 0) - 1 from report_cards where report_tab_id = tab_id)
      where id = card_id
      returning * into moved_card;

      return moved_card;
    end;
  $$;

grant execute on function move_card_to_tab to seasketch_user;

alter table sketch_classes add column if not exists report_id int references reports(id) on delete set null;

-- Add an updated_at column to report_tabs which is automatically updated upon any changes
alter table report_tabs add column if not exists updated_at timestamptz not null default now();

-- Trigger to update the updated_at column on report_tabs
create or replace function update_report_tabs_updated_at()
  returns trigger
  language plpgsql
  security definer
  as $$
    begin
      new.updated_at = now();
      return new;
    end;

  $$;

-- Create trigger to update the updated_at column
create trigger update_report_tabs_updated_at_trigger
  before update on report_tabs
  for each row
  execute function update_report_tabs_updated_at();

-- Add an updated_at column to report_cards which is automatically updated upon any changes
alter table report_cards add column if not exists updated_at timestamptz not null default now();

-- Trigger to update the updated_at column on report_cards
create or replace function update_report_cards_updated_at()
  returns trigger
  language plpgsql
  security definer
  as $$
    begin
      new.updated_at = now();
      return new;
    end;
  $$;

-- Create trigger to update the updated_at column
create trigger update_report_cards_updated_at_trigger
  before update on report_cards
  for each row
  execute function update_report_cards_updated_at();

-- Function to update report_tabs updated_at when report_cards change
create or replace function update_report_tabs_from_cards()
  returns trigger
  language plpgsql
  security definer
  as $$
    begin
      -- For INSERT operations
      if tg_op = 'INSERT' then
        update report_tabs set updated_at = now() where id = new.report_tab_id;
        return new;
      end if;
      
      -- For UPDATE operations
      if tg_op = 'UPDATE' then
        -- Update the old tab if report_tab_id changed
        if old.report_tab_id is distinct from new.report_tab_id then
          update report_tabs set updated_at = now() where id = old.report_tab_id;
        end if;
        -- Update the new tab (or same tab if no change)
        update report_tabs set updated_at = now() where id = new.report_tab_id;
        return new;
      end if;
      
      -- For DELETE operations
      if tg_op = 'DELETE' then
        update report_tabs set updated_at = now() where id = old.report_tab_id;
        return old;
      end if;
      
      return null;
    end;
  $$;

-- Create trigger to update report_tabs updated_at when report_cards change
create trigger update_report_tabs_from_cards_trigger
  after insert or update or delete on report_cards
  for each row
  execute function update_report_tabs_from_cards();

create or replace function reports_updated_at(r reports)
  returns timestamptz
  language sql
  security definer
  stable
  as $$
    select max(updated_at) from report_tabs where report_id = r.id;
  $$;

grant execute on function reports_updated_at to anon;

create or replace function publish_report(sketch_class_id int)
  returns sketch_classes
  language plpgsql
  security definer
  as $$
    declare
      published_sketch_class sketch_classes;
      new_report reports;
      draft_report_id int;
      project_id int;
      new_report_id int;
      new_tab_id int;
      old_report_id int;
    begin
      -- Note that this function copies many columns by name, much like the 
      -- data layers table of contents publishing function. Like it, we will
      -- need to update this function regularly as columns are added or removed.
      
      -- Get the draft report id and project id
      select sc.draft_report_id, sc.project_id 
      from sketch_classes sc 
      where sc.id = sketch_class_id 
      into draft_report_id, project_id;
      
      -- Check authorization
      if not session_is_admin(project_id) then
        raise exception 'You are not authorized to publish this report';
      end if;
      
      -- Check that there is an existing draft report
      if draft_report_id is null then
        raise exception 'No draft report exists for this sketch class';
      end if;
      
      -- Get the current published report id (if any)
      select sc.report_id from sketch_classes sc where sc.id = sketch_class_id into old_report_id;
      
      -- Create a new report by copying the draft report
      insert into reports (project_id, sketch_class_id)
      select reports.project_id, reports.sketch_class_id
      from reports 
      where id = draft_report_id
      returning * into new_report;
      
      new_report_id := new_report.id;
      
      -- Copy all report tabs from draft to new report
      for new_tab_id in 
        select rt.id 
        from report_tabs rt 
        where rt.report_id = draft_report_id 
        order by rt.position
      loop
        declare
          new_tab_id_copy int;
          old_tab_id int;
        begin
          old_tab_id := new_tab_id;
          
          -- Insert the tab and get the new tab id
          insert into report_tabs (report_id, title, position, alternate_language_settings, updated_at)
          select new_report_id, title, position, alternate_language_settings, updated_at
          from report_tabs 
          where id = old_tab_id
          returning id into new_tab_id_copy;
          
          -- Copy all cards for this tab
          insert into report_cards (report_tab_id, body, position, alternate_language_settings, component_settings, type, tint, icon, updated_at)
          select 
            new_tab_id_copy,
            rc.body, 
            rc.position, 
            rc.alternate_language_settings, 
            rc.component_settings, 
            rc.type, 
            rc.tint, 
            rc.icon,
            rc.updated_at
          from report_cards rc 
          where rc.report_tab_id = old_tab_id
          order by rc.position;
        end;
      end loop;
      
      -- Delete the current published report if it exists
      if old_report_id is not null then
        delete from reports where id = old_report_id;
      end if;
      
      -- Update sketch_class to point to the new published report
      update sketch_classes 
      set report_id = new_report_id 
      where id = sketch_class_id;
      
      -- Return the updated sketch class
      select * from sketch_classes where id = sketch_class_id into published_sketch_class;
      return published_sketch_class;
    end;
  $$;

grant execute on function publish_report to seasketch_user;

drop function if exists sketch_classes_report;

create or replace function sketch_classes_report(sc sketch_classes)
  returns reports
  language sql
  stable
  security definer
  as $$
    select * from reports where id = sc.report_id limit 1;
  $$;

grant execute on function sketch_classes_report to anon;

alter table report_cards drop column if exists title;