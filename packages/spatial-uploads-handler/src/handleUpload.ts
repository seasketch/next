import { getClient } from "./lambda-db-client";
import { dirSync } from "tmp";
import { writeFileSync } from "fs";
import * as path from "path";
import {
  GeostatsLayer,
  RasterInfo,
  SuggestedRasterPresentation,
} from "@seasketch/geostats-types";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
import { processVectorUpload } from "./processVectorUpload";
import { processRasterUpload } from "./processRasterUpload";
import { notifySlackChannel } from "./notifySlackChannel";
import { getObject, putObject } from "./remotes";
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

export type { SpatialUploadsHandlerRequest } from "./spatialUploadsHandlerTypes";

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
): Promise<ProcessedUploadResponse> {
  if (DEBUG) {
    console.log("DEBUG MODE ENABLED");
  }
  const pgClient = await getClient();
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
    const { rows } = await pgClient.query(
      `update project_background_jobs set progress = least($1, 1.0) where id = $2 returning progress`,
      [progress, jobId],
    );
  });

  const dist = path.join(tmpobj.name, "dist");
  await logger.exec(["mkdir", [dist]], "Failed to create directory", 0);

  const s3LogPath = `s3://${process.env.BUCKET}/${jobId}.log.txt`;
  let { name, ext, base } = path.parse(objectKey);

  name = sanitize(name);
  const originalName = name;
  name = `${jobId}`;
  const isTif = ext === ".tif" || ext === ".tiff";

  // Step 1) Fetch the uploaded file from S3
  const keyParts = objectKey.split("/");
  let workingFilePath = `${path.join(
    tmpobj.name,
    keyParts[keyParts.length - 1],
  )}`;
  await updateProgress("running", "fetching", 0.0);
  if (DEBUG) {
    console.log("Fetching", objectKey, "to", workingFilePath);
  }
  await getObject(
    workingFilePath,
    `s3://${path.join(process.env.BUCKET!, objectKey)}`,
    logger,
    2 / 30,
  );

  let stats: GeostatsLayer[] | RasterInfo;
  let aiDataAnalystNotesPromise: Promise<AiDataAnalystNotes | undefined>;

  const uploadFilename = originalName + ext;

  // After the environment is set up, we can start processing the file depending
  // on its type
  try {
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
    await putObject(logPath, s3LogPath, logger);
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
      logfile: s3LogPath,
    };
    // Trigger the task to process the outputs
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
    console.error(e);
    const error = e as Error;
    if (!skipLoggingProgress) {
      const q = await pgClient.query(
        `update project_background_jobs set state = 'failed', error_message = $1, progress_message = 'failed' where id = $2 returning *`,
        [error.message || error.name, jobId],
      );
    }
    if (
      process.env.SLACK_TOKEN &&
      process.env.SLACK_CHANNEL &&
      process.env.NODE_ENV === "production"
    ) {
      const command = new GetObjectCommand({
        Bucket: process.env.BUCKET,
        Key: objectKey,
      });
      const presignedDownloadUrl = await getSignedUrl(
        process.env.DEBUGGING_AWS_ACCESS_KEY_ID &&
          process.env.DEBUGGING_AWS_SECRET_ACCESS_KEY
          ? new S3Client({
              region: process.env.AWS_REGION!,
              credentials: {
                accessKeyId: process.env.DEBUGGING_AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.DEBUGGING_AWS_SECRET_ACCESS_KEY,
              },
            })
          : s3Client,
        command,
        {
          expiresIn: 172800,
        },
      );

      await notifySlackChannel(
        originalName + ext,
        presignedDownloadUrl,
        logger.output,
        process.env.BUCKET!,
        objectKey,
        requestingUser,
        error.message || error.name,
      );
    }
    throw e;
  } finally {
    const logPath = path.join(tmpobj.name, "log.txt");
    writeFileSync(logPath, logger.output);
    await putObject(logPath, s3LogPath, logger);
    if (DEBUG) {
      console.log("Debugging enabled, not cleaning up tmp directory");
    } else {
      tmpobj.removeCallback();
    }
  }
}

const s3Client = new S3Client({ region: process.env.AWS_REGION! });
