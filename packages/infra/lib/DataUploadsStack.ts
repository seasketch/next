/**
 * DataHostingStacks enable direct GeoJSON data hosting from SeaSketch.
 * Stacks are created in different regions to support different geographies
 * with data close to their users.
 */
import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";

export class DataUploadsStack extends cdk.Stack {
  uploadsBucket: s3.Bucket;
  normalizedUploadsBucket: s3.Bucket;
  constructor(
    scope: cdk.Construct,
    id: string,
    props: cdk.StackProps & {
      region: string;
    }
  ) {
    super(scope, id, props);
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
      //  Will lose the ability to debug upload failures after 1 week
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(2),
          expiration: cdk.Duration.days(7),
        },
      ],
    });
    const normalizedDataBucket = new s3.Bucket(this, "DataUploadsNormalized", {
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });
    this.uploadsBucket = uploadsBucket;
    this.normalizedUploadsBucket = normalizedDataBucket;
  }
}
