import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { Pool } from "pg";
import { OverlayEngineWorkerMessage } from "overlay-worker";
import colors from "yoctocolors-cjs";
import { JobStatusUpdater, MessageWithReceipt } from "./JobStatusUpdater";

// Initialize SQS client
const sqsClient = new SQSClient({
  region: process.env.S3_REGION || "us-east-1",
});

let jobStatusUpdater: JobStatusUpdater | null = null;

const DEFAULT_SQS_CONSUMER_COUNT = 4;

function getOverlayEngineSqsConsumerCount(): number {
  const raw = process.env.OVERLAY_ENGINE_WORKER_SQS_CONSUMER_COUNT;
  if (raw === undefined || raw === "") {
    return DEFAULT_SQS_CONSUMER_COUNT;
  }
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    console.warn(
      `OVERLAY_ENGINE_WORKER_SQS_CONSUMER_COUNT="${raw}" is invalid; using ${DEFAULT_SQS_CONSUMER_COUNT}`,
    );
    return DEFAULT_SQS_CONSUMER_COUNT;
  }
  return n;
}

/**
 * Consolidates messages by jobKey to avoid multiple database updates
 * Priority: result/error > begin > progress (highest progress value only)
 */
function consolidateMessagesByJobKey(
  messages: MessageWithReceipt[],
): Map<string, MessageWithReceipt> {
  const consolidated = new Map<string, MessageWithReceipt>();

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
export async function consumeOverlayEngineWorkerMessages(
  pgPool: Pool,
  consumerIndex?: number,
) {
  const queueUrl = process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL;

  if (!queueUrl) {
    console.error(
      "OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL environment variable is not set",
    );
    return;
  }

  const logPrefix =
    consumerIndex !== undefined ? `[sqs ${consumerIndex + 1}] ` : "";

  try {
    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20, // Long polling
    });

    const response = await sqsClient.send(command);

    if (response.Messages && response.Messages.length > 0) {
      let queryCount = 0;
      // Parse all messages first
      const parsedMessages: MessageWithReceipt[] = [];
      const receiptHandlesToDelete: string[] = []; // Store all receipt handles for deletion

      for (const message of response.Messages) {
        if (message.Body) {
          try {
            const parsedMessage: OverlayEngineWorkerMessage & {
              origin?: string;
            } = JSON.parse(message.Body);

            if (parsedMessage.jobKey) {
              parsedMessages.push({
                ...parsedMessage,
                receiptHandle: message.ReceiptHandle,
                origin:
                  (parsedMessage.origin as "overlay" | "subdivision") ||
                  "overlay",
              });
              // Store receipt handle for later deletion
            } else {
              console.error(
                colors.red(
                  "Job key is required for overlay engine worker messages",
                ),
              );
            }
          } catch (parseError) {
            if (message.ReceiptHandle) {
              receiptHandlesToDelete.push(message.ReceiptHandle);
            }
            console.error(
              colors.red("Failed to parse message body:"),
              parseError,
            );
            console.log("Raw message body:", message.Body);
          }
        } else {
          if (message.ReceiptHandle) {
            receiptHandlesToDelete.push(message.ReceiptHandle);
            console.error(
              colors.red("Failed to parse message body:"),
              "No body",
            );
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
                    ? message.type
                    : ""
            } ${message.type === "progress" ? message.message : ""} ${
              message.type === "progress" && message.eta ? message.eta : ""
            }`,
          ),
        );
      }

      // Consolidate messages by jobKey
      const consolidatedMessages = consolidateMessagesByJobKey(
        parsedMessages as any,
      );

      // Process consolidated messages
      for (const [jobKey, consolidatedMessage] of consolidatedMessages) {
        try {
          jobStatusUpdater?.enqueueMessage(consolidatedMessage);
        } catch (processError) {
          console.error(
            `Error processing consolidated message for job ${jobKey}:`,
            processError,
          );
        }
      }

      // Delete all processed messages from the queue
      for (const receiptHandle of receiptHandlesToDelete) {
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
    console.error(
      `${logPrefix}Error consuming messages from SQS queue:`,
      error,
    );
  }
}

async function runOneSqsConsumerLoop(
  pgPool: Pool,
  consumerIndex: number,
  consumerCount: number,
): Promise<never> {
  while (true) {
    try {
      await consumeOverlayEngineWorkerMessages(pgPool, consumerIndex);
    } catch (error) {
      console.error(
        `[sqs ${consumerIndex + 1}/${consumerCount}] Error in continuous polling:`,
        error,
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

/**
 * Starts continuous message consumers that poll the queue in parallel.
 * Each loop performs long-poll ReceiveMessage (max 10 messages); multiple
 * loops multiply theoretical throughput. All share one {@link JobStatusUpdater}.
 */
export function startOverlayEngineWorkerMessageConsumer(pgPool: Pool) {
  const consumerCount = getOverlayEngineSqsConsumerCount();

  console.log(
    `Starting overlay engine worker message consumer (${consumerCount} parallel pollers) on ${process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL}`,
  );

  jobStatusUpdater = new JobStatusUpdater(pgPool, sqsClient);

  for (let i = 0; i < consumerCount; i++) {
    void runOneSqsConsumerLoop(pgPool, i, consumerCount);
  }
}
