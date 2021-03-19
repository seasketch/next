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
import { Duration } from "@aws-cdk/core";

export class DataHostingStack extends cdk.Stack {
  privilegedRole: iam.Role;
  bucket: s3.Bucket;
  constructor(
    scope: cdk.Construct,
    id: string,
    props: cdk.StackProps & {
      /* Long/Lat of the data center (approx) to help admins choose which is closest */
      coords: [number, number];
      /* Name of the data center to use in the admin interface */
      name: string;
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
          allowedOrigins: ["*"],
          allowedMethods: ["HEAD", "GET"],
          allowedHeaders: ["*"],
          id: "my-cors-rule-1",
          maxAge: 3600,
        } as s3.CorsRule,
      ],
    });
    const role = new iam.Role(this, "GeoJSONUploader", {
      assumedBy: new iam.AccountPrincipal(this.account),
    });

    storageBucket.grantReadWrite(role);
    this.privilegedRole = role;
    new cdk.CfnOutput(this, "bucket", { value: storageBucket.bucketName });

    const distribution = new cloudfront.Distribution(this, "GeoJSONCDN", {
      defaultBehavior: {
        origin: new origins.S3Origin(storageBucket),
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
      },
    });
    new cdk.CfnOutput(this, "url", {
      value: distribution.distributionDomainName,
    });
    new cdk.CfnOutput(this, "location", {
      value: JSON.stringify(props.coords),
    });
    new cdk.CfnOutput(this, "region", {
      value: this.region,
    });
    new cdk.CfnOutput(this, "name", {
      value: props.name,
    });
    // TODO: WAF settings to rate limit requests, protecting unlisted datasets
    this.bucket = storageBucket;
  }
}
