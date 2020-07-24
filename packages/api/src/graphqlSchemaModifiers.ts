export default {
  fieldOrder: {
    /**
     * Custom queries, mutations, and fields should be reordered logically so
     * that related functionality can be discovered when browsing documentation
     * in graphql. Graphile-generated crud operations and getByNodeId-type
     * queries that aren't given an explicit order will just be listed at the
     * end of the list.
     */
    Mutation: [
      // user ingress mutations
      "confirmOnboarded",
      "joinProject",
      "leaveProject",
      "confirmProjectInvite",
      "confirmProjectInviteWithVerifiedEmail",
      "confirmProjectInviteWithSurveyToken",

      // Admin user administration
      "approveParticipant",
      "addUserToGroup",
      "removeUserFromGroup",
      "grantAdminAccess",
      "revokeAdminAccess",

      // User invites
      "createProjectInvites",
      "sendAllProjectInvites",
      "sendProjectInvites",

      // Access control lists
      "addGroupToAcl",
      "removeGroupFromAcl",

      // Survey mutations
      "makeResponseDraft",
      "updateSurveyInvitedGroups",
      "sendSurveyInviteReminder",

      // SketchClass mutations
      "addValidChildSketchClass",
      "removeValidChildSketchClass",

      // Form mutations
      "initializeBlankSketchClassForm",
      "initializeSketchClassFormFromTemplate",
      "initializeBlankSurveyForm",
      "initializeSurveyFormFromTemplate",
      "setFormFieldOrder",
    ],
    Query: [
      "me",
      "currentProject",
      "projectsConnection",
      "templateForms",
      "verifyProjectInvite",
      "verifySurveyInvite",
      "survey",
    ],
    Project: [
      // basic props
      "nodeId",
      "id",
      "name",
      "description",
      "accessControl",
      "isListed",
      "isFeatured",
      "logoUrl",
      "logoLink",
      "slug",
      "url",
      // session-specific information
      "sessionHasPrivilegedAccess",
      "sessionIsAdmin",
      "sessionParticipationStatus",
      "invite",
      "sessionOutstandingSurveyInvites",
      "myFolders",
      "mySketches",
      // resources used by all users
      "sketchClasses",
      "forumsConnection",
      "surveys",
      // admin-specific resources
      // user management
      "adminCount",
      "participantCount",
      "unapprovedParticipantCount",
      "inviteCounts",
      "invitesConnection",
      "admins",
      "participants",
      "unapprovedParticipants",
      "groups",
    ],
    Sketch: [
      "nodeId",
      "id",
      "name",
      "sketchClassId",
      "sketchClass",
      "userId",
      "user",
      "collectionId",
      "collection",
      "folderId",
      "copyOf",
      "copiedFrom",
    ],
    SketchClass: [
      "nodeId",
      "id",
      "projectId",
      "name",
      "isMyPlansOption",
      "isArchived",
      "canDigitize",
      "form",
    ],
  },
  /**
   * Extra documentation that cannot or is awkward to define using Smart
   * Comments can be included here. Be sure to mention related queries or
   * mutations in documentation to enhance discoverability, and link to
   * related content on the github wiki. Remember that GraphQL documentation
   * toosl support markdown.
   */
  documentation: {
    Query: `
Most relevant root-level queries are listed first, which concern getting 
the currently logged-in user (\`me\`) and project (\`currentProject\`). 
There are also cross-project resources such as form templates and of 
course the project listing connection. Most queries when working from a project
should be performed using fields on the \`Project\` type.

Postgraphile also automatically generates a variety of accessor queries 
for each database table. These are unlikely to be needed often but may possibly 
be utilized by sophisticated GraphQL clients in the future to update caches.
    `,
    "Query.projectsConnection": `
The projectsConnection exposes all SeaSketch projects the current session has 
access to. For a superuser, this would be all of them (that aren't deleted). 
For a project administrator, they have access to all public projects and those 
that they administer. For everyone else, they see all public projects and any 
\`invite-only\` projects that they are approved members of.

The projectsConnection exposes a fully-featured Relay compatible connection so 
that an efficient listing can be made of the hundreds of SeaSketch Projects.
    `,
    "Query.templateForms": `
Template forms can be created by SeaSketch superusers for use in **any** 
project. For example, there could be a template for a human-uses survey that
project administrators can copy and use as a starting point for customization.

SeaSketch superusers can create template Forms using the \`createFormTemplateFromSketchClass\` 
and \`createFormTemplateFromSurvey\` mutations.
    `,
    "User.profile": `
Access the user's profile. This feature is only accessible to project admins if
the user has chosen to share their profile with the project.

User profiles cannot be accessed directly en-mass by end-users. Rather, Survey 
\`Posts\` and other shared content will have accessor methods to get at this 
information, but again, only if the profile has been shared.`,
    "Project.sketchClasses": `
List of all the SketchClasses that can be used in digitizing spatial data. 
Accessible to all users, though access control settings may limit which users
can access some SketchClasses.
    `,
    "Project.forumsConnection": `
List of all discussion forums the current user has access to.
    `,
    "Project.surveys": `Listing of all Surveys accessible to the current user.`,
    "Project.admins": `Listing of all users who have admin access.`,
    "Project.groups": `
Listing of current user groups.

Group membership can be updated using the \`addUserToGroup\`/\`removeUserFromGroup\` mutations
    `,
    "Group.members": `Listing of all users who have been assigned to this group.`,
    "ProjectAccessControlSetting.ADMINS_ONLY": `Only project administrators will be able to access the project.`,
    "ProjectAccessControlSetting.INVITE_ONLY": `
Only users who have been invited to join the project can participate. Admins can send email invitations with a special link to signup.

Other users may request access, in which case admins can approve those access requests if appropriate.
    `,
    "ProjectAccessControlSetting.PUBLIC": `Anyone can join and use a public project, though access to particular datasets, sketch classes, and forums may be restricted via access control lists.`,
    "ProjectInvite.groups": `
Groups to be assigned to the user once the invite is confirmed. Existing invite group membership can be updated using the crud operations on ProjectInviteGroup types.
    `,
    "ProjectInvite.inviteEmails": `Listing of all emails related to this invite.`,
    "ProjectInvite.status": `Status derived from the state of invite emails as well as token expiration`,
    "InviteStatus.UNSENT": `**Project Invites only**. Invites may be created but not sent immediately. This way admins can collaboratively update a project invite list before mass-sending invites when a project is first published.`,
    "InviteStatus.QUEUED": `
#### Project Invites    
Admin has sent the invite, but the mail delivery subsystem has not yet sent the invite.

#### Survey Invites
Invite has been created but email has not yet been sent. Emails will be sent automatically by a periodic backend process (approx every 20 seconds).
`,
    "InviteStatus.SENT": `Invite email has been sent but not yet delivered to the user's mail server`,
    "InviteStatus.DELIVERED": `Delivered to the user's mail server`,
    "InviteStatus.BOUNCED": `Emails may be bounced due to a full inbox, misconfigured mail server, or other reasons. See [AWS SES documentation](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/monitor-using-event-publishing.html#event-publishing-terminology).`,
    "InviteStatus.COMPLAINT": `User has reported SeaSketch as sending Spam in this or another project. SeaSketch will no longer send emails to this user in any project.`,
    "InviteStatus.UNCONFIRMED": `Unused enum value.`,
    "InviteStatus.CONFIRMED": `
#### Project Invites
User has accepted the invite.

#### Survey Invites
User has responded to the survey.`,
    "InviteStatus.TOKEN_EXPIRED": `
For **project invites**, Invite JSON Web Tokens are set to expire in 14 (admins) or 60 days. **Survey invites** expire after 60 days for invite_only surveys, and after 2 years for public surveys. Invites should be resent if still necessary`,
    "InviteStatus.ERROR": `SeaSketch application error when sending invite emails. Refer to email status`,
    "InviteStatus.UNSUBSCRIBED": `
The user has unsubscribed from all emails originating from SeaSketch.

If this happens SeaSketch will not be able to send any invitations to the user.
`,
    "InviteStatus.SURVEY_INVITE_QUEUED":
      "Project invites have this status when a survey invite is queued for sending in this project. Users can be invited to a survey + have an un-sent project invite that they can confirm using `confirmProjectInviteWithSurveyToken()`. This way users do not need to simultaneously be sent both a project and survey invite.",
    "InviteStatus.SURVEY_INVITE_SENT":
      "Survey invite for this project and email has already been sent. See InviteStatus.SURVEY_INVITE_QUEUED for more details.",
    "EmailStatus.QUEUED": `Admin has sent the invite, but the mail delivery subsystem has not yet sent the invite`,
    "EmailStatus.SENT": `Invite email has been sent but not yet delivered to the user's mail server`,
    "EmailStatus.DELIVERED": `Delivered to the user's mail server`,
    "EmailStatus.BOUNCED": `Emails may be bounced due to a full inbox, misconfigured mail server, or other reasons. See [AWS SES documentation](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/monitor-using-event-publishing.html#event-publishing-terminology).`,
    "EmailStatus.COMPLAINT": `User has reported SeaSketch as sending Spam in this or another project. SeaSketch will no longer send emails to this user in any project.`,
    "EmailStatus.ERROR": `SeaSketch application error when sending invite emails. Refer to email status`,
    "EmailStatus.UNSUBSCRIBED": `
The user has unsubscribed from all emails originating from SeaSketch.

If this happens SeaSketch will not be able to send any invitations to the user.
    `,
    "ParticipationStatus.NONE": `User has not joined or participated in the project before. This status would only be accessible to a logged in user themselves, never in the admin listing of users.`,
    "ParticipationStatus.PENDING_APPROVAL": `For invite-only projects, this user has requested access to the project and needs approval from an admin.`,
    "ParticipationStatus.PARTICIPANT_SHARED_PROFILE": `With a shared profile, this user can now take actions like participating in discussion forums.`,
    "ParticipationStatus.PARTICIPANT_HIDDEN_PROFILE": `While the user has joined the project, they haven't shared (or later un-shared) their profile. Admins will not be able to see any info about them so they cannot be added to groups. Users cannot use any of the discussion or sharing features without publishing their profile.`,
    "FormTemplateType.SURVEYS": `Template should only be listed for *Surveys*.`,
    "FormTemplateType.SKETCHES": `Template should only be listed for *SketchClasses*.`,
    "FormTemplateType.SURVEYS_AND_SKETCHES": `Template should be an option for both types.`,
    "Form.formFields": `List of all FormFields in this form.`,
    "FormField.conditionalRenderingRules": `Set of rules that determine the visibility of this field.`,
    FormFieldType: `
FormField input types. Each type will need a custom client-side component. 
This list will expand as the application supports new types. New types can be 
added by using the command: 

\`alter type form_field_type add value 'NEW_TYPE';\`
`,
    "FormFieldType.TEXTINPUT": `The simplest input type, a plain html \`<input type="text" />\``,
    "FormFieldType.TEXTAREA": `HTML textarea field`,
    "FormFieldType.SELECT": `HTML select field. May support multiple choices`,
    "FormFieldType.SECTION": `Non-input type field. Used to insert headers into a form`,
    "FieldRuleOperator.LESS_THAN": `Predicate field value is less than specified value`,
    "FieldRuleOperator.IS_BLANK": `Empty string input or no choice selection`,
    "FieldRuleOperator.CONTAINS": `String contains value`,
    "Project.sessionParticipationStatus": `Participation status for the currently logged-in session`,
    "SketchClass.form": `Form schema used to collect attributes on these sketches.`,
    "SketchGeometryType.COLLECTION": `Sketch itself will have no geometry, but can be associated with a number of child sketches. Can be represented as a GeoJSON FeatureCollection.`,
    "SketchGeometryType.CHOOSE_FEATURE": `Users will choose one (or more) features from a feature collection. For example, a choice of grid cells or marxan zones.`,
    "SketchClass.acl": `Access control lists can be used by admins to control who can digitize sketches of this class. All users will have access to SketchClass schemas in order to render information posted to forums, but they will only be able to digitize or edit these sketches if they are on the access control list.`,
    "SketchClass.validChildren": `If listed for a Collection, only valid child sketch classes can be added as children.`,
    "Acl.groups": `
If set and \`type\` is GROUP, the resource will only be available to these groups.

Use \`addGroupToAcl()\`/\`removeGroupFromAcl()\` mutations to edit these permissions.
`,
    "CreateProjectInvitesInput.projectInviteOptions": `List of emails (required) and fullnames`,
    "CreateProjectInvitesInput.groupNames": `List of group **names** (not ids)`,
    "CreateProjectInvitesInput.sendEmailNow": `If set to true, emails will be QUEUED for sending immediately`,
    SurveyAccessType: "Controls who has access to respond to a survey",
    "SurveyAccessType.PUBLIC": "Anyone can respond",
    "SurveyAccessType.INVITE_ONLY":
      "Only users part of an invited group or email invitation can respond",
    "Survey.invitedGroups": `
Listing of groups whose users should be invited to participate in the survey.

Use \`updateSurveyInvitedGroups()\` mutation to modify.
`,
    "Survey.surveyInvites": `All related survey invites. Survey invites will be automatically created for users in the groups specified by \`surveyInvitedGroups\`.`,
    "Survey.surveyResponsesConnection": `Responses related to this survey. End-users will have access to their own submitted or draft responses. Administrators will have access to their own, plus all submitted responses.`,
    "User.emailNotificationPreference": `Email notification preferences can be read and set by the current user session.
    These settings cannot be accessed by other users or SeaSketch project admins.`,
    "SurveyTokenInfo.token":
      "Signed token that can be used for accessing the survey",
    "SurveyTokenInfo.surveyId": "ID of related survey",
    "SurveyTokenInfo.projectId": "ID of related project",
    "Query.survey":
      "Note that when requesting a survey and related resources (project, forms & fields) from an invite link when anonymous, the `x-ss-survey-invite-token` header will need to be set in order to gain access to protected resources. For more details [see the wiki](https://github.com/seasketch/next/wiki/User-Ingress#survey-invites)",
    "Mutation.deleteTopic":
      "Can be performed by project admins at any time. Can only be performed by original author within 5 minutes of posting.",
    "Mutation.deletePost":
      "Can be performed by project admins at any time. Can only be performed by original author within 5 minutes of posting.",
  },
};
