--! Previous: sha1:76561bb24c87c0391c8bd678ce2069f9a74ec834
--! Hash: sha1:7a611205578c22e9e2b339cc3fd01626c29efa15

-- Enter migration here
CREATE OR REPLACE FUNCTION public.projects_url(p public.projects) RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT
    'https://www.seasket.org/' || p.slug || '/'
$$;
