import express from "express";
import { postgraphile } from "postgraphile";
import PgSimplifyInflectorPlugin from "@graphile-contrib/pg-simplify-inflector";
import compression from "compression";
import path from "path";
import authConfig from "./authConfig.json";
import pool from "./pool";
import graphqlSchemaModifiers from "./graphqlSchemaModifiers";
import reorderSchemaFields from "./plugins/reorderSchemaFieldsPlugin";
import extraDocumentationPlugin from "./plugins/extraDocumentationPlugin";
import ProjectInvitesPlugin from "./plugins/projectInvitesPlugin";
import SurveyInvitesPlugin from "./plugins/surveyInvitesPlugin";
import postgisPlugin from "@graphile/postgis";
import CanonicalEmailPlugin from "./plugins/canonicalEmailPlugin";
import SanitizeInteractivityTemplatesPlugin from "./plugins/sanitizeInteractivityTemplatesPlugin";
import DataSourcePlugin from "./plugins/dataSourcePlugin";
import SpritesPlugin from "./plugins/spritesPlugin";
import { getJWKS, rotateKeys } from "./auth/jwks";
import authorizationMiddleware from "./middleware/authorizationMiddleware";
import userAccountMiddlware from "./middleware/userAccountMiddleware";
import currentProjectMiddlware from "./middleware/currentProjectMiddleware";
import surveyInviteMiddlware from "./middleware/surveyInviteMiddleware";
import { IncomingRequest } from "./middleware/IncomingRequest";
import verifyEmailMiddleware from "./middleware/verifyEmailMiddleware";
// @ts-ignore
import orderTopicsByDateAndStickyPlugin from "./plugins/orderTopicsByDateAndStickyPlugin";
import { unsubscribeFromTopic } from "./activityNotifications/topicNotifications";
// @ts-ignore
import PostGraphileUploadFieldPlugin from "postgraphile-plugin-upload-field";
import { graphqlUploadExpress } from "graphql-upload";
import uploadFieldDefinitions from "./uploadFieldDefinitions";
import bytes from "bytes";

const app = express();

app.use(compression());

// for accurate setting of req.ip
app.set("trust proxy", true);

app.get("/auth-helper", (req, res) => {
  res.header({ "Content-Type": "text/html" });
  res.sendFile(path.join(__dirname, "../../", "src", "authHelper.html"));
});

app.get("/auth_config.json", (req, res) => {
  res.contentType("json");
  res.send(
    JSON.stringify({
      ...authConfig,
      audience: process.env.JWT_AUD,
    })
  );
});

app.get("/unsubscribeFromTopic", (req, res) => {
  const token = req.query.token;
  if (!token || token.length < 1) {
    res.status(400);
    res.send("Missing token");
  } else {
    unsubscribeFromTopic(pool, token)
      .then(() => {
        res.send("You have been unsubscribed from this discussion topic.");
      })
      .catch((e) => {
        res.status(400);
        res.send(e.toString());
      });
  }
});

app.get("/.well-known/jwks.json", async (req, res) => {
  const keys = await getJWKS(pool);
  res.json(keys);
});

// assign req.currentProjectId from headers if applicable
app.use(currentProjectMiddlware);

// Parse Bearer tokens and populate req.user with valid claims
app.use(
  authorizationMiddleware,
  function (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: (err: Error | null) => void
  ) {
    // Needed to allow requests to proceed with invalid (e.g. expired) tokens.
    // Clients will be anonymous in that case.
    // @ts-ignore
    if (err.code === "invalid_token") return next();
    return next(err);
  }
);

// Create new user account if req.user is unrecognized, and assign req.user.id
app.use(userAccountMiddlware);

// Parse survey invites and populate req.surveyInvite with valid claims
app.use(surveyInviteMiddlware);

// set email as verified in auth0 db if an emailed token is present in headers
app.use(verifyEmailMiddleware);

app.use(
  graphqlUploadExpress({
    maxFiles: 2,
    maxFileSize: bytes("25mb"),
  })
);

app.use(function (req, res, next) {
  res.header("Access-Control-Max-Age", "600");
  next();
});

app.use(
  postgraphile(pool, "public", {
    ownerConnectionString: process.env.OWNER_DATABASE_URL,
    watchPg: true,
    graphiql: true,
    enhanceGraphiql: true,
    allowExplain: (req) => process.env.NODE_ENV !== "production",
    ignoreRBAC: false,
    ignoreIndexes: false,
    enableCors: true,
    dynamicJson: true,
    setofFunctionsContainNulls: false,
    pgSettings: async (req: IncomingRequest) => {
      // These session vars will be added to each postgres transaction
      return {
        role: req.user
          ? req.user.superuser
            ? "seasketch_superuser"
            : "seasketch_user"
          : "anon",
        "session.project_id": req.projectId,
        "session.email_verified": !!req.user?.emailVerified,
        "session.canonical_email": req.user?.canonicalEmail,
        "session.user_id": req.user?.id,
        "session.request_ip": req.ip,
        "session.survey_invite_email": req.surveyInvite?.email,
        "session.survey_invite_id": req.surveyInvite?.inviteId,
      };
    },
    appendPlugins: [
      PgSimplifyInflectorPlugin,
      PostGraphileUploadFieldPlugin,
      postgisPlugin,
      ProjectInvitesPlugin,
      SurveyInvitesPlugin,
      CanonicalEmailPlugin,
      DataSourcePlugin,
      SanitizeInteractivityTemplatesPlugin,
      orderTopicsByDateAndStickyPlugin,
      reorderSchemaFields(graphqlSchemaModifiers.fieldOrder),
      extraDocumentationPlugin(graphqlSchemaModifiers.documentation),
      SpritesPlugin,
    ],
    graphileBuildOptions: {
      pgOmitListSuffix: true,
      uploadFieldDefinitions,
    },
    exportGqlSchemaPath: "./generated-schema.gql",
    sortExport: true,
    async additionalGraphQLContextFromRequest(req, res) {
      // Return here things that your resolvers need
      return {
        user: req.user,
      };
    },
  })
);

app.listen(process.env.PORT || 3857);

console.log(
  `SeaSketch server running on http://localhost:${
    process.env.PORT || 3857
  }/graphiql`
);

(async function () {
  rotateKeys(pool);
})();
