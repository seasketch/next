import {
  RasterInfo,
  SuggestedRasterPresentation,
} from "@seasketch/geostats-types";
import {
  ProgressUpdater,
  ResponseOutput,
  SupportedTypes,
} from "./handleUpload";
import { parse as parsePath, join as pathJoin } from "path";
import { statSync } from "fs";
import { rasterInfoForBands } from "../rasterInfoForBands";
import { Logger } from "./logger";

export async function processRasterUpload(options: {
  logger: Logger;
  /** Path to original upload */
  path: string;
  /** Outputs will be uploaded to r2 after processing */
  outputs: (ResponseOutput & { local: string })[];
  updateProgress: ProgressUpdater;
  // Base of key in object store (r2 or s3) where outputs will be stored
  baseKey: string;
  /** Tmp directory for storing outputs and derivative files */
  workingDirectory: string;
  /** filename for outputs. Should be something unique, like jobid */
  jobId: string;
  /** Santitized original filename. Used for layer name */
  originalName: string;
}): Promise<RasterInfo> {
  const {
    logger,
    outputs,
    updateProgress,
    baseKey,
    workingDirectory,
    jobId,
    originalName,
  } = options;
  // Step 2) Use ogr/gdal to see if it is a supported file format
  await updateProgress("running", "validating");
  let type: SupportedTypes;
  let path = options.path;
  const originalPath = options.path;
  let { ext } = parsePath(path);
  const isTif = ext === ".tif" || ext === ".tiff";
  if (!isTif) {
    throw new Error("Only GeoTIFF files are supported");
  }
  // Raster specific
  type = "GeoTIFF";

  const rioInfo = await logger.exec(
    ["rio", ["info", path]],
    "Problem reading file. Rasters should be uploaded as GeoTIFF.",
    2 / 30
  );
  const rioData = JSON.parse(rioInfo);
  if (rioData.driver !== "GTiff") {
    throw new Error(`Unrecognized raster driver "${rioData.driver}"`);
  }

  const isCorrectProjection = rioData.crs === "EPSG:3857";
  let resolution = rioData.transform[0];

  const fc = await logger.exec(
    ["rio", ["bounds", path]],
    "Problem determining bounds of raster",
    2 / 30
  );
  const bounds = JSON.parse(fc).bbox;

  if (!isCorrectProjection) {
    // use rio warp to reproject tif
    const warpedPath = pathJoin(workingDirectory, jobId + ".warped.tif");
    await logger.exec(
      ["rio", ["warp", path, warpedPath, "--dst-crs", "EPSG:3857"]],
      "Problem reprojecting raster",
      5 / 30
    );
    path = warpedPath;
    const inputExt = parsePath(path).ext;
  }

  const stats = await rasterInfoForBands(path);

  if (
    stats.presentation === SuggestedRasterPresentation.categorical &&
    stats.bands[0].colorInterpretation?.toLowerCase() === "palette"
  ) {
    // use pct2rgb.py to convert to rgb
    const rgbPath = pathJoin(workingDirectory, jobId + ".rgb.tif");
    await logger.exec(
      ["gdal_translate", ["-expand", "rgb", path, rgbPath]],
      "Problem converting palletized raster to RGB",
      2 / 30
    );
    path = rgbPath;
  } else if (stats.presentation === SuggestedRasterPresentation.continuous) {
    // If singleband, determine scale ratio. Otherwise set to 1
    // An example of using the scale ratio is a single-band raster with 8-bit
    // float values 0 - 1. We want to scale these to 0 - 255 so they can be
    // displayed in grayscale.
    let scaleRatio = 254 / stats.bands[0].maximum;
    // use rio to convert to rgb
    const rgbPath = pathJoin(workingDirectory, jobId + "-rgb.png");
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
          path,
          rgbPath,
        ],
      ],
      "Problem converting raster to RGB",
      2 / 30
    );
    path = rgbPath;
  }

  outputs.push({
    type: ext === ".tif" || ext === ".tiff" ? "GeoTIFF" : "PNG",
    remote: `${process.env.RESOURCES_REMOTE}/${baseKey}/${jobId}${ext}`,
    local: path,
    size: statSync(path).size,
    url: `${process.env.UPLOADS_BASE_URL}/${baseKey}/${jobId}${ext}`,
    filename: `${originalName}${ext}`,
    isOriginal: true,
    isNormalizedOutput: path === originalPath,
  });

  // Add transformed file to outputs
  if (path !== originalPath) {
    const inputExt = parsePath(path).ext;
    outputs.push({
      type: inputExt === ".tif" || inputExt === ".tiff" ? "GeoTIFF" : "PNG",
      remote: `${process.env.RESOURCES_REMOTE}/${baseKey}/${jobId}${inputExt}`,
      local: path,
      size: statSync(path).size,
      url: `${process.env.UPLOADS_BASE_URL}/${baseKey}/${jobId}${inputExt}`,
      filename: `${jobId}${inputExt}`,
      isNormalizedOutput: true,
    });
  }

  await updateProgress("running", "tiling");
  const mbtilesPath = pathJoin(workingDirectory, jobId + ".mbtiles");

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
        `NAME=${originalName}`,
        path,
        mbtilesPath,
      ],
    ],
    "Problem converting raster to mbtiles",
    8 / 30
  );

  // TODO: how can we make this tile all the way back to z=5 at least?
  await logger.exec(
    ["gdaladdo", ["-minsize", "8", "-r", "nearest", mbtilesPath]],
    "Problem adding overviews to mbtiles",
    4 / 30
  );

  // Convert to pmtiles
  const pmtilesPath = pathJoin(workingDirectory, jobId + ".pmtiles");
  await logger.exec(
    [`pmtiles`, ["convert", mbtilesPath, pmtilesPath]],
    "PMTiles conversion failed",
    4 / 30
  );
  outputs.push({
    type: "PMTiles",
    remote: `${process.env.TILES_REMOTE}/${baseKey}/${jobId}.pmtiles`,
    local: pmtilesPath,
    size: statSync(pmtilesPath).size,
    url: `${process.env.TILES_BASE_URL}/${baseKey}/${jobId}.pmtiles`,
    filename: `${jobId}.pmtiles`,
  });

  // Assign bounds from rio bounds command output
  for (const band of stats.bands) {
    band.bounds = bounds;
  }

  return stats;
}
