/**
 * Lambda / dev-server payload for spatial upload processing.
 * Lives in a separate module so `handler.ts` and `handleUpload.ts` do not
 * circularly import each other (Node 22+ rejects require(esm) cycles).
 */
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
