/**
 * Lambda / dev-server payload for spatial upload processing.
 * Lives in a separate module so `handler.ts` and `handleUpload.ts` do not
 * circularly import each other (Node 22+ rejects require(esm) cycles).
 */
export interface SpatialUploadsHandlerRequest {
    taskId: string;
    objectKey: string;
    suffix: string;
    skipLoggingProgress?: boolean;
    requestingUser: string;
    enableAiDataAnalyst?: boolean;
}
//# sourceMappingURL=spatialUploadsHandlerTypes.d.ts.map