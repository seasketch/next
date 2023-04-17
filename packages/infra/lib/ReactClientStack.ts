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
import * as route53 from "@aws-cdk/aws-route53";
import * as acm from "@aws-cdk/aws-certificatemanager";
import { ViewerProtocolPolicy } from "@aws-cdk/aws-cloudfront";
import targets = require("@aws-cdk/aws-route53-targets");

export class ReactClientStack extends cdk.Stack {
  bucket: s3.Bucket;
  url: string;
  constructor(
    scope: cdk.Construct,
    id: string,
    props: cdk.StackProps & {
      maintenanceRole: iam.IRole;
      domainName: string;
      siteSubDomain?: string;
      publicUploadsBucket: s3.Bucket;
    }
  ) {
    super(scope, id, props);
    this.bucket = new s3.Bucket(this, "ReactClient", {
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
    });
    this.bucket.grantPublicAccess();
    new cdk.CfnOutput(this, "ReactClientBucket", {
      value: this.bucket.bucketName,
    });

    const zone = route53.HostedZone.fromLookup(this, "Zone", {
      domainName: props.domainName,
    });
    const siteDomain = props.siteSubDomain
      ? [props.siteSubDomain, props.domainName].join(".")
      : props.domainName;
    new cdk.CfnOutput(this, "Site", { value: "https://" + siteDomain });
    // TLS certificate
    const certificate = new acm.DnsValidatedCertificate(
      this,
      "SiteCertificate",
      {
        domainName: siteDomain,
        hostedZone: zone,
        region: "us-east-1", // Cloudfront only checks this region for certificates.
      }
    );

    const distribution = new cloudfront.Distribution(this, "ReactClientCF", {
      defaultBehavior: {
        origin: new origins.S3Origin(this.bucket),
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
      },
      additionalBehaviors: {
        "/sprites/*": {
          origin: new origins.S3Origin(props.publicUploadsBucket),
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          compress: true,
        },
      },
      certificate: certificate,
      domainNames: [siteDomain],
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.hours(1),
        },
      ],
    });
    this.url = distribution.distributionDomainName;
    this.bucket.grantReadWrite(props.maintenanceRole);

    new route53.ARecord(this, "SiteAliasRecord", {
      recordName: siteDomain,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
      zone,
    });

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
