import { getClient } from "./lambda-db-client";
import { dirSync } from "tmp";
import {
  statSync,
  readFileSync,
  writeFileSync,
  createReadStream,
  createWriteStream,
} from "fs";
import * as path from "path";
import { spawn } from "node:child_process";
import geostats, { statsFromMBTiles, GeostatsLayer } from "./geostats";
import { Feature, FeatureCollection } from "geojson";
import bytes from "bytes";
import bbox from "@turf/bbox";
import sanitize from "sanitize-filename";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { SpatialUploadsHandlerRequest } from "../handler";
import { Readable } from "node:stream";
import { WebClient } from "@slack/web-api";
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

export { SpatialUploadsHandlerRequest };

enum SupportedTypes {
  GeoJSON,
  FlatGeobuf,
  ZippedShapefile,
}

export interface ResponseOutput {
  remote: string;
  type: "FlatGeobuf" | "GeoJSON" | "PMTiles";
  url?: string;
  size: number;
}

export interface ProcessedUploadLayer {
  name: string;
  filename: string;
  geostats: GeostatsLayer | null;
  outputs: ResponseOutput[];
  bounds?: number[];
}

export interface ProcessedUploadResponse {
  logfile: string;
  layers: ProcessedUploadLayer[];
  error?: string;
}

// Don't create geojson archives if flatgeobuf is over 15mb
const GEOJSON_BYTE_LIMIT = 15000000;
// Create a tileset if flatgeobuf is > 1MB
const MVT_THRESHOLD = 1000000;
// Outputs should not exceed 1 GB
const MAX_OUTPUT_SIZE = 1000000000;

export default async function handleUpload(
  uuid: string,
  objectKey: string,
  dataSourcesBucket: string,
  dataSourcesUrl: string,
  suffix: string,
  requestingUser: string,
  skipLoggingProgress?: boolean
): Promise<ProcessedUploadResponse> {
  const pgClient = await getClient();

  /**
   * Updates progress of the upload task
   * @param state
   * @param progress Optional 0.0-1.0 value
   */
  async function updateProgress(
    state:
      | "fetching"
      | "processing"
      | "validating"
      | "requires_user_input"
      | "converting_format"
      | "tiling"
      | "uploading_products"
      | "complete"
      | "failed",
    progress?: number
  ) {
    if (skipLoggingProgress) {
      console.log("progress logging skipped");
      return;
    }
    if (progress !== undefined) {
      await pgClient.query(
        `update data_upload_tasks set state = $1, progress = least($2, 1) where id = $3 returning progress`,
        [state, progress, uuid]
      );
    } else {
      await pgClient.query(
        `update data_upload_tasks set state = $1 where id = $2 returning progress`,
        [state, uuid]
      );
    }
  }

  // Create a temporary directory that will be cleaned up when the task
  // completes (error or none using try..finally)
  const tmpobj = dirSync({
    unsafeCleanup: true,
  });

  // Logger/task executor which tracks all stdout/stderr outputs so they can be
  // saved to a log file
  const logger = new Logger(async (increment: number) => {
    if (skipLoggingProgress) {
      return;
    }
    const { rows } = await pgClient.query(
      `update data_upload_tasks set progress = least(progress + $1, 1) where id = $2 returning progress`,
      [increment, uuid]
    );
  });

  const s3LogPath = `s3://${process.env.BUCKET}/${uuid}.log.txt`;
  let { name, ext, base } = path.parse(objectKey);
  name = sanitize(name);
  const originalName = name;
  name = `${uuid}`;

  try {
    // Step 1) Fetch the uploaded file from S3
    const filepath = `${path.join(tmpobj.name, objectKey.split("/")[1])}`;
    await updateProgress("fetching", 0.0);
    await getObject(
      filepath,
      `s3://${path.join(process.env.BUCKET!, objectKey)}`,
      logger
    );
    logger.updateProgress(1 / 20);

    // Step 2) Use ogr/gdal to see if it is a supported file format
    await updateProgress("validating");
    let type: SupportedTypes;
    let wgs84 = false;
    const ogrInfo = await logger.exec(
      `ogrinfo -al -so ${ext === ".zip" ? "/vsizip/" : ""}${filepath}`,
      ext === ".shp"
        ? "Could not read file. Shapefiles should be uploaded as a zip archive with related sidecar files"
        : "Could not run ogrinfo on file",
      1 / 20
    );
    if (/GeoJSON/.test(ogrInfo)) {
      type = SupportedTypes.GeoJSON;
    } else if (/FlatGeobuf/.test(ogrInfo)) {
      type = SupportedTypes.FlatGeobuf;
    } else if (/ESRI Shapefile/.test(ogrInfo)) {
      type = SupportedTypes.ZippedShapefile;
    } else {
      throw new Error("Not a recognized file type");
    }
    // Might be useful to know. All files are normalized to WGS84
    if (/WGS 84/.test(ogrInfo)) {
      wgs84 = true;
    }

    /**
     * Step 3) Convert to appropriate outputs.
     *
     * Vector files are converted to FGB and GeoJSON depending on file size,
     * and if over a certain threshold tiled to mbtiles and then pmtiles.
     *
     * Raster TBD, but likely COG and/or pmtiles
     */
    await updateProgress("converting_format");
    const outputs: {
      type: "GeoJSON" | "PMTiles" | "FlatGeobuf";
      remote: string;
      local: string;
      url?: string;
      size: number;
    }[] = [];
    const dist = path.join(tmpobj.name, "dist");
    await logger.exec(`mkdir ${dist}`, "Failed to create directory", 0);
    const normalizedVectorPath = path.join(dist, name + ".fgb");

    // All vector files are normalized to a WGS84 FlatGeobuf for long-term
    // storage. Using this format we can easily tile and convert to other
    // formats, and fgb doesn't take up too much storage capacity.
    try {
      await logger.exec(
        `ogr2ogr -skipfailures -t_srs EPSG:4326 ${normalizedVectorPath} ${
          type === SupportedTypes.ZippedShapefile ? "/vsizip/" : ""
        }${filepath} `,
        "Problem converting to FlatGeobuf",
        1 / 20
      );
    } catch (e) {
      if (
        "message" in (e as Error) &&
        /Mismatched geometry type/.test((e as Error).message)
      ) {
        logger.output +=
          "Mixed geometry types. Attempting to run ogr2ogr again using PROMOTE_TO_MULTI.\n";
        await logger.exec(
          `ogr2ogr -skipfailures -t_srs EPSG:4326 -nlt PROMOTE_TO_MULTI ${normalizedVectorPath} ${
            type === SupportedTypes.ZippedShapefile ? "/vsizip/" : ""
          }${filepath} `,
          "Problem converting to FlatGeobuf",
          1 / 20
        );
      }
    }
    const normalizedVectorFileSize = statSync(normalizedVectorPath).size;
    outputs.push({
      type: "FlatGeobuf",
      remote: `s3://${process.env.NORMALIZED_OUTPUTS_BUCKET}/projects/${suffix}/${uuid}.fgb`,
      local: normalizedVectorPath,
      size: normalizedVectorFileSize,
    });

    let stats: GeostatsLayer | null = null;
    let bounds: number[] | null = null;

    // Only convert to GeoJSON if the dataset is small. Otherwise we can convert
    // from the normalized fgb dynamically if someone wants to download it as
    // GeoJSON or shapefile.
    if (normalizedVectorFileSize <= GEOJSON_BYTE_LIMIT) {
      const geojsonPath = path.join(dist, name + ".geojson.json");
      await logger.exec(
        `ogr2ogr -skipfailures -t_srs EPSG:4326 -f GeoJSON -nlt PROMOTE_TO_MULTI ${geojsonPath} ${normalizedVectorPath} `,
        "Problem converting to GeoJSON",
        1 / 20
      );
      outputs.push({
        type: "GeoJSON",
        remote: `s3://${dataSourcesBucket}/${uuid}`,
        local: geojsonPath,
        url: `${dataSourcesUrl}/${uuid}`,
        size: statSync(geojsonPath).size,
      });
    }

    /**
     * Tiling only happens if the file is over a certain size. If very small
     * just loading the raw GeoJSON in mapbox-gl-js should be sufficient.
     *
     * Here we are just using default tippecanoe settings and then running the
     * mbtiles through `pmtiles convert`. PMTiles archives are much more compact
     * than mbtiles and much easier to create a serverless tile server for.
     *
     * At some point we may need to customize the settings of tippecanoe but it
     * seems the Felt is doing a lot of work on improving the default behavior.
     */
    if (normalizedVectorFileSize > MVT_THRESHOLD) {
      const mvtPath = path.join(dist, name + ".mbtiles");
      const pmtilesPath = path.join(dist, name + ".pmtiles");
      await updateProgress("tiling");
      await logger.exec(
        `tippecanoe -n "${originalName}" -zg -L'{"file":"${normalizedVectorPath}", "layer":"${originalName}"}' -o ${mvtPath}`,
        "Tippecanoe failed",
        10 / 20
      );
      await logger.exec(
        `pmtiles convert ${mvtPath} ${pmtilesPath}`,
        "PMTiles conversion failed",
        2 / 20
      );
      outputs.push({
        type: "PMTiles",
        remote: `r2://ssn-tiles/projects/${suffix}/public/${uuid}.pmtiles`,
        local: pmtilesPath,
        size: statSync(pmtilesPath).size,
        url: `https://tiles.seasketchdata.com/projects/${suffix}/public/${uuid}`,
      });

      // Collect mapbox-geostats from mbtiles archive
      // (generated automatically by tippecanoe)
      const info = await statsFromMBTiles(mvtPath);
      stats = info.geostats;
      bounds = info.bounds;
    }

    // If mapbox-geostats weren't extracted from mbtiles, get them from GeoJSON
    // if available
    if (!stats && outputs.find((output) => output.type === "GeoJSON")) {
      const path = outputs.find((output) => output.type === "GeoJSON")!.local;
      const geojson = JSON.parse(readFileSync(path).toString()) as
        | Feature
        | FeatureCollection;
      stats = geostats(geojson, originalName);
      bounds = bbox(geojson);
    }

    // Step 4) Upload outputs to s3 and the tile server (cloudflare r2)

    // Ensure that outputs do not exceed file size limits
    await updateProgress("uploading_products");
    for (const output of outputs) {
      if (output.size > MAX_OUTPUT_SIZE) {
        throw new Error(
          `${output.type} output exceeds ${bytes(MAX_OUTPUT_SIZE)} limit`
        );
      }
    }
    for (const output of outputs) {
      if (/s3:/.test(output.remote)) {
        await putObject(output.local, output.remote, logger, 1 / 20);
      } else if (/r2:/.test(output.remote)) {
        await putObject(output.local, output.remote, logger, 1 / 20);
      } else {
        throw new Error(`Unrecognized remote ${output.remote}`);
      }
    }

    const logPath = path.join(tmpobj.name, "log.txt");
    writeFileSync(logPath, logger.output);
    await putObject(logPath, s3LogPath, logger);
    return {
      layers: [
        {
          filename: originalName + ext,
          name: originalName,
          geostats: stats,
          outputs: outputs.map((o) => ({ ...o, local: undefined })),
          bounds: bounds || undefined,
        },
      ],
      logfile: s3LogPath,
    };
  } catch (e) {
    const error = e as Error;
    if (!skipLoggingProgress) {
      await pgClient.query(
        `update data_upload_tasks set state = 'failed', error_message = $1 where id = $2`,
        [error.message || error.name, uuid]
      );
    }
    if (process.env.SLACK_TOKEN && process.env.SLACK_CHANNEL) {
      const command = new GetObjectCommand({
        Bucket: process.env.BUCKET,
        Key: objectKey,
      });
      const presignedDownloadUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 172800,
      });

      await notifySlackChannel(
        originalName + ext,
        presignedDownloadUrl,
        logger.output,
        process.env.BUCKET!,
        objectKey,
        requestingUser
      );
    }
    console.log(logger.output);
    throw e;
  } finally {
    const logPath = path.join(tmpobj.name, "log.txt");
    writeFileSync(logPath, logger.output);
    await putObject(logPath, s3LogPath, logger);
    tmpobj.removeCallback();
  }
}

class Logger {
  output: string;
  updateProgress: (increment: number) => Promise<void>;

  constructor(updateProgress: (increment: number) => Promise<void>) {
    this.output = "";
    this.updateProgress = updateProgress;
  }

  /**
   *
   * @param command String Command to run
   * @param throwMsg String If the process exists with a status code other than 0, this message will be thrown
   * @param progressFraction Float If provided, the `updateProgress` function will be called to increment progress on the upload task record. If the Logger detects progress messages from the script in stdout/err, it will update accordingly. If not, it will simply increment the progress by this fraction once the entire command completes.
   * @returns
   */
  async exec(
    command: string,
    throwMsg: string,
    progressFraction?: number
  ): Promise<string> {
    let stdout = "";
    const self = this;
    return new Promise((resolve, reject) => {
      let progress = 0;
      self.output += command + "\n";
      const child = spawn(command, { shell: true });

      const progressRegExp = /([\d\.]+)%/;

      child.stdout.setEncoding("utf8");
      child.stdout.on("data", function (data) {
        if (progressFraction && progressRegExp.test(data.toString())) {
          const newProgress = parseFloat(
            data.toString().match(progressRegExp)[1]
          );
          const increment = newProgress - progress;
          progress = newProgress;
          self.updateProgress((increment / 100) * progressFraction);
        }
        stdout += data.toString();
        self.output += data.toString();
      });

      child.stderr.setEncoding("utf8");
      child.stderr.on("data", function (data) {
        if (
          data.indexOf("ERROR 1: ICreateFeature: Mismatched geometry type") !=
          -1
        ) {
          reject(
            new Error("ERROR 1: ICreateFeature: Mismatched geometry type")
          );
        }
        if (progressFraction && progressRegExp.test(data.toString())) {
          const newProgress = parseFloat(
            data.toString().match(progressRegExp)[1]
          );
          const increment = newProgress - progress;
          progress = newProgress;
          self.updateProgress((increment / 100) * progressFraction);
        }
        self.output += data.toString();
      });

      child.on("close", async function (code) {
        if (code !== 0) {
          reject(new Error(throwMsg));
        } else {
          if (progress === 0) {
            if (progressFraction) {
              await self.updateProgress(progressFraction);
            }
          }
          resolve(stdout);
        }
      });
    });
  }
}

const s3Client = new S3Client({ region: process.env.AWS_REGION! });
const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function putObject(
  filepath: string,
  remote: string,
  logger: Logger,
  increment?: number
) {
  const parts = remote.replace(/\w+:\/\//, "").split("/");
  const client = /r2:/.test(remote) ? r2Client : s3Client;
  const Bucket = parts[0];
  const Key = parts.slice(1).join("/");
  const fileStream = createReadStream(filepath);
  const uploadParams = {
    Bucket,
    Key,
    Body: fileStream,
  };
  const logmsg = `putObject ${filepath} to ${remote}`;
  logger.output += logmsg + "\n";
  await client.send(new PutObjectCommand(uploadParams));
  if (increment) {
    logger.updateProgress(increment);
  }
}

async function getObject(
  filepath: string,
  remote: string,
  logger: Logger
): Promise<string> {
  const parts = remote.replace("s3://", "").split("/");
  const Bucket = parts[0];
  const Key = parts.slice(1).join("/");
  logger.output += `getObject ${remote} to ${filepath}`;
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket,
      Key,
    })
  );
  if (response.Body) {
    return new Promise((resolve, reject) => {
      if (response.Body instanceof Readable) {
        response.Body.pipe(createWriteStream(filepath))
          .on("error", (err) => reject(err))
          .on("close", () => resolve(filepath));
      }
    });
  } else {
    throw new Error("Invalid response from s3");
  }
}

async function notifySlackChannel(
  filename: string,
  presignedDownloadUrl: string,
  logs: string,
  bucket: string,
  objectKey: string,
  user: string
) {
  const slack = new WebClient(process.env.SLACK_TOKEN!);

  await slack.chat.postMessage({
    channel: process.env.SLACK_CHANNEL!,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "An Upload Failed",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Processing of this spatial data file failed. It could be that this file format is unsupported, it was corrupted, or there was a problem with SeaSketch.",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: filename,
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "Download file",
            emoji: false,
          },
          value: filename,
          url: presignedDownloadUrl,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Download link expires after 48 hours.\n\nbucket=${bucket}\nkey=${objectKey}\nuser=${user}`,
          },
        ],
      },
    ],
  });

  await slack.files.upload({
    channels: process.env.SLACK_CHANNEL!,
    filename: `${filename}.logs.txt`,
    content: logs,
    title: `${filename} processing logs`,
  });
}
