import { getClient } from "./lambda-db-client";
import { dirSync } from "tmp";
import { writeFileSync } from "fs";
import * as path from "path";
import {
  GeostatsLayer,
  RasterInfo,
  SuggestedRasterPresentation,
} from "@seasketch/geostats-types";
import bytes from "bytes";
import sanitize from "sanitize-filename";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { SpatialUploadsHandlerRequest } from "../handler";
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
import { processVectorUpload } from "./processVectorUpload";
import { processRasterUpload } from "./processRasterUpload";
import { notifySlackChannel } from "./notifySlackChannel";
import { getObject, putObject } from "./remotes";
import { Logger } from "./logger";
import { getLayerIdentifiers } from "./formats/netcdf";

export { SpatialUploadsHandlerRequest };

const DEBUG = process.env.DEBUG === "true";

export type SupportedTypes =
  | "GeoJSON"
  | "FlatGeobuf"
  | "ZippedShapefile"
  | "GeoTIFF"
  | "NetCDF";

export interface ResponseOutput {
  /** Remote location string as used in rclone */
  remote: string;
  filename: string;
  /**
   * Note, these should be kept in sync with the postgres data_upload_output_type enum
   */
  type:
    | SupportedTypes
    | "PMTiles"
    // geotif may be converted to normalized png when processing gray -> rgb
    | "PNG"
    | "XMLMetadata";
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

// Create a tileset if flatgeobuf is > 100kb (~1mb geojson)
export const MVT_THRESHOLD = 100_000;
// Outputs should not exceed 1 GB
export const MAX_OUTPUT_SIZE = bytes("6 GB") as number;

export type ProgressUpdater = (
  state: "running" | "complete" | "failed",
  progressMessage: string,
  progress?: number
) => Promise<void>;

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
  skipLoggingProgress?: boolean
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
    progress?: number
  ) => {
    if (skipLoggingProgress) {
      return;
    }
    if (progress !== undefined) {
      await pgClient.query(
        `update project_background_jobs set state = $1, progress = least($2, 1), progress_message = $3 where id = $4 returning progress`,
        [state, progress, progressMessage, jobId]
      );
    } else {
      await pgClient.query(
        `update project_background_jobs set state = $1, progress_message = $2 where id = $3 returning progress`,
        [state, progressMessage, jobId]
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
      [progress, jobId]
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
    keyParts[keyParts.length - 1]
  )}`;
  await updateProgress("running", "fetching", 0.0);
  if (DEBUG) {
    console.log("Fetching", objectKey, "to", workingFilePath);
  }
  await getObject(
    workingFilePath,
    `s3://${path.join(process.env.BUCKET!, objectKey)}`,
    logger,
    2 / 30
  );

  let stats: GeostatsLayer[] | RasterInfo;

  // After the environment is set up, we can start processing the file depending
  // on its type
  try {
    if (isTif || ext === ".nc") {
      stats = await processRasterUpload({
        logger,
        path: workingFilePath,
        outputs,
        updateProgress,
        baseKey,
        jobId,
        originalName,
        workingDirectory: dist,
      });
    } else {
      stats = await processVectorUpload({
        logger,
        path: workingFilePath,
        outputs,
        updateProgress,
        baseKey,
        jobId,
        originalName,
        workingDirectory: dist,
      });
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
          MAX_OUTPUT_SIZE
        )} limit. Was ${bytes(
          outputs.find((o) => o.size > MAX_OUTPUT_SIZE)!.size
        )}`
      );
    }
    // Upload outputs to cloud storage
    for (const output of outputs) {
      await putObject(output.local, output.remote, logger, 1 / 30);
    }

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
          filename: originalName + ext,
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
      ]
    );
    return response;
  } catch (e) {
    console.error(e);
    const error = e as Error;
    if (!skipLoggingProgress) {
      const q = await pgClient.query(
        `update project_background_jobs set state = 'failed', error_message = $1, progress_message = 'failed' where id = $2 returning *`,
        [error.message || error.name, jobId]
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
        }
      );

      await notifySlackChannel(
        originalName + ext,
        presignedDownloadUrl,
        logger.output,
        process.env.BUCKET!,
        objectKey,
        requestingUser,
        error.message || error.name
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
