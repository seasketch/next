"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressNotifier = void 0;
const messaging_1 = require("./messaging");
// Debounces progress messages to avoid spamming the database and client
class ProgressNotifier {
    constructor(jobKey, maxWaitMs, queueUrl) {
        this.progress = 0;
        this.lastNotifiedProgress = 0;
        this.sendMessage = () => { };
        this.messageLastSent = new Date().getTime();
        this.maxWaitMs = maxWaitMs;
        this.jobKey = jobKey;
        this.queueUrl = queueUrl;
    }
    notify(progress, message) {
        let sendNotification = false;
        // only send notification if one of these criteria are met:
        // 1. it has been more than maxWaitMs since the last notification
        if (Date.now() - (this.messageLastSent || 0) > this.maxWaitMs) {
            // console.log(
            //   "exceeded max wait",
            //   Date.now(),
            //   this.messageLastSent,
            //   this.maxWaitMs,
            //   Date.now() - (this.messageLastSent || 0)
            // );
            sendNotification = true;
        }
        // 2. The progress has increased by 10% or more since the last notification
        if (progress > this.lastNotifiedProgress + 5) {
            // console.log(
            //   "progress increased beyond threshold",
            //   progress,
            //   this.lastNotifiedProgress
            // );
            sendNotification = true;
        }
        // if (sendNotification) {
        //   console.log(
        //     "send notification",
        //     Date.now(),
        //     this.messageLastSent,
        //     this.maxWaitMs,
        //     progress,
        //     this.lastNotifiedProgress
        //   );
        // }
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
    async sendNotification() {
        await (0, messaging_1.sendProgressMessage)(this.jobKey, this.progress, this.queueUrl, this.message).then((response) => {
            // noop
            let noop = 1 + 2;
        });
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