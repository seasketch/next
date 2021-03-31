import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import * as ecsPatterns from "@aws-cdk/aws-ecs-patterns";
import * as ecs from "@aws-cdk/aws-ecs";
import * as iam from "@aws-cdk/aws-iam";
import { DatabaseInstance } from "@aws-cdk/aws-rds";
import { ISecurityGroup, IVpc, Protocol } from "@aws-cdk/aws-ec2";
import { Bucket } from "@aws-cdk/aws-s3";
import { PolicyStatement } from "@aws-cdk/aws-iam";
import { HostedZone } from "@aws-cdk/aws-route53";
import { ApplicationProtocol } from "@aws-cdk/aws-elasticloadbalancingv2";

const JWKS_URI = `https://seasketch.auth0.com/.well-known/jwks.json`;
const JWT_AUD = "https://api.seasketch.org";
const JWT_ISS = "https://seasketch.auth0.com";
const AUTH0_DOMAIN = "seasketch.auth0.com";
const HOST = "https://api.seasket.ch";

export class GraphQLStack extends cdk.Stack {
  constructor(
    scope: cdk.Construct,
    id: string,
    props: cdk.StackProps & {
      db: DatabaseInstance;
      vpc: IVpc;
      securityGroup: ISecurityGroup;
      uploadsBucket: Bucket;
      uploadsUrl: string;
      redisHost: string;
    }
  ) {
    super(scope, id, props);
    const { AUTH0_CLIENT_SECRET, AUTH0_CLIENT_ID } = process.env;
    if (!AUTH0_CLIENT_ID || !AUTH0_CLIENT_SECRET) {
      throw new Error(
        `AUTH0_CLIENT_SECRET, AUTH0_CLIENT_ID environment variables must be set`
      );
    }
    // The code that defines your stack goes here
    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      "GraphQLServer",
      {
        // cluster,
        cpu: 512,
        memoryLimitMiB: 1024,
        taskImageOptions: {
          image: ecs.ContainerImage.fromAsset("./containers/graphql", {
            buildArgs: {
              commit: process.env.COMMIT || "master",
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
            HOST,
            REDIS_HOST: props.redisHost,
          },
          containerPort: 3857,
        },
        desiredCount: 2,
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
    // TODO: adjust log retention
    service.targetGroup.configureHealthCheck({
      path: "/favicon.ico",
      port: "3857",
    });
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
    props.uploadsBucket.grantReadWrite(service.taskDefinition.taskRole);
  }
}
