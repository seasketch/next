/**
 * This stack includes several lambdas for sending out project & survey invites,
 * and also monitoring the sns topics that relay information on email delivery
 * status.
 */
import * as cdk from "@aws-cdk/core";
import * as iam from "@aws-cdk/aws-iam";
import * as logs from "@aws-cdk/aws-logs";
import * as lambda from "@aws-cdk/aws-lambda";
import * as path from "path";
import { Vpc } from "@aws-cdk/aws-ec2";
import { DatabaseInstance } from "@aws-cdk/aws-rds";
import { Bucket } from "@aws-cdk/aws-s3";

export class UploadHandlerLambdaStack extends cdk.Stack {
  fn: lambda.DockerImageFunction;
  constructor(
    scope: cdk.Construct,
    id: string,
    props: cdk.StackProps & {
      vpc: Vpc;
      db: DatabaseInstance;
      bucket: Bucket;
      normalizedOutputsBucket: Bucket;
    }
  ) {
    super(scope, id, props);
    if (!process.env.UPLOADS_BASE_URL) {
      throw new Error("UPLOADS_BASE_URL must be set in environment");
    }
    if (!process.env.RESOURCES_REMOTE) {
      throw new Error("RESOURCES_REMOTE must be set in environment");
    }
    if (!process.env.TILES_REMOTE) {
      throw new Error("TILES_REMOTE must be set in environment");
    }
    if (!process.env.TILES_BASE_URL) {
      throw new Error("TILES_BASE_URL must be set in environment");
    }
    if (!process.env.SLACK_CHANNEL || !process.env.SLACK_TOKEN) {
      throw new Error(
        "SLACK_CHANNEL and SLACK_TOKEN must be set in environment"
      );
    }

    const {
      UPLOADS_BASE_URL,
      RESOURCES_REMOTE,
      TILES_REMOTE,
      TILES_BASE_URL,
      DEBUGGING_AWS_ACCESS_KEY_ID,
      DEBUGGING_AWS_SECRET_ACCESS_KEY,
    } = process.env;

    const fn = new lambda.DockerImageFunction(this, "SpatialUploadHandler", {
      functionName: "SpatialUploadsHandler",
      vpc: props.vpc,
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, "../../spatial-uploads-handler"),
        {}
      ),
      timeout: cdk.Duration.minutes(12),
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        PGHOST: props.db.instanceEndpoint.hostname,
        PGPORT: "5432",
        PGDATABASE: "seasketch",
        PGUSER: "admin",
        PGREGION: props.db.env.region,
        BUCKET: props.bucket.bucketName,
        NORMALIZED_OUTPUTS_BUCKET: props.normalizedOutputsBucket.bucketName,
        R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID!,
        R2_ENDPOINT: process.env.R2_ENDPOINT!,
        R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY!,
        SLACK_TOKEN: process.env.SLACK_TOKEN,
        SLACK_CHANNEL: process.env.SLACK_CHANNEL,
        UPLOADS_BASE_URL,
        RESOURCES_REMOTE,
        TILES_REMOTE,
        TILES_BASE_URL,
        DEBUGGING_AWS_ACCESS_KEY_ID: DEBUGGING_AWS_ACCESS_KEY_ID || "",
        DEBUGGING_AWS_SECRET_ACCESS_KEY: DEBUGGING_AWS_SECRET_ACCESS_KEY || "",
        NODE_EXTRA_CA_CERTS: "/var/runtime/ca-cert.pem",
      },
      memorySize: 10240,
      reservedConcurrentExecutions: 100,
      initialPolicy: [
        new iam.PolicyStatement({
          actions: ["rds-db:connect"],
          effect: iam.Effect.ALLOW,
          // TODO: It would be nice to scope this down
          // https://github.com/aws/aws-cdk/issues/11851
          // In practice this shouldn't be a big deal because
          // we won't have RDS instances that shouldn't be
          // accessed in the same VPC
          resources: [`arn:aws:rds-db:*:*:dbuser:*/*`],
        }),
        new iam.PolicyStatement({
          actions: [
            "s3:DeleteObject",
            "s3:DeleteObjectTagging",
            "s3:DeleteObjectVersion",
            "s3:GetObject",
            "s3:GetObjectTagging",
            "s3:PutObject",
            "s3:PutObjectAcl",
            "s3:PutObjectTagging",
          ],
          effect: iam.Effect.ALLOW,
          resources: [`arn:aws:s3:::seasketchdata-*/*`],
        }),
      ],
    });
    props.bucket.grantReadWrite(fn);
    props.normalizedOutputsBucket.grantReadWrite(fn);
    props.bucket.grantPutAcl(fn);
    props.normalizedOutputsBucket.grantPutAcl(fn);
    this.fn = fn;
  }
}
