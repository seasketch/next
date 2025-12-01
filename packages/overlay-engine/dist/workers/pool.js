"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerPool = void 0;
exports.createClippingWorkerPool = createClippingWorkerPool;
// pool.ts
const node_worker_threads_1 = require("node:worker_threads");
const node_os_1 = __importDefault(require("node:os"));
class WorkerPool {
    constructor(workerPath, size = 5) {
        this.idle = [];
        this.busy = new Set();
        this.queue = [];
        this.workerPath = workerPath;
        this.size = size;
        for (let i = 0; i < size; i++) {
            this.idle.push(this.createWorker());
        }
        process.on("beforeExit", () => {
            this.destroy().catch(() => void 0);
        });
    }
    createWorker() {
        return new node_worker_threads_1.Worker(this.workerPath);
    }
    run(payload) {
        return new Promise((resolve, reject) => {
            this.queue.push({ payload, resolve, reject });
            this.dispatch();
        });
    }
    dispatch() {
        while (this.idle.length && this.queue.length) {
            const worker = this.idle.pop();
            const task = this.queue.shift();
            this.busy.add(worker);
            const onMessage = (msg) => {
                cleanup();
                if (msg && msg.ok) {
                    task.resolve(msg.result);
                }
                else {
                    const e = new Error(msg && "error" in msg ? msg.error.message : "Worker error");
                    if (msg && "error" in msg && msg.error.stack)
                        e.stack = msg.error.stack;
                    task.reject(e);
                }
                this.replaceCrashed(worker);
            };
            const onError = (err) => {
                cleanup();
                task.reject(err);
                this.replaceCrashed(worker);
            };
            const onExit = (code) => {
                cleanup();
                task.reject(new Error(`Worker exited with code ${code}`));
                this.replaceCrashed(worker);
            };
            const cleanup = () => {
                worker.off("message", onMessage);
                worker.off("error", onError);
                worker.off("exit", onExit);
            };
            worker.once("message", onMessage);
            worker.once("error", onError);
            worker.once("exit", onExit);
            worker.postMessage(task.payload);
        }
    }
    replaceCrashed(worker) {
        this.busy.delete(worker);
        try {
            worker.terminate().catch(() => void 0);
        }
        catch (_a) { }
        this.idle.push(this.createWorker());
        this.dispatch();
    }
    async destroy() {
        // reject any queued tasks
        while (this.queue.length) {
            const t = this.queue.shift();
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
exports.WorkerPool = WorkerPool;
function createClippingWorkerPool(workerPath, size = Math.max(1, (node_os_1.default.availableParallelism() || node_os_1.default.cpus().length) - 1)) {
    return new WorkerPool(workerPath, size);
}
//# sourceMappingURL=pool.js.map