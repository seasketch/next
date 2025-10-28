// pool.ts
import { Worker } from "node:worker_threads";
import os from "node:os";

type WorkerOk<TOut> = { ok: true; result: TOut };
type WorkerErr = { ok: false; error: { message: string; stack?: string } };
type WorkerMsg<TOut> = WorkerOk<TOut> | WorkerErr;

type Task<TIn, TOut> = {
  payload: TIn;
  resolve: (value: TOut) => void;
  reject: (reason?: unknown) => void;
};

export class WorkerPool<TIn = unknown, TOut = unknown> {
  readonly size: number;
  private readonly workerPath: string;
  private idle: Worker[] = [];
  private busy = new Set<Worker>();
  private queue: Array<Task<TIn, TOut>> = [];

  constructor(workerPath: string, size = 5) {
    this.workerPath = workerPath;
    this.size = size;

    for (let i = 0; i < size; i++) {
      this.idle.push(this.createWorker());
    }

    process.on("beforeExit", () => {
      this.destroy().catch(() => void 0);
    });
  }

  private createWorker(): Worker {
    return new Worker(this.workerPath);
  }

  run(payload: TIn): Promise<TOut> {
    return new Promise<TOut>((resolve, reject) => {
      this.queue.push({ payload, resolve, reject });
      this.dispatch();
    });
  }

  private dispatch(): void {
    while (this.idle.length && this.queue.length) {
      const worker = this.idle.pop() as Worker;
      const task = this.queue.shift() as Task<TIn, TOut>;
      this.busy.add(worker);

      const onMessage = (msg: WorkerMsg<TOut>) => {
        cleanup();
        if (msg && msg.ok) {
          task.resolve(msg.result);
        } else {
          const e = new Error(
            msg && "error" in msg ? msg.error.message : "Worker error"
          );
          if (msg && "error" in msg && msg.error.stack)
            (e as any).stack = msg.error.stack;
          task.reject(e);
        }
        this.replaceCrashed(worker);
      };

      const onError = (err: unknown) => {
        cleanup();
        task.reject(err);
        this.replaceCrashed(worker);
      };

      const onExit = (code: number) => {
        cleanup();
        task.reject(new Error(`Worker exited with code ${code}`));
        this.replaceCrashed(worker);
      };

      const cleanup = () => {
        worker.off("message", onMessage as any);
        worker.off("error", onError as any);
        worker.off("exit", onExit as any);
      };

      worker.once("message", onMessage as any);
      worker.once("error", onError as any);
      worker.once("exit", onExit as any);
      worker.postMessage(task.payload);
    }
  }

  private replaceCrashed(worker: Worker): void {
    this.busy.delete(worker);
    try {
      worker.terminate().catch(() => void 0);
    } catch {}
    this.idle.push(this.createWorker());
    this.dispatch();
  }

  async destroy(): Promise<void> {
    // reject any queued tasks
    while (this.queue.length) {
      const t = this.queue.shift()!;
      t.reject(new Error("Worker pool destroyed"));
    }
    const terminations = [
      ...this.idle.map((w) => w.terminate()),
      ...[...this.busy].map((w) => w.terminate()),
    ];
    this.idle = [];
    this.busy.clear();
    await Promise.allSettled(terminations);
  }
}

export function createClippingWorkerPool(
  workerPath: string,
  size = Math.max(1, (os.availableParallelism() || os.cpus().length) - 1)
): WorkerPool<any, any> {
  console.log(`Creating worker pool with ${size} workers`);
  return new WorkerPool(workerPath, size);
}
