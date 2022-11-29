#!/usr/bin/env node
const { Client } = require("pg");
const client = new Client({
  connectionString:
    process.env.CYPRESS_TEST_DB ||
    "postgres://postgres:password@localhost:54321/seasketch",
});
(async () => {
  await client.connect();
  const res = await client.query(
    `update invite_emails set token_expires_at = to_timestamp($1) where id = $2 returning id`,
    [1666633274.849, process.argv[2]]
  );
  console.log(
    `Updated ${res.rows.length} invite_email${res.rows.length !== 1 ? "s" : ""} from database`
  );
  await client.end();
})();