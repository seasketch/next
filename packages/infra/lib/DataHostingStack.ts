/**
 * DataHostingStacks enable direct GeoJSON data hosting from SeaSketch.
 * Stacks are created in different regions to support different geographies
 * with data close to their users.
 */
import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import * as cloudfront from "@aws-cdk/aws-cloudfront";
import * as iam from "@aws-cdk/aws-iam";
import * as origins from "@aws-cdk/aws-cloudfront-origins";
import { ViewerProtocolPolicy } from "@aws-cdk/aws-cloudfront";
import { CfnOutput, Duration, PhysicalName } from "@aws-cdk/core";
import commonAllowedOrigins from "./commonAllowedOrigins";
import { CustomResource } from "@aws-cdk/core";
import * as logs from "@aws-cdk/aws-logs";
import * as cr from "@aws-cdk/custom-resources";
import * as lambda from "@aws-cdk/aws-lambda";
import * as path from "path";
import { Vpc } from "@aws-cdk/aws-ec2";
import { DatabaseInstance } from "@aws-cdk/aws-rds";
import { HostingStackResourceProperties } from "../lambdas/dataHostDbUpdater/index";
import { PolicyStatement } from "@aws-cdk/aws-iam";

export class DataHostingStack extends cdk.Stack {
  bucket: s3.Bucket;
  constructor(
    scope: cdk.Construct,
    id: string,
    props: cdk.StackProps & {
      /* Long/Lat of the data center (approx) to help admins choose which is closest */
      coords: [number, number];
      /* Name of the data center to use in the admin interface */
      name: string;
      // allowedCorsDomains: string[];
      // maintenanceRole: iam.IRole;
      lambdaFunctionNameExport: string;
      dbRegion: string;
    }
  ) {
    super(scope, id, props);
    const storageBucket = new s3.Bucket(this, "GeoJSONData", {
      publicReadAccess: true,
      // TODO: Change to retain when in production so we don't lose any user data
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      // Versioning will help prevent any data loss due to overwriting
      versioned: true,
      cors: [
        {
          allowedOrigins: [
            // ...commonAllowedOrigins,
            "*",
            // ...props.allowedCorsDomains,
          ],
          allowedMethods: ["HEAD", "GET"],
          allowedHeaders: ["*"],
          id: "localhost",
          maxAge: 31536000,
        } as s3.CorsRule,
      ],
    });
    const role = new iam.Role(this, "GeoJSONUploader", {
      assumedBy: new iam.AccountPrincipal(this.account),
    });

    storageBucket.grantReadWrite(role);

    const distribution = new cloudfront.Distribution(this, "GeoJSONCDN", {
      defaultBehavior: {
        origin: new origins.S3Origin(storageBucket),
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
      },
    });
    // TODO: WAF settings to rate limit requests, protecting unlisted datasets
    this.bucket = storageBucket;
    // this.bucket.grantReadWrite(props.maintenanceRole);

    /**
     * After creating the stack it will need to be added to a table in the
     * database as one of the options users can choose for hosting their data.
     * This lambda will run after creation to do that.
     */
    const onEvent = new lambda.Function(this, "DataHostingStackEventHandler", {
      // Don't forget to compile the typescript code for this lambda manually
      // if it is ever changed
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../lambdas/dataHostingStackHook")
      ),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_14_X,
      // should be more than ample
      timeout: cdk.Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_DAY,
      environment: {
        LAMBDA_FUNCTION_EXPORT_NAME: props.lambdaFunctionNameExport,
        LAMBDA_REGION: props.dbRegion,
      },
      initialPolicy: [
        new PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["lambda:InvokeFunction"],
          resources: [
            `arn:aws:lambda:${props.dbRegion}:${
              props.env?.account || "*"
            }:function:*`,
          ],
        }),
        new PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["cloudformation:ListExports"],
          resources: [`*`],
        }),
      ],
    });

    const myProvider = new cr.Provider(
      this,
      "DataHostingStackEventHandlerProvider",
      {
        onEventHandler: onEvent,
        logRetention: logs.RetentionDays.ONE_MONTH,
      }
    );

    const custom = new CustomResource(this, "InitDataHostingStack", {
      serviceToken: myProvider.serviceToken,
      properties: {
        // lambda need to know how to access the db
        region: props.env!.region,
        coords: props.coords,
        name: props.name,
        domain: distribution.distributionDomainName,
      } as HostingStackResourceProperties,
    });
  }
}
