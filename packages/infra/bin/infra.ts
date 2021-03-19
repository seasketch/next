#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { ClientStack } from "../lib/ClientStack";
import { DatabaseStack } from "../lib/DatabaseStack";
import { DataHostingStack } from "../lib/DataHostingStack";
import { VpnStack } from "../VpnStack";
import { MaintenanceStack } from "../MaintenanceStack";
import { CustomResource, CustomResourceProvider } from "@aws-cdk/core";

const env = { account: "196230260133", region: "us-west-2" };

const app = new cdk.App();
const db = new DatabaseStack(app, "SeaSketchProductionDBStack", { env });
new MaintenanceStack(app, "SeaSketchMaintenanceStack", {
  env,
  vpc: db.vpc,
  db: db.instance,
});
// For now, use the crappy Copilot configration via `copilot svc exec`

// Setup regional hosts for user-uploaded GeoJSON. These have some extra outputs
// which will need to go into the data_sources_buckets postgres table
const dataHosts = [
  new DataHostingStack(app, "SeaSketchDataOregon", {
    env: { ...env, region: "us-west-2" },
    coords: [-119.6313015, 45.8511146],
    name: "Oregon, USA",
  }),

  new DataHostingStack(app, "SeaSketchDataVirginia", {
    env: { ...env, region: "us-east-1" },
    coords: [-77.15, 38.91],
    name: "Virginia, USA",
  }),

  new DataHostingStack(app, "SeaSketchDataIreland", {
    env: { ...env, region: "eu-west-1" },
    coords: [-7.9, 52],
    name: "Ireland",
  }),

  new DataHostingStack(app, "SeaSketchDataSaoPaulo", {
    env: { ...env, region: "sa-east-1" },
    coords: [-47.9, -22.6],
    name: "São Paulo",
  }),

  new DataHostingStack(app, "SeaSketchDataSydney", {
    env: { ...env, region: "ap-southeast-2" },
    coords: [150.8, -33.7],
    name: "Sydney",
  }),
];

new ClientStack(app, "SeaSketchProductionClientStack", { env });
