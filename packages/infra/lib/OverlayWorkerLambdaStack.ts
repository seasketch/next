/**
 * This stack deploys the overlay-worker lambda function for processing
 * overlay calculations asynchronously.
 */
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as path from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

export class OverlayWorkerLambdaStack extends cdk.Stack {
  public readonly fn: NodejsFunction;

  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps & {
      devQueues?: sqs.IQueue[];
      productionQueue: sqs.IQueue;
    }
  ) {
    super(scope, id, props);

    this.fn = new NodejsFunction(this, "OverlayWorker", {
      functionName: "OverlayWorker",
      projectRoot: path.join(__dirname, "../../overlay-worker"),
      depsLockFilePath: path.join(
        __dirname,
        "../../overlay-worker/package-lock.json"
      ),
      bundling: {
        minify: false,
        target: "node22",
        sourceMap: true,
        keepNames: true,
        platform: "node",
        esbuildVersion: "0.21.5",
        externalModules: ["undici"],
        nodeModules: ["undici", "@aws-sdk/client-sqs"],
        commandHooks: {
          beforeBundling() {
            return [];
          },
          beforeInstall() {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string) {
            // Copy the prebuilt self-contained worker from overlay-engine package
            const standaloneSrc = path.join(
              __dirname,
              "../../overlay-engine/dist/workers/clipBatch.standalone.js"
            );
            return [`cp ${standaloneSrc} ${outputDir}/worker.js`];
          },
        },
      },
      entry: path.join(__dirname, "../../overlay-worker/src/index.ts"),
      handler: "lambdaHandler",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(15),
      logGroup: new logs.LogGroup(this, "OverlayWorkerLogs", {
        retention: logs.RetentionDays.ONE_MONTH,
      }),
      retryAttempts: 0,
      memorySize: 10240, // 10GB
      reservedConcurrentExecutions: 100,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL: props.productionQueue.queueUrl,
        // Absolute path at runtime inside Lambda for the Piscina worker
        PISCINA_WORKER_PATH: "/var/task/worker.js",
      },
      initialPolicy: [
        new iam.PolicyStatement({
          actions: ["sqs:SendMessage", "sqs:GetQueueAttributes"],
          effect: iam.Effect.ALLOW,
          resources: [
            ...(props.devQueues || []).map((q) => q.queueArn),
            props.productionQueue.queueArn,
          ],
        }),
      ],
    });
  }
}
