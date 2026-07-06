import { RDS } from "aws-sdk";
import { Client } from "pg";

export async function getClient() {
  if (!dbClient) {
    if (
      db.host &&
      (/localhost/.test(db.host) ||
        /127.0.0.1/.test(db.host) ||
        /host.docker.internal/.test(db.host))
    ) {
      dbClient = new Promise<Client>(async (resolve, reject) => {
        const client = new Client({
          database: db.database,
          host: db.host,
          port: parseInt(db.port.toString()),
          user: db.user,
          password: process.env.PGPASSWORD,
        });
        try {
          await client.connect();
          client.on("error", () => {
            dbClient = null;
          });
          resolve(client);
        } catch (e) {
          reject(e);
        }
      });
    } else {
      dbClient = new Promise<Client>((resolve, reject) => {
        signer.getAuthToken(
          {
            region: db.region,
            hostname: db.host,
            port: parseInt(db.port.toString()),
            username: db.user,
          },
          async function (err, token) {
            if (err) {
              reject(new Error(`could not get auth token: ${err}`));
            } else {
              const client = new Client({
                database: db.database,
                host: db.host,
                port: parseInt(db.port.toString()),
                user: db.user,
                password: token,
                ssl: { rejectUnauthorized: false },
              });
              try {
                await client.connect();
                client.on("error", () => {
                  dbClient = null;
                });
                resolve(client);
              } catch (e) {
                reject(e);
              }
            }
          },
        );
      });
    }
  }
  return dbClient;
}

const signer = new RDS.Signer();

for (const param of ["PGREGION", "PGHOST", "PGPORT", "PGUSER", "PGDATABASE"]) {
  if (!process.env[param]) {
    throw new Error(`Environment variable "${param}" not set`);
  }
}

const db = {
  region: process.env.PGREGION!,
  host: process.env.PGHOST!,
  port: parseInt(process.env.PGPORT as string),
  user: process.env.PGUSER!,
  database: process.env.PGDATABASE!,
};

let dbClient: Promise<Client> | null = null;
