/**
 * This stack defines the lambda which processes overlay data table uploads.
 */
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import * as path from "path";
import { Construct } from "constructs";

export class DataTablesHandlerLambdaStack extends cdk.Stack {
  fn: lambda.DockerImageFunction;
  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps & {
      vpc: ec2.Vpc;
      db: rds.DatabaseInstance;
      bucket: s3.Bucket;
    },
  ) {
    super(scope, id, props);
    if (!process.env.TILES_REMOTE) {
      throw new Error("TILES_REMOTE must be set in environment");
    }

    const fn = new lambda.DockerImageFunction(this, "DataTablesHandler", {
      functionName: "DataTablesHandler",
      vpc: props.vpc,
      architecture: lambda.Architecture.X86_64,
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, "../.."),
        {
          file: "data-tables-handler/Dockerfile",
          platform: Platform.LINUX_AMD64,
        },
      ),
      timeout: cdk.Duration.minutes(15),
      logGroup: new logs.LogGroup(this, "DataTablesHandlerLogs", {
        retention: logs.RetentionDays.ONE_MONTH,
      }),
      memorySize: 2048,
      environment: {
        NODE_ENV: "production",
        BUCKET: props.bucket.bucketName,
        TILES_REMOTE: process.env.TILES_REMOTE,
        R2_ENDPOINT: process.env.R2_ENDPOINT!,
        R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID!,
        R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY!,
        R2_TILES_BUCKET: process.env.R2_TILES_BUCKET!,
        PGHOST: props.db.instanceEndpoint.hostname,
        PGUSER: "graphile",
        PGREGION: props.db.env.region,
        PGPORT: "5432",
        PGDATABASE: "seasketch",
      },
    });

    props.bucket.grantRead(fn);
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["rds-db:connect"],
        resources: [
          `arn:aws:rds-db:${props.db.env.region}:${props.db.env.account}:dbuser:${props.db.instanceResourceId}/graphile`,
        ],
      }),
    );

    this.fn = fn;
  }
}
