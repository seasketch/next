import {
  RasterInfo,
  SuggestedRasterPresentation,
} from "@seasketch/geostats-types";
import { ProgressUpdater, ResponseOutput } from "./handleUpload";
import { parse as parsePath, join as pathJoin } from "path";
import { statSync } from "fs";
import { rasterInfoForBands } from "./rasterInfoForBands";
import { Logger } from "./logger";
import gdal from "gdal-async";

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
  await updateProgress("running", "validating");
  let path = options.path;
  const originalPath = options.path;

  const { ext, isCorrectProjection } = await validateInput(path, logger);

  // Get raster stats
  const stats = await rasterInfoForBands(path);

  const size = statSync(path).size;

  // Reproject files > 2MB in case blocksize is too small
  if (!isCorrectProjection || size > 2_000_000) {
    await updateProgress("running", "reprojecting");
    // use rio warp to reproject tif
    const warpedPath = pathJoin(workingDirectory, jobId + ".warped.tif");
    await logger.exec(
      [
        "gdalwarp",
        [
          "-r",
          stats.presentation === SuggestedRasterPresentation.rgb
            ? "cubic"
            : stats.presentation === SuggestedRasterPresentation.categorical ||
              stats.byteEncoding
            ? "mode"
            : "nearest",
          "-t_srs",
          "EPSG:3857",
          "-co",
          "COMPRESS=DEFLATE",
          path,
          warpedPath,
        ],
      ],
      "Problem reprojecting raster",
      2 / 30
    );
    path = warpedPath;
  }

  // Add original file to outputs
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

  // Add transformed file to outputs, if different from original
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

  // Assign bounds from rio bounds command output
  const fc = await logger.exec(
    ["rio", ["bounds", path]],
    "Problem determining bounds of raster",
    2 / 30
  );
  const bounds = JSON.parse(fc).bbox;
  for (const band of stats.bands) {
    band.bounds = bounds;
  }

  if (
    stats.presentation === SuggestedRasterPresentation.categorical ||
    stats.presentation === SuggestedRasterPresentation.continuous
  ) {
    await updateProgress("running", "encoding");
    path = await encodeValuesToRGB(
      path,
      logger,
      workingDirectory,
      stats.bands[0].noDataValue,
      stats.bands[0].base,
      stats.bands[0].interval,
      jobId
    );
  }

  await updateProgress("running", "tiling");

  const pmtilesPath = await createPMTiles(
    path,
    logger,
    workingDirectory,
    jobId,
    originalName,
    stats.presentation
  );

  outputs.push({
    type: "PMTiles",
    remote: `${process.env.TILES_REMOTE}/${baseKey}/${jobId}.pmtiles`,
    local: pmtilesPath,
    size: statSync(pmtilesPath).size,
    url: `${process.env.TILES_BASE_URL}/${baseKey}/${jobId}.pmtiles`,
    filename: `${jobId}.pmtiles`,
  });

  return stats;
}

async function validateInput(path: string, logger: Logger) {
  let { ext } = parsePath(path);

  // Use rasterio to see if it is a supported file format
  const isTif = ext === ".tif" || ext === ".tiff";
  if (!isTif) {
    throw new Error("Only GeoTIFF files are supported");
  }

  const ds = await gdal.openAsync(path);
  if (ds.driver.description !== "GTiff") {
    throw new Error(`Unrecognized raster driver "${ds.driver.description}"`);
  }

  const isCorrectProjection =
    ds.srs &&
    ds.srs.getAuthorityName() === "EPSG" &&
    ds.srs.getAuthorityCode() === "3857";

  return {
    isCorrectProjection,
    crs: ds.srs
      ? `${ds.srs.getAuthorityName()}:${ds.srs.getAuthorityCode()}`
      : null,
    ext,
  };
}

async function createPMTiles(
  path: string,
  logger: Logger,
  workingDirectory: string,
  jobId: string,
  layerName: string,
  presentation: SuggestedRasterPresentation
) {
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
        `NAME=${layerName}`,
        path,
        mbtilesPath,
      ],
    ],
    "Problem converting raster to mbtiles",
    8 / 30
  );

  // TODO: how can we make this tile all the way back to z=5 at least?
  // Research Notes 5/5/24 - Chad Burt
  // gdaladdo may quit once the overview would be < 128 pixels on a side.
  // The way to add one more zoom level would be to perform the following steps:
  //   * Figure out the zoom range in the mbtiles (e.g. 6-9)
  //   * Calculate the size reduction (e.g. 9-6=3. 3**2 = 8x. Need 16x next)
  //   * Use gdal_translate to resize the tif.
  //     (gdal_translate -outsize 6.25% 6.25% input.tif output.tif)
  //   * Convert to mbtiles again
  //   * Use a script like the following to merge the 2 mbtiles archives
  //     https://github.com/mapbox/mbutil/blob/d495c0a737f4bce5fde8e707fe267674be39369a/patch
  //
  // I'm not sure it's worth it to do all that at this point.

  const ds = await gdal.openAsync(mbtilesPath);
  const maxzoom = parseInt((await ds.getMetadataAsync()).maxzoom);
  let overviews = [];
  if (maxzoom) {
    let zoom = maxzoom - 1;
    while (zoom > 1) {
      overviews.push(2 ** (maxzoom - zoom));
      zoom--;
    }
  }

  await logger.exec(
    [
      "gdaladdo",
      [
        "-r",
        presentation === SuggestedRasterPresentation.rgb ? "cubic" : "nearest",
        mbtilesPath,
        ...overviews.map((o) => o.toString()),
      ],
    ],
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

  return pmtilesPath;
}

async function encodeValuesToRGB(
  path: string,
  logger: Logger,
  workingDirectory: string,
  noDataValue: number | null,
  base: number,
  interval: number,
  jobId?: string
) {
  const rel = (p: string) => pathJoin(workingDirectory, p);

  const operations: { [fname: string]: string } = {
    "temp_r.tif": `
      floor(
        (
          (
            ( A - ${base} ) * ${1 / interval}
          ) + 32768
        ) / 65536
      )
    `,
    "temp_g.tif": `
      floor(
        (
          (
            (
              (A - ${base}) * ${1 / interval}
            ) + 32768
          ) % 65536
        ) / 256
      )
    `,
    "temp_b.tif": `
      (
        floor(
          (A - ${base}) * ${1 / interval}
        ) + 32768
      ) % 256
    `,
  };

  if (noDataValue !== null) {
    operations["temp_a.tif"] = `255*(A!=${noDataValue})`;
  }

  for (const [output, formula] of Object.entries(operations)) {
    await logger.exec(
      [
        "gdal_calc.py",
        [
          "-A",
          path,
          "--outfile",
          rel(output),
          "--calc",
          formula.replace(/\n/g, "").trim(),
          "--NoDataValue",
          "0",
          "--type",
          "Byte",
          "--creation-option",
          "COMPRESS=DEFLATE",
        ],
      ],
      `Problem creating ${output}`
    );
  }

  // Step 2: Merge Bands into a Single RGB TIFF
  const vrtInputs = [rel("temp_r.tif"), rel("temp_g.tif"), rel("temp_b.tif")];
  if (noDataValue !== null) {
    vrtInputs.push(rel("temp_a.tif"));
  }
  const vrtFname = rel(noDataValue === null ? "temp_rgb.vrt" : "temp_rgba.vrt");
  await logger.exec(
    ["gdalbuildvrt", ["-separate", vrtFname, ...vrtInputs]],
    "Problem building VRT"
  );
  const encodedFname = rel(
    noDataValue === null ? "output_encoded_rgb.tif" : "output_encoded_rgba.tif"
  );
  await logger.exec(
    ["gdal_translate", ["-co", "COMPRESS=DEFLATE", vrtFname, encodedFname]],
    "Problem converting VRT to RGB TIFF"
  );

  return encodedFname;
}
