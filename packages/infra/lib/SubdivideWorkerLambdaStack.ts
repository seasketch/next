import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as path from "path";
import { Construct } from "constructs";

export class SubdivideWorkerLambdaStack extends cdk.Stack {
  fn: lambda.DockerImageFunction;
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    const fn = new lambda.DockerImageFunction(this, "SubdivisionWorker", {
      functionName: "SubdivisionWorker",
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, "../../subdivide-worker"),
        {}
      ),
      timeout: cdk.Duration.minutes(15),
      logGroup: new logs.LogGroup(this, "SubdivisionWorkerLogs", {
        retention: logs.RetentionDays.ONE_MONTH,
      }),
      memorySize: 8192,
      environment: {
        R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || "",
        R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || "",
        R2_ENDPOINT: process.env.R2_ENDPOINT || "",
        R2_BUCKET: process.env.R2_BUCKET || "",
        R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL || "",
      },
    });

    this.fn = fn;
  }
}
