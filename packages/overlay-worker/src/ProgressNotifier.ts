import { sendProgressMessage } from "./messaging";

// Debounces progress messages to avoid spamming the database and client
export class ProgressNotifier {
  private jobKey: string;
  private progress = 0;
  private lastNotifiedProgress = 0;
  private messageLastSent?: number;
  private maxWaitMs: number;
  private message?: string;
  private queueUrl: string;
  private sendMessage = () => {};

  constructor(jobKey: string, maxWaitMs: number, queueUrl: string) {
    this.messageLastSent = new Date().getTime();
    this.maxWaitMs = maxWaitMs;
    this.jobKey = jobKey;
    this.queueUrl = queueUrl;
  }

  notify(progress: number, message?: string) {
    let sendNotification = false;

    // only send notification if one of these criteria are met:
    // 1. it has been more than maxWaitMs since the last notification
    if (
      (Math.round(progress) > Math.round(this.lastNotifiedProgress) &&
        Date.now() - (this.messageLastSent || 0) > this.maxWaitMs) ||
      Date.now() - (this.messageLastSent || 0) > this.maxWaitMs * 5
    ) {
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
    } else {
      return Promise.resolve();
    }
  }

  async sendNotification() {
    await sendProgressMessage(
      this.jobKey,
      this.progress,
      this.queueUrl,
      this.message
    ).then((response) => {
      // noop
      let noop = 1 + 2;
    });
    return;
  }

  flush() {
    const maybeDebounced: any = this.sendMessage as any;
    if (maybeDebounced && typeof maybeDebounced.flush === "function") {
      maybeDebounced.flush();
    }
  }
}
