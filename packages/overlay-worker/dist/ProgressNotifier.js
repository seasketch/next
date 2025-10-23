"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressNotifier = void 0;
const messaging_1 = require("./messaging");
const EtaEstimator_1 = require("./EtaEstimator");
// Debounces progress messages to avoid spamming the database and client
class ProgressNotifier {
    constructor(jobKey, maxWaitMs, queueUrl) {
        this.progress = 0;
        this.lastNotifiedProgress = 0;
        this.etaEstimator = null;
        this.eta = null;
        this.sendMessage = () => { };
        this.messageLastSent = new Date().getTime();
        this.maxWaitMs = maxWaitMs;
        this.jobKey = jobKey;
        this.queueUrl = queueUrl;
    }
    notify(progress, message) {
        let sendNotification = false;
        if (progress === 0) {
            this.etaEstimator = new EtaEstimator_1.EtaEstimator({
                totalUnits: 100,
            });
        }
        const timeSinceLastSent = Date.now() - (this.messageLastSent || 0);
        const exceedsMaxWait = timeSinceLastSent > this.maxWaitMs;
        // only send notification if one of these criteria are met:
        // 1. it has been more than maxWaitMs since the last notification
        if ((Math.round(progress) > Math.round(this.lastNotifiedProgress) &&
            exceedsMaxWait) ||
            timeSinceLastSent > this.maxWaitMs * 5) {
            sendNotification = true;
        }
        // 2. The progress has increased by 10% or more since the last notification
        if (progress > this.lastNotifiedProgress + 5) {
            sendNotification = true;
        }
        if (progress > this.progress) {
            if (this.etaEstimator) {
                const state = this.etaEstimator.update(progress);
                this.eta = state.eta;
            }
        }
        this.progress = progress;
        this.message = message;
        if (sendNotification) {
            this.lastNotifiedProgress = this.progress;
            this.messageLastSent = new Date().getTime();
            return this.sendNotification();
        }
        else {
            return Promise.resolve();
        }
    }
    sendNotification() {
        return (0, messaging_1.sendProgressMessage)(this.jobKey, this.progress, this.queueUrl, this.message, this.eta || undefined);
    }
    flush() {
        const maybeDebounced = this.sendMessage;
        if (maybeDebounced && typeof maybeDebounced.flush === "function") {
            maybeDebounced.flush();
        }
    }
}
exports.ProgressNotifier = ProgressNotifier;
//# sourceMappingURL=ProgressNotifier.js.map