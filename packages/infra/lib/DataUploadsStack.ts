/**
 * DataHostingStacks enable direct GeoJSON data hosting from SeaSketch.
 * Stacks are created in different regions to support different geographies
 * with data close to their users.
 */
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class DataUploadsStack extends cdk.Stack {
  uploadsBucket: s3.Bucket;
  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps & {
      region: string;
    }
  ) {
    super(scope, id, props);
    // Staging uploads now go to the R2 bucket ssn-spatial-uploads-tmp.
    // This S3 bucket stays until its lifecycle rule drains objects uploaded
    // before that cutover. DataUploadsNormalized was unused and is gone;
    // its removal policy was RETAIN, so the empty bucket is left in the
    // account when this stack next deploys.
    const uploadsBucket = new s3.Bucket(this, "DataUploads", {
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedOrigins: ["*"],
          allowedMethods: ["HEAD", "GET", "PUT"],
          allowedHeaders: ["*"],
          maxAge: 31536000,
        } as s3.CorsRule,
      ],
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(2),
          expiration: cdk.Duration.days(7),
        },
      ],
    });
    this.uploadsBucket = uploadsBucket;
  }
}
