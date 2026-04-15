import type { GeostatsLayer, RasterInfo } from "@seasketch/geostats-types";
import type { AiDataAnalystNotes } from "ai-data-analyst";
/**
 * Shared upload pipeline types and constants.
 *
 * Kept separate from `handleUpload.ts` so `processRasterUpload` /
 * `processVectorUpload` do not import `handleUpload` (which imports them),
 * which would create a circular dependency and break Node 22+ / tsx.
 */
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
    aiDataAnalystNotes?: AiDataAnalystNotes;
}
export interface ProcessedUploadResponse {
    logfile: string;
    layers: ProcessedUploadLayer[];
    error?: string;
}
export declare const MVT_THRESHOLD = 100000;
/** Same numeric cap as legacy `bytes("6 GB")` (6 GiB). */
export declare const MAX_OUTPUT_SIZE = 6442450944;
export type ProgressUpdater = (state: "running" | "complete" | "failed", progressMessage: string, progress?: number) => Promise<void>;
//# sourceMappingURL=uploadPipelineShared.d.ts.map