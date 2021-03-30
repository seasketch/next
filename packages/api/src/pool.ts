import { Signer } from "aws-sdk/clients/rds";
import { Pool } from "pg";

require("dotenv").config();

const signer = new Signer();

let pool: Promise<Pool>;

export default async function getPool(): Promise<Pool> {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

async function createPool(): Promise<Pool> {
  return new Promise<Pool>((resolve, reject) => {
    if (process.env.NODE_ENV === "test") {
      const Pool = require("pgmock2").default;
      resolve(new Pool());
    } else if (process.env.NODE_ENV === "production") {
      const { PGHOST, PGUSER, PGREGION, PGPORT, PGDATABASE } = process.env;
      if (!PGHOST || !PGUSER || !PGREGION || !PGPORT || !PGDATABASE) {
        return reject(
          new Error(
            "PGHOST, PGUSER, PGREGION, PGPORT, PGDATABASE must be set if NODE_ENV=production"
          )
        );
      }
      console.log(
        `Requesting IAM token for user ${PGUSER} at ${PGHOST}/${PGDATABASE}`
      );
      signer.getAuthToken(
        {
          region: PGREGION,
          hostname: PGHOST,
          port: parseInt(PGPORT),
          username: PGUSER,
        },
        function (err, token) {
          if (err) {
            return reject(new Error("Could not sign token for RDS access"));
          } else {
            console.log("connecting with options...");
            console.log({
              database: PGDATABASE,
              host: PGHOST,
              port: parseInt(PGPORT),
              password: "******",
              user: PGUSER,
              ssl: { rejectUnauthorized: false },
            });
            const pool = new Pool({
              database: PGDATABASE,
              host: PGHOST,
              port: parseInt(PGPORT),
              password: token,
              user: PGUSER,
              ssl: { rejectUnauthorized: false },
            });
            pool.connect((err, client) => {
              if (err) {
                reject(err);
              } else {
                client.query("SET statement_timeout TO 3000");
                resolve(pool);
              }
            });
          }
        }
      );
    } else {
      console.log(`Connecting to ${process.env.DATABASE_URL}`);
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
      pool.on("error", (err, client) => {
        console.error("Unexpected error on idle client", err);
        process.exit(-1);
      });
      pool.connect((err, client) => {
        if (err) {
          reject(err);
        } else {
          client.query("SET statement_timeout TO 3000");
          resolve(pool);
        }
      });
    }
  });
}
