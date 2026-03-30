import { GeostatsLayer } from "@seasketch/geostats-types";
import { type PrefetchedColumnIntelligence } from "@seasketch/column-intelligence-llm";
import { ProgressUpdater, ResponseOutput } from "./handleUpload";
import { Logger } from "./logger";
export default function fromMarkdown(md: string): any;
export interface ProcessVectorUploadResult {
    layers: GeostatsLayer[];
    /** LLM column intelligence when {@link ProcessVectorUploadOptions.columnIntelligenceUploadedFilename} was set. */
    columnIntelligence: PrefetchedColumnIntelligence | undefined;
}
/**
 * Process a vector upload, converting it to a normalized FlatGeobuf file and
 * creating vector tiles if the file is under a certain size.
 *
 * @param options
 * @returns
 */
export declare function processVectorUpload(options: {
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
     * Original upload filename for column intelligence. When omitted, column intelligence is not run here.
     */
    columnIntelligenceUploadedFilename?: string | null;
}): Promise<ProcessVectorUploadResult>;
//# sourceMappingURL=processVectorUpload.d.ts.map