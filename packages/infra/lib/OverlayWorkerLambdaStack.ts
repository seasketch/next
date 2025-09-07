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
      devQueue: sqs.IQueue;
      productionQueue: sqs.IQueue;
    }
  ) {
    super(scope, id, props);

    this.fn = new NodejsFunction(this, "OverlayWorker", {
      functionName: "OverlayWorker",
      bundling: {
        minify: false,
        target: "es2020",
        sourceMap: true,
        keepNames: true,
      },
      entry: path.join(__dirname, "../../overlay-worker/src/index.ts"),
      handler: "lambdaHandler",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(15),
      logGroup: new logs.LogGroup(this, "OverlayWorkerLogs", {
        retention: logs.RetentionDays.ONE_MONTH,
      }),
      retryAttempts: 0,
      memorySize: 4096,
      reservedConcurrentExecutions: 100,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL: props.productionQueue.queueUrl,
      },
      initialPolicy: [
        new iam.PolicyStatement({
          actions: ["sqs:SendMessage", "sqs:GetQueueAttributes"],
          effect: iam.Effect.ALLOW,
          resources: [props.devQueue.queueArn, props.productionQueue.queueArn],
        }),
      ],
    });
  }
}
