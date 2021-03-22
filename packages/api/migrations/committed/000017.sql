--! Previous: sha1:8ceecc5a99e90f875719ba4cab503278fe914e1b
--! Hash: sha1:a4428edc5143127a1d49a17157a772ed15c917a7

-- Enter migration here
alter table survey_invites alter column email drop not null;

create or replace function survey_invite_before_insert_trigger()
  returns trigger 
  language plpgsql
  volatile
  as $$
    begin
      if NEW.user_id is null and NEW.email is null then
        raise exception 'Must specific either user_id or email';
      end if;
      if NEW.user_id is not null and (NEW.email is not null or NEW.fullname is not null) then
        raise exception 'Invites created from group lists should not have an email or fullname';
      end if;
      if NEW.email is null and NEW.was_added_from_group = false then
        raise exception 'was_added_from_group should be true if email is blank';
      end if;
      return NEW;
    end;
  $$;

drop TRIGGER if exists survey_invites_before_insert on survey_invites;
CREATE TRIGGER survey_invites_before_insert
    BEFORE INSERT on survey_invites
    FOR EACH ROW 
    EXECUTE PROCEDURE survey_invite_before_insert_trigger();

create or replace function survey_invite_before_update_trigger()
  returns trigger 
  language plpgsql
  volatile
  as $$
    begin
      if NEW.user_id is null and NEW.email is null then
        raise exception 'Must specific either user_id or email';
      end if;
      if NEW.email is null and NEW.was_added_from_group = false then
        raise exception 'was_added_from_group should be true if email is blank';
      end if;
      return NEW;
    end;
  $$;

drop TRIGGER if exists survey_invites_before_update on survey_invites;
CREATE TRIGGER survey_invites_before_update
    BEFORE update on survey_invites
    FOR EACH ROW 
    EXECUTE PROCEDURE survey_invite_before_update_trigger();

drop domain if exists survey_invite_options cascade;
create domain survey_invite_options as project_invite_options;

alter table survey_invites drop constraint if exists email_unique;
alter table survey_invites add constraint email_unique unique (email);

CREATE or replace FUNCTION create_survey_invites("surveyId" integer, "includeProjectInvite" boolean, "makeAdmin" boolean,"groupNames" text[], "surveyInviteOptions" survey_invite_options[]) 
  RETURNS SETOF survey_invites
  LANGUAGE plpgsql 
  SECURITY DEFINER
  AS $$
  declare
    invite_ids int[];
    pid int;
  begin
    select project_id into pid from surveys where id = "surveyId";
    if (select session_is_admin(pid)) = false then
      raise exception 'Must be project administrator';
    end if;

    
    with ins as (
    insert into survey_invites (
      survey_id,
      email,
      fullname
    ) 
    select 
      "surveyId",
      email, 
      fullname 
    from 
      unnest("surveyInviteOptions")
    on conflict do nothing
    returning id
     ) select array_agg(id) into invite_ids from ins;

    if "includeProjectInvite" is true then
      perform create_project_invites(pid, false, "makeAdmin", "groupNames", "surveyInviteOptions");
    end if;
    return query select * from survey_invites where id = any(invite_ids);
  end;
$$;

grant execute on function create_survey_invites to seasketch_user;

revoke UPDATE(email) ON TABLE public.survey_invites from seasketch_user;

drop policy if exists surveys_invited_groups_admin on surveys;

revoke all on survey_invited_groups from anon;

create or replace function surveys_invited_groups(survey surveys)
  returns setof project_groups
  security definer
  language plpgsql
  stable
  as $$
    begin
      if session_is_admin(survey.project_id) = false then
        raise exception 'Must be project admin';
      end if;
      return query select 
        * 
      from 
        project_groups
      where
        id = any( select group_id from survey_invited_groups where survey_id = survey.id);
    end;
  $$;

grant execute on function surveys_invited_groups to seasketch_user;

comment on function surveys_invited_groups is '
@simpleCollections only
';

drop function if exists update_survey_invited_groups cascade;
create or replace function update_survey_invited_groups("surveyId" int, "groupIds" int[])
  returns setof project_groups
  security definer
  language plpgsql
  volatile
  as $$
    declare
      pid int;
    begin
      select project_id into pid from surveys where id = "surveyId";
      if session_is_admin(pid) = false then
        raise exception 'Must be project admin';
      end if;
      delete from survey_invited_groups where survey_id = "surveyId";
      insert into survey_invited_groups (survey_id, group_id) select "surveyId", id from project_groups where project_id = pid and id = any("groupIds");
      perform update_survey_group_invites("surveyId");
      return query select * from project_groups where id = any("groupIds");
    end;
  $$;

grant execute on function update_survey_invited_groups to seasketch_user;

comment on function update_survey_invited_groups is '
Updates the list of groups that should have access to the given survey. Users
in any added groups will get an invite, and the system will create an invite for
any users that are added to the group. When removing a group, the system will
delete invites for any user that is no longer in an invited group. *Clients
should warn admins of this behavior when removing groups for an active survey*.

The list of invited groups can be accessed via `Survey.invitedGroups`.
';

create or replace function update_survey_group_invites(surveyid int)
  returns void
  language plpgsql
  security definer
  volatile
  as $$
    begin
      -- delete group-related invites for users that do not belong to any of the groups
      delete from
        survey_invites
      where
        survey_invites.was_added_from_group = true and
        survey_invites.survey_id = surveyid and
        not exists (
          select 
            1 
          from 
            project_group_members 
          where
            project_group_members.user_id = survey_invites.user_id and
            project_group_members.group_id = any (
              select
                group_id
              from
                survey_invited_groups
              where
                survey_invited_groups.survey_id = surveyid
              
            )
        );
      -- find users in related groups who are lacking an invite and add them
      insert into survey_invites (
        user_id,
        survey_id,
        was_added_from_group
      ) select
        distinct user_id,
        surveyid,
        true
      from
        project_group_members
      where
        project_group_members.group_id = any (
          select
            group_id
          from
            survey_invited_groups
          where
            survey_invited_groups.survey_id = surveyid
        ) and not exists (
          select 1 from 
            survey_invites
          where
            survey_id = surveyid and
            user_id = project_group_members.user_id
        );
    end;
$$;

comment on function update_survey_group_invites is '
Not for use in graphql api. Is called by update functions and triggers related
to group membership and survey invited groups to update the list of invitations.
';

CREATE OR REPLACE FUNCTION add_user_to_group_update_survey_invites_trigger()
  RETURNS trigger 
  language plpgsql
  AS $$
BEGIN
  -- Add survey invites for any surveys that are part of this group that they don't already have
  insert into survey_invites (
    user_id,
    was_added_from_group,
    survey_id
  ) select
    NEW.user_id,
    true,
    survey_id
  from
    survey_invited_groups
  where
    survey_invited_groups.group_id = NEW.group_id and
    not exists (
      select
        1
      from
        survey_invites
      where
        survey_invites.was_added_from_group = true and 
        survey_invites.survey_id = survey_invited_groups.survey_id and
        survey_invites.user_id = NEW.user_id
    );
	RETURN NEW;
END;
$$;

drop trigger if exists after_add_user_to_group_update_survey_invites on project_group_members;
CREATE TRIGGER after_add_user_to_group_update_survey_invites
  AFTER INSERT
  ON project_group_members
  FOR EACH ROW
  EXECUTE PROCEDURE add_user_to_group_update_survey_invites_trigger();


CREATE OR REPLACE FUNCTION remove_user_from_group_update_survey_invites_trigger()
  RETURNS trigger 
  language plpgsql
  AS $$
BEGIN
  -- Remove survey invites where was_added_from_group but user is no longer in relevant groups
  with for_deletion as (
    select
      survey_invites.*
    from
      survey_invites
    inner join
      surveys
    on
      surveys.id = survey_invites.survey_id
    where
      survey_invites.user_id = OLD.user_id and
      was_added_from_group = true and
      surveys.project_id = (
        select
          project_id
        from
          project_groups
        where
          project_groups.id = OLD.group_id
        limit 1
      ) and 
      -- user isn't in any acceptible group
      not exists (
        select 1 from
          survey_invited_groups
        where
          survey_invited_groups.group_id = any (select group_id from project_group_members where user_id = OLD.user_id) and
          survey_invited_groups.survey_id = survey_invites.survey_id
      )
  )
  delete from
    survey_invites
  where
    survey_invites.id in (select id from for_deletion);
	RETURN OLD;
END;
$$;

drop trigger if exists after_remove_user_from_group_update_survey_invites on project_group_members;
CREATE TRIGGER after_remove_user_from_group_update_survey_invites
  AFTER DELETE
  ON project_group_members
  FOR EACH ROW
  EXECUTE PROCEDURE remove_user_from_group_update_survey_invites_trigger();


alter table invite_emails
drop constraint invite_emails_project_invite_id_fkey;

alter table invite_emails
drop constraint invite_emails_survey_invite_id_fkey;

alter table invite_emails
add constraint invite_emails_project_invite_id_fkey
foreign key (project_invite_id)
references project_invites (id)
on delete cascade;

alter table invite_emails
add constraint invite_emails_survey_invite_id_fkey
foreign key (survey_invite_id)
references survey_invites (id)
on delete cascade;

COMMENT ON CONSTRAINT invite_emails_project_invite_id_fkey ON public.invite_emails IS '@simpleCollections only';

drop policy if exists invite_emails_admin on invite_emails;

CREATE POLICY invite_emails_admin ON public.invite_emails FOR SELECT TO seasketch_user USING (
  session_is_admin((select project_id from project_invites where id = project_invite_id)) or
  session_is_admin((
    select 
      surveys.project_id       
    from 
      survey_invites 
    inner join
      surveys
    on
      surveys.id = survey_invites.survey_id
    where 
      survey_invites.id = survey_invite_id
  ))
);

create or replace function survey_invites_status(invite survey_invites) RETURNS
    invite_status
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      email_status invite_status;
      expired boolean;
      has_complaint boolean;
      has_responded boolean;
    begin
      select exists(select 1 from invite_emails where to_address = invite.email and status = 'COMPLAINT') into has_complaint;
      select exists(select 1 from survey_responses where user_id = invite.user_id and survey_id = invite.survey_id) into has_responded;
      if invite.was_used = true or has_responded = true then 
        return 'CONFIRMED';
      end if;
      if has_complaint then
        return 'COMPLAINT';
      else
        select
          now() > token_expires_at as expired,
          status
        into
          expired,
          email_status
        from
          invite_emails
        where
          survey_invite_id = invite.id
        order by
          created_at desc
        limit 1;
        if expired = true then
          return 'TOKEN_EXPIRED';
        elsif email_status is null then
          return 'QUEUED';
        else
          return email_status::invite_status;
        end if;
      end if;
    end;      
  $$;

comment on function survey_invites_status is 'Indicates the status of the invite, e.g. whether an invite email has been sent, status of those emails, and whether a response has been submitted.';

grant execute on function survey_invites_status to seasketch_user;

CREATE or replace FUNCTION public.before_invite_emails_insert() RETURNS trigger
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

comment on constraint survey_invites_survey_id_fkey on survey_invites is '
@simpleCollections only
';

comment on constraint invite_emails_survey_invite_id_fkey on invite_emails is '
@simpleCollections only
';


CREATE or replace FUNCTION public.survey_invite_was_used(invite_id integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select was_used from survey_invites where id = invite_id;
  $$;


COMMENT ON FUNCTION public.survey_invite_was_used(invite_id integer) IS '@omit';
grant execute on function survey_invite_was_used to anon;

drop type if exists survey_validation_info_composite cascade;
create type survey_validation_info_composite as (
  is_disabled boolean,
  limit_to_single_response boolean
);

create or replace function survey_validation_info(survey_id int)
  returns survey_validation_info_composite
  language sql
  security definer
  as $$
    select is_disabled, limit_to_single_response from surveys where id = survey_id;
  $$;

grant execute on function survey_validation_info to anon;

comment on function survey_validation_info is '@omit';

drop type if exists survey_token_info cascade;
create type survey_token_info as (
  token text,
  survey_id int,
  project_id int
);

create or replace function projects_session_outstanding_survey_invites(project projects)
  returns setof survey_token_info
  security definer
  language sql
  stable
  as $$
    select 
      invite_emails.token, 
      survey_invites.survey_id,
      surveys.project_id
    from
      invite_emails
    inner join
      survey_invites
    on
      survey_invites.id = invite_emails.survey_invite_id
    inner join
      surveys
    on
      surveys.id = survey_invites.survey_id
    where
      surveys.project_id = project.id and
      survey_invites.was_used = false and 
      invite_emails.token_expires_at > now() and
      (
        invite_emails.to_address = nullif(current_setting('session.canonical_email', TRUE), '') or
        it_me(survey_invites.user_id)
      )
  $$;

grant execute on function projects_session_outstanding_survey_invites to anon;
comment on function projects_session_outstanding_survey_invites is '
@simpleCollections only
Invites (and related tokens) for surveys which this user has not yet responded
to. Details on how to handle survey invites [can be found on the wiki](https://github.com/seasketch/next/wiki/User-Ingress#survey-invites).
';
