export declare class WorkerPool<TIn = unknown, TOut = unknown> {
    readonly size: number;
    private readonly workerPath;
    private idle;
    private busy;
    private queue;
    constructor(workerPath: string, size?: number);
    private createWorker;
    run(payload: TIn): Promise<TOut>;
    private dispatch;
    private replaceCrashed;
    destroy(): Promise<void>;
}
export declare function createPool(workerPath: string, size?: number): WorkerPool<any, any>;
//# sourceMappingURL=pool.d.ts.map