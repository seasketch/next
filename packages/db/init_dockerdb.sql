-- Create user that graphile can use that can only assume safe roles
CREATE USER graphile WITH PASSWORD 'password';

CREATE DATABASE seasketch;

GRANT CONNECT ON seasketch TO graphile;

