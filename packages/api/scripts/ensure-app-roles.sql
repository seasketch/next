-- Cluster roles created by migration 000001. A database dump does not include roles,
-- so restore has to create them before replaying grants.
DO $$
BEGIN
  CREATE ROLE anon;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE ROLE seasketch_user;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE ROLE seasketch_superuser;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

GRANT anon, seasketch_user, seasketch_superuser TO postgres;
GRANT anon, seasketch_user, seasketch_superuser TO graphile;
GRANT anon, seasketch_user TO seasketch_superuser;
GRANT anon TO seasketch_user;
