/**
 * DataHostingStacks enable direct GeoJSON data hosting from SeaSketch.
 * Stacks are created in different regions to support different geographies
 * with data close to their users.
 */
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as path from "path";
import { ViewerProtocolPolicy } from "aws-cdk-lib/aws-cloudfront";
import { Construct } from "constructs";

export class ReactClientStack extends cdk.Stack {
  bucket: s3.Bucket;
  url: string;
  constructor(
    scope: Construct,
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
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
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
    const certificate = new acm.Certificate(this, "SiteCertificate", {
      domainName: siteDomain,
      validation: acm.CertificateValidation.fromDns(zone),
    });

    const distribution = new cloudfront.Distribution(this, "ReactClientCF", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withBucketDefaults(this.bucket),
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
      },
      additionalBehaviors: {
        "/sprites/*": {
          origin: origins.S3BucketOrigin.withBucketDefaults(
            props.publicUploadsBucket
          ),
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
        new route53Targets.CloudFrontTarget(distribution)
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
