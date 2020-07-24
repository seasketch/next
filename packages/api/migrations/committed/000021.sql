--! Previous: sha1:228b7f09439f9caa1902cc61bbd20b89ba19c74f
--! Hash: sha1:2909fcb3ba5cfe63a2df0399a500636d8cc3ce5f

-- Enter migration here
comment on function projects_users_banned_from_forums is '
@simpleCollections only
List of all banned users. Listing only accessible to admins.
';

comment on constraint forums_project_id_fkey on forums is '@simpleCollections only';

comment on column topics.sticky is '
Sticky topics will be listed at the topic of the forum.

Can be toggled by project admins using `setTopicSticky()` mutation.
';

comment on column topics.locked is '
Locked topics can only be posted to by project admins and will display a lock symbol.

Can be toggled by project admins using `setTopicLocked()` mutation.
';

comment on column posts.hidden_by_moderator is 'If set, the post has been hidden by a project admin. Contents of the post will not be available to the client. Admins should update this field using `setPostHiddenByModerator()`.';

comment on function set_forum_order is '
Set the order in which discussion forums will be displayed. Provide a list of forum IDs in the correct order. Missing ids will be added to the end of the list.
';

comment on function create_post is '
Must have write permission for the specified forum. Create reply to a discussion topic. `message` must be JSON, something like the output of DraftJS.
';

comment on function update_post is '
Updates the contents of the post. Can only be used by the author for 5 minutes after posting.
';

comment on function set_post_hidden_by_moderator is '
Admins can use this function to hide the contents of a message. Message will still appear in the client with the missing content, and should link to the Community Guidelines for why the post may have been hidden. If admins want all evidence of the post removed they must delete it.
';

comment on function set_topic_sticky is '
Admins can use this mutation to place topics at the top of the forum listing.
';
