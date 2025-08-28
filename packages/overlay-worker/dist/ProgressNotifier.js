"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressNotifier = void 0;
const lodash_debounce_1 = __importDefault(require("lodash.debounce"));
const messaging_1 = require("./messaging");
// Debounces progress messages to avoid spamming the database and client
class ProgressNotifier {
    constructor(jobKey, debounceMs, maxWaitMs) {
        this.progress = 0;
        this.sendMessage = () => { };
        this.jobKey = jobKey;
        // this.sendMessage = () => {
        //   console.log("Sending progress message", this.progress, this.message);
        //   sendProgressMessage(this.jobKey, this.progress, this.message);
        // };
        this.sendMessage = (0, lodash_debounce_1.default)(() => {
            (0, messaging_1.sendProgressMessage)(this.jobKey, this.progress, this.message);
        }, debounceMs, {
            maxWait: maxWaitMs,
        });
    }
    notify(progress, message) {
        let hasChanged = false;
        if (progress >= this.progress && message !== this.message) {
            this.message = message;
            hasChanged = true;
        }
        if (progress > this.progress) {
            this.progress = progress;
            hasChanged = true;
        }
        if (hasChanged) {
            this.sendMessage();
        }
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