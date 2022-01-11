-- Enter migration here
alter table form_elements add column if not exists subordinant_to int references form_elements (id) on delete cascade;
comment on column form_elements.subordinant_to is 'Subordinant forms work only in survey forms. With these, special Form Elements like SpatialAccessPriority can specify questions to be asked dependent upon answers to another question. The "parent" FormElement that an element is subordinate to is fully responsible for rendering the given elements.';

