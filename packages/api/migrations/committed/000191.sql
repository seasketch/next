--! Previous: sha1:ce3bc28dd2d213d5cb86da35ac7b3d30d81f3bb0
--! Hash: sha1:8857761d763e890f92911797f876edd8ef6b7301

-- Enter migration here
CREATE OR REPLACE FUNCTION slugify("value" TEXT, "allow_unicode" BOOLEAN)
RETURNS TEXT AS $$

  WITH "normalized" AS (
    SELECT CASE
      WHEN "allow_unicode" THEN "value"
      ELSE unaccent("value")
    END AS "value"
  )
  SELECT regexp_replace(
    trim(
      lower(
        regexp_replace(
          "value",
          E'[^\\w\\s-]',
          '',
          'gi'
        )
      )
    ),
    E'[-\\s]+', '_', 'gi'
  ) FROM "normalized";

$$ LANGUAGE SQL STRICT IMMUTABLE;

CREATE OR REPLACE FUNCTION slugify(TEXT)
RETURNS TEXT AS 'SELECT slugify($1, false)' LANGUAGE SQL IMMUTABLE STRICT;

drop function if exists collect_text_from_prosemirror_body(jsonb, text);
create or replace function collect_text_from_prosemirror_body(body jsonb)
  returns text
  language plpgsql
  immutable
  as $$
    declare
      output text;
      i jsonb;
    begin
      output = '';
      if body ? 'text' then
        output = concat(output, body->>'text');
      end if;
      if body ? 'content' then
        for i in (select * from jsonb_array_elements((body->'content')))
        loop
          if length(output) > 32 then
            return output;
          else
            output = concat(output, collect_text_from_prosemirror_body(i));
          end if;
        end loop;
      end if;
      return output;
    end;
  $$;


create or replace function generate_export_id(id int, export_id text, body jsonb)
  returns text
  language plpgsql
  immutable
  as $$
    declare
      collected_text text;
    begin
      if export_id is null then
        return concat('form_element_', id::text);
      end if;
      collected_text = collect_text_from_prosemirror_body(body);
      if length(collected_text) < 2 then
        return concat('form_element_', id::text);
      end if;
      return substring(slugify(collected_text), 0, 32);
    end;
  $$;

alter table form_elements add column if not exists generated_export_id text not null generated always as (generate_export_id(id, export_id, body)) stored;
