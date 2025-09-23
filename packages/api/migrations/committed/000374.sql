--! AllowInvalidHash
--! Previous: sha1:2ca2fd961964107591546ea8a56a3caae241ae1e
--! Hash: sha1:63c3f6742da551ee49d725c9437202a31531e0b4

-- Enter migration here

create or replace function search_projects(query text)
  returns setof projects
  language plpgsql
  stable
  security definer
  as $$
    declare
      visible_project_ids int[] = '{}';
      trimmed text;
      q tsquery;
      tokens text[];
    begin
      select coalesce(array_agg(id), '{}') into visible_project_ids from projects where session_has_project_access(id);
      trimmed := btrim(query);

      if trimmed is null or length(trimmed) < 3 then
        return;
      end if;

      -- Build a tsquery using the simple configuration with prefix matching for each token
      if position(' ' in trimmed) <= 0 then
        q := to_tsquery('simple', regexp_replace(trimmed, '[^[:alnum:]]', ' ', 'g') || ':*');
      else
        tokens := regexp_split_to_array(regexp_replace(trimmed, '[^[:alnum:]\s]+', ' ', 'g'), '\s+');
        q := to_tsquery(
          'simple',
          (
            select coalesce(
              array_to_string(
                ARRAY(
                  select (tok || ':*')
                  from unnest(tokens) as tok
                  where tok is not null and length(tok) > 0
                ),
                ' & '
              ),
              ''
            )
          )
        );
      end if;

      return query
      select p.*
      from projects p,
      lateral (
        select
          setweight(
            to_tsvector(
              'simple',
              coalesce(p.name, '') || ' ' || coalesce(
                (select array_to_string(array_agg(e.value->>'name'), ' ')
                 from jsonb_each(p.translated_props) e),
                ''
              )
            ), 'A'
          ) ||
          setweight(
            to_tsvector(
              'simple',
              coalesce(p.description, '') || ' ' || coalesce(
                (select array_to_string(array_agg(e2.value->>'description'), ' ')
                 from jsonb_each(p.translated_props) e2),
                ''
              )
            ), 'B'
          ) as doc
      ) d
      where p.id = any(visible_project_ids)
        and not p.is_deleted
        and d.doc @@ q
        and p.slug != 'superuser'
      order by ts_rank(d.doc, q) desc, p.id asc;
    end;
  $$;

  grant execute on function search_projects to anon;
  comment on function search_projects is '@simpleCollections only';


create or replace function projects_center_geojson(project projects)
  returns json
  language sql
  stable
  security definer
  as $$
  select ST_AsGeoJSON(ST_Centroid(region))::json from projects where id = project.id;
  $$;

grant execute on function projects_center_geojson to anon;
