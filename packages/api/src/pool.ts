import { Signer } from "aws-sdk/clients/rds";
import { Pool } from "pg";

require("dotenv").config();

const signer = new Signer();

let pool: Pool;
let workerPool: Pool;

if (process.env.NODE_ENV === "test") {
  const Pool = require("pgmock2").default;
  pool = new Pool();
  workerPool = new Pool();
} else if (process.env.NODE_ENV === "production") {
  const { PGHOST, PGUSER, PGREGION, PGPORT, PGDATABASE } = process.env;
  if (!PGHOST || !PGUSER || !PGREGION || !PGPORT || !PGDATABASE) {
    throw new Error(
      "PGHOST, PGUSER, PGREGION, PGPORT, PGDATABASE must be set if NODE_ENV=production"
    );
  }
  console.log(
    `Requesting IAM token for user ${PGUSER} at ${PGHOST}/${PGDATABASE}`
  );
  pool = new Pool({
    database: PGDATABASE,
    host: PGHOST,
    port: parseInt(PGPORT),
    // @ts-ignore
    password: async () => {
      return new Promise((resolve, reject) => {
        signer.getAuthToken(
          {
            region: PGREGION,
            hostname: PGHOST,
            port: parseInt(PGPORT),
            username: PGUSER,
          },
          function (err, token) {
            if (err) {
              reject(err);
            } else {
              resolve(token);
            }
          }
        );
      });
    },
    user: PGUSER,
    ssl: { rejectUnauthorized: false },
  });

  workerPool = new Pool({
    database: PGDATABASE,
    host: PGHOST,
    port: parseInt(PGPORT),
    // @ts-ignore
    password: async () => {
      return new Promise((resolve, reject) => {
        signer.getAuthToken(
          {
            region: PGREGION,
            hostname: PGHOST,
            port: parseInt(PGPORT),
            username: "admin",
          },
          function (err, token) {
            if (err) {
              reject(err);
            } else {
              resolve(token);
            }
          }
        );
      });
    },
    user: "admin",
    ssl: { rejectUnauthorized: false },
  });
} else {
  console.log(`Connecting to ${process.env.DATABASE_URL}`);
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  workerPool = new Pool({
    connectionString: process.env.ADMIN_DATABASE_URL,
  });
}

if (process.env.NODE_ENV !== "test") {
  pool.on("error", (err, client) => {
    console.error("Unexpected error on idle client", err);
    process.exit(-1);
  });

  pool.connect((err, client) => {
    if (err) {
      throw err;
    } else {
      client.query("SET statement_timeout TO 3000");
    }
  });

  workerPool.on("error", (err, client) => {
    console.error("Unexpected error on idle client", err);
    process.exit(-1);
  });

  workerPool.connect((err, client) => {
    if (err) {
      throw err;
    } else {
      client.query("SET statement_timeout TO 3000");
    }
  });
}

export default pool;
export { workerPool };
