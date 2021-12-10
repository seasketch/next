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
    `delete from projects where slug = $1 returning id`,
    [process.argv[2]]
  );
  console.log(
    `Deleted ${res.rows.length} project${res.rows.length !== 1 ? "s" : ""}`
  );
  await client.end();
})();
