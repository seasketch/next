import handleUpload from "./src/index";

export interface SpatialUploadsHandlerRequest {
  taskId: string;
  objectKey: string;
  /** Used for storing GeoJSON */
  dataSourcesBucket: string;
  /** Used for storing GeoJSON */
  dataSourcesUrl: string;
  // prepended to the key used to save outputs
  // e.g. /projects/cburt/public
  suffix: string;
  // Must be set if using the production lambda from a dev
  // machine, since it can only connect to the prod db
  skipLoggingProgress?: boolean;
  // Canonical email of the requesting user for logging purposes
  requestingUser: string;
}

export const processUpload = async (event: SpatialUploadsHandlerRequest) => {
  const s3LogPath = `s3://${process.env.BUCKET}/${event.taskId}.log.txt`;
  try {
    const outputs = await handleUpload(
      event.taskId,
      event.objectKey,
      event.dataSourcesBucket,
      event.dataSourcesUrl,
      event.suffix,
      event.requestingUser,
      event.skipLoggingProgress
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
