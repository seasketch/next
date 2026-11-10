--! Previous: sha1:177f716da2b293473b71e9bd4b3a6b3601b81235
--! Hash: sha1:908d2a135d675dcb27cfb70eeaa6143dc135bbc2
--! Message: list project draft reports

-- Draft reports for a project, including reports that are not assigned to a
-- sketch class. Published copies (draft_id set) are omitted so authors copy
-- from the report being edited, not from a published snapshot.
-- reports_select also allows anyone with project access, so this function
-- checks admin itself.

create or replace function public.projects_draft_reports(p public.projects)
returns setof public.reports
language sql
stable
as $$
  select r.*
  from public.reports r
  where public.session_is_admin(p.id)
    and r.project_id = p.id
    and r.draft_id is null
  order by lower(r.title), r.id;
$$;

revoke all on function public.projects_draft_reports(public.projects) from public;
grant execute on function public.projects_draft_reports(public.projects) to seasketch_user;
grant execute on function public.projects_draft_reports(public.projects) to seasketch_superuser;

comment on function public.projects_draft_reports(public.projects) is '@simpleCollections only
Draft reports for this project, including reports that are not assigned to a sketch class. Published versions are omitted. Admins only.';
