--! Previous: sha1:e609611ee62bec274e5da81b6a89185120cafc5c
--! Hash: sha1:a943cd0256bce79a4ebda91b2090a622755945a4

-- Enter migration here
ALTER TYPE invite_status ADD VALUE if not exists 'SURVEY_INVITE_QUEUED';
ALTER TYPE invite_status ADD VALUE if not exists 'SURVEY_INVITE_SENT';

CREATE OR REPLACE FUNCTION project_invites_status(invite public.project_invites) RETURNS public.invite_status
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      email_status invite_status;
      expired boolean;
      has_complaint boolean;
      survey_invite_status invite_status;
    begin
      select exists(select 1 from invite_emails where to_address = invite.email and status = 'COMPLAINT') into has_complaint;
      -- check for sent survey invites
      select 
        status 
      into
        survey_invite_status
      from 
        invite_emails 
      where 
        invite_emails.to_address = invite.email and
        invite_emails.survey_invite_id = any(select id from surveys where surveys.project_id = invite.project_id);
      if survey_invite_status is not null then
        if survey_invite_status in ('SENT', 'DELIVERED', 'CONFIRMED') then
          return 'SURVEY_INVITE_SENT';
        else
          return survey_invite_status;
        end if;
      elseif exists(
        select
          1
        from
          survey_invites
        inner join
          surveys
        on
          survey_invites.survey_id = surveys.id
        where
          survey_invites.email = invite.email and
          surveys.project_id = invite.project_id
      ) then
        return 'SURVEY_INVITE_QUEUED';
      elseif invite.was_used = true then 
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


CREATE or replace FUNCTION projects_invite(p public.projects) RETURNS public.project_invites
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select 
      *
    from 
      project_invites 
    where 
      project_id = p.id and ((
        email = current_setting('session.canonical_email', TRUE)::email and
        exists(
          select 1 from invite_emails 
          where status != 'QUEUED' and 
          project_invite_id = project_invites.id
        )
      ) or (
        email = current_setting('session.survey_invite_email', TRUE)::email
      ))
    limit 1;
  $$;

CREATE or replace FUNCTION public.confirm_project_invite_with_survey_token("projectId" integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    begin
      -- check that there is a user logged in with a verified email
      if nullif(current_setting('session.user_id', TRUE), '')::int is not null and nullif(current_setting('session.survey_invite_email', TRUE), '')::text is not null then
        -- check if there is an invite that matches that email
        if exists(select 1 from project_invites where email = nullif(current_setting('session.survey_invite_email', TRUE), '')) then
          -- if so, run confirm_project_invite(invite_id)
          return (
            select confirm_project_invite((
              select id from project_invites where email = nullif(current_setting('session.survey_invite_email', TRUE), '')
            ))
          );
        else
          raise exception 'No sent invite matching your email found';
        end if;
      else
        raise exception 'Must be logged in with a verified email and have x-ss-survey-invite-token header set';
      end if;
    end;
  $$;

grant execute on function confirm_project_invite_with_survey_token to seasketch_user;

comment on function confirm_project_invite_with_survey_token is '
Project invites can be paired with survey invites so that users can be sent an
email inviting them to a survey, then use that survey invite to confirm a 
project invitation. This way there are no duplicative emails sent.

Clients must set x-ss-survey-invite-token header before calling this mutation.
';
