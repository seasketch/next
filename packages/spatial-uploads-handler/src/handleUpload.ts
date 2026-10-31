import { getClient } from "./lambda-db-client";
import { dirSync } from "tmp";
import { writeFileSync } from "fs";
import * as path from "path";
import {
  GeostatsLayer,
  RasterInfo,
  SuggestedRasterPresentation,
} from "@seasketch/geostats-types";
import { processVectorUpload } from "./processVectorUpload";
import { processRasterUpload } from "./processRasterUpload";
import { notifySlackChannel } from "./notifySlackChannel";
import { getObject, presignStagedGet, putObject } from "./remotes";
import { Logger } from "./logger";
import { getLayerIdentifiers } from "./formats/netcdf";
import type { AiDataAnalystNotes } from "ai-data-analyst";
import bytes = require("bytes");
import sanitize = require("sanitize-filename");
import {
  MAX_OUTPUT_SIZE,
  type ProcessedUploadLayer,
  type ProcessedUploadResponse,
  type ProgressUpdater,
  type ResponseOutput,
} from "./uploadPipelineShared";
import type { DelimitedUploadProcessingOptions } from "./spatialUploadsHandlerTypes";
import { toError } from "./storageErrors";

export type {
  SpatialUploadsHandlerRequest,
  DelimitedUploadProcessingOptions,
} from "./spatialUploadsHandlerTypes";

export {
  MAX_OUTPUT_SIZE,
  MVT_THRESHOLD,
} from "./uploadPipelineShared";
export type {
  ProcessedUploadLayer,
  ProcessedUploadResponse,
  ProgressUpdater,
  ResponseOutput,
  SupportedTypes,
} from "./uploadPipelineShared";

const DEBUG = process.env.DEBUG === "true";

/**
 * Mark a background job as failed with the given message, unless it has
 * already reached a terminal state. Never throws: a database problem here is
 * logged so that it cannot mask the error being reported.
 */
async function failJobIfActive(
  jobId: string,
  errorMessage: string,
): Promise<void> {
  try {
    const pgClient = await getClient();
    await pgClient.query(
      `update project_background_jobs set state = 'failed', error_message = $1, progress_message = 'failed' where id = $2 and state in ('queued', 'running')`,
      [errorMessage, jobId],
    );
  } catch (dbError) {
    console.error(
      `Could not mark job ${jobId} as failed. The job may be left in a running state until it times out.`,
      dbError,
    );
  }
}

export default async function handleUpload(
  /** project_background_jobs uuid */
  jobId: string,
  /** full s3 object key */
  objectKey: string,
  /** Project identifier */
  slug: string,
  /**
   * For logging purposes only. In the form of "Full Name<email@example.com>"
   */
  requestingUser: string,
  skipLoggingProgress?: boolean,
  /** When true, run column intelligence / title / attribution LLMs (requires CF_AIG_* env). */
  enableAiDataAnalyst?: boolean,
  /** Column mapping / CRS for delimited (CSV/TSV/TXT) uploads. */
  processingOptions?: DelimitedUploadProcessingOptions,
): Promise<ProcessedUploadResponse> {
  if (DEBUG) {
    console.log("DEBUG MODE ENABLED");
  }
  // getClient() is memoized, so the closures below share one connection. It is
  // called lazily (inside the try) so that a connection failure is reported
  // through the same catch as every other error.
  const outputs: (ResponseOutput & { local: string })[] = [];
  const baseKey = `projects/${slug}/public`;

  /**
   * Updates progress of the upload task
   * @param state
   * @param progress Optional 0.0-1.0 value
   */
  const updateProgress: ProgressUpdater = async (
    state: "running" | "complete" | "failed",
    progressMessage: string,
    progress?: number,
  ) => {
    if (skipLoggingProgress) {
      return;
    }
    const pgClient = await getClient();
    if (progress !== undefined) {
      await pgClient.query(
        `update project_background_jobs set state = $1, progress = least($2, 1), progress_message = $3 where id = $4 returning progress`,
        [state, progress, progressMessage, jobId],
      );
    } else {
      await pgClient.query(
        `update project_background_jobs set state = $1, progress_message = $2 where id = $3 returning progress`,
        [state, progressMessage, jobId],
      );
    }
  };

  // Create a temporary directory that will be cleaned up when the task
  // completes (error or none using try..finally)
  const tmpobj = dirSync({
    unsafeCleanup: true,
    keep: true,
    prefix: "uploads-",
  });

  // Logger/task executor which tracks all stdout/stderr outputs so they can be
  // saved to a log file
  const logger = new Logger(async (progress: number) => {
    if (skipLoggingProgress) {
      return;
    }
    const pgClient = await getClient();
    await pgClient.query(
      `update project_background_jobs set progress = least($1, 1.0) where id = $2 returning progress`,
      [progress, jobId],
    );
  });

  const dist = path.join(tmpobj.name, "dist");

  const logRemote = `r2://${process.env.BUCKET}/${jobId}.log.txt`;
  const stagedRemote = `r2://${process.env.BUCKET}/${objectKey}`;
  let { name, ext, base } = path.parse(objectKey);

  name = sanitize(name);
  const originalName = name;
  name = `${jobId}`;
  const isTif = ext === ".tif" || ext === ".tiff";

  const keyParts = objectKey.split("/");
  let workingFilePath = `${path.join(
    tmpobj.name,
    keyParts[keyParts.length - 1],
  )}`;

  let stats: GeostatsLayer[] | RasterInfo;
  let aiDataAnalystNotesPromise: Promise<AiDataAnalystNotes | undefined>;

  const uploadFilename = originalName + ext;

  // Everything that can fail lives inside this try, so the catch below is the
  // one place that records the failure on the job and alerts Slack. The Lambda
  // is invoked asynchronously, so an error that escapes this function is never
  // reported anywhere else.
  try {
    await logger.exec(["mkdir", [dist]], "Failed to create directory", 0);

    // Step 1) Fetch the uploaded file from storage
    await updateProgress("running", "fetching", 0.0);
    if (DEBUG) {
      console.log("Fetching", stagedRemote, "to", workingFilePath);
    }
    await getObject(workingFilePath, stagedRemote, logger, 2 / 30);

    // Step 2) Process the file depending on its type
    if (isTif || ext === ".nc") {
      const rasterResult = await processRasterUpload({
        logger,
        path: workingFilePath,
        outputs,
        updateProgress,
        baseKey,
        jobId,
        originalName,
        uploadFilename,
        workingDirectory: dist,
        enableAiDataAnalyst,
      });
      stats = rasterResult.rasterInfo;
      aiDataAnalystNotesPromise = rasterResult.aiDataAnalystNotesPromise;
    } else {
      const vectorResult = await processVectorUpload({
        logger,
        path: workingFilePath,
        outputs,
        updateProgress,
        baseKey,
        jobId,
        originalName,
        uploadFilename,
        workingDirectory: dist,
        enableAiDataAnalyst,
        processingOptions,
      });
      stats = vectorResult.layers;
      aiDataAnalystNotesPromise = vectorResult.aiDataAnalystNotesPromise;
    }

    // Determine bounds for the layer
    let bounds: number[] | undefined;
    if (Array.isArray(stats) && stats.length > 1) {
      throw new Error("Multiple vector layers in the same file not supported");
    } else if (Array.isArray(stats)) {
      bounds = stats[0].bounds;
    } else {
      bounds = stats.bands[0].bounds;
    }

    // Ensure that outputs do not exceed file size limits
    await updateProgress("running", "uploading products");
    if (outputs.find((o) => o.size > MAX_OUTPUT_SIZE)) {
      throw new Error(
        `One or more outputs exceed ${bytes(
          MAX_OUTPUT_SIZE,
        )} limit. Was ${bytes(
          outputs.find((o) => o.size > MAX_OUTPUT_SIZE)!.size,
        )}`,
      );
    }
    // Upload outputs to cloud storage
    for (const output of outputs) {
      await putObject(output.local, output.remote, logger, 1 / 30);
    }

    const isVectorUpload = !isTif && ext !== ".nc";
    if (enableAiDataAnalyst) {
      await updateProgress("running", "ai cartographer");
    } else if (isVectorUpload) {
      await updateProgress("running", "classifying pii");
    } else {
      await updateProgress("running", "finalizing");
    }
    const aiDataAnalystNotes = await aiDataAnalystNotesPromise;

    await updateProgress("running", "worker complete", 1);

    // Determine final url that should be assigned to mapbox-gl-style source
    let sourceUrl: string | undefined;
    for (const output of outputs) {
      if (output.type === "PMTiles") {
        sourceUrl = output.url!.replace(/\.pmtiles$/, "");
      } else if (
        output.type === "GeoJSON" &&
        !output.isOriginal &&
        !sourceUrl
      ) {
        sourceUrl = output.url;
      }
    }
    if (!sourceUrl) {
      throw new Error("No sourceUrl found");
    }

    // Write logs before returning response
    const logPath = path.join(tmpobj.name, "log.txt");
    writeFileSync(logPath, logger.output);
    await putObject(logPath, logRemote, logger);
    const geostats = Array.isArray(stats) ? stats[0] : stats;

    const response: { layers: ProcessedUploadLayer[]; logfile: string } = {
      layers: [
        {
          filename: uploadFilename,
          name: "bands" in geostats ? originalName : geostats.layer,
          geostats,
          outputs: outputs.map((o) => ({
            ...o,
            local: undefined,
            filename: o.filename,
          })),
          bounds: bounds || undefined,
          url: sourceUrl,
          isSingleBandRaster:
            isTif &&
            (stats as RasterInfo).presentation ===
              SuggestedRasterPresentation.continuous,
          ...(aiDataAnalystNotes ? { aiDataAnalystNotes } : {}),
        },
      ],
      logfile: logRemote,
    };
    // Trigger the task to process the outputs
    const pgClient = await getClient();
    await pgClient.query(
      `SELECT graphile_worker.add_job('processDataUploadOutputs', $1::json)`,
      [
        JSON.stringify({
          jobId: jobId,
          data: response,
        }),
      ],
    );
    return response;
  } catch (e) {
    const error = toError(e);
    console.error(
      `Upload job ${jobId} failed while processing ${stagedRemote}:`,
      error,
    );
    logger.output += `\nERROR: ${error.message}\n`;
    if (!skipLoggingProgress) {
      await failJobIfActive(jobId, error.message);
    }
    if (
      process.env.SLACK_TOKEN &&
      process.env.SLACK_CHANNEL &&
      process.env.NODE_ENV === "production"
    ) {
      // A Slack outage must not hide the original error.
      try {
        const presignedDownloadUrl = await presignStagedGet(
          process.env.BUCKET!,
          objectKey,
          172800,
        );
        await notifySlackChannel(
          originalName + ext,
          presignedDownloadUrl,
          logger.output,
          process.env.BUCKET!,
          objectKey,
          requestingUser,
          error.message,
        );
      } catch (slackError) {
        console.error(
          `Could not send Slack notification for failed job ${jobId}`,
          slackError,
        );
      }
    }
    throw error;
  } finally {
    // Persisting the log is best-effort. If storage is the thing that is
    // broken, a failure here would otherwise replace the real error.
    try {
      const logPath = path.join(tmpobj.name, "log.txt");
      writeFileSync(logPath, logger.output);
      await putObject(logPath, logRemote, logger);
    } catch (logError) {
      console.error(
        `Could not write processing log for job ${jobId} to ${logRemote}`,
        logError,
      );
    }
    if (DEBUG) {
      console.log("Debugging enabled, not cleaning up tmp directory");
    } else {
      tmpobj.removeCallback();
    }
  }
}
