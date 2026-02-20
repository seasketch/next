/**
 * This stack deploys the fragment-worker lambda function for creating sketch
 * fragments via clipToGeographies. Invoked synchronously (RequestResponse)
 * from the API server.
 */
import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

export class FragmentWorkerLambdaStack extends cdk.Stack {
  public readonly fn: NodejsFunction;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    this.fn = new NodejsFunction(this, "FragmentWorker", {
      functionName: "FragmentWorker",
      projectRoot: path.join(__dirname, "../../fragment-worker"),
      depsLockFilePath: path.join(
        __dirname,
        "../../fragment-worker/package-lock.json",
      ),
      bundling: {
        minify: false,
        target: "node22",
        sourceMap: true,
        keepNames: true,
        platform: "node",
        esbuildVersion: "0.21.5",
        externalModules: ["undici"],
        nodeModules: ["undici"],
      },
      entry: path.join(__dirname, "../../fragment-worker/src/index.ts"),
      handler: "lambdaHandler",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(2),
      logGroup: new logs.LogGroup(this, "FragmentWorkerLogs", {
        retention: logs.RetentionDays.ONE_DAY,
      }),
      retryAttempts: 0,
      memorySize: 10240,
      architecture: lambda.Architecture.ARM_64,
    });
  }
}
