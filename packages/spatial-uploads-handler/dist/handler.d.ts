import type { SpatialUploadsHandlerRequest } from "./src/spatialUploadsHandlerTypes";
export type { SpatialUploadsHandlerRequest } from "./src/spatialUploadsHandlerTypes";
export declare const processUpload: (event: SpatialUploadsHandlerRequest) => Promise<{
    log: string;
    logfile: string;
    layers: import("./src/uploadPipelineShared").ProcessedUploadLayer[];
    error?: string;
} | {
    error: string;
    log: string;
}>;
//# sourceMappingURL=handler.d.ts.map