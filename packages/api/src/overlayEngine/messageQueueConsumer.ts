import { ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { Pool } from "pg";
import { OverlayEngineWorkerMessage } from "overlay-worker";
import colors from "yoctocolors-cjs";
import { JobStatusUpdater, MessageWithReceipt } from "./JobStatusUpdater";
import { createSqsClient } from "./sqsClient";

const sqsClient = createSqsClient();

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
 * Parses and logs the message content, then deletes processed messages.
 * A failed receive is thrown to the caller, so the polling loop can back
 * off instead of retrying at once.
 */
export async function consumeOverlayEngineWorkerMessages(
  pgPool: Pool,
  consumerIndex?: number,
): Promise<boolean> {
  const queueUrl = process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL;

  if (!queueUrl) {
    console.error(
      "OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL environment variable is not set",
    );
    return false;
  }

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
  return true;
}

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
// How often a poller that keeps failing repeats its error.
const FAILURE_LOG_INTERVAL_MS = 30_000;

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    // The SDK's connection errors often carry an empty message.
    const text = error.message || error.name;
    return code && code !== text ? `${text} (${code})` : text;
  }
  return String(error);
}

/**
 * One long-polling loop. A failed receive (the queue is unreachable, as it is
 * for a few seconds while the local ElasticMQ container starts) waits with
 * exponential backoff before the next attempt, and repeats its error at most
 * every FAILURE_LOG_INTERVAL_MS, so an outage produces a few lines rather
 * than a flood from every poller.
 */
async function runOneSqsConsumerLoop(
  pgPool: Pool,
  consumerIndex: number,
  consumerCount: number,
): Promise<never> {
  const prefix = `[sqs ${consumerIndex + 1}/${consumerCount}]`;
  let backoff = INITIAL_BACKOFF_MS;
  let failures = 0;
  let lastLoggedAt = 0;
  while (true) {
    try {
      await consumeOverlayEngineWorkerMessages(pgPool, consumerIndex);
      if (failures > 0) {
        console.log(
          `${prefix} queue reachable again after ${failures} failed attempt${
            failures === 1 ? "" : "s"
          }`,
        );
      }
      backoff = INITIAL_BACKOFF_MS;
      failures = 0;
    } catch (error) {
      failures++;
      const now = Date.now();
      if (failures === 1 || now - lastLoggedAt >= FAILURE_LOG_INTERVAL_MS) {
        lastLoggedAt = now;
        console.error(
          `${prefix} cannot receive from ${process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL}: ${describeError(
            error,
          )}. Retrying in ${backoff / 1000}s${
            failures > 1 ? ` (${failures} failures so far)` : ""
          }.`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, backoff));
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
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
