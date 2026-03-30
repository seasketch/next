import { RasterInfo } from "@seasketch/geostats-types";
import { type PrefetchedColumnIntelligence } from "@seasketch/column-intelligence-llm";
import { ProgressUpdater, ResponseOutput } from "./handleUpload";
import { Logger } from "./logger";
export interface ProcessRasterUploadResult {
    rasterInfo: RasterInfo;
    /** LLM column intelligence when {@link ProcessRasterUploadOptions.columnIntelligenceUploadedFilename} was set. */
    columnIntelligence: PrefetchedColumnIntelligence | undefined;
}
export declare function processRasterUpload(options: {
    logger: Logger;
    /** Path to original upload */
    path: string;
    /** Outputs will be uploaded to r2 after processing */
    outputs: (ResponseOutput & {
        local: string;
    })[];
    updateProgress: ProgressUpdater;
    baseKey: string;
    /** Tmp directory for storing outputs and derivative files */
    workingDirectory: string;
    /** filename for outputs. Should be something unique, like jobid */
    jobId: string;
    /** Santitized original filename. Used for layer name */
    originalName: string;
    /**
     * Original upload filename (e.g. `sanitizedName.tif`) for column intelligence.
     * When omitted, column intelligence is not run here.
     */
    columnIntelligenceUploadedFilename?: string | null;
}): Promise<ProcessRasterUploadResult>;
//# sourceMappingURL=processRasterUpload.d.ts.map