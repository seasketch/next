import { GeostatsLayer } from "@seasketch/geostats-types";
import { type ProgressUpdater, type ResponseOutput } from "./uploadPipelineShared";
import { Logger } from "./logger";
import { type AiDataAnalystNotes } from "ai-data-analyst";
export default function fromMarkdown(md: string): any;
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
    /** Display filename (e.g. sanitized name + extension) for LLM context */
    uploadFilename: string;
    /** When true, run title / attribution / column intelligence LLMs (requires CF_AIG_* env). */
    enableAiDataAnalyst?: boolean;
}): Promise<{
    layers: GeostatsLayer[];
    /** Resolve after local processing; caller should await after uploads so LLMs overlap I/O. */
    aiDataAnalystNotesPromise: Promise<AiDataAnalystNotes | undefined>;
}>;
//# sourceMappingURL=processVectorUpload.d.ts.map