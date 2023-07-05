import { createPostGraphileSchema } from "postgraphile-core";
import graphileOptions from "./graphileOptions";
import { lexicographicSortSchema, printSchema } from "graphql";
import fs from "fs";

console.log(
  `GM_DBURL=${process.env.GM_DBURL}`
  // process.env.GM_DBURL!.replace("postgres:password", "graphile:password")
);
const DB_URL = process.env.GM_DBURL!.replace(
  "postgres:password",
  "graphile:password"
);
createPostGraphileSchema(DB_URL, "public", {
  ...graphileOptions(),
}).then((schema) => {
  const sorted = lexicographicSortSchema(schema);
  fs.writeFileSync("generated-schema-clean.gql", printSchema(sorted));
  console.log(`wrote generated-schema-clean.gql`);
  process.exit();
});
