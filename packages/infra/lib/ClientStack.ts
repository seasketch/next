/**
 * The ClientStack is responsible for setting up a bucket and cloudfront distribution
 * for the react browser client.
 */
import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";

export class ClientStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // The code that defines your stack goes here
    const clientBucket = new s3.Bucket(this, "ReactClient", {
      publicReadAccess: true,
      websiteIndexDocument: "index.html",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
  }
}
