import { OverlayEngineWorkerMessage } from "./types";
export declare function sendMessage(msg: OverlayEngineWorkerMessage, jobKey: string): Promise<void>;
export declare function sendResultMessage(jobKey: string, result: any): Promise<void>;
export declare function sendProgressMessage(jobKey: string, progress: number, message?: string): Promise<void>;
export declare function sendErrorMessage(jobKey: string, error: string): Promise<void>;
export declare function sendBeginMessage(jobKey: string, logfileUrl: string, logsExpiresAt: string): Promise<void>;
//# sourceMappingURL=messaging.d.ts.map