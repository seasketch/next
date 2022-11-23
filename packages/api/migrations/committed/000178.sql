--! Previous: sha1:e30b288ff540e0832271bd94dbfa6b856535ad8b
--! Hash: sha1:abdf661a39e6a3968e11dcd711bd32c0865395cf

-- Enter migration here
alter table sketch_classes add column if not exists is_template boolean not null default false;
alter table sketch_classes add column if not exists template_description text;

create or replace function create_sketch_class_from_template("projectId" int, template_sketch_class_id int)
  returns sketch_classes
  language plpgsql
  security definer
  as $$
    declare 
      base sketch_classes;
    begin
      if session_is_admin("projectId") then
        select * into base from sketch_classes where id = template_sketch_class_id;
        if base is null then
          raise exception 'Sketch Class with id=% does not exist', template_sketch_class_id;
        end if;
        if base.is_template = false then
          raise exception 'Sketch Class with id=% is not a template', template_sketch_class_id;
        end if;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

grant execute on function create_sketch_class_from_template to seasketch_user;

create or replace function template_sketch_classes()
  returns setof sketch_classes
  security definer
  language sql
  stable
  as $$
    select * from sketch_classes where is_template = true;
  $$;

grant execute on function template_sketch_classes to seasketch_user;

comment on function template_sketch_classes is '
@simpleCollections only
List of template sketch classes such as "Marine Protected Area", "MPA Network", etc.
';

grant update (template_description) on sketch_classes to seasketch_user;
