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
import commonAllowedOrigins from "./commonAllowedOrigins";

export class PublicUploadsStack extends cdk.Stack {
  bucket: s3.Bucket;
  url: string;
  constructor(
    scope: cdk.Construct,
    id: string,
    props: cdk.StackProps & {
      allowedCorsDomains: string[];
      maintenanceRole: iam.IRole;
    }
  ) {
    super(scope, id, props);
    this.bucket = new s3.Bucket(this, "PublicUploads", {
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      // Versioning will help prevent any data loss due to overwriting
      versioned: true,
      cors: [
        {
          allowedOrigins: [
            ...commonAllowedOrigins,
            ...props.allowedCorsDomains,
          ],
          allowedMethods: ["HEAD", "GET"],
          allowedHeaders: ["*"],
          id: "localhost",
          maxAge: 31536000,
        } as s3.CorsRule,
      ],
    });
    this.bucket.grantPublicAccess();
    this.bucket.grantReadWrite(props.maintenanceRole);

    const distribution = new cloudfront.Distribution(this, "PublicUploadsCF", {
      defaultBehavior: {
        origin: new origins.S3Origin(this.bucket),
        // TODO: FUCK YOU FUCK YOU FUCK YOU!!!
        cachePolicy: cloudfront.CachePolicy.fromCachePolicyId(
          this,
          "caching-w-cors",
          "32ee4e23-6a0b-41f2-99dd-b170f3d0569c"
        ),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });
    this.url = distribution.distributionDomainName;
  }
}
