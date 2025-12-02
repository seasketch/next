#!/usr/bin/env node
import "source-map-support/register";
require("dotenv").config();
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
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
import { DataUploadsStack } from "../lib/DataUploadsStack";
import { UploadHandlerLambdaStack } from "../lib/UploadHandlerLambdaStack";
import { SQSStack } from "../lib/SQSStack";
import { OverlayWorkerLambdaStack } from "../lib/OverlayWorkerLambdaStack";
import { SubdivideWorkerLambdaStack } from "../lib/SubdivideWorkerLambdaStack";
let env = require("./env.production");

const DOMAIN_NAME = "seasketch.org";
const SUBDOMAIN: string | undefined = "www";
const HOST = SUBDOMAIN ? [SUBDOMAIN, DOMAIN_NAME].join(".") : DOMAIN_NAME;

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

const allowedCorsDomains = [
  // Hardcoded now to account for multiple historical domains
  `https://next.seasket.ch`,
  "http://localhost:3000",
  "https://seasketch.org",
  "https://www.seasketch.org",
  "https://staging.seasket.ch",
  "https://*.seasketch-next-client.pages.dev",
  "https://seasketch-next-client.pages.dev",
  "https://app.seasketch.org",
  "https://*.seasketch.org",
];

const uploads = new PublicUploadsStack(app, "SeaSketchPublicUploads", {
  env,
  maintenanceRole: maintenance.taskRole,
  allowedCorsDomains,
});

// React client hosting has been migrated to Cloudflare
// const client = new ReactClientStack(app, "SeaSketchReactClient", {
//   env,
//   maintenanceRole: maintenance.taskRole,
//   domainName: DOMAIN_NAME,
//   siteSubDomain: SUBDOMAIN,
//   publicUploadsBucket: uploads.bucket,
// });

const tilePackages = new OfflineTilePackageBucketStack(
  app,
  "SeaSketchOfflineTilePackagesBucket",
  {
    env,
    maintenanceRole: maintenance.taskRole,
    allowedCorsDomains,
  }
);

const dataUploads = new DataUploadsStack(app, "SeaSketchDataUploadsStack", {
  env,
  region: "us-west-2",
});

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

const uploadHandler = new UploadHandlerLambdaStack(
  app,
  "SpatialUploadHandler",
  {
    env,
    vpc: db.vpc,
    db: db.instance,
    bucket: dataUploads.uploadsBucket,
    normalizedOutputsBucket: dataUploads.normalizedUploadsBucket,
  }
);

const sqs = new SQSStack(app, "SeaSketchSQS", {
  env,
});

const overlayWorker = new OverlayWorkerLambdaStack(
  app,
  "SeaSketchOverlayWorker",
  {
    env,
    devQueues: sqs.devOverlayEngineWorkerQueues,
    productionQueue: sqs.productionOverlayEngineWorkerQueue,
  }
);

const subdivideWorker = new SubdivideWorkerLambdaStack(
  app,
  "SeaSketchSubdivisionWorker",
  {
    env,
    devQueues: sqs.devOverlayEngineWorkerQueues,
    productionQueue: sqs.productionOverlayEngineWorkerQueue,
  }
);

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
  clientDomain: HOST,
  spatialUploadsBucket: dataUploads.uploadsBucket,
  spatialUploadsHandlerArn: uploadHandler.fn.functionArn,
  overlayWorkerArn: overlayWorker.fn.functionArn,
  normalizedOutputsBucket: dataUploads.normalizedUploadsBucket,
  uploadHandler: uploadHandler.fn,
  subdivisionWorkerLambdaArn: subdivideWorker.fn.functionArn,
  overlayEngineWorkerSqsQueue: sqs.productionOverlayEngineWorkerQueue,
});

uploadHandler.fn.grantInvoke;

// TODO: Fix to use ISSUER var?
new MailerLambdaStack(app, "SeaSketchMailers", {
  env,
  vpc: db.vpc,
  db: db.instance,
  host: HOST,
  topic: EMAIL_STATUS_NOTIFICATION_TOPIC,
  emailSource: SES_EMAIL_SOURCE,
});
