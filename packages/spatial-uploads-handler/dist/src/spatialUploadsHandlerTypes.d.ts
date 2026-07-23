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
    processingOptions?: DelimitedUploadProcessingOptions;
}
/**
 * Column mapping and coordinate reference system chosen (or auto-detected)
 * for a delimited text (CSV/TSV/TXT) spatial upload. Mirrored on the client
 * in `packages/client/src/admin/uploads/delimitedSpatial/types.ts` — keep
 * both in sync when making changes.
 */
export type DelimitedUploadProcessingOptions = {
    kind: "delimited";
    geometryMode: "point_xy" | "wkt";
    xField?: string;
    yField?: string;
    geometryField?: string;
    crs: string;
    delimiter: "," | "\t" | ";" | "|";
    hasHeaderRow: boolean;
};
//# sourceMappingURL=spatialUploadsHandlerTypes.d.ts.map