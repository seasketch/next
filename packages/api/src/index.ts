import express from "express";
import { postgraphile } from "postgraphile";
import PgSimplifyInflectorPlugin from "@graphile-contrib/pg-simplify-inflector";
import compression from "compression";
import jwt from "jsonwebtoken";

const app = express();

app.use(compression());

type Role =
  | "anon"
  | "seasketch_user"
  | "seasketch_admin"
  | "seasketch_superuser";

interface PGSettings {
  role: Role;
  "session.project_id"?: number;
  "session.email_verified": boolean;
  "session.user_id"?: number;
  [key: string]: any;
}

app.use(
  postgraphile(
    process.env.DATABASE_URL ||
      "postgres://graphile:password@localhost:54320/seasketch",
    "public",
    {
      ownerConnectionString:
        process.env.OWNER_DATABASE_URL ||
        "postgres://postgres:password@localhost:54320/seasketch",
      watchPg: true,
      graphiql: true,
      enhanceGraphiql: true,
      ignoreRBAC: false,
      ignoreIndexes: false,
      pgSettings: (req): PGSettings => {
        // TODO: This decodes any jwt and trusts it's claims for development.
        // Implement Auth0 integration for production use.
        const defaults = {
          statement_timeout: "1000",
          role: "anon",
          "session.email_verified": false
        } as PGSettings;
        if (req.headers["authorization"]) {
          const decoded = jwt.decode(
            req.headers["authorization"].split(" ")[1],
            { json: true }
          );
          if (decoded) {
            return {
              ...defaults,
              role: decoded.role || "anon",
              "session.project_id": parseInt(decoded.project_id),
              "session.email_verified": !!decoded.email_verified,
              "session.user_id": parseInt(decoded.sub)
            };
          } else {
            return defaults;
          }
        } else {
          return defaults;
        }
      },
      appendPlugins: [PgSimplifyInflectorPlugin],
      graphileBuildOptions: {
        pgOmitListSuffix: true
      },
      exportGqlSchemaPath: "./generated-schema.gql",
      sortExport: true
    }
  )
);

app.listen(process.env.PORT || 3000);
