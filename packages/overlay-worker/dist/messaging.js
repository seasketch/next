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
    const queueUrl = msg.queueUrl;
    if (!queueUrl) {
        throw new Error("Payload is missing queueUrl");
    }
    const command = new client_sqs_1.SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(msg),
    });
    const sendPromise = sqs.send(command);
    pendingSendOperations.add(sendPromise);
    sendPromise
        .then((v) => {
        if (msg.type === "result") {
            console.log("result message sent", v);
        }
    })
        .finally(() => pendingSendOperations.delete(sendPromise));
    return sendPromise;
}
async function sendResultMessage(jobKey, result, queueUrl) {
    console.log("sending result message", result);
    const msg = {
        type: "result",
        result,
        jobKey,
        queueUrl,
    };
    await sendMessage(msg);
}
async function sendProgressMessage(jobKey, progress, queueUrl, message) {
    const msg = {
        type: "progress",
        progress,
        message,
        jobKey,
        queueUrl,
    };
    return sendMessage(msg);
}
async function sendErrorMessage(jobKey, error, queueUrl) {
    const msg = {
        type: "error",
        error,
        jobKey,
        queueUrl,
    };
    await sendMessage(msg);
}
async function sendBeginMessage(jobKey, logfileUrl, logsExpiresAt, queueUrl) {
    const msg = {
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
async function flushMessages() {
    while (pendingSendOperations.size > 0) {
        await Promise.allSettled(Array.from(pendingSendOperations));
    }
}
//# sourceMappingURL=messaging.js.map