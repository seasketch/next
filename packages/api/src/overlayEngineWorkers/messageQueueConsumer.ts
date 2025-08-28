import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { Pool } from "pg";
import { OverlayEngineWorkerMessage } from "overlay-worker";
import colors from "yoctocolors-cjs";

// Initialize SQS client
const sqsClient = new SQSClient({
  region: process.env.S3_REGION || "us-east-1",
});

/**
 * Consolidates messages by jobKey to avoid multiple database updates
 * Priority: result/error > begin > progress (highest progress value only)
 */
function consolidateMessagesByJobKey(
  messages: OverlayEngineWorkerMessage[]
): Map<string, OverlayEngineWorkerMessage> {
  const consolidated = new Map<string, OverlayEngineWorkerMessage>();

  for (const message of messages) {
    const existing = consolidated.get(message.jobKey);

    if (!existing) {
      // First message for this job
      consolidated.set(message.jobKey, message);
      continue;
    }

    // Determine priority and consolidate
    if (message.type === "result" || message.type === "error") {
      // Result/error messages always take priority
      consolidated.set(message.jobKey, message);
    } else if (message.type === "begin" && existing.type === "progress") {
      // Begin messages take priority over progress
      consolidated.set(message.jobKey, message);
    } else if (message.type === "progress" && existing.type === "progress") {
      // For progress messages, keep the highest progress value
      if (message.progress > existing.progress) {
        consolidated.set(message.jobKey, message);
      }
    }
    // If existing is result/error/begin, don't replace with progress
  }

  return consolidated;
}

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
      // Parse all messages first
      const parsedMessages: OverlayEngineWorkerMessage[] = [];
      const allReceiptHandles: string[] = []; // Store all receipt handles for deletion

      for (const message of response.Messages) {
        if (message.Body) {
          try {
            if (message.ReceiptHandle) {
              allReceiptHandles.push(message.ReceiptHandle);
            }
            const parsedMessage: OverlayEngineWorkerMessage = JSON.parse(
              message.Body
            );

            if (parsedMessage.jobKey) {
              parsedMessages.push(parsedMessage);
              // Store receipt handle for later deletion
            } else {
              console.error(
                colors.red(
                  "Job key is required for overlay engine worker messages"
                )
              );
            }
          } catch (parseError) {
            console.error(
              colors.red("Failed to parse message body:"),
              parseError
            );
            console.log("Raw message body:", message.Body);
          }
        }
      }

      parsedMessages.sort((a, b) => a.jobKey.localeCompare(b.jobKey));
      for (const message of parsedMessages) {
        const color =
          message.type === "begin"
            ? colors.green
            : message.type === "error"
            ? colors.red
            : message.type === "progress"
            ? colors.blue
            : colors.yellow;
        console.log(
          color(
            `[${message.jobKey}] ${message.type} ${
              message.type === "progress"
                ? message.progress
                : message.type === "error"
                ? message.error
                : message.type === "result"
                ? message.result
                : ""
            }`
          )
        );
      }

      // Consolidate messages by jobKey
      const consolidatedMessages = consolidateMessagesByJobKey(parsedMessages);

      // Process consolidated messages
      for (const [jobKey, consolidatedMessage] of consolidatedMessages) {
        try {
          // Process the consolidated message based on its type
          switch (consolidatedMessage.type) {
            case "result":
              await pgPool.query(
                `update spatial_metrics set value = $1, state = 'complete', updated_at = now(), progress_percentage = 100, error_message = null where job_key = $2`,
                [consolidatedMessage.result, jobKey]
              );
              break;
            case "error":
              await pgPool.query(
                `update spatial_metrics set state = 'error', error_message = $1, updated_at = now() where job_key = $2 and state = 'processing'`,
                [consolidatedMessage.error, jobKey]
              );
              break;
            case "progress":
              await pgPool.query(
                `update spatial_metrics set state = 'processing', updated_at = now(), progress_percentage = $1 where job_key = $2 and state != 'complete' and state != 'error' and progress_percentage < $1`,
                [Math.round(consolidatedMessage.progress), jobKey]
              );
              break;
            case "begin":
              await pgPool.query(
                `update spatial_metrics set state = 'processing', updated_at = now() where job_key = $1 and state = 'queued'`,
                [jobKey]
              );
              if (consolidatedMessage.logfileUrl) {
                await pgPool.query(
                  `update spatial_metrics set logs_url = $1, logs_expires_at = $2 where job_key = $3`,
                  [
                    consolidatedMessage.logfileUrl,
                    consolidatedMessage.logsExpiresAt,
                    jobKey,
                  ]
                );
              }
              break;
            default:
              console.log(
                `Unknown message type for job ${jobKey}:`,
                consolidatedMessage
              );
              break;
          }
        } catch (processError) {
          console.error(
            `Error processing consolidated message for job ${jobKey}:`,
            processError
          );
        }
      }

      // Delete all processed messages from the queue
      for (const receiptHandle of allReceiptHandles) {
        try {
          const deleteCommand = new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: receiptHandle,
          });
          await sqsClient.send(deleteCommand);
        } catch (deleteError) {
          console.error("Failed to delete message:", deleteError);
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
