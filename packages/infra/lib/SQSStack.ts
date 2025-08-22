import * as cdk from "@aws-cdk/core";
import * as sqs from "@aws-cdk/aws-sqs";

export interface SQSStackProps {
  env: cdk.Environment;
}

export class SQSStack extends cdk.Stack {
  public readonly devOverlayEngineWorkerQueue: sqs.Queue;
  public readonly productionOverlayEngineWorkerQueue: sqs.Queue;

  constructor(scope: cdk.Construct, id: string, props: SQSStackProps) {
    super(scope, id, props);

    // Dev queue for testing
    this.devOverlayEngineWorkerQueue = new sqs.Queue(
      this,
      "DevOverlayEngineWorkerQueue",
      {
        queueName: "seasketch-dev-overlay-engine-worker-queue",
        maxMessageSizeBytes: 256 * 1024, // 256KB
      }
    );

    // Production queue
    this.productionOverlayEngineWorkerQueue = new sqs.Queue(
      this,
      "ProductionOverlayEngineWorkerQueue",
      {
        queueName: "seasketch-production-overlay-engine-worker-queue",
        maxMessageSizeBytes: 256 * 1024, // 256KB
      }
    );

    // Output the queue URLs and ARNs for reference
    new cdk.CfnOutput(this, "DevOverlayEngineWorkerQueueUrl", {
      value: this.devOverlayEngineWorkerQueue.queueUrl,
      description: "Dev Overlay Engine Worker Queue URL",
    });

    new cdk.CfnOutput(this, "ProductionOverlayEngineWorkerQueueUrl", {
      value: this.productionOverlayEngineWorkerQueue.queueUrl,
      description: "Production Overlay Engine Worker Queue URL",
    });

    new cdk.CfnOutput(this, "DevOverlayEngineWorkerQueueArn", {
      value: this.devOverlayEngineWorkerQueue.queueArn,
      description: "Dev Overlay Engine Worker Queue ARN",
    });

    new cdk.CfnOutput(this, "ProductionOverlayEngineWorkerQueueArn", {
      value: this.productionOverlayEngineWorkerQueue.queueArn,
      description: "Production Overlay Engine Worker Queue ARN",
    });
  }
}
