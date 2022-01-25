import { makePluginHook } from "postgraphile";
import PgSimplifyInflectorPlugin from "@graphile-contrib/pg-simplify-inflector";
import graphqlSchemaModifiers from "./graphqlSchemaModifiers";
import reorderSchemaFields from "./plugins/reorderSchemaFieldsPlugin";
import extraDocumentationPlugin from "./plugins/extraDocumentationPlugin";
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
const pluginHook = makePluginHook([PgPubsub]);

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
    pluginHook,
    appendPlugins: [
      PgSimplifyInflectorPlugin,
      PostGraphileUploadFieldPlugin,
      postgisPlugin,
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
