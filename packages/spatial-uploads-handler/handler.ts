import handleUpload from "./src/handleUpload";
import { toError } from "./src/storageErrors";
import type { SpatialUploadsHandlerRequest } from "./src/spatialUploadsHandlerTypes";

export type {
  SpatialUploadsHandlerRequest,
  DelimitedUploadProcessingOptions,
} from "./src/spatialUploadsHandlerTypes";

/**
 * Lambda entry point.
 *
 * The API invokes this function asynchronously (InvocationType "Event"), so
 * whatever is returned here is discarded. handleUpload records every failure
 * on the project_background_jobs row and alerts Slack before rethrowing; this
 * wrapper only logs to CloudWatch and returns rather than throws, since a
 * thrown error would trigger Lambda's async retries and re-run a job that has
 * already been marked failed.
 */
export const processUpload = async (event: SpatialUploadsHandlerRequest) => {
  const logRemote = `r2://${process.env.BUCKET}/${event.taskId}.log.txt`;
  try {
    const outputs = await handleUpload(
      event.taskId,
      event.objectKey,
      event.suffix,
      event.requestingUser,
      event.skipLoggingProgress,
      event.enableAiDataAnalyst,
      event.processingOptions,
    );
    return {
      ...outputs,
      log: logRemote,
    };
  } catch (e) {
    const error = toError(e);
    console.error(
      `processUpload failed for job ${event.taskId} (${event.objectKey}):`,
      error,
    );
    return {
      error: error.message,
      log: logRemote,
    };
  }
};
