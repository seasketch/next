--! Previous: sha1:57ccffc859fd53e1be83dad0f1d7c548d0d63987
--! Hash: sha1:b902a63dcd37833df44fe36cc671ecfcffbc3587

-- Enter migration here
CREATE OR REPLACE FUNCTION public.projects_url(p public.projects) RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT
    'https://next.seasket.ch/' || p.slug || '/'
$$;
