import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { Pool } from "pg";
import { OverlayEngineWorkerMessage } from "overlay-worker";

// Initialize SQS client
const sqsClient = new SQSClient({
  region: process.env.S3_REGION || "us-east-1",
});

/**
 * Consumes messages from the overlay engine worker SQS queue
 * Parses and logs the message content, then deletes processed messages
 */
export async function consumeOverlayEngineWorkerMessages(pgPool: Pool) {
  const queueUrl = process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL;

  if (!queueUrl) {
    console.error(
      "OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL environment variable is not set"
    );
    return;
  }

  try {
    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20, // Long polling
    });

    const response = await sqsClient.send(command);

    if (response.Messages && response.Messages.length > 0) {
      for (const message of response.Messages) {
        if (message.Body) {
          try {
            const parsedMessage: OverlayEngineWorkerMessage = JSON.parse(
              message.Body
            );

            if (parsedMessage.jobKey) {
              // Process the message based on its type
              switch (parsedMessage.type) {
                case "result":
                  console.log(
                    `Job ${parsedMessage.jobKey} completed with result:`,
                    parsedMessage.result
                  );
                  await pgPool.query(
                    `update spatial_metrics set value = $1, state = 'complete', updated_at = now(), progress_percentage = 100, error_message = null where job_key = $2`,
                    [parsedMessage.result, parsedMessage.jobKey]
                  );
                  break;
                case "error":
                  console.log(
                    `Job ${parsedMessage.jobKey} failed with error:`,
                    parsedMessage.error
                  );
                  await pgPool.query(
                    `update spatial_metrics set state = 'error', error_message = $1, updated_at = now() where job_key = $2 and state = 'processing'`,
                    [parsedMessage.error, parsedMessage.jobKey]
                  );
                  break;
                case "progress":
                  console.log(
                    `Job ${parsedMessage.jobKey} progress: ${
                      parsedMessage.progress
                    }% - ${parsedMessage.message || ""}`
                  );
                  await pgPool.query(
                    `update spatial_metrics set state = 'processing', updated_at = now(), progress_percentage = $1 where job_key = $2 and progress_percentage < $1 and state != 'complete' and state != 'error'`,
                    [Math.round(parsedMessage.progress), parsedMessage.jobKey]
                  );
                  break;
                case "begin":
                  console.log(
                    `Job ${parsedMessage.jobKey} started. Logs: ${
                      parsedMessage.logfileUrl || "none"
                    }`
                  );
                  await pgPool.query(
                    `update spatial_metrics set state = 'processing', updated_at = now(), progress_percentage = max(progress_percentage, 0) where job_key = $1 and state = 'queued'`,
                    [parsedMessage.jobKey]
                  );
                  if (parsedMessage.logfileUrl) {
                    await pgPool.query(
                      `update spatial_metrics set logs_url = $1, logs_expires_at = $2 where job_key = $3`,
                      [
                        parsedMessage.logfileUrl,
                        parsedMessage.logsExpiresAt,
                        parsedMessage.jobKey,
                      ]
                    );
                  }
                  break;
                default:
                  console.log(
                    `Unknown message type for job ${
                      (parsedMessage as any).jobKey
                    }:`,
                    parsedMessage
                  );
                  // Delete unrecognized message types to prevent infinite retries
                  break;
              }
            } else {
              console.error(
                "Job key is required for overlay engine worker messages"
              );
            }
          } catch (parseError) {
            console.error("Failed to parse message body:", parseError);
            console.log("Raw message body:", message.Body);
          } finally {
            // Delete the message from the queue after processing
            if (message.ReceiptHandle) {
              const deleteCommand = new DeleteMessageCommand({
                QueueUrl: queueUrl,
                ReceiptHandle: message.ReceiptHandle,
              });
              await sqsClient.send(deleteCommand);
            }
          }
        }
      }
    } else {
      // console.log("No messages received from queue");
    }
  } catch (error) {
    console.error("Error consuming messages from SQS queue:", error);
  }
}

/**
 * Starts a continuous message consumer that polls the queue
 */
export async function startOverlayEngineWorkerMessageConsumer(pgPool: Pool) {
  console.log("Starting overlay engine worker message consumer...");

  // Start continuous polling
  while (true) {
    try {
      await consumeOverlayEngineWorkerMessages(pgPool);
    } catch (error) {
      console.error("Error in continuous polling:", error);
      // Wait a bit longer on error before retrying
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}
