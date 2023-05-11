--! Previous: sha1:b293512f8e5c129637bf907c3a7d1496d385164d
--! Hash: sha1:ab9c34acfe5ecf79d82f7037fa8480c6327c5a86

-- Enter migration here
drop function if exists create_form_logic_rule;

drop function if exists create_survey_jump_rule("formElementId" integer, "jumpToId" integer, command form_logic_command, operator field_rule_operator,
"subjectId" integer);
grant execute on function create_survey_jump_rule("formElementId" integer, "jumpToId" integer, "booleanOperator" form_logic_operator, operator field_rule_operator) to seasketch_user;

drop function if exists create_visibility_logic_rule;
-- Creates a new form_logic_rule and form_logic_condition for a given form_element_id
-- configured with default visibility logic where the subject is the previous FormElement
-- in the same form and the operator and value are something suitable for the subject
-- configuration
create or replace function create_visibility_logic_rule("formElementId" integer)
  returns form_logic_rules
  language plpgsql
  as $$
    declare
      logic_rule form_logic_rules;
      fid integer;
      subject form_elements;
      supported_opts field_rule_operator[];
      op public.field_rule_operator;
      min integer;
      max integer;
      default_value integer;
      options jsonb;
      val jsonb;
    begin
      select form_id into fid from form_elements where id = "formElementId";
      select 
        form_elements.*
      into 
        subject
      from 
        form_elements 
      inner join
        form_element_types 
      on 
        form_element_types.component_name = form_elements.type_id
      where
        id != "formElementId" and
        form_id = fid and
        position < (select position from form_elements where id = "formElementId") and
        form_element_types.is_input = true and 
        array_length(array_remove(form_element_types.supported_operators, 'is blank'), 1) > 0
      order by position desc
      limit 1;
      raise notice 'subject: %', subject;
      if subject is null then
        raise notice 'subject is null %', subject is null;
        select 
          form_elements.*
        into 
          subject
        from 
          form_elements 
        inner join
          form_element_types 
        on 
          form_element_types.component_name = form_elements.type_id
        where
          id != "formElementId" and
          form_id = fid and
          form_element_types.is_input = true and
          array_length(array_remove(form_element_types.supported_operators, 'is blank'), 1) > 0
        order by position desc
        limit 1;
      end if;
      if subject is null then
        raise exception 'Could not find a suitable field to control this field''s visibility';
      end if;
      raise notice 'subject: %', subject;
      -- insert into form_logic_rules (form_element_id, command, position) values ("formElementId", 'SHOW', 0) returning * into logic_rule;
      -- for subject, select an appropriate operator and value into op and val
      raise notice 'subject.type_id: %', subject.type_id;
      select
        array_remove(supported_operators, 'is blank')
      into 
        supported_opts
      from 
        form_element_types 
      where 
        form_element_types.component_name = subject.type_id;
      op = supported_opts[1];
      raise notice 'op: %', op;
      select (component_settings->>'min')::int as min, (component_settings->>'max')::int as max, (component_settings->>'defaultValue')::int as default_value from form_elements where id = subject.id into min, max, default_value;
      select component_settings->>'options' from form_elements where id = subject.id into options;
      raise notice 'min: %, max: %', min, max;
      raise notice 'options: %', options;
      if op = '<' or op = '>' then
        if max is not null then
          val = max;
        elsif min is not null then
          val = min;
        elsif default_value is not null then
          val = default_value;
        else
          val = 0;
        end if;
      else
        if options->0 is not null then
          if options->0->>'value' is not null then
            val = (options->0->'value');
          else
            val = (options->0->'label');
          end if;
        else
          if max is not null then
            val = max;
          elsif min is not null then
            val = min;
          elsif default_value is not null then
            val = default_value;
          end if;
        end if;
      end if;
      raise notice 'val: %', val;
      insert into form_logic_rules (form_element_id, command, position) values ("formElementId", 'SHOW', 0) returning * into logic_rule;
      insert into form_logic_conditions (rule_id, subject_id, operator, value) values (logic_rule.id, subject.id, op, val);
      return logic_rule;
    end;
  $$;

grant execute on function create_visibility_logic_rule to seasketch_user;
