import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as iam from "aws-cdk-lib/aws-iam";
import * as rds from "aws-cdk-lib/aws-rds";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { ApplicationProtocol } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { AwsLogDriver } from "aws-cdk-lib/aws-ecs";
import { Construct } from "constructs";

const JWKS_URI = `https://seasketch.auth0.com/.well-known/jwks.json`;
const JWT_AUD = "https://api.seasketch.org";
const JWT_ISS = "https://seasketch.auth0.com/";
const AUTH0_DOMAIN = "seasketch.auth0.com";
const HOST = "https://api.seasket.ch";

export class GraphQLStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps & {
      db: rds.DatabaseInstance;
      vpc: ec2.IVpc;
      securityGroup: ec2.ISecurityGroup;
      uploadsBucket: Bucket;
      tilePackagesBucket: Bucket;
      uploadsUrl: string;
      redisHost: string;
      emailSource: string;
      clientDomain: string;
      spatialUploadsBucket: Bucket;
      normalizedOutputsBucket: Bucket;
      spatialUploadsHandlerArn: string;
      overlayWorkerArn: string;
      uploadHandler: lambda.DockerImageFunction;
      subdivisionWorkerLambdaArn: string;
      overlayEngineWorkerSqsQueueUrl: string;
    }
  ) {
    super(scope, id, props);
    const {
      AUTH0_CLIENT_SECRET,
      AUTH0_CLIENT_ID,
      UNSPLASH_KEY,
      SENTRY_DSN,
      MAPBOX_ACCESS_TOKEN,
      SCREENSHOTTER_FUNCTION_ARN,
    } = process.env;
    if (!AUTH0_CLIENT_ID || !AUTH0_CLIENT_SECRET) {
      throw new Error(
        `AUTH0_CLIENT_SECRET, AUTH0_CLIENT_ID environment variables must be set`
      );
    }
    if (!UNSPLASH_KEY) {
      throw new Error(`UNSPLASH_KEY environment variable must be set`);
    }
    if (!SENTRY_DSN) {
      throw new Error(`SENTRY_DSN environment variable must be set`);
    }
    if (!MAPBOX_ACCESS_TOKEN) {
      throw new Error(`MAPBOX_ACCESS_TOKEN environment variable must be set`);
    }
    if (!process.env.COMMIT) {
      throw new Error(
        "You must specify a COMMIT env var so that the graphql container can be built with the appropriate version of the source code."
      );
    }
    if (!SCREENSHOTTER_FUNCTION_ARN) {
      throw new Error("You must specify a SCREENSHOTTER_FUNCTION_ARN env var.");
    }
    if (
      !process.env.R2_ENDPOINT ||
      !process.env.R2_SECRET_ACCESS_KEY ||
      !process.env.R2_ACCESS_KEY_ID ||
      !process.env.R2_FILE_UPLOADS_BUCKET ||
      !process.env.R2_TILES_BUCKET
    ) {
      throw new Error(
        `R2_ENDPOINT, R2_SECRET_ACCESS_KEY, R2_FILE_UPLOADS_BUCKET, R2_SECRET_ACCESS_KEY, R2_ACCESS_KEY_ID and R2_TILES_BUCKET must be set in environment`
      );
    }

    if (
      !process.env.CLOUDFLARE_IMAGES_TOKEN ||
      !process.env.CLOUDFLARE_IMAGES_ACCOUNT ||
      !process.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH
    ) {
      throw new Error(
        `CLOUDFLARE_IMAGES_TOKEN & CLOUDFLARE_IMAGES_ACCOUNT must be set in environment`
      );
    }
    if (!process.env.CLOUDFLARE_ACCOUNT_TAG) {
      throw new Error(`CLOUDFLARE_ACCOUNT_TAG must be set in environment`);
    }
    if (!process.env.CLOUDFLARE_GRAPHQL_TOKEN) {
      throw new Error(`CLOUDFLARE_GRAPHQL_TOKEN must be set in environment`);
    }
    if (!process.env.CLOUDFLARE_SITE_TAG) {
      throw new Error(`CLOUDFLARE_SITE_TAG must be set in environment`);
    }
    if (!process.env.PMTILES_SERVER_ZONE) {
      throw new Error(`PMTILES_SERVER_ZONE must be set in environment`);
    }
    if (!process.env.GOOGLE_MAPS_2D_TILE_API_KEY) {
      throw new Error(`GOOGLE_MAPS_2D_TILE_API_KEY must be set in environment`);
    }
    // The code that defines your stack goes here
    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      "GraphQLServer",
      {
        // cluster,
        cpu: 1024,
        memoryLimitMiB: 1024 * 4,
        taskImageOptions: {
          logDriver: new AwsLogDriver({
            streamPrefix: "SeaSketchGraphQLServer",
            logRetention: 30,
          }),
          image: ecs.ContainerImage.fromAsset("./containers/graphql", {
            buildArgs: {
              commit: process.env.COMMIT,
              tags: "graphql",
            },
          }),
          environment: {
            NODE_ENV: "production",
            PGHOST: props.db.instanceEndpoint.hostname,
            PGUSER: "graphile",
            PGREGION: props.db.env.region,
            PGPORT: "5432",
            PGDATABASE: "seasketch",
            JWKS_URI,
            JWT_AUD,
            JWT_ISS,
            AUTH0_CLIENT_ID,
            AUTH0_CLIENT_SECRET,
            AUTH0_DOMAIN,
            PUBLIC_S3_BUCKET: props.uploadsBucket.bucketName,
            PUBLIC_UPLOADS_DOMAIN: props.uploadsUrl,
            S3_REGION: props.uploadsBucket.env.region,
            TILE_PACKAGES_BUCKET: props.tilePackagesBucket.bucketName,
            REDIS_HOST: props.redisHost,
            SES_EMAIL_SOURCE: props.emailSource,
            GRAPHILE_WORKER_CONCURRENCY: "20",
            BUILD: process.env.BUILD || "dev",
            UNSPLASH_KEY,
            SENTRY_DSN,
            MAPBOX_ACCESS_TOKEN,
            CLIENT_DOMAIN: props.clientDomain,
            SPATIAL_UPLOADS_BUCKET: props.spatialUploadsBucket.bucketName,
            SPATIAL_UPLOADS_LAMBDA_ARN: props.spatialUploadsHandlerArn,
            OVERLAY_WORKER_LAMBDA_ARN: props.overlayWorkerArn,
            R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
            R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
            R2_ENDPOINT: process.env.R2_ENDPOINT,
            R2_FILE_UPLOADS_BUCKET: process.env.R2_FILE_UPLOADS_BUCKET,
            R2_TILES_BUCKET: process.env.R2_TILES_BUCKET,
            CLOUDFLARE_IMAGES_TOKEN: process.env.CLOUDFLARE_IMAGES_TOKEN,
            CLOUDFLARE_IMAGES_ACCOUNT: process.env.CLOUDFLARE_IMAGES_ACCOUNT,
            CLOUDFLARE_IMAGES_ACCOUNT_HASH:
              process.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH,
            ISSUER: process.env.ISSUER || HOST,
            API_ROOT: HOST,
            SCREENSHOTTER_FUNCTION_ARN,
            CLOUDFLARE_ACCOUNT_TAG: process.env.CLOUDFLARE_ACCOUNT_TAG,
            CLOUDFLARE_SITE_TAG: process.env.CLOUDFLARE_SITE_TAG,
            CLOUDFLARE_GRAPHQL_TOKEN: process.env.CLOUDFLARE_GRAPHQL_TOKEN,
            PMTILES_SERVER_ZONE: process.env.PMTILES_SERVER_ZONE,
            GOOGLE_MAPS_2D_TILE_API_KEY:
              process.env.GOOGLE_MAPS_2D_TILE_API_KEY,
            SUBDIVISION_WORKER_LAMBDA_ARN: props.subdivisionWorkerLambdaArn,
            OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL:
              props.overlayEngineWorkerSqsQueueUrl,
          },
          containerPort: 3857,
        },
        desiredCount: 2,
        minHealthyPercent: 50,
        maxHealthyPercent: 200,
        listenerPort: 443,
        domainName: "api.seasket.ch",
        domainZone: HostedZone.fromLookup(this, "seasket.ch", {
          domainName: "seasket.ch.",
        }),
        protocol: ApplicationProtocol.HTTPS,
        vpc: props.vpc,
        redirectHTTP: true,
      }
    );
    service.targetGroup.configureHealthCheck({
      path: "/favicon.ico",
      port: "3857",
      interval: cdk.Duration.seconds(5),
      healthyHttpCodes: "200",
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
      timeout: cdk.Duration.seconds(4),
    });

    service.targetGroup.setAttribute(
      "deregistration_delay.timeout_seconds",
      "30"
    );

    service.taskDefinition.taskRole.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["rds-db:connect"],
        effect: iam.Effect.ALLOW,
        // TODO: It would be nice to scope this down
        // https://github.com/aws/aws-cdk/issues/11851
        // In practice this shouldn't be a big deal because
        // we won't have RDS instances that shouldn't be
        // accessed in the same VPC
        resources: [`arn:aws:rds-db:*:*:dbuser:*/*`],
      })
    );
    service.taskDefinition.taskRole.addToPrincipalPolicy(
      new PolicyStatement({
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
      })
    );
    service.taskDefinition.taskRole.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["ses:SendEmail"],
        effect: iam.Effect.ALLOW,
        resources: [
          `arn:aws:ses:us-west-2:196230260133:identity/do-not-reply@seasketch.org`,
        ],
      })
    );
    service.taskDefinition.taskRole.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        effect: iam.Effect.ALLOW,
        resources: [SCREENSHOTTER_FUNCTION_ARN],
      })
    );

    service.taskDefinition.taskRole.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        effect: iam.Effect.ALLOW,
        resources: [props.overlayWorkerArn],
      })
    );

    props.uploadsBucket.grantReadWrite(service.taskDefinition.taskRole);
    props.tilePackagesBucket.grantReadWrite(service.taskDefinition.taskRole);
    props.spatialUploadsBucket.grantReadWrite(service.taskDefinition.taskRole);
    props.normalizedOutputsBucket.grantReadWrite(
      service.taskDefinition.taskRole
    );
    props.uploadHandler.grantInvoke(service.taskDefinition.taskRole);
  }
}
