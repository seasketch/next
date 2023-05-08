-- Enter migration here
CREATE OR REPLACE FUNCTION public.create_logic_rule("formElementId" integer, "jumpToId" integer, "command" public.form_logic_command, operator public.field_rule_operator, "subjectId" integer) RETURNS public.form_logic_rules
    LANGUAGE plpgsql
    AS $$
    declare
      logic_rule form_logic_rules;
    begin
      insert into form_logic_rules (form_element_id, command, position) values ("formElementId", "command", 0) returning * into logic_rule;
      insert into form_logic_conditions (rule_id, subject_id, operator) values (logic_rule.id, "subjectId", "operator");
      return logic_rule;
    end;
  $$;

grant execute on function create_logic_rule to seasketch_user;