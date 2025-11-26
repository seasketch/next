export declare class ProgressNotifier {
    private jobKey;
    private progress;
    private lastNotifiedProgress;
    private messageLastSent?;
    private maxWaitMs;
    private message?;
    private queueUrl;
    private etaEstimator;
    private eta;
    private sendMessage;
    constructor(jobKey: string, maxWaitMs: number, queueUrl: string);
    notify(progress: number, message?: string): Promise<import("@aws-sdk/client-sqs").SendMessageCommandOutput> | Promise<void>;
    sendNotification(): Promise<import("@aws-sdk/client-sqs").SendMessageCommandOutput>;
    flush(): void;
}
//# sourceMappingURL=ProgressNotifier.d.ts.map