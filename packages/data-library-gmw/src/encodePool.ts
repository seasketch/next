import { ChildProcess, fork } from "child_process";
import { join } from "path";
import type { EncodeWorkerJob } from "./encodeWorker";

type WorkerResult =
  | { empty: true }
  | { empty: false; mrt: Buffer }
  | { error: string };

export class EncodePool {
  private workers: ChildProcess[];
  private idle: ChildProcess[];
  private waiters: Array<(worker: ChildProcess) => void> = [];

  constructor(size: number) {
    const n = Math.max(1, size);
    this.workers = Array.from({ length: n }, () =>
      fork(join(__dirname, "encodeWorker.ts"), [], {
        serialization: "advanced",
      }),
    );
    this.idle = [...this.workers];
  }

  async encode(job: EncodeWorkerJob): Promise<Buffer | null> {
    const worker = await this.take();
    try {
      const result = await new Promise<WorkerResult>((resolve, reject) => {
        const onMessage = (msg: WorkerResult) => {
          cleanup();
          resolve(msg);
        };
        const onError = (err: Error) => {
          cleanup();
          reject(err);
        };
        const cleanup = () => {
          worker.off("message", onMessage);
          worker.off("error", onError);
        };
        worker.on("message", onMessage);
        worker.on("error", onError);
        worker.send(job);
      });
      if ("error" in result) throw new Error(result.error);
      if (result.empty) return null;
      return result.mrt;
    } finally {
      this.release(worker);
    }
  }

  async close(): Promise<void> {
    await Promise.all(
      this.workers.map(
        (w) =>
          new Promise<void>((resolve) => {
            w.once("exit", () => resolve());
            w.kill();
          }),
      ),
    );
  }

  private take(): Promise<ChildProcess> {
    const idle = this.idle.pop();
    if (idle) return Promise.resolve(idle);
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private release(worker: ChildProcess) {
    const waiter = this.waiters.shift();
    if (waiter) waiter(worker);
    else this.idle.push(worker);
  }
}
