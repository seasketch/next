--! Previous: sha1:2e003b78168d3a477834f8d938fbe4061d55e18d
--! Hash: sha1:caaedabf14d87a0132e268e731d74d789558a0c7
--! Message: Remove survey invites

-- Remove survey invites. Group-limited surveys stay: survey_invited_groups
-- still controls who can respond when a survey's access type is INVITE_ONLY.

create or replace function public.session_can_access_form(fid integer) returns boolean
    language sql stable
    security definer
    as $$
    select session_is_admin((select project_id_for_form_id(fid))) or
    (
      session_has_project_access((select project_id_for_form_id(fid))) and (
        session_on_acl((
          select
            id
          from
            access_control_lists
          where
            access_control_lists.sketch_class_id is not null and
            access_control_lists.sketch_class_id = (select sketch_class_id from forms where id = fid)
        )) or (
          exists(
            select
              id
            from
              surveys
            where
              id = (select survey_id from forms where forms.id = fid) and
              (
                is_disabled = false and (
                  access_type = 'PUBLIC' or session_in_group(survey_group_ids(surveys.id))
                )
              )
          )
        )
      )
    )
  $$;

comment on function public.session_can_access_form(fid integer) is '@omit';

create or replace function public.projects_invite(p public.projects) returns public.project_invites
    language sql stable
    security definer
    as $$
    select
      *
    from
      project_invites
    where
      project_id = p.id and
      email = current_setting('session.canonical_email', TRUE)::email and
      exists(
        select 1 from invite_emails
        where status != 'QUEUED' and
        project_invite_id = project_invites.id
      )
    limit 1;
  $$;

create or replace function public.before_invite_emails_insert() returns trigger
    language plpgsql
    as $$
  begin
    if NEW.project_invite_id is not null then
      NEW.to_address = (select email from project_invites where id = NEW.project_invite_id);
    end if;

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
    return new;
  end;
$$;

create or replace function public.update_survey_invited_groups("surveyId" integer, "groupIds" integer[]) returns setof public.project_groups
    language plpgsql
    security definer
    as $$
    declare
      pid int;
    begin
      select project_id into pid from surveys where id = "surveyId";
      if session_is_admin(pid) = false then
        raise exception 'Must be project admin';
      end if;
      delete from survey_invited_groups where survey_id = "surveyId";
      insert into survey_invited_groups (survey_id, group_id)
        select "surveyId", id from project_groups where project_id = pid and id = any("groupIds");
      return query select * from project_groups where id = any("groupIds");
    end;
  $$;

comment on function public.update_survey_invited_groups("surveyId" integer, "groupIds" integer[]) is '
Updates the groups whose members can respond to the survey.
The list can be read via `Survey.invitedGroups`.
';

create or replace function public.before_survey_invited_groups_insert() returns trigger
    language plpgsql
    as $$
  begin
    if not exists (select id from project_groups where id = NEW.group_id and project_id = (select project_id from surveys where id = NEW.survey_id)) then
      raise exception 'Surveys may only include participant groups from the same project';
    end if;
    return new;
  end;
$$;

drop policy if exists surveys_select on public.surveys;
create policy surveys_select on public.surveys for select to anon
  using ((
    public.session_is_admin(project_id)
    or (
      public.session_has_project_access(project_id)
      and (is_disabled = false)
      and (
        (access_type = 'PUBLIC'::public.survey_access_type)
        or public.session_in_group(public.survey_group_ids(id))
      )
    )
  ));

drop policy if exists invite_emails_admin on public.invite_emails;
create policy invite_emails_admin on public.invite_emails for select to seasketch_user
  using ((public.session_is_admin((
    select project_invites.project_id
    from public.project_invites
    where project_invites.id = invite_emails.project_invite_id
  ))));

drop trigger if exists after_add_user_to_group_update_survey_invites on public.project_group_members;
drop trigger if exists after_remove_user_from_group_update_survey_invites on public.project_group_members;
drop trigger if exists after_response_submission on public.survey_responses;
drop trigger if exists survey_invites_before_insert on public.survey_invites;
drop trigger if exists survey_invites_before_update on public.survey_invites;

drop function if exists public.add_user_to_group_update_survey_invites_trigger();
drop function if exists public.remove_user_from_group_update_survey_invites_trigger();
drop function if exists public.after_response_submission();
drop function if exists public.update_survey_group_invites(integer);
drop function if exists public.session_has_survey_invite(integer);
drop function if exists public.survey_invite_was_used(integer);
drop function if exists public.survey_invite_before_insert_trigger();
drop function if exists public.survey_invite_before_update_trigger();
drop function if exists public.confirm_project_invite_with_survey_token(integer);
drop function if exists public.projects_session_outstanding_survey_invites(public.projects);
drop function if exists public.create_survey_invites(integer, boolean, boolean, text[], public.survey_invite_options[]);
drop function if exists public.survey_invites_status(public.survey_invites);

-- invite_status cannot drop values in place. Recreate it without the survey
-- labels, then rebuild the functions whose signatures use the type.
drop function if exists public.projects_invite_counts(public.projects);
drop function if exists public.projects_invites(public.projects, public.invite_status[], public.invite_order_by, public.sort_by_direction);
drop function if exists public.update_project_invite(integer, boolean, text, text, integer[]);
drop function if exists public.project_invites_status(public.project_invites);

drop type if exists public.invite_stats;
drop type if exists public.project_invite_details;
drop type if exists public.invite_status;

create type public.invite_status as enum (
  'UNSENT',
  'QUEUED',
  'SENT',
  'DELIVERED',
  'BOUNCED',
  'COMPLAINT',
  'UNCONFIRMED',
  'CONFIRMED',
  'TOKEN_EXPIRED',
  'ERROR',
  'UNSUBSCRIBED'
);

create type public.invite_stats as (
  status public.invite_status,
  count integer
);

create type public.project_invite_details as (
  admin boolean,
  fullname text,
  email text,
  project_id integer,
  state public.invite_status
);

comment on type public.invite_status is 'Invite status is derived from feedback notifications coming from the AWS SES email service and token expiration date. See the inviteEmails relation for more details.';

create function public.project_invites_status(invite public.project_invites) returns public.invite_status
    language plpgsql stable
    security definer
    as $$
    declare
      email_status invite_status;
      expired boolean;
      has_complaint boolean;
    begin
      select exists(select 1 from invite_emails where to_address = invite.email and status = 'COMPLAINT') into has_complaint;
      if invite.was_used = true then
        return 'CONFIRMED';
      elseif has_complaint then
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
          project_invite_id = invite.id
        order by
          created_at desc
        limit 1;
        if expired = true then
          return 'TOKEN_EXPIRED';
        elsif email_status is null then
          return 'UNSENT';
        else
          return email_status::invite_status;
        end if;
      end if;
    end;
  $$;

revoke all on function public.project_invites_status(public.project_invites) from public;
grant all on function public.project_invites_status(public.project_invites) to seasketch_user;

create function public.projects_invite_counts(p public.projects) returns setof public.invite_stats
    language sql stable
    security definer
    as $$
    select t::invite_stats from (
    select
        project_invites_status(project_invites.*)::invite_status as status,
        count(*) as count
      from
        project_invites
      where
        project_id = p.id and session_is_admin(p.id)
      group by
        status) as t;
  $$;

comment on function public.projects_invite_counts(p public.projects) is '
@simpleCollections only
Breakdown of number of invites per status. Used to display counts in overview listing of users, groups, and invites in the user administration dashboard.
';

revoke all on function public.projects_invite_counts(public.projects) from public;
grant all on function public.projects_invite_counts(public.projects) to seasketch_user;

create function public.projects_invites(p public.projects, statuses public.invite_status[], "orderBy" public.invite_order_by, direction public.sort_by_direction) returns setof public.project_invites
    language sql stable
    as $$
    select
      *
    from
      project_invites
    where
      session_is_admin(p.id) and
      project_id = p.id and
      (array_length(statuses, 1) is null or project_invites_status(project_invites.*) = any (statuses))
    order by
      (CASE WHEN "orderBy" = 'EMAIL' and "direction" = 'ASC' THEN email
            WHEN "orderBy" = 'NAME' and "direction" = 'ASC' THEN fullname
            else fullname
      END) ASC,
      (CASE WHEN "orderBy" = 'EMAIL' and "direction" = 'DESC' THEN email
            WHEN "orderBy" = 'NAME' and "direction" = 'DESC' THEN fullname
            ELSE fullname
      END) DESC
  $$;

comment on function public.projects_invites(p public.projects, statuses public.invite_status[], "orderBy" public.invite_order_by, direction public.sort_by_direction) is 'List project invites by status';

revoke all on function public.projects_invites(public.projects, public.invite_status[], public.invite_order_by, public.sort_by_direction) from public;
grant all on function public.projects_invites(public.projects, public.invite_status[], public.invite_order_by, public.sort_by_direction) to seasketch_user;

create function public.update_project_invite("inviteId" integer, make_admin boolean, email text, fullname text, groups integer[]) returns public.project_invites
    language plpgsql
    security definer
    as $$
    declare
      pid int;
      status invite_status;
      current_email text;
      used boolean;
      _email text;
      _make_admin boolean;
      _fullname text;
      invite project_invites;
    begin
      select "email", "make_admin", "fullname" into _email, _make_admin, _fullname;
      select project_id, project_invites_status(project_invites.*), project_invites.email, was_used into pid, status, current_email, used from project_invites where project_invites.id = "inviteId";
      if session_is_admin(pid) then
        if status != 'UNSENT'::invite_status and current_email != _email then
          raise exception 'Cannot change email if invite has already been sent.';
        end if;
        if used is true then
          raise exception 'Cannot update invite if it has already been used.';
        end if;
        update project_invites set email = _email, fullname = _fullname, make_admin = _make_admin where id = "inviteId";
        delete from project_invite_groups where invite_id = "inviteId";
        for i IN 1 ..coalesce(array_upper(groups, 1), 0) loop
          insert into project_invite_groups (invite_id, group_id) values ("inviteId", "groups"[i]);
        end loop;
        select * into invite from project_invites where project_invites.id = "inviteId";
        return invite;
      else
        raise exception 'Must be a project admin';
      end if;
    end;
  $$;

revoke all on function public.update_project_invite(integer, boolean, text, text, integer[]) from public;
grant all on function public.update_project_invite(integer, boolean, text, text, integer[]) to seasketch_user;

delete from public.invite_emails where project_invite_id is null;

alter table public.invite_emails drop constraint if exists invite_email_has_related_model;
alter table public.invite_emails drop column if exists survey_invite_id;
alter table public.invite_emails drop constraint if exists invite_email_has_project_invite;
alter table public.invite_emails
  add constraint invite_email_has_project_invite check (project_invite_id is not null);

drop table if exists public.survey_invites;
drop domain if exists public.survey_invite_options;
drop type if exists public.survey_token_info;
