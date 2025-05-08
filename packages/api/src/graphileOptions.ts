import { makePluginHook } from "postgraphile";
import PgSimplifyInflectorPlugin from "@graphile-contrib/pg-simplify-inflector";
import ProjectInvitesPlugin from "./plugins/projectInvitesPlugin";
import SurveyInvitesPlugin from "./plugins/surveyInvitesPlugin";
import postgisPlugin from "@graphile/postgis";
import CanonicalEmailPlugin from "./plugins/canonicalEmailPlugin";
import ProjectInviteStateSubscriptionPlugin from "./plugins/ProjectInviteStateSubscriptionPlugin";
import SanitizeInteractivityTemplatesPlugin from "./plugins/sanitizeInteractivityTemplatesPlugin";
import DataSourcePlugin from "./plugins/dataSourcePlugin";
import SpritesPlugin from "./plugins/spritesPlugin";
// @ts-ignore
import orderTopicsByDateAndStickyPlugin from "./plugins/orderTopicsByDateAndStickyPlugin";
// @ts-ignore
import PostGraphileUploadFieldPlugin from "postgraphile-plugin-upload-field";
import uploadFieldDefinitions from "./uploadFieldDefinitions";
import { default as PgPubsub } from "@graphile/pg-pubsub";
import BuildPlugin from "./plugins/buildPlugin";
import ExportIdPlugin from "./plugins/exportIdPlugin";
import UnsplashPlugin from "./plugins/unsplashPlugin";
import { PostGraphileOptions } from "postgraphile";
import ConsentDocumentPlugin from "./plugins/consentDocumentPlugin";
import SentryPlugin from "./plugins/sentryPlugin";
import UploadStylePlugin from "./plugins/uploadStylePlugin";
import IsSuperuserPlugin from "./plugins/IsSuperuserPlugin";
import OfflineTilePackagePlugin from "./plugins/offlineTilePackagePlugin";
import BasemapOfflineDetailsPlugin from "./plugins/BasemapOfflineDetailsPlugin";
import DataUploadTaskPlugin from "./plugins/dataUploadTaskPlugin";
import SketchingPlugin from "./plugins/sketchingPlugin";
import ForumPostsPlugin from "./plugins/forumPostsPlugin";
import ForumSubscriptionsPlugin from "./plugins/forumSubscriptionsPlugin";
import MapBookmarkSubscriptionsPlugin from "./plugins/mapBookmarkSubscriptionsPlugin";
import MapBookmarkRateLimiterPlugin from "./plugins/mapBookmarkRateLimiterPlugin";
import TranslatedPropsPlugin from "./plugins/translatedPropsPlugin";
import VerifyEmailPlugin from "./plugins/verifyEmailPlugin";
import {
  FileUploadPlugin,
  FileUploadRateLimiterPlugin,
} from "./plugins/fileUploadPlugin";
import SketchClassStylePlugin from "./plugins/sketchClassStylePlugin";
import DataUploadTasksSubscriptionPlugin from "./plugins/dataUploadTasksSubscriptionPlugin";
import DraftTocStatusPlugin from "./plugins/projectDraftTableOfContentsStatusSubscription";
import ComputedMetadataPlugin from "./plugins/computedMetadataPlugin";
import SearchOverlaysRateLimiterPlugin from "./plugins/searchOverlaysRateLimiterPlugin";
import ProjectBackgroundJobSubscriptionPlugin from "./plugins/projectBackgroundJobSubscriptionPlugin";
import MetadataParserPlugin from "./plugins/metadataParserPlugin";
import ApiKeyPlugin from "./plugins/apiKeyPlugin";
import AboutPagePlugin from "./plugins/aboutPagePlugin";
import ReplacePMTilesPlugin from "./plugins/replacePMTilesPlugin";
import GeographyPlugin from "./plugins/GeographyPlugin";

const pluginHook = makePluginHook([{ ...PgPubsub, ...SentryPlugin }]);

export default function graphileOptions(): PostGraphileOptions {
  return {
    ownerConnectionString: process.env.ADMIN_DATABASE_URL,
    watchPg: true,
    graphiql: true,
    enhanceGraphiql: true,
    allowExplain: (req) => process.env.NODE_ENV !== "production",
    ignoreRBAC: false,
    ignoreIndexes: false,
    // enableCors: true,
    dynamicJson: true,
    setofFunctionsContainNulls: false,
    bodySizeLimit: "3mb",
    pluginHook,
    appendPlugins: [
      PgSimplifyInflectorPlugin,
      PostGraphileUploadFieldPlugin,
      postgisPlugin,
      FileUploadPlugin,
      FileUploadRateLimiterPlugin,
      ProjectInvitesPlugin,
      SurveyInvitesPlugin,
      CanonicalEmailPlugin,
      DataSourcePlugin,
      ExportIdPlugin,
      SanitizeInteractivityTemplatesPlugin,
      orderTopicsByDateAndStickyPlugin,
      ProjectInviteStateSubscriptionPlugin,
      BuildPlugin,
      SpritesPlugin,
      UnsplashPlugin,
      ConsentDocumentPlugin,
      UploadStylePlugin,
      IsSuperuserPlugin,
      OfflineTilePackagePlugin,
      BasemapOfflineDetailsPlugin,
      DataUploadTaskPlugin,
      SketchingPlugin,
      ForumPostsPlugin,
      ForumSubscriptionsPlugin,
      MapBookmarkSubscriptionsPlugin,
      MapBookmarkRateLimiterPlugin,
      TranslatedPropsPlugin,
      VerifyEmailPlugin,
      SketchClassStylePlugin,
      DraftTocStatusPlugin,
      ComputedMetadataPlugin,
      SearchOverlaysRateLimiterPlugin,
      ProjectBackgroundJobSubscriptionPlugin,
      MetadataParserPlugin,
      ApiKeyPlugin,
      AboutPagePlugin,
      ReplacePMTilesPlugin,
      GeographyPlugin,
      // reorderSchemaFields(graphqlSchemaModifiers.fieldOrder),
      // extraDocumentationPlugin(graphqlSchemaModifiers.documentation),
    ],
    graphileBuildOptions: {
      pgOmitListSuffix: true,
      uploadFieldDefinitions,
    },
    subscriptions: true,
    exportGqlSchemaPath: "./generated-schema.gql",
    sortExport: true,
    hideIndexWarnings: true,
  };
}
