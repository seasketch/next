/**
 * DataHostingStacks enable direct GeoJSON data hosting from SeaSketch.
 * Stacks are created in different regions to support different geographies
 * with data close to their users.
 */
import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import * as iam from "@aws-cdk/aws-iam";
import commonAllowedOrigins from "./commonAllowedOrigins";

export class OfflineTilePackageBucketStack extends cdk.Stack {
  bucket: s3.Bucket;
  constructor(
    scope: cdk.Construct,
    id: string,
    props: cdk.StackProps & {
      allowedCorsDomains: string[];
      maintenanceRole: iam.IRole;
    }
  ) {
    super(scope, id, props);
    this.bucket = new s3.Bucket(this, "OfflineTilePackages", {
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: false,
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
    this.bucket.grantReadWrite(props.maintenanceRole);
  }
}
