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
    `delete from users where canonical_email = $1 returning id`,
    [process.argv[2]]
  );
  console.log(
    `Deleted ${res.rows.length} user${res.rows.length !== 1 ? "s" : ""} from database`
  );
  await client.end();
})();