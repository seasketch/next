-- Create user that graphile can use that can only assume safe roles
CREATE USER graphile WITH PASSWORD 'password';

CREATE USER graphile_migrate WITH PASSWORD 'password';

CREATE DATABASE seasketch OWNER graphile_migrate;

GRANT ALL PRIVILEGES ON DATABASE seasketch TO graphile_migrate;

-- GRANT CONNECT ON seasketch TO graphile;
