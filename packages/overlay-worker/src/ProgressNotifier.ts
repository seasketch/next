import debounce from "lodash.debounce";
import {
  sendErrorMessage,
  sendProgressMessage,
  sendResultMessage,
} from "./messaging";

// Debounces progress messages to avoid spamming the database and client
export class ProgressNotifier {
  private jobKey: string;
  private progress = 0;
  private message?: string;
  private sendMessage = () => {};

  constructor(jobKey: string, debounceMs: number, maxWaitMs: number) {
    this.jobKey = jobKey;
    // this.sendMessage = () => {
    //   console.log("Sending progress message", this.progress, this.message);
    //   sendProgressMessage(this.jobKey, this.progress, this.message);
    // };
    this.sendMessage = debounce(
      () => {
        sendProgressMessage(this.jobKey, this.progress, this.message);
      },
      debounceMs,
      {
        maxWait: maxWaitMs,
      }
    );
  }

  notify(progress: number, message?: string) {
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
    const maybeDebounced: any = this.sendMessage as any;
    if (maybeDebounced && typeof maybeDebounced.flush === "function") {
      maybeDebounced.flush();
    }
  }
}
