--! Previous: sha1:112a8e56f9180201a9403c1aee3361faf1cc5468
--! Hash: sha1:e86cb171e7655e8bc908482255091c60e98f4031
--! Message: dedicated-api-key-signing-keys

-- Enter migration here
create table if not exists api_key_signing_keys (
  kid uuid primary key default gen_random_uuid(),
  public_pem text not null,
  private_pem text,
  created_at timestamp with time zone not null default now(),
  retired_at timestamp with time zone
);

create unique index if not exists api_key_signing_keys_active_idx
  on api_key_signing_keys ((true))
  where private_pem is not null;

comment on table api_key_signing_keys is '
@omit
Dedicated RS256 signing keys for project API keys, separate from jwks.
Keys do not expire or rotate on a schedule; rotating clears private_pem
and retains public_pem so existing API keys continue to verify.
';

grant all on api_key_signing_keys to graphile;

-- Legacy API keys were signed with the rotating jwks table and can no longer
-- verify. Mark pre-existing unrevoked keys as revoked on deploy so the admin UI
-- reflects their state and they no longer count toward the 4-key project limit.
update api_keys
set is_revoked = true
where not is_revoked
  and not exists (select 1 from api_key_signing_keys);
