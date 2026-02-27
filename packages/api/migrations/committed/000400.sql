--! Previous: sha1:0d8e1d2b60b7ca54e574687c87c3ad091698e8c4
--! Hash: sha1:13f13ae7f024472ca06cb45a2182284b8584dd58

CREATE OR REPLACE FUNCTION public.get_spatial_metric(metric_id bigint) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
  declare
    policy_passed boolean;
    subj_geography_id integer;
    subj_fragment_id text;
    metric_row spatial_metrics;
  begin
    select * into metric_row
    from spatial_metrics
    where id = metric_id;
    
    if not found then
      return null;
    end if;
    

    RAISE NOTICE 'metric_row: %', metric_row;
    if current_user not in ('graphile_worker', 'postgres') then
      if metric_row.subject_geography_id is not null then
        if not session_has_project_access((select project_id from project_geography where id = metric_row.subject_geography_id limit 1)) then
          RAISE NOTICE 'Permission denied for geography %', metric_row.subject_geography_id;
          raise exception 'Permission denied';
        end if;
      else
        policy_passed := check_sketch_rls_policy((select sketch_id from sketch_fragments where fragment_hash = metric_row.subject_fragment_id limit 1));
        if not policy_passed then
          raise exception 'Permission denied';
        end if;
      end if;
    end if;
    
    return spatial_metric_to_json(metric_row);
  end;
  $$;
