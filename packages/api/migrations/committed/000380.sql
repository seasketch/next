--! Previous: sha1:cb9d2784cb5be99f152243e5d33fd7ef8ebfb27b
--! Hash: sha1:121dca3205af573a2af6eb41606efe0ac77db537

-- Enter migration here
alter table report_cards add column if not exists collapsible_footer_enabled boolean not null default false;
alter table report_cards add column if not exists collapsible_footer_body jsonb not null default '{ "type": "doc", "content": [{"type": "footerTitle", "content": [{"text": "Learn More", "type": "text"}]},{"type": "paragraph", "content": [{"text": "Describe your data sources and purpose here.", "type": "text"}] }]}'::jsonb;

drop function if exists update_report_card;

CREATE FUNCTION public.update_report_card(card_id integer, component_settings jsonb, body jsonb, alternate_language_settings jsonb, tint text, icon text, card_type text, collapsible_footer_enabled boolean, collapsible_footer_body jsonb) RETURNS public.report_cards
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      updated_card report_cards;
      tab_id int;
    begin
      select report_tab_id from report_cards where id = card_id into tab_id;
      if session_is_admin((select project_id from reports where id = (select report_id from report_tabs where id = tab_id))) then
        update report_cards set component_settings = update_report_card.component_settings, body = update_report_card.body, alternate_language_settings = update_report_card.alternate_language_settings, tint = update_report_card.tint, icon = update_report_card.icon, type = update_report_card.card_type, collapsible_footer_enabled = update_report_card.collapsible_footer_enabled, collapsible_footer_body = update_report_card.collapsible_footer_body where id = update_report_card.card_id returning * into updated_card;
        return updated_card;
      else
        raise exception 'You are not authorized to update this card';
      end if;
    end;
  $$;


grant execute on function update_report_card to seasketch_user;
