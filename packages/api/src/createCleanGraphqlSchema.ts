import { createPostGraphileSchema } from "postgraphile-core";
import graphileOptions from "./graphileOptions";
import { lexicographicSortSchema, printSchema } from "graphql";
import fs from "fs";

const DB_URL = process.env.GM_DBURL!.replace(
  "postgres:password",
  "graphile:password"
);
createPostGraphileSchema(DB_URL, "public", {
  ...graphileOptions(),
}).then((schema) => {
  const sorted = lexicographicSortSchema(schema);
  fs.writeFileSync("generated-schema-clean.gql", printSchema(sorted));
  process.exit();
});
