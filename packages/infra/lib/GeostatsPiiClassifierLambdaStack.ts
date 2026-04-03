/**
 * Deploys the geostats-pii-risk-classifier Lambda — a Python container that
 * classifies pruned GeostatsLayer objects for PII risk (using Presidio and
 * spaCy) and redacts high-risk string columns before they are sent to OpenAI.
 *
 * Invoked synchronously (RequestResponse) by the SpatialUploadsHandler Lambda
 * when GEOSTATS_PII_CLASSIFIER_ARN is present in its environment.
 */
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as path from "path";
import { Construct } from "constructs";

export class GeostatsPiiClassifierLambdaStack extends cdk.Stack {
  public readonly fn: lambda.DockerImageFunction;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    this.fn = new lambda.DockerImageFunction(this, "GeostatsPiiClassifier", {
      functionName: "GeostatsPiiClassifier",
      architecture: lambda.Architecture.X86_64,
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, "../../geostats-pii-risk-classifier"),
      ),
      // 90 s is ample for a warm invocation; cold start including spaCy/Presidio
      // model load should settle well under this.  Increase if needed.
      timeout: cdk.Duration.seconds(90),
      logGroup: new logs.LogGroup(this, "GeostatsPiiClassifierLogs", {
        retention: logs.RetentionDays.ONE_MONTH,
      }),
      memorySize: 4096,
      retryAttempts: 0,
    });
  }
}
