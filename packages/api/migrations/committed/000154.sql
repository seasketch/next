--! Previous: sha1:61e5b9e753983b6b2acff217ce688bf2e9f244c2
--! Hash: sha1:ab573def4bf856394ae7ea64b9cab0f5cfd677a0

-- Enter migration here

drop function if exists project_public_details();
drop function if exists current_project_public_details();

CREATE OR REPLACE FUNCTION public.project_public_details(slug text) RETURNS public.public_project_details
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    id,
    name,
    slug,
    logo_url,
    access_control,
    support_email,
    project_access_status(id) as access_status
  FROM
    projects
  WHERE
    projects.slug = project_public_details.slug
$$;
