import { GeostatsLayer, RasterInfo } from "@seasketch/geostats-types";
import { SpatialUploadsHandlerRequest } from "../handler";
export { SpatialUploadsHandlerRequest };
export type SupportedTypes = "GeoJSON" | "FlatGeobuf" | "ZippedShapefile" | "GeoTIFF" | "NetCDF";
export interface ResponseOutput {
    /** Remote location string as used in rclone */
    remote: string;
    filename: string;
    /**
     * Note, these should be kept in sync with the postgres data_upload_output_type enum
     */
    type: SupportedTypes | "PMTiles" | "PNG" | "XMLMetadata";
    /** URL of the tile service (or geojson if really small) */
    url?: string;
    /** in bytes */
    size: number;
    /** Original file uploaded by the user. Kept for export */
    isOriginal?: boolean;
    /** "normalized" outputs are all in a uniform projection and can be used to
     * created alternative export files in the future */
    isNormalizedOutput?: boolean;
}
export interface ProcessedUploadLayer {
    name: string;
    filename: string;
    geostats: GeostatsLayer | RasterInfo | null;
    outputs: ResponseOutput[];
    bounds?: number[];
    url: string;
    isSingleBandRaster?: boolean;
}
export interface ProcessedUploadResponse {
    logfile: string;
    layers: ProcessedUploadLayer[];
    error?: string;
}
export declare const MVT_THRESHOLD = 100000;
export declare const MAX_OUTPUT_SIZE: number;
export type ProgressUpdater = (state: "running" | "complete" | "failed", progressMessage: string, progress?: number) => Promise<void>;
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
requestingUser: string, skipLoggingProgress?: boolean): Promise<ProcessedUploadResponse>;
//# sourceMappingURL=handleUpload.d.ts.map