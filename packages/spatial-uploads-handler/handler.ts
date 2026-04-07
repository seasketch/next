import handleUpload from "./src/handleUpload";

export interface SpatialUploadsHandlerRequest {
  taskId: string;
  objectKey: string;
  // prepended to the key used to save outputs
  // e.g. /projects/cburt/public
  suffix: string;
  // Must be set if using the production lambda from a dev
  // machine, since it can only connect to the prod db
  skipLoggingProgress?: boolean;
  // Canonical email of the requesting user for logging purposes
  requestingUser: string;
  // Whether to enable AI data analyst. If not set or false, will skip sending
  // data to openai. *Will* still run classification of PII using local models.
  enableAiDataAnalyst?: boolean;
}

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
