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

/**
 * Consolidates messages by jobKey to avoid multiple database updates
 * Priority: result/error > begin > progress (highest progress value only)
 */
function consolidateMessagesByJobKey(
  messages: MessageWithReceipt[]
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
      let queryCount = 0;
      console.time("processing sqs messages");
      // Parse all messages first
      const parsedMessages: MessageWithReceipt[] = [];
      const allReceiptHandles: string[] = []; // Store all receipt handles for deletion

      for (const message of response.Messages) {
        if (message.Body) {
          try {
            const parsedMessage: OverlayEngineWorkerMessage & {
              origin?: string;
            } = JSON.parse(message.Body);
            if (
              parsedMessage.origin &&
              parsedMessage.origin !== "overlay" &&
              message.ReceiptHandle
            ) {
              allReceiptHandles.push(message.ReceiptHandle);
            }

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
                  "Job key is required for overlay engine worker messages"
                )
              );
            }
          } catch (parseError) {
            if (message.ReceiptHandle) {
              allReceiptHandles.push(message.ReceiptHandle);
            }
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
            } ${message.type === "progress" ? message.message : ""} ${
              message.type === "progress" && message.eta ? message.eta : ""
            }`
          )
        );
      }

      // Consolidate messages by jobKey
      const consolidatedMessages = consolidateMessagesByJobKey(
        parsedMessages as any
      );

      // Process consolidated messages
      for (const [jobKey, consolidatedMessage] of consolidatedMessages) {
        try {
          // Route by origin: overlay (default) vs subdivision
          const origin = (consolidatedMessage as any).origin || "overlay";
          if (origin === "subdivision") {
            switch (consolidatedMessage.type) {
              case "begin":
                queryCount++;
                await pgPool.query(
                  `update source_processing_jobs set state = 'processing', updated_at = now(), started_at = now() where job_key = $1 and (state = 'queued' or state = 'processing')`,
                  [jobKey]
                );
                break;
              case "progress":
                queryCount++;
                await pgPool.query(
                  `update source_processing_jobs set state = 'processing', updated_at = now(), progress_percentage = greatest(progress_percentage, $1), progress_message = $3, eta = $4 where job_key = $2 and state != 'complete' and state != 'error'`,
                  [
                    Math.round(consolidatedMessage.progress || 0),
                    jobKey,
                    consolidatedMessage.message || null,
                    consolidatedMessage.eta || null,
                  ]
                );
                break;
              case "error":
                queryCount++;
                await pgPool.query(
                  `update source_processing_jobs set state = 'error', error_message = $1, updated_at = now(), duration = now() - started_at where job_key = $2 and (state = 'processing' or state = 'queued')`,
                  [consolidatedMessage.error, jobKey]
                );
                break;
              case "result": {
                // Expect { object: { publicUrl?, bucket, key, size, filename } }
                const res = consolidatedMessage.result || {};
                queryCount++;
                const obj = res.object || {};
                // Fetch job so we know data_source_id and project_id
                const jobQ = await pgPool.query(
                  `select data_source_id, project_id from source_processing_jobs where job_key = $1`,
                  [jobKey]
                );
                if (jobQ.rows.length > 0) {
                  const { data_source_id, project_id } = jobQ.rows[0];
                  const url =
                    obj.publicUrl || `https://uploads.seasketch.org/${obj.key}`;
                  const remote = `r2://${obj.bucket}/${obj.key}`;
                  const size = obj.size || 0;
                  const filename = obj.filename || obj.key || "output.fgb";
                  const epsg = obj.epsg || null;
                  queryCount++;
                  await pgPool.query(
                    `insert into data_upload_outputs (data_source_id, type, remote, size, filename, url, is_original, project_id, original_filename, source_processing_job_key, epsg)
                     values ($1, $9, $2, $3, $4, $5, false, $6, $4, $7, $8)
                    `,
                    [
                      data_source_id,
                      remote,
                      size,
                      filename,
                      url,
                      project_id,
                      jobKey,
                      epsg,
                      (obj.key as string).endsWith(".fgb")
                        ? "ReportingFlatgeobufV1"
                        : "ReportingCOG",
                    ]
                  );
                  queryCount++;
                  await pgPool.query(
                    `update source_processing_jobs set state = 'complete', updated_at = now(), completed_at = now(), duration = now() - started_at, progress_percentage = 100, error_message = null where job_key = $1`,
                    [jobKey]
                  );
                }
                break;
              }
              default:
                break;
            }
          } else {
            if (!jobStatusUpdater) {
              throw new Error("JobStatusUpdater is not initialized");
            }
            jobStatusUpdater.enqueueMessage(consolidatedMessage);
            // switch (consolidatedMessage.type) {
            //   case "result":
            //     queryCount++;
            //     await pgPool.query(
            //       `update spatial_metrics set value = $1, state = 'complete', updated_at = now(), completed_at = now(), duration = coalesce($3, now() - started_at), progress_percentage = 100, error_message = null where job_key = $2`,
            //       [
            //         consolidatedMessage.result,
            //         jobKey,
            //         consolidatedMessage.duration
            //           ? `${consolidatedMessage.duration}ms`
            //           : null,
            //       ]
            //     );
            //     break;
            //   case "error":
            //     queryCount++;
            //     await pgPool.query(
            //       `update spatial_metrics set state = 'error', error_message = $1, updated_at = now(), duration = now() - started_at where job_key = $2 and (state = 'processing' or state = 'queued')`,
            //       [consolidatedMessage.error, jobKey]
            //     );
            //     break;
            //   case "progress":
            //     queryCount++;
            //     await pgPool.query(
            //       `update spatial_metrics set state = 'processing', updated_at = now(), progress_percentage = greatest(progress_percentage, $1), eta = $3 where job_key = $2 and state != 'complete' and state != 'error'`,
            //       [
            //         Math.round(consolidatedMessage.progress),
            //         jobKey,
            //         consolidatedMessage.eta,
            //       ]
            //     );
            //     break;
            //   case "begin":
            //     queryCount++;
            //     await pgPool.query(
            //       `update spatial_metrics set state = 'processing', updated_at = now(), started_at = now() where job_key = $1 and (state = 'queued' or state = 'processing')`,
            //       [jobKey]
            //     );
            //     if (consolidatedMessage.logfileUrl) {
            //       queryCount++;
            //       await pgPool.query(
            //         `update spatial_metrics set logs_url = $1, logs_expires_at = $2 where job_key = $3`,
            //         [
            //           consolidatedMessage.logfileUrl,
            //           consolidatedMessage.logsExpiresAt,
            //           jobKey,
            //         ]
            //       );
            //     }
            //     break;
            //   default:
            //     console.log(
            //       `Unknown message type for job ${jobKey}:`,
            //       consolidatedMessage
            //     );
            //     break;
            // }
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
        console.log("deleting receipt handle:", receiptHandle);
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
      console.timeEnd("processing sqs messages");
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
  console.log(
    `Starting overlay engine worker message consumer on ${process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL}`
  );

  jobStatusUpdater = new JobStatusUpdater(pgPool, sqsClient);
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
