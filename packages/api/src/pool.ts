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
  pool.on("connect", (client) => {
    client.query("SET statement_timeout TO 3000");
  });
}

export default pool;
