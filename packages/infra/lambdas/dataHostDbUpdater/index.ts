/**
 * CustomResource Hook receives events when a DataHostingStack is modified.
 * Makes sure records exist in the SeaSketch database so that a hosting region
 * can be specified by users.
 */
import * as AWS from "aws-sdk";
import { Client } from "pg";
const fs = require("fs");

// Type definitions for CDK custom resources
declare namespace AWSCDKAsyncCustomResource {
  interface OnEventRequest {
    RequestType: "Create" | "Update" | "Delete";
    ResourceProperties: any;
  }

  interface OnEventResponse {
    PhysicalResourceId: string;
    Data?: { [key: string]: any };
  }
}

const pem = fs.readFileSync("./rds-ca-2019-root.pem").toString();
const signer = new AWS.RDS.Signer();

export interface HostingStackResourceProperties {
  region: string;
  coords: [number, number];
  name: string;
  domain: string;
  bucket: string;
}

const db = {
  region: process.env.PGREGION,
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT as string),
  user: process.env.PGUSER,
  database: process.env.PGDATABASE,
};

export async function handler(event: AWSCDKAsyncCustomResource.OnEventRequest) {
  const props = (event as any)
    .ResourceProperties as HostingStackResourceProperties;
  switch (event.RequestType) {
    case "Create":
      console.log("create", props);
      return await upsertDataSourcesBucket(props);
    case "Update":
      console.log("update", props);
      return await upsertDataSourcesBucket(props);
    case "Delete":
      console.log("delete", props);
      return await setDataSourcesBucketOffline(props);
  }
}

async function getClient(host: HostingStackResourceProperties) {
  return new Promise<Client>((resolve, reject) => {
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
          const dbClient = new Client({
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
            await dbClient.connect();
            resolve(dbClient);
          } catch (e) {
            reject(e);
          }
        }
      }
    );
  });
}

export async function upsertDataSourcesBucket(
  event: HostingStackResourceProperties
): Promise<AWSCDKAsyncCustomResource.OnEventResponse> {
  const dbClient = await getClient(event);
  const query = `
  insert into data_sources_buckets (url, name, region, location, bucket)
  values ($1, $2, $3, ST_GeomFromText($4, 4326), $5)
  on conflict (url)
  do
    update set name = $6, region = $7, location = ST_GeomFromText($8, 4326), bucket = $9
  `;
  const values = [
    `https://${event.domain}`,
    event.name,
    event.region,
    `POINT(${event.coords.join(" ")})`,
    event.bucket,
    event.name,
    event.region,
    `POINT(${event.coords.join(" ")})`,
    event.bucket,
  ];
  console.log("query, values", query, values);
  await dbClient.query(query, values);
  return {
    PhysicalResourceId: idForEvent(event),
  };
}

export async function setDataSourcesBucketOffline(
  event: HostingStackResourceProperties
): Promise<AWSCDKAsyncCustomResource.OnEventResponse> {
  const dbClient = await getClient(event);
  await dbClient.query(
    `
    update data_sources_buckets 
    set offline = true where url = $1
  `,
    [`https://${event.domain}`]
  );
  return {
    PhysicalResourceId: idForEvent(event),
  };
}

function idForEvent(event: HostingStackResourceProperties) {
  return `${db.host}/dataSourcesBuckets/${event.domain}`;
}
