/**
 * This stack deploys the fragment-worker lambda function for creating sketch
 * fragments via clipToGeographies. Invoked synchronously (RequestResponse)
 * from the API server.
 */
import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as path from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { NODEJS_24_X } from "./nodeRuntime";

export class FragmentWorkerLambdaStack extends cdk.Stack {
  public readonly fn: NodejsFunction;

  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps & {
      overlayEngineAccessTokenSecret: secretsmanager.ISecret;
    },
  ) {
    super(scope, id, props);

    this.fn = new NodejsFunction(this, "FragmentWorker", {
      functionName: "FragmentWorker",
      projectRoot: path.join(__dirname, "../../fragment-worker"),
      // Pruned lockfile: CDK runs npm ci against a synthetic package.json of
      // nodeModules, which a workspace lockfile does not satisfy.
      depsLockFilePath: path.join(
        __dirname,
        "../../fragment-worker/bundle-package-lock.json",
      ),
      bundling: {
        minify: false,
        target: "node24",
        sourceMap: true,
        keepNames: true,
        platform: "node",
        esbuildVersion: "0.25.11",
        externalModules: ["undici"],
        nodeModules: ["undici", "@aws-sdk/client-secrets-manager"],
      },
      entry: path.join(__dirname, "../../fragment-worker/src/index.ts"),
      handler: "lambdaHandler",
      runtime: NODEJS_24_X,
      timeout: cdk.Duration.minutes(2),
      logGroup: new logs.LogGroup(this, "FragmentWorkerLogs", {
        retention: logs.RetentionDays.ONE_DAY,
      }),
      retryAttempts: 0,
      memorySize: 10240,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN:
          props.overlayEngineAccessTokenSecret.secretArn,
      },
    });

    props.overlayEngineAccessTokenSecret.grantRead(this.fn);
    cdk.Tags.of(this.fn).add("Cost Center", "fragment-worker");
  }
}
