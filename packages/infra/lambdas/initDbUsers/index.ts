/**
 * initDbUsers handles events from a CloudFormation Custom Resource in order
 * to run after the initial creation of the SeaSketch Database.
 * It does two things:
 *   * Creates a new 'graphile' user for use by postgraphile
 *   * Grants 'rds_iam' permission to both postgres & graphile users
 *     to enable iam authentication
 */
import * as AWS from "aws-sdk";
import { Client } from "node-postgres";

export async function handler(event: AWSCDKAsyncCustomResource.OnEventRequest) {
  switch (event.RequestType) {
    case "Create":
      console.log("initializing users...", event.ResourceProperties);
      return initializeUsers(event);
    case "Update":
      console.log("update: noop");
      return { PhysicalResourceId: event.PhysicalResourceId };
    case "Delete":
      console.log("delete: noop");
      return {};
  }
}

interface DBSecret {
  password: string;
  dbname: string;
  engine: string;
  port: number;
  dbInstanceIdentifier: string;
  host: string;
  username: string;
}

export async function initializeUsers(
  event: AWSCDKAsyncCustomResource.OnEventRequest
): Promise<AWSCDKAsyncCustomResource.OnEventResponse> {
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
  let secret: DBSecret;
  if (secretValue.SecretString) {
    secret = JSON.parse(secretValue.SecretString);
  } else {
    // @ts-ignore
    let buff = new Buffer(secretValue.SecretBinary!, "base64");
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
  console.log("creating user...");
  await dbClient.query("CREATE USER graphile WITH LOGIN");
  console.log("granint rds_iam...");
  await dbClient.query("GRANT rds_iam TO postgres");
  const res = await dbClient.query("GRANT rds_iam TO graphile");
  console.log("done", res);
  return {
    PhysicalResourceId: `${secret.dbInstanceIdentifier}/dbUsers`,
    Data: {
      username: "graphile",
    },
  };
}
