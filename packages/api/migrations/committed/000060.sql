--! Previous: sha1:1898f28347ea9857039099dc7d87fdd6bca296d1
--! Hash: sha1:8903611b0533033c5c45800339c9ff8e7fd3c712

-- Enter migration here
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
grant select(created_at) on table projects to anon;
