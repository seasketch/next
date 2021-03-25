const AWS = require("aws-sdk");
const { Client } = require("node-postgres");
const graphile = require("graphile-migrate");
const fs = require("fs");
const path = require("path");

exports.handler = (event) => {
  switch (event.RequestType) {
    case "Create":
      console.log("initializing database...", event.ResourceProperties);
      return initializeDb(event);
    case "Update":
      console.log("update: noop");
      return { PhysicalResourceId: event.PhysicalResourceId };
    case "Delete":
      console.log("delete: noop");
      return {};
  }
};

// interface DBSecret {
//   password: string;
//   dbname: string;
//   engine: string;
//   port: number;
//   dbInstanceIdentifier: string;
//   host: string;
//   username: string;
// }

async function initializeDb(event) {
  const region = event.ResourceProperties["region"];
  if (!region) {
    throw new Error("'region' not defined in ResourceProperties");
  }
  const client = new AWS.SecretsManager({
    region,
  });
  const secretName = event.ResourceProperties["secret"];
  if (!secretName) {
    throw new Error("'secret' not defined in ResourceProperties");
  }
  const secretValue = await client
    .getSecretValue({ SecretId: secretName })
    .promise();
  // Decrypts secret using the associated KMS CMK.
  // Depending on whether the secret is a string or binary, one of these fields will be populated.
  let secret;
  if (secretValue.SecretString) {
    secret = JSON.parse(secretValue.SecretString);
  } else {
    let buff = new Buffer(secretValue.SecretBinary, "base64");
    secret = JSON.parse(buff.toString("ascii"));
  }
  const dbClient = new Client({
    database: secret.dbname,
    host: secret.host,
    port: secret.port,
    password: secret.password,
    user: secret.username,
  });
  await dbClient.connect();
  /**
   * Create an IAM login role for the maintenance bastion. We could just use,
   * postgres, but enabling iam login would disable login with the master
   * password stored in SSM. Don't ask me how long it took to figure that out...
   *
   * Also, ffs, you can't create superusers in rds. You have to grant a role
   * rds_superuser because superuser is too powerful for RDS to handle
   */
  await dbClient.query("CREATE ROLE bastion WITH login");
  await dbClient.query("GRANT rds_iam TO bastion");
  await dbClient.query("GRANT rds_superuser TO bastion");
  await dbClient.query("alter user bastion createrole");
  await dbClient.query("GRANT CONNECT ON DATABASE seasketch TO bastion");
  await dbClient.query("CREATE USER graphile WITH LOGIN");
  await dbClient.query("GRANT CONNECT ON DATABASE seasketch TO graphile");
  const response = await dbClient.query("GRANT rds_iam TO graphile");
  const connectionString = `postgres://${secret.username}:${secret.password}@${secret.host}:${secret.port}/${secret.dbname}`;
  /**
   * After initial setup of user roles, run the latest database migrations
   */
  const migrationsFolder = path.resolve("./migrations");
  await graphile.migrate({
    connectionString,
    migrationsFolder,
  });
  return {
    PhysicalResourceId: `${secret.dbInstanceIdentifier}/initialMigration`,
    Data: {
      username: "graphile",
    },
  };
}
