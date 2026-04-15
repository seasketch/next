import { type ProcessedUploadResponse } from "./uploadPipelineShared";
export type { SpatialUploadsHandlerRequest } from "./spatialUploadsHandlerTypes";
export { MAX_OUTPUT_SIZE, MVT_THRESHOLD, } from "./uploadPipelineShared";
export type { ProcessedUploadLayer, ProcessedUploadResponse, ProgressUpdater, ResponseOutput, SupportedTypes, } from "./uploadPipelineShared";
export default function handleUpload(
/** project_background_jobs uuid */
jobId: string, 
/** full s3 object key */
objectKey: string, 
/** Project identifier */
slug: string, 
/**
 * For logging purposes only. In the form of "Full Name<email@example.com>"
 */
requestingUser: string, skipLoggingProgress?: boolean, 
/** When true, run column intelligence / title / attribution LLMs (requires CF_AIG_* env). */
enableAiDataAnalyst?: boolean): Promise<ProcessedUploadResponse>;
//# sourceMappingURL=handleUpload.d.ts.map