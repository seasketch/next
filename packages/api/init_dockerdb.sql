-- Create user that graphile can use that can only assume safe roles
CREATE USER graphile WITH PASSWORD 'password';

CREATE USER graphile_migrate WITH PASSWORD 'password';

CREATE DATABASE seasketch OWNER graphile_migrate;
CREATE DATABASE seasketch_shadow OWNER graphile_migrate;

alter user graphile_migrate with superuser createrole;

-- GRANT CONNECT ON seasketch TO graphile;
