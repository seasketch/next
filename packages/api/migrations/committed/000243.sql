--! Previous: sha1:0eed3a09aba9c3e6b87506e8585854ab126d63ee
--! Hash: sha1:76561bb24c87c0391c8bd678ce2069f9a74ec834

-- Enter migration here
CREATE OR REPLACE FUNCTION public.create_project_invites("projectId" integer, "sendEmailNow" boolean, "makeAdmin" boolean, "groupNames" text[], "projectInviteOptions" public.project_invite_options[]) RETURNS SETOF public.project_invites
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      invite_ids int[];
      invite_id int;
      options project_invite_options;
      i_id int;
      invites project_invites[];
      existing_participants project_participants[];
    begin
      if (select session_is_admin("projectId")) = false then
        raise exception 'Must be project administrator';
      end if;

      with ins as (
        insert into project_invites (
          project_id,
          make_admin,
          email,
          fullname
        ) 
        select 
          "projectId",
          "makeAdmin",
          email, 
          fullname 
        from 
          unnest("projectInviteOptions")
        on conflict do nothing
        returning id
      )
      select array_agg(id) into invite_ids from ins;

      -- add to groups if exists
      if "groupNames" is not null and array_length("groupNames", 1) > 0 then
          insert into
            project_invite_groups (
              invite_id,
              group_id
            )
          select
            unnest(invite_ids),
            project_groups.id
          from
            project_groups
          where
            project_groups.name = any("groupNames") and
            project_id = "projectId"
          ;
      end if;
      -- afterwards, create invite_emails records if "sendEmailsNow" is true
      if "sendEmailNow" = true then
        perform send_project_invites((
          select
            array_agg(id)
          from
            project_invites
          where
            project_id = "projectId" and email in (select email from unnest("projectInviteOptions"))
        ));
      end if;
      return query select * from project_invites where project_id = "projectId" and email in (select email from unnest("projectInviteOptions"));
    end;
  $$;
