--! Previous: sha1:e61f7322d81359c2b8898c30417a164e063fe671
--! Hash: sha1:8ceecc5a99e90f875719ba4cab503278fe914e1b

comment on column surveys.is_disabled is '
Disabled surveys will not be accessible to non-admins. Invite email sending will
be paused.
';

comment on column surveys.access_type is '
PUBLIC or INVITE_ONLY
';

comment on column surveys.show_social_media_buttons is '
Only applicable for public surveys. Show tools to respondants for sharing the 
survey on social media to encourage responses.
';

comment on column surveys.start_button_text is '
Usually the survey will show a button that says [Begin Survey]. This can be 
customized by admins.
';

alter table survey_invites drop column if exists user_id;
alter table survey_invites add column user_id integer references users(id);


drop type if exists email_summary_frequency cascade;
create type email_summary_frequency as enum (
  'NEVER',
  'WEEKLY',
  'DAILY'
);

drop table if exists email_notification_preferences;
create table email_notification_preferences (
  user_id int not null unique references users(id) on delete cascade,
  unsubscribe_all boolean not null default false,
  frequency email_summary_frequency not null default 'WEEKLY',
  notify_on_reply boolean not null default true
);

comment on column email_notification_preferences.unsubscribe_all is '
If selected, users should receive absolutely no email from SeaSketch. Invite 
emails should not be sent and their status should be set to UNSUBSCRIBED.
';

comment on column email_notification_preferences.frequency is '
How often users should be notified of SeaSketch project activity.
';

comment on column email_notification_preferences.notify_on_reply is '
If set, users should receive realtime notifications of responses to discussion
forum threads for which they are a participant.
';

comment on table email_notification_preferences is '
Email notification preferences can be read and set by the current user session.
These settings cannot be accessed by other users or SeaSketch project admins.
';

create index on email_notification_preferences (user_id);

-- Trigger to create on user addition

create or replace function on_user_insert_create_notification_preferences ()
  returns trigger
  language plpgsql
  as $$
    BEGIN
      insert into email_notification_preferences (user_id) values (NEW.id);
      return NEW;
    END;
$$;

drop trigger if exists trig_auto_create_notification_preferences on users;
CREATE TRIGGER trig_auto_create_notification_preferences AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION on_user_insert_create_notification_preferences();


-- RLS
GRANT select on email_notification_preferences to seasketch_user;
GRANT update on email_notification_preferences to seasketch_user;
alter table email_notification_preferences enable row level security;

create policy email_notification_preferences_owner 
  on email_notification_preferences 
  for all 
  to seasketch_user using (
    it_me(user_id)
  ) with check (
    it_me(user_id)
  );


create or replace function unsubscribed("userId" int)
  returns boolean
  security definer
  language sql
  as $$
    select exists(select 1 from email_notification_preferences where user_id = "userId" and unsubscribe_all = true)
$$;

grant execute on function unsubscribed to graphile;
comment on function unsubscribed is '@omit';

alter type email_status add value 'UNSUBSCRIBED';

alter type invite_status add value 'UNSUBSCRIBED';

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
    if NEW.survey_invite_id is not null then
      NEW.to_address = (select email from survey_invites where id = NEW.survey_invite_id);
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
        (status = 'QUEUED' or status = 'SENT') and
        (token_expires_at is null or now() < token_expires_at)
      ) then
        return NULL;
      end if;
    end if;
    if NEW.survey_invite_id is not null then
      if exists (
        select 1 from invite_emails where 
        survey_invite_id = new.survey_invite_id and
        (status = 'QUEUED' or status = 'SENT') and
        (token_expires_at is null or now() < token_expires_at)
      ) then
        return NULL;
      end if;
    end if;
    return new;
  end;
$$;


--
-- Name: before_invite_emails_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.before_invite_emails_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  begin
    if (NEW.status != 'QUEUED' and NEW.status != 'UNSUBSCRIBED') and (NEW.token is null or NEW.token_expires_at is null) then
      raise exception 'token and token_expires_at must be set on invite_emails unless status = "QUEUED" or "UNSUBSCRIBED"';
    end if;
    return new;
  end;
$$;
