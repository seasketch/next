import express from "express";
import { postgraphile, makePluginHook } from "postgraphile";
import compression from "compression";
import path from "path";
import authConfig from "./authConfig.json";
import pool, { workerPool } from "./pool";
import { getJWKS, rotateKeys } from "./auth/jwks";
import authorizationMiddleware from "./middleware/authorizationMiddleware";
import userAccountMiddlware from "./middleware/userAccountMiddleware";
import currentProjectMiddlware from "./middleware/currentProjectMiddleware";
import surveyInviteMiddlware from "./middleware/surveyInviteMiddleware";
import { IncomingRequest } from "./middleware/IncomingRequest";
import verifyEmailMiddleware from "./middleware/verifyEmailMiddleware";
import { unsubscribeFromTopic } from "./activityNotifications/topicNotifications";
import { graphqlUploadExpress } from "graphql-upload";
import { default as PgPubsub } from "@graphile/pg-pubsub";
import bytes from "bytes";
import { run } from "graphile-worker";
import cors from "cors";
import https from "https";
import fs from "fs";
import graphileOptions from "./graphileOptions";

const app = express();

app.use(compression());

app.use(
  cors({
    origin: true,
    allowedHeaders: [
      "authorization",
      "content-type",
      "x-ss-slug",
      "origin",
      "x-requested-with",
      "accept",
      "x-apollo-tracing",
      "content-length",
      "x-postgraphile-explain",
    ],
    maxAge: 600,
  })
);

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

// Parse Bearer tokens and populate req.user with valid claims
app.use(
  authorizationMiddleware,
  function (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: (err: Error | null) => void
  ) {
    console.error(err);
    // Needed to allow requests to proceed with invalid (e.g. expired) tokens.
    // Clients will be anonymous in that case.
    // @ts-ignore
    if (err.code === "invalid_token") return next();
    return next(err);
  }
);

// assign req.currentProjectId from headers if applicable
app.use(currentProjectMiddlware);

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

run({
  pgPool: workerPool,
  concurrency: parseInt(process.env.GRAPHILE_WORKER_CONCURRENCY || "0"),
  // Install signal handlers for graceful shutdown on SIGINT, SIGTERM, etc
  noHandleSignals: false,
  pollInterval: process.env.GRAPHILE_POLL_INTERVAL
    ? parseInt(process.env.GRAPHILE_POLL_INTERVAL)
    : 1000,
  taskDirectory: path.join(__dirname, "..", "tasks"),
});

app.use(
  postgraphile(pool, "public", {
    ...graphileOptions(),
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
    websocketMiddlewares: [
      authorizationMiddleware,
      currentProjectMiddlware,
      userAccountMiddlware,
      verifyEmailMiddleware,
    ],
    async additionalGraphQLContextFromRequest(req, res) {
      // Return here things that your resolvers need
      return {
        user: req.user,
        projectId: req.projectId,
      };
    },
  })
);

if (process.env.SSL_CRT_FILE && process.env.SSL_KEY_FILE) {
  https
    .createServer(
      {
        key: fs.readFileSync(process.env.SSL_KEY_FILE),
        cert: fs.readFileSync(process.env.SSL_CRT_FILE),
      },
      app
    )
    .listen(3857, function () {
      console.log(
        `SeaSketch server running on https://0.0.0.0:${
          process.env.PORT || 3857
        }/graphiql`
      );
    });
} else {
  app.listen(process.env.PORT || 3857, () => {
    console.log(
      `SeaSketch server running on http://localhost:${
        process.env.PORT || 3857
      }/graphiql`
    );
  });
}

(async function () {
  rotateKeys(pool);
})();
