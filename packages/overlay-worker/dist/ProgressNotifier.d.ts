export declare class ProgressNotifier {
    private jobKey;
    private progress;
    private message?;
    private sendMessage;
    constructor(jobKey: string, debounceMs: number, maxWaitMs: number);
    notify(progress: number, message?: string): void;
    flush(): void;
}
//# sourceMappingURL=ProgressNotifier.d.ts.map