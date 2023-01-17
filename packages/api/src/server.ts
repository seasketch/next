import express, { Request } from "express";
import { postgraphile } from "postgraphile";
import compression from "compression";
import path from "path";
import pool, { createPool, workerPool } from "./pool";
import { getJWKS, rotateKeys, verify } from "./auth/jwks";
import authorizationMiddleware from "./middleware/authorizationMiddleware";
import userAccountMiddlware from "./middleware/userAccountMiddleware";
import currentProjectMiddlware from "./middleware/currentProjectMiddleware";
import surveyInviteMiddlware from "./middleware/surveyInviteMiddleware";
import verifyEmailMiddleware from "./middleware/verifyEmailMiddleware";
import { unsubscribeFromTopic } from "./activityNotifications/topicNotifications";
import { graphqlUploadExpress } from "graphql-upload";
import bytes from "bytes";
import { run } from "graphile-worker";
import cors from "cors";
import https from "https";
import fs from "fs";
import graphileOptions from "./graphileOptions";
import { getFeatureCollection, getMVT } from "./exportSurvey";
import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";
import { getPgSettings, setTransactionSessionVariables } from "./poolAuth";
import { makeDataLoaders } from "./dataLoaders";

interface SSNRequest extends Request {
  user?: { id: number; canonicalEmail: string };
}

const app = express();

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      // enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // enable Express.js middleware tracing
      new Tracing.Integrations.Express({ app }),
    ],

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
    environment: process.env.REACT_APP_SENTRY_ENV || "production",
  });

  // RequestHandler creates a separate execution context using domains, so that every
  // transaction/span/breadcrumb is attached to its own Hub instance

  app.use(
    Sentry.Handlers.requestHandler({
      user: false,
    })
  );

  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());
}

app.use(compression());

app.use(
  cors({
    origin: true,
    credentials: true,
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
      "if-none-match",
      "pragma",
    ],
    exposedHeaders: ["ETag"],
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
      domain: process.env.AUTH0_DOMAIN,
      clientId: process.env.AUTH0_CLIENT_ID,
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

app.use(function (req: SSNRequest, res, next) {
  if (req.user) {
    Sentry.setUser({
      email: req.user.canonicalEmail,
      id: req.user?.id?.toString(),
    });
  }
  next();
});

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

app.use(function (req: SSNRequest, res, next) {
  if (req.user) {
    Sentry.setUser({
      email: req.user.canonicalEmail,
      id: req.user.id.toString(),
    });
  }
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
  crontab: `
    * * * * * cleanupDataUploads
    * * * * * cleanupDeletedOverlayRecords
  `,
});

const tilesetPool = createPool();
const geoPool = createPool();
const loadersPool = createPool({}, "admin");

app.use(
  "/export-survey/:id/spatial/:element_id/tiles/:z/:x/:y.pbf",
  authorizationMiddleware,
  currentProjectMiddlware,
  userAccountMiddlware,
  async function (req, res, next) {
    const client = await tilesetPool.connect();
    try {
      await client.query("BEGIN");
      await setTransactionSessionVariables(getPgSettings(req), client);
      const x = parseInt(req.params.x, 10);
      const y = parseInt(req.params.y, 10);
      const z = parseInt(req.params.z, 10);
      const surveyId = parseInt(req.params.id);
      const elementId = parseInt(req.params.element_id);
      const tile = await getMVT(elementId, x, y, z, client);
      await client.query("COMMIT");
      await client.release();
      res.setHeader("Content-Type", "application/x-protobuf");
      res.setHeader("Cache-Control", "public, max-age=10");
      if (tile === null || tile.length === 0) {
        res.status(204);
      }
      res.send(tile);
    } catch (e: any) {
      client.query("COMMIT");
      res.status(500).send(`Problem generating tiles.\n${e.toString()}`);
      return;
    } finally {
      client.release();
    }
  }
);

app.use(
  "/sketches/:id.geojson.json",
  authorizationMiddleware,
  currentProjectMiddlware,
  userAccountMiddlware,
  async function (req, res, next) {
    const client = await geoPool.connect();
    try {
      await client.query("BEGIN");
      let token: string | undefined = req.query.reporting_access_token;
      let claims:
        | { userId?: number; projectId?: number; canonicalEmail?: string }
        | undefined;
      if (token) {
        claims = await verify(
          loadersPool,
          token,
          process.env.HOST || "seasketch.org"
        );
      }
      const pgSettings = getPgSettings(req);
      if (
        claims &&
        claims.canonicalEmail &&
        claims.userId &&
        pgSettings.role === "anon"
      ) {
        pgSettings.role = "seasketch_user";
        pgSettings["session.user_id"] = claims.userId;
        pgSettings["session.email_verified"] = true;
        pgSettings["session.canonical_email"] = claims.canonicalEmail;
      }
      if (claims && claims.projectId) {
        pgSettings["session.project_id"] = claims.projectId;
      }
      await setTransactionSessionVariables(pgSettings, client);
      const id = parseInt(req.params.id);
      const { rows } = await client.query(
        `
          SELECT sketch_or_collection_as_geojson($1)
          `,
        [id]
      );
      const geojson = rows[0].sketch_or_collection_as_geojson;
      await client.query("COMMIT");
      await client.release();
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Sketch-${id}.geojson.json`
      );
      if (
        (req.query && req.query.timestamp) ||
        geojson?.properties?.sharedInForum
      ) {
        // 30 minutes
        // Ideally we'd set this to a year, but I'm conserned about updates to
        // field exportid that could impact styled sketches. Like if sketches
        // are styled by a "designation" field, but that field's exportid
        // changes to "class". The attributes are burned into the cached
        // geometry with the old exportid
        res.setHeader("Cache-Control", "public, max-age=1800");
      }
      if (geojson === null) {
        res.status(404);
      }
      res.send(geojson);
    } catch (e: any) {
      client.query("COMMIT");
      client.release();
      res.status(500).send(`Problem generating tiles.\n${e.toString()}`);
      return;
    }
  }
);

app.use(
  "/export-survey/:id/spatial/:element_id/:format",
  authorizationMiddleware,
  currentProjectMiddlware,
  userAccountMiddlware,
  async function (req, res, next) {
    let { id, element_id, format } = req.params;
    if (!id || !element_id || !format) {
      throw new Error(
        "Invalid request. id, element_id and format parameters required"
      );
    }
    try {
      await pool.query("BEGIN");
      await setTransactionSessionVariables(getPgSettings(req), pool);
      const collection = await getFeatureCollection(
        parseInt(req.params.id),
        parseInt(req.params.element_id),
        pool
      );
      await pool.query("COMMIT");

      if (format === "geojson") {
        res.header({ "Content-Type": "application/json" });
        res.header({
          "Content-Disposition": `attachment; filename="${
            req.query.filename || `${req.params.element_id}.geojson.json`
          }"`,
        });
        res.send(JSON.stringify(collection));
      } else {
        throw new Error(
          `Format was ${format}. Only GeoJSON is currently supported`
        );
      }
    } catch (e: any) {
      res.status(500);
      res.send(e.toString());
    }
  }
);

app.use(
  postgraphile(pool, "public", {
    ...graphileOptions(),
    pgSettings: getPgSettings,
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
        loaders: makeDataLoaders(loadersPool),
      };
    },
  })
);

// The error handler must be before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

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
