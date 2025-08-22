import {
  OverlayEngineWorkerBeginMessage,
  OverlayEngineWorkerErrorMessage,
  OverlayEngineWorkerMessage,
  OverlayEngineWorkerProgressMessage,
  OverlayEngineWorkerResultMessage,
} from "./types";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

export async function sendMessage(
  msg: OverlayEngineWorkerMessage,
  jobKey: string
) {
  const queueUrl = process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL;
  if (!queueUrl) {
    throw new Error("OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL is not set");
  }
  const sqs = new SQSClient({ region: process.env.AWS_REGION });
  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(msg),
  });
  await sqs.send(command);
}

export async function sendResultMessage(jobKey: string, result: any) {
  const msg: OverlayEngineWorkerResultMessage = {
    type: "result",
    result,
    jobKey,
  };
  await sendMessage(msg, jobKey);
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
  await sendMessage(msg, jobKey);
}

export async function sendErrorMessage(jobKey: string, error: string) {
  const msg: OverlayEngineWorkerErrorMessage = {
    type: "error",
    error,
    jobKey,
  };
  await sendMessage(msg, jobKey);
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
  await sendMessage(msg, jobKey);
}
