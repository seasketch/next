import { gql } from '@apollo/client';
export type Maybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
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
  /** The day, does not include a time. */
  Date: any;
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

/** All input for the `alternateLanguageLabelsForFormElement` mutation. */
export type AlternateLanguageLabelsForFormElementInput = {
  alternateLanguageSettings?: Maybe<Scalars['JSON']>;
  attrId?: Maybe<Scalars['Int']>;
  attrValue?: Maybe<Scalars['JSON']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
};

/** The output of our `alternateLanguageLabelsForFormElement` mutation. */
export type AlternateLanguageLabelsForFormElementPayload = {
  __typename?: 'AlternateLanguageLabelsForFormElementPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  json?: Maybe<Scalars['JSON']>;
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
  user?: Maybe<User>;
  /** An edge for our `User`. May be used by Relay 1. */
  userEdge?: Maybe<UsersEdge>;
};


/** The output of our `approveParticipant` mutation. */
export type ApproveParticipantPayloadUserEdgeArgs = {
  orderBy?: Maybe<Array<UsersOrderBy>>;
};

export enum ArcgisFeatureLayerFetchStrategy {
  Auto = 'AUTO',
  Raw = 'RAW',
  Tiled = 'TILED'
}

/** An input for mutations affecting `ArcgisImportItem` */
export type ArcgisImportItemInput = {
  id?: Maybe<Scalars['Int']>;
  isFolder?: Maybe<Scalars['Boolean']>;
  parentId?: Maybe<Scalars['String']>;
  sourceId?: Maybe<Scalars['Int']>;
  stableId?: Maybe<Scalars['String']>;
  sublayerId?: Maybe<Scalars['Int']>;
  title?: Maybe<Scalars['String']>;
};

/** An input for mutations affecting `ArcgisImportSource` */
export type ArcgisImportSourceInput = {
  fetchStrategy?: Maybe<ArcgisFeatureLayerFetchStrategy>;
  id?: Maybe<Scalars['Int']>;
  type?: Maybe<ArcgisSourceType>;
  url?: Maybe<Scalars['String']>;
};

export enum ArcgisSourceType {
  ArcgisDynamicMapserver = 'ARCGIS_DYNAMIC_MAPSERVER',
  ArcgisRasterTiles = 'ARCGIS_RASTER_TILES',
  ArcgisVector = 'ARCGIS_VECTOR'
}

/** All input for the `archiveResponses` mutation. */
export type ArchiveResponsesInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  ids?: Maybe<Array<Maybe<Scalars['Int']>>>;
  makeArchived?: Maybe<Scalars['Boolean']>;
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
  isArcgisTiledMapservice: Scalars['Boolean'];
  /**
   * Used to indicate whether the basemap is included in the public basemap
   * listing. Useful for hiding an option temporarily, or adding a basemap to the
   * project which will only be used in surveys.
   */
  isDisabled: Scalars['Boolean'];
  /** Identify the labels layer lowest in the stack so that overlay layers may be placed underneath. */
  labelsLayerId?: Maybe<Scalars['String']>;
  /** Reads and enables pagination through a set of `MapBookmark`. */
  mapBookmarksBySelectedBasemapConnection: MapBookmarksConnection;
  maxzoom?: Maybe<Scalars['Int']>;
  /** Label shown in the basemap picker interface */
  name: Scalars['String'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** Only available on supported projects by authorized users */
  offlineSupportInformation?: Maybe<OfflineSupportInformation>;
  /** Reads and enables pagination through a set of `OfflineTileSetting`. */
  offlineTileSettings: Array<OfflineTileSetting>;
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
  translatedProps: Scalars['JSON'];
  type: BasemapType;
  /**
   * For MAPBOX types, this can be a mapbox://-style url or a link to a custom
   * mapbox gl style. For RASTER_URL_TEMPLATE, it should be a url template
   * conforming to the [raster source documetation](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#tiled-sources)
   */
  url: Scalars['String'];
  useDefaultOfflineTileSettings: Scalars['Boolean'];
};


export type BasemapMapBookmarksBySelectedBasemapConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<MapBookmarkCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<MapBookmarksOrderBy>>;
};


export type BasemapOfflineTileSettingsArgs = {
  condition?: Maybe<OfflineTileSettingCondition>;
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<OfflineTileSettingsOrderBy>>;
};


export type BasemapOptionalBasemapLayersArgs = {
  condition?: Maybe<OptionalBasemapLayerCondition>;
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<OptionalBasemapLayersOrderBy>>;
};


export type BasemapProjectsSharedBasemapsConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<ProjectsSharedBasemapCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<ProjectsSharedBasemapsOrderBy>>;
};


export type BasemapRelatedFormElementsArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};

/** A condition to be used against `Basemap` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type BasemapCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `interactivitySettingsId` field. */
  interactivitySettingsId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `projectId` field. */
  projectId?: Maybe<Scalars['Int']>;
};

/** An input for mutations affecting `Basemap` */
export type BasemapInput = {
  /**
   * Optional attribution to show at the bottom of the map. Will be overriden by
   * the attribution specified in the gl-style in the case of MAPBOX types.
   */
  attribution?: Maybe<Scalars['String']>;
  description?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['Int']>;
  isArcgisTiledMapservice?: Maybe<Scalars['Boolean']>;
  /**
   * Used to indicate whether the basemap is included in the public basemap
   * listing. Useful for hiding an option temporarily, or adding a basemap to the
   * project which will only be used in surveys.
   */
  isDisabled?: Maybe<Scalars['Boolean']>;
  /** Identify the labels layer lowest in the stack so that overlay layers may be placed underneath. */
  labelsLayerId?: Maybe<Scalars['String']>;
  maxzoom?: Maybe<Scalars['Int']>;
  /** Label shown in the basemap picker interface */
  name: Scalars['String'];
  /**
   * If not set, the basemap will be considered a "Shared Basemap" that can be
   * added to any project. Otherwise it is private to the given proejct. Only
   * superusers can create Shared Basemaps.
   */
  projectId?: Maybe<Scalars['Int']>;
  surveysOnly?: Maybe<Scalars['Boolean']>;
  terrainExaggeration?: Maybe<Scalars['BigFloat']>;
  terrainMaxZoom?: Maybe<Scalars['Int']>;
  /** If set to false, terrain will always be on. Otherwise the user will be given a toggle switch. */
  terrainOptional?: Maybe<Scalars['Boolean']>;
  terrainTileSize?: Maybe<Scalars['Int']>;
  /**
   * Terrain data source url. Leave blank to disable 3d terrain. See [mapbox gl style terrain
   * documentation](https://docs.mapbox.com/mapbox-gl-js/style-spec/terrain/).
   */
  terrainUrl?: Maybe<Scalars['String']>;
  terrainVisibilityDefault?: Maybe<Scalars['Boolean']>;
  /** Square thumbnail will be used to identify the basemap */
  thumbnail?: Maybe<Scalars['Upload']>;
  /** For use with RASTER_URL_TEMPLATE types. See the [raster source documetation](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#tiled-sources) */
  tileSize?: Maybe<Scalars['Int']>;
  translatedProps?: Maybe<Scalars['JSON']>;
  type: BasemapType;
  /**
   * For MAPBOX types, this can be a mapbox://-style url or a link to a custom
   * mapbox gl style. For RASTER_URL_TEMPLATE, it should be a url template
   * conforming to the [raster source documetation](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#tiled-sources)
   */
  url: Scalars['String'];
  useDefaultOfflineTileSettings?: Maybe<Scalars['Boolean']>;
};

/** Represents an update to a `Basemap`. Fields that are set will be updated. */
export type BasemapPatch = {
  /**
   * Optional attribution to show at the bottom of the map. Will be overriden by
   * the attribution specified in the gl-style in the case of MAPBOX types.
   */
  attribution?: Maybe<Scalars['String']>;
  description?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['Int']>;
  interactivitySettingsId?: Maybe<Scalars['Int']>;
  isArcgisTiledMapservice?: Maybe<Scalars['Boolean']>;
  /**
   * Used to indicate whether the basemap is included in the public basemap
   * listing. Useful for hiding an option temporarily, or adding a basemap to the
   * project which will only be used in surveys.
   */
  isDisabled?: Maybe<Scalars['Boolean']>;
  /** Identify the labels layer lowest in the stack so that overlay layers may be placed underneath. */
  labelsLayerId?: Maybe<Scalars['String']>;
  maxzoom?: Maybe<Scalars['Int']>;
  /** Label shown in the basemap picker interface */
  name?: Maybe<Scalars['String']>;
  /**
   * If not set, the basemap will be considered a "Shared Basemap" that can be
   * added to any project. Otherwise it is private to the given proejct. Only
   * superusers can create Shared Basemaps.
   */
  projectId?: Maybe<Scalars['Int']>;
  surveysOnly?: Maybe<Scalars['Boolean']>;
  terrainExaggeration?: Maybe<Scalars['BigFloat']>;
  terrainMaxZoom?: Maybe<Scalars['Int']>;
  /** If set to false, terrain will always be on. Otherwise the user will be given a toggle switch. */
  terrainOptional?: Maybe<Scalars['Boolean']>;
  terrainTileSize?: Maybe<Scalars['Int']>;
  /**
   * Terrain data source url. Leave blank to disable 3d terrain. See [mapbox gl style terrain
   * documentation](https://docs.mapbox.com/mapbox-gl-js/style-spec/terrain/).
   */
  terrainUrl?: Maybe<Scalars['String']>;
  terrainVisibilityDefault?: Maybe<Scalars['Boolean']>;
  /** Square thumbnail will be used to identify the basemap */
  thumbnail?: Maybe<Scalars['Upload']>;
  /** For use with RASTER_URL_TEMPLATE types. See the [raster source documetation](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#tiled-sources) */
  tileSize?: Maybe<Scalars['Int']>;
  translatedProps?: Maybe<Scalars['JSON']>;
  type?: Maybe<BasemapType>;
  /**
   * For MAPBOX types, this can be a mapbox://-style url or a link to a custom
   * mapbox gl style. For RASTER_URL_TEMPLATE, it should be a url template
   * conforming to the [raster source documetation](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#tiled-sources)
   */
  url?: Maybe<Scalars['String']>;
  useDefaultOfflineTileSettings?: Maybe<Scalars['Boolean']>;
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



export type BookmarkPayload = {
  __typename?: 'BookmarkPayload';
  bookmark?: Maybe<MapBookmark>;
  bookmarkId: Scalars['UUID'];
};

export type CacheableOfflineAsset = {
  __typename?: 'CacheableOfflineAsset';
  /**
   * If provided, is a "bare" url with query strings such as access_token
   * stripped out.
   */
  cacheKey?: Maybe<Scalars['String']>;
  type: CacheableOfflineAssetType;
  url: Scalars['String'];
};

export enum CacheableOfflineAssetType {
  Font = 'FONT',
  Image = 'IMAGE',
  Json = 'JSON',
  MapboxGlStyle = 'MAPBOX_GL_STYLE',
  Sprite = 'SPRITE'
}

/** All input for the `cancelDataUpload` mutation. */
export type CancelDataUploadInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
  uploadId?: Maybe<Scalars['UUID']>;
};

/** The output of our `cancelDataUpload` mutation. */
export type CancelDataUploadPayload = {
  __typename?: 'CancelDataUploadPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `clearFormElementStyle` mutation. */
export type ClearFormElementStyleInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  formElementId?: Maybe<Scalars['Int']>;
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
  orderBy?: Maybe<Array<FormElementsOrderBy>>;
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

/** All input for the `copyAppearance` mutation. */
export type CopyAppearanceInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  copyFromId?: Maybe<Scalars['Int']>;
  formElementId?: Maybe<Scalars['Int']>;
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
  orderBy?: Maybe<Array<FormElementsOrderBy>>;
};

/** All input for the `copySketchFolder` mutation. */
export type CopySketchFolderInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  folderId?: Maybe<Scalars['Int']>;
};

/** The output of our `copySketchFolder` mutation. */
export type CopySketchFolderPayload = {
  __typename?: 'CopySketchFolderPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  sketchFolder?: Maybe<SketchFolder>;
  /** An edge for our `SketchFolder`. May be used by Relay 1. */
  sketchFolderEdge?: Maybe<SketchFoldersEdge>;
};


/** The output of our `copySketchFolder` mutation. */
export type CopySketchFolderPayloadSketchFolderEdgeArgs = {
  orderBy?: Maybe<Array<SketchFoldersOrderBy>>;
};

/** All input for the `copySketch` mutation. */
export type CopySketchInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  sketchId?: Maybe<Scalars['Int']>;
};

/** The output of our `copySketch` mutation. */
export type CopySketchPayload = {
  __typename?: 'CopySketchPayload';
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
  sketch?: Maybe<Sketch>;
  /** Reads a single `SketchClass` that is related to this `Sketch`. */
  sketchClass?: Maybe<SketchClass>;
  /** Reads a single `User` that is related to this `Sketch`. */
  user?: Maybe<User>;
};

export type CopySketchTocItemResults = {
  __typename?: 'CopySketchTocItemResults';
  folders?: Maybe<Array<SketchFolder>>;
  parentId: Scalars['Int'];
  sketches?: Maybe<Array<Sketch>>;
  /** Returns the parent collection (if exists) so that the client can select an updated updatedAt */
  updatedCollection?: Maybe<Sketch>;
};

/** All input for the create `Basemap` mutation. */
export type CreateBasemapInput = {
  /** The `Basemap` to be created by this mutation. */
  basemap: BasemapInput;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<BasemapsOrderBy>>;
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

/** All input for the create `DataLayer` mutation. */
export type CreateDataLayerInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<DataLayersOrderBy>>;
};

/** All input for the create `DataSource` mutation. */
export type CreateDataSourceInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<DataSourcesOrderBy>>;
};

/** All input for the `createDataUpload` mutation. */
export type CreateDataUploadInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  contentType?: Maybe<Scalars['String']>;
  filename?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
};

/** The output of our `createDataUpload` mutation. */
export type CreateDataUploadPayload = {
  __typename?: 'CreateDataUploadPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  dataUploadTask?: Maybe<DataUploadTask>;
  /** An edge for our `DataUploadTask`. May be used by Relay 1. */
  dataUploadTaskEdge?: Maybe<DataUploadTasksEdge>;
  /** Reads a single `Project` that is related to this `DataUploadTask`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `createDataUpload` mutation. */
export type CreateDataUploadPayloadDataUploadTaskEdgeArgs = {
  orderBy?: Maybe<Array<DataUploadTasksOrderBy>>;
};

/** All input for the create `FormElement` mutation. */
export type CreateFormElementInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<FormElementsOrderBy>>;
};

/** All input for the create `FormLogicCondition` mutation. */
export type CreateFormLogicConditionInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<FormLogicConditionsOrderBy>>;
};

/** All input for the create `FormLogicRule` mutation. */
export type CreateFormLogicRuleInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<FormLogicRulesOrderBy>>;
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

/** All input for the create `InteractivitySetting` mutation. */
export type CreateInteractivitySettingInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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

/** All input for the `createMapBookmark` mutation. */
export type CreateMapBookmarkInput = {
  basemapName?: Maybe<Scalars['String']>;
  basemapOptionalLayerStates?: Maybe<Scalars['JSON']>;
  cameraOptions?: Maybe<Scalars['JSON']>;
  clientGeneratedThumbnail?: Maybe<Scalars['String']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  isPublic?: Maybe<Scalars['Boolean']>;
  layerNames?: Maybe<Scalars['JSON']>;
  mapDimensions?: Maybe<Array<Maybe<Scalars['Int']>>>;
  selectedBasemap?: Maybe<Scalars['Int']>;
  sidebarState?: Maybe<Scalars['JSON']>;
  sketchNames?: Maybe<Scalars['JSON']>;
  slug?: Maybe<Scalars['String']>;
  style?: Maybe<Scalars['JSON']>;
  visibleDataLayers?: Maybe<Array<Maybe<Scalars['String']>>>;
  visibleSketches?: Maybe<Array<Maybe<Scalars['Int']>>>;
};

/** The output of our `createMapBookmark` mutation. */
export type CreateMapBookmarkPayload = {
  __typename?: 'CreateMapBookmarkPayload';
  /** Reads a single `Basemap` that is related to this `MapBookmark`. */
  basemapBySelectedBasemap?: Maybe<Basemap>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  mapBookmark?: Maybe<MapBookmark>;
  /** An edge for our `MapBookmark`. May be used by Relay 1. */
  mapBookmarkEdge?: Maybe<MapBookmarksEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `createMapBookmark` mutation. */
export type CreateMapBookmarkPayloadMapBookmarkEdgeArgs = {
  orderBy?: Maybe<Array<MapBookmarksOrderBy>>;
};

/** All input for the create `OfflineTileSetting` mutation. */
export type CreateOfflineTileSettingInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `OfflineTileSetting` to be created by this mutation. */
  offlineTileSetting: OfflineTileSettingInput;
};

/** The output of our create `OfflineTileSetting` mutation. */
export type CreateOfflineTileSettingPayload = {
  __typename?: 'CreateOfflineTileSettingPayload';
  /** Reads a single `Basemap` that is related to this `OfflineTileSetting`. */
  basemap?: Maybe<Basemap>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `OfflineTileSetting` that was created by this mutation. */
  offlineTileSetting?: Maybe<OfflineTileSetting>;
  /** Reads a single `Project` that is related to this `OfflineTileSetting`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the create `OptionalBasemapLayer` mutation. */
export type CreateOptionalBasemapLayerInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<ProjectInviteGroupsOrderBy>>;
};

/** All input for the `createProjectInvites` mutation. */
export type CreateProjectInvitesInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  groupNames?: Maybe<Array<Maybe<Scalars['String']>>>;
  makeAdmin?: Maybe<Scalars['Boolean']>;
  projectId?: Maybe<Scalars['Int']>;
  projectInviteOptions?: Maybe<Array<Maybe<ProjectInviteOptionInput>>>;
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
  orderBy?: Maybe<Array<ProjectsOrderBy>>;
};

/** All input for the create `ProjectsSharedBasemap` mutation. */
export type CreateProjectsSharedBasemapInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<ProjectsSharedBasemapsOrderBy>>;
};

/** All input for the `createSketchClassFromTemplate` mutation. */
export type CreateSketchClassFromTemplateInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
  templateSketchClassId?: Maybe<Scalars['Int']>;
};

/** The output of our `createSketchClassFromTemplate` mutation. */
export type CreateSketchClassFromTemplatePayload = {
  __typename?: 'CreateSketchClassFromTemplatePayload';
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


/** The output of our `createSketchClassFromTemplate` mutation. */
export type CreateSketchClassFromTemplatePayloadSketchClassEdgeArgs = {
  orderBy?: Maybe<Array<SketchClassesOrderBy>>;
};

/** All input for the `createSketchFolder` mutation. */
export type CreateSketchFolderInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  collectionId?: Maybe<Scalars['Int']>;
  folderId?: Maybe<Scalars['Int']>;
  name?: Maybe<Scalars['String']>;
  slug?: Maybe<Scalars['String']>;
};

/** The output of our `createSketchFolder` mutation. */
export type CreateSketchFolderPayload = {
  __typename?: 'CreateSketchFolderPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  sketchFolder?: Maybe<SketchFolder>;
  /** An edge for our `SketchFolder`. May be used by Relay 1. */
  sketchFolderEdge?: Maybe<SketchFoldersEdge>;
};


/** The output of our `createSketchFolder` mutation. */
export type CreateSketchFolderPayloadSketchFolderEdgeArgs = {
  orderBy?: Maybe<Array<SketchFoldersOrderBy>>;
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
  surveyInvites?: Maybe<Array<SurveyInvite>>;
};

/** All input for the `createSurveyJumpRule` mutation. */
export type CreateSurveyJumpRuleInput = {
  booleanOperator?: Maybe<FormLogicOperator>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  formElementId?: Maybe<Scalars['Int']>;
  jumpToId?: Maybe<Scalars['Int']>;
  operator?: Maybe<FieldRuleOperator>;
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
  orderBy?: Maybe<Array<FormLogicRulesOrderBy>>;
};

/** All input for the `createSurveyResponse` mutation. */
export type CreateSurveyResponseInput = {
  bypassedSubmissionControl?: Maybe<Scalars['Boolean']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  draft?: Maybe<Scalars['Boolean']>;
  facilitated?: Maybe<Scalars['Boolean']>;
  offlineId?: Maybe<Scalars['UUID']>;
  practice?: Maybe<Scalars['Boolean']>;
  responseData?: Maybe<Scalars['JSON']>;
  surveyId?: Maybe<Scalars['Int']>;
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
  orderBy?: Maybe<Array<SurveyResponsesOrderBy>>;
};

/** All input for the `createSurveyResponseV2` mutation. */
export type CreateSurveyResponseV2Input = {
  bypassedSubmissionControl?: Maybe<Scalars['Boolean']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  draft?: Maybe<Scalars['Boolean']>;
  facilitated?: Maybe<Scalars['Boolean']>;
  offlineId?: Maybe<Scalars['UUID']>;
  practice?: Maybe<Scalars['Boolean']>;
  responseData?: Maybe<Scalars['JSON']>;
  surveyId?: Maybe<Scalars['Int']>;
};

/** The output of our `createSurveyResponseV2` mutation. */
export type CreateSurveyResponseV2Payload = {
  __typename?: 'CreateSurveyResponseV2Payload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  integer?: Maybe<Scalars['Int']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the create `TableOfContentsItem` mutation. */
export type CreateTableOfContentsItemInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<TableOfContentsItemsOrderBy>>;
};

/** All input for the `createVisibilityLogicRule` mutation. */
export type CreateVisibilityLogicRuleInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  formElementId?: Maybe<Scalars['Int']>;
};

/** The output of our `createVisibilityLogicRule` mutation. */
export type CreateVisibilityLogicRulePayload = {
  __typename?: 'CreateVisibilityLogicRulePayload';
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


/** The output of our `createVisibilityLogicRule` mutation. */
export type CreateVisibilityLogicRulePayloadFormLogicRuleEdgeArgs = {
  orderBy?: Maybe<Array<FormLogicRulesOrderBy>>;
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
  /** @deprecated Use TableOfContentsItem.geoprocessingReferenceId instead */
  staticId?: Maybe<Scalars['String']>;
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
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
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
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<TableOfContentsItemCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<TableOfContentsItemsOrderBy>>;
};

/**
 * A condition to be used against `DataLayer` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type DataLayerCondition = {
  /** Checks for equality with the object’s `dataSourceId` field. */
  dataSourceId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `interactivitySettingsId` field. */
  interactivitySettingsId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `projectId` field. */
  projectId?: Maybe<Scalars['Int']>;
};

/** An input for mutations affecting `DataLayer` */
export type DataLayerInput = {
  dataSourceId: Scalars['Int'];
  id?: Maybe<Scalars['Int']>;
  /**
   * JSON array of MapBox GL Style layers. Layers should not specify an id or
   * sourceId. These will be automatically generated at runtime.
   */
  mapboxGlStyles?: Maybe<Scalars['JSON']>;
  projectId: Scalars['Int'];
  /**
   * Determines z-ordering of layer in relation to layers in the basemap. For this
   * functionality to work, layers must be identified in the basemap configuration.
   */
  renderUnder?: Maybe<RenderUnderType>;
  /** For vector tile sources (VECTOR), references the layer inside the vector tiles that this layer applies to. */
  sourceLayer?: Maybe<Scalars['String']>;
  spriteIds?: Maybe<Array<Maybe<Scalars['Int']>>>;
  staticId?: Maybe<Scalars['String']>;
  /**
   * For ARCGIS_MAPSERVER and eventually WMS sources. In this case mapbox_gl_styles
   * is blank and this layer merely controls the display of a single sublayer when
   * making image requests.
   */
  sublayer?: Maybe<Scalars['String']>;
  zIndex?: Maybe<Scalars['Int']>;
};

/** Represents an update to a `DataLayer`. Fields that are set will be updated. */
export type DataLayerPatch = {
  dataSourceId?: Maybe<Scalars['Int']>;
  id?: Maybe<Scalars['Int']>;
  interactivitySettingsId?: Maybe<Scalars['Int']>;
  /**
   * JSON array of MapBox GL Style layers. Layers should not specify an id or
   * sourceId. These will be automatically generated at runtime.
   */
  mapboxGlStyles?: Maybe<Scalars['JSON']>;
  projectId?: Maybe<Scalars['Int']>;
  /**
   * Determines z-ordering of layer in relation to layers in the basemap. For this
   * functionality to work, layers must be identified in the basemap configuration.
   */
  renderUnder?: Maybe<RenderUnderType>;
  /** For vector tile sources (VECTOR), references the layer inside the vector tiles that this layer applies to. */
  sourceLayer?: Maybe<Scalars['String']>;
  spriteIds?: Maybe<Array<Maybe<Scalars['Int']>>>;
  staticId?: Maybe<Scalars['String']>;
  /**
   * For ARCGIS_MAPSERVER and eventually WMS sources. In this case mapbox_gl_styles
   * is blank and this layer merely controls the display of a single sublayer when
   * making image requests.
   */
  sublayer?: Maybe<Scalars['String']>;
  zIndex?: Maybe<Scalars['Int']>;
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
  arcgisFetchStrategy: ArcgisFeatureLayerFetchStrategy;
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
  /**
   * mapbox-geostats summary information for vector sources. Useful for
   * cartographic tools and authoring popups. SEASKETCH_VECTOR sources only.
   */
  geostats?: Maybe<Scalars['JSON']>;
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
  /** Size of the normalized file. SEASKETCH_VECTOR sources only. */
  normalizedSourceBytes?: Maybe<Scalars['Int']>;
  /**
   * Sources are converted to flatgeobuf (vector, 4326) or geotif (raster) and
   * store indefinitely so they may be processed into tilesets and to support the
   * download function. SEASKETCH_VECTOR sources only.
   */
  normalizedSourceObjectKey?: Maybe<Scalars['String']>;
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
  /** For tiled sources, a list of endpoints that can be used to retrieve tiles. */
  tiles?: Maybe<Array<Maybe<Scalars['String']>>>;
  /** The minimum visual size to display tiles for this layer. Only configurable for raster layers. */
  tileSize?: Maybe<Scalars['Int']>;
  /** GeoJSON only. Douglas-Peucker simplification tolerance (higher means simpler geometries and faster performance). */
  tolerance?: Maybe<Scalars['BigFloat']>;
  translatedProps: Scalars['JSON'];
  /** MapBox GL source type or custom seasketch type. */
  type: DataSourceTypes;
  uploadedBy?: Maybe<Scalars['String']>;
  uploadedSourceFilename?: Maybe<Scalars['String']>;
  /** If uploaded using a multi-layer file format (gdb), includes the layer ID. SEASKETCH_VECTOR sources only. */
  uploadedSourceLayername?: Maybe<Scalars['String']>;
  /** UUID of the upload processing job associated with a SEASKETCH_VECTOR source. */
  uploadTaskId?: Maybe<Scalars['UUID']>;
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
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<DataLayerCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<DataLayersOrderBy>>;
};

export enum DataSourceImportTypes {
  /** Imported from an arcgis feature layer identified by original_source_url */
  Arcgis = 'ARCGIS',
  /** Uploaded directly to SeaSketch using GeoJSON or shapefile */
  Upload = 'UPLOAD'
}

/** An input for mutations affecting `DataSource` */
export type DataSourceInput = {
  arcgisFetchStrategy?: Maybe<ArcgisFeatureLayerFetchStrategy>;
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
  createdAt?: Maybe<Scalars['Datetime']>;
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
  /**
   * mapbox-geostats summary information for vector sources. Useful for
   * cartographic tools and authoring popups. SEASKETCH_VECTOR sources only.
   */
  geostats?: Maybe<Scalars['JSON']>;
  /** Should be used as sourceId in stylesheets. */
  id?: Maybe<Scalars['Int']>;
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
  /** Size of the normalized file. SEASKETCH_VECTOR sources only. */
  normalizedSourceBytes?: Maybe<Scalars['Int']>;
  /**
   * Sources are converted to flatgeobuf (vector, 4326) or geotif (raster) and
   * store indefinitely so they may be processed into tilesets and to support the
   * download function. SEASKETCH_VECTOR sources only.
   */
  normalizedSourceObjectKey?: Maybe<Scalars['String']>;
  /** SEASKETCH_VECTOR sources only. S3 object key where data are stored */
  objectKey?: Maybe<Scalars['UUID']>;
  /**
   * For SeaSketchVector sources, identifies location of original service that
   * hosted the data, if any. This can be used to update a layer with an updated
   * copy of the data source if necessary.
   */
  originalSourceUrl?: Maybe<Scalars['String']>;
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
  supportsDynamicLayers?: Maybe<Scalars['Boolean']>;
  /** For tiled sources, a list of endpoints that can be used to retrieve tiles. */
  tiles?: Maybe<Array<Maybe<Scalars['String']>>>;
  /** The minimum visual size to display tiles for this layer. Only configurable for raster layers. */
  tileSize?: Maybe<Scalars['Int']>;
  /** GeoJSON only. Douglas-Peucker simplification tolerance (higher means simpler geometries and faster performance). */
  tolerance?: Maybe<Scalars['BigFloat']>;
  translatedProps?: Maybe<Scalars['JSON']>;
  /** MapBox GL source type or custom seasketch type. */
  type: DataSourceTypes;
  uploadedSourceFilename?: Maybe<Scalars['String']>;
  /** If uploaded using a multi-layer file format (gdb), includes the layer ID. SEASKETCH_VECTOR sources only. */
  uploadedSourceLayername?: Maybe<Scalars['String']>;
  /** UUID of the upload processing job associated with a SEASKETCH_VECTOR source. */
  uploadTaskId?: Maybe<Scalars['UUID']>;
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

/** Represents an update to a `DataSource`. Fields that are set will be updated. */
export type DataSourcePatch = {
  arcgisFetchStrategy?: Maybe<ArcgisFeatureLayerFetchStrategy>;
  /** Contains an attribution to be displayed when the map is shown to a user. */
  attribution?: Maybe<Scalars['String']>;
  /**
   * GeoJSON only. Size of the tile buffer on each side. A value of 0 produces no
   * buffer. A value of 512 produces a buffer as wide as the tile itself. Larger
   * values produce fewer rendering artifacts near tile edges and slower performance.
   */
  buffer?: Maybe<Scalars['Int']>;
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
  /** Raster-DEM only. The encoding used by this source. Mapbox Terrain RGB is used by default */
  encoding?: Maybe<RasterDemEncoding>;
  /**
   * GeoJSON only. Whether to generate ids for the geojson features. When enabled,
   * the feature.id property will be auto assigned based on its index in the
   * features array, over-writing any previous values.
   */
  generateId?: Maybe<Scalars['Boolean']>;
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
  supportsDynamicLayers?: Maybe<Scalars['Boolean']>;
  /** For tiled sources, a list of endpoints that can be used to retrieve tiles. */
  tiles?: Maybe<Array<Maybe<Scalars['String']>>>;
  /** The minimum visual size to display tiles for this layer. Only configurable for raster layers. */
  tileSize?: Maybe<Scalars['Int']>;
  /** GeoJSON only. Douglas-Peucker simplification tolerance (higher means simpler geometries and faster performance). */
  tolerance?: Maybe<Scalars['BigFloat']>;
  translatedProps?: Maybe<Scalars['JSON']>;
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

export enum DataSourceTypes {
  /** Loads dynamic images for the entire viewport from arcgis server */
  ArcgisDynamicMapserver = 'ARCGIS_DYNAMIC_MAPSERVER',
  /** Tiled ArcGIS Map Service */
  ArcgisRasterTiles = 'ARCGIS_RASTER_TILES',
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
  /** SeaSketch-hosted vector tiles */
  SeasketchMvt = 'SEASKETCH_MVT',
  /** Raster data hosting on SeaSketch CDN */
  SeasketchRaster = 'SEASKETCH_RASTER',
  /** GeoJSON hosted on SeaSketch CDN */
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
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<ProjectCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<ProjectsOrderBy>>;
};

/**
 * A condition to be used against `DataSourcesBucket` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type DataSourcesBucketCondition = {
  /** Checks for equality with the object’s `url` field. */
  url?: Maybe<Scalars['String']>;
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

export enum DataUploadState {
  AwaitingUpload = 'AWAITING_UPLOAD',
  Cartography = 'CARTOGRAPHY',
  Complete = 'COMPLETE',
  ConvertingFormat = 'CONVERTING_FORMAT',
  Failed = 'FAILED',
  FailedDismissed = 'FAILED_DISMISSED',
  Fetching = 'FETCHING',
  Processing = 'PROCESSING',
  RequiresUserInput = 'REQUIRES_USER_INPUT',
  Tiling = 'TILING',
  Uploaded = 'UPLOADED',
  UploadingProducts = 'UPLOADING_PRODUCTS',
  Validating = 'VALIDATING',
  WorkerComplete = 'WORKER_COMPLETE'
}

export type DataUploadTask = Node & {
  __typename?: 'DataUploadTask';
  /** Content-Type of the original upload. */
  contentType: Scalars['String'];
  createdAt: Scalars['Datetime'];
  errorMessage?: Maybe<Scalars['String']>;
  /** Original name of file as uploaded by the user. */
  filename: Scalars['String'];
  id: Scalars['UUID'];
  /** Reads and enables pagination through a set of `DataLayer`. */
  layers?: Maybe<Array<DataLayer>>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  outputs?: Maybe<Scalars['JSON']>;
  /** Use to upload source data to s3. Must be an admin. */
  presignedUploadUrl?: Maybe<Scalars['String']>;
  /** 0.0 to 1.0 scale, applies to tiling process. */
  progress?: Maybe<Scalars['BigFloat']>;
  /** Reads a single `Project` that is related to this `DataUploadTask`. */
  project?: Maybe<Project>;
  projectId: Scalars['Int'];
  startedAt?: Maybe<Scalars['Datetime']>;
  state: DataUploadState;
  tableOfContentsItemStableIds?: Maybe<Array<Maybe<Scalars['String']>>>;
  userId: Scalars['Int'];
};


export type DataUploadTaskLayersArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};

/**
 * A condition to be used against `DataUploadTask` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type DataUploadTaskCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['UUID']>;
  /** Checks for equality with the object’s `projectId` field. */
  projectId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `state` field. */
  state?: Maybe<DataUploadState>;
};

export type DataUploadTaskSubscriptionPayload = {
  __typename?: 'DataUploadTaskSubscriptionPayload';
  dataUploadTask?: Maybe<DataUploadTask>;
  dataUploadTaskId: Scalars['UUID'];
  previousState?: Maybe<DataUploadState>;
  project: Project;
  projectId: Scalars['Int'];
};

/** A connection to a list of `DataUploadTask` values. */
export type DataUploadTasksConnection = {
  __typename?: 'DataUploadTasksConnection';
  /** A list of edges which contains the `DataUploadTask` and cursor to aid in pagination. */
  edges: Array<DataUploadTasksEdge>;
  /** A list of `DataUploadTask` objects. */
  nodes: Array<DataUploadTask>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `DataUploadTask` you could get from the connection. */
  totalCount: Scalars['Int'];
};

/** A `DataUploadTask` edge in the connection. */
export type DataUploadTasksEdge = {
  __typename?: 'DataUploadTasksEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `DataUploadTask` at the end of the edge. */
  node: DataUploadTask;
};

/** Methods to use when ordering `DataUploadTask`. */
export enum DataUploadTasksOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ProjectIdAsc = 'PROJECT_ID_ASC',
  ProjectIdDesc = 'PROJECT_ID_DESC',
  StateAsc = 'STATE_ASC',
  StateDesc = 'STATE_DESC'
}



/** All input for the `deleteBasemapByNodeId` mutation. */
export type DeleteBasemapByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `Basemap` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteBasemap` mutation. */
export type DeleteBasemapInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<BasemapsOrderBy>>;
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

/** All input for the `deleteDataLayerByInteractivitySettingsId` mutation. */
export type DeleteDataLayerByInteractivitySettingsIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  interactivitySettingsId: Scalars['Int'];
};

/** All input for the `deleteDataLayerByNodeId` mutation. */
export type DeleteDataLayerByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `DataLayer` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteDataLayer` mutation. */
export type DeleteDataLayerInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<DataLayersOrderBy>>;
};

/** All input for the `deleteDataSourceByNodeId` mutation. */
export type DeleteDataSourceByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `DataSource` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteDataSource` mutation. */
export type DeleteDataSourceInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<DataSourcesOrderBy>>;
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

/** All input for the `deleteFormElementByNodeId` mutation. */
export type DeleteFormElementByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `FormElement` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteFormElement` mutation. */
export type DeleteFormElementInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<FormElementsOrderBy>>;
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

/** All input for the `deleteFormLogicConditionByNodeId` mutation. */
export type DeleteFormLogicConditionByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `FormLogicCondition` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteFormLogicCondition` mutation. */
export type DeleteFormLogicConditionInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<FormLogicConditionsOrderBy>>;
};

/** All input for the `deleteFormLogicRuleByNodeId` mutation. */
export type DeleteFormLogicRuleByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `FormLogicRule` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteFormLogicRule` mutation. */
export type DeleteFormLogicRuleInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<FormLogicRulesOrderBy>>;
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

/** All input for the `deleteOfflineTilePackage` mutation. */
export type DeleteOfflineTilePackageInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['UUID']>;
};

/** The output of our `deleteOfflineTilePackage` mutation. */
export type DeleteOfflineTilePackagePayload = {
  __typename?: 'DeleteOfflineTilePackagePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  offlineTilePackage?: Maybe<OfflineTilePackage>;
  /** An edge for our `OfflineTilePackage`. May be used by Relay 1. */
  offlineTilePackageEdge?: Maybe<OfflineTilePackagesEdge>;
  /** Reads a single `Project` that is related to this `OfflineTilePackage`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `deleteOfflineTilePackage` mutation. */
export type DeleteOfflineTilePackagePayloadOfflineTilePackageEdgeArgs = {
  orderBy?: Maybe<Array<OfflineTilePackagesOrderBy>>;
};

/** All input for the `deleteOfflineTileSettingByNodeId` mutation. */
export type DeleteOfflineTileSettingByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `OfflineTileSetting` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteOfflineTileSettingByProjectIdAndBasemapId` mutation. */
export type DeleteOfflineTileSettingByProjectIdAndBasemapIdInput = {
  basemapId: Scalars['Int'];
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectId: Scalars['Int'];
};

/** All input for the `deleteOfflineTileSetting` mutation. */
export type DeleteOfflineTileSettingInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
};

/** The output of our delete `OfflineTileSetting` mutation. */
export type DeleteOfflineTileSettingPayload = {
  __typename?: 'DeleteOfflineTileSettingPayload';
  /** Reads a single `Basemap` that is related to this `OfflineTileSetting`. */
  basemap?: Maybe<Basemap>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  deletedOfflineTileSettingNodeId?: Maybe<Scalars['ID']>;
  /** The `OfflineTileSetting` that was deleted by this mutation. */
  offlineTileSetting?: Maybe<OfflineTileSetting>;
  /** Reads a single `Project` that is related to this `OfflineTileSetting`. */
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
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `OptionalBasemapLayer` to be deleted. */
  nodeId: Scalars['ID'];
};

/** All input for the `deleteOptionalBasemapLayer` mutation. */
export type DeleteOptionalBasemapLayerInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<ProjectsOrderBy>>;
};

/** All input for the `deleteProjectsSharedBasemapByBasemapIdAndProjectId` mutation. */
export type DeleteProjectsSharedBasemapByBasemapIdAndProjectIdInput = {
  basemapId: Scalars['Int'];
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<ProjectsSharedBasemapsOrderBy>>;
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

/** All input for the `deleteSketchClassByFormElementId` mutation. */
export type DeleteSketchClassByFormElementIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** If set, this sketch class is only for use in a survey indicated by the form_element. */
  formElementId: Scalars['Int'];
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

export type DeleteSketchTocItemsResults = {
  __typename?: 'DeleteSketchTocItemsResults';
  deletedItems: Array<Scalars['String']>;
  updatedCollections: Array<Maybe<Sketch>>;
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

/** All input for the `deleteTableOfContentsBranch` mutation. */
export type DeleteTableOfContentsBranchInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  tableOfContentsItemId?: Maybe<Scalars['Int']>;
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

/** All input for the `denyParticipant` mutation. */
export type DenyParticipantInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
  userId?: Maybe<Scalars['Int']>;
};

/** The output of our `denyParticipant` mutation. */
export type DenyParticipantPayload = {
  __typename?: 'DenyParticipantPayload';
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


/** The output of our `denyParticipant` mutation. */
export type DenyParticipantPayloadUserEdgeArgs = {
  orderBy?: Maybe<Array<UsersOrderBy>>;
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

/** All input for the `dismissFailedUpload` mutation. */
export type DismissFailedUploadInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['UUID']>;
};

/** The output of our `dismissFailedUpload` mutation. */
export type DismissFailedUploadPayload = {
  __typename?: 'DismissFailedUploadPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  dataUploadTask?: Maybe<DataUploadTask>;
  /** An edge for our `DataUploadTask`. May be used by Relay 1. */
  dataUploadTaskEdge?: Maybe<DataUploadTasksEdge>;
  /** Reads a single `Project` that is related to this `DataUploadTask`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `dismissFailedUpload` mutation. */
export type DismissFailedUploadPayloadDataUploadTaskEdgeArgs = {
  orderBy?: Maybe<Array<DataUploadTasksOrderBy>>;
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

export enum EmailVerificationStatus {
  /** An email was sent to the address */
  EmailSent = 'EMAIL_SENT',
  /** The email address is already verified */
  Verified = 'VERIFIED'
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

/** All input for the `enableOfflineSupport` mutation. */
export type EnableOfflineSupportInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  enable?: Maybe<Scalars['Boolean']>;
  projectId?: Maybe<Scalars['Int']>;
};

/** The output of our `enableOfflineSupport` mutation. */
export type EnableOfflineSupportPayload = {
  __typename?: 'EnableOfflineSupportPayload';
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


/** The output of our `enableOfflineSupport` mutation. */
export type EnableOfflineSupportPayloadProjectEdgeArgs = {
  orderBy?: Maybe<Array<ProjectsOrderBy>>;
};

export enum ExtendedGeostatsType {
  Array = 'ARRAY',
  Boolean = 'BOOLEAN',
  Mixed = 'MIXED',
  Null = 'NULL',
  Number = 'NUMBER',
  Object = 'OBJECT',
  String = 'STRING'
}

/** All input for the `failDataUpload` mutation. */
export type FailDataUploadInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['UUID']>;
  msg?: Maybe<Scalars['String']>;
};

/** The output of our `failDataUpload` mutation. */
export type FailDataUploadPayload = {
  __typename?: 'FailDataUploadPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  dataUploadTask?: Maybe<DataUploadTask>;
  /** An edge for our `DataUploadTask`. May be used by Relay 1. */
  dataUploadTaskEdge?: Maybe<DataUploadTasksEdge>;
  /** Reads a single `Project` that is related to this `DataUploadTask`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `failDataUpload` mutation. */
export type FailDataUploadPayloadDataUploadTaskEdgeArgs = {
  orderBy?: Maybe<Array<DataUploadTasksOrderBy>>;
};

export enum FieldRuleOperator {
  Contains = 'CONTAINS',
  Equal = 'EQUAL',
  GreaterThan = 'GREATER_THAN',
  IsBlank = 'IS_BLANK',
  LessThan = 'LESS_THAN',
  NotEqual = 'NOT_EQUAL'
}

export type FileUpload = Node & {
  __typename?: 'FileUpload';
  cloudflareImagesId?: Maybe<Scalars['String']>;
  /** Use a listed media type from https://www.iana.org/assignments/media-types/media-types.xhtml */
  contentType: Scalars['String'];
  createdAt: Scalars['Datetime'];
  /**
   * Includes a temporary token to enable download. Use
   * rel="download nofollow" so that it is not indexed by search engines.
   */
  downloadUrl: Scalars['String'];
  filename: Scalars['String'];
  fileSizeBytes: Scalars['BigInt'];
  id: Scalars['UUID'];
  isSpatial: Scalars['Boolean'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** Reads a single `Post` that is related to this `FileUpload`. */
  post?: Maybe<Post>;
  postId?: Maybe<Scalars['Int']>;
  /** Use to upload to cloud storage (PUT). */
  presignedUploadUrl?: Maybe<Scalars['String']>;
  projectId: Scalars['Int'];
  tilejsonEndpoint?: Maybe<Scalars['String']>;
  usage: FileUploadUsage;
  userId: Scalars['Int'];
};

/**
 * A condition to be used against `FileUpload` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type FileUploadCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['UUID']>;
  /** Checks for equality with the object’s `postId` field. */
  postId?: Maybe<Scalars['Int']>;
};

export enum FileUploadUsage {
  ForumAttachment = 'FORUM_ATTACHMENT',
  SurveyResponse = 'SURVEY_RESPONSE'
}

export enum FileUploadUsageInput {
  ForumAttachment = 'forum_attachment',
  SurveyResponse = 'survey_response'
}

/** A connection to a list of `FileUpload` values. */
export type FileUploadsConnection = {
  __typename?: 'FileUploadsConnection';
  /** A list of edges which contains the `FileUpload` and cursor to aid in pagination. */
  edges: Array<FileUploadsEdge>;
  /** A list of `FileUpload` objects. */
  nodes: Array<FileUpload>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `FileUpload` you could get from the connection. */
  totalCount: Scalars['Int'];
};

/** A `FileUpload` edge in the connection. */
export type FileUploadsEdge = {
  __typename?: 'FileUploadsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `FileUpload` at the end of the edge. */
  node: FileUpload;
};

/** Methods to use when ordering `FileUpload`. */
export enum FileUploadsOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PostIdAsc = 'POST_ID_ASC',
  PostIdDesc = 'POST_ID_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
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
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
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
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
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
  generatedExportId: Scalars['String'];
  generatedLabel: Scalars['String'];
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
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<SurveyConsentDocumentCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<SurveyConsentDocumentsOrderBy>>;
};

/** An input for mutations affecting `FormElement` */
export type FormElementInput = {
  alternateLanguageSettings?: Maybe<Scalars['JSON']>;
  /** Optional background color to transition the form to when this element is displayed. */
  backgroundColor?: Maybe<Scalars['String']>;
  backgroundHeight?: Maybe<Scalars['Int']>;
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
  componentSettings?: Maybe<Scalars['JSON']>;
  createdAt?: Maybe<Scalars['Datetime']>;
  /**
   * Column name used in csv export, property name in reporting tools. Keep stable
   * to avoid breaking reports. If null, this value will be dynamically generated
   * from the first several characters of the text in FormElement.body.
   */
  exportId?: Maybe<Scalars['String']>;
  /** Form this field belongs to. */
  formId: Scalars['Int'];
  generatedExportId?: Maybe<Scalars['String']>;
  generatedLabel?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['Int']>;
  /** Users must provide input for these fields before submission. */
  isRequired?: Maybe<Scalars['Boolean']>;
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
  /**
   * Determines order of field display. Clients should display fields in ascending
   * order. Cannot be changed individually. Use `setFormElementOrder()` mutation to
   * update.
   */
  position?: Maybe<Scalars['Int']>;
  /** Color used to style navigation controls */
  secondaryColor?: Maybe<Scalars['String']>;
  /**
   * Used for special elements like SpatialAccessPriorityInput to create a sort of
   * sub-form that the parent element controls the rendering of. Will not appear in
   * the form unless the client implementation utilizes something like
   * FormElement.shouldDisplaySubordinateElement to control visibility.
   */
  subordinateTo?: Maybe<Scalars['Int']>;
  /**
   * Indicates whether the form element should be displayed with dark or light text
   * variants to match the background color. Admin interface should automatically
   * set this value based on `background_color`, though admins may wish to manually override.
   */
  textVariant?: Maybe<FormElementTextVariant>;
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
  alternateLanguageSettings?: Maybe<Scalars['JSON']>;
  /** Optional background color to transition the form to when this element is displayed. */
  backgroundColor?: Maybe<Scalars['String']>;
  backgroundHeight?: Maybe<Scalars['Int']>;
  backgroundPalette?: Maybe<Array<Maybe<Scalars['String']>>>;
  backgroundWidth?: Maybe<Scalars['Int']>;
  /**
   * [prosemirror](https://prosemirror.net/) document representing a rich-text
   * question or informational content. Level 1 headers can be assumed to be the
   * question for input-type fields, though formatting is up to the project
   * administrators. Clients should provide a template that encourages this
   * convention when building forms.
   */
  body?: Maybe<Scalars['JSON']>;
  /** Type-specific configuration. For example, a Choice field might have a list of valid choices. */
  componentSettings?: Maybe<Scalars['JSON']>;
  createdAt?: Maybe<Scalars['Datetime']>;
  /**
   * Column name used in csv export, property name in reporting tools. Keep stable
   * to avoid breaking reports. If null, this value will be dynamically generated
   * from the first several characters of the text in FormElement.body.
   */
  exportId?: Maybe<Scalars['String']>;
  /** Form this field belongs to. */
  formId?: Maybe<Scalars['Int']>;
  generatedExportId?: Maybe<Scalars['String']>;
  generatedLabel?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['Int']>;
  /** Users must provide input for these fields before submission. */
  isRequired?: Maybe<Scalars['Boolean']>;
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
  /**
   * Determines order of field display. Clients should display fields in ascending
   * order. Cannot be changed individually. Use `setFormElementOrder()` mutation to
   * update.
   */
  position?: Maybe<Scalars['Int']>;
  /** Color used to style navigation controls */
  secondaryColor?: Maybe<Scalars['String']>;
  /**
   * Used for special elements like SpatialAccessPriorityInput to create a sort of
   * sub-form that the parent element controls the rendering of. Will not appear in
   * the form unless the client implementation utilizes something like
   * FormElement.shouldDisplaySubordinateElement to control visibility.
   */
  subordinateTo?: Maybe<Scalars['Int']>;
  /**
   * Indicates whether the form element should be displayed with dark or light text
   * variants to match the background color. Admin interface should automatically
   * set this value based on `background_color`, though admins may wish to manually override.
   */
  textVariant?: Maybe<FormElementTextVariant>;
  typeId?: Maybe<Scalars['String']>;
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
  geostatsArrayOf?: Maybe<ExtendedGeostatsType>;
  geostatsType?: Maybe<ExtendedGeostatsType>;
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
  componentName?: Maybe<Scalars['String']>;
  /** Checks for equality with the object’s `label` field. */
  label?: Maybe<Scalars['String']>;
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
  id?: Maybe<Scalars['Int']>;
  operator?: Maybe<FieldRuleOperator>;
  ruleId: Scalars['Int'];
  subjectId: Scalars['Int'];
  value?: Maybe<Scalars['JSON']>;
};

/** Represents an update to a `FormLogicCondition`. Fields that are set will be updated. */
export type FormLogicConditionPatch = {
  id?: Maybe<Scalars['Int']>;
  operator?: Maybe<FieldRuleOperator>;
  ruleId?: Maybe<Scalars['Int']>;
  subjectId?: Maybe<Scalars['Int']>;
  value?: Maybe<Scalars['JSON']>;
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
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};

/** An input for mutations affecting `FormLogicRule` */
export type FormLogicRuleInput = {
  booleanOperator?: Maybe<FormLogicOperator>;
  command: FormLogicCommand;
  formElementId: Scalars['Int'];
  id?: Maybe<Scalars['Int']>;
  jumpToId?: Maybe<Scalars['Int']>;
  position: Scalars['Int'];
};

/** Represents an update to a `FormLogicRule`. Fields that are set will be updated. */
export type FormLogicRulePatch = {
  booleanOperator?: Maybe<FormLogicOperator>;
  command?: Maybe<FormLogicCommand>;
  formElementId?: Maybe<Scalars['Int']>;
  id?: Maybe<Scalars['Int']>;
  jumpToId?: Maybe<Scalars['Int']>;
  position?: Maybe<Scalars['Int']>;
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
  id?: Maybe<Scalars['Int']>;
  /**
   * SeaSetch superusers can create template forms than can be used when creating
   * SketchClasses or Surveys. These templates can be created using the
   * `createFormTemplateFromSketchClass` and `createFormTemplateFromSurvey`
   * mutations. Template forms can be listed with the root-level `templateForms`
   * query.
   */
  isTemplate?: Maybe<Scalars['Boolean']>;
  /** Related *SketchClass* */
  sketchClassId?: Maybe<Scalars['Int']>;
  /** Related *Survey* */
  surveyId?: Maybe<Scalars['Int']>;
  /** Chosen by superusers upon template creation */
  templateName?: Maybe<Scalars['String']>;
  /** Indicates which features should use this form as a template */
  templateType?: Maybe<FormTemplateType>;
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
  canPost?: Maybe<Scalars['Boolean']>;
  /** Optional description of the forum to be displayed to project users. */
  description?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  lastPostDate?: Maybe<Scalars['Datetime']>;
  /** Title displayed for the forum. */
  name: Scalars['String'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /**
   * Sets position of this forum in the listing. Forums should be listed by
   * position in ascending order. Set using `setForumOrder()`
   */
  position?: Maybe<Scalars['Int']>;
  postCount?: Maybe<Scalars['Int']>;
  /** Reads a single `Project` that is related to this `Forum`. */
  project?: Maybe<Project>;
  projectId: Scalars['Int'];
  readAcl?: Maybe<Acl>;
  topicCount?: Maybe<Scalars['Int']>;
  /** Reads and enables pagination through a set of `Topic`. */
  topicsConnection: TopicsConnection;
  translatedProps: Scalars['JSON'];
  writeAcl?: Maybe<Acl>;
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

export type ForumActivityPayload = {
  __typename?: 'ForumActivityPayload';
  forum?: Maybe<Forum>;
  forumId: Scalars['Int'];
  post?: Maybe<Post>;
  postId: Scalars['Int'];
  project?: Maybe<Project>;
  projectId: Scalars['Int'];
  topic?: Maybe<Topic>;
  topicId: Scalars['Int'];
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
  translatedProps?: Maybe<Scalars['JSON']>;
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
  translatedProps?: Maybe<Scalars['JSON']>;
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

/** All input for the `generateOfflineTilePackage` mutation. */
export type GenerateOfflineTilePackageInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  dataSourceUrl?: Maybe<Scalars['String']>;
  maxShorelineZ?: Maybe<Scalars['Int']>;
  maxZ?: Maybe<Scalars['Int']>;
  originalUrlTemplate?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
  sourceType?: Maybe<OfflineTilePackageSourceType>;
};

/** The output of our `generateOfflineTilePackage` mutation. */
export type GenerateOfflineTilePackagePayload = {
  __typename?: 'GenerateOfflineTilePackagePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  offlineTilePackage?: Maybe<OfflineTilePackage>;
  /** An edge for our `OfflineTilePackage`. May be used by Relay 1. */
  offlineTilePackageEdge?: Maybe<OfflineTilePackagesEdge>;
  /** Reads a single `Project` that is related to this `OfflineTilePackage`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `generateOfflineTilePackage` mutation. */
export type GenerateOfflineTilePackagePayloadOfflineTilePackageEdgeArgs = {
  orderBy?: Maybe<Array<OfflineTilePackagesOrderBy>>;
};


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

/** All input for the `getChildFoldersRecursive` mutation. */
export type GetChildFoldersRecursiveInput = {
  childType?: Maybe<SketchChildType>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  parentId?: Maybe<Scalars['Int']>;
};

/** The output of our `getChildFoldersRecursive` mutation. */
export type GetChildFoldersRecursivePayload = {
  __typename?: 'GetChildFoldersRecursivePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  integers?: Maybe<Array<Maybe<Scalars['Int']>>>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
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
  direction?: Maybe<SortByDirection>;
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<ParticipantSortBy>;
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
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<ProjectInviteGroupCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<ProjectInviteGroupsOrderBy>>;
};

/** An input for mutations affecting `Group` */
export type GroupInput = {
  id?: Maybe<Scalars['Int']>;
  /** Label for the group. */
  name: Scalars['String'];
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

/** All input for the `importArcgisServices` mutation. */
export type ImportArcgisServicesInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  items?: Maybe<Array<Maybe<ArcgisImportItemInput>>>;
  projectId?: Maybe<Scalars['Int']>;
  sources?: Maybe<Array<Maybe<ArcgisImportSourceInput>>>;
};

/** The output of our `importArcgisServices` mutation. */
export type ImportArcgisServicesPayload = {
  __typename?: 'ImportArcgisServicesPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  tableOfContentsItems?: Maybe<Array<TableOfContentsItem>>;
};

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
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<BasemapCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<BasemapsOrderBy>>;
};


export type InteractivitySettingDataLayersByInteractivitySettingsIdConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<DataLayerCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<DataLayersOrderBy>>;
};

/** An input for mutations affecting `InteractivitySetting` */
export type InteractivitySettingInput = {
  cursor?: Maybe<CursorType>;
  id?: Maybe<Scalars['Int']>;
  /** Used only for basemap interactivity settings. Optional list of layer ids that this setting applies to. */
  layers?: Maybe<Array<Maybe<Scalars['String']>>>;
  longTemplate?: Maybe<Scalars['String']>;
  shortTemplate?: Maybe<Scalars['String']>;
  type?: Maybe<InteractivityType>;
};

/** Represents an update to a `InteractivitySetting`. Fields that are set will be updated. */
export type InteractivitySettingPatch = {
  cursor?: Maybe<CursorType>;
  id?: Maybe<Scalars['Int']>;
  /** Used only for basemap interactivity settings. Optional list of layer ids that this setting applies to. */
  layers?: Maybe<Array<Maybe<Scalars['String']>>>;
  longTemplate?: Maybe<Scalars['String']>;
  shortTemplate?: Maybe<Scalars['String']>;
  type?: Maybe<InteractivityType>;
};

export enum InteractivityType {
  AllPropertiesPopup = 'ALL_PROPERTIES_POPUP',
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
  id?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `projectInviteId` field. */
  projectInviteId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `status` field. */
  status?: Maybe<EmailStatus>;
  /** Checks for equality with the object’s `surveyInviteId` field. */
  surveyInviteId?: Maybe<Scalars['Int']>;
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

/** All input for the `labelForFormElementValue` mutation. */
export type LabelForFormElementValueInput = {
  attrValue?: Maybe<Scalars['JSON']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  componentSettings?: Maybe<Scalars['JSON']>;
};

/** The output of our `labelForFormElementValue` mutation. */
export type LabelForFormElementValuePayload = {
  __typename?: 'LabelForFormElementValuePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  json?: Maybe<Scalars['JSON']>;
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

/** All input for the `makeResponsesNotPractice` mutation. */
export type MakeResponsesNotPracticeInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  ids?: Maybe<Array<Maybe<Scalars['Int']>>>;
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
  clientMutationId?: Maybe<Scalars['String']>;
  ids?: Maybe<Array<Maybe<Scalars['Int']>>>;
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
  orderBy?: Maybe<Array<SurveyResponsesOrderBy>>;
};

/** All input for the `makeSketchClass` mutation. */
export type MakeSketchClassInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
  templateId?: Maybe<Scalars['Int']>;
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
  orderBy?: Maybe<Array<SketchClassesOrderBy>>;
};

/** All input for the `makeSurvey` mutation. */
export type MakeSurveyInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
  templateId?: Maybe<Scalars['Int']>;
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

export type MapBookmark = {
  __typename?: 'MapBookmark';
  /** Reads a single `Basemap` that is related to this `MapBookmark`. */
  basemapBySelectedBasemap?: Maybe<Basemap>;
  basemapName?: Maybe<Scalars['String']>;
  basemapOptionalLayerStates?: Maybe<Scalars['JSON']>;
  cameraOptions: Scalars['JSON'];
  /** Generated by clients. Should not be used if authorative thumbnail (image_id) is available. */
  clientGeneratedThumbnail?: Maybe<Scalars['String']>;
  createdAt: Scalars['Datetime'];
  id: Scalars['UUID'];
  imageId?: Maybe<Scalars['String']>;
  isPublic: Scalars['Boolean'];
  job?: Maybe<WorkerJob>;
  layerNames?: Maybe<Scalars['JSON']>;
  mapDimensions: Array<Maybe<Scalars['Int']>>;
  postId?: Maybe<Scalars['Int']>;
  projectId?: Maybe<Scalars['Int']>;
  screenshotJobStatus: WorkerJobStatus;
  selectedBasemap: Scalars['Int'];
  sidebarState?: Maybe<Scalars['JSON']>;
  sketchNames?: Maybe<Scalars['JSON']>;
  sprites?: Maybe<Sprite>;
  style: Scalars['JSON'];
  userId: Scalars['Int'];
  visibleDataLayers: Array<Maybe<Scalars['String']>>;
  visibleSketches?: Maybe<Array<Maybe<Scalars['Int']>>>;
};

/**
 * A condition to be used against `MapBookmark` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type MapBookmarkCondition = {
  /** Checks for equality with the object’s `postId` field. */
  postId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `selectedBasemap` field. */
  selectedBasemap?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `visibleDataLayers` field. */
  visibleDataLayers?: Maybe<Array<Maybe<Scalars['String']>>>;
};

/** A connection to a list of `MapBookmark` values. */
export type MapBookmarksConnection = {
  __typename?: 'MapBookmarksConnection';
  /** A list of edges which contains the `MapBookmark` and cursor to aid in pagination. */
  edges: Array<MapBookmarksEdge>;
  /** A list of `MapBookmark` objects. */
  nodes: Array<MapBookmark>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `MapBookmark` you could get from the connection. */
  totalCount: Scalars['Int'];
};

/** A `MapBookmark` edge in the connection. */
export type MapBookmarksEdge = {
  __typename?: 'MapBookmarksEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `MapBookmark` at the end of the edge. */
  node: MapBookmark;
};

/** Methods to use when ordering `MapBookmark`. */
export enum MapBookmarksOrderBy {
  Natural = 'NATURAL',
  PostIdAsc = 'POST_ID_ASC',
  PostIdDesc = 'POST_ID_DESC',
  SelectedBasemapAsc = 'SELECTED_BASEMAP_ASC',
  SelectedBasemapDesc = 'SELECTED_BASEMAP_DESC',
  VisibleDataLayersAsc = 'VISIBLE_DATA_LAYERS_ASC',
  VisibleDataLayersDesc = 'VISIBLE_DATA_LAYERS_DESC'
}

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

/** All input for the `mergeTranslatedProps` mutation. */
export type MergeTranslatedPropsInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  existing?: Maybe<Scalars['JSON']>;
  propName?: Maybe<Scalars['String']>;
  propTranslations?: Maybe<Scalars['JSON']>;
};

/** The output of our `mergeTranslatedProps` mutation. */
export type MergeTranslatedPropsPayload = {
  __typename?: 'MergeTranslatedPropsPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  json?: Maybe<Scalars['JSON']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `modifySurveyAnswers` mutation. */
export type ModifySurveyAnswersInput = {
  answers?: Maybe<Scalars['JSON']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  responseIds?: Maybe<Array<Maybe<Scalars['Int']>>>;
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
  alternateLanguageLabelsForFormElement?: Maybe<AlternateLanguageLabelsForFormElementPayload>;
  approveParticipant?: Maybe<ApproveParticipantPayload>;
  archiveResponses?: Maybe<ArchiveResponsesPayload>;
  cancelDataUpload?: Maybe<CancelDataUploadPayload>;
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
  copySketch?: Maybe<CopySketchPayload>;
  copySketchFolder?: Maybe<CopySketchFolderPayload>;
  copySketchTocItem?: Maybe<CopySketchTocItemResults>;
  /** Creates a single `Basemap`. */
  createBasemap?: Maybe<CreateBasemapPayload>;
  /** Creates a single `CommunityGuideline`. */
  createCommunityGuideline?: Maybe<CreateCommunityGuidelinePayload>;
  /** Creates a single `DataLayer`. */
  createDataLayer?: Maybe<CreateDataLayerPayload>;
  /** Creates a single `DataSource`. */
  createDataSource?: Maybe<CreateDataSourcePayload>;
  createDataUpload?: Maybe<CreateDataUploadPayload>;
  createFileUpload: UploaderResponse;
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
  createMapBookmark?: Maybe<CreateMapBookmarkPayload>;
  /** Creates a single `OfflineTileSetting`. */
  createOfflineTileSetting?: Maybe<CreateOfflineTileSettingPayload>;
  /** Creates a single `OptionalBasemapLayer`. */
  createOptionalBasemapLayer?: Maybe<CreateOptionalBasemapLayerPayload>;
  createPost: Post;
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
  /**
   * Create a new sketch in the user's account. If preprocessing is enabled,
   * the sketch's final geometry will be set by running the proprocessing
   * function again on userGeom. This ensures the value conforms to the
   * project's rules, and also benefits the user in that they need not submit
   * a huge geometry to the server.
   *
   * In the case of collections, the userGeom can be omitted.
   */
  createSketch?: Maybe<Sketch>;
  createSketchClassFromTemplate?: Maybe<CreateSketchClassFromTemplatePayload>;
  createSketchFolder?: Maybe<CreateSketchFolderPayload>;
  /** Creates a single `SurveyInvitedGroup`. */
  createSurveyInvitedGroup?: Maybe<CreateSurveyInvitedGroupPayload>;
  createSurveyInvites?: Maybe<CreateSurveyInvitesPayload>;
  /** Initializes a new FormLogicRule with a single condition and command=JUMP. */
  createSurveyJumpRule?: Maybe<CreateSurveyJumpRulePayload>;
  createSurveyResponse?: Maybe<CreateSurveyResponsePayload>;
  createSurveyResponseV2?: Maybe<CreateSurveyResponseV2Payload>;
  /** Creates a single `TableOfContentsItem`. */
  createTableOfContentsItem?: Maybe<CreateTableOfContentsItemPayload>;
  createTopic: Topic;
  createVisibilityLogicRule?: Maybe<CreateVisibilityLogicRulePayload>;
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
  deleteOfflineTilePackage?: Maybe<DeleteOfflineTilePackagePayload>;
  /** Deletes a single `OfflineTileSetting` using a unique key. */
  deleteOfflineTileSetting?: Maybe<DeleteOfflineTileSettingPayload>;
  /** Deletes a single `OfflineTileSetting` using its globally unique id. */
  deleteOfflineTileSettingByNodeId?: Maybe<DeleteOfflineTileSettingPayload>;
  /** Deletes a single `OfflineTileSetting` using a unique key. */
  deleteOfflineTileSettingByProjectIdAndBasemapId?: Maybe<DeleteOfflineTileSettingPayload>;
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
  /**
   * Deletes one or more Sketch or SketchFolders
   *
   * Returns an updatedCollections property which should be used to update the
   * updatedAt property on related collections so that correct cache keys are
   * used when requesting reports.
   */
  deleteSketchTocItems?: Maybe<DeleteSketchTocItemsResults>;
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
  denyParticipant?: Maybe<DenyParticipantPayload>;
  /** Ban a user from posting in the discussion forum */
  disableForumPosting?: Maybe<DisableForumPostingPayload>;
  dismissFailedUpload?: Maybe<DismissFailedUploadPayload>;
  /** Re-enable discussion forum posting for a user that was previously banned. */
  enableForumPosting?: Maybe<EnableForumPostingPayload>;
  enableOfflineSupport?: Maybe<EnableOfflineSupportPayload>;
  failDataUpload?: Maybe<FailDataUploadPayload>;
  generateOfflineTilePackage?: Maybe<GenerateOfflineTilePackagePayload>;
  getChildFoldersRecursive?: Maybe<GetChildFoldersRecursivePayload>;
  /**
   * Use to create new sprites. If an existing sprite in the database for this
   * project has a matching md5 hash no new Sprite will be created.
   */
  getOrCreateSprite?: Maybe<Sprite>;
  /** Give a user admin access to a project. User must have already joined the project and shared their user profile. */
  grantAdminAccess?: Maybe<GrantAdminAccessPayload>;
  importArcgisServices?: Maybe<ImportArcgisServicesPayload>;
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
  labelForFormElementValue?: Maybe<LabelForFormElementValuePayload>;
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
  mergeTranslatedProps?: Maybe<MergeTranslatedPropsPayload>;
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
  /**
   * Send an email to the user with a link to verify their email address.
   * If the user's email is already verified, no email will be sent.
   */
  sendEmailVerification: EmailVerificationStatus;
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
  setTranslatedProp: SetTranslatedPropResult;
  /**
   * Sets the list of groups that the given user belongs to. Will clear all other
   * group memberships in the project. Available only to admins.
   */
  setUserGroups?: Maybe<SetUserGroupsPayload>;
  /** Superusers only. Promote a sprite to be globally available. */
  shareSprite?: Maybe<ShareSpritePayload>;
  /** Superusers only. "Deletes" a sprite but keeps it in the DB in case layers are already referencing it. */
  softDeleteSprite?: Maybe<SoftDeleteSpritePayload>;
  submitDataUpload?: Maybe<SubmitDataUploadPayload>;
  tableOfContentsItemsPrimaryDownloadUrl?: Maybe<TableOfContentsItemsPrimaryDownloadUrlPayload>;
  /**
   * Toggle admin access for the given project and user. User must have already
   * joined the project and shared their user profile.
   */
  toggleAdminAccess?: Maybe<ToggleAdminAccessPayload>;
  /** Ban a user from posting in the discussion forum */
  toggleForumPostingBan?: Maybe<ToggleForumPostingBanPayload>;
  toggleLanguageSupport?: Maybe<ToggleLanguageSupportPayload>;
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
  updateBasemapOfflineTileSettings?: Maybe<UpdateBasemapOfflineTileSettingsPayload>;
  /** Updates a single `CommunityGuideline` using a unique key and a patch. */
  updateCommunityGuideline?: Maybe<UpdateCommunityGuidelinePayload>;
  /** Updates a single `CommunityGuideline` using its globally unique id and a patch. */
  updateCommunityGuidelineByNodeId?: Maybe<UpdateCommunityGuidelinePayload>;
  updateDataHostingQuota?: Maybe<UpdateDataHostingQuotaPayload>;
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
  /** Updates a single `OfflineTileSetting` using a unique key and a patch. */
  updateOfflineTileSetting?: Maybe<UpdateOfflineTileSettingPayload>;
  /** Updates a single `OfflineTileSetting` using its globally unique id and a patch. */
  updateOfflineTileSettingByNodeId?: Maybe<UpdateOfflineTileSettingPayload>;
  /** Updates a single `OfflineTileSetting` using a unique key and a patch. */
  updateOfflineTileSettingByProjectIdAndBasemapId?: Maybe<UpdateOfflineTileSettingPayload>;
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
  /**
   * If preprocessing is enabled,
   * the sketch's final geometry will be set by running the proprocessing
   * function again on userGeom. This ensures the value conforms to the
   * project's rules, and also benefits the user in that they need not submit
   * a huge geometry to the server.
   *
   * When updating a sketch, be sure to use the Sketch.parentCollection
   * association to update the client graphql cache with an up to date
   * updatedAt timestamp. This will ensure a correct cache key is used when
   * requesting collection reports.
   */
  updateSketch?: Maybe<Sketch>;
  /** Updates a single `SketchClass` using a unique key and a patch. */
  updateSketchClass?: Maybe<UpdateSketchClassPayload>;
  /** Updates a single `SketchClass` using a unique key and a patch. */
  updateSketchClassByFormElementId?: Maybe<UpdateSketchClassPayload>;
  /** Updates a single `SketchClass` using its globally unique id and a patch. */
  updateSketchClassByNodeId?: Maybe<UpdateSketchClassPayload>;
  /** Admin mutation for updating the mapbox gl style for a sketch class */
  updateSketchClassMapboxGLStyle: SketchClass;
  /** Updates a single `SketchFolder` using a unique key and a patch. */
  updateSketchFolder?: Maybe<UpdateSketchFolderPayload>;
  /** Updates a single `SketchFolder` using its globally unique id and a patch. */
  updateSketchFolderByNodeId?: Maybe<UpdateSketchFolderPayload>;
  updateSketchParent?: Maybe<UpdateSketchParentPayload>;
  /**
   * Create to respond to drag & drop actions in the sketch table of contents.
   * Can assign a folder_id or collection_id to one or multiple Sketches or
   * SketchFolders.
   *
   * Returns an updatedCollections property which should be used to update the
   * updatedAt property on related collections so that correct cache keys are
   * used when requesting reports.
   */
  updateSketchTocItemParent?: Maybe<UpdateSketchTocItemParentResults>;
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
export type MutationAlternateLanguageLabelsForFormElementArgs = {
  input: AlternateLanguageLabelsForFormElementInput;
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
export type MutationCancelDataUploadArgs = {
  input: CancelDataUploadInput;
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
export type MutationCopySketchArgs = {
  input: CopySketchInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCopySketchFolderArgs = {
  input: CopySketchFolderInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCopySketchTocItemArgs = {
  forForum?: Maybe<Scalars['Boolean']>;
  id: Scalars['Int'];
  type: SketchChildType;
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
export type MutationCreateDataUploadArgs = {
  input: CreateDataUploadInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateFileUploadArgs = {
  contentType: Scalars['String'];
  filename: Scalars['String'];
  fileSizeBytes: Scalars['Int'];
  projectId: Scalars['Int'];
  usage: FileUploadUsageInput;
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
export type MutationCreateMapBookmarkArgs = {
  input: CreateMapBookmarkInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateOfflineTileSettingArgs = {
  input: CreateOfflineTileSettingInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateOptionalBasemapLayerArgs = {
  input: CreateOptionalBasemapLayerInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreatePostArgs = {
  message: Scalars['JSON'];
  topicId: Scalars['Int'];
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
  collectionId?: Maybe<Scalars['Int']>;
  folderId?: Maybe<Scalars['Int']>;
  name: Scalars['String'];
  properties: Scalars['JSON'];
  sketchClassId: Scalars['Int'];
  userGeom?: Maybe<Scalars['GeoJSON']>;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateSketchClassFromTemplateArgs = {
  input: CreateSketchClassFromTemplateInput;
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
export type MutationCreateSurveyResponseV2Args = {
  input: CreateSurveyResponseV2Input;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateTableOfContentsItemArgs = {
  input: CreateTableOfContentsItemInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateTopicArgs = {
  forumId: Scalars['Int'];
  message: Scalars['JSON'];
  title: Scalars['String'];
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateVisibilityLogicRuleArgs = {
  input: CreateVisibilityLogicRuleInput;
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
export type MutationDeleteOfflineTilePackageArgs = {
  input: DeleteOfflineTilePackageInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteOfflineTileSettingArgs = {
  input: DeleteOfflineTileSettingInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteOfflineTileSettingByNodeIdArgs = {
  input: DeleteOfflineTileSettingByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteOfflineTileSettingByProjectIdAndBasemapIdArgs = {
  input: DeleteOfflineTileSettingByProjectIdAndBasemapIdInput;
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
export type MutationDeleteSketchTocItemsArgs = {
  items: Array<Maybe<UpdateTocItemParentInput>>;
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
export type MutationDenyParticipantArgs = {
  input: DenyParticipantInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDisableForumPostingArgs = {
  input: DisableForumPostingInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDismissFailedUploadArgs = {
  input: DismissFailedUploadInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationEnableForumPostingArgs = {
  input: EnableForumPostingInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationEnableOfflineSupportArgs = {
  input: EnableOfflineSupportInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationFailDataUploadArgs = {
  input: FailDataUploadInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationGenerateOfflineTilePackageArgs = {
  input: GenerateOfflineTilePackageInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationGetChildFoldersRecursiveArgs = {
  input: GetChildFoldersRecursiveInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationGetOrCreateSpriteArgs = {
  height: Scalars['Int'];
  pixelRatio: Scalars['Int'];
  projectId: Scalars['Int'];
  smallestImage: Scalars['Upload'];
  type?: Maybe<Scalars['String']>;
  width: Scalars['Int'];
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationGrantAdminAccessArgs = {
  input: GrantAdminAccessInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationImportArcgisServicesArgs = {
  input: ImportArcgisServicesInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationJoinProjectArgs = {
  input: JoinProjectInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationLabelForFormElementValueArgs = {
  input: LabelForFormElementValueInput;
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
export type MutationMergeTranslatedPropsArgs = {
  input: MergeTranslatedPropsInput;
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
export type MutationSendEmailVerificationArgs = {
  redirectUrl?: Maybe<Scalars['String']>;
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
  backgroundPalette: Array<Maybe<Scalars['String']>>;
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
export type MutationSetTranslatedPropArgs = {
  id: Scalars['Int'];
  propName: Scalars['String'];
  translations: Array<TranslatedPropInput>;
  typeName: Scalars['String'];
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSetUserGroupsArgs = {
  input: SetUserGroupsInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationShareSpriteArgs = {
  input: ShareSpriteInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSoftDeleteSpriteArgs = {
  input: SoftDeleteSpriteInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSubmitDataUploadArgs = {
  input: SubmitDataUploadInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationTableOfContentsItemsPrimaryDownloadUrlArgs = {
  input: TableOfContentsItemsPrimaryDownloadUrlInput;
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
export type MutationToggleLanguageSupportArgs = {
  input: ToggleLanguageSupportInput;
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
export type MutationUpdateBasemapOfflineTileSettingsArgs = {
  input: UpdateBasemapOfflineTileSettingsInput;
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
export type MutationUpdateDataHostingQuotaArgs = {
  input: UpdateDataHostingQuotaInput;
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
export type MutationUpdateOfflineTileSettingArgs = {
  input: UpdateOfflineTileSettingInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateOfflineTileSettingByNodeIdArgs = {
  input: UpdateOfflineTileSettingByNodeIdInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateOfflineTileSettingByProjectIdAndBasemapIdArgs = {
  input: UpdateOfflineTileSettingByProjectIdAndBasemapIdInput;
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
  id: Scalars['Int'];
  name: Scalars['String'];
  properties: Scalars['JSON'];
  userGeom?: Maybe<Scalars['GeoJSON']>;
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
export type MutationUpdateSketchClassMapboxGlStyleArgs = {
  sketchClassId: Scalars['Int'];
  style?: Maybe<Scalars['JSON']>;
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
export type MutationUpdateSketchParentArgs = {
  input: UpdateSketchParentInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateSketchTocItemParentArgs = {
  collectionId?: Maybe<Scalars['Int']>;
  folderId?: Maybe<Scalars['Int']>;
  tocItems: Array<Maybe<UpdateTocItemParentInput>>;
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
  id?: Maybe<Scalars['Int']>;
  name: Scalars['String'];
  projectId: Scalars['Int'];
  style: Scalars['JSON'];
  surveysOnly?: Maybe<Scalars['Boolean']>;
  thumb: Scalars['Upload'];
};

/** An object with a globally unique `ID`. */
export type Node = {
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
};

export type OfflineSourceDetails = {
  __typename?: 'OfflineSourceDetails';
  dataSourceUrl: Scalars['String'];
  templateUrl: Scalars['String'];
  /** Whether a tile packages is available for download */
  tilePackages: Array<OfflineTilePackage>;
  type: OfflineTilePackageSourceType;
};

/** Provides information on resources necessary to use a basemap offline */
export type OfflineSupportInformation = {
  __typename?: 'OfflineSupportInformation';
  hasUncacheableSources: Scalars['Boolean'];
  id: Scalars['ID'];
  sources: Array<OfflineSourceDetails>;
  staticAssets: Array<CacheableOfflineAsset>;
  styleLastModified?: Maybe<Scalars['Date']>;
};

export type OfflineTilePackage = Node & {
  __typename?: 'OfflineTilePackage';
  bytes: Scalars['Int'];
  createdAt: Scalars['Datetime'];
  dataSourceUrl: Scalars['String'];
  /** @deprecated Use jobErrors instead */
  error?: Maybe<Scalars['String']>;
  id: Scalars['UUID'];
  isMapboxHosted: Scalars['Boolean'];
  jobErrors?: Maybe<Scalars['String']>;
  jobStatus?: Maybe<OfflineTilePackageStatus>;
  maxShorelineZ?: Maybe<Scalars['Int']>;
  maxZ: Scalars['Int'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  originalUrlTemplate: Scalars['String'];
  /** Can be used to download a tilepackage (if permitted) */
  presignedUrl: Scalars['String'];
  /** Reads a single `Project` that is related to this `OfflineTilePackage`. */
  project?: Maybe<Project>;
  projectId: Scalars['Int'];
  region: GeometryPolygon;
  sourceType: OfflineTilePackageSourceType;
  /** @deprecated Use jobStatus instead */
  status: OfflineTilePackageStatus;
  tilesFetched: Scalars['Int'];
  totalTiles: Scalars['Int'];
};

/**
 * A condition to be used against `OfflineTilePackage` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type OfflineTilePackageCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['UUID']>;
  /** Checks for equality with the object’s `projectId` field. */
  projectId?: Maybe<Scalars['Int']>;
};

export enum OfflineTilePackageSourceType {
  Raster = 'RASTER',
  RasterDem = 'RASTER_DEM',
  Vector = 'VECTOR'
}

export enum OfflineTilePackageStatus {
  Complete = 'COMPLETE',
  Failed = 'FAILED',
  Generating = 'GENERATING',
  Queued = 'QUEUED',
  Uploading = 'UPLOADING'
}

/** A connection to a list of `OfflineTilePackage` values. */
export type OfflineTilePackagesConnection = {
  __typename?: 'OfflineTilePackagesConnection';
  /** A list of edges which contains the `OfflineTilePackage` and cursor to aid in pagination. */
  edges: Array<OfflineTilePackagesEdge>;
  /** A list of `OfflineTilePackage` objects. */
  nodes: Array<OfflineTilePackage>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `OfflineTilePackage` you could get from the connection. */
  totalCount: Scalars['Int'];
};

/** A `OfflineTilePackage` edge in the connection. */
export type OfflineTilePackagesEdge = {
  __typename?: 'OfflineTilePackagesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']>;
  /** The `OfflineTilePackage` at the end of the edge. */
  node: OfflineTilePackage;
};

/** Methods to use when ordering `OfflineTilePackage`. */
export enum OfflineTilePackagesOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ProjectIdAsc = 'PROJECT_ID_ASC',
  ProjectIdDesc = 'PROJECT_ID_DESC'
}

export type OfflineTileSetting = Node & {
  __typename?: 'OfflineTileSetting';
  /** Reads a single `Basemap` that is related to this `OfflineTileSetting`. */
  basemap?: Maybe<Basemap>;
  basemapId?: Maybe<Scalars['Int']>;
  id: Scalars['Int'];
  maxShorelineZ?: Maybe<Scalars['Int']>;
  maxZ: Scalars['Int'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** Reads a single `Project` that is related to this `OfflineTileSetting`. */
  project?: Maybe<Project>;
  projectId: Scalars['Int'];
  region: GeometryPolygon;
};

/**
 * A condition to be used against `OfflineTileSetting` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type OfflineTileSettingCondition = {
  /** Checks for equality with the object’s `basemapId` field. */
  basemapId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `projectId` field. */
  projectId?: Maybe<Scalars['Int']>;
};

/** An input for mutations affecting `OfflineTileSetting` */
export type OfflineTileSettingInput = {
  basemapId?: Maybe<Scalars['Int']>;
  id?: Maybe<Scalars['Int']>;
  maxShorelineZ?: Maybe<Scalars['Int']>;
  maxZ?: Maybe<Scalars['Int']>;
  projectId: Scalars['Int'];
  region: Scalars['GeoJSON'];
};

/** Represents an update to a `OfflineTileSetting`. Fields that are set will be updated. */
export type OfflineTileSettingPatch = {
  basemapId?: Maybe<Scalars['Int']>;
  id?: Maybe<Scalars['Int']>;
  maxShorelineZ?: Maybe<Scalars['Int']>;
  maxZ?: Maybe<Scalars['Int']>;
  projectId?: Maybe<Scalars['Int']>;
  region?: Maybe<Scalars['GeoJSON']>;
};

/** Methods to use when ordering `OfflineTileSetting`. */
export enum OfflineTileSettingsOrderBy {
  BasemapIdAsc = 'BASEMAP_ID_ASC',
  BasemapIdDesc = 'BASEMAP_ID_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ProjectIdAsc = 'PROJECT_ID_ASC',
  ProjectIdDesc = 'PROJECT_ID_DESC'
}

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
  basemapId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
};

/** An input for mutations affecting `OptionalBasemapLayer` */
export type OptionalBasemapLayerInput = {
  basemapId: Scalars['Int'];
  defaultVisibility?: Maybe<Scalars['Boolean']>;
  description?: Maybe<Scalars['String']>;
  /**
   * Specify RADIO or SELECT if this option should be presented as a group of
   * options. Useful for mutually exclusive views like different years for the same
   * dataset, or a heatmap display of density for multiple species where a single
   * species must be chosen from a list. If left null, the option will be treated as standalone.
   */
  groupType?: Maybe<OptionalBasemapLayersGroupType>;
  id?: Maybe<Scalars['Int']>;
  /** IDs for layers in the gl style that will be toggled by this option. */
  layers?: Maybe<Array<Maybe<Scalars['String']>>>;
  /** JSON representation of a ProseMirror document with layer metadata. */
  metadata?: Maybe<Scalars['JSON']>;
  /** Label that will be given in the UI */
  name: Scalars['String'];
  options?: Maybe<Scalars['JSON']>;
};

/** Represents an update to a `OptionalBasemapLayer`. Fields that are set will be updated. */
export type OptionalBasemapLayerPatch = {
  basemapId?: Maybe<Scalars['Int']>;
  defaultVisibility?: Maybe<Scalars['Boolean']>;
  description?: Maybe<Scalars['String']>;
  /**
   * Specify RADIO or SELECT if this option should be presented as a group of
   * options. Useful for mutually exclusive views like different years for the same
   * dataset, or a heatmap display of density for multiple species where a single
   * species must be chosen from a list. If left null, the option will be treated as standalone.
   */
  groupType?: Maybe<OptionalBasemapLayersGroupType>;
  id?: Maybe<Scalars['Int']>;
  /** IDs for layers in the gl style that will be toggled by this option. */
  layers?: Maybe<Array<Maybe<Scalars['String']>>>;
  /** JSON representation of a ProseMirror document with layer metadata. */
  metadata?: Maybe<Scalars['JSON']>;
  /** Label that will be given in the UI */
  name?: Maybe<Scalars['String']>;
  options?: Maybe<Scalars['JSON']>;
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

export type OutstandingSurveyInvites = {
  __typename?: 'OutstandingSurveyInvites';
  projectId: Scalars['Int'];
  surveyId: Scalars['Int'];
  token: Scalars['String'];
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
  blurb?: Maybe<Scalars['String']>;
  bookmarkAttachmentIds: Array<Maybe<Scalars['UUID']>>;
  createdAt: Scalars['Datetime'];
  /** Reads and enables pagination through a set of `FileUpload`. */
  fileUploads?: Maybe<Array<FileUpload>>;
  /** Reads and enables pagination through a set of `FileUpload`. */
  fileUploadsConnection: FileUploadsConnection;
  /**
   * If set, the post has been hidden by a project admin. Contents of the post will
   * not be available to the client. Admins should update this field using
   * `setPostHiddenByModerator()`.
   */
  hiddenByModerator: Scalars['Boolean'];
  html: Scalars['String'];
  id: Scalars['Int'];
  /** Reads and enables pagination through a set of `MapBookmark`. */
  mapBookmarks?: Maybe<Array<MapBookmark>>;
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
  orderedAttachmentIds?: Maybe<Array<Maybe<Scalars['String']>>>;
  sketchIds?: Maybe<Array<Maybe<Scalars['Int']>>>;
  /** Reads a single `Topic` that is related to this `Post`. */
  topic?: Maybe<Topic>;
  topicId: Scalars['Int'];
};


export type PostFileUploadsArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};


export type PostFileUploadsConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<FileUploadCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<FileUploadsOrderBy>>;
};


export type PostMapBookmarksArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
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
  email?: Maybe<Scalars['Email']>;
  fullname?: Maybe<Scalars['String']>;
  nickname?: Maybe<Scalars['String']>;
  picture?: Maybe<Scalars['Upload']>;
  userId?: Maybe<Scalars['Int']>;
};

/** A connection to a list of `Profile` values. */
export type ProfilesConnection = {
  __typename?: 'ProfilesConnection';
  /** A list of edges which contains the `Profile` and cursor to aid in pagination. */
  edges: Array<ProfilesEdge>;
  /** A list of `Profile` objects. */
  nodes: Array<Profile>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Profile` you could get from the connection. */
  totalCount: Scalars['Int'];
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
  /** Reads and enables pagination through a set of `User`. */
  accessRequestsConnection: UsersConnection;
  /** Reads and enables pagination through a set of `DataUploadTask`. */
  activeDataUploads?: Maybe<Array<DataUploadTask>>;
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
  dataHostingQuota?: Maybe<Scalars['BigInt']>;
  dataHostingQuotaUsed?: Maybe<Scalars['BigInt']>;
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
  /** Reads and enables pagination through a set of `DataUploadTask`. */
  dataUploadTasksConnection: DataUploadTasksConnection;
  /** Should be a short length in order to fit in the project header. */
  description?: Maybe<Scalars['String']>;
  draftTableOfContentsHasChanges: Scalars['Boolean'];
  /**
   * Draft layer lists, accessible only to admins. Make edits to the layer list and
   * then use the `publishTableOfContents` mutation when it is ready for end-users.
   */
  draftTableOfContentsItems?: Maybe<Array<TableOfContentsItem>>;
  /** Reads and enables pagination through a set of `Forum`. */
  forums: Array<Forum>;
  /** Reads and enables pagination through a set of `Group`. */
  groups: Array<Group>;
  hideForums: Scalars['Boolean'];
  hideOverlays: Scalars['Boolean'];
  hideSketches: Scalars['Boolean'];
  id: Scalars['Int'];
  importedArcgisServices?: Maybe<Array<Maybe<Scalars['String']>>>;
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
  isOfflineEnabled?: Maybe<Scalars['Boolean']>;
  /** Reads and enables pagination through a set of `Post`. */
  latestPostsConnection: PostsConnection;
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
  /** Reads and enables pagination through a set of `OfflineTilePackage`. */
  offlineTilePackagesConnection: OfflineTilePackagesConnection;
  /** Reads and enables pagination through a set of `OfflineTileSetting`. */
  offlineTileSettings: Array<OfflineTileSetting>;
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
  /**
   * This token can be used to access this user's sketches from the geojson endpoint.
   * For example, `/sketches/123.geojson.json?access_token=xxx`
   * Returns null if user is not singed in. Can be used only for a single
   * project. Must be refreshed occasionally.
   */
  sketchGeometryToken?: Maybe<Scalars['String']>;
  /** Short identifier for the project used in the url. This property cannot be changed after project creation. */
  slug: Scalars['String'];
  /** Reads and enables pagination through a set of `Sprite`. */
  sprites?: Maybe<Array<Sprite>>;
  supportedLanguages: Array<Maybe<Scalars['String']>>;
  supportEmail: Scalars['String'];
  /** Reads and enables pagination through a set of `Basemap`. */
  surveyBasemaps?: Maybe<Array<Basemap>>;
  /** Reads and enables pagination through a set of `Survey`. */
  surveys: Array<Survey>;
  /** Public layer list. Cannot be edited directly. */
  tableOfContentsItems?: Maybe<Array<TableOfContentsItem>>;
  tableOfContentsLastPublished?: Maybe<Scalars['Datetime']>;
  translatedProps: Scalars['JSON'];
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
export type ProjectAccessRequestsConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  direction?: Maybe<SortByDirection>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<ParticipantSortBy>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectActiveDataUploadsArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
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
export type ProjectBasemapsArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectBasemapsConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<BasemapCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<BasemapsOrderBy>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectDataLayersForItemsArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  tableOfContentsItemIds?: Maybe<Array<Maybe<Scalars['Int']>>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectDataSourcesForItemsArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  tableOfContentsItemIds?: Maybe<Array<Maybe<Scalars['Int']>>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectDataUploadTasksConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<DataUploadTaskCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<DataUploadTasksOrderBy>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectDraftTableOfContentsItemsArgs = {
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
export type ProjectIsAdminArgs = {
  userId?: Maybe<Scalars['Int']>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectLatestPostsConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
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
export type ProjectOfflineTilePackagesConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<OfflineTilePackageCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<OfflineTilePackagesOrderBy>>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectOfflineTileSettingsArgs = {
  condition?: Maybe<OfflineTileSettingCondition>;
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<OfflineTileSettingsOrderBy>>;
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
export type ProjectSpritesArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};


/**
 * SeaSketch Project type. This root type contains most of the fields and queries
 * needed to drive the application.
 */
export type ProjectSurveyBasemapsArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
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
export type ProjectTableOfContentsItemsArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
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
  accessControl?: Maybe<ProjectAccessControlSetting>;
  /** Checks for equality with the object’s `dataSourcesBucketId` field. */
  dataSourcesBucketId?: Maybe<Scalars['String']>;
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `isFeatured` field. */
  isFeatured?: Maybe<Scalars['Boolean']>;
  /** Checks for equality with the object’s `name` field. */
  name?: Maybe<Scalars['String']>;
  /** Checks for equality with the object’s `slug` field. */
  slug?: Maybe<Scalars['String']>;
};

export type ProjectDraftTableOfContentsStatusPayload = {
  __typename?: 'ProjectDraftTableOfContentsStatusPayload';
  hasChanges: Scalars['Boolean'];
  project?: Maybe<Project>;
  projectId: Scalars['Int'];
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
  participationStatus?: Maybe<ParticipationStatus>;
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
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<ProjectInviteGroupCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<ProjectInviteGroupsOrderBy>>;
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
  email?: Maybe<Scalars['Email']>;
  fullname?: Maybe<Scalars['String']>;
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
  accessControl?: Maybe<ProjectAccessControlSetting>;
  dataSourcesBucketId?: Maybe<Scalars['String']>;
  /** Should be a short length in order to fit in the project header. */
  description?: Maybe<Scalars['String']>;
  hideForums?: Maybe<Scalars['Boolean']>;
  hideOverlays?: Maybe<Scalars['Boolean']>;
  hideSketches?: Maybe<Scalars['Boolean']>;
  inviteEmailSubject?: Maybe<Scalars['String']>;
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
  logoUrl?: Maybe<Scalars['Upload']>;
  mapboxPublicKey?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  region?: Maybe<Scalars['GeoJSON']>;
  translatedProps?: Maybe<Scalars['JSON']>;
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
  NameAsc = 'NAME_ASC',
  NameDesc = 'NAME_DESC',
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
  basemapId?: Maybe<Scalars['Int']>;
};

/** An input for mutations affecting `ProjectsSharedBasemap` */
export type ProjectsSharedBasemapInput = {
  basemapId: Scalars['Int'];
  projectId: Scalars['Int'];
};

/** Represents an update to a `ProjectsSharedBasemap`. Fields that are set will be updated. */
export type ProjectsSharedBasemapPatch = {
  basemapId?: Maybe<Scalars['Int']>;
  projectId?: Maybe<Scalars['Int']>;
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
  clientMutationId?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
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
  bookmarkById?: Maybe<MapBookmark>;
  /**
   * GraphQL server software build identifier. During a deployment, if changes are
   * not detected in software modules some may be skipped. So, client and server
   * version could differ.
   *
   * We return "dev" if build cannot be determined from deployment environment.
   */
  build: Scalars['String'];
  camelCase?: Maybe<Scalars['String']>;
  collectAttachmentIdsFromProsemirrorBody?: Maybe<Array<Maybe<Scalars['String']>>>;
  collectTextFromProsemirrorBodyForLabel?: Maybe<Scalars['String']>;
  communityGuideline?: Maybe<CommunityGuideline>;
  /** Reads a single `CommunityGuideline` using its globally unique `ID`. */
  communityGuidelineByNodeId?: Maybe<CommunityGuideline>;
  /** @deprecated Use projectBySlug() instead */
  currentProject?: Maybe<Project>;
  /** @deprecated Use project_access_status(slug) instead */
  currentProjectAccessStatus?: Maybe<ProjectAccessStatus>;
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
  dataUploadTask?: Maybe<DataUploadTask>;
  /** Reads a single `DataUploadTask` using its globally unique `ID`. */
  dataUploadTaskByNodeId?: Maybe<DataUploadTask>;
  /** Reads and enables pagination through a set of `DataUploadTask`. */
  dataUploadTasksConnection?: Maybe<DataUploadTasksConnection>;
  emailNotificationPreferenceByUserId?: Maybe<EmailNotificationPreference>;
  /** Reads and enables pagination through a set of `EmailNotificationPreference`. */
  emailNotificationPreferencesConnection?: Maybe<EmailNotificationPreferencesConnection>;
  extractSpriteIds?: Maybe<Array<Maybe<Scalars['Int']>>>;
  fileUpload?: Maybe<FileUpload>;
  /** Reads a single `FileUpload` using its globally unique `ID`. */
  fileUploadByNodeId?: Maybe<FileUpload>;
  /** Reads and enables pagination through a set of `FileUpload`. */
  fileUploadsConnection?: Maybe<FileUploadsConnection>;
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
  generateExportId?: Maybe<Scalars['String']>;
  generateLabel?: Maybe<Scalars['String']>;
  getDefaultDataSourcesBucket?: Maybe<Scalars['String']>;
  /** Reads and enables pagination through a set of `Survey`. */
  getSurveys?: Maybe<Array<Survey>>;
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
  isMyEmailVerified: Scalars['Boolean'];
  lcfirst?: Maybe<Scalars['String']>;
  /** Reads and enables pagination through a set of `MapBookmark`. */
  mapBookmarksConnection?: Maybe<MapBookmarksConnection>;
  /** Access the current session's User. The user is determined by the access token embedded in the `Authorization` header. */
  me?: Maybe<User>;
  /** Fetches an object given its globally unique `ID`. */
  node?: Maybe<Node>;
  /** The root query type must be a `Node` to work well with Relay 1 mutations. This just resolves to `query`. */
  nodeId: Scalars['ID'];
  offlineTilePackage?: Maybe<OfflineTilePackage>;
  /** Reads a single `OfflineTilePackage` using its globally unique `ID`. */
  offlineTilePackageByNodeId?: Maybe<OfflineTilePackage>;
  /** Reads and enables pagination through a set of `OfflineTilePackage`. */
  offlineTilePackagesConnection?: Maybe<OfflineTilePackagesConnection>;
  offlineTileSetting?: Maybe<OfflineTileSetting>;
  /** Reads a single `OfflineTileSetting` using its globally unique `ID`. */
  offlineTileSettingByNodeId?: Maybe<OfflineTileSetting>;
  offlineTileSettingByProjectIdAndBasemapId?: Maybe<OfflineTileSetting>;
  /** Reads a set of `OfflineTileSetting`. */
  offlineTileSettings?: Maybe<Array<OfflineTileSetting>>;
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
  /** Used by project administrators to access a list of public sprites promoted by the SeaSketch development team. */
  publicSprites?: Maybe<Array<Sprite>>;
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
  /** Reads and enables pagination through a set of `SketchFolder`. */
  sketchFoldersConnection?: Maybe<SketchFoldersConnection>;
  sprite?: Maybe<Sprite>;
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
  /** List of template sketch classes such as "Marine Protected Area", "MPA Network", etc. */
  templateSketchClasses?: Maybe<Array<SketchClass>>;
  tilebbox?: Maybe<GeometryInterface>;
  toGraphqlId?: Maybe<Scalars['String']>;
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
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<BasemapCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<BasemapsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryBookmarkByIdArgs = {
  id?: Maybe<Scalars['UUID']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryCamelCaseArgs = {
  snakeCase?: Maybe<Scalars['String']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryCollectAttachmentIdsFromProsemirrorBodyArgs = {
  body?: Maybe<Scalars['JSON']>;
  type?: Maybe<Scalars['String']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryCollectTextFromProsemirrorBodyForLabelArgs = {
  body?: Maybe<Scalars['JSON']>;
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
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<DataSourcesBucketCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<DataSourcesBucketsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryDataUploadTaskArgs = {
  id: Scalars['UUID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryDataUploadTaskByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryDataUploadTasksConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<DataUploadTaskCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<DataUploadTasksOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryEmailNotificationPreferenceByUserIdArgs = {
  userId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryEmailNotificationPreferencesConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<EmailNotificationPreferenceCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<EmailNotificationPreferencesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryExtractSpriteIdsArgs = {
  t?: Maybe<Scalars['String']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryFileUploadArgs = {
  id: Scalars['UUID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryFileUploadByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryFileUploadsConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<FileUploadCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<FileUploadsOrderBy>>;
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
  condition?: Maybe<FormElementTypeCondition>;
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<FormElementTypesOrderBy>>;
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
export type QueryGenerateExportIdArgs = {
  body?: Maybe<Scalars['JSON']>;
  exportId?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['Int']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryGenerateLabelArgs = {
  body?: Maybe<Scalars['JSON']>;
  id?: Maybe<Scalars['Int']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryGetSurveysArgs = {
  first?: Maybe<Scalars['Int']>;
  ids?: Maybe<Array<Maybe<Scalars['Int']>>>;
  offset?: Maybe<Scalars['Int']>;
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
export type QueryLcfirstArgs = {
  word?: Maybe<Scalars['String']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryMapBookmarksConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<MapBookmarkCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<MapBookmarksOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryNodeArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryOfflineTilePackageArgs = {
  id: Scalars['UUID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryOfflineTilePackageByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryOfflineTilePackagesConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<OfflineTilePackageCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<OfflineTilePackagesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryOfflineTileSettingArgs = {
  id: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryOfflineTileSettingByNodeIdArgs = {
  nodeId: Scalars['ID'];
};


/** The root query type which gives access points into the data universe. */
export type QueryOfflineTileSettingByProjectIdAndBasemapIdArgs = {
  basemapId: Scalars['Int'];
  projectId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryOfflineTileSettingsArgs = {
  condition?: Maybe<OfflineTileSettingCondition>;
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<OfflineTileSettingsOrderBy>>;
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
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<PostCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<PostsOrderBy>>;
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
  pid?: Maybe<Scalars['Int']>;
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
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<ProjectInviteGroupCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<ProjectInviteGroupsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryProjectPublicDetailsArgs = {
  slug?: Maybe<Scalars['String']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryProjectsConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<ProjectCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<ProjectsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryProjectsSharedBasemapByBasemapIdAndProjectIdArgs = {
  basemapId: Scalars['Int'];
  projectId: Scalars['Int'];
};


/** The root query type which gives access points into the data universe. */
export type QueryProjectsSharedBasemapsConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<ProjectsSharedBasemapCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<ProjectsSharedBasemapsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryPublicSpritesArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySessionIsBannedFromPostingArgs = {
  pid?: Maybe<Scalars['Int']>;
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
export type QuerySketchFoldersConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<SketchFolderCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<SketchFoldersOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySpriteArgs = {
  id: Scalars['Int'];
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
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<SurveyConsentDocumentCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<SurveyConsentDocumentsOrderBy>>;
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
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<SurveyResponseCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<SurveyResponsesOrderBy>>;
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
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTemplateSketchClassesArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTilebboxArgs = {
  srid?: Maybe<Scalars['Int']>;
  x?: Maybe<Scalars['Int']>;
  y?: Maybe<Scalars['Int']>;
  z?: Maybe<Scalars['Int']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryToGraphqlIdArgs = {
  id?: Maybe<Scalars['Int']>;
  type?: Maybe<Scalars['String']>;
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
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  condition?: Maybe<TopicCondition>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<TopicsOrderBy>>;
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
  clientMutationId?: Maybe<Scalars['String']>;
  elementIds?: Maybe<Array<Maybe<Scalars['Int']>>>;
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
  clientMutationId?: Maybe<Scalars['String']>;
  ruleIds?: Maybe<Array<Maybe<Scalars['Int']>>>;
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

/** All input for the `setUserGroups` mutation. */
export type SetUserGroupsInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  groups?: Maybe<Array<Maybe<Scalars['Int']>>>;
  projectId?: Maybe<Scalars['Int']>;
  userId?: Maybe<Scalars['Int']>;
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

/** All input for the `shareSprite` mutation. */
export type ShareSpriteInput = {
  category?: Maybe<Scalars['String']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  spriteId?: Maybe<Scalars['Int']>;
};

/** The output of our `shareSprite` mutation. */
export type ShareSpritePayload = {
  __typename?: 'ShareSpritePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  sprite?: Maybe<Sprite>;
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
  /**
   * If the sketch is a collection, includes an array of properties for all
   * sketches that belong to it. These objects will match the `properties` member
   * of the GeoJSON Feature representation of each sketch. This can be passed to
   * report clients in the initialization message.
   */
  childProperties?: Maybe<Scalars['JSON']>;
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
  createdAt: Scalars['Datetime'];
  /** Parent folder. Both regular sketches and collections may be nested within folders for organization purposes. */
  folderId?: Maybe<Scalars['Int']>;
  /** Reads a single `FormElement` that is related to this `Sketch`. */
  formElement?: Maybe<FormElement>;
  formElementId?: Maybe<Scalars['Int']>;
  /**
   * Use this to get a copy of the sketch with properties populated exactly as they
   * would in the geojson or mvt endpoint. Useful for seeding a client-side cache.
   */
  geojsonFeature?: Maybe<Scalars['JSON']>;
  geojsonProperties?: Maybe<Scalars['JSON']>;
  /**
   * The geometry of the Sketch **after** it has been preprocessed. This is the
   * geometry that is used for reporting. Preprocessed geometries may be extremely
   * large and complex, so it may be necessary to access them through a vector tile
   * service or some other optimization.
   */
  geom?: Maybe<GeometryGeometry>;
  id: Scalars['Int'];
  isCollection?: Maybe<Scalars['Boolean']>;
  mercatorGeometry?: Maybe<GeometryGeometry>;
  /** User provided name for the sketch. */
  name: Scalars['String'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  numVertices?: Maybe<Scalars['Int']>;
  parentCollection?: Maybe<Sketch>;
  postId?: Maybe<Scalars['Int']>;
  properties: Scalars['JSON'];
  responseId?: Maybe<Scalars['Int']>;
  sharedInForum: Scalars['Boolean'];
  /** Reads a single `SketchClass` that is related to this `Sketch`. */
  sketchClass?: Maybe<SketchClass>;
  /** SketchClass that defines the behavior of this type of sketch. */
  sketchClassId: Scalars['Int'];
  /**
   * Greater of updatedAt, createdAt, as stringified epoch timestamp.
   * Useful for requesting the latest geometry
   */
  timestamp: Scalars['String'];
  updatedAt: Scalars['Datetime'];
  /** Reads a single `User` that is related to this `Sketch`. */
  user?: Maybe<User>;
  userAttributes?: Maybe<Scalars['JSON']>;
  /**
   * Spatial feature the user directly digitized, without preprocessing. This is
   * the feature that should be used if the Sketch is later edited.
   */
  userGeom?: Maybe<GeometryGeometry>;
  /** Owner of the sketch. */
  userId?: Maybe<Scalars['Int']>;
};

export enum SketchChildType {
  Sketch = 'SKETCH',
  SketchFolder = 'SKETCH_FOLDER'
}

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
  isTemplate: Scalars['Boolean'];
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
  preprocessingEndpoint?: Maybe<Scalars['String']>;
  preprocessingProjectUrl?: Maybe<Scalars['String']>;
  /** Reads a single `Project` that is related to this `SketchClass`. */
  project?: Maybe<Project>;
  /** SketchClasses belong to a single project. */
  projectId: Scalars['Int'];
  /** Number of sketches created with this sketch class */
  sketchCount?: Maybe<Scalars['BigInt']>;
  templateDescription?: Maybe<Scalars['String']>;
  translatedProps: Scalars['JSON'];
  /** Reads and enables pagination through a set of `SketchClass`. */
  validChildren?: Maybe<Array<SketchClass>>;
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
  /** Checks for equality with the object’s `formElementId` field. */
  formElementId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `projectId` field. */
  projectId?: Maybe<Scalars['Int']>;
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
  /**
   * If set to true, (non-admin) users should not be able to digitize new features
   * using this sketch class, but they should still be able to access the sketch
   * class in order to render existing sketches of this type.
   */
  isArchived?: Maybe<Scalars['Boolean']>;
  /** Label chosen by project admins that is shown to users. */
  name?: Maybe<Scalars['String']>;
  preprocessingEndpoint?: Maybe<Scalars['String']>;
  preprocessingProjectUrl?: Maybe<Scalars['String']>;
  templateDescription?: Maybe<Scalars['String']>;
  translatedProps?: Maybe<Scalars['JSON']>;
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
  postId?: Maybe<Scalars['Int']>;
  projectId: Scalars['Int'];
  sharedInForum: Scalars['Boolean'];
  userId: Scalars['Int'];
};

/**
 * A condition to be used against `SketchFolder` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type SketchFolderCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `userId` field. */
  userId?: Maybe<Scalars['Int']>;
};

/** Represents an update to a `SketchFolder`. Fields that are set will be updated. */
export type SketchFolderPatch = {
  /** The parent sketch collection, if any. Folders can only have a single parent entity. */
  collectionId?: Maybe<Scalars['Int']>;
  /** The parent folder, if any. */
  folderId?: Maybe<Scalars['Int']>;
  id?: Maybe<Scalars['Int']>;
  name?: Maybe<Scalars['String']>;
  postId?: Maybe<Scalars['Int']>;
  projectId?: Maybe<Scalars['Int']>;
  sharedInForum?: Maybe<Scalars['Boolean']>;
  userId?: Maybe<Scalars['Int']>;
};

/** A connection to a list of `SketchFolder` values. */
export type SketchFoldersConnection = {
  __typename?: 'SketchFoldersConnection';
  /** A list of edges which contains the `SketchFolder` and cursor to aid in pagination. */
  edges: Array<SketchFoldersEdge>;
  /** A list of `SketchFolder` objects. */
  nodes: Array<SketchFolder>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `SketchFolder` you could get from the connection. */
  totalCount: Scalars['Int'];
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

/** All input for the `softDeleteSprite` mutation. */
export type SoftDeleteSpriteInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['Int']>;
};

/** The output of our `softDeleteSprite` mutation. */
export type SoftDeleteSpritePayload = {
  __typename?: 'SoftDeleteSpritePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  sprite?: Maybe<Sprite>;
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
  category?: Maybe<Scalars['String']>;
  deleted?: Maybe<Scalars['Boolean']>;
  id: Scalars['Int'];
  /**
   * Hash of lowest-dpi image in the set (pixelRatio=1). Useful for de-duplicating
   * symbols that have been imported multiple times
   */
  md5: Scalars['String'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  /** If unset, sprite will be available for use in all projects */
  projectId?: Maybe<Scalars['Int']>;
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
  condition?: Maybe<SpriteImageCondition>;
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<SpriteImagesOrderBy>>;
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
  spriteId?: Maybe<Scalars['Int']>;
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

/** All input for the `submitDataUpload` mutation. */
export type SubmitDataUploadInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['UUID']>;
};

/** The output of our `submitDataUpload` mutation. */
export type SubmitDataUploadPayload = {
  __typename?: 'SubmitDataUploadPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  dataUploadTask?: Maybe<DataUploadTask>;
  /** An edge for our `DataUploadTask`. May be used by Relay 1. */
  dataUploadTaskEdge?: Maybe<DataUploadTasksEdge>;
  /** Reads a single `Project` that is related to this `DataUploadTask`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `submitDataUpload` mutation. */
export type SubmitDataUploadPayloadDataUploadTaskEdgeArgs = {
  orderBy?: Maybe<Array<DataUploadTasksOrderBy>>;
};

/** The root subscription type: contains realtime events you can subscribe to with the `subscription` operation. */
export type Subscription = {
  __typename?: 'Subscription';
  /** Triggered on all updates to DataUploadTasks in a project */
  dataUploadTasks?: Maybe<DataUploadTaskSubscriptionPayload>;
  /** Triggered when a new post is created in the subscribed topic */
  forumActivity?: Maybe<ForumActivityPayload>;
  /**
   * Triggered when the status of a project invite changes, generally because
   * of a change in the delivery status of a related InviteEmail. Uses
   * x-ss-slug to determine appropriate project.
   */
  projectInviteStateUpdated?: Maybe<ProjectInviteStateSubscriptionPayload>;
  /** Triggered when a project's draft table of contents status changes */
  updatedDraftTableOfContentsStatus?: Maybe<ProjectDraftTableOfContentsStatusPayload>;
  /** Triggered when a map bookmark is updated */
  updatedMapBookmark?: Maybe<BookmarkPayload>;
};


/** The root subscription type: contains realtime events you can subscribe to with the `subscription` operation. */
export type SubscriptionDataUploadTasksArgs = {
  slug: Scalars['String'];
};


/** The root subscription type: contains realtime events you can subscribe to with the `subscription` operation. */
export type SubscriptionForumActivityArgs = {
  slug: Scalars['String'];
};


/** The root subscription type: contains realtime events you can subscribe to with the `subscription` operation. */
export type SubscriptionUpdatedDraftTableOfContentsStatusArgs = {
  slug: Scalars['String'];
};


/** The root subscription type: contains realtime events you can subscribe to with the `subscription` operation. */
export type SubscriptionUpdatedMapBookmarkArgs = {
  id: Scalars['UUID'];
};

export type Survey = Node & {
  __typename?: 'Survey';
  /** PUBLIC or INVITE_ONLY */
  accessType: SurveyAccessType;
  archivedResponseCount?: Maybe<Scalars['Int']>;
  /** Reads and enables pagination through a set of `Basemap`. */
  basemaps?: Maybe<Array<Basemap>>;
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
  responsesSpatialExtent?: Maybe<Scalars['String']>;
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


export type SurveyBasemapsArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
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


export type SurveySurveyInvitedGroupsArgs = {
  condition?: Maybe<SurveyInvitedGroupCondition>;
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
  orderBy?: Maybe<Array<SurveyInvitedGroupsOrderBy>>;
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

export enum SurveyAccessType {
  InviteOnly = 'INVITE_ONLY',
  Public = 'PUBLIC'
}

/** A condition to be used against `Survey` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type SurveyCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `projectId` field. */
  projectId?: Maybe<Scalars['Int']>;
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
  formElementId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
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

export type SurveyInviteOptionsInput = {
  email?: Maybe<Scalars['Email']>;
  fullname?: Maybe<Scalars['String']>;
};

/** Represents an update to a `SurveyInvite`. Fields that are set will be updated. */
export type SurveyInvitePatch = {
  fullname?: Maybe<Scalars['String']>;
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
  groupId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `surveyId` field. */
  surveyId?: Maybe<Scalars['Int']>;
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
  accessType?: Maybe<SurveyAccessType>;
  /** If set, responses that originate from an IP address outside this fence will be flagged. */
  geofence?: Maybe<Scalars['GeoJSON']>;
  id?: Maybe<Scalars['Int']>;
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
  showFacilitationOption?: Maybe<Scalars['Boolean']>;
  showProgress?: Maybe<Scalars['Boolean']>;
  /**
   * Only applicable for public surveys. Show tools to respondants for sharing the
   * survey on social media to encourage responses.
   */
  showSocialMediaButtons?: Maybe<Scalars['Boolean']>;
  supportedLanguages?: Maybe<Array<Maybe<Scalars['String']>>>;
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
   * Should be used by clients to uniquely identify responses that are collected
   * offline. Survey facilitators can download their responses to disk as json so
   * that they may be recovered/submitted in the case of the client machine being
   * damaged or stolen. Tracking an offline uuid ensures that these responses are
   * not somehow submitted in duplicate.
   */
  offlineId?: Maybe<Scalars['UUID']>;
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
  id?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `surveyId` field. */
  surveyId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `userId` field. */
  userId?: Maybe<Scalars['Int']>;
};

/** Represents an update to a `SurveyResponse`. Fields that are set will be updated. */
export type SurveyResponsePatch = {
  archived?: Maybe<Scalars['Boolean']>;
  /** JSON representation of responses, keyed by the form field export_id */
  data?: Maybe<Scalars['JSON']>;
  /** Users may save their responses for later editing before submission. After submission they can no longer edit them. */
  isDraft?: Maybe<Scalars['Boolean']>;
  isPractice?: Maybe<Scalars['Boolean']>;
  updatedAt?: Maybe<Scalars['Datetime']>;
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
  /**
   * Metadata will be returned as directly stored in the SeaSketch
   * database or computed by fetching from a 3rd party service,
   * depending on the data source type.
   */
  computedMetadata?: Maybe<Scalars['JSON']>;
  /** Reads a single `DataLayer` that is related to this `TableOfContentsItem`. */
  dataLayer?: Maybe<DataLayer>;
  /** If is_folder=false, a DataLayers visibility will be controlled by this item */
  dataLayerId?: Maybe<Scalars['Int']>;
  enableDownload: Scalars['Boolean'];
  geoprocessingReferenceId?: Maybe<Scalars['String']>;
  hasMetadata?: Maybe<Scalars['Boolean']>;
  hideChildren: Scalars['Boolean'];
  id: Scalars['Int'];
  /**
   * If set, folders with this property cannot be toggled in order to activate all
   * their children. Toggles can only be used to toggle children off
   */
  isClickOffOnly: Scalars['Boolean'];
  isCustomGlSource?: Maybe<Scalars['Boolean']>;
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
  project?: Maybe<Project>;
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
  translatedProps: Scalars['JSON'];
  usesDynamicMetadata?: Maybe<Scalars['Boolean']>;
};

/**
 * A condition to be used against `TableOfContentsItem` object types. All fields
 * are tested for equality and combined with a logical ‘and.’
 */
export type TableOfContentsItemCondition = {
  /** Checks for equality with the object’s `dataLayerId` field. */
  dataLayerId?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `id` field. */
  id?: Maybe<Scalars['Int']>;
  /** Checks for equality with the object’s `isDraft` field. */
  isDraft?: Maybe<Scalars['Boolean']>;
  /** Checks for equality with the object’s `projectId` field. */
  projectId?: Maybe<Scalars['Int']>;
};

/** An input for mutations affecting `TableOfContentsItem` */
export type TableOfContentsItemInput = {
  /** If set, users will be able to zoom to the bounds of this item. [minx, miny, maxx, maxy] */
  bounds?: Maybe<Array<Maybe<Scalars['BigFloat']>>>;
  /** If is_folder=false, a DataLayers visibility will be controlled by this item */
  dataLayerId?: Maybe<Scalars['Int']>;
  enableDownload?: Maybe<Scalars['Boolean']>;
  hideChildren?: Maybe<Scalars['Boolean']>;
  /**
   * If set, folders with this property cannot be toggled in order to activate all
   * their children. Toggles can only be used to toggle children off
   */
  isClickOffOnly?: Maybe<Scalars['Boolean']>;
  /** If not a folder, the item is a layer-type and must have a data_layer_id */
  isFolder?: Maybe<Scalars['Boolean']>;
  /** DraftJS compatible representation of text content to display when a user requests layer metadata. Not valid for Folders */
  metadata?: Maybe<Scalars['JSON']>;
  /**
   * stable_id of the parent folder, if any. This property cannot be changed
   * directly. To rearrange items into folders, use the
   * `updateTableOfContentsItemParent` mutation.
   */
  parentStableId?: Maybe<Scalars['String']>;
  projectId: Scalars['Int'];
  /** If set, children of this folder will appear as radio options so that only one may be toggle at a time */
  showRadioChildren?: Maybe<Scalars['Boolean']>;
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
  bounds?: Maybe<Array<Maybe<Scalars['BigFloat']>>>;
  /** If is_folder=false, a DataLayers visibility will be controlled by this item */
  dataLayerId?: Maybe<Scalars['Int']>;
  enableDownload?: Maybe<Scalars['Boolean']>;
  geoprocessingReferenceId?: Maybe<Scalars['String']>;
  hideChildren?: Maybe<Scalars['Boolean']>;
  /**
   * If set, folders with this property cannot be toggled in order to activate all
   * their children. Toggles can only be used to toggle children off
   */
  isClickOffOnly?: Maybe<Scalars['Boolean']>;
  /** DraftJS compatible representation of text content to display when a user requests layer metadata. Not valid for Folders */
  metadata?: Maybe<Scalars['JSON']>;
  /** If set, children of this folder will appear as radio options so that only one may be toggle at a time */
  showRadioChildren?: Maybe<Scalars['Boolean']>;
  /** Name used in the table of contents rendering */
  title?: Maybe<Scalars['String']>;
  translatedProps?: Maybe<Scalars['JSON']>;
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

/** All input for the `tableOfContentsItemsPrimaryDownloadUrl` mutation. */
export type TableOfContentsItemsPrimaryDownloadUrlInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  item?: Maybe<TableOfContentsItemInput>;
};

/** The output of our `tableOfContentsItemsPrimaryDownloadUrl` mutation. */
export type TableOfContentsItemsPrimaryDownloadUrlPayload = {
  __typename?: 'TableOfContentsItemsPrimaryDownloadUrlPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  string?: Maybe<Scalars['String']>;
};

export enum TileScheme {
  Tms = 'TMS',
  Xyz = 'XYZ'
}

export type TocItemDetails = {
  __typename?: 'TocItemDetails';
  id: Scalars['Int'];
  type: SketchChildType;
};

/** All input for the `toggleAdminAccess` mutation. */
export type ToggleAdminAccessInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
  userId?: Maybe<Scalars['Int']>;
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
  clientMutationId?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
  userId?: Maybe<Scalars['Int']>;
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

/** All input for the `toggleLanguageSupport` mutation. */
export type ToggleLanguageSupportInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  code?: Maybe<Scalars['String']>;
  enable?: Maybe<Scalars['Boolean']>;
  slug?: Maybe<Scalars['String']>;
};

/** The output of our `toggleLanguageSupport` mutation. */
export type ToggleLanguageSupportPayload = {
  __typename?: 'ToggleLanguageSupportPayload';
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


/** The output of our `toggleLanguageSupport` mutation. */
export type ToggleLanguageSupportPayloadProjectEdgeArgs = {
  orderBy?: Maybe<Array<ProjectsOrderBy>>;
};

/** All input for the `toggleResponsesPractice` mutation. */
export type ToggleResponsesPracticeInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  ids?: Maybe<Array<Maybe<Scalars['Int']>>>;
  isPractice?: Maybe<Scalars['Boolean']>;
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
  blurb?: Maybe<Scalars['String']>;
  createdAt: Scalars['Datetime'];
  /** Reads a single `Forum` that is related to this `Topic`. */
  forum?: Maybe<Forum>;
  forumId: Scalars['Int'];
  id: Scalars['Int'];
  lastPostDate?: Maybe<Scalars['Datetime']>;
  /**
   * Locked topics can only be posted to by project admins and will display a lock symbol.
   *
   * Can be toggled by project admins using `setTopicLocked()` mutation.
   */
  locked: Scalars['Boolean'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID'];
  participantCount?: Maybe<Scalars['Int']>;
  /** Reads and enables pagination through a set of `Profile`. */
  participantsConnection: ProfilesConnection;
  /** Reads and enables pagination through a set of `Post`. */
  postsConnection: PostsConnection;
  postsCount?: Maybe<Scalars['Int']>;
  /**
   * Sticky topics will be listed at the topic of the forum.
   *
   * Can be toggled by project admins using `setTopicSticky()` mutation.
   */
  sticky: Scalars['Boolean'];
  /** Title displayed in the topics listing. Can be updated in the first 5 minutes after creation. */
  title: Scalars['String'];
};


export type TopicParticipantsConnectionArgs = {
  after?: Maybe<Scalars['Cursor']>;
  before?: Maybe<Scalars['Cursor']>;
  first?: Maybe<Scalars['Int']>;
  last?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
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

export type TranslatedPropInput = {
  languageCode: Scalars['String'];
  value?: Maybe<Scalars['String']>;
};


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
  clientMutationId?: Maybe<Scalars['String']>;
  /** An object where the defined keys will be set on the `Acl` being updated. */
  patch: AclPatch;
};

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

/** All input for the `updateAclByTableOfContentsItemId` mutation. */
export type UpdateAclByTableOfContentsItemIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  clientMutationId?: Maybe<Scalars['String']>;
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
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `Basemap` being updated. */
  patch: BasemapPatch;
};

/** All input for the `updateBasemapOfflineTileSettings` mutation. */
export type UpdateBasemapOfflineTileSettingsInput = {
  basemapId?: Maybe<Scalars['Int']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  maxShorelineZ?: Maybe<Scalars['Int']>;
  maxZ?: Maybe<Scalars['Int']>;
  projectId?: Maybe<Scalars['Int']>;
  useDefault?: Maybe<Scalars['Boolean']>;
};

/** The output of our `updateBasemapOfflineTileSettings` mutation. */
export type UpdateBasemapOfflineTileSettingsPayload = {
  __typename?: 'UpdateBasemapOfflineTileSettingsPayload';
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


/** The output of our `updateBasemapOfflineTileSettings` mutation. */
export type UpdateBasemapOfflineTileSettingsPayloadBasemapEdgeArgs = {
  orderBy?: Maybe<Array<BasemapsOrderBy>>;
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
  orderBy?: Maybe<Array<BasemapsOrderBy>>;
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

/** All input for the `updateDataHostingQuota` mutation. */
export type UpdateDataHostingQuotaInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
  quota?: Maybe<Scalars['BigInt']>;
};

/** The output of our `updateDataHostingQuota` mutation. */
export type UpdateDataHostingQuotaPayload = {
  __typename?: 'UpdateDataHostingQuotaPayload';
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


/** The output of our `updateDataHostingQuota` mutation. */
export type UpdateDataHostingQuotaPayloadProjectEdgeArgs = {
  orderBy?: Maybe<Array<ProjectsOrderBy>>;
};

/** All input for the `updateDataLayerByInteractivitySettingsId` mutation. */
export type UpdateDataLayerByInteractivitySettingsIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  clientMutationId?: Maybe<Scalars['String']>;
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
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<DataLayersOrderBy>>;
};

/** All input for the `updateDataSourceByNodeId` mutation. */
export type UpdateDataSourceByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<DataSourcesOrderBy>>;
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

/** All input for the `updateFormByNodeId` mutation. */
export type UpdateFormByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  clientMutationId?: Maybe<Scalars['String']>;
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
  clientMutationId?: Maybe<Scalars['String']>;
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
  clientMutationId?: Maybe<Scalars['String']>;
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
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<FormElementsOrderBy>>;
};

/** All input for the `updateForm` mutation. */
export type UpdateFormInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  clientMutationId?: Maybe<Scalars['String']>;
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
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<FormLogicConditionsOrderBy>>;
};

/** All input for the `updateFormLogicRuleByNodeId` mutation. */
export type UpdateFormLogicRuleByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<FormLogicRulesOrderBy>>;
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
  orderBy?: Maybe<Array<FormsOrderBy>>;
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

/** All input for the `updateInteractivitySettingByNodeId` mutation. */
export type UpdateInteractivitySettingByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  clientMutationId?: Maybe<Scalars['String']>;
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
  clientMutationId?: Maybe<Scalars['String']>;
  projectId?: Maybe<Scalars['Int']>;
  secret?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<ProjectsOrderBy>>;
};

/** All input for the `updateOfflineTileSettingByNodeId` mutation. */
export type UpdateOfflineTileSettingByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `OfflineTileSetting` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `OfflineTileSetting` being updated. */
  patch: OfflineTileSettingPatch;
};

/** All input for the `updateOfflineTileSettingByProjectIdAndBasemapId` mutation. */
export type UpdateOfflineTileSettingByProjectIdAndBasemapIdInput = {
  basemapId: Scalars['Int'];
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** An object where the defined keys will be set on the `OfflineTileSetting` being updated. */
  patch: OfflineTileSettingPatch;
  projectId: Scalars['Int'];
};

/** All input for the `updateOfflineTileSetting` mutation. */
export type UpdateOfflineTileSettingInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  /** An object where the defined keys will be set on the `OfflineTileSetting` being updated. */
  patch: OfflineTileSettingPatch;
};

/** The output of our update `OfflineTileSetting` mutation. */
export type UpdateOfflineTileSettingPayload = {
  __typename?: 'UpdateOfflineTileSettingPayload';
  /** Reads a single `Basemap` that is related to this `OfflineTileSetting`. */
  basemap?: Maybe<Basemap>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  /** The `OfflineTileSetting` that was updated by this mutation. */
  offlineTileSetting?: Maybe<OfflineTileSetting>;
  /** Reads a single `Project` that is related to this `OfflineTileSetting`. */
  project?: Maybe<Project>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `updateOptionalBasemapLayerByNodeId` mutation. */
export type UpdateOptionalBasemapLayerByNodeIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<ProjectInviteGroupsOrderBy>>;
};

/** All input for the `updateProjectInvite` mutation. */
export type UpdateProjectInviteInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  email?: Maybe<Scalars['String']>;
  fullname?: Maybe<Scalars['String']>;
  groups?: Maybe<Array<Maybe<Scalars['Int']>>>;
  inviteId?: Maybe<Scalars['Int']>;
  makeAdmin?: Maybe<Scalars['Boolean']>;
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
  orderBy?: Maybe<Array<ProjectsOrderBy>>;
};

/** All input for the `updateProjectsSharedBasemapByBasemapIdAndProjectId` mutation. */
export type UpdateProjectsSharedBasemapByBasemapIdAndProjectIdInput = {
  basemapId: Scalars['Int'];
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<ProjectsSharedBasemapsOrderBy>>;
};

/** All input for the `updateSketchClassByFormElementId` mutation. */
export type UpdateSketchClassByFormElementIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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

/** All input for the `updateSketchParent` mutation. */
export type UpdateSketchParentInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  collectionId?: Maybe<Scalars['Int']>;
  folderId?: Maybe<Scalars['Int']>;
  id?: Maybe<Scalars['Int']>;
};

/** The output of our `updateSketchParent` mutation. */
export type UpdateSketchParentPayload = {
  __typename?: 'UpdateSketchParentPayload';
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
  sketch?: Maybe<Sketch>;
  /** Reads a single `SketchClass` that is related to this `Sketch`. */
  sketchClass?: Maybe<SketchClass>;
  /** Reads a single `User` that is related to this `Sketch`. */
  user?: Maybe<User>;
};

export type UpdateSketchTocItemParentResults = {
  __typename?: 'UpdateSketchTocItemParentResults';
  folders: Array<Maybe<SketchFolder>>;
  sketches: Array<Maybe<Sketch>>;
  updatedCollections: Array<Maybe<Sketch>>;
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

/** All input for the `updateTableOfContentsItemByDataLayerId` mutation. */
export type UpdateTableOfContentsItemByDataLayerIdInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
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
  clientMutationId?: Maybe<Scalars['String']>;
  /** The globally unique `ID` which will identify a single `TableOfContentsItem` to be updated. */
  nodeId: Scalars['ID'];
  /** An object where the defined keys will be set on the `TableOfContentsItem` being updated. */
  patch: TableOfContentsItemPatch;
};

/** All input for the `updateTableOfContentsItemChildren` mutation. */
export type UpdateTableOfContentsItemChildrenInput = {
  childIds?: Maybe<Array<Maybe<Scalars['Int']>>>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  parentId?: Maybe<Scalars['Int']>;
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
  clientMutationId?: Maybe<Scalars['String']>;
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
  orderBy?: Maybe<Array<TableOfContentsItemsOrderBy>>;
};

export type UpdateTocItemParentInput = {
  id: Scalars['Int'];
  type: SketchChildType;
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

/** All input for the `updateZIndexes` mutation. */
export type UpdateZIndexesInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: Maybe<Scalars['String']>;
  dataLayerIds?: Maybe<Array<Maybe<Scalars['Int']>>>;
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


export type UploaderResponse = {
  __typename?: 'UploaderResponse';
  cloudflareImagesUploadUrl?: Maybe<Scalars['String']>;
  fileUpload: FileUpload;
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
  accessRequestDenied?: Maybe<Scalars['Boolean']>;
  approvedBy?: Maybe<User>;
  approvedOrDeniedOn?: Maybe<Scalars['Datetime']>;
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
  deniedBy?: Maybe<User>;
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
  needsAccessRequestApproval?: Maybe<Scalars['Boolean']>;
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
export type UserAccessRequestDeniedArgs = {
  slug?: Maybe<Scalars['String']>;
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
export type UserApprovedByArgs = {
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
export type UserApprovedOrDeniedOnArgs = {
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
export type UserDeniedByArgs = {
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
export type UserGroupsArgs = {
  first?: Maybe<Scalars['Int']>;
  offset?: Maybe<Scalars['Int']>;
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
export type UserNeedsAccessRequestApprovalArgs = {
  slug?: Maybe<Scalars['String']>;
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

/** A connection to a list of `User` values. */
export type UsersConnection = {
  __typename?: 'UsersConnection';
  /** A list of edges which contains the `User` and cursor to aid in pagination. */
  edges: Array<UsersEdge>;
  /** A list of `User` objects. */
  nodes: Array<User>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `User` you could get from the connection. */
  totalCount: Scalars['Int'];
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

export type WorkerJob = {
  __typename?: 'WorkerJob';
  attempts?: Maybe<Scalars['Int']>;
  createdAt?: Maybe<Scalars['Datetime']>;
  key?: Maybe<Scalars['String']>;
  lastError?: Maybe<Scalars['String']>;
  lockedAt?: Maybe<Scalars['Datetime']>;
  maxAttempts?: Maybe<Scalars['Int']>;
  runAt?: Maybe<Scalars['Datetime']>;
  taskIdentifier?: Maybe<Scalars['String']>;
};

export enum WorkerJobStatus {
  Error = 'ERROR',
  Failed = 'FAILED',
  Finished = 'FINISHED',
  Queued = 'QUEUED',
  Started = 'STARTED'
}

export type SetTranslatedPropResult = {
  __typename?: 'setTranslatedPropResult';
  id: Scalars['Int'];
  translatedProps: Scalars['JSON'];
  typeName: Scalars['String'];
};

export type UpdateTerrainExaggerationFragment = (
  { __typename?: 'Basemap' }
  & Pick<Basemap, 'terrainExaggeration'>
);

export type NewLabelsLayerFragment = (
  { __typename?: 'Basemap' }
  & Pick<Basemap, 'labelsLayerId'>
);

export type NewTerrainFragment = (
  { __typename?: 'Basemap' }
  & Pick<Basemap, 'terrainUrl' | 'terrainOptional' | 'terrainVisibilityDefault'>
);

export type NewBasemapFragment = (
  { __typename?: 'Basemap' }
  & Pick<Basemap, 'id' | 'projectId' | 'attribution' | 'description' | 'labelsLayerId' | 'name' | 'terrainExaggeration' | 'terrainOptional' | 'url' | 'type' | 'tileSize' | 'thumbnail' | 'terrainUrl' | 'terrainTileSize' | 'surveysOnly'>
);

export type ProjectBucketSettingQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type ProjectBucketSettingQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename: 'Project' }
    & Pick<Project, 'id'>
    & { dataSourcesBucket?: Maybe<(
      { __typename?: 'DataSourcesBucket' }
      & Pick<DataSourcesBucket, 'url' | 'region' | 'name'>
      & { location: (
        { __typename?: 'GeometryPoint' }
        & Pick<GeometryPoint, 'geojson'>
      ) }
    )> }
  )>, dataSourcesBucketsConnection?: Maybe<(
    { __typename?: 'DataSourcesBucketsConnection' }
    & { nodes: Array<(
      { __typename?: 'DataSourcesBucket' }
      & Pick<DataSourcesBucket, 'url' | 'name' | 'region'>
      & { location: (
        { __typename?: 'GeometryPoint' }
        & Pick<GeometryPoint, 'geojson'>
      ) }
    )> }
  )> }
);

export type UpdateProjectStorageBucketMutationVariables = Exact<{
  slug: Scalars['String'];
  bucket: Scalars['String'];
}>;


export type UpdateProjectStorageBucketMutation = (
  { __typename?: 'Mutation' }
  & { updateProjectBySlug?: Maybe<(
    { __typename?: 'UpdateProjectPayload' }
    & Pick<UpdateProjectPayload, 'clientMutationId'>
    & { project?: Maybe<(
      { __typename: 'Project' }
      & Pick<Project, 'id'>
      & { dataSourcesBucket?: Maybe<(
        { __typename?: 'DataSourcesBucket' }
        & Pick<DataSourcesBucket, 'url' | 'region' | 'name'>
      )> }
    )> }
  )> }
);

export type UpdateFormatFragment = (
  { __typename?: 'DataSource' }
  & Pick<DataSource, 'queryParameters'>
);

export type NewGlStyleFragment = (
  { __typename?: 'DataLayer' }
  & Pick<DataLayer, 'mapboxGlStyles'>
);

export type NewRenderUnderFragment = (
  { __typename?: 'DataLayer' }
  & Pick<DataLayer, 'renderUnder'>
);

export type NewZIndexFragment = (
  { __typename?: 'DataLayer' }
  & Pick<DataLayer, 'zIndex'>
);

export type NewRuleFragment = (
  { __typename?: 'FormLogicRule' }
  & Pick<FormLogicRule, 'booleanOperator' | 'command' | 'id' | 'jumpToId' | 'position' | 'formElementId'>
  & { conditions?: Maybe<Array<(
    { __typename?: 'FormLogicCondition' }
    & Pick<FormLogicCondition, 'id' | 'operator' | 'value' | 'subjectId' | 'ruleId'>
  )>> }
);

export type NewConditionFragment = (
  { __typename?: 'FormLogicCondition' }
  & Pick<FormLogicCondition, 'id'>
);

export type NewElementFragment = (
  { __typename?: 'FormElement' }
  & Pick<FormElement, 'body' | 'componentSettings' | 'exportId' | 'formId' | 'id' | 'isRequired' | 'position' | 'jumpToId' | 'typeId' | 'backgroundColor' | 'secondaryColor' | 'backgroundImage' | 'layout' | 'backgroundPalette' | 'textVariant' | 'unsplashAuthorUrl' | 'unsplashAuthorName' | 'backgroundWidth' | 'backgroundHeight'>
  & { type?: Maybe<(
    { __typename?: 'FormElementType' }
    & Pick<FormElementType, 'componentName' | 'isHidden' | 'isInput' | 'isSingleUseOnly' | 'isSurveysOnly' | 'label' | 'supportedOperators'>
  )> }
);

export type LogicRuleEditorFormElementFragment = (
  { __typename?: 'FormElement' }
  & Pick<FormElement, 'id' | 'body' | 'typeId' | 'formId' | 'jumpToId' | 'componentSettings' | 'exportId' | 'isRequired'>
  & { type?: Maybe<(
    { __typename?: 'FormElementType' }
    & Pick<FormElementType, 'supportedOperators' | 'isInput'>
  )> }
);

export type LogicRuleEditorRuleFragment = (
  { __typename?: 'FormLogicRule' }
  & Pick<FormLogicRule, 'booleanOperator' | 'command' | 'formElementId' | 'id' | 'jumpToId' | 'position'>
  & { conditions?: Maybe<Array<(
    { __typename?: 'FormLogicCondition' }
    & Pick<FormLogicCondition, 'id' | 'operator' | 'ruleId' | 'subjectId' | 'value'>
  )>> }
);

export type NewSurveyFragment = (
  { __typename?: 'Survey' }
  & Pick<Survey, 'id' | 'accessType' | 'isDisabled' | 'limitToSingleResponse' | 'name' | 'submittedResponseCount' | 'projectId'>
  & { invitedGroups?: Maybe<Array<(
    { __typename?: 'Group' }
    & Pick<Group, 'id' | 'name'>
  )>> }
);

export type NewGroupFragment = (
  { __typename?: 'Group' }
  & Pick<Group, 'id' | 'projectId' | 'name'>
);

export type NewInviteEmailFragment = (
  { __typename?: 'InviteEmail' }
  & Pick<InviteEmail, 'id' | 'toAddress' | 'createdAt' | 'status' | 'tokenExpiresAt' | 'error' | 'updatedAt'>
);

export type NewLayerOptionsFragment = (
  { __typename?: 'OptionalBasemapLayer' }
  & Pick<OptionalBasemapLayer, 'options'>
);

export type UpdateAlternateLanguageSettingsFragment = (
  { __typename?: 'FormElement' }
  & Pick<FormElement, 'alternateLanguageSettings'>
);

export type UpdateComponentSettingsFragment = (
  { __typename?: 'FormElement' }
  & Pick<FormElement, 'componentSettings'>
);

export type UpdateBodyFragment = (
  { __typename?: 'FormElement' }
  & Pick<FormElement, 'body'>
);

export type MySketchFragment = (
  { __typename?: 'Sketch' }
  & Pick<Sketch, 'name' | 'isCollection' | 'collectionId' | 'folderId' | 'timestamp' | 'sharedInForum' | 'sketchClassId' | 'bbox'>
);

export type MyFolderFragment = (
  { __typename?: 'SketchFolder' }
  & Pick<SketchFolder, 'name' | 'collectionId' | 'folderId' | 'sharedInForum'>
);

export type PopupShareDetailsFragment = (
  { __typename?: 'Post' }
  & Pick<Post, 'id' | 'topicId'>
  & { topic?: Maybe<(
    { __typename?: 'Topic' }
    & Pick<Topic, 'id' | 'title' | 'forumId'>
  )> }
);

export type DataFragment = (
  { __typename?: 'SketchFolder' }
  & Pick<SketchFolder, 'id' | 'name'>
);

export type MapboxApiKeysQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type MapboxApiKeysQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id' | 'mapboxPublicKey' | 'mapboxSecretKey'>
  )> }
);

export type UpdatePublicKeyMutationVariables = Exact<{
  id: Scalars['Int'];
  public?: Maybe<Scalars['String']>;
}>;


export type UpdatePublicKeyMutation = (
  { __typename?: 'Mutation' }
  & { updateProject?: Maybe<(
    { __typename?: 'UpdateProjectPayload' }
    & { project?: Maybe<(
      { __typename?: 'Project' }
      & Pick<Project, 'id' | 'mapboxPublicKey'>
    )> }
  )> }
);

export type UpdateSecretKeyMutationVariables = Exact<{
  id: Scalars['Int'];
  mapboxSecretKey?: Maybe<Scalars['String']>;
}>;


export type UpdateSecretKeyMutation = (
  { __typename?: 'Mutation' }
  & { updateMapboxSecretKey?: Maybe<(
    { __typename?: 'UpdateMapboxSecretKeyPayload' }
    & { project?: Maybe<(
      { __typename?: 'Project' }
      & Pick<Project, 'id' | 'mapboxSecretKey'>
    )> }
  )> }
);

export type GetAclQueryVariables = Exact<{
  nodeId: Scalars['ID'];
}>;


export type GetAclQuery = (
  { __typename?: 'Query' }
  & { aclByNodeId?: Maybe<(
    { __typename?: 'Acl' }
    & Pick<Acl, 'id' | 'nodeId' | 'type'>
    & { groups?: Maybe<Array<(
      { __typename?: 'Group' }
      & Pick<Group, 'id' | 'name' | 'memberCount'>
    )>> }
  )> }
);

export type UpdateAclTypeMutationVariables = Exact<{
  nodeId: Scalars['ID'];
  type: AccessControlListType;
}>;


export type UpdateAclTypeMutation = (
  { __typename?: 'Mutation' }
  & { updateAclByNodeId?: Maybe<(
    { __typename?: 'UpdateAclPayload' }
    & { acl?: Maybe<(
      { __typename?: 'Acl' }
      & Pick<Acl, 'id' | 'nodeId' | 'type'>
    )> }
  )> }
);

export type AddGroupToAclMutationVariables = Exact<{
  id: Scalars['Int'];
  groupId: Scalars['Int'];
}>;


export type AddGroupToAclMutation = (
  { __typename?: 'Mutation' }
  & { addGroupToAcl?: Maybe<(
    { __typename?: 'AddGroupToAclPayload' }
    & { acl?: Maybe<(
      { __typename?: 'Acl' }
      & { groups?: Maybe<Array<(
        { __typename?: 'Group' }
        & Pick<Group, 'id' | 'name'>
      )>> }
    )> }
  )> }
);

export type RemoveGroupFromAclMutationVariables = Exact<{
  id: Scalars['Int'];
  groupId: Scalars['Int'];
}>;


export type RemoveGroupFromAclMutation = (
  { __typename?: 'Mutation' }
  & { removeGroupFromAcl?: Maybe<(
    { __typename?: 'RemoveGroupFromAclPayload' }
    & { acl?: Maybe<(
      { __typename?: 'Acl' }
      & { groups?: Maybe<Array<(
        { __typename?: 'Group' }
        & Pick<Group, 'id' | 'name'>
      )>> }
    )> }
  )> }
);

export type GroupsQueryVariables = Exact<{
  projectSlug: Scalars['String'];
}>;


export type GroupsQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id'>
    & { groups: Array<(
      { __typename?: 'Group' }
      & Pick<Group, 'id' | 'name' | 'memberCount'>
    )> }
  )> }
);

export type CreateTableOfContentsItemMutationVariables = Exact<{
  title: Scalars['String'];
  stableId: Scalars['String'];
  projectId: Scalars['Int'];
  isFolder: Scalars['Boolean'];
  parentStableId?: Maybe<Scalars['String']>;
  metadata?: Maybe<Scalars['JSON']>;
  bounds?: Maybe<Array<Maybe<Scalars['BigFloat']>> | Maybe<Scalars['BigFloat']>>;
  dataLayerId?: Maybe<Scalars['Int']>;
}>;


export type CreateTableOfContentsItemMutation = (
  { __typename?: 'Mutation' }
  & { createTableOfContentsItem?: Maybe<(
    { __typename?: 'CreateTableOfContentsItemPayload' }
    & { tableOfContentsItem?: Maybe<(
      { __typename?: 'TableOfContentsItem' }
      & Pick<TableOfContentsItem, 'id' | 'title' | 'stableId' | 'projectId' | 'parentStableId' | 'isClickOffOnly' | 'isDraft' | 'isFolder' | 'metadata' | 'bounds' | 'dataLayerId'>
    )> }
  )> }
);

export type CreateArcGisDynamicDataSourceMutationVariables = Exact<{
  projectId: Scalars['Int'];
  url: Scalars['String'];
  attribution?: Maybe<Scalars['String']>;
  bounds?: Maybe<Array<Maybe<Scalars['BigFloat']>> | Maybe<Scalars['BigFloat']>>;
  queryParameters?: Maybe<Scalars['JSON']>;
}>;


export type CreateArcGisDynamicDataSourceMutation = (
  { __typename?: 'Mutation' }
  & { createDataSource?: Maybe<(
    { __typename?: 'CreateDataSourcePayload' }
    & { dataSource?: Maybe<(
      { __typename?: 'DataSource' }
      & Pick<DataSource, 'id' | 'projectId' | 'type' | 'url'>
    )> }
  )> }
);

export type CreateArcGisImageSourceMutationVariables = Exact<{
  projectId: Scalars['Int'];
  url: Scalars['String'];
  attribution?: Maybe<Scalars['String']>;
  bounds?: Maybe<Array<Maybe<Scalars['BigFloat']>> | Maybe<Scalars['BigFloat']>>;
  queryParameters?: Maybe<Scalars['JSON']>;
  enableHighDPI?: Maybe<Scalars['Boolean']>;
  supportsDynamicLayers: Scalars['Boolean'];
}>;


export type CreateArcGisImageSourceMutation = (
  { __typename?: 'Mutation' }
  & { createDataSource?: Maybe<(
    { __typename?: 'CreateDataSourcePayload' }
    & { dataSource?: Maybe<(
      { __typename?: 'DataSource' }
      & Pick<DataSource, 'id' | 'url'>
    )> }
  )> }
);

export type CreateSeaSketchVectorSourceMutationVariables = Exact<{
  projectId: Scalars['Int'];
  attribution?: Maybe<Scalars['String']>;
  bounds: Array<Maybe<Scalars['BigFloat']>> | Maybe<Scalars['BigFloat']>;
  byteLength: Scalars['Int'];
  originalSourceUrl?: Maybe<Scalars['String']>;
  importType: DataSourceImportTypes;
  enhancedSecurity: Scalars['Boolean'];
}>;


export type CreateSeaSketchVectorSourceMutation = (
  { __typename?: 'Mutation' }
  & { createDataSource?: Maybe<(
    { __typename?: 'CreateDataSourcePayload' }
    & { dataSource?: Maybe<(
      { __typename?: 'DataSource' }
      & Pick<DataSource, 'id' | 'projectId' | 'type' | 'url' | 'presignedUploadUrl' | 'enhancedSecurity'>
    )> }
  )> }
);

export type CreateDataLayerMutationVariables = Exact<{
  projectId: Scalars['Int'];
  dataSourceId: Scalars['Int'];
  mapboxGlStyles?: Maybe<Scalars['JSON']>;
  renderUnder?: Maybe<RenderUnderType>;
  sublayer?: Maybe<Scalars['String']>;
}>;


export type CreateDataLayerMutation = (
  { __typename?: 'Mutation' }
  & { createDataLayer?: Maybe<(
    { __typename?: 'CreateDataLayerPayload' }
    & { dataLayer?: Maybe<(
      { __typename?: 'DataLayer' }
      & Pick<DataLayer, 'id' | 'dataSourceId' | 'zIndex'>
      & { interactivitySettings?: Maybe<(
        { __typename?: 'InteractivitySetting' }
        & Pick<InteractivitySetting, 'cursor' | 'id' | 'longTemplate' | 'shortTemplate' | 'type'>
      )> }
    )> }
  )> }
);

export type GetOrCreateSpriteMutationVariables = Exact<{
  height: Scalars['Int'];
  width: Scalars['Int'];
  pixelRatio: Scalars['Int'];
  projectId: Scalars['Int'];
  smallestImage: Scalars['Upload'];
}>;


export type GetOrCreateSpriteMutation = (
  { __typename?: 'Mutation' }
  & { getOrCreateSprite?: Maybe<(
    { __typename?: 'Sprite' }
    & Pick<Sprite, 'id' | 'md5' | 'projectId' | 'type'>
    & { spriteImages: Array<(
      { __typename?: 'SpriteImage' }
      & Pick<SpriteImage, 'spriteId' | 'height' | 'pixelRatio' | 'url' | 'width'>
    )> }
  )> }
);

export type AddImageToSpriteMutationVariables = Exact<{
  spriteId: Scalars['Int'];
  width: Scalars['Int'];
  height: Scalars['Int'];
  pixelRatio: Scalars['Int'];
  image: Scalars['Upload'];
}>;


export type AddImageToSpriteMutation = (
  { __typename?: 'Mutation' }
  & { addImageToSprite?: Maybe<(
    { __typename?: 'Sprite' }
    & Pick<Sprite, 'id' | 'md5' | 'projectId' | 'type'>
    & { spriteImages: Array<(
      { __typename?: 'SpriteImage' }
      & Pick<SpriteImage, 'spriteId' | 'height' | 'pixelRatio' | 'url' | 'width'>
    )> }
  )> }
);

export type VerifyProjectInviteQueryVariables = Exact<{
  token: Scalars['String'];
}>;


export type VerifyProjectInviteQuery = (
  { __typename?: 'Query' }
  & { verifyProjectInvite?: Maybe<(
    { __typename?: 'ProjectInviteTokenVerificationResults' }
    & Pick<ProjectInviteTokenVerificationResults, 'error' | 'existingAccount'>
    & { claims?: Maybe<(
      { __typename?: 'ProjectInviteTokenClaims' }
      & Pick<ProjectInviteTokenClaims, 'admin' | 'email' | 'fullname' | 'inviteId' | 'projectId' | 'wasUsed' | 'projectSlug'>
    )> }
  )> }
);

export type ConfirmProjectInviteMutationVariables = Exact<{
  token: Scalars['String'];
}>;


export type ConfirmProjectInviteMutation = (
  { __typename?: 'Mutation' }
  & { confirmProjectInvite?: Maybe<(
    { __typename?: 'ProjectInviteTokenClaims' }
    & Pick<ProjectInviteTokenClaims, 'admin' | 'email' | 'fullname' | 'inviteId' | 'projectId' | 'projectName' | 'wasUsed' | 'projectSlug'>
  )> }
);

export type ResendEmailVerificationMutationVariables = Exact<{ [key: string]: never; }>;


export type ResendEmailVerificationMutation = (
  { __typename?: 'Mutation' }
  & { resendVerificationEmail: (
    { __typename?: 'SendVerificationEmailResults' }
    & Pick<SendVerificationEmailResults, 'success' | 'error'>
  ) }
);

export type RequestInviteOnlyProjectAccessMutationVariables = Exact<{
  projectId: Scalars['Int'];
}>;


export type RequestInviteOnlyProjectAccessMutation = (
  { __typename?: 'Mutation' }
  & { joinProject?: Maybe<(
    { __typename?: 'JoinProjectPayload' }
    & Pick<JoinProjectPayload, 'clientMutationId'>
  )> }
);

export type BasemapDetailsFragment = (
  { __typename?: 'Basemap' }
  & Pick<Basemap, 'id' | 'attribution' | 'labelsLayerId' | 'name' | 'description' | 'projectId' | 'terrainExaggeration' | 'terrainMaxZoom' | 'terrainOptional' | 'terrainTileSize' | 'terrainUrl' | 'terrainVisibilityDefault' | 'thumbnail' | 'tileSize' | 'type' | 'url' | 'surveysOnly' | 'translatedProps' | 'isArcgisTiledMapservice' | 'maxzoom'>
  & { interactivitySettings?: Maybe<(
    { __typename?: 'InteractivitySetting' }
    & Pick<InteractivitySetting, 'cursor' | 'id' | 'layers' | 'longTemplate' | 'shortTemplate' | 'type'>
  )>, optionalBasemapLayers: Array<(
    { __typename?: 'OptionalBasemapLayer' }
    & Pick<OptionalBasemapLayer, 'basemapId' | 'id' | 'defaultVisibility' | 'description' | 'options' | 'groupType' | 'layers' | 'metadata' | 'name'>
  )> }
);

export type GetBasemapsQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type GetBasemapsQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id'>
    & { surveyBasemaps?: Maybe<Array<(
      { __typename?: 'Basemap' }
      & BasemapDetailsFragment
    )>>, basemaps?: Maybe<Array<(
      { __typename?: 'Basemap' }
      & BasemapDetailsFragment
    )>> }
  )> }
);

export type CreateBasemapMutationVariables = Exact<{
  projectId?: Maybe<Scalars['Int']>;
  name: Scalars['String'];
  thumbnail: Scalars['Upload'];
  tileSize?: Maybe<Scalars['Int']>;
  type: BasemapType;
  url: Scalars['String'];
  surveysOnly?: Maybe<Scalars['Boolean']>;
  isArcgisTiledMapservice?: Maybe<Scalars['Boolean']>;
}>;


export type CreateBasemapMutation = (
  { __typename?: 'Mutation' }
  & { createBasemap?: Maybe<(
    { __typename?: 'CreateBasemapPayload' }
    & { basemap?: Maybe<(
      { __typename?: 'Basemap' }
      & BasemapDetailsFragment
    )> }
  )> }
);

export type UploadBasemapMutationVariables = Exact<{
  projectId: Scalars['Int'];
  name: Scalars['String'];
  thumbnail: Scalars['Upload'];
  existingId?: Maybe<Scalars['Int']>;
  style: Scalars['JSON'];
  surveysOnly?: Maybe<Scalars['Boolean']>;
}>;


export type UploadBasemapMutation = (
  { __typename?: 'Mutation' }
  & { uploadStyle: (
    { __typename?: 'Basemap' }
    & BasemapDetailsFragment
  ) }
);

export type BasemapAdminDetailsFragment = (
  { __typename?: 'Basemap' }
  & Pick<Basemap, 'id' | 'attribution' | 'description' | 'labelsLayerId' | 'name' | 'projectId' | 'terrainExaggeration' | 'terrainMaxZoom' | 'terrainOptional' | 'terrainTileSize' | 'terrainUrl' | 'terrainVisibilityDefault' | 'thumbnail' | 'tileSize' | 'type' | 'url' | 'surveysOnly' | 'isArcgisTiledMapservice'>
  & { interactivitySettings?: Maybe<(
    { __typename?: 'InteractivitySetting' }
    & Pick<InteractivitySetting, 'cursor' | 'id' | 'layers' | 'longTemplate' | 'shortTemplate' | 'type'>
  )>, optionalBasemapLayers: Array<(
    { __typename?: 'OptionalBasemapLayer' }
    & Pick<OptionalBasemapLayer, 'basemapId' | 'defaultVisibility' | 'description' | 'options' | 'groupType' | 'id' | 'layers' | 'metadata' | 'name'>
  )> }
  & BasemapDetailsFragment
);

export type GetBasemapQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type GetBasemapQuery = (
  { __typename?: 'Query' }
  & { basemap?: Maybe<(
    { __typename?: 'Basemap' }
    & BasemapAdminDetailsFragment
  )> }
);

export type UpdateBasemapMutationVariables = Exact<{
  id: Scalars['Int'];
  name?: Maybe<Scalars['String']>;
}>;


export type UpdateBasemapMutation = (
  { __typename?: 'Mutation' }
  & { updateBasemap?: Maybe<(
    { __typename?: 'UpdateBasemapPayload' }
    & { basemap?: Maybe<(
      { __typename?: 'Basemap' }
      & Pick<Basemap, 'name' | 'id'>
    )> }
  )> }
);

export type UpdateBasemapUrlMutationVariables = Exact<{
  id: Scalars['Int'];
  url: Scalars['String'];
}>;


export type UpdateBasemapUrlMutation = (
  { __typename?: 'Mutation' }
  & { updateBasemap?: Maybe<(
    { __typename?: 'UpdateBasemapPayload' }
    & { basemap?: Maybe<(
      { __typename?: 'Basemap' }
      & Pick<Basemap, 'url' | 'id'>
    )> }
  )> }
);

export type UpdateBasemapLabelsLayerMutationVariables = Exact<{
  id: Scalars['Int'];
  layer?: Maybe<Scalars['String']>;
}>;


export type UpdateBasemapLabelsLayerMutation = (
  { __typename?: 'Mutation' }
  & { updateBasemap?: Maybe<(
    { __typename?: 'UpdateBasemapPayload' }
    & { basemap?: Maybe<(
      { __typename?: 'Basemap' }
      & Pick<Basemap, 'id' | 'labelsLayerId'>
    )> }
  )> }
);

export type Toggle3dTerrainMutationVariables = Exact<{
  id: Scalars['Int'];
  terrainUrl?: Maybe<Scalars['String']>;
}>;


export type Toggle3dTerrainMutation = (
  { __typename?: 'Mutation' }
  & { updateBasemap?: Maybe<(
    { __typename?: 'UpdateBasemapPayload' }
    & { basemap?: Maybe<(
      { __typename?: 'Basemap' }
      & Pick<Basemap, 'id' | 'terrainUrl'>
    )> }
  )> }
);

export type Set3dTerrainMutationVariables = Exact<{
  id: Scalars['Int'];
  terrainUrl?: Maybe<Scalars['String']>;
  terrainOptional?: Maybe<Scalars['Boolean']>;
  terrainVisibilityDefault?: Maybe<Scalars['Boolean']>;
}>;


export type Set3dTerrainMutation = (
  { __typename?: 'Mutation' }
  & { updateBasemap?: Maybe<(
    { __typename?: 'UpdateBasemapPayload' }
    & { basemap?: Maybe<(
      { __typename?: 'Basemap' }
      & Pick<Basemap, 'id' | 'terrainUrl' | 'terrainVisibilityDefault' | 'terrainOptional'>
    )> }
  )> }
);

export type UpdateTerrainExaggerationMutationVariables = Exact<{
  id: Scalars['Int'];
  terrainExaggeration: Scalars['BigFloat'];
}>;


export type UpdateTerrainExaggerationMutation = (
  { __typename?: 'Mutation' }
  & { updateBasemap?: Maybe<(
    { __typename?: 'UpdateBasemapPayload' }
    & { basemap?: Maybe<(
      { __typename?: 'Basemap' }
      & Pick<Basemap, 'id' | 'terrainExaggeration'>
    )> }
  )> }
);

export type DeleteBasemapMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteBasemapMutation = (
  { __typename?: 'Mutation' }
  & { deleteBasemap?: Maybe<(
    { __typename?: 'DeleteBasemapPayload' }
    & { basemap?: Maybe<(
      { __typename?: 'Basemap' }
      & Pick<Basemap, 'id'>
    )> }
  )> }
);

export type OptionalLayerQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type OptionalLayerQuery = (
  { __typename?: 'Query' }
  & { optionalBasemapLayer?: Maybe<(
    { __typename?: 'OptionalBasemapLayer' }
    & Pick<OptionalBasemapLayer, 'id' | 'basemapId' | 'defaultVisibility' | 'description' | 'options' | 'groupType' | 'layers' | 'metadata' | 'name'>
  )> }
);

export type UpdateOptionalLayerNameMutationVariables = Exact<{
  id: Scalars['Int'];
  name: Scalars['String'];
}>;


export type UpdateOptionalLayerNameMutation = (
  { __typename?: 'Mutation' }
  & { updateOptionalBasemapLayer?: Maybe<(
    { __typename?: 'UpdateOptionalBasemapLayerPayload' }
    & { optionalBasemapLayer?: Maybe<(
      { __typename?: 'OptionalBasemapLayer' }
      & Pick<OptionalBasemapLayer, 'id' | 'name'>
    )> }
  )> }
);

export type CreateOptionalLayerMutationVariables = Exact<{
  name: Scalars['String'];
  basemapId: Scalars['Int'];
  groupType?: Maybe<OptionalBasemapLayersGroupType>;
  options?: Maybe<Scalars['JSON']>;
}>;


export type CreateOptionalLayerMutation = (
  { __typename?: 'Mutation' }
  & { createOptionalBasemapLayer?: Maybe<(
    { __typename?: 'CreateOptionalBasemapLayerPayload' }
    & { optionalBasemapLayer?: Maybe<(
      { __typename?: 'OptionalBasemapLayer' }
      & Pick<OptionalBasemapLayer, 'id' | 'basemapId' | 'defaultVisibility' | 'description' | 'options' | 'groupType' | 'layers' | 'metadata' | 'name'>
      & { basemap?: Maybe<(
        { __typename?: 'Basemap' }
        & BasemapAdminDetailsFragment
      )> }
    )> }
  )> }
);

export type UpdateOptionalLayerMutationVariables = Exact<{
  id: Scalars['Int'];
  name?: Maybe<Scalars['String']>;
  description?: Maybe<Scalars['String']>;
  defaultVisibility?: Maybe<Scalars['Boolean']>;
  metadata?: Maybe<Scalars['JSON']>;
}>;


export type UpdateOptionalLayerMutation = (
  { __typename?: 'Mutation' }
  & { updateOptionalBasemapLayer?: Maybe<(
    { __typename?: 'UpdateOptionalBasemapLayerPayload' }
    & { optionalBasemapLayer?: Maybe<(
      { __typename?: 'OptionalBasemapLayer' }
      & Pick<OptionalBasemapLayer, 'name' | 'description' | 'id' | 'defaultVisibility' | 'metadata'>
    )> }
  )> }
);

export type DeleteOptionalLayerMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteOptionalLayerMutation = (
  { __typename?: 'Mutation' }
  & { deleteOptionalBasemapLayer?: Maybe<(
    { __typename?: 'DeleteOptionalBasemapLayerPayload' }
    & { optionalBasemapLayer?: Maybe<(
      { __typename?: 'OptionalBasemapLayer' }
      & Pick<OptionalBasemapLayer, 'id'>
    )> }
  )> }
);

export type UpdateOptionalBasemapLayerLayerListMutationVariables = Exact<{
  id: Scalars['Int'];
  layers?: Maybe<Array<Maybe<Scalars['String']>> | Maybe<Scalars['String']>>;
}>;


export type UpdateOptionalBasemapLayerLayerListMutation = (
  { __typename?: 'Mutation' }
  & { updateOptionalBasemapLayer?: Maybe<(
    { __typename?: 'UpdateOptionalBasemapLayerPayload' }
    & { optionalBasemapLayer?: Maybe<(
      { __typename?: 'OptionalBasemapLayer' }
      & Pick<OptionalBasemapLayer, 'id' | 'layers'>
    )> }
  )> }
);

export type UpdateOptionalBasemapLayerOptionsMutationVariables = Exact<{
  id: Scalars['Int'];
  options: Scalars['JSON'];
}>;


export type UpdateOptionalBasemapLayerOptionsMutation = (
  { __typename?: 'Mutation' }
  & { updateOptionalBasemapLayer?: Maybe<(
    { __typename?: 'UpdateOptionalBasemapLayerPayload' }
    & { optionalBasemapLayer?: Maybe<(
      { __typename?: 'OptionalBasemapLayer' }
      & Pick<OptionalBasemapLayer, 'id' | 'options'>
    )> }
  )> }
);

export type GetOptionalBasemapLayerQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type GetOptionalBasemapLayerQuery = (
  { __typename?: 'Query' }
  & { optionalBasemapLayer?: Maybe<(
    { __typename?: 'OptionalBasemapLayer' }
    & Pick<OptionalBasemapLayer, 'id' | 'basemapId' | 'name' | 'description' | 'defaultVisibility' | 'groupType' | 'layers' | 'metadata' | 'options'>
  )> }
);

export type GetOptionalBasemapLayerMetadataQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type GetOptionalBasemapLayerMetadataQuery = (
  { __typename?: 'Query' }
  & { optionalBasemapLayer?: Maybe<(
    { __typename?: 'OptionalBasemapLayer' }
    & Pick<OptionalBasemapLayer, 'id' | 'metadata'>
  )> }
);

export type UpdateOptionalBasemapLayerMetadataMutationVariables = Exact<{
  id: Scalars['Int'];
  metadata?: Maybe<Scalars['JSON']>;
}>;


export type UpdateOptionalBasemapLayerMetadataMutation = (
  { __typename?: 'Mutation' }
  & { updateOptionalBasemapLayer?: Maybe<(
    { __typename?: 'UpdateOptionalBasemapLayerPayload' }
    & { optionalBasemapLayer?: Maybe<(
      { __typename?: 'OptionalBasemapLayer' }
      & Pick<OptionalBasemapLayer, 'id' | 'metadata'>
    )> }
  )> }
);

export type UpdateInteractivitySettingsLayersMutationVariables = Exact<{
  id: Scalars['Int'];
  layers?: Maybe<Array<Maybe<Scalars['String']>> | Maybe<Scalars['String']>>;
}>;


export type UpdateInteractivitySettingsLayersMutation = (
  { __typename?: 'Mutation' }
  & { updateInteractivitySetting?: Maybe<(
    { __typename?: 'UpdateInteractivitySettingPayload' }
    & { interactivitySetting?: Maybe<(
      { __typename?: 'InteractivitySetting' }
      & Pick<InteractivitySetting, 'layers' | 'id'>
    )> }
  )> }
);

export type MapboxKeysQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type MapboxKeysQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id' | 'mapboxPublicKey' | 'mapboxSecretKey'>
  )> }
);

export type SetBasemapMaxZoomMutationVariables = Exact<{
  id: Scalars['Int'];
  maxzoom?: Maybe<Scalars['Int']>;
}>;


export type SetBasemapMaxZoomMutation = (
  { __typename?: 'Mutation' }
  & { updateBasemap?: Maybe<(
    { __typename?: 'UpdateBasemapPayload' }
    & { basemap?: Maybe<(
      { __typename?: 'Basemap' }
      & Pick<Basemap, 'id' | 'maxzoom'>
    )> }
  )> }
);

export type CreateProjectMutationVariables = Exact<{
  name: Scalars['String'];
  slug: Scalars['String'];
}>;


export type CreateProjectMutation = (
  { __typename?: 'Mutation' }
  & { createProject?: Maybe<(
    { __typename?: 'CreateProjectPayload' }
    & { project?: Maybe<(
      { __typename?: 'Project' }
      & Pick<Project, 'id' | 'url' | 'slug'>
    )> }
  )> }
);

export type VerifyEmailMutationVariables = Exact<{
  redirectUrl?: Maybe<Scalars['String']>;
}>;


export type VerifyEmailMutation = (
  { __typename?: 'Mutation' }
  & Pick<Mutation, 'sendEmailVerification'>
);

export type DataUploadDetailsFragment = (
  { __typename?: 'DataUploadTask' }
  & Pick<DataUploadTask, 'createdAt' | 'filename' | 'id' | 'progress' | 'state' | 'errorMessage' | 'tableOfContentsItemStableIds'>
);

export type CreateDataUploadMutationVariables = Exact<{
  projectId: Scalars['Int'];
  filename: Scalars['String'];
  contentType: Scalars['String'];
}>;


export type CreateDataUploadMutation = (
  { __typename?: 'Mutation' }
  & { createDataUpload?: Maybe<(
    { __typename?: 'CreateDataUploadPayload' }
    & { dataUploadTask?: Maybe<(
      { __typename?: 'DataUploadTask' }
      & Pick<DataUploadTask, 'presignedUploadUrl'>
      & DataUploadDetailsFragment
    )> }
  )> }
);

export type SubmitDataUploadMutationVariables = Exact<{
  id: Scalars['UUID'];
}>;


export type SubmitDataUploadMutation = (
  { __typename?: 'Mutation' }
  & { submitDataUpload?: Maybe<(
    { __typename?: 'SubmitDataUploadPayload' }
    & { dataUploadTask?: Maybe<(
      { __typename?: 'DataUploadTask' }
      & DataUploadDetailsFragment
    )> }
  )> }
);

export type DataUploadTasksQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type DataUploadTasksQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id'>
    & { activeDataUploads?: Maybe<Array<(
      { __typename?: 'DataUploadTask' }
      & DataUploadDetailsFragment
    )>> }
  )> }
);

export type DismissFailedTaskMutationVariables = Exact<{
  id: Scalars['UUID'];
}>;


export type DismissFailedTaskMutation = (
  { __typename?: 'Mutation' }
  & { dismissFailedUpload?: Maybe<(
    { __typename?: 'DismissFailedUploadPayload' }
    & { dataUploadTask?: Maybe<(
      { __typename?: 'DataUploadTask' }
      & DataUploadDetailsFragment
    )> }
  )> }
);

export type FailUploadMutationVariables = Exact<{
  id: Scalars['UUID'];
  message: Scalars['String'];
}>;


export type FailUploadMutation = (
  { __typename?: 'Mutation' }
  & { failDataUpload?: Maybe<(
    { __typename?: 'FailDataUploadPayload' }
    & { dataUploadTask?: Maybe<(
      { __typename?: 'DataUploadTask' }
      & DataUploadDetailsFragment
    )> }
  )> }
);

export type ProjectDataQuotaRemainingQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type ProjectDataQuotaRemainingQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id' | 'dataHostingQuota' | 'dataHostingQuotaUsed'>
  )> }
);

export type CancelUploadMutationVariables = Exact<{
  projectId: Scalars['Int'];
  uploadId: Scalars['UUID'];
}>;


export type CancelUploadMutation = (
  { __typename?: 'Mutation' }
  & { cancelDataUpload?: Maybe<(
    { __typename?: 'CancelDataUploadPayload' }
    & Pick<CancelDataUploadPayload, 'clientMutationId'>
  )> }
);

export type DataUploadEventFragment = (
  { __typename?: 'DataUploadTaskSubscriptionPayload' }
  & Pick<DataUploadTaskSubscriptionPayload, 'projectId' | 'dataUploadTaskId' | 'previousState'>
  & { dataUploadTask?: Maybe<(
    { __typename?: 'DataUploadTask' }
    & DataUploadDetailsFragment
  )> }
);

export type DataUploadsSubscriptionVariables = Exact<{
  slug: Scalars['String'];
}>;


export type DataUploadsSubscription = (
  { __typename?: 'Subscription' }
  & { dataUploadTasks?: Maybe<(
    { __typename?: 'DataUploadTaskSubscriptionPayload' }
    & DataUploadEventFragment
  )> }
);

export type UpdateDataHostingQuotaMutationVariables = Exact<{
  projectId: Scalars['Int'];
  quota: Scalars['BigInt'];
}>;


export type UpdateDataHostingQuotaMutation = (
  { __typename?: 'Mutation' }
  & { updateDataHostingQuota?: Maybe<(
    { __typename?: 'UpdateDataHostingQuotaPayload' }
    & { project?: Maybe<(
      { __typename?: 'Project' }
      & Pick<Project, 'id' | 'dataHostingQuota' | 'dataHostingQuotaUsed'>
    )> }
  )> }
);

export type DownloadableOfflineTilePackagesQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type DownloadableOfflineTilePackagesQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'mapboxPublicKey'>
    & { offlineTilePackagesConnection: (
      { __typename?: 'OfflineTilePackagesConnection' }
      & { nodes: Array<(
        { __typename?: 'OfflineTilePackage' }
        & OfflineTilePackageDetailsFragment
      )> }
    ) }
  )> }
);

export type DownloadBasemapDetailsQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DownloadBasemapDetailsQuery = (
  { __typename?: 'Query' }
  & { basemap?: Maybe<(
    { __typename?: 'Basemap' }
    & OfflineBasemapDetailsFragment
  )> }
);

export type ImportBasemapDetailsQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type ImportBasemapDetailsQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id'>
    & { surveys: Array<(
      { __typename?: 'Survey' }
      & Pick<Survey, 'id'>
      & { basemaps?: Maybe<Array<(
        { __typename?: 'Basemap' }
        & Pick<Basemap, 'id' | 'thumbnail' | 'name'>
        & { offlineSupportInformation?: Maybe<(
          { __typename?: 'OfflineSupportInformation' }
          & Pick<OfflineSupportInformation, 'hasUncacheableSources'>
          & BasemapOfflineSupportInfoFragment
        )> }
      )>> }
    )> }
  )> }
);

export type DraftTableOfContentsQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type DraftTableOfContentsQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id' | 'draftTableOfContentsHasChanges' | 'tableOfContentsLastPublished' | 'importedArcgisServices'>
    & { region: (
      { __typename?: 'GeometryPolygon' }
      & Pick<GeometryPolygon, 'geojson'>
    ), draftTableOfContentsItems?: Maybe<Array<(
      { __typename?: 'TableOfContentsItem' }
      & OverlayFragment
    )>> }
  )> }
);

export type LayersAndSourcesForItemsQueryVariables = Exact<{
  slug: Scalars['String'];
  tableOfContentsItemIds: Array<Maybe<Scalars['Int']>> | Maybe<Scalars['Int']>;
}>;


export type LayersAndSourcesForItemsQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id'>
    & { dataSourcesForItems?: Maybe<Array<(
      { __typename?: 'DataSource' }
      & Pick<DataSource, 'attribution' | 'bounds' | 'buffer' | 'byteLength' | 'cluster' | 'clusterMaxZoom' | 'clusterProperties' | 'clusterRadius' | 'coordinates' | 'createdAt' | 'encoding' | 'enhancedSecurity' | 'id' | 'importType' | 'lineMetrics' | 'maxzoom' | 'minzoom' | 'originalSourceUrl' | 'queryParameters' | 'scheme' | 'tiles' | 'tileSize' | 'tolerance' | 'type' | 'url' | 'urls' | 'useDevicePixelRatio' | 'supportsDynamicLayers' | 'uploadedSourceFilename' | 'translatedProps' | 'arcgisFetchStrategy'>
    )>>, dataLayersForItems?: Maybe<Array<(
      { __typename?: 'DataLayer' }
      & Pick<DataLayer, 'staticId' | 'zIndex' | 'dataSourceId' | 'id' | 'mapboxGlStyles' | 'renderUnder' | 'sourceLayer' | 'sublayer'>
      & { interactivitySettings?: Maybe<(
        { __typename?: 'InteractivitySetting' }
        & Pick<InteractivitySetting, 'id' | 'cursor' | 'longTemplate' | 'shortTemplate' | 'type'>
      )>, sprites?: Maybe<Array<(
        { __typename?: 'Sprite' }
        & Pick<Sprite, 'id' | 'type'>
        & { spriteImages: Array<(
          { __typename?: 'SpriteImage' }
          & Pick<SpriteImage, 'pixelRatio' | 'height' | 'width' | 'url' | 'spriteId'>
        )> }
      )>> }
    )>> }
  )> }
);

export type CreateFolderMutationVariables = Exact<{
  title: Scalars['String'];
  stableId: Scalars['String'];
  projectId: Scalars['Int'];
  parentStableId?: Maybe<Scalars['String']>;
  isClickOffOnly?: Maybe<Scalars['Boolean']>;
  showRadioChildren?: Maybe<Scalars['Boolean']>;
  hideChildren?: Maybe<Scalars['Boolean']>;
}>;


export type CreateFolderMutation = (
  { __typename?: 'Mutation' }
  & { createTableOfContentsItem?: Maybe<(
    { __typename?: 'CreateTableOfContentsItemPayload' }
    & { tableOfContentsItem?: Maybe<(
      { __typename?: 'TableOfContentsItem' }
      & Pick<TableOfContentsItem, 'id' | 'title' | 'stableId' | 'projectId' | 'parentStableId' | 'isClickOffOnly' | 'isDraft' | 'isFolder' | 'showRadioChildren' | 'sortIndex' | 'hideChildren' | 'enableDownload'>
    )> }
  )> }
);

export type DeleteBranchMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteBranchMutation = (
  { __typename?: 'Mutation' }
  & { deleteTableOfContentsBranch?: Maybe<(
    { __typename?: 'DeleteTableOfContentsBranchPayload' }
    & Pick<DeleteTableOfContentsBranchPayload, 'clientMutationId'>
  )> }
);

export type UpdateTableOfContentsItemChildrenMutationVariables = Exact<{
  id?: Maybe<Scalars['Int']>;
  childIds: Array<Maybe<Scalars['Int']>> | Maybe<Scalars['Int']>;
}>;


export type UpdateTableOfContentsItemChildrenMutation = (
  { __typename?: 'Mutation' }
  & { updateTableOfContentsItemChildren?: Maybe<(
    { __typename?: 'UpdateTableOfContentsItemChildrenPayload' }
    & { tableOfContentsItems?: Maybe<Array<(
      { __typename?: 'TableOfContentsItem' }
      & Pick<TableOfContentsItem, 'id' | 'sortIndex' | 'parentStableId'>
    )>> }
  )> }
);

export type GetFolderQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type GetFolderQuery = (
  { __typename?: 'Query' }
  & { tableOfContentsItem?: Maybe<(
    { __typename?: 'TableOfContentsItem' }
    & Pick<TableOfContentsItem, 'id' | 'bounds' | 'isClickOffOnly' | 'showRadioChildren' | 'title' | 'hideChildren'>
    & { acl?: Maybe<(
      { __typename?: 'Acl' }
      & Pick<Acl, 'nodeId' | 'id'>
    )> }
  )> }
);

export type UpdateFolderMutationVariables = Exact<{
  id: Scalars['Int'];
  bounds?: Maybe<Array<Maybe<Scalars['BigFloat']>> | Maybe<Scalars['BigFloat']>>;
  isClickOffOnly?: Maybe<Scalars['Boolean']>;
  showRadioChildren?: Maybe<Scalars['Boolean']>;
  title?: Maybe<Scalars['String']>;
  hideChildren?: Maybe<Scalars['Boolean']>;
}>;


export type UpdateFolderMutation = (
  { __typename?: 'Mutation' }
  & { updateTableOfContentsItem?: Maybe<(
    { __typename?: 'UpdateTableOfContentsItemPayload' }
    & { tableOfContentsItem?: Maybe<(
      { __typename?: 'TableOfContentsItem' }
      & Pick<TableOfContentsItem, 'id' | 'bounds' | 'isClickOffOnly' | 'showRadioChildren' | 'hideChildren' | 'title'>
    )> }
  )> }
);

export type GetLayerItemQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type GetLayerItemQuery = (
  { __typename?: 'Query' }
  & { tableOfContentsItem?: Maybe<(
    { __typename?: 'TableOfContentsItem' }
    & Pick<TableOfContentsItem, 'id' | 'bounds' | 'dataLayerId' | 'metadata' | 'parentStableId' | 'projectId' | 'stableId' | 'title' | 'enableDownload' | 'geoprocessingReferenceId'>
    & { acl?: Maybe<(
      { __typename?: 'Acl' }
      & Pick<Acl, 'nodeId' | 'id' | 'type'>
      & { groups?: Maybe<Array<(
        { __typename?: 'Group' }
        & Pick<Group, 'id' | 'name'>
      )>> }
    )>, dataLayer?: Maybe<(
      { __typename?: 'DataLayer' }
      & Pick<DataLayer, 'id' | 'zIndex' | 'mapboxGlStyles' | 'interactivitySettingsId' | 'renderUnder' | 'sourceLayer' | 'sublayer' | 'staticId' | 'dataSourceId'>
      & { sprites?: Maybe<Array<(
        { __typename?: 'Sprite' }
        & Pick<Sprite, 'id' | 'type'>
        & { spriteImages: Array<(
          { __typename?: 'SpriteImage' }
          & Pick<SpriteImage, 'pixelRatio' | 'height' | 'width' | 'url'>
        )> }
      )>>, dataSource?: Maybe<(
        { __typename?: 'DataSource' }
        & Pick<DataSource, 'id' | 'attribution' | 'bounds' | 'buffer' | 'byteLength' | 'cluster' | 'clusterMaxZoom' | 'clusterProperties' | 'clusterRadius' | 'coordinates' | 'createdAt' | 'encoding' | 'enhancedSecurity' | 'generateId' | 'importType' | 'lineMetrics' | 'maxzoom' | 'minzoom' | 'originalSourceUrl' | 'promoteId' | 'queryParameters' | 'scheme' | 'tiles' | 'tileSize' | 'tolerance' | 'type' | 'url' | 'urls' | 'useDevicePixelRatio' | 'supportsDynamicLayers' | 'uploadedSourceFilename' | 'uploadedBy' | 'geostats' | 'translatedProps' | 'arcgisFetchStrategy'>
      )> }
    )> }
  )> }
);

export type UpdateTableOfContentsItemMutationVariables = Exact<{
  id: Scalars['Int'];
  title?: Maybe<Scalars['String']>;
  bounds?: Maybe<Array<Maybe<Scalars['BigFloat']>> | Maybe<Scalars['BigFloat']>>;
  metadata?: Maybe<Scalars['JSON']>;
  geoprocessingReferenceId?: Maybe<Scalars['String']>;
}>;


export type UpdateTableOfContentsItemMutation = (
  { __typename?: 'Mutation' }
  & { updateTableOfContentsItem?: Maybe<(
    { __typename?: 'UpdateTableOfContentsItemPayload' }
    & { tableOfContentsItem?: Maybe<(
      { __typename?: 'TableOfContentsItem' }
      & Pick<TableOfContentsItem, 'id' | 'bounds' | 'metadata' | 'title' | 'geoprocessingReferenceId' | 'stableId'>
    )> }
  )> }
);

export type UpdateEnableDownloadMutationVariables = Exact<{
  id: Scalars['Int'];
  enableDownload?: Maybe<Scalars['Boolean']>;
}>;


export type UpdateEnableDownloadMutation = (
  { __typename?: 'Mutation' }
  & { updateTableOfContentsItem?: Maybe<(
    { __typename?: 'UpdateTableOfContentsItemPayload' }
    & { tableOfContentsItem?: Maybe<(
      { __typename?: 'TableOfContentsItem' }
      & Pick<TableOfContentsItem, 'id' | 'enableDownload'>
    )> }
  )> }
);

export type UpdateLayerMutationVariables = Exact<{
  id: Scalars['Int'];
  renderUnder?: Maybe<RenderUnderType>;
  mapboxGlStyles?: Maybe<Scalars['JSON']>;
  sublayer?: Maybe<Scalars['String']>;
  staticId?: Maybe<Scalars['String']>;
}>;


export type UpdateLayerMutation = (
  { __typename?: 'Mutation' }
  & { updateDataLayer?: Maybe<(
    { __typename?: 'UpdateDataLayerPayload' }
    & { dataLayer?: Maybe<(
      { __typename?: 'DataLayer' }
      & Pick<DataLayer, 'id' | 'zIndex' | 'renderUnder' | 'mapboxGlStyles' | 'sublayer' | 'staticId'>
      & { sprites?: Maybe<Array<(
        { __typename?: 'Sprite' }
        & Pick<Sprite, 'id' | 'type'>
        & { spriteImages: Array<(
          { __typename?: 'SpriteImage' }
          & Pick<SpriteImage, 'pixelRatio' | 'height' | 'width' | 'url'>
        )> }
      )>> }
    )> }
  )> }
);

export type UpdateDataSourceMutationVariables = Exact<{
  id: Scalars['Int'];
  attribution?: Maybe<Scalars['String']>;
}>;


export type UpdateDataSourceMutation = (
  { __typename?: 'Mutation' }
  & { updateDataSource?: Maybe<(
    { __typename?: 'UpdateDataSourcePayload' }
    & { dataSource?: Maybe<(
      { __typename?: 'DataSource' }
      & Pick<DataSource, 'id' | 'attribution' | 'bounds' | 'buffer' | 'byteLength' | 'cluster' | 'clusterMaxZoom' | 'clusterProperties' | 'clusterRadius' | 'coordinates' | 'createdAt' | 'encoding' | 'enhancedSecurity' | 'generateId' | 'importType' | 'lineMetrics' | 'maxzoom' | 'minzoom' | 'originalSourceUrl' | 'promoteId' | 'queryParameters' | 'scheme' | 'tiles' | 'tileSize' | 'tolerance' | 'type' | 'url' | 'urls' | 'useDevicePixelRatio' | 'supportsDynamicLayers' | 'translatedProps'>
    )> }
  )> }
);

export type InteractivitySettingsForLayerQueryVariables = Exact<{
  layerId: Scalars['Int'];
}>;


export type InteractivitySettingsForLayerQuery = (
  { __typename?: 'Query' }
  & { dataLayer?: Maybe<(
    { __typename?: 'DataLayer' }
    & Pick<DataLayer, 'id' | 'sourceLayer'>
    & { interactivitySettings?: Maybe<(
      { __typename?: 'InteractivitySetting' }
      & Pick<InteractivitySetting, 'cursor' | 'id' | 'longTemplate' | 'shortTemplate' | 'type'>
    )> }
  )> }
);

export type UpdateInteractivitySettingsMutationVariables = Exact<{
  id: Scalars['Int'];
  type?: Maybe<InteractivityType>;
  cursor?: Maybe<CursorType>;
  longTemplate?: Maybe<Scalars['String']>;
  shortTemplate?: Maybe<Scalars['String']>;
}>;


export type UpdateInteractivitySettingsMutation = (
  { __typename?: 'Mutation' }
  & { updateInteractivitySetting?: Maybe<(
    { __typename?: 'UpdateInteractivitySettingPayload' }
    & { interactivitySetting?: Maybe<(
      { __typename?: 'InteractivitySetting' }
      & Pick<InteractivitySetting, 'id' | 'type' | 'cursor' | 'longTemplate' | 'shortTemplate'>
    )> }
  )> }
);

export type DataSourceUrlPropertiesQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DataSourceUrlPropertiesQuery = (
  { __typename?: 'Query' }
  & { dataSource?: Maybe<(
    { __typename?: 'DataSource' }
    & Pick<DataSource, 'id' | 'type' | 'url' | 'originalSourceUrl' | 'queryParameters'>
  )> }
);

export type UpdateZIndexesMutationVariables = Exact<{
  dataLayerIds: Array<Maybe<Scalars['Int']>> | Maybe<Scalars['Int']>;
}>;


export type UpdateZIndexesMutation = (
  { __typename?: 'Mutation' }
  & { updateZIndexes?: Maybe<(
    { __typename?: 'UpdateZIndexesPayload' }
    & { dataLayers?: Maybe<Array<(
      { __typename?: 'DataLayer' }
      & Pick<DataLayer, 'id' | 'zIndex'>
    )>> }
  )> }
);

export type UpdateRenderUnderTypeMutationVariables = Exact<{
  layerId: Scalars['Int'];
  renderUnder?: Maybe<RenderUnderType>;
}>;


export type UpdateRenderUnderTypeMutation = (
  { __typename?: 'Mutation' }
  & { updateDataLayer?: Maybe<(
    { __typename?: 'UpdateDataLayerPayload' }
    & { dataLayer?: Maybe<(
      { __typename?: 'DataLayer' }
      & Pick<DataLayer, 'id' | 'renderUnder'>
    )> }
  )> }
);

export type UpdateQueryParametersMutationVariables = Exact<{
  sourceId: Scalars['Int'];
  queryParameters: Scalars['JSON'];
}>;


export type UpdateQueryParametersMutation = (
  { __typename?: 'Mutation' }
  & { updateDataSource?: Maybe<(
    { __typename?: 'UpdateDataSourcePayload' }
    & { dataSource?: Maybe<(
      { __typename?: 'DataSource' }
      & Pick<DataSource, 'id' | 'queryParameters'>
    )> }
  )> }
);

export type UpdateFetchStrategyMutationVariables = Exact<{
  sourceId: Scalars['Int'];
  fetchStrategy: ArcgisFeatureLayerFetchStrategy;
}>;


export type UpdateFetchStrategyMutation = (
  { __typename?: 'Mutation' }
  & { updateDataSource?: Maybe<(
    { __typename?: 'UpdateDataSourcePayload' }
    & { dataSource?: Maybe<(
      { __typename?: 'DataSource' }
      & Pick<DataSource, 'id' | 'arcgisFetchStrategy'>
    )> }
  )> }
);

export type UpdateEnableHighDpiRequestsMutationVariables = Exact<{
  sourceId: Scalars['Int'];
  useDevicePixelRatio: Scalars['Boolean'];
}>;


export type UpdateEnableHighDpiRequestsMutation = (
  { __typename?: 'Mutation' }
  & { updateDataSource?: Maybe<(
    { __typename?: 'UpdateDataSourcePayload' }
    & { dataSource?: Maybe<(
      { __typename?: 'DataSource' }
      & Pick<DataSource, 'id' | 'useDevicePixelRatio'>
    )> }
  )> }
);

export type GetMetadataQueryVariables = Exact<{
  itemId: Scalars['Int'];
}>;


export type GetMetadataQuery = (
  { __typename?: 'Query' }
  & { tableOfContentsItem?: Maybe<(
    { __typename?: 'TableOfContentsItem' }
    & Pick<TableOfContentsItem, 'id' | 'computedMetadata' | 'usesDynamicMetadata' | 'isCustomGlSource'>
  )> }
);

export type UpdateMetadataMutationVariables = Exact<{
  itemId: Scalars['Int'];
  metadata?: Maybe<Scalars['JSON']>;
}>;


export type UpdateMetadataMutation = (
  { __typename?: 'Mutation' }
  & { updateTableOfContentsItem?: Maybe<(
    { __typename?: 'UpdateTableOfContentsItemPayload' }
    & { tableOfContentsItem?: Maybe<(
      { __typename?: 'TableOfContentsItem' }
      & Pick<TableOfContentsItem, 'id' | 'metadata' | 'usesDynamicMetadata' | 'computedMetadata'>
    )> }
  )> }
);

export type ProjectHostingQuotaQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type ProjectHostingQuotaQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id' | 'dataHostingQuota' | 'dataHostingQuotaUsed'>
  )> }
);

export type InteractivitySettingsByIdQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type InteractivitySettingsByIdQuery = (
  { __typename?: 'Query' }
  & { interactivitySetting?: Maybe<(
    { __typename?: 'InteractivitySetting' }
    & Pick<InteractivitySetting, 'cursor' | 'id' | 'layers' | 'longTemplate' | 'shortTemplate' | 'type'>
  )> }
);

export type PublishTableOfContentsMutationVariables = Exact<{
  projectId: Scalars['Int'];
}>;


export type PublishTableOfContentsMutation = (
  { __typename?: 'Mutation' }
  & { publishTableOfContents?: Maybe<(
    { __typename?: 'PublishTableOfContentsPayload' }
    & { tableOfContentsItems?: Maybe<Array<(
      { __typename?: 'TableOfContentsItem' }
      & Pick<TableOfContentsItem, 'id'>
    )>> }
  )> }
);

export type DraftStatusSubscriptionVariables = Exact<{
  slug: Scalars['String'];
}>;


export type DraftStatusSubscription = (
  { __typename?: 'Subscription' }
  & { updatedDraftTableOfContentsStatus?: Maybe<(
    { __typename?: 'ProjectDraftTableOfContentsStatusPayload' }
    & Pick<ProjectDraftTableOfContentsStatusPayload, 'hasChanges' | 'projectId'>
    & { project?: Maybe<(
      { __typename?: 'Project' }
      & Pick<Project, 'id' | 'draftTableOfContentsHasChanges' | 'tableOfContentsLastPublished'>
    )> }
  )> }
);

export type ImportArcGisServiceMutationVariables = Exact<{
  items: Array<ArcgisImportItemInput> | ArcgisImportItemInput;
  sources: Array<ArcgisImportSourceInput> | ArcgisImportSourceInput;
  projectId: Scalars['Int'];
}>;


export type ImportArcGisServiceMutation = (
  { __typename?: 'Mutation' }
  & { importArcgisServices?: Maybe<(
    { __typename?: 'ImportArcgisServicesPayload' }
    & { tableOfContentsItems?: Maybe<Array<(
      { __typename?: 'TableOfContentsItem' }
      & Pick<TableOfContentsItem, 'id' | 'title'>
    )>> }
  )> }
);

export type SetMaxZoomMutationVariables = Exact<{
  sourceId: Scalars['Int'];
  maxzoom?: Maybe<Scalars['Int']>;
}>;


export type SetMaxZoomMutation = (
  { __typename?: 'Mutation' }
  & { updateDataSource?: Maybe<(
    { __typename?: 'UpdateDataSourcePayload' }
    & { dataSource?: Maybe<(
      { __typename?: 'DataSource' }
      & Pick<DataSource, 'id' | 'maxzoom'>
    )> }
  )> }
);

export type ForumListDetailsFragment = (
  { __typename?: 'Forum' }
  & Pick<Forum, 'id' | 'name' | 'description' | 'archived' | 'position' | 'topicCount' | 'postCount' | 'lastPostDate' | 'translatedProps'>
  & { readAcl?: Maybe<(
    { __typename?: 'Acl' }
    & Pick<Acl, 'id' | 'nodeId'>
  )>, writeAcl?: Maybe<(
    { __typename?: 'Acl' }
    & Pick<Acl, 'id' | 'nodeId'>
  )> }
);

export type ForumAdminListQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type ForumAdminListQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id'>
    & { forums: Array<(
      { __typename?: 'Forum' }
      & ForumListDetailsFragment
    )> }
  )> }
);

export type CreateForumMutationVariables = Exact<{
  name: Scalars['String'];
  projectId: Scalars['Int'];
}>;


export type CreateForumMutation = (
  { __typename?: 'Mutation' }
  & { createForum?: Maybe<(
    { __typename?: 'CreateForumPayload' }
    & { forum?: Maybe<(
      { __typename?: 'Forum' }
      & ForumListDetailsFragment
    )> }
  )> }
);

export type UpdateForumMutationVariables = Exact<{
  id: Scalars['Int'];
  name?: Maybe<Scalars['String']>;
  archived?: Maybe<Scalars['Boolean']>;
  description?: Maybe<Scalars['String']>;
}>;


export type UpdateForumMutation = (
  { __typename?: 'Mutation' }
  & { updateForum?: Maybe<(
    { __typename?: 'UpdateForumPayload' }
    & { forum?: Maybe<(
      { __typename?: 'Forum' }
      & Pick<Forum, 'id' | 'name' | 'archived' | 'description'>
    )> }
  )> }
);

export type DeleteForumMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteForumMutation = (
  { __typename?: 'Mutation' }
  & { deleteForum?: Maybe<(
    { __typename?: 'DeleteForumPayload' }
    & { forum?: Maybe<(
      { __typename?: 'Forum' }
      & Pick<Forum, 'id'>
    )> }
  )> }
);

export type AuthorProfileFragment = (
  { __typename?: 'Profile' }
  & Pick<Profile, 'affiliations' | 'email' | 'fullname' | 'nickname' | 'picture' | 'userId'>
);

export type ForumPostFragment = (
  { __typename?: 'Post' }
  & Pick<Post, 'id' | 'createdAt' | 'hiddenByModerator' | 'topicId' | 'html' | 'sketchIds' | 'orderedAttachmentIds'>
  & { authorProfile?: Maybe<(
    { __typename?: 'Profile' }
    & AuthorProfileFragment
  )>, mapBookmarks?: Maybe<Array<(
    { __typename?: 'MapBookmark' }
    & MapBookmarkDetailsFragment
  )>>, fileUploads?: Maybe<Array<(
    { __typename?: 'FileUpload' }
    & FileUploadDetailsFragment
  )>> }
);

export type RecentPostFragment = (
  { __typename?: 'Post' }
  & Pick<Post, 'blurb'>
  & { topic?: Maybe<(
    { __typename?: 'Topic' }
    & Pick<Topic, 'id' | 'postsCount' | 'title' | 'sticky' | 'participantCount'>
    & { forum?: Maybe<(
      { __typename?: 'Forum' }
      & Pick<Forum, 'id' | 'name' | 'translatedProps'>
    )>, participantsConnection: (
      { __typename?: 'ProfilesConnection' }
      & { nodes: Array<(
        { __typename?: 'Profile' }
        & AuthorProfileFragment
      )> }
    ) }
  )> }
  & ForumPostFragment
);

export type ForumDetailsFragment = (
  { __typename?: 'Forum' }
  & Pick<Forum, 'id' | 'archived' | 'name' | 'description' | 'topicCount' | 'postCount' | 'lastPostDate' | 'canPost' | 'translatedProps'>
);

export type ForumsQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type ForumsQuery = (
  { __typename?: 'Query' }
  & { me?: Maybe<(
    { __typename?: 'User' }
    & Pick<User, 'id'>
    & { profile?: Maybe<(
      { __typename?: 'Profile' }
      & AuthorProfileFragment
    )> }
  )>, projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id' | 'sessionParticipationStatus'>
    & { forums: Array<(
      { __typename?: 'Forum' }
      & ForumDetailsFragment
    )>, latestPostsConnection: (
      { __typename?: 'PostsConnection' }
      & { nodes: Array<(
        { __typename?: 'Post' }
        & RecentPostFragment
      )> }
    ) }
  )> }
);

export type ForumTopicFragment = (
  { __typename?: 'Topic' }
  & Pick<Topic, 'id' | 'title' | 'createdAt' | 'locked' | 'sticky' | 'postsCount' | 'lastPostDate' | 'blurb' | 'forumId' | 'participantCount'>
  & { authorProfile?: Maybe<(
    { __typename?: 'Profile' }
    & AuthorProfileFragment
  )>, participantsConnection: (
    { __typename?: 'ProfilesConnection' }
    & { nodes: Array<(
      { __typename?: 'Profile' }
      & Pick<Profile, 'userId' | 'email' | 'picture' | 'fullname' | 'nickname'>
    )> }
  ) }
);

export type TopicListQueryVariables = Exact<{
  forumId: Scalars['Int'];
}>;


export type TopicListQuery = (
  { __typename?: 'Query' }
  & { forum?: Maybe<(
    { __typename?: 'Forum' }
    & Pick<Forum, 'id' | 'archived' | 'name' | 'description' | 'topicCount' | 'postCount' | 'lastPostDate' | 'canPost'>
    & { project?: Maybe<(
      { __typename?: 'Project' }
      & Pick<Project, 'id' | 'sessionParticipationStatus'>
    )>, topicsConnection: (
      { __typename?: 'TopicsConnection' }
      & { nodes: Array<(
        { __typename?: 'Topic' }
        & ForumTopicFragment
      )> }
    ) }
  )> }
);

export type CreateTopicMutationVariables = Exact<{
  forumId: Scalars['Int'];
  content: Scalars['JSON'];
  title: Scalars['String'];
}>;


export type CreateTopicMutation = (
  { __typename?: 'Mutation' }
  & { createTopic: (
    { __typename?: 'Topic' }
    & Pick<Topic, 'postsCount' | 'lastPostDate'>
    & { forum?: Maybe<(
      { __typename?: 'Forum' }
      & Pick<Forum, 'id' | 'topicCount' | 'postCount' | 'lastPostDate'>
    )> }
    & ForumTopicFragment
  ) }
);

export type BreadcrumbTopicQueryVariables = Exact<{
  topicId: Scalars['Int'];
}>;


export type BreadcrumbTopicQuery = (
  { __typename?: 'Query' }
  & { topic?: Maybe<(
    { __typename?: 'Topic' }
    & Pick<Topic, 'id' | 'title'>
  )> }
);

export type TopicDetailQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type TopicDetailQuery = (
  { __typename?: 'Query' }
  & { topic?: Maybe<(
    { __typename?: 'Topic' }
    & { postsConnection: (
      { __typename?: 'PostsConnection' }
      & { nodes: Array<(
        { __typename?: 'Post' }
        & ForumPostFragment
      )> }
    ), forum?: Maybe<(
      { __typename?: 'Forum' }
      & Pick<Forum, 'id' | 'canPost'>
      & { project?: Maybe<(
        { __typename?: 'Project' }
        & Pick<Project, 'id' | 'sessionParticipationStatus'>
      )> }
    )> }
    & ForumTopicFragment
  )>, me?: Maybe<(
    { __typename?: 'User' }
    & Pick<User, 'id'>
    & { profile?: Maybe<(
      { __typename?: 'Profile' }
      & AuthorProfileFragment
    )> }
  )> }
);

export type CreateReplyMutationVariables = Exact<{
  topicId: Scalars['Int'];
  content: Scalars['JSON'];
}>;


export type CreateReplyMutation = (
  { __typename?: 'Mutation' }
  & { createPost: (
    { __typename?: 'Post' }
    & { topic?: Maybe<(
      { __typename?: 'Topic' }
      & { forum?: Maybe<(
        { __typename?: 'Forum' }
        & Pick<Forum, 'id' | 'postCount' | 'topicCount' | 'lastPostDate'>
      )> }
      & ForumTopicFragment
    )> }
    & ForumPostFragment
  ) }
);

export type CopyTocItemForForumPostMutationVariables = Exact<{
  id: Scalars['Int'];
  type: SketchChildType;
}>;


export type CopyTocItemForForumPostMutation = (
  { __typename?: 'Mutation' }
  & { copySketchTocItem?: Maybe<(
    { __typename?: 'CopySketchTocItemResults' }
    & Pick<CopySketchTocItemResults, 'parentId'>
    & { folders?: Maybe<Array<(
      { __typename?: 'SketchFolder' }
      & SketchFolderDetailsFragment
    )>>, sketches?: Maybe<Array<(
      { __typename?: 'Sketch' }
      & SketchTocDetailsFragment
    )>> }
  )> }
);

export type NewPostsSubscriptionVariables = Exact<{
  slug: Scalars['String'];
}>;


export type NewPostsSubscription = (
  { __typename?: 'Subscription' }
  & { forumActivity?: Maybe<(
    { __typename?: 'ForumActivityPayload' }
    & { post?: Maybe<(
      { __typename?: 'Post' }
      & ForumPostFragment
    )>, topic?: Maybe<(
      { __typename?: 'Topic' }
      & ForumTopicFragment
    )>, forum?: Maybe<(
      { __typename?: 'Forum' }
      & ForumDetailsFragment
    )> }
  )> }
);

export type JobFragment = (
  { __typename?: 'WorkerJob' }
  & Pick<WorkerJob, 'attempts' | 'createdAt' | 'key' | 'lockedAt' | 'maxAttempts' | 'runAt' | 'taskIdentifier' | 'lastError'>
);

export type MapBookmarkDetailsFragment = (
  { __typename?: 'MapBookmark' }
  & Pick<MapBookmark, 'id' | 'imageId' | 'createdAt' | 'basemapOptionalLayerStates' | 'cameraOptions' | 'projectId' | 'selectedBasemap' | 'visibleDataLayers' | 'mapDimensions' | 'visibleSketches' | 'screenshotJobStatus' | 'basemapName' | 'layerNames' | 'sketchNames' | 'clientGeneratedThumbnail'>
  & { job?: Maybe<(
    { __typename?: 'WorkerJob' }
    & JobFragment
  )> }
);

export type GetBookmarkQueryVariables = Exact<{
  id: Scalars['UUID'];
}>;


export type GetBookmarkQuery = (
  { __typename?: 'Query' }
  & { bookmarkById?: Maybe<(
    { __typename?: 'MapBookmark' }
    & MapBookmarkDetailsFragment
  )> }
);

export type CreateMapBookmarkMutationVariables = Exact<{
  slug: Scalars['String'];
  isPublic: Scalars['Boolean'];
  basemapOptionalLayerStates?: Maybe<Scalars['JSON']>;
  visibleDataLayers: Array<Scalars['String']> | Scalars['String'];
  cameraOptions: Scalars['JSON'];
  selectedBasemap: Scalars['Int'];
  style: Scalars['JSON'];
  mapDimensions: Array<Scalars['Int']> | Scalars['Int'];
  visibleSketches: Array<Scalars['Int']> | Scalars['Int'];
  sidebarState?: Maybe<Scalars['JSON']>;
  basemapName: Scalars['String'];
  layerNames: Scalars['JSON'];
  sketchNames: Scalars['JSON'];
  clientGeneratedThumbnail: Scalars['String'];
}>;


export type CreateMapBookmarkMutation = (
  { __typename?: 'Mutation' }
  & { createMapBookmark?: Maybe<(
    { __typename?: 'CreateMapBookmarkPayload' }
    & { mapBookmark?: Maybe<(
      { __typename?: 'MapBookmark' }
      & MapBookmarkDetailsFragment
    )> }
  )> }
);

export type MapBookmarkSubscriptionVariables = Exact<{
  id: Scalars['UUID'];
}>;


export type MapBookmarkSubscription = (
  { __typename?: 'Subscription' }
  & { updatedMapBookmark?: Maybe<(
    { __typename?: 'BookmarkPayload' }
    & Pick<BookmarkPayload, 'bookmarkId'>
    & { bookmark?: Maybe<(
      { __typename?: 'MapBookmark' }
      & MapBookmarkDetailsFragment
    )> }
  )> }
);

export type SketchPresentFragment = (
  { __typename?: 'Sketch' }
  & Pick<Sketch, 'id' | 'name'>
);

export type FileUploadDetailsFragment = (
  { __typename?: 'FileUpload' }
  & Pick<FileUpload, 'id' | 'filename' | 'postId' | 'userId' | 'fileSizeBytes' | 'contentType' | 'downloadUrl' | 'createdAt' | 'usage' | 'cloudflareImagesId'>
);

export type CreateFileUploadForPostMutationVariables = Exact<{
  contentType: Scalars['String'];
  filename: Scalars['String'];
  fileSizeBytes: Scalars['Int'];
  projectId: Scalars['Int'];
  usage: FileUploadUsageInput;
}>;


export type CreateFileUploadForPostMutation = (
  { __typename?: 'Mutation' }
  & { createFileUpload: (
    { __typename?: 'UploaderResponse' }
    & Pick<UploaderResponse, 'cloudflareImagesUploadUrl'>
    & { fileUpload: (
      { __typename?: 'FileUpload' }
      & Pick<FileUpload, 'presignedUploadUrl'>
      & FileUploadDetailsFragment
    ) }
  ) }
);

export type SpriteDetailsFragment = (
  { __typename?: 'Sprite' }
  & Pick<Sprite, 'id' | 'type' | 'category' | 'projectId'>
  & { spriteImages: Array<(
    { __typename?: 'SpriteImage' }
    & Pick<SpriteImage, 'spriteId' | 'height' | 'width' | 'pixelRatio' | 'url'>
  )> }
);

export type SpritesQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type SpritesQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id'>
    & { sprites?: Maybe<Array<(
      { __typename?: 'Sprite' }
      & SpriteDetailsFragment
    )>> }
  )>, publicSprites?: Maybe<Array<(
    { __typename?: 'Sprite' }
    & SpriteDetailsFragment
  )>> }
);

export type GetSpriteQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type GetSpriteQuery = (
  { __typename?: 'Query' }
  & { sprite?: Maybe<(
    { __typename?: 'Sprite' }
    & SpriteDetailsFragment
  )> }
);

export type ShareSpriteMutationVariables = Exact<{
  id: Scalars['Int'];
  category?: Maybe<Scalars['String']>;
}>;


export type ShareSpriteMutation = (
  { __typename?: 'Mutation' }
  & { shareSprite?: Maybe<(
    { __typename?: 'ShareSpritePayload' }
    & { sprite?: Maybe<(
      { __typename?: 'Sprite' }
      & SpriteDetailsFragment
    )> }
  )> }
);

export type DeleteSpriteMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteSpriteMutation = (
  { __typename?: 'Mutation' }
  & { softDeleteSprite?: Maybe<(
    { __typename?: 'SoftDeleteSpritePayload' }
    & { sprite?: Maybe<(
      { __typename?: 'Sprite' }
      & SpriteDetailsFragment
    )> }
  )> }
);

export type JoinProjectMutationVariables = Exact<{
  projectId: Scalars['Int'];
}>;


export type JoinProjectMutation = (
  { __typename?: 'Mutation' }
  & { joinProject?: Maybe<(
    { __typename?: 'JoinProjectPayload' }
    & { query?: Maybe<(
      { __typename?: 'Query' }
      & { project?: Maybe<(
        { __typename?: 'Project' }
        & Pick<Project, 'id' | 'sessionParticipationStatus'>
      )> }
    )> }
  )> }
);

export type MapEssentialsFragment = (
  { __typename?: 'Project' }
  & Pick<Project, 'id' | 'mapboxPublicKey' | 'mapboxSecretKey'>
  & { basemaps?: Maybe<Array<(
    { __typename?: 'Basemap' }
    & BasemapDetailsFragment
  )>>, surveyBasemaps?: Maybe<Array<(
    { __typename?: 'Basemap' }
    & BasemapDetailsFragment
  )>>, region: (
    { __typename?: 'GeometryPolygon' }
    & Pick<GeometryPolygon, 'geojson'>
  ) }
);

export type GetBasemapsAndRegionQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type GetBasemapsAndRegionQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & MapEssentialsFragment
  )> }
);

export type OfflineSurveysQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type OfflineSurveysQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id'>
    & { surveys: Array<(
      { __typename?: 'Survey' }
      & Pick<Survey, 'id' | 'name'>
    )> }
  )> }
);

export type SurveysByIdQueryVariables = Exact<{
  surveyIds: Array<Maybe<Scalars['Int']>> | Maybe<Scalars['Int']>;
}>;


export type SurveysByIdQuery = (
  { __typename?: 'Query' }
  & { getSurveys?: Maybe<Array<(
    { __typename?: 'Survey' }
    & Pick<Survey, 'id' | 'projectId' | 'name'>
    & { project?: Maybe<(
      { __typename?: 'Project' }
      & Pick<Project, 'id' | 'name' | 'slug'>
    )> }
  )>>, me?: Maybe<(
    { __typename?: 'User' }
    & Pick<User, 'id' | 'canonicalEmail'>
    & { profile?: Maybe<(
      { __typename?: 'Profile' }
      & Pick<Profile, 'userId' | 'email' | 'fullname' | 'nickname' | 'picture'>
    )> }
  )> }
);

export type OfflineTilePackageDetailsFragment = (
  { __typename?: 'OfflineTilePackage' }
  & Pick<OfflineTilePackage, 'id' | 'bytes' | 'projectId' | 'sourceType' | 'jobStatus' | 'tilesFetched' | 'totalTiles' | 'createdAt' | 'jobErrors' | 'dataSourceUrl' | 'isMapboxHosted' | 'maxZ' | 'maxShorelineZ' | 'presignedUrl' | 'originalUrlTemplate'>
  & { region: (
    { __typename?: 'GeometryPolygon' }
    & Pick<GeometryPolygon, 'geojson'>
  ) }
);

export type BasemapOfflineSupportInfoFragment = (
  { __typename?: 'OfflineSupportInformation' }
  & Pick<OfflineSupportInformation, 'id' | 'styleLastModified'>
  & { staticAssets: Array<(
    { __typename?: 'CacheableOfflineAsset' }
    & Pick<CacheableOfflineAsset, 'url' | 'cacheKey' | 'type'>
  )>, sources: Array<(
    { __typename?: 'OfflineSourceDetails' }
    & Pick<OfflineSourceDetails, 'templateUrl' | 'dataSourceUrl' | 'type'>
    & { tilePackages: Array<(
      { __typename?: 'OfflineTilePackage' }
      & OfflineTilePackageDetailsFragment
    )> }
  )> }
);

export type OfflineBasemapDetailsFragment = (
  { __typename?: 'Basemap' }
  & Pick<Basemap, 'useDefaultOfflineTileSettings'>
  & { offlineTileSettings: Array<(
    { __typename?: 'OfflineTileSetting' }
    & Pick<OfflineTileSetting, 'basemapId' | 'id' | 'maxShorelineZ' | 'maxZ'>
  )>, offlineSupportInformation?: Maybe<(
    { __typename?: 'OfflineSupportInformation' }
    & BasemapOfflineSupportInfoFragment
  )> }
  & BasemapDetailsFragment
);

export type OfflineTileSettingsForCalculationFragment = (
  { __typename?: 'OfflineTileSetting' }
  & Pick<OfflineTileSetting, 'maxShorelineZ' | 'maxZ'>
);

export type OfflineSurveyMapsQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type OfflineSurveyMapsQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'mapboxPublicKey' | 'id'>
    & { region: (
      { __typename?: 'GeometryPolygon' }
      & Pick<GeometryPolygon, 'geojson'>
    ), offlineTileSettings: Array<(
      { __typename?: 'OfflineTileSetting' }
      & Pick<OfflineTileSetting, 'maxShorelineZ' | 'maxZ' | 'basemapId'>
    )>, surveys: Array<(
      { __typename?: 'Survey' }
      & Pick<Survey, 'id' | 'name'>
      & { form?: Maybe<(
        { __typename?: 'Form' }
        & Pick<Form, 'id'>
      )>, basemaps?: Maybe<Array<(
        { __typename?: 'Basemap' }
        & OfflineBasemapDetailsFragment
      )>> }
    )>, offlineTilePackagesConnection: (
      { __typename?: 'OfflineTilePackagesConnection' }
      & { nodes: Array<(
        { __typename?: 'OfflineTilePackage' }
        & OfflineTilePackageDetailsFragment
      )> }
    ) }
  )> }
);

export type OfflineTileSettingsFragment = (
  { __typename?: 'OfflineTileSetting' }
  & Pick<OfflineTileSetting, 'id' | 'projectId' | 'basemapId' | 'maxZ' | 'maxShorelineZ'>
  & { region: (
    { __typename?: 'GeometryPolygon' }
    & Pick<GeometryPolygon, 'geojson'>
  ) }
);

export type BasemapOfflineSettingsQueryVariables = Exact<{
  id: Scalars['Int'];
  slug: Scalars['String'];
}>;


export type BasemapOfflineSettingsQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id' | 'mapboxPublicKey'>
    & { region: (
      { __typename?: 'GeometryPolygon' }
      & Pick<GeometryPolygon, 'geojson'>
    ), offlineTileSettings: Array<(
      { __typename?: 'OfflineTileSetting' }
      & OfflineTileSettingsFragment
    )> }
  )>, basemap?: Maybe<(
    { __typename?: 'Basemap' }
    & Pick<Basemap, 'id' | 'name' | 'url' | 'useDefaultOfflineTileSettings'>
    & { project?: Maybe<(
      { __typename?: 'Project' }
      & Pick<Project, 'id'>
      & { region: (
        { __typename?: 'GeometryPolygon' }
        & Pick<GeometryPolygon, 'geojson'>
      ) }
    )>, offlineSupportInformation?: Maybe<(
      { __typename?: 'OfflineSupportInformation' }
      & Pick<OfflineSupportInformation, 'id' | 'hasUncacheableSources'>
      & { sources: Array<(
        { __typename?: 'OfflineSourceDetails' }
        & Pick<OfflineSourceDetails, 'dataSourceUrl' | 'type'>
      )> }
    )> }
  )> }
);

export type UpdateBasemapOfflineTileSettingsMutationVariables = Exact<{
  projectId: Scalars['Int'];
  maxZ: Scalars['Int'];
  maxShorelineZ?: Maybe<Scalars['Int']>;
  basemapId: Scalars['Int'];
  useDefault: Scalars['Boolean'];
}>;


export type UpdateBasemapOfflineTileSettingsMutation = (
  { __typename?: 'Mutation' }
  & { updateBasemapOfflineTileSettings?: Maybe<(
    { __typename?: 'UpdateBasemapOfflineTileSettingsPayload' }
    & { basemap?: Maybe<(
      { __typename?: 'Basemap' }
      & Pick<Basemap, 'id' | 'useDefaultOfflineTileSettings'>
      & { project?: Maybe<(
        { __typename?: 'Project' }
        & Pick<Project, 'id'>
        & { offlineTileSettings: Array<(
          { __typename?: 'OfflineTileSetting' }
          & OfflineTileSettingsFragment
        )> }
      )> }
    )> }
  )> }
);

export type GenerateOfflineTilePackageMutationVariables = Exact<{
  dataSourceUrl: Scalars['String'];
  projectId: Scalars['Int'];
  maxZ: Scalars['Int'];
  maxShorelineZ?: Maybe<Scalars['Int']>;
  sourceType?: Maybe<OfflineTilePackageSourceType>;
  originalUrlTemplate: Scalars['String'];
}>;


export type GenerateOfflineTilePackageMutation = (
  { __typename?: 'Mutation' }
  & { generateOfflineTilePackage?: Maybe<(
    { __typename?: 'GenerateOfflineTilePackagePayload' }
    & { offlineTilePackage?: Maybe<(
      { __typename?: 'OfflineTilePackage' }
      & { project?: Maybe<(
        { __typename?: 'Project' }
        & Pick<Project, 'id'>
        & { surveys: Array<(
          { __typename?: 'Survey' }
          & Pick<Survey, 'id'>
          & { basemaps?: Maybe<Array<(
            { __typename?: 'Basemap' }
            & Pick<Basemap, 'id'>
            & { offlineSupportInformation?: Maybe<(
              { __typename?: 'OfflineSupportInformation' }
              & Pick<OfflineSupportInformation, 'id'>
              & { staticAssets: Array<(
                { __typename?: 'CacheableOfflineAsset' }
                & Pick<CacheableOfflineAsset, 'url' | 'type'>
              )>, sources: Array<(
                { __typename?: 'OfflineSourceDetails' }
                & Pick<OfflineSourceDetails, 'templateUrl' | 'dataSourceUrl' | 'type'>
                & { tilePackages: Array<(
                  { __typename?: 'OfflineTilePackage' }
                  & OfflineTilePackageDetailsFragment
                )> }
              )> }
            )> }
          )>> }
        )> }
      )> }
      & OfflineTilePackageDetailsFragment
    )> }
  )> }
);

export type DeleteTilePackageMutationVariables = Exact<{
  id: Scalars['UUID'];
}>;


export type DeleteTilePackageMutation = (
  { __typename?: 'Mutation' }
  & { deleteOfflineTilePackage?: Maybe<(
    { __typename?: 'DeleteOfflineTilePackagePayload' }
    & { offlineTilePackage?: Maybe<(
      { __typename?: 'OfflineTilePackage' }
      & Pick<OfflineTilePackage, 'id'>
    )> }
  )> }
);

export type GetTilePackageQueryVariables = Exact<{
  id: Scalars['UUID'];
}>;


export type GetTilePackageQuery = (
  { __typename?: 'Query' }
  & { offlineTilePackage?: Maybe<(
    { __typename?: 'OfflineTilePackage' }
    & OfflineTilePackageDetailsFragment
  )> }
);

export type ProjectAccessControlSettingsQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type ProjectAccessControlSettingsQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename: 'Project' }
    & Pick<Project, 'id' | 'accessControl' | 'isListed'>
  )> }
);

export type UpdateProjectAccessControlSettingsMutationVariables = Exact<{
  slug: Scalars['String'];
  accessControl?: Maybe<ProjectAccessControlSetting>;
  isListed?: Maybe<Scalars['Boolean']>;
}>;


export type UpdateProjectAccessControlSettingsMutation = (
  { __typename?: 'Mutation' }
  & { updateProjectBySlug?: Maybe<(
    { __typename?: 'UpdateProjectPayload' }
    & Pick<UpdateProjectPayload, 'clientMutationId'>
    & { project?: Maybe<(
      { __typename: 'Project' }
      & Pick<Project, 'id' | 'accessControl' | 'isListed'>
    )> }
  )> }
);

export type ToggleLanguageSupportMutationVariables = Exact<{
  slug: Scalars['String'];
  enable: Scalars['Boolean'];
  code: Scalars['String'];
}>;


export type ToggleLanguageSupportMutation = (
  { __typename?: 'Mutation' }
  & { toggleLanguageSupport?: Maybe<(
    { __typename?: 'ToggleLanguageSupportPayload' }
    & { project?: Maybe<(
      { __typename?: 'Project' }
      & Pick<Project, 'id' | 'supportedLanguages'>
    )> }
  )> }
);

export type SetTranslatedPropsMutationVariables = Exact<{
  id: Scalars['Int'];
  typeName: Scalars['String'];
  propName: Scalars['String'];
  translations: Array<TranslatedPropInput> | TranslatedPropInput;
}>;


export type SetTranslatedPropsMutation = (
  { __typename?: 'Mutation' }
  & { setTranslatedProp: (
    { __typename?: 'setTranslatedPropResult' }
    & Pick<SetTranslatedPropResult, 'id' | 'translatedProps' | 'typeName'>
  ) }
);

export type ProjectMetadataFragment = (
  { __typename?: 'Project' }
  & Pick<Project, 'id' | 'slug' | 'url' | 'name' | 'description' | 'logoLink' | 'logoUrl' | 'accessControl' | 'sessionIsAdmin' | 'isFeatured' | 'supportEmail' | 'isOfflineEnabled' | 'sketchGeometryToken' | 'supportedLanguages' | 'translatedProps' | 'hideForums' | 'hideSketches' | 'hideOverlays'>
  & { sketchClasses: Array<(
    { __typename?: 'SketchClass' }
    & Pick<SketchClass, 'id' | 'name' | 'canDigitize' | 'formElementId' | 'isArchived' | 'translatedProps'>
  )> }
);

export type ProjectPublicDetailsMetadataFragment = (
  { __typename?: 'PublicProjectDetail' }
  & Pick<PublicProjectDetail, 'id' | 'accessControl' | 'slug' | 'name' | 'logoUrl' | 'supportEmail' | 'accessStatus'>
);

export type ProjectMetadataMeFragFragment = (
  { __typename?: 'User' }
  & Pick<User, 'id'>
  & { profile?: Maybe<(
    { __typename?: 'Profile' }
    & Pick<Profile, 'userId' | 'fullname' | 'nickname' | 'email' | 'picture' | 'affiliations'>
  )> }
);

export type ProjectMetadataQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type ProjectMetadataQuery = (
  { __typename?: 'Query' }
  & Pick<Query, 'isMyEmailVerified'>
  & { project?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'sessionParticipationStatus' | 'sessionHasPrivilegedAccess'>
    & ProjectMetadataFragment
  )>, projectPublicDetails?: Maybe<(
    { __typename?: 'PublicProjectDetail' }
    & ProjectPublicDetailsMetadataFragment
  )>, me?: Maybe<(
    { __typename?: 'User' }
    & ProjectMetadataMeFragFragment
  )> }
);

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = (
  { __typename?: 'Query' }
  & Pick<Query, 'isMyEmailVerified'>
  & { me?: Maybe<(
    { __typename?: 'User' }
    & Pick<User, 'id'>
    & { profile?: Maybe<(
      { __typename?: 'Profile' }
      & UserProfileDetailsFragment
    )> }
  )> }
);

export type ProjectRegionQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type ProjectRegionQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename: 'Project' }
    & Pick<Project, 'id'>
    & { region: (
      { __typename?: 'GeometryPolygon' }
      & Pick<GeometryPolygon, 'geojson'>
    ) }
  )> }
);

export type UpdateProjectRegionMutationVariables = Exact<{
  slug: Scalars['String'];
  region: Scalars['GeoJSON'];
}>;


export type UpdateProjectRegionMutation = (
  { __typename?: 'Mutation' }
  & { updateProjectBySlug?: Maybe<(
    { __typename?: 'UpdateProjectPayload' }
    & Pick<UpdateProjectPayload, 'clientMutationId'>
    & { project?: Maybe<(
      { __typename: 'Project' }
      & Pick<Project, 'id'>
      & { region: (
        { __typename?: 'GeometryPolygon' }
        & Pick<GeometryPolygon, 'geojson'>
      ) }
    )> }
  )> }
);

export type GetProjectBySlugQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type GetProjectBySlugQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id' | 'name'>
  )> }
);

export type ProjectSlugExistsQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type ProjectSlugExistsQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id'>
  )> }
);

export type OverlayFragment = (
  { __typename?: 'TableOfContentsItem' }
  & Pick<TableOfContentsItem, 'id' | 'bounds' | 'dataLayerId' | 'enableDownload' | 'hideChildren' | 'isClickOffOnly' | 'isFolder' | 'parentStableId' | 'showRadioChildren' | 'sortIndex' | 'stableId' | 'title' | 'geoprocessingReferenceId' | 'translatedProps' | 'hasMetadata'>
  & { acl?: Maybe<(
    { __typename?: 'Acl' }
    & Pick<Acl, 'id' | 'type'>
  )> }
);

export type PublishedTableOfContentsQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type PublishedTableOfContentsQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id'>
    & { tableOfContentsItems?: Maybe<Array<(
      { __typename?: 'TableOfContentsItem' }
      & OverlayFragment
    )>> }
  )> }
);

export type DataSourceDetailsFragment = (
  { __typename?: 'DataSource' }
  & Pick<DataSource, 'id' | 'attribution' | 'bounds' | 'buffer' | 'byteLength' | 'cluster' | 'clusterMaxZoom' | 'clusterProperties' | 'clusterRadius' | 'coordinates' | 'encoding' | 'enhancedSecurity' | 'importType' | 'lineMetrics' | 'maxzoom' | 'minzoom' | 'originalSourceUrl' | 'queryParameters' | 'scheme' | 'tiles' | 'tileSize' | 'tolerance' | 'type' | 'url' | 'urls' | 'useDevicePixelRatio' | 'supportsDynamicLayers' | 'translatedProps' | 'arcgisFetchStrategy'>
);

export type ClientSpriteFragment = (
  { __typename?: 'Sprite' }
  & Pick<Sprite, 'id' | 'type'>
  & { spriteImages: Array<(
    { __typename?: 'SpriteImage' }
    & Pick<SpriteImage, 'url' | 'height' | 'width' | 'pixelRatio' | 'spriteId'>
  )> }
);

export type DataLayerDetailsFragment = (
  { __typename?: 'DataLayer' }
  & Pick<DataLayer, 'id' | 'mapboxGlStyles' | 'renderUnder' | 'sourceLayer' | 'sublayer' | 'zIndex' | 'staticId' | 'dataSourceId'>
  & { sprites?: Maybe<Array<(
    { __typename?: 'Sprite' }
    & ClientSpriteFragment
  )>>, interactivitySettings?: Maybe<(
    { __typename?: 'InteractivitySetting' }
    & Pick<InteractivitySetting, 'cursor' | 'id' | 'longTemplate' | 'shortTemplate' | 'type'>
  )> }
);

export type ProjectListItemFragment = (
  { __typename?: 'Project' }
  & Pick<Project, 'id' | 'logoUrl' | 'name' | 'slug' | 'description' | 'url' | 'isFeatured' | 'translatedProps'>
);

export type ProjectListingQueryVariables = Exact<{
  first?: Maybe<Scalars['Int']>;
  after?: Maybe<Scalars['Cursor']>;
  last?: Maybe<Scalars['Int']>;
  before?: Maybe<Scalars['Cursor']>;
}>;


export type ProjectListingQuery = (
  { __typename?: 'Query' }
  & { projects?: Maybe<(
    { __typename?: 'ProjectsConnection' }
    & Pick<ProjectsConnection, 'totalCount'>
    & { edges: Array<(
      { __typename?: 'ProjectsEdge' }
      & Pick<ProjectsEdge, 'cursor'>
      & { node: (
        { __typename?: 'Project' }
        & ProjectListItemFragment
      ) }
    )>, pageInfo: (
      { __typename?: 'PageInfo' }
      & Pick<PageInfo, 'hasNextPage' | 'hasPreviousPage' | 'endCursor' | 'startCursor'>
    ) }
  )>, featuredProjects?: Maybe<(
    { __typename?: 'ProjectsConnection' }
    & { nodes: Array<(
      { __typename?: 'Project' }
      & ProjectListItemFragment
    )> }
  )> }
);

export type SketchFormElementFragment = (
  { __typename?: 'FormElement' }
  & Pick<FormElement, 'id' | 'componentSettings' | 'alternateLanguageSettings' | 'body' | 'isRequired' | 'isInput' | 'position' | 'typeId' | 'exportId' | 'generatedExportId' | 'generatedLabel'>
  & { type?: Maybe<(
    { __typename?: 'FormElementType' }
    & Pick<FormElementType, 'componentName' | 'isInput' | 'isSingleUseOnly' | 'isSurveysOnly' | 'label' | 'isHidden' | 'geostatsType' | 'geostatsArrayOf'>
  )> }
);

export type SketchingDetailsFragment = (
  { __typename?: 'SketchClass' }
  & Pick<SketchClass, 'id' | 'name' | 'isArchived' | 'isTemplate' | 'mapboxGlStyle' | 'projectId' | 'sketchCount' | 'allowMulti' | 'geometryType' | 'geoprocessingClientName' | 'geoprocessingClientUrl' | 'geoprocessingProjectUrl' | 'formElementId' | 'preprocessingEndpoint' | 'preprocessingProjectUrl' | 'canDigitize' | 'translatedProps'>
  & { validChildren?: Maybe<Array<(
    { __typename?: 'SketchClass' }
    & Pick<SketchClass, 'id' | 'name'>
  )>>, form?: Maybe<(
    { __typename?: 'Form' }
    & Pick<Form, 'id'>
    & { formElements?: Maybe<Array<(
      { __typename?: 'FormElement' }
      & SketchFormElementFragment
    )>>, logicRules?: Maybe<Array<(
      { __typename?: 'FormLogicRule' }
      & LogicRuleDetailsFragment
    )>> }
  )> }
);

export type AdminSketchingDetailsFragment = (
  { __typename?: 'SketchClass' }
  & { acl?: Maybe<(
    { __typename?: 'Acl' }
    & Pick<Acl, 'nodeId' | 'type' | 'id' | 'sketchClassId'>
    & { groups?: Maybe<Array<(
      { __typename?: 'Group' }
      & Pick<Group, 'id' | 'name'>
    )>> }
  )> }
  & SketchingDetailsFragment
);

export type SketchClassFormQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type SketchClassFormQuery = (
  { __typename?: 'Query' }
  & { form?: Maybe<(
    { __typename?: 'Form' }
    & Pick<Form, 'id' | 'sketchClassId'>
    & { formElements?: Maybe<Array<(
      { __typename?: 'FormElement' }
      & SketchFormElementFragment
    )>>, logicRules?: Maybe<Array<(
      { __typename?: 'FormLogicRule' }
      & LogicRuleDetailsFragment
    )>> }
  )> }
);

export type CreateSketchClassMutationVariables = Exact<{
  projectId: Scalars['Int'];
  templateId: Scalars['Int'];
}>;


export type CreateSketchClassMutation = (
  { __typename?: 'Mutation' }
  & { createSketchClassFromTemplate?: Maybe<(
    { __typename?: 'CreateSketchClassFromTemplatePayload' }
    & { sketchClass?: Maybe<(
      { __typename?: 'SketchClass' }
      & AdminSketchingDetailsFragment
    )> }
  )> }
);

export type TemplateSketchClassFragment = (
  { __typename?: 'SketchClass' }
  & Pick<SketchClass, 'id' | 'name' | 'geometryType' | 'templateDescription'>
);

export type TemplateSketchClassesQueryVariables = Exact<{ [key: string]: never; }>;


export type TemplateSketchClassesQuery = (
  { __typename?: 'Query' }
  & { templateSketchClasses?: Maybe<Array<(
    { __typename?: 'SketchClass' }
    & TemplateSketchClassFragment
  )>> }
);

export type SketchClassesQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type SketchClassesQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id'>
    & { sketchClasses: Array<(
      { __typename?: 'SketchClass' }
      & AdminSketchingDetailsFragment
    )> }
  )> }
);

export type UpdateSketchClassMutationVariables = Exact<{
  id: Scalars['Int'];
  name?: Maybe<Scalars['String']>;
  isArchived?: Maybe<Scalars['Boolean']>;
}>;


export type UpdateSketchClassMutation = (
  { __typename?: 'Mutation' }
  & { updateSketchClass?: Maybe<(
    { __typename?: 'UpdateSketchClassPayload' }
    & { sketchClass?: Maybe<(
      { __typename?: 'SketchClass' }
      & AdminSketchingDetailsFragment
    )> }
  )> }
);

export type DeleteSketchClassMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteSketchClassMutation = (
  { __typename?: 'Mutation' }
  & { deleteSketchClass?: Maybe<(
    { __typename?: 'DeleteSketchClassPayload' }
    & { sketchClass?: Maybe<(
      { __typename?: 'SketchClass' }
      & AdminSketchingDetailsFragment
    )> }
  )> }
);

export type UpdateGeoprocessingServicesMutationVariables = Exact<{
  id: Scalars['Int'];
  preprocessingEndpoint?: Maybe<Scalars['String']>;
  preprocessingProjectUrl?: Maybe<Scalars['String']>;
  geoprocessingClientName?: Maybe<Scalars['String']>;
  geoprocessingClientUrl?: Maybe<Scalars['String']>;
  geoprocessingProjectUrl?: Maybe<Scalars['String']>;
}>;


export type UpdateGeoprocessingServicesMutation = (
  { __typename?: 'Mutation' }
  & { updateSketchClass?: Maybe<(
    { __typename?: 'UpdateSketchClassPayload' }
    & { sketchClass?: Maybe<(
      { __typename?: 'SketchClass' }
      & Pick<SketchClass, 'id' | 'preprocessingEndpoint' | 'preprocessingProjectUrl' | 'geoprocessingClientName' | 'geoprocessingClientUrl' | 'geoprocessingProjectUrl'>
    )> }
  )> }
);

export type UpdateSketchFormElementMutationVariables = Exact<{
  id: Scalars['Int'];
  isRequired?: Maybe<Scalars['Boolean']>;
  exportId?: Maybe<Scalars['String']>;
}>;


export type UpdateSketchFormElementMutation = (
  { __typename?: 'Mutation' }
  & { updateFormElement?: Maybe<(
    { __typename?: 'UpdateFormElementPayload' }
    & { formElement?: Maybe<(
      { __typename?: 'FormElement' }
      & Pick<FormElement, 'id' | 'isRequired' | 'exportId'>
    )> }
  )> }
);

export type LogicRuleEditorFormElementDetailsFragment = (
  { __typename?: 'FormElement' }
  & Pick<FormElement, 'generatedLabel' | 'componentSettings'>
  & { type?: Maybe<(
    { __typename?: 'FormElementType' }
    & Pick<FormElementType, 'componentName' | 'isInput' | 'isHidden' | 'supportedOperators'>
  )> }
  & SketchFormElementFragment
);

export type LogicRuleEditorFormDetailsFragment = (
  { __typename?: 'Form' }
  & Pick<Form, 'id'>
  & { formElements?: Maybe<Array<(
    { __typename?: 'FormElement' }
    & LogicRuleEditorFormElementDetailsFragment
  )>>, logicRules?: Maybe<Array<(
    { __typename?: 'FormLogicRule' }
    & LogicRuleDetailsFragment
  )>> }
);

export type SketchClassLogicRuleDetailsQueryVariables = Exact<{
  sketchClassId: Scalars['Int'];
}>;


export type SketchClassLogicRuleDetailsQuery = (
  { __typename?: 'Query' }
  & { sketchClass?: Maybe<(
    { __typename?: 'SketchClass' }
    & { form?: Maybe<(
      { __typename?: 'Form' }
      & LogicRuleEditorFormDetailsFragment
    )> }
  )> }
);

export type CreateVisibilityRuleMutationVariables = Exact<{
  formElementId: Scalars['Int'];
}>;


export type CreateVisibilityRuleMutation = (
  { __typename?: 'Mutation' }
  & { createVisibilityLogicRule?: Maybe<(
    { __typename?: 'CreateVisibilityLogicRulePayload' }
    & { formLogicRule?: Maybe<(
      { __typename?: 'FormLogicRule' }
      & Pick<FormLogicRule, 'id'>
      & LogicRuleDetailsFragment
    )> }
  )> }
);

export type UpdateVisibilityRuleMutationVariables = Exact<{
  id: Scalars['Int'];
  command?: Maybe<FormLogicCommand>;
  booleanOperator?: Maybe<FormLogicOperator>;
}>;


export type UpdateVisibilityRuleMutation = (
  { __typename?: 'Mutation' }
  & { updateFormLogicRule?: Maybe<(
    { __typename?: 'UpdateFormLogicRulePayload' }
    & { formLogicRule?: Maybe<(
      { __typename?: 'FormLogicRule' }
      & Pick<FormLogicRule, 'id' | 'command' | 'booleanOperator'>
    )> }
  )> }
);

export type UpdateVisibilityConditionMutationVariables = Exact<{
  id: Scalars['Int'];
  operator?: Maybe<FieldRuleOperator>;
  subjectId?: Maybe<Scalars['Int']>;
  value?: Maybe<Scalars['JSON']>;
}>;


export type UpdateVisibilityConditionMutation = (
  { __typename?: 'Mutation' }
  & { updateFormLogicCondition?: Maybe<(
    { __typename?: 'UpdateFormLogicConditionPayload' }
    & { formLogicCondition?: Maybe<(
      { __typename?: 'FormLogicCondition' }
      & Pick<FormLogicCondition, 'id' | 'operator' | 'subjectId' | 'value'>
    )> }
  )> }
);

export type DeleteVisibilityRuleMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteVisibilityRuleMutation = (
  { __typename?: 'Mutation' }
  & { deleteFormLogicRule?: Maybe<(
    { __typename?: 'DeleteFormLogicRulePayload' }
    & { formLogicRule?: Maybe<(
      { __typename?: 'FormLogicRule' }
      & Pick<FormLogicRule, 'id'>
    )> }
  )> }
);

export type AddVisibilityConditionMutationVariables = Exact<{
  ruleId: Scalars['Int'];
  subjectId: Scalars['Int'];
  operator: FieldRuleOperator;
  value: Scalars['JSON'];
}>;


export type AddVisibilityConditionMutation = (
  { __typename?: 'Mutation' }
  & { createFormLogicCondition?: Maybe<(
    { __typename?: 'CreateFormLogicConditionPayload' }
    & { formLogicCondition?: Maybe<(
      { __typename?: 'FormLogicCondition' }
      & Pick<FormLogicCondition, 'id' | 'operator' | 'subjectId' | 'value' | 'ruleId'>
    )> }
  )> }
);

export type DeleteVisibilityRuleConditionMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteVisibilityRuleConditionMutation = (
  { __typename?: 'Mutation' }
  & { deleteFormLogicCondition?: Maybe<(
    { __typename?: 'DeleteFormLogicConditionPayload' }
    & { formLogicCondition?: Maybe<(
      { __typename?: 'FormLogicCondition' }
      & Pick<FormLogicCondition, 'id'>
    )> }
  )> }
);

export type UpdateSketchClassStyleMutationVariables = Exact<{
  id: Scalars['Int'];
  style?: Maybe<Scalars['JSON']>;
}>;


export type UpdateSketchClassStyleMutation = (
  { __typename?: 'Mutation' }
  & { updateSketchClassMapboxGLStyle: (
    { __typename?: 'SketchClass' }
    & Pick<SketchClass, 'id' | 'mapboxGlStyle'>
  ) }
);

export type SketchTocDetailsFragment = (
  { __typename?: 'Sketch' }
  & Pick<Sketch, 'id' | 'bbox' | 'name' | 'numVertices' | 'sketchClassId' | 'collectionId' | 'folderId' | 'timestamp' | 'updatedAt' | 'createdAt' | 'isCollection'>
  & { sketchClass?: Maybe<(
    { __typename?: 'SketchClass' }
    & Pick<SketchClass, 'id' | 'geometryType'>
  )> }
);

export type SketchFolderDetailsFragment = (
  { __typename?: 'SketchFolder' }
  & Pick<SketchFolder, 'collectionId' | 'folderId' | 'id' | 'name'>
);

export type SketchingQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type SketchingQuery = (
  { __typename?: 'Query' }
  & { me?: Maybe<(
    { __typename?: 'User' }
    & Pick<User, 'id'>
  )>, projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'sessionParticipationStatus' | 'id' | 'supportedLanguages' | 'sketchGeometryToken'>
    & { sketchClasses: Array<(
      { __typename?: 'SketchClass' }
      & SketchingDetailsFragment
    )>, mySketches?: Maybe<Array<(
      { __typename: 'Sketch' }
      & SketchTocDetailsFragment
    )>>, myFolders?: Maybe<Array<(
      { __typename: 'SketchFolder' }
      & SketchFolderDetailsFragment
    )>> }
  )> }
);

export type CreateSketchFolderMutationVariables = Exact<{
  slug: Scalars['String'];
  name: Scalars['String'];
  folderId?: Maybe<Scalars['Int']>;
  collectionId?: Maybe<Scalars['Int']>;
}>;


export type CreateSketchFolderMutation = (
  { __typename?: 'Mutation' }
  & { createSketchFolder?: Maybe<(
    { __typename?: 'CreateSketchFolderPayload' }
    & { sketchFolder?: Maybe<(
      { __typename?: 'SketchFolder' }
      & SketchFolderDetailsFragment
    )> }
  )> }
);

export type SketchCrudResponseFragment = (
  { __typename?: 'Sketch' }
  & Pick<Sketch, 'id' | 'name' | 'properties' | 'geojsonProperties'>
  & { userGeom?: Maybe<(
    { __typename?: 'GeometryGeometryCollection' }
    & Pick<GeometryGeometryCollection, 'geojson'>
  ) | (
    { __typename?: 'GeometryLineString' }
    & Pick<GeometryLineString, 'geojson'>
  ) | (
    { __typename?: 'GeometryMultiLineString' }
    & Pick<GeometryMultiLineString, 'geojson'>
  ) | (
    { __typename?: 'GeometryMultiPoint' }
    & Pick<GeometryMultiPoint, 'geojson'>
  ) | (
    { __typename?: 'GeometryMultiPolygon' }
    & Pick<GeometryMultiPolygon, 'geojson'>
  ) | (
    { __typename?: 'GeometryPoint' }
    & Pick<GeometryPoint, 'geojson'>
  ) | (
    { __typename?: 'GeometryPolygon' }
    & Pick<GeometryPolygon, 'geojson'>
  )>, parentCollection?: Maybe<(
    { __typename?: 'Sketch' }
    & Pick<Sketch, 'id' | 'updatedAt' | 'timestamp'>
  )> }
  & SketchTocDetailsFragment
  & SketchEditorModalDetailsFragment
);

export type CreateSketchMutationVariables = Exact<{
  name: Scalars['String'];
  sketchClassId: Scalars['Int'];
  userGeom?: Maybe<Scalars['GeoJSON']>;
  collectionId?: Maybe<Scalars['Int']>;
  folderId?: Maybe<Scalars['Int']>;
  properties: Scalars['JSON'];
}>;


export type CreateSketchMutation = (
  { __typename?: 'Mutation' }
  & { createSketch?: Maybe<(
    { __typename?: 'Sketch' }
    & SketchCrudResponseFragment
  )> }
);

export type UpdateSketchMutationVariables = Exact<{
  id: Scalars['Int'];
  name: Scalars['String'];
  userGeom?: Maybe<Scalars['GeoJSON']>;
  properties: Scalars['JSON'];
}>;


export type UpdateSketchMutation = (
  { __typename?: 'Mutation' }
  & { updateSketch?: Maybe<(
    { __typename?: 'Sketch' }
    & SketchCrudResponseFragment
  )> }
);

export type DeleteSketchTocItemsMutationVariables = Exact<{
  items: Array<Maybe<UpdateTocItemParentInput>> | Maybe<UpdateTocItemParentInput>;
}>;


export type DeleteSketchTocItemsMutation = (
  { __typename?: 'Mutation' }
  & { deleteSketchTocItems?: Maybe<(
    { __typename?: 'DeleteSketchTocItemsResults' }
    & Pick<DeleteSketchTocItemsResults, 'deletedItems'>
    & { updatedCollections: Array<Maybe<(
      { __typename?: 'Sketch' }
      & Pick<Sketch, 'id' | 'updatedAt'>
    )>> }
  )> }
);

export type RenameFolderMutationVariables = Exact<{
  id: Scalars['Int'];
  name: Scalars['String'];
}>;


export type RenameFolderMutation = (
  { __typename?: 'Mutation' }
  & { updateSketchFolder?: Maybe<(
    { __typename?: 'UpdateSketchFolderPayload' }
    & { sketchFolder?: Maybe<(
      { __typename?: 'SketchFolder' }
      & Pick<SketchFolder, 'id' | 'name'>
    )> }
  )> }
);

export type SketchEditorModalDetailsFragment = (
  { __typename?: 'Sketch' }
  & Pick<Sketch, 'properties' | 'userAttributes'>
  & { userGeom?: Maybe<(
    { __typename?: 'GeometryGeometryCollection' }
    & Pick<GeometryGeometryCollection, 'geojson'>
  ) | (
    { __typename?: 'GeometryLineString' }
    & Pick<GeometryLineString, 'geojson'>
  ) | (
    { __typename?: 'GeometryMultiLineString' }
    & Pick<GeometryMultiLineString, 'geojson'>
  ) | (
    { __typename?: 'GeometryMultiPoint' }
    & Pick<GeometryMultiPoint, 'geojson'>
  ) | (
    { __typename?: 'GeometryMultiPolygon' }
    & Pick<GeometryMultiPolygon, 'geojson'>
  ) | (
    { __typename?: 'GeometryPoint' }
    & Pick<GeometryPoint, 'geojson'>
  ) | (
    { __typename?: 'GeometryPolygon' }
    & Pick<GeometryPolygon, 'geojson'>
  )>, sketchClass?: Maybe<(
    { __typename?: 'SketchClass' }
    & SketchingDetailsFragment
  )> }
  & SketchTocDetailsFragment
);

export type GetSketchForEditingQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type GetSketchForEditingQuery = (
  { __typename?: 'Query' }
  & { sketch?: Maybe<(
    { __typename?: 'Sketch' }
    & SketchEditorModalDetailsFragment
  )> }
);

export type UpdateTocItemsParentMutationVariables = Exact<{
  folderId?: Maybe<Scalars['Int']>;
  collectionId?: Maybe<Scalars['Int']>;
  tocItems: Array<Maybe<UpdateTocItemParentInput>> | Maybe<UpdateTocItemParentInput>;
}>;


export type UpdateTocItemsParentMutation = (
  { __typename?: 'Mutation' }
  & { updateSketchTocItemParent?: Maybe<(
    { __typename?: 'UpdateSketchTocItemParentResults' }
    & { folders: Array<Maybe<(
      { __typename?: 'SketchFolder' }
      & Pick<SketchFolder, 'id' | 'folderId' | 'collectionId'>
    )>>, sketches: Array<Maybe<(
      { __typename?: 'Sketch' }
      & Pick<Sketch, 'id' | 'updatedAt' | 'folderId' | 'collectionId'>
    )>>, updatedCollections: Array<Maybe<(
      { __typename?: 'Sketch' }
      & Pick<Sketch, 'id' | 'updatedAt'>
    )>> }
  )> }
);

export type SketchReportingDetailsQueryVariables = Exact<{
  id: Scalars['Int'];
  sketchClassId: Scalars['Int'];
}>;


export type SketchReportingDetailsQuery = (
  { __typename?: 'Query' }
  & { sketch?: Maybe<(
    { __typename?: 'Sketch' }
    & Pick<Sketch, 'id' | 'name' | 'createdAt' | 'updatedAt' | 'properties' | 'userAttributes' | 'childProperties'>
  )>, sketchClass?: Maybe<(
    { __typename?: 'SketchClass' }
    & Pick<SketchClass, 'id' | 'geoprocessingClientName' | 'geoprocessingClientUrl' | 'geoprocessingProjectUrl' | 'geometryType'>
    & { project?: Maybe<(
      { __typename?: 'Project' }
      & Pick<Project, 'id' | 'supportedLanguages'>
    )>, form?: Maybe<(
      { __typename?: 'Form' }
      & Pick<Form, 'id'>
      & { formElements?: Maybe<Array<(
        { __typename?: 'FormElement' }
        & Pick<FormElement, 'exportId' | 'id' | 'isInput' | 'typeId' | 'body' | 'generatedExportId' | 'generatedLabel'>
      )>>, logicRules?: Maybe<Array<(
        { __typename?: 'FormLogicRule' }
        & LogicRuleDetailsFragment
      )>> }
    )> }
  )> }
);

export type CopyTocItemMutationVariables = Exact<{
  id: Scalars['Int'];
  type: SketchChildType;
}>;


export type CopyTocItemMutation = (
  { __typename?: 'Mutation' }
  & { copySketchTocItem?: Maybe<(
    { __typename?: 'CopySketchTocItemResults' }
    & Pick<CopySketchTocItemResults, 'parentId'>
    & { folders?: Maybe<Array<(
      { __typename?: 'SketchFolder' }
      & SketchFolderDetailsFragment
    )>>, sketches?: Maybe<Array<(
      { __typename?: 'Sketch' }
      & SketchTocDetailsFragment
    )>>, updatedCollection?: Maybe<(
      { __typename?: 'Sketch' }
      & Pick<Sketch, 'id' | 'updatedAt'>
    )> }
  )> }
);

export type ProjectSketchesFragment = (
  { __typename?: 'Project' }
  & { sketchClasses: Array<(
    { __typename?: 'SketchClass' }
    & SketchingDetailsFragment
  )> }
);

export type SurveyListDetailsFragment = (
  { __typename?: 'Survey' }
  & Pick<Survey, 'id' | 'accessType' | 'showProgress' | 'isDisabled' | 'limitToSingleResponse' | 'name' | 'submittedResponseCount' | 'practiceResponseCount' | 'projectId' | 'isTemplate' | 'showFacilitationOption' | 'supportedLanguages'>
  & { invitedGroups?: Maybe<Array<(
    { __typename?: 'Group' }
    & Pick<Group, 'id' | 'name'>
  )>> }
);

export type SurveysQueryVariables = Exact<{
  projectId: Scalars['Int'];
}>;


export type SurveysQuery = (
  { __typename?: 'Query' }
  & { project?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id'>
    & { surveys: Array<(
      { __typename?: 'Survey' }
      & SurveyListDetailsFragment
    )> }
  )> }
);

export type CreateSurveyMutationVariables = Exact<{
  name: Scalars['String'];
  projectId: Scalars['Int'];
  templateId?: Maybe<Scalars['Int']>;
}>;


export type CreateSurveyMutation = (
  { __typename?: 'Mutation' }
  & { makeSurvey?: Maybe<(
    { __typename?: 'MakeSurveyPayload' }
    & { survey?: Maybe<(
      { __typename?: 'Survey' }
      & SurveyListDetailsFragment
    )> }
  )> }
);

export type SurveyByIdQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type SurveyByIdQuery = (
  { __typename?: 'Query' }
  & { survey?: Maybe<(
    { __typename?: 'Survey' }
    & Pick<Survey, 'isSpatial'>
    & SurveyListDetailsFragment
  )> }
);

export type AddFormElementTypeDetailsFragment = (
  { __typename?: 'FormElementType' }
  & Pick<FormElementType, 'componentName' | 'isHidden' | 'isInput' | 'isSingleUseOnly' | 'isSurveysOnly' | 'label' | 'supportedOperators' | 'isSpatial' | 'allowedLayouts'>
);

export type FormElementDetailsFragment = (
  { __typename?: 'FormElement' }
  & Pick<FormElement, 'body' | 'componentSettings' | 'alternateLanguageSettings' | 'exportId' | 'formId' | 'id' | 'isRequired' | 'position' | 'jumpToId' | 'isInput' | 'typeId' | 'backgroundColor' | 'secondaryColor' | 'backgroundImage' | 'layout' | 'backgroundPalette' | 'textVariant' | 'unsplashAuthorUrl' | 'unsplashAuthorName' | 'backgroundWidth' | 'backgroundHeight' | 'subordinateTo' | 'mapBasemaps' | 'mapCameraOptions' | 'generatedExportId' | 'generatedLabel'>
  & { type?: Maybe<(
    { __typename?: 'FormElementType' }
    & AddFormElementTypeDetailsFragment
  )> }
);

export type SketchClassDetailsFragment = (
  { __typename?: 'SketchClass' }
  & Pick<SketchClass, 'id' | 'mapboxGlStyle' | 'formElementId' | 'geometryType' | 'geoprocessingClientName' | 'geoprocessingClientUrl' | 'geoprocessingProjectUrl' | 'allowMulti'>
  & { form?: Maybe<(
    { __typename?: 'Form' }
    & Pick<Form, 'id'>
    & { formElements?: Maybe<Array<(
      { __typename?: 'FormElement' }
      & FormElementDetailsFragment
    )>>, logicRules?: Maybe<Array<(
      { __typename?: 'FormLogicRule' }
      & LogicRuleDetailsFragment
    )>> }
  )> }
);

export type FormElementFullDetailsFragment = (
  { __typename?: 'FormElement' }
  & { sketchClass?: Maybe<(
    { __typename?: 'SketchClass' }
    & SketchClassDetailsFragment
  )> }
  & FormElementDetailsFragment
);

export type LogicRuleConditionDetailsFragment = (
  { __typename?: 'FormLogicCondition' }
  & Pick<FormLogicCondition, 'id' | 'operator' | 'value' | 'subjectId' | 'ruleId'>
);

export type LogicRuleDetailsFragment = (
  { __typename?: 'FormLogicRule' }
  & Pick<FormLogicRule, 'booleanOperator' | 'command' | 'id' | 'jumpToId' | 'position' | 'formElementId'>
  & { conditions?: Maybe<Array<(
    { __typename?: 'FormLogicCondition' }
    & LogicRuleConditionDetailsFragment
  )>> }
);

export type SurveyFormEditorDetailsQueryVariables = Exact<{
  id: Scalars['Int'];
  slug: Scalars['String'];
}>;


export type SurveyFormEditorDetailsQuery = (
  { __typename?: 'Query' }
  & { formElementTypes?: Maybe<Array<(
    { __typename?: 'FormElementType' }
    & AddFormElementTypeDetailsFragment
  )>>, survey?: Maybe<(
    { __typename?: 'Survey' }
    & { form?: Maybe<(
      { __typename?: 'Form' }
      & Pick<Form, 'id' | 'isTemplate' | 'surveyId' | 'templateName' | 'templateType'>
      & { formElements?: Maybe<Array<(
        { __typename?: 'FormElement' }
        & FormElementFullDetailsFragment
      )>>, logicRules?: Maybe<Array<(
        { __typename?: 'FormLogicRule' }
        & LogicRuleDetailsFragment
      )>> }
    )> }
    & SurveyListDetailsFragment
  )>, projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id' | 'name' | 'url'>
    & { region: (
      { __typename?: 'GeometryPolygon' }
      & Pick<GeometryPolygon, 'geojson'>
    ) }
  )> }
);

export type FormElementTypesQueryVariables = Exact<{ [key: string]: never; }>;


export type FormElementTypesQuery = (
  { __typename?: 'Query' }
  & { formElementTypes?: Maybe<Array<(
    { __typename?: 'FormElementType' }
    & AddFormElementTypeDetailsFragment
  )>> }
);

export type UpdateSurveyBaseSettingsMutationVariables = Exact<{
  id: Scalars['Int'];
  showProgress?: Maybe<Scalars['Boolean']>;
  showFacilitationOption?: Maybe<Scalars['Boolean']>;
  supportedLanguages?: Maybe<Array<Maybe<Scalars['String']>> | Maybe<Scalars['String']>>;
}>;


export type UpdateSurveyBaseSettingsMutation = (
  { __typename?: 'Mutation' }
  & { updateSurvey?: Maybe<(
    { __typename?: 'UpdateSurveyPayload' }
    & { survey?: Maybe<(
      { __typename?: 'Survey' }
      & Pick<Survey, 'id' | 'showProgress' | 'showFacilitationOption' | 'supportedLanguages'>
    )> }
  )> }
);

export type UpdateFormElementSketchClassMutationVariables = Exact<{
  id: Scalars['Int'];
  geometryType?: Maybe<SketchGeometryType>;
  allowMulti?: Maybe<Scalars['Boolean']>;
  geoprocessingClientName?: Maybe<Scalars['String']>;
  geoprocessingClientUrl?: Maybe<Scalars['String']>;
  geoprocessingProjectUrl?: Maybe<Scalars['String']>;
}>;


export type UpdateFormElementSketchClassMutation = (
  { __typename?: 'Mutation' }
  & { updateSketchClass?: Maybe<(
    { __typename?: 'UpdateSketchClassPayload' }
    & { sketchClass?: Maybe<(
      { __typename?: 'SketchClass' }
      & Pick<SketchClass, 'id' | 'geometryType' | 'allowMulti' | 'mapboxGlStyle' | 'geoprocessingClientName' | 'geoprocessingClientUrl' | 'geoprocessingProjectUrl'>
    )> }
  )> }
);

export type UpdateFormElementMutationVariables = Exact<{
  id: Scalars['Int'];
  isRequired?: Maybe<Scalars['Boolean']>;
  body?: Maybe<Scalars['JSON']>;
  exportId?: Maybe<Scalars['String']>;
  componentSettings?: Maybe<Scalars['JSON']>;
  alternateLanguageSettings?: Maybe<Scalars['JSON']>;
  jumpToId?: Maybe<Scalars['Int']>;
  typeId?: Maybe<Scalars['String']>;
}>;


export type UpdateFormElementMutation = (
  { __typename?: 'Mutation' }
  & { updateFormElement?: Maybe<(
    { __typename?: 'UpdateFormElementPayload' }
    & { formElement?: Maybe<(
      { __typename?: 'FormElement' }
      & Pick<FormElement, 'id' | 'isRequired' | 'body' | 'exportId' | 'componentSettings' | 'alternateLanguageSettings' | 'jumpToId' | 'typeId'>
    )> }
  )> }
);

export type UpdateComponentSettingsMutationVariables = Exact<{
  id: Scalars['Int'];
  componentSettings?: Maybe<Scalars['JSON']>;
}>;


export type UpdateComponentSettingsMutation = (
  { __typename?: 'Mutation' }
  & { updateFormElement?: Maybe<(
    { __typename?: 'UpdateFormElementPayload' }
    & { formElement?: Maybe<(
      { __typename?: 'FormElement' }
      & Pick<FormElement, 'id' | 'componentSettings'>
    )> }
  )> }
);

export type UpdateAlternateLanguageSettingsMutationVariables = Exact<{
  id: Scalars['Int'];
  alternateLanguageSettings?: Maybe<Scalars['JSON']>;
}>;


export type UpdateAlternateLanguageSettingsMutation = (
  { __typename?: 'Mutation' }
  & { updateFormElement?: Maybe<(
    { __typename?: 'UpdateFormElementPayload' }
    & { formElement?: Maybe<(
      { __typename?: 'FormElement' }
      & Pick<FormElement, 'id' | 'alternateLanguageSettings'>
    )> }
  )> }
);

export type UpdateFormElementBodyMutationVariables = Exact<{
  id: Scalars['Int'];
  body: Scalars['JSON'];
}>;


export type UpdateFormElementBodyMutation = (
  { __typename?: 'Mutation' }
  & { updateFormElement?: Maybe<(
    { __typename?: 'UpdateFormElementPayload' }
    & { formElement?: Maybe<(
      { __typename?: 'FormElement' }
      & Pick<FormElement, 'id' | 'body'>
    )> }
  )> }
);

export type UpdateFormElementOrderMutationVariables = Exact<{
  elementIds?: Maybe<Array<Maybe<Scalars['Int']>> | Maybe<Scalars['Int']>>;
}>;


export type UpdateFormElementOrderMutation = (
  { __typename?: 'Mutation' }
  & { setFormElementOrder?: Maybe<(
    { __typename?: 'SetFormElementOrderPayload' }
    & { formElements?: Maybe<Array<(
      { __typename?: 'FormElement' }
      & Pick<FormElement, 'id' | 'position'>
    )>> }
  )> }
);

export type AddFormElementMutationVariables = Exact<{
  body: Scalars['JSON'];
  componentSettings: Scalars['JSON'];
  formId: Scalars['Int'];
  componentType: Scalars['String'];
  position?: Maybe<Scalars['Int']>;
  exportId?: Maybe<Scalars['String']>;
  subordinateTo?: Maybe<Scalars['Int']>;
  isRequired: Scalars['Boolean'];
}>;


export type AddFormElementMutation = (
  { __typename?: 'Mutation' }
  & { createFormElement?: Maybe<(
    { __typename?: 'CreateFormElementPayload' }
    & { formElement?: Maybe<(
      { __typename?: 'FormElement' }
      & FormElementFullDetailsFragment
    )> }
  )> }
);

export type DeleteFormElementMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteFormElementMutation = (
  { __typename?: 'Mutation' }
  & { deleteFormElement?: Maybe<(
    { __typename?: 'DeleteFormElementPayload' }
    & { formElement?: Maybe<(
      { __typename?: 'FormElement' }
      & Pick<FormElement, 'id'>
    )> }
  )> }
);

export type UpdateFormMutationVariables = Exact<{
  id: Scalars['Int'];
  isTemplate?: Maybe<Scalars['Boolean']>;
  templateName?: Maybe<Scalars['String']>;
}>;


export type UpdateFormMutation = (
  { __typename?: 'Mutation' }
  & { updateForm?: Maybe<(
    { __typename?: 'UpdateFormPayload' }
    & { form?: Maybe<(
      { __typename?: 'Form' }
      & Pick<Form, 'id' | 'isTemplate' | 'templateName'>
    )> }
  )> }
);

export type GetPhotosQueryVariables = Exact<{
  query: Scalars['String'];
}>;


export type GetPhotosQuery = (
  { __typename?: 'Query' }
  & { getUnsplashPhotos: (
    { __typename?: 'UnsplashSearchResult' }
    & { results: Array<(
      { __typename?: 'UnsplashPhoto' }
      & Pick<UnsplashPhoto, 'blur_hash' | 'color' | 'description' | 'height' | 'width' | 'id'>
      & { links: (
        { __typename?: 'UnsplashPhotoLinks' }
        & Pick<UnsplashPhotoLinks, 'download_location'>
      ), urls: (
        { __typename?: 'UnsplashUrls' }
        & Pick<UnsplashUrls, 'full' | 'raw' | 'regular' | 'small' | 'thumb'>
      ), user: (
        { __typename?: 'UnsplashUser' }
        & Pick<UnsplashUser, 'id' | 'name' | 'username'>
        & { links: (
          { __typename?: 'UnsplashLinks' }
          & Pick<UnsplashLinks, 'html'>
        ) }
      ) }
    )> }
  ) }
);

export type UpdateFormElementBackgroundMutationVariables = Exact<{
  id: Scalars['Int'];
  backgroundColor?: Maybe<Scalars['String']>;
  secondaryColor?: Maybe<Scalars['String']>;
  backgroundPalette?: Maybe<Array<Maybe<Scalars['String']>> | Maybe<Scalars['String']>>;
  textVariant?: Maybe<FormElementTextVariant>;
  layout?: Maybe<FormElementLayout>;
}>;


export type UpdateFormElementBackgroundMutation = (
  { __typename?: 'Mutation' }
  & { updateFormElement?: Maybe<(
    { __typename?: 'UpdateFormElementPayload' }
    & { formElement?: Maybe<(
      { __typename?: 'FormElement' }
      & Pick<FormElement, 'id' | 'backgroundColor' | 'secondaryColor' | 'backgroundImage' | 'layout' | 'backgroundPalette' | 'textVariant' | 'unsplashAuthorName' | 'unsplashAuthorUrl'>
    )> }
  )> }
);

export type SetFormElementBackgroundMutationVariables = Exact<{
  id: Scalars['Int'];
  backgroundColor: Scalars['String'];
  secondaryColor: Scalars['String'];
  backgroundUrl: Scalars['String'];
  downloadUrl: Scalars['String'];
  backgroundPalette: Array<Maybe<Scalars['String']>> | Maybe<Scalars['String']>;
  unsplashAuthorUrl: Scalars['String'];
  unsplashAuthorName: Scalars['String'];
  backgroundWidth: Scalars['Int'];
  backgroundHeight: Scalars['Int'];
}>;


export type SetFormElementBackgroundMutation = (
  { __typename?: 'Mutation' }
  & { setFormElementBackground: (
    { __typename?: 'FormElement' }
    & Pick<FormElement, 'id' | 'backgroundColor' | 'secondaryColor' | 'backgroundImage' | 'backgroundPalette' | 'unsplashAuthorName' | 'unsplashAuthorUrl' | 'backgroundWidth' | 'backgroundHeight'>
  ) }
);

export type ClearFormElementStyleMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type ClearFormElementStyleMutation = (
  { __typename?: 'Mutation' }
  & { clearFormElementStyle?: Maybe<(
    { __typename?: 'ClearFormElementStylePayload' }
    & { formElement?: Maybe<(
      { __typename?: 'FormElement' }
      & Pick<FormElement, 'id' | 'backgroundColor' | 'backgroundImage' | 'backgroundPalette' | 'unsplashAuthorName' | 'unsplashAuthorUrl' | 'textVariant' | 'secondaryColor' | 'layout'>
    )> }
  )> }
);

export type CreateLogicRuleForSurveyMutationVariables = Exact<{
  formElementId: Scalars['Int'];
  operator: FieldRuleOperator;
  jumpToId: Scalars['Int'];
}>;


export type CreateLogicRuleForSurveyMutation = (
  { __typename?: 'Mutation' }
  & { createSurveyJumpRule?: Maybe<(
    { __typename?: 'CreateSurveyJumpRulePayload' }
    & { formLogicRule?: Maybe<(
      { __typename?: 'FormLogicRule' }
      & Pick<FormLogicRule, 'id' | 'position' | 'booleanOperator' | 'command' | 'formElementId' | 'jumpToId'>
      & { conditions?: Maybe<Array<(
        { __typename?: 'FormLogicCondition' }
        & Pick<FormLogicCondition, 'id' | 'operator' | 'ruleId' | 'subjectId' | 'value'>
      )>> }
    )> }
  )> }
);

export type UpdateFormLogicRuleMutationVariables = Exact<{
  id: Scalars['Int'];
  jumpToId?: Maybe<Scalars['Int']>;
  booleanOperator?: Maybe<FormLogicOperator>;
  formElementId?: Maybe<Scalars['Int']>;
}>;


export type UpdateFormLogicRuleMutation = (
  { __typename?: 'Mutation' }
  & { updateFormLogicRule?: Maybe<(
    { __typename?: 'UpdateFormLogicRulePayload' }
    & { formLogicRule?: Maybe<(
      { __typename?: 'FormLogicRule' }
      & Pick<FormLogicRule, 'id' | 'booleanOperator' | 'command' | 'jumpToId' | 'position' | 'formElementId'>
    )> }
  )> }
);

export type UpdateLogicConditionMutationVariables = Exact<{
  id: Scalars['Int'];
  operator?: Maybe<FieldRuleOperator>;
  value?: Maybe<Scalars['JSON']>;
  subjectId?: Maybe<Scalars['Int']>;
}>;


export type UpdateLogicConditionMutation = (
  { __typename?: 'Mutation' }
  & { updateFormLogicCondition?: Maybe<(
    { __typename?: 'UpdateFormLogicConditionPayload' }
    & { formLogicCondition?: Maybe<(
      { __typename?: 'FormLogicCondition' }
      & Pick<FormLogicCondition, 'id' | 'ruleId' | 'operator' | 'subjectId' | 'value'>
    )> }
  )> }
);

export type DeleteLogicConditionMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteLogicConditionMutation = (
  { __typename?: 'Mutation' }
  & { deleteFormLogicCondition?: Maybe<(
    { __typename?: 'DeleteFormLogicConditionPayload' }
    & { formLogicCondition?: Maybe<(
      { __typename?: 'FormLogicCondition' }
      & Pick<FormLogicCondition, 'id' | 'ruleId'>
    )> }
  )> }
);

export type DeleteLogicRuleMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteLogicRuleMutation = (
  { __typename?: 'Mutation' }
  & { deleteFormLogicRule?: Maybe<(
    { __typename?: 'DeleteFormLogicRulePayload' }
    & { formLogicRule?: Maybe<(
      { __typename?: 'FormLogicRule' }
      & Pick<FormLogicRule, 'id' | 'formElementId'>
    )> }
  )> }
);

export type AddConditionMutationVariables = Exact<{
  operator: FieldRuleOperator;
  ruleId: Scalars['Int'];
  subjectId: Scalars['Int'];
  value?: Maybe<Scalars['JSON']>;
}>;


export type AddConditionMutation = (
  { __typename?: 'Mutation' }
  & { createFormLogicCondition?: Maybe<(
    { __typename?: 'CreateFormLogicConditionPayload' }
    & { formLogicCondition?: Maybe<(
      { __typename?: 'FormLogicCondition' }
      & Pick<FormLogicCondition, 'id' | 'operator' | 'ruleId' | 'subjectId' | 'value'>
    )> }
  )> }
);

export type UpdateSurveyDraftStatusMutationVariables = Exact<{
  id: Scalars['Int'];
  isDisabled: Scalars['Boolean'];
}>;


export type UpdateSurveyDraftStatusMutation = (
  { __typename?: 'Mutation' }
  & { updateSurvey?: Maybe<(
    { __typename?: 'UpdateSurveyPayload' }
    & { survey?: Maybe<(
      { __typename?: 'Survey' }
      & Pick<Survey, 'id' | 'isDisabled'>
    )> }
  )> }
);

export type UploadConsentDocMutationVariables = Exact<{
  document: Scalars['Upload'];
  formElementId: Scalars['Int'];
  version: Scalars['Int'];
}>;


export type UploadConsentDocMutation = (
  { __typename?: 'Mutation' }
  & { uploadConsentDocument: (
    { __typename?: 'FormElement' }
    & Pick<FormElement, 'id' | 'componentSettings'>
  ) }
);

export type SurveyResponseFragment = (
  { __typename?: 'SurveyResponse' }
  & Pick<SurveyResponse, 'id' | 'surveyId' | 'bypassedDuplicateSubmissionControl' | 'updatedAt' | 'accountEmail' | 'userId' | 'createdAt' | 'data' | 'isDuplicateEntry' | 'isDuplicateIp' | 'isPractice' | 'isUnrecognizedUserAgent' | 'archived' | 'lastUpdatedByEmail'>
);

export type FormElementExtendedDetailsFragment = (
  { __typename?: 'FormElement' }
  & { sketchClass?: Maybe<(
    { __typename?: 'SketchClass' }
    & Pick<SketchClass, 'geometryType'>
  )>, surveyConsentDocumentsConnection: (
    { __typename?: 'SurveyConsentDocumentsConnection' }
    & { nodes: Array<(
      { __typename?: 'SurveyConsentDocument' }
      & Pick<SurveyConsentDocument, 'url' | 'version'>
    )> }
  ) }
  & FormElementDetailsFragment
);

export type SurveyResponsesQueryVariables = Exact<{
  surveyId: Scalars['Int'];
}>;


export type SurveyResponsesQuery = (
  { __typename?: 'Query' }
  & { survey?: Maybe<(
    { __typename?: 'Survey' }
    & Pick<Survey, 'id' | 'practiceResponseCount' | 'archivedResponseCount' | 'submittedResponseCount' | 'responsesSpatialExtent'>
    & { form?: Maybe<(
      { __typename?: 'Form' }
      & { formElements?: Maybe<Array<(
        { __typename?: 'FormElement' }
        & FormElementExtendedDetailsFragment
      )>>, logicRules?: Maybe<Array<(
        { __typename?: 'FormLogicRule' }
        & SurveyAppRuleFragment
      )>> }
    )>, surveyResponsesConnection: (
      { __typename?: 'SurveyResponsesConnection' }
      & { nodes: Array<(
        { __typename?: 'SurveyResponse' }
        & SurveyResponseFragment
      )> }
    ) }
  )> }
);

export type SurveyMapDetailsQueryVariables = Exact<{
  surveyId: Scalars['Int'];
}>;


export type SurveyMapDetailsQuery = (
  { __typename?: 'Query' }
  & { survey?: Maybe<(
    { __typename?: 'Survey' }
    & { form?: Maybe<(
      { __typename?: 'Form' }
      & Pick<Form, 'id'>
      & { formElements?: Maybe<Array<(
        { __typename?: 'FormElement' }
        & FormElementDetailsFragment
      )>> }
    )> }
  )> }
);

export type ToggleResponsesPracticeMutationVariables = Exact<{
  ids?: Maybe<Array<Maybe<Scalars['Int']>> | Maybe<Scalars['Int']>>;
  isPractice?: Maybe<Scalars['Boolean']>;
}>;


export type ToggleResponsesPracticeMutation = (
  { __typename?: 'Mutation' }
  & { toggleResponsesPractice?: Maybe<(
    { __typename?: 'ToggleResponsesPracticePayload' }
    & { surveyResponses?: Maybe<Array<(
      { __typename?: 'SurveyResponse' }
      & Pick<SurveyResponse, 'id' | 'isPractice' | 'archived' | 'lastUpdatedByEmail'>
      & { survey?: Maybe<(
        { __typename?: 'Survey' }
        & Pick<Survey, 'id' | 'practiceResponseCount' | 'archivedResponseCount' | 'submittedResponseCount'>
      )> }
    )>> }
  )> }
);

export type ArchiveResponsesMutationVariables = Exact<{
  ids?: Maybe<Array<Maybe<Scalars['Int']>> | Maybe<Scalars['Int']>>;
  makeArchived?: Maybe<Scalars['Boolean']>;
}>;


export type ArchiveResponsesMutation = (
  { __typename?: 'Mutation' }
  & { archiveResponses?: Maybe<(
    { __typename?: 'ArchiveResponsesPayload' }
    & { surveyResponses?: Maybe<Array<(
      { __typename?: 'SurveyResponse' }
      & Pick<SurveyResponse, 'id' | 'isPractice' | 'archived' | 'lastUpdatedByEmail'>
      & { survey?: Maybe<(
        { __typename?: 'Survey' }
        & Pick<Survey, 'id' | 'practiceResponseCount' | 'archivedResponseCount' | 'submittedResponseCount'>
      )> }
    )>> }
  )> }
);

export type ModifyAnswersMutationVariables = Exact<{
  responseIds: Array<Maybe<Scalars['Int']>> | Maybe<Scalars['Int']>;
  answers?: Maybe<Scalars['JSON']>;
}>;


export type ModifyAnswersMutation = (
  { __typename?: 'Mutation' }
  & { modifySurveyAnswers?: Maybe<(
    { __typename?: 'ModifySurveyAnswersPayload' }
    & { surveyResponses?: Maybe<Array<(
      { __typename?: 'SurveyResponse' }
      & Pick<SurveyResponse, 'id' | 'data' | 'updatedAt' | 'lastUpdatedByEmail'>
    )>> }
  )> }
);

export type CopyAppearanceMutationVariables = Exact<{
  id: Scalars['Int'];
  copyFrom: Scalars['Int'];
}>;


export type CopyAppearanceMutation = (
  { __typename?: 'Mutation' }
  & { copyAppearance?: Maybe<(
    { __typename?: 'CopyAppearancePayload' }
    & { formElement?: Maybe<(
      { __typename?: 'FormElement' }
      & Pick<FormElement, 'id' | 'backgroundImage' | 'backgroundColor' | 'secondaryColor' | 'backgroundPalette' | 'unsplashAuthorName' | 'unsplashAuthorUrl' | 'backgroundHeight' | 'backgroundWidth' | 'layout' | 'textVariant'>
    )> }
  )> }
);

export type UpdateFormElementBasemapsMutationVariables = Exact<{
  id: Scalars['Int'];
  mapBasemaps?: Maybe<Array<Maybe<Scalars['Int']>> | Maybe<Scalars['Int']>>;
}>;


export type UpdateFormElementBasemapsMutation = (
  { __typename?: 'Mutation' }
  & { updateFormElement?: Maybe<(
    { __typename?: 'UpdateFormElementPayload' }
    & { formElement?: Maybe<(
      { __typename?: 'FormElement' }
      & Pick<FormElement, 'id' | 'mapBasemaps'>
    )> }
  )> }
);

export type UpdateFormElementMapCameraMutationVariables = Exact<{
  id: Scalars['Int'];
  mapCameraOptions?: Maybe<Scalars['JSON']>;
}>;


export type UpdateFormElementMapCameraMutation = (
  { __typename?: 'Mutation' }
  & { updateFormElement?: Maybe<(
    { __typename?: 'UpdateFormElementPayload' }
    & { formElement?: Maybe<(
      { __typename?: 'FormElement' }
      & Pick<FormElement, 'id' | 'mapCameraOptions'>
    )> }
  )> }
);

export type AllBasemapsQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type AllBasemapsQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id'>
    & { basemaps?: Maybe<Array<(
      { __typename?: 'Basemap' }
      & BasemapDetailsFragment
    )>>, surveyBasemaps?: Maybe<Array<(
      { __typename?: 'Basemap' }
      & { relatedFormElements?: Maybe<Array<(
        { __typename?: 'FormElement' }
        & Pick<FormElement, 'id'>
      )>> }
      & BasemapDetailsFragment
    )>> }
  )> }
);

export type GetFormElementQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type GetFormElementQuery = (
  { __typename?: 'Query' }
  & { formElement?: Maybe<(
    { __typename?: 'FormElement' }
    & FormElementDetailsFragment
  )> }
);

export type UpdateOfflineEnabledMutationVariables = Exact<{
  projectId: Scalars['Int'];
  enabled: Scalars['Boolean'];
}>;


export type UpdateOfflineEnabledMutation = (
  { __typename?: 'Mutation' }
  & { enableOfflineSupport?: Maybe<(
    { __typename?: 'EnableOfflineSupportPayload' }
    & { project?: Maybe<(
      { __typename?: 'Project' }
      & Pick<Project, 'id' | 'isOfflineEnabled'>
    )> }
  )> }
);

export type SurveyAppRuleFragment = (
  { __typename?: 'FormLogicRule' }
  & Pick<FormLogicRule, 'booleanOperator' | 'command' | 'formElementId' | 'id' | 'jumpToId' | 'position'>
  & { conditions?: Maybe<Array<(
    { __typename?: 'FormLogicCondition' }
    & Pick<FormLogicCondition, 'id' | 'operator' | 'ruleId' | 'subjectId' | 'value'>
  )>> }
);

export type SurveyAppFormElementFragment = (
  { __typename?: 'FormElement' }
  & Pick<FormElement, 'id' | 'componentSettings' | 'alternateLanguageSettings' | 'body' | 'isRequired' | 'isInput' | 'position' | 'typeId' | 'formId' | 'backgroundColor' | 'secondaryColor' | 'backgroundImage' | 'layout' | 'textVariant' | 'unsplashAuthorName' | 'unsplashAuthorUrl' | 'backgroundWidth' | 'backgroundHeight' | 'jumpToId' | 'subordinateTo' | 'mapBasemaps' | 'mapCameraOptions' | 'generatedExportId' | 'generatedLabel'>
  & { type?: Maybe<(
    { __typename?: 'FormElementType' }
    & Pick<FormElementType, 'componentName' | 'isInput' | 'isSingleUseOnly' | 'isSurveysOnly' | 'label' | 'isSpatial' | 'allowedLayouts' | 'supportedOperators' | 'isHidden'>
  )>, sketchClass?: Maybe<(
    { __typename?: 'SketchClass' }
    & SketchClassDetailsFragment
  )> }
);

export type SurveyAppSurveyFragment = (
  { __typename?: 'Survey' }
  & Pick<Survey, 'id' | 'name' | 'accessType' | 'isDisabled' | 'showProgress' | 'showFacilitationOption' | 'supportedLanguages'>
  & { basemaps?: Maybe<Array<(
    { __typename?: 'Basemap' }
    & BasemapDetailsFragment
  )>>, form?: Maybe<(
    { __typename?: 'Form' }
    & Pick<Form, 'id'>
    & { logicRules?: Maybe<Array<(
      { __typename?: 'FormLogicRule' }
      & SurveyAppRuleFragment
    )>>, formElements?: Maybe<Array<(
      { __typename?: 'FormElement' }
      & SurveyAppFormElementFragment
    )>> }
  )> }
);

export type SurveyQueryVariables = Exact<{
  id: Scalars['Int'];
  slug: Scalars['String'];
}>;


export type SurveyQuery = (
  { __typename?: 'Query' }
  & { projectPublicDetails?: Maybe<(
    { __typename?: 'PublicProjectDetail' }
    & ProjectPublicDetailsMetadataFragment
  )>, me?: Maybe<(
    { __typename?: 'User' }
    & Pick<User, 'id' | 'isAdmin'>
    & ProjectMetadataMeFragFragment
  )>, currentProject?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id' | 'name' | 'url'>
    & { region: (
      { __typename?: 'GeometryPolygon' }
      & Pick<GeometryPolygon, 'geojson'>
    ) }
    & MapEssentialsFragment
    & ProjectMetadataFragment
  )>, survey?: Maybe<(
    { __typename?: 'Survey' }
    & SurveyAppSurveyFragment
  )> }
);

export type CreateResponseMutationVariables = Exact<{
  surveyId: Scalars['Int'];
  isDraft: Scalars['Boolean'];
  bypassedDuplicateSubmissionControl: Scalars['Boolean'];
  responseData: Scalars['JSON'];
  facilitated: Scalars['Boolean'];
  practice: Scalars['Boolean'];
  offlineId?: Maybe<Scalars['UUID']>;
}>;


export type CreateResponseMutation = (
  { __typename?: 'Mutation' }
  & { createSurveyResponseV2?: Maybe<(
    { __typename?: 'CreateSurveyResponseV2Payload' }
    & Pick<CreateSurveyResponseV2Payload, 'clientMutationId'>
    & { id: CreateSurveyResponseV2Payload['integer'] }
  )> }
);

export type UpdateProjectNameMutationVariables = Exact<{
  name: Scalars['String'];
  slug: Scalars['String'];
  clientMutationId?: Maybe<Scalars['String']>;
}>;


export type UpdateProjectNameMutation = (
  { __typename?: 'Mutation' }
  & { updateProjectBySlug?: Maybe<(
    { __typename?: 'UpdateProjectPayload' }
    & Pick<UpdateProjectPayload, 'clientMutationId'>
    & { project?: Maybe<(
      { __typename?: 'Project' }
      & Pick<Project, 'id' | 'name'>
    )> }
  )> }
);

export type UpdateProjectSettingsMutationVariables = Exact<{
  slug: Scalars['String'];
  clientMutationId?: Maybe<Scalars['String']>;
  name?: Maybe<Scalars['String']>;
  description?: Maybe<Scalars['String']>;
  logoUrl?: Maybe<Scalars['Upload']>;
  logoLink?: Maybe<Scalars['String']>;
  isFeatured?: Maybe<Scalars['Boolean']>;
  mapboxPublicKey?: Maybe<Scalars['String']>;
}>;


export type UpdateProjectSettingsMutation = (
  { __typename?: 'Mutation' }
  & { updateProjectBySlug?: Maybe<(
    { __typename?: 'UpdateProjectPayload' }
    & Pick<UpdateProjectPayload, 'clientMutationId'>
    & { project?: Maybe<(
      { __typename?: 'Project' }
      & Pick<Project, 'id' | 'name' | 'description' | 'logoUrl' | 'logoLink' | 'mapboxPublicKey' | 'mapboxSecretKey' | 'isFeatured'>
    )> }
  )> }
);

export type UpdateHideSketchesMutationVariables = Exact<{
  hidden: Scalars['Boolean'];
  projectId: Scalars['Int'];
}>;


export type UpdateHideSketchesMutation = (
  { __typename?: 'Mutation' }
  & { updateProject?: Maybe<(
    { __typename?: 'UpdateProjectPayload' }
    & { project?: Maybe<(
      { __typename?: 'Project' }
      & Pick<Project, 'id' | 'hideSketches'>
    )> }
  )> }
);

export type UpdateHideForumsMutationVariables = Exact<{
  hidden: Scalars['Boolean'];
  projectId: Scalars['Int'];
}>;


export type UpdateHideForumsMutation = (
  { __typename?: 'Mutation' }
  & { updateProject?: Maybe<(
    { __typename?: 'UpdateProjectPayload' }
    & { project?: Maybe<(
      { __typename?: 'Project' }
      & Pick<Project, 'id' | 'hideForums'>
    )> }
  )> }
);

export type UpdateHideOverlaysMutationVariables = Exact<{
  hidden: Scalars['Boolean'];
  projectId: Scalars['Int'];
}>;


export type UpdateHideOverlaysMutation = (
  { __typename?: 'Mutation' }
  & { updateProject?: Maybe<(
    { __typename?: 'UpdateProjectPayload' }
    & { project?: Maybe<(
      { __typename?: 'Project' }
      & Pick<Project, 'id' | 'hideOverlays'>
    )> }
  )> }
);

export type UserAdminCountsQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type UserAdminCountsQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id' | 'accessControl' | 'participantCount' | 'adminCount' | 'unapprovedParticipantCount'>
    & { inviteCounts?: Maybe<Array<(
      { __typename?: 'InviteStat' }
      & Pick<InviteStat, 'count' | 'status'>
    )>>, groups: Array<(
      { __typename?: 'Group' }
      & Pick<Group, 'id' | 'name' | 'memberCount'>
    )> }
  )> }
);

export type CreateGroupMutationVariables = Exact<{
  projectId: Scalars['Int'];
  name: Scalars['String'];
}>;


export type CreateGroupMutation = (
  { __typename?: 'Mutation' }
  & { createGroup?: Maybe<(
    { __typename?: 'CreateGroupPayload' }
    & { group?: Maybe<(
      { __typename?: 'Group' }
      & Pick<Group, 'id' | 'name' | 'projectId'>
    )> }
  )> }
);

export type ParticipantListDetailsFragment = (
  { __typename?: 'User' }
  & Pick<User, 'id' | 'bannedFromForums' | 'isAdmin' | 'canonicalEmail'>
  & { profile?: Maybe<(
    { __typename?: 'Profile' }
    & Pick<Profile, 'userId' | 'email' | 'fullname' | 'nickname' | 'picture'>
  )>, groups?: Maybe<Array<(
    { __typename?: 'Group' }
    & Pick<Group, 'id' | 'name'>
  )>> }
);

export type ParticipantsQueryVariables = Exact<{
  slug: Scalars['String'];
  offset?: Maybe<Scalars['Int']>;
  first?: Maybe<Scalars['Int']>;
}>;


export type ParticipantsQuery = (
  { __typename?: 'Query' }
  & { root?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id'>
    & { participants?: Maybe<Array<(
      { __typename?: 'User' }
      & ParticipantListDetailsFragment
    )>> }
  )> }
);

export type AdminsQueryVariables = Exact<{
  slug: Scalars['String'];
  offset?: Maybe<Scalars['Int']>;
  first?: Maybe<Scalars['Int']>;
}>;


export type AdminsQuery = (
  { __typename?: 'Query' }
  & { root?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id'>
    & { participants?: Maybe<Array<(
      { __typename?: 'User' }
      & ParticipantListDetailsFragment
    )>> }
  )> }
);

export type GroupMembersQueryVariables = Exact<{
  groupId: Scalars['Int'];
  offset?: Maybe<Scalars['Int']>;
  first?: Maybe<Scalars['Int']>;
}>;


export type GroupMembersQuery = (
  { __typename?: 'Query' }
  & { root?: Maybe<(
    { __typename?: 'Group' }
    & { participants?: Maybe<Array<(
      { __typename?: 'User' }
      & ParticipantListDetailsFragment
    )>> }
  )> }
);

export type UserListDetailsFragment = (
  { __typename?: 'User' }
  & Pick<User, 'id' | 'isAdmin' | 'canonicalEmail' | 'bannedFromForums' | 'needsAccessRequestApproval' | 'approvedOrDeniedOn' | 'onboarded'>
  & { groups?: Maybe<Array<(
    { __typename?: 'Group' }
    & Pick<Group, 'name' | 'id'>
  )>>, approvedBy?: Maybe<(
    { __typename?: 'User' }
    & Pick<User, 'id' | 'canonicalEmail'>
  )>, deniedBy?: Maybe<(
    { __typename?: 'User' }
    & Pick<User, 'id' | 'canonicalEmail'>
  )>, profile?: Maybe<(
    { __typename?: 'Profile' }
    & Pick<Profile, 'userId' | 'email' | 'fullname' | 'nickname' | 'picture'>
  )> }
);

export type UserSettingsListsQueryVariables = Exact<{
  slug: Scalars['String'];
  projectId: Scalars['Int'];
}>;


export type UserSettingsListsQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id' | 'accessControl'>
    & { groups: Array<(
      { __typename?: 'Group' }
      & Pick<Group, 'name' | 'id'>
    )>, invitesConnection: (
      { __typename?: 'ProjectInvitesConnection' }
      & { nodes: Array<(
        { __typename?: 'ProjectInvite' }
        & InviteDetailsFragment
      )> }
    ), participants?: Maybe<Array<(
      { __typename?: 'User' }
      & UserListDetailsFragment
    )>>, accessRequestsConnection: (
      { __typename?: 'UsersConnection' }
      & { nodes: Array<(
        { __typename?: 'User' }
        & UserListDetailsFragment
      )> }
    ) }
  )> }
);

export type UserInfoQueryVariables = Exact<{
  userId: Scalars['Int'];
  slug: Scalars['String'];
  projectId: Scalars['Int'];
}>;


export type UserInfoQuery = (
  { __typename?: 'Query' }
  & { user?: Maybe<(
    { __typename?: 'User' }
    & Pick<User, 'id' | 'isAdmin' | 'canonicalEmail' | 'bannedFromForums' | 'onboarded' | 'participationStatus' | 'needsAccessRequestApproval' | 'approvedOrDeniedOn'>
    & { emailNotificationPreference?: Maybe<(
      { __typename?: 'EmailNotificationPreference' }
      & Pick<EmailNotificationPreference, 'unsubscribeAll'>
    )>, groups?: Maybe<Array<(
      { __typename?: 'Group' }
      & Pick<Group, 'name' | 'id'>
    )>>, deniedBy?: Maybe<(
      { __typename?: 'User' }
      & Pick<User, 'id' | 'canonicalEmail'>
    )>, approvedBy?: Maybe<(
      { __typename?: 'User' }
      & Pick<User, 'id' | 'canonicalEmail'>
    )>, profile?: Maybe<(
      { __typename?: 'Profile' }
      & Pick<Profile, 'userId' | 'affiliations' | 'email' | 'fullname' | 'nickname' | 'picture'>
    )> }
  )>, project?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id'>
  )>, projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id'>
    & { groups: Array<(
      { __typename?: 'Group' }
      & Pick<Group, 'name' | 'id'>
    )> }
  )> }
);

export type ToggleAdminAccessMutationVariables = Exact<{
  userId: Scalars['Int'];
  projectId: Scalars['Int'];
}>;


export type ToggleAdminAccessMutation = (
  { __typename?: 'Mutation' }
  & { toggleAdminAccess?: Maybe<(
    { __typename?: 'ToggleAdminAccessPayload' }
    & Pick<ToggleAdminAccessPayload, 'clientMutationId'>
    & { isAdmin: ToggleAdminAccessPayload['boolean'] }
  )> }
);

export type SetUserGroupsMutationVariables = Exact<{
  userId: Scalars['Int'];
  projectId: Scalars['Int'];
  groupIds: Array<Maybe<Scalars['Int']>> | Maybe<Scalars['Int']>;
}>;


export type SetUserGroupsMutation = (
  { __typename?: 'Mutation' }
  & { setUserGroups?: Maybe<(
    { __typename?: 'SetUserGroupsPayload' }
    & { groupIds: SetUserGroupsPayload['integers'] }
  )> }
);

export type ToggleForumPostingBanMutationVariables = Exact<{
  userId: Scalars['Int'];
  projectId: Scalars['Int'];
}>;


export type ToggleForumPostingBanMutation = (
  { __typename?: 'Mutation' }
  & { toggleForumPostingBan?: Maybe<(
    { __typename?: 'ToggleForumPostingBanPayload' }
    & { isBanned: ToggleForumPostingBanPayload['boolean'] }
  )> }
);

export type DeleteGroupMutationVariables = Exact<{
  groupId: Scalars['Int'];
}>;


export type DeleteGroupMutation = (
  { __typename?: 'Mutation' }
  & { deleteGroup?: Maybe<(
    { __typename?: 'DeleteGroupPayload' }
    & { group?: Maybe<(
      { __typename?: 'Group' }
      & Pick<Group, 'id'>
    )> }
  )> }
);

export type CreateProjectInvitesMutationVariables = Exact<{
  projectId: Scalars['Int'];
  makeAdmin: Scalars['Boolean'];
  groupNames: Array<Maybe<Scalars['String']>> | Maybe<Scalars['String']>;
  userDetails: Array<Maybe<ProjectInviteOptionInput>> | Maybe<ProjectInviteOptionInput>;
  sendEmailNow: Scalars['Boolean'];
}>;


export type CreateProjectInvitesMutation = (
  { __typename?: 'Mutation' }
  & { createProjectInvites?: Maybe<(
    { __typename?: 'CreateProjectInvitesPayload' }
    & { projectInvites?: Maybe<Array<(
      { __typename?: 'ProjectInvite' }
      & InviteDetailsFragment
    )>> }
  )> }
);

export type InviteDetailsFragment = (
  { __typename?: 'ProjectInvite' }
  & Pick<ProjectInvite, 'createdAt' | 'email' | 'fullname' | 'id' | 'status' | 'makeAdmin' | 'wasUsed'>
  & { groups?: Maybe<Array<(
    { __typename?: 'Group' }
    & Pick<Group, 'id' | 'name'>
  )>> }
);

export type ProjectInvitesQueryVariables = Exact<{
  projectId: Scalars['Int'];
  status?: Maybe<Array<Maybe<InviteStatus>> | Maybe<InviteStatus>>;
  orderBy?: Maybe<InviteOrderBy>;
  cursor?: Maybe<Scalars['Cursor']>;
  limit?: Maybe<Scalars['Int']>;
}>;


export type ProjectInvitesQuery = (
  { __typename?: 'Query' }
  & { project?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id'>
    & { invitesConnection: (
      { __typename?: 'ProjectInvitesConnection' }
      & { edges: Array<(
        { __typename?: 'ProjectInvitesEdge' }
        & { node: (
          { __typename?: 'ProjectInvite' }
          & InviteDetailsFragment
        ) }
      )>, pageInfo: (
        { __typename?: 'PageInfo' }
        & Pick<PageInfo, 'hasNextPage' | 'endCursor'>
      ) }
    ) }
  )> }
);

export type InviteEmailDetailsFragment = (
  { __typename?: 'InviteEmail' }
  & Pick<InviteEmail, 'id' | 'toAddress' | 'createdAt' | 'status' | 'tokenExpiresAt' | 'error' | 'updatedAt'>
);

export type InviteEditorModalQueryQueryVariables = Exact<{
  inviteId: Scalars['Int'];
  slug: Scalars['String'];
}>;


export type InviteEditorModalQueryQuery = (
  { __typename?: 'Query' }
  & { projectBySlug?: Maybe<(
    { __typename?: 'Project' }
    & Pick<Project, 'id'>
    & { groups: Array<(
      { __typename?: 'Group' }
      & Pick<Group, 'id' | 'name'>
    )> }
  )>, projectInvite?: Maybe<(
    { __typename?: 'ProjectInvite' }
    & Pick<ProjectInvite, 'id' | 'makeAdmin' | 'email' | 'fullname' | 'status' | 'wasUsed' | 'participationStatus'>
    & { groups?: Maybe<Array<(
      { __typename?: 'Group' }
      & Pick<Group, 'id' | 'name'>
    )>>, inviteEmails: Array<(
      { __typename?: 'InviteEmail' }
      & InviteEmailDetailsFragment
    )> }
  )> }
);

export type UpdateProjectInviteMutationVariables = Exact<{
  id: Scalars['Int'];
  makeAdmin: Scalars['Boolean'];
  email: Scalars['String'];
  fullname?: Maybe<Scalars['String']>;
  groups: Array<Maybe<Scalars['Int']>> | Maybe<Scalars['Int']>;
}>;


export type UpdateProjectInviteMutation = (
  { __typename?: 'Mutation' }
  & { updateProjectInvite?: Maybe<(
    { __typename?: 'UpdateProjectInvitePayload' }
    & { projectInvite?: Maybe<(
      { __typename?: 'ProjectInvite' }
      & Pick<ProjectInvite, 'id' | 'makeAdmin' | 'email' | 'fullname'>
      & { groups?: Maybe<Array<(
        { __typename?: 'Group' }
        & Pick<Group, 'id' | 'name'>
      )>>, inviteEmails: Array<(
        { __typename?: 'InviteEmail' }
        & InviteEmailDetailsFragment
      )> }
    )> }
  )> }
);

export type DeleteProjectInviteMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteProjectInviteMutation = (
  { __typename?: 'Mutation' }
  & { deleteProjectInvite?: Maybe<(
    { __typename?: 'DeleteProjectInvitePayload' }
    & { projectInvite?: Maybe<(
      { __typename?: 'ProjectInvite' }
      & Pick<ProjectInvite, 'id'>
    )> }
  )> }
);

export type SendInviteMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type SendInviteMutation = (
  { __typename?: 'Mutation' }
  & { sendProjectInvites?: Maybe<(
    { __typename?: 'SendProjectInvitesPayload' }
    & { inviteEmails?: Maybe<Array<(
      { __typename?: 'InviteEmail' }
      & { projectInvite?: Maybe<(
        { __typename?: 'ProjectInvite' }
        & Pick<ProjectInvite, 'id' | 'status'>
      )> }
      & InviteEmailDetailsFragment
    )>> }
  )> }
);

export type RenameGroupMutationVariables = Exact<{
  id: Scalars['Int'];
  name: Scalars['String'];
}>;


export type RenameGroupMutation = (
  { __typename?: 'Mutation' }
  & { updateGroup?: Maybe<(
    { __typename?: 'UpdateGroupPayload' }
    & { group?: Maybe<(
      { __typename?: 'Group' }
      & Pick<Group, 'id' | 'name'>
    )> }
  )> }
);

export type SendInvitesMutationVariables = Exact<{
  ids: Array<Maybe<Scalars['Int']>> | Maybe<Scalars['Int']>;
}>;


export type SendInvitesMutation = (
  { __typename?: 'Mutation' }
  & { sendProjectInvites?: Maybe<(
    { __typename?: 'SendProjectInvitesPayload' }
    & { inviteEmails?: Maybe<Array<(
      { __typename?: 'InviteEmail' }
      & Pick<InviteEmail, 'projectInviteId'>
      & { projectInvite?: Maybe<(
        { __typename?: 'ProjectInvite' }
        & Pick<ProjectInvite, 'id' | 'status'>
      )> }
      & InviteEmailDetailsFragment
    )>> }
  )> }
);

export type ProjectInviteEmailStatusSubscriptionSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type ProjectInviteEmailStatusSubscriptionSubscription = (
  { __typename?: 'Subscription' }
  & { projectInviteStateUpdated?: Maybe<(
    { __typename?: 'ProjectInviteStateSubscriptionPayload' }
    & { invite?: Maybe<(
      { __typename?: 'ProjectInvite' }
      & Pick<ProjectInvite, 'id' | 'status'>
    )> }
  )> }
);

export type ApproveAccessRequestMutationVariables = Exact<{
  userId: Scalars['Int'];
  projectId: Scalars['Int'];
  slug: Scalars['String'];
}>;


export type ApproveAccessRequestMutation = (
  { __typename?: 'Mutation' }
  & { approveParticipant?: Maybe<(
    { __typename?: 'ApproveParticipantPayload' }
    & { user?: Maybe<(
      { __typename?: 'User' }
      & Pick<User, 'id' | 'needsAccessRequestApproval' | 'approvedOrDeniedOn'>
      & { approvedBy?: Maybe<(
        { __typename?: 'User' }
        & Pick<User, 'id' | 'canonicalEmail'>
      )>, deniedBy?: Maybe<(
        { __typename?: 'User' }
        & Pick<User, 'id' | 'canonicalEmail'>
      )> }
    )> }
  )> }
);

export type DenyAccessRequestMutationVariables = Exact<{
  userId: Scalars['Int'];
  projectId: Scalars['Int'];
  slug: Scalars['String'];
}>;


export type DenyAccessRequestMutation = (
  { __typename?: 'Mutation' }
  & { denyParticipant?: Maybe<(
    { __typename?: 'DenyParticipantPayload' }
    & { user?: Maybe<(
      { __typename?: 'User' }
      & Pick<User, 'id' | 'needsAccessRequestApproval' | 'approvedOrDeniedOn'>
      & { approvedBy?: Maybe<(
        { __typename?: 'User' }
        & Pick<User, 'id' | 'canonicalEmail'>
      )>, deniedBy?: Maybe<(
        { __typename?: 'User' }
        & Pick<User, 'id' | 'canonicalEmail'>
      )> }
    )> }
  )> }
);

export type UserProfileDetailsFragment = (
  { __typename?: 'Profile' }
  & Pick<Profile, 'userId' | 'fullname' | 'affiliations' | 'email' | 'nickname' | 'picture'>
);

export type UpdateProfileMutationVariables = Exact<{
  userId: Scalars['Int'];
  affiliations?: Maybe<Scalars['String']>;
  email?: Maybe<Scalars['Email']>;
  fullname?: Maybe<Scalars['String']>;
  nickname?: Maybe<Scalars['String']>;
  picture?: Maybe<Scalars['Upload']>;
}>;


export type UpdateProfileMutation = (
  { __typename?: 'Mutation' }
  & { updateProfileByUserId?: Maybe<(
    { __typename?: 'UpdateProfilePayload' }
    & { profile?: Maybe<(
      { __typename?: 'Profile' }
      & Pick<Profile, 'userId'>
      & { user?: Maybe<(
        { __typename?: 'User' }
        & Pick<User, 'id'>
        & { profile?: Maybe<(
          { __typename?: 'Profile' }
          & UserProfileDetailsFragment
        )> }
      )> }
    )> }
  )> }
);

export type MyProfileQueryVariables = Exact<{ [key: string]: never; }>;


export type MyProfileQuery = (
  { __typename?: 'Query' }
  & { me?: Maybe<(
    { __typename?: 'User' }
    & Pick<User, 'id'>
    & { profile?: Maybe<(
      { __typename?: 'Profile' }
      & UserProfileDetailsFragment
    )> }
  )> }
);

export type UserIsSuperuserQueryVariables = Exact<{ [key: string]: never; }>;


export type UserIsSuperuserQuery = (
  { __typename?: 'Query' }
  & Pick<Query, 'currentUserIsSuperuser'>
);

export const UpdateTerrainExaggerationFragmentDoc = /*#__PURE__*/ gql`
    fragment UpdateTerrainExaggeration on Basemap {
  terrainExaggeration
}
    `;
export const NewLabelsLayerFragmentDoc = /*#__PURE__*/ gql`
    fragment NewLabelsLayer on Basemap {
  labelsLayerId
}
    `;
export const NewTerrainFragmentDoc = /*#__PURE__*/ gql`
    fragment NewTerrain on Basemap {
  terrainUrl
  terrainOptional
  terrainVisibilityDefault
}
    `;
export const NewBasemapFragmentDoc = /*#__PURE__*/ gql`
    fragment NewBasemap on Basemap {
  id
  projectId
  attribution
  description
  labelsLayerId
  name
  terrainExaggeration
  terrainOptional
  url
  type
  tileSize
  thumbnail
  terrainUrl
  terrainTileSize
  surveysOnly
}
    `;
export const UpdateFormatFragmentDoc = /*#__PURE__*/ gql`
    fragment UpdateFormat on DataSource {
  queryParameters
}
    `;
export const NewGlStyleFragmentDoc = /*#__PURE__*/ gql`
    fragment NewGLStyle on DataLayer {
  mapboxGlStyles
}
    `;
export const NewRenderUnderFragmentDoc = /*#__PURE__*/ gql`
    fragment NewRenderUnder on DataLayer {
  renderUnder
}
    `;
export const NewZIndexFragmentDoc = /*#__PURE__*/ gql`
    fragment NewZIndex on DataLayer {
  zIndex
}
    `;
export const NewRuleFragmentDoc = /*#__PURE__*/ gql`
    fragment NewRule on FormLogicRule {
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
export const NewConditionFragmentDoc = /*#__PURE__*/ gql`
    fragment NewCondition on FormLogicCondition {
  id
}
    `;
export const NewElementFragmentDoc = /*#__PURE__*/ gql`
    fragment NewElement on FormElement {
  body
  componentSettings
  exportId
  formId
  id
  isRequired
  position
  jumpToId
  type {
    componentName
    isHidden
    isInput
    isSingleUseOnly
    isSurveysOnly
    label
    supportedOperators
  }
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
}
    `;
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
export const NewSurveyFragmentDoc = /*#__PURE__*/ gql`
    fragment NewSurvey on Survey {
  id
  accessType
  invitedGroups {
    id
    name
  }
  isDisabled
  limitToSingleResponse
  name
  submittedResponseCount
  projectId
}
    `;
export const NewGroupFragmentDoc = /*#__PURE__*/ gql`
    fragment NewGroup on Group {
  id
  projectId
  name
}
    `;
export const NewInviteEmailFragmentDoc = /*#__PURE__*/ gql`
    fragment NewInviteEmail on InviteEmail {
  id
  toAddress
  createdAt
  status
  tokenExpiresAt
  error
  updatedAt
}
    `;
export const NewLayerOptionsFragmentDoc = /*#__PURE__*/ gql`
    fragment NewLayerOptions on OptionalBasemapLayer {
  options
}
    `;
export const UpdateAlternateLanguageSettingsFragmentDoc = /*#__PURE__*/ gql`
    fragment UpdateAlternateLanguageSettings on FormElement {
  alternateLanguageSettings
}
    `;
export const UpdateComponentSettingsFragmentDoc = /*#__PURE__*/ gql`
    fragment UpdateComponentSettings on FormElement {
  componentSettings
}
    `;
export const UpdateBodyFragmentDoc = /*#__PURE__*/ gql`
    fragment UpdateBody on FormElement {
  body
}
    `;
export const MySketchFragmentDoc = /*#__PURE__*/ gql`
    fragment MySketch on Sketch {
  name
  isCollection
  collectionId
  folderId
  timestamp
  sharedInForum
  sketchClassId
  bbox
}
    `;
export const MyFolderFragmentDoc = /*#__PURE__*/ gql`
    fragment MyFolder on SketchFolder {
  name
  collectionId
  folderId
  sharedInForum
}
    `;
export const PopupShareDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment PopupShareDetails on Post {
  id
  topicId
  topic {
    id
    title
    forumId
  }
}
    `;
export const DataFragmentDoc = /*#__PURE__*/ gql`
    fragment data on SketchFolder {
  id
  name
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
  translatedProps
  isArcgisTiledMapservice
  maxzoom
}
    `;
export const BasemapAdminDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment BasemapAdminDetails on Basemap {
  ...BasemapDetails
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
  surveysOnly
  isArcgisTiledMapservice
}
    ${BasemapDetailsFragmentDoc}`;
export const DataUploadDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment DataUploadDetails on DataUploadTask {
  createdAt
  filename
  id
  progress
  state
  errorMessage
  tableOfContentsItemStableIds
}
    `;
export const DataUploadEventFragmentDoc = /*#__PURE__*/ gql`
    fragment DataUploadEvent on DataUploadTaskSubscriptionPayload {
  projectId
  dataUploadTaskId
  previousState
  dataUploadTask {
    ...DataUploadDetails
  }
}
    ${DataUploadDetailsFragmentDoc}`;
export const ForumListDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment ForumListDetails on Forum {
  id
  name
  description
  archived
  position
  topicCount
  postCount
  lastPostDate
  readAcl {
    id
    nodeId
  }
  writeAcl {
    id
    nodeId
  }
  translatedProps
}
    `;
export const AuthorProfileFragmentDoc = /*#__PURE__*/ gql`
    fragment AuthorProfile on Profile {
  affiliations
  email
  fullname
  nickname
  picture
  userId
}
    `;
export const JobFragmentDoc = /*#__PURE__*/ gql`
    fragment Job on WorkerJob {
  attempts
  createdAt
  key
  lockedAt
  maxAttempts
  runAt
  taskIdentifier
  lastError
}
    `;
export const MapBookmarkDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment MapBookmarkDetails on MapBookmark {
  id
  imageId
  createdAt
  basemapOptionalLayerStates
  cameraOptions
  projectId
  selectedBasemap
  visibleDataLayers
  mapDimensions
  visibleSketches
  screenshotJobStatus
  basemapName
  layerNames
  job {
    ...Job
  }
  basemapName
  sketchNames
  clientGeneratedThumbnail
}
    ${JobFragmentDoc}`;
export const FileUploadDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment FileUploadDetails on FileUpload {
  id
  filename
  postId
  userId
  fileSizeBytes
  contentType
  downloadUrl
  createdAt
  usage
  cloudflareImagesId
}
    `;
export const ForumPostFragmentDoc = /*#__PURE__*/ gql`
    fragment ForumPost on Post {
  id
  authorProfile {
    ...AuthorProfile
  }
  createdAt
  hiddenByModerator
  topicId
  html
  sketchIds
  mapBookmarks {
    ...MapBookmarkDetails
  }
  fileUploads {
    ...FileUploadDetails
  }
  orderedAttachmentIds
}
    ${AuthorProfileFragmentDoc}
${MapBookmarkDetailsFragmentDoc}
${FileUploadDetailsFragmentDoc}`;
export const RecentPostFragmentDoc = /*#__PURE__*/ gql`
    fragment RecentPost on Post {
  ...ForumPost
  blurb
  topic {
    id
    postsCount
    title
    sticky
    forum {
      id
      name
      translatedProps
    }
    participantCount
    participantsConnection(first: 4) {
      nodes {
        ...AuthorProfile
      }
    }
  }
}
    ${ForumPostFragmentDoc}
${AuthorProfileFragmentDoc}`;
export const ForumDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment ForumDetails on Forum {
  id
  archived
  name
  description
  topicCount
  postCount
  lastPostDate
  canPost
  translatedProps
}
    `;
export const ForumTopicFragmentDoc = /*#__PURE__*/ gql`
    fragment ForumTopic on Topic {
  id
  title
  authorProfile {
    ...AuthorProfile
  }
  createdAt
  locked
  sticky
  postsCount
  lastPostDate
  blurb
  forumId
  participantCount
  participantsConnection(first: 5) {
    nodes {
      userId
      email
      picture
      fullname
      nickname
    }
  }
}
    ${AuthorProfileFragmentDoc}`;
export const SketchPresentFragmentDoc = /*#__PURE__*/ gql`
    fragment SketchPresent on Sketch {
  id
  name
}
    `;
export const SpriteDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment SpriteDetails on Sprite {
  id
  type
  category
  projectId
  spriteImages {
    spriteId
    height
    width
    pixelRatio
    url
  }
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
export const OfflineTilePackageDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment OfflineTilePackageDetails on OfflineTilePackage {
  id
  bytes
  projectId
  region {
    geojson
  }
  sourceType
  jobStatus
  tilesFetched
  totalTiles
  createdAt
  jobErrors
  dataSourceUrl
  isMapboxHosted
  maxZ
  maxShorelineZ
  presignedUrl
  originalUrlTemplate
}
    `;
export const BasemapOfflineSupportInfoFragmentDoc = /*#__PURE__*/ gql`
    fragment BasemapOfflineSupportInfo on OfflineSupportInformation {
  id
  styleLastModified
  staticAssets {
    url
    cacheKey
    type
  }
  sources {
    templateUrl
    dataSourceUrl
    tilePackages {
      ...OfflineTilePackageDetails
    }
    type
  }
}
    ${OfflineTilePackageDetailsFragmentDoc}`;
export const OfflineBasemapDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment OfflineBasemapDetails on Basemap {
  ...BasemapDetails
  useDefaultOfflineTileSettings
  offlineTileSettings {
    basemapId
    id
    maxShorelineZ
    maxZ
  }
  offlineSupportInformation {
    ...BasemapOfflineSupportInfo
  }
}
    ${BasemapDetailsFragmentDoc}
${BasemapOfflineSupportInfoFragmentDoc}`;
export const OfflineTileSettingsForCalculationFragmentDoc = /*#__PURE__*/ gql`
    fragment OfflineTileSettingsForCalculation on OfflineTileSetting {
  maxShorelineZ
  maxZ
}
    `;
export const OfflineTileSettingsFragmentDoc = /*#__PURE__*/ gql`
    fragment OfflineTileSettings on OfflineTileSetting {
  id
  projectId
  basemapId
  maxZ
  maxShorelineZ
  region {
    geojson
  }
}
    `;
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
  isOfflineEnabled
  sketchGeometryToken
  sketchClasses {
    id
    name
    canDigitize
    formElementId
    isArchived
    translatedProps
  }
  supportedLanguages
  translatedProps
  hideForums
  hideSketches
  hideOverlays
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
    affiliations
  }
}
    `;
export const OverlayFragmentDoc = /*#__PURE__*/ gql`
    fragment Overlay on TableOfContentsItem {
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
  geoprocessingReferenceId
  translatedProps
  hasMetadata
}
    `;
export const DataSourceDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment DataSourceDetails on DataSource {
  id
  attribution
  bounds
  buffer
  byteLength
  cluster
  clusterMaxZoom
  clusterProperties
  clusterRadius
  coordinates
  encoding
  enhancedSecurity
  importType
  lineMetrics
  maxzoom
  minzoom
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
  translatedProps
  arcgisFetchStrategy
}
    `;
export const ClientSpriteFragmentDoc = /*#__PURE__*/ gql`
    fragment ClientSprite on Sprite {
  id
  type
  spriteImages {
    url
    height
    width
    pixelRatio
    spriteId
  }
}
    `;
export const DataLayerDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment DataLayerDetails on DataLayer {
  id
  mapboxGlStyles
  renderUnder
  sourceLayer
  sublayer
  zIndex
  staticId
  dataSourceId
  sprites {
    ...ClientSprite
  }
  interactivitySettings {
    cursor
    id
    longTemplate
    shortTemplate
    type
  }
}
    ${ClientSpriteFragmentDoc}`;
export const ProjectListItemFragmentDoc = /*#__PURE__*/ gql`
    fragment ProjectListItem on Project {
  id
  logoUrl
  name
  slug
  description
  url
  isFeatured
  translatedProps
}
    `;
export const SketchFormElementFragmentDoc = /*#__PURE__*/ gql`
    fragment SketchFormElement on FormElement {
  id
  componentSettings
  alternateLanguageSettings
  body
  isRequired
  isInput
  position
  typeId
  exportId
  generatedExportId
  generatedLabel
  type {
    componentName
    isInput
    isSingleUseOnly
    isSurveysOnly
    label
    isHidden
    geostatsType
    geostatsArrayOf
  }
}
    `;
export const LogicRuleConditionDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment LogicRuleConditionDetails on FormLogicCondition {
  id
  operator
  value
  subjectId
  ruleId
}
    `;
export const LogicRuleDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment LogicRuleDetails on FormLogicRule {
  booleanOperator
  command
  id
  jumpToId
  position
  formElementId
  conditions {
    ...LogicRuleConditionDetails
  }
}
    ${LogicRuleConditionDetailsFragmentDoc}`;
export const SketchingDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment SketchingDetails on SketchClass {
  id
  name
  isArchived
  isTemplate
  mapboxGlStyle
  projectId
  sketchCount
  validChildren {
    id
    name
  }
  allowMulti
  form {
    id
    formElements {
      ...SketchFormElement
    }
    logicRules {
      ...LogicRuleDetails
    }
  }
  geometryType
  geoprocessingClientName
  geoprocessingClientUrl
  geoprocessingProjectUrl
  formElementId
  preprocessingEndpoint
  preprocessingProjectUrl
  canDigitize
  translatedProps
}
    ${SketchFormElementFragmentDoc}
${LogicRuleDetailsFragmentDoc}`;
export const AdminSketchingDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment AdminSketchingDetails on SketchClass {
  ...SketchingDetails
  acl {
    nodeId
    type
    id
    sketchClassId
    groups {
      id
      name
    }
  }
}
    ${SketchingDetailsFragmentDoc}`;
export const TemplateSketchClassFragmentDoc = /*#__PURE__*/ gql`
    fragment TemplateSketchClass on SketchClass {
  id
  name
  geometryType
  templateDescription
}
    `;
export const LogicRuleEditorFormElementDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment LogicRuleEditorFormElementDetails on FormElement {
  ...SketchFormElement
  generatedLabel
  componentSettings
  type {
    componentName
    isInput
    isHidden
    supportedOperators
  }
}
    ${SketchFormElementFragmentDoc}`;
export const LogicRuleEditorFormDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment LogicRuleEditorFormDetails on Form {
  id
  formElements {
    ...LogicRuleEditorFormElementDetails
  }
  logicRules {
    ...LogicRuleDetails
  }
}
    ${LogicRuleEditorFormElementDetailsFragmentDoc}
${LogicRuleDetailsFragmentDoc}`;
export const SketchFolderDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment SketchFolderDetails on SketchFolder {
  collectionId
  folderId
  id
  name
}
    `;
export const SketchTocDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment SketchTocDetails on Sketch {
  id
  bbox
  name
  numVertices
  sketchClassId
  collectionId
  bbox
  folderId
  timestamp
  updatedAt
  createdAt
  isCollection
  sketchClass {
    id
    geometryType
  }
}
    `;
export const SketchEditorModalDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment SketchEditorModalDetails on Sketch {
  ...SketchTocDetails
  userGeom {
    geojson
  }
  properties
  userAttributes
  sketchClass {
    ...SketchingDetails
  }
}
    ${SketchTocDetailsFragmentDoc}
${SketchingDetailsFragmentDoc}`;
export const SketchCrudResponseFragmentDoc = /*#__PURE__*/ gql`
    fragment SketchCRUDResponse on Sketch {
  ...SketchTocDetails
  id
  name
  userGeom {
    geojson
  }
  properties
  geojsonProperties
  ...SketchEditorModalDetails
  parentCollection {
    id
    updatedAt
    timestamp
  }
}
    ${SketchTocDetailsFragmentDoc}
${SketchEditorModalDetailsFragmentDoc}`;
export const ProjectSketchesFragmentDoc = /*#__PURE__*/ gql`
    fragment ProjectSketches on Project {
  sketchClasses {
    ...SketchingDetails
  }
}
    ${SketchingDetailsFragmentDoc}`;
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
  generatedExportId
  generatedLabel
}
    ${AddFormElementTypeDetailsFragmentDoc}`;
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
  sketchClass {
    geometryType
  }
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
  generatedExportId
  generatedLabel
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
  basemaps {
    ...BasemapDetails
  }
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
    ${BasemapDetailsFragmentDoc}
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
  needsAccessRequestApproval(slug: $slug)
  approvedBy(projectId: $projectId) {
    id
    canonicalEmail
  }
  deniedBy(projectId: $projectId) {
    id
    canonicalEmail
  }
  approvedOrDeniedOn(projectId: $projectId)
  onboarded
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
export const UserProfileDetailsFragmentDoc = /*#__PURE__*/ gql`
    fragment UserProfileDetails on Profile {
  userId
  fullname
  affiliations
  email
  nickname
  picture
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
export const MapboxApiKeysDocument = /*#__PURE__*/ gql`
    query MapboxAPIKeys($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    mapboxPublicKey
    mapboxSecretKey
  }
}
    `;
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
      enhancedSecurity
    }
  }
}
    `;
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
export const ResendEmailVerificationDocument = /*#__PURE__*/ gql`
    mutation ResendEmailVerification {
  resendVerificationEmail {
    success
    error
  }
}
    `;
export const RequestInviteOnlyProjectAccessDocument = /*#__PURE__*/ gql`
    mutation RequestInviteOnlyProjectAccess($projectId: Int!) {
  joinProject(input: {projectId: $projectId}) {
    clientMutationId
  }
}
    `;
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
export const CreateBasemapDocument = /*#__PURE__*/ gql`
    mutation CreateBasemap($projectId: Int, $name: String!, $thumbnail: Upload!, $tileSize: Int, $type: BasemapType!, $url: String!, $surveysOnly: Boolean, $isArcgisTiledMapservice: Boolean) {
  createBasemap(
    input: {basemap: {projectId: $projectId, name: $name, thumbnail: $thumbnail, tileSize: $tileSize, type: $type, url: $url, surveysOnly: $surveysOnly, isArcgisTiledMapservice: $isArcgisTiledMapservice}}
  ) {
    basemap {
      ...BasemapDetails
    }
  }
}
    ${BasemapDetailsFragmentDoc}`;
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
export const GetBasemapDocument = /*#__PURE__*/ gql`
    query GetBasemap($id: Int!) {
  basemap(id: $id) {
    ...BasemapAdminDetails
  }
}
    ${BasemapAdminDetailsFragmentDoc}`;
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
export const DeleteBasemapDocument = /*#__PURE__*/ gql`
    mutation DeleteBasemap($id: Int!) {
  deleteBasemap(input: {id: $id}) {
    basemap {
      id
    }
  }
}
    `;
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
export const CreateOptionalLayerDocument = /*#__PURE__*/ gql`
    mutation CreateOptionalLayer($name: String!, $basemapId: Int!, $groupType: OptionalBasemapLayersGroupType, $options: JSON) {
  createOptionalBasemapLayer(
    input: {optionalBasemapLayer: {name: $name, basemapId: $basemapId, groupType: $groupType, options: $options}}
  ) {
    optionalBasemapLayer {
      basemap {
        ...BasemapAdminDetails
      }
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
    ${BasemapAdminDetailsFragmentDoc}`;
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
export const DeleteOptionalLayerDocument = /*#__PURE__*/ gql`
    mutation DeleteOptionalLayer($id: Int!) {
  deleteOptionalBasemapLayer(input: {id: $id}) {
    optionalBasemapLayer {
      id
    }
  }
}
    `;
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
export const GetOptionalBasemapLayerMetadataDocument = /*#__PURE__*/ gql`
    query GetOptionalBasemapLayerMetadata($id: Int!) {
  optionalBasemapLayer(id: $id) {
    id
    metadata
  }
}
    `;
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
export const MapboxKeysDocument = /*#__PURE__*/ gql`
    query MapboxKeys($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    mapboxPublicKey
    mapboxSecretKey
  }
}
    `;
export const SetBasemapMaxZoomDocument = /*#__PURE__*/ gql`
    mutation SetBasemapMaxZoom($id: Int!, $maxzoom: Int) {
  updateBasemap(input: {id: $id, patch: {maxzoom: $maxzoom}}) {
    basemap {
      id
      maxzoom
    }
  }
}
    `;
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
export const VerifyEmailDocument = /*#__PURE__*/ gql`
    mutation VerifyEmail($redirectUrl: String) {
  sendEmailVerification(redirectUrl: $redirectUrl)
}
    `;
export const CreateDataUploadDocument = /*#__PURE__*/ gql`
    mutation createDataUpload($projectId: Int!, $filename: String!, $contentType: String!) {
  createDataUpload(
    input: {filename: $filename, projectId: $projectId, contentType: $contentType}
  ) {
    dataUploadTask {
      ...DataUploadDetails
      presignedUploadUrl
    }
  }
}
    ${DataUploadDetailsFragmentDoc}`;
export const SubmitDataUploadDocument = /*#__PURE__*/ gql`
    mutation submitDataUpload($id: UUID!) {
  submitDataUpload(input: {id: $id}) {
    dataUploadTask {
      ...DataUploadDetails
    }
  }
}
    ${DataUploadDetailsFragmentDoc}`;
export const DataUploadTasksDocument = /*#__PURE__*/ gql`
    query DataUploadTasks($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    activeDataUploads {
      ...DataUploadDetails
    }
  }
}
    ${DataUploadDetailsFragmentDoc}`;
export const DismissFailedTaskDocument = /*#__PURE__*/ gql`
    mutation DismissFailedTask($id: UUID!) {
  dismissFailedUpload(input: {id: $id}) {
    dataUploadTask {
      ...DataUploadDetails
    }
  }
}
    ${DataUploadDetailsFragmentDoc}`;
export const FailUploadDocument = /*#__PURE__*/ gql`
    mutation FailUpload($id: UUID!, $message: String!) {
  failDataUpload(input: {id: $id, msg: $message}) {
    dataUploadTask {
      ...DataUploadDetails
    }
  }
}
    ${DataUploadDetailsFragmentDoc}`;
export const ProjectDataQuotaRemainingDocument = /*#__PURE__*/ gql`
    query ProjectDataQuotaRemaining($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    dataHostingQuota
    dataHostingQuotaUsed
  }
}
    `;
export const CancelUploadDocument = /*#__PURE__*/ gql`
    mutation CancelUpload($projectId: Int!, $uploadId: UUID!) {
  cancelDataUpload(input: {projectId: $projectId, uploadId: $uploadId}) {
    clientMutationId
  }
}
    `;
export const DataUploadsDocument = /*#__PURE__*/ gql`
    subscription DataUploads($slug: String!) {
  dataUploadTasks(slug: $slug) {
    ...DataUploadEvent
  }
}
    ${DataUploadEventFragmentDoc}`;
export const UpdateDataHostingQuotaDocument = /*#__PURE__*/ gql`
    mutation UpdateDataHostingQuota($projectId: Int!, $quota: BigInt!) {
  updateDataHostingQuota(input: {projectId: $projectId, quota: $quota}) {
    project {
      id
      dataHostingQuota
      dataHostingQuotaUsed
    }
  }
}
    `;
export const DownloadableOfflineTilePackagesDocument = /*#__PURE__*/ gql`
    query DownloadableOfflineTilePackages($slug: String!) {
  projectBySlug(slug: $slug) {
    mapboxPublicKey
    offlineTilePackagesConnection {
      nodes {
        ...OfflineTilePackageDetails
      }
    }
  }
}
    ${OfflineTilePackageDetailsFragmentDoc}`;
export const DownloadBasemapDetailsDocument = /*#__PURE__*/ gql`
    query DownloadBasemapDetails($id: Int!) {
  basemap(id: $id) {
    ...OfflineBasemapDetails
  }
}
    ${OfflineBasemapDetailsFragmentDoc}`;
export const ImportBasemapDetailsDocument = /*#__PURE__*/ gql`
    query ImportBasemapDetails($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    surveys {
      id
      basemaps {
        id
        thumbnail
        name
        offlineSupportInformation {
          hasUncacheableSources
          ...BasemapOfflineSupportInfo
        }
      }
    }
  }
}
    ${BasemapOfflineSupportInfoFragmentDoc}`;
export const DraftTableOfContentsDocument = /*#__PURE__*/ gql`
    query DraftTableOfContents($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    draftTableOfContentsHasChanges
    tableOfContentsLastPublished
    region {
      geojson
    }
    draftTableOfContentsItems {
      ...Overlay
    }
    importedArcgisServices
  }
}
    ${OverlayFragmentDoc}`;
export const LayersAndSourcesForItemsDocument = /*#__PURE__*/ gql`
    query layersAndSourcesForItems($slug: String!, $tableOfContentsItemIds: [Int]!) {
  projectBySlug(slug: $slug) {
    id
    dataSourcesForItems(tableOfContentsItemIds: $tableOfContentsItemIds) {
      attribution
      bounds
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
      uploadedSourceFilename
      translatedProps
      arcgisFetchStrategy
    }
    dataLayersForItems(tableOfContentsItemIds: $tableOfContentsItemIds) {
      interactivitySettings {
        id
        cursor
        longTemplate
        shortTemplate
        type
      }
      staticId
      sprites {
        id
        spriteImages {
          pixelRatio
          height
          width
          url
          spriteId
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
export const DeleteBranchDocument = /*#__PURE__*/ gql`
    mutation DeleteBranch($id: Int!) {
  deleteTableOfContentsBranch(input: {tableOfContentsItemId: $id}) {
    clientMutationId
  }
}
    `;
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
export const GetFolderDocument = /*#__PURE__*/ gql`
    query GetFolder($id: Int!) {
  tableOfContentsItem(id: $id) {
    id
    bounds
    isClickOffOnly
    showRadioChildren
    title
    hideChildren
    acl {
      nodeId
      id
    }
  }
}
    `;
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
    geoprocessingReferenceId
    dataLayer {
      id
      zIndex
      mapboxGlStyles
      interactivitySettingsId
      renderUnder
      sourceLayer
      sublayer
      staticId
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
        uploadedSourceFilename
        uploadedBy
        geostats
        translatedProps
        arcgisFetchStrategy
      }
    }
  }
}
    `;
export const UpdateTableOfContentsItemDocument = /*#__PURE__*/ gql`
    mutation UpdateTableOfContentsItem($id: Int!, $title: String, $bounds: [BigFloat], $metadata: JSON, $geoprocessingReferenceId: String) {
  updateTableOfContentsItem(
    input: {id: $id, patch: {title: $title, bounds: $bounds, metadata: $metadata, geoprocessingReferenceId: $geoprocessingReferenceId}}
  ) {
    tableOfContentsItem {
      id
      bounds
      metadata
      title
      geoprocessingReferenceId
      stableId
    }
  }
}
    `;
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
export const UpdateLayerDocument = /*#__PURE__*/ gql`
    mutation UpdateLayer($id: Int!, $renderUnder: RenderUnderType, $mapboxGlStyles: JSON, $sublayer: String, $staticId: String) {
  updateDataLayer(
    input: {id: $id, patch: {renderUnder: $renderUnder, mapboxGlStyles: $mapboxGlStyles, sublayer: $sublayer, staticId: $staticId}}
  ) {
    dataLayer {
      id
      zIndex
      renderUnder
      mapboxGlStyles
      sublayer
      staticId
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
export const UpdateDataSourceDocument = /*#__PURE__*/ gql`
    mutation UpdateDataSource($id: Int!, $attribution: String) {
  updateDataSource(input: {id: $id, patch: {attribution: $attribution}}) {
    dataSource {
      id
      attribution
      bounds
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
      translatedProps
    }
  }
}
    `;
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
export const DataSourceUrlPropertiesDocument = /*#__PURE__*/ gql`
    query DataSourceUrlProperties($id: Int!) {
  dataSource(id: $id) {
    id
    type
    url
    originalSourceUrl
    queryParameters
  }
}
    `;
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
export const UpdateFetchStrategyDocument = /*#__PURE__*/ gql`
    mutation UpdateFetchStrategy($sourceId: Int!, $fetchStrategy: ArcgisFeatureLayerFetchStrategy!) {
  updateDataSource(
    input: {id: $sourceId, patch: {arcgisFetchStrategy: $fetchStrategy}}
  ) {
    dataSource {
      id
      arcgisFetchStrategy
    }
  }
}
    `;
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
export const GetMetadataDocument = /*#__PURE__*/ gql`
    query GetMetadata($itemId: Int!) {
  tableOfContentsItem(id: $itemId) {
    id
    computedMetadata
    usesDynamicMetadata
    isCustomGlSource
  }
}
    `;
export const UpdateMetadataDocument = /*#__PURE__*/ gql`
    mutation UpdateMetadata($itemId: Int!, $metadata: JSON) {
  updateTableOfContentsItem(input: {id: $itemId, patch: {metadata: $metadata}}) {
    tableOfContentsItem {
      id
      metadata
      usesDynamicMetadata
      computedMetadata
    }
  }
}
    `;
export const ProjectHostingQuotaDocument = /*#__PURE__*/ gql`
    query ProjectHostingQuota($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    dataHostingQuota
    dataHostingQuotaUsed
  }
}
    `;
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
export const PublishTableOfContentsDocument = /*#__PURE__*/ gql`
    mutation PublishTableOfContents($projectId: Int!) {
  publishTableOfContents(input: {projectId: $projectId}) {
    tableOfContentsItems {
      id
    }
  }
}
    `;
export const DraftStatusDocument = /*#__PURE__*/ gql`
    subscription DraftStatus($slug: String!) {
  updatedDraftTableOfContentsStatus(slug: $slug) {
    hasChanges
    projectId
    project {
      id
      draftTableOfContentsHasChanges
      tableOfContentsLastPublished
    }
  }
}
    `;
export const ImportArcGisServiceDocument = /*#__PURE__*/ gql`
    mutation ImportArcGISService($items: [ArcgisImportItemInput!]!, $sources: [ArcgisImportSourceInput!]!, $projectId: Int!) {
  importArcgisServices(
    input: {items: $items, sources: $sources, projectId: $projectId}
  ) {
    tableOfContentsItems {
      id
      title
    }
  }
}
    `;
export const SetMaxZoomDocument = /*#__PURE__*/ gql`
    mutation SetMaxZoom($sourceId: Int!, $maxzoom: Int) {
  updateDataSource(input: {id: $sourceId, patch: {maxzoom: $maxzoom}}) {
    dataSource {
      id
      maxzoom
    }
  }
}
    `;
export const ForumAdminListDocument = /*#__PURE__*/ gql`
    query ForumAdminList($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    forums {
      ...ForumListDetails
    }
  }
}
    ${ForumListDetailsFragmentDoc}`;
export const CreateForumDocument = /*#__PURE__*/ gql`
    mutation CreateForum($name: String!, $projectId: Int!) {
  createForum(input: {forum: {name: $name, projectId: $projectId}}) {
    forum {
      ...ForumListDetails
    }
  }
}
    ${ForumListDetailsFragmentDoc}`;
export const UpdateForumDocument = /*#__PURE__*/ gql`
    mutation UpdateForum($id: Int!, $name: String, $archived: Boolean, $description: String) {
  updateForum(
    input: {id: $id, patch: {name: $name, archived: $archived, description: $description}}
  ) {
    forum {
      id
      name
      archived
      description
    }
  }
}
    `;
export const DeleteForumDocument = /*#__PURE__*/ gql`
    mutation DeleteForum($id: Int!) {
  deleteForum(input: {id: $id}) {
    forum {
      id
    }
  }
}
    `;
export const ForumsDocument = /*#__PURE__*/ gql`
    query Forums($slug: String!) {
  me {
    id
    profile {
      ...AuthorProfile
    }
  }
  projectBySlug(slug: $slug) {
    id
    sessionParticipationStatus
    forums {
      ...ForumDetails
    }
    latestPostsConnection(first: 5) {
      nodes {
        ...RecentPost
      }
    }
  }
}
    ${AuthorProfileFragmentDoc}
${ForumDetailsFragmentDoc}
${RecentPostFragmentDoc}`;
export const TopicListDocument = /*#__PURE__*/ gql`
    query TopicList($forumId: Int!) {
  forum(id: $forumId) {
    id
    archived
    name
    description
    topicCount
    postCount
    lastPostDate
    project {
      id
      sessionParticipationStatus
    }
    canPost
    topicsConnection(orderBy: LAST_POST_CREATED_AT_AND_STICKY) {
      nodes {
        ...ForumTopic
      }
    }
  }
}
    ${ForumTopicFragmentDoc}`;
export const CreateTopicDocument = /*#__PURE__*/ gql`
    mutation CreateTopic($forumId: Int!, $content: JSON!, $title: String!) {
  createTopic(forumId: $forumId, message: $content, title: $title) {
    ...ForumTopic
    postsCount
    lastPostDate
    forum {
      id
      topicCount
      postCount
      lastPostDate
    }
  }
}
    ${ForumTopicFragmentDoc}`;
export const BreadcrumbTopicDocument = /*#__PURE__*/ gql`
    query BreadcrumbTopic($topicId: Int!) {
  topic(id: $topicId) {
    id
    title
  }
}
    `;
export const TopicDetailDocument = /*#__PURE__*/ gql`
    query TopicDetail($id: Int!) {
  topic(id: $id) {
    ...ForumTopic
    postsConnection(orderBy: ID_ASC) {
      nodes {
        ...ForumPost
      }
    }
    forum {
      id
      canPost
      project {
        id
        sessionParticipationStatus
      }
    }
  }
  me {
    id
    profile {
      ...AuthorProfile
    }
  }
}
    ${ForumTopicFragmentDoc}
${ForumPostFragmentDoc}
${AuthorProfileFragmentDoc}`;
export const CreateReplyDocument = /*#__PURE__*/ gql`
    mutation CreateReply($topicId: Int!, $content: JSON!) {
  createPost(topicId: $topicId, message: $content) {
    ...ForumPost
    topic {
      ...ForumTopic
      forum {
        id
        postCount
        topicCount
        lastPostDate
      }
    }
  }
}
    ${ForumPostFragmentDoc}
${ForumTopicFragmentDoc}`;
export const CopyTocItemForForumPostDocument = /*#__PURE__*/ gql`
    mutation CopyTocItemForForumPost($id: Int!, $type: SketchChildType!) {
  copySketchTocItem(id: $id, type: $type, forForum: true) {
    folders {
      ...SketchFolderDetails
    }
    sketches {
      ...SketchTocDetails
    }
    parentId
  }
}
    ${SketchFolderDetailsFragmentDoc}
${SketchTocDetailsFragmentDoc}`;
export const NewPostsDocument = /*#__PURE__*/ gql`
    subscription NewPosts($slug: String!) {
  forumActivity(slug: $slug) {
    post {
      ...ForumPost
    }
    topic {
      ...ForumTopic
    }
    forum {
      ...ForumDetails
    }
  }
}
    ${ForumPostFragmentDoc}
${ForumTopicFragmentDoc}
${ForumDetailsFragmentDoc}`;
export const GetBookmarkDocument = /*#__PURE__*/ gql`
    query GetBookmark($id: UUID!) {
  bookmarkById(id: $id) {
    ...MapBookmarkDetails
  }
}
    ${MapBookmarkDetailsFragmentDoc}`;
export const CreateMapBookmarkDocument = /*#__PURE__*/ gql`
    mutation CreateMapBookmark($slug: String!, $isPublic: Boolean!, $basemapOptionalLayerStates: JSON, $visibleDataLayers: [String!]!, $cameraOptions: JSON!, $selectedBasemap: Int!, $style: JSON!, $mapDimensions: [Int!]!, $visibleSketches: [Int!]!, $sidebarState: JSON, $basemapName: String!, $layerNames: JSON!, $sketchNames: JSON!, $clientGeneratedThumbnail: String!) {
  createMapBookmark(
    input: {isPublic: $isPublic, slug: $slug, basemapOptionalLayerStates: $basemapOptionalLayerStates, visibleDataLayers: $visibleDataLayers, cameraOptions: $cameraOptions, selectedBasemap: $selectedBasemap, style: $style, mapDimensions: $mapDimensions, visibleSketches: $visibleSketches, sidebarState: $sidebarState, basemapName: $basemapName, layerNames: $layerNames, sketchNames: $sketchNames, clientGeneratedThumbnail: $clientGeneratedThumbnail}
  ) {
    mapBookmark {
      ...MapBookmarkDetails
    }
  }
}
    ${MapBookmarkDetailsFragmentDoc}`;
export const MapBookmarkDocument = /*#__PURE__*/ gql`
    subscription MapBookmark($id: UUID!) {
  updatedMapBookmark(id: $id) {
    bookmarkId
    bookmark {
      ...MapBookmarkDetails
    }
  }
}
    ${MapBookmarkDetailsFragmentDoc}`;
export const CreateFileUploadForPostDocument = /*#__PURE__*/ gql`
    mutation createFileUploadForPost($contentType: String!, $filename: String!, $fileSizeBytes: Int!, $projectId: Int!, $usage: FileUploadUsageInput!) {
  createFileUpload(
    contentType: $contentType
    filename: $filename
    fileSizeBytes: $fileSizeBytes
    projectId: $projectId
    usage: $usage
  ) {
    cloudflareImagesUploadUrl
    fileUpload {
      ...FileUploadDetails
      presignedUploadUrl
    }
  }
}
    ${FileUploadDetailsFragmentDoc}`;
export const SpritesDocument = /*#__PURE__*/ gql`
    query Sprites($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    sprites {
      ...SpriteDetails
    }
  }
  publicSprites {
    ...SpriteDetails
  }
}
    ${SpriteDetailsFragmentDoc}`;
export const GetSpriteDocument = /*#__PURE__*/ gql`
    query GetSprite($id: Int!) {
  sprite(id: $id) {
    ...SpriteDetails
  }
}
    ${SpriteDetailsFragmentDoc}`;
export const ShareSpriteDocument = /*#__PURE__*/ gql`
    mutation ShareSprite($id: Int!, $category: String) {
  shareSprite(input: {spriteId: $id, category: $category}) {
    sprite {
      ...SpriteDetails
    }
  }
}
    ${SpriteDetailsFragmentDoc}`;
export const DeleteSpriteDocument = /*#__PURE__*/ gql`
    mutation DeleteSprite($id: Int!) {
  softDeleteSprite(input: {id: $id}) {
    sprite {
      ...SpriteDetails
    }
  }
}
    ${SpriteDetailsFragmentDoc}`;
export const JoinProjectDocument = /*#__PURE__*/ gql`
    mutation JoinProject($projectId: Int!) {
  joinProject(input: {projectId: $projectId}) {
    query {
      project(id: $projectId) {
        id
        sessionParticipationStatus
      }
    }
  }
}
    `;
export const GetBasemapsAndRegionDocument = /*#__PURE__*/ gql`
    query GetBasemapsAndRegion($slug: String!) {
  projectBySlug(slug: $slug) {
    ...MapEssentials
  }
}
    ${MapEssentialsFragmentDoc}`;
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
export const SurveysByIdDocument = /*#__PURE__*/ gql`
    query SurveysById($surveyIds: [Int]!) {
  getSurveys(ids: $surveyIds) {
    id
    projectId
    name
    project {
      id
      name
      slug
    }
  }
  me {
    id
    canonicalEmail
    profile {
      userId
      email
      fullname
      nickname
      picture
    }
  }
}
    `;
export const OfflineSurveyMapsDocument = /*#__PURE__*/ gql`
    query OfflineSurveyMaps($slug: String!) {
  projectBySlug(slug: $slug) {
    region {
      geojson
    }
    mapboxPublicKey
    id
    offlineTileSettings {
      maxShorelineZ
      maxZ
      basemapId
    }
    surveys {
      id
      name
      form {
        id
      }
      basemaps {
        ...OfflineBasemapDetails
      }
    }
    offlineTilePackagesConnection {
      nodes {
        ...OfflineTilePackageDetails
      }
    }
  }
}
    ${OfflineBasemapDetailsFragmentDoc}
${OfflineTilePackageDetailsFragmentDoc}`;
export const BasemapOfflineSettingsDocument = /*#__PURE__*/ gql`
    query BasemapOfflineSettings($id: Int!, $slug: String!) {
  projectBySlug(slug: $slug) {
    id
    mapboxPublicKey
    region {
      geojson
    }
    offlineTileSettings {
      ...OfflineTileSettings
    }
  }
  basemap(id: $id) {
    id
    name
    url
    useDefaultOfflineTileSettings
    project {
      id
      region {
        geojson
      }
    }
    offlineSupportInformation {
      id
      hasUncacheableSources
      sources {
        dataSourceUrl
        type
      }
    }
  }
}
    ${OfflineTileSettingsFragmentDoc}`;
export const UpdateBasemapOfflineTileSettingsDocument = /*#__PURE__*/ gql`
    mutation UpdateBasemapOfflineTileSettings($projectId: Int!, $maxZ: Int!, $maxShorelineZ: Int, $basemapId: Int!, $useDefault: Boolean!) {
  updateBasemapOfflineTileSettings(
    input: {basemapId: $basemapId, maxShorelineZ: $maxShorelineZ, maxZ: $maxZ, projectId: $projectId, useDefault: $useDefault}
  ) {
    basemap {
      id
      useDefaultOfflineTileSettings
      project {
        id
        offlineTileSettings {
          ...OfflineTileSettings
        }
      }
    }
  }
}
    ${OfflineTileSettingsFragmentDoc}`;
export const GenerateOfflineTilePackageDocument = /*#__PURE__*/ gql`
    mutation generateOfflineTilePackage($dataSourceUrl: String!, $projectId: Int!, $maxZ: Int!, $maxShorelineZ: Int, $sourceType: OfflineTilePackageSourceType, $originalUrlTemplate: String!) {
  generateOfflineTilePackage(
    input: {dataSourceUrl: $dataSourceUrl, projectId: $projectId, maxZ: $maxZ, maxShorelineZ: $maxShorelineZ, sourceType: $sourceType, originalUrlTemplate: $originalUrlTemplate}
  ) {
    offlineTilePackage {
      project {
        id
        surveys {
          id
          basemaps {
            id
            offlineSupportInformation {
              id
              staticAssets {
                url
                type
              }
              sources {
                templateUrl
                dataSourceUrl
                tilePackages {
                  ...OfflineTilePackageDetails
                }
                type
              }
            }
          }
        }
      }
      ...OfflineTilePackageDetails
    }
  }
}
    ${OfflineTilePackageDetailsFragmentDoc}`;
export const DeleteTilePackageDocument = /*#__PURE__*/ gql`
    mutation deleteTilePackage($id: UUID!) {
  deleteOfflineTilePackage(input: {id: $id}) {
    offlineTilePackage {
      id
    }
  }
}
    `;
export const GetTilePackageDocument = /*#__PURE__*/ gql`
    query getTilePackage($id: UUID!) {
  offlineTilePackage(id: $id) {
    ...OfflineTilePackageDetails
  }
}
    ${OfflineTilePackageDetailsFragmentDoc}`;
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
export const ToggleLanguageSupportDocument = /*#__PURE__*/ gql`
    mutation toggleLanguageSupport($slug: String!, $enable: Boolean!, $code: String!) {
  toggleLanguageSupport(input: {code: $code, slug: $slug, enable: $enable}) {
    project {
      id
      supportedLanguages
    }
  }
}
    `;
export const SetTranslatedPropsDocument = /*#__PURE__*/ gql`
    mutation setTranslatedProps($id: Int!, $typeName: String!, $propName: String!, $translations: [TranslatedPropInput!]!) {
  setTranslatedProp(
    id: $id
    propName: $propName
    typeName: $typeName
    translations: $translations
  ) {
    id
    translatedProps
    typeName
  }
}
    `;
export const ProjectMetadataDocument = /*#__PURE__*/ gql`
    query ProjectMetadata($slug: String!) {
  project: projectBySlug(slug: $slug) {
    ...ProjectMetadata
    sessionParticipationStatus
    sessionHasPrivilegedAccess
  }
  projectPublicDetails(slug: $slug) {
    ...ProjectPublicDetailsMetadata
  }
  me {
    ...ProjectMetadataMeFrag
  }
  isMyEmailVerified
}
    ${ProjectMetadataFragmentDoc}
${ProjectPublicDetailsMetadataFragmentDoc}
${ProjectMetadataMeFragFragmentDoc}`;
export const MeDocument = /*#__PURE__*/ gql`
    query Me {
  me {
    id
    profile {
      ...UserProfileDetails
    }
  }
  isMyEmailVerified
}
    ${UserProfileDetailsFragmentDoc}`;
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
export const GetProjectBySlugDocument = /*#__PURE__*/ gql`
    query GetProjectBySlug($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    name
  }
}
    `;
export const ProjectSlugExistsDocument = /*#__PURE__*/ gql`
    query ProjectSlugExists($slug: String!) {
  projectBySlug(slug: $slug) {
    id
  }
}
    `;
export const PublishedTableOfContentsDocument = /*#__PURE__*/ gql`
    query PublishedTableOfContents($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    tableOfContentsItems {
      ...Overlay
    }
  }
}
    ${OverlayFragmentDoc}`;
export const ProjectListingDocument = /*#__PURE__*/ gql`
    query ProjectListing($first: Int, $after: Cursor, $last: Int, $before: Cursor) {
  projects: projectsConnection(
    first: $first
    last: $last
    after: $after
    before: $before
    orderBy: NAME_ASC
  ) {
    edges {
      cursor
      node {
        ...ProjectListItem
      }
    }
    totalCount
    pageInfo {
      hasNextPage
      hasPreviousPage
      endCursor
      startCursor
    }
  }
  featuredProjects: projectsConnection(condition: {isFeatured: true}) {
    nodes {
      ...ProjectListItem
    }
  }
}
    ${ProjectListItemFragmentDoc}`;
export const SketchClassFormDocument = /*#__PURE__*/ gql`
    query SketchClassForm($id: Int!) {
  form(id: $id) {
    id
    formElements {
      ...SketchFormElement
    }
    sketchClassId
    logicRules {
      ...LogicRuleDetails
    }
  }
}
    ${SketchFormElementFragmentDoc}
${LogicRuleDetailsFragmentDoc}`;
export const CreateSketchClassDocument = /*#__PURE__*/ gql`
    mutation CreateSketchClass($projectId: Int!, $templateId: Int!) {
  createSketchClassFromTemplate(
    input: {projectId: $projectId, templateSketchClassId: $templateId}
  ) {
    sketchClass {
      ...AdminSketchingDetails
    }
  }
}
    ${AdminSketchingDetailsFragmentDoc}`;
export const TemplateSketchClassesDocument = /*#__PURE__*/ gql`
    query TemplateSketchClasses {
  templateSketchClasses {
    ...TemplateSketchClass
  }
}
    ${TemplateSketchClassFragmentDoc}`;
export const SketchClassesDocument = /*#__PURE__*/ gql`
    query SketchClasses($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    sketchClasses {
      ...AdminSketchingDetails
    }
  }
}
    ${AdminSketchingDetailsFragmentDoc}`;
export const UpdateSketchClassDocument = /*#__PURE__*/ gql`
    mutation UpdateSketchClass($id: Int!, $name: String, $isArchived: Boolean) {
  updateSketchClass(
    input: {id: $id, patch: {name: $name, isArchived: $isArchived}}
  ) {
    sketchClass {
      ...AdminSketchingDetails
    }
  }
}
    ${AdminSketchingDetailsFragmentDoc}`;
export const DeleteSketchClassDocument = /*#__PURE__*/ gql`
    mutation DeleteSketchClass($id: Int!) {
  deleteSketchClass(input: {id: $id}) {
    sketchClass {
      ...AdminSketchingDetails
    }
  }
}
    ${AdminSketchingDetailsFragmentDoc}`;
export const UpdateGeoprocessingServicesDocument = /*#__PURE__*/ gql`
    mutation UpdateGeoprocessingServices($id: Int!, $preprocessingEndpoint: String, $preprocessingProjectUrl: String, $geoprocessingClientName: String, $geoprocessingClientUrl: String, $geoprocessingProjectUrl: String) {
  updateSketchClass(
    input: {id: $id, patch: {preprocessingEndpoint: $preprocessingEndpoint, preprocessingProjectUrl: $preprocessingProjectUrl, geoprocessingClientName: $geoprocessingClientName, geoprocessingClientUrl: $geoprocessingClientUrl, geoprocessingProjectUrl: $geoprocessingProjectUrl}}
  ) {
    sketchClass {
      id
      preprocessingEndpoint
      preprocessingProjectUrl
      geoprocessingClientName
      geoprocessingClientUrl
      geoprocessingProjectUrl
    }
  }
}
    `;
export const UpdateSketchFormElementDocument = /*#__PURE__*/ gql`
    mutation UpdateSketchFormElement($id: Int!, $isRequired: Boolean, $exportId: String) {
  updateFormElement(
    input: {id: $id, patch: {isRequired: $isRequired, exportId: $exportId}}
  ) {
    formElement {
      id
      isRequired
      exportId
    }
  }
}
    `;
export const SketchClassLogicRuleDetailsDocument = /*#__PURE__*/ gql`
    query SketchClassLogicRuleDetails($sketchClassId: Int!) {
  sketchClass(id: $sketchClassId) {
    form {
      ...LogicRuleEditorFormDetails
    }
  }
}
    ${LogicRuleEditorFormDetailsFragmentDoc}`;
export const CreateVisibilityRuleDocument = /*#__PURE__*/ gql`
    mutation createVisibilityRule($formElementId: Int!) {
  createVisibilityLogicRule(input: {formElementId: $formElementId}) {
    formLogicRule {
      id
      ...LogicRuleDetails
    }
  }
}
    ${LogicRuleDetailsFragmentDoc}`;
export const UpdateVisibilityRuleDocument = /*#__PURE__*/ gql`
    mutation UpdateVisibilityRule($id: Int!, $command: FormLogicCommand, $booleanOperator: FormLogicOperator) {
  updateFormLogicRule(
    input: {id: $id, patch: {command: $command, booleanOperator: $booleanOperator}}
  ) {
    formLogicRule {
      id
      command
      booleanOperator
    }
  }
}
    `;
export const UpdateVisibilityConditionDocument = /*#__PURE__*/ gql`
    mutation UpdateVisibilityCondition($id: Int!, $operator: FieldRuleOperator, $subjectId: Int, $value: JSON) {
  updateFormLogicCondition(
    input: {id: $id, patch: {operator: $operator, subjectId: $subjectId, value: $value}}
  ) {
    formLogicCondition {
      id
      operator
      subjectId
      value
    }
  }
}
    `;
export const DeleteVisibilityRuleDocument = /*#__PURE__*/ gql`
    mutation DeleteVisibilityRule($id: Int!) {
  deleteFormLogicRule(input: {id: $id}) {
    formLogicRule {
      id
    }
  }
}
    `;
export const AddVisibilityConditionDocument = /*#__PURE__*/ gql`
    mutation AddVisibilityCondition($ruleId: Int!, $subjectId: Int!, $operator: FieldRuleOperator!, $value: JSON!) {
  createFormLogicCondition(
    input: {formLogicCondition: {ruleId: $ruleId, subjectId: $subjectId, operator: $operator, value: $value}}
  ) {
    formLogicCondition {
      id
      operator
      subjectId
      value
      ruleId
    }
  }
}
    `;
export const DeleteVisibilityRuleConditionDocument = /*#__PURE__*/ gql`
    mutation DeleteVisibilityRuleCondition($id: Int!) {
  deleteFormLogicCondition(input: {id: $id}) {
    formLogicCondition {
      id
    }
  }
}
    `;
export const UpdateSketchClassStyleDocument = /*#__PURE__*/ gql`
    mutation UpdateSketchClassStyle($id: Int!, $style: JSON) {
  updateSketchClassMapboxGLStyle(sketchClassId: $id, style: $style) {
    id
    mapboxGlStyle
  }
}
    `;
export const SketchingDocument = /*#__PURE__*/ gql`
    query Sketching($slug: String!) {
  me {
    id
  }
  projectBySlug(slug: $slug) {
    sessionParticipationStatus
    id
    supportedLanguages
    sketchClasses {
      ...SketchingDetails
    }
    mySketches {
      __typename
      ...SketchTocDetails
    }
    myFolders {
      __typename
      ...SketchFolderDetails
    }
    sketchGeometryToken
  }
}
    ${SketchingDetailsFragmentDoc}
${SketchTocDetailsFragmentDoc}
${SketchFolderDetailsFragmentDoc}`;
export const CreateSketchFolderDocument = /*#__PURE__*/ gql`
    mutation CreateSketchFolder($slug: String!, $name: String!, $folderId: Int, $collectionId: Int) {
  createSketchFolder(
    input: {slug: $slug, name: $name, folderId: $folderId, collectionId: $collectionId}
  ) {
    sketchFolder {
      ...SketchFolderDetails
    }
  }
}
    ${SketchFolderDetailsFragmentDoc}`;
export const CreateSketchDocument = /*#__PURE__*/ gql`
    mutation CreateSketch($name: String!, $sketchClassId: Int!, $userGeom: GeoJSON, $collectionId: Int, $folderId: Int, $properties: JSON!) {
  createSketch(
    name: $name
    sketchClassId: $sketchClassId
    userGeom: $userGeom
    folderId: $folderId
    collectionId: $collectionId
    properties: $properties
  ) {
    ...SketchCRUDResponse
  }
}
    ${SketchCrudResponseFragmentDoc}`;
export const UpdateSketchDocument = /*#__PURE__*/ gql`
    mutation UpdateSketch($id: Int!, $name: String!, $userGeom: GeoJSON, $properties: JSON!) {
  updateSketch(id: $id, name: $name, userGeom: $userGeom, properties: $properties) {
    ...SketchCRUDResponse
  }
}
    ${SketchCrudResponseFragmentDoc}`;
export const DeleteSketchTocItemsDocument = /*#__PURE__*/ gql`
    mutation DeleteSketchTocItems($items: [UpdateTocItemParentInput]!) {
  deleteSketchTocItems(items: $items) {
    deletedItems
    updatedCollections {
      id
      updatedAt
    }
  }
}
    `;
export const RenameFolderDocument = /*#__PURE__*/ gql`
    mutation RenameFolder($id: Int!, $name: String!) {
  updateSketchFolder(input: {id: $id, patch: {name: $name}}) {
    sketchFolder {
      id
      name
    }
  }
}
    `;
export const GetSketchForEditingDocument = /*#__PURE__*/ gql`
    query GetSketchForEditing($id: Int!) {
  sketch(id: $id) {
    ...SketchEditorModalDetails
  }
}
    ${SketchEditorModalDetailsFragmentDoc}`;
export const UpdateTocItemsParentDocument = /*#__PURE__*/ gql`
    mutation UpdateTocItemsParent($folderId: Int, $collectionId: Int, $tocItems: [UpdateTocItemParentInput]!) {
  updateSketchTocItemParent(
    folderId: $folderId
    collectionId: $collectionId
    tocItems: $tocItems
  ) {
    folders {
      id
      folderId
      collectionId
    }
    sketches {
      id
      updatedAt
      folderId
      collectionId
    }
    updatedCollections {
      id
      updatedAt
    }
  }
}
    `;
export const SketchReportingDetailsDocument = /*#__PURE__*/ gql`
    query SketchReportingDetails($id: Int!, $sketchClassId: Int!) {
  sketch(id: $id) {
    id
    name
    createdAt
    updatedAt
    properties
    userAttributes
    childProperties
  }
  sketchClass(id: $sketchClassId) {
    project {
      id
      supportedLanguages
    }
    id
    geoprocessingClientName
    geoprocessingClientUrl
    geoprocessingProjectUrl
    geometryType
    form {
      id
      formElements {
        exportId
        id
        isInput
        typeId
        body
        generatedExportId
        generatedLabel
      }
      logicRules {
        ...LogicRuleDetails
      }
    }
  }
}
    ${LogicRuleDetailsFragmentDoc}`;
export const CopyTocItemDocument = /*#__PURE__*/ gql`
    mutation CopyTocItem($id: Int!, $type: SketchChildType!) {
  copySketchTocItem(id: $id, type: $type) {
    folders {
      ...SketchFolderDetails
    }
    sketches {
      ...SketchTocDetails
    }
    parentId
    updatedCollection {
      id
      updatedAt
    }
  }
}
    ${SketchFolderDetailsFragmentDoc}
${SketchTocDetailsFragmentDoc}`;
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
export const CreateSurveyDocument = /*#__PURE__*/ gql`
    mutation CreateSurvey($name: String!, $projectId: Int!, $templateId: Int) {
  makeSurvey(input: {projectId: $projectId, name: $name, templateId: $templateId}) {
    survey {
      ...SurveyListDetails
    }
  }
}
    ${SurveyListDetailsFragmentDoc}`;
export const SurveyByIdDocument = /*#__PURE__*/ gql`
    query SurveyById($id: Int!) {
  survey(id: $id) {
    ...SurveyListDetails
    isSpatial
  }
}
    ${SurveyListDetailsFragmentDoc}`;
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
export const FormElementTypesDocument = /*#__PURE__*/ gql`
    query FormElementTypes {
  formElementTypes {
    ...AddFormElementTypeDetails
  }
}
    ${AddFormElementTypeDetailsFragmentDoc}`;
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
export const UpdateFormElementSketchClassDocument = /*#__PURE__*/ gql`
    mutation UpdateFormElementSketchClass($id: Int!, $geometryType: SketchGeometryType, $allowMulti: Boolean, $geoprocessingClientName: String, $geoprocessingClientUrl: String, $geoprocessingProjectUrl: String) {
  updateSketchClass(
    input: {id: $id, patch: {geometryType: $geometryType, allowMulti: $allowMulti, geoprocessingClientName: $geoprocessingClientName, geoprocessingClientUrl: $geoprocessingClientUrl, geoprocessingProjectUrl: $geoprocessingProjectUrl}}
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
export const DeleteFormElementDocument = /*#__PURE__*/ gql`
    mutation DeleteFormElement($id: Int!) {
  deleteFormElement(input: {id: $id}) {
    formElement {
      id
    }
  }
}
    `;
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
    responsesSpatialExtent
  }
}
    ${FormElementExtendedDetailsFragmentDoc}
${SurveyAppRuleFragmentDoc}
${SurveyResponseFragmentDoc}`;
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
export const GetFormElementDocument = /*#__PURE__*/ gql`
    query GetFormElement($id: Int!) {
  formElement(id: $id) {
    ...FormElementDetails
  }
}
    ${FormElementDetailsFragmentDoc}`;
export const UpdateOfflineEnabledDocument = /*#__PURE__*/ gql`
    mutation UpdateOfflineEnabled($projectId: Int!, $enabled: Boolean!) {
  enableOfflineSupport(input: {projectId: $projectId, enable: $enabled}) {
    project {
      id
      isOfflineEnabled
    }
  }
}
    `;
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
export const CreateResponseDocument = /*#__PURE__*/ gql`
    mutation CreateResponse($surveyId: Int!, $isDraft: Boolean!, $bypassedDuplicateSubmissionControl: Boolean!, $responseData: JSON!, $facilitated: Boolean!, $practice: Boolean!, $offlineId: UUID) {
  createSurveyResponseV2(
    input: {surveyId: $surveyId, draft: $isDraft, responseData: $responseData, bypassedSubmissionControl: $bypassedDuplicateSubmissionControl, facilitated: $facilitated, practice: $practice, offlineId: $offlineId}
  ) {
    clientMutationId
    id: integer
  }
}
    `;
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
export const UpdateHideSketchesDocument = /*#__PURE__*/ gql`
    mutation UpdateHideSketches($hidden: Boolean!, $projectId: Int!) {
  updateProject(input: {id: $projectId, patch: {hideSketches: $hidden}}) {
    project {
      id
      hideSketches
    }
  }
}
    `;
export const UpdateHideForumsDocument = /*#__PURE__*/ gql`
    mutation UpdateHideForums($hidden: Boolean!, $projectId: Int!) {
  updateProject(input: {id: $projectId, patch: {hideForums: $hidden}}) {
    project {
      id
      hideForums
    }
  }
}
    `;
export const UpdateHideOverlaysDocument = /*#__PURE__*/ gql`
    mutation UpdateHideOverlays($hidden: Boolean!, $projectId: Int!) {
  updateProject(input: {id: $projectId, patch: {hideOverlays: $hidden}}) {
    project {
      id
      hideOverlays
    }
  }
}
    `;
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
export const GroupMembersDocument = /*#__PURE__*/ gql`
    query GroupMembers($groupId: Int!, $offset: Int, $first: Int) {
  root: group(id: $groupId) {
    participants: members(offset: $offset, first: $first) {
      ...ParticipantListDetails
    }
  }
}
    ${ParticipantListDetailsFragmentDoc}`;
export const UserSettingsListsDocument = /*#__PURE__*/ gql`
    query UserSettingsLists($slug: String!, $projectId: Int!) {
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
    accessRequestsConnection {
      nodes {
        ...UserListDetails
      }
    }
    accessControl
  }
}
    ${InviteDetailsFragmentDoc}
${UserListDetailsFragmentDoc}`;
export const UserInfoDocument = /*#__PURE__*/ gql`
    query UserInfo($userId: Int!, $slug: String!, $projectId: Int!) {
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
    needsAccessRequestApproval(slug: $slug)
    deniedBy(projectId: $projectId) {
      id
      canonicalEmail
    }
    approvedBy(projectId: $projectId) {
      id
      canonicalEmail
    }
    approvedOrDeniedOn(projectId: $projectId)
    profile {
      userId
      affiliations
      email
      fullname
      nickname
      picture
    }
  }
  project(id: $projectId) {
    id
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
export const ToggleAdminAccessDocument = /*#__PURE__*/ gql`
    mutation toggleAdminAccess($userId: Int!, $projectId: Int!) {
  toggleAdminAccess(input: {projectId: $projectId, userId: $userId}) {
    clientMutationId
    isAdmin: boolean
  }
}
    `;
export const SetUserGroupsDocument = /*#__PURE__*/ gql`
    mutation setUserGroups($userId: Int!, $projectId: Int!, $groupIds: [Int]!) {
  setUserGroups(
    input: {userId: $userId, projectId: $projectId, groups: $groupIds}
  ) {
    groupIds: integers
  }
}
    `;
export const ToggleForumPostingBanDocument = /*#__PURE__*/ gql`
    mutation toggleForumPostingBan($userId: Int!, $projectId: Int!) {
  toggleForumPostingBan(input: {userId: $userId, projectId: $projectId}) {
    isBanned: boolean
  }
}
    `;
export const DeleteGroupDocument = /*#__PURE__*/ gql`
    mutation deleteGroup($groupId: Int!) {
  deleteGroup(input: {id: $groupId}) {
    group {
      id
    }
  }
}
    `;
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
    participationStatus
  }
}
    ${InviteEmailDetailsFragmentDoc}`;
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
export const DeleteProjectInviteDocument = /*#__PURE__*/ gql`
    mutation DeleteProjectInvite($id: Int!) {
  deleteProjectInvite(input: {id: $id}) {
    projectInvite {
      id
    }
  }
}
    `;
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
export const ProjectInviteEmailStatusSubscriptionDocument = /*#__PURE__*/ gql`
    subscription ProjectInviteEmailStatusSubscription {
  projectInviteStateUpdated {
    invite {
      id
      status
    }
  }
}
    `;
export const ApproveAccessRequestDocument = /*#__PURE__*/ gql`
    mutation ApproveAccessRequest($userId: Int!, $projectId: Int!, $slug: String!) {
  approveParticipant(input: {projectId: $projectId, userId: $userId}) {
    user {
      id
      needsAccessRequestApproval(slug: $slug)
      approvedBy(projectId: $projectId) {
        id
        canonicalEmail
      }
      deniedBy(projectId: $projectId) {
        id
        canonicalEmail
      }
      approvedOrDeniedOn(projectId: $projectId)
    }
  }
}
    `;
export const DenyAccessRequestDocument = /*#__PURE__*/ gql`
    mutation DenyAccessRequest($userId: Int!, $projectId: Int!, $slug: String!) {
  denyParticipant(input: {projectId: $projectId, userId: $userId}) {
    user {
      id
      needsAccessRequestApproval(slug: $slug)
      approvedBy(projectId: $projectId) {
        id
        canonicalEmail
      }
      deniedBy(projectId: $projectId) {
        id
        canonicalEmail
      }
      approvedOrDeniedOn(projectId: $projectId)
    }
  }
}
    `;
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
          ...UserProfileDetails
        }
      }
    }
  }
}
    ${UserProfileDetailsFragmentDoc}`;
export const MyProfileDocument = /*#__PURE__*/ gql`
    query MyProfile {
  me {
    id
    profile {
      ...UserProfileDetails
    }
  }
}
    ${UserProfileDetailsFragmentDoc}`;
export const UserIsSuperuserDocument = /*#__PURE__*/ gql`
    query UserIsSuperuser {
  currentUserIsSuperuser
}
    `;
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
    DataUploadTasks: 'DataUploadTasks',
    ProjectDataQuotaRemaining: 'ProjectDataQuotaRemaining',
    DownloadableOfflineTilePackages: 'DownloadableOfflineTilePackages',
    DownloadBasemapDetails: 'DownloadBasemapDetails',
    ImportBasemapDetails: 'ImportBasemapDetails',
    DraftTableOfContents: 'DraftTableOfContents',
    layersAndSourcesForItems: 'layersAndSourcesForItems',
    GetFolder: 'GetFolder',
    GetLayerItem: 'GetLayerItem',
    InteractivitySettingsForLayer: 'InteractivitySettingsForLayer',
    DataSourceUrlProperties: 'DataSourceUrlProperties',
    GetMetadata: 'GetMetadata',
    ProjectHostingQuota: 'ProjectHostingQuota',
    InteractivitySettingsById: 'InteractivitySettingsById',
    ForumAdminList: 'ForumAdminList',
    Forums: 'Forums',
    TopicList: 'TopicList',
    BreadcrumbTopic: 'BreadcrumbTopic',
    TopicDetail: 'TopicDetail',
    GetBookmark: 'GetBookmark',
    Sprites: 'Sprites',
    GetSprite: 'GetSprite',
    GetBasemapsAndRegion: 'GetBasemapsAndRegion',
    OfflineSurveys: 'OfflineSurveys',
    SurveysById: 'SurveysById',
    OfflineSurveyMaps: 'OfflineSurveyMaps',
    BasemapOfflineSettings: 'BasemapOfflineSettings',
    getTilePackage: 'getTilePackage',
    ProjectAccessControlSettings: 'ProjectAccessControlSettings',
    ProjectMetadata: 'ProjectMetadata',
    Me: 'Me',
    ProjectRegion: 'ProjectRegion',
    GetProjectBySlug: 'GetProjectBySlug',
    ProjectSlugExists: 'ProjectSlugExists',
    PublishedTableOfContents: 'PublishedTableOfContents',
    ProjectListing: 'ProjectListing',
    SketchClassForm: 'SketchClassForm',
    TemplateSketchClasses: 'TemplateSketchClasses',
    SketchClasses: 'SketchClasses',
    SketchClassLogicRuleDetails: 'SketchClassLogicRuleDetails',
    Sketching: 'Sketching',
    GetSketchForEditing: 'GetSketchForEditing',
    SketchReportingDetails: 'SketchReportingDetails',
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
    MyProfile: 'MyProfile',
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
    SetBasemapMaxZoom: 'SetBasemapMaxZoom',
    CreateProject: 'CreateProject',
    VerifyEmail: 'VerifyEmail',
    createDataUpload: 'createDataUpload',
    submitDataUpload: 'submitDataUpload',
    DismissFailedTask: 'DismissFailedTask',
    FailUpload: 'FailUpload',
    CancelUpload: 'CancelUpload',
    UpdateDataHostingQuota: 'UpdateDataHostingQuota',
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
    UpdateFetchStrategy: 'UpdateFetchStrategy',
    UpdateEnableHighDPIRequests: 'UpdateEnableHighDPIRequests',
    UpdateMetadata: 'UpdateMetadata',
    PublishTableOfContents: 'PublishTableOfContents',
    ImportArcGISService: 'ImportArcGISService',
    SetMaxZoom: 'SetMaxZoom',
    CreateForum: 'CreateForum',
    UpdateForum: 'UpdateForum',
    DeleteForum: 'DeleteForum',
    CreateTopic: 'CreateTopic',
    CreateReply: 'CreateReply',
    CopyTocItemForForumPost: 'CopyTocItemForForumPost',
    CreateMapBookmark: 'CreateMapBookmark',
    createFileUploadForPost: 'createFileUploadForPost',
    ShareSprite: 'ShareSprite',
    DeleteSprite: 'DeleteSprite',
    JoinProject: 'JoinProject',
    UpdateBasemapOfflineTileSettings: 'UpdateBasemapOfflineTileSettings',
    generateOfflineTilePackage: 'generateOfflineTilePackage',
    deleteTilePackage: 'deleteTilePackage',
    updateProjectAccessControlSettings: 'updateProjectAccessControlSettings',
    toggleLanguageSupport: 'toggleLanguageSupport',
    setTranslatedProps: 'setTranslatedProps',
    UpdateProjectRegion: 'UpdateProjectRegion',
    CreateSketchClass: 'CreateSketchClass',
    UpdateSketchClass: 'UpdateSketchClass',
    DeleteSketchClass: 'DeleteSketchClass',
    UpdateGeoprocessingServices: 'UpdateGeoprocessingServices',
    UpdateSketchFormElement: 'UpdateSketchFormElement',
    createVisibilityRule: 'createVisibilityRule',
    UpdateVisibilityRule: 'UpdateVisibilityRule',
    UpdateVisibilityCondition: 'UpdateVisibilityCondition',
    DeleteVisibilityRule: 'DeleteVisibilityRule',
    AddVisibilityCondition: 'AddVisibilityCondition',
    DeleteVisibilityRuleCondition: 'DeleteVisibilityRuleCondition',
    UpdateSketchClassStyle: 'UpdateSketchClassStyle',
    CreateSketchFolder: 'CreateSketchFolder',
    CreateSketch: 'CreateSketch',
    UpdateSketch: 'UpdateSketch',
    DeleteSketchTocItems: 'DeleteSketchTocItems',
    RenameFolder: 'RenameFolder',
    UpdateTocItemsParent: 'UpdateTocItemsParent',
    CopyTocItem: 'CopyTocItem',
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
    UpdateOfflineEnabled: 'UpdateOfflineEnabled',
    CreateResponse: 'CreateResponse',
    UpdateProjectName: 'UpdateProjectName',
    UpdateProjectSettings: 'UpdateProjectSettings',
    UpdateHideSketches: 'UpdateHideSketches',
    UpdateHideForums: 'UpdateHideForums',
    UpdateHideOverlays: 'UpdateHideOverlays',
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
    ApproveAccessRequest: 'ApproveAccessRequest',
    DenyAccessRequest: 'DenyAccessRequest',
    UpdateProfile: 'UpdateProfile'
  },
  Subscription: {
    DataUploads: 'DataUploads',
    DraftStatus: 'DraftStatus',
    NewPosts: 'NewPosts',
    MapBookmark: 'MapBookmark',
    ProjectInviteEmailStatusSubscription: 'ProjectInviteEmailStatusSubscription'
  },
  Fragment: {
    UpdateTerrainExaggeration: 'UpdateTerrainExaggeration',
    NewLabelsLayer: 'NewLabelsLayer',
    NewTerrain: 'NewTerrain',
    NewBasemap: 'NewBasemap',
    UpdateFormat: 'UpdateFormat',
    NewGLStyle: 'NewGLStyle',
    NewRenderUnder: 'NewRenderUnder',
    NewZIndex: 'NewZIndex',
    NewRule: 'NewRule',
    NewCondition: 'NewCondition',
    NewElement: 'NewElement',
    LogicRuleEditorFormElement: 'LogicRuleEditorFormElement',
    LogicRuleEditorRule: 'LogicRuleEditorRule',
    NewSurvey: 'NewSurvey',
    NewGroup: 'NewGroup',
    NewInviteEmail: 'NewInviteEmail',
    NewLayerOptions: 'NewLayerOptions',
    UpdateAlternateLanguageSettings: 'UpdateAlternateLanguageSettings',
    UpdateComponentSettings: 'UpdateComponentSettings',
    UpdateBody: 'UpdateBody',
    MySketch: 'MySketch',
    MyFolder: 'MyFolder',
    PopupShareDetails: 'PopupShareDetails',
    data: 'data',
    BasemapDetails: 'BasemapDetails',
    BasemapAdminDetails: 'BasemapAdminDetails',
    DataUploadDetails: 'DataUploadDetails',
    DataUploadEvent: 'DataUploadEvent',
    ForumListDetails: 'ForumListDetails',
    AuthorProfile: 'AuthorProfile',
    ForumPost: 'ForumPost',
    RecentPost: 'RecentPost',
    ForumDetails: 'ForumDetails',
    ForumTopic: 'ForumTopic',
    Job: 'Job',
    MapBookmarkDetails: 'MapBookmarkDetails',
    SketchPresent: 'SketchPresent',
    FileUploadDetails: 'FileUploadDetails',
    SpriteDetails: 'SpriteDetails',
    MapEssentials: 'MapEssentials',
    OfflineTilePackageDetails: 'OfflineTilePackageDetails',
    BasemapOfflineSupportInfo: 'BasemapOfflineSupportInfo',
    OfflineBasemapDetails: 'OfflineBasemapDetails',
    OfflineTileSettingsForCalculation: 'OfflineTileSettingsForCalculation',
    OfflineTileSettings: 'OfflineTileSettings',
    ProjectMetadata: 'ProjectMetadata',
    ProjectPublicDetailsMetadata: 'ProjectPublicDetailsMetadata',
    ProjectMetadataMeFrag: 'ProjectMetadataMeFrag',
    Overlay: 'Overlay',
    DataSourceDetails: 'DataSourceDetails',
    ClientSprite: 'ClientSprite',
    DataLayerDetails: 'DataLayerDetails',
    ProjectListItem: 'ProjectListItem',
    SketchFormElement: 'SketchFormElement',
    SketchingDetails: 'SketchingDetails',
    AdminSketchingDetails: 'AdminSketchingDetails',
    TemplateSketchClass: 'TemplateSketchClass',
    LogicRuleEditorFormElementDetails: 'LogicRuleEditorFormElementDetails',
    LogicRuleEditorFormDetails: 'LogicRuleEditorFormDetails',
    SketchTocDetails: 'SketchTocDetails',
    SketchFolderDetails: 'SketchFolderDetails',
    SketchCRUDResponse: 'SketchCRUDResponse',
    SketchEditorModalDetails: 'SketchEditorModalDetails',
    ProjectSketches: 'ProjectSketches',
    SurveyListDetails: 'SurveyListDetails',
    AddFormElementTypeDetails: 'AddFormElementTypeDetails',
    FormElementDetails: 'FormElementDetails',
    SketchClassDetails: 'SketchClassDetails',
    FormElementFullDetails: 'FormElementFullDetails',
    LogicRuleConditionDetails: 'LogicRuleConditionDetails',
    LogicRuleDetails: 'LogicRuleDetails',
    SurveyResponse: 'SurveyResponse',
    FormElementExtendedDetails: 'FormElementExtendedDetails',
    SurveyAppRule: 'SurveyAppRule',
    SurveyAppFormElement: 'SurveyAppFormElement',
    SurveyAppSurvey: 'SurveyAppSurvey',
    ParticipantListDetails: 'ParticipantListDetails',
    UserListDetails: 'UserListDetails',
    InviteDetails: 'InviteDetails',
    InviteEmailDetails: 'InviteEmailDetails',
    UserProfileDetails: 'UserProfileDetails'
  }
}