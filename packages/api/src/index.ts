import express from "express";
import { postgraphile } from "postgraphile";
import PgSimplifyInflectorPlugin from "@graphile-contrib/pg-simplify-inflector";
import compression from "compression";

const app = express();

app.use(compression());

app.use(
  postgraphile(
    process.env.DATABASE_URL ||
      "postgres://graphile_root:password@localhost:54320/seasketch",
    "public",
    {
      pgDefaultRole: "anon",
      ownerConnectionString:
        process.env.OWNER_DATABASE_URL ||
        "postgres://postgres:password@localhost:54320/seasketch",
      watchPg: true,
      graphiql: true,
      enhanceGraphiql: true,
      ignoreRBAC: false,
      pgSettings: {
        statement_timeout: "1000"
      },
      appendPlugins: [PgSimplifyInflectorPlugin],
      graphileBuildOptions: {
        pgOmitListSuffix: true
      }
    }
  )
);

app.listen(process.env.PORT || 3000);
