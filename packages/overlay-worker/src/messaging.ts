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
  const queueUrl = msg.queueUrl;
  if (!queueUrl) {
    throw new Error("Payload is missing queueUrl");
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

export async function sendResultMessage(
  jobKey: string,
  result: any,
  queueUrl: string
) {
  const msg: OverlayEngineWorkerResultMessage = {
    type: "result",
    result,
    jobKey,
    queueUrl,
  };
  await sendMessage(msg);
}

export async function sendProgressMessage(
  jobKey: string,
  progress: number,
  queueUrl: string,
  message?: string
) {
  const msg: OverlayEngineWorkerProgressMessage = {
    type: "progress",
    progress,
    message,
    jobKey,
    queueUrl,
  };
  return sendMessage(msg);
}

export async function sendErrorMessage(
  jobKey: string,
  error: string,
  queueUrl: string
) {
  const msg: OverlayEngineWorkerErrorMessage = {
    type: "error",
    error,
    jobKey,
    queueUrl,
  };
  await sendMessage(msg);
}

export async function sendBeginMessage(
  jobKey: string,
  logfileUrl: string,
  logsExpiresAt: string,
  queueUrl: string
) {
  const msg: OverlayEngineWorkerBeginMessage = {
    type: "begin",
    logfileUrl,
    logsExpiresAt,
    jobKey,
    queueUrl,
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
