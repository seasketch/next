"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessage = sendMessage;
exports.sendResultMessage = sendResultMessage;
exports.sendProgressMessage = sendProgressMessage;
exports.sendErrorMessage = sendErrorMessage;
exports.sendBeginMessage = sendBeginMessage;
exports.flushMessages = flushMessages;
const client_sqs_1 = require("@aws-sdk/client-sqs");
const sqs = new client_sqs_1.SQSClient({ region: process.env.AWS_REGION });
// Tracks in-flight SQS send operations so they can be flushed later
const pendingSendOperations = new Set();
function sendMessage(msg) {
    const queueUrl = process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL;
    if (!queueUrl) {
        throw new Error("OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL is not set");
    }
    const command = new client_sqs_1.SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(msg),
    });
    const sendPromise = sqs.send(command);
    pendingSendOperations.add(sendPromise);
    sendPromise.finally(() => pendingSendOperations.delete(sendPromise));
    return sendPromise;
}
async function sendResultMessage(jobKey, result) {
    const msg = {
        type: "result",
        result,
        jobKey,
    };
    await sendMessage(msg);
}
async function sendProgressMessage(jobKey, progress, message) {
    const msg = {
        type: "progress",
        progress,
        message,
        jobKey,
    };
    return sendMessage(msg);
}
async function sendErrorMessage(jobKey, error) {
    const msg = {
        type: "error",
        error,
        jobKey,
    };
    await sendMessage(msg);
}
async function sendBeginMessage(jobKey, logfileUrl, logsExpiresAt) {
    const msg = {
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
async function flushMessages() {
    while (pendingSendOperations.size > 0) {
        await Promise.allSettled(Array.from(pendingSendOperations));
    }
}
//# sourceMappingURL=messaging.js.map