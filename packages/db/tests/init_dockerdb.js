const { Client } = require("pg");
const fs = require("fs");
const sql = fs.readFileSync("./init_dockerdb.sql");
const client = new Client(process.env.TEST_DB + "template1");
(async () => {
  await client.connect();
  await client.query("CREATE USER graphile WITH PASSWORD 'password'");
  await client.query("CREATE USER graphile_migrate WITH PASSWORD 'password'");
  await client.query("CREATE DATABASE seasketch OWNER graphile_migrate;");
  await client.query(
    "GRANT ALL PRIVILEGES ON DATABASE seasketch TO graphile_migrate;"
  );
  await client.end();
})();
