import { OverlayEngineWorkerMessage } from "./types";
export declare function sendMessage(msg: OverlayEngineWorkerMessage): Promise<import("@aws-sdk/client-sqs").SendMessageCommandOutput>;
export declare function sendResultMessage(jobKey: string, result: any, queueUrl: string, duration?: number): Promise<void>;
export declare function sendProgressMessage(jobKey: string, progress: number, queueUrl: string, message?: string, eta?: Date): Promise<import("@aws-sdk/client-sqs").SendMessageCommandOutput>;
export declare function sendErrorMessage(jobKey: string, error: string, queueUrl: string): Promise<void>;
export declare function sendBeginMessage(jobKey: string, logfileUrl: string, logsExpiresAt: string, queueUrl: string): Promise<void>;
/**
 * Tracks unresolved calls to sendMessage and awaits their completion. Usefull
 * to call after completing a job.
 *
 */
export declare function flushMessages(): Promise<void>;
//# sourceMappingURL=messaging.d.ts.map