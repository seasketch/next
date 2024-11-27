--! Previous: sha1:980c0780e88309cb10a2ade13561e53ff0f6d482
--! Hash: sha1:e697656842a7b30ad925e95f11e70f0620739495

-- Enter migration here
drop function if exists create_api_key;
drop table if exists api_keys;
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  project_id int not null references projects(id) on delete cascade,
  created_by int not null references users(id) on delete cascade,
  is_revoked boolean not null default false,
  created_at timestamp with time zone not null default now(),
  last_used_at timestamp with time zone,
  expires_at timestamp with time zone
);

CREATE OR REPLACE FUNCTION enforce_api_key_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- Check the count of existing API keys for the project
  IF (
    SELECT COUNT(*)
    FROM api_keys
    WHERE project_id = NEW.project_id AND is_revoked = false AND (
      expires_at IS NULL OR expires_at > now()
    )
  ) >= 4 THEN
    RAISE EXCEPTION 'Project % already has the maximum number of active API keys', NEW.project_id;
  END IF;

  RETURN NEW; -- Allow the insert if the condition is not met
END;
$$ LANGUAGE plpgsql;


Drop TRIGGER IF EXISTS limit_api_keys_per_project ON api_keys;
CREATE TRIGGER limit_api_keys_per_project
BEFORE INSERT ON api_keys
FOR EACH ROW
EXECUTE FUNCTION enforce_api_key_limit();

create or replace function enforce_api_keys_admin_required()
returns trigger 
language plpgsql
as $$
BEGIN
  IF NOT (is_admin(NEW.project_id, NEW.created_by)) THEN
    RAISE EXCEPTION 'Only admins can create API keys';
  END IF;
  RETURN NEW;
END;
$$;

drop trigger if exists require_admin_on_api_key on api_keys;
create trigger require_admin_on_api_key
before insert on api_keys
for each row
execute function enforce_api_keys_admin_required();


comment on table api_keys is '@omit create,update,delete';

drop function if exists create_api_key;
create or replace function create_api_key(
  _project_id int,
  _label text,
  _created_by int,
  _expires_at timestamp with time zone
) 
  returns api_keys 
  language sql
  as $$
    insert into api_keys (project_id, label, created_by, expires_at)
    values (
      _project_id, 
      _label, 
       _created_by, 
      _expires_at
    )
    returning *;
  $$;

comment on function create_api_key is '@omit';

grant select on api_keys to seasketch_user;
grant insert on api_keys to seasketch_user;
alter table api_keys enable row level security;
create policy select_api_keys on api_keys for select using (session_is_admin(project_id));
create policy insert_api_keys on api_keys for insert with check (session_is_admin(project_id));

create or replace function revoke_api_key(id uuid)
  returns void
  language plpgsql
  security definer
  as $$
    BEGIN
      if not session_is_admin((select project_id from api_keys where api_keys.id = revoke_api_key.id)) then
        raise exception 'permission denied';
      end if;
      update api_keys set is_revoked = true where api_keys.id = revoke_api_key.id;
    end;
  $$;

grant execute on function revoke_api_key(uuid) to seasketch_user;

-- Checks if is_revoked is false and expires_at is in the future,
-- and if so, updates last_used_at to now()
create or replace function is_api_key_in_good_standing(id uuid)
  returns boolean
  language plpgsql
  as $$
    declare
      is_good boolean;
    begin
      select 
        not is_revoked and (expires_at is null or expires_at > now())
      into is_good
      from api_keys
      where api_keys.id = is_api_key_in_good_standing.id;
      if is_good then
        update api_keys set last_used_at = now() where api_keys.id = is_api_key_in_good_standing.id;
      end if;
      return is_good;
    end;
  $$;

create index api_keys_project_idx on api_keys (project_id);

create index api_keys_creator_idx on api_keys (created_by);
