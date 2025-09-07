export declare class ProgressNotifier {
    private jobKey;
    private progress;
    private lastNotifiedProgress;
    private messageLastSent?;
    private maxWaitMs;
    private message?;
    private sendMessage;
    constructor(jobKey: string, debounceMs: number, maxWaitMs: number);
    notify(progress: number, message?: string): Promise<void>;
    sendNotification(): Promise<void>;
    flush(): void;
}
//# sourceMappingURL=ProgressNotifier.d.ts.map