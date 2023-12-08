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

type SupportedTypes = "GeoJSON" | "FlatGeobuf" | "ZippedShapefile" | "GeoTIFF";

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
    | "PNG";
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
  geostats: GeostatsLayer | null;
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
const MVT_THRESHOLD = 100000;
// Outputs should not exceed 1 GB
const MAX_OUTPUT_SIZE = 1000000000;

enum ColorInterp {
  RGB,
  RGBA,
  GRAY,
  PALETTE,
}

const DEFAULT_RASTER_INFO = {
  colorInterp: ColorInterp.GRAY,
  isCorrectProjection: false,
  stats: [] as { min: number; max: number; mean: number; std: number }[],
  bounds: [-180.0, -85.06, 180.0, 85.06] as [number, number, number, number],
  resolution: 100,
};

export default async function handleUpload(
  uuid: string,
  objectKey: string,
  suffix: string,
  requestingUser: string,
  skipLoggingProgress?: boolean
): Promise<ProcessedUploadResponse> {
  console.log("handle");
  const pgClient = await getClient();
  console.log("got client");

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
      | "failed"
      | "worker_complete",
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
    keep: true,
    prefix: "uploads-",
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

  /** Final url that should be assigned to mapbox-gl-style source */
  let sourceUrl: string | undefined;

  const s3LogPath = `s3://${process.env.BUCKET}/${uuid}.log.txt`;
  let { name, ext, base } = path.parse(objectKey);
  name = sanitize(name);
  const originalName = name;
  name = `${uuid}`;
  const isZip = ext === ".zip";
  const isTif = ext === ".tif";

  try {
    // Step 1) Fetch the uploaded file from S3
    let workingFilePath = `${path.join(tmpobj.name, objectKey.split("/")[1])}`;
    let originalFilePath = workingFilePath;
    await updateProgress("fetching", 0.0);
    console.log(
      workingFilePath,
      `s3://${path.join(process.env.BUCKET!, objectKey)}`
    );
    await getObject(
      workingFilePath,
      `s3://${path.join(process.env.BUCKET!, objectKey)}`,
      logger
    );
    logger.updateProgress(1 / 20);

    if (isZip) {
      const workingDir = tmpobj.name;
      // // Unzip the file
      await logger.exec(
        ["unzip", ["-o", workingFilePath, "-d", workingDir]],
        "Problem unzipping file",
        1 / 20
      );

      // Find the first shapefile (.shp) in the working Dir
      const shapefile = await logger.exec(
        [
          "find",
          [
            workingDir,
            "-type",
            "f",
            "-not",
            "-path",
            "*/.*",
            "-not",
            "-path",
            "*/__",
            "-name",
            "*.shp",
          ],
        ],
        "Problem finding shapefile in zip archive",
        1 / 20
      );
      workingFilePath = shapefile.trim();
    }

    // Step 2) Use ogr/gdal to see if it is a supported file format
    await updateProgress("validating");
    let type: SupportedTypes;
    let wgs84 = false;
    const rasterInfo = {
      ...DEFAULT_RASTER_INFO,
    };
    if (isTif) {
      type = "GeoTIFF";
      const rioInfo = await logger.exec(
        ["rio", ["info", "-v", workingFilePath]],
        "Problem reading file. Rasters should be uploaded as GeoTIFF.",
        1 / 20
      );
      const rioData = JSON.parse(rioInfo);
      if (rioData.driver !== "GTiff") {
        throw new Error(`Unrecognized raster driver "${rioData.driver}"`);
      }
      if (rioData.colorinterp[0] === "gray") {
        // It seems Arc Desktop exports rgb files in a format that gdal/rio info
        // doesn't interpret correctly. Hopefully guessing this way is ok.
        if (
          rioData.colorinterp.length === 3 &&
          rioData.colorinterp[1] === "undefined"
        ) {
          rasterInfo.colorInterp = ColorInterp.RGB;
        } else {
          rasterInfo.colorInterp = ColorInterp.GRAY;
        }
      } else if (
        // Sam Arc Desktop hueristic here for rgba
        rioData.colorinterp.length === 4 &&
        rioData.colorinterp[3] === "alpha" &&
        rioData.colorinterp[0] === "undefined"
      ) {
        rasterInfo.colorInterp = ColorInterp.RGBA;
      } else if (rioData.colorinterp[0] === "red") {
        if (rioData.colorinterp[3] === "alpha") {
          rasterInfo.colorInterp = ColorInterp.RGBA;
        } else {
          rasterInfo.colorInterp = ColorInterp.RGB;
        }
      } else if (rioData.colorinterp[0] === "palette") {
        rasterInfo.colorInterp = ColorInterp.PALETTE;
      } else {
        throw new Error(
          `Unrecognized colorinterp [${rioData.colorinterp.join(",")}]`
        );
      }
      rasterInfo.isCorrectProjection = rioData.crs === "EPSG:3857";
      rasterInfo.stats = rioData.stats;
      rasterInfo.bounds = rioData.bounds;
      rasterInfo.resolution = rioData.transform[0];

      const fc = await logger.exec(
        ["rio", ["bounds", workingFilePath]],
        "Problem determining bounds of raster",
        1 / 20
      );
      rasterInfo.bounds = JSON.parse(fc).bbox;
    } else {
      const ogrInfo = await logger.exec(
        ["ogrinfo", ["-al", "-so", workingFilePath]],
        // `ogrinfo -al -so ${workingFilePath}`,
        ext === ".shp"
          ? "Could not read file. Shapefiles should be uploaded as a zip archive with related sidecar files"
          : "Could not run ogrinfo on file",
        1 / 20
      );
      if (/GeoJSON/.test(ogrInfo)) {
        type = "GeoJSON";
      } else if (/FlatGeobuf/.test(ogrInfo)) {
        type = "FlatGeobuf";
      } else if (/ESRI Shapefile/.test(ogrInfo)) {
        type = "ZippedShapefile";
      } else {
        throw new Error("Not a recognized file type");
      }
      // Might be useful to know. All files are normalized to WGS84
      if (/WGS 84/.test(ogrInfo)) {
        wgs84 = true;
      }
    }

    /**
     * Step 3) Convert to appropriate outputs.
     *
     * Vector files are converted to FGB and GeoJSON depending on file size,
     * and if over a certain threshold tiled to mbtiles and then pmtiles.
     *
     * Rasters are converted to pmtiles with no intermediate format
     */
    await updateProgress("converting_format");
    const outputs: (ResponseOutput & { local: string })[] = [];
    const baseKey = `projects/${suffix}/public`;

    outputs.push({
      type: type,
      filename: name + ext,
      remote: `${process.env.RESOURCES_REMOTE}/${baseKey}/${name}${ext}`,
      local: originalFilePath,
      size: statSync(originalFilePath).size,
      url: `${process.env.UPLOADS_BASE_URL}/${baseKey}/${name}${ext}`,
      isOriginal: true,
    });

    const dist = path.join(tmpobj.name, "dist");
    await logger.exec(["mkdir", [dist]], "Failed to create directory", 0);
    let stats: GeostatsLayer | null = null;
    let bounds: number[] | null = null;
    bounds = rasterInfo.bounds;
    if (isTif) {
      let inputPath = workingFilePath;
      if (!rasterInfo.isCorrectProjection) {
        // use rio warp to reproject tif
        const warpedPath = path.join(dist, name + ".warped.tif");
        await logger.exec(
          ["rio", ["warp", inputPath, warpedPath, "--dst-crs", "EPSG:3857"]],
          "Problem reprojecting raster",
          1 / 20
        );
        inputPath = warpedPath;
      }
      if (rasterInfo.colorInterp === ColorInterp.PALETTE) {
        // use pct2rgb.py to convert to rgb
        const rgbPath = path.join(dist, name + ".rgb.tif");
        await logger.exec(
          ["gdal_translate", ["-expand", "rgb", inputPath, rgbPath]],
          "Problem converting palletized raster to RGB",
          1 / 20
        );
        inputPath = rgbPath;
      } else if (rasterInfo.colorInterp === ColorInterp.GRAY) {
        // If singleband, determine scale ratio. Otherwise set to 1
        // An example of using the scale ratio is a single-band raster with 8-bit
        // float values 0 - 1. We want to scale these to 0 - 255 so they can be
        // displayed in grayscale.
        let scaleRatio = 255 / rasterInfo.stats[0].max;
        // use rio to convert to rgb
        const rgbPath = path.join(dist, name + "-rgb.png");
        await logger.exec(
          [
            "rio",
            [
              "convert",
              "--scale-ratio",
              scaleRatio.toString(),
              "-f",
              "PNG",
              "--rgb",
              "--dtype",
              "uint8",
              inputPath,
              rgbPath,
            ],
          ],
          "Problem converting raster to RGB",
          1 / 20
        );
        inputPath = rgbPath;
      }

      const ext = path.parse(inputPath).ext;
      outputs.push({
        type: ext === ".tif" ? "GeoTIFF" : "PNG",
        remote: `${process.env.RESOURCES_REMOTE}/${baseKey}/${uuid}${ext}`,
        local: inputPath,
        size: statSync(inputPath).size,
        url: `${process.env.UPLOADS_BASE_URL}/${baseKey}/${uuid}${ext}`,
        filename: `${uuid}${ext}`,
        isNormalizedOutput: true,
      });

      // Convert to mbtiles
      await updateProgress("tiling");
      const mbtilesPath = path.join(dist, name + ".mbtiles");

      // Not necessary when using gdal_translate & gdaladdo
      // Using resolution output from rio info and some hints from:
      // https://gis.stackexchange.com/questions/268107/gdal2tiles-py-how-to-find-optimal-zoom-level-for-leaflet
      // const radius = 6378137;
      // const equator = 2 * Math.PI * radius;
      // const tileSize = 512;
      // const minzoom = 0;
      // const maxzoom = Math.min(
      //   // At most, tile to zoom level 16
      //   16,
      //   Math.ceil(Math.log2(equator / tileSize / rasterInfo.resolution))
      // );

      // await logger.exec(
      //   [
      //     "rio",
      //     [
      //       "mbtiles",
      //       inputPath,
      //       mbtilesPath,
      //       "--format",
      //       "PNG",
      //       "--include-empty-tiles",
      //       "--title",
      //       name,
      //       "--description",
      //       name + ext,
      //       "--zoom-levels",
      //       `${minzoom}..${maxzoom}`,
      //       "--tile-size",
      //       tileSize.toString(),
      //       "--resampling",
      //       rasterInfo.colorInterp === ColorInterp.GRAY ? "nearest" : "cubic",
      //       ...(rasterInfo.colorInterp === ColorInterp.RGBA ? ["--rgba"] : []),
      //       "--progress-bar",
      //       "--implementation",
      //       "cf",
      //     ],
      //   ],
      //   "Problem converting raster to mbtiles",
      //   5 / 20
      // );

      await logger.exec(
        [
          "gdal_translate",
          [
            "-of",
            "mbtiles",
            "-co",
            "BLOCKSIZE=512",
            "-co",
            "RESAMPLING=NEAREST",
            "-co",
            `NAME=${name}`,
            inputPath,
            mbtilesPath,
          ],
        ],
        "Problem converting raster to mbtiles",
        3 / 20
      );

      await logger.exec(
        ["gdaladdo", ["-minsize", "8", "-r", "cubic", mbtilesPath]],
        "Problem adding overviews to mbtiles",
        2 / 20
      );

      // Convert to pmtiles
      const pmtilesPath = path.join(dist, name + ".pmtiles");
      await logger.exec(
        [`pmtiles`, ["convert", mbtilesPath, pmtilesPath]],
        "PMTiles conversion failed",
        5 / 20
      );
      outputs.push({
        type: "PMTiles",
        remote: `${process.env.TILES_REMOTE}/${baseKey}/${uuid}.pmtiles`,
        local: pmtilesPath,
        size: statSync(pmtilesPath).size,
        url: `${process.env.TILES_BASE_URL}/${baseKey}/${uuid}.pmtiles`,
        filename: `${uuid}.pmtiles`,
      });
      sourceUrl = `${process.env.TILES_BASE_URL}/${baseKey}/${uuid}.json`;
    } else {
      const normalizedVectorPath = path.join(dist, name + ".fgb");

      // All vector files are normalized to a WGS84 FlatGeobuf for long-term
      // storage. Using this format we can easily tile and convert to other
      // formats, and fgb doesn't take up too much storage capacity.
      try {
        await logger.exec(
          [
            "ogr2ogr",
            [
              "-skipfailures",
              "-t_srs",
              "EPSG:4326",
              "-oo",
              "FLATTEN_NESTED_ATTRIBUTES=yes",
              "-splitlistfields",
              normalizedVectorPath,
              workingFilePath,
              "-nln",
              originalName,
            ],
          ],
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
            [
              "ogr2ogr",
              [
                "-skipfailures",
                "-t_srs",
                "EPSG:4326",
                "-nlt",
                "PROMOTE_TO_MULTI",
                normalizedVectorPath,
                workingFilePath,
                "-nln",
                originalName,
              ],
            ],
            "Problem converting to FlatGeobuf",
            1 / 20
          );
        }
      }

      const normalizedVectorFileSize = statSync(normalizedVectorPath).size;
      outputs.push({
        type: "FlatGeobuf",
        filename: `${uuid}.fgb`,
        remote: `${process.env.RESOURCES_REMOTE}/${baseKey}/${uuid}.fgb`,
        local: normalizedVectorPath,
        size: normalizedVectorFileSize,
        url: `${process.env.UPLOADS_BASE_URL}/${baseKey}/${uuid}.fgb`,
        isNormalizedOutput: true,
      });

      // Only convert to GeoJSON if the dataset is small. Otherwise we can convert
      // from the normalized fgb dynamically if someone wants to download it as
      // GeoJSON or shapefile.
      if (normalizedVectorFileSize <= MVT_THRESHOLD) {
        const geojsonPath = path.join(dist, name + ".geojson.json");
        await logger.exec(
          [
            "ogr2ogr",
            [
              "-skipfailures",
              "-t_srs",
              "EPSG:4326",
              "-f",
              "GeoJSON",
              "-nlt",
              "PROMOTE_TO_MULTI",
              geojsonPath,
              normalizedVectorPath,
            ],
          ],
          "Problem converting to GeoJSON",
          1 / 20
        );
        outputs.push({
          type: "GeoJSON",
          remote: `${process.env.RESOURCES_REMOTE}/${baseKey}/${uuid}.geojson.json`,
          local: geojsonPath,
          url: `${process.env.UPLOADS_BASE_URL}/${baseKey}/${uuid}.geojson.json`,
          size: statSync(geojsonPath).size,
          filename: `${uuid}.geojson.json`,
        });
        sourceUrl = `${process.env.UPLOADS_BASE_URL}/${baseKey}/${uuid}.geojson.json`;
      }

      // For some reason tippecanoe often converts numeric columns from fgb
      // to mixed and stringifies the values. To avoid that, detect numeric
      // columns using fiona (fio info) and then use the -T command to
      // manually specify the types.
      const fioInfo = await logger.exec(
        ["fio", ["info", normalizedVectorPath]],
        "Problem detecting numeric properties using fiona.",
        1 / 20
      );
      const fioData = JSON.parse(fioInfo);
      const schema = fioData?.schema?.properties || {};
      const numericAttributes: {
        name: string;
        type: "int" | "float";
        quantiles?: number[];
      }[] = [];
      for (const key in schema) {
        const type = schema[key];
        if (/int/i.test(type)) {
          numericAttributes.push({ name: key, type: "int" });
        } else if (/float/i.test(type)) {
          numericAttributes.push({ name: key, type: "float" });
        }
      }
      try {
        // If there are numeric attributes, calculate quantiles
        if (numericAttributes.length) {
          for (const attribute of numericAttributes) {
            if (
              !/fid/i.test(attribute.name) &&
              !/objectid/i.test(attribute.name) &&
              !/^id$/i.test(attribute.name)
            ) {
              const attrDataFname = path.join(
                dist,
                `details-${numericAttributes.indexOf(attribute)}.json`
              );
              const data = await logger.exec(
                [
                  "ogr2ogr",
                  [
                    attrDataFname,
                    normalizedVectorPath,
                    "-dialect",
                    "sqlite",
                    "-sql",
                    `
                    SELECT 
                      quantile, 
                      max(VALUE) as max 
                    from (
                      SELECT 
                        "${attribute.name}" as VALUE, 
                        NTILE(20) OVER (ORDER BY "${attribute.name}") as quantile 
                      FROM 
                        "${originalName}"
                    ) group by quantile
                  `,
                  ],
                ],
                "Problem calculating quantiles",
                1 / 20
              );
              const attrData = JSON.parse(
                readFileSync(attrDataFname).toString()
              );
              if (attrData && attrData.features.length) {
                attribute.quantiles = [];
                for (const feature of attrData.features) {
                  if (
                    attribute.quantiles.indexOf(feature.properties.max) === -1
                  ) {
                    attribute.quantiles.push(feature.properties.max);
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        // Don't do anything if quantiles fail
        console.error("Failed to generate quantiles");
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
          [
            "tippecanoe",
            [
              ...numericAttributes
                .map((a) => [`-T`, `${a.name}:${a.type}`])
                .flat(),
              "-n",
              `"${originalName}"`,
              "-zg",
              "--drop-densest-as-needed",
              "-l",
              `${originalName}`,
              "-o",
              mvtPath,
              normalizedVectorPath,
            ],
          ],
          "Tippecanoe failed",
          10 / 20
        );
        await logger.exec(
          [`pmtiles`, ["convert", mvtPath, pmtilesPath]],
          "PMTiles conversion failed",
          2 / 20
        );
        outputs.push({
          type: "PMTiles",
          remote: `${process.env.TILES_REMOTE}/${baseKey}/${uuid}.pmtiles`,
          local: pmtilesPath,
          size: statSync(pmtilesPath).size,
          url: `${process.env.TILES_BASE_URL}/${baseKey}/${uuid}.pmtiles`,
          filename: `${uuid}.pmtiles`,
        });
        sourceUrl = `${process.env.TILES_BASE_URL}/${baseKey}/${uuid}`;

        // Collect mapbox-geostats from mbtiles archive
        // (generated automatically by tippecanoe)
        const info = await statsFromMBTiles(mvtPath);
        stats = info.geostats;
        for (const attr of stats?.attributes || []) {
          const numeric = numericAttributes.find(
            (a) => a.name === attr.attribute
          );
          if (numeric && numeric.quantiles) {
            attr.quantiles = numeric.quantiles;
          }
        }
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

      for (const attr of stats?.attributes || []) {
        const numeric = numericAttributes.find(
          (a) => a.name === attr.attribute
        );
        if (numeric && numeric.quantiles) {
          attr.quantiles = numeric.quantiles;
        }
      }
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
        await putObject(output.local, output.remote, logger, 2 / 20);
      } else if (/r2:/.test(output.remote)) {
        await putObject(output.local, output.remote, logger, 2 / 20);
      } else {
        throw new Error(`Unrecognized remote ${output.remote}`);
      }
    }
    await updateProgress("worker_complete", 1);
    const logPath = path.join(tmpobj.name, "log.txt");
    writeFileSync(logPath, logger.output);
    await putObject(logPath, s3LogPath, logger);
    if (!sourceUrl) {
      throw new Error("sourceUrl not set");
    }
    const response = {
      layers: [
        {
          filename: originalName + ext,
          name: originalName,
          geostats: stats,
          outputs: outputs.map((o) => ({
            ...o,
            local: undefined,
            filename: o.filename,
          })),
          bounds: bounds || undefined,
          url: sourceUrl,
          isSingleBandRaster:
            isTif && rasterInfo.colorInterp === ColorInterp.GRAY,
        } as ProcessedUploadLayer,
      ],
      logfile: s3LogPath,
    };
    // Trigger the task to process the outputs
    await pgClient.query(
      `SELECT graphile_worker.add_job('processDataUploadOutputs', $1::json)`,
      [
        JSON.stringify({
          uploadId: uuid,
          data: response,
        }),
      ]
    );
    return response;
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
    command: [string, string[]],
    throwMsg: string,
    progressFraction?: number
  ): Promise<string> {
    // console.log("exec " + command[0] + " " + command[1].join(" "));
    let stdout = "";
    const self = this;
    return new Promise((resolve, reject) => {
      let progress = 0;
      self.output += `${command[0]} ${command[1].join(" ")}\n`;
      const child = spawn(command[0], command[1]);

      const progressRegExp = /([\d\.]+)%/;

      child.stdout.setEncoding("utf8");
      child.stdout.on("data", function (data) {
        // console.log(`stdout: ${data}`);
        if (progressFraction && progressRegExp.test(data.toString())) {
          const newProgress = parseFloat(
            data.toString().match(progressRegExp)[1]
          );
          const increment = newProgress - progress;
          progress = newProgress;
          self.updateProgress((increment / 100) * progressFraction);
        }
        stdout += data.toString();
        self.output += data.toString() + "\n";
      });

      child.stderr.setEncoding("utf8");
      child.stderr.on("data", function (data) {
        // console.log(`stderr: ${data}`);
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
        self.output += data.toString() + "\n";
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
  logger.output += `getObject ${remote} to ${filepath}\n`;
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
  user: string,
  error: string
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
          text: error,
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
