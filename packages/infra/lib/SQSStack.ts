import * as cdk from "aws-cdk-lib";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

export interface SQSStackProps {
  env: cdk.Environment;
}

export class SQSStack extends cdk.Stack {
  public readonly devOverlayEngineWorkerQueues: sqs.Queue[];
  public readonly productionOverlayEngineWorkerQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: SQSStackProps) {
    super(scope, id, props);

    // Dev queues for testing
    this.devOverlayEngineWorkerQueues = Array.from({ length: 5 }).map(
      (_, idx) =>
        new sqs.Queue(this, `DevOverlayEngineWorkerQueue${idx + 1}` as const, {
          queueName: `seasketch-dev-overlay-engine-worker-queue-${idx + 1}`,
          maxMessageSizeBytes: 256 * 1024, // 256KB
          retentionPeriod: cdk.Duration.minutes(2),
        })
    );

    // Production queue
    this.productionOverlayEngineWorkerQueue = new sqs.Queue(
      this,
      "ProductionOverlayEngineWorkerQueue",
      {
        queueName: "seasketch-production-overlay-engine-worker-queue",
        maxMessageSizeBytes: 256 * 1024, // 256KB
        retentionPeriod: cdk.Duration.minutes(2),
      }
    );

    // Output the dev queue URLs and ARNs for reference
    this.devOverlayEngineWorkerQueues.forEach((q, i) => {
      new cdk.CfnOutput(this, `DevOverlayEngineWorkerQueueUrl${i + 1}`, {
        value: q.queueUrl,
        description: `Dev Overlay Engine Worker Queue ${i + 1} URL`,
      });
      new cdk.CfnOutput(this, `DevOverlayEngineWorkerQueueArn${i + 1}`, {
        value: q.queueArn,
        description: `Dev Overlay Engine Worker Queue ${i + 1} ARN`,
      });
    });

    new cdk.CfnOutput(this, "ProductionOverlayEngineWorkerQueueUrl", {
      value: this.productionOverlayEngineWorkerQueue.queueUrl,
      description: "Production Overlay Engine Worker Queue URL",
    });

    new cdk.CfnOutput(this, "ProductionOverlayEngineWorkerQueueArn", {
      value: this.productionOverlayEngineWorkerQueue.queueArn,
      description: "Production Overlay Engine Worker Queue ARN",
    });
  }
}
