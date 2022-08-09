#!/usr/bin/env node
import "source-map-support/register";
require("dotenv").config();
import * as cdk from "@aws-cdk/core";
import { DatabaseStack } from "../lib/DatabaseStack";
import { DataHostingStack } from "../lib/DataHostingStack";
import { MaintenanceStack } from "../lib/MaintenanceStack";
import { ReactClientStack } from "../lib/ReactClientStack";
import { PublicUploadsStack } from "../lib/PublicUploadsStack";
import { DataHostDbUpdaterStack } from "../lib/DataHostDbUpdaterStack";
import { RedisStack } from "../lib/RedisStack";
import { GraphQLStack } from "../lib/GraphQLStack";
import { MailerLambdaStack } from "../lib/MailerLambdaStack";
import { OfflineTilePackageBucketStack } from "../lib/OfflineTilePackageUploadStack";
let env = require("./env.production");

const DOMAIN_NAME = "seasket.ch";
const SUBDOMAIN = "next";
const EMAIL_STATUS_NOTIFICATION_TOPIC =
  "arn:aws:sns:us-west-2:196230260133:email-notification-bounces-production";
const SES_EMAIL_SOURCE = '"SeaSketch" <do-not-reply@seasketch.org>';

const app = new cdk.App();
const db = new DatabaseStack(app, "SeaSketchDB", { env });
const redis = new RedisStack(app, "SeaSketchRedis", {
  env,
  db: db.instance,
  vpc: db.vpc,
  securityGroup: db.defaultSecurityGroup,
});
const maintenance = new MaintenanceStack(app, "SeaSketchMaintenanceBastion", {
  env,
  vpc: db.vpc,
  db: db.instance,
  redis: redis.cluster,
});
const client = new ReactClientStack(app, "SeaSketchReactClient", {
  env,
  maintenanceRole: maintenance.taskRole,
  domainName: DOMAIN_NAME,
  siteSubDomain: SUBDOMAIN,
});
const allowedCorsDomains = [
  `https://${[SUBDOMAIN, DOMAIN_NAME].join(".")}`,
  "http://localhost:3000",
  "https://seasketch.org",
  "https://www.seasketch.org",
  "https://staging.seasket.ch",
];

const uploads = new PublicUploadsStack(app, "SeaSketchPublicUploads", {
  env,
  maintenanceRole: maintenance.taskRole,
  allowedCorsDomains,
});

const tilePackages = new OfflineTilePackageBucketStack(
  app,
  "SeaSketchOfflineTilePackagesBucket",
  {
    env,
    maintenanceRole: maintenance.taskRole,
    allowedCorsDomains,
  }
);

const dataHostDbUpdater = new DataHostDbUpdaterStack(
  app,
  "SeaSketchDataHostDbUpdater",
  {
    env,
    db: db.instance,
    vpc: db.vpc,
  }
);

// Setup regional hosts for user-uploaded GeoJSON. These should be registered
// with the database after creation
const hostConfigs: {
  region: string;
  slug: string;
  coords: [number, number];
  name: string;
}[] = [
  {
    name: "Oregon, USA",
    slug: "oregon",
    region: "us-west-2",
    coords: [-119.6313015, 45.8511146],
  },
  {
    region: "us-east-1",
    coords: [-77.15, 38.91],
    name: "Virginia, USA",
    slug: "virginia",
  },
  {
    region: "eu-west-1",
    coords: [-7.9, 52],
    name: "Ireland",
    slug: "ireland",
  },
  {
    region: "sa-east-1",
    coords: [-47.9, -22.6],
    name: "São Paulo",
    slug: "sao-paulo",
  },
  {
    region: "ap-southeast-2",
    coords: [150.8, -33.7],
    name: "Sydney",
    slug: "sydney",
  },
];

const dataHosts = hostConfigs.map((config) => {
  const host = new DataHostingStack(app, "SeaSketchData-" + config.slug, {
    env: { account: env.account, region: config.region },
    ...config,
    // allowedCorsDomains,
    // maintenanceRole: maintenance.taskRole,
    lambdaFunctionNameExport: "DataHostDbUpdaterLambda",
    dbRegion: env.region,
    allowedCorsDomains,
  });
  host.addDependency(dataHostDbUpdater);
  return host;
});

new GraphQLStack(app, "SeaSketchGraphQLServer", {
  env,
  db: db.instance,
  securityGroup: db.defaultSecurityGroup,
  uploadsBucket: uploads.bucket,
  uploadsUrl: uploads.url,
  vpc: db.vpc,
  redisHost: redis.cluster.attrRedisEndpointAddress,
  emailSource: SES_EMAIL_SOURCE,
  tilePackagesBucket: tilePackages.bucket,
  clientDomain: SUBDOMAIN + "." + DOMAIN_NAME,
});

new MailerLambdaStack(app, "SeaSketchMailers", {
  env,
  vpc: db.vpc,
  db: db.instance,
  host: `${SUBDOMAIN}.${DOMAIN_NAME}`,
  topic: EMAIL_STATUS_NOTIFICATION_TOPIC,
  emailSource: SES_EMAIL_SOURCE,
});
