import { RDS } from "aws-sdk";
import { Client } from "pg";

/**
 * Provides a reusable method of connecting to the production SeaSketch database
 * from Lambda services. Connections are reused so that calling getClient()
 * multiple times will always point to the same database connection. In the
 * event of an error, that connection will be thrown out and subsequent calls
 * will create a new connection.
 *
 * In order for the AWS.RDS signer to operate from lambda you will need to grant
 * connect privileges using an IAM role. See:
 * https://github.com/seasketch/next/blob/master/packages/infra/lib/DataHostDbUpdaterStack.ts#L43
 *
 * This module will throw an exception on import if the following environment
 * variables are not present:
 *
 *   * PGREGION
 *   * PGHOST
 *   * PGPORT
 *   * PGUSER
 *   * PGDATABASE
 *
 * @returns pg.Client
 * @example
 *
 * export const handler = (event) => {
 *   const client = getClient();
 *   const results = await client.query(
 *     `select * from projects where id = $1`,
 *     [event.id]
 *   );
 * }
 */
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
            // uses the IAM role access keys to create an authentication token
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
                password: token,
                user: db.user,
                ssl: {
                  ca: pem,
                },
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
          }
        );
      });
    }
  }
  return dbClient;
}

const pem = `-----BEGIN CERTIFICATE-----
MIIEBjCCAu6gAwIBAgIJAMc0ZzaSUK51MA0GCSqGSIb3DQEBCwUAMIGPMQswCQYD
VQQGEwJVUzEQMA4GA1UEBwwHU2VhdHRsZTETMBEGA1UECAwKV2FzaGluZ3RvbjEi
MCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1h
em9uIFJEUzEgMB4GA1UEAwwXQW1hem9uIFJEUyBSb290IDIwMTkgQ0EwHhcNMTkw
ODIyMTcwODUwWhcNMjQwODIyMTcwODUwWjCBjzELMAkGA1UEBhMCVVMxEDAOBgNV
BAcMB1NlYXR0bGUxEzARBgNVBAgMCldhc2hpbmd0b24xIjAgBgNVBAoMGUFtYXpv
biBXZWIgU2VydmljZXMsIEluYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxIDAeBgNV
BAMMF0FtYXpvbiBSRFMgUm9vdCAyMDE5IENBMIIBIjANBgkqhkiG9w0BAQEFAAOC
AQ8AMIIBCgKCAQEArXnF/E6/Qh+ku3hQTSKPMhQQlCpoWvnIthzX6MK3p5a0eXKZ
oWIjYcNNG6UwJjp4fUXl6glp53Jobn+tWNX88dNH2n8DVbppSwScVE2LpuL+94vY
0EYE/XxN7svKea8YvlrqkUBKyxLxTjh+U/KrGOaHxz9v0l6ZNlDbuaZw3qIWdD/I
6aNbGeRUVtpM6P+bWIoxVl/caQylQS6CEYUk+CpVyJSkopwJlzXT07tMoDL5WgX9
O08KVgDNz9qP/IGtAcRduRcNioH3E9v981QO1zt/Gpb2f8NqAjUUCUZzOnij6mx9
McZ+9cWX88CRzR0vQODWuZscgI08NvM69Fn2SQIDAQABo2MwYTAOBgNVHQ8BAf8E
BAMCAQYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUc19g2LzLA5j0Kxc0LjZa
pmD/vB8wHwYDVR0jBBgwFoAUc19g2LzLA5j0Kxc0LjZapmD/vB8wDQYJKoZIhvcN
AQELBQADggEBAHAG7WTmyjzPRIM85rVj+fWHsLIvqpw6DObIjMWokpliCeMINZFV
ynfgBKsf1ExwbvJNzYFXW6dihnguDG9VMPpi2up/ctQTN8tm9nDKOy08uNZoofMc
NUZxKCEkVKZv+IL4oHoeayt8egtv3ujJM6V14AstMQ6SwvwvA93EP/Ug2e4WAXHu
cbI1NAbUgVDqp+DRdfvZkgYKryjTWd/0+1fS8X1bBZVWzl7eirNVnHbSH2ZDpNuY
0SBd8dj5F6ld3t58ydZbrTHze7JJOd8ijySAp4/kiu9UfZWuTPABzDa/DSdz9Dk/
zPW4CXXvhLmE02TA9/HeCw3KEHIwicNuEfw=
-----END CERTIFICATE-----`;

const signer = new RDS.Signer();

for (const param of ["PGREGION", "PGHOST", "PGPORT", "PGUSER", "PGDATABASE"]) {
  if (!process.env[param]) {
    throw new Error(`Environment variable "${param}" not set`);
  }
}

const db = {
  region: process.env.PGREGION,
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT as string),
  user: process.env.PGUSER,
  database: process.env.PGDATABASE,
};

let dbClient: Promise<Client> | null;
