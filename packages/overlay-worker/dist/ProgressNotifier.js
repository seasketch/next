"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressNotifier = void 0;
const messaging_1 = require("./messaging");
// Debounces progress messages to avoid spamming the database and client
class ProgressNotifier {
    constructor(jobKey, debounceMs, maxWaitMs) {
        this.progress = 0;
        this.lastNotifiedProgress = 0;
        this.sendMessage = () => { };
        this.messageLastSent = new Date().getTime();
        this.maxWaitMs = maxWaitMs;
        this.jobKey = jobKey;
    }
    notify(progress, message) {
        let sendNotification = false;
        // only send notification if one of these criteria are met:
        // 1. the progress message has changed
        if (message !== this.message) {
            sendNotification = true;
        }
        // 2. it has been more than maxWaitMs since the last notification
        if (Date.now() - (this.messageLastSent || 0) > this.maxWaitMs) {
            sendNotification = true;
        }
        // 3. The progress has increased by 10% or more since the last notification
        if (progress > this.lastNotifiedProgress * 1.1) {
            sendNotification = true;
        }
        this.progress = progress;
        this.message = message;
        if (sendNotification) {
            return this.sendNotification();
        }
        else {
            return Promise.resolve();
        }
    }
    async sendNotification() {
        this.lastNotifiedProgress = this.progress;
        this.messageLastSent = new Date().getTime();
        await (0, messaging_1.sendProgressMessage)(this.jobKey, this.progress, this.message).then((response) => { });
        return;
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