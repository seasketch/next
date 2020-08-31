import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  /**
   * A signed eight-byte integer. The upper big integer values are greater than the
   * max value for a JavaScript number. Therefore all big integers will be output as
   * strings and not numbers.
   */
  BigInt: any;
  /** A location in a connection that can be used for resuming pagination. */
  Cursor: any;
  /**
   * A point in time as described by the [ISO
   * 8601](https://en.wikipedia.org/wiki/ISO_8601) standard. May or may not include a timezone.
   */
  Datetime: any;
  Email: any;
  /** The `GeoJSON` scalar type represents GeoJSON values as specified by[RFC 7946](https://tools.ietf.org/html/rfc7946). */
  GeoJSON: any;
  /** A JavaScript object encoded in the JSON format as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSON: any;
};

export enum AccessControlListType {
  AdminsOnly = 'ADMINS_ONLY',
  Group = 'GROUP',
  Public = 'PUBLIC'
}

/**
 * Access Control Lists can be associated with SketchClasses, Forums, and 
 * potentially other application resources to allow admins to control access based
 * on admin privileges or group membership. The behavior of the system is primarily
 * driven by the `type` and `groups` settings.
 * 
 * The [AUTHORIZATION.md file](https://github.com/seasketch/next/blob/master/packages/db/AUTHORIZATION.md#content-managed-by-an-access-control-list)
 * details how ACL functionality was added to the Forums type, and can be used as a
 * template to add ACL features to new types if needed.
 */
export type Acl = Node & {
  __typename?: 'Acl';
  forumIdRead?: Maybe<Scalars['Int']>;
  forumIdWrite?: Maybe<Scalars['Int']>;
  /**
   * If set and `type` is GROUP, the resource will only be available to these groups.
   * 
   * Use `addGroupToAcl()`/`removeGroupFromAcl()` mutations to edit these permissions.
   */
  groups?: Maybe<Array<Maybe<Group>>>;
  id: Scalars['Int'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** Reads a single `SketchClass` that is related to this `Acl`. */
  sketchClass?: Maybe<SketchClass>;
  sketchClassId?: Maybe<Scalars['Int']>;
  /** Control whether access control is PUBLIC, ADMINS_ONLY, or GROUP */
  type: AccessControlListType;
};


/**
 * Access Control Lists can be associated with SketchClasses, Forums, and 
 * potentially other application resources to allow admins to control access based
 * on admin privileges or group membership. The behavior of the system is primarily
 * driven by the `type` and `groups` settings.
 * 
 * The [AUTHORIZATION.md file](https://github.com/seasketch/next/blob/master/packages/db/AUTHORIZATION.md#content-managed-by-an-access-control-list)
 * details how ACL functionality was added to the Forums type, and can be used as a
 * template to add ACL features to new types if needed.
 */
export type AclGroupsArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};

/** Represents an update to a `Acl`. Fields that are set will be updated. */
export type AclPatch = {
  /** Control whether access control is PUBLIC, ADMINS_ONLY, or GROUP */
  type?: Maybe<AccessControlListType>;
};

/** All input for the `addGroupToAcl` mutation. */
export type AddGroupToAclInput = {
  aclId?: Maybe<Scalars['Int']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  groupId?: Maybe<Scalars['Int']>;
};

/** The output of our `addGroupToAcl` mutation. */
export type AddGroupToAclPayload = {
  __typename?: 'AddGroupToAclPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `addUserToGroup` mutation. */
export type AddUserToGroupInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  groupId?: Maybe<Scalars['Int']>;
  userId?: Maybe<Scalars['Int']>;
};

/** The output of our `addUserToGroup` mutation. */
export type AddUserToGroupPayload = {
  __typename?: 'AddUserToGroupPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `addValidChildSketchClass` mutation. */
export type AddValidChildSketchClassInput = {
  child?: Maybe<Scalars['Int']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  parent?: Maybe<Scalars['Int']>;
};

/** The output of our `addValidChildSketchClass` mutation. */
export type AddValidChildSketchClassPayload = {
  __typename?: 'AddValidChildSketchClassPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `approveParticipant` mutation. */
export type ApproveParticipantInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
  userId?: Maybe<Scalars['Int']>;
};

/** The output of our `approveParticipant` mutation. */
export type ApproveParticipantPayload = {
  __typename?: 'ApproveParticipantPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/**
 * Community guidelines can be set by project admins with standards for using the 
 * discussion forums. Users will be shown this content before making their first
 * post, and they will be shown when posts are hidden by moderators for violating
 * community standards.
 */
export type CommunityGuideline = Node & {
  __typename?: 'CommunityGuideline';
  /** JSON contents are expected to be used with a system like DraftJS on the client. */
  content: Scalars['JSON'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** Reads a single `Project` that is related to this `CommunityGuideline`. */
  project?: Maybe<Project>;
  projectId: Scalars['Int'];
};

/** An input for mutations affecting `CommunityGuideline` */
export type CommunityGuidelineInput = {
  /** JSON contents are expected to be used with a system like DraftJS on the client. */
  content?: Maybe<Scalars['JSON']>;
  projectId: Scalars['Int'];
};

/** Represents an update to a `CommunityGuideline`. Fields that are set will be updated. */
export type CommunityGuidelinePatch = {
  /** JSON contents are expected to be used with a system like DraftJS on the client. */
  content?: Maybe<Scalars['JSON']>;
};

/** All input for the `confirmOnboarded` mutation. */
export type ConfirmOnboardedInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
};

/** The output of our `confirmOnboarded` mutation. */
export type ConfirmOnboardedPayload = {
  __typename?: 'ConfirmOnboardedPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  user?: Maybe<User>;
  /** An edge for our `User`. May be used by Relay 1. */
  userEdge?: Maybe<UsersEdge>;
};


/** The output of our `confirmOnboarded` mutation. */
export type ConfirmOnboardedPayloadUserEdgeArgs = {
  orderBy?: Maybe<Array<UsersOrderBy>>;
};

/** All input for the `confirmProjectInviteWithSurveyToken` mutation. */
export type ConfirmProjectInviteWithSurveyTokenInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
};

/** The output of our `confirmProjectInviteWithSurveyToken` mutation. */
export type ConfirmProjectInviteWithSurveyTokenPayload = {
  __typename?: 'ConfirmProjectInviteWithSurveyTokenPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  integer?: Maybe<Scalars['Int']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `confirmProjectInviteWithVerifiedEmail` mutation. */
export type ConfirmProjectInviteWithVerifiedEmailInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
};

/** The output of our `confirmProjectInviteWithVerifiedEmail` mutation. */
export type ConfirmProjectInviteWithVerifiedEmailPayload = {
  __typename?: 'ConfirmProjectInviteWithVerifiedEmailPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  integer?: Maybe<Scalars['Int']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the create `CommunityGuideline` mutation. */
export type CreateCommunityGuidelineInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `CommunityGuideline` to be created by this mutation. */
  communityGuideline: CommunityGuidelineInput;
};

/** The output of our create `CommunityGuideline` mutation. */
export type CreateCommunityGuidelinePayload = {
  __typename?: 'CreateCommunityGuidelinePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `CommunityGuideline` that was created by this mutation. */
  communityGuideline?: Maybe<CommunityGuideline>;
  /** Reads a single `Project` that is related to this `CommunityGuideline`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the create `FormConditionalRenderingRule` mutation. */
export type CreateFormConditionalRenderingRuleInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `FormConditionalRenderingRule` to be created by this mutation. */
  formConditionalRenderingRule: FormConditionalRenderingRuleInput;
};

/** The output of our create `FormConditionalRenderingRule` mutation. */
export type CreateFormConditionalRenderingRulePayload = {
  __typename?: 'CreateFormConditionalRenderingRulePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `FormField` that is related to this `FormConditionalRenderingRule`. */
  field?: Maybe<FormField>;
  /** The `FormConditionalRenderingRule` that was created by this mutation. */
  formConditionalRenderingRule?: Maybe<FormConditionalRenderingRule>;
  /** An edge for our `FormConditionalRenderingRule`. May be used by Relay 1. */
  formConditionalRenderingRuleEdge?: Maybe<FormConditionalRenderingRulesEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our create `FormConditionalRenderingRule` mutation. */
export type CreateFormConditionalRenderingRulePayloadFormConditionalRenderingRuleEdgeArgs = {
  orderBy?: Maybe<Array<FormConditionalRenderingRulesOrderBy>>;
};

/** All input for the create `FormField` mutation. */
export type CreateFormFieldInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `FormField` to be created by this mutation. */
  formField: FormFieldInput;
};

/** The output of our create `FormField` mutation. */
export type CreateFormFieldPayload = {
  __typename?: 'CreateFormFieldPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `Form` that is related to this `FormField`. */
  form?: Maybe<Form>;
  /** The `FormField` that was created by this mutation. */
  formField?: Maybe<FormField>;
  /** An edge for our `FormField`. May be used by Relay 1. */
  formFieldEdge?: Maybe<FormFieldsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our create `FormField` mutation. */
export type CreateFormFieldPayloadFormFieldEdgeArgs = {
  orderBy?: Maybe<Array<FormFieldsOrderBy>>;
};

/** All input for the `createFormTemplateFromSketchClass` mutation. */
export type CreateFormTemplateFromSketchClassInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  sketchClassId?: Maybe<Scalars['Int']>;
  templateName?: Maybe<Scalars['String']>;
  templateType?: Maybe<FormTemplateType>;
};

/** The output of our `createFormTemplateFromSketchClass` mutation. */
export type CreateFormTemplateFromSketchClassPayload = {
  __typename?: 'CreateFormTemplateFromSketchClassPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  form?: Maybe<Form>;
  /** An edge for our `Form`. May be used by Relay 1. */
  formEdge?: Maybe<FormsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `SketchClass` that is related to this `Form`. */
  sketchClass?: Maybe<SketchClass>;
  /** Reads a single `Survey` that is related to this `Form`. */
  survey?: Maybe<Survey>;
};


/** The output of our `createFormTemplateFromSketchClass` mutation. */
export type CreateFormTemplateFromSketchClassPayloadFormEdgeArgs = {
  orderBy?: Maybe<Array<FormsOrderBy>>;
};

/** All input for the `createFormTemplateFromSurvey` mutation. */
export type CreateFormTemplateFromSurveyInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  surveyId?: Maybe<Scalars['Int']>;
  templateName?: Maybe<Scalars['String']>;
  templateType?: Maybe<FormTemplateType>;
};

/** The output of our `createFormTemplateFromSurvey` mutation. */
export type CreateFormTemplateFromSurveyPayload = {
  __typename?: 'CreateFormTemplateFromSurveyPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  form?: Maybe<Form>;
  /** An edge for our `Form`. May be used by Relay 1. */
  formEdge?: Maybe<FormsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `SketchClass` that is related to this `Form`. */
  sketchClass?: Maybe<SketchClass>;
  /** Reads a single `Survey` that is related to this `Form`. */
  survey?: Maybe<Survey>;
};


/** The output of our `createFormTemplateFromSurvey` mutation. */
export type CreateFormTemplateFromSurveyPayloadFormEdgeArgs = {
  orderBy?: Maybe<Array<FormsOrderBy>>;
};

/** All input for the create `Forum` mutation. */
export type CreateForumInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `Forum` to be created by this mutation. */
  forum: ForumInput;
};

/** The output of our create `Forum` mutation. */
export type CreateForumPayload = {
  __typename?: 'CreateForumPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `Forum` that was created by this mutation. */
  forum?: Maybe<Forum>;
  /** An edge for our `Forum`. May be used by Relay 1. */
  forumEdge?: Maybe<ForumsEdge>;
  /** Reads a single `Project` that is related to this `Forum`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our create `Forum` mutation. */
export type CreateForumPayloadForumEdgeArgs = {
  orderBy?: Maybe<Array<ForumsOrderBy>>;
};

/** All input for the create `Group` mutation. */
export type CreateGroupInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `Group` to be created by this mutation. */
  group: GroupInput;
};

/** The output of our create `Group` mutation. */
export type CreateGroupPayload = {
  __typename?: 'CreateGroupPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `Group` that was created by this mutation. */
  group?: Maybe<Group>;
  /** Reads a single `Project` that is related to this `Group`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `createPost` mutation. */
export type CreatePostInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  message?: Maybe<Scalars['JSON']>;
  topicId?: Maybe<Scalars['Int']>;
};

/** The output of our `createPost` mutation. */
export type CreatePostPayload = {
  __typename?: 'CreatePostPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  post?: Maybe<Post>;
  /** An edge for our `Post`. May be used by Relay 1. */
  postEdge?: Maybe<PostsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Topic` that is related to this `Post`. */
  topic?: Maybe<Topic>;
};


/** The output of our `createPost` mutation. */
export type CreatePostPayloadPostEdgeArgs = {
  orderBy?: Maybe<Array<PostsOrderBy>>;
};

/** All input for the `createProject` mutation. */
export type CreateProjectInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  name: Scalars['String'];
  slug: Scalars['String'];
};

/** All input for the create `ProjectInviteGroup` mutation. */
export type CreateProjectInviteGroupInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `ProjectInviteGroup` to be created by this mutation. */
  projectInviteGroup: ProjectInviteGroupInput;
};

/** The output of our create `ProjectInviteGroup` mutation. */
export type CreateProjectInviteGroupPayload = {
  __typename?: 'CreateProjectInviteGroupPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `ProjectInviteGroup` that was created by this mutation. */
  projectInviteGroup?: Maybe<ProjectInviteGroup>;
  /** An edge for our `ProjectInviteGroup`. May be used by Relay 1. */
  projectInviteGroupEdge?: Maybe<ProjectInviteGroupsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our create `ProjectInviteGroup` mutation. */
export type CreateProjectInviteGroupPayloadProjectInviteGroupEdgeArgs = {
  orderBy?: Maybe<Array<ProjectInviteGroupsOrderBy>>;
};

/** All input for the `createProjectInvites` mutation. */
export type CreateProjectInvitesInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** List of group **names** (not ids) */
  groupNames?: Maybe<Array<Maybe<Scalars['String']>>>;
  makeAdmin?: Maybe<Scalars['Boolean']>;
  projectId?: Maybe<Scalars['Int']>;
  /** List of emails (required) and fullnames */
  projectInviteOptions?: Maybe<Array<Maybe<ProjectInviteOptionInput>>>;
  /** If set to true, emails will be QUEUED for sending immediately */
  sendEmailNow?: Maybe<Scalars['Boolean']>;
};

/** The output of our `createProjectInvites` mutation. */
export type CreateProjectInvitesPayload = {
  __typename?: 'CreateProjectInvitesPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectInvites?: Maybe<Array<Maybe<ProjectInvite>>>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** The output of our `createProject` mutation. */
export type CreateProjectPayload = {
  __typename?: 'CreateProjectPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  project?: Maybe<Project>;
  /** An edge for our `Project`. May be used by Relay 1. */
  projectEdge?: Maybe<ProjectsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `createProject` mutation. */
export type CreateProjectPayloadProjectEdgeArgs = {
  orderBy?: Maybe<Array<ProjectsOrderBy>>;
};

/** All input for the create `SketchClass` mutation. */
export type CreateSketchClassInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `SketchClass` to be created by this mutation. */
  sketchClass: SketchClassInput;
};

/** The output of our create `SketchClass` mutation. */
export type CreateSketchClassPayload = {
  __typename?: 'CreateSketchClassPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `Project` that is related to this `SketchClass`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** The `SketchClass` that was created by this mutation. */
  sketchClass?: Maybe<SketchClass>;
  /** An edge for our `SketchClass`. May be used by Relay 1. */
  sketchClassEdge?: Maybe<SketchClassesEdge>;
};


/** The output of our create `SketchClass` mutation. */
export type CreateSketchClassPayloadSketchClassEdgeArgs = {
  orderBy?: Maybe<Array<SketchClassesOrderBy>>;
};

/** All input for the create `SketchFolder` mutation. */
export type CreateSketchFolderInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `SketchFolder` to be created by this mutation. */
  sketchFolder: SketchFolderInput;
};

/** The output of our create `SketchFolder` mutation. */
export type CreateSketchFolderPayload = {
  __typename?: 'CreateSketchFolderPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** The `SketchFolder` that was created by this mutation. */
  sketchFolder?: Maybe<SketchFolder>;
  /** An edge for our `SketchFolder`. May be used by Relay 1. */
  sketchFolderEdge?: Maybe<SketchFoldersEdge>;
};


/** The output of our create `SketchFolder` mutation. */
export type CreateSketchFolderPayloadSketchFolderEdgeArgs = {
  orderBy?: Maybe<Array<SketchFoldersOrderBy>>;
};

/** All input for the create `Sketch` mutation. */
export type CreateSketchInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `Sketch` to be created by this mutation. */
  sketch: SketchInput;
};

/** The output of our create `Sketch` mutation. */
export type CreateSketchPayload = {
  __typename?: 'CreateSketchPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `Sketch` that is related to this `Sketch`. */
  collection?: Maybe<Sketch>;
  /** Reads a single `Sketch` that is related to this `Sketch`. */
  copiedFrom?: Maybe<Sketch>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** The `Sketch` that was created by this mutation. */
  sketch?: Maybe<Sketch>;
  /** Reads a single `SketchClass` that is related to this `Sketch`. */
  sketchClass?: Maybe<SketchClass>;
  /** Reads a single `User` that is related to this `Sketch`. */
  user?: Maybe<User>;
};

/** All input for the create `Survey` mutation. */
export type CreateSurveyInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `Survey` to be created by this mutation. */
  survey: SurveyInput;
};

/** All input for the create `SurveyInvitedGroup` mutation. */
export type CreateSurveyInvitedGroupInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `SurveyInvitedGroup` to be created by this mutation. */
  surveyInvitedGroup: SurveyInvitedGroupInput;
};

/** The output of our create `SurveyInvitedGroup` mutation. */
export type CreateSurveyInvitedGroupPayload = {
  __typename?: 'CreateSurveyInvitedGroupPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Survey` that is related to this `SurveyInvitedGroup`. */
  survey?: Maybe<Survey>;
  /** The `SurveyInvitedGroup` that was created by this mutation. */
  surveyInvitedGroup?: Maybe<SurveyInvitedGroup>;
};

/** All input for the `createSurveyInvites` mutation. */
export type CreateSurveyInvitesInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  groupNames?: Maybe<Array<Maybe<Scalars['String']>>>;
  includeProjectInvite?: Maybe<Scalars['Boolean']>;
  makeAdmin?: Maybe<Scalars['Boolean']>;
  surveyId?: Maybe<Scalars['Int']>;
  surveyInviteOptions?: Maybe<Array<Maybe<SurveyInviteOptionsInput>>>;
};

/** The output of our `createSurveyInvites` mutation. */
export type CreateSurveyInvitesPayload = {
  __typename?: 'CreateSurveyInvitesPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  surveyInvites?: Maybe<Array<Maybe<SurveyInvite>>>;
};

/** The output of our create `Survey` mutation. */
export type CreateSurveyPayload = {
  __typename?: 'CreateSurveyPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `Project` that is related to this `Survey`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** The `Survey` that was created by this mutation. */
  survey?: Maybe<Survey>;
};

/** All input for the create `SurveyResponse` mutation. */
export type CreateSurveyResponseInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `SurveyResponse` to be created by this mutation. */
  surveyResponse: SurveyResponseInput;
};

/** The output of our create `SurveyResponse` mutation. */
export type CreateSurveyResponsePayload = {
  __typename?: 'CreateSurveyResponsePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Survey` that is related to this `SurveyResponse`. */
  survey?: Maybe<Survey>;
  /** The `SurveyResponse` that was created by this mutation. */
  surveyResponse?: Maybe<SurveyResponse>;
  /** An edge for our `SurveyResponse`. May be used by Relay 1. */
  surveyResponseEdge?: Maybe<SurveyResponsesEdge>;
};


/** The output of our create `SurveyResponse` mutation. */
export type CreateSurveyResponsePayloadSurveyResponseEdgeArgs = {
  orderBy?: Maybe<Array<SurveyResponsesOrderBy>>;
};

/** All input for the `createTopic` mutation. */
export type CreateTopicInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  forumId?: Maybe<Scalars['Int']>;
  message?: Maybe<Scalars['JSON']>;
  title?: Maybe<Scalars['String']>;
};

/** The output of our `createTopic` mutation. */
export type CreateTopicPayload = {
  __typename?: 'CreateTopicPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `Forum` that is related to this `Topic`. */
  forum?: Maybe<Forum>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  topic?: Maybe<Topic>;
  /** An edge for our `Topic`. May be used by Relay 1. */
  topicEdge?: Maybe<TopicsEdge>;
};


/** The output of our `createTopic` mutation. */
export type CreateTopicPayloadTopicEdgeArgs = {
  orderBy?: Maybe<Array<TopicsOrderBy>>;
};



/** All input for the `deleteCommunityGuidelineByNodeId` mutation. */
export type DeleteCommunityGuidelineByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `CommunityGuideline` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteCommunityGuideline` mutation. */
export type DeleteCommunityGuidelineInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectId: Scalars['Int'];
};

/** The output of our delete `CommunityGuideline` mutation. */
export type DeleteCommunityGuidelinePayload = {
  __typename?: 'DeleteCommunityGuidelinePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `CommunityGuideline` that was deleted by this mutation. */
  communityGuideline?: Maybe<CommunityGuideline>;
  deletedCommunityGuidelineNodeId?: Maybe<Scalars['ID']>;
  /** Reads a single `Project` that is related to this `CommunityGuideline`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `deleteFormByNodeId` mutation. */
export type DeleteFormByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Form` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteFormBySketchClassId` mutation. */
export type DeleteFormBySketchClassIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Related *SketchClass* */
  sketchClassId: Scalars['Int'];
};

/** All input for the `deleteFormBySurveyId` mutation. */
export type DeleteFormBySurveyIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Related *Survey* */
  surveyId: Scalars['Int'];
};

/** All input for the `deleteFormConditionalRenderingRuleByNodeId` mutation. */
export type DeleteFormConditionalRenderingRuleByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `FormConditionalRenderingRule` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteFormConditionalRenderingRule` mutation. */
export type DeleteFormConditionalRenderingRuleInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `FormConditionalRenderingRule` mutation. */
export type DeleteFormConditionalRenderingRulePayload = {
  __typename?: 'DeleteFormConditionalRenderingRulePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedFormConditionalRenderingRuleNodeId?: Maybe<Scalars['ID']>;
  /** Reads a single `FormField` that is related to this `FormConditionalRenderingRule`. */
  field?: Maybe<FormField>;
  /** The `FormConditionalRenderingRule` that was deleted by this mutation. */
  formConditionalRenderingRule?: Maybe<FormConditionalRenderingRule>;
  /** An edge for our `FormConditionalRenderingRule`. May be used by Relay 1. */
  formConditionalRenderingRuleEdge?: Maybe<FormConditionalRenderingRulesEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our delete `FormConditionalRenderingRule` mutation. */
export type DeleteFormConditionalRenderingRulePayloadFormConditionalRenderingRuleEdgeArgs = {
  orderBy?: Maybe<Array<FormConditionalRenderingRulesOrderBy>>;
};

/** All input for the `deleteFormFieldByNodeId` mutation. */
export type DeleteFormFieldByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `FormField` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteFormField` mutation. */
export type DeleteFormFieldInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `FormField` mutation. */
export type DeleteFormFieldPayload = {
  __typename?: 'DeleteFormFieldPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedFormFieldNodeId?: Maybe<Scalars['ID']>;
  /** Reads a single `Form` that is related to this `FormField`. */
  form?: Maybe<Form>;
  /** The `FormField` that was deleted by this mutation. */
  formField?: Maybe<FormField>;
  /** An edge for our `FormField`. May be used by Relay 1. */
  formFieldEdge?: Maybe<FormFieldsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our delete `FormField` mutation. */
export type DeleteFormFieldPayloadFormFieldEdgeArgs = {
  orderBy?: Maybe<Array<FormFieldsOrderBy>>;
};

/** All input for the `deleteForm` mutation. */
export type DeleteFormInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `Form` mutation. */
export type DeleteFormPayload = {
  __typename?: 'DeleteFormPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedFormNodeId?: Maybe<Scalars['ID']>;
  /** The `Form` that was deleted by this mutation. */
  form?: Maybe<Form>;
  /** An edge for our `Form`. May be used by Relay 1. */
  formEdge?: Maybe<FormsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `SketchClass` that is related to this `Form`. */
  sketchClass?: Maybe<SketchClass>;
  /** Reads a single `Survey` that is related to this `Form`. */
  survey?: Maybe<Survey>;
};


/** The output of our delete `Form` mutation. */
export type DeleteFormPayloadFormEdgeArgs = {
  orderBy?: Maybe<Array<FormsOrderBy>>;
};

/** All input for the `deleteForumByNodeId` mutation. */
export type DeleteForumByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Forum` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteForum` mutation. */
export type DeleteForumInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `Forum` mutation. */
export type DeleteForumPayload = {
  __typename?: 'DeleteForumPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedForumNodeId?: Maybe<Scalars['ID']>;
  /** The `Forum` that was deleted by this mutation. */
  forum?: Maybe<Forum>;
  /** An edge for our `Forum`. May be used by Relay 1. */
  forumEdge?: Maybe<ForumsEdge>;
  /** Reads a single `Project` that is related to this `Forum`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our delete `Forum` mutation. */
export type DeleteForumPayloadForumEdgeArgs = {
  orderBy?: Maybe<Array<ForumsOrderBy>>;
};

/** All input for the `deleteGroupByNodeId` mutation. */
export type DeleteGroupByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Group` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteGroupByProjectIdAndName` mutation. */
export type DeleteGroupByProjectIdAndNameInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Label for the group. */
  name: Scalars['String'];
  projectId: Scalars['Int'];
};

/** All input for the `deleteGroup` mutation. */
export type DeleteGroupInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `Group` mutation. */
export type DeleteGroupPayload = {
  __typename?: 'DeleteGroupPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedProjectGroupNodeId?: Maybe<Scalars['ID']>;
  /** The `Group` that was deleted by this mutation. */
  group?: Maybe<Group>;
  /** Reads a single `Project` that is related to this `Group`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `deletePostByNodeId` mutation. */
export type DeletePostByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Post` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deletePost` mutation. */
export type DeletePostInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `Post` mutation. */
export type DeletePostPayload = {
  __typename?: 'DeletePostPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedPostNodeId?: Maybe<Scalars['ID']>;
  /** The `Post` that was deleted by this mutation. */
  post?: Maybe<Post>;
  /** An edge for our `Post`. May be used by Relay 1. */
  postEdge?: Maybe<PostsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Topic` that is related to this `Post`. */
  topic?: Maybe<Topic>;
};


/** The output of our delete `Post` mutation. */
export type DeletePostPayloadPostEdgeArgs = {
  orderBy?: Maybe<Array<PostsOrderBy>>;
};

/** All input for the `deleteProject` mutation. */
export type DeleteProjectInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectId: Scalars['Int'];
};

/** All input for the `deleteProjectInviteByEmailAndProjectId` mutation. */
export type DeleteProjectInviteByEmailAndProjectIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Specified by admin when invite was created. */
  email: Scalars['Email'];
  projectId: Scalars['Int'];
};

/** All input for the `deleteProjectInviteByNodeId` mutation. */
export type DeleteProjectInviteByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `ProjectInvite` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteProjectInviteGroupByInviteIdAndGroupId` mutation. */
export type DeleteProjectInviteGroupByInviteIdAndGroupIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  groupId: Scalars['Int'];
  inviteId: Scalars['Int'];
};

/** The output of our delete `ProjectInviteGroup` mutation. */
export type DeleteProjectInviteGroupPayload = {
  __typename?: 'DeleteProjectInviteGroupPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedProjectInviteGroupNodeId?: Maybe<Scalars['ID']>;
  /** The `ProjectInviteGroup` that was deleted by this mutation. */
  projectInviteGroup?: Maybe<ProjectInviteGroup>;
  /** An edge for our `ProjectInviteGroup`. May be used by Relay 1. */
  projectInviteGroupEdge?: Maybe<ProjectInviteGroupsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our delete `ProjectInviteGroup` mutation. */
export type DeleteProjectInviteGroupPayloadProjectInviteGroupEdgeArgs = {
  orderBy?: Maybe<Array<ProjectInviteGroupsOrderBy>>;
};

/** All input for the `deleteProjectInvite` mutation. */
export type DeleteProjectInviteInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `ProjectInvite` mutation. */
export type DeleteProjectInvitePayload = {
  __typename?: 'DeleteProjectInvitePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedProjectInviteNodeId?: Maybe<Scalars['ID']>;
  /** The `ProjectInvite` that was deleted by this mutation. */
  projectInvite?: Maybe<ProjectInvite>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** The output of our `deleteProject` mutation. */
export type DeleteProjectPayload = {
  __typename?: 'DeleteProjectPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  project?: Maybe<Project>;
  /** An edge for our `Project`. May be used by Relay 1. */
  projectEdge?: Maybe<ProjectsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `deleteProject` mutation. */
export type DeleteProjectPayloadProjectEdgeArgs = {
  orderBy?: Maybe<Array<ProjectsOrderBy>>;
};

/** All input for the `deleteSketchByNodeId` mutation. */
export type DeleteSketchByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Sketch` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteSketchClassByNodeId` mutation. */
export type DeleteSketchClassByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `SketchClass` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteSketchClass` mutation. */
export type DeleteSketchClassInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `SketchClass` mutation. */
export type DeleteSketchClassPayload = {
  __typename?: 'DeleteSketchClassPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedSketchClassNodeId?: Maybe<Scalars['ID']>;
  /** Reads a single `Project` that is related to this `SketchClass`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** The `SketchClass` that was deleted by this mutation. */
  sketchClass?: Maybe<SketchClass>;
  /** An edge for our `SketchClass`. May be used by Relay 1. */
  sketchClassEdge?: Maybe<SketchClassesEdge>;
};


/** The output of our delete `SketchClass` mutation. */
export type DeleteSketchClassPayloadSketchClassEdgeArgs = {
  orderBy?: Maybe<Array<SketchClassesOrderBy>>;
};

/** All input for the `deleteSketchFolderByNodeId` mutation. */
export type DeleteSketchFolderByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `SketchFolder` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteSketchFolder` mutation. */
export type DeleteSketchFolderInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `SketchFolder` mutation. */
export type DeleteSketchFolderPayload = {
  __typename?: 'DeleteSketchFolderPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedSketchFolderNodeId?: Maybe<Scalars['ID']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** The `SketchFolder` that was deleted by this mutation. */
  sketchFolder?: Maybe<SketchFolder>;
  /** An edge for our `SketchFolder`. May be used by Relay 1. */
  sketchFolderEdge?: Maybe<SketchFoldersEdge>;
};


/** The output of our delete `SketchFolder` mutation. */
export type DeleteSketchFolderPayloadSketchFolderEdgeArgs = {
  orderBy?: Maybe<Array<SketchFoldersOrderBy>>;
};

/** All input for the `deleteSketch` mutation. */
export type DeleteSketchInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `Sketch` mutation. */
export type DeleteSketchPayload = {
  __typename?: 'DeleteSketchPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `Sketch` that is related to this `Sketch`. */
  collection?: Maybe<Sketch>;
  /** Reads a single `Sketch` that is related to this `Sketch`. */
  copiedFrom?: Maybe<Sketch>;
  deletedSketchNodeId?: Maybe<Scalars['ID']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** The `Sketch` that was deleted by this mutation. */
  sketch?: Maybe<Sketch>;
  /** Reads a single `SketchClass` that is related to this `Sketch`. */
  sketchClass?: Maybe<SketchClass>;
  /** Reads a single `User` that is related to this `Sketch`. */
  user?: Maybe<User>;
};

/** All input for the `deleteSurveyByNodeId` mutation. */
export type DeleteSurveyByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Survey` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteSurvey` mutation. */
export type DeleteSurveyInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** All input for the `deleteSurveyInviteByEmailAndSurveyId` mutation. */
export type DeleteSurveyInviteByEmailAndSurveyIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  email: Scalars['Email'];
  surveyId: Scalars['Int'];
};

/** All input for the `deleteSurveyInviteByEmail` mutation. */
export type DeleteSurveyInviteByEmailInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  email: Scalars['Email'];
};

/** All input for the `deleteSurveyInviteByNodeId` mutation. */
export type DeleteSurveyInviteByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `SurveyInvite` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteSurveyInvitedGroupBySurveyIdAndGroupId` mutation. */
export type DeleteSurveyInvitedGroupBySurveyIdAndGroupIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  groupId: Scalars['Int'];
  surveyId: Scalars['Int'];
};

/** The output of our delete `SurveyInvitedGroup` mutation. */
export type DeleteSurveyInvitedGroupPayload = {
  __typename?: 'DeleteSurveyInvitedGroupPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedSurveyInvitedGroupNodeId?: Maybe<Scalars['ID']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Survey` that is related to this `SurveyInvitedGroup`. */
  survey?: Maybe<Survey>;
  /** The `SurveyInvitedGroup` that was deleted by this mutation. */
  surveyInvitedGroup?: Maybe<SurveyInvitedGroup>;
};

/** All input for the `deleteSurveyInvite` mutation. */
export type DeleteSurveyInviteInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `SurveyInvite` mutation. */
export type DeleteSurveyInvitePayload = {
  __typename?: 'DeleteSurveyInvitePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedSurveyInviteNodeId?: Maybe<Scalars['ID']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Survey` that is related to this `SurveyInvite`. */
  survey?: Maybe<Survey>;
  /** The `SurveyInvite` that was deleted by this mutation. */
  surveyInvite?: Maybe<SurveyInvite>;
  /** An edge for our `SurveyInvite`. May be used by Relay 1. */
  surveyInviteEdge?: Maybe<SurveyInvitesEdge>;
};


/** The output of our delete `SurveyInvite` mutation. */
export type DeleteSurveyInvitePayloadSurveyInviteEdgeArgs = {
  orderBy?: Maybe<Array<SurveyInvitesOrderBy>>;
};

/** The output of our delete `Survey` mutation. */
export type DeleteSurveyPayload = {
  __typename?: 'DeleteSurveyPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedSurveyNodeId?: Maybe<Scalars['ID']>;
  /** Reads a single `Project` that is related to this `Survey`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** The `Survey` that was deleted by this mutation. */
  survey?: Maybe<Survey>;
};

/** All input for the `deleteSurveyResponseByNodeId` mutation. */
export type DeleteSurveyResponseByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `SurveyResponse` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteSurveyResponse` mutation. */
export type DeleteSurveyResponseInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `SurveyResponse` mutation. */
export type DeleteSurveyResponsePayload = {
  __typename?: 'DeleteSurveyResponsePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedSurveyResponseNodeId?: Maybe<Scalars['ID']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Survey` that is related to this `SurveyResponse`. */
  survey?: Maybe<Survey>;
  /** The `SurveyResponse` that was deleted by this mutation. */
  surveyResponse?: Maybe<SurveyResponse>;
  /** An edge for our `SurveyResponse`. May be used by Relay 1. */
  surveyResponseEdge?: Maybe<SurveyResponsesEdge>;
};


/** The output of our delete `SurveyResponse` mutation. */
export type DeleteSurveyResponsePayloadSurveyResponseEdgeArgs = {
  orderBy?: Maybe<Array<SurveyResponsesOrderBy>>;
};

/** All input for the `deleteTopicByNodeId` mutation. */
export type DeleteTopicByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Topic` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteTopic` mutation. */
export type DeleteTopicInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `Topic` mutation. */
export type DeleteTopicPayload = {
  __typename?: 'DeleteTopicPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedTopicNodeId?: Maybe<Scalars['ID']>;
  /** Reads a single `Forum` that is related to this `Topic`. */
  forum?: Maybe<Forum>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** The `Topic` that was deleted by this mutation. */
  topic?: Maybe<Topic>;
  /** An edge for our `Topic`. May be used by Relay 1. */
  topicEdge?: Maybe<TopicsEdge>;
};


/** The output of our delete `Topic` mutation. */
export type DeleteTopicPayloadTopicEdgeArgs = {
  orderBy?: Maybe<Array<TopicsOrderBy>>;
};

/** All input for the `disableForumPosting` mutation. */
export type DisableForumPostingInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
  userId?: Maybe<Scalars['Int']>;
};

/** The output of our `disableForumPosting` mutation. */
export type DisableForumPostingPayload = {
  __typename?: 'DisableForumPostingPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/**
 * Email notification preferences can be read and set by the current user session.
 * These settings cannot be accessed by other users or SeaSketch project admins.
 */
export type EmailNotificationPreference = {
  __typename?: 'EmailNotificationPreference';
  /**
   * Email used when registering the account in Auth0. This email cannot be
   * updated through the API, though it may be possible to do so manually by
   * SeaSketch developers.
   * 
   * This is the email by which users will recieve transactional emails like
   * project and survey invites, and email notifications.
   */
  canonicalEmail?: Maybe<Scalars['String']>;
  /** How often users should be notified of SeaSketch project activity. */
  frequency: EmailSummaryFrequency;
  /**
   * If set, users should receive realtime notifications of responses to discussion
   * forum threads for which they are a participant.
   */
  notifyOnReply: Scalars['Boolean'];
  /**
   * If selected, users should receive absolutely no email from SeaSketch. Invite 
   * emails should not be sent and their status should be set to UNSUBSCRIBED.
   */
  unsubscribeAll: Scalars['Boolean'];
  /** Reads a single `User` that is related to this `EmailNotificationPreference`. */
  user?: Maybe<User>;
  userId: Scalars['Int'];
};

/**
 * A condition to be used against `EmailNotificationPreference` object types. All
 * fields are tested for equality and combined with a logical ‘and.’
 */
export type EmailNotificationPreferenceCondition = {
  /** Checks for equality with the object’s `userId` field. */
  userId?: Maybe<Scalars['Int']>;
};

/** Represents an update to a `EmailNotificationPreference`. Fields that are set will be updated. */
export type EmailNotificationPreferencePatch = {
  /** How often users should be notified of SeaSketch project activity. */
  frequency?: Maybe<EmailSummaryFrequency>;
  /**
   * If set, users should receive realtime notifications of responses to discussion
   * forum threads for which they are a participant.
   */
  notifyOnReply?: Maybe<Scalars['Boolean']>;
  /**
   * If selected, users should receive absolutely no email from SeaSketch. Invite 
   * emails should not be sent and their status should be set to UNSUBSCRIBED.
   */
  unsubscribeAll?: Maybe<Scalars['Boolean']>;
  userId?: Maybe<Scalars['Int']>;
};

/** A connection to a list of `EmailNotificationPreference` values. */
export type EmailNotificationPreferencesConnection = {
  __typename?: 'EmailNotificationPreferencesConnection';
  /** A list of edges which contains the `EmailNotificationPreference` and cursor to aid in pagination. */
  edges: Array<EmailNotificationPreferencesEdge>;
  /** A list of `EmailNotificationPreference` objects. */
  nodes: Array<Maybe<EmailNotificationPreference>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `EmailNotificationPreference` you could get from the connection. */
  totalCount: Scalars['Int'];
};

/** A `EmailNotificationPreference` edge in the connection. */
export type EmailNotificationPreferencesEdge = {
  __typename?: 'EmailNotificationPreferencesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `EmailNotificationPreference` at the end of the edge. */
  node?: Maybe<EmailNotificationPreference>;
};

/** Methods to use when ordering `EmailNotificationPreference`. */
export enum EmailNotificationPreferencesOrderBy {
  Natural = 'NATURAL',
  UserIdAsc = 'USER_ID_ASC',
  UserIdDesc = 'USER_ID_DESC'
}

export enum EmailStatus {
  /**
   * Emails may be bounced due to a full inbox, misconfigured mail server, or other
   * reasons. See [AWS SES documentation](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/monitor-using-event-publishing.html#event-publishing-terminology).
   */
  Bounced = 'BOUNCED',
  /**
   * User has reported SeaSketch as sending Spam in this or another project.
   * SeaSketch will no longer send emails to this user in any project.
   */
  Complaint = 'COMPLAINT',
  /** Delivered to the user's mail server */
  Delivered = 'DELIVERED',
  /** SeaSketch application error when sending invite emails. Refer to email status */
  Error = 'ERROR',
  /** Admin has sent the invite, but the mail delivery subsystem has not yet sent the invite */
  Queued = 'QUEUED',
  /** Invite email has been sent but not yet delivered to the user's mail server */
  Sent = 'SENT',
  /**
   * The user has unsubscribed from all emails originating from SeaSketch.
   * 
   * If this happens SeaSketch will not be able to send any invitations to the user.
   */
  Unsubscribed = 'UNSUBSCRIBED'
}

export enum EmailSummaryFrequency {
  Daily = 'DAILY',
  Never = 'NEVER',
  Weekly = 'WEEKLY'
}

/** All input for the `enableForumPosting` mutation. */
export type EnableForumPostingInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
  userId?: Maybe<Scalars['Int']>;
};

/** The output of our `enableForumPosting` mutation. */
export type EnableForumPostingPayload = {
  __typename?: 'EnableForumPostingPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

export enum FieldRuleOperator {
  /** String contains value */
  Contains = 'CONTAINS',
  Equal = 'EQUAL',
  GreaterThan = 'GREATER_THAN',
  /** Empty string input or no choice selection */
  IsBlank = 'IS_BLANK',
  /** Predicate field value is less than specified value */
  LessThan = 'LESS_THAN',
  NotEqual = 'NOT_EQUAL'
}

/**
 * Custom user-input Forms are used in two places in SeaSketch. For SketchClasses,
 * Forms are used to add attributes to spatial features. In Surveys, Forms are used
 * in support of gathering response data.
 * 
 * Forms have any number of *FormFields* ordered by a `position` field, and form 
 * contents may be hidden depending on the evaluation of *FormConditionalRenderingRules*.
 * 
 * Forms typically belong to either a *Survey* or *SketchClass* exclusively. Some
 * Forms may be designated as a template, in which case they belong to neither. 
 * Only superusers can create form templates, and clients should provide templates
 * as an option when creating new forms.
 */
export type Form = Node & {
  __typename?: 'Form';
  /** List of all FormFields in this form. */
  formFields: Array<FormField>;
  id: Scalars['Int'];
  /**
   * SeaSetch superusers can create template forms than can be used when creating 
   * SketchClasses or Surveys. These templates can be created using the 
   * `createFormTemplateFromSketchClass` and `createFormTemplateFromSurvey` 
   * mutations. Template forms can be listed with the root-level `templateForms` 
   * query.
   */
  isTemplate: Scalars['Boolean'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** Reads a single `SketchClass` that is related to this `Form`. */
  sketchClass?: Maybe<SketchClass>;
  /** Related *SketchClass* */
  sketchClassId?: Maybe<Scalars['Int']>;
  /** Reads a single `Survey` that is related to this `Form`. */
  survey?: Maybe<Survey>;
  /** Related *Survey* */
  surveyId?: Maybe<Scalars['Int']>;
  /** Chosen by superusers upon template creation */
  templateName?: Maybe<Scalars['String']>;
  /** Indicates which features should use this form as a template */
  templateType?: Maybe<FormTemplateType>;
};


/**
 * Custom user-input Forms are used in two places in SeaSketch. For SketchClasses,
 * Forms are used to add attributes to spatial features. In Surveys, Forms are used
 * in support of gathering response data.
 * 
 * Forms have any number of *FormFields* ordered by a `position` field, and form 
 * contents may be hidden depending on the evaluation of *FormConditionalRenderingRules*.
 * 
 * Forms typically belong to either a *Survey* or *SketchClass* exclusively. Some
 * Forms may be designated as a template, in which case they belong to neither. 
 * Only superusers can create form templates, and clients should provide templates
 * as an option when creating new forms.
 */
export type FormFormFieldsArgs = {
  condition?: Maybe<FormFieldCondition>;
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<FormFieldsOrderBy>>;
};

/** A condition to be used against `Form` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type FormCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `isTemplate` field. */
  isTemplate?: Maybe<Scalars['Boolean']>;
  /** Checks for equality with the object’s `sketchClassId` field. */
  sketchClassId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `surveyId` field. */
  surveyId?: Maybe<Scalars['Int']>;
};

/**
 * If any rendering rules are set, at least one rule must evaluate true for the 
 * field to be displayed to users. isRequired rules on *FormFields* should not be
 * enforced for fields that are hidden by a rule.
 * 
 * An example of a rule would be:
 * 
 * SHOW fieldB if fieldA GREATER_THAN 5
 */
export type FormConditionalRenderingRule = Node & {
  __typename?: 'FormConditionalRenderingRule';
  /** Reads a single `FormField` that is related to this `FormConditionalRenderingRule`. */
  field?: Maybe<FormField>;
  /** Field that will be hidden unless the rule evaluates true */
  fieldId: Scalars['Int'];
  id: Scalars['Int'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** Comparison operation */
  operator: FieldRuleOperator;
  /** Field that is evaluated */
  predicateFieldId: Scalars['Int'];
  /** Value that predicate_field.value is compared to */
  value?: Maybe<Scalars['String']>;
};

/**
 * A condition to be used against `FormConditionalRenderingRule` object types. All
 * fields are tested for equality and combined with a logical ‘and.’
 */
export type FormConditionalRenderingRuleCondition = {
  /** Checks for equality with the object’s `fieldId` field. */
  fieldId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
};

/** An input for mutations affecting `FormConditionalRenderingRule` */
export type FormConditionalRenderingRuleInput = {
  /** Field that will be hidden unless the rule evaluates true */
  fieldId: Scalars['Int'];
  id?: Maybe<Scalars['Int']>;
  /** Comparison operation */
  operator?: Maybe<FieldRuleOperator>;
  /** Field that is evaluated */
  predicateFieldId: Scalars['Int'];
  /** Value that predicate_field.value is compared to */
  value?: Maybe<Scalars['String']>;
};

/** Represents an update to a `FormConditionalRenderingRule`. Fields that are set will be updated. */
export type FormConditionalRenderingRulePatch = {
  /** Field that will be hidden unless the rule evaluates true */
  fieldId?: Maybe<Scalars['Int']>;
  /** Comparison operation */
  operator?: Maybe<FieldRuleOperator>;
  /** Field that is evaluated */
  predicateFieldId?: Maybe<Scalars['Int']>;
  /** Value that predicate_field.value is compared to */
  value?: Maybe<Scalars['String']>;
};

/** A `FormConditionalRenderingRule` edge in the connection. */
export type FormConditionalRenderingRulesEdge = {
  __typename?: 'FormConditionalRenderingRulesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `FormConditionalRenderingRule` at the end of the edge. */
  node?: Maybe<FormConditionalRenderingRule>;
};

/** Methods to use when ordering `FormConditionalRenderingRule`. */
export enum FormConditionalRenderingRulesOrderBy {
  FieldIdAsc = 'FIELD_ID_ASC',
  FieldIdDesc = 'FIELD_ID_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

/**
 * *FormFields* represent input fields in a form. Records contain fields to support
 * generic functionality like name, description, position, and isRequired. They 
 * also have a JSON `componentSettings` field that can have custom data to support
 * a particular input type, indicated by the `type` field.
 * 
 * Project administrators have full control over managing form fields through
 * graphile-generated CRUD mutations.
 */
export type FormField = Node & {
  __typename?: 'FormField';
  /** Type-specific configuration. For example, a Choice field might have a list of valid choices. */
  componentSettings: Scalars['JSON'];
  /** Set of rules that determine the visibility of this field. */
  conditionalRenderingRules: Array<FormConditionalRenderingRule>;
  /** Question description. Max length 500 characters */
  description?: Maybe<Scalars['String']>;
  /** Column name in csv export, property name in reporting tools. Keep stable to avoid breaking reports */
  exportId: Scalars['String'];
  /** Reads a single `Form` that is related to this `FormField`. */
  form?: Maybe<Form>;
  /** Form this field belongs to. */
  formId: Scalars['Int'];
  id: Scalars['Int'];
  /** Users must provide input for these fields before submission. */
  isRequired: Scalars['Boolean'];
  /** Question label */
  name: Scalars['String'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /**
   * Determines order of field display. Clients should display fields in ascending 
   * order. Cannot be changed individually. Use `setFormFieldOrder()` mutation to 
   * update.
   */
  position: Scalars['Int'];
  /**
   * Indicates the input type. Each input type has a client-side component
   * implementation with custom configuration properties stored in
   * `componentSettings`.
   */
  type: FormFieldType;
};


/**
 * *FormFields* represent input fields in a form. Records contain fields to support
 * generic functionality like name, description, position, and isRequired. They 
 * also have a JSON `componentSettings` field that can have custom data to support
 * a particular input type, indicated by the `type` field.
 * 
 * Project administrators have full control over managing form fields through
 * graphile-generated CRUD mutations.
 */
export type FormFieldConditionalRenderingRulesArgs = {
  condition?: Maybe<FormConditionalRenderingRuleCondition>;
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<FormConditionalRenderingRulesOrderBy>>;
};

/**
 * A condition to be used against `FormField` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type FormFieldCondition = {
  /** Checks for equality with the object’s `formId` field. */
  formId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
};

/** An input for mutations affecting `FormField` */
export type FormFieldInput = {
  /** Type-specific configuration. For example, a Choice field might have a list of valid choices. */
  componentSettings?: Maybe<Scalars['JSON']>;
  /** Question description. Max length 500 characters */
  description?: Maybe<Scalars['String']>;
  /** Column name in csv export, property name in reporting tools. Keep stable to avoid breaking reports */
  exportId: Scalars['String'];
  /** Form this field belongs to. */
  formId: Scalars['Int'];
  id?: Maybe<Scalars['Int']>;
  /** Users must provide input for these fields before submission. */
  isRequired?: Maybe<Scalars['Boolean']>;
  /** Question label */
  name: Scalars['String'];
  /**
   * Determines order of field display. Clients should display fields in ascending 
   * order. Cannot be changed individually. Use `setFormFieldOrder()` mutation to 
   * update.
   */
  position?: Maybe<Scalars['Int']>;
  /**
   * Indicates the input type. Each input type has a client-side component
   * implementation with custom configuration properties stored in
   * `componentSettings`.
   */
  type: FormFieldType;
};

/** Represents an update to a `FormField`. Fields that are set will be updated. */
export type FormFieldPatch = {
  /** Type-specific configuration. For example, a Choice field might have a list of valid choices. */
  componentSettings?: Maybe<Scalars['JSON']>;
  /** Question description. Max length 500 characters */
  description?: Maybe<Scalars['String']>;
  /** Column name in csv export, property name in reporting tools. Keep stable to avoid breaking reports */
  exportId?: Maybe<Scalars['String']>;
  /** Users must provide input for these fields before submission. */
  isRequired?: Maybe<Scalars['Boolean']>;
  /** Question label */
  name?: Maybe<Scalars['String']>;
  /**
   * Determines order of field display. Clients should display fields in ascending 
   * order. Cannot be changed individually. Use `setFormFieldOrder()` mutation to 
   * update.
   */
  position?: Maybe<Scalars['Int']>;
  /**
   * Indicates the input type. Each input type has a client-side component
   * implementation with custom configuration properties stored in
   * `componentSettings`.
   */
  type?: Maybe<FormFieldType>;
};

/** A `FormField` edge in the connection. */
export type FormFieldsEdge = {
  __typename?: 'FormFieldsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `FormField` at the end of the edge. */
  node?: Maybe<FormField>;
};

/** Methods to use when ordering `FormField`. */
export enum FormFieldsOrderBy {
  FormIdAsc = 'FORM_ID_ASC',
  FormIdDesc = 'FORM_ID_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

/**
 * FormField input types. Each type will need a custom client-side component. 
 * This list will expand as the application supports new types. New types can be 
 * added by using the command: 
 * 
 * `alter type form_field_type add value 'NEW_TYPE';`
 */
export enum FormFieldType {
  /** Non-input type field. Used to insert headers into a form */
  Section = 'SECTION',
  /** HTML select field. May support multiple choices */
  Select = 'SELECT',
  /** HTML textarea field */
  Textarea = 'TEXTAREA',
  /** The simplest input type, a plain html `<input type="text" />` */
  Textinput = 'TEXTINPUT'
}

/** A connection to a list of `Form` values. */
export type FormsConnection = {
  __typename?: 'FormsConnection';
  /** A list of edges which contains the `Form` and cursor to aid in pagination. */
  edges: Array<FormsEdge>;
  /** A list of `Form` objects. */
  nodes: Array<Maybe<Form>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Form` you could get from the connection. */
  totalCount: Scalars['Int'];
};

/** A `Form` edge in the connection. */
export type FormsEdge = {
  __typename?: 'FormsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `Form` at the end of the edge. */
  node?: Maybe<Form>;
};

/** Methods to use when ordering `Form`. */
export enum FormsOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  IsTemplateAsc = 'IS_TEMPLATE_ASC',
  IsTemplateDesc = 'IS_TEMPLATE_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  SketchClassIdAsc = 'SKETCH_CLASS_ID_ASC',
  SketchClassIdDesc = 'SKETCH_CLASS_ID_DESC',
  SurveyIdAsc = 'SURVEY_ID_ASC',
  SurveyIdDesc = 'SURVEY_ID_DESC'
}

/** Indicates which features should use the form as a template */
export enum FormTemplateType {
  /** Template should only be listed for *SketchClasses*. */
  Sketches = 'SKETCHES',
  /** Template should only be listed for *Surveys*. */
  Surveys = 'SURVEYS',
  /** Template should be an option for both types. */
  SurveysAndSketches = 'SURVEYS_AND_SKETCHES'
}

/**
 * Discussion forums are the highest level organizing unit of the discussion forums
 * for a project. Each forum can have many topics (threads), which then contain
 * posts. Only project administrators can create and configure forums.
 */
export type Forum = Node & {
  __typename?: 'Forum';
  /**
   * Archived forums will only be accessible by project administrators from the
   * admin dashboard. This is an alternative to deleting a forum.
   */
  archived?: Maybe<Scalars['Boolean']>;
  /** Optional description of the forum to be displayed to project users. */
  description?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /** Title displayed for the forum. */
  name: Scalars['String'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /**
   * Sets position of this forum in the listing. Forums should be listed by
   * position in ascending order. Set using `setForumOrder()`
   */
  position?: Maybe<Scalars['Int']>;
  /** Reads a single `Project` that is related to this `Forum`. */
  project?: Maybe<Project>;
  projectId: Scalars['Int'];
  /** Reads and enables pagination through a set of `Topic`. */
  topicsConnection: TopicsConnection;
};


/**
 * Discussion forums are the highest level organizing unit of the discussion forums
 * for a project. Each forum can have many topics (threads), which then contain
 * posts. Only project administrators can create and configure forums.
 */
export type ForumTopicsConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<TopicCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<TopicsOrderBy>>;
};

/** A condition to be used against `Forum` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type ForumCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `projectId` field. */
  projectId?: Maybe<Scalars['Int']>;
};

/** An input for mutations affecting `Forum` */
export type ForumInput = {
  /**
   * Archived forums will only be accessible by project administrators from the
   * admin dashboard. This is an alternative to deleting a forum.
   */
  archived?: Maybe<Scalars['Boolean']>;
  /** Optional description of the forum to be displayed to project users. */
  description?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['Int']>;
  /** Title displayed for the forum. */
  name: Scalars['String'];
  /**
   * Sets position of this forum in the listing. Forums should be listed by
   * position in ascending order. Set using `setForumOrder()`
   */
  position?: Maybe<Scalars['Int']>;
  projectId: Scalars['Int'];
};

/** Represents an update to a `Forum`. Fields that are set will be updated. */
export type ForumPatch = {
  /**
   * Archived forums will only be accessible by project administrators from the
   * admin dashboard. This is an alternative to deleting a forum.
   */
  archived?: Maybe<Scalars['Boolean']>;
  /** Optional description of the forum to be displayed to project users. */
  description?: Maybe<Scalars['String']>;
  /** Title displayed for the forum. */
  name?: Maybe<Scalars['String']>;
  /**
   * Sets position of this forum in the listing. Forums should be listed by
   * position in ascending order. Set using `setForumOrder()`
   */
  position?: Maybe<Scalars['Int']>;
};

/** A `Forum` edge in the connection. */
export type ForumsEdge = {
  __typename?: 'ForumsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `Forum` at the end of the edge. */
  node?: Maybe<Forum>;
};

/** Methods to use when ordering `Forum`. */
export enum ForumsOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ProjectIdAsc = 'PROJECT_ID_ASC',
  ProjectIdDesc = 'PROJECT_ID_DESC'
}

/** All geography XY types implement this interface */
export type GeographyGeometry = {
  /** Converts the object to GeoJSON */
  geojson?: Maybe<Scalars['GeoJSON']>;
  /** Spatial reference identifier (SRID) */
  srid: Scalars['Int'];
};

/** All geography types implement this interface */
export type GeographyInterface = {
  /** Converts the object to GeoJSON */
  geojson?: Maybe<Scalars['GeoJSON']>;
  /** Spatial reference identifier (SRID) */
  srid: Scalars['Int'];
};

export type GeographyLineString = GeographyGeometry & GeographyInterface & {
  __typename?: 'GeographyLineString';
  geojson?: Maybe<Scalars['GeoJSON']>;
  points?: Maybe<Array<Maybe<GeographyPoint>>>;
  srid: Scalars['Int'];
};

export type GeographyPoint = GeographyGeometry & GeographyInterface & {
  __typename?: 'GeographyPoint';
  geojson?: Maybe<Scalars['GeoJSON']>;
  latitude: Scalars['Float'];
  longitude: Scalars['Float'];
  srid: Scalars['Int'];
};

export type GeographyPolygon = GeographyGeometry & GeographyInterface & {
  __typename?: 'GeographyPolygon';
  exterior?: Maybe<GeographyLineString>;
  geojson?: Maybe<Scalars['GeoJSON']>;
  interiors?: Maybe<Array<Maybe<GeographyLineString>>>;
  srid: Scalars['Int'];
};


/** All geometry XY types implement this interface */
export type GeometryGeometry = {
  /** Converts the object to GeoJSON */
  geojson?: Maybe<Scalars['GeoJSON']>;
  /** Spatial reference identifier (SRID) */
  srid: Scalars['Int'];
};

export type GeometryGeometryCollection = GeometryGeometry & GeometryInterface & {
  __typename?: 'GeometryGeometryCollection';
  geojson?: Maybe<Scalars['GeoJSON']>;
  geometries?: Maybe<Array<Maybe<GeometryGeometry>>>;
  srid: Scalars['Int'];
};

export type GeometryGeometryCollectionM = GeometryGeometryM & GeometryInterface & {
  __typename?: 'GeometryGeometryCollectionM';
  geojson?: Maybe<Scalars['GeoJSON']>;
  geometries?: Maybe<Array<Maybe<GeometryGeometryM>>>;
  srid: Scalars['Int'];
};

export type GeometryGeometryCollectionZ = GeometryGeometryZ & GeometryInterface & {
  __typename?: 'GeometryGeometryCollectionZ';
  geojson?: Maybe<Scalars['GeoJSON']>;
  geometries?: Maybe<Array<Maybe<GeometryGeometryZ>>>;
  srid: Scalars['Int'];
};

export type GeometryGeometryCollectionZm = GeometryGeometryZm & GeometryInterface & {
  __typename?: 'GeometryGeometryCollectionZM';
  geojson?: Maybe<Scalars['GeoJSON']>;
  geometries?: Maybe<Array<Maybe<GeometryGeometryZm>>>;
  srid: Scalars['Int'];
};

/** All geometry XYM types implement this interface */
export type GeometryGeometryM = {
  /** Converts the object to GeoJSON */
  geojson?: Maybe<Scalars['GeoJSON']>;
  /** Spatial reference identifier (SRID) */
  srid: Scalars['Int'];
};

/** All geometry XYZ types implement this interface */
export type GeometryGeometryZ = {
  /** Converts the object to GeoJSON */
  geojson?: Maybe<Scalars['GeoJSON']>;
  /** Spatial reference identifier (SRID) */
  srid: Scalars['Int'];
};

/** All geometry XYZM types implement this interface */
export type GeometryGeometryZm = {
  /** Converts the object to GeoJSON */
  geojson?: Maybe<Scalars['GeoJSON']>;
  /** Spatial reference identifier (SRID) */
  srid: Scalars['Int'];
};

/** All geometry types implement this interface */
export type GeometryInterface = {
  /** Converts the object to GeoJSON */
  geojson?: Maybe<Scalars['GeoJSON']>;
  /** Spatial reference identifier (SRID) */
  srid: Scalars['Int'];
};

export type GeometryLineString = GeometryGeometry & GeometryInterface & {
  __typename?: 'GeometryLineString';
  geojson?: Maybe<Scalars['GeoJSON']>;
  points?: Maybe<Array<Maybe<GeometryPoint>>>;
  srid: Scalars['Int'];
};

export type GeometryLineStringM = GeometryGeometryM & GeometryInterface & {
  __typename?: 'GeometryLineStringM';
  geojson?: Maybe<Scalars['GeoJSON']>;
  points?: Maybe<Array<Maybe<GeometryPointM>>>;
  srid: Scalars['Int'];
};

export type GeometryLineStringZ = GeometryGeometryZ & GeometryInterface & {
  __typename?: 'GeometryLineStringZ';
  geojson?: Maybe<Scalars['GeoJSON']>;
  points?: Maybe<Array<Maybe<GeometryPointZ>>>;
  srid: Scalars['Int'];
};

export type GeometryLineStringZm = GeometryGeometryZm & GeometryInterface & {
  __typename?: 'GeometryLineStringZM';
  geojson?: Maybe<Scalars['GeoJSON']>;
  points?: Maybe<Array<Maybe<GeometryPointZm>>>;
  srid: Scalars['Int'];
};

export type GeometryMultiLineString = GeometryGeometry & GeometryInterface & {
  __typename?: 'GeometryMultiLineString';
  geojson?: Maybe<Scalars['GeoJSON']>;
  lines?: Maybe<Array<Maybe<GeometryLineString>>>;
  srid: Scalars['Int'];
};

export type GeometryMultiLineStringM = GeometryGeometryM & GeometryInterface & {
  __typename?: 'GeometryMultiLineStringM';
  geojson?: Maybe<Scalars['GeoJSON']>;
  lines?: Maybe<Array<Maybe<GeometryLineStringM>>>;
  srid: Scalars['Int'];
};

export type GeometryMultiLineStringZ = GeometryGeometryZ & GeometryInterface & {
  __typename?: 'GeometryMultiLineStringZ';
  geojson?: Maybe<Scalars['GeoJSON']>;
  lines?: Maybe<Array<Maybe<GeometryLineStringZ>>>;
  srid: Scalars['Int'];
};

export type GeometryMultiLineStringZm = GeometryGeometryZm & GeometryInterface & {
  __typename?: 'GeometryMultiLineStringZM';
  geojson?: Maybe<Scalars['GeoJSON']>;
  lines?: Maybe<Array<Maybe<GeometryLineStringZm>>>;
  srid: Scalars['Int'];
};

export type GeometryMultiPoint = GeometryGeometry & GeometryInterface & {
  __typename?: 'GeometryMultiPoint';
  geojson?: Maybe<Scalars['GeoJSON']>;
  points?: Maybe<Array<Maybe<GeometryPoint>>>;
  srid: Scalars['Int'];
};

export type GeometryMultiPointM = GeometryGeometryM & GeometryInterface & {
  __typename?: 'GeometryMultiPointM';
  geojson?: Maybe<Scalars['GeoJSON']>;
  points?: Maybe<Array<Maybe<GeometryPointM>>>;
  srid: Scalars['Int'];
};

export type GeometryMultiPointZ = GeometryGeometryZ & GeometryInterface & {
  __typename?: 'GeometryMultiPointZ';
  geojson?: Maybe<Scalars['GeoJSON']>;
  points?: Maybe<Array<Maybe<GeometryPointZ>>>;
  srid: Scalars['Int'];
};

export type GeometryMultiPointZm = GeometryGeometryZm & GeometryInterface & {
  __typename?: 'GeometryMultiPointZM';
  geojson?: Maybe<Scalars['GeoJSON']>;
  points?: Maybe<Array<Maybe<GeometryPointZm>>>;
  srid: Scalars['Int'];
};

export type GeometryMultiPolygon = GeometryGeometry & GeometryInterface & {
  __typename?: 'GeometryMultiPolygon';
  geojson?: Maybe<Scalars['GeoJSON']>;
  polygons?: Maybe<Array<Maybe<GeometryPolygon>>>;
  srid: Scalars['Int'];
};

export type GeometryMultiPolygonM = GeometryGeometryM & GeometryInterface & {
  __typename?: 'GeometryMultiPolygonM';
  geojson?: Maybe<Scalars['GeoJSON']>;
  polygons?: Maybe<Array<Maybe<GeometryPolygonM>>>;
  srid: Scalars['Int'];
};

export type GeometryMultiPolygonZ = GeometryGeometryZ & GeometryInterface & {
  __typename?: 'GeometryMultiPolygonZ';
  geojson?: Maybe<Scalars['GeoJSON']>;
  polygons?: Maybe<Array<Maybe<GeometryPolygonZ>>>;
  srid: Scalars['Int'];
};

export type GeometryMultiPolygonZm = GeometryGeometryZm & GeometryInterface & {
  __typename?: 'GeometryMultiPolygonZM';
  geojson?: Maybe<Scalars['GeoJSON']>;
  polygons?: Maybe<Array<Maybe<GeometryPolygonZm>>>;
  srid: Scalars['Int'];
};

export type GeometryPoint = GeometryGeometry & GeometryInterface & {
  __typename?: 'GeometryPoint';
  geojson?: Maybe<Scalars['GeoJSON']>;
  srid: Scalars['Int'];
  x: Scalars['Float'];
  y: Scalars['Float'];
};

export type GeometryPointM = GeometryGeometryM & GeometryInterface & {
  __typename?: 'GeometryPointM';
  geojson?: Maybe<Scalars['GeoJSON']>;
  srid: Scalars['Int'];
  x: Scalars['Float'];
  y: Scalars['Float'];
};

export type GeometryPointZ = GeometryGeometryZ & GeometryInterface & {
  __typename?: 'GeometryPointZ';
  geojson?: Maybe<Scalars['GeoJSON']>;
  srid: Scalars['Int'];
  x: Scalars['Float'];
  y: Scalars['Float'];
};

export type GeometryPointZm = GeometryGeometryZm & GeometryInterface & {
  __typename?: 'GeometryPointZM';
  geojson?: Maybe<Scalars['GeoJSON']>;
  srid: Scalars['Int'];
  x: Scalars['Float'];
  y: Scalars['Float'];
};

export type GeometryPolygon = GeometryGeometry & GeometryInterface & {
  __typename?: 'GeometryPolygon';
  exterior?: Maybe<GeometryLineString>;
  geojson?: Maybe<Scalars['GeoJSON']>;
  interiors?: Maybe<Array<Maybe<GeometryLineString>>>;
  srid: Scalars['Int'];
};

export type GeometryPolygonM = GeometryGeometryM & GeometryInterface & {
  __typename?: 'GeometryPolygonM';
  exterior?: Maybe<GeometryLineStringM>;
  geojson?: Maybe<Scalars['GeoJSON']>;
  interiors?: Maybe<Array<Maybe<GeometryLineStringM>>>;
  srid: Scalars['Int'];
};

export type GeometryPolygonZ = GeometryGeometryZ & GeometryInterface & {
  __typename?: 'GeometryPolygonZ';
  exterior?: Maybe<GeometryLineStringZ>;
  geojson?: Maybe<Scalars['GeoJSON']>;
  interiors?: Maybe<Array<Maybe<GeometryLineStringZ>>>;
  srid: Scalars['Int'];
};

export type GeometryPolygonZm = GeometryGeometryZm & GeometryInterface & {
  __typename?: 'GeometryPolygonZM';
  exterior?: Maybe<GeometryLineStringZm>;
  geojson?: Maybe<Scalars['GeoJSON']>;
  interiors?: Maybe<Array<Maybe<GeometryLineStringZm>>>;
  srid: Scalars['Int'];
};

/** All input for the `grantAdminAccess` mutation. */
export type GrantAdminAccessInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
  userId?: Maybe<Scalars['Int']>;
};

/** The output of our `grantAdminAccess` mutation. */
export type GrantAdminAccessPayload = {
  __typename?: 'GrantAdminAccessPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/**
 * User groups designated by the project administrators. User groups can be used to
 * assign access control privileges to users. 
 * 
 * Note that only admins have access to groups, or direct knowlege of what groups a
 * user belongs to. If an admin wanted to create an *Assholes* group they are 
 * free to do so.
 */
export type Group = Node & {
  __typename?: 'Group';
  id: Scalars['Int'];
  memberCount?: Maybe<Scalars['Int']>;
  /** Listing of all users who have been assigned to this group. */
  members?: Maybe<Array<Maybe<User>>>;
  /** Label for the group. */
  name?: Maybe<Scalars['String']>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** Reads a single `Project` that is related to this `Group`. */
  project?: Maybe<Project>;
  projectId: Scalars['Int'];
};


/**
 * User groups designated by the project administrators. User groups can be used to
 * assign access control privileges to users. 
 * 
 * Note that only admins have access to groups, or direct knowlege of what groups a
 * user belongs to. If an admin wanted to create an *Assholes* group they are 
 * free to do so.
 */
export type GroupMembersArgs = {
  direction?: Maybe<SortByDirection>;
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<ParticipantSortBy>;
};

/** An input for mutations affecting `Group` */
export type GroupInput = {
  id?: Maybe<Scalars['Int']>;
  /** Label for the group. */
  name?: Maybe<Scalars['String']>;
  projectId: Scalars['Int'];
};

/** Represents an update to a `Group`. Fields that are set will be updated. */
export type GroupPatch = {
  id?: Maybe<Scalars['Int']>;
  /** Label for the group. */
  name?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
};

/** Methods to use when ordering `Group`. */
export enum GroupsOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ProjectIdAsc = 'PROJECT_ID_ASC',
  ProjectIdDesc = 'PROJECT_ID_DESC'
}

/** All input for the `initializeBlankSketchClassForm` mutation. */
export type InitializeBlankSketchClassFormInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  sketchClassId?: Maybe<Scalars['Int']>;
};

/** The output of our `initializeBlankSketchClassForm` mutation. */
export type InitializeBlankSketchClassFormPayload = {
  __typename?: 'InitializeBlankSketchClassFormPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  form?: Maybe<Form>;
  /** An edge for our `Form`. May be used by Relay 1. */
  formEdge?: Maybe<FormsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `SketchClass` that is related to this `Form`. */
  sketchClass?: Maybe<SketchClass>;
  /** Reads a single `Survey` that is related to this `Form`. */
  survey?: Maybe<Survey>;
};


/** The output of our `initializeBlankSketchClassForm` mutation. */
export type InitializeBlankSketchClassFormPayloadFormEdgeArgs = {
  orderBy?: Maybe<Array<FormsOrderBy>>;
};

/** All input for the `initializeBlankSurveyForm` mutation. */
export type InitializeBlankSurveyFormInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  surveyId?: Maybe<Scalars['Int']>;
};

/** The output of our `initializeBlankSurveyForm` mutation. */
export type InitializeBlankSurveyFormPayload = {
  __typename?: 'InitializeBlankSurveyFormPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  form?: Maybe<Form>;
  /** An edge for our `Form`. May be used by Relay 1. */
  formEdge?: Maybe<FormsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `SketchClass` that is related to this `Form`. */
  sketchClass?: Maybe<SketchClass>;
  /** Reads a single `Survey` that is related to this `Form`. */
  survey?: Maybe<Survey>;
};


/** The output of our `initializeBlankSurveyForm` mutation. */
export type InitializeBlankSurveyFormPayloadFormEdgeArgs = {
  orderBy?: Maybe<Array<FormsOrderBy>>;
};

/** All input for the `initializeSketchClassFormFromTemplate` mutation. */
export type InitializeSketchClassFormFromTemplateInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  sketchClassId?: Maybe<Scalars['Int']>;
  templateId?: Maybe<Scalars['Int']>;
};

/** The output of our `initializeSketchClassFormFromTemplate` mutation. */
export type InitializeSketchClassFormFromTemplatePayload = {
  __typename?: 'InitializeSketchClassFormFromTemplatePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  form?: Maybe<Form>;
  /** An edge for our `Form`. May be used by Relay 1. */
  formEdge?: Maybe<FormsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `SketchClass` that is related to this `Form`. */
  sketchClass?: Maybe<SketchClass>;
  /** Reads a single `Survey` that is related to this `Form`. */
  survey?: Maybe<Survey>;
};


/** The output of our `initializeSketchClassFormFromTemplate` mutation. */
export type InitializeSketchClassFormFromTemplatePayloadFormEdgeArgs = {
  orderBy?: Maybe<Array<FormsOrderBy>>;
};

/** All input for the `initializeSurveyFormFromTemplate` mutation. */
export type InitializeSurveyFormFromTemplateInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  surveyId?: Maybe<Scalars['Int']>;
  templateId?: Maybe<Scalars['Int']>;
};

/** The output of our `initializeSurveyFormFromTemplate` mutation. */
export type InitializeSurveyFormFromTemplatePayload = {
  __typename?: 'InitializeSurveyFormFromTemplatePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  form?: Maybe<Form>;
  /** An edge for our `Form`. May be used by Relay 1. */
  formEdge?: Maybe<FormsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `SketchClass` that is related to this `Form`. */
  sketchClass?: Maybe<SketchClass>;
  /** Reads a single `Survey` that is related to this `Form`. */
  survey?: Maybe<Survey>;
};


/** The output of our `initializeSurveyFormFromTemplate` mutation. */
export type InitializeSurveyFormFromTemplatePayloadFormEdgeArgs = {
  orderBy?: Maybe<Array<FormsOrderBy>>;
};

/**
 * Invite emails can be associated with either a project or survey invitation. 
 * Project invite emails are sent by direct admin action, going into a QUEUED state
 * and eventually sent out by a backend emailing process. Survey invites are 
 * automatically created whenever a survey is published.
 * 
 * [More details on the mailing process can be found on the
 * wiki](https://github.com/seasketch/next/wiki/User-and-Survey-Invite-Management).
 */
export type InviteEmail = Node & {
  __typename?: 'InviteEmail';
  createdAt: Scalars['Datetime'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** Reads a single `ProjectInvite` that is related to this `InviteEmail`. */
  projectInvite?: Maybe<ProjectInvite>;
  projectInviteId?: Maybe<Scalars['Int']>;
  /** Updated by the mailer processes and SES notifications. */
  status: EmailStatus;
  /** Reads a single `SurveyInvite` that is related to this `InviteEmail`. */
  surveyInvite?: Maybe<SurveyInvite>;
  surveyInviteId?: Maybe<Scalars['Int']>;
  /**
   * Emails contain a link with an embedded JSON Web Token that is used to authorize 
   * access. These tokens have an expiration that is both embedded in the token and 
   * tracked in the database. Each email has its own token and expiration.
   */
  tokenExpiresAt?: Maybe<Scalars['Datetime']>;
  updatedAt?: Maybe<Scalars['Datetime']>;
};

/**
 * A condition to be used against `InviteEmail` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type InviteEmailCondition = {
  /** Checks for equality with the object’s `projectInviteId` field. */
  projectInviteId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `status` field. */
  status?: Maybe<EmailStatus>;
  /** Checks for equality with the object’s `surveyInviteId` field. */
  surveyInviteId?: Maybe<Scalars['Int']>;
};

/** Methods to use when ordering `InviteEmail`. */
export enum InviteEmailsOrderBy {
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ProjectInviteIdAsc = 'PROJECT_INVITE_ID_ASC',
  ProjectInviteIdDesc = 'PROJECT_INVITE_ID_DESC',
  StatusAsc = 'STATUS_ASC',
  StatusDesc = 'STATUS_DESC',
  SurveyInviteIdAsc = 'SURVEY_INVITE_ID_ASC',
  SurveyInviteIdDesc = 'SURVEY_INVITE_ID_DESC'
}

export enum InviteOrderBy {
  Email = 'EMAIL',
  Name = 'NAME'
}

export type InviteStat = {
  __typename?: 'InviteStat';
  count?: Maybe<Scalars['Int']>;
  status?: Maybe<InviteStatus>;
};

/**
 * Invite status is derived from feedback notifications coming from the AWS SES
 * email service and token expiration date. See the inviteEmails relation for more details.
 */
export enum InviteStatus {
  /**
   * Emails may be bounced due to a full inbox, misconfigured mail server, or other
   * reasons. See [AWS SES documentation](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/monitor-using-event-publishing.html#event-publishing-terminology).
   */
  Bounced = 'BOUNCED',
  /**
   * User has reported SeaSketch as sending Spam in this or another project.
   * SeaSketch will no longer send emails to this user in any project.
   */
  Complaint = 'COMPLAINT',
  /**
   * #### Project Invites
   * User has accepted the invite.
   * 
   * #### Survey Invites
   * User has responded to the survey.
   */
  Confirmed = 'CONFIRMED',
  /** Delivered to the user's mail server */
  Delivered = 'DELIVERED',
  /** SeaSketch application error when sending invite emails. Refer to email status */
  Error = 'ERROR',
  /**
   * #### Project Invites    
   * Admin has sent the invite, but the mail delivery subsystem has not yet sent the invite.
   * 
   * #### Survey Invites
   * Invite has been created but email has not yet been sent. Emails will be sent
   * automatically by a periodic backend process (approx every 20 seconds).
   */
  Queued = 'QUEUED',
  /** Invite email has been sent but not yet delivered to the user's mail server */
  Sent = 'SENT',
  /**
   * Project invites have this status when a survey invite is queued for sending in
   * this project. Users can be invited to a survey + have an un-sent project
   * invite that they can confirm using `confirmProjectInviteWithSurveyToken()`.
   * This way users do not need to simultaneously be sent both a project and survey invite.
   */
  SurveyInviteQueued = 'SURVEY_INVITE_QUEUED',
  /** Survey invite for this project and email has already been sent. See InviteStatus.SURVEY_INVITE_QUEUED for more details. */
  SurveyInviteSent = 'SURVEY_INVITE_SENT',
  /**
   * For **project invites**, Invite JSON Web Tokens are set to expire in 14
   * (admins) or 60 days. **Survey invites** expire after 60 days for invite_only
   * surveys, and after 2 years for public surveys. Invites should be resent if
   * still necessary
   */
  TokenExpired = 'TOKEN_EXPIRED',
  /** Unused enum value. */
  Unconfirmed = 'UNCONFIRMED',
  /**
   * **Project Invites only**. Invites may be created but not sent immediately.
   * This way admins can collaboratively update a project invite list before
   * mass-sending invites when a project is first published.
   */
  Unsent = 'UNSENT',
  /**
   * The user has unsubscribed from all emails originating from SeaSketch.
   * 
   * If this happens SeaSketch will not be able to send any invitations to the user.
   */
  Unsubscribed = 'UNSUBSCRIBED'
}

/** All input for the `joinProject` mutation. */
export type JoinProjectInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
};

/** The output of our `joinProject` mutation. */
export type JoinProjectPayload = {
  __typename?: 'JoinProjectPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** All input for the `leaveProject` mutation. */
export type LeaveProjectInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
};

/** The output of our `leaveProject` mutation. */
export type LeaveProjectPayload = {
  __typename?: 'LeaveProjectPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `makeResponseDraft` mutation. */
export type MakeResponseDraftInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  responseId?: Maybe<Scalars['Int']>;
};

/** The output of our `makeResponseDraft` mutation. */
export type MakeResponseDraftPayload = {
  __typename?: 'MakeResponseDraftPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Survey` that is related to this `SurveyResponse`. */
  survey?: Maybe<Survey>;
  surveyResponse?: Maybe<SurveyResponse>;
  /** An edge for our `SurveyResponse`. May be used by Relay 1. */
  surveyResponseEdge?: Maybe<SurveyResponsesEdge>;
};


/** The output of our `makeResponseDraft` mutation. */
export type MakeResponseDraftPayloadSurveyResponseEdgeArgs = {
  orderBy?: Maybe<Array<SurveyResponsesOrderBy>>;
};

/** All input for the `markTopicAsRead` mutation. */
export type MarkTopicAsReadInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  topicId?: Maybe<Scalars['Int']>;
};

/** The output of our `markTopicAsRead` mutation. */
export type MarkTopicAsReadPayload = {
  __typename?: 'MarkTopicAsReadPayload';
  boolean?: Maybe<Scalars['Boolean']>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** The root mutation type which contains root level fields which mutate data. */
export type Mutation = {
  __typename?: 'Mutation';
  /** Add a group to a given access control list. Must be an administrator. */
  addGroupToAcl?: Maybe<AddGroupToAclPayload>;
  /** Add the given user to a group. Must be an administrator of the project. */
  addUserToGroup?: Maybe<AddUserToGroupPayload>;
  /** Add a SketchClass to the list of valid children for a Collection-type SketchClass. */
  addValidChildSketchClass?: Maybe<AddValidChildSketchClassPayload>;
  /** For invite_only projects. Approve access request by a user. Must be an administrator of the project. */
  approveParticipant?: Maybe<ApproveParticipantPayload>;
  /** Confirm that a new user has seen any onboarding materials. Updates User.onboarded date. */
  confirmOnboarded?: Maybe<ConfirmOnboardedPayload>;
  /**
   * Accept a project invite using a token (distributed via email). When
   * confirming a token, the current session will be assigned any group
   * membership or admin privileges assigned to the invite. The act of
   * accepting a token that was sent via email will also verify the user's
   * email if it wasn't already.
   * 
   * More details on how to handle invites can be found
   * [on the wiki](https://github.com/seasketch/next/wiki/User-Ingress#project-invites)
   */
  confirmProjectInvite?: Maybe<ProjectInviteTokenClaims>;
  /**
   * Project invites can be paired with survey invites so that users can be sent an
   * email inviting them to a survey, then use that survey invite to confirm a 
   * project invitation. This way there are no duplicative emails sent.
   * 
   * Clients must set x-ss-survey-invite-token header before calling this mutation.
   */
  confirmProjectInviteWithSurveyToken?: Maybe<ConfirmProjectInviteWithSurveyTokenPayload>;
  /**
   * Users can confirm project invites without clicking thru an email if they are 
   * registered for SeaSketch and their verified email matches that of a project 
   * invite. Outstanding (or confirmed) invites can be accessed via the 
   * `currentProject.invite` query.
   * 
   * More details on how to handle invites can be found [on the
   * wiki](https://github.com/seasketch/next/wiki/User-Ingress#project-invites).
   */
  confirmProjectInviteWithVerifiedEmail?: Maybe<ConfirmProjectInviteWithVerifiedEmailPayload>;
  /** Creates a single `CommunityGuideline`. */
  createCommunityGuideline?: Maybe<CreateCommunityGuidelinePayload>;
  /** Creates a single `FormConditionalRenderingRule`. */
  createFormConditionalRenderingRule?: Maybe<CreateFormConditionalRenderingRulePayload>;
  /** Creates a single `FormField`. */
  createFormField?: Maybe<CreateFormFieldPayload>;
  createFormTemplateFromSketchClass?: Maybe<CreateFormTemplateFromSketchClassPayload>;
  createFormTemplateFromSurvey?: Maybe<CreateFormTemplateFromSurveyPayload>;
  /** Creates a single `Forum`. */
  createForum?: Maybe<CreateForumPayload>;
  /** Creates a single `Group`. */
  createGroup?: Maybe<CreateGroupPayload>;
  /**
   * Must have write permission for the specified forum. Create reply to a
   * discussion topic. `message` must be JSON, something like the output of DraftJS.
   */
  createPost?: Maybe<CreatePostPayload>;
  /**
   * Users with verified emails can create new projects by choosing a unique name
   * and url slug. This project will be unlisted with admin_only access and the
   * user will be automatically added to the list of admins.
   */
  createProject?: Maybe<CreateProjectPayload>;
  /** Creates a single `ProjectInviteGroup`. */
  createProjectInviteGroup?: Maybe<CreateProjectInviteGroupPayload>;
  /**
   * Create a set of project invites from a set of emails and optional names. Clients
   * should implement this feature as a simple textarea where admins can copy and 
   * paste a set of names and emails from a spreadsheet.#
   * 
   * Invites can be assigned to a list of groups and optional admin permission. The
   * function can either send these invite emails immediately or they can be manually
   * sent later.
   * 
   * More details on project invite management [can be found in the wiki](https://github.com/seasketch/next/wiki/User-and-Survey-Invite-Management).
   */
  createProjectInvites?: Maybe<CreateProjectInvitesPayload>;
  /** Creates a single `Sketch`. */
  createSketch?: Maybe<CreateSketchPayload>;
  /** Creates a single `SketchClass`. */
  createSketchClass?: Maybe<CreateSketchClassPayload>;
  /** Creates a single `SketchFolder`. */
  createSketchFolder?: Maybe<CreateSketchFolderPayload>;
  /** Creates a single `Survey`. */
  createSurvey?: Maybe<CreateSurveyPayload>;
  /** Creates a single `SurveyInvitedGroup`. */
  createSurveyInvitedGroup?: Maybe<CreateSurveyInvitedGroupPayload>;
  createSurveyInvites?: Maybe<CreateSurveyInvitesPayload>;
  /** Creates a single `SurveyResponse`. */
  createSurveyResponse?: Maybe<CreateSurveyResponsePayload>;
  /**
   * Must have write permission for the specified forum. Create a new discussion
   * topic, including the first post. `message` must be JSON, something like the
   * output of DraftJS.
   */
  createTopic?: Maybe<CreateTopicPayload>;
  /** Deletes a single `CommunityGuideline` using a unique key. */
  deleteCommunityGuideline?: Maybe<DeleteCommunityGuidelinePayload>;
  /** Deletes a single `CommunityGuideline` using its globally unique id. */
  deleteCommunityGuidelineByNodeId?: Maybe<DeleteCommunityGuidelinePayload>;
  /** Deletes a single `Form` using a unique key. */
  deleteForm?: Maybe<DeleteFormPayload>;
  /** Deletes a single `Form` using its globally unique id. */
  deleteFormByNodeId?: Maybe<DeleteFormPayload>;
  /** Deletes a single `Form` using a unique key. */
  deleteFormBySketchClassId?: Maybe<DeleteFormPayload>;
  /** Deletes a single `Form` using a unique key. */
  deleteFormBySurveyId?: Maybe<DeleteFormPayload>;
  /** Deletes a single `FormConditionalRenderingRule` using a unique key. */
  deleteFormConditionalRenderingRule?: Maybe<DeleteFormConditionalRenderingRulePayload>;
  /** Deletes a single `FormConditionalRenderingRule` using its globally unique id. */
  deleteFormConditionalRenderingRuleByNodeId?: Maybe<DeleteFormConditionalRenderingRulePayload>;
  /** Deletes a single `FormField` using a unique key. */
  deleteFormField?: Maybe<DeleteFormFieldPayload>;
  /** Deletes a single `FormField` using its globally unique id. */
  deleteFormFieldByNodeId?: Maybe<DeleteFormFieldPayload>;
  /** Deletes a single `Forum` using a unique key. */
  deleteForum?: Maybe<DeleteForumPayload>;
  /** Deletes a single `Forum` using its globally unique id. */
  deleteForumByNodeId?: Maybe<DeleteForumPayload>;
  /** Deletes a single `Group` using a unique key. */
  deleteGroup?: Maybe<DeleteGroupPayload>;
  /** Deletes a single `Group` using its globally unique id. */
  deleteGroupByNodeId?: Maybe<DeleteGroupPayload>;
  /** Deletes a single `Group` using a unique key. */
  deleteGroupByProjectIdAndName?: Maybe<DeleteGroupPayload>;
  /** Can be performed by project admins at any time. Can only be performed by original author within 5 minutes of posting. */
  deletePost?: Maybe<DeletePostPayload>;
  /** Deletes a single `Post` using its globally unique id. */
  deletePostByNodeId?: Maybe<DeletePostPayload>;
  /**
   * Marks project as deleted. Will remain in database but not accessible to
   * anyone. Function can only be accessed by project administrators.
   */
  deleteProject?: Maybe<DeleteProjectPayload>;
  /** Deletes a single `ProjectInvite` using a unique key. */
  deleteProjectInvite?: Maybe<DeleteProjectInvitePayload>;
  /** Deletes a single `ProjectInvite` using a unique key. */
  deleteProjectInviteByEmailAndProjectId?: Maybe<DeleteProjectInvitePayload>;
  /** Deletes a single `ProjectInvite` using its globally unique id. */
  deleteProjectInviteByNodeId?: Maybe<DeleteProjectInvitePayload>;
  /** Deletes a single `ProjectInviteGroup` using a unique key. */
  deleteProjectInviteGroupByInviteIdAndGroupId?: Maybe<DeleteProjectInviteGroupPayload>;
  /** Deletes a single `Sketch` using a unique key. */
  deleteSketch?: Maybe<DeleteSketchPayload>;
  /** Deletes a single `Sketch` using its globally unique id. */
  deleteSketchByNodeId?: Maybe<DeleteSketchPayload>;
  /** Deletes a single `SketchClass` using a unique key. */
  deleteSketchClass?: Maybe<DeleteSketchClassPayload>;
  /** Deletes a single `SketchClass` using its globally unique id. */
  deleteSketchClassByNodeId?: Maybe<DeleteSketchClassPayload>;
  /** Deletes a single `SketchFolder` using a unique key. */
  deleteSketchFolder?: Maybe<DeleteSketchFolderPayload>;
  /** Deletes a single `SketchFolder` using its globally unique id. */
  deleteSketchFolderByNodeId?: Maybe<DeleteSketchFolderPayload>;
  /** Deletes a single `Survey` using a unique key. */
  deleteSurvey?: Maybe<DeleteSurveyPayload>;
  /** Deletes a single `Survey` using its globally unique id. */
  deleteSurveyByNodeId?: Maybe<DeleteSurveyPayload>;
  /** Deletes a single `SurveyInvite` using a unique key. */
  deleteSurveyInvite?: Maybe<DeleteSurveyInvitePayload>;
  /** Deletes a single `SurveyInvite` using a unique key. */
  deleteSurveyInviteByEmail?: Maybe<DeleteSurveyInvitePayload>;
  /** Deletes a single `SurveyInvite` using a unique key. */
  deleteSurveyInviteByEmailAndSurveyId?: Maybe<DeleteSurveyInvitePayload>;
  /** Deletes a single `SurveyInvite` using its globally unique id. */
  deleteSurveyInviteByNodeId?: Maybe<DeleteSurveyInvitePayload>;
  /** Deletes a single `SurveyInvitedGroup` using a unique key. */
  deleteSurveyInvitedGroupBySurveyIdAndGroupId?: Maybe<DeleteSurveyInvitedGroupPayload>;
  /** Deletes a single `SurveyResponse` using a unique key. */
  deleteSurveyResponse?: Maybe<DeleteSurveyResponsePayload>;
  /** Deletes a single `SurveyResponse` using its globally unique id. */
  deleteSurveyResponseByNodeId?: Maybe<DeleteSurveyResponsePayload>;
  /** Can be performed by project admins at any time. Can only be performed by original author within 5 minutes of posting. */
  deleteTopic?: Maybe<DeleteTopicPayload>;
  /** Deletes a single `Topic` using its globally unique id. */
  deleteTopicByNodeId?: Maybe<DeleteTopicPayload>;
  /** Ban a user from posting in the discussion forum */
  disableForumPosting?: Maybe<DisableForumPostingPayload>;
  /** Re-enable discussion forum posting for a user that was previously banned. */
  enableForumPosting?: Maybe<EnableForumPostingPayload>;
  /** Give a user admin access to a project. User must have already joined the project and shared their user profile. */
  grantAdminAccess?: Maybe<GrantAdminAccessPayload>;
  /**
   * When creating a new SketchClass, admins can either choose from a set of 
   * templates or start with a blank form. This mutation will initialize with a blank
   * form with no fields configured.
   */
  initializeBlankSketchClassForm?: Maybe<InitializeBlankSketchClassFormPayload>;
  /**
   * When creating a new Survey, admins can either choose from a set of 
   * templates or start with a blank form. This mutation will initialize with a blank
   * form with no fields configured.
   */
  initializeBlankSurveyForm?: Maybe<InitializeBlankSurveyFormPayload>;
  /**
   * Admins can choose to start a new SketchClass with a form derived from the list
   * of Form templates.
   */
  initializeSketchClassFormFromTemplate?: Maybe<InitializeSketchClassFormFromTemplatePayload>;
  /**
   * Admins can choose to start a new Survey with a form derived from the list
   * of Form templates.
   */
  initializeSurveyFormFromTemplate?: Maybe<InitializeSurveyFormFromTemplatePayload>;
  /**
   * Adds current user to the list of participants for a project, sharing their 
   * profile with administrators in user listings. Their profile will also be shared 
   * in public or group discussion forum posts.
   * 
   * Clients will need to determine when/how to show prompts to join a project based
   * on activity that minimizes annoyance when browsing among projects but also makes
   * sure users are visible to admins so that they may gain user group permissions.
   */
  joinProject?: Maybe<JoinProjectPayload>;
  /**
   * Turns off profile sharing in this project. User privacy choices should be 
   * respected, and profile information should disappear from the admin users lists,
   * forum posts, and any other shared content. In the forum a balance will need to 
   * be made to hide their posts entirely since anonymous content could be malicious, 
   * and maintain a historical record of discussions.
   */
  leaveProject?: Maybe<LeaveProjectPayload>;
  /**
   * Project administrators cannot edit survey responses and survey respondants 
   * cannot edit responses after they have been submitted. Admins can use this 
   * mutation to put a response into draft mode so that they can be updated and 
   * resubmitted by the respondant.
   */
  makeResponseDraft?: Maybe<MakeResponseDraftPayload>;
  /**
   * Mark the topic as read by the current session user. Used to avoid sending email
   * notifications to users who have already read a topic. Call when loading a topic, 
   * and whenever new posts are shown.
   */
  markTopicAsRead?: Maybe<MarkTopicAsReadPayload>;
  /** Remove a group from a given access control list. Must be an administrator. */
  removeGroupFromAcl?: Maybe<RemoveGroupFromAclPayload>;
  /** Remove the given user from a group. Must be an administrator of the project. */
  removeUserFromGroup?: Maybe<RemoveUserFromGroupPayload>;
  /** Remove a SketchClass from the list of valid children for a Collection. */
  removeValidChildSketchClass?: Maybe<RemoveValidChildSketchClassPayload>;
  /** Remove participant admin privileges. */
  revokeAdminAccess?: Maybe<RevokeAdminAccessPayload>;
  /** Send all UNSENT invites in the current project. */
  sendAllProjectInvites?: Maybe<SendAllProjectInvitesPayload>;
  /** Send a list of project invites identified by their id. */
  sendProjectInvites?: Maybe<SendProjectInvitesPayload>;
  /**
   * Send a reminder email for a survey invite that has already been sent.
   * Returns the same inviteId if successful.
   */
  sendSurveyInviteReminder?: Maybe<Scalars['Int']>;
  /**
   * Sets the positions of all fields in a form at once. Any missing field ids from
   * the input will be positioned at the end of the form.
   * 
   * Use this instead of trying to manage the position of form fields individually.
   */
  setFormFieldOrder?: Maybe<SetFormFieldOrderPayload>;
  /**
   * Set the order in which discussion forums will be displayed. Provide a list of
   * forum IDs in the correct order. Missing ids will be added to the end of the list.
   */
  setForumOrder?: Maybe<SetForumOrderPayload>;
  /**
   * Admins can use this function to hide the contents of a message. Message will
   * still appear in the client with the missing content, and should link to the
   * Community Guidelines for why the post may have been hidden. If admins want all
   * evidence of the post removed they must delete it.
   */
  setPostHiddenByModerator?: Maybe<SetPostHiddenByModeratorPayload>;
  /**
   * Lock a topic so that it can no longer be responded to. Past discussion will
   * still be visible. This mutation is only available to project admins.
   */
  setTopicLocked?: Maybe<SetTopicLockedPayload>;
  /** Admins can use this mutation to place topics at the top of the forum listing. */
  setTopicSticky?: Maybe<SetTopicStickyPayload>;
  /** Updates a single `Acl` using a unique key and a patch. */
  updateAcl?: Maybe<UpdateAclPayload>;
  /** Updates a single `Acl` using its globally unique id and a patch. */
  updateAclByNodeId?: Maybe<UpdateAclPayload>;
  /** Updates a single `Acl` using a unique key and a patch. */
  updateAclBySketchClassId?: Maybe<UpdateAclPayload>;
  /** Updates a single `CommunityGuideline` using a unique key and a patch. */
  updateCommunityGuideline?: Maybe<UpdateCommunityGuidelinePayload>;
  /** Updates a single `CommunityGuideline` using its globally unique id and a patch. */
  updateCommunityGuidelineByNodeId?: Maybe<UpdateCommunityGuidelinePayload>;
  /** Updates a single `EmailNotificationPreference` using a unique key and a patch. */
  updateEmailNotificationPreferenceByUserId?: Maybe<UpdateEmailNotificationPreferencePayload>;
  /** Updates a single `FormConditionalRenderingRule` using a unique key and a patch. */
  updateFormConditionalRenderingRule?: Maybe<UpdateFormConditionalRenderingRulePayload>;
  /** Updates a single `FormConditionalRenderingRule` using its globally unique id and a patch. */
  updateFormConditionalRenderingRuleByNodeId?: Maybe<UpdateFormConditionalRenderingRulePayload>;
  /** Updates a single `FormField` using a unique key and a patch. */
  updateFormField?: Maybe<UpdateFormFieldPayload>;
  /** Updates a single `FormField` using its globally unique id and a patch. */
  updateFormFieldByNodeId?: Maybe<UpdateFormFieldPayload>;
  /** Updates a single `Forum` using a unique key and a patch. */
  updateForum?: Maybe<UpdateForumPayload>;
  /** Updates a single `Forum` using its globally unique id and a patch. */
  updateForumByNodeId?: Maybe<UpdateForumPayload>;
  /** Updates a single `Group` using a unique key and a patch. */
  updateGroup?: Maybe<UpdateGroupPayload>;
  /** Updates a single `Group` using its globally unique id and a patch. */
  updateGroupByNodeId?: Maybe<UpdateGroupPayload>;
  /** Updates a single `Group` using a unique key and a patch. */
  updateGroupByProjectIdAndName?: Maybe<UpdateGroupPayload>;
  /** Updates the contents of the post. Can only be used by the author for 5 minutes after posting. */
  updatePost?: Maybe<UpdatePostPayload>;
  /** Updates a single `Profile` using a unique key and a patch. */
  updateProfileByUserId?: Maybe<UpdateProfilePayload>;
  /** Updates a single `Project` using a unique key and a patch. */
  updateProject?: Maybe<UpdateProjectPayload>;
  /** Updates a single `Project` using its globally unique id and a patch. */
  updateProjectByNodeId?: Maybe<UpdateProjectPayload>;
  /** Updates a single `Project` using a unique key and a patch. */
  updateProjectBySlug?: Maybe<UpdateProjectPayload>;
  /** Updates a single `ProjectInvite` using a unique key and a patch. */
  updateProjectInvite?: Maybe<UpdateProjectInvitePayload>;
  /** Updates a single `ProjectInvite` using a unique key and a patch. */
  updateProjectInviteByEmailAndProjectId?: Maybe<UpdateProjectInvitePayload>;
  /** Updates a single `ProjectInvite` using its globally unique id and a patch. */
  updateProjectInviteByNodeId?: Maybe<UpdateProjectInvitePayload>;
  /** Updates a single `ProjectInviteGroup` using a unique key and a patch. */
  updateProjectInviteGroupByInviteIdAndGroupId?: Maybe<UpdateProjectInviteGroupPayload>;
  /** Updates a single `Sketch` using a unique key and a patch. */
  updateSketch?: Maybe<UpdateSketchPayload>;
  /** Updates a single `Sketch` using its globally unique id and a patch. */
  updateSketchByNodeId?: Maybe<UpdateSketchPayload>;
  /** Updates a single `SketchClass` using a unique key and a patch. */
  updateSketchClass?: Maybe<UpdateSketchClassPayload>;
  /** Updates a single `SketchClass` using its globally unique id and a patch. */
  updateSketchClassByNodeId?: Maybe<UpdateSketchClassPayload>;
  /** Updates a single `SketchFolder` using a unique key and a patch. */
  updateSketchFolder?: Maybe<UpdateSketchFolderPayload>;
  /** Updates a single `SketchFolder` using its globally unique id and a patch. */
  updateSketchFolderByNodeId?: Maybe<UpdateSketchFolderPayload>;
  /** Updates a single `Survey` using a unique key and a patch. */
  updateSurvey?: Maybe<UpdateSurveyPayload>;
  /** Updates a single `Survey` using its globally unique id and a patch. */
  updateSurveyByNodeId?: Maybe<UpdateSurveyPayload>;
  /** Updates a single `SurveyInvite` using a unique key and a patch. */
  updateSurveyInvite?: Maybe<UpdateSurveyInvitePayload>;
  /** Updates a single `SurveyInvite` using a unique key and a patch. */
  updateSurveyInviteByEmail?: Maybe<UpdateSurveyInvitePayload>;
  /** Updates a single `SurveyInvite` using a unique key and a patch. */
  updateSurveyInviteByEmailAndSurveyId?: Maybe<UpdateSurveyInvitePayload>;
  /** Updates a single `SurveyInvite` using its globally unique id and a patch. */
  updateSurveyInviteByNodeId?: Maybe<UpdateSurveyInvitePayload>;
  /**
   * Updates the list of groups that should have access to the given survey. Users
   * in any added groups will get an invite, and the system will create an invite for
   * any users that are added to the group. When removing a group, the system will
   * delete invites for any user that is no longer in an invited group. *Clients
   * should warn admins of this behavior when removing groups for an active survey*.
   * 
   * The list of invited groups can be accessed via `Survey.invitedGroups`.
   */
  updateSurveyInvitedGroups?: Maybe<UpdateSurveyInvitedGroupsPayload>;
  /** Updates a single `SurveyResponse` using a unique key and a patch. */
  updateSurveyResponse?: Maybe<UpdateSurveyResponsePayload>;
  /** Updates a single `SurveyResponse` using its globally unique id and a patch. */
  updateSurveyResponseByNodeId?: Maybe<UpdateSurveyResponsePayload>;
  /** Updates a single `Topic` using a unique key and a patch. */
  updateTopic?: Maybe<UpdateTopicPayload>;
  /** Updates a single `Topic` using its globally unique id and a patch. */
  updateTopicByNodeId?: Maybe<UpdateTopicPayload>;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationAddGroupToAclArgs = {
  input: AddGroupToAclInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationAddUserToGroupArgs = {
  input: AddUserToGroupInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationAddValidChildSketchClassArgs = {
  input: AddValidChildSketchClassInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationApproveParticipantArgs = {
  input: ApproveParticipantInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationConfirmOnboardedArgs = {
  input: ConfirmOnboardedInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationConfirmProjectInviteArgs = {
  token: Scalars['String'];
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationConfirmProjectInviteWithSurveyTokenArgs = {
  input: ConfirmProjectInviteWithSurveyTokenInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationConfirmProjectInviteWithVerifiedEmailArgs = {
  input: ConfirmProjectInviteWithVerifiedEmailInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateCommunityGuidelineArgs = {
  input: CreateCommunityGuidelineInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateFormConditionalRenderingRuleArgs = {
  input: CreateFormConditionalRenderingRuleInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateFormFieldArgs = {
  input: CreateFormFieldInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateFormTemplateFromSketchClassArgs = {
  input: CreateFormTemplateFromSketchClassInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateFormTemplateFromSurveyArgs = {
  input: CreateFormTemplateFromSurveyInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateForumArgs = {
  input: CreateForumInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateGroupArgs = {
  input: CreateGroupInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreatePostArgs = {
  input: CreatePostInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateProjectArgs = {
  input: CreateProjectInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateProjectInviteGroupArgs = {
  input: CreateProjectInviteGroupInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateProjectInvitesArgs = {
  input: CreateProjectInvitesInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateSketchArgs = {
  input: CreateSketchInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateSketchClassArgs = {
  input: CreateSketchClassInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateSketchFolderArgs = {
  input: CreateSketchFolderInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateSurveyArgs = {
  input: CreateSurveyInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateSurveyInvitedGroupArgs = {
  input: CreateSurveyInvitedGroupInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateSurveyInvitesArgs = {
  input: CreateSurveyInvitesInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateSurveyResponseArgs = {
  input: CreateSurveyResponseInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateTopicArgs = {
  input: CreateTopicInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteCommunityGuidelineArgs = {
  input: DeleteCommunityGuidelineInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteCommunityGuidelineByNodeIdArgs = {
  input: DeleteCommunityGuidelineByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteFormArgs = {
  input: DeleteFormInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteFormByNodeIdArgs = {
  input: DeleteFormByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteFormBySketchClassIdArgs = {
  input: DeleteFormBySketchClassIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteFormBySurveyIdArgs = {
  input: DeleteFormBySurveyIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteFormConditionalRenderingRuleArgs = {
  input: DeleteFormConditionalRenderingRuleInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteFormConditionalRenderingRuleByNodeIdArgs = {
  input: DeleteFormConditionalRenderingRuleByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteFormFieldArgs = {
  input: DeleteFormFieldInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteFormFieldByNodeIdArgs = {
  input: DeleteFormFieldByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteForumArgs = {
  input: DeleteForumInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteForumByNodeIdArgs = {
  input: DeleteForumByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteGroupArgs = {
  input: DeleteGroupInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteGroupByNodeIdArgs = {
  input: DeleteGroupByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteGroupByProjectIdAndNameArgs = {
  input: DeleteGroupByProjectIdAndNameInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeletePostArgs = {
  input: DeletePostInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeletePostByNodeIdArgs = {
  input: DeletePostByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteProjectArgs = {
  input: DeleteProjectInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteProjectInviteArgs = {
  input: DeleteProjectInviteInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteProjectInviteByEmailAndProjectIdArgs = {
  input: DeleteProjectInviteByEmailAndProjectIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteProjectInviteByNodeIdArgs = {
  input: DeleteProjectInviteByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteProjectInviteGroupByInviteIdAndGroupIdArgs = {
  input: DeleteProjectInviteGroupByInviteIdAndGroupIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteSketchArgs = {
  input: DeleteSketchInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteSketchByNodeIdArgs = {
  input: DeleteSketchByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteSketchClassArgs = {
  input: DeleteSketchClassInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteSketchClassByNodeIdArgs = {
  input: DeleteSketchClassByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteSketchFolderArgs = {
  input: DeleteSketchFolderInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteSketchFolderByNodeIdArgs = {
  input: DeleteSketchFolderByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteSurveyArgs = {
  input: DeleteSurveyInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteSurveyByNodeIdArgs = {
  input: DeleteSurveyByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteSurveyInviteArgs = {
  input: DeleteSurveyInviteInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteSurveyInviteByEmailArgs = {
  input: DeleteSurveyInviteByEmailInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteSurveyInviteByEmailAndSurveyIdArgs = {
  input: DeleteSurveyInviteByEmailAndSurveyIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteSurveyInviteByNodeIdArgs = {
  input: DeleteSurveyInviteByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteSurveyInvitedGroupBySurveyIdAndGroupIdArgs = {
  input: DeleteSurveyInvitedGroupBySurveyIdAndGroupIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteSurveyResponseArgs = {
  input: DeleteSurveyResponseInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteSurveyResponseByNodeIdArgs = {
  input: DeleteSurveyResponseByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteTopicArgs = {
  input: DeleteTopicInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteTopicByNodeIdArgs = {
  input: DeleteTopicByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDisableForumPostingArgs = {
  input: DisableForumPostingInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationEnableForumPostingArgs = {
  input: EnableForumPostingInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationGrantAdminAccessArgs = {
  input: GrantAdminAccessInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationInitializeBlankSketchClassFormArgs = {
  input: InitializeBlankSketchClassFormInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationInitializeBlankSurveyFormArgs = {
  input: InitializeBlankSurveyFormInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationInitializeSketchClassFormFromTemplateArgs = {
  input: InitializeSketchClassFormFromTemplateInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationInitializeSurveyFormFromTemplateArgs = {
  input: InitializeSurveyFormFromTemplateInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationJoinProjectArgs = {
  input: JoinProjectInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationLeaveProjectArgs = {
  input: LeaveProjectInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationMakeResponseDraftArgs = {
  input: MakeResponseDraftInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationMarkTopicAsReadArgs = {
  input: MarkTopicAsReadInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationRemoveGroupFromAclArgs = {
  input: RemoveGroupFromAclInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationRemoveUserFromGroupArgs = {
  input: RemoveUserFromGroupInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationRemoveValidChildSketchClassArgs = {
  input: RemoveValidChildSketchClassInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationRevokeAdminAccessArgs = {
  input: RevokeAdminAccessInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSendAllProjectInvitesArgs = {
  input: SendAllProjectInvitesInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSendProjectInvitesArgs = {
  input: SendProjectInvitesInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSendSurveyInviteReminderArgs = {
  inviteId: Scalars['Int'];
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSetFormFieldOrderArgs = {
  input: SetFormFieldOrderInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSetForumOrderArgs = {
  input: SetForumOrderInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSetPostHiddenByModeratorArgs = {
  input: SetPostHiddenByModeratorInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSetTopicLockedArgs = {
  input: SetTopicLockedInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSetTopicStickyArgs = {
  input: SetTopicStickyInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateAclArgs = {
  input: UpdateAclInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateAclByNodeIdArgs = {
  input: UpdateAclByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateAclBySketchClassIdArgs = {
  input: UpdateAclBySketchClassIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateCommunityGuidelineArgs = {
  input: UpdateCommunityGuidelineInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateCommunityGuidelineByNodeIdArgs = {
  input: UpdateCommunityGuidelineByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateEmailNotificationPreferenceByUserIdArgs = {
  input: UpdateEmailNotificationPreferenceByUserIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateFormConditionalRenderingRuleArgs = {
  input: UpdateFormConditionalRenderingRuleInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateFormConditionalRenderingRuleByNodeIdArgs = {
  input: UpdateFormConditionalRenderingRuleByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateFormFieldArgs = {
  input: UpdateFormFieldInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateFormFieldByNodeIdArgs = {
  input: UpdateFormFieldByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateForumArgs = {
  input: UpdateForumInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateForumByNodeIdArgs = {
  input: UpdateForumByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateGroupArgs = {
  input: UpdateGroupInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateGroupByNodeIdArgs = {
  input: UpdateGroupByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateGroupByProjectIdAndNameArgs = {
  input: UpdateGroupByProjectIdAndNameInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdatePostArgs = {
  input: UpdatePostInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateProfileByUserIdArgs = {
  input: UpdateProfileByUserIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateProjectArgs = {
  input: UpdateProjectInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateProjectByNodeIdArgs = {
  input: UpdateProjectByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateProjectBySlugArgs = {
  input: UpdateProjectBySlugInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateProjectInviteArgs = {
  input: UpdateProjectInviteInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateProjectInviteByEmailAndProjectIdArgs = {
  input: UpdateProjectInviteByEmailAndProjectIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateProjectInviteByNodeIdArgs = {
  input: UpdateProjectInviteByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateProjectInviteGroupByInviteIdAndGroupIdArgs = {
  input: UpdateProjectInviteGroupByInviteIdAndGroupIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateSketchArgs = {
  input: UpdateSketchInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateSketchByNodeIdArgs = {
  input: UpdateSketchByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateSketchClassArgs = {
  input: UpdateSketchClassInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateSketchClassByNodeIdArgs = {
  input: UpdateSketchClassByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateSketchFolderArgs = {
  input: UpdateSketchFolderInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateSketchFolderByNodeIdArgs = {
  input: UpdateSketchFolderByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateSurveyArgs = {
  input: UpdateSurveyInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateSurveyByNodeIdArgs = {
  input: UpdateSurveyByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateSurveyInviteArgs = {
  input: UpdateSurveyInviteInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateSurveyInviteByEmailArgs = {
  input: UpdateSurveyInviteByEmailInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateSurveyInviteByEmailAndSurveyIdArgs = {
  input: UpdateSurveyInviteByEmailAndSurveyIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateSurveyInviteByNodeIdArgs = {
  input: UpdateSurveyInviteByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateSurveyInvitedGroupsArgs = {
  input: UpdateSurveyInvitedGroupsInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateSurveyResponseArgs = {
  input: UpdateSurveyResponseInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateSurveyResponseByNodeIdArgs = {
  input: UpdateSurveyResponseByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateTopicArgs = {
  input: UpdateTopicInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateTopicByNodeIdArgs = {
  input: UpdateTopicByNodeIdInput;
};

/** An object with a globally unique `ID`. */
export type Node = {
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
};

/** Information about pagination in a connection. */
export type PageInfo = {
  __typename?: 'PageInfo';
  /** When paginating forwards, the cursor to continue. */
  endCursor?: Maybe<Scalars['Cursor']>;
  /** When paginating forwards, are there more items? */
  hasNextPage: Scalars['Boolean'];
  /** When paginating backwards, are there more items? */
  hasPreviousPage: Scalars['Boolean'];
  /** When paginating backwards, the cursor to continue. */
  startCursor?: Maybe<Scalars['Cursor']>;
};

export enum ParticipantSortBy {
  Email = 'EMAIL',
  Name = 'NAME'
}

export enum ParticipationStatus {
  /**
   * User has not joined or participated in the project before. This status would
   * only be accessible to a logged in user themselves, never in the admin listing of users.
   */
  None = 'NONE',
  /**
   * While the user has joined the project, they haven't shared (or later
   * un-shared) their profile. Admins will not be able to see any info about them
   * so they cannot be added to groups. Users cannot use any of the discussion or
   * sharing features without publishing their profile.
   */
  ParticipantHiddenProfile = 'PARTICIPANT_HIDDEN_PROFILE',
  /** With a shared profile, this user can now take actions like participating in discussion forums. */
  ParticipantSharedProfile = 'PARTICIPANT_SHARED_PROFILE',
  /** For invite-only projects, this user has requested access to the project and needs approval from an admin. */
  PendingApproval = 'PENDING_APPROVAL'
}

export type Post = Node & {
  __typename?: 'Post';
  authorId: Scalars['Int'];
  /** User Profile of the author. If a user has not shared their profile the post message will be hidden. */
  authorProfile?: Maybe<Profile>;
  createdAt: Scalars['Datetime'];
  /**
   * If set, the post has been hidden by a project admin. Contents of the post will
   * not be available to the client. Admins should update this field using
   * `setPostHiddenByModerator()`.
   */
  hiddenByModerator: Scalars['Boolean'];
  id: Scalars['Int'];
  /**
   * Message contents of the post as JSON for use with DraftJS. 
   * 
   * Message may be null if user is not currently sharing their profile, in which 
   * case the client should explain such. 
   * 
   * Message could also be null if `hiddenByModerator` is set. In that case the 
   * client should explain that the post violated the `CommunityGuidelines`, if set.
   */
  message?: Maybe<Scalars['JSON']>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** Reads a single `Topic` that is related to this `Post`. */
  topic?: Maybe<Topic>;
  topicId: Scalars['Int'];
};

/** A condition to be used against `Post` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type PostCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `topicId` field. */
  topicId?: Maybe<Scalars['Int']>;
};

/** A connection to a list of `Post` values. */
export type PostsConnection = {
  __typename?: 'PostsConnection';
  /** A list of edges which contains the `Post` and cursor to aid in pagination. */
  edges: Array<PostsEdge>;
  /** A list of `Post` objects. */
  nodes: Array<Maybe<Post>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Post` you could get from the connection. */
  totalCount: Scalars['Int'];
};

/** A `Post` edge in the connection. */
export type PostsEdge = {
  __typename?: 'PostsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `Post` at the end of the edge. */
  node?: Maybe<Post>;
};

/** Methods to use when ordering `Post`. */
export enum PostsOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  TopicIdAsc = 'TOPIC_ID_ASC',
  TopicIdDesc = 'TOPIC_ID_DESC'
}

/**
 * Personal information that users have contributed. This information is only 
 * accessible directly to admins on projects where the user has chosen to share the
 * information (via the `joinProject()` mutation).
 * 
 * Regular SeaSketch users can access user profiles thru accessor fields on shared
 * content like forum posts if they have been shared, but regular users have no 
 * means of listing out all profiles in bulk.
 */
export type Profile = {
  __typename?: 'Profile';
  affiliations?: Maybe<Scalars['String']>;
  bio?: Maybe<Scalars['String']>;
  email?: Maybe<Scalars['Email']>;
  fullname?: Maybe<Scalars['String']>;
  nickname?: Maybe<Scalars['String']>;
  picture?: Maybe<Scalars['String']>;
  /** Reads a single `User` that is related to this `Profile`. */
  user?: Maybe<User>;
  userId: Scalars['Int'];
};

/** Represents an update to a `Profile`. Fields that are set will be updated. */
export type ProfilePatch = {
  affiliations?: Maybe<Scalars['String']>;
  bio?: Maybe<Scalars['String']>;
  email?: Maybe<Scalars['Email']>;
  fullname?: Maybe<Scalars['String']>;
  nickname?: Maybe<Scalars['String']>;
  picture?: Maybe<Scalars['String']>;
  userId?: Maybe<Scalars['Int']>;
};

/** A `Profile` edge in the connection. */
export type ProfilesEdge = {
  __typename?: 'ProfilesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `Profile` at the end of the edge. */
  node?: Maybe<Profile>;
};

/** Methods to use when ordering `Profile`. */
export enum ProfilesOrderBy {
  Natural = 'NATURAL',
  UserIdAsc = 'USER_ID_ASC',
  UserIdDesc = 'USER_ID_DESC'
}

/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type Project = Node & {
  __typename?: 'Project';
  /** Admins can control whether a project is public, invite-only, or admins-only. */
  accessControl: ProjectAccessControlSetting;
  adminCount?: Maybe<Scalars['Int']>;
  /** Listing of all users who have admin access. */
  admins?: Maybe<Array<Maybe<User>>>;
  /** Reads a single `CommunityGuideline` that is related to this `Project`. */
  communityGuidelines?: Maybe<CommunityGuideline>;
  /** Should be a short length in order to fit in the project header. */
  description?: Maybe<Scalars['String']>;
  /** List of all discussion forums the current user has access to. */
  forums: Array<Forum>;
  /**
   * Listing of current user groups.
   * 
   * Group membership can be updated using the `addUserToGroup`/`removeUserFromGroup` mutations
   */
  groups: Array<Group>;
  id: Scalars['Int'];
  /**
   * Returns the project invitation for the current user session, if any. Will not
   * appear until the invite has been sent. The system determines the relevant
   * invite using the `canonical_email` claim in the user access token.
   * 
   * If the invite status is unconfirmed the client should accept it using the
   * `confirmProjectInviteWithVerifiedEmail()` mutation. Details on how to work
   * with user ingress and project invites [can be found on the
   * wiki](https://github.com/seasketch/next/wiki/User-Ingress).
   */
  invite?: Maybe<ProjectInvite>;
  /**
   * Breakdown of number of invites per status. Used to display counts in overview
   * listing of users, groups, and invites in the user administration dashboard.
   */
  inviteCounts?: Maybe<Array<Maybe<InviteStat>>>;
  /** List project invites by status */
  invitesConnection: ProjectInvitesConnection;
  /** Featured projects may be given prominent placement on the homepage. This property can only be modified by superusers. */
  isFeatured: Scalars['Boolean'];
  /**
   * Project admins can decide whether their project will be displayed on the
   * public project listing via Query.projectsConnection.
   */
  isListed: Scalars['Boolean'];
  /** If a logoUrl is provided, it will link to this url in a new window if provided. */
  logoLink?: Maybe<Scalars['String']>;
  /**
   * URL referencing an image that will be used to represent the project. Will be
   * displayed at 48x48 pixels and must be a public url.
   */
  logoUrl?: Maybe<Scalars['String']>;
  /** List of all folders created by this user. */
  myFolders?: Maybe<Array<Maybe<SketchFolder>>>;
  /** A list of all sketches for this project and the current user session */
  mySketches?: Maybe<Array<Maybe<Sketch>>>;
  name: Scalars['String'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** Count of all users who have opted into participating in the project, sharing their profile with project administrators. */
  participantCount?: Maybe<Scalars['Int']>;
  /**
   * All users who have opted into participating in the project, sharing 
   * their profile with project administrators.
   * 
   * If the project is invite-only, users who have not been approved will not appear
   * in this list. Those users can be accessed via `unapprovedParticipants()`
   */
  participants?: Maybe<Array<Maybe<User>>>;
  /**
   * Whether the current user has any discussion forum posts in this project. Use
   * this to determine whether `project.communityGuidelines` should be shown to the
   * user before their first post.
   */
  sessionHasPosts?: Maybe<Scalars['Boolean']>;
  /**
   * Indicates whether current session should have special access or group
   * privileges. These grants will not be active if the user does not have a
   * verified email address.
   * 
   * Clients should check for situations where a user access token has a false
   * `email_verified` cliam paired with privileged access. If that is the case they
   * should prompt users to confirm their email address.
   */
  sessionHasPrivilegedAccess?: Maybe<Scalars['Boolean']>;
  /**
   * Returns true if the user has admin privileges on this project. Will return
   * true even if the session email is not verified, but permissions will not work until it is.
   */
  sessionIsAdmin?: Maybe<Scalars['Boolean']>;
  /**
   * Invites (and related tokens) for surveys which this user has not yet responded
   * to. Details on how to handle survey invites [can be found on the
   * wiki](https://github.com/seasketch/next/wiki/User-Ingress#survey-invites).
   */
  sessionOutstandingSurveyInvites?: Maybe<Array<Maybe<SurveyTokenInfo>>>;
  /** Participation status for the currently logged-in session */
  sessionParticipationStatus?: Maybe<ParticipationStatus>;
  /**
   * List of all the SketchClasses that can be used in digitizing spatial data. 
   * Accessible to all users, though access control settings may limit which users
   * can access some SketchClasses.
   */
  sketchClasses: Array<SketchClass>;
  /** Short identifier for the project used in the url. This property cannot be changed after project creation. */
  slug: Scalars['String'];
  /** Listing of all Surveys accessible to the current user. */
  surveys: Array<Survey>;
  /** Number of users who have outstanding access requests. Only relevant for invite-only projects. */
  unapprovedParticipantCount?: Maybe<Scalars['Int']>;
  /**
   * For invite-only projects. List all pending participation requests.
   * 
   * Users can be approved using the `approveParticipant()` mutation.
   */
  unapprovedParticipants?: Maybe<Array<Maybe<User>>>;
  /** Project url will resolve to `https://seasketch.org/{slug}/` */
  url?: Maybe<Scalars['String']>;
  /** List of all banned users. Listing only accessible to admins. */
  usersBannedFromForums?: Maybe<Array<Maybe<User>>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectAdminsArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectForumsArgs = {
  condition?: Maybe<ForumCondition>;
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<ForumsOrderBy>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectGroupsArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<GroupsOrderBy>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectInviteCountsArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectInvitesConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  direction?: Maybe<SortByDirection>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<InviteOrderBy>;
  statuses?: Maybe<Array<Maybe<InviteStatus>>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectMyFoldersArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectMySketchesArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectParticipantsArgs = {
  direction?: Maybe<SortByDirection>;
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<ParticipantSortBy>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectSessionOutstandingSurveyInvitesArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectSketchClassesArgs = {
  condition?: Maybe<SketchClassCondition>;
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<SketchClassesOrderBy>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectSurveysArgs = {
  condition?: Maybe<SurveyCondition>;
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<SurveysOrderBy>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectUnapprovedParticipantsArgs = {
  direction?: Maybe<SortByDirection>;
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<ParticipantSortBy>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectUsersBannedFromForumsArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};

export enum ProjectAccessControlSetting {
  /** Only project administrators will be able to access the project. */
  AdminsOnly = 'ADMINS_ONLY',
  /**
   * Only users who have been invited to join the project can participate. Admins
   * can send email invitations with a special link to signup.
   * 
   * Other users may request access, in which case admins can approve those access requests if appropriate.
   */
  InviteOnly = 'INVITE_ONLY',
  /**
   * Anyone can join and use a public project, though access to particular
   * datasets, sketch classes, and forums may be restricted via access control lists.
   */
  Public = 'PUBLIC'
}

/** A condition to be used against `Project` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type ProjectCondition = {
  /** Checks for equality with the object’s `accessControl` field. */
  accessControl?: Maybe<ProjectAccessControlSetting>;
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `isFeatured` field. */
  isFeatured?: Maybe<Scalars['Boolean']>;
  /** Checks for equality with the object’s `slug` field. */
  slug?: Maybe<Scalars['String']>;
};

/**
 * Admins can invite users to their project, adding them to user groups and 
 * distributing admin privileges as needed. Invitations can be immediately sent via
 * email or they can be sent out later in batches. 
 * 
 * Use the `createProjectInvites()`
 * mutation to create one or more invitations and then use graphile generated 
 * mutations to update and delete them.
 * 
 * Details on [handling user ingress with invitation
 * tokens](https://github.com/seasketch/next/wiki/User-Ingress#project-invites) and [the mailer subsystem](https://github.com/seasketch/next/wiki/User-and-Survey-Invite-Management)
 * can be found on the wiki.
 */
export type ProjectInvite = Node & {
  __typename?: 'ProjectInvite';
  createdAt: Scalars['Datetime'];
  /** Specified by admin when invite was created. */
  email: Scalars['Email'];
  /** Specified by admin when invite was created. */
  fullname?: Maybe<Scalars['String']>;
  /**
   * Groups to be assigned to the user once the invite is confirmed. Existing
   * invite group membership can be updated using the crud operations on
   * ProjectInviteGroup types.
   */
  groups?: Maybe<Array<Maybe<Group>>>;
  id: Scalars['Int'];
  /** Listing of all emails related to this invite. */
  inviteEmails: Array<InviteEmail>;
  /** User will be made an admin of the project if true. They will not be given special access until their email is verified. */
  makeAdmin: Scalars['Boolean'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  projectId: Scalars['Int'];
  /** Status derived from the state of invite emails as well as token expiration */
  status?: Maybe<InviteStatus>;
  /** Is set upon invite acceptance. */
  userId?: Maybe<Scalars['Int']>;
  /** Project invite has already been accepted. */
  wasUsed: Scalars['Boolean'];
};


/**
 * Admins can invite users to their project, adding them to user groups and 
 * distributing admin privileges as needed. Invitations can be immediately sent via
 * email or they can be sent out later in batches. 
 * 
 * Use the `createProjectInvites()`
 * mutation to create one or more invitations and then use graphile generated 
 * mutations to update and delete them.
 * 
 * Details on [handling user ingress with invitation
 * tokens](https://github.com/seasketch/next/wiki/User-Ingress#project-invites) and [the mailer subsystem](https://github.com/seasketch/next/wiki/User-and-Survey-Invite-Management)
 * can be found on the wiki.
 */
export type ProjectInviteGroupsArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};


/**
 * Admins can invite users to their project, adding them to user groups and 
 * distributing admin privileges as needed. Invitations can be immediately sent via
 * email or they can be sent out later in batches. 
 * 
 * Use the `createProjectInvites()`
 * mutation to create one or more invitations and then use graphile generated 
 * mutations to update and delete them.
 * 
 * Details on [handling user ingress with invitation
 * tokens](https://github.com/seasketch/next/wiki/User-Ingress#project-invites) and [the mailer subsystem](https://github.com/seasketch/next/wiki/User-and-Survey-Invite-Management)
 * can be found on the wiki.
 */
export type ProjectInviteInviteEmailsArgs = {
  condition?: Maybe<InviteEmailCondition>;
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<InviteEmailsOrderBy>>;
};

export type ProjectInviteGroup = {
  __typename?: 'ProjectInviteGroup';
  groupId: Scalars['Int'];
  inviteId: Scalars['Int'];
};

/**
 * A condition to be used against `ProjectInviteGroup` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type ProjectInviteGroupCondition = {
  /** Checks for equality with the object’s `groupId` field. */
  groupId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `inviteId` field. */
  inviteId?: Maybe<Scalars['Int']>;
};

/** An input for mutations affecting `ProjectInviteGroup` */
export type ProjectInviteGroupInput = {
  groupId: Scalars['Int'];
  inviteId: Scalars['Int'];
};

/** Represents an update to a `ProjectInviteGroup`. Fields that are set will be updated. */
export type ProjectInviteGroupPatch = {
  groupId?: Maybe<Scalars['Int']>;
  inviteId?: Maybe<Scalars['Int']>;
};

/** A connection to a list of `ProjectInviteGroup` values. */
export type ProjectInviteGroupsConnection = {
  __typename?: 'ProjectInviteGroupsConnection';
  /** A list of edges which contains the `ProjectInviteGroup` and cursor to aid in pagination. */
  edges: Array<ProjectInviteGroupsEdge>;
  /** A list of `ProjectInviteGroup` objects. */
  nodes: Array<Maybe<ProjectInviteGroup>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `ProjectInviteGroup` you could get from the connection. */
  totalCount: Scalars['Int'];
};

/** A `ProjectInviteGroup` edge in the connection. */
export type ProjectInviteGroupsEdge = {
  __typename?: 'ProjectInviteGroupsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `ProjectInviteGroup` at the end of the edge. */
  node?: Maybe<ProjectInviteGroup>;
};

/** Methods to use when ordering `ProjectInviteGroup`. */
export enum ProjectInviteGroupsOrderBy {
  GroupIdAsc = 'GROUP_ID_ASC',
  GroupIdDesc = 'GROUP_ID_DESC',
  InviteIdAsc = 'INVITE_ID_ASC',
  InviteIdDesc = 'INVITE_ID_DESC',
  Natural = 'NATURAL'
}

/** An input for mutations affecting `ProjectInviteOption` */
export type ProjectInviteOptionInput = {
  email?: Maybe<Scalars['Email']>;
  fullname?: Maybe<Scalars['String']>;
};

/** Represents an update to a `ProjectInvite`. Fields that are set will be updated. */
export type ProjectInvitePatch = {
  /** Specified by admin when invite was created. */
  email?: Maybe<Scalars['Email']>;
  /** Specified by admin when invite was created. */
  fullname?: Maybe<Scalars['String']>;
  /** User will be made an admin of the project if true. They will not be given special access until their email is verified. */
  makeAdmin?: Maybe<Scalars['Boolean']>;
};

/** A connection to a list of `ProjectInvite` values. */
export type ProjectInvitesConnection = {
  __typename?: 'ProjectInvitesConnection';
  /** A list of edges which contains the `ProjectInvite` and cursor to aid in pagination. */
  edges: Array<ProjectInvitesEdge>;
  /** A list of `ProjectInvite` objects. */
  nodes: Array<Maybe<ProjectInvite>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `ProjectInvite` you could get from the connection. */
  totalCount: Scalars['Int'];
};

/** A `ProjectInvite` edge in the connection. */
export type ProjectInvitesEdge = {
  __typename?: 'ProjectInvitesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `ProjectInvite` at the end of the edge. */
  node?: Maybe<ProjectInvite>;
};

export type ProjectInviteTokenClaims = {
  __typename?: 'ProjectInviteTokenClaims';
  admin: Scalars['Boolean'];
  email: Scalars['String'];
  fullname?: Maybe<Scalars['String']>;
  inviteId: Scalars['Int'];
  projectId: Scalars['Int'];
  wasUsed: Scalars['Boolean'];
};

export type ProjectInviteTokenVerificationResults = {
  __typename?: 'ProjectInviteTokenVerificationResults';
  claims?: Maybe<ProjectInviteTokenClaims>;
  error?: Maybe<Scalars['String']>;
};

/** Represents an update to a `Project`. Fields that are set will be updated. */
export type ProjectPatch = {
  /** Admins can control whether a project is public, invite-only, or admins-only. */
  accessControl?: Maybe<ProjectAccessControlSetting>;
  /** Should be a short length in order to fit in the project header. */
  description?: Maybe<Scalars['String']>;
  /** Featured projects may be given prominent placement on the homepage. This property can only be modified by superusers. */
  isFeatured?: Maybe<Scalars['Boolean']>;
  /**
   * Project admins can decide whether their project will be displayed on the
   * public project listing via Query.projectsConnection.
   */
  isListed?: Maybe<Scalars['Boolean']>;
  /** If a logoUrl is provided, it will link to this url in a new window if provided. */
  logoLink?: Maybe<Scalars['String']>;
  /**
   * URL referencing an image that will be used to represent the project. Will be
   * displayed at 48x48 pixels and must be a public url.
   */
  logoUrl?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
};

/** A connection to a list of `Project` values. */
export type ProjectsConnection = {
  __typename?: 'ProjectsConnection';
  /** A list of edges which contains the `Project` and cursor to aid in pagination. */
  edges: Array<ProjectsEdge>;
  /** A list of `Project` objects. */
  nodes: Array<Maybe<Project>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Project` you could get from the connection. */
  totalCount: Scalars['Int'];
};

/** A `Project` edge in the connection. */
export type ProjectsEdge = {
  __typename?: 'ProjectsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `Project` at the end of the edge. */
  node?: Maybe<Project>;
};

/** Methods to use when ordering `Project`. */
export enum ProjectsOrderBy {
  AccessControlAsc = 'ACCESS_CONTROL_ASC',
  AccessControlDesc = 'ACCESS_CONTROL_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  IsFeaturedAsc = 'IS_FEATURED_ASC',
  IsFeaturedDesc = 'IS_FEATURED_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  SlugAsc = 'SLUG_ASC',
  SlugDesc = 'SLUG_DESC'
}

/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type Query = Node & {
  __typename?: 'Query';
  acl?: Maybe<Acl>;
  /** Reads a single `Acl` using its globally unique `ID`. */
  aclByNodeId?: Maybe<Acl>;
  aclBySketchClassId?: Maybe<Acl>;
  communityGuideline?: Maybe<CommunityGuideline>;
  /** Reads a single `CommunityGuideline` using its globally unique `ID`. */
  communityGuidelineByNodeId?: Maybe<CommunityGuideline>;
  /**
   * The current SeaSketch Project, which is determined by the `referer` or
   * `x-ss-slug` request headers. Most queries used by the app should be rooted on this field.
   */
  currentProject?: Maybe<Project>;
  emailNotificationPreferenceByUserId?: Maybe<EmailNotificationPreference>;
  /** Reads and enables pagination through a set of `EmailNotificationPreference`. */
  emailNotificationPreferencesConnection?: Maybe<EmailNotificationPreferencesConnection>;
  form?: Maybe<Form>;
  /** Reads a single `Form` using its globally unique `ID`. */
  formByNodeId?: Maybe<Form>;
  formBySketchClassId?: Maybe<Form>;
  formBySurveyId?: Maybe<Form>;
  formConditionalRenderingRule?: Maybe<FormConditionalRenderingRule>;
  /** Reads a single `FormConditionalRenderingRule` using its globally unique `ID`. */
  formConditionalRenderingRuleByNodeId?: Maybe<FormConditionalRenderingRule>;
  formField?: Maybe<FormField>;
  /** Reads a single `FormField` using its globally unique `ID`. */
  formFieldByNodeId?: Maybe<FormField>;
  forum?: Maybe<Forum>;
  /** Reads a single `Forum` using its globally unique `ID`. */
  forumByNodeId?: Maybe<Forum>;
  group?: Maybe<Group>;
  /** Reads a single `Group` using its globally unique `ID`. */
  groupByNodeId?: Maybe<Group>;
  groupByProjectIdAndName?: Maybe<Group>;
  /** Reads a single `InviteEmail` using its globally unique `ID`. */
  inviteEmailByNodeId?: Maybe<InviteEmail>;
  /** Access the current session's User. The user is determined by the access token embedded in the `Authorization` header. */
  me?: Maybe<User>;
  /** Fetches an object given its globally unique `ID`. */
  node?: Maybe<Node>;
  /** The root query type must be a `Node` to work well with Relay 1 mutations. This just resolves to `query`. */
  nodeId: Scalars['ID'];
  post?: Maybe<Post>;
  /** Reads a single `Post` using its globally unique `ID`. */
  postByNodeId?: Maybe<Post>;
  /** Reads and enables pagination through a set of `Post`. */
  postsConnection?: Maybe<PostsConnection>;
  profileByUserId?: Maybe<Profile>;
  project?: Maybe<Project>;
  /** Reads a single `Project` using its globally unique `ID`. */
  projectByNodeId?: Maybe<Project>;
  projectBySlug?: Maybe<Project>;
  projectInvite?: Maybe<ProjectInvite>;
  projectInviteByEmailAndProjectId?: Maybe<ProjectInvite>;
  /** Reads a single `ProjectInvite` using its globally unique `ID`. */
  projectInviteByNodeId?: Maybe<ProjectInvite>;
  projectInviteGroupByInviteIdAndGroupId?: Maybe<ProjectInviteGroup>;
  /** Reads and enables pagination through a set of `ProjectInviteGroup`. */
  projectInviteGroupsConnection?: Maybe<ProjectInviteGroupsConnection>;
  /**
   * The projectsConnection exposes all SeaSketch projects the current session has 
   * access to. For a superuser, this would be all of them (that aren't deleted). 
   * For a project administrator, they have access to all public projects and those 
   * that they administer. For everyone else, they see all public projects and any 
   * `invite-only` projects that they are approved members of.
   * 
   * The projectsConnection exposes a fully-featured Relay compatible connection so 
   * that an efficient listing can be made of the hundreds of SeaSketch Projects.
   */
  projectsConnection?: Maybe<ProjectsConnection>;
  /**
   * Exposes the root query type nested one level down. This is helpful for Relay 1
   * which can only query top level fields if they are in a particular form.
   */
  query: Query;
  sessionIsBannedFromPosting?: Maybe<Scalars['Boolean']>;
  sketch?: Maybe<Sketch>;
  /** Reads a single `Sketch` using its globally unique `ID`. */
  sketchByNodeId?: Maybe<Sketch>;
  sketchClass?: Maybe<SketchClass>;
  /** Reads a single `SketchClass` using its globally unique `ID`. */
  sketchClassByNodeId?: Maybe<SketchClass>;
  sketchFolder?: Maybe<SketchFolder>;
  /** Reads a single `SketchFolder` using its globally unique `ID`. */
  sketchFolderByNodeId?: Maybe<SketchFolder>;
  /**
   * Note that when requesting a survey and related resources (project, forms &
   * fields) from an invite link when anonymous, the `x-ss-survey-invite-token`
   * header will need to be set in order to gain access to protected resources. For
   * more details [see the
   * wiki](https://github.com/seasketch/next/wiki/User-Ingress#survey-invites)
   */
  survey?: Maybe<Survey>;
  /** Reads a single `Survey` using its globally unique `ID`. */
  surveyByNodeId?: Maybe<Survey>;
  surveyInvite?: Maybe<SurveyInvite>;
  surveyInviteByEmail?: Maybe<SurveyInvite>;
  surveyInviteByEmailAndSurveyId?: Maybe<SurveyInvite>;
  /** Reads a single `SurveyInvite` using its globally unique `ID`. */
  surveyInviteByNodeId?: Maybe<SurveyInvite>;
  surveyResponse?: Maybe<SurveyResponse>;
  /** Reads a single `SurveyResponse` using its globally unique `ID`. */
  surveyResponseByNodeId?: Maybe<SurveyResponse>;
  /**
   * Template forms can be created by SeaSketch superusers for use in **any** 
   * project. For example, there could be a template for a human-uses survey that
   * project administrators can copy and use as a starting point for customization.
   * 
   * SeaSketch superusers can create template Forms using the `createFormTemplateFromSketchClass` 
   * and `createFormTemplateFromSurvey` mutations.
   */
  templateForms?: Maybe<Array<Maybe<Form>>>;
  topic?: Maybe<Topic>;
  /** Reads a single `Topic` using its globally unique `ID`. */
  topicByNodeId?: Maybe<Topic>;
  /** Reads and enables pagination through a set of `Topic`. */
  topicsConnection?: Maybe<TopicsConnection>;
  user?: Maybe<User>;
  /** Reads a single `User` using its globally unique `ID`. */
  userByNodeId?: Maybe<User>;
  /**
   * Verify whether the an invite token has a valid signature and has not yet
   * expired.
   * 
   * Use before attempting the confirmProjectInvite() mutation.
   * More details on how to handle invites can be found
   * [on the wiki](https://github.com/seasketch/next/wiki/User-Ingress#project-invites)
   */
  verifyProjectInvite?: Maybe<ProjectInviteTokenVerificationResults>;
  /**
   * Verify whether the an invite token has a valid signature and has not yet
   * expired or been used.
   * 
   * Use before starting an invite-only survey. For info on invite handling
   * [see the wiki](https://github.com/seasketch/next/wiki/User-Ingress#survey-invites)
   */
  verifySurveyInvite?: Maybe<SurveyInviteTokenVerificationResults>;
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryAclArgs = {
  id: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryAclByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryAclBySketchClassIdArgs = {
  sketchClassId: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryCommunityGuidelineArgs = {
  projectId: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryCommunityGuidelineByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryEmailNotificationPreferenceByUserIdArgs = {
  userId: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryEmailNotificationPreferencesConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<EmailNotificationPreferenceCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<EmailNotificationPreferencesOrderBy>>;
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryFormArgs = {
  id: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryFormByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryFormBySketchClassIdArgs = {
  sketchClassId: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryFormBySurveyIdArgs = {
  surveyId: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryFormConditionalRenderingRuleArgs = {
  id: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryFormConditionalRenderingRuleByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryFormFieldArgs = {
  id: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryFormFieldByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryForumArgs = {
  id: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryForumByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryGroupArgs = {
  id: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryGroupByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryGroupByProjectIdAndNameArgs = {
  name: Scalars['String'];
  projectId: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryInviteEmailByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryNodeArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryPostArgs = {
  id: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryPostByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryPostsConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<PostCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<PostsOrderBy>>;
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryProfileByUserIdArgs = {
  userId: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryProjectArgs = {
  id: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryProjectByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryProjectBySlugArgs = {
  slug: Scalars['String'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryProjectInviteArgs = {
  id: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryProjectInviteByEmailAndProjectIdArgs = {
  email: Scalars['Email'];
  projectId: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryProjectInviteByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryProjectInviteGroupByInviteIdAndGroupIdArgs = {
  groupId: Scalars['Int'];
  inviteId: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryProjectInviteGroupsConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<ProjectInviteGroupCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<ProjectInviteGroupsOrderBy>>;
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryProjectsConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<ProjectCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<ProjectsOrderBy>>;
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QuerySessionIsBannedFromPostingArgs = {
  pid?: Maybe<Scalars['Int']>;
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QuerySketchArgs = {
  id: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QuerySketchByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QuerySketchClassArgs = {
  id: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QuerySketchClassByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QuerySketchFolderArgs = {
  id: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QuerySketchFolderByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QuerySurveyArgs = {
  id: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QuerySurveyByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QuerySurveyInviteArgs = {
  id: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QuerySurveyInviteByEmailArgs = {
  email: Scalars['Email'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QuerySurveyInviteByEmailAndSurveyIdArgs = {
  email: Scalars['Email'];
  surveyId: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QuerySurveyInviteByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QuerySurveyResponseArgs = {
  id: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QuerySurveyResponseByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryTemplateFormsArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryTopicArgs = {
  id: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryTopicByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryTopicsConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<TopicCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<TopicsOrderBy>>;
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryUserArgs = {
  id: Scalars['Int'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryUserByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryVerifyProjectInviteArgs = {
  token: Scalars['String'];
};


/**
 * Most relevant root-level queries are listed first, which concern getting 
 * the currently logged-in user (`me`) and project (`currentProject`). 
 * There are also cross-project resources such as form templates and of 
 * course the project listing connection. Most queries when working from a project
 * should be performed using fields on the `Project` type.
 * 
 * Postgraphile also automatically generates a variety of accessor queries 
 * for each database table. These are unlikely to be needed often but may possibly 
 * be utilized by sophisticated GraphQL clients in the future to update caches.
 */
export type QueryVerifySurveyInviteArgs = {
  token: Scalars['String'];
};

/** All input for the `removeGroupFromAcl` mutation. */
export type RemoveGroupFromAclInput = {
  aclId?: Maybe<Scalars['Int']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  groupId?: Maybe<Scalars['Int']>;
};

/** The output of our `removeGroupFromAcl` mutation. */
export type RemoveGroupFromAclPayload = {
  __typename?: 'RemoveGroupFromAclPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `removeUserFromGroup` mutation. */
export type RemoveUserFromGroupInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  groupId?: Maybe<Scalars['Int']>;
  userId?: Maybe<Scalars['Int']>;
};

/** The output of our `removeUserFromGroup` mutation. */
export type RemoveUserFromGroupPayload = {
  __typename?: 'RemoveUserFromGroupPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `removeValidChildSketchClass` mutation. */
export type RemoveValidChildSketchClassInput = {
  child?: Maybe<Scalars['Int']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  parent?: Maybe<Scalars['Int']>;
};

/** The output of our `removeValidChildSketchClass` mutation. */
export type RemoveValidChildSketchClassPayload = {
  __typename?: 'RemoveValidChildSketchClassPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `revokeAdminAccess` mutation. */
export type RevokeAdminAccessInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
  userId?: Maybe<Scalars['Int']>;
};

/** The output of our `revokeAdminAccess` mutation. */
export type RevokeAdminAccessPayload = {
  __typename?: 'RevokeAdminAccessPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `sendAllProjectInvites` mutation. */
export type SendAllProjectInvitesInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
};

/** The output of our `sendAllProjectInvites` mutation. */
export type SendAllProjectInvitesPayload = {
  __typename?: 'SendAllProjectInvitesPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  inviteEmails?: Maybe<Array<Maybe<InviteEmail>>>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `sendProjectInvites` mutation. */
export type SendProjectInvitesInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  inviteIds?: Maybe<Array<Maybe<Scalars['Int']>>>;
};

/** The output of our `sendProjectInvites` mutation. */
export type SendProjectInvitesPayload = {
  __typename?: 'SendProjectInvitesPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  inviteEmails?: Maybe<Array<Maybe<InviteEmail>>>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `setFormFieldOrder` mutation. */
export type SetFormFieldOrderInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  fieldIds?: Maybe<Array<Maybe<Scalars['Int']>>>;
};

/** The output of our `setFormFieldOrder` mutation. */
export type SetFormFieldOrderPayload = {
  __typename?: 'SetFormFieldOrderPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  formFields?: Maybe<Array<Maybe<FormField>>>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `setForumOrder` mutation. */
export type SetForumOrderInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  forumIds?: Maybe<Array<Maybe<Scalars['Int']>>>;
};

/** The output of our `setForumOrder` mutation. */
export type SetForumOrderPayload = {
  __typename?: 'SetForumOrderPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  forums?: Maybe<Array<Maybe<Forum>>>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `setPostHiddenByModerator` mutation. */
export type SetPostHiddenByModeratorInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  postId?: Maybe<Scalars['Int']>;
  value?: Maybe<Scalars['Boolean']>;
};

/** The output of our `setPostHiddenByModerator` mutation. */
export type SetPostHiddenByModeratorPayload = {
  __typename?: 'SetPostHiddenByModeratorPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  post?: Maybe<Post>;
  /** An edge for our `Post`. May be used by Relay 1. */
  postEdge?: Maybe<PostsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Topic` that is related to this `Post`. */
  topic?: Maybe<Topic>;
};


/** The output of our `setPostHiddenByModerator` mutation. */
export type SetPostHiddenByModeratorPayloadPostEdgeArgs = {
  orderBy?: Maybe<Array<PostsOrderBy>>;
};

/** All input for the `setTopicLocked` mutation. */
export type SetTopicLockedInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  topicId?: Maybe<Scalars['Int']>;
  value?: Maybe<Scalars['Boolean']>;
};

/** The output of our `setTopicLocked` mutation. */
export type SetTopicLockedPayload = {
  __typename?: 'SetTopicLockedPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `Forum` that is related to this `Topic`. */
  forum?: Maybe<Forum>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  topic?: Maybe<Topic>;
  /** An edge for our `Topic`. May be used by Relay 1. */
  topicEdge?: Maybe<TopicsEdge>;
};


/** The output of our `setTopicLocked` mutation. */
export type SetTopicLockedPayloadTopicEdgeArgs = {
  orderBy?: Maybe<Array<TopicsOrderBy>>;
};

/** All input for the `setTopicSticky` mutation. */
export type SetTopicStickyInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  topicId?: Maybe<Scalars['Int']>;
  value?: Maybe<Scalars['Boolean']>;
};

/** The output of our `setTopicSticky` mutation. */
export type SetTopicStickyPayload = {
  __typename?: 'SetTopicStickyPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `Forum` that is related to this `Topic`. */
  forum?: Maybe<Forum>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  topic?: Maybe<Topic>;
  /** An edge for our `Topic`. May be used by Relay 1. */
  topicEdge?: Maybe<TopicsEdge>;
};


/** The output of our `setTopicSticky` mutation. */
export type SetTopicStickyPayloadTopicEdgeArgs = {
  orderBy?: Maybe<Array<TopicsOrderBy>>;
};

/**
 * A *Sketch* is a spatial feature that matches the schema defined by the related 
 * *SketchClass*. User *Sketches* appears in the user's "My Plans" tab and can be
 * shared in the discussion forum. They are also the gateway to analytical reports.
 * 
 * Sketches are completely owned by individual users, so access control rules 
 * ensure that only the owner of a sketch can perform CRUD operations on them. 
 * Admins have no special access. Use the graphile-generated mutations to manage 
 * these records.
 */
export type Sketch = Node & {
  __typename?: 'Sketch';
  /** Bounding box of the final preprocessed geometry. [xmin, ymin, xmax, ymax] */
  bbox?: Maybe<Array<Maybe<Scalars['Float']>>>;
  /** Reads a single `Sketch` that is related to this `Sketch`. */
  collection?: Maybe<Sketch>;
  /** If the sketch is not a collection, it can belong to a collection (collections cannot be nested). */
  collectionId?: Maybe<Scalars['Int']>;
  /** Reads a single `Sketch` that is related to this `Sketch`. */
  copiedFrom?: Maybe<Sketch>;
  /**
   * If this Sketch started as a copy of another it is tracked here. Eventually
   * SeaSketch may have a means of visualizing how plans are iterated on over time.
   */
  copyOf?: Maybe<Scalars['Int']>;
  /** Parent folder. Both regular sketches and collections may be nested within folders for organization purposes. */
  folderId?: Maybe<Scalars['Int']>;
  /**
   * The geometry of the Sketch **after** it has been preprocessed. This is the
   * geometry that is used for reporting. Preprocessed geometries may be extremely
   * large and complex, so it may be necessary to access them through a vector tile
   * service or some other optimization.
   */
  geom?: Maybe<GeometryGeometry>;
  id: Scalars['Int'];
  /** User provided name for the sketch. */
  name: Scalars['String'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /**
   * Number of points in the final geometry. Can be used to gauge the complexity of
   * the shape and decide whether to load via graphql or use a vector tile service.
   */
  numVertices?: Maybe<Scalars['Int']>;
  /** Reads a single `SketchClass` that is related to this `Sketch`. */
  sketchClass?: Maybe<SketchClass>;
  /** SketchClass that defines the behavior of this type of sketch. */
  sketchClassId: Scalars['Int'];
  /** Reads a single `User` that is related to this `Sketch`. */
  user?: Maybe<User>;
  /**
   * Spatial feature the user directly digitized, without preprocessing. This is
   * the feature that should be used if the Sketch is later edited.
   */
  userGeom?: Maybe<GeometryGeometry>;
  /** Owner of the sketch. */
  userId: Scalars['Int'];
};

/** Sketch Classes act as a schema for sketches drawn by users. */
export type SketchClass = Node & {
  __typename?: 'SketchClass';
  /**
   * Access control lists can be used by admins to control who can digitize
   * sketches of this class. All users will have access to SketchClass schemas in
   * order to render information posted to forums, but they will only be able to
   * digitize or edit these sketches if they are on the access control list.
   */
  acl?: Maybe<Acl>;
  /**
   * If set to true, a geometry_type of POLYGON would allow for both POLYGONs and 
   * MULTIPOLYGONs after preprocessing or on spatial file upload. Users will still 
   * digitize single features. 
   * 
   * Note that this feature should be used seldomly, since for planning purposes it 
   * is unlikely to have non-contiguous zones.
   * 
   * For CHOOSE_FEATURE geometry types, this field will enable the selction of 
   * multiple features.
   */
  allowMulti: Scalars['Boolean'];
  /**
   * Whether the current user session is allowed to digitize sketches of this type.
   * Digitizing is controlled by admins via access control lists, and archived
   * sketch classes can only be digitized by admins.
   */
  canDigitize?: Maybe<Scalars['Boolean']>;
  /** Form schema used to collect attributes on these sketches. */
  form?: Maybe<Form>;
  /** Geometry type users digitize. COLLECTION types act as a feature collection and have no drawn geometry. */
  geometryType: SketchGeometryType;
  /** Name of the report to be displayed. */
  geoprocessingClientName?: Maybe<Scalars['String']>;
  /** Endpoint for the client javascript bundle. */
  geoprocessingClientUrl?: Maybe<Scalars['String']>;
  /**
   * Root endpoint of a
   * [@seasketch/geoprocessing](https://github.com/seasketch/geoprocessing) project
   * that should be used for reporting.
   */
  geoprocessingProjectUrl?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /**
   * If set to true, (non-admin) users should not be able to digitize new features
   * using this sketch class, but they should still be able to access the sketch
   * class in order to render existing sketches of this type.
   */
  isArchived: Scalars['Boolean'];
  /**
   * If set to true, show as an option in the digitizing tools. If set to false,
   * this sketch class may be solely for survey responses.
   */
  isMyPlansOption: Scalars['Boolean'];
  /**
   * [Mapbox GL Style](https://docs.mapbox.com/mapbox-gl-js/style-spec/) used to 
   * render features. Sketches can be styled based on attribute data by using 
   * [Expressions](https://docs.mapbox.com/help/glossary/expression/).
   */
  mapboxGlStyle?: Maybe<Scalars['JSON']>;
  /** Label chosen by project admins that is shown to users. */
  name: Scalars['String'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** Reads a single `Project` that is related to this `SketchClass`. */
  project?: Maybe<Project>;
  /** SketchClasses belong to a single project. */
  projectId: Scalars['Int'];
  /** Number of sketches created with this sketch class */
  sketchCount?: Maybe<Scalars['BigInt']>;
  /** If listed for a Collection, only valid child sketch classes can be added as children. */
  validChildren?: Maybe<Array<Maybe<SketchClass>>>;
};


/** Sketch Classes act as a schema for sketches drawn by users. */
export type SketchClassValidChildrenArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};

/**
 * A condition to be used against `SketchClass` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type SketchClassCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `projectId` field. */
  projectId?: Maybe<Scalars['Int']>;
};

/** A `SketchClass` edge in the connection. */
export type SketchClassesEdge = {
  __typename?: 'SketchClassesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `SketchClass` at the end of the edge. */
  node?: Maybe<SketchClass>;
};

/** Methods to use when ordering `SketchClass`. */
export enum SketchClassesOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ProjectIdAsc = 'PROJECT_ID_ASC',
  ProjectIdDesc = 'PROJECT_ID_DESC'
}

/** An input for mutations affecting `SketchClass` */
export type SketchClassInput = {
  /**
   * If set to true, a geometry_type of POLYGON would allow for both POLYGONs and 
   * MULTIPOLYGONs after preprocessing or on spatial file upload. Users will still 
   * digitize single features. 
   * 
   * Note that this feature should be used seldomly, since for planning purposes it 
   * is unlikely to have non-contiguous zones.
   * 
   * For CHOOSE_FEATURE geometry types, this field will enable the selction of 
   * multiple features.
   */
  allowMulti?: Maybe<Scalars['Boolean']>;
  /** Geometry type users digitize. COLLECTION types act as a feature collection and have no drawn geometry. */
  geometryType?: Maybe<SketchGeometryType>;
  /** Name of the report to be displayed. */
  geoprocessingClientName?: Maybe<Scalars['String']>;
  /** Endpoint for the client javascript bundle. */
  geoprocessingClientUrl?: Maybe<Scalars['String']>;
  /**
   * Root endpoint of a
   * [@seasketch/geoprocessing](https://github.com/seasketch/geoprocessing) project
   * that should be used for reporting.
   */
  geoprocessingProjectUrl?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['Int']>;
  /**
   * If set to true, (non-admin) users should not be able to digitize new features
   * using this sketch class, but they should still be able to access the sketch
   * class in order to render existing sketches of this type.
   */
  isArchived?: Maybe<Scalars['Boolean']>;
  /**
   * If set to true, show as an option in the digitizing tools. If set to false,
   * this sketch class may be solely for survey responses.
   */
  isMyPlansOption?: Maybe<Scalars['Boolean']>;
  /**
   * [Mapbox GL Style](https://docs.mapbox.com/mapbox-gl-js/style-spec/) used to 
   * render features. Sketches can be styled based on attribute data by using 
   * [Expressions](https://docs.mapbox.com/help/glossary/expression/).
   */
  mapboxGlStyle?: Maybe<Scalars['JSON']>;
  /** Label chosen by project admins that is shown to users. */
  name: Scalars['String'];
  /** SketchClasses belong to a single project. */
  projectId: Scalars['Int'];
};

/** Represents an update to a `SketchClass`. Fields that are set will be updated. */
export type SketchClassPatch = {
  /**
   * If set to true, a geometry_type of POLYGON would allow for both POLYGONs and 
   * MULTIPOLYGONs after preprocessing or on spatial file upload. Users will still 
   * digitize single features. 
   * 
   * Note that this feature should be used seldomly, since for planning purposes it 
   * is unlikely to have non-contiguous zones.
   * 
   * For CHOOSE_FEATURE geometry types, this field will enable the selction of 
   * multiple features.
   */
  allowMulti?: Maybe<Scalars['Boolean']>;
  /** Name of the report to be displayed. */
  geoprocessingClientName?: Maybe<Scalars['String']>;
  /** Endpoint for the client javascript bundle. */
  geoprocessingClientUrl?: Maybe<Scalars['String']>;
  /**
   * Root endpoint of a
   * [@seasketch/geoprocessing](https://github.com/seasketch/geoprocessing) project
   * that should be used for reporting.
   */
  geoprocessingProjectUrl?: Maybe<Scalars['String']>;
  /**
   * If set to true, (non-admin) users should not be able to digitize new features
   * using this sketch class, but they should still be able to access the sketch
   * class in order to render existing sketches of this type.
   */
  isArchived?: Maybe<Scalars['Boolean']>;
  /** Label chosen by project admins that is shown to users. */
  name?: Maybe<Scalars['String']>;
};

/**
 * SketchFolders can be used by users to organize their sketches. Collection-type
 * sketches can be used to organize sketches as well, but they are limited in that 
 * they cannot be nested, and also represent specific management semantics. Folders
 * can be used by users to arbitrarily organize their Sketches.
 */
export type SketchFolder = Node & {
  __typename?: 'SketchFolder';
  /** The parent sketch collection, if any. Folders can only have a single parent entity. */
  collectionId?: Maybe<Scalars['Int']>;
  /** The parent folder, if any. */
  folderId?: Maybe<Scalars['Int']>;
  id: Scalars['Int'];
  name: Scalars['String'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  projectId: Scalars['Int'];
  userId: Scalars['Int'];
};

/** An input for mutations affecting `SketchFolder` */
export type SketchFolderInput = {
  /** The parent sketch collection, if any. Folders can only have a single parent entity. */
  collectionId?: Maybe<Scalars['Int']>;
  /** The parent folder, if any. */
  folderId?: Maybe<Scalars['Int']>;
  id?: Maybe<Scalars['Int']>;
  name: Scalars['String'];
  projectId: Scalars['Int'];
  userId: Scalars['Int'];
};

/** Represents an update to a `SketchFolder`. Fields that are set will be updated. */
export type SketchFolderPatch = {
  /** The parent sketch collection, if any. Folders can only have a single parent entity. */
  collectionId?: Maybe<Scalars['Int']>;
  /** The parent folder, if any. */
  folderId?: Maybe<Scalars['Int']>;
  id?: Maybe<Scalars['Int']>;
  name?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
  userId?: Maybe<Scalars['Int']>;
};

/** A `SketchFolder` edge in the connection. */
export type SketchFoldersEdge = {
  __typename?: 'SketchFoldersEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `SketchFolder` at the end of the edge. */
  node?: Maybe<SketchFolder>;
};

/** Methods to use when ordering `SketchFolder`. */
export enum SketchFoldersOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  UserIdAsc = 'USER_ID_ASC',
  UserIdDesc = 'USER_ID_DESC'
}

export enum SketchGeometryType {
  /** Users will choose one (or more) features from a feature collection. For example, a choice of grid cells or marxan zones. */
  ChooseFeature = 'CHOOSE_FEATURE',
  /**
   * Sketch itself will have no geometry, but can be associated with a number of
   * child sketches. Can be represented as a GeoJSON FeatureCollection.
   */
  Collection = 'COLLECTION',
  Linestring = 'LINESTRING',
  Point = 'POINT',
  Polygon = 'POLYGON'
}

/** An input for mutations affecting `Sketch` */
export type SketchInput = {
  /** Bounding box of the final preprocessed geometry. [xmin, ymin, xmax, ymax] */
  bbox?: Maybe<Array<Maybe<Scalars['Float']>>>;
  /** If the sketch is not a collection, it can belong to a collection (collections cannot be nested). */
  collectionId?: Maybe<Scalars['Int']>;
  /**
   * If this Sketch started as a copy of another it is tracked here. Eventually
   * SeaSketch may have a means of visualizing how plans are iterated on over time.
   */
  copyOf?: Maybe<Scalars['Int']>;
  /** Parent folder. Both regular sketches and collections may be nested within folders for organization purposes. */
  folderId?: Maybe<Scalars['Int']>;
  /**
   * The geometry of the Sketch **after** it has been preprocessed. This is the
   * geometry that is used for reporting. Preprocessed geometries may be extremely
   * large and complex, so it may be necessary to access them through a vector tile
   * service or some other optimization.
   */
  geom?: Maybe<Scalars['GeoJSON']>;
  id?: Maybe<Scalars['Int']>;
  /** User provided name for the sketch. */
  name: Scalars['String'];
  /**
   * Number of points in the final geometry. Can be used to gauge the complexity of
   * the shape and decide whether to load via graphql or use a vector tile service.
   */
  numVertices?: Maybe<Scalars['Int']>;
  /** SketchClass that defines the behavior of this type of sketch. */
  sketchClassId: Scalars['Int'];
  /**
   * Spatial feature the user directly digitized, without preprocessing. This is
   * the feature that should be used if the Sketch is later edited.
   */
  userGeom?: Maybe<Scalars['GeoJSON']>;
  /** Owner of the sketch. */
  userId: Scalars['Int'];
};

/** Represents an update to a `Sketch`. Fields that are set will be updated. */
export type SketchPatch = {
  /** If the sketch is not a collection, it can belong to a collection (collections cannot be nested). */
  collectionId?: Maybe<Scalars['Int']>;
  /**
   * The geometry of the Sketch **after** it has been preprocessed. This is the
   * geometry that is used for reporting. Preprocessed geometries may be extremely
   * large and complex, so it may be necessary to access them through a vector tile
   * service or some other optimization.
   */
  geom?: Maybe<Scalars['GeoJSON']>;
  /** User provided name for the sketch. */
  name?: Maybe<Scalars['String']>;
  /**
   * Spatial feature the user directly digitized, without preprocessing. This is
   * the feature that should be used if the Sketch is later edited.
   */
  userGeom?: Maybe<Scalars['GeoJSON']>;
};

export enum SortByDirection {
  Asc = 'ASC',
  Desc = 'DESC'
}

export type Survey = Node & {
  __typename?: 'Survey';
  /** PUBLIC or INVITE_ONLY */
  accessType: SurveyAccessType;
  /** Shown to users after completing a survey. Expected to be something like Draft.js content state */
  closingMessage: Scalars['JSON'];
  /** Reads a single `Form` that is related to this `Survey`. */
  form?: Maybe<Form>;
  /**
   * Reads and enables pagination through a set of `Form`.
   * @deprecated Please use form instead
   */
  formsConnection: FormsConnection;
  /** If set, responses that originate from an IP address outside this fence will be flagged. */
  geofence?: Maybe<GeographyPolygon>;
  id: Scalars['Int'];
  /** Shown to users before starting a survey response. Expected to be something like Draft.js content state */
  introMessage: Scalars['JSON'];
  /**
   * Listing of groups whose users should be invited to participate in the survey.
   * 
   * Use `updateSurveyInvitedGroups()` mutation to modify.
   */
  invitedGroups?: Maybe<Array<Maybe<Group>>>;
  /**
   * Disabled surveys will not be accessible to non-admins. Invite email sending will
   * be paused.
   */
  isDisabled: Scalars['Boolean'];
  /**
   * If set, there can only be one response with matching contact information. The
   * app will also discourage multiple submissions from the same browser session.
   */
  limitToSingleResponse: Scalars['Boolean'];
  name: Scalars['String'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** Reads a single `Project` that is related to this `Survey`. */
  project?: Maybe<Project>;
  projectId: Scalars['Int'];
  /**
   * Only applicable for public surveys. Show tools to respondants for sharing the 
   * survey on social media to encourage responses.
   */
  showSocialMediaButtons?: Maybe<Scalars['Boolean']>;
  /**
   * Usually the survey will show a button that says [Begin Survey]. This can be 
   * customized by admins.
   */
  startButtonText?: Maybe<Scalars['String']>;
  submittedResponseCount?: Maybe<Scalars['Int']>;
  /**
   * All related survey invites. Survey invites will be automatically created for
   * users in the groups specified by `surveyInvitedGroups`.
   */
  surveyInvites: Array<SurveyInvite>;
  /**
   * Responses related to this survey. End-users will have access to their own
   * submitted or draft responses. Administrators will have access to their own,
   * plus all submitted responses.
   */
  surveyResponsesConnection: SurveyResponsesConnection;
};


export type SurveyFormsConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<FormCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<FormsOrderBy>>;
};


export type SurveyInvitedGroupsArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};


export type SurveySurveyInvitesArgs = {
  condition?: Maybe<SurveyInviteCondition>;
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<SurveyInvitesOrderBy>>;
};


export type SurveySurveyResponsesConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<SurveyResponseCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<SurveyResponsesOrderBy>>;
};

/** Controls who has access to respond to a survey */
export enum SurveyAccessType {
  /** Only users part of an invited group or email invitation can respond */
  InviteOnly = 'INVITE_ONLY',
  /** Anyone can respond */
  Public = 'PUBLIC'
}

/** A condition to be used against `Survey` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type SurveyCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `projectId` field. */
  projectId?: Maybe<Scalars['Int']>;
};

/** An input for mutations affecting `Survey` */
export type SurveyInput = {
  /** PUBLIC or INVITE_ONLY */
  accessType?: Maybe<SurveyAccessType>;
  /** Shown to users after completing a survey. Expected to be something like Draft.js content state */
  closingMessage?: Maybe<Scalars['JSON']>;
  /** If set, responses that originate from an IP address outside this fence will be flagged. */
  geofence?: Maybe<Scalars['GeoJSON']>;
  id?: Maybe<Scalars['Int']>;
  /** Shown to users before starting a survey response. Expected to be something like Draft.js content state */
  introMessage?: Maybe<Scalars['JSON']>;
  /**
   * Disabled surveys will not be accessible to non-admins. Invite email sending will
   * be paused.
   */
  isDisabled?: Maybe<Scalars['Boolean']>;
  /**
   * If set, there can only be one response with matching contact information. The
   * app will also discourage multiple submissions from the same browser session.
   */
  limitToSingleResponse?: Maybe<Scalars['Boolean']>;
  name: Scalars['String'];
  projectId: Scalars['Int'];
  /**
   * Only applicable for public surveys. Show tools to respondants for sharing the 
   * survey on social media to encourage responses.
   */
  showSocialMediaButtons?: Maybe<Scalars['Boolean']>;
  /**
   * Usually the survey will show a button that says [Begin Survey]. This can be 
   * customized by admins.
   */
  startButtonText?: Maybe<Scalars['String']>;
};

export type SurveyInvite = Node & {
  __typename?: 'SurveyInvite';
  createdAt: Scalars['Datetime'];
  email?: Maybe<Scalars['Email']>;
  fullname?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /** Reads and enables pagination through a set of `InviteEmail`. */
  inviteEmails: Array<InviteEmail>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /**
   * Indicates the status of the invite, e.g. whether an invite email has been
   * sent, status of those emails, and whether a response has been submitted.
   */
  status?: Maybe<InviteStatus>;
  /** Reads a single `Survey` that is related to this `SurveyInvite`. */
  survey?: Maybe<Survey>;
  surveyId: Scalars['Int'];
  userId?: Maybe<Scalars['Int']>;
  wasUsed: Scalars['Boolean'];
};


export type SurveyInviteInviteEmailsArgs = {
  condition?: Maybe<InviteEmailCondition>;
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<InviteEmailsOrderBy>>;
};

/**
 * A condition to be used against `SurveyInvite` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type SurveyInviteCondition = {
  /** Checks for equality with the object’s `email` field. */
  email?: Maybe<Scalars['Email']>;
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `surveyId` field. */
  surveyId?: Maybe<Scalars['Int']>;
};

export type SurveyInvitedGroup = {
  __typename?: 'SurveyInvitedGroup';
  groupId: Scalars['Int'];
  /** Reads a single `Survey` that is related to this `SurveyInvitedGroup`. */
  survey?: Maybe<Survey>;
  surveyId: Scalars['Int'];
};

/** An input for mutations affecting `SurveyInvitedGroup` */
export type SurveyInvitedGroupInput = {
  groupId: Scalars['Int'];
  surveyId: Scalars['Int'];
};

export type SurveyInviteOptionsInput = {
  email?: Maybe<Scalars['Email']>;
  fullname?: Maybe<Scalars['String']>;
};

/** Represents an update to a `SurveyInvite`. Fields that are set will be updated. */
export type SurveyInvitePatch = {
  fullname?: Maybe<Scalars['String']>;
};

/** A `SurveyInvite` edge in the connection. */
export type SurveyInvitesEdge = {
  __typename?: 'SurveyInvitesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `SurveyInvite` at the end of the edge. */
  node?: Maybe<SurveyInvite>;
};

/** Methods to use when ordering `SurveyInvite`. */
export enum SurveyInvitesOrderBy {
  EmailAsc = 'EMAIL_ASC',
  EmailDesc = 'EMAIL_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  SurveyIdAsc = 'SURVEY_ID_ASC',
  SurveyIdDesc = 'SURVEY_ID_DESC'
}

export type SurveyInviteTokenClaims = {
  __typename?: 'SurveyInviteTokenClaims';
  email?: Maybe<Scalars['String']>;
  fullname?: Maybe<Scalars['String']>;
  inviteId: Scalars['Int'];
  projectId: Scalars['Int'];
  surveyId: Scalars['Int'];
  wasUsed: Scalars['Boolean'];
};

export type SurveyInviteTokenVerificationResults = {
  __typename?: 'SurveyInviteTokenVerificationResults';
  claims?: Maybe<SurveyInviteTokenClaims>;
  error?: Maybe<Scalars['String']>;
};

/** Represents an update to a `Survey`. Fields that are set will be updated. */
export type SurveyPatch = {
  /** PUBLIC or INVITE_ONLY */
  accessType?: Maybe<SurveyAccessType>;
  /** Shown to users after completing a survey. Expected to be something like Draft.js content state */
  closingMessage?: Maybe<Scalars['JSON']>;
  /** If set, responses that originate from an IP address outside this fence will be flagged. */
  geofence?: Maybe<Scalars['GeoJSON']>;
  id?: Maybe<Scalars['Int']>;
  /** Shown to users before starting a survey response. Expected to be something like Draft.js content state */
  introMessage?: Maybe<Scalars['JSON']>;
  /**
   * Disabled surveys will not be accessible to non-admins. Invite email sending will
   * be paused.
   */
  isDisabled?: Maybe<Scalars['Boolean']>;
  /**
   * If set, there can only be one response with matching contact information. The
   * app will also discourage multiple submissions from the same browser session.
   */
  limitToSingleResponse?: Maybe<Scalars['Boolean']>;
  name?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
  /**
   * Only applicable for public surveys. Show tools to respondants for sharing the 
   * survey on social media to encourage responses.
   */
  showSocialMediaButtons?: Maybe<Scalars['Boolean']>;
  /**
   * Usually the survey will show a button that says [Begin Survey]. This can be 
   * customized by admins.
   */
  startButtonText?: Maybe<Scalars['String']>;
};

export type SurveyResponse = Node & {
  __typename?: 'SurveyResponse';
  /**
   * Should be set by the client on submission and tracked by cookies or
   * localStorage. Surveys that permit only a single entry enable users to bypass
   * the limit for legitimate purposes, like entering responses on a shared computer.
   */
  bypassedDuplicateSubmissionControl: Scalars['Boolean'];
  createdAt: Scalars['Datetime'];
  /** JSON representation of responses, keyed by the form field export_id */
  data: Scalars['JSON'];
  id: Scalars['Int'];
  /** Users may save their responses for later editing before submission. After submission they can no longer edit them. */
  isDraft: Scalars['Boolean'];
  /** Duplicate entries are detected by matching contact-information field values. */
  isDuplicateEntry: Scalars['Boolean'];
  /**
   * Detected by comparing ip hashes from previous entries. IP hashes are not tied
   * to particular responses, so only the second and subsequent entries are flagged.
   */
  isDuplicateIp: Scalars['Boolean'];
  /**
   * Unusual or missing user-agent headers on submissions are flagged. May indicate
   * scripting but does not necessarily imply malicious intent.
   */
  isUnrecognizedUserAgent: Scalars['Boolean'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /**
   * Checked on SUBMISSION, so adding or changing a survey geofence after responses
   * have been submitted will not update values. GPS coordinates and IP addresses
   * are not stored for privacy purposes.
   */
  outsideGeofence: Scalars['Boolean'];
  /** Reads a single `Survey` that is related to this `SurveyResponse`. */
  survey?: Maybe<Survey>;
  surveyId: Scalars['Int'];
  updatedAt?: Maybe<Scalars['Datetime']>;
  userId?: Maybe<Scalars['Int']>;
};

/**
 * A condition to be used against `SurveyResponse` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type SurveyResponseCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `surveyId` field. */
  surveyId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `userId` field. */
  userId?: Maybe<Scalars['Int']>;
};

/** An input for mutations affecting `SurveyResponse` */
export type SurveyResponseInput = {
  /**
   * Should be set by the client on submission and tracked by cookies or
   * localStorage. Surveys that permit only a single entry enable users to bypass
   * the limit for legitimate purposes, like entering responses on a shared computer.
   */
  bypassedDuplicateSubmissionControl?: Maybe<Scalars['Boolean']>;
  createdAt?: Maybe<Scalars['Datetime']>;
  /** JSON representation of responses, keyed by the form field export_id */
  data?: Maybe<Scalars['JSON']>;
  id?: Maybe<Scalars['Int']>;
  /** Users may save their responses for later editing before submission. After submission they can no longer edit them. */
  isDraft?: Maybe<Scalars['Boolean']>;
  surveyId: Scalars['Int'];
  updatedAt?: Maybe<Scalars['Datetime']>;
  userId?: Maybe<Scalars['Int']>;
};

/** Represents an update to a `SurveyResponse`. Fields that are set will be updated. */
export type SurveyResponsePatch = {
  /** JSON representation of responses, keyed by the form field export_id */
  data?: Maybe<Scalars['JSON']>;
  /** Users may save their responses for later editing before submission. After submission they can no longer edit them. */
  isDraft?: Maybe<Scalars['Boolean']>;
};

/** A connection to a list of `SurveyResponse` values. */
export type SurveyResponsesConnection = {
  __typename?: 'SurveyResponsesConnection';
  /** A list of edges which contains the `SurveyResponse` and cursor to aid in pagination. */
  edges: Array<SurveyResponsesEdge>;
  /** A list of `SurveyResponse` objects. */
  nodes: Array<Maybe<SurveyResponse>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `SurveyResponse` you could get from the connection. */
  totalCount: Scalars['Int'];
};

/** A `SurveyResponse` edge in the connection. */
export type SurveyResponsesEdge = {
  __typename?: 'SurveyResponsesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `SurveyResponse` at the end of the edge. */
  node?: Maybe<SurveyResponse>;
};

/** Methods to use when ordering `SurveyResponse`. */
export enum SurveyResponsesOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  SurveyIdAsc = 'SURVEY_ID_ASC',
  SurveyIdDesc = 'SURVEY_ID_DESC',
  UserIdAsc = 'USER_ID_ASC',
  UserIdDesc = 'USER_ID_DESC'
}

/** Methods to use when ordering `Survey`. */
export enum SurveysOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ProjectIdAsc = 'PROJECT_ID_ASC',
  ProjectIdDesc = 'PROJECT_ID_DESC'
}

export type SurveyTokenInfo = {
  __typename?: 'SurveyTokenInfo';
  /** ID of related project */
  projectId?: Maybe<Scalars['Int']>;
  /** ID of related survey */
  surveyId?: Maybe<Scalars['Int']>;
  /** Signed token that can be used for accessing the survey */
  token?: Maybe<Scalars['String']>;
};

export type Topic = Node & {
  __typename?: 'Topic';
  authorId: Scalars['Int'];
  /** User Profile of the author. If a user has not shared their profile the post contents will be hidden. */
  authorProfile?: Maybe<Profile>;
  createdAt: Scalars['Datetime'];
  /** Reads a single `Forum` that is related to this `Topic`. */
  forum?: Maybe<Forum>;
  forumId: Scalars['Int'];
  id: Scalars['Int'];
  /**
   * Locked topics can only be posted to by project admins and will display a lock symbol.
   * 
   * Can be toggled by project admins using `setTopicLocked()` mutation.
   */
  locked: Scalars['Boolean'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** Reads and enables pagination through a set of `Post`. */
  postsConnection: PostsConnection;
  /**
   * Sticky topics will be listed at the topic of the forum.
   * 
   * Can be toggled by project admins using `setTopicSticky()` mutation.
   */
  sticky: Scalars['Boolean'];
  /** Title displayed in the topics listing. Can be updated in the first 5 minutes after creation. */
  title: Scalars['String'];
};


export type TopicPostsConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<PostCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<PostsOrderBy>>;
};

/** A condition to be used against `Topic` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type TopicCondition = {
  /** Checks for equality with the object’s `forumId` field. */
  forumId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
};

/** Represents an update to a `Topic`. Fields that are set will be updated. */
export type TopicPatch = {
  /**
   * Locked topics can only be posted to by project admins and will display a lock symbol.
   * 
   * Can be toggled by project admins using `setTopicLocked()` mutation.
   */
  locked?: Maybe<Scalars['Boolean']>;
  /**
   * Sticky topics will be listed at the topic of the forum.
   * 
   * Can be toggled by project admins using `setTopicSticky()` mutation.
   */
  sticky?: Maybe<Scalars['Boolean']>;
  /** Title displayed in the topics listing. Can be updated in the first 5 minutes after creation. */
  title?: Maybe<Scalars['String']>;
};

/** A connection to a list of `Topic` values. */
export type TopicsConnection = {
  __typename?: 'TopicsConnection';
  /** A list of edges which contains the `Topic` and cursor to aid in pagination. */
  edges: Array<TopicsEdge>;
  /** A list of `Topic` objects. */
  nodes: Array<Maybe<Topic>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Topic` you could get from the connection. */
  totalCount: Scalars['Int'];
};

/** A `Topic` edge in the connection. */
export type TopicsEdge = {
  __typename?: 'TopicsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `Topic` at the end of the edge. */
  node?: Maybe<Topic>;
};

/** Methods to use when ordering `Topic`. */
export enum TopicsOrderBy {
  ForumIdAsc = 'FORUM_ID_ASC',
  ForumIdDesc = 'FORUM_ID_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  LastPostCreatedAtAndSticky = 'LAST_POST_CREATED_AT_AND_STICKY',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

/** All input for the `updateAclByNodeId` mutation. */
export type UpdateAclByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Acl` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `Acl` being updated. */
  patch: AclPatch;
};

/** All input for the `updateAclBySketchClassId` mutation. */
export type UpdateAclBySketchClassIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** An object where the defined keys will be set on the `Acl` being updated. */
  patch: AclPatch;
  sketchClassId: Scalars['Int'];
};

/** All input for the `updateAcl` mutation. */
export type UpdateAclInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `Acl` being updated. */
  patch: AclPatch;
};

/** The output of our update `Acl` mutation. */
export type UpdateAclPayload = {
  __typename?: 'UpdateAclPayload';
  /** The `Acl` that was updated by this mutation. */
  acl?: Maybe<Acl>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `SketchClass` that is related to this `Acl`. */
  sketchClass?: Maybe<SketchClass>;
};

/** All input for the `updateCommunityGuidelineByNodeId` mutation. */
export type UpdateCommunityGuidelineByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `CommunityGuideline` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `CommunityGuideline` being updated. */
  patch: CommunityGuidelinePatch;
};

/** All input for the `updateCommunityGuideline` mutation. */
export type UpdateCommunityGuidelineInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** An object where the defined keys will be set on the `CommunityGuideline` being updated. */
  patch: CommunityGuidelinePatch;
  projectId: Scalars['Int'];
};

/** The output of our update `CommunityGuideline` mutation. */
export type UpdateCommunityGuidelinePayload = {
  __typename?: 'UpdateCommunityGuidelinePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `CommunityGuideline` that was updated by this mutation. */
  communityGuideline?: Maybe<CommunityGuideline>;
  /** Reads a single `Project` that is related to this `CommunityGuideline`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `updateEmailNotificationPreferenceByUserId` mutation. */
export type UpdateEmailNotificationPreferenceByUserIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** An object where the defined keys will be set on the `EmailNotificationPreference` being updated. */
  patch: EmailNotificationPreferencePatch;
  userId: Scalars['Int'];
};

/** The output of our update `EmailNotificationPreference` mutation. */
export type UpdateEmailNotificationPreferencePayload = {
  __typename?: 'UpdateEmailNotificationPreferencePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `EmailNotificationPreference` that was updated by this mutation. */
  emailNotificationPreference?: Maybe<EmailNotificationPreference>;
  /** An edge for our `EmailNotificationPreference`. May be used by Relay 1. */
  emailNotificationPreferenceEdge?: Maybe<EmailNotificationPreferencesEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `User` that is related to this `EmailNotificationPreference`. */
  user?: Maybe<User>;
};


/** The output of our update `EmailNotificationPreference` mutation. */
export type UpdateEmailNotificationPreferencePayloadEmailNotificationPreferenceEdgeArgs = {
  orderBy?: Maybe<Array<EmailNotificationPreferencesOrderBy>>;
};

/** All input for the `updateFormConditionalRenderingRuleByNodeId` mutation. */
export type UpdateFormConditionalRenderingRuleByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `FormConditionalRenderingRule` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `FormConditionalRenderingRule` being updated. */
  patch: FormConditionalRenderingRulePatch;
};

/** All input for the `updateFormConditionalRenderingRule` mutation. */
export type UpdateFormConditionalRenderingRuleInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `FormConditionalRenderingRule` being updated. */
  patch: FormConditionalRenderingRulePatch;
};

/** The output of our update `FormConditionalRenderingRule` mutation. */
export type UpdateFormConditionalRenderingRulePayload = {
  __typename?: 'UpdateFormConditionalRenderingRulePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `FormField` that is related to this `FormConditionalRenderingRule`. */
  field?: Maybe<FormField>;
  /** The `FormConditionalRenderingRule` that was updated by this mutation. */
  formConditionalRenderingRule?: Maybe<FormConditionalRenderingRule>;
  /** An edge for our `FormConditionalRenderingRule`. May be used by Relay 1. */
  formConditionalRenderingRuleEdge?: Maybe<FormConditionalRenderingRulesEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our update `FormConditionalRenderingRule` mutation. */
export type UpdateFormConditionalRenderingRulePayloadFormConditionalRenderingRuleEdgeArgs = {
  orderBy?: Maybe<Array<FormConditionalRenderingRulesOrderBy>>;
};

/** All input for the `updateFormFieldByNodeId` mutation. */
export type UpdateFormFieldByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `FormField` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `FormField` being updated. */
  patch: FormFieldPatch;
};

/** All input for the `updateFormField` mutation. */
export type UpdateFormFieldInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `FormField` being updated. */
  patch: FormFieldPatch;
};

/** The output of our update `FormField` mutation. */
export type UpdateFormFieldPayload = {
  __typename?: 'UpdateFormFieldPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `Form` that is related to this `FormField`. */
  form?: Maybe<Form>;
  /** The `FormField` that was updated by this mutation. */
  formField?: Maybe<FormField>;
  /** An edge for our `FormField`. May be used by Relay 1. */
  formFieldEdge?: Maybe<FormFieldsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our update `FormField` mutation. */
export type UpdateFormFieldPayloadFormFieldEdgeArgs = {
  orderBy?: Maybe<Array<FormFieldsOrderBy>>;
};

/** All input for the `updateForumByNodeId` mutation. */
export type UpdateForumByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Forum` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `Forum` being updated. */
  patch: ForumPatch;
};

/** All input for the `updateForum` mutation. */
export type UpdateForumInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `Forum` being updated. */
  patch: ForumPatch;
};

/** The output of our update `Forum` mutation. */
export type UpdateForumPayload = {
  __typename?: 'UpdateForumPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `Forum` that was updated by this mutation. */
  forum?: Maybe<Forum>;
  /** An edge for our `Forum`. May be used by Relay 1. */
  forumEdge?: Maybe<ForumsEdge>;
  /** Reads a single `Project` that is related to this `Forum`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our update `Forum` mutation. */
export type UpdateForumPayloadForumEdgeArgs = {
  orderBy?: Maybe<Array<ForumsOrderBy>>;
};

/** All input for the `updateGroupByNodeId` mutation. */
export type UpdateGroupByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Group` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `Group` being updated. */
  patch: GroupPatch;
};

/** All input for the `updateGroupByProjectIdAndName` mutation. */
export type UpdateGroupByProjectIdAndNameInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Label for the group. */
  name: Scalars['String'];
  /** An object where the defined keys will be set on the `Group` being updated. */
  patch: GroupPatch;
  projectId: Scalars['Int'];
};

/** All input for the `updateGroup` mutation. */
export type UpdateGroupInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `Group` being updated. */
  patch: GroupPatch;
};

/** The output of our update `Group` mutation. */
export type UpdateGroupPayload = {
  __typename?: 'UpdateGroupPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `Group` that was updated by this mutation. */
  group?: Maybe<Group>;
  /** Reads a single `Project` that is related to this `Group`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `updatePost` mutation. */
export type UpdatePostInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  message?: Maybe<Scalars['JSON']>;
  postId?: Maybe<Scalars['Int']>;
};

/** The output of our `updatePost` mutation. */
export type UpdatePostPayload = {
  __typename?: 'UpdatePostPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  post?: Maybe<Post>;
  /** An edge for our `Post`. May be used by Relay 1. */
  postEdge?: Maybe<PostsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Topic` that is related to this `Post`. */
  topic?: Maybe<Topic>;
};


/** The output of our `updatePost` mutation. */
export type UpdatePostPayloadPostEdgeArgs = {
  orderBy?: Maybe<Array<PostsOrderBy>>;
};

/** All input for the `updateProfileByUserId` mutation. */
export type UpdateProfileByUserIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** An object where the defined keys will be set on the `Profile` being updated. */
  patch: ProfilePatch;
  userId: Scalars['Int'];
};

/** The output of our update `Profile` mutation. */
export type UpdateProfilePayload = {
  __typename?: 'UpdateProfilePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `Profile` that was updated by this mutation. */
  profile?: Maybe<Profile>;
  /** An edge for our `Profile`. May be used by Relay 1. */
  profileEdge?: Maybe<ProfilesEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `User` that is related to this `Profile`. */
  user?: Maybe<User>;
};


/** The output of our update `Profile` mutation. */
export type UpdateProfilePayloadProfileEdgeArgs = {
  orderBy?: Maybe<Array<ProfilesOrderBy>>;
};

/** All input for the `updateProjectByNodeId` mutation. */
export type UpdateProjectByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Project` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `Project` being updated. */
  patch: ProjectPatch;
};

/** All input for the `updateProjectBySlug` mutation. */
export type UpdateProjectBySlugInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** An object where the defined keys will be set on the `Project` being updated. */
  patch: ProjectPatch;
  /** Short identifier for the project used in the url. This property cannot be changed after project creation. */
  slug: Scalars['String'];
};

/** All input for the `updateProject` mutation. */
export type UpdateProjectInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `Project` being updated. */
  patch: ProjectPatch;
};

/** All input for the `updateProjectInviteByEmailAndProjectId` mutation. */
export type UpdateProjectInviteByEmailAndProjectIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Specified by admin when invite was created. */
  email: Scalars['Email'];
  /** An object where the defined keys will be set on the `ProjectInvite` being updated. */
  patch: ProjectInvitePatch;
  projectId: Scalars['Int'];
};

/** All input for the `updateProjectInviteByNodeId` mutation. */
export type UpdateProjectInviteByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `ProjectInvite` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `ProjectInvite` being updated. */
  patch: ProjectInvitePatch;
};

/** All input for the `updateProjectInviteGroupByInviteIdAndGroupId` mutation. */
export type UpdateProjectInviteGroupByInviteIdAndGroupIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  groupId: Scalars['Int'];
  inviteId: Scalars['Int'];
  /** An object where the defined keys will be set on the `ProjectInviteGroup` being updated. */
  patch: ProjectInviteGroupPatch;
};

/** The output of our update `ProjectInviteGroup` mutation. */
export type UpdateProjectInviteGroupPayload = {
  __typename?: 'UpdateProjectInviteGroupPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `ProjectInviteGroup` that was updated by this mutation. */
  projectInviteGroup?: Maybe<ProjectInviteGroup>;
  /** An edge for our `ProjectInviteGroup`. May be used by Relay 1. */
  projectInviteGroupEdge?: Maybe<ProjectInviteGroupsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our update `ProjectInviteGroup` mutation. */
export type UpdateProjectInviteGroupPayloadProjectInviteGroupEdgeArgs = {
  orderBy?: Maybe<Array<ProjectInviteGroupsOrderBy>>;
};

/** All input for the `updateProjectInvite` mutation. */
export type UpdateProjectInviteInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `ProjectInvite` being updated. */
  patch: ProjectInvitePatch;
};

/** The output of our update `ProjectInvite` mutation. */
export type UpdateProjectInvitePayload = {
  __typename?: 'UpdateProjectInvitePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `ProjectInvite` that was updated by this mutation. */
  projectInvite?: Maybe<ProjectInvite>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** The output of our update `Project` mutation. */
export type UpdateProjectPayload = {
  __typename?: 'UpdateProjectPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `Project` that was updated by this mutation. */
  project?: Maybe<Project>;
  /** An edge for our `Project`. May be used by Relay 1. */
  projectEdge?: Maybe<ProjectsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our update `Project` mutation. */
export type UpdateProjectPayloadProjectEdgeArgs = {
  orderBy?: Maybe<Array<ProjectsOrderBy>>;
};

/** All input for the `updateSketchByNodeId` mutation. */
export type UpdateSketchByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Sketch` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `Sketch` being updated. */
  patch: SketchPatch;
};

/** All input for the `updateSketchClassByNodeId` mutation. */
export type UpdateSketchClassByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `SketchClass` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `SketchClass` being updated. */
  patch: SketchClassPatch;
};

/** All input for the `updateSketchClass` mutation. */
export type UpdateSketchClassInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `SketchClass` being updated. */
  patch: SketchClassPatch;
};

/** The output of our update `SketchClass` mutation. */
export type UpdateSketchClassPayload = {
  __typename?: 'UpdateSketchClassPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `Project` that is related to this `SketchClass`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** The `SketchClass` that was updated by this mutation. */
  sketchClass?: Maybe<SketchClass>;
  /** An edge for our `SketchClass`. May be used by Relay 1. */
  sketchClassEdge?: Maybe<SketchClassesEdge>;
};


/** The output of our update `SketchClass` mutation. */
export type UpdateSketchClassPayloadSketchClassEdgeArgs = {
  orderBy?: Maybe<Array<SketchClassesOrderBy>>;
};

/** All input for the `updateSketchFolderByNodeId` mutation. */
export type UpdateSketchFolderByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `SketchFolder` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `SketchFolder` being updated. */
  patch: SketchFolderPatch;
};

/** All input for the `updateSketchFolder` mutation. */
export type UpdateSketchFolderInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `SketchFolder` being updated. */
  patch: SketchFolderPatch;
};

/** The output of our update `SketchFolder` mutation. */
export type UpdateSketchFolderPayload = {
  __typename?: 'UpdateSketchFolderPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** The `SketchFolder` that was updated by this mutation. */
  sketchFolder?: Maybe<SketchFolder>;
  /** An edge for our `SketchFolder`. May be used by Relay 1. */
  sketchFolderEdge?: Maybe<SketchFoldersEdge>;
};


/** The output of our update `SketchFolder` mutation. */
export type UpdateSketchFolderPayloadSketchFolderEdgeArgs = {
  orderBy?: Maybe<Array<SketchFoldersOrderBy>>;
};

/** All input for the `updateSketch` mutation. */
export type UpdateSketchInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `Sketch` being updated. */
  patch: SketchPatch;
};

/** The output of our update `Sketch` mutation. */
export type UpdateSketchPayload = {
  __typename?: 'UpdateSketchPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `Sketch` that is related to this `Sketch`. */
  collection?: Maybe<Sketch>;
  /** Reads a single `Sketch` that is related to this `Sketch`. */
  copiedFrom?: Maybe<Sketch>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** The `Sketch` that was updated by this mutation. */
  sketch?: Maybe<Sketch>;
  /** Reads a single `SketchClass` that is related to this `Sketch`. */
  sketchClass?: Maybe<SketchClass>;
  /** Reads a single `User` that is related to this `Sketch`. */
  user?: Maybe<User>;
};

/** All input for the `updateSurveyByNodeId` mutation. */
export type UpdateSurveyByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Survey` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `Survey` being updated. */
  patch: SurveyPatch;
};

/** All input for the `updateSurvey` mutation. */
export type UpdateSurveyInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `Survey` being updated. */
  patch: SurveyPatch;
};

/** All input for the `updateSurveyInviteByEmailAndSurveyId` mutation. */
export type UpdateSurveyInviteByEmailAndSurveyIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  email: Scalars['Email'];
  /** An object where the defined keys will be set on the `SurveyInvite` being updated. */
  patch: SurveyInvitePatch;
  surveyId: Scalars['Int'];
};

/** All input for the `updateSurveyInviteByEmail` mutation. */
export type UpdateSurveyInviteByEmailInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  email: Scalars['Email'];
  /** An object where the defined keys will be set on the `SurveyInvite` being updated. */
  patch: SurveyInvitePatch;
};

/** All input for the `updateSurveyInviteByNodeId` mutation. */
export type UpdateSurveyInviteByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `SurveyInvite` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `SurveyInvite` being updated. */
  patch: SurveyInvitePatch;
};

/** All input for the `updateSurveyInvitedGroups` mutation. */
export type UpdateSurveyInvitedGroupsInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  groupIds?: Maybe<Array<Maybe<Scalars['Int']>>>;
  surveyId?: Maybe<Scalars['Int']>;
};

/** The output of our `updateSurveyInvitedGroups` mutation. */
export type UpdateSurveyInvitedGroupsPayload = {
  __typename?: 'UpdateSurveyInvitedGroupsPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  groups?: Maybe<Array<Maybe<Group>>>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `updateSurveyInvite` mutation. */
export type UpdateSurveyInviteInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `SurveyInvite` being updated. */
  patch: SurveyInvitePatch;
};

/** The output of our update `SurveyInvite` mutation. */
export type UpdateSurveyInvitePayload = {
  __typename?: 'UpdateSurveyInvitePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Survey` that is related to this `SurveyInvite`. */
  survey?: Maybe<Survey>;
  /** The `SurveyInvite` that was updated by this mutation. */
  surveyInvite?: Maybe<SurveyInvite>;
  /** An edge for our `SurveyInvite`. May be used by Relay 1. */
  surveyInviteEdge?: Maybe<SurveyInvitesEdge>;
};


/** The output of our update `SurveyInvite` mutation. */
export type UpdateSurveyInvitePayloadSurveyInviteEdgeArgs = {
  orderBy?: Maybe<Array<SurveyInvitesOrderBy>>;
};

/** The output of our update `Survey` mutation. */
export type UpdateSurveyPayload = {
  __typename?: 'UpdateSurveyPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `Project` that is related to this `Survey`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** The `Survey` that was updated by this mutation. */
  survey?: Maybe<Survey>;
};

/** All input for the `updateSurveyResponseByNodeId` mutation. */
export type UpdateSurveyResponseByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `SurveyResponse` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `SurveyResponse` being updated. */
  patch: SurveyResponsePatch;
};

/** All input for the `updateSurveyResponse` mutation. */
export type UpdateSurveyResponseInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `SurveyResponse` being updated. */
  patch: SurveyResponsePatch;
};

/** The output of our update `SurveyResponse` mutation. */
export type UpdateSurveyResponsePayload = {
  __typename?: 'UpdateSurveyResponsePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Survey` that is related to this `SurveyResponse`. */
  survey?: Maybe<Survey>;
  /** The `SurveyResponse` that was updated by this mutation. */
  surveyResponse?: Maybe<SurveyResponse>;
  /** An edge for our `SurveyResponse`. May be used by Relay 1. */
  surveyResponseEdge?: Maybe<SurveyResponsesEdge>;
};


/** The output of our update `SurveyResponse` mutation. */
export type UpdateSurveyResponsePayloadSurveyResponseEdgeArgs = {
  orderBy?: Maybe<Array<SurveyResponsesOrderBy>>;
};

/** All input for the `updateTopicByNodeId` mutation. */
export type UpdateTopicByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Topic` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `Topic` being updated. */
  patch: TopicPatch;
};

/** All input for the `updateTopic` mutation. */
export type UpdateTopicInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `Topic` being updated. */
  patch: TopicPatch;
};

/** The output of our update `Topic` mutation. */
export type UpdateTopicPayload = {
  __typename?: 'UpdateTopicPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `Forum` that is related to this `Topic`. */
  forum?: Maybe<Forum>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** The `Topic` that was updated by this mutation. */
  topic?: Maybe<Topic>;
  /** An edge for our `Topic`. May be used by Relay 1. */
  topicEdge?: Maybe<TopicsEdge>;
};


/** The output of our update `Topic` mutation. */
export type UpdateTopicPayloadTopicEdgeArgs = {
  orderBy?: Maybe<Array<TopicsOrderBy>>;
};

/**
 * The SeaSketch User type is quite sparse since authentication is handled by Auth0
 * and we store no personal information unless the user explicitly adds it to the
 * user `Profile`.
 * 
 * During operation of the system, users identify themselves using bearer tokens. 
 * These tokens contain ephemeral information like `canonical_email` which can be
 * used to accept project invite tokens.
 */
export type User = Node & {
  __typename?: 'User';
  /**
   * Whether the user has been banned from the forums. Use `disableForumPosting()`
   * and `enableForumPosting()` mutations to modify this state. Accessible only to admins.
   */
  bannedFromForums?: Maybe<Scalars['Boolean']>;
  /**
   * Email notification preferences can be read and set by the current user session.
   *     These settings cannot be accessed by other users or SeaSketch project admins.
   */
  emailNotificationPreference?: Maybe<EmailNotificationPreference>;
  /**
   * Reads and enables pagination through a set of `EmailNotificationPreference`.
   * @deprecated Please use emailNotificationPreference instead
   */
  emailNotificationPreferencesConnection: EmailNotificationPreferencesConnection;
  id: Scalars['Int'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /**
   * Indicates whether the user has seen post-registration information. Can be 
   * updated with `confirmOnboarded()` mutation. 
   * 
   * Since this field is a date, it could
   * hypothetically be reset as terms of service are updated, though it may be better
   * to add a new property to track that.
   */
  onboarded?: Maybe<Scalars['Datetime']>;
  participationStatus?: Maybe<ParticipationStatus>;
  /**
   * Access the user's profile. This feature is only accessible to project admins if
   * the user has chosen to share their profile with the project.
   * 
   * User profiles cannot be accessed directly en-mass by end-users. Rather, Survey 
   * `Posts` and other shared content will have accessor methods to get at this 
   * information, but again, only if the profile has been shared.
   */
  profile?: Maybe<Profile>;
};


/**
 * The SeaSketch User type is quite sparse since authentication is handled by Auth0
 * and we store no personal information unless the user explicitly adds it to the
 * user `Profile`.
 * 
 * During operation of the system, users identify themselves using bearer tokens. 
 * These tokens contain ephemeral information like `canonical_email` which can be
 * used to accept project invite tokens.
 */
export type UserBannedFromForumsArgs = {
  projectId?: Maybe<Scalars['Int']>;
};


/**
 * The SeaSketch User type is quite sparse since authentication is handled by Auth0
 * and we store no personal information unless the user explicitly adds it to the
 * user `Profile`.
 * 
 * During operation of the system, users identify themselves using bearer tokens. 
 * These tokens contain ephemeral information like `canonical_email` which can be
 * used to accept project invite tokens.
 */
export type UserEmailNotificationPreferencesConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<EmailNotificationPreferenceCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<EmailNotificationPreferencesOrderBy>>;
};


/**
 * The SeaSketch User type is quite sparse since authentication is handled by Auth0
 * and we store no personal information unless the user explicitly adds it to the
 * user `Profile`.
 * 
 * During operation of the system, users identify themselves using bearer tokens. 
 * These tokens contain ephemeral information like `canonical_email` which can be
 * used to accept project invite tokens.
 */
export type UserParticipationStatusArgs = {
  projectId?: Maybe<Scalars['Int']>;
};

/** A `User` edge in the connection. */
export type UsersEdge = {
  __typename?: 'UsersEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `User` at the end of the edge. */
  node?: Maybe<User>;
};

/** Methods to use when ordering `User`. */
export enum UsersOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

export type SimpleProjectListQueryVariables = Exact<{
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
}>;


export type SimpleProjectListQuery = (
  { __typename?: 'Query' }
  & { projectsConnection?: Maybe<(
    { __typename?: 'ProjectsConnection' }
    & { nodes: Array<Maybe<(
      { __typename?: 'Project' }
      & Pick<Project, 'id' | 'name' | 'url' | 'description' | 'isListed' | 'isFeatured' | 'logoUrl'>
      & { forums: Array<(
        { __typename?: 'Forum' }
        & Pick<Forum, 'name'>
        & { topicsConnection: (
          { __typename?: 'TopicsConnection' }
          & { nodes: Array<Maybe<(
            { __typename?: 'Topic' }
            & Pick<Topic, 'title'>
          )>> }
        ) }
      )> }
    )>> }
  )> }
);


export const SimpleProjectListDocument = gql`
    query SimpleProjectList($first: Int, $offset: Int) {
  projectsConnection(first: $first, offset: $offset) {
    nodes {
      id
      name
      url
      description
      isListed
      isFeatured
      logoUrl
      forums {
        name
        topicsConnection {
          nodes {
            title
          }
        }
      }
    }
  }
}
    `;

/**
 * __useSimpleProjectListQuery__
 *
 * To run a query within a React component, call `useSimpleProjectListQuery` and pass it any options that fit your needs.
 * When your component renders, `useSimpleProjectListQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSimpleProjectListQuery({
 *   variables: {
 *      first: // value for 'first'
 *      offset: // value for 'offset'
 *   },
 * });
 */
export function useSimpleProjectListQuery(baseOptions?: Apollo.QueryHookOptions<SimpleProjectListQuery, SimpleProjectListQueryVariables>) {
        return Apollo.useQuery<SimpleProjectListQuery, SimpleProjectListQueryVariables>(SimpleProjectListDocument, baseOptions);
      }
export function useSimpleProjectListLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SimpleProjectListQuery, SimpleProjectListQueryVariables>) {
          return Apollo.useLazyQuery<SimpleProjectListQuery, SimpleProjectListQueryVariables>(SimpleProjectListDocument, baseOptions);
        }
export type SimpleProjectListQueryHookResult = ReturnType<typeof useSimpleProjectListQuery>;
export type SimpleProjectListLazyQueryHookResult = ReturnType<typeof useSimpleProjectListLazyQuery>;
export type SimpleProjectListQueryResult = Apollo.QueryResult<SimpleProjectListQuery, SimpleProjectListQueryVariables>;