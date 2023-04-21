--! Previous: sha1:7a611205578c22e9e2b339cc3fd01626c29efa15
--! Hash: sha1:0ead82003f7ee6c0c596ec297611e7755bf70ff4

-- Enter migration here
CREATE OR REPLACE FUNCTION public.projects_url(p public.projects) RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT
    'https://www.seasketch.org/' || p.slug || '/'
$$;
