--! Previous: sha1:2333ed9fff52a9fd530cbafcc8a7587b6c503b42
--! Hash: sha1:2a911af9cfb7fa75e232790171a67e59b722a836

-- Enter migration here
alter table form_logic_conditions alter column value drop not null;


create or replace function create_survey_jump_rule("formElementId" int, "jumpToId" int, "booleanOperator" form_logic_operator, "operator" field_rule_operator)
  returns form_logic_rules
  language plpgsql
  as $$
    declare
      logic_rule form_logic_rules;
    begin
      insert into form_logic_rules (form_element_id, boolean_operator, command, jump_to_id) values ("formElementId", 'OR', 'JUMP', "jumpToId") returning * into logic_rule;
      insert into form_logic_conditions (rule_id, subject_id, operator) values (logic_rule.id, "formElementId", "operator");
      return logic_rule;
    end;
  $$;

grant execute on function create_survey_jump_rule to seasketch_user;

comment on function create_survey_jump_rule is '
Initializes a new FormLogicRule with a single condition and command=JUMP.
';

alter table form_elements add column if not exists jump_to_id int references form_elements(id) on delete set null;

comment on column form_elements.jump_to_id is '
Used only in surveys. If set, the survey will advance to the page of the specified form element. If null, the survey will simply advance to the next question in the list by `position`.
';

grant all on form_elements to seasketch_user;

-- TODO: add post-delete rule to cleanup logic_rules that are empty
