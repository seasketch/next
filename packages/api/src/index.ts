import express from "express";
import { postgraphile } from "postgraphile";
import PgSimplifyInflectorPlugin from "@graphile-contrib/pg-simplify-inflector";
import compression from "compression";
import path from "path";
import jwt from "express-jwt";
import jwks from "jwks-rsa";
import authConfig from "./authConfig.json";
import {
  PGSessionSettings,
  getPGSessionSettings,
  IncomingRequest,
} from "./auth";

require("dotenv").config();

const app = express();

app.use(compression());

app.get("/auth-helper", (req, res) => {
  res.header({ "Content-Type": "text/html" });
  res.sendFile(path.join(__dirname, "..", "src", "authHelper.html"));
});

app.get("/auth_config.json", (req, res) => {
  console.log(req.headers);
  res.contentType("json");
  res.send(
    JSON.stringify({
      ...authConfig,
      audience: process.env.JWT_AUD,
    })
  );
});

const jwtCheck = jwt({
  secret: jwks.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: process.env.JWKS_URI!,
  }),
  audience: process.env.JWT_AUD,
  issuer: process.env.JWT_ISS,
  algorithms: ["RS256"],
});

app.use(jwtCheck);

app.use(
  (
    err: Error | null,
    req: express.Request,
    res: express.Response,
    next: () => void
  ) => {
    if (err?.name === "UnauthorizedError") {
      next();
    }
  }
);

app.use(
  postgraphile(process.env.DATABASE_URL, "public", {
    ownerConnectionString: process.env.OWNER_DATABASE_URL,
    watchPg: true,
    graphiql: true,
    enhanceGraphiql: true,
    ignoreRBAC: false,
    ignoreIndexes: false,
    pgSettings: (req): Promise<PGSessionSettings> =>
      getPGSessionSettings(req as IncomingRequest),
    appendPlugins: [PgSimplifyInflectorPlugin],
    graphileBuildOptions: {
      pgOmitListSuffix: true,
    },
    exportGqlSchemaPath: "./generated-schema.gql",
    sortExport: true,
  })
);

app.listen(process.env.PORT || 3857);

console.log(
  `seasketch server running on http://localhost:${
    process.env.PORT || 3857
  }/graphiql`
);
