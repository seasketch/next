import handleUpload from "./src/handleUpload";
import type { SpatialUploadsHandlerRequest } from "./src/spatialUploadsHandlerTypes";

export type { SpatialUploadsHandlerRequest } from "./src/spatialUploadsHandlerTypes";

export const processUpload = async (event: SpatialUploadsHandlerRequest) => {
  const s3LogPath = `s3://${process.env.BUCKET}/${event.taskId}.log.txt`;
  try {
    const outputs = await handleUpload(
      event.taskId,
      event.objectKey,
      event.suffix,
      event.requestingUser,
      event.skipLoggingProgress,
      event.enableAiDataAnalyst,
    );
    return {
      ...outputs,
      log: s3LogPath,
    };
  } catch (e) {
    return {
      error: (e as Error).message,
      log: s3LogPath,
    };
  }
};
