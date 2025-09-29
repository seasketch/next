import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class SubdivideWorkerLambdaStack extends cdk.Stack {
  fn: lambda.DockerImageFunction;
  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps & {
      productionQueue?: sqs.IQueue;
      devQueues?: sqs.IQueue[];
    }
  ) {
    super(scope, id, props);

    const fn = new lambda.DockerImageFunction(this, "SubdivisionWorker", {
      functionName: "SubdivisionWorker",
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, "../../subdivision-worker"),
        {}
      ),
      timeout: cdk.Duration.minutes(15),
      logGroup: new logs.LogGroup(this, "SubdivisionWorkerLogs", {
        retention: logs.RetentionDays.ONE_MONTH,
      }),
      memorySize: 8192,
      retryAttempts: 0,
      environment: {
        R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || "",
        R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || "",
        R2_ENDPOINT: process.env.R2_ENDPOINT || "",
        R2_BUCKET: "ssn-tiles",
        R2_PUBLIC_BASE_URL: "https://uploads.seasketch.org",
      },
      initialPolicy: [
        new iam.PolicyStatement({
          actions: ["sqs:SendMessage", "sqs:GetQueueAttributes"],
          effect: iam.Effect.ALLOW,
          resources: [
            ...((props.devQueues || []).map((q) => q.queueArn) as string[]),
            ...(props.productionQueue ? [props.productionQueue.queueArn] : []),
          ],
        }),
      ],
    });

    this.fn = fn;
  }
}
