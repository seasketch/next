import {
  OverlayEngineWorkerBeginMessage,
  OverlayEngineWorkerErrorMessage,
  OverlayEngineWorkerMessage,
  OverlayEngineWorkerProgressMessage,
  OverlayEngineWorkerResultMessage,
} from "./types";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({ region: process.env.AWS_REGION });

// Tracks in-flight SQS send operations so they can be flushed later
const pendingSendOperations = new Set<Promise<unknown>>();

export function sendMessage(msg: OverlayEngineWorkerMessage) {
  const queueUrl = process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL;
  if (!queueUrl) {
    throw new Error("OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL is not set");
  }
  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(msg),
  });
  const sendPromise = sqs.send(command);
  pendingSendOperations.add(sendPromise);
  sendPromise.finally(() => pendingSendOperations.delete(sendPromise));
  return sendPromise;
}

export async function sendResultMessage(jobKey: string, result: any) {
  const msg: OverlayEngineWorkerResultMessage = {
    type: "result",
    result,
    jobKey,
  };
  await sendMessage(msg);
}

export async function sendProgressMessage(
  jobKey: string,
  progress: number,
  message?: string
) {
  const msg: OverlayEngineWorkerProgressMessage = {
    type: "progress",
    progress,
    message,
    jobKey,
  };
  return sendMessage(msg);
}

export async function sendErrorMessage(jobKey: string, error: string) {
  const msg: OverlayEngineWorkerErrorMessage = {
    type: "error",
    error,
    jobKey,
  };
  await sendMessage(msg);
}

export async function sendBeginMessage(
  jobKey: string,
  logfileUrl: string,
  logsExpiresAt: string
) {
  const msg: OverlayEngineWorkerBeginMessage = {
    type: "begin",
    logfileUrl,
    logsExpiresAt,
    jobKey,
  };
  await sendMessage(msg);
}

/**
 * Tracks unresolved calls to sendMessage and awaits their completion. Usefull
 * to call after completing a job.
 *
 */
export async function flushMessages() {
  while (pendingSendOperations.size > 0) {
    await Promise.allSettled(Array.from(pendingSendOperations));
  }
}
