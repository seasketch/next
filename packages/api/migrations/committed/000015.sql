--! Previous: sha1:caa10561eb38d0000106a791b3aec4b6f8917e03
--! Hash: sha1:921cf80f47843160ec34e7ba94667018e75a3e0a

-- Enter migration here
comment on column project_invites.was_used is 'Project invite has already been accepted.';

grant all on project_invite_groups to seasketch_user;
alter table project_invite_groups enable row level security;

drop policy if exists project_invite_groups_admin on project_invite_groups;
create policy project_invite_groups_admin on project_invite_groups for all to seasketch_user 
  using (
    session_is_admin((select project_id from project_invites where project_invites.id = invite_id))
  ) with check (
    (session_is_admin((select project_id from project_invites where project_invites.id = invite_id)))
  );

comment on constraint project_invite_groups_invite_id_fkey on project_invite_groups is '@omit';
comment on constraint project_invite_groups_group_id_fkey on project_invite_groups is '@omit';

COMMENT ON TABLE public.forms IS '
@omit all
Custom user-input Forms are used in two places in SeaSketch. For SketchClasses,
Forms are used to add attributes to spatial features. In Surveys, Forms are used
in support of gathering response data.

Forms have any number of *FormFields* ordered by a `position` field, and form 
contents may be hidden depending on the evaluation of *FormConditionalRenderingRules*.

Forms typically belong to either a *Survey* or *SketchClass* exclusively. Some
Forms may be designated as a template, in which case they belong to neither. 
Only superusers can create form templates, and clients should provide templates
as an option when creating new forms.
';

COMMENT ON COLUMN public.forms.is_template IS '
SeaSetch superusers can create template forms than can be used when creating 
SketchClasses or Surveys. These templates can be created using the 
`createFormTemplateFromSketchClass` and `createFormTemplateFromSurvey` 
mutations. Template forms can be listed with the root-level `templateForms` 
query.
';

comment on column forms.sketch_class_id is 'Related *SketchClass*';
comment on column forms.survey_id is 'Related *Survey*';
comment on column forms.template_name is 'Chosen by superusers upon template creation';
comment on table form_fields is '
@omit all
*FormFields* represent input fields in a form. Records contain fields to support
generic functionality like name, description, position, and isRequired. They 
also have a JSON `componentSettings` field that can have custom data to support
a particular input type, indicated by the `type` field.

Project administrators have full control over managing form fields through
graphile-generated CRUD mutations.
';
comment on column form_fields.form_id is 'Form this field belongs to.';
comment on column form_fields.type is 'Indicates the input type. Each input type has a client-side component implementation with custom configuration properties stored in `componentSettings`.';
comment on column form_fields.is_required is 'Users must provide input for these fields before submission.';
comment on column form_fields.position is '
Determines order of field display. Clients should display fields in ascending 
order. Cannot be changed individually. Use `setFormFieldOrder()` mutation to 
update.
';
comment on column form_fields.component_settings is 'Type-specific configuration. For example, a Choice field might have a list of valid choices.';
COMMENT ON TABLE public.form_conditional_rendering_rules IS '
@omit all
If any rendering rules are set, at least one rule must evaluate true for the 
field to be displayed to users. isRequired rules on *FormFields* should not be
enforced for fields that are hidden by a rule.

An example of a rule would be:

SHOW fieldB if fieldA GREATER_THAN 5
';
comment on column form_conditional_rendering_rules.field_id is 'Field that will be hidden unless the rule evaluates true';
comment on column form_conditional_rendering_rules.predicate_field_id is 'Field that is evaluated';
comment on column form_conditional_rendering_rules.value is 'Value that predicate_field.value is compared to';
comment on column form_conditional_rendering_rules.operator is 'Comparison operation';
comment on column project_invites.fullname is 'Specified by admin when invite was created.';
comment on column project_invites.email is 'Specified by admin when invite was created.';
comment on column project_invites.user_id is 'Is set upon invite acceptance.';
COMMENT ON TABLE public.invite_emails IS '
@omit all
Invite emails can be associated with either a project or survey invitation. 
Project invite emails are sent by direct admin action, going into a QUEUED state
and eventually sent out by a backend emailing process. Survey invites are 
automatically created whenever a survey is published.

[More details on the mailing process can be found on the wiki](https://github.com/seasketch/next/wiki/User-and-Survey-Invite-Management).
';

comment on column invite_emails.status is '
Updated by the mailer processes and SES notifications.
';
comment on column invite_emails.token_expires_at is '
Emails contain a link with an embedded JSON Web Token that is used to authorize 
access. These tokens have an expiration that is both embedded in the token and 
tracked in the database. Each email has its own token and expiration.
';

COMMENT ON TABLE public.project_invites IS '
@omit all
@simpleCollections only
Admins can invite users to their project, adding them to user groups and 
distributing admin privileges as needed. Invitations can be immediately sent via
email or they can be sent out later in batches. 

Use the `createProjectInvites()`
mutation to create one or more invitations and then use graphile generated 
mutations to update and delete them.

Details on [handling user ingress with invitation tokens](https://github.com/seasketch/next/wiki/User-Ingress#project-invites) and [the mailer subsystem](https://github.com/seasketch/next/wiki/User-and-Survey-Invite-Management) can be found on the wiki.
';

CREATE OR REPLACE FUNCTION public.projects_invite(p public.projects) RETURNS public.project_invites
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
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

COMMENT ON TABLE public.sketches IS '
@omit all,many
A *Sketch* is a spatial feature that matches the schema defined by the related 
*SketchClass*. User *Sketches* appears in the user''s "My Plans" tab and can be
shared in the discussion forum. They are also the gateway to analytical reports.

Sketches are completely owned by individual users, so access control rules 
ensure that only the owner of a sketch can perform CRUD operations on them. 
Admins have no special access. Use the graphile-generated mutations to manage 
these records.
';

comment on column sketches.name is 'User provided name for the sketch.';
comment on column sketches.sketch_class_id is 'SketchClass that defines the behavior of this type of sketch.';
comment on column sketches.user_id is 'Owner of the sketch.';
comment on column sketches.collection_id is 'If the sketch is not a collection, it can belong to a collection (collections cannot be nested).';
comment on column sketches.copy_of is 'If this Sketch started as a copy of another it is tracked here. Eventually SeaSketch may have a means of visualizing how plans are iterated on over time.';
comment on column sketches.user_geom is 'Spatial feature the user directly digitized, without preprocessing. This is the feature that should be used if the Sketch is later edited.';
comment on column sketches.geom is 'The geometry of the Sketch **after** it has been preprocessed. This is the geometry that is used for reporting. Preprocessed geometries may be extremely large and complex, so it may be necessary to access them through a vector tile service or some other optimization.';
comment on column sketches.bbox is 'Bounding box of the final preprocessed geometry. [xmin, ymin, xmax, ymax]';
comment on column sketches.num_vertices is 'Number of points in the final geometry. Can be used to gauge the complexity of the shape and decide whether to load via graphql or use a vector tile service.';
comment on column sketches.folder_id is 'Parent folder. Both regular sketches and collections may be nested within folders for organization purposes.';

alter table sketch_classes drop column if exists mapbox_gl_style;
alter table sketch_classes add column mapbox_gl_style jsonb;

comment on column sketch_classes.name is 'Label chosen by project admins that is shown to users.';
comment on column sketch_classes.project_id is 'SketchClasses belong to a single project.';
comment on function sketch_classes_can_digitize is 'Whether the current user session is allowed to digitize sketches of this type. Digitizing is controlled by admins via access control lists, and archived sketch classes can only be digitized by admins.';

DELETE FROM pg_enum
WHERE enumlabel = 'CHOOSE_FEATURE'
AND enumtypid = (
  SELECT oid FROM pg_type WHERE typname = 'sketch_geometry_type'
);
alter type sketch_geometry_type add value 'CHOOSE_FEATURE';

comment on column sketch_classes.allow_multi is '
If set to true, a geometry_type of POLYGON would allow for both POLYGONs and 
MULTIPOLYGONs after preprocessing or on spatial file upload. Users will still 
digitize single features. 

Note that this feature should be used seldomly, since for planning purposes it 
is unlikely to have non-contiguous zones.

For CHOOSE_FEATURE geometry types, this field will enable the selction of 
multiple features.
';

comment on column sketch_classes.geoprocessing_project_url is '
Root endpoint of a [@seasketch/geoprocessing](https://github.com/seasketch/geoprocessing) project that should be used for reporting.
';
comment on column sketch_classes.geoprocessing_client_url is '
Endpoint for the client javascript bundle.
';
comment on column sketch_classes.geoprocessing_client_name is '
Name of the report to be displayed.
';

comment on column sketch_classes.mapbox_gl_style is '
[Mapbox GL Style](https://docs.mapbox.com/mapbox-gl-js/style-spec/) used to 
render features. Sketches can be styled based on attribute data by using 
[Expressions](https://docs.mapbox.com/help/glossary/expression/).
';

COMMENT ON TABLE public.access_control_lists IS '
@omit all,many
@name acl
Access Control Lists can be associated with SketchClasses, Forums, and 
potentially other application resources to allow admins to control access based
on admin privileges or group membership. The behavior of the system is primarily
driven by the `type` and `groups` settings.

The [AUTHORIZATION.md file](https://github.com/seasketch/next/blob/master/packages/db/AUTHORIZATION.md#content-managed-by-an-access-control-list)
details how ACL functionality was added to the Forums type, and can be used as a
template to add ACL features to new types if needed.
';

comment on column access_control_lists.type is 'Control whether access control is PUBLIC, ADMINS_ONLY, or GROUP';

comment on function onboarded is '@omit';

comment on function leave_project is '
Turns off profile sharing in this project. User privacy choices should be 
respected, and profile information should disappear from the admin users lists,
forum posts, and any other shared content. In the forum a balance will need to 
be made to hide their posts entirely since anonymous content could be malicious, 
and maintain a historical record of discussions.
';

comment on function join_project is '
Adds current user to the list of participants for a project, sharing their 
profile with administrators in user listings. Their profile will also be shared 
in public or group discussion forum posts.

Clients will need to determine when/how to show prompts to join a project based
on activity that minimizes annoyance when browsing among projects but also makes
sure users are visible to admins so that they may gain user group permissions.
';

comment on function confirm_project_invite_with_verified_email is '
Users can confirm project invites without clicking thru an email if they are 
registered for SeaSketch and their verified email matches that of a project 
invite. Outstanding (or confirmed) invites can be accessed via the 
`currentProject.invite` query.

More details on how to handle invites can be found [on the wiki](https://github.com/seasketch/next/wiki/User-Ingress#project-invites).
';


CREATE OR REPLACE FUNCTION public.revoke_admin_access("projectId" integer, "userId" integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    BEGIN
      IF session_is_admin("projectId") or session_is_superuser() THEN
        IF exists(select 1 from project_participants where user_id = "userId" and project_id = "projectId" and share_profile = true) THEN
          update project_participants set is_admin = false where user_id = "userId" and project_id = "projectId";
        ELSE
          raise exception 'Participant not found.';
        END IF;
      ELSE
        raise exception 'You must be a project administrator';
      END IF;
    END
  $$;

grant execute on function revoke_admin_access to seasketch_user;

comment on function revoke_admin_access is '
Remove participant admin privileges.
';

comment on function create_project_invites is '
Create a set of project invites from a set of emails and optional names. Clients
should implement this feature as a simple textarea where admins can copy and 
paste a set of names and emails from a spreadsheet.#

Invites can be assigned to a list of groups and optional admin permission. The
function can either send these invite emails immediately or they can be manually
sent later.

More details on project invite management [can be found in the wiki](https://github.com/seasketch/next/wiki/User-and-Survey-Invite-Management).
';

comment on function send_all_project_invites is '
Send all UNSENT invites in the current project.
';

comment on function send_project_invites is '
Send a list of project invites identified by their id.
';

comment on function make_response_draft is '
Project administrators cannot edit survey responses and survey respondants 
cannot edit responses after they have been submitted. Admins can use this 
mutation to put a response into draft mode so that they can be updated and 
resubmitted by the respondant.
';

comment on function add_valid_child_sketch_class is '
Add a SketchClass to the list of valid children for a Collection-type SketchClass.
';

comment on function remove_valid_child_sketch_class is '
Remove a SketchClass from the list of valid children for a Collection.
';

comment on function initialize_blank_sketch_class_form is '
When creating a new SketchClass, admins can either choose from a set of 
templates or start with a blank form. This mutation will initialize with a blank
form with no fields configured.
';

comment on function initialize_sketch_class_form_from_template is '
Admins can choose to start a new SketchClass with a form derived from the list
of Form templates.
';

comment on function initialize_blank_survey_form is '
When creating a new Survey, admins can either choose from a set of 
templates or start with a blank form. This mutation will initialize with a blank
form with no fields configured.
';

comment on function initialize_survey_form_from_template is '
Admins can choose to start a new Survey with a form derived from the list
of Form templates.
';

comment on function set_form_field_order is '
Sets the positions of all fields in a form at once. Any missing field ids from
the input will be positioned at the end of the form.

Use this instead of trying to manage the position of form fields individually.
';
