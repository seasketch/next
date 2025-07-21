export interface SpatialUploadsHandlerRequest {
    taskId: string;
    objectKey: string;
    suffix: string;
    skipLoggingProgress?: boolean;
    requestingUser: string;
}
export declare const processUpload: (event: SpatialUploadsHandlerRequest) => Promise<{
    log: string;
    logfile: string;
    layers: import("./src/handleUpload").ProcessedUploadLayer[];
    error?: string;
} | {
    error: string;
    log: string;
}>;
//# sourceMappingURL=handler.d.ts.map