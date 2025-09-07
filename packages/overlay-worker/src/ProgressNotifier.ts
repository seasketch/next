import { sendProgressMessage } from "./messaging";

// Debounces progress messages to avoid spamming the database and client
export class ProgressNotifier {
  private jobKey: string;
  private progress = 0;
  private lastNotifiedProgress = 0;
  private messageLastSent?: number;
  private maxWaitMs: number;
  private message?: string;
  private sendMessage = () => {};

  constructor(jobKey: string, debounceMs: number, maxWaitMs: number) {
    this.messageLastSent = new Date().getTime();
    this.maxWaitMs = maxWaitMs;
    this.jobKey = jobKey;
  }

  notify(progress: number, message?: string) {
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
    } else {
      return Promise.resolve();
    }
  }

  async sendNotification() {
    this.lastNotifiedProgress = this.progress;
    this.messageLastSent = new Date().getTime();
    await sendProgressMessage(this.jobKey, this.progress, this.message).then(
      (response) => {}
    );
    return;
  }

  flush() {
    const maybeDebounced: any = this.sendMessage as any;
    if (maybeDebounced && typeof maybeDebounced.flush === "function") {
      maybeDebounced.flush();
    }
  }
}
