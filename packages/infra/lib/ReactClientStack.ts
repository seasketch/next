/**
 * DataHostingStacks enable direct GeoJSON data hosting from SeaSketch.
 * Stacks are created in different regions to support different geographies
 * with data close to their users.
 */
import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import * as cloudfront from "@aws-cdk/aws-cloudfront";
import * as origins from "@aws-cdk/aws-cloudfront-origins";
import * as iam from "@aws-cdk/aws-iam";
import { ViewerProtocolPolicy } from "@aws-cdk/aws-cloudfront";

export class ReactClientStack extends cdk.Stack {
  bucket: s3.Bucket;
  url: string;
  constructor(
    scope: cdk.Construct,
    id: string,
    props: cdk.StackProps & { maintenanceRole: iam.IRole }
  ) {
    super(scope, id, props);
    this.bucket = new s3.Bucket(this, "ReactClient", {
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      websiteIndexDocument: "index.html",
    });
    this.bucket.grantPublicAccess();

    const distribution = new cloudfront.Distribution(this, "ReactClientCF", {
      defaultBehavior: {
        origin: new origins.S3Origin(this.bucket),
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });
    this.url = distribution.distributionDomainName;
    this.bucket.grantReadWrite(props.maintenanceRole);

    // new BucketDeployment(this, 'BucketDeployment', {
    //   sources: [Source.asset('./website', { exclude: ['index.html'] })],
    //   destinationBucket: this.bucket,
    //   cacheControl: [CacheControl.fromString('max-age=31536000,public,immutable')],
    //   prune: false,
    // });

    // new BucketDeployment(this, 'HTMLBucketDeployment', {
    //   sources: [Source.asset('../client/build', { exclude: ['*', '!index.html'] })],
    //   destinationBucket: this.bucket,
    //   cacheControl: [CacheControl.fromString('max-age=0,no-cache,no-store,must-revalidate')],
    //   prune: false,
    // });
  }
}
