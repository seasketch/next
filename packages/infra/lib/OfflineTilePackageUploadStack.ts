/**
 * DataHostingStacks enable direct GeoJSON data hosting from SeaSketch.
 * Stacks are created in different regions to support different geographies
 * with data close to their users.
 */
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import commonAllowedOrigins from "./commonAllowedOrigins";
import { Construct } from "constructs";

export class OfflineTilePackageBucketStack extends cdk.Stack {
  bucket: s3.Bucket;
  constructor(
    scope: Construct,
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
