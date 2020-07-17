import { Pool } from "pg";
require("dotenv").config();

let pool: Pool;
if (process.env.NODE_ENV === "test") {
  const Pool = require("pgmock2").default;
  pool = new Pool();
} else {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  pool.on("error", (err, client) => {
    console.error("Unexpected error on idle client", err);
    process.exit(-1);
  });
  pool.connect((err, client) => {
    if (err) {
      console.error(
        `Exception when trying to connect to db at ${process.env.DATABASE_URL}`
      );
      console.error(err);
      process.exit(-1);
    } else {
      client.query("SET statement_timeout TO 3000");
    }
  });
}

export default pool;
