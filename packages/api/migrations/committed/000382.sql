--! Previous: sha1:37a4fa6a9f38ae6654817c54a4c716d100708706
--! Hash: sha1:2d6321d59ed1cad7392b58f7ca9cc3c8840b8e00

-- Enter migration here
alter table report_cards add column if not exists display_map_layer_visibility_controls boolean not null default true;

drop function if exists update_report_card;
CREATE OR REPLACE FUNCTION public.update_report_card(card_id integer, component_settings jsonb, body jsonb, alternate_language_settings jsonb, tint text, icon text, card_type text, collapsible_footer_enabled boolean, collapsible_footer_body jsonb, display_map_layer_visibility_controls boolean) RETURNS public.report_cards
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      updated_card report_cards;
      tab_id int;
    begin
      select report_tab_id from report_cards where id = card_id into tab_id;
      if session_is_admin((select project_id from reports where id = (select report_id from report_tabs where id = tab_id))) then
        update report_cards set component_settings = update_report_card.component_settings, body = update_report_card.body, alternate_language_settings = update_report_card.alternate_language_settings, tint = update_report_card.tint, icon = update_report_card.icon, type = update_report_card.card_type, collapsible_footer_enabled = update_report_card.collapsible_footer_enabled, collapsible_footer_body = update_report_card.collapsible_footer_body, display_map_layer_visibility_controls = update_report_card.display_map_layer_visibility_controls where id = update_report_card.card_id returning * into updated_card;
        return updated_card;
      else
        raise exception 'You are not authorized to update this card';
      end if;
    end;
  $$;

grant execute on function update_report_card to seasketch_user;
