import handleUpload from "./src/handleUpload";
import type { SpatialUploadsHandlerRequest } from "./src/spatialUploadsHandlerTypes";

export type {
  SpatialUploadsHandlerRequest,
  DelimitedUploadProcessingOptions,
} from "./src/spatialUploadsHandlerTypes";

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
    return {
      error: (e as Error).message,
      log: logRemote,
    };
  }
};
