--! Previous: sha1:13f13ae7f024472ca06cb45a2182284b8584dd58
--! Hash: sha1:cb7da76a18e46aa5e19cb205f356ce4eb1ea45c5

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
    

    if current_user not in ('graphile_worker', 'postgres', 'admin') then
      if metric_row.subject_geography_id is not null then
        if not session_has_project_access((select project_id from project_geography where id = metric_row.subject_geography_id limit 1)) then
          raise exception 'Permission denied for get_spatial_metric. User % is not allowed to access geography %', current_user, metric_row.subject_geography_id;
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
