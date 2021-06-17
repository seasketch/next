--! Previous: sha1:d1f1bd29b992e094909a401667873b256d41c1bb
--! Hash: sha1:a085742433e5d26bb502ec591555fc44fe84b4b9

-- Enter migration here
create or replace function email_unsubscribed(email text)
  returns boolean
  language sql
  security definer
  as $$
    select case when exists (select
      users.canonical_email,
      email_notification_preferences.unsubscribe_all
    from
      users
    inner join
      email_notification_preferences
    on
      email_notification_preferences.user_id = users.id
    where
      canonical_email = email and
      email_notification_preferences.unsubscribe_all = true
    ) then true else false end;
  $$;

grant execute on function email_unsubscribed to anon;
comment on function email_unsubscribed is '@omit';


CREATE OR REPLACE FUNCTION public.confirm_project_invite(invite_id integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      userid int;
      project_invite project_invites;
    begin
      select current_setting('session.user_id')::int into userid;
      if userid is null then
        raise exception 'Not signed in';
      end if;
      if (select current_setting('session.escalate_privileges', true)) != 'on' then
        raise exception 'Permission denied';
      end if;
      if exists (select id from project_invites where id = invite_id and was_used = true) then
        raise exception 'Invite has already been used';
      end if;
      -- set was_used to true
      -- set user_id on project_invite
      update project_invites set user_id = userid, was_used = true where id = invite_id returning * into project_invite;
      if project_invite is null then
        raise exception 'Cannot find invite with id %', invite_id;
      end if;
      -- create project participant record, respecting make_admin setting
      insert into project_participants (
        user_id, 
        project_id, 
        is_admin, 
        approved,
        share_profile,
        requested_at
      ) values (
        userid,
        project_invite.project_id,
        project_invite.make_admin,
        true,
        false,
        now()
      ) on conflict on constraint project_participants_pkey
      do update
        set approved = true,
        is_admin = (project_participants.is_admin or project_invite.make_admin);
      -- add any group access permissions
      insert into project_group_members (group_id, user_id)
      select group_id, userid from 
        project_invite_groups
      where
        project_invite_groups.invite_id = project_invite.id
      on conflict do nothing;
      return userid;
    end;
  $$;

create or replace function account_exists(email text)
  returns boolean
  security definer
  language sql
  as $$
    select case when exists (select
      1
    from
      users
    where
      canonical_email = email) 
    then true else false end;
  $$;

comment on function account_exists is '@omit';
grant execute on function account_exists to anon;
