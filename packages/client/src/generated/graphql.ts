import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  /** A floating point number that requires more precision than IEEE 754 binary 64 */
  BigFloat: any;
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
  /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSON: any;
  /** A universally unique identifier as defined by [RFC 4122](https://tools.ietf.org/html/rfc4122). */
  UUID: any;
  /** The `Upload` scalar type represents a file upload. */
  Upload: any;
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
  /** Reads a single `Basemap` that is related to this `Acl`. */
  basemap?: Maybe<Basemap>;
  basemapId?: Maybe<Scalars['Int']>;
  forumIdRead?: Maybe<Scalars['Int']>;
  forumIdWrite?: Maybe<Scalars['Int']>;
  /** Reads and enables pagination through a set of `Group`. */
  groups?: Maybe<Array<Group>>;
  id: Scalars['Int'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** Reads a single `SketchClass` that is related to this `Acl`. */
  sketchClass?: Maybe<SketchClass>;
  sketchClassId?: Maybe<Scalars['Int']>;
  /** Reads a single `TableOfContentsItem` that is related to this `Acl`. */
  tableOfContentsItem?: Maybe<TableOfContentsItem>;
  tableOfContentsItemId?: Maybe<Scalars['Int']>;
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
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};

/** Represents an update to a `Acl`. Fields that are set will be updated. */
export type AclPatch = {
  /** Control whether access control is PUBLIC, ADMINS_ONLY, or GROUP */
  type?: InputMaybe<AccessControlListType>;
};

/** All input for the `addGroupToAcl` mutation. */
export type AddGroupToAclInput = {
  aclId?: InputMaybe<Scalars['Int']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  groupId?: InputMaybe<Scalars['Int']>;
};

/** The output of our `addGroupToAcl` mutation. */
export type AddGroupToAclPayload = {
  __typename?: 'AddGroupToAclPayload';
  acl?: Maybe<Acl>;
  /** Reads a single `Basemap` that is related to this `Acl`. */
  basemap?: Maybe<Basemap>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `SketchClass` that is related to this `Acl`. */
  sketchClass?: Maybe<SketchClass>;
  /** Reads a single `TableOfContentsItem` that is related to this `Acl`. */
  tableOfContentsItem?: Maybe<TableOfContentsItem>;
};

/** All input for the `addUserToGroup` mutation. */
export type AddUserToGroupInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  groupId?: InputMaybe<Scalars['Int']>;
  userId?: InputMaybe<Scalars['Int']>;
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
  child?: InputMaybe<Scalars['Int']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  parent?: InputMaybe<Scalars['Int']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
  projectId?: InputMaybe<Scalars['Int']>;
  userId?: InputMaybe<Scalars['Int']>;
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

/** All input for the `archiveResponses` mutation. */
export type ArchiveResponsesInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  ids?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
  makeArchived?: InputMaybe<Scalars['Boolean']>;
};

/** The output of our `archiveResponses` mutation. */
export type ArchiveResponsesPayload = {
  __typename?: 'ArchiveResponsesPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  surveyResponses?: Maybe<Array<SurveyResponse>>;
};

export type Basemap = Node & {
  __typename?: 'Basemap';
  /** Reads a single `Acl` that is related to this `Basemap`. */
  acl?: Maybe<Acl>;
  /**
   * Optional attribution to show at the bottom of the map. Will be overriden by
   * the attribution specified in the gl-style in the case of MAPBOX types.
   */
  attribution?: Maybe<Scalars['String']>;
  description?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /** Reads a single `InteractivitySetting` that is related to this `Basemap`. */
  interactivitySettings?: Maybe<InteractivitySetting>;
  interactivitySettingsId: Scalars['Int'];
  /**
   * Used to indicate whether the basemap is included in the public basemap
   * listing. Useful for hiding an option temporarily, or adding a basemap to the
   * project which will only be used in surveys.
   */
  isDisabled: Scalars['Boolean'];
  /** Identify the labels layer lowest in the stack so that overlay layers may be placed underneath. */
  labelsLayerId?: Maybe<Scalars['String']>;
  /** Label shown in the basemap picker interface */
  name: Scalars['String'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** Reads and enables pagination through a set of `OptionalBasemapLayer`. */
  optionalBasemapLayers: Array<OptionalBasemapLayer>;
  /** Reads a single `Project` that is related to this `Basemap`. */
  project?: Maybe<Project>;
  /**
   * If not set, the basemap will be considered a "Shared Basemap" that can be
   * added to any project. Otherwise it is private to the given proejct. Only
   * superusers can create Shared Basemaps.
   */
  projectId?: Maybe<Scalars['Int']>;
  /** Reads and enables pagination through a set of `ProjectsSharedBasemap`. */
  projectsSharedBasemapsConnection: ProjectsSharedBasemapsConnection;
  /** Reads and enables pagination through a set of `FormElement`. */
  relatedFormElements?: Maybe<Array<FormElement>>;
  surveysOnly: Scalars['Boolean'];
  terrainExaggeration: Scalars['BigFloat'];
  terrainMaxZoom: Scalars['Int'];
  /** If set to false, terrain will always be on. Otherwise the user will be given a toggle switch. */
  terrainOptional: Scalars['Boolean'];
  terrainTileSize: Scalars['Int'];
  /**
   * Terrain data source url. Leave blank to disable 3d terrain. See [mapbox gl style terrain
   * documentation](https://docs.mapbox.com/mapbox-gl-js/style-spec/terrain/).
   */
  terrainUrl?: Maybe<Scalars['String']>;
  terrainVisibilityDefault: Scalars['Boolean'];
  /** Square thumbnail will be used to identify the basemap */
  thumbnail: Scalars['String'];
  /** For use with RASTER_URL_TEMPLATE types. See the [raster source documetation](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#tiled-sources) */
  tileSize: Scalars['Int'];
  type: BasemapType;
  /**
   * For MAPBOX types, this can be a mapbox://-style url or a link to a custom
   * mapbox gl style. For RASTER_URL_TEMPLATE, it should be a url template
   * conforming to the [raster source documetation](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#tiled-sources)
   */
  url: Scalars['String'];
};


export type BasemapOptionalBasemapLayersArgs = {
  condition?: InputMaybe<OptionalBasemapLayerCondition>;
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<OptionalBasemapLayersOrderBy>>;
};


export type BasemapProjectsSharedBasemapsConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<ProjectsSharedBasemapCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<ProjectsSharedBasemapsOrderBy>>;
};


export type BasemapRelatedFormElementsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};

/** A condition to be used against `Basemap` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type BasemapCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `interactivitySettingsId` field. */
  interactivitySettingsId?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `projectId` field. */
  projectId?: InputMaybe<Scalars['Int']>;
};

/** An input for mutations affecting `Basemap` */
export type BasemapInput = {
  /**
   * Optional attribution to show at the bottom of the map. Will be overriden by
   * the attribution specified in the gl-style in the case of MAPBOX types.
   */
  attribution?: InputMaybe<Scalars['String']>;
  description?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['Int']>;
  /**
   * Used to indicate whether the basemap is included in the public basemap
   * listing. Useful for hiding an option temporarily, or adding a basemap to the
   * project which will only be used in surveys.
   */
  isDisabled?: InputMaybe<Scalars['Boolean']>;
  /** Identify the labels layer lowest in the stack so that overlay layers may be placed underneath. */
  labelsLayerId?: InputMaybe<Scalars['String']>;
  /** Label shown in the basemap picker interface */
  name: Scalars['String'];
  /**
   * If not set, the basemap will be considered a "Shared Basemap" that can be
   * added to any project. Otherwise it is private to the given proejct. Only
   * superusers can create Shared Basemaps.
   */
  projectId?: InputMaybe<Scalars['Int']>;
  surveysOnly?: InputMaybe<Scalars['Boolean']>;
  terrainExaggeration?: InputMaybe<Scalars['BigFloat']>;
  terrainMaxZoom?: InputMaybe<Scalars['Int']>;
  /** If set to false, terrain will always be on. Otherwise the user will be given a toggle switch. */
  terrainOptional?: InputMaybe<Scalars['Boolean']>;
  terrainTileSize?: InputMaybe<Scalars['Int']>;
  /**
   * Terrain data source url. Leave blank to disable 3d terrain. See [mapbox gl style terrain
   * documentation](https://docs.mapbox.com/mapbox-gl-js/style-spec/terrain/).
   */
  terrainUrl?: InputMaybe<Scalars['String']>;
  terrainVisibilityDefault?: InputMaybe<Scalars['Boolean']>;
  /** Square thumbnail will be used to identify the basemap */
  thumbnail?: InputMaybe<Scalars['Upload']>;
  /** For use with RASTER_URL_TEMPLATE types. See the [raster source documetation](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#tiled-sources) */
  tileSize?: InputMaybe<Scalars['Int']>;
  type: BasemapType;
  /**
   * For MAPBOX types, this can be a mapbox://-style url or a link to a custom
   * mapbox gl style. For RASTER_URL_TEMPLATE, it should be a url template
   * conforming to the [raster source documetation](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#tiled-sources)
   */
  url: Scalars['String'];
};

/** Represents an update to a `Basemap`. Fields that are set will be updated. */
export type BasemapPatch = {
  /**
   * Optional attribution to show at the bottom of the map. Will be overriden by
   * the attribution specified in the gl-style in the case of MAPBOX types.
   */
  attribution?: InputMaybe<Scalars['String']>;
  description?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['Int']>;
  interactivitySettingsId?: InputMaybe<Scalars['Int']>;
  /**
   * Used to indicate whether the basemap is included in the public basemap
   * listing. Useful for hiding an option temporarily, or adding a basemap to the
   * project which will only be used in surveys.
   */
  isDisabled?: InputMaybe<Scalars['Boolean']>;
  /** Identify the labels layer lowest in the stack so that overlay layers may be placed underneath. */
  labelsLayerId?: InputMaybe<Scalars['String']>;
  /** Label shown in the basemap picker interface */
  name?: InputMaybe<Scalars['String']>;
  /**
   * If not set, the basemap will be considered a "Shared Basemap" that can be
   * added to any project. Otherwise it is private to the given proejct. Only
   * superusers can create Shared Basemaps.
   */
  projectId?: InputMaybe<Scalars['Int']>;
  surveysOnly?: InputMaybe<Scalars['Boolean']>;
  terrainExaggeration?: InputMaybe<Scalars['BigFloat']>;
  terrainMaxZoom?: InputMaybe<Scalars['Int']>;
  /** If set to false, terrain will always be on. Otherwise the user will be given a toggle switch. */
  terrainOptional?: InputMaybe<Scalars['Boolean']>;
  terrainTileSize?: InputMaybe<Scalars['Int']>;
  /**
   * Terrain data source url. Leave blank to disable 3d terrain. See [mapbox gl style terrain
   * documentation](https://docs.mapbox.com/mapbox-gl-js/style-spec/terrain/).
   */
  terrainUrl?: InputMaybe<Scalars['String']>;
  terrainVisibilityDefault?: InputMaybe<Scalars['Boolean']>;
  /** Square thumbnail will be used to identify the basemap */
  thumbnail?: InputMaybe<Scalars['Upload']>;
  /** For use with RASTER_URL_TEMPLATE types. See the [raster source documetation](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#tiled-sources) */
  tileSize?: InputMaybe<Scalars['Int']>;
  type?: InputMaybe<BasemapType>;
  /**
   * For MAPBOX types, this can be a mapbox://-style url or a link to a custom
   * mapbox gl style. For RASTER_URL_TEMPLATE, it should be a url template
   * conforming to the [raster source documetation](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#tiled-sources)
   */
  url?: InputMaybe<Scalars['String']>;
};

/** SeaSketch supports multiple different basemap types. All must eventually be compiled down to a mapbox gl style. */
export enum BasemapType {
  Mapbox = 'MAPBOX',
  RasterUrlTemplate = 'RASTER_URL_TEMPLATE'
}

/** A connection to a list of `Basemap` values. */
export type BasemapsConnection = {
  __typename?: 'BasemapsConnection';
  /** A list of edges which contains the `Basemap` and cursor to aid in pagination. */
  edges: Array<BasemapsEdge>;
  /** A list of `Basemap` objects. */
  nodes: Array<Basemap>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Basemap` you could get from the connection. */
  totalCount: Scalars['Int'];
};

/** A `Basemap` edge in the connection. */
export type BasemapsEdge = {
  __typename?: 'BasemapsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `Basemap` at the end of the edge. */
  node: Basemap;
};

/** Methods to use when ordering `Basemap`. */
export enum BasemapsOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  InteractivitySettingsIdAsc = 'INTERACTIVITY_SETTINGS_ID_ASC',
  InteractivitySettingsIdDesc = 'INTERACTIVITY_SETTINGS_ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ProjectIdAsc = 'PROJECT_ID_ASC',
  ProjectIdDesc = 'PROJECT_ID_DESC'
}

/** All input for the `clearFormElementStyle` mutation. */
export type ClearFormElementStyleInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  formElementId?: InputMaybe<Scalars['Int']>;
};

/** The output of our `clearFormElementStyle` mutation. */
export type ClearFormElementStylePayload = {
  __typename?: 'ClearFormElementStylePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  formElement?: Maybe<FormElement>;
  /** An edge for our `FormElement`. May be used by Relay 1. */
  formElementEdge?: Maybe<FormElementsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `clearFormElementStyle` mutation. */
export type ClearFormElementStylePayloadFormElementEdgeArgs = {
  orderBy?: InputMaybe<Array<FormElementsOrderBy>>;
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
  content?: InputMaybe<Scalars['JSON']>;
  projectId: Scalars['Int'];
};

/** Represents an update to a `CommunityGuideline`. Fields that are set will be updated. */
export type CommunityGuidelinePatch = {
  /** JSON contents are expected to be used with a system like DraftJS on the client. */
  content?: InputMaybe<Scalars['JSON']>;
};

/** All input for the `confirmOnboarded` mutation. */
export type ConfirmOnboardedInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  orderBy?: InputMaybe<Array<UsersOrderBy>>;
};

/** All input for the `confirmProjectInviteWithSurveyToken` mutation. */
export type ConfirmProjectInviteWithSurveyTokenInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  projectId?: InputMaybe<Scalars['Int']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
  projectId?: InputMaybe<Scalars['Int']>;
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

/** All input for the `copyAppearance` mutation. */
export type CopyAppearanceInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  copyFromId?: InputMaybe<Scalars['Int']>;
  formElementId?: InputMaybe<Scalars['Int']>;
};

/** The output of our `copyAppearance` mutation. */
export type CopyAppearancePayload = {
  __typename?: 'CopyAppearancePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  formElement?: Maybe<FormElement>;
  /** An edge for our `FormElement`. May be used by Relay 1. */
  formElementEdge?: Maybe<FormElementsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `copyAppearance` mutation. */
export type CopyAppearancePayloadFormElementEdgeArgs = {
  orderBy?: InputMaybe<Array<FormElementsOrderBy>>;
};

/** All input for the create `Basemap` mutation. */
export type CreateBasemapInput = {
  /** The `Basemap` to be created by this mutation. */
  basemap: BasemapInput;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
};

/** The output of our create `Basemap` mutation. */
export type CreateBasemapPayload = {
  __typename?: 'CreateBasemapPayload';
  /** The `Basemap` that was created by this mutation. */
  basemap?: Maybe<Basemap>;
  /** An edge for our `Basemap`. May be used by Relay 1. */
  basemapEdge?: Maybe<BasemapsEdge>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `InteractivitySetting` that is related to this `Basemap`. */
  interactivitySettings?: Maybe<InteractivitySetting>;
  /** Reads a single `Project` that is related to this `Basemap`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our create `Basemap` mutation. */
export type CreateBasemapPayloadBasemapEdgeArgs = {
  orderBy?: InputMaybe<Array<BasemapsOrderBy>>;
};

/** All input for the create `CommunityGuideline` mutation. */
export type CreateCommunityGuidelineInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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

/** All input for the create `DataLayer` mutation. */
export type CreateDataLayerInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The `DataLayer` to be created by this mutation. */
  dataLayer: DataLayerInput;
};

/** The output of our create `DataLayer` mutation. */
export type CreateDataLayerPayload = {
  __typename?: 'CreateDataLayerPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `DataLayer` that was created by this mutation. */
  dataLayer?: Maybe<DataLayer>;
  /** An edge for our `DataLayer`. May be used by Relay 1. */
  dataLayerEdge?: Maybe<DataLayersEdge>;
  /** Reads a single `DataSource` that is related to this `DataLayer`. */
  dataSource?: Maybe<DataSource>;
  /** Reads a single `InteractivitySetting` that is related to this `DataLayer`. */
  interactivitySettings?: Maybe<InteractivitySetting>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our create `DataLayer` mutation. */
export type CreateDataLayerPayloadDataLayerEdgeArgs = {
  orderBy?: InputMaybe<Array<DataLayersOrderBy>>;
};

/** All input for the create `DataSource` mutation. */
export type CreateDataSourceInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The `DataSource` to be created by this mutation. */
  dataSource: DataSourceInput;
};

/** The output of our create `DataSource` mutation. */
export type CreateDataSourcePayload = {
  __typename?: 'CreateDataSourcePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `DataSource` that was created by this mutation. */
  dataSource?: Maybe<DataSource>;
  /** An edge for our `DataSource`. May be used by Relay 1. */
  dataSourceEdge?: Maybe<DataSourcesEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our create `DataSource` mutation. */
export type CreateDataSourcePayloadDataSourceEdgeArgs = {
  orderBy?: InputMaybe<Array<DataSourcesOrderBy>>;
};

/** All input for the create `FormElement` mutation. */
export type CreateFormElementInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The `FormElement` to be created by this mutation. */
  formElement: FormElementInput;
};

/** The output of our create `FormElement` mutation. */
export type CreateFormElementPayload = {
  __typename?: 'CreateFormElementPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `FormElement` that was created by this mutation. */
  formElement?: Maybe<FormElement>;
  /** An edge for our `FormElement`. May be used by Relay 1. */
  formElementEdge?: Maybe<FormElementsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our create `FormElement` mutation. */
export type CreateFormElementPayloadFormElementEdgeArgs = {
  orderBy?: InputMaybe<Array<FormElementsOrderBy>>;
};

/** All input for the create `FormLogicCondition` mutation. */
export type CreateFormLogicConditionInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The `FormLogicCondition` to be created by this mutation. */
  formLogicCondition: FormLogicConditionInput;
};

/** The output of our create `FormLogicCondition` mutation. */
export type CreateFormLogicConditionPayload = {
  __typename?: 'CreateFormLogicConditionPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `FormLogicCondition` that was created by this mutation. */
  formLogicCondition?: Maybe<FormLogicCondition>;
  /** An edge for our `FormLogicCondition`. May be used by Relay 1. */
  formLogicConditionEdge?: Maybe<FormLogicConditionsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our create `FormLogicCondition` mutation. */
export type CreateFormLogicConditionPayloadFormLogicConditionEdgeArgs = {
  orderBy?: InputMaybe<Array<FormLogicConditionsOrderBy>>;
};

/** All input for the create `FormLogicRule` mutation. */
export type CreateFormLogicRuleInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The `FormLogicRule` to be created by this mutation. */
  formLogicRule: FormLogicRuleInput;
};

/** The output of our create `FormLogicRule` mutation. */
export type CreateFormLogicRulePayload = {
  __typename?: 'CreateFormLogicRulePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `FormLogicRule` that was created by this mutation. */
  formLogicRule?: Maybe<FormLogicRule>;
  /** An edge for our `FormLogicRule`. May be used by Relay 1. */
  formLogicRuleEdge?: Maybe<FormLogicRulesEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our create `FormLogicRule` mutation. */
export type CreateFormLogicRulePayloadFormLogicRuleEdgeArgs = {
  orderBy?: InputMaybe<Array<FormLogicRulesOrderBy>>;
};

/** All input for the `createFormTemplateFromSketchClass` mutation. */
export type CreateFormTemplateFromSketchClassInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  sketchClassId?: InputMaybe<Scalars['Int']>;
  templateName?: InputMaybe<Scalars['String']>;
  templateType?: InputMaybe<FormTemplateType>;
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
  orderBy?: InputMaybe<Array<FormsOrderBy>>;
};

/** All input for the `createFormTemplateFromSurvey` mutation. */
export type CreateFormTemplateFromSurveyInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  surveyId?: InputMaybe<Scalars['Int']>;
  templateName?: InputMaybe<Scalars['String']>;
  templateType?: InputMaybe<FormTemplateType>;
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
  orderBy?: InputMaybe<Array<FormsOrderBy>>;
};

/** All input for the create `Forum` mutation. */
export type CreateForumInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  orderBy?: InputMaybe<Array<ForumsOrderBy>>;
};

/** All input for the create `Group` mutation. */
export type CreateGroupInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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

/** All input for the create `InteractivitySetting` mutation. */
export type CreateInteractivitySettingInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The `InteractivitySetting` to be created by this mutation. */
  interactivitySetting: InteractivitySettingInput;
};

/** The output of our create `InteractivitySetting` mutation. */
export type CreateInteractivitySettingPayload = {
  __typename?: 'CreateInteractivitySettingPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `InteractivitySetting` that was created by this mutation. */
  interactivitySetting?: Maybe<InteractivitySetting>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the create `OptionalBasemapLayer` mutation. */
export type CreateOptionalBasemapLayerInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The `OptionalBasemapLayer` to be created by this mutation. */
  optionalBasemapLayer: OptionalBasemapLayerInput;
};

/** The output of our create `OptionalBasemapLayer` mutation. */
export type CreateOptionalBasemapLayerPayload = {
  __typename?: 'CreateOptionalBasemapLayerPayload';
  /** Reads a single `Basemap` that is related to this `OptionalBasemapLayer`. */
  basemap?: Maybe<Basemap>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `OptionalBasemapLayer` that was created by this mutation. */
  optionalBasemapLayer?: Maybe<OptionalBasemapLayer>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `createPost` mutation. */
export type CreatePostInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  message?: InputMaybe<Scalars['JSON']>;
  topicId?: InputMaybe<Scalars['Int']>;
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
  orderBy?: InputMaybe<Array<PostsOrderBy>>;
};

/** All input for the `createProject` mutation. */
export type CreateProjectInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  name: Scalars['String'];
  slug: Scalars['String'];
};

/** All input for the create `ProjectInviteGroup` mutation. */
export type CreateProjectInviteGroupInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  /** Reads a single `Group` that is related to this `ProjectInviteGroup`. */
  group?: Maybe<Group>;
  /** Reads a single `ProjectInvite` that is related to this `ProjectInviteGroup`. */
  invite?: Maybe<ProjectInvite>;
  /** The `ProjectInviteGroup` that was created by this mutation. */
  projectInviteGroup?: Maybe<ProjectInviteGroup>;
  /** An edge for our `ProjectInviteGroup`. May be used by Relay 1. */
  projectInviteGroupEdge?: Maybe<ProjectInviteGroupsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our create `ProjectInviteGroup` mutation. */
export type CreateProjectInviteGroupPayloadProjectInviteGroupEdgeArgs = {
  orderBy?: InputMaybe<Array<ProjectInviteGroupsOrderBy>>;
};

/** All input for the `createProjectInvites` mutation. */
export type CreateProjectInvitesInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  groupNames?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
  makeAdmin?: InputMaybe<Scalars['Boolean']>;
  projectId?: InputMaybe<Scalars['Int']>;
  projectInviteOptions?: InputMaybe<Array<InputMaybe<ProjectInviteOptionInput>>>;
  sendEmailNow?: InputMaybe<Scalars['Boolean']>;
};

/** The output of our `createProjectInvites` mutation. */
export type CreateProjectInvitesPayload = {
  __typename?: 'CreateProjectInvitesPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectInvites?: Maybe<Array<ProjectInvite>>;
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
  /** Reads a single `DataSourcesBucket` that is related to this `Project`. */
  dataSourcesBucket?: Maybe<DataSourcesBucket>;
  project?: Maybe<Project>;
  /** An edge for our `Project`. May be used by Relay 1. */
  projectEdge?: Maybe<ProjectsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `createProject` mutation. */
export type CreateProjectPayloadProjectEdgeArgs = {
  orderBy?: InputMaybe<Array<ProjectsOrderBy>>;
};

/** All input for the create `ProjectsSharedBasemap` mutation. */
export type CreateProjectsSharedBasemapInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The `ProjectsSharedBasemap` to be created by this mutation. */
  projectsSharedBasemap: ProjectsSharedBasemapInput;
};

/** The output of our create `ProjectsSharedBasemap` mutation. */
export type CreateProjectsSharedBasemapPayload = {
  __typename?: 'CreateProjectsSharedBasemapPayload';
  /** Reads a single `Basemap` that is related to this `ProjectsSharedBasemap`. */
  basemap?: Maybe<Basemap>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `ProjectsSharedBasemap` that was created by this mutation. */
  projectsSharedBasemap?: Maybe<ProjectsSharedBasemap>;
  /** An edge for our `ProjectsSharedBasemap`. May be used by Relay 1. */
  projectsSharedBasemapEdge?: Maybe<ProjectsSharedBasemapsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our create `ProjectsSharedBasemap` mutation. */
export type CreateProjectsSharedBasemapPayloadProjectsSharedBasemapEdgeArgs = {
  orderBy?: InputMaybe<Array<ProjectsSharedBasemapsOrderBy>>;
};

/** All input for the create `SketchFolder` mutation. */
export type CreateSketchFolderInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  orderBy?: InputMaybe<Array<SketchFoldersOrderBy>>;
};

/** All input for the create `Sketch` mutation. */
export type CreateSketchInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  /** Reads a single `FormElement` that is related to this `Sketch`. */
  formElement?: Maybe<FormElement>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** The `Sketch` that was created by this mutation. */
  sketch?: Maybe<Sketch>;
  /** Reads a single `SketchClass` that is related to this `Sketch`. */
  sketchClass?: Maybe<SketchClass>;
  /** Reads a single `User` that is related to this `Sketch`. */
  user?: Maybe<User>;
};

/** All input for the create `SurveyInvitedGroup` mutation. */
export type CreateSurveyInvitedGroupInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
  groupNames?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
  includeProjectInvite?: InputMaybe<Scalars['Boolean']>;
  makeAdmin?: InputMaybe<Scalars['Boolean']>;
  surveyId?: InputMaybe<Scalars['Int']>;
  surveyInviteOptions?: InputMaybe<Array<InputMaybe<SurveyInviteOptionsInput>>>;
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
  surveyInvites?: Maybe<Array<SurveyInvite>>;
};

/** All input for the `createSurveyJumpRule` mutation. */
export type CreateSurveyJumpRuleInput = {
  booleanOperator?: InputMaybe<FormLogicOperator>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  formElementId?: InputMaybe<Scalars['Int']>;
  jumpToId?: InputMaybe<Scalars['Int']>;
  operator?: InputMaybe<FieldRuleOperator>;
};

/** The output of our `createSurveyJumpRule` mutation. */
export type CreateSurveyJumpRulePayload = {
  __typename?: 'CreateSurveyJumpRulePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  formLogicRule?: Maybe<FormLogicRule>;
  /** An edge for our `FormLogicRule`. May be used by Relay 1. */
  formLogicRuleEdge?: Maybe<FormLogicRulesEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `createSurveyJumpRule` mutation. */
export type CreateSurveyJumpRulePayloadFormLogicRuleEdgeArgs = {
  orderBy?: InputMaybe<Array<FormLogicRulesOrderBy>>;
};

/** All input for the `createSurveyResponse` mutation. */
export type CreateSurveyResponseInput = {
  bypassedSubmissionControl?: InputMaybe<Scalars['Boolean']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  draft?: InputMaybe<Scalars['Boolean']>;
  facilitated?: InputMaybe<Scalars['Boolean']>;
  practice?: InputMaybe<Scalars['Boolean']>;
  responseData?: InputMaybe<Scalars['JSON']>;
  surveyId?: InputMaybe<Scalars['Int']>;
};

/** The output of our `createSurveyResponse` mutation. */
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
  surveyResponse?: Maybe<SurveyResponse>;
  /** An edge for our `SurveyResponse`. May be used by Relay 1. */
  surveyResponseEdge?: Maybe<SurveyResponsesEdge>;
};


/** The output of our `createSurveyResponse` mutation. */
export type CreateSurveyResponsePayloadSurveyResponseEdgeArgs = {
  orderBy?: InputMaybe<Array<SurveyResponsesOrderBy>>;
};

/** All input for the create `TableOfContentsItem` mutation. */
export type CreateTableOfContentsItemInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The `TableOfContentsItem` to be created by this mutation. */
  tableOfContentsItem: TableOfContentsItemInput;
};

/** The output of our create `TableOfContentsItem` mutation. */
export type CreateTableOfContentsItemPayload = {
  __typename?: 'CreateTableOfContentsItemPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `DataLayer` that is related to this `TableOfContentsItem`. */
  dataLayer?: Maybe<DataLayer>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** The `TableOfContentsItem` that was created by this mutation. */
  tableOfContentsItem?: Maybe<TableOfContentsItem>;
  /** An edge for our `TableOfContentsItem`. May be used by Relay 1. */
  tableOfContentsItemEdge?: Maybe<TableOfContentsItemsEdge>;
};


/** The output of our create `TableOfContentsItem` mutation. */
export type CreateTableOfContentsItemPayloadTableOfContentsItemEdgeArgs = {
  orderBy?: InputMaybe<Array<TableOfContentsItemsOrderBy>>;
};

/** All input for the `createTopic` mutation. */
export type CreateTopicInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  forumId?: InputMaybe<Scalars['Int']>;
  message?: InputMaybe<Scalars['JSON']>;
  title?: InputMaybe<Scalars['String']>;
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
  orderBy?: InputMaybe<Array<TopicsOrderBy>>;
};

export enum CursorType {
  Auto = 'AUTO',
  Crosshair = 'CROSSHAIR',
  Default = 'DEFAULT',
  Pointer = 'POINTER'
}

/**
 * Data layers represent multiple MapBox GL Style layers tied to a single source.
 * These layers could also be called "operational layers" in that they are meant to
 * be overlaid on a basemap.
 *
 * The layers can appear tied to a TableOfContentsItem or be part of rich features
 * associated with a basemap.
 */
export type DataLayer = Node & {
  __typename?: 'DataLayer';
  /** Reads a single `DataSource` that is related to this `DataLayer`. */
  dataSource?: Maybe<DataSource>;
  dataSourceId: Scalars['Int'];
  id: Scalars['Int'];
  /** Reads a single `InteractivitySetting` that is related to this `DataLayer`. */
  interactivitySettings?: Maybe<InteractivitySetting>;
  interactivitySettingsId: Scalars['Int'];
  /**
   * JSON array of MapBox GL Style layers. Layers should not specify an id or
   * sourceId. These will be automatically generated at runtime.
   */
  mapboxGlStyles?: Maybe<Scalars['JSON']>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  projectId: Scalars['Int'];
  /**
   * Determines z-ordering of layer in relation to layers in the basemap. For this
   * functionality to work, layers must be identified in the basemap configuration.
   */
  renderUnder: RenderUnderType;
  /** For vector tile sources (VECTOR), references the layer inside the vector tiles that this layer applies to. */
  sourceLayer?: Maybe<Scalars['String']>;
  spriteIds?: Maybe<Array<Maybe<Scalars['Int']>>>;
  /** Reads and enables pagination through a set of `Sprite`. */
  sprites?: Maybe<Array<Sprite>>;
  /**
   * For ARCGIS_MAPSERVER and eventually WMS sources. In this case mapbox_gl_styles
   * is blank and this layer merely controls the display of a single sublayer when
   * making image requests.
   */
  sublayer?: Maybe<Scalars['String']>;
  /** Reads a single `TableOfContentsItem` that is related to this `DataLayer`. */
  tableOfContentsItem?: Maybe<TableOfContentsItem>;
  /**
   * Reads and enables pagination through a set of `TableOfContentsItem`.
   * @deprecated Please use tableOfContentsItem instead
   */
  tableOfContentsItemsConnection: TableOfContentsItemsConnection;
  zIndex: Scalars['Int'];
};


/**
 * Data layers represent multiple MapBox GL Style layers tied to a single source.
 * These layers could also be called "operational layers" in that they are meant to
 * be overlaid on a basemap.
 *
 * The layers can appear tied to a TableOfContentsItem or be part of rich features
 * associated with a basemap.
 */
export type DataLayerSpritesArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};


/**
 * Data layers represent multiple MapBox GL Style layers tied to a single source.
 * These layers could also be called "operational layers" in that they are meant to
 * be overlaid on a basemap.
 *
 * The layers can appear tied to a TableOfContentsItem or be part of rich features
 * associated with a basemap.
 */
export type DataLayerTableOfContentsItemsConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<TableOfContentsItemCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<TableOfContentsItemsOrderBy>>;
};

/**
 * A condition to be used against `DataLayer` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type DataLayerCondition = {
  /** Checks for equality with the object’s `dataSourceId` field. */
  dataSourceId?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `interactivitySettingsId` field. */
  interactivitySettingsId?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `projectId` field. */
  projectId?: InputMaybe<Scalars['Int']>;
};

/** An input for mutations affecting `DataLayer` */
export type DataLayerInput = {
  dataSourceId: Scalars['Int'];
  id?: InputMaybe<Scalars['Int']>;
  /**
   * JSON array of MapBox GL Style layers. Layers should not specify an id or
   * sourceId. These will be automatically generated at runtime.
   */
  mapboxGlStyles?: InputMaybe<Scalars['JSON']>;
  projectId: Scalars['Int'];
  /**
   * Determines z-ordering of layer in relation to layers in the basemap. For this
   * functionality to work, layers must be identified in the basemap configuration.
   */
  renderUnder?: InputMaybe<RenderUnderType>;
  /** For vector tile sources (VECTOR), references the layer inside the vector tiles that this layer applies to. */
  sourceLayer?: InputMaybe<Scalars['String']>;
  spriteIds?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
  /**
   * For ARCGIS_MAPSERVER and eventually WMS sources. In this case mapbox_gl_styles
   * is blank and this layer merely controls the display of a single sublayer when
   * making image requests.
   */
  sublayer?: InputMaybe<Scalars['String']>;
  zIndex?: InputMaybe<Scalars['Int']>;
};

/** Represents an update to a `DataLayer`. Fields that are set will be updated. */
export type DataLayerPatch = {
  dataSourceId?: InputMaybe<Scalars['Int']>;
  id?: InputMaybe<Scalars['Int']>;
  interactivitySettingsId?: InputMaybe<Scalars['Int']>;
  /**
   * JSON array of MapBox GL Style layers. Layers should not specify an id or
   * sourceId. These will be automatically generated at runtime.
   */
  mapboxGlStyles?: InputMaybe<Scalars['JSON']>;
  projectId?: InputMaybe<Scalars['Int']>;
  /**
   * Determines z-ordering of layer in relation to layers in the basemap. For this
   * functionality to work, layers must be identified in the basemap configuration.
   */
  renderUnder?: InputMaybe<RenderUnderType>;
  /** For vector tile sources (VECTOR), references the layer inside the vector tiles that this layer applies to. */
  sourceLayer?: InputMaybe<Scalars['String']>;
  spriteIds?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
  /**
   * For ARCGIS_MAPSERVER and eventually WMS sources. In this case mapbox_gl_styles
   * is blank and this layer merely controls the display of a single sublayer when
   * making image requests.
   */
  sublayer?: InputMaybe<Scalars['String']>;
  zIndex?: InputMaybe<Scalars['Int']>;
};

/** A connection to a list of `DataLayer` values. */
export type DataLayersConnection = {
  __typename?: 'DataLayersConnection';
  /** A list of edges which contains the `DataLayer` and cursor to aid in pagination. */
  edges: Array<DataLayersEdge>;
  /** A list of `DataLayer` objects. */
  nodes: Array<DataLayer>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `DataLayer` you could get from the connection. */
  totalCount: Scalars['Int'];
};

/** A `DataLayer` edge in the connection. */
export type DataLayersEdge = {
  __typename?: 'DataLayersEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `DataLayer` at the end of the edge. */
  node: DataLayer;
};

/** Methods to use when ordering `DataLayer`. */
export enum DataLayersOrderBy {
  DataSourceIdAsc = 'DATA_SOURCE_ID_ASC',
  DataSourceIdDesc = 'DATA_SOURCE_ID_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  InteractivitySettingsIdAsc = 'INTERACTIVITY_SETTINGS_ID_ASC',
  InteractivitySettingsIdDesc = 'INTERACTIVITY_SETTINGS_ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ProjectIdAsc = 'PROJECT_ID_ASC',
  ProjectIdDesc = 'PROJECT_ID_DESC'
}

/**
 * SeaSketch DataSources are analogous to MapBox GL Style sources but are extended
 * to include new types to support services such as ArcGIS MapServers and content
 * hosted on the SeaSketch CDN.
 *
 * When documentation is lacking for any of these properties, consult the [MapBox GL Style docs](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson-promoteId)
 */
export type DataSource = Node & {
  __typename?: 'DataSource';
  /** Contains an attribution to be displayed when the map is shown to a user. */
  attribution?: Maybe<Scalars['String']>;
  /**
   * An array containing the longitude and latitude of the southwest and northeast
   * corners of the source bounding box in the following order: `[sw.lng, sw.lat,
   * ne.lng, ne.lat]`. When this property is included in a source, no tiles outside
   * of the given bounds are requested by Mapbox GL. This property can also be used
   * as metadata for non-tiled sources.
   */
  bounds?: Maybe<Array<Maybe<Scalars['BigFloat']>>>;
  /** SEASKETCH_VECTOR sources only. S3 bucket where data are stored. Populated from Project.data_sources_bucket on creation. */
  bucketId?: Maybe<Scalars['String']>;
  /**
   * GeoJSON only. Size of the tile buffer on each side. A value of 0 produces no
   * buffer. A value of 512 produces a buffer as wide as the tile itself. Larger
   * values produce fewer rendering artifacts near tile edges and slower performance.
   */
  buffer?: Maybe<Scalars['Int']>;
  /** SEASKETCH_VECTOR sources only. Approximate size of the geojson source */
  byteLength?: Maybe<Scalars['Int']>;
  /**
   * GeoJSON only.
   *
   * If the data is a collection of point features, setting this to true clusters
   * the points by radius into groups. Cluster groups become new Point features in
   * the source with additional properties:
   *
   *   * cluster Is true if the point is a cluster
   *   * cluster_id A unqiue id for the cluster to be used in conjunction with the
   * [cluster inspection methods](https://docs.mapbox.com/mapbox-gl-js/api/#geojsonsource#getclusterexpansionzoom)
   *   * point_count Number of original points grouped into this cluster
   *   * point_count_abbreviated An abbreviated point count
   */
  cluster?: Maybe<Scalars['Boolean']>;
  /**
   * GeoJSON only. Max zoom on which to cluster points if clustering is enabled.
   * Defaults to one zoom less than maxzoom (so that last zoom features are not clustered).
   */
  clusterMaxZoom?: Maybe<Scalars['Int']>;
  /** See [MapBox GL Style docs](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson-clusterProperties). */
  clusterProperties?: Maybe<Scalars['JSON']>;
  /**
   * GeoJSON only. Radius of each cluster if clustering is enabled. A value of 512
   * indicates a radius equal to the width of a tile.
   */
  clusterRadius?: Maybe<Scalars['Int']>;
  /** Image sources only. Corners of image specified in longitude, latitude pairs. */
  coordinates?: Maybe<Array<Maybe<Scalars['BigFloat']>>>;
  createdAt: Scalars['Datetime'];
  /** Reads and enables pagination through a set of `DataLayer`. */
  dataLayersConnection: DataLayersConnection;
  /** Raster-DEM only. The encoding used by this source. Mapbox Terrain RGB is used by default */
  encoding?: Maybe<RasterDemEncoding>;
  /**
   * SEASKETCH_VECTOR sources only. When enabled, uploads will be placed in a
   * different class of storage that requires a temporary security credential to
   * access. Set during creation and cannot be changed.
   */
  enhancedSecurity?: Maybe<Scalars['Boolean']>;
  /**
   * GeoJSON only. Whether to generate ids for the geojson features. When enabled,
   * the feature.id property will be auto assigned based on its index in the
   * features array, over-writing any previous values.
   */
  generateId?: Maybe<Scalars['Boolean']>;
  /** Should be used as sourceId in stylesheets. */
  id: Scalars['Int'];
  /**
   * For SeaSketchVector sources, identifies whether the original source comes from
   * a direct upload or a service location like ArcGIS server
   */
  importType?: Maybe<DataSourceImportTypes>;
  /**
   * GeoJSON only. Whether to calculate line distance metrics. This is required for
   * line layers that specify line-gradient values.
   */
  lineMetrics?: Maybe<Scalars['Boolean']>;
  /**
   * For Vector, Raster, GeoJSON and Raster DEM sources. Maximum zoom level for
   * which tiles are available, as in the TileJSON spec. Data from tiles at the
   * maxzoom are used when displaying the map at higher zoom levels.
   */
  maxzoom?: Maybe<Scalars['Int']>;
  /** For Vector, Raster, and Raster DEM sources. Minimum zoom level for which tiles are available, as in the TileJSON spec. */
  minzoom?: Maybe<Scalars['Int']>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** SEASKETCH_VECTOR sources only. S3 object key where data are stored */
  objectKey?: Maybe<Scalars['UUID']>;
  /**
   * For SeaSketchVector sources, identifies location of original service that
   * hosted the data, if any. This can be used to update a layer with an updated
   * copy of the data source if necessary.
   */
  originalSourceUrl?: Maybe<Scalars['String']>;
  /** Use to upload source data to s3. Must be an admin. */
  presignedUploadUrl?: Maybe<Scalars['String']>;
  projectId: Scalars['Int'];
  /**
   * GeoJSON only. A property to use as a feature id (for feature state). Either a
   * property name, or an object of the form `{<sourceLayer>: <propertyName>}.`
   */
  promoteId?: Maybe<Scalars['Boolean']>;
  /**
   * ARCGIS_DYNAMIC_MAPSERVER and ARCGIS_VECTOR only. Key-Value object with
   * querystring parameters that will be added to requests.
   */
  queryParameters?: Maybe<Scalars['JSON']>;
  /**
   * For MapBox Vector and Raster sources. Influences the y direction of the tile
   * coordinates. The global-mercator (aka Spherical Mercator) profile is assumed.
   */
  scheme?: Maybe<TileScheme>;
  /** ArcGIS map service setting. If enabled, client can reorder layers and apply layer-specific opacity settings. */
  supportsDynamicLayers: Scalars['Boolean'];
  /** The minimum visual size to display tiles for this layer. Only configurable for raster layers. */
  tileSize?: Maybe<Scalars['Int']>;
  /** For tiled sources, a list of endpoints that can be used to retrieve tiles. */
  tiles?: Maybe<Array<Maybe<Scalars['String']>>>;
  /** GeoJSON only. Douglas-Peucker simplification tolerance (higher means simpler geometries and faster performance). */
  tolerance?: Maybe<Scalars['BigFloat']>;
  /** MapBox GL source type or custom seasketch type. */
  type: DataSourceTypes;
  /**
   * A URL to a TileJSON resource for tiled sources. For GeoJSON or
   * SEASKETCH_VECTOR sources, use this to fill in the data property of the source.
   * Also used by ARCGIS_DYNAMIC_MAPSERVER and ARCGIS_VECTOR
   */
  url?: Maybe<Scalars['String']>;
  /** Video sources only. URLs to video content in order of preferred format. */
  urls?: Maybe<Array<Maybe<Scalars['String']>>>;
  /** ARCGIS_DYNAMIC_MAPSERVER only. When using a high-dpi screen, request higher resolution images. */
  useDevicePixelRatio?: Maybe<Scalars['Boolean']>;
};


/**
 * SeaSketch DataSources are analogous to MapBox GL Style sources but are extended
 * to include new types to support services such as ArcGIS MapServers and content
 * hosted on the SeaSketch CDN.
 *
 * When documentation is lacking for any of these properties, consult the [MapBox GL Style docs](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson-promoteId)
 */
export type DataSourceDataLayersConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<DataLayerCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<DataLayersOrderBy>>;
};

export enum DataSourceImportTypes {
  /** Imported from an arcgis feature layer identified by original_source_url */
  Arcgis = 'ARCGIS',
  /** Uploaded directly to SeaSketch using GeoJSON or shapefile */
  Upload = 'UPLOAD'
}

/** An input for mutations affecting `DataSource` */
export type DataSourceInput = {
  /** Contains an attribution to be displayed when the map is shown to a user. */
  attribution?: InputMaybe<Scalars['String']>;
  /**
   * An array containing the longitude and latitude of the southwest and northeast
   * corners of the source bounding box in the following order: `[sw.lng, sw.lat,
   * ne.lng, ne.lat]`. When this property is included in a source, no tiles outside
   * of the given bounds are requested by Mapbox GL. This property can also be used
   * as metadata for non-tiled sources.
   */
  bounds?: InputMaybe<Array<InputMaybe<Scalars['BigFloat']>>>;
  /** SEASKETCH_VECTOR sources only. S3 bucket where data are stored. Populated from Project.data_sources_bucket on creation. */
  bucketId?: InputMaybe<Scalars['String']>;
  /**
   * GeoJSON only. Size of the tile buffer on each side. A value of 0 produces no
   * buffer. A value of 512 produces a buffer as wide as the tile itself. Larger
   * values produce fewer rendering artifacts near tile edges and slower performance.
   */
  buffer?: InputMaybe<Scalars['Int']>;
  /** SEASKETCH_VECTOR sources only. Approximate size of the geojson source */
  byteLength?: InputMaybe<Scalars['Int']>;
  /**
   * GeoJSON only.
   *
   * If the data is a collection of point features, setting this to true clusters
   * the points by radius into groups. Cluster groups become new Point features in
   * the source with additional properties:
   *
   *   * cluster Is true if the point is a cluster
   *   * cluster_id A unqiue id for the cluster to be used in conjunction with the
   * [cluster inspection methods](https://docs.mapbox.com/mapbox-gl-js/api/#geojsonsource#getclusterexpansionzoom)
   *   * point_count Number of original points grouped into this cluster
   *   * point_count_abbreviated An abbreviated point count
   */
  cluster?: InputMaybe<Scalars['Boolean']>;
  /**
   * GeoJSON only. Max zoom on which to cluster points if clustering is enabled.
   * Defaults to one zoom less than maxzoom (so that last zoom features are not clustered).
   */
  clusterMaxZoom?: InputMaybe<Scalars['Int']>;
  /** See [MapBox GL Style docs](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson-clusterProperties). */
  clusterProperties?: InputMaybe<Scalars['JSON']>;
  /**
   * GeoJSON only. Radius of each cluster if clustering is enabled. A value of 512
   * indicates a radius equal to the width of a tile.
   */
  clusterRadius?: InputMaybe<Scalars['Int']>;
  /** Image sources only. Corners of image specified in longitude, latitude pairs. */
  coordinates?: InputMaybe<Array<InputMaybe<Scalars['BigFloat']>>>;
  createdAt?: InputMaybe<Scalars['Datetime']>;
  /** Raster-DEM only. The encoding used by this source. Mapbox Terrain RGB is used by default */
  encoding?: InputMaybe<RasterDemEncoding>;
  /**
   * SEASKETCH_VECTOR sources only. When enabled, uploads will be placed in a
   * different class of storage that requires a temporary security credential to
   * access. Set during creation and cannot be changed.
   */
  enhancedSecurity?: InputMaybe<Scalars['Boolean']>;
  /**
   * GeoJSON only. Whether to generate ids for the geojson features. When enabled,
   * the feature.id property will be auto assigned based on its index in the
   * features array, over-writing any previous values.
   */
  generateId?: InputMaybe<Scalars['Boolean']>;
  /** Should be used as sourceId in stylesheets. */
  id?: InputMaybe<Scalars['Int']>;
  /**
   * For SeaSketchVector sources, identifies whether the original source comes from
   * a direct upload or a service location like ArcGIS server
   */
  importType?: InputMaybe<DataSourceImportTypes>;
  /**
   * GeoJSON only. Whether to calculate line distance metrics. This is required for
   * line layers that specify line-gradient values.
   */
  lineMetrics?: InputMaybe<Scalars['Boolean']>;
  /**
   * For Vector, Raster, GeoJSON and Raster DEM sources. Maximum zoom level for
   * which tiles are available, as in the TileJSON spec. Data from tiles at the
   * maxzoom are used when displaying the map at higher zoom levels.
   */
  maxzoom?: InputMaybe<Scalars['Int']>;
  /** For Vector, Raster, and Raster DEM sources. Minimum zoom level for which tiles are available, as in the TileJSON spec. */
  minzoom?: InputMaybe<Scalars['Int']>;
  /** SEASKETCH_VECTOR sources only. S3 object key where data are stored */
  objectKey?: InputMaybe<Scalars['UUID']>;
  /**
   * For SeaSketchVector sources, identifies location of original service that
   * hosted the data, if any. This can be used to update a layer with an updated
   * copy of the data source if necessary.
   */
  originalSourceUrl?: InputMaybe<Scalars['String']>;
  projectId: Scalars['Int'];
  /**
   * GeoJSON only. A property to use as a feature id (for feature state). Either a
   * property name, or an object of the form `{<sourceLayer>: <propertyName>}.`
   */
  promoteId?: InputMaybe<Scalars['Boolean']>;
  /**
   * ARCGIS_DYNAMIC_MAPSERVER and ARCGIS_VECTOR only. Key-Value object with
   * querystring parameters that will be added to requests.
   */
  queryParameters?: InputMaybe<Scalars['JSON']>;
  /**
   * For MapBox Vector and Raster sources. Influences the y direction of the tile
   * coordinates. The global-mercator (aka Spherical Mercator) profile is assumed.
   */
  scheme?: InputMaybe<TileScheme>;
  /** ArcGIS map service setting. If enabled, client can reorder layers and apply layer-specific opacity settings. */
  supportsDynamicLayers?: InputMaybe<Scalars['Boolean']>;
  /** The minimum visual size to display tiles for this layer. Only configurable for raster layers. */
  tileSize?: InputMaybe<Scalars['Int']>;
  /** For tiled sources, a list of endpoints that can be used to retrieve tiles. */
  tiles?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
  /** GeoJSON only. Douglas-Peucker simplification tolerance (higher means simpler geometries and faster performance). */
  tolerance?: InputMaybe<Scalars['BigFloat']>;
  /** MapBox GL source type or custom seasketch type. */
  type: DataSourceTypes;
  /**
   * A URL to a TileJSON resource for tiled sources. For GeoJSON or
   * SEASKETCH_VECTOR sources, use this to fill in the data property of the source.
   * Also used by ARCGIS_DYNAMIC_MAPSERVER and ARCGIS_VECTOR
   */
  url?: InputMaybe<Scalars['String']>;
  /** Video sources only. URLs to video content in order of preferred format. */
  urls?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
  /** ARCGIS_DYNAMIC_MAPSERVER only. When using a high-dpi screen, request higher resolution images. */
  useDevicePixelRatio?: InputMaybe<Scalars['Boolean']>;
};

/** Represents an update to a `DataSource`. Fields that are set will be updated. */
export type DataSourcePatch = {
  /** Contains an attribution to be displayed when the map is shown to a user. */
  attribution?: InputMaybe<Scalars['String']>;
  /**
   * GeoJSON only. Size of the tile buffer on each side. A value of 0 produces no
   * buffer. A value of 512 produces a buffer as wide as the tile itself. Larger
   * values produce fewer rendering artifacts near tile edges and slower performance.
   */
  buffer?: InputMaybe<Scalars['Int']>;
  /**
   * GeoJSON only.
   *
   * If the data is a collection of point features, setting this to true clusters
   * the points by radius into groups. Cluster groups become new Point features in
   * the source with additional properties:
   *
   *   * cluster Is true if the point is a cluster
   *   * cluster_id A unqiue id for the cluster to be used in conjunction with the
   * [cluster inspection methods](https://docs.mapbox.com/mapbox-gl-js/api/#geojsonsource#getclusterexpansionzoom)
   *   * point_count Number of original points grouped into this cluster
   *   * point_count_abbreviated An abbreviated point count
   */
  cluster?: InputMaybe<Scalars['Boolean']>;
  /**
   * GeoJSON only. Max zoom on which to cluster points if clustering is enabled.
   * Defaults to one zoom less than maxzoom (so that last zoom features are not clustered).
   */
  clusterMaxZoom?: InputMaybe<Scalars['Int']>;
  /** See [MapBox GL Style docs](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson-clusterProperties). */
  clusterProperties?: InputMaybe<Scalars['JSON']>;
  /**
   * GeoJSON only. Radius of each cluster if clustering is enabled. A value of 512
   * indicates a radius equal to the width of a tile.
   */
  clusterRadius?: InputMaybe<Scalars['Int']>;
  /** Image sources only. Corners of image specified in longitude, latitude pairs. */
  coordinates?: InputMaybe<Array<InputMaybe<Scalars['BigFloat']>>>;
  /** Raster-DEM only. The encoding used by this source. Mapbox Terrain RGB is used by default */
  encoding?: InputMaybe<RasterDemEncoding>;
  /**
   * GeoJSON only. Whether to generate ids for the geojson features. When enabled,
   * the feature.id property will be auto assigned based on its index in the
   * features array, over-writing any previous values.
   */
  generateId?: InputMaybe<Scalars['Boolean']>;
  /**
   * GeoJSON only. Whether to calculate line distance metrics. This is required for
   * line layers that specify line-gradient values.
   */
  lineMetrics?: InputMaybe<Scalars['Boolean']>;
  /**
   * For Vector, Raster, GeoJSON and Raster DEM sources. Maximum zoom level for
   * which tiles are available, as in the TileJSON spec. Data from tiles at the
   * maxzoom are used when displaying the map at higher zoom levels.
   */
  maxzoom?: InputMaybe<Scalars['Int']>;
  /** For Vector, Raster, and Raster DEM sources. Minimum zoom level for which tiles are available, as in the TileJSON spec. */
  minzoom?: InputMaybe<Scalars['Int']>;
  /**
   * GeoJSON only. A property to use as a feature id (for feature state). Either a
   * property name, or an object of the form `{<sourceLayer>: <propertyName>}.`
   */
  promoteId?: InputMaybe<Scalars['Boolean']>;
  /**
   * ARCGIS_DYNAMIC_MAPSERVER and ARCGIS_VECTOR only. Key-Value object with
   * querystring parameters that will be added to requests.
   */
  queryParameters?: InputMaybe<Scalars['JSON']>;
  /**
   * For MapBox Vector and Raster sources. Influences the y direction of the tile
   * coordinates. The global-mercator (aka Spherical Mercator) profile is assumed.
   */
  scheme?: InputMaybe<TileScheme>;
  /** ArcGIS map service setting. If enabled, client can reorder layers and apply layer-specific opacity settings. */
  supportsDynamicLayers?: InputMaybe<Scalars['Boolean']>;
  /** The minimum visual size to display tiles for this layer. Only configurable for raster layers. */
  tileSize?: InputMaybe<Scalars['Int']>;
  /** For tiled sources, a list of endpoints that can be used to retrieve tiles. */
  tiles?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
  /** GeoJSON only. Douglas-Peucker simplification tolerance (higher means simpler geometries and faster performance). */
  tolerance?: InputMaybe<Scalars['BigFloat']>;
  /**
   * A URL to a TileJSON resource for tiled sources. For GeoJSON or
   * SEASKETCH_VECTOR sources, use this to fill in the data property of the source.
   * Also used by ARCGIS_DYNAMIC_MAPSERVER and ARCGIS_VECTOR
   */
  url?: InputMaybe<Scalars['String']>;
  /** Video sources only. URLs to video content in order of preferred format. */
  urls?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
  /** ARCGIS_DYNAMIC_MAPSERVER only. When using a high-dpi screen, request higher resolution images. */
  useDevicePixelRatio?: InputMaybe<Scalars['Boolean']>;
};

export enum DataSourceTypes {
  /** Loads dynamic images for the entire viewport from arcgis server */
  ArcgisDynamicMapserver = 'ARCGIS_DYNAMIC_MAPSERVER',
  /** Loads vector data from arcgis server for rendering as a geojson source */
  ArcgisVector = 'ARCGIS_VECTOR',
  /** MapBox GL Style "geojson" source */
  Geojson = 'GEOJSON',
  /** MapBox GL Style "image" source */
  Image = 'IMAGE',
  /** MapBox GL Style "raster" source */
  Raster = 'RASTER',
  /** MapBox GL Style "raster" source */
  RasterDem = 'RASTER_DEM',
  /** Combination of geojson and possible vector sources hosted on SeaSketch CND */
  SeasketchVector = 'SEASKETCH_VECTOR',
  /** MapBox GL Style "vector" source */
  Vector = 'VECTOR',
  /** MapBox GL Style "video" source */
  Video = 'VIDEO'
}

export type DataSourcesBucket = Node & {
  __typename?: 'DataSourcesBucket';
  bucket?: Maybe<Scalars['String']>;
  location: GeometryPoint;
  name: Scalars['String'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** Indicates the DataHostingStack for this region has been deleted */
  offline: Scalars['Boolean'];
  /** Reads and enables pagination through a set of `Project`. */
  projectsConnection: ProjectsConnection;
  region: Scalars['String'];
  /** Base url for this point-of-presence. */
  url: Scalars['String'];
};


export type DataSourcesBucketProjectsConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<ProjectCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<ProjectsOrderBy>>;
};

/**
 * A condition to be used against `DataSourcesBucket` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type DataSourcesBucketCondition = {
  /** Checks for equality with the object’s `url` field. */
  url?: InputMaybe<Scalars['String']>;
};

/** A connection to a list of `DataSourcesBucket` values. */
export type DataSourcesBucketsConnection = {
  __typename?: 'DataSourcesBucketsConnection';
  /** A list of edges which contains the `DataSourcesBucket` and cursor to aid in pagination. */
  edges: Array<DataSourcesBucketsEdge>;
  /** A list of `DataSourcesBucket` objects. */
  nodes: Array<DataSourcesBucket>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `DataSourcesBucket` you could get from the connection. */
  totalCount: Scalars['Int'];
};

/** A `DataSourcesBucket` edge in the connection. */
export type DataSourcesBucketsEdge = {
  __typename?: 'DataSourcesBucketsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `DataSourcesBucket` at the end of the edge. */
  node: DataSourcesBucket;
};

/** Methods to use when ordering `DataSourcesBucket`. */
export enum DataSourcesBucketsOrderBy {
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  UrlAsc = 'URL_ASC',
  UrlDesc = 'URL_DESC'
}

/** A `DataSource` edge in the connection. */
export type DataSourcesEdge = {
  __typename?: 'DataSourcesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `DataSource` at the end of the edge. */
  node: DataSource;
};

/** Methods to use when ordering `DataSource`. */
export enum DataSourcesOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ProjectIdAsc = 'PROJECT_ID_ASC',
  ProjectIdDesc = 'PROJECT_ID_DESC'
}

/** All input for the `deleteBasemapByNodeId` mutation. */
export type DeleteBasemapByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Basemap` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteBasemap` mutation. */
export type DeleteBasemapInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `Basemap` mutation. */
export type DeleteBasemapPayload = {
  __typename?: 'DeleteBasemapPayload';
  /** The `Basemap` that was deleted by this mutation. */
  basemap?: Maybe<Basemap>;
  /** An edge for our `Basemap`. May be used by Relay 1. */
  basemapEdge?: Maybe<BasemapsEdge>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedBasemapNodeId?: Maybe<Scalars['ID']>;
  /** Reads a single `InteractivitySetting` that is related to this `Basemap`. */
  interactivitySettings?: Maybe<InteractivitySetting>;
  /** Reads a single `Project` that is related to this `Basemap`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our delete `Basemap` mutation. */
export type DeleteBasemapPayloadBasemapEdgeArgs = {
  orderBy?: InputMaybe<Array<BasemapsOrderBy>>;
};

/** All input for the `deleteCommunityGuidelineByNodeId` mutation. */
export type DeleteCommunityGuidelineByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `CommunityGuideline` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteCommunityGuideline` mutation. */
export type DeleteCommunityGuidelineInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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

/** All input for the `deleteDataLayerByInteractivitySettingsId` mutation. */
export type DeleteDataLayerByInteractivitySettingsIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  interactivitySettingsId: Scalars['Int'];
};

/** All input for the `deleteDataLayerByNodeId` mutation. */
export type DeleteDataLayerByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `DataLayer` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteDataLayer` mutation. */
export type DeleteDataLayerInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `DataLayer` mutation. */
export type DeleteDataLayerPayload = {
  __typename?: 'DeleteDataLayerPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `DataLayer` that was deleted by this mutation. */
  dataLayer?: Maybe<DataLayer>;
  /** An edge for our `DataLayer`. May be used by Relay 1. */
  dataLayerEdge?: Maybe<DataLayersEdge>;
  /** Reads a single `DataSource` that is related to this `DataLayer`. */
  dataSource?: Maybe<DataSource>;
  deletedDataLayerNodeId?: Maybe<Scalars['ID']>;
  /** Reads a single `InteractivitySetting` that is related to this `DataLayer`. */
  interactivitySettings?: Maybe<InteractivitySetting>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our delete `DataLayer` mutation. */
export type DeleteDataLayerPayloadDataLayerEdgeArgs = {
  orderBy?: InputMaybe<Array<DataLayersOrderBy>>;
};

/** All input for the `deleteDataSourceByNodeId` mutation. */
export type DeleteDataSourceByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `DataSource` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteDataSource` mutation. */
export type DeleteDataSourceInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** Should be used as sourceId in stylesheets. */
  id: Scalars['Int'];
};

/** The output of our delete `DataSource` mutation. */
export type DeleteDataSourcePayload = {
  __typename?: 'DeleteDataSourcePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `DataSource` that was deleted by this mutation. */
  dataSource?: Maybe<DataSource>;
  /** An edge for our `DataSource`. May be used by Relay 1. */
  dataSourceEdge?: Maybe<DataSourcesEdge>;
  deletedDataSourceNodeId?: Maybe<Scalars['ID']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our delete `DataSource` mutation. */
export type DeleteDataSourcePayloadDataSourceEdgeArgs = {
  orderBy?: InputMaybe<Array<DataSourcesOrderBy>>;
};

/** All input for the `deleteFormByNodeId` mutation. */
export type DeleteFormByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Form` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteFormBySketchClassId` mutation. */
export type DeleteFormBySketchClassIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** Related *SketchClass* */
  sketchClassId: Scalars['Int'];
};

/** All input for the `deleteFormBySurveyId` mutation. */
export type DeleteFormBySurveyIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** Related *Survey* */
  surveyId: Scalars['Int'];
};

/** All input for the `deleteFormElementByNodeId` mutation. */
export type DeleteFormElementByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `FormElement` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteFormElement` mutation. */
export type DeleteFormElementInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `FormElement` mutation. */
export type DeleteFormElementPayload = {
  __typename?: 'DeleteFormElementPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedFormElementNodeId?: Maybe<Scalars['ID']>;
  /** The `FormElement` that was deleted by this mutation. */
  formElement?: Maybe<FormElement>;
  /** An edge for our `FormElement`. May be used by Relay 1. */
  formElementEdge?: Maybe<FormElementsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our delete `FormElement` mutation. */
export type DeleteFormElementPayloadFormElementEdgeArgs = {
  orderBy?: InputMaybe<Array<FormElementsOrderBy>>;
};

/** All input for the `deleteForm` mutation. */
export type DeleteFormInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** All input for the `deleteFormLogicConditionByNodeId` mutation. */
export type DeleteFormLogicConditionByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `FormLogicCondition` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteFormLogicCondition` mutation. */
export type DeleteFormLogicConditionInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `FormLogicCondition` mutation. */
export type DeleteFormLogicConditionPayload = {
  __typename?: 'DeleteFormLogicConditionPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedFormLogicConditionNodeId?: Maybe<Scalars['ID']>;
  /** The `FormLogicCondition` that was deleted by this mutation. */
  formLogicCondition?: Maybe<FormLogicCondition>;
  /** An edge for our `FormLogicCondition`. May be used by Relay 1. */
  formLogicConditionEdge?: Maybe<FormLogicConditionsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our delete `FormLogicCondition` mutation. */
export type DeleteFormLogicConditionPayloadFormLogicConditionEdgeArgs = {
  orderBy?: InputMaybe<Array<FormLogicConditionsOrderBy>>;
};

/** All input for the `deleteFormLogicRuleByNodeId` mutation. */
export type DeleteFormLogicRuleByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `FormLogicRule` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteFormLogicRule` mutation. */
export type DeleteFormLogicRuleInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `FormLogicRule` mutation. */
export type DeleteFormLogicRulePayload = {
  __typename?: 'DeleteFormLogicRulePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedFormLogicRuleNodeId?: Maybe<Scalars['ID']>;
  /** The `FormLogicRule` that was deleted by this mutation. */
  formLogicRule?: Maybe<FormLogicRule>;
  /** An edge for our `FormLogicRule`. May be used by Relay 1. */
  formLogicRuleEdge?: Maybe<FormLogicRulesEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our delete `FormLogicRule` mutation. */
export type DeleteFormLogicRulePayloadFormLogicRuleEdgeArgs = {
  orderBy?: InputMaybe<Array<FormLogicRulesOrderBy>>;
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
  orderBy?: InputMaybe<Array<FormsOrderBy>>;
};

/** All input for the `deleteForumByNodeId` mutation. */
export type DeleteForumByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Forum` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteForum` mutation. */
export type DeleteForumInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  orderBy?: InputMaybe<Array<ForumsOrderBy>>;
};

/** All input for the `deleteGroupByNodeId` mutation. */
export type DeleteGroupByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Group` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteGroupByProjectIdAndName` mutation. */
export type DeleteGroupByProjectIdAndNameInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
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

/** All input for the `deleteOptionalBasemapLayerByNodeId` mutation. */
export type DeleteOptionalBasemapLayerByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `OptionalBasemapLayer` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteOptionalBasemapLayer` mutation. */
export type DeleteOptionalBasemapLayerInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `OptionalBasemapLayer` mutation. */
export type DeleteOptionalBasemapLayerPayload = {
  __typename?: 'DeleteOptionalBasemapLayerPayload';
  /** Reads a single `Basemap` that is related to this `OptionalBasemapLayer`. */
  basemap?: Maybe<Basemap>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedOptionalBasemapLayerNodeId?: Maybe<Scalars['ID']>;
  /** The `OptionalBasemapLayer` that was deleted by this mutation. */
  optionalBasemapLayer?: Maybe<OptionalBasemapLayer>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `deletePostByNodeId` mutation. */
export type DeletePostByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Post` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deletePost` mutation. */
export type DeletePostInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  orderBy?: InputMaybe<Array<PostsOrderBy>>;
};

/** All input for the `deleteProject` mutation. */
export type DeleteProjectInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  projectId: Scalars['Int'];
};

/** All input for the `deleteProjectInviteByEmailAndProjectId` mutation. */
export type DeleteProjectInviteByEmailAndProjectIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `ProjectInvite` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteProjectInviteGroupByInviteIdAndGroupId` mutation. */
export type DeleteProjectInviteGroupByInviteIdAndGroupIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  /** Reads a single `Group` that is related to this `ProjectInviteGroup`. */
  group?: Maybe<Group>;
  /** Reads a single `ProjectInvite` that is related to this `ProjectInviteGroup`. */
  invite?: Maybe<ProjectInvite>;
  /** The `ProjectInviteGroup` that was deleted by this mutation. */
  projectInviteGroup?: Maybe<ProjectInviteGroup>;
  /** An edge for our `ProjectInviteGroup`. May be used by Relay 1. */
  projectInviteGroupEdge?: Maybe<ProjectInviteGroupsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our delete `ProjectInviteGroup` mutation. */
export type DeleteProjectInviteGroupPayloadProjectInviteGroupEdgeArgs = {
  orderBy?: InputMaybe<Array<ProjectInviteGroupsOrderBy>>;
};

/** All input for the `deleteProjectInvite` mutation. */
export type DeleteProjectInviteInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  /** Reads a single `DataSourcesBucket` that is related to this `Project`. */
  dataSourcesBucket?: Maybe<DataSourcesBucket>;
  project?: Maybe<Project>;
  /** An edge for our `Project`. May be used by Relay 1. */
  projectEdge?: Maybe<ProjectsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `deleteProject` mutation. */
export type DeleteProjectPayloadProjectEdgeArgs = {
  orderBy?: InputMaybe<Array<ProjectsOrderBy>>;
};

/** All input for the `deleteProjectsSharedBasemapByBasemapIdAndProjectId` mutation. */
export type DeleteProjectsSharedBasemapByBasemapIdAndProjectIdInput = {
  basemapId: Scalars['Int'];
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  projectId: Scalars['Int'];
};

/** The output of our delete `ProjectsSharedBasemap` mutation. */
export type DeleteProjectsSharedBasemapPayload = {
  __typename?: 'DeleteProjectsSharedBasemapPayload';
  /** Reads a single `Basemap` that is related to this `ProjectsSharedBasemap`. */
  basemap?: Maybe<Basemap>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedProjectsSharedBasemapNodeId?: Maybe<Scalars['ID']>;
  /** The `ProjectsSharedBasemap` that was deleted by this mutation. */
  projectsSharedBasemap?: Maybe<ProjectsSharedBasemap>;
  /** An edge for our `ProjectsSharedBasemap`. May be used by Relay 1. */
  projectsSharedBasemapEdge?: Maybe<ProjectsSharedBasemapsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our delete `ProjectsSharedBasemap` mutation. */
export type DeleteProjectsSharedBasemapPayloadProjectsSharedBasemapEdgeArgs = {
  orderBy?: InputMaybe<Array<ProjectsSharedBasemapsOrderBy>>;
};

/** All input for the `deleteSketchByNodeId` mutation. */
export type DeleteSketchByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Sketch` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteSketchClassByFormElementId` mutation. */
export type DeleteSketchClassByFormElementIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** If set, this sketch class is only for use in a survey indicated by the form_element. */
  formElementId: Scalars['Int'];
};

/** All input for the `deleteSketchClassByNodeId` mutation. */
export type DeleteSketchClassByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `SketchClass` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteSketchClass` mutation. */
export type DeleteSketchClassInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  /** Reads a single `FormElement` that is related to this `SketchClass`. */
  formElement?: Maybe<FormElement>;
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
  orderBy?: InputMaybe<Array<SketchClassesOrderBy>>;
};

/** All input for the `deleteSketchFolderByNodeId` mutation. */
export type DeleteSketchFolderByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `SketchFolder` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteSketchFolder` mutation. */
export type DeleteSketchFolderInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  orderBy?: InputMaybe<Array<SketchFoldersOrderBy>>;
};

/** All input for the `deleteSketch` mutation. */
export type DeleteSketchInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  /** Reads a single `FormElement` that is related to this `Sketch`. */
  formElement?: Maybe<FormElement>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Survey` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteSurvey` mutation. */
export type DeleteSurveyInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** All input for the `deleteSurveyInviteByEmailAndSurveyId` mutation. */
export type DeleteSurveyInviteByEmailAndSurveyIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  email: Scalars['Email'];
  surveyId: Scalars['Int'];
};

/** All input for the `deleteSurveyInviteByEmail` mutation. */
export type DeleteSurveyInviteByEmailInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  email: Scalars['Email'];
};

/** All input for the `deleteSurveyInviteByNodeId` mutation. */
export type DeleteSurveyInviteByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `SurveyInvite` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteSurveyInvite` mutation. */
export type DeleteSurveyInviteInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  orderBy?: InputMaybe<Array<SurveyInvitesOrderBy>>;
};

/** All input for the `deleteSurveyInvitedGroupBySurveyIdAndGroupId` mutation. */
export type DeleteSurveyInvitedGroupBySurveyIdAndGroupIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `SurveyResponse` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteSurveyResponse` mutation. */
export type DeleteSurveyResponseInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  orderBy?: InputMaybe<Array<SurveyResponsesOrderBy>>;
};

/** All input for the `deleteTableOfContentsBranch` mutation. */
export type DeleteTableOfContentsBranchInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  tableOfContentsItemId?: InputMaybe<Scalars['Int']>;
};

/** The output of our `deleteTableOfContentsBranch` mutation. */
export type DeleteTableOfContentsBranchPayload = {
  __typename?: 'DeleteTableOfContentsBranchPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `deleteTopicByNodeId` mutation. */
export type DeleteTopicByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Topic` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteTopic` mutation. */
export type DeleteTopicInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  orderBy?: InputMaybe<Array<TopicsOrderBy>>;
};

/** All input for the `disableForumPosting` mutation. */
export type DisableForumPostingInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  projectId?: InputMaybe<Scalars['Int']>;
  userId?: InputMaybe<Scalars['Int']>;
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
  userId?: InputMaybe<Scalars['Int']>;
};

/** Represents an update to a `EmailNotificationPreference`. Fields that are set will be updated. */
export type EmailNotificationPreferencePatch = {
  /** How often users should be notified of SeaSketch project activity. */
  frequency?: InputMaybe<EmailSummaryFrequency>;
  /**
   * If set, users should receive realtime notifications of responses to discussion
   * forum threads for which they are a participant.
   */
  notifyOnReply?: InputMaybe<Scalars['Boolean']>;
  /**
   * If selected, users should receive absolutely no email from SeaSketch. Invite
   * emails should not be sent and their status should be set to UNSUBSCRIBED.
   */
  unsubscribeAll?: InputMaybe<Scalars['Boolean']>;
  userId?: InputMaybe<Scalars['Int']>;
};

/** A connection to a list of `EmailNotificationPreference` values. */
export type EmailNotificationPreferencesConnection = {
  __typename?: 'EmailNotificationPreferencesConnection';
  /** A list of edges which contains the `EmailNotificationPreference` and cursor to aid in pagination. */
  edges: Array<EmailNotificationPreferencesEdge>;
  /** A list of `EmailNotificationPreference` objects. */
  nodes: Array<EmailNotificationPreference>;
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
  node: EmailNotificationPreference;
};

/** Methods to use when ordering `EmailNotificationPreference`. */
export enum EmailNotificationPreferencesOrderBy {
  Natural = 'NATURAL',
  UserIdAsc = 'USER_ID_ASC',
  UserIdDesc = 'USER_ID_DESC'
}

export enum EmailStatus {
  Bounced = 'BOUNCED',
  Complaint = 'COMPLAINT',
  Delivered = 'DELIVERED',
  Error = 'ERROR',
  Queued = 'QUEUED',
  Sent = 'SENT',
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
  clientMutationId?: InputMaybe<Scalars['String']>;
  projectId?: InputMaybe<Scalars['Int']>;
  userId?: InputMaybe<Scalars['Int']>;
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
  Contains = 'CONTAINS',
  Equal = 'EQUAL',
  GreaterThan = 'GREATER_THAN',
  IsBlank = 'IS_BLANK',
  LessThan = 'LESS_THAN',
  NotEqual = 'NOT_EQUAL'
}

/**
 * Custom user-input Forms are used in two places in SeaSketch. For SketchClasses,
 * Forms are used to add attributes to spatial features. In Surveys, Forms are used
 * in support of gathering response data.
 *
 * Forms have any number of *FormElements* ordered by a `position` field, and form
 * contents may be hidden depending on the evaluation of *FormConditionalRenderingRules*.
 *
 * Forms typically belong to either a *Survey* or *SketchClass* exclusively. Some
 * Forms may be designated as a template, in which case they belong to neither.
 * Only superusers can create form templates, and clients should provide templates
 * as an option when creating new forms.
 */
export type Form = Node & {
  __typename?: 'Form';
  /** Lists FormElements in order for rendering */
  formElements?: Maybe<Array<FormElement>>;
  id: Scalars['Int'];
  /**
   * SeaSetch superusers can create template forms than can be used when creating
   * SketchClasses or Surveys. These templates can be created using the
   * `createFormTemplateFromSketchClass` and `createFormTemplateFromSurvey`
   * mutations. Template forms can be listed with the root-level `templateForms`
   * query.
   */
  isTemplate: Scalars['Boolean'];
  /** Reads and enables pagination through a set of `FormLogicRule`. */
  logicRules?: Maybe<Array<FormLogicRule>>;
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
 * Forms have any number of *FormElements* ordered by a `position` field, and form
 * contents may be hidden depending on the evaluation of *FormConditionalRenderingRules*.
 *
 * Forms typically belong to either a *Survey* or *SketchClass* exclusively. Some
 * Forms may be designated as a template, in which case they belong to neither.
 * Only superusers can create form templates, and clients should provide templates
 * as an option when creating new forms.
 */
export type FormFormElementsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};


/**
 * Custom user-input Forms are used in two places in SeaSketch. For SketchClasses,
 * Forms are used to add attributes to spatial features. In Surveys, Forms are used
 * in support of gathering response data.
 *
 * Forms have any number of *FormElements* ordered by a `position` field, and form
 * contents may be hidden depending on the evaluation of *FormConditionalRenderingRules*.
 *
 * Forms typically belong to either a *Survey* or *SketchClass* exclusively. Some
 * Forms may be designated as a template, in which case they belong to neither.
 * Only superusers can create form templates, and clients should provide templates
 * as an option when creating new forms.
 */
export type FormLogicRulesArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};

/** A condition to be used against `Form` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type FormCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `isTemplate` field. */
  isTemplate?: InputMaybe<Scalars['Boolean']>;
  /** Checks for equality with the object’s `sketchClassId` field. */
  sketchClassId?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `surveyId` field. */
  surveyId?: InputMaybe<Scalars['Int']>;
};

/**
 * *FormElements* represent input fields or read-only content in a form. Records contain fields to support
 * generic functionality like body, position, and isRequired. They
 * also have a JSON `componentSettings` field that can have custom data to support
 * a particular input type, indicated by the `type` field.
 *
 * Project administrators have full control over managing form elements through
 * graphile-generated CRUD mutations.
 */
export type FormElement = Node & {
  __typename?: 'FormElement';
  alternateLanguageSettings: Scalars['JSON'];
  /** Optional background color to transition the form to when this element is displayed. */
  backgroundColor?: Maybe<Scalars['String']>;
  backgroundHeight?: Maybe<Scalars['Int']>;
  /** Optional background image to display when this form_element appears. */
  backgroundImage?: Maybe<Scalars['String']>;
  backgroundPalette?: Maybe<Array<Maybe<Scalars['String']>>>;
  backgroundWidth?: Maybe<Scalars['Int']>;
  /**
   * [prosemirror](https://prosemirror.net/) document representing a rich-text
   * question or informational content. Level 1 headers can be assumed to be the
   * question for input-type fields, though formatting is up to the project
   * administrators. Clients should provide a template that encourages this
   * convention when building forms.
   */
  body: Scalars['JSON'];
  /** Type-specific configuration. For example, a Choice field might have a list of valid choices. */
  componentSettings: Scalars['JSON'];
  createdAt: Scalars['Datetime'];
  /**
   * Column name used in csv export, property name in reporting tools. Keep stable
   * to avoid breaking reports. If null, this value will be dynamically generated
   * from the first several characters of the text in FormElement.body.
   */
  exportId?: Maybe<Scalars['String']>;
  /** Form this field belongs to. */
  formId: Scalars['Int'];
  id: Scalars['Int'];
  isInput?: Maybe<Scalars['Boolean']>;
  /** Users must provide input for these fields before submission. */
  isRequired: Scalars['Boolean'];
  /**
   * Used only in surveys. If set, the survey will advance to the page of the
   * specified form element. If null, the survey will simply advance to the next
   * question in the list by `position`.
   */
  jumpToId?: Maybe<Scalars['Int']>;
  /** Layout of image in relation to form_element content. */
  layout?: Maybe<FormElementLayout>;
  /** IDs for basemaps that should be included in the map view if a map layout is selected */
  mapBasemaps?: Maybe<Array<Maybe<Scalars['Int']>>>;
  /**
   * If using a map-based layout, can be used to set the default starting point of the map
   *
   * See https://docs.mapbox.com/mapbox-gl-js/api/properties/#cameraoptions
   * ```json
   * {
   *   "center": [-73.5804, 45.53483],
   *   "pitch": 60,
   *   "bearing": -60,
   *   "zoom": 10
   * }
   * ```
   */
  mapCameraOptions?: Maybe<Scalars['JSON']>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /**
   * Determines order of field display. Clients should display fields in ascending
   * order. Cannot be changed individually. Use `setFormElementOrder()` mutation to
   * update.
   */
  position: Scalars['Int'];
  /** Color used to style navigation controls */
  secondaryColor?: Maybe<Scalars['String']>;
  /** Sketch Class to be used in conjuction with a form element that supports spatial feature input. */
  sketchClass?: Maybe<SketchClass>;
  /** Reads a single `SketchClass` that is related to this `FormElement`. */
  sketchClassFk?: Maybe<SketchClass>;
  /**
   * Used for special elements like SpatialAccessPriorityInput to create a sort of
   * sub-form that the parent element controls the rendering of. Will not appear in
   * the form unless the client implementation utilizes something like
   * FormElement.shouldDisplaySubordinateElement to control visibility.
   */
  subordinateTo?: Maybe<Scalars['Int']>;
  /** Reads and enables pagination through a set of `SurveyConsentDocument`. */
  surveyConsentDocumentsConnection: SurveyConsentDocumentsConnection;
  /**
   * Indicates whether the form element should be displayed with dark or light text
   * variants to match the background color. Admin interface should automatically
   * set this value based on `background_color`, though admins may wish to manually override.
   */
  textVariant: FormElementTextVariant;
  type?: Maybe<FormElementType>;
  typeId: Scalars['String'];
  unsplashAuthorName?: Maybe<Scalars['String']>;
  unsplashAuthorUrl?: Maybe<Scalars['String']>;
};


/**
 * *FormElements* represent input fields or read-only content in a form. Records contain fields to support
 * generic functionality like body, position, and isRequired. They
 * also have a JSON `componentSettings` field that can have custom data to support
 * a particular input type, indicated by the `type` field.
 *
 * Project administrators have full control over managing form elements through
 * graphile-generated CRUD mutations.
 */
export type FormElementSurveyConsentDocumentsConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<SurveyConsentDocumentCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<SurveyConsentDocumentsOrderBy>>;
};

/** An input for mutations affecting `FormElement` */
export type FormElementInput = {
  alternateLanguageSettings?: InputMaybe<Scalars['JSON']>;
  /** Optional background color to transition the form to when this element is displayed. */
  backgroundColor?: InputMaybe<Scalars['String']>;
  backgroundHeight?: InputMaybe<Scalars['Int']>;
  backgroundPalette?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
  backgroundWidth?: InputMaybe<Scalars['Int']>;
  /**
   * [prosemirror](https://prosemirror.net/) document representing a rich-text
   * question or informational content. Level 1 headers can be assumed to be the
   * question for input-type fields, though formatting is up to the project
   * administrators. Clients should provide a template that encourages this
   * convention when building forms.
   */
  body: Scalars['JSON'];
  /** Type-specific configuration. For example, a Choice field might have a list of valid choices. */
  componentSettings?: InputMaybe<Scalars['JSON']>;
  createdAt?: InputMaybe<Scalars['Datetime']>;
  /**
   * Column name used in csv export, property name in reporting tools. Keep stable
   * to avoid breaking reports. If null, this value will be dynamically generated
   * from the first several characters of the text in FormElement.body.
   */
  exportId?: InputMaybe<Scalars['String']>;
  /** Form this field belongs to. */
  formId: Scalars['Int'];
  id?: InputMaybe<Scalars['Int']>;
  /** Users must provide input for these fields before submission. */
  isRequired?: InputMaybe<Scalars['Boolean']>;
  /**
   * Used only in surveys. If set, the survey will advance to the page of the
   * specified form element. If null, the survey will simply advance to the next
   * question in the list by `position`.
   */
  jumpToId?: InputMaybe<Scalars['Int']>;
  /** Layout of image in relation to form_element content. */
  layout?: InputMaybe<FormElementLayout>;
  /** IDs for basemaps that should be included in the map view if a map layout is selected */
  mapBasemaps?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
  /**
   * If using a map-based layout, can be used to set the default starting point of the map
   *
   * See https://docs.mapbox.com/mapbox-gl-js/api/properties/#cameraoptions
   * ```json
   * {
   *   "center": [-73.5804, 45.53483],
   *   "pitch": 60,
   *   "bearing": -60,
   *   "zoom": 10
   * }
   * ```
   */
  mapCameraOptions?: InputMaybe<Scalars['JSON']>;
  /**
   * Determines order of field display. Clients should display fields in ascending
   * order. Cannot be changed individually. Use `setFormElementOrder()` mutation to
   * update.
   */
  position?: InputMaybe<Scalars['Int']>;
  /** Color used to style navigation controls */
  secondaryColor?: InputMaybe<Scalars['String']>;
  /**
   * Used for special elements like SpatialAccessPriorityInput to create a sort of
   * sub-form that the parent element controls the rendering of. Will not appear in
   * the form unless the client implementation utilizes something like
   * FormElement.shouldDisplaySubordinateElement to control visibility.
   */
  subordinateTo?: InputMaybe<Scalars['Int']>;
  /**
   * Indicates whether the form element should be displayed with dark or light text
   * variants to match the background color. Admin interface should automatically
   * set this value based on `background_color`, though admins may wish to manually override.
   */
  textVariant?: InputMaybe<FormElementTextVariant>;
  typeId: Scalars['String'];
};

export enum FormElementLayout {
  Cover = 'COVER',
  Left = 'LEFT',
  MapFullscreen = 'MAP_FULLSCREEN',
  MapSidebarLeft = 'MAP_SIDEBAR_LEFT',
  MapSidebarRight = 'MAP_SIDEBAR_RIGHT',
  MapStacked = 'MAP_STACKED',
  MapTop = 'MAP_TOP',
  Right = 'RIGHT',
  Top = 'TOP'
}

/** Represents an update to a `FormElement`. Fields that are set will be updated. */
export type FormElementPatch = {
  alternateLanguageSettings?: InputMaybe<Scalars['JSON']>;
  /** Optional background color to transition the form to when this element is displayed. */
  backgroundColor?: InputMaybe<Scalars['String']>;
  backgroundHeight?: InputMaybe<Scalars['Int']>;
  backgroundPalette?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
  backgroundWidth?: InputMaybe<Scalars['Int']>;
  /**
   * [prosemirror](https://prosemirror.net/) document representing a rich-text
   * question or informational content. Level 1 headers can be assumed to be the
   * question for input-type fields, though formatting is up to the project
   * administrators. Clients should provide a template that encourages this
   * convention when building forms.
   */
  body?: InputMaybe<Scalars['JSON']>;
  /** Type-specific configuration. For example, a Choice field might have a list of valid choices. */
  componentSettings?: InputMaybe<Scalars['JSON']>;
  createdAt?: InputMaybe<Scalars['Datetime']>;
  /**
   * Column name used in csv export, property name in reporting tools. Keep stable
   * to avoid breaking reports. If null, this value will be dynamically generated
   * from the first several characters of the text in FormElement.body.
   */
  exportId?: InputMaybe<Scalars['String']>;
  /** Form this field belongs to. */
  formId?: InputMaybe<Scalars['Int']>;
  id?: InputMaybe<Scalars['Int']>;
  /** Users must provide input for these fields before submission. */
  isRequired?: InputMaybe<Scalars['Boolean']>;
  /**
   * Used only in surveys. If set, the survey will advance to the page of the
   * specified form element. If null, the survey will simply advance to the next
   * question in the list by `position`.
   */
  jumpToId?: InputMaybe<Scalars['Int']>;
  /** Layout of image in relation to form_element content. */
  layout?: InputMaybe<FormElementLayout>;
  /** IDs for basemaps that should be included in the map view if a map layout is selected */
  mapBasemaps?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
  /**
   * If using a map-based layout, can be used to set the default starting point of the map
   *
   * See https://docs.mapbox.com/mapbox-gl-js/api/properties/#cameraoptions
   * ```json
   * {
   *   "center": [-73.5804, 45.53483],
   *   "pitch": 60,
   *   "bearing": -60,
   *   "zoom": 10
   * }
   * ```
   */
  mapCameraOptions?: InputMaybe<Scalars['JSON']>;
  /**
   * Determines order of field display. Clients should display fields in ascending
   * order. Cannot be changed individually. Use `setFormElementOrder()` mutation to
   * update.
   */
  position?: InputMaybe<Scalars['Int']>;
  /** Color used to style navigation controls */
  secondaryColor?: InputMaybe<Scalars['String']>;
  /**
   * Used for special elements like SpatialAccessPriorityInput to create a sort of
   * sub-form that the parent element controls the rendering of. Will not appear in
   * the form unless the client implementation utilizes something like
   * FormElement.shouldDisplaySubordinateElement to control visibility.
   */
  subordinateTo?: InputMaybe<Scalars['Int']>;
  /**
   * Indicates whether the form element should be displayed with dark or light text
   * variants to match the background color. Admin interface should automatically
   * set this value based on `background_color`, though admins may wish to manually override.
   */
  textVariant?: InputMaybe<FormElementTextVariant>;
  typeId?: InputMaybe<Scalars['String']>;
};

export enum FormElementTextVariant {
  Dark = 'DARK',
  Dynamic = 'DYNAMIC',
  Light = 'LIGHT'
}

/** Identifies the type of element in a form, including metadata about that element type. */
export type FormElementType = Node & {
  __typename?: 'FormElementType';
  allowAdminUpdates: Scalars['Boolean'];
  allowedLayouts?: Maybe<Array<Maybe<FormElementLayout>>>;
  componentName: Scalars['String'];
  isHidden: Scalars['Boolean'];
  /**
   * Whether the element is an input that collects information from users or
   * contains presentational content like a Welcome Message component.
   */
  isInput: Scalars['Boolean'];
  isRequiredForSketchClasses: Scalars['Boolean'];
  isRequiredForSurveys: Scalars['Boolean'];
  /** These elements can only be added to a form once. */
  isSingleUseOnly: Scalars['Boolean'];
  /**
   * Indicates if the element type is a spatial data input. Components that
   * implement these types are expected to render their own map (in contrast with
   * elements that simply have their layout set to MAP_SIDEBAR_RIGHT|LEFT, which
   * expect the SurveyApp component to render a map for them.
   */
  isSpatial: Scalars['Boolean'];
  /** If true, the element type should only be added to forms related to a survey. */
  isSurveysOnly: Scalars['Boolean'];
  /**
   * Control form element deployment with feature-flags. If this flag is enabled,
   * the form element should only appear as an option for addition to superuser
   * roles. Once added to a form however, it is visible to all users. No
   * access-control is enforced other than hiding the option in the client.
   */
  label: Scalars['String'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  sketchClassTemplateId?: Maybe<Scalars['Int']>;
  supportedOperators: Array<Maybe<FieldRuleOperator>>;
};

/**
 * A condition to be used against `FormElementType` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type FormElementTypeCondition = {
  /** Checks for equality with the object’s `componentName` field. */
  componentName?: InputMaybe<Scalars['String']>;
  /** Checks for equality with the object’s `label` field. */
  label?: InputMaybe<Scalars['String']>;
};

/** Methods to use when ordering `FormElementType`. */
export enum FormElementTypesOrderBy {
  ComponentNameAsc = 'COMPONENT_NAME_ASC',
  ComponentNameDesc = 'COMPONENT_NAME_DESC',
  LabelAsc = 'LABEL_ASC',
  LabelDesc = 'LABEL_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

/** A `FormElement` edge in the connection. */
export type FormElementsEdge = {
  __typename?: 'FormElementsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `FormElement` at the end of the edge. */
  node: FormElement;
};

/** Methods to use when ordering `FormElement`. */
export enum FormElementsOrderBy {
  FormIdAsc = 'FORM_ID_ASC',
  FormIdDesc = 'FORM_ID_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  MapBasemapsAsc = 'MAP_BASEMAPS_ASC',
  MapBasemapsDesc = 'MAP_BASEMAPS_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

export enum FormLogicCommand {
  Hide = 'HIDE',
  Jump = 'JUMP',
  Show = 'SHOW'
}

/**
 * Conditions are nested within FormLogicRules. In many cases there may be
 * only a single condition, but in others the FormLogicRule.booleanOperator
 * property defines how they are applied.
 */
export type FormLogicCondition = Node & {
  __typename?: 'FormLogicCondition';
  id: Scalars['Int'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  operator: FieldRuleOperator;
  ruleId: Scalars['Int'];
  subjectId: Scalars['Int'];
  value?: Maybe<Scalars['JSON']>;
};

/** An input for mutations affecting `FormLogicCondition` */
export type FormLogicConditionInput = {
  id?: InputMaybe<Scalars['Int']>;
  operator?: InputMaybe<FieldRuleOperator>;
  ruleId: Scalars['Int'];
  subjectId: Scalars['Int'];
  value?: InputMaybe<Scalars['JSON']>;
};

/** Represents an update to a `FormLogicCondition`. Fields that are set will be updated. */
export type FormLogicConditionPatch = {
  id?: InputMaybe<Scalars['Int']>;
  operator?: InputMaybe<FieldRuleOperator>;
  ruleId?: InputMaybe<Scalars['Int']>;
  subjectId?: InputMaybe<Scalars['Int']>;
  value?: InputMaybe<Scalars['JSON']>;
};

/** A `FormLogicCondition` edge in the connection. */
export type FormLogicConditionsEdge = {
  __typename?: 'FormLogicConditionsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `FormLogicCondition` at the end of the edge. */
  node: FormLogicCondition;
};

/** Methods to use when ordering `FormLogicCondition`. */
export enum FormLogicConditionsOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

export enum FormLogicOperator {
  And = 'AND',
  Or = 'OR'
}

/**
 * Form logic rules can be used to hide or show FormElements based on the values of
 * preceeding fields in a SketchClass. They can also define page jump logic within a Survey.
 */
export type FormLogicRule = Node & {
  __typename?: 'FormLogicRule';
  booleanOperator: FormLogicOperator;
  command: FormLogicCommand;
  /** Reads and enables pagination through a set of `FormLogicCondition`. */
  conditions?: Maybe<Array<FormLogicCondition>>;
  formElementId: Scalars['Int'];
  id: Scalars['Int'];
  jumpToId?: Maybe<Scalars['Int']>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  position: Scalars['Int'];
};


/**
 * Form logic rules can be used to hide or show FormElements based on the values of
 * preceeding fields in a SketchClass. They can also define page jump logic within a Survey.
 */
export type FormLogicRuleConditionsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};

/** An input for mutations affecting `FormLogicRule` */
export type FormLogicRuleInput = {
  booleanOperator?: InputMaybe<FormLogicOperator>;
  command: FormLogicCommand;
  formElementId: Scalars['Int'];
  id?: InputMaybe<Scalars['Int']>;
  jumpToId?: InputMaybe<Scalars['Int']>;
  position: Scalars['Int'];
};

/** Represents an update to a `FormLogicRule`. Fields that are set will be updated. */
export type FormLogicRulePatch = {
  booleanOperator?: InputMaybe<FormLogicOperator>;
  command?: InputMaybe<FormLogicCommand>;
  formElementId?: InputMaybe<Scalars['Int']>;
  id?: InputMaybe<Scalars['Int']>;
  jumpToId?: InputMaybe<Scalars['Int']>;
  position?: InputMaybe<Scalars['Int']>;
};

/** A `FormLogicRule` edge in the connection. */
export type FormLogicRulesEdge = {
  __typename?: 'FormLogicRulesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `FormLogicRule` at the end of the edge. */
  node: FormLogicRule;
};

/** Methods to use when ordering `FormLogicRule`. */
export enum FormLogicRulesOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

/** Represents an update to a `Form`. Fields that are set will be updated. */
export type FormPatch = {
  id?: InputMaybe<Scalars['Int']>;
  /**
   * SeaSetch superusers can create template forms than can be used when creating
   * SketchClasses or Surveys. These templates can be created using the
   * `createFormTemplateFromSketchClass` and `createFormTemplateFromSurvey`
   * mutations. Template forms can be listed with the root-level `templateForms`
   * query.
   */
  isTemplate?: InputMaybe<Scalars['Boolean']>;
  /** Related *SketchClass* */
  sketchClassId?: InputMaybe<Scalars['Int']>;
  /** Related *Survey* */
  surveyId?: InputMaybe<Scalars['Int']>;
  /** Chosen by superusers upon template creation */
  templateName?: InputMaybe<Scalars['String']>;
  /** Indicates which features should use this form as a template */
  templateType?: InputMaybe<FormTemplateType>;
};

/** Indicates which features should use the form as a template */
export enum FormTemplateType {
  Sketches = 'SKETCHES',
  Surveys = 'SURVEYS',
  SurveysAndSketches = 'SURVEYS_AND_SKETCHES'
}

/** A connection to a list of `Form` values. */
export type FormsConnection = {
  __typename?: 'FormsConnection';
  /** A list of edges which contains the `Form` and cursor to aid in pagination. */
  edges: Array<FormsEdge>;
  /** A list of `Form` objects. */
  nodes: Array<Form>;
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
  node: Form;
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
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<TopicCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<TopicsOrderBy>>;
};

/** A condition to be used against `Forum` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type ForumCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `projectId` field. */
  projectId?: InputMaybe<Scalars['Int']>;
};

/** An input for mutations affecting `Forum` */
export type ForumInput = {
  /**
   * Archived forums will only be accessible by project administrators from the
   * admin dashboard. This is an alternative to deleting a forum.
   */
  archived?: InputMaybe<Scalars['Boolean']>;
  /** Optional description of the forum to be displayed to project users. */
  description?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['Int']>;
  /** Title displayed for the forum. */
  name: Scalars['String'];
  /**
   * Sets position of this forum in the listing. Forums should be listed by
   * position in ascending order. Set using `setForumOrder()`
   */
  position?: InputMaybe<Scalars['Int']>;
  projectId: Scalars['Int'];
};

/** Represents an update to a `Forum`. Fields that are set will be updated. */
export type ForumPatch = {
  /**
   * Archived forums will only be accessible by project administrators from the
   * admin dashboard. This is an alternative to deleting a forum.
   */
  archived?: InputMaybe<Scalars['Boolean']>;
  /** Optional description of the forum to be displayed to project users. */
  description?: InputMaybe<Scalars['String']>;
  /** Title displayed for the forum. */
  name?: InputMaybe<Scalars['String']>;
  /**
   * Sets position of this forum in the listing. Forums should be listed by
   * position in ascending order. Set using `setForumOrder()`
   */
  position?: InputMaybe<Scalars['Int']>;
};

/** A `Forum` edge in the connection. */
export type ForumsEdge = {
  __typename?: 'ForumsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `Forum` at the end of the edge. */
  node: Forum;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
  projectId?: InputMaybe<Scalars['Int']>;
  userId?: InputMaybe<Scalars['Int']>;
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
  /** Reads and enables pagination through a set of `User`. */
  members?: Maybe<Array<User>>;
  /** Label for the group. */
  name: Scalars['String'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** Reads a single `Project` that is related to this `Group`. */
  project?: Maybe<Project>;
  projectId: Scalars['Int'];
  /** Reads and enables pagination through a set of `ProjectInviteGroup`. */
  projectInviteGroupsByGroupIdConnection: ProjectInviteGroupsConnection;
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
  direction?: InputMaybe<SortByDirection>;
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<ParticipantSortBy>;
};


/**
 * User groups designated by the project administrators. User groups can be used to
 * assign access control privileges to users.
 *
 * Note that only admins have access to groups, or direct knowlege of what groups a
 * user belongs to. If an admin wanted to create an *Assholes* group they are
 * free to do so.
 */
export type GroupProjectInviteGroupsByGroupIdConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<ProjectInviteGroupCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<ProjectInviteGroupsOrderBy>>;
};

/** An input for mutations affecting `Group` */
export type GroupInput = {
  id?: InputMaybe<Scalars['Int']>;
  /** Label for the group. */
  name: Scalars['String'];
  projectId: Scalars['Int'];
};

/** Represents an update to a `Group`. Fields that are set will be updated. */
export type GroupPatch = {
  id?: InputMaybe<Scalars['Int']>;
  /** Label for the group. */
  name?: InputMaybe<Scalars['String']>;
  projectId?: InputMaybe<Scalars['Int']>;
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

export type InteractivitySetting = Node & {
  __typename?: 'InteractivitySetting';
  /** Reads and enables pagination through a set of `Basemap`. */
  basemapsByInteractivitySettingsIdConnection: BasemapsConnection;
  cursor: CursorType;
  /** Reads a single `DataLayer` that is related to this `InteractivitySetting`. */
  dataLayerByInteractivitySettingsId?: Maybe<DataLayer>;
  /**
   * Reads and enables pagination through a set of `DataLayer`.
   * @deprecated Please use dataLayerByInteractivitySettingsId instead
   */
  dataLayersByInteractivitySettingsIdConnection: DataLayersConnection;
  id: Scalars['Int'];
  /** Used only for basemap interactivity settings. Optional list of layer ids that this setting applies to. */
  layers?: Maybe<Array<Maybe<Scalars['String']>>>;
  longTemplate?: Maybe<Scalars['String']>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  shortTemplate?: Maybe<Scalars['String']>;
  type: InteractivityType;
};


export type InteractivitySettingBasemapsByInteractivitySettingsIdConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<BasemapCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<BasemapsOrderBy>>;
};


export type InteractivitySettingDataLayersByInteractivitySettingsIdConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<DataLayerCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<DataLayersOrderBy>>;
};

/** An input for mutations affecting `InteractivitySetting` */
export type InteractivitySettingInput = {
  cursor?: InputMaybe<CursorType>;
  id?: InputMaybe<Scalars['Int']>;
  /** Used only for basemap interactivity settings. Optional list of layer ids that this setting applies to. */
  layers?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
  longTemplate?: InputMaybe<Scalars['String']>;
  shortTemplate?: InputMaybe<Scalars['String']>;
  type?: InputMaybe<InteractivityType>;
};

/** Represents an update to a `InteractivitySetting`. Fields that are set will be updated. */
export type InteractivitySettingPatch = {
  cursor?: InputMaybe<CursorType>;
  id?: InputMaybe<Scalars['Int']>;
  /** Used only for basemap interactivity settings. Optional list of layer ids that this setting applies to. */
  layers?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
  longTemplate?: InputMaybe<Scalars['String']>;
  shortTemplate?: InputMaybe<Scalars['String']>;
  type?: InputMaybe<InteractivityType>;
};

export enum InteractivityType {
  Banner = 'BANNER',
  FixedBlock = 'FIXED_BLOCK',
  None = 'NONE',
  Popup = 'POPUP',
  Tooltip = 'TOOLTIP'
}

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
  error?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
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
  toAddress: Scalars['Email'];
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
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `projectInviteId` field. */
  projectInviteId?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `status` field. */
  status?: InputMaybe<EmailStatus>;
  /** Checks for equality with the object’s `surveyInviteId` field. */
  surveyInviteId?: InputMaybe<Scalars['Int']>;
};

/** Methods to use when ordering `InviteEmail`. */
export enum InviteEmailsOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
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
  Bounced = 'BOUNCED',
  Complaint = 'COMPLAINT',
  Confirmed = 'CONFIRMED',
  Delivered = 'DELIVERED',
  Error = 'ERROR',
  Queued = 'QUEUED',
  Sent = 'SENT',
  SurveyInviteQueued = 'SURVEY_INVITE_QUEUED',
  SurveyInviteSent = 'SURVEY_INVITE_SENT',
  TokenExpired = 'TOKEN_EXPIRED',
  Unconfirmed = 'UNCONFIRMED',
  Unsent = 'UNSENT',
  Unsubscribed = 'UNSUBSCRIBED'
}

/** All input for the `joinProject` mutation. */
export type JoinProjectInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  projectId?: InputMaybe<Scalars['Int']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
  projectId?: InputMaybe<Scalars['Int']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
  responseId?: InputMaybe<Scalars['Int']>;
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
  orderBy?: InputMaybe<Array<SurveyResponsesOrderBy>>;
};

/** All input for the `makeResponsesNotPractice` mutation. */
export type MakeResponsesNotPracticeInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  ids?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
};

/** The output of our `makeResponsesNotPractice` mutation. */
export type MakeResponsesNotPracticePayload = {
  __typename?: 'MakeResponsesNotPracticePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  surveyResponses?: Maybe<Array<SurveyResponse>>;
};

/** All input for the `makeResponsesPractice` mutation. */
export type MakeResponsesPracticeInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  ids?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
};

/** The output of our `makeResponsesPractice` mutation. */
export type MakeResponsesPracticePayload = {
  __typename?: 'MakeResponsesPracticePayload';
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


/** The output of our `makeResponsesPractice` mutation. */
export type MakeResponsesPracticePayloadSurveyResponseEdgeArgs = {
  orderBy?: InputMaybe<Array<SurveyResponsesOrderBy>>;
};

/** All input for the `makeSketchClass` mutation. */
export type MakeSketchClassInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  name?: InputMaybe<Scalars['String']>;
  projectId?: InputMaybe<Scalars['Int']>;
  templateId?: InputMaybe<Scalars['Int']>;
};

/** The output of our `makeSketchClass` mutation. */
export type MakeSketchClassPayload = {
  __typename?: 'MakeSketchClassPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `FormElement` that is related to this `SketchClass`. */
  formElement?: Maybe<FormElement>;
  /** Reads a single `Project` that is related to this `SketchClass`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  sketchClass?: Maybe<SketchClass>;
  /** An edge for our `SketchClass`. May be used by Relay 1. */
  sketchClassEdge?: Maybe<SketchClassesEdge>;
};


/** The output of our `makeSketchClass` mutation. */
export type MakeSketchClassPayloadSketchClassEdgeArgs = {
  orderBy?: InputMaybe<Array<SketchClassesOrderBy>>;
};

/** All input for the `makeSurvey` mutation. */
export type MakeSurveyInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  name?: InputMaybe<Scalars['String']>;
  projectId?: InputMaybe<Scalars['Int']>;
  templateId?: InputMaybe<Scalars['Int']>;
};

/** The output of our `makeSurvey` mutation. */
export type MakeSurveyPayload = {
  __typename?: 'MakeSurveyPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `Project` that is related to this `Survey`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  survey?: Maybe<Survey>;
};

/** All input for the `markTopicAsRead` mutation. */
export type MarkTopicAsReadInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  topicId?: InputMaybe<Scalars['Int']>;
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

/** All input for the `modifySurveyAnswers` mutation. */
export type ModifySurveyAnswersInput = {
  answers?: InputMaybe<Scalars['JSON']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  responseIds?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
};

/** The output of our `modifySurveyAnswers` mutation. */
export type ModifySurveyAnswersPayload = {
  __typename?: 'ModifySurveyAnswersPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  surveyResponses?: Maybe<Array<SurveyResponse>>;
};

/** The root mutation type which contains root level fields which mutate data. */
export type Mutation = {
  __typename?: 'Mutation';
  /** Add a group to a given access control list. Must be an administrator. */
  addGroupToAcl?: Maybe<AddGroupToAclPayload>;
  addImageToSprite?: Maybe<Sprite>;
  /** Add the given user to a group. Must be an administrator of the project. */
  addUserToGroup?: Maybe<AddUserToGroupPayload>;
  /** Add a SketchClass to the list of valid children for a Collection-type SketchClass. */
  addValidChildSketchClass?: Maybe<AddValidChildSketchClassPayload>;
  /** For invite_only projects. Approve access request by a user. Must be an administrator of the project. */
  approveParticipant?: Maybe<ApproveParticipantPayload>;
  archiveResponses?: Maybe<ArchiveResponsesPayload>;
  clearFormElementStyle?: Maybe<ClearFormElementStylePayload>;
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
  /**
   * Copies appearance settings like layout and background_image from one form
   * element to another. Useful when initializing custom appearance on an element
   * from the defaults set by a previous question.
   */
  copyAppearance?: Maybe<CopyAppearancePayload>;
  /** Creates a single `Basemap`. */
  createBasemap?: Maybe<CreateBasemapPayload>;
  /** Creates a single `CommunityGuideline`. */
  createCommunityGuideline?: Maybe<CreateCommunityGuidelinePayload>;
  /** Creates a single `DataLayer`. */
  createDataLayer?: Maybe<CreateDataLayerPayload>;
  /** Creates a single `DataSource`. */
  createDataSource?: Maybe<CreateDataSourcePayload>;
  /** Creates a single `FormElement`. */
  createFormElement?: Maybe<CreateFormElementPayload>;
  /** Creates a single `FormLogicCondition`. */
  createFormLogicCondition?: Maybe<CreateFormLogicConditionPayload>;
  /** Creates a single `FormLogicRule`. */
  createFormLogicRule?: Maybe<CreateFormLogicRulePayload>;
  createFormTemplateFromSketchClass?: Maybe<CreateFormTemplateFromSketchClassPayload>;
  createFormTemplateFromSurvey?: Maybe<CreateFormTemplateFromSurveyPayload>;
  /** Creates a single `Forum`. */
  createForum?: Maybe<CreateForumPayload>;
  /** Creates a single `Group`. */
  createGroup?: Maybe<CreateGroupPayload>;
  /** Creates a single `InteractivitySetting`. */
  createInteractivitySetting?: Maybe<CreateInteractivitySettingPayload>;
  /** Creates a single `OptionalBasemapLayer`. */
  createOptionalBasemapLayer?: Maybe<CreateOptionalBasemapLayerPayload>;
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
  /** Creates a single `ProjectsSharedBasemap`. */
  createProjectsSharedBasemap?: Maybe<CreateProjectsSharedBasemapPayload>;
  /** Creates a single `Sketch`. */
  createSketch?: Maybe<CreateSketchPayload>;
  /** Creates a single `SketchFolder`. */
  createSketchFolder?: Maybe<CreateSketchFolderPayload>;
  /** Creates a single `SurveyInvitedGroup`. */
  createSurveyInvitedGroup?: Maybe<CreateSurveyInvitedGroupPayload>;
  createSurveyInvites?: Maybe<CreateSurveyInvitesPayload>;
  /** Initializes a new FormLogicRule with a single condition and command=JUMP. */
  createSurveyJumpRule?: Maybe<CreateSurveyJumpRulePayload>;
  createSurveyResponse?: Maybe<CreateSurveyResponsePayload>;
  /** Creates a single `TableOfContentsItem`. */
  createTableOfContentsItem?: Maybe<CreateTableOfContentsItemPayload>;
  /**
   * Must have write permission for the specified forum. Create a new discussion
   * topic, including the first post. `message` must be JSON, something like the
   * output of DraftJS.
   */
  createTopic?: Maybe<CreateTopicPayload>;
  /** Deletes a single `Basemap` using a unique key. */
  deleteBasemap?: Maybe<DeleteBasemapPayload>;
  /** Deletes a single `Basemap` using its globally unique id. */
  deleteBasemapByNodeId?: Maybe<DeleteBasemapPayload>;
  /** Deletes a single `CommunityGuideline` using a unique key. */
  deleteCommunityGuideline?: Maybe<DeleteCommunityGuidelinePayload>;
  /** Deletes a single `CommunityGuideline` using its globally unique id. */
  deleteCommunityGuidelineByNodeId?: Maybe<DeleteCommunityGuidelinePayload>;
  /** Deletes a single `DataLayer` using a unique key. */
  deleteDataLayer?: Maybe<DeleteDataLayerPayload>;
  /** Deletes a single `DataLayer` using a unique key. */
  deleteDataLayerByInteractivitySettingsId?: Maybe<DeleteDataLayerPayload>;
  /** Deletes a single `DataLayer` using its globally unique id. */
  deleteDataLayerByNodeId?: Maybe<DeleteDataLayerPayload>;
  /** Deletes a single `DataSource` using a unique key. */
  deleteDataSource?: Maybe<DeleteDataSourcePayload>;
  /** Deletes a single `DataSource` using its globally unique id. */
  deleteDataSourceByNodeId?: Maybe<DeleteDataSourcePayload>;
  /** Deletes a single `Form` using a unique key. */
  deleteForm?: Maybe<DeleteFormPayload>;
  /** Deletes a single `Form` using its globally unique id. */
  deleteFormByNodeId?: Maybe<DeleteFormPayload>;
  /** Deletes a single `Form` using a unique key. */
  deleteFormBySketchClassId?: Maybe<DeleteFormPayload>;
  /** Deletes a single `Form` using a unique key. */
  deleteFormBySurveyId?: Maybe<DeleteFormPayload>;
  /** Deletes a single `FormElement` using a unique key. */
  deleteFormElement?: Maybe<DeleteFormElementPayload>;
  /** Deletes a single `FormElement` using its globally unique id. */
  deleteFormElementByNodeId?: Maybe<DeleteFormElementPayload>;
  /** Deletes a single `FormLogicCondition` using a unique key. */
  deleteFormLogicCondition?: Maybe<DeleteFormLogicConditionPayload>;
  /** Deletes a single `FormLogicCondition` using its globally unique id. */
  deleteFormLogicConditionByNodeId?: Maybe<DeleteFormLogicConditionPayload>;
  /** Deletes a single `FormLogicRule` using a unique key. */
  deleteFormLogicRule?: Maybe<DeleteFormLogicRulePayload>;
  /** Deletes a single `FormLogicRule` using its globally unique id. */
  deleteFormLogicRuleByNodeId?: Maybe<DeleteFormLogicRulePayload>;
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
  /** Deletes a single `OptionalBasemapLayer` using a unique key. */
  deleteOptionalBasemapLayer?: Maybe<DeleteOptionalBasemapLayerPayload>;
  /** Deletes a single `OptionalBasemapLayer` using its globally unique id. */
  deleteOptionalBasemapLayerByNodeId?: Maybe<DeleteOptionalBasemapLayerPayload>;
  /** Deletes a single `Post` using a unique key. */
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
  /** Deletes a single `ProjectsSharedBasemap` using a unique key. */
  deleteProjectsSharedBasemapByBasemapIdAndProjectId?: Maybe<DeleteProjectsSharedBasemapPayload>;
  /** Deletes a single `Sketch` using a unique key. */
  deleteSketch?: Maybe<DeleteSketchPayload>;
  /** Deletes a single `Sketch` using its globally unique id. */
  deleteSketchByNodeId?: Maybe<DeleteSketchPayload>;
  /** Deletes a single `SketchClass` using a unique key. */
  deleteSketchClass?: Maybe<DeleteSketchClassPayload>;
  /** Deletes a single `SketchClass` using a unique key. */
  deleteSketchClassByFormElementId?: Maybe<DeleteSketchClassPayload>;
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
  /**
   * Deletes an item from the draft table of contents, as well as all child items
   * if it is a folder. This action will also delete all related layers and sources
   * (if no other layers reference the source).
   */
  deleteTableOfContentsBranch?: Maybe<DeleteTableOfContentsBranchPayload>;
  /** Deletes a single `Topic` using a unique key. */
  deleteTopic?: Maybe<DeleteTopicPayload>;
  /** Deletes a single `Topic` using its globally unique id. */
  deleteTopicByNodeId?: Maybe<DeleteTopicPayload>;
  /** Ban a user from posting in the discussion forum */
  disableForumPosting?: Maybe<DisableForumPostingPayload>;
  /** Re-enable discussion forum posting for a user that was previously banned. */
  enableForumPosting?: Maybe<EnableForumPostingPayload>;
  /**
   * Use to create new sprites. If an existing sprite in the database for this
   * project has a matching md5 hash no new Sprite will be created.
   */
  getOrCreateSprite?: Maybe<Sprite>;
  /** Give a user admin access to a project. User must have already joined the project and shared their user profile. */
  grantAdminAccess?: Maybe<GrantAdminAccessPayload>;
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
  makeResponsesNotPractice?: Maybe<MakeResponsesNotPracticePayload>;
  makeResponsesPractice?: Maybe<MakeResponsesPracticePayload>;
  makeSketchClass?: Maybe<MakeSketchClassPayload>;
  makeSurvey?: Maybe<MakeSurveyPayload>;
  /**
   * Mark the topic as read by the current session user. Used to avoid sending email
   * notifications to users who have already read a topic. Call when loading a topic,
   * and whenever new posts are shown.
   */
  markTopicAsRead?: Maybe<MarkTopicAsReadPayload>;
  modifySurveyAnswers?: Maybe<ModifySurveyAnswersPayload>;
  /**
   * Copies all table of contents items, related layers, sources, and access
   * control lists to create a new table of contents that will be displayed to project users.
   */
  publishTableOfContents?: Maybe<PublishTableOfContentsPayload>;
  /** Remove a group from a given access control list. Must be an administrator. */
  removeGroupFromAcl?: Maybe<RemoveGroupFromAclPayload>;
  /** Remove the given user from a group. Must be an administrator of the project. */
  removeUserFromGroup?: Maybe<RemoveUserFromGroupPayload>;
  /** Remove a SketchClass from the list of valid children for a Collection. */
  removeValidChildSketchClass?: Maybe<RemoveValidChildSketchClassPayload>;
  /**
   * Re-sends an email verification link to the canonical email for the
   * current user session
   */
  resendVerificationEmail: SendVerificationEmailResults;
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
  setFormElementBackground: FormElement;
  /**
   * Sets the positions of all elements in a form at once. Any missing element ids from
   * the input will be positioned at the end of the form.
   *
   * Use this instead of trying to manage the position of form elements individually.
   */
  setFormElementOrder?: Maybe<SetFormElementOrderPayload>;
  setFormLogicRuleOrder?: Maybe<SetFormLogicRuleOrderPayload>;
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
  /**
   * Sets the list of groups that the given user belongs to. Will clear all other
   * group memberships in the project. Available only to admins.
   */
  setUserGroups?: Maybe<SetUserGroupsPayload>;
  /**
   * Toggle admin access for the given project and user. User must have already
   * joined the project and shared their user profile.
   */
  toggleAdminAccess?: Maybe<ToggleAdminAccessPayload>;
  /** Ban a user from posting in the discussion forum */
  toggleForumPostingBan?: Maybe<ToggleForumPostingBanPayload>;
  toggleResponsesPractice?: Maybe<ToggleResponsesPracticePayload>;
  /** Updates a single `Acl` using a unique key and a patch. */
  updateAcl?: Maybe<UpdateAclPayload>;
  /** Updates a single `Acl` using a unique key and a patch. */
  updateAclByBasemapId?: Maybe<UpdateAclPayload>;
  /** Updates a single `Acl` using its globally unique id and a patch. */
  updateAclByNodeId?: Maybe<UpdateAclPayload>;
  /** Updates a single `Acl` using a unique key and a patch. */
  updateAclBySketchClassId?: Maybe<UpdateAclPayload>;
  /** Updates a single `Acl` using a unique key and a patch. */
  updateAclByTableOfContentsItemId?: Maybe<UpdateAclPayload>;
  /** Updates a single `Basemap` using a unique key and a patch. */
  updateBasemap?: Maybe<UpdateBasemapPayload>;
  /** Updates a single `Basemap` using its globally unique id and a patch. */
  updateBasemapByNodeId?: Maybe<UpdateBasemapPayload>;
  /** Updates a single `CommunityGuideline` using a unique key and a patch. */
  updateCommunityGuideline?: Maybe<UpdateCommunityGuidelinePayload>;
  /** Updates a single `CommunityGuideline` using its globally unique id and a patch. */
  updateCommunityGuidelineByNodeId?: Maybe<UpdateCommunityGuidelinePayload>;
  /** Updates a single `DataLayer` using a unique key and a patch. */
  updateDataLayer?: Maybe<UpdateDataLayerPayload>;
  /** Updates a single `DataLayer` using a unique key and a patch. */
  updateDataLayerByInteractivitySettingsId?: Maybe<UpdateDataLayerPayload>;
  /** Updates a single `DataLayer` using its globally unique id and a patch. */
  updateDataLayerByNodeId?: Maybe<UpdateDataLayerPayload>;
  /** Updates a single `DataSource` using a unique key and a patch. */
  updateDataSource?: Maybe<UpdateDataSourcePayload>;
  /** Updates a single `DataSource` using its globally unique id and a patch. */
  updateDataSourceByNodeId?: Maybe<UpdateDataSourcePayload>;
  /** Updates a single `EmailNotificationPreference` using a unique key and a patch. */
  updateEmailNotificationPreferenceByUserId?: Maybe<UpdateEmailNotificationPreferencePayload>;
  /** Updates a single `Form` using a unique key and a patch. */
  updateForm?: Maybe<UpdateFormPayload>;
  /** Updates a single `Form` using its globally unique id and a patch. */
  updateFormByNodeId?: Maybe<UpdateFormPayload>;
  /** Updates a single `Form` using a unique key and a patch. */
  updateFormBySketchClassId?: Maybe<UpdateFormPayload>;
  /** Updates a single `Form` using a unique key and a patch. */
  updateFormBySurveyId?: Maybe<UpdateFormPayload>;
  /** Updates a single `FormElement` using a unique key and a patch. */
  updateFormElement?: Maybe<UpdateFormElementPayload>;
  /** Updates a single `FormElement` using its globally unique id and a patch. */
  updateFormElementByNodeId?: Maybe<UpdateFormElementPayload>;
  /** Updates a single `FormLogicCondition` using a unique key and a patch. */
  updateFormLogicCondition?: Maybe<UpdateFormLogicConditionPayload>;
  /** Updates a single `FormLogicCondition` using its globally unique id and a patch. */
  updateFormLogicConditionByNodeId?: Maybe<UpdateFormLogicConditionPayload>;
  /** Updates a single `FormLogicRule` using a unique key and a patch. */
  updateFormLogicRule?: Maybe<UpdateFormLogicRulePayload>;
  /** Updates a single `FormLogicRule` using its globally unique id and a patch. */
  updateFormLogicRuleByNodeId?: Maybe<UpdateFormLogicRulePayload>;
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
  /** Updates a single `InteractivitySetting` using a unique key and a patch. */
  updateInteractivitySetting?: Maybe<UpdateInteractivitySettingPayload>;
  /** Updates a single `InteractivitySetting` using its globally unique id and a patch. */
  updateInteractivitySettingByNodeId?: Maybe<UpdateInteractivitySettingPayload>;
  updateMapboxSecretKey?: Maybe<UpdateMapboxSecretKeyPayload>;
  /** Updates a single `OptionalBasemapLayer` using a unique key and a patch. */
  updateOptionalBasemapLayer?: Maybe<UpdateOptionalBasemapLayerPayload>;
  /** Updates a single `OptionalBasemapLayer` using its globally unique id and a patch. */
  updateOptionalBasemapLayerByNodeId?: Maybe<UpdateOptionalBasemapLayerPayload>;
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
  updateProjectInvite?: Maybe<UpdateProjectInvitePayload>;
  /** Updates a single `ProjectInviteGroup` using a unique key and a patch. */
  updateProjectInviteGroupByInviteIdAndGroupId?: Maybe<UpdateProjectInviteGroupPayload>;
  /** Updates a single `ProjectsSharedBasemap` using a unique key and a patch. */
  updateProjectsSharedBasemapByBasemapIdAndProjectId?: Maybe<UpdateProjectsSharedBasemapPayload>;
  /** Updates a single `Sketch` using a unique key and a patch. */
  updateSketch?: Maybe<UpdateSketchPayload>;
  /** Updates a single `Sketch` using its globally unique id and a patch. */
  updateSketchByNodeId?: Maybe<UpdateSketchPayload>;
  /** Updates a single `SketchClass` using a unique key and a patch. */
  updateSketchClass?: Maybe<UpdateSketchClassPayload>;
  /** Updates a single `SketchClass` using a unique key and a patch. */
  updateSketchClassByFormElementId?: Maybe<UpdateSketchClassPayload>;
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
  /** Updates a single `TableOfContentsItem` using a unique key and a patch. */
  updateTableOfContentsItem?: Maybe<UpdateTableOfContentsItemPayload>;
  /** Updates a single `TableOfContentsItem` using a unique key and a patch. */
  updateTableOfContentsItemByDataLayerId?: Maybe<UpdateTableOfContentsItemPayload>;
  /** Updates a single `TableOfContentsItem` using its globally unique id and a patch. */
  updateTableOfContentsItemByNodeId?: Maybe<UpdateTableOfContentsItemPayload>;
  updateTableOfContentsItemChildren?: Maybe<UpdateTableOfContentsItemChildrenPayload>;
  /** Updates a single `Topic` using a unique key and a patch. */
  updateTopic?: Maybe<UpdateTopicPayload>;
  /** Updates a single `Topic` using its globally unique id and a patch. */
  updateTopicByNodeId?: Maybe<UpdateTopicPayload>;
  updateZIndexes?: Maybe<UpdateZIndexesPayload>;
  /** Use to upload pdf documents for use with the Consent FormElement */
  uploadConsentDocument: FormElement;
  /** Upload mapbox-gl-style documents for use as basemaps */
  uploadStyle: Basemap;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationAddGroupToAclArgs = {
  input: AddGroupToAclInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationAddImageToSpriteArgs = {
  height: Scalars['Int'];
  image: Scalars['Upload'];
  pixelRatio: Scalars['Int'];
  spriteId: Scalars['Int'];
  width: Scalars['Int'];
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
export type MutationArchiveResponsesArgs = {
  input: ArchiveResponsesInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationClearFormElementStyleArgs = {
  input: ClearFormElementStyleInput;
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
export type MutationCopyAppearanceArgs = {
  input: CopyAppearanceInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateBasemapArgs = {
  input: CreateBasemapInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateCommunityGuidelineArgs = {
  input: CreateCommunityGuidelineInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateDataLayerArgs = {
  input: CreateDataLayerInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateDataSourceArgs = {
  input: CreateDataSourceInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateFormElementArgs = {
  input: CreateFormElementInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateFormLogicConditionArgs = {
  input: CreateFormLogicConditionInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateFormLogicRuleArgs = {
  input: CreateFormLogicRuleInput;
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
export type MutationCreateInteractivitySettingArgs = {
  input: CreateInteractivitySettingInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateOptionalBasemapLayerArgs = {
  input: CreateOptionalBasemapLayerInput;
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
export type MutationCreateProjectsSharedBasemapArgs = {
  input: CreateProjectsSharedBasemapInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateSketchArgs = {
  input: CreateSketchInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateSketchFolderArgs = {
  input: CreateSketchFolderInput;
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
export type MutationCreateSurveyJumpRuleArgs = {
  input: CreateSurveyJumpRuleInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateSurveyResponseArgs = {
  input: CreateSurveyResponseInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateTableOfContentsItemArgs = {
  input: CreateTableOfContentsItemInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateTopicArgs = {
  input: CreateTopicInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteBasemapArgs = {
  input: DeleteBasemapInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteBasemapByNodeIdArgs = {
  input: DeleteBasemapByNodeIdInput;
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
export type MutationDeleteDataLayerArgs = {
  input: DeleteDataLayerInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteDataLayerByInteractivitySettingsIdArgs = {
  input: DeleteDataLayerByInteractivitySettingsIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteDataLayerByNodeIdArgs = {
  input: DeleteDataLayerByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteDataSourceArgs = {
  input: DeleteDataSourceInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteDataSourceByNodeIdArgs = {
  input: DeleteDataSourceByNodeIdInput;
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
export type MutationDeleteFormElementArgs = {
  input: DeleteFormElementInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteFormElementByNodeIdArgs = {
  input: DeleteFormElementByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteFormLogicConditionArgs = {
  input: DeleteFormLogicConditionInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteFormLogicConditionByNodeIdArgs = {
  input: DeleteFormLogicConditionByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteFormLogicRuleArgs = {
  input: DeleteFormLogicRuleInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteFormLogicRuleByNodeIdArgs = {
  input: DeleteFormLogicRuleByNodeIdInput;
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
export type MutationDeleteOptionalBasemapLayerArgs = {
  input: DeleteOptionalBasemapLayerInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteOptionalBasemapLayerByNodeIdArgs = {
  input: DeleteOptionalBasemapLayerByNodeIdInput;
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
export type MutationDeleteProjectsSharedBasemapByBasemapIdAndProjectIdArgs = {
  input: DeleteProjectsSharedBasemapByBasemapIdAndProjectIdInput;
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
export type MutationDeleteSketchClassByFormElementIdArgs = {
  input: DeleteSketchClassByFormElementIdInput;
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
export type MutationDeleteTableOfContentsBranchArgs = {
  input: DeleteTableOfContentsBranchInput;
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
export type MutationGetOrCreateSpriteArgs = {
  height: Scalars['Int'];
  pixelRatio: Scalars['Int'];
  projectId: Scalars['Int'];
  smallestImage: Scalars['Upload'];
  type?: InputMaybe<Scalars['String']>;
  width: Scalars['Int'];
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationGrantAdminAccessArgs = {
  input: GrantAdminAccessInput;
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
export type MutationMakeResponsesNotPracticeArgs = {
  input: MakeResponsesNotPracticeInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationMakeResponsesPracticeArgs = {
  input: MakeResponsesPracticeInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationMakeSketchClassArgs = {
  input: MakeSketchClassInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationMakeSurveyArgs = {
  input: MakeSurveyInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationMarkTopicAsReadArgs = {
  input: MarkTopicAsReadInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationModifySurveyAnswersArgs = {
  input: ModifySurveyAnswersInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationPublishTableOfContentsArgs = {
  input: PublishTableOfContentsInput;
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
export type MutationSetFormElementBackgroundArgs = {
  backgroundColor: Scalars['String'];
  backgroundHeight: Scalars['Int'];
  backgroundPalette: Array<InputMaybe<Scalars['String']>>;
  backgroundUrl: Scalars['String'];
  backgroundWidth: Scalars['Int'];
  downloadUrl: Scalars['String'];
  id: Scalars['Int'];
  secondaryColor: Scalars['String'];
  unsplashAuthorName: Scalars['String'];
  unsplashAuthorUrl: Scalars['String'];
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSetFormElementOrderArgs = {
  input: SetFormElementOrderInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSetFormLogicRuleOrderArgs = {
  input: SetFormLogicRuleOrderInput;
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
export type MutationSetUserGroupsArgs = {
  input: SetUserGroupsInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationToggleAdminAccessArgs = {
  input: ToggleAdminAccessInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationToggleForumPostingBanArgs = {
  input: ToggleForumPostingBanInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationToggleResponsesPracticeArgs = {
  input: ToggleResponsesPracticeInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateAclArgs = {
  input: UpdateAclInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateAclByBasemapIdArgs = {
  input: UpdateAclByBasemapIdInput;
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
export type MutationUpdateAclByTableOfContentsItemIdArgs = {
  input: UpdateAclByTableOfContentsItemIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateBasemapArgs = {
  input: UpdateBasemapInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateBasemapByNodeIdArgs = {
  input: UpdateBasemapByNodeIdInput;
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
export type MutationUpdateDataLayerArgs = {
  input: UpdateDataLayerInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateDataLayerByInteractivitySettingsIdArgs = {
  input: UpdateDataLayerByInteractivitySettingsIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateDataLayerByNodeIdArgs = {
  input: UpdateDataLayerByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateDataSourceArgs = {
  input: UpdateDataSourceInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateDataSourceByNodeIdArgs = {
  input: UpdateDataSourceByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateEmailNotificationPreferenceByUserIdArgs = {
  input: UpdateEmailNotificationPreferenceByUserIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateFormArgs = {
  input: UpdateFormInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateFormByNodeIdArgs = {
  input: UpdateFormByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateFormBySketchClassIdArgs = {
  input: UpdateFormBySketchClassIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateFormBySurveyIdArgs = {
  input: UpdateFormBySurveyIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateFormElementArgs = {
  input: UpdateFormElementInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateFormElementByNodeIdArgs = {
  input: UpdateFormElementByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateFormLogicConditionArgs = {
  input: UpdateFormLogicConditionInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateFormLogicConditionByNodeIdArgs = {
  input: UpdateFormLogicConditionByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateFormLogicRuleArgs = {
  input: UpdateFormLogicRuleInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateFormLogicRuleByNodeIdArgs = {
  input: UpdateFormLogicRuleByNodeIdInput;
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
export type MutationUpdateInteractivitySettingArgs = {
  input: UpdateInteractivitySettingInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateInteractivitySettingByNodeIdArgs = {
  input: UpdateInteractivitySettingByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateMapboxSecretKeyArgs = {
  input: UpdateMapboxSecretKeyInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateOptionalBasemapLayerArgs = {
  input: UpdateOptionalBasemapLayerInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateOptionalBasemapLayerByNodeIdArgs = {
  input: UpdateOptionalBasemapLayerByNodeIdInput;
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
export type MutationUpdateProjectInviteGroupByInviteIdAndGroupIdArgs = {
  input: UpdateProjectInviteGroupByInviteIdAndGroupIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateProjectsSharedBasemapByBasemapIdAndProjectIdArgs = {
  input: UpdateProjectsSharedBasemapByBasemapIdAndProjectIdInput;
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
export type MutationUpdateSketchClassByFormElementIdArgs = {
  input: UpdateSketchClassByFormElementIdInput;
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
export type MutationUpdateTableOfContentsItemArgs = {
  input: UpdateTableOfContentsItemInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateTableOfContentsItemByDataLayerIdArgs = {
  input: UpdateTableOfContentsItemByDataLayerIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateTableOfContentsItemByNodeIdArgs = {
  input: UpdateTableOfContentsItemByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateTableOfContentsItemChildrenArgs = {
  input: UpdateTableOfContentsItemChildrenInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateTopicArgs = {
  input: UpdateTopicInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateTopicByNodeIdArgs = {
  input: UpdateTopicByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateZIndexesArgs = {
  input: UpdateZIndexesInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUploadConsentDocumentArgs = {
  document: Scalars['Upload'];
  formElementId: Scalars['Int'];
  version: Scalars['Int'];
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUploadStyleArgs = {
  id?: InputMaybe<Scalars['Int']>;
  name: Scalars['String'];
  projectId: Scalars['Int'];
  style: Scalars['JSON'];
  surveysOnly?: InputMaybe<Scalars['Boolean']>;
  thumb: Scalars['Upload'];
};

/** An object with a globally unique `ID`. */
export type Node = {
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
};

/** Available only for MapBox GL Style-based basemaps. Specifies optional components of the basemap that can be shown or hidden. */
export type OptionalBasemapLayer = Node & {
  __typename?: 'OptionalBasemapLayer';
  /** Reads a single `Basemap` that is related to this `OptionalBasemapLayer`. */
  basemap?: Maybe<Basemap>;
  basemapId: Scalars['Int'];
  defaultVisibility: Scalars['Boolean'];
  description?: Maybe<Scalars['String']>;
  /**
   * Specify RADIO or SELECT if this option should be presented as a group of
   * options. Useful for mutually exclusive views like different years for the same
   * dataset, or a heatmap display of density for multiple species where a single
   * species must be chosen from a list. If left null, the option will be treated as standalone.
   */
  groupType: OptionalBasemapLayersGroupType;
  id: Scalars['Int'];
  /** IDs for layers in the gl style that will be toggled by this option. */
  layers: Array<Maybe<Scalars['String']>>;
  /** JSON representation of a ProseMirror document with layer metadata. */
  metadata?: Maybe<Scalars['JSON']>;
  /** Label that will be given in the UI */
  name: Scalars['String'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  options?: Maybe<Scalars['JSON']>;
};

/**
 * A condition to be used against `OptionalBasemapLayer` object types. All fields
 * are tested for equality and combined with a logical ‘and.’
 */
export type OptionalBasemapLayerCondition = {
  /** Checks for equality with the object’s `basemapId` field. */
  basemapId?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['Int']>;
};

/** An input for mutations affecting `OptionalBasemapLayer` */
export type OptionalBasemapLayerInput = {
  basemapId: Scalars['Int'];
  defaultVisibility?: InputMaybe<Scalars['Boolean']>;
  description?: InputMaybe<Scalars['String']>;
  /**
   * Specify RADIO or SELECT if this option should be presented as a group of
   * options. Useful for mutually exclusive views like different years for the same
   * dataset, or a heatmap display of density for multiple species where a single
   * species must be chosen from a list. If left null, the option will be treated as standalone.
   */
  groupType?: InputMaybe<OptionalBasemapLayersGroupType>;
  id?: InputMaybe<Scalars['Int']>;
  /** IDs for layers in the gl style that will be toggled by this option. */
  layers?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
  /** JSON representation of a ProseMirror document with layer metadata. */
  metadata?: InputMaybe<Scalars['JSON']>;
  /** Label that will be given in the UI */
  name: Scalars['String'];
  options?: InputMaybe<Scalars['JSON']>;
};

/** Represents an update to a `OptionalBasemapLayer`. Fields that are set will be updated. */
export type OptionalBasemapLayerPatch = {
  basemapId?: InputMaybe<Scalars['Int']>;
  defaultVisibility?: InputMaybe<Scalars['Boolean']>;
  description?: InputMaybe<Scalars['String']>;
  /**
   * Specify RADIO or SELECT if this option should be presented as a group of
   * options. Useful for mutually exclusive views like different years for the same
   * dataset, or a heatmap display of density for multiple species where a single
   * species must be chosen from a list. If left null, the option will be treated as standalone.
   */
  groupType?: InputMaybe<OptionalBasemapLayersGroupType>;
  id?: InputMaybe<Scalars['Int']>;
  /** IDs for layers in the gl style that will be toggled by this option. */
  layers?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
  /** JSON representation of a ProseMirror document with layer metadata. */
  metadata?: InputMaybe<Scalars['JSON']>;
  /** Label that will be given in the UI */
  name?: InputMaybe<Scalars['String']>;
  options?: InputMaybe<Scalars['JSON']>;
};

export enum OptionalBasemapLayersGroupType {
  None = 'NONE',
  Radio = 'RADIO',
  Select = 'SELECT'
}

/** Methods to use when ordering `OptionalBasemapLayer`. */
export enum OptionalBasemapLayersOrderBy {
  BasemapIdAsc = 'BASEMAP_ID_ASC',
  BasemapIdDesc = 'BASEMAP_ID_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

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
  None = 'NONE',
  ParticipantHiddenProfile = 'PARTICIPANT_HIDDEN_PROFILE',
  ParticipantSharedProfile = 'PARTICIPANT_SHARED_PROFILE',
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
  id?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `topicId` field. */
  topicId?: InputMaybe<Scalars['Int']>;
};

/** A connection to a list of `Post` values. */
export type PostsConnection = {
  __typename?: 'PostsConnection';
  /** A list of edges which contains the `Post` and cursor to aid in pagination. */
  edges: Array<PostsEdge>;
  /** A list of `Post` objects. */
  nodes: Array<Post>;
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
  node: Post;
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
  affiliations?: InputMaybe<Scalars['String']>;
  bio?: InputMaybe<Scalars['String']>;
  email?: InputMaybe<Scalars['Email']>;
  fullname?: InputMaybe<Scalars['String']>;
  nickname?: InputMaybe<Scalars['String']>;
  picture?: InputMaybe<Scalars['Upload']>;
  userId?: InputMaybe<Scalars['Int']>;
};

/** A `Profile` edge in the connection. */
export type ProfilesEdge = {
  __typename?: 'ProfilesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `Profile` at the end of the edge. */
  node: Profile;
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
  /** Reads and enables pagination through a set of `User`. */
  admins?: Maybe<Array<User>>;
  /** Reads and enables pagination through a set of `Basemap`. */
  basemaps?: Maybe<Array<Basemap>>;
  /** Reads and enables pagination through a set of `Basemap`. */
  basemapsConnection: BasemapsConnection;
  /** Reads a single `CommunityGuideline` that is related to this `Project`. */
  communityGuidelines?: Maybe<CommunityGuideline>;
  createdAt?: Maybe<Scalars['Datetime']>;
  creatorId: Scalars['Int'];
  dataHostingQuota?: Maybe<Scalars['Int']>;
  dataHostingQuotaUsed?: Maybe<Scalars['Int']>;
  /**
   * Retrieve DataLayers for a given set of TableOfContentsItem IDs. Should be used
   * in conjuction with `dataSourcesForItems` to progressively load layer information
   * when users request layers be displayed on the map.
   */
  dataLayersForItems?: Maybe<Array<DataLayer>>;
  /** Reads a single `DataSourcesBucket` that is related to this `Project`. */
  dataSourcesBucket?: Maybe<DataSourcesBucket>;
  dataSourcesBucketId?: Maybe<Scalars['String']>;
  /**
   * Retrieve DataSources for a given set of TableOfContentsItem IDs. Should be used
   * in conjuction with `dataLayersForItems` to progressively load layer information
   * when users request layers be displayed on the map.
   */
  dataSourcesForItems?: Maybe<Array<DataSource>>;
  /** Should be a short length in order to fit in the project header. */
  description?: Maybe<Scalars['String']>;
  /**
   * Draft layer lists, accessible only to admins. Make edits to the layer list and
   * then use the `publishTableOfContents` mutation when it is ready for end-users.
   */
  draftTableOfContentsItems?: Maybe<Array<TableOfContentsItem>>;
  /** Reads and enables pagination through a set of `Forum`. */
  forums: Array<Forum>;
  /** Reads and enables pagination through a set of `Group`. */
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
  inviteCounts?: Maybe<Array<InviteStat>>;
  inviteEmailSubject: Scalars['String'];
  inviteEmailTemplateText: Scalars['String'];
  /** List project invites by status */
  invitesConnection: ProjectInvitesConnection;
  /**
   * Returns true if the given user is an administrator of the project. Informaiton
   * is only available administrators of the project and will otherwise always return false.
   */
  isAdmin?: Maybe<Scalars['Boolean']>;
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
  mapboxPublicKey?: Maybe<Scalars['String']>;
  mapboxSecretKey?: Maybe<Scalars['String']>;
  /** List of all folders created by this user. */
  myFolders?: Maybe<Array<SketchFolder>>;
  /** A list of all sketches for this project and the current user session */
  mySketches?: Maybe<Array<Sketch>>;
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
  participants?: Maybe<Array<User>>;
  region: GeometryPolygon;
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
  sessionOutstandingSurveyInvites?: Maybe<Array<SurveyTokenInfo>>;
  sessionParticipationStatus?: Maybe<ParticipationStatus>;
  /** Reads and enables pagination through a set of `SketchClass`. */
  sketchClasses: Array<SketchClass>;
  /** Short identifier for the project used in the url. This property cannot be changed after project creation. */
  slug: Scalars['String'];
  /** Reads and enables pagination through a set of `Sprite`. */
  sprites: Array<Sprite>;
  supportEmail: Scalars['String'];
  /** Reads and enables pagination through a set of `Basemap`. */
  surveyBasemaps?: Maybe<Array<Basemap>>;
  /** Reads and enables pagination through a set of `Survey`. */
  surveys: Array<Survey>;
  /** Public layer list. Cannot be edited directly. */
  tableOfContentsItems?: Maybe<Array<TableOfContentsItem>>;
  /** Number of users who have outstanding access requests. Only relevant for invite-only projects. */
  unapprovedParticipantCount?: Maybe<Scalars['Int']>;
  /**
   * For invite-only projects. List all pending participation requests.
   *
   * Users can be approved using the `approveParticipant()` mutation.
   */
  unapprovedParticipants?: Maybe<Array<User>>;
  /** Project url will resolve to `https://seasketch.org/{slug}/` */
  url?: Maybe<Scalars['String']>;
  /** List of all banned users. Listing only accessible to admins. */
  usersBannedFromForums?: Maybe<Array<User>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectAdminsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectBasemapsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectBasemapsConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<BasemapCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<BasemapsOrderBy>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectDataLayersForItemsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  tableOfContentsItemIds?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectDataSourcesForItemsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  tableOfContentsItemIds?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectDraftTableOfContentsItemsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectForumsArgs = {
  condition?: InputMaybe<ForumCondition>;
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<ForumsOrderBy>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectGroupsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<GroupsOrderBy>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectInviteCountsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectInvitesConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  direction?: InputMaybe<SortByDirection>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<InviteOrderBy>;
  statuses?: InputMaybe<Array<InputMaybe<InviteStatus>>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectIsAdminArgs = {
  userId?: InputMaybe<Scalars['Int']>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectMyFoldersArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectMySketchesArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectParticipantsArgs = {
  direction?: InputMaybe<SortByDirection>;
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<ParticipantSortBy>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectSessionOutstandingSurveyInvitesArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectSketchClassesArgs = {
  condition?: InputMaybe<SketchClassCondition>;
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<SketchClassesOrderBy>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectSpritesArgs = {
  condition?: InputMaybe<SpriteCondition>;
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<SpritesOrderBy>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectSurveyBasemapsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectSurveysArgs = {
  condition?: InputMaybe<SurveyCondition>;
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<SurveysOrderBy>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectTableOfContentsItemsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectUnapprovedParticipantsArgs = {
  direction?: InputMaybe<SortByDirection>;
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<ParticipantSortBy>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectUsersBannedFromForumsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};

export enum ProjectAccessControlSetting {
  AdminsOnly = 'ADMINS_ONLY',
  InviteOnly = 'INVITE_ONLY',
  Public = 'PUBLIC'
}

export enum ProjectAccessStatus {
  DeniedAdminsOnly = 'DENIED_ADMINS_ONLY',
  DeniedAnon = 'DENIED_ANON',
  DeniedEmailNotVerified = 'DENIED_EMAIL_NOT_VERIFIED',
  DeniedNotApproved = 'DENIED_NOT_APPROVED',
  DeniedNotRequested = 'DENIED_NOT_REQUESTED',
  Granted = 'GRANTED',
  ProjectDoesNotExist = 'PROJECT_DOES_NOT_EXIST'
}

/** A condition to be used against `Project` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type ProjectCondition = {
  /** Checks for equality with the object’s `accessControl` field. */
  accessControl?: InputMaybe<ProjectAccessControlSetting>;
  /** Checks for equality with the object’s `dataSourcesBucketId` field. */
  dataSourcesBucketId?: InputMaybe<Scalars['String']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `isFeatured` field. */
  isFeatured?: InputMaybe<Scalars['Boolean']>;
  /** Checks for equality with the object’s `slug` field. */
  slug?: InputMaybe<Scalars['String']>;
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
  /** Reads and enables pagination through a set of `Group`. */
  groups?: Maybe<Array<Group>>;
  id: Scalars['Int'];
  /** Reads and enables pagination through a set of `InviteEmail`. */
  inviteEmails: Array<InviteEmail>;
  /** User will be made an admin of the project if true. They will not be given special access until their email is verified. */
  makeAdmin: Scalars['Boolean'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  projectId: Scalars['Int'];
  /** Reads and enables pagination through a set of `ProjectInviteGroup`. */
  projectInviteGroupsByInviteIdConnection: ProjectInviteGroupsConnection;
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
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
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
  condition?: InputMaybe<InviteEmailCondition>;
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<InviteEmailsOrderBy>>;
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
export type ProjectInviteProjectInviteGroupsByInviteIdConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<ProjectInviteGroupCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<ProjectInviteGroupsOrderBy>>;
};

export type ProjectInviteGroup = {
  __typename?: 'ProjectInviteGroup';
  /** Reads a single `Group` that is related to this `ProjectInviteGroup`. */
  group?: Maybe<Group>;
  groupId: Scalars['Int'];
  /** Reads a single `ProjectInvite` that is related to this `ProjectInviteGroup`. */
  invite?: Maybe<ProjectInvite>;
  inviteId: Scalars['Int'];
};

/**
 * A condition to be used against `ProjectInviteGroup` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type ProjectInviteGroupCondition = {
  /** Checks for equality with the object’s `groupId` field. */
  groupId?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `inviteId` field. */
  inviteId?: InputMaybe<Scalars['Int']>;
};

/** An input for mutations affecting `ProjectInviteGroup` */
export type ProjectInviteGroupInput = {
  groupId: Scalars['Int'];
  inviteId: Scalars['Int'];
};

/** Represents an update to a `ProjectInviteGroup`. Fields that are set will be updated. */
export type ProjectInviteGroupPatch = {
  groupId?: InputMaybe<Scalars['Int']>;
  inviteId?: InputMaybe<Scalars['Int']>;
};

/** A connection to a list of `ProjectInviteGroup` values. */
export type ProjectInviteGroupsConnection = {
  __typename?: 'ProjectInviteGroupsConnection';
  /** A list of edges which contains the `ProjectInviteGroup` and cursor to aid in pagination. */
  edges: Array<ProjectInviteGroupsEdge>;
  /** A list of `ProjectInviteGroup` objects. */
  nodes: Array<ProjectInviteGroup>;
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
  node: ProjectInviteGroup;
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
  email?: InputMaybe<Scalars['Email']>;
  fullname?: InputMaybe<Scalars['String']>;
};

export type ProjectInviteStateSubscriptionPayload = {
  __typename?: 'ProjectInviteStateSubscriptionPayload';
  invite?: Maybe<ProjectInvite>;
};

export type ProjectInviteTokenClaims = {
  __typename?: 'ProjectInviteTokenClaims';
  admin: Scalars['Boolean'];
  email: Scalars['String'];
  fullname?: Maybe<Scalars['String']>;
  inviteId: Scalars['Int'];
  projectId: Scalars['Int'];
  projectName: Scalars['String'];
  projectSlug: Scalars['String'];
  wasUsed: Scalars['Boolean'];
};

export type ProjectInviteTokenVerificationResults = {
  __typename?: 'ProjectInviteTokenVerificationResults';
  claims?: Maybe<ProjectInviteTokenClaims>;
  error?: Maybe<Scalars['String']>;
  /** Indicates whether there is an existing account that matches the email address on the invite */
  existingAccount?: Maybe<Scalars['Boolean']>;
};

/** A connection to a list of `ProjectInvite` values. */
export type ProjectInvitesConnection = {
  __typename?: 'ProjectInvitesConnection';
  /** A list of edges which contains the `ProjectInvite` and cursor to aid in pagination. */
  edges: Array<ProjectInvitesEdge>;
  /** A list of `ProjectInvite` objects. */
  nodes: Array<ProjectInvite>;
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
  node: ProjectInvite;
};

/** Represents an update to a `Project`. Fields that are set will be updated. */
export type ProjectPatch = {
  /** Admins can control whether a project is public, invite-only, or admins-only. */
  accessControl?: InputMaybe<ProjectAccessControlSetting>;
  dataSourcesBucketId?: InputMaybe<Scalars['String']>;
  /** Should be a short length in order to fit in the project header. */
  description?: InputMaybe<Scalars['String']>;
  inviteEmailSubject?: InputMaybe<Scalars['String']>;
  inviteEmailTemplateText?: InputMaybe<Scalars['String']>;
  /** Featured projects may be given prominent placement on the homepage. This property can only be modified by superusers. */
  isFeatured?: InputMaybe<Scalars['Boolean']>;
  /**
   * Project admins can decide whether their project will be displayed on the
   * public project listing via Query.projectsConnection.
   */
  isListed?: InputMaybe<Scalars['Boolean']>;
  /** If a logoUrl is provided, it will link to this url in a new window if provided. */
  logoLink?: InputMaybe<Scalars['String']>;
  /**
   * URL referencing an image that will be used to represent the project. Will be
   * displayed at 48x48 pixels and must be a public url.
   */
  logoUrl?: InputMaybe<Scalars['Upload']>;
  mapboxPublicKey?: InputMaybe<Scalars['String']>;
  name?: InputMaybe<Scalars['String']>;
  region?: InputMaybe<Scalars['GeoJSON']>;
};

/** A connection to a list of `Project` values. */
export type ProjectsConnection = {
  __typename?: 'ProjectsConnection';
  /** A list of edges which contains the `Project` and cursor to aid in pagination. */
  edges: Array<ProjectsEdge>;
  /** A list of `Project` objects. */
  nodes: Array<Project>;
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
  node: Project;
};

/** Methods to use when ordering `Project`. */
export enum ProjectsOrderBy {
  AccessControlAsc = 'ACCESS_CONTROL_ASC',
  AccessControlDesc = 'ACCESS_CONTROL_DESC',
  DataSourcesBucketIdAsc = 'DATA_SOURCES_BUCKET_ID_ASC',
  DataSourcesBucketIdDesc = 'DATA_SOURCES_BUCKET_ID_DESC',
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

export type ProjectsSharedBasemap = {
  __typename?: 'ProjectsSharedBasemap';
  /** Reads a single `Basemap` that is related to this `ProjectsSharedBasemap`. */
  basemap?: Maybe<Basemap>;
  basemapId: Scalars['Int'];
  projectId: Scalars['Int'];
};

/**
 * A condition to be used against `ProjectsSharedBasemap` object types. All fields
 * are tested for equality and combined with a logical ‘and.’
 */
export type ProjectsSharedBasemapCondition = {
  /** Checks for equality with the object’s `basemapId` field. */
  basemapId?: InputMaybe<Scalars['Int']>;
};

/** An input for mutations affecting `ProjectsSharedBasemap` */
export type ProjectsSharedBasemapInput = {
  basemapId: Scalars['Int'];
  projectId: Scalars['Int'];
};

/** Represents an update to a `ProjectsSharedBasemap`. Fields that are set will be updated. */
export type ProjectsSharedBasemapPatch = {
  basemapId?: InputMaybe<Scalars['Int']>;
  projectId?: InputMaybe<Scalars['Int']>;
};

/** A connection to a list of `ProjectsSharedBasemap` values. */
export type ProjectsSharedBasemapsConnection = {
  __typename?: 'ProjectsSharedBasemapsConnection';
  /** A list of edges which contains the `ProjectsSharedBasemap` and cursor to aid in pagination. */
  edges: Array<ProjectsSharedBasemapsEdge>;
  /** A list of `ProjectsSharedBasemap` objects. */
  nodes: Array<ProjectsSharedBasemap>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `ProjectsSharedBasemap` you could get from the connection. */
  totalCount: Scalars['Int'];
};

/** A `ProjectsSharedBasemap` edge in the connection. */
export type ProjectsSharedBasemapsEdge = {
  __typename?: 'ProjectsSharedBasemapsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `ProjectsSharedBasemap` at the end of the edge. */
  node: ProjectsSharedBasemap;
};

/** Methods to use when ordering `ProjectsSharedBasemap`. */
export enum ProjectsSharedBasemapsOrderBy {
  BasemapIdAsc = 'BASEMAP_ID_ASC',
  BasemapIdDesc = 'BASEMAP_ID_DESC',
  Natural = 'NATURAL'
}

export type PublicProjectDetail = {
  __typename?: 'PublicProjectDetail';
  accessControl?: Maybe<ProjectAccessControlSetting>;
  accessStatus?: Maybe<ProjectAccessStatus>;
  id?: Maybe<Scalars['Int']>;
  logoUrl?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  slug?: Maybe<Scalars['String']>;
  supportEmail?: Maybe<Scalars['String']>;
};

/** All input for the `publishTableOfContents` mutation. */
export type PublishTableOfContentsInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  projectId?: InputMaybe<Scalars['Int']>;
};

/** The output of our `publishTableOfContents` mutation. */
export type PublishTableOfContentsPayload = {
  __typename?: 'PublishTableOfContentsPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  tableOfContentsItems?: Maybe<Array<TableOfContentsItem>>;
};

/** The root query type which gives access points into the data universe. */
export type Query = Node & {
  __typename?: 'Query';
  acl?: Maybe<Acl>;
  aclByBasemapId?: Maybe<Acl>;
  /** Reads a single `Acl` using its globally unique `ID`. */
  aclByNodeId?: Maybe<Acl>;
  aclBySketchClassId?: Maybe<Acl>;
  aclByTableOfContentsItemId?: Maybe<Acl>;
  basemap?: Maybe<Basemap>;
  /** Reads a single `Basemap` using its globally unique `ID`. */
  basemapByNodeId?: Maybe<Basemap>;
  /** Reads and enables pagination through a set of `Basemap`. */
  basemapsConnection?: Maybe<BasemapsConnection>;
  /**
   * GraphQL server software build identifier. During a deployment, if changes are
   * not detected in software modules some may be skipped. So, client and server
   * version could differ.
   *
   * We return "dev" if build cannot be determined from deployment environment.
   */
  build: Scalars['String'];
  communityGuideline?: Maybe<CommunityGuideline>;
  /** Reads a single `CommunityGuideline` using its globally unique `ID`. */
  communityGuidelineByNodeId?: Maybe<CommunityGuideline>;
  currentUserIsSuperuser: Scalars['Boolean'];
  dataLayer?: Maybe<DataLayer>;
  dataLayerByInteractivitySettingsId?: Maybe<DataLayer>;
  /** Reads a single `DataLayer` using its globally unique `ID`. */
  dataLayerByNodeId?: Maybe<DataLayer>;
  dataSource?: Maybe<DataSource>;
  /** Reads a single `DataSource` using its globally unique `ID`. */
  dataSourceByNodeId?: Maybe<DataSource>;
  dataSourcesBucket?: Maybe<DataSourcesBucket>;
  /** Reads a single `DataSourcesBucket` using its globally unique `ID`. */
  dataSourcesBucketByNodeId?: Maybe<DataSourcesBucket>;
  /** Reads and enables pagination through a set of `DataSourcesBucket`. */
  dataSourcesBucketsConnection?: Maybe<DataSourcesBucketsConnection>;
  emailNotificationPreferenceByUserId?: Maybe<EmailNotificationPreference>;
  /** Reads and enables pagination through a set of `EmailNotificationPreference`. */
  emailNotificationPreferencesConnection?: Maybe<EmailNotificationPreferencesConnection>;
  extractSpriteIds?: Maybe<Array<Maybe<Scalars['Int']>>>;
  form?: Maybe<Form>;
  /** Reads a single `Form` using its globally unique `ID`. */
  formByNodeId?: Maybe<Form>;
  formBySketchClassId?: Maybe<Form>;
  formBySurveyId?: Maybe<Form>;
  formElement?: Maybe<FormElement>;
  /** Reads a single `FormElement` using its globally unique `ID`. */
  formElementByNodeId?: Maybe<FormElement>;
  formElementType?: Maybe<FormElementType>;
  formElementTypeByLabel?: Maybe<FormElementType>;
  /** Reads a single `FormElementType` using its globally unique `ID`. */
  formElementTypeByNodeId?: Maybe<FormElementType>;
  /** Reads a set of `FormElementType`. */
  formElementTypes?: Maybe<Array<FormElementType>>;
  formLogicCondition?: Maybe<FormLogicCondition>;
  /** Reads a single `FormLogicCondition` using its globally unique `ID`. */
  formLogicConditionByNodeId?: Maybe<FormLogicCondition>;
  formLogicRule?: Maybe<FormLogicRule>;
  /** Reads a single `FormLogicRule` using its globally unique `ID`. */
  formLogicRuleByNodeId?: Maybe<FormLogicRule>;
  forum?: Maybe<Forum>;
  /** Reads a single `Forum` using its globally unique `ID`. */
  forumByNodeId?: Maybe<Forum>;
  getDefaultDataSourcesBucket?: Maybe<Scalars['String']>;
  getUnsplashPhotos: UnsplashSearchResult;
  group?: Maybe<Group>;
  /** Reads a single `Group` using its globally unique `ID`. */
  groupByNodeId?: Maybe<Group>;
  groupByProjectIdAndName?: Maybe<Group>;
  interactivitySetting?: Maybe<InteractivitySetting>;
  /** Reads a single `InteractivitySetting` using its globally unique `ID`. */
  interactivitySettingByNodeId?: Maybe<InteractivitySetting>;
  inviteEmail?: Maybe<InviteEmail>;
  /** Reads a single `InviteEmail` using its globally unique `ID`. */
  inviteEmailByNodeId?: Maybe<InviteEmail>;
  /** Access the current session's User. The user is determined by the access token embedded in the `Authorization` header. */
  me?: Maybe<User>;
  /** Fetches an object given its globally unique `ID`. */
  node?: Maybe<Node>;
  /** The root query type must be a `Node` to work well with Relay 1 mutations. This just resolves to `query`. */
  nodeId: Scalars['ID'];
  optionalBasemapLayer?: Maybe<OptionalBasemapLayer>;
  /** Reads a single `OptionalBasemapLayer` using its globally unique `ID`. */
  optionalBasemapLayerByNodeId?: Maybe<OptionalBasemapLayer>;
  post?: Maybe<Post>;
  /** Reads a single `Post` using its globally unique `ID`. */
  postByNodeId?: Maybe<Post>;
  /** Reads and enables pagination through a set of `Post`. */
  postsConnection?: Maybe<PostsConnection>;
  profileByUserId?: Maybe<Profile>;
  project?: Maybe<Project>;
  projectAccessStatus?: Maybe<ProjectAccessStatus>;
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
  projectPublicDetails?: Maybe<PublicProjectDetail>;
  /** Reads and enables pagination through a set of `Project`. */
  projectsConnection?: Maybe<ProjectsConnection>;
  projectsSharedBasemapByBasemapIdAndProjectId?: Maybe<ProjectsSharedBasemap>;
  /** Reads and enables pagination through a set of `ProjectsSharedBasemap`. */
  projectsSharedBasemapsConnection?: Maybe<ProjectsSharedBasemapsConnection>;
  /**
   * Exposes the root query type nested one level down. This is helpful for Relay 1
   * which can only query top level fields if they are in a particular form.
   */
  query: Query;
  sessionIsBannedFromPosting?: Maybe<Scalars['Boolean']>;
  sharedBasemaps?: Maybe<Basemap>;
  sketch?: Maybe<Sketch>;
  /** Reads a single `Sketch` using its globally unique `ID`. */
  sketchByNodeId?: Maybe<Sketch>;
  sketchClass?: Maybe<SketchClass>;
  sketchClassByFormElementId?: Maybe<SketchClass>;
  /** Reads a single `SketchClass` using its globally unique `ID`. */
  sketchClassByNodeId?: Maybe<SketchClass>;
  sketchFolder?: Maybe<SketchFolder>;
  /** Reads a single `SketchFolder` using its globally unique `ID`. */
  sketchFolderByNodeId?: Maybe<SketchFolder>;
  sprite?: Maybe<Sprite>;
  spriteByMd5AndProjectId?: Maybe<Sprite>;
  /** Reads a single `Sprite` using its globally unique `ID`. */
  spriteByNodeId?: Maybe<Sprite>;
  spriteImageBySpriteIdAndPixelRatio?: Maybe<SpriteImage>;
  survey?: Maybe<Survey>;
  /** Reads a single `Survey` using its globally unique `ID`. */
  surveyByNodeId?: Maybe<Survey>;
  surveyConsentDocument?: Maybe<SurveyConsentDocument>;
  surveyConsentDocumentByFormElementIdAndVersion?: Maybe<SurveyConsentDocument>;
  /** Reads a single `SurveyConsentDocument` using its globally unique `ID`. */
  surveyConsentDocumentByNodeId?: Maybe<SurveyConsentDocument>;
  /** Reads and enables pagination through a set of `SurveyConsentDocument`. */
  surveyConsentDocumentsConnection?: Maybe<SurveyConsentDocumentsConnection>;
  surveyInvite?: Maybe<SurveyInvite>;
  surveyInviteByEmail?: Maybe<SurveyInvite>;
  surveyInviteByEmailAndSurveyId?: Maybe<SurveyInvite>;
  /** Reads a single `SurveyInvite` using its globally unique `ID`. */
  surveyInviteByNodeId?: Maybe<SurveyInvite>;
  surveyInvitedGroupBySurveyIdAndGroupId?: Maybe<SurveyInvitedGroup>;
  surveyResponse?: Maybe<SurveyResponse>;
  /** Reads a single `SurveyResponse` using its globally unique `ID`. */
  surveyResponseByNodeId?: Maybe<SurveyResponse>;
  /** Reads and enables pagination through a set of `SurveyResponse`. */
  surveyResponsesConnection?: Maybe<SurveyResponsesConnection>;
  tableOfContentsItem?: Maybe<TableOfContentsItem>;
  tableOfContentsItemByDataLayerId?: Maybe<TableOfContentsItem>;
  /** Reads a single `TableOfContentsItem` using its globally unique `ID`. */
  tableOfContentsItemByNodeId?: Maybe<TableOfContentsItem>;
  /** Reads and enables pagination through a set of `Form`. */
  templateForms?: Maybe<Array<Form>>;
  tilebbox?: Maybe<GeometryInterface>;
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


/** The root query type which gives access points into the data universe. */
export type QueryAclArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryAclByBasemapIdArgs = {
  basemapId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryAclByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryAclBySketchClassIdArgs = {
  sketchClassId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryAclByTableOfContentsItemIdArgs = {
  tableOfContentsItemId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryBasemapArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryBasemapByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryBasemapsConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<BasemapCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<BasemapsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryCommunityGuidelineArgs = {
  projectId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryCommunityGuidelineByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryDataLayerArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryDataLayerByInteractivitySettingsIdArgs = {
  interactivitySettingsId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryDataLayerByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryDataSourceArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryDataSourceByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryDataSourcesBucketArgs = {
  url: Scalars['String'];
};


/** The root query type which gives access points into the data universe. */
export type QueryDataSourcesBucketByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryDataSourcesBucketsConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<DataSourcesBucketCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<DataSourcesBucketsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryEmailNotificationPreferenceByUserIdArgs = {
  userId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryEmailNotificationPreferencesConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<EmailNotificationPreferenceCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<EmailNotificationPreferencesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryExtractSpriteIdsArgs = {
  t?: InputMaybe<Scalars['String']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryFormArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryFormByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryFormBySketchClassIdArgs = {
  sketchClassId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryFormBySurveyIdArgs = {
  surveyId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryFormElementArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryFormElementByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryFormElementTypeArgs = {
  componentName: Scalars['String'];
};


/** The root query type which gives access points into the data universe. */
export type QueryFormElementTypeByLabelArgs = {
  label: Scalars['String'];
};


/** The root query type which gives access points into the data universe. */
export type QueryFormElementTypeByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryFormElementTypesArgs = {
  condition?: InputMaybe<FormElementTypeCondition>;
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<FormElementTypesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryFormLogicConditionArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryFormLogicConditionByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryFormLogicRuleArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryFormLogicRuleByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryForumArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryForumByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGetUnsplashPhotosArgs = {
  query: Scalars['String'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGroupArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGroupByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGroupByProjectIdAndNameArgs = {
  name: Scalars['String'];
  projectId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryInteractivitySettingArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryInteractivitySettingByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryInviteEmailArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryInviteEmailByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryNodeArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryOptionalBasemapLayerArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryOptionalBasemapLayerByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryPostArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryPostByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryPostsConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<PostCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<PostsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryProfileByUserIdArgs = {
  userId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryProjectArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryProjectAccessStatusArgs = {
  pid?: InputMaybe<Scalars['Int']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryProjectByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryProjectBySlugArgs = {
  slug: Scalars['String'];
};


/** The root query type which gives access points into the data universe. */
export type QueryProjectInviteArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryProjectInviteByEmailAndProjectIdArgs = {
  email: Scalars['Email'];
  projectId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryProjectInviteByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryProjectInviteGroupByInviteIdAndGroupIdArgs = {
  groupId: Scalars['Int'];
  inviteId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryProjectInviteGroupsConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<ProjectInviteGroupCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<ProjectInviteGroupsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryProjectPublicDetailsArgs = {
  slug?: InputMaybe<Scalars['String']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryProjectsConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<ProjectCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<ProjectsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryProjectsSharedBasemapByBasemapIdAndProjectIdArgs = {
  basemapId: Scalars['Int'];
  projectId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryProjectsSharedBasemapsConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<ProjectsSharedBasemapCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<ProjectsSharedBasemapsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySessionIsBannedFromPostingArgs = {
  pid?: InputMaybe<Scalars['Int']>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySketchArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySketchByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySketchClassArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySketchClassByFormElementIdArgs = {
  formElementId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySketchClassByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySketchFolderArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySketchFolderByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySpriteArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySpriteByMd5AndProjectIdArgs = {
  md5: Scalars['String'];
  projectId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySpriteByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySpriteImageBySpriteIdAndPixelRatioArgs = {
  pixelRatio: Scalars['Int'];
  spriteId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySurveyArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySurveyByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySurveyConsentDocumentArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySurveyConsentDocumentByFormElementIdAndVersionArgs = {
  formElementId: Scalars['Int'];
  version: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySurveyConsentDocumentByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySurveyConsentDocumentsConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<SurveyConsentDocumentCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<SurveyConsentDocumentsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySurveyInviteArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySurveyInviteByEmailArgs = {
  email: Scalars['Email'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySurveyInviteByEmailAndSurveyIdArgs = {
  email: Scalars['Email'];
  surveyId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySurveyInviteByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySurveyInvitedGroupBySurveyIdAndGroupIdArgs = {
  groupId: Scalars['Int'];
  surveyId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySurveyResponseArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySurveyResponseByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySurveyResponsesConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<SurveyResponseCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<SurveyResponsesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTableOfContentsItemArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTableOfContentsItemByDataLayerIdArgs = {
  dataLayerId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTableOfContentsItemByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTemplateFormsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTilebboxArgs = {
  srid?: InputMaybe<Scalars['Int']>;
  x?: InputMaybe<Scalars['Int']>;
  y?: InputMaybe<Scalars['Int']>;
  z?: InputMaybe<Scalars['Int']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTopicArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTopicByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTopicsConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<TopicCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<TopicsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryUserArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryUserByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryVerifyProjectInviteArgs = {
  token: Scalars['String'];
};


/** The root query type which gives access points into the data universe. */
export type QueryVerifySurveyInviteArgs = {
  token: Scalars['String'];
};

export enum RasterDemEncoding {
  Mapbox = 'MAPBOX',
  Terrarium = 'TERRARIUM'
}

/** All input for the `removeGroupFromAcl` mutation. */
export type RemoveGroupFromAclInput = {
  aclId?: InputMaybe<Scalars['Int']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  groupId?: InputMaybe<Scalars['Int']>;
};

/** The output of our `removeGroupFromAcl` mutation. */
export type RemoveGroupFromAclPayload = {
  __typename?: 'RemoveGroupFromAclPayload';
  acl?: Maybe<Acl>;
  /** Reads a single `Basemap` that is related to this `Acl`. */
  basemap?: Maybe<Basemap>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `SketchClass` that is related to this `Acl`. */
  sketchClass?: Maybe<SketchClass>;
  /** Reads a single `TableOfContentsItem` that is related to this `Acl`. */
  tableOfContentsItem?: Maybe<TableOfContentsItem>;
};

/** All input for the `removeUserFromGroup` mutation. */
export type RemoveUserFromGroupInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  groupId?: InputMaybe<Scalars['Int']>;
  userId?: InputMaybe<Scalars['Int']>;
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
  child?: InputMaybe<Scalars['Int']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  parent?: InputMaybe<Scalars['Int']>;
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

export enum RenderUnderType {
  Labels = 'LABELS',
  Land = 'LAND',
  None = 'NONE'
}

/** All input for the `revokeAdminAccess` mutation. */
export type RevokeAdminAccessInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  projectId?: InputMaybe<Scalars['Int']>;
  userId?: InputMaybe<Scalars['Int']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
  projectId?: InputMaybe<Scalars['Int']>;
};

/** The output of our `sendAllProjectInvites` mutation. */
export type SendAllProjectInvitesPayload = {
  __typename?: 'SendAllProjectInvitesPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  inviteEmails?: Maybe<Array<InviteEmail>>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `sendProjectInvites` mutation. */
export type SendProjectInvitesInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  inviteIds?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
};

/** The output of our `sendProjectInvites` mutation. */
export type SendProjectInvitesPayload = {
  __typename?: 'SendProjectInvitesPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  inviteEmails?: Maybe<Array<InviteEmail>>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

export type SendVerificationEmailResults = {
  __typename?: 'SendVerificationEmailResults';
  error?: Maybe<Scalars['String']>;
  success: Scalars['Boolean'];
};

/** All input for the `setFormElementOrder` mutation. */
export type SetFormElementOrderInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  elementIds?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
};

/** The output of our `setFormElementOrder` mutation. */
export type SetFormElementOrderPayload = {
  __typename?: 'SetFormElementOrderPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  formElements?: Maybe<Array<FormElement>>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `setFormLogicRuleOrder` mutation. */
export type SetFormLogicRuleOrderInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  ruleIds?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
};

/** The output of our `setFormLogicRuleOrder` mutation. */
export type SetFormLogicRuleOrderPayload = {
  __typename?: 'SetFormLogicRuleOrderPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  formLogicRules?: Maybe<Array<FormLogicRule>>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `setForumOrder` mutation. */
export type SetForumOrderInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  forumIds?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
};

/** The output of our `setForumOrder` mutation. */
export type SetForumOrderPayload = {
  __typename?: 'SetForumOrderPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  forums?: Maybe<Array<Forum>>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `setPostHiddenByModerator` mutation. */
export type SetPostHiddenByModeratorInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  postId?: InputMaybe<Scalars['Int']>;
  value?: InputMaybe<Scalars['Boolean']>;
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
  orderBy?: InputMaybe<Array<PostsOrderBy>>;
};

/** All input for the `setTopicLocked` mutation. */
export type SetTopicLockedInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  topicId?: InputMaybe<Scalars['Int']>;
  value?: InputMaybe<Scalars['Boolean']>;
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
  orderBy?: InputMaybe<Array<TopicsOrderBy>>;
};

/** All input for the `setTopicSticky` mutation. */
export type SetTopicStickyInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  topicId?: InputMaybe<Scalars['Int']>;
  value?: InputMaybe<Scalars['Boolean']>;
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
  orderBy?: InputMaybe<Array<TopicsOrderBy>>;
};

/** All input for the `setUserGroups` mutation. */
export type SetUserGroupsInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  groups?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
  projectId?: InputMaybe<Scalars['Int']>;
  userId?: InputMaybe<Scalars['Int']>;
};

/** The output of our `setUserGroups` mutation. */
export type SetUserGroupsPayload = {
  __typename?: 'SetUserGroupsPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  integers?: Maybe<Array<Maybe<Scalars['Int']>>>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
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
  /** Reads a single `FormElement` that is related to this `Sketch`. */
  formElement?: Maybe<FormElement>;
  formElementId?: Maybe<Scalars['Int']>;
  /**
   * The geometry of the Sketch **after** it has been preprocessed. This is the
   * geometry that is used for reporting. Preprocessed geometries may be extremely
   * large and complex, so it may be necessary to access them through a vector tile
   * service or some other optimization.
   */
  geom?: Maybe<GeometryGeometry>;
  id: Scalars['Int'];
  mercatorGeometry?: Maybe<GeometryGeometry>;
  /** User provided name for the sketch. */
  name: Scalars['String'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  numVertices?: Maybe<Scalars['Int']>;
  properties: Scalars['JSON'];
  responseId?: Maybe<Scalars['Int']>;
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
  userId?: Maybe<Scalars['Int']>;
};

/** Sketch Classes act as a schema for sketches drawn by users. */
export type SketchClass = Node & {
  __typename?: 'SketchClass';
  /** Reads a single `Acl` that is related to this `SketchClass`. */
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
  /** Reads a single `Form` that is related to this `SketchClass`. */
  form?: Maybe<Form>;
  /** Reads a single `FormElement` that is related to this `SketchClass`. */
  formElement?: Maybe<FormElement>;
  /** If set, this sketch class is only for use in a survey indicated by the form_element. */
  formElementId?: Maybe<Scalars['Int']>;
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
  /** Reads and enables pagination through a set of `SketchClass`. */
  validChildren?: Maybe<Array<SketchClass>>;
};


/** Sketch Classes act as a schema for sketches drawn by users. */
export type SketchClassValidChildrenArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};

/**
 * A condition to be used against `SketchClass` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type SketchClassCondition = {
  /** Checks for equality with the object’s `formElementId` field. */
  formElementId?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `projectId` field. */
  projectId?: InputMaybe<Scalars['Int']>;
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
  allowMulti?: InputMaybe<Scalars['Boolean']>;
  /** Geometry type users digitize. COLLECTION types act as a feature collection and have no drawn geometry. */
  geometryType?: InputMaybe<SketchGeometryType>;
  /** Name of the report to be displayed. */
  geoprocessingClientName?: InputMaybe<Scalars['String']>;
  /** Endpoint for the client javascript bundle. */
  geoprocessingClientUrl?: InputMaybe<Scalars['String']>;
  /**
   * Root endpoint of a
   * [@seasketch/geoprocessing](https://github.com/seasketch/geoprocessing) project
   * that should be used for reporting.
   */
  geoprocessingProjectUrl?: InputMaybe<Scalars['String']>;
  /**
   * If set to true, (non-admin) users should not be able to digitize new features
   * using this sketch class, but they should still be able to access the sketch
   * class in order to render existing sketches of this type.
   */
  isArchived?: InputMaybe<Scalars['Boolean']>;
  /**
   * [Mapbox GL Style](https://docs.mapbox.com/mapbox-gl-js/style-spec/) used to
   * render features. Sketches can be styled based on attribute data by using
   * [Expressions](https://docs.mapbox.com/help/glossary/expression/).
   */
  mapboxGlStyle?: InputMaybe<Scalars['JSON']>;
  /** Label chosen by project admins that is shown to users. */
  name?: InputMaybe<Scalars['String']>;
};

/** A `SketchClass` edge in the connection. */
export type SketchClassesEdge = {
  __typename?: 'SketchClassesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `SketchClass` at the end of the edge. */
  node: SketchClass;
};

/** Methods to use when ordering `SketchClass`. */
export enum SketchClassesOrderBy {
  FormElementIdAsc = 'FORM_ELEMENT_ID_ASC',
  FormElementIdDesc = 'FORM_ELEMENT_ID_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ProjectIdAsc = 'PROJECT_ID_ASC',
  ProjectIdDesc = 'PROJECT_ID_DESC'
}

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
  collectionId?: InputMaybe<Scalars['Int']>;
  /** The parent folder, if any. */
  folderId?: InputMaybe<Scalars['Int']>;
  id?: InputMaybe<Scalars['Int']>;
  name: Scalars['String'];
  projectId: Scalars['Int'];
  userId: Scalars['Int'];
};

/** Represents an update to a `SketchFolder`. Fields that are set will be updated. */
export type SketchFolderPatch = {
  /** The parent sketch collection, if any. Folders can only have a single parent entity. */
  collectionId?: InputMaybe<Scalars['Int']>;
  /** The parent folder, if any. */
  folderId?: InputMaybe<Scalars['Int']>;
  id?: InputMaybe<Scalars['Int']>;
  name?: InputMaybe<Scalars['String']>;
  projectId?: InputMaybe<Scalars['Int']>;
  userId?: InputMaybe<Scalars['Int']>;
};

/** A `SketchFolder` edge in the connection. */
export type SketchFoldersEdge = {
  __typename?: 'SketchFoldersEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `SketchFolder` at the end of the edge. */
  node: SketchFolder;
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
  ChooseFeature = 'CHOOSE_FEATURE',
  Collection = 'COLLECTION',
  Linestring = 'LINESTRING',
  Point = 'POINT',
  Polygon = 'POLYGON'
}

/** An input for mutations affecting `Sketch` */
export type SketchInput = {
  bbox?: InputMaybe<Array<InputMaybe<Scalars['Float']>>>;
  /** If the sketch is not a collection, it can belong to a collection (collections cannot be nested). */
  collectionId?: InputMaybe<Scalars['Int']>;
  /**
   * If this Sketch started as a copy of another it is tracked here. Eventually
   * SeaSketch may have a means of visualizing how plans are iterated on over time.
   */
  copyOf?: InputMaybe<Scalars['Int']>;
  /** Parent folder. Both regular sketches and collections may be nested within folders for organization purposes. */
  folderId?: InputMaybe<Scalars['Int']>;
  formElementId?: InputMaybe<Scalars['Int']>;
  /**
   * The geometry of the Sketch **after** it has been preprocessed. This is the
   * geometry that is used for reporting. Preprocessed geometries may be extremely
   * large and complex, so it may be necessary to access them through a vector tile
   * service or some other optimization.
   */
  geom?: InputMaybe<Scalars['GeoJSON']>;
  id?: InputMaybe<Scalars['Int']>;
  mercatorGeometry?: InputMaybe<Scalars['GeoJSON']>;
  /** User provided name for the sketch. */
  name: Scalars['String'];
  numVertices?: InputMaybe<Scalars['Int']>;
  properties?: InputMaybe<Scalars['JSON']>;
  responseId?: InputMaybe<Scalars['Int']>;
  /** SketchClass that defines the behavior of this type of sketch. */
  sketchClassId: Scalars['Int'];
  /**
   * Spatial feature the user directly digitized, without preprocessing. This is
   * the feature that should be used if the Sketch is later edited.
   */
  userGeom?: InputMaybe<Scalars['GeoJSON']>;
  /** Owner of the sketch. */
  userId?: InputMaybe<Scalars['Int']>;
};

/** Represents an update to a `Sketch`. Fields that are set will be updated. */
export type SketchPatch = {
  /** If the sketch is not a collection, it can belong to a collection (collections cannot be nested). */
  collectionId?: InputMaybe<Scalars['Int']>;
  /**
   * The geometry of the Sketch **after** it has been preprocessed. This is the
   * geometry that is used for reporting. Preprocessed geometries may be extremely
   * large and complex, so it may be necessary to access them through a vector tile
   * service or some other optimization.
   */
  geom?: InputMaybe<Scalars['GeoJSON']>;
  /** User provided name for the sketch. */
  name?: InputMaybe<Scalars['String']>;
  /**
   * Spatial feature the user directly digitized, without preprocessing. This is
   * the feature that should be used if the Sketch is later edited.
   */
  userGeom?: InputMaybe<Scalars['GeoJSON']>;
};

export enum SortByDirection {
  Asc = 'ASC',
  Desc = 'DESC'
}

/**
 * Image sprites for use in Mapbox GL Styles. The database holds metadata about the
 * sprite, the actual images are in cloud storage referenced by the URL parameter.
 */
export type Sprite = Node & {
  __typename?: 'Sprite';
  id: Scalars['Int'];
  /**
   * Hash of lowest-dpi image in the set (pixelRatio=1). Useful for de-duplicating
   * symbols that have been imported multiple times
   */
  md5: Scalars['String'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** Reads a single `Project` that is related to this `Sprite`. */
  project?: Maybe<Project>;
  /** If unset, sprite will be available for use in all projects */
  projectId: Scalars['Int'];
  /** Reads and enables pagination through a set of `SpriteImage`. */
  spriteImages: Array<SpriteImage>;
  /** Optional. Indicates whether the image is intended for use with particular GL Styles */
  type?: Maybe<SpriteType>;
};


/**
 * Image sprites for use in Mapbox GL Styles. The database holds metadata about the
 * sprite, the actual images are in cloud storage referenced by the URL parameter.
 */
export type SpriteSpriteImagesArgs = {
  condition?: InputMaybe<SpriteImageCondition>;
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<SpriteImagesOrderBy>>;
};

/** A condition to be used against `Sprite` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type SpriteCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `md5` field. */
  md5?: InputMaybe<Scalars['String']>;
  /** Checks for equality with the object’s `projectId` field. */
  projectId?: InputMaybe<Scalars['Int']>;
};

export type SpriteImage = {
  __typename?: 'SpriteImage';
  /** Must be <= 1024 */
  height: Scalars['Int'];
  /**
   * Device pixel ratio a copy of this image supports. 2x would be for "retina"
   * devices. Multiple records may point to the same sprite id, but each must have
   * a unique combination of id, pixel_ratio, and data_layer_id.
   */
  pixelRatio: Scalars['Int'];
  /** Reads a single `Sprite` that is related to this `SpriteImage`. */
  sprite?: Maybe<Sprite>;
  spriteId: Scalars['Int'];
  /** Supports multipart Upload operations */
  url: Scalars['String'];
  /** Must be <= 1024 */
  width: Scalars['Int'];
};

/**
 * A condition to be used against `SpriteImage` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type SpriteImageCondition = {
  /** Checks for equality with the object’s `spriteId` field. */
  spriteId?: InputMaybe<Scalars['Int']>;
};

/** Methods to use when ordering `SpriteImage`. */
export enum SpriteImagesOrderBy {
  Natural = 'NATURAL',
  SpriteIdAsc = 'SPRITE_ID_ASC',
  SpriteIdDesc = 'SPRITE_ID_DESC'
}

export enum SpriteType {
  Fill = 'FILL',
  Icon = 'ICON',
  Line = 'LINE'
}

/** Methods to use when ordering `Sprite`. */
export enum SpritesOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Md5Asc = 'MD5_ASC',
  Md5Desc = 'MD5_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ProjectIdAsc = 'PROJECT_ID_ASC',
  ProjectIdDesc = 'PROJECT_ID_DESC'
}

/** The root subscription type: contains realtime events you can subscribe to with the `subscription` operation. */
export type Subscription = {
  __typename?: 'Subscription';
  /**
   * Triggered when the status of a project invite changes, generally because
   * of a change in the delivery status of a related InviteEmail. Uses
   * x-ss-slug to determine appropriate project.
   */
  projectInviteStateUpdated?: Maybe<ProjectInviteStateSubscriptionPayload>;
};

export type Survey = Node & {
  __typename?: 'Survey';
  /** PUBLIC or INVITE_ONLY */
  accessType: SurveyAccessType;
  archivedResponseCount?: Maybe<Scalars['Int']>;
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
  /** Reads and enables pagination through a set of `Group`. */
  invitedGroups?: Maybe<Array<Group>>;
  /**
   * Disabled surveys will not be accessible to non-admins. Invite email sending will
   * be paused.
   */
  isDisabled: Scalars['Boolean'];
  isSpatial?: Maybe<Scalars['Boolean']>;
  isTemplate?: Maybe<Scalars['Boolean']>;
  /**
   * If set, there can only be one response with matching contact information. The
   * app will also discourage multiple submissions from the same browser session.
   */
  limitToSingleResponse: Scalars['Boolean'];
  name: Scalars['String'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  practiceResponseCount?: Maybe<Scalars['Int']>;
  /** Reads a single `Project` that is related to this `Survey`. */
  project?: Maybe<Project>;
  projectId: Scalars['Int'];
  showFacilitationOption: Scalars['Boolean'];
  showProgress: Scalars['Boolean'];
  /**
   * Only applicable for public surveys. Show tools to respondants for sharing the
   * survey on social media to encourage responses.
   */
  showSocialMediaButtons?: Maybe<Scalars['Boolean']>;
  submittedResponseCount?: Maybe<Scalars['Int']>;
  supportedLanguages: Array<Maybe<Scalars['String']>>;
  /** Reads and enables pagination through a set of `SurveyInvitedGroup`. */
  surveyInvitedGroups: Array<SurveyInvitedGroup>;
  /** Reads and enables pagination through a set of `SurveyInvite`. */
  surveyInvites: Array<SurveyInvite>;
  /** Reads and enables pagination through a set of `SurveyResponse`. */
  surveyResponsesConnection: SurveyResponsesConnection;
};


export type SurveyFormsConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<FormCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<FormsOrderBy>>;
};


export type SurveyInvitedGroupsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};


export type SurveySurveyInvitedGroupsArgs = {
  condition?: InputMaybe<SurveyInvitedGroupCondition>;
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<SurveyInvitedGroupsOrderBy>>;
};


export type SurveySurveyInvitesArgs = {
  condition?: InputMaybe<SurveyInviteCondition>;
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<SurveyInvitesOrderBy>>;
};


export type SurveySurveyResponsesConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<SurveyResponseCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<SurveyResponsesOrderBy>>;
};

export enum SurveyAccessType {
  InviteOnly = 'INVITE_ONLY',
  Public = 'PUBLIC'
}

/** A condition to be used against `Survey` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type SurveyCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `projectId` field. */
  projectId?: InputMaybe<Scalars['Int']>;
};

export type SurveyConsentDocument = Node & {
  __typename?: 'SurveyConsentDocument';
  createdAt: Scalars['Datetime'];
  /** Reads a single `FormElement` that is related to this `SurveyConsentDocument`. */
  formElement?: Maybe<FormElement>;
  formElementId: Scalars['Int'];
  id: Scalars['Int'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  url: Scalars['String'];
  version: Scalars['Int'];
};

/**
 * A condition to be used against `SurveyConsentDocument` object types. All fields
 * are tested for equality and combined with a logical ‘and.’
 */
export type SurveyConsentDocumentCondition = {
  /** Checks for equality with the object’s `formElementId` field. */
  formElementId?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['Int']>;
};

/** A connection to a list of `SurveyConsentDocument` values. */
export type SurveyConsentDocumentsConnection = {
  __typename?: 'SurveyConsentDocumentsConnection';
  /** A list of edges which contains the `SurveyConsentDocument` and cursor to aid in pagination. */
  edges: Array<SurveyConsentDocumentsEdge>;
  /** A list of `SurveyConsentDocument` objects. */
  nodes: Array<SurveyConsentDocument>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `SurveyConsentDocument` you could get from the connection. */
  totalCount: Scalars['Int'];
};

/** A `SurveyConsentDocument` edge in the connection. */
export type SurveyConsentDocumentsEdge = {
  __typename?: 'SurveyConsentDocumentsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `SurveyConsentDocument` at the end of the edge. */
  node: SurveyConsentDocument;
};

/** Methods to use when ordering `SurveyConsentDocument`. */
export enum SurveyConsentDocumentsOrderBy {
  FormElementIdAsc = 'FORM_ELEMENT_ID_ASC',
  FormElementIdDesc = 'FORM_ELEMENT_ID_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

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
  condition?: InputMaybe<InviteEmailCondition>;
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<InviteEmailsOrderBy>>;
};

/**
 * A condition to be used against `SurveyInvite` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type SurveyInviteCondition = {
  /** Checks for equality with the object’s `email` field. */
  email?: InputMaybe<Scalars['Email']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `surveyId` field. */
  surveyId?: InputMaybe<Scalars['Int']>;
};

export type SurveyInviteOptionsInput = {
  email?: InputMaybe<Scalars['Email']>;
  fullname?: InputMaybe<Scalars['String']>;
};

/** Represents an update to a `SurveyInvite`. Fields that are set will be updated. */
export type SurveyInvitePatch = {
  fullname?: InputMaybe<Scalars['String']>;
};

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

export type SurveyInvitedGroup = {
  __typename?: 'SurveyInvitedGroup';
  groupId: Scalars['Int'];
  /** Reads a single `Survey` that is related to this `SurveyInvitedGroup`. */
  survey?: Maybe<Survey>;
  surveyId: Scalars['Int'];
};

/**
 * A condition to be used against `SurveyInvitedGroup` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type SurveyInvitedGroupCondition = {
  /** Checks for equality with the object’s `groupId` field. */
  groupId?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `surveyId` field. */
  surveyId?: InputMaybe<Scalars['Int']>;
};

/** An input for mutations affecting `SurveyInvitedGroup` */
export type SurveyInvitedGroupInput = {
  groupId: Scalars['Int'];
  surveyId: Scalars['Int'];
};

/** Methods to use when ordering `SurveyInvitedGroup`. */
export enum SurveyInvitedGroupsOrderBy {
  GroupIdAsc = 'GROUP_ID_ASC',
  GroupIdDesc = 'GROUP_ID_DESC',
  Natural = 'NATURAL',
  SurveyIdAsc = 'SURVEY_ID_ASC',
  SurveyIdDesc = 'SURVEY_ID_DESC'
}

/** A `SurveyInvite` edge in the connection. */
export type SurveyInvitesEdge = {
  __typename?: 'SurveyInvitesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `SurveyInvite` at the end of the edge. */
  node: SurveyInvite;
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

/** Represents an update to a `Survey`. Fields that are set will be updated. */
export type SurveyPatch = {
  /** PUBLIC or INVITE_ONLY */
  accessType?: InputMaybe<SurveyAccessType>;
  /** If set, responses that originate from an IP address outside this fence will be flagged. */
  geofence?: InputMaybe<Scalars['GeoJSON']>;
  id?: InputMaybe<Scalars['Int']>;
  /**
   * Disabled surveys will not be accessible to non-admins. Invite email sending will
   * be paused.
   */
  isDisabled?: InputMaybe<Scalars['Boolean']>;
  /**
   * If set, there can only be one response with matching contact information. The
   * app will also discourage multiple submissions from the same browser session.
   */
  limitToSingleResponse?: InputMaybe<Scalars['Boolean']>;
  name?: InputMaybe<Scalars['String']>;
  projectId?: InputMaybe<Scalars['Int']>;
  showFacilitationOption?: InputMaybe<Scalars['Boolean']>;
  showProgress?: InputMaybe<Scalars['Boolean']>;
  /**
   * Only applicable for public surveys. Show tools to respondants for sharing the
   * survey on social media to encourage responses.
   */
  showSocialMediaButtons?: InputMaybe<Scalars['Boolean']>;
  supportedLanguages?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
};

export type SurveyResponse = Node & {
  __typename?: 'SurveyResponse';
  accountEmail?: Maybe<Scalars['String']>;
  archived: Scalars['Boolean'];
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
  /** If true, a logged-in user entered information on behalf of another person, so userId is not as relevant. */
  isFacilitated: Scalars['Boolean'];
  isPractice: Scalars['Boolean'];
  /**
   * Unusual or missing user-agent headers on submissions are flagged. May indicate
   * scripting but does not necessarily imply malicious intent.
   */
  isUnrecognizedUserAgent: Scalars['Boolean'];
  lastUpdatedByEmail?: Maybe<Scalars['String']>;
  lastUpdatedById?: Maybe<Scalars['Int']>;
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
  /**
   * User account that submitted the survey. Note that if isFacilitated is set, the
   * account may not be who is represented by the response content.
   */
  userId?: Maybe<Scalars['Int']>;
};

/**
 * A condition to be used against `SurveyResponse` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type SurveyResponseCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `surveyId` field. */
  surveyId?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `userId` field. */
  userId?: InputMaybe<Scalars['Int']>;
};

/** Represents an update to a `SurveyResponse`. Fields that are set will be updated. */
export type SurveyResponsePatch = {
  archived?: InputMaybe<Scalars['Boolean']>;
  /** JSON representation of responses, keyed by the form field export_id */
  data?: InputMaybe<Scalars['JSON']>;
  /** Users may save their responses for later editing before submission. After submission they can no longer edit them. */
  isDraft?: InputMaybe<Scalars['Boolean']>;
  isPractice?: InputMaybe<Scalars['Boolean']>;
  updatedAt?: InputMaybe<Scalars['Datetime']>;
};

/** A connection to a list of `SurveyResponse` values. */
export type SurveyResponsesConnection = {
  __typename?: 'SurveyResponsesConnection';
  /** A list of edges which contains the `SurveyResponse` and cursor to aid in pagination. */
  edges: Array<SurveyResponsesEdge>;
  /** A list of `SurveyResponse` objects. */
  nodes: Array<SurveyResponse>;
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
  node: SurveyResponse;
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

export type SurveyTokenInfo = {
  __typename?: 'SurveyTokenInfo';
  projectId?: Maybe<Scalars['Int']>;
  surveyId?: Maybe<Scalars['Int']>;
  token?: Maybe<Scalars['String']>;
};

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

/**
 * TableOfContentsItems represent a tree-view of folders and operational layers
 * that can be added to the map. Both layers and folders may be nested into other
 * folders for organization, and each folder has its own access control list.
 *
 * Items that represent data layers have a `DataLayer` relation, which in turn has
 * a reference to a `DataSource`. Usually these relations should be fetched in
 * batch only once the layer is turned on, using the
 * `dataLayersAndSourcesByLayerId` query.
 */
export type TableOfContentsItem = Node & {
  __typename?: 'TableOfContentsItem';
  /** Reads a single `Acl` that is related to this `TableOfContentsItem`. */
  acl?: Maybe<Acl>;
  /** If set, users will be able to zoom to the bounds of this item. [minx, miny, maxx, maxy] */
  bounds?: Maybe<Array<Maybe<Scalars['BigFloat']>>>;
  /** Reads a single `DataLayer` that is related to this `TableOfContentsItem`. */
  dataLayer?: Maybe<DataLayer>;
  /** If is_folder=false, a DataLayers visibility will be controlled by this item */
  dataLayerId?: Maybe<Scalars['Int']>;
  enableDownload: Scalars['Boolean'];
  hideChildren: Scalars['Boolean'];
  id: Scalars['Int'];
  /**
   * If set, folders with this property cannot be toggled in order to activate all
   * their children. Toggles can only be used to toggle children off
   */
  isClickOffOnly: Scalars['Boolean'];
  /**
   * Identifies whether this item is part of the draft table of contents edited by
   * admin or the static public version. This property cannot be changed. Rather,
   * use the `publishTableOfContents()` mutation
   */
  isDraft: Scalars['Boolean'];
  /** If not a folder, the item is a layer-type and must have a data_layer_id */
  isFolder: Scalars['Boolean'];
  /** DraftJS compatible representation of text content to display when a user requests layer metadata. Not valid for Folders */
  metadata?: Maybe<Scalars['JSON']>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /**
   * stable_id of the parent folder, if any. This property cannot be changed
   * directly. To rearrange items into folders, use the
   * `updateTableOfContentsItemParent` mutation.
   */
  parentStableId?: Maybe<Scalars['String']>;
  projectId: Scalars['Int'];
  /** If set, children of this folder will appear as radio options so that only one may be toggle at a time */
  showRadioChildren: Scalars['Boolean'];
  /** Position in the layer list */
  sortIndex: Scalars['Int'];
  /**
   * The stable_id property must be set by clients when creating new items. [Nanoid](https://github.com/ai/nanoid#readme)
   * should be used with a custom alphabet that excludes dashes and has a lenght of
   * 9. The purpose of the stable_id is to control the nesting arrangement of items
   * and provide a stable reference for layer visibility settings and map bookmarks.
   * When published, the id primary key property of the item will change but not the
   * stable_id.
   */
  stableId: Scalars['String'];
  /** Name used in the table of contents rendering */
  title: Scalars['String'];
};

/**
 * A condition to be used against `TableOfContentsItem` object types. All fields
 * are tested for equality and combined with a logical ‘and.’
 */
export type TableOfContentsItemCondition = {
  /** Checks for equality with the object’s `dataLayerId` field. */
  dataLayerId?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `isDraft` field. */
  isDraft?: InputMaybe<Scalars['Boolean']>;
  /** Checks for equality with the object’s `projectId` field. */
  projectId?: InputMaybe<Scalars['Int']>;
};

/** An input for mutations affecting `TableOfContentsItem` */
export type TableOfContentsItemInput = {
  /** If set, users will be able to zoom to the bounds of this item. [minx, miny, maxx, maxy] */
  bounds?: InputMaybe<Array<InputMaybe<Scalars['BigFloat']>>>;
  /** If is_folder=false, a DataLayers visibility will be controlled by this item */
  dataLayerId?: InputMaybe<Scalars['Int']>;
  enableDownload?: InputMaybe<Scalars['Boolean']>;
  hideChildren?: InputMaybe<Scalars['Boolean']>;
  /**
   * If set, folders with this property cannot be toggled in order to activate all
   * their children. Toggles can only be used to toggle children off
   */
  isClickOffOnly?: InputMaybe<Scalars['Boolean']>;
  /** If not a folder, the item is a layer-type and must have a data_layer_id */
  isFolder?: InputMaybe<Scalars['Boolean']>;
  /** DraftJS compatible representation of text content to display when a user requests layer metadata. Not valid for Folders */
  metadata?: InputMaybe<Scalars['JSON']>;
  /**
   * stable_id of the parent folder, if any. This property cannot be changed
   * directly. To rearrange items into folders, use the
   * `updateTableOfContentsItemParent` mutation.
   */
  parentStableId?: InputMaybe<Scalars['String']>;
  projectId: Scalars['Int'];
  /** If set, children of this folder will appear as radio options so that only one may be toggle at a time */
  showRadioChildren?: InputMaybe<Scalars['Boolean']>;
  /**
   * The stable_id property must be set by clients when creating new items. [Nanoid](https://github.com/ai/nanoid#readme)
   * should be used with a custom alphabet that excludes dashes and has a lenght of
   * 9. The purpose of the stable_id is to control the nesting arrangement of items
   * and provide a stable reference for layer visibility settings and map bookmarks.
   * When published, the id primary key property of the item will change but not the
   * stable_id.
   */
  stableId: Scalars['String'];
  /** Name used in the table of contents rendering */
  title: Scalars['String'];
};

/** Represents an update to a `TableOfContentsItem`. Fields that are set will be updated. */
export type TableOfContentsItemPatch = {
  /** If set, users will be able to zoom to the bounds of this item. [minx, miny, maxx, maxy] */
  bounds?: InputMaybe<Array<InputMaybe<Scalars['BigFloat']>>>;
  /** If is_folder=false, a DataLayers visibility will be controlled by this item */
  dataLayerId?: InputMaybe<Scalars['Int']>;
  enableDownload?: InputMaybe<Scalars['Boolean']>;
  hideChildren?: InputMaybe<Scalars['Boolean']>;
  /**
   * If set, folders with this property cannot be toggled in order to activate all
   * their children. Toggles can only be used to toggle children off
   */
  isClickOffOnly?: InputMaybe<Scalars['Boolean']>;
  /** DraftJS compatible representation of text content to display when a user requests layer metadata. Not valid for Folders */
  metadata?: InputMaybe<Scalars['JSON']>;
  /** If set, children of this folder will appear as radio options so that only one may be toggle at a time */
  showRadioChildren?: InputMaybe<Scalars['Boolean']>;
  /** Name used in the table of contents rendering */
  title?: InputMaybe<Scalars['String']>;
};

/** A connection to a list of `TableOfContentsItem` values. */
export type TableOfContentsItemsConnection = {
  __typename?: 'TableOfContentsItemsConnection';
  /** A list of edges which contains the `TableOfContentsItem` and cursor to aid in pagination. */
  edges: Array<TableOfContentsItemsEdge>;
  /** A list of `TableOfContentsItem` objects. */
  nodes: Array<TableOfContentsItem>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `TableOfContentsItem` you could get from the connection. */
  totalCount: Scalars['Int'];
};

/** A `TableOfContentsItem` edge in the connection. */
export type TableOfContentsItemsEdge = {
  __typename?: 'TableOfContentsItemsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `TableOfContentsItem` at the end of the edge. */
  node: TableOfContentsItem;
};

/** Methods to use when ordering `TableOfContentsItem`. */
export enum TableOfContentsItemsOrderBy {
  DataLayerIdAsc = 'DATA_LAYER_ID_ASC',
  DataLayerIdDesc = 'DATA_LAYER_ID_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  IsDraftAsc = 'IS_DRAFT_ASC',
  IsDraftDesc = 'IS_DRAFT_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ProjectIdAsc = 'PROJECT_ID_ASC',
  ProjectIdDesc = 'PROJECT_ID_DESC'
}

export enum TileScheme {
  Tms = 'TMS',
  Xyz = 'XYZ'
}

/** All input for the `toggleAdminAccess` mutation. */
export type ToggleAdminAccessInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  projectId?: InputMaybe<Scalars['Int']>;
  userId?: InputMaybe<Scalars['Int']>;
};

/** The output of our `toggleAdminAccess` mutation. */
export type ToggleAdminAccessPayload = {
  __typename?: 'ToggleAdminAccessPayload';
  boolean?: Maybe<Scalars['Boolean']>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `toggleForumPostingBan` mutation. */
export type ToggleForumPostingBanInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  projectId?: InputMaybe<Scalars['Int']>;
  userId?: InputMaybe<Scalars['Int']>;
};

/** The output of our `toggleForumPostingBan` mutation. */
export type ToggleForumPostingBanPayload = {
  __typename?: 'ToggleForumPostingBanPayload';
  boolean?: Maybe<Scalars['Boolean']>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `toggleResponsesPractice` mutation. */
export type ToggleResponsesPracticeInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  ids?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
  isPractice?: InputMaybe<Scalars['Boolean']>;
};

/** The output of our `toggleResponsesPractice` mutation. */
export type ToggleResponsesPracticePayload = {
  __typename?: 'ToggleResponsesPracticePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  surveyResponses?: Maybe<Array<SurveyResponse>>;
};

export type Topic = Node & {
  __typename?: 'Topic';
  authorId: Scalars['Int'];
  /** User Profile of the author. If a user has not shared their profile the first post contents will be hidden. */
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
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<PostCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<PostsOrderBy>>;
};

/** A condition to be used against `Topic` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type TopicCondition = {
  /** Checks for equality with the object’s `forumId` field. */
  forumId?: InputMaybe<Scalars['Int']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['Int']>;
};

/** Represents an update to a `Topic`. Fields that are set will be updated. */
export type TopicPatch = {
  /**
   * Locked topics can only be posted to by project admins and will display a lock symbol.
   *
   * Can be toggled by project admins using `setTopicLocked()` mutation.
   */
  locked?: InputMaybe<Scalars['Boolean']>;
  /**
   * Sticky topics will be listed at the topic of the forum.
   *
   * Can be toggled by project admins using `setTopicSticky()` mutation.
   */
  sticky?: InputMaybe<Scalars['Boolean']>;
  /** Title displayed in the topics listing. Can be updated in the first 5 minutes after creation. */
  title?: InputMaybe<Scalars['String']>;
};

/** A connection to a list of `Topic` values. */
export type TopicsConnection = {
  __typename?: 'TopicsConnection';
  /** A list of edges which contains the `Topic` and cursor to aid in pagination. */
  edges: Array<TopicsEdge>;
  /** A list of `Topic` objects. */
  nodes: Array<Topic>;
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
  node: Topic;
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

export type UnsplashLinks = {
  __typename?: 'UnsplashLinks';
  html: Scalars['String'];
};

export type UnsplashPhoto = {
  __typename?: 'UnsplashPhoto';
  blur_hash?: Maybe<Scalars['String']>;
  color: Scalars['String'];
  description?: Maybe<Scalars['String']>;
  height: Scalars['Int'];
  id: Scalars['String'];
  links: UnsplashPhotoLinks;
  urls: UnsplashUrls;
  user: UnsplashUser;
  width: Scalars['Int'];
};

export type UnsplashPhotoLinks = {
  __typename?: 'UnsplashPhotoLinks';
  download_location: Scalars['String'];
};

export type UnsplashSearchResult = {
  __typename?: 'UnsplashSearchResult';
  results: Array<UnsplashPhoto>;
  total: Scalars['Int'];
  total_pages: Scalars['Int'];
};

export type UnsplashUrls = {
  __typename?: 'UnsplashUrls';
  full: Scalars['String'];
  raw: Scalars['String'];
  regular: Scalars['String'];
  small: Scalars['String'];
  thumb: Scalars['String'];
};

export type UnsplashUser = {
  __typename?: 'UnsplashUser';
  id: Scalars['String'];
  links: UnsplashLinks;
  name: Scalars['String'];
  username: Scalars['String'];
};

/** All input for the `updateAclByBasemapId` mutation. */
export type UpdateAclByBasemapIdInput = {
  basemapId: Scalars['Int'];
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** An object where the defined keys will be set on the `Acl` being updated. */
  patch: AclPatch;
};

/** All input for the `updateAclByNodeId` mutation. */
export type UpdateAclByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** An object where the defined keys will be set on the `Acl` being updated. */
  patch: AclPatch;
  sketchClassId: Scalars['Int'];
};

/** All input for the `updateAclByTableOfContentsItemId` mutation. */
export type UpdateAclByTableOfContentsItemIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** An object where the defined keys will be set on the `Acl` being updated. */
  patch: AclPatch;
  tableOfContentsItemId: Scalars['Int'];
};

/** All input for the `updateAcl` mutation. */
export type UpdateAclInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `Acl` being updated. */
  patch: AclPatch;
};

/** The output of our update `Acl` mutation. */
export type UpdateAclPayload = {
  __typename?: 'UpdateAclPayload';
  /** The `Acl` that was updated by this mutation. */
  acl?: Maybe<Acl>;
  /** Reads a single `Basemap` that is related to this `Acl`. */
  basemap?: Maybe<Basemap>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `SketchClass` that is related to this `Acl`. */
  sketchClass?: Maybe<SketchClass>;
  /** Reads a single `TableOfContentsItem` that is related to this `Acl`. */
  tableOfContentsItem?: Maybe<TableOfContentsItem>;
};

/** All input for the `updateBasemapByNodeId` mutation. */
export type UpdateBasemapByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Basemap` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `Basemap` being updated. */
  patch: BasemapPatch;
};

/** All input for the `updateBasemap` mutation. */
export type UpdateBasemapInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `Basemap` being updated. */
  patch: BasemapPatch;
};

/** The output of our update `Basemap` mutation. */
export type UpdateBasemapPayload = {
  __typename?: 'UpdateBasemapPayload';
  /** The `Basemap` that was updated by this mutation. */
  basemap?: Maybe<Basemap>;
  /** An edge for our `Basemap`. May be used by Relay 1. */
  basemapEdge?: Maybe<BasemapsEdge>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `InteractivitySetting` that is related to this `Basemap`. */
  interactivitySettings?: Maybe<InteractivitySetting>;
  /** Reads a single `Project` that is related to this `Basemap`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our update `Basemap` mutation. */
export type UpdateBasemapPayloadBasemapEdgeArgs = {
  orderBy?: InputMaybe<Array<BasemapsOrderBy>>;
};

/** All input for the `updateCommunityGuidelineByNodeId` mutation. */
export type UpdateCommunityGuidelineByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
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

/** All input for the `updateDataLayerByInteractivitySettingsId` mutation. */
export type UpdateDataLayerByInteractivitySettingsIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  interactivitySettingsId: Scalars['Int'];
  /** An object where the defined keys will be set on the `DataLayer` being updated. */
  patch: DataLayerPatch;
};

/** All input for the `updateDataLayerByNodeId` mutation. */
export type UpdateDataLayerByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `DataLayer` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `DataLayer` being updated. */
  patch: DataLayerPatch;
};

/** All input for the `updateDataLayer` mutation. */
export type UpdateDataLayerInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `DataLayer` being updated. */
  patch: DataLayerPatch;
};

/** The output of our update `DataLayer` mutation. */
export type UpdateDataLayerPayload = {
  __typename?: 'UpdateDataLayerPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `DataLayer` that was updated by this mutation. */
  dataLayer?: Maybe<DataLayer>;
  /** An edge for our `DataLayer`. May be used by Relay 1. */
  dataLayerEdge?: Maybe<DataLayersEdge>;
  /** Reads a single `DataSource` that is related to this `DataLayer`. */
  dataSource?: Maybe<DataSource>;
  /** Reads a single `InteractivitySetting` that is related to this `DataLayer`. */
  interactivitySettings?: Maybe<InteractivitySetting>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our update `DataLayer` mutation. */
export type UpdateDataLayerPayloadDataLayerEdgeArgs = {
  orderBy?: InputMaybe<Array<DataLayersOrderBy>>;
};

/** All input for the `updateDataSourceByNodeId` mutation. */
export type UpdateDataSourceByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `DataSource` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `DataSource` being updated. */
  patch: DataSourcePatch;
};

/** All input for the `updateDataSource` mutation. */
export type UpdateDataSourceInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** Should be used as sourceId in stylesheets. */
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `DataSource` being updated. */
  patch: DataSourcePatch;
};

/** The output of our update `DataSource` mutation. */
export type UpdateDataSourcePayload = {
  __typename?: 'UpdateDataSourcePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `DataSource` that was updated by this mutation. */
  dataSource?: Maybe<DataSource>;
  /** An edge for our `DataSource`. May be used by Relay 1. */
  dataSourceEdge?: Maybe<DataSourcesEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our update `DataSource` mutation. */
export type UpdateDataSourcePayloadDataSourceEdgeArgs = {
  orderBy?: InputMaybe<Array<DataSourcesOrderBy>>;
};

/** All input for the `updateEmailNotificationPreferenceByUserId` mutation. */
export type UpdateEmailNotificationPreferenceByUserIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  orderBy?: InputMaybe<Array<EmailNotificationPreferencesOrderBy>>;
};

/** All input for the `updateFormByNodeId` mutation. */
export type UpdateFormByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Form` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `Form` being updated. */
  patch: FormPatch;
};

/** All input for the `updateFormBySketchClassId` mutation. */
export type UpdateFormBySketchClassIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** An object where the defined keys will be set on the `Form` being updated. */
  patch: FormPatch;
  /** Related *SketchClass* */
  sketchClassId: Scalars['Int'];
};

/** All input for the `updateFormBySurveyId` mutation. */
export type UpdateFormBySurveyIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** An object where the defined keys will be set on the `Form` being updated. */
  patch: FormPatch;
  /** Related *Survey* */
  surveyId: Scalars['Int'];
};

/** All input for the `updateFormElementByNodeId` mutation. */
export type UpdateFormElementByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `FormElement` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `FormElement` being updated. */
  patch: FormElementPatch;
};

/** All input for the `updateFormElement` mutation. */
export type UpdateFormElementInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `FormElement` being updated. */
  patch: FormElementPatch;
};

/** The output of our update `FormElement` mutation. */
export type UpdateFormElementPayload = {
  __typename?: 'UpdateFormElementPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `FormElement` that was updated by this mutation. */
  formElement?: Maybe<FormElement>;
  /** An edge for our `FormElement`. May be used by Relay 1. */
  formElementEdge?: Maybe<FormElementsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our update `FormElement` mutation. */
export type UpdateFormElementPayloadFormElementEdgeArgs = {
  orderBy?: InputMaybe<Array<FormElementsOrderBy>>;
};

/** All input for the `updateForm` mutation. */
export type UpdateFormInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `Form` being updated. */
  patch: FormPatch;
};

/** All input for the `updateFormLogicConditionByNodeId` mutation. */
export type UpdateFormLogicConditionByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `FormLogicCondition` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `FormLogicCondition` being updated. */
  patch: FormLogicConditionPatch;
};

/** All input for the `updateFormLogicCondition` mutation. */
export type UpdateFormLogicConditionInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `FormLogicCondition` being updated. */
  patch: FormLogicConditionPatch;
};

/** The output of our update `FormLogicCondition` mutation. */
export type UpdateFormLogicConditionPayload = {
  __typename?: 'UpdateFormLogicConditionPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `FormLogicCondition` that was updated by this mutation. */
  formLogicCondition?: Maybe<FormLogicCondition>;
  /** An edge for our `FormLogicCondition`. May be used by Relay 1. */
  formLogicConditionEdge?: Maybe<FormLogicConditionsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our update `FormLogicCondition` mutation. */
export type UpdateFormLogicConditionPayloadFormLogicConditionEdgeArgs = {
  orderBy?: InputMaybe<Array<FormLogicConditionsOrderBy>>;
};

/** All input for the `updateFormLogicRuleByNodeId` mutation. */
export type UpdateFormLogicRuleByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `FormLogicRule` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `FormLogicRule` being updated. */
  patch: FormLogicRulePatch;
};

/** All input for the `updateFormLogicRule` mutation. */
export type UpdateFormLogicRuleInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `FormLogicRule` being updated. */
  patch: FormLogicRulePatch;
};

/** The output of our update `FormLogicRule` mutation. */
export type UpdateFormLogicRulePayload = {
  __typename?: 'UpdateFormLogicRulePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `FormLogicRule` that was updated by this mutation. */
  formLogicRule?: Maybe<FormLogicRule>;
  /** An edge for our `FormLogicRule`. May be used by Relay 1. */
  formLogicRuleEdge?: Maybe<FormLogicRulesEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our update `FormLogicRule` mutation. */
export type UpdateFormLogicRulePayloadFormLogicRuleEdgeArgs = {
  orderBy?: InputMaybe<Array<FormLogicRulesOrderBy>>;
};

/** The output of our update `Form` mutation. */
export type UpdateFormPayload = {
  __typename?: 'UpdateFormPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `Form` that was updated by this mutation. */
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


/** The output of our update `Form` mutation. */
export type UpdateFormPayloadFormEdgeArgs = {
  orderBy?: InputMaybe<Array<FormsOrderBy>>;
};

/** All input for the `updateForumByNodeId` mutation. */
export type UpdateForumByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  orderBy?: InputMaybe<Array<ForumsOrderBy>>;
};

/** All input for the `updateGroupByNodeId` mutation. */
export type UpdateGroupByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
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

/** All input for the `updateInteractivitySettingByNodeId` mutation. */
export type UpdateInteractivitySettingByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `InteractivitySetting` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `InteractivitySetting` being updated. */
  patch: InteractivitySettingPatch;
};

/** All input for the `updateInteractivitySetting` mutation. */
export type UpdateInteractivitySettingInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `InteractivitySetting` being updated. */
  patch: InteractivitySettingPatch;
};

/** The output of our update `InteractivitySetting` mutation. */
export type UpdateInteractivitySettingPayload = {
  __typename?: 'UpdateInteractivitySettingPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `InteractivitySetting` that was updated by this mutation. */
  interactivitySetting?: Maybe<InteractivitySetting>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `updateMapboxSecretKey` mutation. */
export type UpdateMapboxSecretKeyInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  projectId?: InputMaybe<Scalars['Int']>;
  secret?: InputMaybe<Scalars['String']>;
};

/** The output of our `updateMapboxSecretKey` mutation. */
export type UpdateMapboxSecretKeyPayload = {
  __typename?: 'UpdateMapboxSecretKeyPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `DataSourcesBucket` that is related to this `Project`. */
  dataSourcesBucket?: Maybe<DataSourcesBucket>;
  project?: Maybe<Project>;
  /** An edge for our `Project`. May be used by Relay 1. */
  projectEdge?: Maybe<ProjectsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `updateMapboxSecretKey` mutation. */
export type UpdateMapboxSecretKeyPayloadProjectEdgeArgs = {
  orderBy?: InputMaybe<Array<ProjectsOrderBy>>;
};

/** All input for the `updateOptionalBasemapLayerByNodeId` mutation. */
export type UpdateOptionalBasemapLayerByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `OptionalBasemapLayer` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `OptionalBasemapLayer` being updated. */
  patch: OptionalBasemapLayerPatch;
};

/** All input for the `updateOptionalBasemapLayer` mutation. */
export type UpdateOptionalBasemapLayerInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `OptionalBasemapLayer` being updated. */
  patch: OptionalBasemapLayerPatch;
};

/** The output of our update `OptionalBasemapLayer` mutation. */
export type UpdateOptionalBasemapLayerPayload = {
  __typename?: 'UpdateOptionalBasemapLayerPayload';
  /** Reads a single `Basemap` that is related to this `OptionalBasemapLayer`. */
  basemap?: Maybe<Basemap>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `OptionalBasemapLayer` that was updated by this mutation. */
  optionalBasemapLayer?: Maybe<OptionalBasemapLayer>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `updatePost` mutation. */
export type UpdatePostInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  message?: InputMaybe<Scalars['JSON']>;
  postId?: InputMaybe<Scalars['Int']>;
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
  orderBy?: InputMaybe<Array<PostsOrderBy>>;
};

/** All input for the `updateProfileByUserId` mutation. */
export type UpdateProfileByUserIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  orderBy?: InputMaybe<Array<ProfilesOrderBy>>;
};

/** All input for the `updateProjectByNodeId` mutation. */
export type UpdateProjectByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `Project` being updated. */
  patch: ProjectPatch;
};

/** All input for the `updateProjectInviteGroupByInviteIdAndGroupId` mutation. */
export type UpdateProjectInviteGroupByInviteIdAndGroupIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  /** Reads a single `Group` that is related to this `ProjectInviteGroup`. */
  group?: Maybe<Group>;
  /** Reads a single `ProjectInvite` that is related to this `ProjectInviteGroup`. */
  invite?: Maybe<ProjectInvite>;
  /** The `ProjectInviteGroup` that was updated by this mutation. */
  projectInviteGroup?: Maybe<ProjectInviteGroup>;
  /** An edge for our `ProjectInviteGroup`. May be used by Relay 1. */
  projectInviteGroupEdge?: Maybe<ProjectInviteGroupsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our update `ProjectInviteGroup` mutation. */
export type UpdateProjectInviteGroupPayloadProjectInviteGroupEdgeArgs = {
  orderBy?: InputMaybe<Array<ProjectInviteGroupsOrderBy>>;
};

/** All input for the `updateProjectInvite` mutation. */
export type UpdateProjectInviteInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  email?: InputMaybe<Scalars['String']>;
  fullname?: InputMaybe<Scalars['String']>;
  groups?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
  inviteId?: InputMaybe<Scalars['Int']>;
  makeAdmin?: InputMaybe<Scalars['Boolean']>;
};

/** The output of our `updateProjectInvite` mutation. */
export type UpdateProjectInvitePayload = {
  __typename?: 'UpdateProjectInvitePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  /** Reads a single `DataSourcesBucket` that is related to this `Project`. */
  dataSourcesBucket?: Maybe<DataSourcesBucket>;
  /** The `Project` that was updated by this mutation. */
  project?: Maybe<Project>;
  /** An edge for our `Project`. May be used by Relay 1. */
  projectEdge?: Maybe<ProjectsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our update `Project` mutation. */
export type UpdateProjectPayloadProjectEdgeArgs = {
  orderBy?: InputMaybe<Array<ProjectsOrderBy>>;
};

/** All input for the `updateProjectsSharedBasemapByBasemapIdAndProjectId` mutation. */
export type UpdateProjectsSharedBasemapByBasemapIdAndProjectIdInput = {
  basemapId: Scalars['Int'];
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** An object where the defined keys will be set on the `ProjectsSharedBasemap` being updated. */
  patch: ProjectsSharedBasemapPatch;
  projectId: Scalars['Int'];
};

/** The output of our update `ProjectsSharedBasemap` mutation. */
export type UpdateProjectsSharedBasemapPayload = {
  __typename?: 'UpdateProjectsSharedBasemapPayload';
  /** Reads a single `Basemap` that is related to this `ProjectsSharedBasemap`. */
  basemap?: Maybe<Basemap>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `ProjectsSharedBasemap` that was updated by this mutation. */
  projectsSharedBasemap?: Maybe<ProjectsSharedBasemap>;
  /** An edge for our `ProjectsSharedBasemap`. May be used by Relay 1. */
  projectsSharedBasemapEdge?: Maybe<ProjectsSharedBasemapsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our update `ProjectsSharedBasemap` mutation. */
export type UpdateProjectsSharedBasemapPayloadProjectsSharedBasemapEdgeArgs = {
  orderBy?: InputMaybe<Array<ProjectsSharedBasemapsOrderBy>>;
};

/** All input for the `updateSketchByNodeId` mutation. */
export type UpdateSketchByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Sketch` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `Sketch` being updated. */
  patch: SketchPatch;
};

/** All input for the `updateSketchClassByFormElementId` mutation. */
export type UpdateSketchClassByFormElementIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** If set, this sketch class is only for use in a survey indicated by the form_element. */
  formElementId: Scalars['Int'];
  /** An object where the defined keys will be set on the `SketchClass` being updated. */
  patch: SketchClassPatch;
};

/** All input for the `updateSketchClassByNodeId` mutation. */
export type UpdateSketchClassByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  /** Reads a single `FormElement` that is related to this `SketchClass`. */
  formElement?: Maybe<FormElement>;
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
  orderBy?: InputMaybe<Array<SketchClassesOrderBy>>;
};

/** All input for the `updateSketchFolderByNodeId` mutation. */
export type UpdateSketchFolderByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  orderBy?: InputMaybe<Array<SketchFoldersOrderBy>>;
};

/** All input for the `updateSketch` mutation. */
export type UpdateSketchInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  /** Reads a single `FormElement` that is related to this `Sketch`. */
  formElement?: Maybe<FormElement>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `SurveyInvite` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `SurveyInvite` being updated. */
  patch: SurveyInvitePatch;
};

/** All input for the `updateSurveyInvite` mutation. */
export type UpdateSurveyInviteInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  orderBy?: InputMaybe<Array<SurveyInvitesOrderBy>>;
};

/** All input for the `updateSurveyInvitedGroups` mutation. */
export type UpdateSurveyInvitedGroupsInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  groupIds?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
  surveyId?: InputMaybe<Scalars['Int']>;
};

/** The output of our `updateSurveyInvitedGroups` mutation. */
export type UpdateSurveyInvitedGroupsPayload = {
  __typename?: 'UpdateSurveyInvitedGroupsPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  groups?: Maybe<Array<Group>>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  orderBy?: InputMaybe<Array<SurveyResponsesOrderBy>>;
};

/** All input for the `updateTableOfContentsItemByDataLayerId` mutation. */
export type UpdateTableOfContentsItemByDataLayerIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** If is_folder=false, a DataLayers visibility will be controlled by this item */
  dataLayerId: Scalars['Int'];
  /** An object where the defined keys will be set on the `TableOfContentsItem` being updated. */
  patch: TableOfContentsItemPatch;
};

/** All input for the `updateTableOfContentsItemByNodeId` mutation. */
export type UpdateTableOfContentsItemByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `TableOfContentsItem` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `TableOfContentsItem` being updated. */
  patch: TableOfContentsItemPatch;
};

/** All input for the `updateTableOfContentsItemChildren` mutation. */
export type UpdateTableOfContentsItemChildrenInput = {
  childIds?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  parentId?: InputMaybe<Scalars['Int']>;
};

/** The output of our `updateTableOfContentsItemChildren` mutation. */
export type UpdateTableOfContentsItemChildrenPayload = {
  __typename?: 'UpdateTableOfContentsItemChildrenPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  tableOfContentsItems?: Maybe<Array<TableOfContentsItem>>;
};

/** All input for the `updateTableOfContentsItem` mutation. */
export type UpdateTableOfContentsItemInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `TableOfContentsItem` being updated. */
  patch: TableOfContentsItemPatch;
};

/** The output of our update `TableOfContentsItem` mutation. */
export type UpdateTableOfContentsItemPayload = {
  __typename?: 'UpdateTableOfContentsItemPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Reads a single `DataLayer` that is related to this `TableOfContentsItem`. */
  dataLayer?: Maybe<DataLayer>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** The `TableOfContentsItem` that was updated by this mutation. */
  tableOfContentsItem?: Maybe<TableOfContentsItem>;
  /** An edge for our `TableOfContentsItem`. May be used by Relay 1. */
  tableOfContentsItemEdge?: Maybe<TableOfContentsItemsEdge>;
};


/** The output of our update `TableOfContentsItem` mutation. */
export type UpdateTableOfContentsItemPayloadTableOfContentsItemEdgeArgs = {
  orderBy?: InputMaybe<Array<TableOfContentsItemsOrderBy>>;
};

/** All input for the `updateTopicByNodeId` mutation. */
export type UpdateTopicByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  clientMutationId?: InputMaybe<Scalars['String']>;
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
  orderBy?: InputMaybe<Array<TopicsOrderBy>>;
};

/** All input for the `updateZIndexes` mutation. */
export type UpdateZIndexesInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']>;
  dataLayerIds?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
};

/** The output of our `updateZIndexes` mutation. */
export type UpdateZIndexesPayload = {
  __typename?: 'UpdateZIndexesPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  dataLayers?: Maybe<Array<DataLayer>>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
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
   * Only visible to admins of projects a user has joined. Can be used for
   * identification purposes since users will not gain any access control
   * privileges until this email has been confirmed.
   */
  canonicalEmail?: Maybe<Scalars['String']>;
  /** Reads a single `EmailNotificationPreference` that is related to this `User`. */
  emailNotificationPreference?: Maybe<EmailNotificationPreference>;
  /**
   * Reads and enables pagination through a set of `EmailNotificationPreference`.
   * @deprecated Please use emailNotificationPreference instead
   */
  emailNotificationPreferencesConnection: EmailNotificationPreferencesConnection;
  /** List of groups for the given project and user. Only available to project admins. */
  groups?: Maybe<Array<Group>>;
  id: Scalars['Int'];
  /** Indicates if user is admin on the current project, indicated by the `x-ss-slug` header. */
  isAdmin?: Maybe<Scalars['Boolean']>;
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
  /** Reads a single `Profile` that is related to this `User`. */
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
export type UserEmailNotificationPreferencesConnectionArgs = {
  after?: InputMaybe<Scalars['Cursor']>;
  before?: InputMaybe<Scalars['Cursor']>;
  condition?: InputMaybe<EmailNotificationPreferenceCondition>;
  first?: InputMaybe<Scalars['Int']>;
  last?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<Array<EmailNotificationPreferencesOrderBy>>;
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
export type UserGroupsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
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
  projectId?: InputMaybe<Scalars['Int']>;
};

/** A `User` edge in the connection. */
export type UsersEdge = {
  __typename?: 'UsersEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `User` at the end of the edge. */
  node: User;
};

/** Methods to use when ordering `User`. */
export enum UsersOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

export type ProjectBucketSettingQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type ProjectBucketSettingQuery = { __typename?: 'Query', projectBySlug?: { __typename: 'Project', id: number, dataSourcesBucket?: { __typename?: 'DataSourcesBucket', url: string, region: string, name: string, location: { __typename?: 'GeometryPoint', geojson?: any | null } } | null } | null, dataSourcesBucketsConnection?: { __typename?: 'DataSourcesBucketsConnection', nodes: Array<{ __typename?: 'DataSourcesBucket', url: string, name: string, region: string, location: { __typename?: 'GeometryPoint', geojson?: any | null } }> } | null };

export type UpdateProjectStorageBucketMutationVariables = Exact<{
  slug: Scalars['String'];
  bucket: Scalars['String'];
}>;


export type UpdateProjectStorageBucketMutation = { __typename?: 'Mutation', updateProjectBySlug?: { __typename?: 'UpdateProjectPayload', clientMutationId?: string | null, project?: { __typename: 'Project', id: number, dataSourcesBucket?: { __typename?: 'DataSourcesBucket', url: string, region: string, name: string } | null } | null } | null };

export type LogicRuleEditorFormElementFragment = { __typename?: 'FormElement', id: number, body: any, typeId: string, formId: number, jumpToId?: number | null, componentSettings: any, exportId?: string | null, isRequired: boolean, type?: { __typename?: 'FormElementType', supportedOperators: Array<FieldRuleOperator | null>, isInput: boolean } | null };

export type LogicRuleEditorRuleFragment = { __typename?: 'FormLogicRule', booleanOperator: FormLogicOperator, command: FormLogicCommand, formElementId: number, id: number, jumpToId?: number | null, position: number, conditions?: Array<{ __typename?: 'FormLogicCondition', id: number, operator: FieldRuleOperator, ruleId: number, subjectId: number, value?: any | null }> | null };

export type MapboxApiKeysQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type MapboxApiKeysQuery = { __typename?: 'Query', projectBySlug?: { __typename?: 'Project', id: number, mapboxPublicKey?: string | null, mapboxSecretKey?: string | null } | null };

export type UpdatePublicKeyMutationVariables = Exact<{
  id: Scalars['Int'];
  public?: InputMaybe<Scalars['String']>;
}>;


export type UpdatePublicKeyMutation = { __typename?: 'Mutation', updateProject?: { __typename?: 'UpdateProjectPayload', project?: { __typename?: 'Project', id: number, mapboxPublicKey?: string | null } | null } | null };

export type UpdateSecretKeyMutationVariables = Exact<{
  id: Scalars['Int'];
  mapboxSecretKey?: InputMaybe<Scalars['String']>;
}>;


export type UpdateSecretKeyMutation = { __typename?: 'Mutation', updateMapboxSecretKey?: { __typename?: 'UpdateMapboxSecretKeyPayload', project?: { __typename?: 'Project', id: number, mapboxSecretKey?: string | null } | null } | null };

export type GetAclQueryVariables = Exact<{
  nodeId: Scalars['ID'];
}>;


export type GetAclQuery = { __typename?: 'Query', aclByNodeId?: { __typename?: 'Acl', id: number, nodeId: string, type: AccessControlListType, groups?: Array<{ __typename?: 'Group', id: number, name: string, memberCount?: number | null }> | null } | null };

export type UpdateAclTypeMutationVariables = Exact<{
  nodeId: Scalars['ID'];
  type: AccessControlListType;
}>;


export type UpdateAclTypeMutation = { __typename?: 'Mutation', updateAclByNodeId?: { __typename?: 'UpdateAclPayload', acl?: { __typename?: 'Acl', id: number, nodeId: string, type: AccessControlListType } | null } | null };

export type AddGroupToAclMutationVariables = Exact<{
  id: Scalars['Int'];
  groupId: Scalars['Int'];
}>;


export type AddGroupToAclMutation = { __typename?: 'Mutation', addGroupToAcl?: { __typename?: 'AddGroupToAclPayload', acl?: { __typename?: 'Acl', groups?: Array<{ __typename?: 'Group', id: number, name: string }> | null } | null } | null };

export type RemoveGroupFromAclMutationVariables = Exact<{
  id: Scalars['Int'];
  groupId: Scalars['Int'];
}>;


export type RemoveGroupFromAclMutation = { __typename?: 'Mutation', removeGroupFromAcl?: { __typename?: 'RemoveGroupFromAclPayload', acl?: { __typename?: 'Acl', groups?: Array<{ __typename?: 'Group', id: number, name: string }> | null } | null } | null };

export type GroupsQueryVariables = Exact<{
  projectSlug: Scalars['String'];
}>;


export type GroupsQuery = { __typename?: 'Query', projectBySlug?: { __typename?: 'Project', id: number, groups: Array<{ __typename?: 'Group', id: number, name: string, memberCount?: number | null }> } | null };

export type CreateTableOfContentsItemMutationVariables = Exact<{
  title: Scalars['String'];
  stableId: Scalars['String'];
  projectId: Scalars['Int'];
  isFolder: Scalars['Boolean'];
  parentStableId?: InputMaybe<Scalars['String']>;
  metadata?: InputMaybe<Scalars['JSON']>;
  bounds?: InputMaybe<Array<InputMaybe<Scalars['BigFloat']>> | InputMaybe<Scalars['BigFloat']>>;
  dataLayerId?: InputMaybe<Scalars['Int']>;
}>;


export type CreateTableOfContentsItemMutation = { __typename?: 'Mutation', createTableOfContentsItem?: { __typename?: 'CreateTableOfContentsItemPayload', tableOfContentsItem?: { __typename?: 'TableOfContentsItem', id: number, title: string, stableId: string, projectId: number, parentStableId?: string | null, isClickOffOnly: boolean, isDraft: boolean, isFolder: boolean, metadata?: any | null, bounds?: Array<any | null> | null, dataLayerId?: number | null } | null } | null };

export type CreateArcGisDynamicDataSourceMutationVariables = Exact<{
  projectId: Scalars['Int'];
  url: Scalars['String'];
  attribution?: InputMaybe<Scalars['String']>;
  bounds?: InputMaybe<Array<InputMaybe<Scalars['BigFloat']>> | InputMaybe<Scalars['BigFloat']>>;
  queryParameters?: InputMaybe<Scalars['JSON']>;
}>;


export type CreateArcGisDynamicDataSourceMutation = { __typename?: 'Mutation', createDataSource?: { __typename?: 'CreateDataSourcePayload', dataSource?: { __typename?: 'DataSource', id: number, projectId: number, type: DataSourceTypes, url?: string | null } | null } | null };

export type CreateArcGisImageSourceMutationVariables = Exact<{
  projectId: Scalars['Int'];
  url: Scalars['String'];
  attribution?: InputMaybe<Scalars['String']>;
  bounds?: InputMaybe<Array<InputMaybe<Scalars['BigFloat']>> | InputMaybe<Scalars['BigFloat']>>;
  queryParameters?: InputMaybe<Scalars['JSON']>;
  enableHighDPI?: InputMaybe<Scalars['Boolean']>;
  supportsDynamicLayers: Scalars['Boolean'];
}>;


export type CreateArcGisImageSourceMutation = { __typename?: 'Mutation', createDataSource?: { __typename?: 'CreateDataSourcePayload', dataSource?: { __typename?: 'DataSource', id: number, url?: string | null } | null } | null };

export type CreateSeaSketchVectorSourceMutationVariables = Exact<{
  projectId: Scalars['Int'];
  attribution?: InputMaybe<Scalars['String']>;
  bounds: Array<InputMaybe<Scalars['BigFloat']>> | InputMaybe<Scalars['BigFloat']>;
  byteLength: Scalars['Int'];
  originalSourceUrl?: InputMaybe<Scalars['String']>;
  importType: DataSourceImportTypes;
  enhancedSecurity: Scalars['Boolean'];
}>;


export type CreateSeaSketchVectorSourceMutation = { __typename?: 'Mutation', createDataSource?: { __typename?: 'CreateDataSourcePayload', dataSource?: { __typename?: 'DataSource', id: number, projectId: number, type: DataSourceTypes, url?: string | null, presignedUploadUrl?: string | null, bucketId?: string | null, enhancedSecurity?: boolean | null, objectKey?: any | null } | null } | null };

export type CreateDataLayerMutationVariables = Exact<{
  projectId: Scalars['Int'];
  dataSourceId: Scalars['Int'];
  mapboxGlStyles?: InputMaybe<Scalars['JSON']>;
  renderUnder?: InputMaybe<RenderUnderType>;
  sublayer?: InputMaybe<Scalars['String']>;
}>;


export type CreateDataLayerMutation = { __typename?: 'Mutation', createDataLayer?: { __typename?: 'CreateDataLayerPayload', dataLayer?: { __typename?: 'DataLayer', id: number, dataSourceId: number, zIndex: number, interactivitySettings?: { __typename?: 'InteractivitySetting', cursor: CursorType, id: number, longTemplate?: string | null, shortTemplate?: string | null, type: InteractivityType } | null } | null } | null };

export type GetOrCreateSpriteMutationVariables = Exact<{
  height: Scalars['Int'];
  width: Scalars['Int'];
  pixelRatio: Scalars['Int'];
  projectId: Scalars['Int'];
  smallestImage: Scalars['Upload'];
}>;


export type GetOrCreateSpriteMutation = { __typename?: 'Mutation', getOrCreateSprite?: { __typename?: 'Sprite', id: number, md5: string, projectId: number, type?: SpriteType | null, spriteImages: Array<{ __typename?: 'SpriteImage', spriteId: number, height: number, pixelRatio: number, url: string, width: number }> } | null };

export type AddImageToSpriteMutationVariables = Exact<{
  spriteId: Scalars['Int'];
  width: Scalars['Int'];
  height: Scalars['Int'];
  pixelRatio: Scalars['Int'];
  image: Scalars['Upload'];
}>;


export type AddImageToSpriteMutation = { __typename?: 'Mutation', addImageToSprite?: { __typename?: 'Sprite', id: number, md5: string, projectId: number, type?: SpriteType | null, spriteImages: Array<{ __typename?: 'SpriteImage', spriteId: number, height: number, pixelRatio: number, url: string, width: number }> } | null };

export type VerifyProjectInviteQueryVariables = Exact<{
  token: Scalars['String'];
}>;


export type VerifyProjectInviteQuery = { __typename?: 'Query', verifyProjectInvite?: { __typename?: 'ProjectInviteTokenVerificationResults', error?: string | null, existingAccount?: boolean | null, claims?: { __typename?: 'ProjectInviteTokenClaims', admin: boolean, email: string, fullname?: string | null, inviteId: number, projectId: number, wasUsed: boolean, projectSlug: string } | null } | null };

export type ConfirmProjectInviteMutationVariables = Exact<{
  token: Scalars['String'];
}>;


export type ConfirmProjectInviteMutation = { __typename?: 'Mutation', confirmProjectInvite?: { __typename?: 'ProjectInviteTokenClaims', admin: boolean, email: string, fullname?: string | null, inviteId: number, projectId: number, projectName: string, wasUsed: boolean, projectSlug: string } | null };

export type ResendEmailVerificationMutationVariables = Exact<{ [key: string]: never; }>;


export type ResendEmailVerificationMutation = { __typename?: 'Mutation', resendVerificationEmail: { __typename?: 'SendVerificationEmailResults', success: boolean, error?: string | null } };

export type RequestInviteOnlyProjectAccessMutationVariables = Exact<{
  projectId: Scalars['Int'];
}>;


export type RequestInviteOnlyProjectAccessMutation = { __typename?: 'Mutation', joinProject?: { __typename?: 'JoinProjectPayload', clientMutationId?: string | null } | null };

export type BasemapDetailsFragment = { __typename?: 'Basemap', id: number, attribution?: string | null, labelsLayerId?: string | null, name: string, description?: string | null, projectId?: number | null, terrainExaggeration: any, terrainMaxZoom: number, terrainOptional: boolean, terrainTileSize: number, terrainUrl?: string | null, terrainVisibilityDefault: boolean, thumbnail: string, tileSize: number, type: BasemapType, url: string, surveysOnly: boolean, interactivitySettings?: { __typename?: 'InteractivitySetting', cursor: CursorType, id: number, layers?: Array<string | null> | null, longTemplate?: string | null, shortTemplate?: string | null, type: InteractivityType } | null, optionalBasemapLayers: Array<{ __typename?: 'OptionalBasemapLayer', basemapId: number, id: number, defaultVisibility: boolean, description?: string | null, options?: any | null, groupType: OptionalBasemapLayersGroupType, layers: Array<string | null>, metadata?: any | null, name: string }> };

export type GetBasemapsQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type GetBasemapsQuery = { __typename?: 'Query', projectBySlug?: { __typename?: 'Project', id: number, surveyBasemaps?: Array<{ __typename?: 'Basemap', id: number, attribution?: string | null, labelsLayerId?: string | null, name: string, description?: string | null, projectId?: number | null, terrainExaggeration: any, terrainMaxZoom: number, terrainOptional: boolean, terrainTileSize: number, terrainUrl?: string | null, terrainVisibilityDefault: boolean, thumbnail: string, tileSize: number, type: BasemapType, url: string, surveysOnly: boolean, interactivitySettings?: { __typename?: 'InteractivitySetting', cursor: CursorType, id: number, layers?: Array<string | null> | null, longTemplate?: string | null, shortTemplate?: string | null, type: InteractivityType } | null, optionalBasemapLayers: Array<{ __typename?: 'OptionalBasemapLayer', basemapId: number, id: number, defaultVisibility: boolean, description?: string | null, options?: any | null, groupType: OptionalBasemapLayersGroupType, layers: Array<string | null>, metadata?: any | null, name: string }> }> | null, basemaps?: Array<{ __typename?: 'Basemap', id: number, attribution?: string | null, labelsLayerId?: string | null, name: string, description?: string | null, projectId?: number | null, terrainExaggeration: any, terrainMaxZoom: number, terrainOptional: boolean, terrainTileSize: number, terrainUrl?: string | null, terrainVisibilityDefault: boolean, thumbnail: string, tileSize: number, type: BasemapType, url: string, surveysOnly: boolean, interactivitySettings?: { __typename?: 'InteractivitySetting', cursor: CursorType, id: number, layers?: Array<string | null> | null, longTemplate?: string | null, shortTemplate?: string | null, type: InteractivityType } | null, optionalBasemapLayers: Array<{ __typename?: 'OptionalBasemapLayer', basemapId: number, id: number, defaultVisibility: boolean, description?: string | null, options?: any | null, groupType: OptionalBasemapLayersGroupType, layers: Array<string | null>, metadata?: any | null, name: string }> }> | null } | null };

export type CreateBasemapMutationVariables = Exact<{
  projectId?: InputMaybe<Scalars['Int']>;
  name: Scalars['String'];
  thumbnail: Scalars['Upload'];
  tileSize?: InputMaybe<Scalars['Int']>;
  type: BasemapType;
  url: Scalars['String'];
  surveysOnly?: InputMaybe<Scalars['Boolean']>;
}>;


export type CreateBasemapMutation = { __typename?: 'Mutation', createBasemap?: { __typename?: 'CreateBasemapPayload', basemap?: { __typename?: 'Basemap', id: number, attribution?: string | null, labelsLayerId?: string | null, name: string, description?: string | null, projectId?: number | null, terrainExaggeration: any, terrainMaxZoom: number, terrainOptional: boolean, terrainTileSize: number, terrainUrl?: string | null, terrainVisibilityDefault: boolean, thumbnail: string, tileSize: number, type: BasemapType, url: string, surveysOnly: boolean, interactivitySettings?: { __typename?: 'InteractivitySetting', cursor: CursorType, id: number, layers?: Array<string | null> | null, longTemplate?: string | null, shortTemplate?: string | null, type: InteractivityType } | null, optionalBasemapLayers: Array<{ __typename?: 'OptionalBasemapLayer', basemapId: number, id: number, defaultVisibility: boolean, description?: string | null, options?: any | null, groupType: OptionalBasemapLayersGroupType, layers: Array<string | null>, metadata?: any | null, name: string }> } | null } | null };

export type UploadBasemapMutationVariables = Exact<{
  projectId: Scalars['Int'];
  name: Scalars['String'];
  thumbnail: Scalars['Upload'];
  existingId?: InputMaybe<Scalars['Int']>;
  style: Scalars['JSON'];
  surveysOnly?: InputMaybe<Scalars['Boolean']>;
}>;


export type UploadBasemapMutation = { __typename?: 'Mutation', uploadStyle: { __typename?: 'Basemap', id: number, attribution?: string | null, labelsLayerId?: string | null, name: string, description?: string | null, projectId?: number | null, terrainExaggeration: any, terrainMaxZoom: number, terrainOptional: boolean, terrainTileSize: number, terrainUrl?: string | null, terrainVisibilityDefault: boolean, thumbnail: string, tileSize: number, type: BasemapType, url: string, surveysOnly: boolean, interactivitySettings?: { __typename?: 'InteractivitySetting', cursor: CursorType, id: number, layers?: Array<string | null> | null, longTemplate?: string | null, shortTemplate?: string | null, type: InteractivityType } | null, optionalBasemapLayers: Array<{ __typename?: 'OptionalBasemapLayer', basemapId: number, id: number, defaultVisibility: boolean, description?: string | null, options?: any | null, groupType: OptionalBasemapLayersGroupType, layers: Array<string | null>, metadata?: any | null, name: string }> } };

export type GetBasemapQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type GetBasemapQuery = { __typename?: 'Query', basemap?: { __typename?: 'Basemap', id: number, attribution?: string | null, description?: string | null, labelsLayerId?: string | null, name: string, projectId?: number | null, terrainExaggeration: any, terrainMaxZoom: number, terrainOptional: boolean, terrainTileSize: number, terrainUrl?: string | null, terrainVisibilityDefault: boolean, thumbnail: string, tileSize: number, type: BasemapType, url: string, interactivitySettings?: { __typename?: 'InteractivitySetting', cursor: CursorType, id: number, layers?: Array<string | null> | null, longTemplate?: string | null, shortTemplate?: string | null, type: InteractivityType } | null, optionalBasemapLayers: Array<{ __typename?: 'OptionalBasemapLayer', basemapId: number, defaultVisibility: boolean, description?: string | null, options?: any | null, groupType: OptionalBasemapLayersGroupType, id: number, layers: Array<string | null>, metadata?: any | null, name: string }> } | null };

export type UpdateBasemapMutationVariables = Exact<{
  id: Scalars['Int'];
  name?: InputMaybe<Scalars['String']>;
}>;


export type UpdateBasemapMutation = { __typename?: 'Mutation', updateBasemap?: { __typename?: 'UpdateBasemapPayload', basemap?: { __typename?: 'Basemap', name: string, id: number } | null } | null };

export type UpdateBasemapUrlMutationVariables = Exact<{
  id: Scalars['Int'];
  url: Scalars['String'];
}>;


export type UpdateBasemapUrlMutation = { __typename?: 'Mutation', updateBasemap?: { __typename?: 'UpdateBasemapPayload', basemap?: { __typename?: 'Basemap', url: string, id: number } | null } | null };

export type UpdateBasemapLabelsLayerMutationVariables = Exact<{
  id: Scalars['Int'];
  layer?: InputMaybe<Scalars['String']>;
}>;


export type UpdateBasemapLabelsLayerMutation = { __typename?: 'Mutation', updateBasemap?: { __typename?: 'UpdateBasemapPayload', basemap?: { __typename?: 'Basemap', id: number, labelsLayerId?: string | null } | null } | null };

export type Toggle3dTerrainMutationVariables = Exact<{
  id: Scalars['Int'];
  terrainUrl?: InputMaybe<Scalars['String']>;
}>;


export type Toggle3dTerrainMutation = { __typename?: 'Mutation', updateBasemap?: { __typename?: 'UpdateBasemapPayload', basemap?: { __typename?: 'Basemap', id: number, terrainUrl?: string | null } | null } | null };

export type Set3dTerrainMutationVariables = Exact<{
  id: Scalars['Int'];
  terrainUrl?: InputMaybe<Scalars['String']>;
  terrainOptional?: InputMaybe<Scalars['Boolean']>;
  terrainVisibilityDefault?: InputMaybe<Scalars['Boolean']>;
}>;


export type Set3dTerrainMutation = { __typename?: 'Mutation', updateBasemap?: { __typename?: 'UpdateBasemapPayload', basemap?: { __typename?: 'Basemap', id: number, terrainUrl?: string | null, terrainVisibilityDefault: boolean, terrainOptional: boolean } | null } | null };

export type UpdateTerrainExaggerationMutationVariables = Exact<{
  id: Scalars['Int'];
  terrainExaggeration: Scalars['BigFloat'];
}>;


export type UpdateTerrainExaggerationMutation = { __typename?: 'Mutation', updateBasemap?: { __typename?: 'UpdateBasemapPayload', basemap?: { __typename?: 'Basemap', id: number, terrainExaggeration: any } | null } | null };

export type DeleteBasemapMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteBasemapMutation = { __typename?: 'Mutation', deleteBasemap?: { __typename?: 'DeleteBasemapPayload', basemap?: { __typename?: 'Basemap', id: number } | null } | null };

export type OptionalLayerQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type OptionalLayerQuery = { __typename?: 'Query', optionalBasemapLayer?: { __typename?: 'OptionalBasemapLayer', id: number, basemapId: number, defaultVisibility: boolean, description?: string | null, options?: any | null, groupType: OptionalBasemapLayersGroupType, layers: Array<string | null>, metadata?: any | null, name: string } | null };

export type UpdateOptionalLayerNameMutationVariables = Exact<{
  id: Scalars['Int'];
  name: Scalars['String'];
}>;


export type UpdateOptionalLayerNameMutation = { __typename?: 'Mutation', updateOptionalBasemapLayer?: { __typename?: 'UpdateOptionalBasemapLayerPayload', optionalBasemapLayer?: { __typename?: 'OptionalBasemapLayer', id: number, name: string } | null } | null };

export type CreateOptionalLayerMutationVariables = Exact<{
  name: Scalars['String'];
  basemapId: Scalars['Int'];
  groupType?: InputMaybe<OptionalBasemapLayersGroupType>;
  options?: InputMaybe<Scalars['JSON']>;
}>;


export type CreateOptionalLayerMutation = { __typename?: 'Mutation', createOptionalBasemapLayer?: { __typename?: 'CreateOptionalBasemapLayerPayload', optionalBasemapLayer?: { __typename?: 'OptionalBasemapLayer', id: number, basemapId: number, defaultVisibility: boolean, description?: string | null, options?: any | null, groupType: OptionalBasemapLayersGroupType, layers: Array<string | null>, metadata?: any | null, name: string } | null } | null };

export type UpdateOptionalLayerMutationVariables = Exact<{
  id: Scalars['Int'];
  name?: InputMaybe<Scalars['String']>;
  description?: InputMaybe<Scalars['String']>;
  defaultVisibility?: InputMaybe<Scalars['Boolean']>;
  metadata?: InputMaybe<Scalars['JSON']>;
}>;


export type UpdateOptionalLayerMutation = { __typename?: 'Mutation', updateOptionalBasemapLayer?: { __typename?: 'UpdateOptionalBasemapLayerPayload', optionalBasemapLayer?: { __typename?: 'OptionalBasemapLayer', name: string, description?: string | null, id: number, defaultVisibility: boolean, metadata?: any | null } | null } | null };

export type DeleteOptionalLayerMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteOptionalLayerMutation = { __typename?: 'Mutation', deleteOptionalBasemapLayer?: { __typename?: 'DeleteOptionalBasemapLayerPayload', optionalBasemapLayer?: { __typename?: 'OptionalBasemapLayer', id: number } | null } | null };

export type UpdateOptionalBasemapLayerLayerListMutationVariables = Exact<{
  id: Scalars['Int'];
  layers?: InputMaybe<Array<InputMaybe<Scalars['String']>> | InputMaybe<Scalars['String']>>;
}>;


export type UpdateOptionalBasemapLayerLayerListMutation = { __typename?: 'Mutation', updateOptionalBasemapLayer?: { __typename?: 'UpdateOptionalBasemapLayerPayload', optionalBasemapLayer?: { __typename?: 'OptionalBasemapLayer', id: number, layers: Array<string | null> } | null } | null };

export type UpdateOptionalBasemapLayerOptionsMutationVariables = Exact<{
  id: Scalars['Int'];
  options: Scalars['JSON'];
}>;


export type UpdateOptionalBasemapLayerOptionsMutation = { __typename?: 'Mutation', updateOptionalBasemapLayer?: { __typename?: 'UpdateOptionalBasemapLayerPayload', optionalBasemapLayer?: { __typename?: 'OptionalBasemapLayer', id: number, options?: any | null } | null } | null };

export type GetOptionalBasemapLayerQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type GetOptionalBasemapLayerQuery = { __typename?: 'Query', optionalBasemapLayer?: { __typename?: 'OptionalBasemapLayer', id: number, basemapId: number, name: string, description?: string | null, defaultVisibility: boolean, groupType: OptionalBasemapLayersGroupType, layers: Array<string | null>, metadata?: any | null, options?: any | null } | null };

export type GetOptionalBasemapLayerMetadataQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type GetOptionalBasemapLayerMetadataQuery = { __typename?: 'Query', optionalBasemapLayer?: { __typename?: 'OptionalBasemapLayer', id: number, metadata?: any | null } | null };

export type UpdateOptionalBasemapLayerMetadataMutationVariables = Exact<{
  id: Scalars['Int'];
  metadata?: InputMaybe<Scalars['JSON']>;
}>;


export type UpdateOptionalBasemapLayerMetadataMutation = { __typename?: 'Mutation', updateOptionalBasemapLayer?: { __typename?: 'UpdateOptionalBasemapLayerPayload', optionalBasemapLayer?: { __typename?: 'OptionalBasemapLayer', id: number, metadata?: any | null } | null } | null };

export type UpdateInteractivitySettingsLayersMutationVariables = Exact<{
  id: Scalars['Int'];
  layers?: InputMaybe<Array<InputMaybe<Scalars['String']>> | InputMaybe<Scalars['String']>>;
}>;


export type UpdateInteractivitySettingsLayersMutation = { __typename?: 'Mutation', updateInteractivitySetting?: { __typename?: 'UpdateInteractivitySettingPayload', interactivitySetting?: { __typename?: 'InteractivitySetting', layers?: Array<string | null> | null, id: number } | null } | null };

export type MapboxKeysQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type MapboxKeysQuery = { __typename?: 'Query', projectBySlug?: { __typename?: 'Project', id: number, mapboxPublicKey?: string | null, mapboxSecretKey?: string | null } | null };

export type CreateProjectMutationVariables = Exact<{
  name: Scalars['String'];
  slug: Scalars['String'];
}>;


export type CreateProjectMutation = { __typename?: 'Mutation', createProject?: { __typename?: 'CreateProjectPayload', project?: { __typename?: 'Project', id: number, url?: string | null, slug: string } | null } | null };

export type DraftTableOfContentsQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type DraftTableOfContentsQuery = { __typename?: 'Query', projectBySlug?: { __typename?: 'Project', id: number, draftTableOfContentsItems?: Array<{ __typename?: 'TableOfContentsItem', id: number, dataLayerId?: number | null, title: string, isClickOffOnly: boolean, isFolder: boolean, stableId: string, parentStableId?: string | null, showRadioChildren: boolean, bounds?: Array<any | null> | null, sortIndex: number, hideChildren: boolean, enableDownload: boolean, acl?: { __typename?: 'Acl', id: number, type: AccessControlListType } | null }> | null } | null };

export type LayersAndSourcesForItemsQueryVariables = Exact<{
  slug: Scalars['String'];
  tableOfContentsItemIds: Array<InputMaybe<Scalars['Int']>> | InputMaybe<Scalars['Int']>;
}>;


export type LayersAndSourcesForItemsQuery = { __typename?: 'Query', projectBySlug?: { __typename?: 'Project', id: number, dataSourcesForItems?: Array<{ __typename?: 'DataSource', attribution?: string | null, bounds?: Array<any | null> | null, bucketId?: string | null, buffer?: number | null, byteLength?: number | null, cluster?: boolean | null, clusterMaxZoom?: number | null, clusterProperties?: any | null, clusterRadius?: number | null, coordinates?: Array<any | null> | null, createdAt: any, encoding?: RasterDemEncoding | null, enhancedSecurity?: boolean | null, id: number, importType?: DataSourceImportTypes | null, lineMetrics?: boolean | null, maxzoom?: number | null, minzoom?: number | null, objectKey?: any | null, originalSourceUrl?: string | null, queryParameters?: any | null, scheme?: TileScheme | null, tiles?: Array<string | null> | null, tileSize?: number | null, tolerance?: any | null, type: DataSourceTypes, url?: string | null, urls?: Array<string | null> | null, useDevicePixelRatio?: boolean | null, supportsDynamicLayers: boolean }> | null, dataLayersForItems?: Array<{ __typename?: 'DataLayer', zIndex: number, dataSourceId: number, id: number, mapboxGlStyles?: any | null, renderUnder: RenderUnderType, sourceLayer?: string | null, sublayer?: string | null, interactivitySettings?: { __typename?: 'InteractivitySetting', id: number, cursor: CursorType, longTemplate?: string | null, shortTemplate?: string | null, type: InteractivityType } | null, sprites?: Array<{ __typename?: 'Sprite', id: number, type?: SpriteType | null, spriteImages: Array<{ __typename?: 'SpriteImage', pixelRatio: number, height: number, width: number, url: string }> }> | null }> | null } | null };

export type CreateFolderMutationVariables = Exact<{
  title: Scalars['String'];
  stableId: Scalars['String'];
  projectId: Scalars['Int'];
  parentStableId?: InputMaybe<Scalars['String']>;
  isClickOffOnly?: InputMaybe<Scalars['Boolean']>;
  showRadioChildren?: InputMaybe<Scalars['Boolean']>;
  hideChildren?: InputMaybe<Scalars['Boolean']>;
}>;


export type CreateFolderMutation = { __typename?: 'Mutation', createTableOfContentsItem?: { __typename?: 'CreateTableOfContentsItemPayload', tableOfContentsItem?: { __typename?: 'TableOfContentsItem', id: number, title: string, stableId: string, projectId: number, parentStableId?: string | null, isClickOffOnly: boolean, isDraft: boolean, isFolder: boolean, showRadioChildren: boolean, sortIndex: number, hideChildren: boolean, enableDownload: boolean } | null } | null };

export type DeleteBranchMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteBranchMutation = { __typename?: 'Mutation', deleteTableOfContentsBranch?: { __typename?: 'DeleteTableOfContentsBranchPayload', clientMutationId?: string | null } | null };

export type UpdateTableOfContentsItemChildrenMutationVariables = Exact<{
  id?: InputMaybe<Scalars['Int']>;
  childIds: Array<InputMaybe<Scalars['Int']>> | InputMaybe<Scalars['Int']>;
}>;


export type UpdateTableOfContentsItemChildrenMutation = { __typename?: 'Mutation', updateTableOfContentsItemChildren?: { __typename?: 'UpdateTableOfContentsItemChildrenPayload', tableOfContentsItems?: Array<{ __typename?: 'TableOfContentsItem', id: number, sortIndex: number, parentStableId?: string | null }> | null } | null };

export type GetFolderQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type GetFolderQuery = { __typename?: 'Query', tableOfContentsItem?: { __typename?: 'TableOfContentsItem', id: number, bounds?: Array<any | null> | null, isClickOffOnly: boolean, showRadioChildren: boolean, title: string, hideChildren: boolean } | null };

export type UpdateFolderMutationVariables = Exact<{
  id: Scalars['Int'];
  bounds?: InputMaybe<Array<InputMaybe<Scalars['BigFloat']>> | InputMaybe<Scalars['BigFloat']>>;
  isClickOffOnly?: InputMaybe<Scalars['Boolean']>;
  showRadioChildren?: InputMaybe<Scalars['Boolean']>;
  title?: InputMaybe<Scalars['String']>;
  hideChildren?: InputMaybe<Scalars['Boolean']>;
}>;


export type UpdateFolderMutation = { __typename?: 'Mutation', updateTableOfContentsItem?: { __typename?: 'UpdateTableOfContentsItemPayload', tableOfContentsItem?: { __typename?: 'TableOfContentsItem', id: number, bounds?: Array<any | null> | null, isClickOffOnly: boolean, showRadioChildren: boolean, hideChildren: boolean, title: string } | null } | null };

export type GetLayerItemQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type GetLayerItemQuery = { __typename?: 'Query', tableOfContentsItem?: { __typename?: 'TableOfContentsItem', id: number, bounds?: Array<any | null> | null, dataLayerId?: number | null, metadata?: any | null, parentStableId?: string | null, projectId: number, stableId: string, title: string, enableDownload: boolean, acl?: { __typename?: 'Acl', nodeId: string, id: number, type: AccessControlListType, groups?: Array<{ __typename?: 'Group', id: number, name: string }> | null } | null, dataLayer?: { __typename?: 'DataLayer', id: number, zIndex: number, mapboxGlStyles?: any | null, interactivitySettingsId: number, renderUnder: RenderUnderType, sourceLayer?: string | null, sublayer?: string | null, dataSourceId: number, sprites?: Array<{ __typename?: 'Sprite', id: number, type?: SpriteType | null, spriteImages: Array<{ __typename?: 'SpriteImage', pixelRatio: number, height: number, width: number, url: string }> }> | null, dataSource?: { __typename?: 'DataSource', id: number, attribution?: string | null, bounds?: Array<any | null> | null, bucketId?: string | null, buffer?: number | null, byteLength?: number | null, cluster?: boolean | null, clusterMaxZoom?: number | null, clusterProperties?: any | null, clusterRadius?: number | null, coordinates?: Array<any | null> | null, createdAt: any, encoding?: RasterDemEncoding | null, enhancedSecurity?: boolean | null, generateId?: boolean | null, importType?: DataSourceImportTypes | null, lineMetrics?: boolean | null, maxzoom?: number | null, minzoom?: number | null, objectKey?: any | null, originalSourceUrl?: string | null, promoteId?: boolean | null, queryParameters?: any | null, scheme?: TileScheme | null, tiles?: Array<string | null> | null, tileSize?: number | null, tolerance?: any | null, type: DataSourceTypes, url?: string | null, urls?: Array<string | null> | null, useDevicePixelRatio?: boolean | null, supportsDynamicLayers: boolean } | null } | null } | null };

export type UpdateTableOfContentsItemMutationVariables = Exact<{
  id: Scalars['Int'];
  title?: InputMaybe<Scalars['String']>;
  bounds?: InputMaybe<Array<InputMaybe<Scalars['BigFloat']>> | InputMaybe<Scalars['BigFloat']>>;
  metadata?: InputMaybe<Scalars['JSON']>;
}>;


export type UpdateTableOfContentsItemMutation = { __typename?: 'Mutation', updateTableOfContentsItem?: { __typename?: 'UpdateTableOfContentsItemPayload', tableOfContentsItem?: { __typename?: 'TableOfContentsItem', id: number, bounds?: Array<any | null> | null, metadata?: any | null, title: string } | null } | null };

export type UpdateEnableDownloadMutationVariables = Exact<{
  id: Scalars['Int'];
  enableDownload?: InputMaybe<Scalars['Boolean']>;
}>;


export type UpdateEnableDownloadMutation = { __typename?: 'Mutation', updateTableOfContentsItem?: { __typename?: 'UpdateTableOfContentsItemPayload', tableOfContentsItem?: { __typename?: 'TableOfContentsItem', id: number, enableDownload: boolean } | null } | null };

export type UpdateLayerMutationVariables = Exact<{
  id: Scalars['Int'];
  renderUnder?: InputMaybe<RenderUnderType>;
  mapboxGlStyles?: InputMaybe<Scalars['JSON']>;
  sublayer?: InputMaybe<Scalars['String']>;
}>;


export type UpdateLayerMutation = { __typename?: 'Mutation', updateDataLayer?: { __typename?: 'UpdateDataLayerPayload', dataLayer?: { __typename?: 'DataLayer', id: number, zIndex: number, renderUnder: RenderUnderType, mapboxGlStyles?: any | null, sublayer?: string | null, sprites?: Array<{ __typename?: 'Sprite', id: number, type?: SpriteType | null, spriteImages: Array<{ __typename?: 'SpriteImage', pixelRatio: number, height: number, width: number, url: string }> }> | null } | null } | null };

export type UpdateDataSourceMutationVariables = Exact<{
  id: Scalars['Int'];
  attribution?: InputMaybe<Scalars['String']>;
}>;


export type UpdateDataSourceMutation = { __typename?: 'Mutation', updateDataSource?: { __typename?: 'UpdateDataSourcePayload', dataSource?: { __typename?: 'DataSource', id: number, attribution?: string | null, bounds?: Array<any | null> | null, bucketId?: string | null, buffer?: number | null, byteLength?: number | null, cluster?: boolean | null, clusterMaxZoom?: number | null, clusterProperties?: any | null, clusterRadius?: number | null, coordinates?: Array<any | null> | null, createdAt: any, encoding?: RasterDemEncoding | null, enhancedSecurity?: boolean | null, generateId?: boolean | null, importType?: DataSourceImportTypes | null, lineMetrics?: boolean | null, maxzoom?: number | null, minzoom?: number | null, objectKey?: any | null, originalSourceUrl?: string | null, promoteId?: boolean | null, queryParameters?: any | null, scheme?: TileScheme | null, tiles?: Array<string | null> | null, tileSize?: number | null, tolerance?: any | null, type: DataSourceTypes, url?: string | null, urls?: Array<string | null> | null, useDevicePixelRatio?: boolean | null, supportsDynamicLayers: boolean } | null } | null };

export type InteractivitySettingsForLayerQueryVariables = Exact<{
  layerId: Scalars['Int'];
}>;


export type InteractivitySettingsForLayerQuery = { __typename?: 'Query', dataLayer?: { __typename?: 'DataLayer', id: number, sourceLayer?: string | null, interactivitySettings?: { __typename?: 'InteractivitySetting', cursor: CursorType, id: number, longTemplate?: string | null, shortTemplate?: string | null, type: InteractivityType } | null } | null };

export type UpdateInteractivitySettingsMutationVariables = Exact<{
  id: Scalars['Int'];
  type?: InputMaybe<InteractivityType>;
  cursor?: InputMaybe<CursorType>;
  longTemplate?: InputMaybe<Scalars['String']>;
  shortTemplate?: InputMaybe<Scalars['String']>;
}>;


export type UpdateInteractivitySettingsMutation = { __typename?: 'Mutation', updateInteractivitySetting?: { __typename?: 'UpdateInteractivitySettingPayload', interactivitySetting?: { __typename?: 'InteractivitySetting', id: number, type: InteractivityType, cursor: CursorType, longTemplate?: string | null, shortTemplate?: string | null } | null } | null };

export type DataSourceUrlPropertiesQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DataSourceUrlPropertiesQuery = { __typename?: 'Query', dataSource?: { __typename?: 'DataSource', id: number, type: DataSourceTypes, bucketId?: string | null, objectKey?: any | null, url?: string | null, originalSourceUrl?: string | null, queryParameters?: any | null } | null };

export type UpdateZIndexesMutationVariables = Exact<{
  dataLayerIds: Array<InputMaybe<Scalars['Int']>> | InputMaybe<Scalars['Int']>;
}>;


export type UpdateZIndexesMutation = { __typename?: 'Mutation', updateZIndexes?: { __typename?: 'UpdateZIndexesPayload', dataLayers?: Array<{ __typename?: 'DataLayer', id: number, zIndex: number }> | null } | null };

export type UpdateRenderUnderTypeMutationVariables = Exact<{
  layerId: Scalars['Int'];
  renderUnder?: InputMaybe<RenderUnderType>;
}>;


export type UpdateRenderUnderTypeMutation = { __typename?: 'Mutation', updateDataLayer?: { __typename?: 'UpdateDataLayerPayload', dataLayer?: { __typename?: 'DataLayer', id: number, renderUnder: RenderUnderType } | null } | null };

export type UpdateQueryParametersMutationVariables = Exact<{
  sourceId: Scalars['Int'];
  queryParameters: Scalars['JSON'];
}>;


export type UpdateQueryParametersMutation = { __typename?: 'Mutation', updateDataSource?: { __typename?: 'UpdateDataSourcePayload', dataSource?: { __typename?: 'DataSource', id: number, queryParameters?: any | null } | null } | null };

export type UpdateEnableHighDpiRequestsMutationVariables = Exact<{
  sourceId: Scalars['Int'];
  useDevicePixelRatio: Scalars['Boolean'];
}>;


export type UpdateEnableHighDpiRequestsMutation = { __typename?: 'Mutation', updateDataSource?: { __typename?: 'UpdateDataSourcePayload', dataSource?: { __typename?: 'DataSource', id: number, useDevicePixelRatio?: boolean | null } | null } | null };

export type GetMetadataQueryVariables = Exact<{
  itemId: Scalars['Int'];
}>;


export type GetMetadataQuery = { __typename?: 'Query', tableOfContentsItem?: { __typename?: 'TableOfContentsItem', id: number, metadata?: any | null } | null };

export type UpdateMetadataMutationVariables = Exact<{
  itemId: Scalars['Int'];
  metadata: Scalars['JSON'];
}>;


export type UpdateMetadataMutation = { __typename?: 'Mutation', updateTableOfContentsItem?: { __typename?: 'UpdateTableOfContentsItemPayload', tableOfContentsItem?: { __typename?: 'TableOfContentsItem', id: number, metadata?: any | null } | null } | null };

export type ProjectHostingQuotaQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type ProjectHostingQuotaQuery = { __typename?: 'Query', projectBySlug?: { __typename?: 'Project', id: number, dataHostingQuota?: number | null, dataHostingQuotaUsed?: number | null } | null };

export type InteractivitySettingsByIdQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type InteractivitySettingsByIdQuery = { __typename?: 'Query', interactivitySetting?: { __typename?: 'InteractivitySetting', cursor: CursorType, id: number, layers?: Array<string | null> | null, longTemplate?: string | null, shortTemplate?: string | null, type: InteractivityType } | null };

export type PublishTableOfContentsMutationVariables = Exact<{
  projectId: Scalars['Int'];
}>;


export type PublishTableOfContentsMutation = { __typename?: 'Mutation', publishTableOfContents?: { __typename?: 'PublishTableOfContentsPayload', tableOfContentsItems?: Array<{ __typename?: 'TableOfContentsItem', id: number }> | null } | null };

export type MapEssentialsFragment = { __typename?: 'Project', id: number, mapboxPublicKey?: string | null, mapboxSecretKey?: string | null, basemaps?: Array<{ __typename?: 'Basemap', id: number, attribution?: string | null, labelsLayerId?: string | null, name: string, description?: string | null, projectId?: number | null, terrainExaggeration: any, terrainMaxZoom: number, terrainOptional: boolean, terrainTileSize: number, terrainUrl?: string | null, terrainVisibilityDefault: boolean, thumbnail: string, tileSize: number, type: BasemapType, url: string, surveysOnly: boolean, interactivitySettings?: { __typename?: 'InteractivitySetting', cursor: CursorType, id: number, layers?: Array<string | null> | null, longTemplate?: string | null, shortTemplate?: string | null, type: InteractivityType } | null, optionalBasemapLayers: Array<{ __typename?: 'OptionalBasemapLayer', basemapId: number, id: number, defaultVisibility: boolean, description?: string | null, options?: any | null, groupType: OptionalBasemapLayersGroupType, layers: Array<string | null>, metadata?: any | null, name: string }> }> | null, surveyBasemaps?: Array<{ __typename?: 'Basemap', id: number, attribution?: string | null, labelsLayerId?: string | null, name: string, description?: string | null, projectId?: number | null, terrainExaggeration: any, terrainMaxZoom: number, terrainOptional: boolean, terrainTileSize: number, terrainUrl?: string | null, terrainVisibilityDefault: boolean, thumbnail: string, tileSize: number, type: BasemapType, url: string, surveysOnly: boolean, interactivitySettings?: { __typename?: 'InteractivitySetting', cursor: CursorType, id: number, layers?: Array<string | null> | null, longTemplate?: string | null, shortTemplate?: string | null, type: InteractivityType } | null, optionalBasemapLayers: Array<{ __typename?: 'OptionalBasemapLayer', basemapId: number, id: number, defaultVisibility: boolean, description?: string | null, options?: any | null, groupType: OptionalBasemapLayersGroupType, layers: Array<string | null>, metadata?: any | null, name: string }> }> | null, region: { __typename?: 'GeometryPolygon', geojson?: any | null } };

export type GetBasemapsAndRegionQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type GetBasemapsAndRegionQuery = { __typename?: 'Query', projectBySlug?: { __typename?: 'Project', id: number, mapboxPublicKey?: string | null, mapboxSecretKey?: string | null, basemaps?: Array<{ __typename?: 'Basemap', id: number, attribution?: string | null, labelsLayerId?: string | null, name: string, description?: string | null, projectId?: number | null, terrainExaggeration: any, terrainMaxZoom: number, terrainOptional: boolean, terrainTileSize: number, terrainUrl?: string | null, terrainVisibilityDefault: boolean, thumbnail: string, tileSize: number, type: BasemapType, url: string, surveysOnly: boolean, interactivitySettings?: { __typename?: 'InteractivitySetting', cursor: CursorType, id: number, layers?: Array<string | null> | null, longTemplate?: string | null, shortTemplate?: string | null, type: InteractivityType } | null, optionalBasemapLayers: Array<{ __typename?: 'OptionalBasemapLayer', basemapId: number, id: number, defaultVisibility: boolean, description?: string | null, options?: any | null, groupType: OptionalBasemapLayersGroupType, layers: Array<string | null>, metadata?: any | null, name: string }> }> | null, surveyBasemaps?: Array<{ __typename?: 'Basemap', id: number, attribution?: string | null, labelsLayerId?: string | null, name: string, description?: string | null, projectId?: number | null, terrainExaggeration: any, terrainMaxZoom: number, terrainOptional: boolean, terrainTileSize: number, terrainUrl?: string | null, terrainVisibilityDefault: boolean, thumbnail: string, tileSize: number, type: BasemapType, url: string, surveysOnly: boolean, interactivitySettings?: { __typename?: 'InteractivitySetting', cursor: CursorType, id: number, layers?: Array<string | null> | null, longTemplate?: string | null, shortTemplate?: string | null, type: InteractivityType } | null, optionalBasemapLayers: Array<{ __typename?: 'OptionalBasemapLayer', basemapId: number, id: number, defaultVisibility: boolean, description?: string | null, options?: any | null, groupType: OptionalBasemapLayersGroupType, layers: Array<string | null>, metadata?: any | null, name: string }> }> | null, region: { __typename?: 'GeometryPolygon', geojson?: any | null } } | null };

export type OfflineSurveysQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type OfflineSurveysQuery = { __typename?: 'Query', projectBySlug?: { __typename?: 'Project', id: number, surveys: Array<{ __typename?: 'Survey', id: number, name: string }> } | null };

export type ProjectAccessControlSettingsQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type ProjectAccessControlSettingsQuery = { __typename?: 'Query', projectBySlug?: { __typename: 'Project', id: number, accessControl: ProjectAccessControlSetting, isListed: boolean } | null };

export type UpdateProjectAccessControlSettingsMutationVariables = Exact<{
  slug: Scalars['String'];
  accessControl?: InputMaybe<ProjectAccessControlSetting>;
  isListed?: InputMaybe<Scalars['Boolean']>;
}>;


export type UpdateProjectAccessControlSettingsMutation = { __typename?: 'Mutation', updateProjectBySlug?: { __typename?: 'UpdateProjectPayload', clientMutationId?: string | null, project?: { __typename: 'Project', id: number, accessControl: ProjectAccessControlSetting, isListed: boolean } | null } | null };

export type ProjectMetadataFragment = { __typename?: 'Project', id: number, slug: string, url?: string | null, name: string, description?: string | null, logoLink?: string | null, logoUrl?: string | null, accessControl: ProjectAccessControlSetting, sessionIsAdmin?: boolean | null, isFeatured: boolean, supportEmail: string };

export type ProjectPublicDetailsMetadataFragment = { __typename?: 'PublicProjectDetail', id?: number | null, accessControl?: ProjectAccessControlSetting | null, slug?: string | null, name?: string | null, logoUrl?: string | null, supportEmail?: string | null, accessStatus?: ProjectAccessStatus | null };

export type ProjectMetadataMeFragFragment = { __typename?: 'User', id: number, profile?: { __typename?: 'Profile', userId: number, fullname?: string | null, nickname?: string | null, email?: any | null, picture?: string | null, bio?: string | null, affiliations?: string | null } | null };

export type ProjectMetadataQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type ProjectMetadataQuery = { __typename?: 'Query', project?: { __typename?: 'Project', id: number, slug: string, url?: string | null, name: string, description?: string | null, logoLink?: string | null, logoUrl?: string | null, accessControl: ProjectAccessControlSetting, sessionIsAdmin?: boolean | null, isFeatured: boolean, supportEmail: string } | null, projectPublicDetails?: { __typename?: 'PublicProjectDetail', id?: number | null, accessControl?: ProjectAccessControlSetting | null, slug?: string | null, name?: string | null, logoUrl?: string | null, supportEmail?: string | null, accessStatus?: ProjectAccessStatus | null } | null, me?: { __typename?: 'User', id: number, profile?: { __typename?: 'Profile', userId: number, fullname?: string | null, nickname?: string | null, email?: any | null, picture?: string | null, bio?: string | null, affiliations?: string | null } | null } | null };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { __typename?: 'Query', me?: { __typename?: 'User', id: number, profile?: { __typename?: 'Profile', userId: number, fullname?: string | null, nickname?: string | null, email?: any | null, picture?: string | null, bio?: string | null, affiliations?: string | null } | null } | null };

export type ProjectRegionQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type ProjectRegionQuery = { __typename?: 'Query', projectBySlug?: { __typename: 'Project', id: number, region: { __typename?: 'GeometryPolygon', geojson?: any | null } } | null };

export type UpdateProjectRegionMutationVariables = Exact<{
  slug: Scalars['String'];
  region: Scalars['GeoJSON'];
}>;


export type UpdateProjectRegionMutation = { __typename?: 'Mutation', updateProjectBySlug?: { __typename?: 'UpdateProjectPayload', clientMutationId?: string | null, project?: { __typename: 'Project', id: number, region: { __typename?: 'GeometryPolygon', geojson?: any | null } } | null } | null };

export type GetProjectBySlugQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type GetProjectBySlugQuery = { __typename?: 'Query', projectBySlug?: { __typename?: 'Project', id: number, name: string } | null };

export type ProjectSlugExistsQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type ProjectSlugExistsQuery = { __typename?: 'Query', projectBySlug?: { __typename?: 'Project', id: number } | null };

export type PublishedTableOfContentsQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type PublishedTableOfContentsQuery = { __typename?: 'Query', projectBySlug?: { __typename?: 'Project', id: number, tableOfContentsItems?: Array<{ __typename?: 'TableOfContentsItem', id: number, bounds?: Array<any | null> | null, dataLayerId?: number | null, enableDownload: boolean, hideChildren: boolean, isClickOffOnly: boolean, isFolder: boolean, parentStableId?: string | null, showRadioChildren: boolean, sortIndex: number, stableId: string, title: string, acl?: { __typename?: 'Acl', id: number, type: AccessControlListType } | null }> | null } | null };

export type SimpleProjectListQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
}>;


export type SimpleProjectListQuery = { __typename?: 'Query', projectsConnection?: { __typename?: 'ProjectsConnection', nodes: Array<{ __typename?: 'Project', id: number, name: string, slug: string, description?: string | null, url?: string | null }> } | null };

export type SurveyListDetailsFragment = { __typename?: 'Survey', id: number, accessType: SurveyAccessType, showProgress: boolean, isDisabled: boolean, limitToSingleResponse: boolean, name: string, submittedResponseCount?: number | null, practiceResponseCount?: number | null, projectId: number, isTemplate?: boolean | null, showFacilitationOption: boolean, supportedLanguages: Array<string | null>, invitedGroups?: Array<{ __typename?: 'Group', id: number, name: string }> | null };

export type SurveysQueryVariables = Exact<{
  projectId: Scalars['Int'];
}>;


export type SurveysQuery = { __typename?: 'Query', project?: { __typename?: 'Project', id: number, surveys: Array<{ __typename?: 'Survey', id: number, accessType: SurveyAccessType, showProgress: boolean, isDisabled: boolean, limitToSingleResponse: boolean, name: string, submittedResponseCount?: number | null, practiceResponseCount?: number | null, projectId: number, isTemplate?: boolean | null, showFacilitationOption: boolean, supportedLanguages: Array<string | null>, invitedGroups?: Array<{ __typename?: 'Group', id: number, name: string }> | null }> } | null };

export type CreateSurveyMutationVariables = Exact<{
  name: Scalars['String'];
  projectId: Scalars['Int'];
  templateId?: InputMaybe<Scalars['Int']>;
}>;


export type CreateSurveyMutation = { __typename?: 'Mutation', makeSurvey?: { __typename?: 'MakeSurveyPayload', survey?: { __typename?: 'Survey', id: number, accessType: SurveyAccessType, showProgress: boolean, isDisabled: boolean, limitToSingleResponse: boolean, name: string, submittedResponseCount?: number | null, practiceResponseCount?: number | null, projectId: number, isTemplate?: boolean | null, showFacilitationOption: boolean, supportedLanguages: Array<string | null>, invitedGroups?: Array<{ __typename?: 'Group', id: number, name: string }> | null } | null } | null };

export type SurveyByIdQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type SurveyByIdQuery = { __typename?: 'Query', survey?: { __typename?: 'Survey', isSpatial?: boolean | null, id: number, accessType: SurveyAccessType, showProgress: boolean, isDisabled: boolean, limitToSingleResponse: boolean, name: string, submittedResponseCount?: number | null, practiceResponseCount?: number | null, projectId: number, isTemplate?: boolean | null, showFacilitationOption: boolean, supportedLanguages: Array<string | null>, invitedGroups?: Array<{ __typename?: 'Group', id: number, name: string }> | null } | null };

export type AddFormElementTypeDetailsFragment = { __typename?: 'FormElementType', componentName: string, isHidden: boolean, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, supportedOperators: Array<FieldRuleOperator | null>, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null };

export type FormElementDetailsFragment = { __typename?: 'FormElement', body: any, componentSettings: any, alternateLanguageSettings: any, exportId?: string | null, formId: number, id: number, isRequired: boolean, position: number, jumpToId?: number | null, isInput?: boolean | null, typeId: string, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, layout?: FormElementLayout | null, backgroundPalette?: Array<string | null> | null, textVariant: FormElementTextVariant, unsplashAuthorUrl?: string | null, unsplashAuthorName?: string | null, backgroundWidth?: number | null, backgroundHeight?: number | null, subordinateTo?: number | null, mapBasemaps?: Array<number | null> | null, mapCameraOptions?: any | null, type?: { __typename?: 'FormElementType', componentName: string, isHidden: boolean, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, supportedOperators: Array<FieldRuleOperator | null>, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null } | null };

export type SketchClassDetailsFragment = { __typename?: 'SketchClass', id: number, mapboxGlStyle?: any | null, formElementId?: number | null, geometryType: SketchGeometryType, geoprocessingClientName?: string | null, geoprocessingClientUrl?: string | null, geoprocessingProjectUrl?: string | null, allowMulti: boolean, form?: { __typename?: 'Form', id: number, formElements?: Array<{ __typename?: 'FormElement', body: any, componentSettings: any, alternateLanguageSettings: any, exportId?: string | null, formId: number, id: number, isRequired: boolean, position: number, jumpToId?: number | null, isInput?: boolean | null, typeId: string, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, layout?: FormElementLayout | null, backgroundPalette?: Array<string | null> | null, textVariant: FormElementTextVariant, unsplashAuthorUrl?: string | null, unsplashAuthorName?: string | null, backgroundWidth?: number | null, backgroundHeight?: number | null, subordinateTo?: number | null, mapBasemaps?: Array<number | null> | null, mapCameraOptions?: any | null, type?: { __typename?: 'FormElementType', componentName: string, isHidden: boolean, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, supportedOperators: Array<FieldRuleOperator | null>, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null } | null }> | null, logicRules?: Array<{ __typename?: 'FormLogicRule', booleanOperator: FormLogicOperator, command: FormLogicCommand, id: number, jumpToId?: number | null, position: number, formElementId: number, conditions?: Array<{ __typename?: 'FormLogicCondition', id: number, operator: FieldRuleOperator, value?: any | null, subjectId: number, ruleId: number }> | null }> | null } | null };

export type FormElementFullDetailsFragment = { __typename?: 'FormElement', body: any, componentSettings: any, alternateLanguageSettings: any, exportId?: string | null, formId: number, id: number, isRequired: boolean, position: number, jumpToId?: number | null, isInput?: boolean | null, typeId: string, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, layout?: FormElementLayout | null, backgroundPalette?: Array<string | null> | null, textVariant: FormElementTextVariant, unsplashAuthorUrl?: string | null, unsplashAuthorName?: string | null, backgroundWidth?: number | null, backgroundHeight?: number | null, subordinateTo?: number | null, mapBasemaps?: Array<number | null> | null, mapCameraOptions?: any | null, sketchClass?: { __typename?: 'SketchClass', id: number, mapboxGlStyle?: any | null, formElementId?: number | null, geometryType: SketchGeometryType, geoprocessingClientName?: string | null, geoprocessingClientUrl?: string | null, geoprocessingProjectUrl?: string | null, allowMulti: boolean, form?: { __typename?: 'Form', id: number, formElements?: Array<{ __typename?: 'FormElement', body: any, componentSettings: any, alternateLanguageSettings: any, exportId?: string | null, formId: number, id: number, isRequired: boolean, position: number, jumpToId?: number | null, isInput?: boolean | null, typeId: string, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, layout?: FormElementLayout | null, backgroundPalette?: Array<string | null> | null, textVariant: FormElementTextVariant, unsplashAuthorUrl?: string | null, unsplashAuthorName?: string | null, backgroundWidth?: number | null, backgroundHeight?: number | null, subordinateTo?: number | null, mapBasemaps?: Array<number | null> | null, mapCameraOptions?: any | null, type?: { __typename?: 'FormElementType', componentName: string, isHidden: boolean, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, supportedOperators: Array<FieldRuleOperator | null>, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null } | null }> | null, logicRules?: Array<{ __typename?: 'FormLogicRule', booleanOperator: FormLogicOperator, command: FormLogicCommand, id: number, jumpToId?: number | null, position: number, formElementId: number, conditions?: Array<{ __typename?: 'FormLogicCondition', id: number, operator: FieldRuleOperator, value?: any | null, subjectId: number, ruleId: number }> | null }> | null } | null } | null, type?: { __typename?: 'FormElementType', componentName: string, isHidden: boolean, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, supportedOperators: Array<FieldRuleOperator | null>, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null } | null };

export type LogicRuleDetailsFragment = { __typename?: 'FormLogicRule', booleanOperator: FormLogicOperator, command: FormLogicCommand, id: number, jumpToId?: number | null, position: number, formElementId: number, conditions?: Array<{ __typename?: 'FormLogicCondition', id: number, operator: FieldRuleOperator, value?: any | null, subjectId: number, ruleId: number }> | null };

export type SurveyFormEditorDetailsQueryVariables = Exact<{
  id: Scalars['Int'];
  slug: Scalars['String'];
}>;


export type SurveyFormEditorDetailsQuery = { __typename?: 'Query', formElementTypes?: Array<{ __typename?: 'FormElementType', componentName: string, isHidden: boolean, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, supportedOperators: Array<FieldRuleOperator | null>, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null }> | null, survey?: { __typename?: 'Survey', id: number, accessType: SurveyAccessType, showProgress: boolean, isDisabled: boolean, limitToSingleResponse: boolean, name: string, submittedResponseCount?: number | null, practiceResponseCount?: number | null, projectId: number, isTemplate?: boolean | null, showFacilitationOption: boolean, supportedLanguages: Array<string | null>, form?: { __typename?: 'Form', id: number, isTemplate: boolean, surveyId?: number | null, templateName?: string | null, templateType?: FormTemplateType | null, formElements?: Array<{ __typename?: 'FormElement', body: any, componentSettings: any, alternateLanguageSettings: any, exportId?: string | null, formId: number, id: number, isRequired: boolean, position: number, jumpToId?: number | null, isInput?: boolean | null, typeId: string, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, layout?: FormElementLayout | null, backgroundPalette?: Array<string | null> | null, textVariant: FormElementTextVariant, unsplashAuthorUrl?: string | null, unsplashAuthorName?: string | null, backgroundWidth?: number | null, backgroundHeight?: number | null, subordinateTo?: number | null, mapBasemaps?: Array<number | null> | null, mapCameraOptions?: any | null, sketchClass?: { __typename?: 'SketchClass', id: number, mapboxGlStyle?: any | null, formElementId?: number | null, geometryType: SketchGeometryType, geoprocessingClientName?: string | null, geoprocessingClientUrl?: string | null, geoprocessingProjectUrl?: string | null, allowMulti: boolean, form?: { __typename?: 'Form', id: number, formElements?: Array<{ __typename?: 'FormElement', body: any, componentSettings: any, alternateLanguageSettings: any, exportId?: string | null, formId: number, id: number, isRequired: boolean, position: number, jumpToId?: number | null, isInput?: boolean | null, typeId: string, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, layout?: FormElementLayout | null, backgroundPalette?: Array<string | null> | null, textVariant: FormElementTextVariant, unsplashAuthorUrl?: string | null, unsplashAuthorName?: string | null, backgroundWidth?: number | null, backgroundHeight?: number | null, subordinateTo?: number | null, mapBasemaps?: Array<number | null> | null, mapCameraOptions?: any | null, type?: { __typename?: 'FormElementType', componentName: string, isHidden: boolean, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, supportedOperators: Array<FieldRuleOperator | null>, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null } | null }> | null, logicRules?: Array<{ __typename?: 'FormLogicRule', booleanOperator: FormLogicOperator, command: FormLogicCommand, id: number, jumpToId?: number | null, position: number, formElementId: number, conditions?: Array<{ __typename?: 'FormLogicCondition', id: number, operator: FieldRuleOperator, value?: any | null, subjectId: number, ruleId: number }> | null }> | null } | null } | null, type?: { __typename?: 'FormElementType', componentName: string, isHidden: boolean, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, supportedOperators: Array<FieldRuleOperator | null>, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null } | null }> | null, logicRules?: Array<{ __typename?: 'FormLogicRule', booleanOperator: FormLogicOperator, command: FormLogicCommand, id: number, jumpToId?: number | null, position: number, formElementId: number, conditions?: Array<{ __typename?: 'FormLogicCondition', id: number, operator: FieldRuleOperator, value?: any | null, subjectId: number, ruleId: number }> | null }> | null } | null, invitedGroups?: Array<{ __typename?: 'Group', id: number, name: string }> | null } | null, projectBySlug?: { __typename?: 'Project', id: number, name: string, url?: string | null, region: { __typename?: 'GeometryPolygon', geojson?: any | null } } | null };

export type FormElementTypesQueryVariables = Exact<{ [key: string]: never; }>;


export type FormElementTypesQuery = { __typename?: 'Query', formElementTypes?: Array<{ __typename?: 'FormElementType', componentName: string, isHidden: boolean, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, supportedOperators: Array<FieldRuleOperator | null>, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null }> | null };

export type UpdateSurveyBaseSettingsMutationVariables = Exact<{
  id: Scalars['Int'];
  showProgress?: InputMaybe<Scalars['Boolean']>;
  showFacilitationOption?: InputMaybe<Scalars['Boolean']>;
  supportedLanguages?: InputMaybe<Array<InputMaybe<Scalars['String']>> | InputMaybe<Scalars['String']>>;
}>;


export type UpdateSurveyBaseSettingsMutation = { __typename?: 'Mutation', updateSurvey?: { __typename?: 'UpdateSurveyPayload', survey?: { __typename?: 'Survey', id: number, showProgress: boolean, showFacilitationOption: boolean, supportedLanguages: Array<string | null> } | null } | null };

export type UpdateFormElementSketchClassMutationVariables = Exact<{
  id: Scalars['Int'];
  geometryType?: InputMaybe<SketchGeometryType>;
  allowMulti?: InputMaybe<Scalars['Boolean']>;
  mapboxGlStyle?: InputMaybe<Scalars['JSON']>;
  geoprocessingClientName?: InputMaybe<Scalars['String']>;
  geoprocessingClientUrl?: InputMaybe<Scalars['String']>;
  geoprocessingProjectUrl?: InputMaybe<Scalars['String']>;
}>;


export type UpdateFormElementSketchClassMutation = { __typename?: 'Mutation', updateSketchClass?: { __typename?: 'UpdateSketchClassPayload', sketchClass?: { __typename?: 'SketchClass', id: number, geometryType: SketchGeometryType, allowMulti: boolean, mapboxGlStyle?: any | null, geoprocessingClientName?: string | null, geoprocessingClientUrl?: string | null, geoprocessingProjectUrl?: string | null } | null } | null };

export type UpdateFormElementMutationVariables = Exact<{
  id: Scalars['Int'];
  isRequired?: InputMaybe<Scalars['Boolean']>;
  body?: InputMaybe<Scalars['JSON']>;
  exportId?: InputMaybe<Scalars['String']>;
  componentSettings?: InputMaybe<Scalars['JSON']>;
  alternateLanguageSettings?: InputMaybe<Scalars['JSON']>;
  jumpToId?: InputMaybe<Scalars['Int']>;
  typeId?: InputMaybe<Scalars['String']>;
}>;


export type UpdateFormElementMutation = { __typename?: 'Mutation', updateFormElement?: { __typename?: 'UpdateFormElementPayload', formElement?: { __typename?: 'FormElement', id: number, isRequired: boolean, body: any, exportId?: string | null, componentSettings: any, alternateLanguageSettings: any, jumpToId?: number | null, typeId: string } | null } | null };

export type UpdateComponentSettingsMutationVariables = Exact<{
  id: Scalars['Int'];
  componentSettings?: InputMaybe<Scalars['JSON']>;
}>;


export type UpdateComponentSettingsMutation = { __typename?: 'Mutation', updateFormElement?: { __typename?: 'UpdateFormElementPayload', formElement?: { __typename?: 'FormElement', id: number, componentSettings: any } | null } | null };

export type UpdateAlternateLanguageSettingsMutationVariables = Exact<{
  id: Scalars['Int'];
  alternateLanguageSettings?: InputMaybe<Scalars['JSON']>;
}>;


export type UpdateAlternateLanguageSettingsMutation = { __typename?: 'Mutation', updateFormElement?: { __typename?: 'UpdateFormElementPayload', formElement?: { __typename?: 'FormElement', id: number, alternateLanguageSettings: any } | null } | null };

export type UpdateFormElementBodyMutationVariables = Exact<{
  id: Scalars['Int'];
  body: Scalars['JSON'];
}>;


export type UpdateFormElementBodyMutation = { __typename?: 'Mutation', updateFormElement?: { __typename?: 'UpdateFormElementPayload', formElement?: { __typename?: 'FormElement', id: number, body: any } | null } | null };

export type UpdateFormElementOrderMutationVariables = Exact<{
  elementIds?: InputMaybe<Array<InputMaybe<Scalars['Int']>> | InputMaybe<Scalars['Int']>>;
}>;


export type UpdateFormElementOrderMutation = { __typename?: 'Mutation', setFormElementOrder?: { __typename?: 'SetFormElementOrderPayload', formElements?: Array<{ __typename?: 'FormElement', id: number, position: number }> | null } | null };

export type AddFormElementMutationVariables = Exact<{
  body: Scalars['JSON'];
  componentSettings: Scalars['JSON'];
  formId: Scalars['Int'];
  componentType: Scalars['String'];
  position?: InputMaybe<Scalars['Int']>;
  exportId?: InputMaybe<Scalars['String']>;
  subordinateTo?: InputMaybe<Scalars['Int']>;
  isRequired: Scalars['Boolean'];
}>;


export type AddFormElementMutation = { __typename?: 'Mutation', createFormElement?: { __typename?: 'CreateFormElementPayload', formElement?: { __typename?: 'FormElement', body: any, componentSettings: any, alternateLanguageSettings: any, exportId?: string | null, formId: number, id: number, isRequired: boolean, position: number, jumpToId?: number | null, isInput?: boolean | null, typeId: string, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, layout?: FormElementLayout | null, backgroundPalette?: Array<string | null> | null, textVariant: FormElementTextVariant, unsplashAuthorUrl?: string | null, unsplashAuthorName?: string | null, backgroundWidth?: number | null, backgroundHeight?: number | null, subordinateTo?: number | null, mapBasemaps?: Array<number | null> | null, mapCameraOptions?: any | null, sketchClass?: { __typename?: 'SketchClass', id: number, mapboxGlStyle?: any | null, formElementId?: number | null, geometryType: SketchGeometryType, geoprocessingClientName?: string | null, geoprocessingClientUrl?: string | null, geoprocessingProjectUrl?: string | null, allowMulti: boolean, form?: { __typename?: 'Form', id: number, formElements?: Array<{ __typename?: 'FormElement', body: any, componentSettings: any, alternateLanguageSettings: any, exportId?: string | null, formId: number, id: number, isRequired: boolean, position: number, jumpToId?: number | null, isInput?: boolean | null, typeId: string, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, layout?: FormElementLayout | null, backgroundPalette?: Array<string | null> | null, textVariant: FormElementTextVariant, unsplashAuthorUrl?: string | null, unsplashAuthorName?: string | null, backgroundWidth?: number | null, backgroundHeight?: number | null, subordinateTo?: number | null, mapBasemaps?: Array<number | null> | null, mapCameraOptions?: any | null, type?: { __typename?: 'FormElementType', componentName: string, isHidden: boolean, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, supportedOperators: Array<FieldRuleOperator | null>, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null } | null }> | null, logicRules?: Array<{ __typename?: 'FormLogicRule', booleanOperator: FormLogicOperator, command: FormLogicCommand, id: number, jumpToId?: number | null, position: number, formElementId: number, conditions?: Array<{ __typename?: 'FormLogicCondition', id: number, operator: FieldRuleOperator, value?: any | null, subjectId: number, ruleId: number }> | null }> | null } | null } | null, type?: { __typename?: 'FormElementType', componentName: string, isHidden: boolean, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, supportedOperators: Array<FieldRuleOperator | null>, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null } | null } | null } | null };

export type DeleteFormElementMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteFormElementMutation = { __typename?: 'Mutation', deleteFormElement?: { __typename?: 'DeleteFormElementPayload', formElement?: { __typename?: 'FormElement', id: number } | null } | null };

export type UpdateFormMutationVariables = Exact<{
  id: Scalars['Int'];
  isTemplate?: InputMaybe<Scalars['Boolean']>;
  templateName?: InputMaybe<Scalars['String']>;
}>;


export type UpdateFormMutation = { __typename?: 'Mutation', updateForm?: { __typename?: 'UpdateFormPayload', form?: { __typename?: 'Form', id: number, isTemplate: boolean, templateName?: string | null } | null } | null };

export type GetPhotosQueryVariables = Exact<{
  query: Scalars['String'];
}>;


export type GetPhotosQuery = { __typename?: 'Query', getUnsplashPhotos: { __typename?: 'UnsplashSearchResult', results: Array<{ __typename?: 'UnsplashPhoto', blur_hash?: string | null, color: string, description?: string | null, height: number, width: number, id: string, links: { __typename?: 'UnsplashPhotoLinks', download_location: string }, urls: { __typename?: 'UnsplashUrls', full: string, raw: string, regular: string, small: string, thumb: string }, user: { __typename?: 'UnsplashUser', id: string, name: string, username: string, links: { __typename?: 'UnsplashLinks', html: string } } }> } };

export type UpdateFormElementBackgroundMutationVariables = Exact<{
  id: Scalars['Int'];
  backgroundColor?: InputMaybe<Scalars['String']>;
  secondaryColor?: InputMaybe<Scalars['String']>;
  backgroundPalette?: InputMaybe<Array<InputMaybe<Scalars['String']>> | InputMaybe<Scalars['String']>>;
  textVariant?: InputMaybe<FormElementTextVariant>;
  layout?: InputMaybe<FormElementLayout>;
}>;


export type UpdateFormElementBackgroundMutation = { __typename?: 'Mutation', updateFormElement?: { __typename?: 'UpdateFormElementPayload', formElement?: { __typename?: 'FormElement', id: number, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, layout?: FormElementLayout | null, backgroundPalette?: Array<string | null> | null, textVariant: FormElementTextVariant, unsplashAuthorName?: string | null, unsplashAuthorUrl?: string | null } | null } | null };

export type SetFormElementBackgroundMutationVariables = Exact<{
  id: Scalars['Int'];
  backgroundColor: Scalars['String'];
  secondaryColor: Scalars['String'];
  backgroundUrl: Scalars['String'];
  downloadUrl: Scalars['String'];
  backgroundPalette: Array<InputMaybe<Scalars['String']>> | InputMaybe<Scalars['String']>;
  unsplashAuthorUrl: Scalars['String'];
  unsplashAuthorName: Scalars['String'];
  backgroundWidth: Scalars['Int'];
  backgroundHeight: Scalars['Int'];
}>;


export type SetFormElementBackgroundMutation = { __typename?: 'Mutation', setFormElementBackground: { __typename?: 'FormElement', id: number, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, backgroundPalette?: Array<string | null> | null, unsplashAuthorName?: string | null, unsplashAuthorUrl?: string | null, backgroundWidth?: number | null, backgroundHeight?: number | null } };

export type ClearFormElementStyleMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type ClearFormElementStyleMutation = { __typename?: 'Mutation', clearFormElementStyle?: { __typename?: 'ClearFormElementStylePayload', formElement?: { __typename?: 'FormElement', id: number, backgroundColor?: string | null, backgroundImage?: string | null, backgroundPalette?: Array<string | null> | null, unsplashAuthorName?: string | null, unsplashAuthorUrl?: string | null, textVariant: FormElementTextVariant, secondaryColor?: string | null, layout?: FormElementLayout | null } | null } | null };

export type CreateLogicRuleForSurveyMutationVariables = Exact<{
  formElementId: Scalars['Int'];
  operator: FieldRuleOperator;
  jumpToId: Scalars['Int'];
}>;


export type CreateLogicRuleForSurveyMutation = { __typename?: 'Mutation', createSurveyJumpRule?: { __typename?: 'CreateSurveyJumpRulePayload', formLogicRule?: { __typename?: 'FormLogicRule', id: number, position: number, booleanOperator: FormLogicOperator, command: FormLogicCommand, formElementId: number, jumpToId?: number | null, conditions?: Array<{ __typename?: 'FormLogicCondition', id: number, operator: FieldRuleOperator, ruleId: number, subjectId: number, value?: any | null }> | null } | null } | null };

export type UpdateFormLogicRuleMutationVariables = Exact<{
  id: Scalars['Int'];
  jumpToId?: InputMaybe<Scalars['Int']>;
  booleanOperator?: InputMaybe<FormLogicOperator>;
  formElementId?: InputMaybe<Scalars['Int']>;
}>;


export type UpdateFormLogicRuleMutation = { __typename?: 'Mutation', updateFormLogicRule?: { __typename?: 'UpdateFormLogicRulePayload', formLogicRule?: { __typename?: 'FormLogicRule', id: number, booleanOperator: FormLogicOperator, command: FormLogicCommand, jumpToId?: number | null, position: number, formElementId: number } | null } | null };

export type UpdateLogicConditionMutationVariables = Exact<{
  id: Scalars['Int'];
  operator?: InputMaybe<FieldRuleOperator>;
  value?: InputMaybe<Scalars['JSON']>;
  subjectId?: InputMaybe<Scalars['Int']>;
}>;


export type UpdateLogicConditionMutation = { __typename?: 'Mutation', updateFormLogicCondition?: { __typename?: 'UpdateFormLogicConditionPayload', formLogicCondition?: { __typename?: 'FormLogicCondition', id: number, ruleId: number, operator: FieldRuleOperator, subjectId: number, value?: any | null } | null } | null };

export type DeleteLogicConditionMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteLogicConditionMutation = { __typename?: 'Mutation', deleteFormLogicCondition?: { __typename?: 'DeleteFormLogicConditionPayload', formLogicCondition?: { __typename?: 'FormLogicCondition', id: number, ruleId: number } | null } | null };

export type DeleteLogicRuleMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteLogicRuleMutation = { __typename?: 'Mutation', deleteFormLogicRule?: { __typename?: 'DeleteFormLogicRulePayload', formLogicRule?: { __typename?: 'FormLogicRule', id: number, formElementId: number } | null } | null };

export type AddConditionMutationVariables = Exact<{
  operator: FieldRuleOperator;
  ruleId: Scalars['Int'];
  subjectId: Scalars['Int'];
  value?: InputMaybe<Scalars['JSON']>;
}>;


export type AddConditionMutation = { __typename?: 'Mutation', createFormLogicCondition?: { __typename?: 'CreateFormLogicConditionPayload', formLogicCondition?: { __typename?: 'FormLogicCondition', id: number, operator: FieldRuleOperator, ruleId: number, subjectId: number, value?: any | null } | null } | null };

export type UpdateSurveyDraftStatusMutationVariables = Exact<{
  id: Scalars['Int'];
  isDisabled: Scalars['Boolean'];
}>;


export type UpdateSurveyDraftStatusMutation = { __typename?: 'Mutation', updateSurvey?: { __typename?: 'UpdateSurveyPayload', survey?: { __typename?: 'Survey', id: number, isDisabled: boolean } | null } | null };

export type UploadConsentDocMutationVariables = Exact<{
  document: Scalars['Upload'];
  formElementId: Scalars['Int'];
  version: Scalars['Int'];
}>;


export type UploadConsentDocMutation = { __typename?: 'Mutation', uploadConsentDocument: { __typename?: 'FormElement', id: number, componentSettings: any } };

export type SurveyResponseFragment = { __typename?: 'SurveyResponse', id: number, surveyId: number, bypassedDuplicateSubmissionControl: boolean, updatedAt?: any | null, accountEmail?: string | null, userId?: number | null, createdAt: any, data: any, isDuplicateEntry: boolean, isDuplicateIp: boolean, isPractice: boolean, isUnrecognizedUserAgent: boolean, archived: boolean, lastUpdatedByEmail?: string | null };

export type FormElementExtendedDetailsFragment = { __typename?: 'FormElement', body: any, componentSettings: any, alternateLanguageSettings: any, exportId?: string | null, formId: number, id: number, isRequired: boolean, position: number, jumpToId?: number | null, isInput?: boolean | null, typeId: string, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, layout?: FormElementLayout | null, backgroundPalette?: Array<string | null> | null, textVariant: FormElementTextVariant, unsplashAuthorUrl?: string | null, unsplashAuthorName?: string | null, backgroundWidth?: number | null, backgroundHeight?: number | null, subordinateTo?: number | null, mapBasemaps?: Array<number | null> | null, mapCameraOptions?: any | null, surveyConsentDocumentsConnection: { __typename?: 'SurveyConsentDocumentsConnection', nodes: Array<{ __typename?: 'SurveyConsentDocument', url: string, version: number }> }, type?: { __typename?: 'FormElementType', componentName: string, isHidden: boolean, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, supportedOperators: Array<FieldRuleOperator | null>, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null } | null };

export type SurveyResponsesQueryVariables = Exact<{
  surveyId: Scalars['Int'];
}>;


export type SurveyResponsesQuery = { __typename?: 'Query', survey?: { __typename?: 'Survey', id: number, practiceResponseCount?: number | null, archivedResponseCount?: number | null, submittedResponseCount?: number | null, form?: { __typename?: 'Form', formElements?: Array<{ __typename?: 'FormElement', body: any, componentSettings: any, alternateLanguageSettings: any, exportId?: string | null, formId: number, id: number, isRequired: boolean, position: number, jumpToId?: number | null, isInput?: boolean | null, typeId: string, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, layout?: FormElementLayout | null, backgroundPalette?: Array<string | null> | null, textVariant: FormElementTextVariant, unsplashAuthorUrl?: string | null, unsplashAuthorName?: string | null, backgroundWidth?: number | null, backgroundHeight?: number | null, subordinateTo?: number | null, mapBasemaps?: Array<number | null> | null, mapCameraOptions?: any | null, surveyConsentDocumentsConnection: { __typename?: 'SurveyConsentDocumentsConnection', nodes: Array<{ __typename?: 'SurveyConsentDocument', url: string, version: number }> }, type?: { __typename?: 'FormElementType', componentName: string, isHidden: boolean, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, supportedOperators: Array<FieldRuleOperator | null>, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null } | null }> | null, logicRules?: Array<{ __typename?: 'FormLogicRule', booleanOperator: FormLogicOperator, command: FormLogicCommand, formElementId: number, id: number, jumpToId?: number | null, position: number, conditions?: Array<{ __typename?: 'FormLogicCondition', id: number, operator: FieldRuleOperator, ruleId: number, subjectId: number, value?: any | null }> | null }> | null } | null, surveyResponsesConnection: { __typename?: 'SurveyResponsesConnection', nodes: Array<{ __typename?: 'SurveyResponse', id: number, surveyId: number, bypassedDuplicateSubmissionControl: boolean, updatedAt?: any | null, accountEmail?: string | null, userId?: number | null, createdAt: any, data: any, isDuplicateEntry: boolean, isDuplicateIp: boolean, isPractice: boolean, isUnrecognizedUserAgent: boolean, archived: boolean, lastUpdatedByEmail?: string | null }> } } | null };

export type SurveyMapDetailsQueryVariables = Exact<{
  surveyId: Scalars['Int'];
}>;


export type SurveyMapDetailsQuery = { __typename?: 'Query', survey?: { __typename?: 'Survey', form?: { __typename?: 'Form', id: number, formElements?: Array<{ __typename?: 'FormElement', body: any, componentSettings: any, alternateLanguageSettings: any, exportId?: string | null, formId: number, id: number, isRequired: boolean, position: number, jumpToId?: number | null, isInput?: boolean | null, typeId: string, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, layout?: FormElementLayout | null, backgroundPalette?: Array<string | null> | null, textVariant: FormElementTextVariant, unsplashAuthorUrl?: string | null, unsplashAuthorName?: string | null, backgroundWidth?: number | null, backgroundHeight?: number | null, subordinateTo?: number | null, mapBasemaps?: Array<number | null> | null, mapCameraOptions?: any | null, type?: { __typename?: 'FormElementType', componentName: string, isHidden: boolean, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, supportedOperators: Array<FieldRuleOperator | null>, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null } | null }> | null } | null } | null };

export type ToggleResponsesPracticeMutationVariables = Exact<{
  ids?: InputMaybe<Array<InputMaybe<Scalars['Int']>> | InputMaybe<Scalars['Int']>>;
  isPractice?: InputMaybe<Scalars['Boolean']>;
}>;


export type ToggleResponsesPracticeMutation = { __typename?: 'Mutation', toggleResponsesPractice?: { __typename?: 'ToggleResponsesPracticePayload', surveyResponses?: Array<{ __typename?: 'SurveyResponse', id: number, isPractice: boolean, archived: boolean, lastUpdatedByEmail?: string | null, survey?: { __typename?: 'Survey', id: number, practiceResponseCount?: number | null, archivedResponseCount?: number | null, submittedResponseCount?: number | null } | null }> | null } | null };

export type ArchiveResponsesMutationVariables = Exact<{
  ids?: InputMaybe<Array<InputMaybe<Scalars['Int']>> | InputMaybe<Scalars['Int']>>;
  makeArchived?: InputMaybe<Scalars['Boolean']>;
}>;


export type ArchiveResponsesMutation = { __typename?: 'Mutation', archiveResponses?: { __typename?: 'ArchiveResponsesPayload', surveyResponses?: Array<{ __typename?: 'SurveyResponse', id: number, isPractice: boolean, archived: boolean, lastUpdatedByEmail?: string | null, survey?: { __typename?: 'Survey', id: number, practiceResponseCount?: number | null, archivedResponseCount?: number | null, submittedResponseCount?: number | null } | null }> | null } | null };

export type ModifyAnswersMutationVariables = Exact<{
  responseIds: Array<InputMaybe<Scalars['Int']>> | InputMaybe<Scalars['Int']>;
  answers?: InputMaybe<Scalars['JSON']>;
}>;


export type ModifyAnswersMutation = { __typename?: 'Mutation', modifySurveyAnswers?: { __typename?: 'ModifySurveyAnswersPayload', surveyResponses?: Array<{ __typename?: 'SurveyResponse', id: number, data: any, updatedAt?: any | null, lastUpdatedByEmail?: string | null }> | null } | null };

export type CopyAppearanceMutationVariables = Exact<{
  id: Scalars['Int'];
  copyFrom: Scalars['Int'];
}>;


export type CopyAppearanceMutation = { __typename?: 'Mutation', copyAppearance?: { __typename?: 'CopyAppearancePayload', formElement?: { __typename?: 'FormElement', id: number, backgroundImage?: string | null, backgroundColor?: string | null, secondaryColor?: string | null, backgroundPalette?: Array<string | null> | null, unsplashAuthorName?: string | null, unsplashAuthorUrl?: string | null, backgroundHeight?: number | null, backgroundWidth?: number | null, layout?: FormElementLayout | null, textVariant: FormElementTextVariant } | null } | null };

export type UpdateFormElementBasemapsMutationVariables = Exact<{
  id: Scalars['Int'];
  mapBasemaps?: InputMaybe<Array<InputMaybe<Scalars['Int']>> | InputMaybe<Scalars['Int']>>;
}>;


export type UpdateFormElementBasemapsMutation = { __typename?: 'Mutation', updateFormElement?: { __typename?: 'UpdateFormElementPayload', formElement?: { __typename?: 'FormElement', id: number, mapBasemaps?: Array<number | null> | null } | null } | null };

export type UpdateFormElementMapCameraMutationVariables = Exact<{
  id: Scalars['Int'];
  mapCameraOptions?: InputMaybe<Scalars['JSON']>;
}>;


export type UpdateFormElementMapCameraMutation = { __typename?: 'Mutation', updateFormElement?: { __typename?: 'UpdateFormElementPayload', formElement?: { __typename?: 'FormElement', id: number, mapCameraOptions?: any | null } | null } | null };

export type AllBasemapsQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type AllBasemapsQuery = { __typename?: 'Query', projectBySlug?: { __typename?: 'Project', id: number, basemaps?: Array<{ __typename?: 'Basemap', id: number, attribution?: string | null, labelsLayerId?: string | null, name: string, description?: string | null, projectId?: number | null, terrainExaggeration: any, terrainMaxZoom: number, terrainOptional: boolean, terrainTileSize: number, terrainUrl?: string | null, terrainVisibilityDefault: boolean, thumbnail: string, tileSize: number, type: BasemapType, url: string, surveysOnly: boolean, interactivitySettings?: { __typename?: 'InteractivitySetting', cursor: CursorType, id: number, layers?: Array<string | null> | null, longTemplate?: string | null, shortTemplate?: string | null, type: InteractivityType } | null, optionalBasemapLayers: Array<{ __typename?: 'OptionalBasemapLayer', basemapId: number, id: number, defaultVisibility: boolean, description?: string | null, options?: any | null, groupType: OptionalBasemapLayersGroupType, layers: Array<string | null>, metadata?: any | null, name: string }> }> | null, surveyBasemaps?: Array<{ __typename?: 'Basemap', id: number, attribution?: string | null, labelsLayerId?: string | null, name: string, description?: string | null, projectId?: number | null, terrainExaggeration: any, terrainMaxZoom: number, terrainOptional: boolean, terrainTileSize: number, terrainUrl?: string | null, terrainVisibilityDefault: boolean, thumbnail: string, tileSize: number, type: BasemapType, url: string, surveysOnly: boolean, relatedFormElements?: Array<{ __typename?: 'FormElement', id: number }> | null, interactivitySettings?: { __typename?: 'InteractivitySetting', cursor: CursorType, id: number, layers?: Array<string | null> | null, longTemplate?: string | null, shortTemplate?: string | null, type: InteractivityType } | null, optionalBasemapLayers: Array<{ __typename?: 'OptionalBasemapLayer', basemapId: number, id: number, defaultVisibility: boolean, description?: string | null, options?: any | null, groupType: OptionalBasemapLayersGroupType, layers: Array<string | null>, metadata?: any | null, name: string }> }> | null } | null };

export type GetFormElementQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type GetFormElementQuery = { __typename?: 'Query', formElement?: { __typename?: 'FormElement', body: any, componentSettings: any, alternateLanguageSettings: any, exportId?: string | null, formId: number, id: number, isRequired: boolean, position: number, jumpToId?: number | null, isInput?: boolean | null, typeId: string, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, layout?: FormElementLayout | null, backgroundPalette?: Array<string | null> | null, textVariant: FormElementTextVariant, unsplashAuthorUrl?: string | null, unsplashAuthorName?: string | null, backgroundWidth?: number | null, backgroundHeight?: number | null, subordinateTo?: number | null, mapBasemaps?: Array<number | null> | null, mapCameraOptions?: any | null, type?: { __typename?: 'FormElementType', componentName: string, isHidden: boolean, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, supportedOperators: Array<FieldRuleOperator | null>, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null } | null } | null };

export type SurveyAppRuleFragment = { __typename?: 'FormLogicRule', booleanOperator: FormLogicOperator, command: FormLogicCommand, formElementId: number, id: number, jumpToId?: number | null, position: number, conditions?: Array<{ __typename?: 'FormLogicCondition', id: number, operator: FieldRuleOperator, ruleId: number, subjectId: number, value?: any | null }> | null };

export type SurveyAppFormElementFragment = { __typename?: 'FormElement', id: number, componentSettings: any, alternateLanguageSettings: any, body: any, isRequired: boolean, isInput?: boolean | null, position: number, typeId: string, formId: number, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, layout?: FormElementLayout | null, textVariant: FormElementTextVariant, unsplashAuthorName?: string | null, unsplashAuthorUrl?: string | null, backgroundWidth?: number | null, backgroundHeight?: number | null, jumpToId?: number | null, subordinateTo?: number | null, mapBasemaps?: Array<number | null> | null, mapCameraOptions?: any | null, type?: { __typename?: 'FormElementType', componentName: string, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null, supportedOperators: Array<FieldRuleOperator | null>, isHidden: boolean } | null, sketchClass?: { __typename?: 'SketchClass', id: number, mapboxGlStyle?: any | null, formElementId?: number | null, geometryType: SketchGeometryType, geoprocessingClientName?: string | null, geoprocessingClientUrl?: string | null, geoprocessingProjectUrl?: string | null, allowMulti: boolean, form?: { __typename?: 'Form', id: number, formElements?: Array<{ __typename?: 'FormElement', body: any, componentSettings: any, alternateLanguageSettings: any, exportId?: string | null, formId: number, id: number, isRequired: boolean, position: number, jumpToId?: number | null, isInput?: boolean | null, typeId: string, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, layout?: FormElementLayout | null, backgroundPalette?: Array<string | null> | null, textVariant: FormElementTextVariant, unsplashAuthorUrl?: string | null, unsplashAuthorName?: string | null, backgroundWidth?: number | null, backgroundHeight?: number | null, subordinateTo?: number | null, mapBasemaps?: Array<number | null> | null, mapCameraOptions?: any | null, type?: { __typename?: 'FormElementType', componentName: string, isHidden: boolean, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, supportedOperators: Array<FieldRuleOperator | null>, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null } | null }> | null, logicRules?: Array<{ __typename?: 'FormLogicRule', booleanOperator: FormLogicOperator, command: FormLogicCommand, id: number, jumpToId?: number | null, position: number, formElementId: number, conditions?: Array<{ __typename?: 'FormLogicCondition', id: number, operator: FieldRuleOperator, value?: any | null, subjectId: number, ruleId: number }> | null }> | null } | null } | null };

export type SurveyAppSurveyFragment = { __typename?: 'Survey', id: number, name: string, accessType: SurveyAccessType, isDisabled: boolean, showProgress: boolean, showFacilitationOption: boolean, supportedLanguages: Array<string | null>, form?: { __typename?: 'Form', id: number, logicRules?: Array<{ __typename?: 'FormLogicRule', booleanOperator: FormLogicOperator, command: FormLogicCommand, formElementId: number, id: number, jumpToId?: number | null, position: number, conditions?: Array<{ __typename?: 'FormLogicCondition', id: number, operator: FieldRuleOperator, ruleId: number, subjectId: number, value?: any | null }> | null }> | null, formElements?: Array<{ __typename?: 'FormElement', id: number, componentSettings: any, alternateLanguageSettings: any, body: any, isRequired: boolean, isInput?: boolean | null, position: number, typeId: string, formId: number, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, layout?: FormElementLayout | null, textVariant: FormElementTextVariant, unsplashAuthorName?: string | null, unsplashAuthorUrl?: string | null, backgroundWidth?: number | null, backgroundHeight?: number | null, jumpToId?: number | null, subordinateTo?: number | null, mapBasemaps?: Array<number | null> | null, mapCameraOptions?: any | null, type?: { __typename?: 'FormElementType', componentName: string, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null, supportedOperators: Array<FieldRuleOperator | null>, isHidden: boolean } | null, sketchClass?: { __typename?: 'SketchClass', id: number, mapboxGlStyle?: any | null, formElementId?: number | null, geometryType: SketchGeometryType, geoprocessingClientName?: string | null, geoprocessingClientUrl?: string | null, geoprocessingProjectUrl?: string | null, allowMulti: boolean, form?: { __typename?: 'Form', id: number, formElements?: Array<{ __typename?: 'FormElement', body: any, componentSettings: any, alternateLanguageSettings: any, exportId?: string | null, formId: number, id: number, isRequired: boolean, position: number, jumpToId?: number | null, isInput?: boolean | null, typeId: string, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, layout?: FormElementLayout | null, backgroundPalette?: Array<string | null> | null, textVariant: FormElementTextVariant, unsplashAuthorUrl?: string | null, unsplashAuthorName?: string | null, backgroundWidth?: number | null, backgroundHeight?: number | null, subordinateTo?: number | null, mapBasemaps?: Array<number | null> | null, mapCameraOptions?: any | null, type?: { __typename?: 'FormElementType', componentName: string, isHidden: boolean, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, supportedOperators: Array<FieldRuleOperator | null>, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null } | null }> | null, logicRules?: Array<{ __typename?: 'FormLogicRule', booleanOperator: FormLogicOperator, command: FormLogicCommand, id: number, jumpToId?: number | null, position: number, formElementId: number, conditions?: Array<{ __typename?: 'FormLogicCondition', id: number, operator: FieldRuleOperator, value?: any | null, subjectId: number, ruleId: number }> | null }> | null } | null } | null }> | null } | null };

export type SurveyQueryVariables = Exact<{
  id: Scalars['Int'];
  slug: Scalars['String'];
}>;


export type SurveyQuery = { __typename?: 'Query', projectPublicDetails?: { __typename?: 'PublicProjectDetail', id?: number | null, accessControl?: ProjectAccessControlSetting | null, slug?: string | null, name?: string | null, logoUrl?: string | null, supportEmail?: string | null, accessStatus?: ProjectAccessStatus | null } | null, me?: { __typename?: 'User', id: number, isAdmin?: boolean | null, profile?: { __typename?: 'Profile', userId: number, fullname?: string | null, nickname?: string | null, email?: any | null, picture?: string | null, bio?: string | null, affiliations?: string | null } | null } | null, currentProject?: { __typename?: 'Project', id: number, name: string, url?: string | null, mapboxPublicKey?: string | null, mapboxSecretKey?: string | null, slug: string, description?: string | null, logoLink?: string | null, logoUrl?: string | null, accessControl: ProjectAccessControlSetting, sessionIsAdmin?: boolean | null, isFeatured: boolean, supportEmail: string, region: { __typename?: 'GeometryPolygon', geojson?: any | null }, basemaps?: Array<{ __typename?: 'Basemap', id: number, attribution?: string | null, labelsLayerId?: string | null, name: string, description?: string | null, projectId?: number | null, terrainExaggeration: any, terrainMaxZoom: number, terrainOptional: boolean, terrainTileSize: number, terrainUrl?: string | null, terrainVisibilityDefault: boolean, thumbnail: string, tileSize: number, type: BasemapType, url: string, surveysOnly: boolean, interactivitySettings?: { __typename?: 'InteractivitySetting', cursor: CursorType, id: number, layers?: Array<string | null> | null, longTemplate?: string | null, shortTemplate?: string | null, type: InteractivityType } | null, optionalBasemapLayers: Array<{ __typename?: 'OptionalBasemapLayer', basemapId: number, id: number, defaultVisibility: boolean, description?: string | null, options?: any | null, groupType: OptionalBasemapLayersGroupType, layers: Array<string | null>, metadata?: any | null, name: string }> }> | null, surveyBasemaps?: Array<{ __typename?: 'Basemap', id: number, attribution?: string | null, labelsLayerId?: string | null, name: string, description?: string | null, projectId?: number | null, terrainExaggeration: any, terrainMaxZoom: number, terrainOptional: boolean, terrainTileSize: number, terrainUrl?: string | null, terrainVisibilityDefault: boolean, thumbnail: string, tileSize: number, type: BasemapType, url: string, surveysOnly: boolean, interactivitySettings?: { __typename?: 'InteractivitySetting', cursor: CursorType, id: number, layers?: Array<string | null> | null, longTemplate?: string | null, shortTemplate?: string | null, type: InteractivityType } | null, optionalBasemapLayers: Array<{ __typename?: 'OptionalBasemapLayer', basemapId: number, id: number, defaultVisibility: boolean, description?: string | null, options?: any | null, groupType: OptionalBasemapLayersGroupType, layers: Array<string | null>, metadata?: any | null, name: string }> }> | null } | null, survey?: { __typename?: 'Survey', id: number, name: string, accessType: SurveyAccessType, isDisabled: boolean, showProgress: boolean, showFacilitationOption: boolean, supportedLanguages: Array<string | null>, form?: { __typename?: 'Form', id: number, logicRules?: Array<{ __typename?: 'FormLogicRule', booleanOperator: FormLogicOperator, command: FormLogicCommand, formElementId: number, id: number, jumpToId?: number | null, position: number, conditions?: Array<{ __typename?: 'FormLogicCondition', id: number, operator: FieldRuleOperator, ruleId: number, subjectId: number, value?: any | null }> | null }> | null, formElements?: Array<{ __typename?: 'FormElement', id: number, componentSettings: any, alternateLanguageSettings: any, body: any, isRequired: boolean, isInput?: boolean | null, position: number, typeId: string, formId: number, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, layout?: FormElementLayout | null, textVariant: FormElementTextVariant, unsplashAuthorName?: string | null, unsplashAuthorUrl?: string | null, backgroundWidth?: number | null, backgroundHeight?: number | null, jumpToId?: number | null, subordinateTo?: number | null, mapBasemaps?: Array<number | null> | null, mapCameraOptions?: any | null, type?: { __typename?: 'FormElementType', componentName: string, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null, supportedOperators: Array<FieldRuleOperator | null>, isHidden: boolean } | null, sketchClass?: { __typename?: 'SketchClass', id: number, mapboxGlStyle?: any | null, formElementId?: number | null, geometryType: SketchGeometryType, geoprocessingClientName?: string | null, geoprocessingClientUrl?: string | null, geoprocessingProjectUrl?: string | null, allowMulti: boolean, form?: { __typename?: 'Form', id: number, formElements?: Array<{ __typename?: 'FormElement', body: any, componentSettings: any, alternateLanguageSettings: any, exportId?: string | null, formId: number, id: number, isRequired: boolean, position: number, jumpToId?: number | null, isInput?: boolean | null, typeId: string, backgroundColor?: string | null, secondaryColor?: string | null, backgroundImage?: string | null, layout?: FormElementLayout | null, backgroundPalette?: Array<string | null> | null, textVariant: FormElementTextVariant, unsplashAuthorUrl?: string | null, unsplashAuthorName?: string | null, backgroundWidth?: number | null, backgroundHeight?: number | null, subordinateTo?: number | null, mapBasemaps?: Array<number | null> | null, mapCameraOptions?: any | null, type?: { __typename?: 'FormElementType', componentName: string, isHidden: boolean, isInput: boolean, isSingleUseOnly: boolean, isSurveysOnly: boolean, label: string, supportedOperators: Array<FieldRuleOperator | null>, isSpatial: boolean, allowedLayouts?: Array<FormElementLayout | null> | null } | null }> | null, logicRules?: Array<{ __typename?: 'FormLogicRule', booleanOperator: FormLogicOperator, command: FormLogicCommand, id: number, jumpToId?: number | null, position: number, formElementId: number, conditions?: Array<{ __typename?: 'FormLogicCondition', id: number, operator: FieldRuleOperator, value?: any | null, subjectId: number, ruleId: number }> | null }> | null } | null } | null }> | null } | null } | null };

export type CreateResponseMutationVariables = Exact<{
  surveyId: Scalars['Int'];
  isDraft: Scalars['Boolean'];
  bypassedDuplicateSubmissionControl: Scalars['Boolean'];
  responseData: Scalars['JSON'];
  facilitated: Scalars['Boolean'];
  practice: Scalars['Boolean'];
}>;


export type CreateResponseMutation = { __typename?: 'Mutation', createSurveyResponse?: { __typename?: 'CreateSurveyResponsePayload', clientMutationId?: string | null, surveyResponse?: { __typename?: 'SurveyResponse', id: number } | null } | null };

export type UpdateProjectNameMutationVariables = Exact<{
  name: Scalars['String'];
  slug: Scalars['String'];
  clientMutationId?: InputMaybe<Scalars['String']>;
}>;


export type UpdateProjectNameMutation = { __typename?: 'Mutation', updateProjectBySlug?: { __typename?: 'UpdateProjectPayload', clientMutationId?: string | null, project?: { __typename?: 'Project', id: number, name: string } | null } | null };

export type UpdateProjectSettingsMutationVariables = Exact<{
  slug: Scalars['String'];
  clientMutationId?: InputMaybe<Scalars['String']>;
  name?: InputMaybe<Scalars['String']>;
  description?: InputMaybe<Scalars['String']>;
  logoUrl?: InputMaybe<Scalars['Upload']>;
  logoLink?: InputMaybe<Scalars['String']>;
  isFeatured?: InputMaybe<Scalars['Boolean']>;
  mapboxPublicKey?: InputMaybe<Scalars['String']>;
}>;


export type UpdateProjectSettingsMutation = { __typename?: 'Mutation', updateProjectBySlug?: { __typename?: 'UpdateProjectPayload', clientMutationId?: string | null, project?: { __typename?: 'Project', id: number, name: string, description?: string | null, logoUrl?: string | null, logoLink?: string | null, mapboxPublicKey?: string | null, mapboxSecretKey?: string | null, isFeatured: boolean } | null } | null };

export type UserAdminCountsQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type UserAdminCountsQuery = { __typename?: 'Query', projectBySlug?: { __typename?: 'Project', id: number, accessControl: ProjectAccessControlSetting, participantCount?: number | null, adminCount?: number | null, unapprovedParticipantCount?: number | null, inviteCounts?: Array<{ __typename?: 'InviteStat', count?: number | null, status?: InviteStatus | null }> | null, groups: Array<{ __typename?: 'Group', id: number, name: string, memberCount?: number | null }> } | null };

export type CreateGroupMutationVariables = Exact<{
  projectId: Scalars['Int'];
  name: Scalars['String'];
}>;


export type CreateGroupMutation = { __typename?: 'Mutation', createGroup?: { __typename?: 'CreateGroupPayload', group?: { __typename?: 'Group', id: number, name: string, projectId: number } | null } | null };

export type ParticipantListDetailsFragment = { __typename?: 'User', id: number, bannedFromForums?: boolean | null, isAdmin?: boolean | null, canonicalEmail?: string | null, profile?: { __typename?: 'Profile', userId: number, email?: any | null, fullname?: string | null, nickname?: string | null, picture?: string | null } | null, groups?: Array<{ __typename?: 'Group', id: number, name: string }> | null };

export type ParticipantsQueryVariables = Exact<{
  slug: Scalars['String'];
  offset?: InputMaybe<Scalars['Int']>;
  first?: InputMaybe<Scalars['Int']>;
}>;


export type ParticipantsQuery = { __typename?: 'Query', root?: { __typename?: 'Project', id: number, participants?: Array<{ __typename?: 'User', id: number, bannedFromForums?: boolean | null, isAdmin?: boolean | null, canonicalEmail?: string | null, profile?: { __typename?: 'Profile', userId: number, email?: any | null, fullname?: string | null, nickname?: string | null, picture?: string | null } | null, groups?: Array<{ __typename?: 'Group', id: number, name: string }> | null }> | null } | null };

export type AdminsQueryVariables = Exact<{
  slug: Scalars['String'];
  offset?: InputMaybe<Scalars['Int']>;
  first?: InputMaybe<Scalars['Int']>;
}>;


export type AdminsQuery = { __typename?: 'Query', root?: { __typename?: 'Project', id: number, participants?: Array<{ __typename?: 'User', id: number, bannedFromForums?: boolean | null, isAdmin?: boolean | null, canonicalEmail?: string | null, profile?: { __typename?: 'Profile', userId: number, email?: any | null, fullname?: string | null, nickname?: string | null, picture?: string | null } | null, groups?: Array<{ __typename?: 'Group', id: number, name: string }> | null }> | null } | null };

export type GroupMembersQueryVariables = Exact<{
  groupId: Scalars['Int'];
  offset?: InputMaybe<Scalars['Int']>;
  first?: InputMaybe<Scalars['Int']>;
}>;


export type GroupMembersQuery = { __typename?: 'Query', root?: { __typename?: 'Group', participants?: Array<{ __typename?: 'User', id: number, bannedFromForums?: boolean | null, isAdmin?: boolean | null, canonicalEmail?: string | null, profile?: { __typename?: 'Profile', userId: number, email?: any | null, fullname?: string | null, nickname?: string | null, picture?: string | null } | null, groups?: Array<{ __typename?: 'Group', id: number, name: string }> | null }> | null } | null };

export type UserListDetailsFragment = { __typename?: 'User', id: number, isAdmin?: boolean | null, canonicalEmail?: string | null, bannedFromForums?: boolean | null, onboarded?: any | null, participationStatus?: ParticipationStatus | null, groups?: Array<{ __typename?: 'Group', name: string, id: number }> | null, profile?: { __typename?: 'Profile', userId: number, email?: any | null, fullname?: string | null, nickname?: string | null, picture?: string | null } | null };

export type UserSettingsListsQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type UserSettingsListsQuery = { __typename?: 'Query', projectBySlug?: { __typename?: 'Project', id: number, accessControl: ProjectAccessControlSetting, groups: Array<{ __typename?: 'Group', name: string, id: number }>, invitesConnection: { __typename?: 'ProjectInvitesConnection', nodes: Array<{ __typename?: 'ProjectInvite', createdAt: any, email: any, fullname?: string | null, id: number, status?: InviteStatus | null, makeAdmin: boolean, wasUsed: boolean, groups?: Array<{ __typename?: 'Group', id: number, name: string }> | null }> }, participants?: Array<{ __typename?: 'User', id: number, isAdmin?: boolean | null, canonicalEmail?: string | null, bannedFromForums?: boolean | null, onboarded?: any | null, participationStatus?: ParticipationStatus | null, groups?: Array<{ __typename?: 'Group', name: string, id: number }> | null, profile?: { __typename?: 'Profile', userId: number, email?: any | null, fullname?: string | null, nickname?: string | null, picture?: string | null } | null }> | null } | null };

export type UserInfoQueryVariables = Exact<{
  userId: Scalars['Int'];
  slug: Scalars['String'];
}>;


export type UserInfoQuery = { __typename?: 'Query', user?: { __typename?: 'User', id: number, isAdmin?: boolean | null, canonicalEmail?: string | null, bannedFromForums?: boolean | null, onboarded?: any | null, participationStatus?: ParticipationStatus | null, emailNotificationPreference?: { __typename?: 'EmailNotificationPreference', unsubscribeAll: boolean } | null, groups?: Array<{ __typename?: 'Group', name: string, id: number }> | null, profile?: { __typename?: 'Profile', userId: number, affiliations?: string | null, bio?: string | null, email?: any | null, fullname?: string | null, nickname?: string | null, picture?: string | null } | null } | null, projectBySlug?: { __typename?: 'Project', id: number, groups: Array<{ __typename?: 'Group', name: string, id: number }> } | null };

export type ToggleAdminAccessMutationVariables = Exact<{
  userId: Scalars['Int'];
  projectId: Scalars['Int'];
}>;


export type ToggleAdminAccessMutation = { __typename?: 'Mutation', toggleAdminAccess?: { __typename?: 'ToggleAdminAccessPayload', clientMutationId?: string | null, isAdmin?: boolean | null } | null };

export type SetUserGroupsMutationVariables = Exact<{
  userId: Scalars['Int'];
  projectId: Scalars['Int'];
  groupIds: Array<InputMaybe<Scalars['Int']>> | InputMaybe<Scalars['Int']>;
}>;


export type SetUserGroupsMutation = { __typename?: 'Mutation', setUserGroups?: { __typename?: 'SetUserGroupsPayload', groupIds?: Array<number | null> | null } | null };

export type ToggleForumPostingBanMutationVariables = Exact<{
  userId: Scalars['Int'];
  projectId: Scalars['Int'];
}>;


export type ToggleForumPostingBanMutation = { __typename?: 'Mutation', toggleForumPostingBan?: { __typename?: 'ToggleForumPostingBanPayload', isBanned?: boolean | null } | null };

export type DeleteGroupMutationVariables = Exact<{
  groupId: Scalars['Int'];
}>;


export type DeleteGroupMutation = { __typename?: 'Mutation', deleteGroup?: { __typename?: 'DeleteGroupPayload', group?: { __typename?: 'Group', id: number } | null } | null };

export type CreateProjectInvitesMutationVariables = Exact<{
  projectId: Scalars['Int'];
  makeAdmin: Scalars['Boolean'];
  groupNames: Array<InputMaybe<Scalars['String']>> | InputMaybe<Scalars['String']>;
  userDetails: Array<InputMaybe<ProjectInviteOptionInput>> | InputMaybe<ProjectInviteOptionInput>;
  sendEmailNow: Scalars['Boolean'];
}>;


export type CreateProjectInvitesMutation = { __typename?: 'Mutation', createProjectInvites?: { __typename?: 'CreateProjectInvitesPayload', projectInvites?: Array<{ __typename?: 'ProjectInvite', createdAt: any, email: any, fullname?: string | null, id: number, status?: InviteStatus | null, makeAdmin: boolean, wasUsed: boolean, groups?: Array<{ __typename?: 'Group', id: number, name: string }> | null }> | null } | null };

export type InviteDetailsFragment = { __typename?: 'ProjectInvite', createdAt: any, email: any, fullname?: string | null, id: number, status?: InviteStatus | null, makeAdmin: boolean, wasUsed: boolean, groups?: Array<{ __typename?: 'Group', id: number, name: string }> | null };

export type ProjectInvitesQueryVariables = Exact<{
  projectId: Scalars['Int'];
  status?: InputMaybe<Array<InputMaybe<InviteStatus>> | InputMaybe<InviteStatus>>;
  orderBy?: InputMaybe<InviteOrderBy>;
  cursor?: InputMaybe<Scalars['Cursor']>;
  limit?: InputMaybe<Scalars['Int']>;
}>;


export type ProjectInvitesQuery = { __typename?: 'Query', project?: { __typename?: 'Project', id: number, invitesConnection: { __typename?: 'ProjectInvitesConnection', edges: Array<{ __typename?: 'ProjectInvitesEdge', node: { __typename?: 'ProjectInvite', createdAt: any, email: any, fullname?: string | null, id: number, status?: InviteStatus | null, makeAdmin: boolean, wasUsed: boolean, groups?: Array<{ __typename?: 'Group', id: number, name: string }> | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: any | null } } } | null };

export type InviteEmailDetailsFragment = { __typename?: 'InviteEmail', id: number, toAddress: any, createdAt: any, status: EmailStatus, tokenExpiresAt?: any | null, error?: string | null, updatedAt?: any | null };

export type InviteEditorModalQueryQueryVariables = Exact<{
  inviteId: Scalars['Int'];
  slug: Scalars['String'];
}>;


export type InviteEditorModalQueryQuery = { __typename?: 'Query', projectBySlug?: { __typename?: 'Project', id: number, groups: Array<{ __typename?: 'Group', id: number, name: string }> } | null, projectInvite?: { __typename?: 'ProjectInvite', id: number, makeAdmin: boolean, email: any, fullname?: string | null, status?: InviteStatus | null, wasUsed: boolean, groups?: Array<{ __typename?: 'Group', id: number, name: string }> | null, inviteEmails: Array<{ __typename?: 'InviteEmail', id: number, toAddress: any, createdAt: any, status: EmailStatus, tokenExpiresAt?: any | null, error?: string | null, updatedAt?: any | null }> } | null };

export type UpdateProjectInviteMutationVariables = Exact<{
  id: Scalars['Int'];
  makeAdmin: Scalars['Boolean'];
  email: Scalars['String'];
  fullname?: InputMaybe<Scalars['String']>;
  groups: Array<InputMaybe<Scalars['Int']>> | InputMaybe<Scalars['Int']>;
}>;


export type UpdateProjectInviteMutation = { __typename?: 'Mutation', updateProjectInvite?: { __typename?: 'UpdateProjectInvitePayload', projectInvite?: { __typename?: 'ProjectInvite', id: number, makeAdmin: boolean, email: any, fullname?: string | null, groups?: Array<{ __typename?: 'Group', id: number, name: string }> | null, inviteEmails: Array<{ __typename?: 'InviteEmail', id: number, toAddress: any, createdAt: any, status: EmailStatus, tokenExpiresAt?: any | null, error?: string | null, updatedAt?: any | null }> } | null } | null };

export type DeleteProjectInviteMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteProjectInviteMutation = { __typename?: 'Mutation', deleteProjectInvite?: { __typename?: 'DeleteProjectInvitePayload', projectInvite?: { __typename?: 'ProjectInvite', id: number } | null } | null };

export type SendInviteMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type SendInviteMutation = { __typename?: 'Mutation', sendProjectInvites?: { __typename?: 'SendProjectInvitesPayload', inviteEmails?: Array<{ __typename?: 'InviteEmail', id: number, toAddress: any, createdAt: any, status: EmailStatus, tokenExpiresAt?: any | null, error?: string | null, updatedAt?: any | null, projectInvite?: { __typename?: 'ProjectInvite', id: number, status?: InviteStatus | null } | null }> | null } | null };

export type RenameGroupMutationVariables = Exact<{
  id: Scalars['Int'];
  name: Scalars['String'];
}>;


export type RenameGroupMutation = { __typename?: 'Mutation', updateGroup?: { __typename?: 'UpdateGroupPayload', group?: { __typename?: 'Group', id: number, name: string } | null } | null };

export type SendInvitesMutationVariables = Exact<{
  ids: Array<InputMaybe<Scalars['Int']>> | InputMaybe<Scalars['Int']>;
}>;


export type SendInvitesMutation = { __typename?: 'Mutation', sendProjectInvites?: { __typename?: 'SendProjectInvitesPayload', inviteEmails?: Array<{ __typename?: 'InviteEmail', projectInviteId?: number | null, id: number, toAddress: any, createdAt: any, status: EmailStatus, tokenExpiresAt?: any | null, error?: string | null, updatedAt?: any | null, projectInvite?: { __typename?: 'ProjectInvite', id: number, status?: InviteStatus | null } | null }> | null } | null };

export type ProjectInviteEmailStatusSubscriptionSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type ProjectInviteEmailStatusSubscriptionSubscription = { __typename?: 'Subscription', projectInviteStateUpdated?: { __typename?: 'ProjectInviteStateSubscriptionPayload', invite?: { __typename?: 'ProjectInvite', status?: InviteStatus | null, opaqueId: number } | null } | null };

export type UpdateProfileMutationVariables = Exact<{
  userId: Scalars['Int'];
  affiliations?: InputMaybe<Scalars['String']>;
  email?: InputMaybe<Scalars['Email']>;
  fullname?: InputMaybe<Scalars['String']>;
  nickname?: InputMaybe<Scalars['String']>;
  picture?: InputMaybe<Scalars['Upload']>;
}>;


export type UpdateProfileMutation = { __typename?: 'Mutation', updateProfileByUserId?: { __typename?: 'UpdateProfilePayload', profile?: { __typename?: 'Profile', userId: number, user?: { __typename?: 'User', id: number, profile?: { __typename?: 'Profile', picture?: string | null } | null } | null } | null } | null };

export type UserIsSuperuserQueryVariables = Exact<{ [key: string]: never; }>;


export type UserIsSuperuserQuery = { __typename?: 'Query', currentUserIsSuperuser: boolean };

export const LogicRuleEditorFormElementFragmentDoc = /*#__PURE__*/ gql`
    fragment LogicRuleEditorFormElement on FormElement {
  id
  body
  typeId
  formId
  jumpToId
  componentSettings
  exportId
  isRequired
  type {
    supportedOperators
    isInput
  }
}
    `;
export const LogicRuleEditorRuleFragmentDoc = /*#__PURE__*/ gql`
    fragment LogicRuleEditorRule on FormLogicRule {
  booleanOperator
  command
  formElementId
  id
  jumpToId
  position
  conditions {
    id
    operator
    ruleId
    subjectId
    value
  }
}
    `;
export const BasemapDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment BasemapDetails on Basemap {
  id
  attribution
  interactivitySettings {
    cursor
    id
    layers
    longTemplate
    shortTemplate
    type
  }
  labelsLayerId
  name
  optionalBasemapLayers {
    basemapId
    id
    defaultVisibility
    description
    options
    groupType
    layers
    metadata
    name
  }
  description
  projectId
  terrainExaggeration
  terrainMaxZoom
  terrainOptional
  terrainTileSize
  terrainUrl
  terrainVisibilityDefault
  thumbnail
  tileSize
  type
  url
  surveysOnly
}
    `;
export const MapEssentialsFragmentDoc = /*#__PURE__*/ gql`
    fragment MapEssentials on Project {
  id
  basemaps {
    ...BasemapDetails
  }
  surveyBasemaps {
    ...BasemapDetails
  }
  region {
    geojson
  }
  mapboxPublicKey
  mapboxSecretKey
}
    ${BasemapDetailsFragmentDoc}`;
export const ProjectMetadataFragmentDoc = /*#__PURE__*/ gql`
    fragment ProjectMetadata on Project {
  id
  slug
  url
  name
  description
  logoLink
  logoUrl
  accessControl
  sessionIsAdmin
  isFeatured
  supportEmail
}
    `;
export const ProjectPublicDetailsMetadataFragmentDoc = /*#__PURE__*/ gql`
    fragment ProjectPublicDetailsMetadata on PublicProjectDetail {
  id
  accessControl
  slug
  name
  logoUrl
  supportEmail
  accessStatus
}
    `;
export const ProjectMetadataMeFragFragmentDoc = /*#__PURE__*/ gql`
    fragment ProjectMetadataMeFrag on User {
  id
  profile {
    userId
    fullname
    nickname
    email
    picture
    bio
    affiliations
  }
}
    `;
export const SurveyListDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment SurveyListDetails on Survey {
  id
  accessType
  showProgress
  invitedGroups {
    id
    name
  }
  isDisabled
  limitToSingleResponse
  name
  submittedResponseCount
  practiceResponseCount
  projectId
  isTemplate
  showFacilitationOption
  supportedLanguages
}
    `;
export const AddFormElementTypeDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment AddFormElementTypeDetails on FormElementType {
  componentName
  isHidden
  isInput
  isSingleUseOnly
  isSurveysOnly
  label
  supportedOperators
  isSpatial
  allowedLayouts
}
    `;
export const FormElementDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment FormElementDetails on FormElement {
  body
  componentSettings
  alternateLanguageSettings
  exportId
  formId
  id
  isRequired
  position
  jumpToId
  type {
    ...AddFormElementTypeDetails
  }
  isInput
  typeId
  backgroundColor
  secondaryColor
  backgroundImage
  layout
  backgroundPalette
  textVariant
  unsplashAuthorUrl
  unsplashAuthorName
  backgroundWidth
  backgroundHeight
  subordinateTo
  mapBasemaps
  mapCameraOptions
}
    ${AddFormElementTypeDetailsFragmentDoc}`;
export const LogicRuleDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment LogicRuleDetails on FormLogicRule {
  booleanOperator
  command
  id
  jumpToId
  position
  formElementId
  conditions {
    id
    operator
    value
    subjectId
    ruleId
  }
}
    `;
export const SketchClassDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment SketchClassDetails on SketchClass {
  id
  mapboxGlStyle
  formElementId
  geometryType
  geoprocessingClientName
  geoprocessingClientUrl
  geoprocessingProjectUrl
  allowMulti
  form {
    formElements {
      ...FormElementDetails
    }
    id
    logicRules {
      ...LogicRuleDetails
    }
  }
}
    ${FormElementDetailsFragmentDoc}
${LogicRuleDetailsFragmentDoc}`;
export const FormElementFullDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment FormElementFullDetails on FormElement {
  ...FormElementDetails
  sketchClass {
    ...SketchClassDetails
  }
}
    ${FormElementDetailsFragmentDoc}
${SketchClassDetailsFragmentDoc}`;
export const SurveyResponseFragmentDoc = /*#__PURE__*/ gql`
    fragment SurveyResponse on SurveyResponse {
  id
  surveyId
  bypassedDuplicateSubmissionControl
  updatedAt
  accountEmail
  userId
  createdAt
  data
  isDuplicateEntry
  isDuplicateIp
  isPractice
  isUnrecognizedUserAgent
  archived
  lastUpdatedByEmail
}
    `;
export const FormElementExtendedDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment FormElementExtendedDetails on FormElement {
  ...FormElementDetails
  surveyConsentDocumentsConnection {
    nodes {
      url
      version
    }
  }
}
    ${FormElementDetailsFragmentDoc}`;
export const SurveyAppRuleFragmentDoc = /*#__PURE__*/ gql`
    fragment SurveyAppRule on FormLogicRule {
  booleanOperator
  command
  conditions {
    id
    operator
    ruleId
    subjectId
    value
  }
  formElementId
  id
  jumpToId
  position
}
    `;
export const SurveyAppFormElementFragmentDoc = /*#__PURE__*/ gql`
    fragment SurveyAppFormElement on FormElement {
  id
  componentSettings
  alternateLanguageSettings
  body
  isRequired
  isInput
  position
  typeId
  formId
  type {
    componentName
    isInput
    isSingleUseOnly
    isSurveysOnly
    label
    isSpatial
    allowedLayouts
    supportedOperators
    isHidden
  }
  sketchClass {
    ...SketchClassDetails
  }
  backgroundColor
  secondaryColor
  backgroundImage
  layout
  textVariant
  unsplashAuthorName
  unsplashAuthorUrl
  backgroundWidth
  backgroundHeight
  jumpToId
  subordinateTo
  mapBasemaps
  mapCameraOptions
}
    ${SketchClassDetailsFragmentDoc}`;
export const SurveyAppSurveyFragmentDoc = /*#__PURE__*/ gql`
    fragment SurveyAppSurvey on Survey {
  id
  name
  accessType
  isDisabled
  showProgress
  showFacilitationOption
  supportedLanguages
  form {
    id
    logicRules {
      ...SurveyAppRule
    }
    formElements {
      ...SurveyAppFormElement
    }
  }
}
    ${SurveyAppRuleFragmentDoc}
${SurveyAppFormElementFragmentDoc}`;
export const ParticipantListDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment ParticipantListDetails on User {
  id
  bannedFromForums
  isAdmin
  profile {
    userId
    email
    fullname
    nickname
    picture
  }
  groups {
    id
    name
  }
  canonicalEmail
}
    `;
export const UserListDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment UserListDetails on User {
  id
  isAdmin
  canonicalEmail
  bannedFromForums
  groups {
    name
    id
  }
  onboarded
  participationStatus
  profile {
    userId
    email
    fullname
    nickname
    picture
  }
}
    `;
export const InviteDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment InviteDetails on ProjectInvite {
  createdAt
  email
  fullname
  groups {
    id
    name
  }
  id
  status
  makeAdmin
  wasUsed
}
    `;
export const InviteEmailDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment InviteEmailDetails on InviteEmail {
  id
  toAddress
  createdAt
  status
  tokenExpiresAt
  error
  updatedAt
}
    `;
export const ProjectBucketSettingDocument = /*#__PURE__*/ gql`
    query ProjectBucketSetting($slug: String!) {
  projectBySlug(slug: $slug) {
    __typename
    id
    dataSourcesBucket {
      url
      region
      name
      location {
        geojson
      }
    }
  }
  dataSourcesBucketsConnection {
    nodes {
      url
      name
      region
      location {
        geojson
      }
    }
  }
}
    `;
export function useProjectBucketSettingQuery(baseOptions: Apollo.QueryHookOptions<ProjectBucketSettingQuery, ProjectBucketSettingQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ProjectBucketSettingQuery, ProjectBucketSettingQueryVariables>(ProjectBucketSettingDocument, options);
      }
export function useProjectBucketSettingLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ProjectBucketSettingQuery, ProjectBucketSettingQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ProjectBucketSettingQuery, ProjectBucketSettingQueryVariables>(ProjectBucketSettingDocument, options);
        }
export type ProjectBucketSettingQueryHookResult = ReturnType<typeof useProjectBucketSettingQuery>;
export type ProjectBucketSettingLazyQueryHookResult = ReturnType<typeof useProjectBucketSettingLazyQuery>;
export type ProjectBucketSettingQueryResult = Apollo.QueryResult<ProjectBucketSettingQuery, ProjectBucketSettingQueryVariables>;
export const UpdateProjectStorageBucketDocument = /*#__PURE__*/ gql`
    mutation UpdateProjectStorageBucket($slug: String!, $bucket: String!) {
  updateProjectBySlug(input: {slug: $slug, patch: {dataSourcesBucketId: $bucket}}) {
    clientMutationId
    project {
      __typename
      id
      dataSourcesBucket {
        url
        region
        name
      }
    }
  }
}
    `;
export type UpdateProjectStorageBucketMutationFn = Apollo.MutationFunction<UpdateProjectStorageBucketMutation, UpdateProjectStorageBucketMutationVariables>;
export function useUpdateProjectStorageBucketMutation(baseOptions?: Apollo.MutationHookOptions<UpdateProjectStorageBucketMutation, UpdateProjectStorageBucketMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateProjectStorageBucketMutation, UpdateProjectStorageBucketMutationVariables>(UpdateProjectStorageBucketDocument, options);
      }
export type UpdateProjectStorageBucketMutationHookResult = ReturnType<typeof useUpdateProjectStorageBucketMutation>;
export type UpdateProjectStorageBucketMutationResult = Apollo.MutationResult<UpdateProjectStorageBucketMutation>;
export type UpdateProjectStorageBucketMutationOptions = Apollo.BaseMutationOptions<UpdateProjectStorageBucketMutation, UpdateProjectStorageBucketMutationVariables>;
export const MapboxApiKeysDocument = /*#__PURE__*/ gql`
    query MapboxAPIKeys($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    mapboxPublicKey
    mapboxSecretKey
  }
}
    `;
export function useMapboxApiKeysQuery(baseOptions: Apollo.QueryHookOptions<MapboxApiKeysQuery, MapboxApiKeysQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<MapboxApiKeysQuery, MapboxApiKeysQueryVariables>(MapboxApiKeysDocument, options);
      }
export function useMapboxApiKeysLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<MapboxApiKeysQuery, MapboxApiKeysQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<MapboxApiKeysQuery, MapboxApiKeysQueryVariables>(MapboxApiKeysDocument, options);
        }
export type MapboxApiKeysQueryHookResult = ReturnType<typeof useMapboxApiKeysQuery>;
export type MapboxApiKeysLazyQueryHookResult = ReturnType<typeof useMapboxApiKeysLazyQuery>;
export type MapboxApiKeysQueryResult = Apollo.QueryResult<MapboxApiKeysQuery, MapboxApiKeysQueryVariables>;
export const UpdatePublicKeyDocument = /*#__PURE__*/ gql`
    mutation updatePublicKey($id: Int!, $public: String) {
  updateProject(input: {id: $id, patch: {mapboxPublicKey: $public}}) {
    project {
      id
      mapboxPublicKey
    }
  }
}
    `;
export type UpdatePublicKeyMutationFn = Apollo.MutationFunction<UpdatePublicKeyMutation, UpdatePublicKeyMutationVariables>;
export function useUpdatePublicKeyMutation(baseOptions?: Apollo.MutationHookOptions<UpdatePublicKeyMutation, UpdatePublicKeyMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdatePublicKeyMutation, UpdatePublicKeyMutationVariables>(UpdatePublicKeyDocument, options);
      }
export type UpdatePublicKeyMutationHookResult = ReturnType<typeof useUpdatePublicKeyMutation>;
export type UpdatePublicKeyMutationResult = Apollo.MutationResult<UpdatePublicKeyMutation>;
export type UpdatePublicKeyMutationOptions = Apollo.BaseMutationOptions<UpdatePublicKeyMutation, UpdatePublicKeyMutationVariables>;
export const UpdateSecretKeyDocument = /*#__PURE__*/ gql`
    mutation updateSecretKey($id: Int!, $mapboxSecretKey: String) {
  updateMapboxSecretKey(input: {projectId: $id, secret: $mapboxSecretKey}) {
    project {
      id
      mapboxSecretKey
    }
  }
}
    `;
export type UpdateSecretKeyMutationFn = Apollo.MutationFunction<UpdateSecretKeyMutation, UpdateSecretKeyMutationVariables>;
export function useUpdateSecretKeyMutation(baseOptions?: Apollo.MutationHookOptions<UpdateSecretKeyMutation, UpdateSecretKeyMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateSecretKeyMutation, UpdateSecretKeyMutationVariables>(UpdateSecretKeyDocument, options);
      }
export type UpdateSecretKeyMutationHookResult = ReturnType<typeof useUpdateSecretKeyMutation>;
export type UpdateSecretKeyMutationResult = Apollo.MutationResult<UpdateSecretKeyMutation>;
export type UpdateSecretKeyMutationOptions = Apollo.BaseMutationOptions<UpdateSecretKeyMutation, UpdateSecretKeyMutationVariables>;
export const GetAclDocument = /*#__PURE__*/ gql`
    query GetAcl($nodeId: ID!) {
  aclByNodeId(nodeId: $nodeId) {
    id
    nodeId
    type
    groups {
      id
      name
      memberCount
    }
  }
}
    `;
export function useGetAclQuery(baseOptions: Apollo.QueryHookOptions<GetAclQuery, GetAclQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAclQuery, GetAclQueryVariables>(GetAclDocument, options);
      }
export function useGetAclLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAclQuery, GetAclQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAclQuery, GetAclQueryVariables>(GetAclDocument, options);
        }
export type GetAclQueryHookResult = ReturnType<typeof useGetAclQuery>;
export type GetAclLazyQueryHookResult = ReturnType<typeof useGetAclLazyQuery>;
export type GetAclQueryResult = Apollo.QueryResult<GetAclQuery, GetAclQueryVariables>;
export const UpdateAclTypeDocument = /*#__PURE__*/ gql`
    mutation UpdateAclType($nodeId: ID!, $type: AccessControlListType!) {
  updateAclByNodeId(input: {nodeId: $nodeId, patch: {type: $type}}) {
    acl {
      id
      nodeId
      type
    }
  }
}
    `;
export type UpdateAclTypeMutationFn = Apollo.MutationFunction<UpdateAclTypeMutation, UpdateAclTypeMutationVariables>;
export function useUpdateAclTypeMutation(baseOptions?: Apollo.MutationHookOptions<UpdateAclTypeMutation, UpdateAclTypeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateAclTypeMutation, UpdateAclTypeMutationVariables>(UpdateAclTypeDocument, options);
      }
export type UpdateAclTypeMutationHookResult = ReturnType<typeof useUpdateAclTypeMutation>;
export type UpdateAclTypeMutationResult = Apollo.MutationResult<UpdateAclTypeMutation>;
export type UpdateAclTypeMutationOptions = Apollo.BaseMutationOptions<UpdateAclTypeMutation, UpdateAclTypeMutationVariables>;
export const AddGroupToAclDocument = /*#__PURE__*/ gql`
    mutation AddGroupToAcl($id: Int!, $groupId: Int!) {
  addGroupToAcl(input: {aclId: $id, groupId: $groupId}) {
    acl {
      groups {
        id
        name
      }
    }
  }
}
    `;
export type AddGroupToAclMutationFn = Apollo.MutationFunction<AddGroupToAclMutation, AddGroupToAclMutationVariables>;
export function useAddGroupToAclMutation(baseOptions?: Apollo.MutationHookOptions<AddGroupToAclMutation, AddGroupToAclMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<AddGroupToAclMutation, AddGroupToAclMutationVariables>(AddGroupToAclDocument, options);
      }
export type AddGroupToAclMutationHookResult = ReturnType<typeof useAddGroupToAclMutation>;
export type AddGroupToAclMutationResult = Apollo.MutationResult<AddGroupToAclMutation>;
export type AddGroupToAclMutationOptions = Apollo.BaseMutationOptions<AddGroupToAclMutation, AddGroupToAclMutationVariables>;
export const RemoveGroupFromAclDocument = /*#__PURE__*/ gql`
    mutation RemoveGroupFromAcl($id: Int!, $groupId: Int!) {
  removeGroupFromAcl(input: {aclId: $id, groupId: $groupId}) {
    acl {
      groups {
        id
        name
      }
    }
  }
}
    `;
export type RemoveGroupFromAclMutationFn = Apollo.MutationFunction<RemoveGroupFromAclMutation, RemoveGroupFromAclMutationVariables>;
export function useRemoveGroupFromAclMutation(baseOptions?: Apollo.MutationHookOptions<RemoveGroupFromAclMutation, RemoveGroupFromAclMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RemoveGroupFromAclMutation, RemoveGroupFromAclMutationVariables>(RemoveGroupFromAclDocument, options);
      }
export type RemoveGroupFromAclMutationHookResult = ReturnType<typeof useRemoveGroupFromAclMutation>;
export type RemoveGroupFromAclMutationResult = Apollo.MutationResult<RemoveGroupFromAclMutation>;
export type RemoveGroupFromAclMutationOptions = Apollo.BaseMutationOptions<RemoveGroupFromAclMutation, RemoveGroupFromAclMutationVariables>;
export const GroupsDocument = /*#__PURE__*/ gql`
    query Groups($projectSlug: String!) {
  projectBySlug(slug: $projectSlug) {
    id
    groups {
      id
      name
      memberCount
    }
  }
}
    `;
export function useGroupsQuery(baseOptions: Apollo.QueryHookOptions<GroupsQuery, GroupsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GroupsQuery, GroupsQueryVariables>(GroupsDocument, options);
      }
export function useGroupsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GroupsQuery, GroupsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GroupsQuery, GroupsQueryVariables>(GroupsDocument, options);
        }
export type GroupsQueryHookResult = ReturnType<typeof useGroupsQuery>;
export type GroupsLazyQueryHookResult = ReturnType<typeof useGroupsLazyQuery>;
export type GroupsQueryResult = Apollo.QueryResult<GroupsQuery, GroupsQueryVariables>;
export const CreateTableOfContentsItemDocument = /*#__PURE__*/ gql`
    mutation CreateTableOfContentsItem($title: String!, $stableId: String!, $projectId: Int!, $isFolder: Boolean!, $parentStableId: String, $metadata: JSON, $bounds: [BigFloat], $dataLayerId: Int) {
  createTableOfContentsItem(
    input: {tableOfContentsItem: {title: $title, stableId: $stableId, projectId: $projectId, parentStableId: $parentStableId, metadata: $metadata, bounds: $bounds, dataLayerId: $dataLayerId, isFolder: $isFolder}}
  ) {
    tableOfContentsItem {
      id
      title
      stableId
      projectId
      parentStableId
      isClickOffOnly
      isDraft
      isFolder
      metadata
      bounds
      dataLayerId
    }
  }
}
    `;
export type CreateTableOfContentsItemMutationFn = Apollo.MutationFunction<CreateTableOfContentsItemMutation, CreateTableOfContentsItemMutationVariables>;
export function useCreateTableOfContentsItemMutation(baseOptions?: Apollo.MutationHookOptions<CreateTableOfContentsItemMutation, CreateTableOfContentsItemMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateTableOfContentsItemMutation, CreateTableOfContentsItemMutationVariables>(CreateTableOfContentsItemDocument, options);
      }
export type CreateTableOfContentsItemMutationHookResult = ReturnType<typeof useCreateTableOfContentsItemMutation>;
export type CreateTableOfContentsItemMutationResult = Apollo.MutationResult<CreateTableOfContentsItemMutation>;
export type CreateTableOfContentsItemMutationOptions = Apollo.BaseMutationOptions<CreateTableOfContentsItemMutation, CreateTableOfContentsItemMutationVariables>;
export const CreateArcGisDynamicDataSourceDocument = /*#__PURE__*/ gql`
    mutation CreateArcGISDynamicDataSource($projectId: Int!, $url: String!, $attribution: String, $bounds: [BigFloat], $queryParameters: JSON) {
  createDataSource(
    input: {dataSource: {projectId: $projectId, type: ARCGIS_VECTOR, url: $url, attribution: $attribution, bounds: $bounds, queryParameters: $queryParameters}}
  ) {
    dataSource {
      id
      projectId
      type
      url
    }
  }
}
    `;
export type CreateArcGisDynamicDataSourceMutationFn = Apollo.MutationFunction<CreateArcGisDynamicDataSourceMutation, CreateArcGisDynamicDataSourceMutationVariables>;
export function useCreateArcGisDynamicDataSourceMutation(baseOptions?: Apollo.MutationHookOptions<CreateArcGisDynamicDataSourceMutation, CreateArcGisDynamicDataSourceMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateArcGisDynamicDataSourceMutation, CreateArcGisDynamicDataSourceMutationVariables>(CreateArcGisDynamicDataSourceDocument, options);
      }
export type CreateArcGisDynamicDataSourceMutationHookResult = ReturnType<typeof useCreateArcGisDynamicDataSourceMutation>;
export type CreateArcGisDynamicDataSourceMutationResult = Apollo.MutationResult<CreateArcGisDynamicDataSourceMutation>;
export type CreateArcGisDynamicDataSourceMutationOptions = Apollo.BaseMutationOptions<CreateArcGisDynamicDataSourceMutation, CreateArcGisDynamicDataSourceMutationVariables>;
export const CreateArcGisImageSourceDocument = /*#__PURE__*/ gql`
    mutation CreateArcGISImageSource($projectId: Int!, $url: String!, $attribution: String, $bounds: [BigFloat], $queryParameters: JSON, $enableHighDPI: Boolean, $supportsDynamicLayers: Boolean!) {
  createDataSource(
    input: {dataSource: {projectId: $projectId, type: ARCGIS_DYNAMIC_MAPSERVER, url: $url, attribution: $attribution, bounds: $bounds, queryParameters: $queryParameters, useDevicePixelRatio: $enableHighDPI, supportsDynamicLayers: $supportsDynamicLayers}}
  ) {
    dataSource {
      id
      url
    }
  }
}
    `;
export type CreateArcGisImageSourceMutationFn = Apollo.MutationFunction<CreateArcGisImageSourceMutation, CreateArcGisImageSourceMutationVariables>;
export function useCreateArcGisImageSourceMutation(baseOptions?: Apollo.MutationHookOptions<CreateArcGisImageSourceMutation, CreateArcGisImageSourceMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateArcGisImageSourceMutation, CreateArcGisImageSourceMutationVariables>(CreateArcGisImageSourceDocument, options);
      }
export type CreateArcGisImageSourceMutationHookResult = ReturnType<typeof useCreateArcGisImageSourceMutation>;
export type CreateArcGisImageSourceMutationResult = Apollo.MutationResult<CreateArcGisImageSourceMutation>;
export type CreateArcGisImageSourceMutationOptions = Apollo.BaseMutationOptions<CreateArcGisImageSourceMutation, CreateArcGisImageSourceMutationVariables>;
export const CreateSeaSketchVectorSourceDocument = /*#__PURE__*/ gql`
    mutation CreateSeaSketchVectorSource($projectId: Int!, $attribution: String, $bounds: [BigFloat]!, $byteLength: Int!, $originalSourceUrl: String, $importType: DataSourceImportTypes!, $enhancedSecurity: Boolean!) {
  createDataSource(
    input: {dataSource: {projectId: $projectId, type: SEASKETCH_VECTOR, attribution: $attribution, bounds: $bounds, byteLength: $byteLength, originalSourceUrl: $originalSourceUrl, importType: $importType, enhancedSecurity: $enhancedSecurity}}
  ) {
    dataSource {
      id
      projectId
      type
      url
      presignedUploadUrl
      bucketId
      enhancedSecurity
      objectKey
    }
  }
}
    `;
export type CreateSeaSketchVectorSourceMutationFn = Apollo.MutationFunction<CreateSeaSketchVectorSourceMutation, CreateSeaSketchVectorSourceMutationVariables>;
export function useCreateSeaSketchVectorSourceMutation(baseOptions?: Apollo.MutationHookOptions<CreateSeaSketchVectorSourceMutation, CreateSeaSketchVectorSourceMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateSeaSketchVectorSourceMutation, CreateSeaSketchVectorSourceMutationVariables>(CreateSeaSketchVectorSourceDocument, options);
      }
export type CreateSeaSketchVectorSourceMutationHookResult = ReturnType<typeof useCreateSeaSketchVectorSourceMutation>;
export type CreateSeaSketchVectorSourceMutationResult = Apollo.MutationResult<CreateSeaSketchVectorSourceMutation>;
export type CreateSeaSketchVectorSourceMutationOptions = Apollo.BaseMutationOptions<CreateSeaSketchVectorSourceMutation, CreateSeaSketchVectorSourceMutationVariables>;
export const CreateDataLayerDocument = /*#__PURE__*/ gql`
    mutation CreateDataLayer($projectId: Int!, $dataSourceId: Int!, $mapboxGlStyles: JSON, $renderUnder: RenderUnderType, $sublayer: String) {
  createDataLayer(
    input: {dataLayer: {projectId: $projectId, dataSourceId: $dataSourceId, mapboxGlStyles: $mapboxGlStyles, renderUnder: $renderUnder, sublayer: $sublayer}}
  ) {
    dataLayer {
      id
      dataSourceId
      zIndex
      interactivitySettings {
        cursor
        id
        longTemplate
        shortTemplate
        type
      }
    }
  }
}
    `;
export type CreateDataLayerMutationFn = Apollo.MutationFunction<CreateDataLayerMutation, CreateDataLayerMutationVariables>;
export function useCreateDataLayerMutation(baseOptions?: Apollo.MutationHookOptions<CreateDataLayerMutation, CreateDataLayerMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateDataLayerMutation, CreateDataLayerMutationVariables>(CreateDataLayerDocument, options);
      }
export type CreateDataLayerMutationHookResult = ReturnType<typeof useCreateDataLayerMutation>;
export type CreateDataLayerMutationResult = Apollo.MutationResult<CreateDataLayerMutation>;
export type CreateDataLayerMutationOptions = Apollo.BaseMutationOptions<CreateDataLayerMutation, CreateDataLayerMutationVariables>;
export const GetOrCreateSpriteDocument = /*#__PURE__*/ gql`
    mutation GetOrCreateSprite($height: Int!, $width: Int!, $pixelRatio: Int!, $projectId: Int!, $smallestImage: Upload!) {
  getOrCreateSprite(
    height: $height
    pixelRatio: $pixelRatio
    projectId: $projectId
    smallestImage: $smallestImage
    width: $width
  ) {
    id
    md5
    projectId
    type
    spriteImages {
      spriteId
      height
      pixelRatio
      url
      width
    }
  }
}
    `;
export type GetOrCreateSpriteMutationFn = Apollo.MutationFunction<GetOrCreateSpriteMutation, GetOrCreateSpriteMutationVariables>;
export function useGetOrCreateSpriteMutation(baseOptions?: Apollo.MutationHookOptions<GetOrCreateSpriteMutation, GetOrCreateSpriteMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<GetOrCreateSpriteMutation, GetOrCreateSpriteMutationVariables>(GetOrCreateSpriteDocument, options);
      }
export type GetOrCreateSpriteMutationHookResult = ReturnType<typeof useGetOrCreateSpriteMutation>;
export type GetOrCreateSpriteMutationResult = Apollo.MutationResult<GetOrCreateSpriteMutation>;
export type GetOrCreateSpriteMutationOptions = Apollo.BaseMutationOptions<GetOrCreateSpriteMutation, GetOrCreateSpriteMutationVariables>;
export const AddImageToSpriteDocument = /*#__PURE__*/ gql`
    mutation AddImageToSprite($spriteId: Int!, $width: Int!, $height: Int!, $pixelRatio: Int!, $image: Upload!) {
  addImageToSprite(
    height: $height
    width: $width
    pixelRatio: $pixelRatio
    spriteId: $spriteId
    image: $image
  ) {
    id
    md5
    projectId
    type
    spriteImages {
      spriteId
      height
      pixelRatio
      url
      width
    }
  }
}
    `;
export type AddImageToSpriteMutationFn = Apollo.MutationFunction<AddImageToSpriteMutation, AddImageToSpriteMutationVariables>;
export function useAddImageToSpriteMutation(baseOptions?: Apollo.MutationHookOptions<AddImageToSpriteMutation, AddImageToSpriteMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<AddImageToSpriteMutation, AddImageToSpriteMutationVariables>(AddImageToSpriteDocument, options);
      }
export type AddImageToSpriteMutationHookResult = ReturnType<typeof useAddImageToSpriteMutation>;
export type AddImageToSpriteMutationResult = Apollo.MutationResult<AddImageToSpriteMutation>;
export type AddImageToSpriteMutationOptions = Apollo.BaseMutationOptions<AddImageToSpriteMutation, AddImageToSpriteMutationVariables>;
export const VerifyProjectInviteDocument = /*#__PURE__*/ gql`
    query VerifyProjectInvite($token: String!) {
  verifyProjectInvite(token: $token) {
    claims {
      admin
      email
      fullname
      inviteId
      projectId
      wasUsed
      projectSlug
    }
    error
    existingAccount
  }
}
    `;
export function useVerifyProjectInviteQuery(baseOptions: Apollo.QueryHookOptions<VerifyProjectInviteQuery, VerifyProjectInviteQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<VerifyProjectInviteQuery, VerifyProjectInviteQueryVariables>(VerifyProjectInviteDocument, options);
      }
export function useVerifyProjectInviteLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<VerifyProjectInviteQuery, VerifyProjectInviteQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<VerifyProjectInviteQuery, VerifyProjectInviteQueryVariables>(VerifyProjectInviteDocument, options);
        }
export type VerifyProjectInviteQueryHookResult = ReturnType<typeof useVerifyProjectInviteQuery>;
export type VerifyProjectInviteLazyQueryHookResult = ReturnType<typeof useVerifyProjectInviteLazyQuery>;
export type VerifyProjectInviteQueryResult = Apollo.QueryResult<VerifyProjectInviteQuery, VerifyProjectInviteQueryVariables>;
export const ConfirmProjectInviteDocument = /*#__PURE__*/ gql`
    mutation ConfirmProjectInvite($token: String!) {
  confirmProjectInvite(token: $token) {
    admin
    email
    fullname
    inviteId
    projectId
    projectName
    wasUsed
    projectSlug
  }
}
    `;
export type ConfirmProjectInviteMutationFn = Apollo.MutationFunction<ConfirmProjectInviteMutation, ConfirmProjectInviteMutationVariables>;
export function useConfirmProjectInviteMutation(baseOptions?: Apollo.MutationHookOptions<ConfirmProjectInviteMutation, ConfirmProjectInviteMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ConfirmProjectInviteMutation, ConfirmProjectInviteMutationVariables>(ConfirmProjectInviteDocument, options);
      }
export type ConfirmProjectInviteMutationHookResult = ReturnType<typeof useConfirmProjectInviteMutation>;
export type ConfirmProjectInviteMutationResult = Apollo.MutationResult<ConfirmProjectInviteMutation>;
export type ConfirmProjectInviteMutationOptions = Apollo.BaseMutationOptions<ConfirmProjectInviteMutation, ConfirmProjectInviteMutationVariables>;
export const ResendEmailVerificationDocument = /*#__PURE__*/ gql`
    mutation ResendEmailVerification {
  resendVerificationEmail {
    success
    error
  }
}
    `;
export type ResendEmailVerificationMutationFn = Apollo.MutationFunction<ResendEmailVerificationMutation, ResendEmailVerificationMutationVariables>;
export function useResendEmailVerificationMutation(baseOptions?: Apollo.MutationHookOptions<ResendEmailVerificationMutation, ResendEmailVerificationMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ResendEmailVerificationMutation, ResendEmailVerificationMutationVariables>(ResendEmailVerificationDocument, options);
      }
export type ResendEmailVerificationMutationHookResult = ReturnType<typeof useResendEmailVerificationMutation>;
export type ResendEmailVerificationMutationResult = Apollo.MutationResult<ResendEmailVerificationMutation>;
export type ResendEmailVerificationMutationOptions = Apollo.BaseMutationOptions<ResendEmailVerificationMutation, ResendEmailVerificationMutationVariables>;
export const RequestInviteOnlyProjectAccessDocument = /*#__PURE__*/ gql`
    mutation RequestInviteOnlyProjectAccess($projectId: Int!) {
  joinProject(input: {projectId: $projectId}) {
    clientMutationId
  }
}
    `;
export type RequestInviteOnlyProjectAccessMutationFn = Apollo.MutationFunction<RequestInviteOnlyProjectAccessMutation, RequestInviteOnlyProjectAccessMutationVariables>;
export function useRequestInviteOnlyProjectAccessMutation(baseOptions?: Apollo.MutationHookOptions<RequestInviteOnlyProjectAccessMutation, RequestInviteOnlyProjectAccessMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RequestInviteOnlyProjectAccessMutation, RequestInviteOnlyProjectAccessMutationVariables>(RequestInviteOnlyProjectAccessDocument, options);
      }
export type RequestInviteOnlyProjectAccessMutationHookResult = ReturnType<typeof useRequestInviteOnlyProjectAccessMutation>;
export type RequestInviteOnlyProjectAccessMutationResult = Apollo.MutationResult<RequestInviteOnlyProjectAccessMutation>;
export type RequestInviteOnlyProjectAccessMutationOptions = Apollo.BaseMutationOptions<RequestInviteOnlyProjectAccessMutation, RequestInviteOnlyProjectAccessMutationVariables>;
export const GetBasemapsDocument = /*#__PURE__*/ gql`
    query GetBasemaps($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    surveyBasemaps {
      ...BasemapDetails
    }
    basemaps {
      ...BasemapDetails
    }
  }
}
    ${BasemapDetailsFragmentDoc}`;
export function useGetBasemapsQuery(baseOptions: Apollo.QueryHookOptions<GetBasemapsQuery, GetBasemapsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBasemapsQuery, GetBasemapsQueryVariables>(GetBasemapsDocument, options);
      }
export function useGetBasemapsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBasemapsQuery, GetBasemapsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBasemapsQuery, GetBasemapsQueryVariables>(GetBasemapsDocument, options);
        }
export type GetBasemapsQueryHookResult = ReturnType<typeof useGetBasemapsQuery>;
export type GetBasemapsLazyQueryHookResult = ReturnType<typeof useGetBasemapsLazyQuery>;
export type GetBasemapsQueryResult = Apollo.QueryResult<GetBasemapsQuery, GetBasemapsQueryVariables>;
export const CreateBasemapDocument = /*#__PURE__*/ gql`
    mutation CreateBasemap($projectId: Int, $name: String!, $thumbnail: Upload!, $tileSize: Int, $type: BasemapType!, $url: String!, $surveysOnly: Boolean) {
  createBasemap(
    input: {basemap: {projectId: $projectId, name: $name, thumbnail: $thumbnail, tileSize: $tileSize, type: $type, url: $url, surveysOnly: $surveysOnly}}
  ) {
    basemap {
      ...BasemapDetails
    }
  }
}
    ${BasemapDetailsFragmentDoc}`;
export type CreateBasemapMutationFn = Apollo.MutationFunction<CreateBasemapMutation, CreateBasemapMutationVariables>;
export function useCreateBasemapMutation(baseOptions?: Apollo.MutationHookOptions<CreateBasemapMutation, CreateBasemapMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateBasemapMutation, CreateBasemapMutationVariables>(CreateBasemapDocument, options);
      }
export type CreateBasemapMutationHookResult = ReturnType<typeof useCreateBasemapMutation>;
export type CreateBasemapMutationResult = Apollo.MutationResult<CreateBasemapMutation>;
export type CreateBasemapMutationOptions = Apollo.BaseMutationOptions<CreateBasemapMutation, CreateBasemapMutationVariables>;
export const UploadBasemapDocument = /*#__PURE__*/ gql`
    mutation UploadBasemap($projectId: Int!, $name: String!, $thumbnail: Upload!, $existingId: Int, $style: JSON!, $surveysOnly: Boolean) {
  uploadStyle(
    thumb: $thumbnail
    style: $style
    projectId: $projectId
    id: $existingId
    name: $name
    surveysOnly: $surveysOnly
  ) {
    ...BasemapDetails
  }
}
    ${BasemapDetailsFragmentDoc}`;
export type UploadBasemapMutationFn = Apollo.MutationFunction<UploadBasemapMutation, UploadBasemapMutationVariables>;
export function useUploadBasemapMutation(baseOptions?: Apollo.MutationHookOptions<UploadBasemapMutation, UploadBasemapMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UploadBasemapMutation, UploadBasemapMutationVariables>(UploadBasemapDocument, options);
      }
export type UploadBasemapMutationHookResult = ReturnType<typeof useUploadBasemapMutation>;
export type UploadBasemapMutationResult = Apollo.MutationResult<UploadBasemapMutation>;
export type UploadBasemapMutationOptions = Apollo.BaseMutationOptions<UploadBasemapMutation, UploadBasemapMutationVariables>;
export const GetBasemapDocument = /*#__PURE__*/ gql`
    query GetBasemap($id: Int!) {
  basemap(id: $id) {
    id
    attribution
    interactivitySettings {
      cursor
      id
      layers
      longTemplate
      shortTemplate
      type
    }
    description
    labelsLayerId
    name
    optionalBasemapLayers {
      basemapId
      defaultVisibility
      description
      options
      groupType
      id
      layers
      metadata
      name
    }
    projectId
    terrainExaggeration
    terrainMaxZoom
    terrainOptional
    terrainTileSize
    terrainUrl
    terrainVisibilityDefault
    thumbnail
    tileSize
    type
    url
  }
}
    `;
export function useGetBasemapQuery(baseOptions: Apollo.QueryHookOptions<GetBasemapQuery, GetBasemapQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBasemapQuery, GetBasemapQueryVariables>(GetBasemapDocument, options);
      }
export function useGetBasemapLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBasemapQuery, GetBasemapQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBasemapQuery, GetBasemapQueryVariables>(GetBasemapDocument, options);
        }
export type GetBasemapQueryHookResult = ReturnType<typeof useGetBasemapQuery>;
export type GetBasemapLazyQueryHookResult = ReturnType<typeof useGetBasemapLazyQuery>;
export type GetBasemapQueryResult = Apollo.QueryResult<GetBasemapQuery, GetBasemapQueryVariables>;
export const UpdateBasemapDocument = /*#__PURE__*/ gql`
    mutation UpdateBasemap($id: Int!, $name: String) {
  updateBasemap(input: {id: $id, patch: {name: $name}}) {
    basemap {
      name
      id
    }
  }
}
    `;
export type UpdateBasemapMutationFn = Apollo.MutationFunction<UpdateBasemapMutation, UpdateBasemapMutationVariables>;
export function useUpdateBasemapMutation(baseOptions?: Apollo.MutationHookOptions<UpdateBasemapMutation, UpdateBasemapMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateBasemapMutation, UpdateBasemapMutationVariables>(UpdateBasemapDocument, options);
      }
export type UpdateBasemapMutationHookResult = ReturnType<typeof useUpdateBasemapMutation>;
export type UpdateBasemapMutationResult = Apollo.MutationResult<UpdateBasemapMutation>;
export type UpdateBasemapMutationOptions = Apollo.BaseMutationOptions<UpdateBasemapMutation, UpdateBasemapMutationVariables>;
export const UpdateBasemapUrlDocument = /*#__PURE__*/ gql`
    mutation UpdateBasemapUrl($id: Int!, $url: String!) {
  updateBasemap(input: {id: $id, patch: {url: $url}}) {
    basemap {
      url
      id
    }
  }
}
    `;
export type UpdateBasemapUrlMutationFn = Apollo.MutationFunction<UpdateBasemapUrlMutation, UpdateBasemapUrlMutationVariables>;
export function useUpdateBasemapUrlMutation(baseOptions?: Apollo.MutationHookOptions<UpdateBasemapUrlMutation, UpdateBasemapUrlMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateBasemapUrlMutation, UpdateBasemapUrlMutationVariables>(UpdateBasemapUrlDocument, options);
      }
export type UpdateBasemapUrlMutationHookResult = ReturnType<typeof useUpdateBasemapUrlMutation>;
export type UpdateBasemapUrlMutationResult = Apollo.MutationResult<UpdateBasemapUrlMutation>;
export type UpdateBasemapUrlMutationOptions = Apollo.BaseMutationOptions<UpdateBasemapUrlMutation, UpdateBasemapUrlMutationVariables>;
export const UpdateBasemapLabelsLayerDocument = /*#__PURE__*/ gql`
    mutation UpdateBasemapLabelsLayer($id: Int!, $layer: String) {
  updateBasemap(input: {id: $id, patch: {labelsLayerId: $layer}}) {
    basemap {
      id
      labelsLayerId
    }
  }
}
    `;
export type UpdateBasemapLabelsLayerMutationFn = Apollo.MutationFunction<UpdateBasemapLabelsLayerMutation, UpdateBasemapLabelsLayerMutationVariables>;
export function useUpdateBasemapLabelsLayerMutation(baseOptions?: Apollo.MutationHookOptions<UpdateBasemapLabelsLayerMutation, UpdateBasemapLabelsLayerMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateBasemapLabelsLayerMutation, UpdateBasemapLabelsLayerMutationVariables>(UpdateBasemapLabelsLayerDocument, options);
      }
export type UpdateBasemapLabelsLayerMutationHookResult = ReturnType<typeof useUpdateBasemapLabelsLayerMutation>;
export type UpdateBasemapLabelsLayerMutationResult = Apollo.MutationResult<UpdateBasemapLabelsLayerMutation>;
export type UpdateBasemapLabelsLayerMutationOptions = Apollo.BaseMutationOptions<UpdateBasemapLabelsLayerMutation, UpdateBasemapLabelsLayerMutationVariables>;
export const Toggle3dTerrainDocument = /*#__PURE__*/ gql`
    mutation Toggle3dTerrain($id: Int!, $terrainUrl: String) {
  updateBasemap(input: {id: $id, patch: {terrainUrl: $terrainUrl}}) {
    basemap {
      id
      terrainUrl
    }
  }
}
    `;
export type Toggle3dTerrainMutationFn = Apollo.MutationFunction<Toggle3dTerrainMutation, Toggle3dTerrainMutationVariables>;
export function useToggle3dTerrainMutation(baseOptions?: Apollo.MutationHookOptions<Toggle3dTerrainMutation, Toggle3dTerrainMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<Toggle3dTerrainMutation, Toggle3dTerrainMutationVariables>(Toggle3dTerrainDocument, options);
      }
export type Toggle3dTerrainMutationHookResult = ReturnType<typeof useToggle3dTerrainMutation>;
export type Toggle3dTerrainMutationResult = Apollo.MutationResult<Toggle3dTerrainMutation>;
export type Toggle3dTerrainMutationOptions = Apollo.BaseMutationOptions<Toggle3dTerrainMutation, Toggle3dTerrainMutationVariables>;
export const Set3dTerrainDocument = /*#__PURE__*/ gql`
    mutation Set3dTerrain($id: Int!, $terrainUrl: String, $terrainOptional: Boolean, $terrainVisibilityDefault: Boolean) {
  updateBasemap(
    input: {id: $id, patch: {terrainUrl: $terrainUrl, terrainOptional: $terrainOptional, terrainVisibilityDefault: $terrainVisibilityDefault}}
  ) {
    basemap {
      id
      terrainUrl
      terrainVisibilityDefault
      terrainOptional
    }
  }
}
    `;
export type Set3dTerrainMutationFn = Apollo.MutationFunction<Set3dTerrainMutation, Set3dTerrainMutationVariables>;
export function useSet3dTerrainMutation(baseOptions?: Apollo.MutationHookOptions<Set3dTerrainMutation, Set3dTerrainMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<Set3dTerrainMutation, Set3dTerrainMutationVariables>(Set3dTerrainDocument, options);
      }
export type Set3dTerrainMutationHookResult = ReturnType<typeof useSet3dTerrainMutation>;
export type Set3dTerrainMutationResult = Apollo.MutationResult<Set3dTerrainMutation>;
export type Set3dTerrainMutationOptions = Apollo.BaseMutationOptions<Set3dTerrainMutation, Set3dTerrainMutationVariables>;
export const UpdateTerrainExaggerationDocument = /*#__PURE__*/ gql`
    mutation UpdateTerrainExaggeration($id: Int!, $terrainExaggeration: BigFloat!) {
  updateBasemap(
    input: {id: $id, patch: {terrainExaggeration: $terrainExaggeration}}
  ) {
    basemap {
      id
      terrainExaggeration
    }
  }
}
    `;
export type UpdateTerrainExaggerationMutationFn = Apollo.MutationFunction<UpdateTerrainExaggerationMutation, UpdateTerrainExaggerationMutationVariables>;
export function useUpdateTerrainExaggerationMutation(baseOptions?: Apollo.MutationHookOptions<UpdateTerrainExaggerationMutation, UpdateTerrainExaggerationMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateTerrainExaggerationMutation, UpdateTerrainExaggerationMutationVariables>(UpdateTerrainExaggerationDocument, options);
      }
export type UpdateTerrainExaggerationMutationHookResult = ReturnType<typeof useUpdateTerrainExaggerationMutation>;
export type UpdateTerrainExaggerationMutationResult = Apollo.MutationResult<UpdateTerrainExaggerationMutation>;
export type UpdateTerrainExaggerationMutationOptions = Apollo.BaseMutationOptions<UpdateTerrainExaggerationMutation, UpdateTerrainExaggerationMutationVariables>;
export const DeleteBasemapDocument = /*#__PURE__*/ gql`
    mutation DeleteBasemap($id: Int!) {
  deleteBasemap(input: {id: $id}) {
    basemap {
      id
    }
  }
}
    `;
export type DeleteBasemapMutationFn = Apollo.MutationFunction<DeleteBasemapMutation, DeleteBasemapMutationVariables>;
export function useDeleteBasemapMutation(baseOptions?: Apollo.MutationHookOptions<DeleteBasemapMutation, DeleteBasemapMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteBasemapMutation, DeleteBasemapMutationVariables>(DeleteBasemapDocument, options);
      }
export type DeleteBasemapMutationHookResult = ReturnType<typeof useDeleteBasemapMutation>;
export type DeleteBasemapMutationResult = Apollo.MutationResult<DeleteBasemapMutation>;
export type DeleteBasemapMutationOptions = Apollo.BaseMutationOptions<DeleteBasemapMutation, DeleteBasemapMutationVariables>;
export const OptionalLayerDocument = /*#__PURE__*/ gql`
    query OptionalLayer($id: Int!) {
  optionalBasemapLayer(id: $id) {
    id
    basemapId
    defaultVisibility
    description
    options
    groupType
    layers
    metadata
    name
  }
}
    `;
export function useOptionalLayerQuery(baseOptions: Apollo.QueryHookOptions<OptionalLayerQuery, OptionalLayerQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<OptionalLayerQuery, OptionalLayerQueryVariables>(OptionalLayerDocument, options);
      }
export function useOptionalLayerLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<OptionalLayerQuery, OptionalLayerQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<OptionalLayerQuery, OptionalLayerQueryVariables>(OptionalLayerDocument, options);
        }
export type OptionalLayerQueryHookResult = ReturnType<typeof useOptionalLayerQuery>;
export type OptionalLayerLazyQueryHookResult = ReturnType<typeof useOptionalLayerLazyQuery>;
export type OptionalLayerQueryResult = Apollo.QueryResult<OptionalLayerQuery, OptionalLayerQueryVariables>;
export const UpdateOptionalLayerNameDocument = /*#__PURE__*/ gql`
    mutation UpdateOptionalLayerName($id: Int!, $name: String!) {
  updateOptionalBasemapLayer(input: {id: $id, patch: {name: $name}}) {
    optionalBasemapLayer {
      id
      name
    }
  }
}
    `;
export type UpdateOptionalLayerNameMutationFn = Apollo.MutationFunction<UpdateOptionalLayerNameMutation, UpdateOptionalLayerNameMutationVariables>;
export function useUpdateOptionalLayerNameMutation(baseOptions?: Apollo.MutationHookOptions<UpdateOptionalLayerNameMutation, UpdateOptionalLayerNameMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateOptionalLayerNameMutation, UpdateOptionalLayerNameMutationVariables>(UpdateOptionalLayerNameDocument, options);
      }
export type UpdateOptionalLayerNameMutationHookResult = ReturnType<typeof useUpdateOptionalLayerNameMutation>;
export type UpdateOptionalLayerNameMutationResult = Apollo.MutationResult<UpdateOptionalLayerNameMutation>;
export type UpdateOptionalLayerNameMutationOptions = Apollo.BaseMutationOptions<UpdateOptionalLayerNameMutation, UpdateOptionalLayerNameMutationVariables>;
export const CreateOptionalLayerDocument = /*#__PURE__*/ gql`
    mutation CreateOptionalLayer($name: String!, $basemapId: Int!, $groupType: OptionalBasemapLayersGroupType, $options: JSON) {
  createOptionalBasemapLayer(
    input: {optionalBasemapLayer: {name: $name, basemapId: $basemapId, groupType: $groupType, options: $options}}
  ) {
    optionalBasemapLayer {
      id
      basemapId
      defaultVisibility
      description
      options
      groupType
      layers
      metadata
      name
    }
  }
}
    `;
export type CreateOptionalLayerMutationFn = Apollo.MutationFunction<CreateOptionalLayerMutation, CreateOptionalLayerMutationVariables>;
export function useCreateOptionalLayerMutation(baseOptions?: Apollo.MutationHookOptions<CreateOptionalLayerMutation, CreateOptionalLayerMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateOptionalLayerMutation, CreateOptionalLayerMutationVariables>(CreateOptionalLayerDocument, options);
      }
export type CreateOptionalLayerMutationHookResult = ReturnType<typeof useCreateOptionalLayerMutation>;
export type CreateOptionalLayerMutationResult = Apollo.MutationResult<CreateOptionalLayerMutation>;
export type CreateOptionalLayerMutationOptions = Apollo.BaseMutationOptions<CreateOptionalLayerMutation, CreateOptionalLayerMutationVariables>;
export const UpdateOptionalLayerDocument = /*#__PURE__*/ gql`
    mutation UpdateOptionalLayer($id: Int!, $name: String, $description: String, $defaultVisibility: Boolean, $metadata: JSON) {
  updateOptionalBasemapLayer(
    input: {id: $id, patch: {name: $name, description: $description, defaultVisibility: $defaultVisibility, metadata: $metadata}}
  ) {
    optionalBasemapLayer {
      name
      description
      id
      defaultVisibility
      metadata
    }
  }
}
    `;
export type UpdateOptionalLayerMutationFn = Apollo.MutationFunction<UpdateOptionalLayerMutation, UpdateOptionalLayerMutationVariables>;
export function useUpdateOptionalLayerMutation(baseOptions?: Apollo.MutationHookOptions<UpdateOptionalLayerMutation, UpdateOptionalLayerMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateOptionalLayerMutation, UpdateOptionalLayerMutationVariables>(UpdateOptionalLayerDocument, options);
      }
export type UpdateOptionalLayerMutationHookResult = ReturnType<typeof useUpdateOptionalLayerMutation>;
export type UpdateOptionalLayerMutationResult = Apollo.MutationResult<UpdateOptionalLayerMutation>;
export type UpdateOptionalLayerMutationOptions = Apollo.BaseMutationOptions<UpdateOptionalLayerMutation, UpdateOptionalLayerMutationVariables>;
export const DeleteOptionalLayerDocument = /*#__PURE__*/ gql`
    mutation DeleteOptionalLayer($id: Int!) {
  deleteOptionalBasemapLayer(input: {id: $id}) {
    optionalBasemapLayer {
      id
    }
  }
}
    `;
export type DeleteOptionalLayerMutationFn = Apollo.MutationFunction<DeleteOptionalLayerMutation, DeleteOptionalLayerMutationVariables>;
export function useDeleteOptionalLayerMutation(baseOptions?: Apollo.MutationHookOptions<DeleteOptionalLayerMutation, DeleteOptionalLayerMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteOptionalLayerMutation, DeleteOptionalLayerMutationVariables>(DeleteOptionalLayerDocument, options);
      }
export type DeleteOptionalLayerMutationHookResult = ReturnType<typeof useDeleteOptionalLayerMutation>;
export type DeleteOptionalLayerMutationResult = Apollo.MutationResult<DeleteOptionalLayerMutation>;
export type DeleteOptionalLayerMutationOptions = Apollo.BaseMutationOptions<DeleteOptionalLayerMutation, DeleteOptionalLayerMutationVariables>;
export const UpdateOptionalBasemapLayerLayerListDocument = /*#__PURE__*/ gql`
    mutation UpdateOptionalBasemapLayerLayerList($id: Int!, $layers: [String]) {
  updateOptionalBasemapLayer(input: {id: $id, patch: {layers: $layers}}) {
    optionalBasemapLayer {
      id
      layers
    }
  }
}
    `;
export type UpdateOptionalBasemapLayerLayerListMutationFn = Apollo.MutationFunction<UpdateOptionalBasemapLayerLayerListMutation, UpdateOptionalBasemapLayerLayerListMutationVariables>;
export function useUpdateOptionalBasemapLayerLayerListMutation(baseOptions?: Apollo.MutationHookOptions<UpdateOptionalBasemapLayerLayerListMutation, UpdateOptionalBasemapLayerLayerListMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateOptionalBasemapLayerLayerListMutation, UpdateOptionalBasemapLayerLayerListMutationVariables>(UpdateOptionalBasemapLayerLayerListDocument, options);
      }
export type UpdateOptionalBasemapLayerLayerListMutationHookResult = ReturnType<typeof useUpdateOptionalBasemapLayerLayerListMutation>;
export type UpdateOptionalBasemapLayerLayerListMutationResult = Apollo.MutationResult<UpdateOptionalBasemapLayerLayerListMutation>;
export type UpdateOptionalBasemapLayerLayerListMutationOptions = Apollo.BaseMutationOptions<UpdateOptionalBasemapLayerLayerListMutation, UpdateOptionalBasemapLayerLayerListMutationVariables>;
export const UpdateOptionalBasemapLayerOptionsDocument = /*#__PURE__*/ gql`
    mutation UpdateOptionalBasemapLayerOptions($id: Int!, $options: JSON!) {
  updateOptionalBasemapLayer(input: {id: $id, patch: {options: $options}}) {
    optionalBasemapLayer {
      id
      options
    }
  }
}
    `;
export type UpdateOptionalBasemapLayerOptionsMutationFn = Apollo.MutationFunction<UpdateOptionalBasemapLayerOptionsMutation, UpdateOptionalBasemapLayerOptionsMutationVariables>;
export function useUpdateOptionalBasemapLayerOptionsMutation(baseOptions?: Apollo.MutationHookOptions<UpdateOptionalBasemapLayerOptionsMutation, UpdateOptionalBasemapLayerOptionsMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateOptionalBasemapLayerOptionsMutation, UpdateOptionalBasemapLayerOptionsMutationVariables>(UpdateOptionalBasemapLayerOptionsDocument, options);
      }
export type UpdateOptionalBasemapLayerOptionsMutationHookResult = ReturnType<typeof useUpdateOptionalBasemapLayerOptionsMutation>;
export type UpdateOptionalBasemapLayerOptionsMutationResult = Apollo.MutationResult<UpdateOptionalBasemapLayerOptionsMutation>;
export type UpdateOptionalBasemapLayerOptionsMutationOptions = Apollo.BaseMutationOptions<UpdateOptionalBasemapLayerOptionsMutation, UpdateOptionalBasemapLayerOptionsMutationVariables>;
export const GetOptionalBasemapLayerDocument = /*#__PURE__*/ gql`
    query GetOptionalBasemapLayer($id: Int!) {
  optionalBasemapLayer(id: $id) {
    id
    basemapId
    name
    description
    defaultVisibility
    groupType
    layers
    metadata
    options
  }
}
    `;
export function useGetOptionalBasemapLayerQuery(baseOptions: Apollo.QueryHookOptions<GetOptionalBasemapLayerQuery, GetOptionalBasemapLayerQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetOptionalBasemapLayerQuery, GetOptionalBasemapLayerQueryVariables>(GetOptionalBasemapLayerDocument, options);
      }
export function useGetOptionalBasemapLayerLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetOptionalBasemapLayerQuery, GetOptionalBasemapLayerQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetOptionalBasemapLayerQuery, GetOptionalBasemapLayerQueryVariables>(GetOptionalBasemapLayerDocument, options);
        }
export type GetOptionalBasemapLayerQueryHookResult = ReturnType<typeof useGetOptionalBasemapLayerQuery>;
export type GetOptionalBasemapLayerLazyQueryHookResult = ReturnType<typeof useGetOptionalBasemapLayerLazyQuery>;
export type GetOptionalBasemapLayerQueryResult = Apollo.QueryResult<GetOptionalBasemapLayerQuery, GetOptionalBasemapLayerQueryVariables>;
export const GetOptionalBasemapLayerMetadataDocument = /*#__PURE__*/ gql`
    query GetOptionalBasemapLayerMetadata($id: Int!) {
  optionalBasemapLayer(id: $id) {
    id
    metadata
  }
}
    `;
export function useGetOptionalBasemapLayerMetadataQuery(baseOptions: Apollo.QueryHookOptions<GetOptionalBasemapLayerMetadataQuery, GetOptionalBasemapLayerMetadataQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetOptionalBasemapLayerMetadataQuery, GetOptionalBasemapLayerMetadataQueryVariables>(GetOptionalBasemapLayerMetadataDocument, options);
      }
export function useGetOptionalBasemapLayerMetadataLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetOptionalBasemapLayerMetadataQuery, GetOptionalBasemapLayerMetadataQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetOptionalBasemapLayerMetadataQuery, GetOptionalBasemapLayerMetadataQueryVariables>(GetOptionalBasemapLayerMetadataDocument, options);
        }
export type GetOptionalBasemapLayerMetadataQueryHookResult = ReturnType<typeof useGetOptionalBasemapLayerMetadataQuery>;
export type GetOptionalBasemapLayerMetadataLazyQueryHookResult = ReturnType<typeof useGetOptionalBasemapLayerMetadataLazyQuery>;
export type GetOptionalBasemapLayerMetadataQueryResult = Apollo.QueryResult<GetOptionalBasemapLayerMetadataQuery, GetOptionalBasemapLayerMetadataQueryVariables>;
export const UpdateOptionalBasemapLayerMetadataDocument = /*#__PURE__*/ gql`
    mutation UpdateOptionalBasemapLayerMetadata($id: Int!, $metadata: JSON) {
  updateOptionalBasemapLayer(input: {id: $id, patch: {metadata: $metadata}}) {
    optionalBasemapLayer {
      id
      metadata
    }
  }
}
    `;
export type UpdateOptionalBasemapLayerMetadataMutationFn = Apollo.MutationFunction<UpdateOptionalBasemapLayerMetadataMutation, UpdateOptionalBasemapLayerMetadataMutationVariables>;
export function useUpdateOptionalBasemapLayerMetadataMutation(baseOptions?: Apollo.MutationHookOptions<UpdateOptionalBasemapLayerMetadataMutation, UpdateOptionalBasemapLayerMetadataMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateOptionalBasemapLayerMetadataMutation, UpdateOptionalBasemapLayerMetadataMutationVariables>(UpdateOptionalBasemapLayerMetadataDocument, options);
      }
export type UpdateOptionalBasemapLayerMetadataMutationHookResult = ReturnType<typeof useUpdateOptionalBasemapLayerMetadataMutation>;
export type UpdateOptionalBasemapLayerMetadataMutationResult = Apollo.MutationResult<UpdateOptionalBasemapLayerMetadataMutation>;
export type UpdateOptionalBasemapLayerMetadataMutationOptions = Apollo.BaseMutationOptions<UpdateOptionalBasemapLayerMetadataMutation, UpdateOptionalBasemapLayerMetadataMutationVariables>;
export const UpdateInteractivitySettingsLayersDocument = /*#__PURE__*/ gql`
    mutation UpdateInteractivitySettingsLayers($id: Int!, $layers: [String]) {
  updateInteractivitySetting(input: {id: $id, patch: {layers: $layers}}) {
    interactivitySetting {
      layers
      id
    }
  }
}
    `;
export type UpdateInteractivitySettingsLayersMutationFn = Apollo.MutationFunction<UpdateInteractivitySettingsLayersMutation, UpdateInteractivitySettingsLayersMutationVariables>;
export function useUpdateInteractivitySettingsLayersMutation(baseOptions?: Apollo.MutationHookOptions<UpdateInteractivitySettingsLayersMutation, UpdateInteractivitySettingsLayersMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateInteractivitySettingsLayersMutation, UpdateInteractivitySettingsLayersMutationVariables>(UpdateInteractivitySettingsLayersDocument, options);
      }
export type UpdateInteractivitySettingsLayersMutationHookResult = ReturnType<typeof useUpdateInteractivitySettingsLayersMutation>;
export type UpdateInteractivitySettingsLayersMutationResult = Apollo.MutationResult<UpdateInteractivitySettingsLayersMutation>;
export type UpdateInteractivitySettingsLayersMutationOptions = Apollo.BaseMutationOptions<UpdateInteractivitySettingsLayersMutation, UpdateInteractivitySettingsLayersMutationVariables>;
export const MapboxKeysDocument = /*#__PURE__*/ gql`
    query MapboxKeys($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    mapboxPublicKey
    mapboxSecretKey
  }
}
    `;
export function useMapboxKeysQuery(baseOptions: Apollo.QueryHookOptions<MapboxKeysQuery, MapboxKeysQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<MapboxKeysQuery, MapboxKeysQueryVariables>(MapboxKeysDocument, options);
      }
export function useMapboxKeysLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<MapboxKeysQuery, MapboxKeysQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<MapboxKeysQuery, MapboxKeysQueryVariables>(MapboxKeysDocument, options);
        }
export type MapboxKeysQueryHookResult = ReturnType<typeof useMapboxKeysQuery>;
export type MapboxKeysLazyQueryHookResult = ReturnType<typeof useMapboxKeysLazyQuery>;
export type MapboxKeysQueryResult = Apollo.QueryResult<MapboxKeysQuery, MapboxKeysQueryVariables>;
export const CreateProjectDocument = /*#__PURE__*/ gql`
    mutation CreateProject($name: String!, $slug: String!) {
  createProject(input: {name: $name, slug: $slug}) {
    project {
      id
      url
      slug
    }
  }
}
    `;
export type CreateProjectMutationFn = Apollo.MutationFunction<CreateProjectMutation, CreateProjectMutationVariables>;
export function useCreateProjectMutation(baseOptions?: Apollo.MutationHookOptions<CreateProjectMutation, CreateProjectMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateProjectMutation, CreateProjectMutationVariables>(CreateProjectDocument, options);
      }
export type CreateProjectMutationHookResult = ReturnType<typeof useCreateProjectMutation>;
export type CreateProjectMutationResult = Apollo.MutationResult<CreateProjectMutation>;
export type CreateProjectMutationOptions = Apollo.BaseMutationOptions<CreateProjectMutation, CreateProjectMutationVariables>;
export const DraftTableOfContentsDocument = /*#__PURE__*/ gql`
    query DraftTableOfContents($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    draftTableOfContentsItems {
      id
      dataLayerId
      title
      acl {
        id
        type
      }
      isClickOffOnly
      isFolder
      stableId
      parentStableId
      showRadioChildren
      bounds
      sortIndex
      hideChildren
      enableDownload
    }
  }
}
    `;
export function useDraftTableOfContentsQuery(baseOptions: Apollo.QueryHookOptions<DraftTableOfContentsQuery, DraftTableOfContentsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<DraftTableOfContentsQuery, DraftTableOfContentsQueryVariables>(DraftTableOfContentsDocument, options);
      }
export function useDraftTableOfContentsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<DraftTableOfContentsQuery, DraftTableOfContentsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<DraftTableOfContentsQuery, DraftTableOfContentsQueryVariables>(DraftTableOfContentsDocument, options);
        }
export type DraftTableOfContentsQueryHookResult = ReturnType<typeof useDraftTableOfContentsQuery>;
export type DraftTableOfContentsLazyQueryHookResult = ReturnType<typeof useDraftTableOfContentsLazyQuery>;
export type DraftTableOfContentsQueryResult = Apollo.QueryResult<DraftTableOfContentsQuery, DraftTableOfContentsQueryVariables>;
export const LayersAndSourcesForItemsDocument = /*#__PURE__*/ gql`
    query layersAndSourcesForItems($slug: String!, $tableOfContentsItemIds: [Int]!) {
  projectBySlug(slug: $slug) {
    id
    dataSourcesForItems(tableOfContentsItemIds: $tableOfContentsItemIds) {
      attribution
      bounds
      bucketId
      buffer
      byteLength
      cluster
      clusterMaxZoom
      clusterProperties
      clusterRadius
      coordinates
      createdAt
      encoding
      enhancedSecurity
      id
      importType
      lineMetrics
      maxzoom
      minzoom
      objectKey
      originalSourceUrl
      queryParameters
      scheme
      tiles
      tileSize
      tolerance
      type
      url
      urls
      useDevicePixelRatio
      supportsDynamicLayers
    }
    dataLayersForItems(tableOfContentsItemIds: $tableOfContentsItemIds) {
      interactivitySettings {
        id
        cursor
        longTemplate
        shortTemplate
        type
      }
      sprites {
        id
        spriteImages {
          pixelRatio
          height
          width
          url
        }
        type
      }
      zIndex
      dataSourceId
      id
      mapboxGlStyles
      renderUnder
      sourceLayer
      sublayer
    }
  }
}
    `;
export function useLayersAndSourcesForItemsQuery(baseOptions: Apollo.QueryHookOptions<LayersAndSourcesForItemsQuery, LayersAndSourcesForItemsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<LayersAndSourcesForItemsQuery, LayersAndSourcesForItemsQueryVariables>(LayersAndSourcesForItemsDocument, options);
      }
export function useLayersAndSourcesForItemsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<LayersAndSourcesForItemsQuery, LayersAndSourcesForItemsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<LayersAndSourcesForItemsQuery, LayersAndSourcesForItemsQueryVariables>(LayersAndSourcesForItemsDocument, options);
        }
export type LayersAndSourcesForItemsQueryHookResult = ReturnType<typeof useLayersAndSourcesForItemsQuery>;
export type LayersAndSourcesForItemsLazyQueryHookResult = ReturnType<typeof useLayersAndSourcesForItemsLazyQuery>;
export type LayersAndSourcesForItemsQueryResult = Apollo.QueryResult<LayersAndSourcesForItemsQuery, LayersAndSourcesForItemsQueryVariables>;
export const CreateFolderDocument = /*#__PURE__*/ gql`
    mutation CreateFolder($title: String!, $stableId: String!, $projectId: Int!, $parentStableId: String, $isClickOffOnly: Boolean, $showRadioChildren: Boolean, $hideChildren: Boolean) {
  createTableOfContentsItem(
    input: {tableOfContentsItem: {title: $title, stableId: $stableId, projectId: $projectId, parentStableId: $parentStableId, isFolder: true, isClickOffOnly: $isClickOffOnly, showRadioChildren: $showRadioChildren, hideChildren: $hideChildren}}
  ) {
    tableOfContentsItem {
      id
      title
      stableId
      projectId
      parentStableId
      isClickOffOnly
      isDraft
      isFolder
      showRadioChildren
      isClickOffOnly
      sortIndex
      hideChildren
      enableDownload
    }
  }
}
    `;
export type CreateFolderMutationFn = Apollo.MutationFunction<CreateFolderMutation, CreateFolderMutationVariables>;
export function useCreateFolderMutation(baseOptions?: Apollo.MutationHookOptions<CreateFolderMutation, CreateFolderMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateFolderMutation, CreateFolderMutationVariables>(CreateFolderDocument, options);
      }
export type CreateFolderMutationHookResult = ReturnType<typeof useCreateFolderMutation>;
export type CreateFolderMutationResult = Apollo.MutationResult<CreateFolderMutation>;
export type CreateFolderMutationOptions = Apollo.BaseMutationOptions<CreateFolderMutation, CreateFolderMutationVariables>;
export const DeleteBranchDocument = /*#__PURE__*/ gql`
    mutation DeleteBranch($id: Int!) {
  deleteTableOfContentsBranch(input: {tableOfContentsItemId: $id}) {
    clientMutationId
  }
}
    `;
export type DeleteBranchMutationFn = Apollo.MutationFunction<DeleteBranchMutation, DeleteBranchMutationVariables>;
export function useDeleteBranchMutation(baseOptions?: Apollo.MutationHookOptions<DeleteBranchMutation, DeleteBranchMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteBranchMutation, DeleteBranchMutationVariables>(DeleteBranchDocument, options);
      }
export type DeleteBranchMutationHookResult = ReturnType<typeof useDeleteBranchMutation>;
export type DeleteBranchMutationResult = Apollo.MutationResult<DeleteBranchMutation>;
export type DeleteBranchMutationOptions = Apollo.BaseMutationOptions<DeleteBranchMutation, DeleteBranchMutationVariables>;
export const UpdateTableOfContentsItemChildrenDocument = /*#__PURE__*/ gql`
    mutation UpdateTableOfContentsItemChildren($id: Int, $childIds: [Int]!) {
  updateTableOfContentsItemChildren(input: {parentId: $id, childIds: $childIds}) {
    tableOfContentsItems {
      id
      sortIndex
      parentStableId
    }
  }
}
    `;
export type UpdateTableOfContentsItemChildrenMutationFn = Apollo.MutationFunction<UpdateTableOfContentsItemChildrenMutation, UpdateTableOfContentsItemChildrenMutationVariables>;
export function useUpdateTableOfContentsItemChildrenMutation(baseOptions?: Apollo.MutationHookOptions<UpdateTableOfContentsItemChildrenMutation, UpdateTableOfContentsItemChildrenMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateTableOfContentsItemChildrenMutation, UpdateTableOfContentsItemChildrenMutationVariables>(UpdateTableOfContentsItemChildrenDocument, options);
      }
export type UpdateTableOfContentsItemChildrenMutationHookResult = ReturnType<typeof useUpdateTableOfContentsItemChildrenMutation>;
export type UpdateTableOfContentsItemChildrenMutationResult = Apollo.MutationResult<UpdateTableOfContentsItemChildrenMutation>;
export type UpdateTableOfContentsItemChildrenMutationOptions = Apollo.BaseMutationOptions<UpdateTableOfContentsItemChildrenMutation, UpdateTableOfContentsItemChildrenMutationVariables>;
export const GetFolderDocument = /*#__PURE__*/ gql`
    query GetFolder($id: Int!) {
  tableOfContentsItem(id: $id) {
    id
    bounds
    isClickOffOnly
    showRadioChildren
    title
    hideChildren
  }
}
    `;
export function useGetFolderQuery(baseOptions: Apollo.QueryHookOptions<GetFolderQuery, GetFolderQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetFolderQuery, GetFolderQueryVariables>(GetFolderDocument, options);
      }
export function useGetFolderLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetFolderQuery, GetFolderQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetFolderQuery, GetFolderQueryVariables>(GetFolderDocument, options);
        }
export type GetFolderQueryHookResult = ReturnType<typeof useGetFolderQuery>;
export type GetFolderLazyQueryHookResult = ReturnType<typeof useGetFolderLazyQuery>;
export type GetFolderQueryResult = Apollo.QueryResult<GetFolderQuery, GetFolderQueryVariables>;
export const UpdateFolderDocument = /*#__PURE__*/ gql`
    mutation UpdateFolder($id: Int!, $bounds: [BigFloat], $isClickOffOnly: Boolean, $showRadioChildren: Boolean, $title: String, $hideChildren: Boolean) {
  updateTableOfContentsItem(
    input: {id: $id, patch: {bounds: $bounds, isClickOffOnly: $isClickOffOnly, showRadioChildren: $showRadioChildren, title: $title, hideChildren: $hideChildren}}
  ) {
    tableOfContentsItem {
      id
      bounds
      isClickOffOnly
      showRadioChildren
      hideChildren
      title
    }
  }
}
    `;
export type UpdateFolderMutationFn = Apollo.MutationFunction<UpdateFolderMutation, UpdateFolderMutationVariables>;
export function useUpdateFolderMutation(baseOptions?: Apollo.MutationHookOptions<UpdateFolderMutation, UpdateFolderMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateFolderMutation, UpdateFolderMutationVariables>(UpdateFolderDocument, options);
      }
export type UpdateFolderMutationHookResult = ReturnType<typeof useUpdateFolderMutation>;
export type UpdateFolderMutationResult = Apollo.MutationResult<UpdateFolderMutation>;
export type UpdateFolderMutationOptions = Apollo.BaseMutationOptions<UpdateFolderMutation, UpdateFolderMutationVariables>;
export const GetLayerItemDocument = /*#__PURE__*/ gql`
    query GetLayerItem($id: Int!) {
  tableOfContentsItem(id: $id) {
    id
    acl {
      nodeId
      id
      type
      groups {
        id
        name
      }
    }
    bounds
    dataLayerId
    metadata
    parentStableId
    projectId
    stableId
    title
    enableDownload
    dataLayer {
      id
      zIndex
      mapboxGlStyles
      interactivitySettingsId
      renderUnder
      sourceLayer
      sublayer
      sprites {
        id
        spriteImages {
          pixelRatio
          height
          width
          url
        }
        type
      }
      dataSourceId
      dataSource {
        id
        attribution
        bounds
        bucketId
        buffer
        byteLength
        cluster
        clusterMaxZoom
        clusterProperties
        clusterRadius
        coordinates
        createdAt
        encoding
        enhancedSecurity
        generateId
        importType
        lineMetrics
        maxzoom
        minzoom
        objectKey
        originalSourceUrl
        promoteId
        queryParameters
        scheme
        tiles
        tileSize
        tolerance
        type
        url
        urls
        useDevicePixelRatio
        supportsDynamicLayers
      }
    }
  }
}
    `;
export function useGetLayerItemQuery(baseOptions: Apollo.QueryHookOptions<GetLayerItemQuery, GetLayerItemQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetLayerItemQuery, GetLayerItemQueryVariables>(GetLayerItemDocument, options);
      }
export function useGetLayerItemLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetLayerItemQuery, GetLayerItemQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetLayerItemQuery, GetLayerItemQueryVariables>(GetLayerItemDocument, options);
        }
export type GetLayerItemQueryHookResult = ReturnType<typeof useGetLayerItemQuery>;
export type GetLayerItemLazyQueryHookResult = ReturnType<typeof useGetLayerItemLazyQuery>;
export type GetLayerItemQueryResult = Apollo.QueryResult<GetLayerItemQuery, GetLayerItemQueryVariables>;
export const UpdateTableOfContentsItemDocument = /*#__PURE__*/ gql`
    mutation UpdateTableOfContentsItem($id: Int!, $title: String, $bounds: [BigFloat], $metadata: JSON) {
  updateTableOfContentsItem(
    input: {id: $id, patch: {title: $title, bounds: $bounds, metadata: $metadata}}
  ) {
    tableOfContentsItem {
      id
      bounds
      metadata
      title
    }
  }
}
    `;
export type UpdateTableOfContentsItemMutationFn = Apollo.MutationFunction<UpdateTableOfContentsItemMutation, UpdateTableOfContentsItemMutationVariables>;
export function useUpdateTableOfContentsItemMutation(baseOptions?: Apollo.MutationHookOptions<UpdateTableOfContentsItemMutation, UpdateTableOfContentsItemMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateTableOfContentsItemMutation, UpdateTableOfContentsItemMutationVariables>(UpdateTableOfContentsItemDocument, options);
      }
export type UpdateTableOfContentsItemMutationHookResult = ReturnType<typeof useUpdateTableOfContentsItemMutation>;
export type UpdateTableOfContentsItemMutationResult = Apollo.MutationResult<UpdateTableOfContentsItemMutation>;
export type UpdateTableOfContentsItemMutationOptions = Apollo.BaseMutationOptions<UpdateTableOfContentsItemMutation, UpdateTableOfContentsItemMutationVariables>;
export const UpdateEnableDownloadDocument = /*#__PURE__*/ gql`
    mutation UpdateEnableDownload($id: Int!, $enableDownload: Boolean) {
  updateTableOfContentsItem(
    input: {id: $id, patch: {enableDownload: $enableDownload}}
  ) {
    tableOfContentsItem {
      id
      enableDownload
    }
  }
}
    `;
export type UpdateEnableDownloadMutationFn = Apollo.MutationFunction<UpdateEnableDownloadMutation, UpdateEnableDownloadMutationVariables>;
export function useUpdateEnableDownloadMutation(baseOptions?: Apollo.MutationHookOptions<UpdateEnableDownloadMutation, UpdateEnableDownloadMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateEnableDownloadMutation, UpdateEnableDownloadMutationVariables>(UpdateEnableDownloadDocument, options);
      }
export type UpdateEnableDownloadMutationHookResult = ReturnType<typeof useUpdateEnableDownloadMutation>;
export type UpdateEnableDownloadMutationResult = Apollo.MutationResult<UpdateEnableDownloadMutation>;
export type UpdateEnableDownloadMutationOptions = Apollo.BaseMutationOptions<UpdateEnableDownloadMutation, UpdateEnableDownloadMutationVariables>;
export const UpdateLayerDocument = /*#__PURE__*/ gql`
    mutation UpdateLayer($id: Int!, $renderUnder: RenderUnderType, $mapboxGlStyles: JSON, $sublayer: String) {
  updateDataLayer(
    input: {id: $id, patch: {renderUnder: $renderUnder, mapboxGlStyles: $mapboxGlStyles, sublayer: $sublayer}}
  ) {
    dataLayer {
      id
      zIndex
      renderUnder
      mapboxGlStyles
      sublayer
      sprites {
        id
        spriteImages {
          pixelRatio
          height
          width
          url
        }
        type
      }
    }
  }
}
    `;
export type UpdateLayerMutationFn = Apollo.MutationFunction<UpdateLayerMutation, UpdateLayerMutationVariables>;
export function useUpdateLayerMutation(baseOptions?: Apollo.MutationHookOptions<UpdateLayerMutation, UpdateLayerMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateLayerMutation, UpdateLayerMutationVariables>(UpdateLayerDocument, options);
      }
export type UpdateLayerMutationHookResult = ReturnType<typeof useUpdateLayerMutation>;
export type UpdateLayerMutationResult = Apollo.MutationResult<UpdateLayerMutation>;
export type UpdateLayerMutationOptions = Apollo.BaseMutationOptions<UpdateLayerMutation, UpdateLayerMutationVariables>;
export const UpdateDataSourceDocument = /*#__PURE__*/ gql`
    mutation UpdateDataSource($id: Int!, $attribution: String) {
  updateDataSource(input: {id: $id, patch: {attribution: $attribution}}) {
    dataSource {
      id
      attribution
      bounds
      bucketId
      buffer
      byteLength
      cluster
      clusterMaxZoom
      clusterProperties
      clusterRadius
      coordinates
      createdAt
      encoding
      enhancedSecurity
      generateId
      importType
      lineMetrics
      maxzoom
      minzoom
      objectKey
      originalSourceUrl
      promoteId
      queryParameters
      scheme
      tiles
      tileSize
      tolerance
      type
      url
      urls
      useDevicePixelRatio
      supportsDynamicLayers
    }
  }
}
    `;
export type UpdateDataSourceMutationFn = Apollo.MutationFunction<UpdateDataSourceMutation, UpdateDataSourceMutationVariables>;
export function useUpdateDataSourceMutation(baseOptions?: Apollo.MutationHookOptions<UpdateDataSourceMutation, UpdateDataSourceMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateDataSourceMutation, UpdateDataSourceMutationVariables>(UpdateDataSourceDocument, options);
      }
export type UpdateDataSourceMutationHookResult = ReturnType<typeof useUpdateDataSourceMutation>;
export type UpdateDataSourceMutationResult = Apollo.MutationResult<UpdateDataSourceMutation>;
export type UpdateDataSourceMutationOptions = Apollo.BaseMutationOptions<UpdateDataSourceMutation, UpdateDataSourceMutationVariables>;
export const InteractivitySettingsForLayerDocument = /*#__PURE__*/ gql`
    query InteractivitySettingsForLayer($layerId: Int!) {
  dataLayer(id: $layerId) {
    id
    sourceLayer
    interactivitySettings {
      cursor
      id
      longTemplate
      shortTemplate
      type
    }
  }
}
    `;
export function useInteractivitySettingsForLayerQuery(baseOptions: Apollo.QueryHookOptions<InteractivitySettingsForLayerQuery, InteractivitySettingsForLayerQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<InteractivitySettingsForLayerQuery, InteractivitySettingsForLayerQueryVariables>(InteractivitySettingsForLayerDocument, options);
      }
export function useInteractivitySettingsForLayerLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<InteractivitySettingsForLayerQuery, InteractivitySettingsForLayerQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<InteractivitySettingsForLayerQuery, InteractivitySettingsForLayerQueryVariables>(InteractivitySettingsForLayerDocument, options);
        }
export type InteractivitySettingsForLayerQueryHookResult = ReturnType<typeof useInteractivitySettingsForLayerQuery>;
export type InteractivitySettingsForLayerLazyQueryHookResult = ReturnType<typeof useInteractivitySettingsForLayerLazyQuery>;
export type InteractivitySettingsForLayerQueryResult = Apollo.QueryResult<InteractivitySettingsForLayerQuery, InteractivitySettingsForLayerQueryVariables>;
export const UpdateInteractivitySettingsDocument = /*#__PURE__*/ gql`
    mutation UpdateInteractivitySettings($id: Int!, $type: InteractivityType, $cursor: CursorType, $longTemplate: String, $shortTemplate: String) {
  updateInteractivitySetting(
    input: {id: $id, patch: {type: $type, cursor: $cursor, longTemplate: $longTemplate, shortTemplate: $shortTemplate}}
  ) {
    interactivitySetting {
      id
      type
      cursor
      longTemplate
      shortTemplate
    }
  }
}
    `;
export type UpdateInteractivitySettingsMutationFn = Apollo.MutationFunction<UpdateInteractivitySettingsMutation, UpdateInteractivitySettingsMutationVariables>;
export function useUpdateInteractivitySettingsMutation(baseOptions?: Apollo.MutationHookOptions<UpdateInteractivitySettingsMutation, UpdateInteractivitySettingsMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateInteractivitySettingsMutation, UpdateInteractivitySettingsMutationVariables>(UpdateInteractivitySettingsDocument, options);
      }
export type UpdateInteractivitySettingsMutationHookResult = ReturnType<typeof useUpdateInteractivitySettingsMutation>;
export type UpdateInteractivitySettingsMutationResult = Apollo.MutationResult<UpdateInteractivitySettingsMutation>;
export type UpdateInteractivitySettingsMutationOptions = Apollo.BaseMutationOptions<UpdateInteractivitySettingsMutation, UpdateInteractivitySettingsMutationVariables>;
export const DataSourceUrlPropertiesDocument = /*#__PURE__*/ gql`
    query DataSourceUrlProperties($id: Int!) {
  dataSource(id: $id) {
    id
    type
    bucketId
    objectKey
    url
    originalSourceUrl
    queryParameters
  }
}
    `;
export function useDataSourceUrlPropertiesQuery(baseOptions: Apollo.QueryHookOptions<DataSourceUrlPropertiesQuery, DataSourceUrlPropertiesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<DataSourceUrlPropertiesQuery, DataSourceUrlPropertiesQueryVariables>(DataSourceUrlPropertiesDocument, options);
      }
export function useDataSourceUrlPropertiesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<DataSourceUrlPropertiesQuery, DataSourceUrlPropertiesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<DataSourceUrlPropertiesQuery, DataSourceUrlPropertiesQueryVariables>(DataSourceUrlPropertiesDocument, options);
        }
export type DataSourceUrlPropertiesQueryHookResult = ReturnType<typeof useDataSourceUrlPropertiesQuery>;
export type DataSourceUrlPropertiesLazyQueryHookResult = ReturnType<typeof useDataSourceUrlPropertiesLazyQuery>;
export type DataSourceUrlPropertiesQueryResult = Apollo.QueryResult<DataSourceUrlPropertiesQuery, DataSourceUrlPropertiesQueryVariables>;
export const UpdateZIndexesDocument = /*#__PURE__*/ gql`
    mutation UpdateZIndexes($dataLayerIds: [Int]!) {
  updateZIndexes(input: {dataLayerIds: $dataLayerIds}) {
    dataLayers {
      id
      zIndex
    }
  }
}
    `;
export type UpdateZIndexesMutationFn = Apollo.MutationFunction<UpdateZIndexesMutation, UpdateZIndexesMutationVariables>;
export function useUpdateZIndexesMutation(baseOptions?: Apollo.MutationHookOptions<UpdateZIndexesMutation, UpdateZIndexesMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateZIndexesMutation, UpdateZIndexesMutationVariables>(UpdateZIndexesDocument, options);
      }
export type UpdateZIndexesMutationHookResult = ReturnType<typeof useUpdateZIndexesMutation>;
export type UpdateZIndexesMutationResult = Apollo.MutationResult<UpdateZIndexesMutation>;
export type UpdateZIndexesMutationOptions = Apollo.BaseMutationOptions<UpdateZIndexesMutation, UpdateZIndexesMutationVariables>;
export const UpdateRenderUnderTypeDocument = /*#__PURE__*/ gql`
    mutation UpdateRenderUnderType($layerId: Int!, $renderUnder: RenderUnderType) {
  updateDataLayer(input: {id: $layerId, patch: {renderUnder: $renderUnder}}) {
    dataLayer {
      id
      renderUnder
    }
  }
}
    `;
export type UpdateRenderUnderTypeMutationFn = Apollo.MutationFunction<UpdateRenderUnderTypeMutation, UpdateRenderUnderTypeMutationVariables>;
export function useUpdateRenderUnderTypeMutation(baseOptions?: Apollo.MutationHookOptions<UpdateRenderUnderTypeMutation, UpdateRenderUnderTypeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateRenderUnderTypeMutation, UpdateRenderUnderTypeMutationVariables>(UpdateRenderUnderTypeDocument, options);
      }
export type UpdateRenderUnderTypeMutationHookResult = ReturnType<typeof useUpdateRenderUnderTypeMutation>;
export type UpdateRenderUnderTypeMutationResult = Apollo.MutationResult<UpdateRenderUnderTypeMutation>;
export type UpdateRenderUnderTypeMutationOptions = Apollo.BaseMutationOptions<UpdateRenderUnderTypeMutation, UpdateRenderUnderTypeMutationVariables>;
export const UpdateQueryParametersDocument = /*#__PURE__*/ gql`
    mutation UpdateQueryParameters($sourceId: Int!, $queryParameters: JSON!) {
  updateDataSource(
    input: {id: $sourceId, patch: {queryParameters: $queryParameters}}
  ) {
    dataSource {
      id
      queryParameters
    }
  }
}
    `;
export type UpdateQueryParametersMutationFn = Apollo.MutationFunction<UpdateQueryParametersMutation, UpdateQueryParametersMutationVariables>;
export function useUpdateQueryParametersMutation(baseOptions?: Apollo.MutationHookOptions<UpdateQueryParametersMutation, UpdateQueryParametersMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateQueryParametersMutation, UpdateQueryParametersMutationVariables>(UpdateQueryParametersDocument, options);
      }
export type UpdateQueryParametersMutationHookResult = ReturnType<typeof useUpdateQueryParametersMutation>;
export type UpdateQueryParametersMutationResult = Apollo.MutationResult<UpdateQueryParametersMutation>;
export type UpdateQueryParametersMutationOptions = Apollo.BaseMutationOptions<UpdateQueryParametersMutation, UpdateQueryParametersMutationVariables>;
export const UpdateEnableHighDpiRequestsDocument = /*#__PURE__*/ gql`
    mutation UpdateEnableHighDPIRequests($sourceId: Int!, $useDevicePixelRatio: Boolean!) {
  updateDataSource(
    input: {id: $sourceId, patch: {useDevicePixelRatio: $useDevicePixelRatio}}
  ) {
    dataSource {
      id
      useDevicePixelRatio
    }
  }
}
    `;
export type UpdateEnableHighDpiRequestsMutationFn = Apollo.MutationFunction<UpdateEnableHighDpiRequestsMutation, UpdateEnableHighDpiRequestsMutationVariables>;
export function useUpdateEnableHighDpiRequestsMutation(baseOptions?: Apollo.MutationHookOptions<UpdateEnableHighDpiRequestsMutation, UpdateEnableHighDpiRequestsMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateEnableHighDpiRequestsMutation, UpdateEnableHighDpiRequestsMutationVariables>(UpdateEnableHighDpiRequestsDocument, options);
      }
export type UpdateEnableHighDpiRequestsMutationHookResult = ReturnType<typeof useUpdateEnableHighDpiRequestsMutation>;
export type UpdateEnableHighDpiRequestsMutationResult = Apollo.MutationResult<UpdateEnableHighDpiRequestsMutation>;
export type UpdateEnableHighDpiRequestsMutationOptions = Apollo.BaseMutationOptions<UpdateEnableHighDpiRequestsMutation, UpdateEnableHighDpiRequestsMutationVariables>;
export const GetMetadataDocument = /*#__PURE__*/ gql`
    query GetMetadata($itemId: Int!) {
  tableOfContentsItem(id: $itemId) {
    id
    metadata
  }
}
    `;
export function useGetMetadataQuery(baseOptions: Apollo.QueryHookOptions<GetMetadataQuery, GetMetadataQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetMetadataQuery, GetMetadataQueryVariables>(GetMetadataDocument, options);
      }
export function useGetMetadataLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetMetadataQuery, GetMetadataQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetMetadataQuery, GetMetadataQueryVariables>(GetMetadataDocument, options);
        }
export type GetMetadataQueryHookResult = ReturnType<typeof useGetMetadataQuery>;
export type GetMetadataLazyQueryHookResult = ReturnType<typeof useGetMetadataLazyQuery>;
export type GetMetadataQueryResult = Apollo.QueryResult<GetMetadataQuery, GetMetadataQueryVariables>;
export const UpdateMetadataDocument = /*#__PURE__*/ gql`
    mutation UpdateMetadata($itemId: Int!, $metadata: JSON!) {
  updateTableOfContentsItem(input: {id: $itemId, patch: {metadata: $metadata}}) {
    tableOfContentsItem {
      id
      metadata
    }
  }
}
    `;
export type UpdateMetadataMutationFn = Apollo.MutationFunction<UpdateMetadataMutation, UpdateMetadataMutationVariables>;
export function useUpdateMetadataMutation(baseOptions?: Apollo.MutationHookOptions<UpdateMetadataMutation, UpdateMetadataMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateMetadataMutation, UpdateMetadataMutationVariables>(UpdateMetadataDocument, options);
      }
export type UpdateMetadataMutationHookResult = ReturnType<typeof useUpdateMetadataMutation>;
export type UpdateMetadataMutationResult = Apollo.MutationResult<UpdateMetadataMutation>;
export type UpdateMetadataMutationOptions = Apollo.BaseMutationOptions<UpdateMetadataMutation, UpdateMetadataMutationVariables>;
export const ProjectHostingQuotaDocument = /*#__PURE__*/ gql`
    query ProjectHostingQuota($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    dataHostingQuota
    dataHostingQuotaUsed
  }
}
    `;
export function useProjectHostingQuotaQuery(baseOptions: Apollo.QueryHookOptions<ProjectHostingQuotaQuery, ProjectHostingQuotaQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ProjectHostingQuotaQuery, ProjectHostingQuotaQueryVariables>(ProjectHostingQuotaDocument, options);
      }
export function useProjectHostingQuotaLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ProjectHostingQuotaQuery, ProjectHostingQuotaQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ProjectHostingQuotaQuery, ProjectHostingQuotaQueryVariables>(ProjectHostingQuotaDocument, options);
        }
export type ProjectHostingQuotaQueryHookResult = ReturnType<typeof useProjectHostingQuotaQuery>;
export type ProjectHostingQuotaLazyQueryHookResult = ReturnType<typeof useProjectHostingQuotaLazyQuery>;
export type ProjectHostingQuotaQueryResult = Apollo.QueryResult<ProjectHostingQuotaQuery, ProjectHostingQuotaQueryVariables>;
export const InteractivitySettingsByIdDocument = /*#__PURE__*/ gql`
    query InteractivitySettingsById($id: Int!) {
  interactivitySetting(id: $id) {
    cursor
    id
    layers
    longTemplate
    shortTemplate
    type
  }
}
    `;
export function useInteractivitySettingsByIdQuery(baseOptions: Apollo.QueryHookOptions<InteractivitySettingsByIdQuery, InteractivitySettingsByIdQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<InteractivitySettingsByIdQuery, InteractivitySettingsByIdQueryVariables>(InteractivitySettingsByIdDocument, options);
      }
export function useInteractivitySettingsByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<InteractivitySettingsByIdQuery, InteractivitySettingsByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<InteractivitySettingsByIdQuery, InteractivitySettingsByIdQueryVariables>(InteractivitySettingsByIdDocument, options);
        }
export type InteractivitySettingsByIdQueryHookResult = ReturnType<typeof useInteractivitySettingsByIdQuery>;
export type InteractivitySettingsByIdLazyQueryHookResult = ReturnType<typeof useInteractivitySettingsByIdLazyQuery>;
export type InteractivitySettingsByIdQueryResult = Apollo.QueryResult<InteractivitySettingsByIdQuery, InteractivitySettingsByIdQueryVariables>;
export const PublishTableOfContentsDocument = /*#__PURE__*/ gql`
    mutation PublishTableOfContents($projectId: Int!) {
  publishTableOfContents(input: {projectId: $projectId}) {
    tableOfContentsItems {
      id
    }
  }
}
    `;
export type PublishTableOfContentsMutationFn = Apollo.MutationFunction<PublishTableOfContentsMutation, PublishTableOfContentsMutationVariables>;
export function usePublishTableOfContentsMutation(baseOptions?: Apollo.MutationHookOptions<PublishTableOfContentsMutation, PublishTableOfContentsMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<PublishTableOfContentsMutation, PublishTableOfContentsMutationVariables>(PublishTableOfContentsDocument, options);
      }
export type PublishTableOfContentsMutationHookResult = ReturnType<typeof usePublishTableOfContentsMutation>;
export type PublishTableOfContentsMutationResult = Apollo.MutationResult<PublishTableOfContentsMutation>;
export type PublishTableOfContentsMutationOptions = Apollo.BaseMutationOptions<PublishTableOfContentsMutation, PublishTableOfContentsMutationVariables>;
export const GetBasemapsAndRegionDocument = /*#__PURE__*/ gql`
    query GetBasemapsAndRegion($slug: String!) {
  projectBySlug(slug: $slug) {
    ...MapEssentials
  }
}
    ${MapEssentialsFragmentDoc}`;
export function useGetBasemapsAndRegionQuery(baseOptions: Apollo.QueryHookOptions<GetBasemapsAndRegionQuery, GetBasemapsAndRegionQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBasemapsAndRegionQuery, GetBasemapsAndRegionQueryVariables>(GetBasemapsAndRegionDocument, options);
      }
export function useGetBasemapsAndRegionLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBasemapsAndRegionQuery, GetBasemapsAndRegionQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBasemapsAndRegionQuery, GetBasemapsAndRegionQueryVariables>(GetBasemapsAndRegionDocument, options);
        }
export type GetBasemapsAndRegionQueryHookResult = ReturnType<typeof useGetBasemapsAndRegionQuery>;
export type GetBasemapsAndRegionLazyQueryHookResult = ReturnType<typeof useGetBasemapsAndRegionLazyQuery>;
export type GetBasemapsAndRegionQueryResult = Apollo.QueryResult<GetBasemapsAndRegionQuery, GetBasemapsAndRegionQueryVariables>;
export const OfflineSurveysDocument = /*#__PURE__*/ gql`
    query OfflineSurveys($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    surveys {
      id
      name
    }
  }
}
    `;
export function useOfflineSurveysQuery(baseOptions: Apollo.QueryHookOptions<OfflineSurveysQuery, OfflineSurveysQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<OfflineSurveysQuery, OfflineSurveysQueryVariables>(OfflineSurveysDocument, options);
      }
export function useOfflineSurveysLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<OfflineSurveysQuery, OfflineSurveysQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<OfflineSurveysQuery, OfflineSurveysQueryVariables>(OfflineSurveysDocument, options);
        }
export type OfflineSurveysQueryHookResult = ReturnType<typeof useOfflineSurveysQuery>;
export type OfflineSurveysLazyQueryHookResult = ReturnType<typeof useOfflineSurveysLazyQuery>;
export type OfflineSurveysQueryResult = Apollo.QueryResult<OfflineSurveysQuery, OfflineSurveysQueryVariables>;
export const ProjectAccessControlSettingsDocument = /*#__PURE__*/ gql`
    query ProjectAccessControlSettings($slug: String!) {
  projectBySlug(slug: $slug) {
    __typename
    id
    accessControl
    isListed
  }
}
    `;
export function useProjectAccessControlSettingsQuery(baseOptions: Apollo.QueryHookOptions<ProjectAccessControlSettingsQuery, ProjectAccessControlSettingsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ProjectAccessControlSettingsQuery, ProjectAccessControlSettingsQueryVariables>(ProjectAccessControlSettingsDocument, options);
      }
export function useProjectAccessControlSettingsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ProjectAccessControlSettingsQuery, ProjectAccessControlSettingsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ProjectAccessControlSettingsQuery, ProjectAccessControlSettingsQueryVariables>(ProjectAccessControlSettingsDocument, options);
        }
export type ProjectAccessControlSettingsQueryHookResult = ReturnType<typeof useProjectAccessControlSettingsQuery>;
export type ProjectAccessControlSettingsLazyQueryHookResult = ReturnType<typeof useProjectAccessControlSettingsLazyQuery>;
export type ProjectAccessControlSettingsQueryResult = Apollo.QueryResult<ProjectAccessControlSettingsQuery, ProjectAccessControlSettingsQueryVariables>;
export const UpdateProjectAccessControlSettingsDocument = /*#__PURE__*/ gql`
    mutation updateProjectAccessControlSettings($slug: String!, $accessControl: ProjectAccessControlSetting, $isListed: Boolean) {
  updateProjectBySlug(
    input: {slug: $slug, patch: {accessControl: $accessControl, isListed: $isListed}}
  ) {
    clientMutationId
    project {
      __typename
      id
      accessControl
      isListed
    }
  }
}
    `;
export type UpdateProjectAccessControlSettingsMutationFn = Apollo.MutationFunction<UpdateProjectAccessControlSettingsMutation, UpdateProjectAccessControlSettingsMutationVariables>;
export function useUpdateProjectAccessControlSettingsMutation(baseOptions?: Apollo.MutationHookOptions<UpdateProjectAccessControlSettingsMutation, UpdateProjectAccessControlSettingsMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateProjectAccessControlSettingsMutation, UpdateProjectAccessControlSettingsMutationVariables>(UpdateProjectAccessControlSettingsDocument, options);
      }
export type UpdateProjectAccessControlSettingsMutationHookResult = ReturnType<typeof useUpdateProjectAccessControlSettingsMutation>;
export type UpdateProjectAccessControlSettingsMutationResult = Apollo.MutationResult<UpdateProjectAccessControlSettingsMutation>;
export type UpdateProjectAccessControlSettingsMutationOptions = Apollo.BaseMutationOptions<UpdateProjectAccessControlSettingsMutation, UpdateProjectAccessControlSettingsMutationVariables>;
export const ProjectMetadataDocument = /*#__PURE__*/ gql`
    query ProjectMetadata($slug: String!) {
  project: projectBySlug(slug: $slug) {
    ...ProjectMetadata
  }
  projectPublicDetails(slug: $slug) {
    ...ProjectPublicDetailsMetadata
  }
  me {
    ...ProjectMetadataMeFrag
  }
}
    ${ProjectMetadataFragmentDoc}
${ProjectPublicDetailsMetadataFragmentDoc}
${ProjectMetadataMeFragFragmentDoc}`;
export function useProjectMetadataQuery(baseOptions: Apollo.QueryHookOptions<ProjectMetadataQuery, ProjectMetadataQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ProjectMetadataQuery, ProjectMetadataQueryVariables>(ProjectMetadataDocument, options);
      }
export function useProjectMetadataLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ProjectMetadataQuery, ProjectMetadataQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ProjectMetadataQuery, ProjectMetadataQueryVariables>(ProjectMetadataDocument, options);
        }
export type ProjectMetadataQueryHookResult = ReturnType<typeof useProjectMetadataQuery>;
export type ProjectMetadataLazyQueryHookResult = ReturnType<typeof useProjectMetadataLazyQuery>;
export type ProjectMetadataQueryResult = Apollo.QueryResult<ProjectMetadataQuery, ProjectMetadataQueryVariables>;
export const MeDocument = /*#__PURE__*/ gql`
    query Me {
  me {
    id
    profile {
      userId
      fullname
      nickname
      email
      picture
      bio
      affiliations
    }
  }
}
    `;
export function useMeQuery(baseOptions?: Apollo.QueryHookOptions<MeQuery, MeQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<MeQuery, MeQueryVariables>(MeDocument, options);
      }
export function useMeLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<MeQuery, MeQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<MeQuery, MeQueryVariables>(MeDocument, options);
        }
export type MeQueryHookResult = ReturnType<typeof useMeQuery>;
export type MeLazyQueryHookResult = ReturnType<typeof useMeLazyQuery>;
export type MeQueryResult = Apollo.QueryResult<MeQuery, MeQueryVariables>;
export const ProjectRegionDocument = /*#__PURE__*/ gql`
    query ProjectRegion($slug: String!) {
  projectBySlug(slug: $slug) {
    __typename
    id
    region {
      geojson
    }
  }
}
    `;
export function useProjectRegionQuery(baseOptions: Apollo.QueryHookOptions<ProjectRegionQuery, ProjectRegionQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ProjectRegionQuery, ProjectRegionQueryVariables>(ProjectRegionDocument, options);
      }
export function useProjectRegionLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ProjectRegionQuery, ProjectRegionQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ProjectRegionQuery, ProjectRegionQueryVariables>(ProjectRegionDocument, options);
        }
export type ProjectRegionQueryHookResult = ReturnType<typeof useProjectRegionQuery>;
export type ProjectRegionLazyQueryHookResult = ReturnType<typeof useProjectRegionLazyQuery>;
export type ProjectRegionQueryResult = Apollo.QueryResult<ProjectRegionQuery, ProjectRegionQueryVariables>;
export const UpdateProjectRegionDocument = /*#__PURE__*/ gql`
    mutation UpdateProjectRegion($slug: String!, $region: GeoJSON!) {
  updateProjectBySlug(input: {slug: $slug, patch: {region: $region}}) {
    clientMutationId
    project {
      __typename
      id
      region {
        geojson
      }
    }
  }
}
    `;
export type UpdateProjectRegionMutationFn = Apollo.MutationFunction<UpdateProjectRegionMutation, UpdateProjectRegionMutationVariables>;
export function useUpdateProjectRegionMutation(baseOptions?: Apollo.MutationHookOptions<UpdateProjectRegionMutation, UpdateProjectRegionMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateProjectRegionMutation, UpdateProjectRegionMutationVariables>(UpdateProjectRegionDocument, options);
      }
export type UpdateProjectRegionMutationHookResult = ReturnType<typeof useUpdateProjectRegionMutation>;
export type UpdateProjectRegionMutationResult = Apollo.MutationResult<UpdateProjectRegionMutation>;
export type UpdateProjectRegionMutationOptions = Apollo.BaseMutationOptions<UpdateProjectRegionMutation, UpdateProjectRegionMutationVariables>;
export const GetProjectBySlugDocument = /*#__PURE__*/ gql`
    query GetProjectBySlug($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    name
  }
}
    `;
export function useGetProjectBySlugQuery(baseOptions: Apollo.QueryHookOptions<GetProjectBySlugQuery, GetProjectBySlugQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetProjectBySlugQuery, GetProjectBySlugQueryVariables>(GetProjectBySlugDocument, options);
      }
export function useGetProjectBySlugLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetProjectBySlugQuery, GetProjectBySlugQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetProjectBySlugQuery, GetProjectBySlugQueryVariables>(GetProjectBySlugDocument, options);
        }
export type GetProjectBySlugQueryHookResult = ReturnType<typeof useGetProjectBySlugQuery>;
export type GetProjectBySlugLazyQueryHookResult = ReturnType<typeof useGetProjectBySlugLazyQuery>;
export type GetProjectBySlugQueryResult = Apollo.QueryResult<GetProjectBySlugQuery, GetProjectBySlugQueryVariables>;
export const ProjectSlugExistsDocument = /*#__PURE__*/ gql`
    query ProjectSlugExists($slug: String!) {
  projectBySlug(slug: $slug) {
    id
  }
}
    `;
export function useProjectSlugExistsQuery(baseOptions: Apollo.QueryHookOptions<ProjectSlugExistsQuery, ProjectSlugExistsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ProjectSlugExistsQuery, ProjectSlugExistsQueryVariables>(ProjectSlugExistsDocument, options);
      }
export function useProjectSlugExistsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ProjectSlugExistsQuery, ProjectSlugExistsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ProjectSlugExistsQuery, ProjectSlugExistsQueryVariables>(ProjectSlugExistsDocument, options);
        }
export type ProjectSlugExistsQueryHookResult = ReturnType<typeof useProjectSlugExistsQuery>;
export type ProjectSlugExistsLazyQueryHookResult = ReturnType<typeof useProjectSlugExistsLazyQuery>;
export type ProjectSlugExistsQueryResult = Apollo.QueryResult<ProjectSlugExistsQuery, ProjectSlugExistsQueryVariables>;
export const PublishedTableOfContentsDocument = /*#__PURE__*/ gql`
    query PublishedTableOfContents($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    tableOfContentsItems {
      id
      acl {
        id
        type
      }
      bounds
      dataLayerId
      enableDownload
      hideChildren
      isClickOffOnly
      isFolder
      parentStableId
      showRadioChildren
      sortIndex
      stableId
      title
    }
  }
}
    `;
export function usePublishedTableOfContentsQuery(baseOptions: Apollo.QueryHookOptions<PublishedTableOfContentsQuery, PublishedTableOfContentsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<PublishedTableOfContentsQuery, PublishedTableOfContentsQueryVariables>(PublishedTableOfContentsDocument, options);
      }
export function usePublishedTableOfContentsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<PublishedTableOfContentsQuery, PublishedTableOfContentsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<PublishedTableOfContentsQuery, PublishedTableOfContentsQueryVariables>(PublishedTableOfContentsDocument, options);
        }
export type PublishedTableOfContentsQueryHookResult = ReturnType<typeof usePublishedTableOfContentsQuery>;
export type PublishedTableOfContentsLazyQueryHookResult = ReturnType<typeof usePublishedTableOfContentsLazyQuery>;
export type PublishedTableOfContentsQueryResult = Apollo.QueryResult<PublishedTableOfContentsQuery, PublishedTableOfContentsQueryVariables>;
export const SimpleProjectListDocument = /*#__PURE__*/ gql`
    query SimpleProjectList($first: Int, $offset: Int) {
  projectsConnection(first: $first, offset: $offset) {
    nodes {
      id
      name
      slug
      description
      url
    }
  }
}
    `;
export function useSimpleProjectListQuery(baseOptions?: Apollo.QueryHookOptions<SimpleProjectListQuery, SimpleProjectListQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SimpleProjectListQuery, SimpleProjectListQueryVariables>(SimpleProjectListDocument, options);
      }
export function useSimpleProjectListLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SimpleProjectListQuery, SimpleProjectListQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SimpleProjectListQuery, SimpleProjectListQueryVariables>(SimpleProjectListDocument, options);
        }
export type SimpleProjectListQueryHookResult = ReturnType<typeof useSimpleProjectListQuery>;
export type SimpleProjectListLazyQueryHookResult = ReturnType<typeof useSimpleProjectListLazyQuery>;
export type SimpleProjectListQueryResult = Apollo.QueryResult<SimpleProjectListQuery, SimpleProjectListQueryVariables>;
export const SurveysDocument = /*#__PURE__*/ gql`
    query Surveys($projectId: Int!) {
  project(id: $projectId) {
    id
    surveys {
      ...SurveyListDetails
    }
  }
}
    ${SurveyListDetailsFragmentDoc}`;
export function useSurveysQuery(baseOptions: Apollo.QueryHookOptions<SurveysQuery, SurveysQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SurveysQuery, SurveysQueryVariables>(SurveysDocument, options);
      }
export function useSurveysLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SurveysQuery, SurveysQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SurveysQuery, SurveysQueryVariables>(SurveysDocument, options);
        }
export type SurveysQueryHookResult = ReturnType<typeof useSurveysQuery>;
export type SurveysLazyQueryHookResult = ReturnType<typeof useSurveysLazyQuery>;
export type SurveysQueryResult = Apollo.QueryResult<SurveysQuery, SurveysQueryVariables>;
export const CreateSurveyDocument = /*#__PURE__*/ gql`
    mutation CreateSurvey($name: String!, $projectId: Int!, $templateId: Int) {
  makeSurvey(input: {projectId: $projectId, name: $name, templateId: $templateId}) {
    survey {
      ...SurveyListDetails
    }
  }
}
    ${SurveyListDetailsFragmentDoc}`;
export type CreateSurveyMutationFn = Apollo.MutationFunction<CreateSurveyMutation, CreateSurveyMutationVariables>;
export function useCreateSurveyMutation(baseOptions?: Apollo.MutationHookOptions<CreateSurveyMutation, CreateSurveyMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateSurveyMutation, CreateSurveyMutationVariables>(CreateSurveyDocument, options);
      }
export type CreateSurveyMutationHookResult = ReturnType<typeof useCreateSurveyMutation>;
export type CreateSurveyMutationResult = Apollo.MutationResult<CreateSurveyMutation>;
export type CreateSurveyMutationOptions = Apollo.BaseMutationOptions<CreateSurveyMutation, CreateSurveyMutationVariables>;
export const SurveyByIdDocument = /*#__PURE__*/ gql`
    query SurveyById($id: Int!) {
  survey(id: $id) {
    ...SurveyListDetails
    isSpatial
  }
}
    ${SurveyListDetailsFragmentDoc}`;
export function useSurveyByIdQuery(baseOptions: Apollo.QueryHookOptions<SurveyByIdQuery, SurveyByIdQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SurveyByIdQuery, SurveyByIdQueryVariables>(SurveyByIdDocument, options);
      }
export function useSurveyByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SurveyByIdQuery, SurveyByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SurveyByIdQuery, SurveyByIdQueryVariables>(SurveyByIdDocument, options);
        }
export type SurveyByIdQueryHookResult = ReturnType<typeof useSurveyByIdQuery>;
export type SurveyByIdLazyQueryHookResult = ReturnType<typeof useSurveyByIdLazyQuery>;
export type SurveyByIdQueryResult = Apollo.QueryResult<SurveyByIdQuery, SurveyByIdQueryVariables>;
export const SurveyFormEditorDetailsDocument = /*#__PURE__*/ gql`
    query SurveyFormEditorDetails($id: Int!, $slug: String!) {
  formElementTypes {
    ...AddFormElementTypeDetails
  }
  survey(id: $id) {
    ...SurveyListDetails
    form {
      id
      isTemplate
      surveyId
      templateName
      templateType
      formElements {
        ...FormElementFullDetails
      }
      logicRules {
        ...LogicRuleDetails
      }
    }
  }
  projectBySlug(slug: $slug) {
    id
    name
    url
    region {
      geojson
    }
  }
}
    ${AddFormElementTypeDetailsFragmentDoc}
${SurveyListDetailsFragmentDoc}
${FormElementFullDetailsFragmentDoc}
${LogicRuleDetailsFragmentDoc}`;
export function useSurveyFormEditorDetailsQuery(baseOptions: Apollo.QueryHookOptions<SurveyFormEditorDetailsQuery, SurveyFormEditorDetailsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SurveyFormEditorDetailsQuery, SurveyFormEditorDetailsQueryVariables>(SurveyFormEditorDetailsDocument, options);
      }
export function useSurveyFormEditorDetailsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SurveyFormEditorDetailsQuery, SurveyFormEditorDetailsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SurveyFormEditorDetailsQuery, SurveyFormEditorDetailsQueryVariables>(SurveyFormEditorDetailsDocument, options);
        }
export type SurveyFormEditorDetailsQueryHookResult = ReturnType<typeof useSurveyFormEditorDetailsQuery>;
export type SurveyFormEditorDetailsLazyQueryHookResult = ReturnType<typeof useSurveyFormEditorDetailsLazyQuery>;
export type SurveyFormEditorDetailsQueryResult = Apollo.QueryResult<SurveyFormEditorDetailsQuery, SurveyFormEditorDetailsQueryVariables>;
export const FormElementTypesDocument = /*#__PURE__*/ gql`
    query FormElementTypes {
  formElementTypes {
    ...AddFormElementTypeDetails
  }
}
    ${AddFormElementTypeDetailsFragmentDoc}`;
export function useFormElementTypesQuery(baseOptions?: Apollo.QueryHookOptions<FormElementTypesQuery, FormElementTypesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<FormElementTypesQuery, FormElementTypesQueryVariables>(FormElementTypesDocument, options);
      }
export function useFormElementTypesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<FormElementTypesQuery, FormElementTypesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<FormElementTypesQuery, FormElementTypesQueryVariables>(FormElementTypesDocument, options);
        }
export type FormElementTypesQueryHookResult = ReturnType<typeof useFormElementTypesQuery>;
export type FormElementTypesLazyQueryHookResult = ReturnType<typeof useFormElementTypesLazyQuery>;
export type FormElementTypesQueryResult = Apollo.QueryResult<FormElementTypesQuery, FormElementTypesQueryVariables>;
export const UpdateSurveyBaseSettingsDocument = /*#__PURE__*/ gql`
    mutation UpdateSurveyBaseSettings($id: Int!, $showProgress: Boolean, $showFacilitationOption: Boolean, $supportedLanguages: [String]) {
  updateSurvey(
    input: {id: $id, patch: {showProgress: $showProgress, showFacilitationOption: $showFacilitationOption, supportedLanguages: $supportedLanguages}}
  ) {
    survey {
      id
      showProgress
      showFacilitationOption
      supportedLanguages
    }
  }
}
    `;
export type UpdateSurveyBaseSettingsMutationFn = Apollo.MutationFunction<UpdateSurveyBaseSettingsMutation, UpdateSurveyBaseSettingsMutationVariables>;
export function useUpdateSurveyBaseSettingsMutation(baseOptions?: Apollo.MutationHookOptions<UpdateSurveyBaseSettingsMutation, UpdateSurveyBaseSettingsMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateSurveyBaseSettingsMutation, UpdateSurveyBaseSettingsMutationVariables>(UpdateSurveyBaseSettingsDocument, options);
      }
export type UpdateSurveyBaseSettingsMutationHookResult = ReturnType<typeof useUpdateSurveyBaseSettingsMutation>;
export type UpdateSurveyBaseSettingsMutationResult = Apollo.MutationResult<UpdateSurveyBaseSettingsMutation>;
export type UpdateSurveyBaseSettingsMutationOptions = Apollo.BaseMutationOptions<UpdateSurveyBaseSettingsMutation, UpdateSurveyBaseSettingsMutationVariables>;
export const UpdateFormElementSketchClassDocument = /*#__PURE__*/ gql`
    mutation UpdateFormElementSketchClass($id: Int!, $geometryType: SketchGeometryType, $allowMulti: Boolean, $mapboxGlStyle: JSON, $geoprocessingClientName: String, $geoprocessingClientUrl: String, $geoprocessingProjectUrl: String) {
  updateSketchClass(
    input: {id: $id, patch: {geometryType: $geometryType, allowMulti: $allowMulti, mapboxGlStyle: $mapboxGlStyle, geoprocessingClientName: $geoprocessingClientName, geoprocessingClientUrl: $geoprocessingClientUrl, geoprocessingProjectUrl: $geoprocessingProjectUrl}}
  ) {
    sketchClass {
      id
      geometryType
      allowMulti
      mapboxGlStyle
      geoprocessingClientName
      geoprocessingClientUrl
      geoprocessingProjectUrl
    }
  }
}
    `;
export type UpdateFormElementSketchClassMutationFn = Apollo.MutationFunction<UpdateFormElementSketchClassMutation, UpdateFormElementSketchClassMutationVariables>;
export function useUpdateFormElementSketchClassMutation(baseOptions?: Apollo.MutationHookOptions<UpdateFormElementSketchClassMutation, UpdateFormElementSketchClassMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateFormElementSketchClassMutation, UpdateFormElementSketchClassMutationVariables>(UpdateFormElementSketchClassDocument, options);
      }
export type UpdateFormElementSketchClassMutationHookResult = ReturnType<typeof useUpdateFormElementSketchClassMutation>;
export type UpdateFormElementSketchClassMutationResult = Apollo.MutationResult<UpdateFormElementSketchClassMutation>;
export type UpdateFormElementSketchClassMutationOptions = Apollo.BaseMutationOptions<UpdateFormElementSketchClassMutation, UpdateFormElementSketchClassMutationVariables>;
export const UpdateFormElementDocument = /*#__PURE__*/ gql`
    mutation UpdateFormElement($id: Int!, $isRequired: Boolean, $body: JSON, $exportId: String, $componentSettings: JSON, $alternateLanguageSettings: JSON, $jumpToId: Int, $typeId: String) {
  updateFormElement(
    input: {id: $id, patch: {isRequired: $isRequired, body: $body, exportId: $exportId, componentSettings: $componentSettings, jumpToId: $jumpToId, typeId: $typeId, alternateLanguageSettings: $alternateLanguageSettings}}
  ) {
    formElement {
      id
      isRequired
      body
      exportId
      componentSettings
      alternateLanguageSettings
      jumpToId
      typeId
    }
  }
}
    `;
export type UpdateFormElementMutationFn = Apollo.MutationFunction<UpdateFormElementMutation, UpdateFormElementMutationVariables>;
export function useUpdateFormElementMutation(baseOptions?: Apollo.MutationHookOptions<UpdateFormElementMutation, UpdateFormElementMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateFormElementMutation, UpdateFormElementMutationVariables>(UpdateFormElementDocument, options);
      }
export type UpdateFormElementMutationHookResult = ReturnType<typeof useUpdateFormElementMutation>;
export type UpdateFormElementMutationResult = Apollo.MutationResult<UpdateFormElementMutation>;
export type UpdateFormElementMutationOptions = Apollo.BaseMutationOptions<UpdateFormElementMutation, UpdateFormElementMutationVariables>;
export const UpdateComponentSettingsDocument = /*#__PURE__*/ gql`
    mutation UpdateComponentSettings($id: Int!, $componentSettings: JSON) {
  updateFormElement(
    input: {id: $id, patch: {componentSettings: $componentSettings}}
  ) {
    formElement {
      id
      componentSettings
    }
  }
}
    `;
export type UpdateComponentSettingsMutationFn = Apollo.MutationFunction<UpdateComponentSettingsMutation, UpdateComponentSettingsMutationVariables>;
export function useUpdateComponentSettingsMutation(baseOptions?: Apollo.MutationHookOptions<UpdateComponentSettingsMutation, UpdateComponentSettingsMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateComponentSettingsMutation, UpdateComponentSettingsMutationVariables>(UpdateComponentSettingsDocument, options);
      }
export type UpdateComponentSettingsMutationHookResult = ReturnType<typeof useUpdateComponentSettingsMutation>;
export type UpdateComponentSettingsMutationResult = Apollo.MutationResult<UpdateComponentSettingsMutation>;
export type UpdateComponentSettingsMutationOptions = Apollo.BaseMutationOptions<UpdateComponentSettingsMutation, UpdateComponentSettingsMutationVariables>;
export const UpdateAlternateLanguageSettingsDocument = /*#__PURE__*/ gql`
    mutation UpdateAlternateLanguageSettings($id: Int!, $alternateLanguageSettings: JSON) {
  updateFormElement(
    input: {id: $id, patch: {alternateLanguageSettings: $alternateLanguageSettings}}
  ) {
    formElement {
      id
      alternateLanguageSettings
    }
  }
}
    `;
export type UpdateAlternateLanguageSettingsMutationFn = Apollo.MutationFunction<UpdateAlternateLanguageSettingsMutation, UpdateAlternateLanguageSettingsMutationVariables>;
export function useUpdateAlternateLanguageSettingsMutation(baseOptions?: Apollo.MutationHookOptions<UpdateAlternateLanguageSettingsMutation, UpdateAlternateLanguageSettingsMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateAlternateLanguageSettingsMutation, UpdateAlternateLanguageSettingsMutationVariables>(UpdateAlternateLanguageSettingsDocument, options);
      }
export type UpdateAlternateLanguageSettingsMutationHookResult = ReturnType<typeof useUpdateAlternateLanguageSettingsMutation>;
export type UpdateAlternateLanguageSettingsMutationResult = Apollo.MutationResult<UpdateAlternateLanguageSettingsMutation>;
export type UpdateAlternateLanguageSettingsMutationOptions = Apollo.BaseMutationOptions<UpdateAlternateLanguageSettingsMutation, UpdateAlternateLanguageSettingsMutationVariables>;
export const UpdateFormElementBodyDocument = /*#__PURE__*/ gql`
    mutation UpdateFormElementBody($id: Int!, $body: JSON!) {
  updateFormElement(input: {id: $id, patch: {body: $body}}) {
    formElement {
      id
      body
    }
  }
}
    `;
export type UpdateFormElementBodyMutationFn = Apollo.MutationFunction<UpdateFormElementBodyMutation, UpdateFormElementBodyMutationVariables>;
export function useUpdateFormElementBodyMutation(baseOptions?: Apollo.MutationHookOptions<UpdateFormElementBodyMutation, UpdateFormElementBodyMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateFormElementBodyMutation, UpdateFormElementBodyMutationVariables>(UpdateFormElementBodyDocument, options);
      }
export type UpdateFormElementBodyMutationHookResult = ReturnType<typeof useUpdateFormElementBodyMutation>;
export type UpdateFormElementBodyMutationResult = Apollo.MutationResult<UpdateFormElementBodyMutation>;
export type UpdateFormElementBodyMutationOptions = Apollo.BaseMutationOptions<UpdateFormElementBodyMutation, UpdateFormElementBodyMutationVariables>;
export const UpdateFormElementOrderDocument = /*#__PURE__*/ gql`
    mutation UpdateFormElementOrder($elementIds: [Int]) {
  setFormElementOrder(input: {elementIds: $elementIds}) {
    formElements {
      id
      position
    }
  }
}
    `;
export type UpdateFormElementOrderMutationFn = Apollo.MutationFunction<UpdateFormElementOrderMutation, UpdateFormElementOrderMutationVariables>;
export function useUpdateFormElementOrderMutation(baseOptions?: Apollo.MutationHookOptions<UpdateFormElementOrderMutation, UpdateFormElementOrderMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateFormElementOrderMutation, UpdateFormElementOrderMutationVariables>(UpdateFormElementOrderDocument, options);
      }
export type UpdateFormElementOrderMutationHookResult = ReturnType<typeof useUpdateFormElementOrderMutation>;
export type UpdateFormElementOrderMutationResult = Apollo.MutationResult<UpdateFormElementOrderMutation>;
export type UpdateFormElementOrderMutationOptions = Apollo.BaseMutationOptions<UpdateFormElementOrderMutation, UpdateFormElementOrderMutationVariables>;
export const AddFormElementDocument = /*#__PURE__*/ gql`
    mutation AddFormElement($body: JSON!, $componentSettings: JSON!, $formId: Int!, $componentType: String!, $position: Int, $exportId: String, $subordinateTo: Int, $isRequired: Boolean!) {
  createFormElement(
    input: {formElement: {body: $body, componentSettings: $componentSettings, formId: $formId, isRequired: $isRequired, typeId: $componentType, position: $position, exportId: $exportId, subordinateTo: $subordinateTo}}
  ) {
    formElement {
      ...FormElementFullDetails
    }
  }
}
    ${FormElementFullDetailsFragmentDoc}`;
export type AddFormElementMutationFn = Apollo.MutationFunction<AddFormElementMutation, AddFormElementMutationVariables>;
export function useAddFormElementMutation(baseOptions?: Apollo.MutationHookOptions<AddFormElementMutation, AddFormElementMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<AddFormElementMutation, AddFormElementMutationVariables>(AddFormElementDocument, options);
      }
export type AddFormElementMutationHookResult = ReturnType<typeof useAddFormElementMutation>;
export type AddFormElementMutationResult = Apollo.MutationResult<AddFormElementMutation>;
export type AddFormElementMutationOptions = Apollo.BaseMutationOptions<AddFormElementMutation, AddFormElementMutationVariables>;
export const DeleteFormElementDocument = /*#__PURE__*/ gql`
    mutation DeleteFormElement($id: Int!) {
  deleteFormElement(input: {id: $id}) {
    formElement {
      id
    }
  }
}
    `;
export type DeleteFormElementMutationFn = Apollo.MutationFunction<DeleteFormElementMutation, DeleteFormElementMutationVariables>;
export function useDeleteFormElementMutation(baseOptions?: Apollo.MutationHookOptions<DeleteFormElementMutation, DeleteFormElementMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteFormElementMutation, DeleteFormElementMutationVariables>(DeleteFormElementDocument, options);
      }
export type DeleteFormElementMutationHookResult = ReturnType<typeof useDeleteFormElementMutation>;
export type DeleteFormElementMutationResult = Apollo.MutationResult<DeleteFormElementMutation>;
export type DeleteFormElementMutationOptions = Apollo.BaseMutationOptions<DeleteFormElementMutation, DeleteFormElementMutationVariables>;
export const UpdateFormDocument = /*#__PURE__*/ gql`
    mutation UpdateForm($id: Int!, $isTemplate: Boolean, $templateName: String) {
  updateForm(
    input: {id: $id, patch: {isTemplate: $isTemplate, templateName: $templateName}}
  ) {
    form {
      id
      isTemplate
      templateName
    }
  }
}
    `;
export type UpdateFormMutationFn = Apollo.MutationFunction<UpdateFormMutation, UpdateFormMutationVariables>;
export function useUpdateFormMutation(baseOptions?: Apollo.MutationHookOptions<UpdateFormMutation, UpdateFormMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateFormMutation, UpdateFormMutationVariables>(UpdateFormDocument, options);
      }
export type UpdateFormMutationHookResult = ReturnType<typeof useUpdateFormMutation>;
export type UpdateFormMutationResult = Apollo.MutationResult<UpdateFormMutation>;
export type UpdateFormMutationOptions = Apollo.BaseMutationOptions<UpdateFormMutation, UpdateFormMutationVariables>;
export const GetPhotosDocument = /*#__PURE__*/ gql`
    query GetPhotos($query: String!) {
  getUnsplashPhotos(query: $query) {
    results {
      blur_hash
      color
      description
      height
      width
      id
      links {
        download_location
      }
      urls {
        full
        raw
        regular
        small
        thumb
      }
      user {
        id
        name
        username
        links {
          html
        }
      }
    }
  }
}
    `;
export function useGetPhotosQuery(baseOptions: Apollo.QueryHookOptions<GetPhotosQuery, GetPhotosQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetPhotosQuery, GetPhotosQueryVariables>(GetPhotosDocument, options);
      }
export function useGetPhotosLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetPhotosQuery, GetPhotosQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetPhotosQuery, GetPhotosQueryVariables>(GetPhotosDocument, options);
        }
export type GetPhotosQueryHookResult = ReturnType<typeof useGetPhotosQuery>;
export type GetPhotosLazyQueryHookResult = ReturnType<typeof useGetPhotosLazyQuery>;
export type GetPhotosQueryResult = Apollo.QueryResult<GetPhotosQuery, GetPhotosQueryVariables>;
export const UpdateFormElementBackgroundDocument = /*#__PURE__*/ gql`
    mutation UpdateFormElementBackground($id: Int!, $backgroundColor: String, $secondaryColor: String, $backgroundPalette: [String], $textVariant: FormElementTextVariant, $layout: FormElementLayout) {
  updateFormElement(
    input: {id: $id, patch: {backgroundColor: $backgroundColor, secondaryColor: $secondaryColor, backgroundPalette: $backgroundPalette, textVariant: $textVariant, layout: $layout}}
  ) {
    formElement {
      id
      backgroundColor
      secondaryColor
      backgroundImage
      layout
      backgroundPalette
      textVariant
      unsplashAuthorName
      unsplashAuthorUrl
    }
  }
}
    `;
export type UpdateFormElementBackgroundMutationFn = Apollo.MutationFunction<UpdateFormElementBackgroundMutation, UpdateFormElementBackgroundMutationVariables>;
export function useUpdateFormElementBackgroundMutation(baseOptions?: Apollo.MutationHookOptions<UpdateFormElementBackgroundMutation, UpdateFormElementBackgroundMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateFormElementBackgroundMutation, UpdateFormElementBackgroundMutationVariables>(UpdateFormElementBackgroundDocument, options);
      }
export type UpdateFormElementBackgroundMutationHookResult = ReturnType<typeof useUpdateFormElementBackgroundMutation>;
export type UpdateFormElementBackgroundMutationResult = Apollo.MutationResult<UpdateFormElementBackgroundMutation>;
export type UpdateFormElementBackgroundMutationOptions = Apollo.BaseMutationOptions<UpdateFormElementBackgroundMutation, UpdateFormElementBackgroundMutationVariables>;
export const SetFormElementBackgroundDocument = /*#__PURE__*/ gql`
    mutation SetFormElementBackground($id: Int!, $backgroundColor: String!, $secondaryColor: String!, $backgroundUrl: String!, $downloadUrl: String!, $backgroundPalette: [String]!, $unsplashAuthorUrl: String!, $unsplashAuthorName: String!, $backgroundWidth: Int!, $backgroundHeight: Int!) {
  setFormElementBackground(
    backgroundColor: $backgroundColor
    secondaryColor: $secondaryColor
    backgroundPalette: $backgroundPalette
    backgroundUrl: $backgroundUrl
    downloadUrl: $downloadUrl
    id: $id
    unsplashAuthorName: $unsplashAuthorName
    unsplashAuthorUrl: $unsplashAuthorUrl
    backgroundHeight: $backgroundHeight
    backgroundWidth: $backgroundWidth
  ) {
    id
    backgroundColor
    secondaryColor
    backgroundImage
    backgroundPalette
    unsplashAuthorName
    unsplashAuthorUrl
    backgroundWidth
    backgroundHeight
  }
}
    `;
export type SetFormElementBackgroundMutationFn = Apollo.MutationFunction<SetFormElementBackgroundMutation, SetFormElementBackgroundMutationVariables>;
export function useSetFormElementBackgroundMutation(baseOptions?: Apollo.MutationHookOptions<SetFormElementBackgroundMutation, SetFormElementBackgroundMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<SetFormElementBackgroundMutation, SetFormElementBackgroundMutationVariables>(SetFormElementBackgroundDocument, options);
      }
export type SetFormElementBackgroundMutationHookResult = ReturnType<typeof useSetFormElementBackgroundMutation>;
export type SetFormElementBackgroundMutationResult = Apollo.MutationResult<SetFormElementBackgroundMutation>;
export type SetFormElementBackgroundMutationOptions = Apollo.BaseMutationOptions<SetFormElementBackgroundMutation, SetFormElementBackgroundMutationVariables>;
export const ClearFormElementStyleDocument = /*#__PURE__*/ gql`
    mutation clearFormElementStyle($id: Int!) {
  clearFormElementStyle(input: {formElementId: $id}) {
    formElement {
      id
      backgroundColor
      backgroundImage
      backgroundPalette
      unsplashAuthorName
      unsplashAuthorUrl
      textVariant
      secondaryColor
      layout
    }
  }
}
    `;
export type ClearFormElementStyleMutationFn = Apollo.MutationFunction<ClearFormElementStyleMutation, ClearFormElementStyleMutationVariables>;
export function useClearFormElementStyleMutation(baseOptions?: Apollo.MutationHookOptions<ClearFormElementStyleMutation, ClearFormElementStyleMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ClearFormElementStyleMutation, ClearFormElementStyleMutationVariables>(ClearFormElementStyleDocument, options);
      }
export type ClearFormElementStyleMutationHookResult = ReturnType<typeof useClearFormElementStyleMutation>;
export type ClearFormElementStyleMutationResult = Apollo.MutationResult<ClearFormElementStyleMutation>;
export type ClearFormElementStyleMutationOptions = Apollo.BaseMutationOptions<ClearFormElementStyleMutation, ClearFormElementStyleMutationVariables>;
export const CreateLogicRuleForSurveyDocument = /*#__PURE__*/ gql`
    mutation createLogicRuleForSurvey($formElementId: Int!, $operator: FieldRuleOperator!, $jumpToId: Int!) {
  createSurveyJumpRule(
    input: {formElementId: $formElementId, booleanOperator: OR, jumpToId: $jumpToId, operator: $operator}
  ) {
    formLogicRule {
      id
      position
      booleanOperator
      command
      formElementId
      jumpToId
      conditions {
        id
        operator
        ruleId
        subjectId
        value
      }
    }
  }
}
    `;
export type CreateLogicRuleForSurveyMutationFn = Apollo.MutationFunction<CreateLogicRuleForSurveyMutation, CreateLogicRuleForSurveyMutationVariables>;
export function useCreateLogicRuleForSurveyMutation(baseOptions?: Apollo.MutationHookOptions<CreateLogicRuleForSurveyMutation, CreateLogicRuleForSurveyMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateLogicRuleForSurveyMutation, CreateLogicRuleForSurveyMutationVariables>(CreateLogicRuleForSurveyDocument, options);
      }
export type CreateLogicRuleForSurveyMutationHookResult = ReturnType<typeof useCreateLogicRuleForSurveyMutation>;
export type CreateLogicRuleForSurveyMutationResult = Apollo.MutationResult<CreateLogicRuleForSurveyMutation>;
export type CreateLogicRuleForSurveyMutationOptions = Apollo.BaseMutationOptions<CreateLogicRuleForSurveyMutation, CreateLogicRuleForSurveyMutationVariables>;
export const UpdateFormLogicRuleDocument = /*#__PURE__*/ gql`
    mutation UpdateFormLogicRule($id: Int!, $jumpToId: Int, $booleanOperator: FormLogicOperator, $formElementId: Int) {
  updateFormLogicRule(
    input: {id: $id, patch: {jumpToId: $jumpToId, booleanOperator: $booleanOperator, formElementId: $formElementId}}
  ) {
    formLogicRule {
      id
      booleanOperator
      command
      jumpToId
      position
      formElementId
    }
  }
}
    `;
export type UpdateFormLogicRuleMutationFn = Apollo.MutationFunction<UpdateFormLogicRuleMutation, UpdateFormLogicRuleMutationVariables>;
export function useUpdateFormLogicRuleMutation(baseOptions?: Apollo.MutationHookOptions<UpdateFormLogicRuleMutation, UpdateFormLogicRuleMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateFormLogicRuleMutation, UpdateFormLogicRuleMutationVariables>(UpdateFormLogicRuleDocument, options);
      }
export type UpdateFormLogicRuleMutationHookResult = ReturnType<typeof useUpdateFormLogicRuleMutation>;
export type UpdateFormLogicRuleMutationResult = Apollo.MutationResult<UpdateFormLogicRuleMutation>;
export type UpdateFormLogicRuleMutationOptions = Apollo.BaseMutationOptions<UpdateFormLogicRuleMutation, UpdateFormLogicRuleMutationVariables>;
export const UpdateLogicConditionDocument = /*#__PURE__*/ gql`
    mutation UpdateLogicCondition($id: Int!, $operator: FieldRuleOperator, $value: JSON, $subjectId: Int) {
  updateFormLogicCondition(
    input: {id: $id, patch: {operator: $operator, value: $value, subjectId: $subjectId}}
  ) {
    formLogicCondition {
      id
      ruleId
      operator
      subjectId
      value
    }
  }
}
    `;
export type UpdateLogicConditionMutationFn = Apollo.MutationFunction<UpdateLogicConditionMutation, UpdateLogicConditionMutationVariables>;
export function useUpdateLogicConditionMutation(baseOptions?: Apollo.MutationHookOptions<UpdateLogicConditionMutation, UpdateLogicConditionMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateLogicConditionMutation, UpdateLogicConditionMutationVariables>(UpdateLogicConditionDocument, options);
      }
export type UpdateLogicConditionMutationHookResult = ReturnType<typeof useUpdateLogicConditionMutation>;
export type UpdateLogicConditionMutationResult = Apollo.MutationResult<UpdateLogicConditionMutation>;
export type UpdateLogicConditionMutationOptions = Apollo.BaseMutationOptions<UpdateLogicConditionMutation, UpdateLogicConditionMutationVariables>;
export const DeleteLogicConditionDocument = /*#__PURE__*/ gql`
    mutation DeleteLogicCondition($id: Int!) {
  deleteFormLogicCondition(input: {id: $id}) {
    formLogicCondition {
      id
      ruleId
    }
  }
}
    `;
export type DeleteLogicConditionMutationFn = Apollo.MutationFunction<DeleteLogicConditionMutation, DeleteLogicConditionMutationVariables>;
export function useDeleteLogicConditionMutation(baseOptions?: Apollo.MutationHookOptions<DeleteLogicConditionMutation, DeleteLogicConditionMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteLogicConditionMutation, DeleteLogicConditionMutationVariables>(DeleteLogicConditionDocument, options);
      }
export type DeleteLogicConditionMutationHookResult = ReturnType<typeof useDeleteLogicConditionMutation>;
export type DeleteLogicConditionMutationResult = Apollo.MutationResult<DeleteLogicConditionMutation>;
export type DeleteLogicConditionMutationOptions = Apollo.BaseMutationOptions<DeleteLogicConditionMutation, DeleteLogicConditionMutationVariables>;
export const DeleteLogicRuleDocument = /*#__PURE__*/ gql`
    mutation DeleteLogicRule($id: Int!) {
  deleteFormLogicRule(input: {id: $id}) {
    formLogicRule {
      id
      formElementId
    }
  }
}
    `;
export type DeleteLogicRuleMutationFn = Apollo.MutationFunction<DeleteLogicRuleMutation, DeleteLogicRuleMutationVariables>;
export function useDeleteLogicRuleMutation(baseOptions?: Apollo.MutationHookOptions<DeleteLogicRuleMutation, DeleteLogicRuleMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteLogicRuleMutation, DeleteLogicRuleMutationVariables>(DeleteLogicRuleDocument, options);
      }
export type DeleteLogicRuleMutationHookResult = ReturnType<typeof useDeleteLogicRuleMutation>;
export type DeleteLogicRuleMutationResult = Apollo.MutationResult<DeleteLogicRuleMutation>;
export type DeleteLogicRuleMutationOptions = Apollo.BaseMutationOptions<DeleteLogicRuleMutation, DeleteLogicRuleMutationVariables>;
export const AddConditionDocument = /*#__PURE__*/ gql`
    mutation AddCondition($operator: FieldRuleOperator!, $ruleId: Int!, $subjectId: Int!, $value: JSON) {
  createFormLogicCondition(
    input: {formLogicCondition: {operator: $operator, ruleId: $ruleId, subjectId: $subjectId, value: $value}}
  ) {
    formLogicCondition {
      id
      operator
      ruleId
      subjectId
      value
    }
  }
}
    `;
export type AddConditionMutationFn = Apollo.MutationFunction<AddConditionMutation, AddConditionMutationVariables>;
export function useAddConditionMutation(baseOptions?: Apollo.MutationHookOptions<AddConditionMutation, AddConditionMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<AddConditionMutation, AddConditionMutationVariables>(AddConditionDocument, options);
      }
export type AddConditionMutationHookResult = ReturnType<typeof useAddConditionMutation>;
export type AddConditionMutationResult = Apollo.MutationResult<AddConditionMutation>;
export type AddConditionMutationOptions = Apollo.BaseMutationOptions<AddConditionMutation, AddConditionMutationVariables>;
export const UpdateSurveyDraftStatusDocument = /*#__PURE__*/ gql`
    mutation UpdateSurveyDraftStatus($id: Int!, $isDisabled: Boolean!) {
  updateSurvey(input: {id: $id, patch: {isDisabled: $isDisabled}}) {
    survey {
      id
      isDisabled
    }
  }
}
    `;
export type UpdateSurveyDraftStatusMutationFn = Apollo.MutationFunction<UpdateSurveyDraftStatusMutation, UpdateSurveyDraftStatusMutationVariables>;
export function useUpdateSurveyDraftStatusMutation(baseOptions?: Apollo.MutationHookOptions<UpdateSurveyDraftStatusMutation, UpdateSurveyDraftStatusMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateSurveyDraftStatusMutation, UpdateSurveyDraftStatusMutationVariables>(UpdateSurveyDraftStatusDocument, options);
      }
export type UpdateSurveyDraftStatusMutationHookResult = ReturnType<typeof useUpdateSurveyDraftStatusMutation>;
export type UpdateSurveyDraftStatusMutationResult = Apollo.MutationResult<UpdateSurveyDraftStatusMutation>;
export type UpdateSurveyDraftStatusMutationOptions = Apollo.BaseMutationOptions<UpdateSurveyDraftStatusMutation, UpdateSurveyDraftStatusMutationVariables>;
export const UploadConsentDocDocument = /*#__PURE__*/ gql`
    mutation UploadConsentDoc($document: Upload!, $formElementId: Int!, $version: Int!) {
  uploadConsentDocument(
    document: $document
    formElementId: $formElementId
    version: $version
  ) {
    id
    componentSettings
  }
}
    `;
export type UploadConsentDocMutationFn = Apollo.MutationFunction<UploadConsentDocMutation, UploadConsentDocMutationVariables>;
export function useUploadConsentDocMutation(baseOptions?: Apollo.MutationHookOptions<UploadConsentDocMutation, UploadConsentDocMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UploadConsentDocMutation, UploadConsentDocMutationVariables>(UploadConsentDocDocument, options);
      }
export type UploadConsentDocMutationHookResult = ReturnType<typeof useUploadConsentDocMutation>;
export type UploadConsentDocMutationResult = Apollo.MutationResult<UploadConsentDocMutation>;
export type UploadConsentDocMutationOptions = Apollo.BaseMutationOptions<UploadConsentDocMutation, UploadConsentDocMutationVariables>;
export const SurveyResponsesDocument = /*#__PURE__*/ gql`
    query SurveyResponses($surveyId: Int!) {
  survey(id: $surveyId) {
    form {
      formElements {
        ...FormElementExtendedDetails
      }
      logicRules {
        ...SurveyAppRule
      }
    }
    id
    practiceResponseCount
    archivedResponseCount
    submittedResponseCount
    surveyResponsesConnection {
      nodes {
        ...SurveyResponse
      }
    }
  }
}
    ${FormElementExtendedDetailsFragmentDoc}
${SurveyAppRuleFragmentDoc}
${SurveyResponseFragmentDoc}`;
export function useSurveyResponsesQuery(baseOptions: Apollo.QueryHookOptions<SurveyResponsesQuery, SurveyResponsesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SurveyResponsesQuery, SurveyResponsesQueryVariables>(SurveyResponsesDocument, options);
      }
export function useSurveyResponsesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SurveyResponsesQuery, SurveyResponsesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SurveyResponsesQuery, SurveyResponsesQueryVariables>(SurveyResponsesDocument, options);
        }
export type SurveyResponsesQueryHookResult = ReturnType<typeof useSurveyResponsesQuery>;
export type SurveyResponsesLazyQueryHookResult = ReturnType<typeof useSurveyResponsesLazyQuery>;
export type SurveyResponsesQueryResult = Apollo.QueryResult<SurveyResponsesQuery, SurveyResponsesQueryVariables>;
export const SurveyMapDetailsDocument = /*#__PURE__*/ gql`
    query SurveyMapDetails($surveyId: Int!) {
  survey(id: $surveyId) {
    form {
      formElements {
        ...FormElementDetails
      }
      id
    }
  }
}
    ${FormElementDetailsFragmentDoc}`;
export function useSurveyMapDetailsQuery(baseOptions: Apollo.QueryHookOptions<SurveyMapDetailsQuery, SurveyMapDetailsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SurveyMapDetailsQuery, SurveyMapDetailsQueryVariables>(SurveyMapDetailsDocument, options);
      }
export function useSurveyMapDetailsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SurveyMapDetailsQuery, SurveyMapDetailsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SurveyMapDetailsQuery, SurveyMapDetailsQueryVariables>(SurveyMapDetailsDocument, options);
        }
export type SurveyMapDetailsQueryHookResult = ReturnType<typeof useSurveyMapDetailsQuery>;
export type SurveyMapDetailsLazyQueryHookResult = ReturnType<typeof useSurveyMapDetailsLazyQuery>;
export type SurveyMapDetailsQueryResult = Apollo.QueryResult<SurveyMapDetailsQuery, SurveyMapDetailsQueryVariables>;
export const ToggleResponsesPracticeDocument = /*#__PURE__*/ gql`
    mutation toggleResponsesPractice($ids: [Int], $isPractice: Boolean) {
  toggleResponsesPractice(input: {ids: $ids, isPractice: $isPractice}) {
    surveyResponses {
      id
      isPractice
      archived
      lastUpdatedByEmail
      survey {
        id
        practiceResponseCount
        archivedResponseCount
        submittedResponseCount
      }
    }
  }
}
    `;
export type ToggleResponsesPracticeMutationFn = Apollo.MutationFunction<ToggleResponsesPracticeMutation, ToggleResponsesPracticeMutationVariables>;
export function useToggleResponsesPracticeMutation(baseOptions?: Apollo.MutationHookOptions<ToggleResponsesPracticeMutation, ToggleResponsesPracticeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ToggleResponsesPracticeMutation, ToggleResponsesPracticeMutationVariables>(ToggleResponsesPracticeDocument, options);
      }
export type ToggleResponsesPracticeMutationHookResult = ReturnType<typeof useToggleResponsesPracticeMutation>;
export type ToggleResponsesPracticeMutationResult = Apollo.MutationResult<ToggleResponsesPracticeMutation>;
export type ToggleResponsesPracticeMutationOptions = Apollo.BaseMutationOptions<ToggleResponsesPracticeMutation, ToggleResponsesPracticeMutationVariables>;
export const ArchiveResponsesDocument = /*#__PURE__*/ gql`
    mutation archiveResponses($ids: [Int], $makeArchived: Boolean) {
  archiveResponses(input: {ids: $ids, makeArchived: $makeArchived}) {
    surveyResponses {
      id
      isPractice
      archived
      lastUpdatedByEmail
      survey {
        id
        practiceResponseCount
        archivedResponseCount
        submittedResponseCount
      }
    }
  }
}
    `;
export type ArchiveResponsesMutationFn = Apollo.MutationFunction<ArchiveResponsesMutation, ArchiveResponsesMutationVariables>;
export function useArchiveResponsesMutation(baseOptions?: Apollo.MutationHookOptions<ArchiveResponsesMutation, ArchiveResponsesMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ArchiveResponsesMutation, ArchiveResponsesMutationVariables>(ArchiveResponsesDocument, options);
      }
export type ArchiveResponsesMutationHookResult = ReturnType<typeof useArchiveResponsesMutation>;
export type ArchiveResponsesMutationResult = Apollo.MutationResult<ArchiveResponsesMutation>;
export type ArchiveResponsesMutationOptions = Apollo.BaseMutationOptions<ArchiveResponsesMutation, ArchiveResponsesMutationVariables>;
export const ModifyAnswersDocument = /*#__PURE__*/ gql`
    mutation modifyAnswers($responseIds: [Int]!, $answers: JSON) {
  modifySurveyAnswers(input: {responseIds: $responseIds, answers: $answers}) {
    surveyResponses {
      id
      data
      updatedAt
      lastUpdatedByEmail
    }
  }
}
    `;
export type ModifyAnswersMutationFn = Apollo.MutationFunction<ModifyAnswersMutation, ModifyAnswersMutationVariables>;
export function useModifyAnswersMutation(baseOptions?: Apollo.MutationHookOptions<ModifyAnswersMutation, ModifyAnswersMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ModifyAnswersMutation, ModifyAnswersMutationVariables>(ModifyAnswersDocument, options);
      }
export type ModifyAnswersMutationHookResult = ReturnType<typeof useModifyAnswersMutation>;
export type ModifyAnswersMutationResult = Apollo.MutationResult<ModifyAnswersMutation>;
export type ModifyAnswersMutationOptions = Apollo.BaseMutationOptions<ModifyAnswersMutation, ModifyAnswersMutationVariables>;
export const CopyAppearanceDocument = /*#__PURE__*/ gql`
    mutation copyAppearance($id: Int!, $copyFrom: Int!) {
  copyAppearance(input: {formElementId: $id, copyFromId: $copyFrom}) {
    formElement {
      id
      backgroundImage
      backgroundColor
      secondaryColor
      backgroundPalette
      unsplashAuthorName
      unsplashAuthorUrl
      backgroundHeight
      backgroundWidth
      layout
      textVariant
    }
  }
}
    `;
export type CopyAppearanceMutationFn = Apollo.MutationFunction<CopyAppearanceMutation, CopyAppearanceMutationVariables>;
export function useCopyAppearanceMutation(baseOptions?: Apollo.MutationHookOptions<CopyAppearanceMutation, CopyAppearanceMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CopyAppearanceMutation, CopyAppearanceMutationVariables>(CopyAppearanceDocument, options);
      }
export type CopyAppearanceMutationHookResult = ReturnType<typeof useCopyAppearanceMutation>;
export type CopyAppearanceMutationResult = Apollo.MutationResult<CopyAppearanceMutation>;
export type CopyAppearanceMutationOptions = Apollo.BaseMutationOptions<CopyAppearanceMutation, CopyAppearanceMutationVariables>;
export const UpdateFormElementBasemapsDocument = /*#__PURE__*/ gql`
    mutation updateFormElementBasemaps($id: Int!, $mapBasemaps: [Int]) {
  updateFormElement(input: {id: $id, patch: {mapBasemaps: $mapBasemaps}}) {
    formElement {
      id
      mapBasemaps
    }
  }
}
    `;
export type UpdateFormElementBasemapsMutationFn = Apollo.MutationFunction<UpdateFormElementBasemapsMutation, UpdateFormElementBasemapsMutationVariables>;
export function useUpdateFormElementBasemapsMutation(baseOptions?: Apollo.MutationHookOptions<UpdateFormElementBasemapsMutation, UpdateFormElementBasemapsMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateFormElementBasemapsMutation, UpdateFormElementBasemapsMutationVariables>(UpdateFormElementBasemapsDocument, options);
      }
export type UpdateFormElementBasemapsMutationHookResult = ReturnType<typeof useUpdateFormElementBasemapsMutation>;
export type UpdateFormElementBasemapsMutationResult = Apollo.MutationResult<UpdateFormElementBasemapsMutation>;
export type UpdateFormElementBasemapsMutationOptions = Apollo.BaseMutationOptions<UpdateFormElementBasemapsMutation, UpdateFormElementBasemapsMutationVariables>;
export const UpdateFormElementMapCameraDocument = /*#__PURE__*/ gql`
    mutation updateFormElementMapCamera($id: Int!, $mapCameraOptions: JSON) {
  updateFormElement(
    input: {id: $id, patch: {mapCameraOptions: $mapCameraOptions}}
  ) {
    formElement {
      id
      mapCameraOptions
    }
  }
}
    `;
export type UpdateFormElementMapCameraMutationFn = Apollo.MutationFunction<UpdateFormElementMapCameraMutation, UpdateFormElementMapCameraMutationVariables>;
export function useUpdateFormElementMapCameraMutation(baseOptions?: Apollo.MutationHookOptions<UpdateFormElementMapCameraMutation, UpdateFormElementMapCameraMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateFormElementMapCameraMutation, UpdateFormElementMapCameraMutationVariables>(UpdateFormElementMapCameraDocument, options);
      }
export type UpdateFormElementMapCameraMutationHookResult = ReturnType<typeof useUpdateFormElementMapCameraMutation>;
export type UpdateFormElementMapCameraMutationResult = Apollo.MutationResult<UpdateFormElementMapCameraMutation>;
export type UpdateFormElementMapCameraMutationOptions = Apollo.BaseMutationOptions<UpdateFormElementMapCameraMutation, UpdateFormElementMapCameraMutationVariables>;
export const AllBasemapsDocument = /*#__PURE__*/ gql`
    query AllBasemaps($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    basemaps {
      ...BasemapDetails
    }
    surveyBasemaps {
      ...BasemapDetails
      relatedFormElements {
        id
      }
    }
  }
}
    ${BasemapDetailsFragmentDoc}`;
export function useAllBasemapsQuery(baseOptions: Apollo.QueryHookOptions<AllBasemapsQuery, AllBasemapsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AllBasemapsQuery, AllBasemapsQueryVariables>(AllBasemapsDocument, options);
      }
export function useAllBasemapsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AllBasemapsQuery, AllBasemapsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AllBasemapsQuery, AllBasemapsQueryVariables>(AllBasemapsDocument, options);
        }
export type AllBasemapsQueryHookResult = ReturnType<typeof useAllBasemapsQuery>;
export type AllBasemapsLazyQueryHookResult = ReturnType<typeof useAllBasemapsLazyQuery>;
export type AllBasemapsQueryResult = Apollo.QueryResult<AllBasemapsQuery, AllBasemapsQueryVariables>;
export const GetFormElementDocument = /*#__PURE__*/ gql`
    query GetFormElement($id: Int!) {
  formElement(id: $id) {
    ...FormElementDetails
  }
}
    ${FormElementDetailsFragmentDoc}`;
export function useGetFormElementQuery(baseOptions: Apollo.QueryHookOptions<GetFormElementQuery, GetFormElementQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetFormElementQuery, GetFormElementQueryVariables>(GetFormElementDocument, options);
      }
export function useGetFormElementLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetFormElementQuery, GetFormElementQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetFormElementQuery, GetFormElementQueryVariables>(GetFormElementDocument, options);
        }
export type GetFormElementQueryHookResult = ReturnType<typeof useGetFormElementQuery>;
export type GetFormElementLazyQueryHookResult = ReturnType<typeof useGetFormElementLazyQuery>;
export type GetFormElementQueryResult = Apollo.QueryResult<GetFormElementQuery, GetFormElementQueryVariables>;
export const SurveyDocument = /*#__PURE__*/ gql`
    query Survey($id: Int!, $slug: String!) {
  projectPublicDetails(slug: $slug) {
    ...ProjectPublicDetailsMetadata
  }
  me {
    id
    isAdmin
    ...ProjectMetadataMeFrag
  }
  currentProject: projectBySlug(slug: $slug) {
    id
    name
    url
    ...MapEssentials
    region {
      geojson
    }
    ...ProjectMetadata
  }
  survey(id: $id) {
    ...SurveyAppSurvey
  }
}
    ${ProjectPublicDetailsMetadataFragmentDoc}
${ProjectMetadataMeFragFragmentDoc}
${MapEssentialsFragmentDoc}
${ProjectMetadataFragmentDoc}
${SurveyAppSurveyFragmentDoc}`;
export function useSurveyQuery(baseOptions: Apollo.QueryHookOptions<SurveyQuery, SurveyQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SurveyQuery, SurveyQueryVariables>(SurveyDocument, options);
      }
export function useSurveyLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SurveyQuery, SurveyQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SurveyQuery, SurveyQueryVariables>(SurveyDocument, options);
        }
export type SurveyQueryHookResult = ReturnType<typeof useSurveyQuery>;
export type SurveyLazyQueryHookResult = ReturnType<typeof useSurveyLazyQuery>;
export type SurveyQueryResult = Apollo.QueryResult<SurveyQuery, SurveyQueryVariables>;
export const CreateResponseDocument = /*#__PURE__*/ gql`
    mutation CreateResponse($surveyId: Int!, $isDraft: Boolean!, $bypassedDuplicateSubmissionControl: Boolean!, $responseData: JSON!, $facilitated: Boolean!, $practice: Boolean!) {
  createSurveyResponse(
    input: {surveyId: $surveyId, draft: $isDraft, responseData: $responseData, bypassedSubmissionControl: $bypassedDuplicateSubmissionControl, facilitated: $facilitated, practice: $practice}
  ) {
    clientMutationId
    surveyResponse {
      id
    }
  }
}
    `;
export type CreateResponseMutationFn = Apollo.MutationFunction<CreateResponseMutation, CreateResponseMutationVariables>;
export function useCreateResponseMutation(baseOptions?: Apollo.MutationHookOptions<CreateResponseMutation, CreateResponseMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateResponseMutation, CreateResponseMutationVariables>(CreateResponseDocument, options);
      }
export type CreateResponseMutationHookResult = ReturnType<typeof useCreateResponseMutation>;
export type CreateResponseMutationResult = Apollo.MutationResult<CreateResponseMutation>;
export type CreateResponseMutationOptions = Apollo.BaseMutationOptions<CreateResponseMutation, CreateResponseMutationVariables>;
export const UpdateProjectNameDocument = /*#__PURE__*/ gql`
    mutation UpdateProjectName($name: String!, $slug: String!, $clientMutationId: String) {
  updateProjectBySlug(
    input: {slug: $slug, clientMutationId: $clientMutationId, patch: {name: $name}}
  ) {
    clientMutationId
    project {
      id
      name
    }
  }
}
    `;
export type UpdateProjectNameMutationFn = Apollo.MutationFunction<UpdateProjectNameMutation, UpdateProjectNameMutationVariables>;
export function useUpdateProjectNameMutation(baseOptions?: Apollo.MutationHookOptions<UpdateProjectNameMutation, UpdateProjectNameMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateProjectNameMutation, UpdateProjectNameMutationVariables>(UpdateProjectNameDocument, options);
      }
export type UpdateProjectNameMutationHookResult = ReturnType<typeof useUpdateProjectNameMutation>;
export type UpdateProjectNameMutationResult = Apollo.MutationResult<UpdateProjectNameMutation>;
export type UpdateProjectNameMutationOptions = Apollo.BaseMutationOptions<UpdateProjectNameMutation, UpdateProjectNameMutationVariables>;
export const UpdateProjectSettingsDocument = /*#__PURE__*/ gql`
    mutation UpdateProjectSettings($slug: String!, $clientMutationId: String, $name: String, $description: String, $logoUrl: Upload, $logoLink: String, $isFeatured: Boolean, $mapboxPublicKey: String) {
  updateProjectBySlug(
    input: {slug: $slug, clientMutationId: $clientMutationId, patch: {name: $name, description: $description, logoUrl: $logoUrl, logoLink: $logoLink, isFeatured: $isFeatured, mapboxPublicKey: $mapboxPublicKey}}
  ) {
    clientMutationId
    project {
      id
      name
      description
      logoUrl
      logoLink
      mapboxPublicKey
      mapboxSecretKey
      isFeatured
    }
  }
}
    `;
export type UpdateProjectSettingsMutationFn = Apollo.MutationFunction<UpdateProjectSettingsMutation, UpdateProjectSettingsMutationVariables>;
export function useUpdateProjectSettingsMutation(baseOptions?: Apollo.MutationHookOptions<UpdateProjectSettingsMutation, UpdateProjectSettingsMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateProjectSettingsMutation, UpdateProjectSettingsMutationVariables>(UpdateProjectSettingsDocument, options);
      }
export type UpdateProjectSettingsMutationHookResult = ReturnType<typeof useUpdateProjectSettingsMutation>;
export type UpdateProjectSettingsMutationResult = Apollo.MutationResult<UpdateProjectSettingsMutation>;
export type UpdateProjectSettingsMutationOptions = Apollo.BaseMutationOptions<UpdateProjectSettingsMutation, UpdateProjectSettingsMutationVariables>;
export const UserAdminCountsDocument = /*#__PURE__*/ gql`
    query UserAdminCounts($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    accessControl
    participantCount
    adminCount
    inviteCounts {
      count
      status
    }
    groups {
      id
      name
      memberCount
    }
    unapprovedParticipantCount
  }
}
    `;
export function useUserAdminCountsQuery(baseOptions: Apollo.QueryHookOptions<UserAdminCountsQuery, UserAdminCountsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<UserAdminCountsQuery, UserAdminCountsQueryVariables>(UserAdminCountsDocument, options);
      }
export function useUserAdminCountsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<UserAdminCountsQuery, UserAdminCountsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<UserAdminCountsQuery, UserAdminCountsQueryVariables>(UserAdminCountsDocument, options);
        }
export type UserAdminCountsQueryHookResult = ReturnType<typeof useUserAdminCountsQuery>;
export type UserAdminCountsLazyQueryHookResult = ReturnType<typeof useUserAdminCountsLazyQuery>;
export type UserAdminCountsQueryResult = Apollo.QueryResult<UserAdminCountsQuery, UserAdminCountsQueryVariables>;
export const CreateGroupDocument = /*#__PURE__*/ gql`
    mutation CreateGroup($projectId: Int!, $name: String!) {
  createGroup(input: {group: {name: $name, projectId: $projectId}}) {
    group {
      id
      name
      projectId
    }
  }
}
    `;
export type CreateGroupMutationFn = Apollo.MutationFunction<CreateGroupMutation, CreateGroupMutationVariables>;
export function useCreateGroupMutation(baseOptions?: Apollo.MutationHookOptions<CreateGroupMutation, CreateGroupMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateGroupMutation, CreateGroupMutationVariables>(CreateGroupDocument, options);
      }
export type CreateGroupMutationHookResult = ReturnType<typeof useCreateGroupMutation>;
export type CreateGroupMutationResult = Apollo.MutationResult<CreateGroupMutation>;
export type CreateGroupMutationOptions = Apollo.BaseMutationOptions<CreateGroupMutation, CreateGroupMutationVariables>;
export const ParticipantsDocument = /*#__PURE__*/ gql`
    query Participants($slug: String!, $offset: Int, $first: Int) {
  root: projectBySlug(slug: $slug) {
    id
    participants(offset: $offset, first: $first) {
      ...ParticipantListDetails
    }
  }
}
    ${ParticipantListDetailsFragmentDoc}`;
export function useParticipantsQuery(baseOptions: Apollo.QueryHookOptions<ParticipantsQuery, ParticipantsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ParticipantsQuery, ParticipantsQueryVariables>(ParticipantsDocument, options);
      }
export function useParticipantsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ParticipantsQuery, ParticipantsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ParticipantsQuery, ParticipantsQueryVariables>(ParticipantsDocument, options);
        }
export type ParticipantsQueryHookResult = ReturnType<typeof useParticipantsQuery>;
export type ParticipantsLazyQueryHookResult = ReturnType<typeof useParticipantsLazyQuery>;
export type ParticipantsQueryResult = Apollo.QueryResult<ParticipantsQuery, ParticipantsQueryVariables>;
export const AdminsDocument = /*#__PURE__*/ gql`
    query Admins($slug: String!, $offset: Int, $first: Int) {
  root: projectBySlug(slug: $slug) {
    id
    participants: admins(offset: $offset, first: $first) {
      ...ParticipantListDetails
    }
  }
}
    ${ParticipantListDetailsFragmentDoc}`;
export function useAdminsQuery(baseOptions: Apollo.QueryHookOptions<AdminsQuery, AdminsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AdminsQuery, AdminsQueryVariables>(AdminsDocument, options);
      }
export function useAdminsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AdminsQuery, AdminsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AdminsQuery, AdminsQueryVariables>(AdminsDocument, options);
        }
export type AdminsQueryHookResult = ReturnType<typeof useAdminsQuery>;
export type AdminsLazyQueryHookResult = ReturnType<typeof useAdminsLazyQuery>;
export type AdminsQueryResult = Apollo.QueryResult<AdminsQuery, AdminsQueryVariables>;
export const GroupMembersDocument = /*#__PURE__*/ gql`
    query GroupMembers($groupId: Int!, $offset: Int, $first: Int) {
  root: group(id: $groupId) {
    participants: members(offset: $offset, first: $first) {
      ...ParticipantListDetails
    }
  }
}
    ${ParticipantListDetailsFragmentDoc}`;
export function useGroupMembersQuery(baseOptions: Apollo.QueryHookOptions<GroupMembersQuery, GroupMembersQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GroupMembersQuery, GroupMembersQueryVariables>(GroupMembersDocument, options);
      }
export function useGroupMembersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GroupMembersQuery, GroupMembersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GroupMembersQuery, GroupMembersQueryVariables>(GroupMembersDocument, options);
        }
export type GroupMembersQueryHookResult = ReturnType<typeof useGroupMembersQuery>;
export type GroupMembersLazyQueryHookResult = ReturnType<typeof useGroupMembersLazyQuery>;
export type GroupMembersQueryResult = Apollo.QueryResult<GroupMembersQuery, GroupMembersQueryVariables>;
export const UserSettingsListsDocument = /*#__PURE__*/ gql`
    query UserSettingsLists($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    groups {
      name
      id
    }
    invitesConnection {
      nodes {
        ...InviteDetails
      }
    }
    participants {
      ...UserListDetails
    }
    accessControl
  }
}
    ${InviteDetailsFragmentDoc}
${UserListDetailsFragmentDoc}`;
export function useUserSettingsListsQuery(baseOptions: Apollo.QueryHookOptions<UserSettingsListsQuery, UserSettingsListsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<UserSettingsListsQuery, UserSettingsListsQueryVariables>(UserSettingsListsDocument, options);
      }
export function useUserSettingsListsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<UserSettingsListsQuery, UserSettingsListsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<UserSettingsListsQuery, UserSettingsListsQueryVariables>(UserSettingsListsDocument, options);
        }
export type UserSettingsListsQueryHookResult = ReturnType<typeof useUserSettingsListsQuery>;
export type UserSettingsListsLazyQueryHookResult = ReturnType<typeof useUserSettingsListsLazyQuery>;
export type UserSettingsListsQueryResult = Apollo.QueryResult<UserSettingsListsQuery, UserSettingsListsQueryVariables>;
export const UserInfoDocument = /*#__PURE__*/ gql`
    query UserInfo($userId: Int!, $slug: String!) {
  user(id: $userId) {
    id
    isAdmin
    canonicalEmail
    bannedFromForums
    emailNotificationPreference {
      unsubscribeAll
    }
    groups {
      name
      id
    }
    onboarded
    participationStatus
    profile {
      userId
      affiliations
      bio
      email
      fullname
      nickname
      picture
    }
  }
  projectBySlug(slug: $slug) {
    id
    groups {
      name
      id
    }
  }
}
    `;
export function useUserInfoQuery(baseOptions: Apollo.QueryHookOptions<UserInfoQuery, UserInfoQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<UserInfoQuery, UserInfoQueryVariables>(UserInfoDocument, options);
      }
export function useUserInfoLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<UserInfoQuery, UserInfoQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<UserInfoQuery, UserInfoQueryVariables>(UserInfoDocument, options);
        }
export type UserInfoQueryHookResult = ReturnType<typeof useUserInfoQuery>;
export type UserInfoLazyQueryHookResult = ReturnType<typeof useUserInfoLazyQuery>;
export type UserInfoQueryResult = Apollo.QueryResult<UserInfoQuery, UserInfoQueryVariables>;
export const ToggleAdminAccessDocument = /*#__PURE__*/ gql`
    mutation toggleAdminAccess($userId: Int!, $projectId: Int!) {
  toggleAdminAccess(input: {projectId: $projectId, userId: $userId}) {
    clientMutationId
    isAdmin: boolean
  }
}
    `;
export type ToggleAdminAccessMutationFn = Apollo.MutationFunction<ToggleAdminAccessMutation, ToggleAdminAccessMutationVariables>;
export function useToggleAdminAccessMutation(baseOptions?: Apollo.MutationHookOptions<ToggleAdminAccessMutation, ToggleAdminAccessMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ToggleAdminAccessMutation, ToggleAdminAccessMutationVariables>(ToggleAdminAccessDocument, options);
      }
export type ToggleAdminAccessMutationHookResult = ReturnType<typeof useToggleAdminAccessMutation>;
export type ToggleAdminAccessMutationResult = Apollo.MutationResult<ToggleAdminAccessMutation>;
export type ToggleAdminAccessMutationOptions = Apollo.BaseMutationOptions<ToggleAdminAccessMutation, ToggleAdminAccessMutationVariables>;
export const SetUserGroupsDocument = /*#__PURE__*/ gql`
    mutation setUserGroups($userId: Int!, $projectId: Int!, $groupIds: [Int]!) {
  setUserGroups(
    input: {userId: $userId, projectId: $projectId, groups: $groupIds}
  ) {
    groupIds: integers
  }
}
    `;
export type SetUserGroupsMutationFn = Apollo.MutationFunction<SetUserGroupsMutation, SetUserGroupsMutationVariables>;
export function useSetUserGroupsMutation(baseOptions?: Apollo.MutationHookOptions<SetUserGroupsMutation, SetUserGroupsMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<SetUserGroupsMutation, SetUserGroupsMutationVariables>(SetUserGroupsDocument, options);
      }
export type SetUserGroupsMutationHookResult = ReturnType<typeof useSetUserGroupsMutation>;
export type SetUserGroupsMutationResult = Apollo.MutationResult<SetUserGroupsMutation>;
export type SetUserGroupsMutationOptions = Apollo.BaseMutationOptions<SetUserGroupsMutation, SetUserGroupsMutationVariables>;
export const ToggleForumPostingBanDocument = /*#__PURE__*/ gql`
    mutation toggleForumPostingBan($userId: Int!, $projectId: Int!) {
  toggleForumPostingBan(input: {userId: $userId, projectId: $projectId}) {
    isBanned: boolean
  }
}
    `;
export type ToggleForumPostingBanMutationFn = Apollo.MutationFunction<ToggleForumPostingBanMutation, ToggleForumPostingBanMutationVariables>;
export function useToggleForumPostingBanMutation(baseOptions?: Apollo.MutationHookOptions<ToggleForumPostingBanMutation, ToggleForumPostingBanMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ToggleForumPostingBanMutation, ToggleForumPostingBanMutationVariables>(ToggleForumPostingBanDocument, options);
      }
export type ToggleForumPostingBanMutationHookResult = ReturnType<typeof useToggleForumPostingBanMutation>;
export type ToggleForumPostingBanMutationResult = Apollo.MutationResult<ToggleForumPostingBanMutation>;
export type ToggleForumPostingBanMutationOptions = Apollo.BaseMutationOptions<ToggleForumPostingBanMutation, ToggleForumPostingBanMutationVariables>;
export const DeleteGroupDocument = /*#__PURE__*/ gql`
    mutation deleteGroup($groupId: Int!) {
  deleteGroup(input: {id: $groupId}) {
    group {
      id
    }
  }
}
    `;
export type DeleteGroupMutationFn = Apollo.MutationFunction<DeleteGroupMutation, DeleteGroupMutationVariables>;
export function useDeleteGroupMutation(baseOptions?: Apollo.MutationHookOptions<DeleteGroupMutation, DeleteGroupMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteGroupMutation, DeleteGroupMutationVariables>(DeleteGroupDocument, options);
      }
export type DeleteGroupMutationHookResult = ReturnType<typeof useDeleteGroupMutation>;
export type DeleteGroupMutationResult = Apollo.MutationResult<DeleteGroupMutation>;
export type DeleteGroupMutationOptions = Apollo.BaseMutationOptions<DeleteGroupMutation, DeleteGroupMutationVariables>;
export const CreateProjectInvitesDocument = /*#__PURE__*/ gql`
    mutation createProjectInvites($projectId: Int!, $makeAdmin: Boolean!, $groupNames: [String]!, $userDetails: [ProjectInviteOptionInput]!, $sendEmailNow: Boolean!) {
  createProjectInvites(
    input: {projectId: $projectId, makeAdmin: $makeAdmin, groupNames: $groupNames, projectInviteOptions: $userDetails, sendEmailNow: $sendEmailNow}
  ) {
    projectInvites {
      ...InviteDetails
    }
  }
}
    ${InviteDetailsFragmentDoc}`;
export type CreateProjectInvitesMutationFn = Apollo.MutationFunction<CreateProjectInvitesMutation, CreateProjectInvitesMutationVariables>;
export function useCreateProjectInvitesMutation(baseOptions?: Apollo.MutationHookOptions<CreateProjectInvitesMutation, CreateProjectInvitesMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateProjectInvitesMutation, CreateProjectInvitesMutationVariables>(CreateProjectInvitesDocument, options);
      }
export type CreateProjectInvitesMutationHookResult = ReturnType<typeof useCreateProjectInvitesMutation>;
export type CreateProjectInvitesMutationResult = Apollo.MutationResult<CreateProjectInvitesMutation>;
export type CreateProjectInvitesMutationOptions = Apollo.BaseMutationOptions<CreateProjectInvitesMutation, CreateProjectInvitesMutationVariables>;
export const ProjectInvitesDocument = /*#__PURE__*/ gql`
    query ProjectInvites($projectId: Int!, $status: [InviteStatus], $orderBy: InviteOrderBy, $cursor: Cursor, $limit: Int) {
  project(id: $projectId) {
    id
    invitesConnection(
      statuses: $status
      orderBy: $orderBy
      after: $cursor
      first: $limit
    ) {
      edges {
        node {
          ...InviteDetails
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
    ${InviteDetailsFragmentDoc}`;
export function useProjectInvitesQuery(baseOptions: Apollo.QueryHookOptions<ProjectInvitesQuery, ProjectInvitesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ProjectInvitesQuery, ProjectInvitesQueryVariables>(ProjectInvitesDocument, options);
      }
export function useProjectInvitesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ProjectInvitesQuery, ProjectInvitesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ProjectInvitesQuery, ProjectInvitesQueryVariables>(ProjectInvitesDocument, options);
        }
export type ProjectInvitesQueryHookResult = ReturnType<typeof useProjectInvitesQuery>;
export type ProjectInvitesLazyQueryHookResult = ReturnType<typeof useProjectInvitesLazyQuery>;
export type ProjectInvitesQueryResult = Apollo.QueryResult<ProjectInvitesQuery, ProjectInvitesQueryVariables>;
export const InviteEditorModalQueryDocument = /*#__PURE__*/ gql`
    query InviteEditorModalQuery($inviteId: Int!, $slug: String!) {
  projectBySlug(slug: $slug) {
    id
    groups {
      id
      name
    }
  }
  projectInvite(id: $inviteId) {
    id
    makeAdmin
    email
    fullname
    status
    groups {
      id
      name
    }
    wasUsed
    inviteEmails {
      ...InviteEmailDetails
    }
  }
}
    ${InviteEmailDetailsFragmentDoc}`;
export function useInviteEditorModalQueryQuery(baseOptions: Apollo.QueryHookOptions<InviteEditorModalQueryQuery, InviteEditorModalQueryQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<InviteEditorModalQueryQuery, InviteEditorModalQueryQueryVariables>(InviteEditorModalQueryDocument, options);
      }
export function useInviteEditorModalQueryLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<InviteEditorModalQueryQuery, InviteEditorModalQueryQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<InviteEditorModalQueryQuery, InviteEditorModalQueryQueryVariables>(InviteEditorModalQueryDocument, options);
        }
export type InviteEditorModalQueryQueryHookResult = ReturnType<typeof useInviteEditorModalQueryQuery>;
export type InviteEditorModalQueryLazyQueryHookResult = ReturnType<typeof useInviteEditorModalQueryLazyQuery>;
export type InviteEditorModalQueryQueryResult = Apollo.QueryResult<InviteEditorModalQueryQuery, InviteEditorModalQueryQueryVariables>;
export const UpdateProjectInviteDocument = /*#__PURE__*/ gql`
    mutation UpdateProjectInvite($id: Int!, $makeAdmin: Boolean!, $email: String!, $fullname: String, $groups: [Int]!) {
  updateProjectInvite(
    input: {inviteId: $id, makeAdmin: $makeAdmin, email: $email, groups: $groups, fullname: $fullname}
  ) {
    projectInvite {
      id
      makeAdmin
      groups {
        id
        name
      }
      email
      fullname
      inviteEmails {
        ...InviteEmailDetails
      }
    }
  }
}
    ${InviteEmailDetailsFragmentDoc}`;
export type UpdateProjectInviteMutationFn = Apollo.MutationFunction<UpdateProjectInviteMutation, UpdateProjectInviteMutationVariables>;
export function useUpdateProjectInviteMutation(baseOptions?: Apollo.MutationHookOptions<UpdateProjectInviteMutation, UpdateProjectInviteMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateProjectInviteMutation, UpdateProjectInviteMutationVariables>(UpdateProjectInviteDocument, options);
      }
export type UpdateProjectInviteMutationHookResult = ReturnType<typeof useUpdateProjectInviteMutation>;
export type UpdateProjectInviteMutationResult = Apollo.MutationResult<UpdateProjectInviteMutation>;
export type UpdateProjectInviteMutationOptions = Apollo.BaseMutationOptions<UpdateProjectInviteMutation, UpdateProjectInviteMutationVariables>;
export const DeleteProjectInviteDocument = /*#__PURE__*/ gql`
    mutation DeleteProjectInvite($id: Int!) {
  deleteProjectInvite(input: {id: $id}) {
    projectInvite {
      id
    }
  }
}
    `;
export type DeleteProjectInviteMutationFn = Apollo.MutationFunction<DeleteProjectInviteMutation, DeleteProjectInviteMutationVariables>;
export function useDeleteProjectInviteMutation(baseOptions?: Apollo.MutationHookOptions<DeleteProjectInviteMutation, DeleteProjectInviteMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteProjectInviteMutation, DeleteProjectInviteMutationVariables>(DeleteProjectInviteDocument, options);
      }
export type DeleteProjectInviteMutationHookResult = ReturnType<typeof useDeleteProjectInviteMutation>;
export type DeleteProjectInviteMutationResult = Apollo.MutationResult<DeleteProjectInviteMutation>;
export type DeleteProjectInviteMutationOptions = Apollo.BaseMutationOptions<DeleteProjectInviteMutation, DeleteProjectInviteMutationVariables>;
export const SendInviteDocument = /*#__PURE__*/ gql`
    mutation SendInvite($id: Int!) {
  sendProjectInvites(input: {inviteIds: [$id]}) {
    inviteEmails {
      ...InviteEmailDetails
      projectInvite {
        id
        status
      }
    }
  }
}
    ${InviteEmailDetailsFragmentDoc}`;
export type SendInviteMutationFn = Apollo.MutationFunction<SendInviteMutation, SendInviteMutationVariables>;
export function useSendInviteMutation(baseOptions?: Apollo.MutationHookOptions<SendInviteMutation, SendInviteMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<SendInviteMutation, SendInviteMutationVariables>(SendInviteDocument, options);
      }
export type SendInviteMutationHookResult = ReturnType<typeof useSendInviteMutation>;
export type SendInviteMutationResult = Apollo.MutationResult<SendInviteMutation>;
export type SendInviteMutationOptions = Apollo.BaseMutationOptions<SendInviteMutation, SendInviteMutationVariables>;
export const RenameGroupDocument = /*#__PURE__*/ gql`
    mutation RenameGroup($id: Int!, $name: String!) {
  updateGroup(input: {id: $id, patch: {name: $name}}) {
    group {
      id
      name
    }
  }
}
    `;
export type RenameGroupMutationFn = Apollo.MutationFunction<RenameGroupMutation, RenameGroupMutationVariables>;
export function useRenameGroupMutation(baseOptions?: Apollo.MutationHookOptions<RenameGroupMutation, RenameGroupMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RenameGroupMutation, RenameGroupMutationVariables>(RenameGroupDocument, options);
      }
export type RenameGroupMutationHookResult = ReturnType<typeof useRenameGroupMutation>;
export type RenameGroupMutationResult = Apollo.MutationResult<RenameGroupMutation>;
export type RenameGroupMutationOptions = Apollo.BaseMutationOptions<RenameGroupMutation, RenameGroupMutationVariables>;
export const SendInvitesDocument = /*#__PURE__*/ gql`
    mutation SendInvites($ids: [Int]!) {
  sendProjectInvites(input: {inviteIds: $ids}) {
    inviteEmails {
      ...InviteEmailDetails
      projectInviteId
      projectInvite {
        id
        status
      }
    }
  }
}
    ${InviteEmailDetailsFragmentDoc}`;
export type SendInvitesMutationFn = Apollo.MutationFunction<SendInvitesMutation, SendInvitesMutationVariables>;
export function useSendInvitesMutation(baseOptions?: Apollo.MutationHookOptions<SendInvitesMutation, SendInvitesMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<SendInvitesMutation, SendInvitesMutationVariables>(SendInvitesDocument, options);
      }
export type SendInvitesMutationHookResult = ReturnType<typeof useSendInvitesMutation>;
export type SendInvitesMutationResult = Apollo.MutationResult<SendInvitesMutation>;
export type SendInvitesMutationOptions = Apollo.BaseMutationOptions<SendInvitesMutation, SendInvitesMutationVariables>;
export const ProjectInviteEmailStatusSubscriptionDocument = /*#__PURE__*/ gql`
    subscription ProjectInviteEmailStatusSubscription {
  projectInviteStateUpdated {
    invite {
      opaqueId: id
      status
    }
  }
}
    `;
export function useProjectInviteEmailStatusSubscriptionSubscription(baseOptions?: Apollo.SubscriptionHookOptions<ProjectInviteEmailStatusSubscriptionSubscription, ProjectInviteEmailStatusSubscriptionSubscriptionVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<ProjectInviteEmailStatusSubscriptionSubscription, ProjectInviteEmailStatusSubscriptionSubscriptionVariables>(ProjectInviteEmailStatusSubscriptionDocument, options);
      }
export type ProjectInviteEmailStatusSubscriptionSubscriptionHookResult = ReturnType<typeof useProjectInviteEmailStatusSubscriptionSubscription>;
export type ProjectInviteEmailStatusSubscriptionSubscriptionResult = Apollo.SubscriptionResult<ProjectInviteEmailStatusSubscriptionSubscription>;
export const UpdateProfileDocument = /*#__PURE__*/ gql`
    mutation UpdateProfile($userId: Int!, $affiliations: String, $email: Email, $fullname: String, $nickname: String, $picture: Upload) {
  updateProfileByUserId(
    input: {userId: $userId, patch: {affiliations: $affiliations, email: $email, fullname: $fullname, nickname: $nickname, picture: $picture}}
  ) {
    profile {
      userId
      user {
        id
        profile {
          picture
        }
      }
    }
  }
}
    `;
export type UpdateProfileMutationFn = Apollo.MutationFunction<UpdateProfileMutation, UpdateProfileMutationVariables>;
export function useUpdateProfileMutation(baseOptions?: Apollo.MutationHookOptions<UpdateProfileMutation, UpdateProfileMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateProfileMutation, UpdateProfileMutationVariables>(UpdateProfileDocument, options);
      }
export type UpdateProfileMutationHookResult = ReturnType<typeof useUpdateProfileMutation>;
export type UpdateProfileMutationResult = Apollo.MutationResult<UpdateProfileMutation>;
export type UpdateProfileMutationOptions = Apollo.BaseMutationOptions<UpdateProfileMutation, UpdateProfileMutationVariables>;
export const UserIsSuperuserDocument = /*#__PURE__*/ gql`
    query UserIsSuperuser {
  currentUserIsSuperuser
}
    `;
export function useUserIsSuperuserQuery(baseOptions?: Apollo.QueryHookOptions<UserIsSuperuserQuery, UserIsSuperuserQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<UserIsSuperuserQuery, UserIsSuperuserQueryVariables>(UserIsSuperuserDocument, options);
      }
export function useUserIsSuperuserLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<UserIsSuperuserQuery, UserIsSuperuserQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<UserIsSuperuserQuery, UserIsSuperuserQueryVariables>(UserIsSuperuserDocument, options);
        }
export type UserIsSuperuserQueryHookResult = ReturnType<typeof useUserIsSuperuserQuery>;
export type UserIsSuperuserLazyQueryHookResult = ReturnType<typeof useUserIsSuperuserLazyQuery>;
export type UserIsSuperuserQueryResult = Apollo.QueryResult<UserIsSuperuserQuery, UserIsSuperuserQueryVariables>;
export const namedOperations = {
  Query: {
    ProjectBucketSetting: 'ProjectBucketSetting',
    MapboxAPIKeys: 'MapboxAPIKeys',
    GetAcl: 'GetAcl',
    Groups: 'Groups',
    VerifyProjectInvite: 'VerifyProjectInvite',
    GetBasemaps: 'GetBasemaps',
    GetBasemap: 'GetBasemap',
    OptionalLayer: 'OptionalLayer',
    GetOptionalBasemapLayer: 'GetOptionalBasemapLayer',
    GetOptionalBasemapLayerMetadata: 'GetOptionalBasemapLayerMetadata',
    MapboxKeys: 'MapboxKeys',
    DraftTableOfContents: 'DraftTableOfContents',
    layersAndSourcesForItems: 'layersAndSourcesForItems',
    GetFolder: 'GetFolder',
    GetLayerItem: 'GetLayerItem',
    InteractivitySettingsForLayer: 'InteractivitySettingsForLayer',
    DataSourceUrlProperties: 'DataSourceUrlProperties',
    GetMetadata: 'GetMetadata',
    ProjectHostingQuota: 'ProjectHostingQuota',
    InteractivitySettingsById: 'InteractivitySettingsById',
    GetBasemapsAndRegion: 'GetBasemapsAndRegion',
    OfflineSurveys: 'OfflineSurveys',
    ProjectAccessControlSettings: 'ProjectAccessControlSettings',
    ProjectMetadata: 'ProjectMetadata',
    Me: 'Me',
    ProjectRegion: 'ProjectRegion',
    GetProjectBySlug: 'GetProjectBySlug',
    ProjectSlugExists: 'ProjectSlugExists',
    PublishedTableOfContents: 'PublishedTableOfContents',
    SimpleProjectList: 'SimpleProjectList',
    Surveys: 'Surveys',
    SurveyById: 'SurveyById',
    SurveyFormEditorDetails: 'SurveyFormEditorDetails',
    FormElementTypes: 'FormElementTypes',
    GetPhotos: 'GetPhotos',
    SurveyResponses: 'SurveyResponses',
    SurveyMapDetails: 'SurveyMapDetails',
    AllBasemaps: 'AllBasemaps',
    GetFormElement: 'GetFormElement',
    Survey: 'Survey',
    UserAdminCounts: 'UserAdminCounts',
    Participants: 'Participants',
    Admins: 'Admins',
    GroupMembers: 'GroupMembers',
    UserSettingsLists: 'UserSettingsLists',
    UserInfo: 'UserInfo',
    ProjectInvites: 'ProjectInvites',
    InviteEditorModalQuery: 'InviteEditorModalQuery',
    UserIsSuperuser: 'UserIsSuperuser'
  },
  Mutation: {
    UpdateProjectStorageBucket: 'UpdateProjectStorageBucket',
    updatePublicKey: 'updatePublicKey',
    updateSecretKey: 'updateSecretKey',
    UpdateAclType: 'UpdateAclType',
    AddGroupToAcl: 'AddGroupToAcl',
    RemoveGroupFromAcl: 'RemoveGroupFromAcl',
    CreateTableOfContentsItem: 'CreateTableOfContentsItem',
    CreateArcGISDynamicDataSource: 'CreateArcGISDynamicDataSource',
    CreateArcGISImageSource: 'CreateArcGISImageSource',
    CreateSeaSketchVectorSource: 'CreateSeaSketchVectorSource',
    CreateDataLayer: 'CreateDataLayer',
    GetOrCreateSprite: 'GetOrCreateSprite',
    AddImageToSprite: 'AddImageToSprite',
    ConfirmProjectInvite: 'ConfirmProjectInvite',
    ResendEmailVerification: 'ResendEmailVerification',
    RequestInviteOnlyProjectAccess: 'RequestInviteOnlyProjectAccess',
    CreateBasemap: 'CreateBasemap',
    UploadBasemap: 'UploadBasemap',
    UpdateBasemap: 'UpdateBasemap',
    UpdateBasemapUrl: 'UpdateBasemapUrl',
    UpdateBasemapLabelsLayer: 'UpdateBasemapLabelsLayer',
    Toggle3dTerrain: 'Toggle3dTerrain',
    Set3dTerrain: 'Set3dTerrain',
    UpdateTerrainExaggeration: 'UpdateTerrainExaggeration',
    DeleteBasemap: 'DeleteBasemap',
    UpdateOptionalLayerName: 'UpdateOptionalLayerName',
    CreateOptionalLayer: 'CreateOptionalLayer',
    UpdateOptionalLayer: 'UpdateOptionalLayer',
    DeleteOptionalLayer: 'DeleteOptionalLayer',
    UpdateOptionalBasemapLayerLayerList: 'UpdateOptionalBasemapLayerLayerList',
    UpdateOptionalBasemapLayerOptions: 'UpdateOptionalBasemapLayerOptions',
    UpdateOptionalBasemapLayerMetadata: 'UpdateOptionalBasemapLayerMetadata',
    UpdateInteractivitySettingsLayers: 'UpdateInteractivitySettingsLayers',
    CreateProject: 'CreateProject',
    CreateFolder: 'CreateFolder',
    DeleteBranch: 'DeleteBranch',
    UpdateTableOfContentsItemChildren: 'UpdateTableOfContentsItemChildren',
    UpdateFolder: 'UpdateFolder',
    UpdateTableOfContentsItem: 'UpdateTableOfContentsItem',
    UpdateEnableDownload: 'UpdateEnableDownload',
    UpdateLayer: 'UpdateLayer',
    UpdateDataSource: 'UpdateDataSource',
    UpdateInteractivitySettings: 'UpdateInteractivitySettings',
    UpdateZIndexes: 'UpdateZIndexes',
    UpdateRenderUnderType: 'UpdateRenderUnderType',
    UpdateQueryParameters: 'UpdateQueryParameters',
    UpdateEnableHighDPIRequests: 'UpdateEnableHighDPIRequests',
    UpdateMetadata: 'UpdateMetadata',
    PublishTableOfContents: 'PublishTableOfContents',
    updateProjectAccessControlSettings: 'updateProjectAccessControlSettings',
    UpdateProjectRegion: 'UpdateProjectRegion',
    CreateSurvey: 'CreateSurvey',
    UpdateSurveyBaseSettings: 'UpdateSurveyBaseSettings',
    UpdateFormElementSketchClass: 'UpdateFormElementSketchClass',
    UpdateFormElement: 'UpdateFormElement',
    UpdateComponentSettings: 'UpdateComponentSettings',
    UpdateAlternateLanguageSettings: 'UpdateAlternateLanguageSettings',
    UpdateFormElementBody: 'UpdateFormElementBody',
    UpdateFormElementOrder: 'UpdateFormElementOrder',
    AddFormElement: 'AddFormElement',
    DeleteFormElement: 'DeleteFormElement',
    UpdateForm: 'UpdateForm',
    UpdateFormElementBackground: 'UpdateFormElementBackground',
    SetFormElementBackground: 'SetFormElementBackground',
    clearFormElementStyle: 'clearFormElementStyle',
    createLogicRuleForSurvey: 'createLogicRuleForSurvey',
    UpdateFormLogicRule: 'UpdateFormLogicRule',
    UpdateLogicCondition: 'UpdateLogicCondition',
    DeleteLogicCondition: 'DeleteLogicCondition',
    DeleteLogicRule: 'DeleteLogicRule',
    AddCondition: 'AddCondition',
    UpdateSurveyDraftStatus: 'UpdateSurveyDraftStatus',
    UploadConsentDoc: 'UploadConsentDoc',
    toggleResponsesPractice: 'toggleResponsesPractice',
    archiveResponses: 'archiveResponses',
    modifyAnswers: 'modifyAnswers',
    copyAppearance: 'copyAppearance',
    updateFormElementBasemaps: 'updateFormElementBasemaps',
    updateFormElementMapCamera: 'updateFormElementMapCamera',
    CreateResponse: 'CreateResponse',
    UpdateProjectName: 'UpdateProjectName',
    UpdateProjectSettings: 'UpdateProjectSettings',
    CreateGroup: 'CreateGroup',
    toggleAdminAccess: 'toggleAdminAccess',
    setUserGroups: 'setUserGroups',
    toggleForumPostingBan: 'toggleForumPostingBan',
    deleteGroup: 'deleteGroup',
    createProjectInvites: 'createProjectInvites',
    UpdateProjectInvite: 'UpdateProjectInvite',
    DeleteProjectInvite: 'DeleteProjectInvite',
    SendInvite: 'SendInvite',
    RenameGroup: 'RenameGroup',
    SendInvites: 'SendInvites',
    UpdateProfile: 'UpdateProfile'
  },
  Subscription: {
    ProjectInviteEmailStatusSubscription: 'ProjectInviteEmailStatusSubscription'
  },
  Fragment: {
    LogicRuleEditorFormElement: 'LogicRuleEditorFormElement',
    LogicRuleEditorRule: 'LogicRuleEditorRule',
    BasemapDetails: 'BasemapDetails',
    MapEssentials: 'MapEssentials',
    ProjectMetadata: 'ProjectMetadata',
    ProjectPublicDetailsMetadata: 'ProjectPublicDetailsMetadata',
    ProjectMetadataMeFrag: 'ProjectMetadataMeFrag',
    SurveyListDetails: 'SurveyListDetails',
    AddFormElementTypeDetails: 'AddFormElementTypeDetails',
    FormElementDetails: 'FormElementDetails',
    SketchClassDetails: 'SketchClassDetails',
    FormElementFullDetails: 'FormElementFullDetails',
    LogicRuleDetails: 'LogicRuleDetails',
    SurveyResponse: 'SurveyResponse',
    FormElementExtendedDetails: 'FormElementExtendedDetails',
    SurveyAppRule: 'SurveyAppRule',
    SurveyAppFormElement: 'SurveyAppFormElement',
    SurveyAppSurvey: 'SurveyAppSurvey',
    ParticipantListDetails: 'ParticipantListDetails',
    UserListDetails: 'UserListDetails',
    InviteDetails: 'InviteDetails',
    InviteEmailDetails: 'InviteEmailDetails'
  }
}