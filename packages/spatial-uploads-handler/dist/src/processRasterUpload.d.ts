import { RasterInfo } from "@seasketch/geostats-types";
import { ProgressUpdater, ResponseOutput } from "./handleUpload";
import { Logger } from "./logger";
import { type AiDataAnalystNotes } from "ai-data-analyst";
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
    /** Display filename (e.g. sanitized name + extension) for LLM context */
    uploadFilename: string;
    /** When true, run title / column intelligence LLMs (requires CF_AIG_* env). */
    enableAiDataAnalyst?: boolean;
}): Promise<{
    rasterInfo: RasterInfo;
    /** Resolve after local processing; caller should await after uploads so LLMs overlap I/O. */
    aiDataAnalystNotesPromise: Promise<AiDataAnalystNotes | undefined>;
}>;
//# sourceMappingURL=processRasterUpload.d.ts.map