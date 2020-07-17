--! Previous: sha1:c4deb590c7e0dcbcd7f1bb501c47b205f8ed1bb6
--! Hash: sha1:daf005967b8ad7eb22970792274cadfbaf5b0fa1

-- Enter migration here
comment on function add_user_to_group is E'Add the given user to a group. Must be an administrator of the project.';
comment on function remove_user_from_group is E'Remove the given user from a group. Must be an administrator of the project.';
comment on function approve_participant is E'For invite_only projects. Approve access request by a user. Must be an administrator of the project.';
