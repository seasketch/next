export declare class ProgressNotifier {
    private jobKey;
    private progress;
    private lastNotifiedProgress;
    private messageLastSent?;
    private maxWaitMs;
    private message?;
    private queueUrl;
    private sendMessage;
    constructor(jobKey: string, maxWaitMs: number, queueUrl: string);
    notify(progress: number, message?: string): Promise<void>;
    sendNotification(): Promise<void>;
    flush(): void;
}
//# sourceMappingURL=ProgressNotifier.d.ts.map