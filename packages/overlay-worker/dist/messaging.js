"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessage = sendMessage;
exports.sendResultMessage = sendResultMessage;
exports.sendProgressMessage = sendProgressMessage;
exports.sendErrorMessage = sendErrorMessage;
exports.sendBeginMessage = sendBeginMessage;
const client_sqs_1 = require("@aws-sdk/client-sqs");
async function sendMessage(msg, jobKey) {
    const queueUrl = process.env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL;
    if (!queueUrl) {
        throw new Error("OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL is not set");
    }
    const sqs = new client_sqs_1.SQSClient({ region: process.env.AWS_REGION });
    const command = new client_sqs_1.SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(msg),
    });
    await sqs.send(command);
}
async function sendResultMessage(jobKey, result) {
    const msg = {
        type: "result",
        result,
        jobKey,
    };
    await sendMessage(msg, jobKey);
}
async function sendProgressMessage(jobKey, progress, message) {
    const msg = {
        type: "progress",
        progress,
        message,
        jobKey,
    };
    await sendMessage(msg, jobKey);
}
async function sendErrorMessage(jobKey, error) {
    const msg = {
        type: "error",
        error,
        jobKey,
    };
    await sendMessage(msg, jobKey);
}
async function sendBeginMessage(jobKey, logfileUrl, logsExpiresAt) {
    const msg = {
        type: "begin",
        logfileUrl,
        logsExpiresAt,
        jobKey,
    };
    await sendMessage(msg, jobKey);
}
//# sourceMappingURL=messaging.js.map