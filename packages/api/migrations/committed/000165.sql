--! Previous: sha1:63abb4a410f8258e1c707acce218e8c454470b84
--! Hash: sha1:881c20d63c5db55f950b11e6950518f343c33491

-- Enter migration here
drop function if exists surveys_responses_spatial_extent;
create or replace function surveys_responses_spatial_extent(survey surveys)
  returns text
  language plpgsql
  stable
  security definer
  as $$
    declare
      bbox text;
    begin
      if (session_is_admin(survey.project_id)) then
        select st_asgeojson(st_extent(user_geom)) into bbox from sketches where response_id in (
          select id from survey_responses where survey_id = survey.id
        );
        return bbox;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

grant execute on function surveys_responses_spatial_extent to seasketch_user;
