--! Previous: sha1:bc6ce8856de8253945dda006e8f1704396c80149
--! Hash: sha1:b89807a916c11b253f57bf81196798da001b67a5

-- Enter migration here
CREATE OR REPLACE FUNCTION public.before_invite_emails_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  begin
    if (NEW.status != 'QUEUED' and NEW.status != 'UNSUBSCRIBED') and (NEW.token is null or NEW.token_expires_at is null) then
      raise exception 'token and token_expires_at must be set on invite_emails unless status = "QUEUED" or "UNSUBSCRIBED". Was %', NEW.status;
    end if;
    -- assigning to_address
    if NEW.project_invite_id is not null then
      NEW.to_address = (select email from project_invites where id = NEW.project_invite_id);
    end if;

    -- check if user has compained in any other emails
    if exists (
      select 
        1
      from 
        invite_emails
      where
        to_address = NEW.to_address and
        status = 'COMPLAINT'
    ) then
      return NULL;
    end if;

    if NEW.project_invite_id is not null then
      if exists (
        select 1 from invite_emails 
        where project_invite_id = new.project_invite_id and
        status = 'QUEUED'
      ) then
        return NULL;
      end if;
    end if;
    if NEW.survey_invite_id is not null then
      if exists (
        select 1 from invite_emails where 
        survey_invite_id = new.survey_invite_id and
        status = 'QUEUED'
      ) then
        return NULL;
      end if;
    end if;
    return new;
  end;
$$;
