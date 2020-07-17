--! Previous: -
--! Hash: sha1:e72e8d4d74c4bf4a81f37ba0fa4cde6833541002

DO $$
BEGIN
  CREATE ROLE anon;
EXCEPTION
  WHEN DUPLICATE_OBJECT THEN
    RAISE NOTICE 'not creating role anon -- it already exists';
END
$$;

DO $$
BEGIN
  CREATE ROLE seasketch_user;
EXCEPTION
  WHEN DUPLICATE_OBJECT THEN
    RAISE NOTICE 'not creating role seasketch_user -- it already exists';
END
$$;

DO $$
BEGIN
  CREATE ROLE seasketch_superuser;
EXCEPTION
  WHEN DUPLICATE_OBJECT THEN
    RAISE NOTICE 'not creating role seasketch_superuser -- it already exists';
END
$$;

GRANT anon, seasketch_user, seasketch_superuser TO postgres;

GRANT anon, seasketch_user, seasketch_superuser TO graphile;

GRANT anon, seasketch_user TO seasketch_superuser;

GRANT anon TO seasketch_user;
