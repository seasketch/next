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
import { Job, run } from "graphile-worker";
import cors from "cors";
import https from "https";
import fs from "fs";
import graphileOptions from "./graphileOptions";
import { getFeatureCollection, getMVT } from "./exportSurvey";
import * as Sentry from "@sentry/node";
import { getPgSettings, setTransactionSessionVariables } from "./poolAuth";
import { makeDataLoaders } from "./dataLoaders";
import slugify from "slugify";
import { Pool } from "pg";
import { ManagementClient } from "auth0";
import * as cache from "./cache";
import { verifyEmailWithToken } from "./emailVerification";
import { getRealUserVisits, getVisitorMetrics } from "./visitorMetrics";
import layerApi from "./layerApi";

const ISSUER = (process.env.ISSUER || "seasketch.org")
  .split(",")
  .map((issuer) => issuer.trim());

interface SSNRequest extends Request {
  user?: { id: number; canonicalEmail: string };
}

const app = express();

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      // Automatically instrument Node.js libraries and frameworks
      ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
      // // enable HTTP calls tracing
      // new Sentry.Integrations.Http({ tracing: true }),
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
    }) as express.RequestHandler
  );

  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler() as express.RequestHandler);
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

const loadersPool = createPool({}, "admin");
// Layers API comes before the authorization middleware because it makes
// use of project api keys
app.use("/layers", layerApi(loadersPool));

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
    maxFileSize: bytes("5GB"),
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

type JobStatusUpdateConfig = {
  table: string;
  column: string;
  task_identifier: string;
};

const jobStatusPropsToUpdate: JobStatusUpdateConfig[] = [
  {
    table: "map_bookmarks",
    column: "screenshot_job_status",
    task_identifier: "createBookmarkScreenshot",
  },
];

async function updateMatchingTables(
  job: Job,
  status: "queued" | "started" | "finished" | "error" | "failed",
  pool: Pool
) {
  const configs = jobStatusPropsToUpdate.filter(
    (c) => c.task_identifier === job.task_identifier
  );
  if (job.payload && "id" in (job.payload as any)) {
    for (const { table, column } of configs) {
      // This query looks weird because error and failed events can come in out
      // of order somehow. This makes sure failure is the final status and
      // related error events don't clobber that status.
      await pool.query(
        `update ${table} set ${column} = $2 where id = $1 and (${column} != 'failed'::worker_job_status or $2 != 'error'::worker_job_status)`,
        [(job.payload as any).id, status]
      );
    }
  }
}

run({
  pgPool: workerPool,
  concurrency: parseInt(process.env.GRAPHILE_WORKER_CONCURRENCY || "0"),
  // Install signal handlers for graceful shutdown on SIGINT, SIGTERM, etc
  noHandleSignals: false,
  pollInterval: process.env.GRAPHILE_POLL_INTERVAL
    ? parseInt(process.env.GRAPHILE_POLL_INTERVAL)
    : 1000,
  taskDirectory: path.join(__dirname, "..", "tasks"),
  crontab:
    process.env.NODE_ENV === "production"
      ? `
  * * * * * cleanupProjectBackgroundJobs
  * * * * * cleanupDeletedOverlayRecords
  * * * * * collectActivityStats
  */2 * * * * collectVisitorStats
  */3 * * * * identifyVisitedProjects
  */2 * * * * collectMapDataRequestCounts
  */3 * * * * identifyProjectsWithDataRequests
  */5 * * * * rollupDataSourceRequests
  * * * * * deleteExpiredArchivedDataSources
  0 */6 * * * updateCRWTemplate
  * 1 * * * refreshGmapsApiSession
  * * * * * cleanupTimedOutSpatialMetricTasks
  `
      : `
  * * * * * cleanupProjectBackgroundJobs
  * * * * * cleanupDeletedOverlayRecords
  * * * * * collectActivityStats
  * * * * * deleteExpiredArchivedDataSources
  * 1 * * * refreshGmapsApiSession
  * * * * * cleanupTimedOutSpatialMetricTasks
  `,
}).then((runner) => {
  runner.events.on("job:start", ({ worker, job }) => {
    const transaction = Sentry.startTransaction({
      op: "job",
      name: `Job Execution: ${job.task_identifier}`,
    });
    // @ts-ignore
    job.__sentry_transaction = transaction;
    updateMatchingTables(job, "started", workerPool);
  });
  runner.events.on("job:success", ({ worker, job }) => {
    // @ts-ignore
    if (job.__sentry_transaction) {
      // @ts-ignore
      job.__sentry_transaction.finish(); // End the transaction on success
    }
    updateMatchingTables(job, "finished", workerPool);
  });
  runner.events.on("job:error", ({ worker, job }) => {
    Sentry.captureMessage(`Graphile Worker:${job.task_identifier}:error`, {
      extra: {
        job: job,
      },
    });
    // @ts-ignore
    if (job.__sentry_transaction) {
      // @ts-ignore
      job.__sentry_transaction.setStatus("internal_error");
      // @ts-ignore
      job.__sentry_transaction.finish();
    }
    updateMatchingTables(job, "error", workerPool);
  });
  runner.events.on("job:failed", ({ worker, job }) => {
    Sentry.captureMessage(`Graphile Worker:${job.task_identifier}:failed`, {
      extra: {
        job: job,
      },
    });
    // @ts-ignore
    if (job.__sentry_transaction) {
      // @ts-ignore
      job.__sentry_transaction.setStatus("failed");
      // @ts-ignore
      job.__sentry_transaction.finish();
    }
    updateMatchingTables(job, "failed", workerPool);
  });
});

const tilesetPool = createPool();
const geoPool = createPool();
const bookmarksPool = createPool();

app.use("/verify-email", async function (req, res, next) {
  // get token from query string
  const token = req.query.verification;
  if (!token) {
    return res.status(400).json({ error: "token is required" });
  }
  try {
    const claims = await verifyEmailWithToken(token, loadersPool);
    res.redirect(302, claims.redirectUrl || process.env.CLIENT_DOMAIN);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

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
      // fixes https://github.com/seasketch/next/issues/840
      if (token === "null" || token === "undefined" || token === "") {
        token = undefined;
      }
      let claims:
        | {
            userId?: number;
            projectId?: number;
            canonicalEmail?: string;
            isSuperuser?: boolean;
          }
        | undefined;
      if (token) {
        claims = await verify(loadersPool, token, ISSUER);
      }
      const pgSettings = getPgSettings(req);
      if (
        claims &&
        claims.canonicalEmail &&
        claims.userId &&
        pgSettings.role === "anon"
      ) {
        pgSettings.role = claims.isSuperuser
          ? "seasketch_superuser"
          : "seasketch_user";
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
      const geojson = rows[0].sketch_or_collection_as_geojson || null;
      if (geojson === null) {
        res
          .status(404)
          .send(
            `Sketch with id ${id} not found. It either does not exists or is not shared with "${
              claims?.canonicalEmail || `anon`
            }"`
          );
        return;
      }
      res.setHeader("Content-Type", "application/json");
      const name = geojson?.properties?.name || `Sketch-${id}`;
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${slugify(name)}.geojson.json`
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
      res.send(geojson);
    } catch (e: any) {
      res.status(500).send(`Problem generating geojson.\n${e.toString()}`);
      return;
    } finally {
      client.query("COMMIT");
      client.release();
    }
  }
);

app.use(
  "/bookmarks/:id",
  authorizationMiddleware,
  currentProjectMiddlware,
  userAccountMiddlware,
  async function (req, res, next) {
    const client = await bookmarksPool.connect();
    try {
      await client.query("BEGIN");
      let token: string | undefined = req.query.token;
      let claims:
        | {
            userId?: number;
            projectId?: number;
            canonicalEmail?: string;
            isSuperuser?: boolean;
          }
        | undefined;
      if (token) {
        claims = await verify(loadersPool, token, ISSUER);
      }
      const pgSettings = getPgSettings(req);
      if (
        claims &&
        claims.canonicalEmail &&
        claims.userId &&
        pgSettings.role === "anon"
      ) {
        pgSettings.role = claims.isSuperuser
          ? "seasketch_superuser"
          : "seasketch_user";
        pgSettings["session.user_id"] = claims.userId;
        pgSettings["session.email_verified"] = true;
        pgSettings["session.canonical_email"] = claims.canonicalEmail;
      }
      if (claims && claims.projectId) {
        pgSettings["session.project_id"] = claims.projectId;
      }
      await setTransactionSessionVariables(pgSettings, client);
      const id = req.params.id;
      const { rows } = await client.query(
        `
        SELECT bookmark_data($1) as bookmark
          `,
        [id]
      );
      const bookmark = rows[0].bookmark || null;
      const { rows: spriteRows } = await client.query(
        `
        SELECT get_sprite_data_for_screenshot(map_bookmarks.*) as sprite_images from map_bookmarks where id = $1
          `,
        [id]
      );
      const spriteImages = spriteRows[0].sprite_images;
      await client.query("COMMIT");
      await client.release();
      res.setHeader("Content-Type", "application/json");
      if (bookmark === null) {
        res.status(404);
      }
      bookmark.spriteImages = spriteImages;
      res.send(bookmark);
    } catch (e: any) {
      client.query("COMMIT");
      client.release();
      res.status(500).send(`Problem generating bookmark.\n${e.toString()}`);
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

app.use("/sitemap.xml", async function (req, res, next) {
  try {
    const client = await loadersPool.connect();
    const { rows } = await client.query(
      `
      SELECT slug, about_page_enabled from projects
      WHERE is_listed = true and
      id = any (
        select 
          distinct(project_id)
        from
          table_of_contents_items
        where
          is_draft = false
      )
      ORDER BY name
    `
    );
    const projects = rows;
    res.header("Content-Type", "text/xml");
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://${process.env.CLIENT_DOMAIN}/</loc>
          <priority>1.0</priority>
        </url>
        <url>
          <loc>https://${process.env.CLIENT_DOMAIN}/projects</loc>
          <priority>0.9</priority>
        </url>
        <url>
          <loc>https://docs.seasketch.org/</loc>
          <priority>0.8</priority>
        </url>
        <url>
          <loc>https://www.seasketch.org/new-project</loc>
          <priority>0.8</priority>
        </url>
        ${projects
          .map(
            (project: { slug: string; about_page_enabled: boolean }) => `
            <url>
              <loc>https://${process.env.CLIENT_DOMAIN}/${project.slug}/app${
              project.about_page_enabled ? "/about" : ""
            }</loc>
            </url>
          `
          )
          .join("\n")}
      </urlset>
    `
    );
    client.release();
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500);
  }
});

app.use(
  postgraphile(pool, "public", {
    ...graphileOptions(),
    pgSettings: getPgSettings,
    websocketMiddlewares: [
      authorizationMiddleware as any,
      currentProjectMiddlware as any,
      userAccountMiddlware as any,
      verifyEmailMiddleware as any,
    ],
    async additionalGraphQLContextFromRequest(req, res) {
      // Return here things that your resolvers need
      return {
        user: req.user,
        projectId: req.projectId,
        loaders: makeDataLoaders(loadersPool),
        adminPool: loadersPool,
      };
    },
  }) as express.RequestHandler
);

// The error handler must be before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler() as express.ErrorRequestHandler);

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

  // Start the overlay engine worker message consumer if the SQS queue URL is configured
  if (process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL) {
    try {
      const { startOverlayEngineWorkerMessageConsumer } = await import(
        "./overlayEngineWorkers/messageQueueConsumer"
      );
      startOverlayEngineWorkerMessageConsumer(loadersPool);
      console.log(
        "Overlay engine worker message consumer started successfully"
      );
    } catch (error) {
      console.error(
        "Failed to start overlay engine worker message consumer:",
        error
      );
    }
  } else {
    console.log(
      "OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL not set, skipping message consumer startup"
    );
  }
})();
