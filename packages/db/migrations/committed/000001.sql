--! Previous: -
--! Hash: sha1:cfee84a7dfd615b554b60c60957ee1477d4f442a

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
  CREATE ROLE seasketch_admin;
EXCEPTION
  WHEN DUPLICATE_OBJECT THEN
    RAISE NOTICE 'not creating role seasketch_admin -- it already exists';
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

GRANT anon, seasketch_user, seasketch_superuser, seasketch_admin TO postgres;

GRANT anon, seasketch_user, seasketch_superuser, seasketch_admin TO graphile;

GRANT anon, seasketch_user, seasketch_admin TO seasketch_superuser;

GRANT anon, seasketch_user TO seasketch_admin;

GRANT anon TO seasketch_user;

