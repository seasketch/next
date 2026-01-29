import { DeleteMessageBatchCommand, SQSClient } from "@aws-sdk/client-sqs";
import {
  OverlayEngineWorkerBeginMessage,
  OverlayEngineWorkerErrorMessage,
  OverlayEngineWorkerMessage,
  OverlayEngineWorkerProgressMessage,
  OverlayEngineWorkerResultMessage,
} from "overlay-worker";
import { Pool } from "pg";
import { debounce } from "lodash";
import colors from "yoctocolors-cjs";

export type MessageWithReceipt = OverlayEngineWorkerMessage & {
  receiptHandle?: string;
  origin: "overlay" | "subdivision";
};

export type TypedMessageWithReceipt<T extends OverlayEngineWorkerMessage> =
  T & {
    receiptHandle?: string;
    origin: "overlay" | "subdivision";
  };

type JobMessageQueue = {
  progress: TypedMessageWithReceipt<OverlayEngineWorkerProgressMessage>[];
  result?: TypedMessageWithReceipt<OverlayEngineWorkerResultMessage>;
  error?: TypedMessageWithReceipt<OverlayEngineWorkerErrorMessage>;
  begin?: TypedMessageWithReceipt<OverlayEngineWorkerBeginMessage>;
};

export class JobStatusUpdater {
  private pgPool: Pool;
  private sqsClient: SQSClient;
  private messageQueue: {
    [jobKey: string]: JobMessageQueue;
  } = {};
  private receiptHandlesToAcknowledge: string[] = [];

  constructor(pgPool: Pool, sqsClient: SQSClient) {
    this.pgPool = pgPool;
    this.sqsClient = sqsClient;
    if (!process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL) {
      throw new Error("OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL is not set");
    }

    setInterval(() => {
      if (Object.keys(this.messageQueue).length > 0) {
        console.log("outstanding job keys:", Object.keys(this.messageQueue));
        console.log("message queue:", this.messageQueue);
        this.debouncedUpdateJobs();
      }
    }, 5000);
  }

  enqueueMessage(message: MessageWithReceipt) {
    const errors = this.validateMessage(message);
    if (errors.length > 0) {
      console.error(`Invalid message: ${errors.join(", ")}`);
      this.queueMessageForAcknowledgement(message);
    } else {
      if (!this.messageQueue[message.jobKey]) {
        this.messageQueue[message.jobKey] = {
          progress: [],
        };
      }
      if (message.type === "progress") {
        this.messageQueue[message.jobKey].progress.push(message);
      } else if (message.type === "result") {
        this.messageQueue[message.jobKey].result = message;
      } else if (message.type === "error") {
        this.messageQueue[message.jobKey].error = message;
      } else if (message.type === "begin") {
        this.messageQueue[message.jobKey].begin = message;
      }
      if (message.type === "progress" || message.type === "begin") {
        this.queueMessageForAcknowledgement(message);
      }
      this.debouncedUpdateJobs();
    }
  }

  private queueMessageForAcknowledgement(message: MessageWithReceipt) {
    if (message.receiptHandle) {
      this.receiptHandlesToAcknowledge.push(message.receiptHandle);
    }
    this.debouncedAcknowledgeMessages();
  }

  private async ackReceiptHandles() {
    const batchSize = 10;
    while (this.receiptHandlesToAcknowledge.length > 0) {
      const batch = this.receiptHandlesToAcknowledge.slice(0, batchSize);
      await this.sqsClient.send(
        new DeleteMessageBatchCommand({
          QueueUrl: process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL,
          Entries: batch.map((receiptHandle, index) => ({
            // Id must be <= 80 chars and match [A-Za-z0-9_-]
            Id: `ack_${index}`,
            ReceiptHandle: receiptHandle,
          })),
        })
      );
      this.receiptHandlesToAcknowledge.splice(0, batch.length);
    }
  }

  private debouncedAcknowledgeMessages = debounce(
    async () => {
      await this.ackReceiptHandles();
    },
    10,
    {
      maxWait: 300,
    }
  );

  validateMessage(message: MessageWithReceipt) {
    const errors: string[] = [];
    if (!message.jobKey) {
      errors.push("Job key is required");
    }
    if (!message.type) {
      errors.push("Type is required");
    }
    if (!message.origin) {
      errors.push("Origin is required");
    }
    if (!["progress", "result", "error", "begin"].includes(message.type)) {
      errors.push("Type is invalid");
    }
    if (message.type === "progress" && !message.progress) {
      errors.push("Progress is required");
    }
    if (message.type === "result" && !message.result) {
      errors.push("Result is required");
    }
    if (message.type === "error" && !message.error) {
      errors.push("Error is required");
    }
    return errors;
  }

  private async processMessages() {
    const start = Date.now();
    await this.processResultsMessages();
    await this.processErrorMessages();
    await this.processBeginMessages();
    await this.processProgressMessages();
    console.log(
      colors.bgGreen(`processMessages duration: ${Date.now() - start}ms`)
    );
  }

  private async processResultsMessages() {
    try {
      const results: TypedMessageWithReceipt<OverlayEngineWorkerResultMessage>[] =
        [];
      for (const jobKey in this.messageQueue) {
        if (this.messageQueue[jobKey].result) {
          results.push(this.messageQueue[jobKey].result);
        }
      }
      const overlayResults = results.filter(
        (message) => message.origin === "overlay"
      );
      const subdivisionResults = results.filter(
        (message) => message.origin === "subdivision"
      );
      if (overlayResults.length > 0) {
        const values: Array<string | number | null | object> = [];
        const placeholders = overlayResults
          .map((message, index) => {
            const base = index * 3;
            values.push(
              JSON.stringify(message.result),
              message.jobKey,
              message.duration ?? null
            );
            return `($${base + 1}, $${base + 2}, $${base + 3})`;
          })
          .join(", ");
        await this.pgPool.query(
          `update spatial_metrics as sm set value = v.result::jsonb, state = 'complete', updated_at = now(), completed_at = now(), duration = coalesce(v.duration::double precision * interval '1 millisecond', now() - sm.started_at), progress_percentage = 100, error_message = null from (values ${placeholders}) as v(result, job_key, duration) where sm.job_key = v.job_key`,
          values
        );
      }
      if (subdivisionResults.length > 0) {
        for (const message of subdivisionResults) {
          const result = message.result as {
            object: {
              publicUrl?: string;
              key?: string;
              bucket?: string;
              size?: number;
              filename?: string;
              epsg?: number;
            };
          };
          const jobQ = await this.pgPool.query(
            `select data_source_id, project_id from source_processing_jobs where job_key = $1`,
            [message.jobKey]
          );
          if (
            !result.object.publicUrl ||
            !result.object.key ||
            !result.object.bucket
          ) {
            await this.pgPool.query(
              `update source_processing_jobs set state = 'error', error_message = 'Invalid result. Missing publicUrl, key, or bucket from result.object.', updated_at = now(), duration = now() - started_at where job_key = $1`,
              [message.jobKey]
            );
            console.error(
              new Error(`Invalid result: ${JSON.stringify(message.result)}`)
            );
            delete this.messageQueue[message.jobKey];
            this.queueMessageForAcknowledgement(message);
            continue;
          }
          if (jobQ.rows.length > 0) {
            const { data_source_id, project_id } = jobQ.rows[0];
            const url =
              result.object.publicUrl ||
              `https://uploads.seasketch.org/${result.object.key}`;
            const remote = `r2://${result.object.bucket}/${result.object.key}`;
            const size = result.object.size || 0;
            const filename =
              result.object.filename || result.object.key || "output.fgb";
            const epsg = result.object.epsg || null;
            await this.pgPool.query(
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
                message.jobKey,
                epsg,
                (result.object.key || "").endsWith(".fgb")
                  ? "ReportingFlatgeobufV1"
                  : "ReportingCOG",
              ]
            );
            await this.pgPool.query(
              `update source_processing_jobs set state = 'complete', updated_at = now(), completed_at = now(), duration = now() - started_at, progress_percentage = 100, error_message = null where job_key = $1`,
              [message.jobKey]
            );
          }
        }
      }
      for (const message of results) {
        delete this.messageQueue[message.jobKey];
        this.queueMessageForAcknowledgement(message);
      }
    } catch (error) {
      console.error("Error processing results messages:", error);
    }
  }

  private async processErrorMessages() {
    try {
      const errors: TypedMessageWithReceipt<OverlayEngineWorkerErrorMessage>[] =
        [];
      for (const jobKey in this.messageQueue) {
        if (this.messageQueue[jobKey].error) {
          errors.push(this.messageQueue[jobKey].error);
        }
      }
      const overlayErrors = errors.filter(
        (message) => message.origin === "overlay"
      );
      const subdivisionErrors = errors.filter(
        (message) => message.origin === "subdivision"
      );
      if (overlayErrors.length > 0) {
        const values: Array<string | number | null | object> = [];
        const placeholders = overlayErrors
          .map((message, index) => {
            const base = index * 2;
            values.push(message.error, message.jobKey);
            return `($${base + 1}, $${base + 2})`;
          })
          .join(", ");
        await this.pgPool.query(
          `update spatial_metrics as sm set state = 'error', error_message = v.error, updated_at = now(), duration = now() - sm.started_at from (values ${placeholders}) as v(error, job_key) where sm.job_key = v.job_key and state != 'complete'`,
          values
        );
      }
      if (subdivisionErrors.length > 0) {
        const values: Array<string | number | null | object> = [];
        const placeholders = subdivisionErrors
          .map((message, index) => {
            const base = index * 2;
            values.push(message.error, message.jobKey);
            return `($${base + 1}, $${base + 2})`;
          })
          .join(", ");
        await this.pgPool.query(
          `update source_processing_jobs as spj set state = 'error', error_message = v.error, updated_at = now(), duration = now() - spj.started_at from (values ${placeholders}) as v(error, job_key) where spj.job_key = v.job_key`,
          values
        );
      }
      for (const message of errors) {
        delete this.messageQueue[message.jobKey].error;
        if (this.jobMessageQueueIsEmpty(this.messageQueue[message.jobKey])) {
          delete this.messageQueue[message.jobKey];
        }
        this.queueMessageForAcknowledgement(message);
      }
    } catch (error) {
      console.error("Error processing error messages:", error);
    }
  }

  private async processBeginMessages() {
    try {
      const begins: TypedMessageWithReceipt<OverlayEngineWorkerBeginMessage>[] =
        [];
      for (const jobKey in this.messageQueue) {
        if (this.messageQueue[jobKey].begin) {
          begins.push(this.messageQueue[jobKey].begin);
        }
      }
      const overlayBeginMessages = begins.filter(
        (message) => message.origin === "overlay"
      );
      const subdivisionBeginMessages = begins.filter(
        (message) => message.origin === "subdivision"
      );
      if (overlayBeginMessages.length > 0) {
        const values: Array<string | number | null | object> = [];
        const placeholders = overlayBeginMessages
          .map((message, index) => {
            const base = index * 1;
            values.push(message.jobKey);
            return `($${base + 1})`;
          })
          .join(", ");
        await this.pgPool.query(
          `update spatial_metrics as sm set state = 'processing', updated_at = now(), started_at = now() from (values ${placeholders}) as v(job_key) where sm.job_key = v.job_key and state != 'complete' and state != 'error'`,
          values
        );
      }
      if (subdivisionBeginMessages.length > 0) {
        const values: Array<string | number | null | object> = [];
        const placeholders = subdivisionBeginMessages
          .map((message, index) => {
            const base = index * 1;
            values.push(message.jobKey);
            return `($${base + 1})`;
          })
          .join(", ");
        await this.pgPool.query(
          `update source_processing_jobs as spj set state = 'processing', updated_at = now(), started_at = now() from (values ${placeholders}) as v(job_key) where spj.job_key = v.job_key and spj.state != 'complete' and spj.state != 'error'`,
          values
        );
      }
      for (const message of begins) {
        const data = this.messageQueue[message.jobKey];
        delete data.begin;
        if (this.jobMessageQueueIsEmpty(data)) {
          delete this.messageQueue[message.jobKey];
        }
        this.queueMessageForAcknowledgement(message);
      }
    } catch (error) {
      console.error("Error processing begin messages:", error);
    }
  }

  private async processProgressMessages() {
    const progressMessages: (OverlayEngineWorkerProgressMessage & {
      origin: "overlay" | "subdivision";
    })[] = [];
    try {
      for (const jobKey in this.messageQueue) {
        const jobMessages = this.messageQueue[jobKey];
        if (jobMessages.progress.length > 0) {
          // get the progress message with the highest progress value
          const progressMessage = jobMessages.progress.reduce(
            (max, message) => {
              return message.progress > max.progress ? message : max;
            },
            jobMessages.progress[0]
          );
          progressMessages.push(progressMessage);
          this.messageQueue[jobKey].progress = [];
        }
      }
      const overlayProgressMessages = progressMessages.filter(
        (message) => message.origin === "overlay"
      );
      const subdivisionProgressMessages = progressMessages.filter(
        (message) => message.origin === "subdivision"
      );

      if (overlayProgressMessages.length > 0) {
        const values: Array<string | number | null | object> = [];
        const placeholders = overlayProgressMessages
          .map((message, index) => {
            const base = index * 3;
            values.push(message.progress, message.jobKey, message.eta ?? null);
            return `($${base + 1}, $${base + 2}, $${base + 3})`;
          })
          .join(", ");
        await this.pgPool.query(
          `update spatial_metrics as sm set state = 'processing', updated_at = now(), progress_percentage = greatest(progress_percentage::double precision, v.progress::double precision), eta = v.eta::timestamptz from (values ${placeholders}) as v(progress, job_key, eta) where sm.job_key = v.job_key and state != 'complete' and state != 'error'`,
          values
        );
      }
      if (subdivisionProgressMessages.length > 0) {
        const values: Array<string | number | null | object> = [];
        const placeholders = subdivisionProgressMessages
          .map((message, index) => {
            const base = index * 3;
            values.push(message.progress, message.jobKey, message.eta ?? null);
            return `($${base + 1}, $${base + 2}, $${base + 3})`;
          })
          .join(", ");
        await this.pgPool.query(
          `update source_processing_jobs as spj set state = 'processing', updated_at = now(), progress_percentage = greatest(spj.progress_percentage::double precision, v.progress::double precision), eta = v.eta::timestamptz from (values ${placeholders}) as v(progress, job_key, eta) where spj.job_key = v.job_key and spj.state != 'complete' and spj.state != 'error'`,
          values
        );
      }
      for (const message of progressMessages) {
        if (this.jobMessageQueueIsEmpty(this.messageQueue[message.jobKey])) {
          delete this.messageQueue[message.jobKey];
        }
      }
    } catch (error) {
      console.error("Error processing progress messages:", error);
    }
  }

  private jobMessageQueueIsEmpty(data: JobMessageQueue) {
    return (
      data.progress.length === 0 &&
      data.result === undefined &&
      data.error === undefined &&
      data.begin === undefined
    );
  }

  debouncedUpdateJobs = debounce(this.processMessages, 100, {
    maxWait: 1000,
  });
}
