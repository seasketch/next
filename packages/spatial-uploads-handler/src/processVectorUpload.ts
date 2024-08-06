import { GeostatsLayer, RasterInfo } from "@seasketch/geostats-types";
import {
  MVT_THRESHOLD,
  ProgressUpdater,
  ResponseOutput,
  SupportedTypes,
} from "./handleUpload";
import { parse as parsePath, join as pathJoin } from "path";
import { statSync } from "fs";
import { geostatsForVectorLayers } from "./geostatsForVectorLayer";
import { Logger } from "./logger";

/**
 * Process a vector upload, converting it to a normalized FlatGeobuf file and
 * creating vector tiles if the file is under a certain size.
 *
 * @param options
 * @returns
 */
export async function processVectorUpload(options: {
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
}): Promise<GeostatsLayer[]> {
  const {
    logger,
    path,
    outputs,
    updateProgress,
    baseKey,
    workingDirectory,
    jobId,
    originalName,
  } = options;
  const originalFilePath = path;
  let workingFilePath = path;
  await updateProgress("running", "validating");

  let type: SupportedTypes;
  let { ext } = parsePath(path);
  const isZip = ext === ".zip";

  // Step 1) Unzip if necessary, and assume it is a shapefile
  if (isZip) {
    await updateProgress("running", "unzipping");
    // // Unzip the file
    await logger.exec(
      ["unzip", ["-o", workingFilePath, "-d", workingDirectory]],
      "Problem unzipping file",
      1 / 30
    );

    await updateProgress("running", "looking for .shp");
    // Find the first shapefile (.shp) in the working Dir
    const shapefile = await logger.exec(
      [
        "find",
        [
          workingDirectory,
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
      1 / 30
    );
    // Consider that there may be multiple shapefiles in the zip archive
    // and choose the first one
    workingFilePath = shapefile.split("\n")[0].trim();
  }

  await updateProgress("running", "validating");

  // First, determine the type of file and evaluate whether it is in the list
  // of supported types
  const ogrInfo = await logger.exec(
    ["ogrinfo", ["-al", "-so", workingFilePath]],
    ext === ".shp"
      ? "Could not read file. Shapefiles should be uploaded as a zip archive with related sidecar files"
      : "Could not run ogrinfo on file",
    1 / 30
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

  // Save original file to the list of outputs, with its determined type
  const originalOutput = {
    type: type,
    filename: jobId + ext,
    remote: `${process.env.RESOURCES_REMOTE}/${baseKey}/${jobId}${ext}`,
    local: originalFilePath,
    size: statSync(originalFilePath).size,
    url: `${process.env.UPLOADS_BASE_URL}/${baseKey}/${jobId}${ext}`,
    isOriginal: true,
  };
  outputs.push(originalOutput);

  // Convert vector to a normalized FlatGeobuf file for long-term archiving
  // and for tiling.
  const normalizedVectorPath = pathJoin(workingDirectory, jobId + ".fgb");
  await updateProgress("running", "converting format");
  await logger.exec(
    [
      "ogr2ogr",
      [
        "-skipfailures",
        "-t_srs",
        "EPSG:4326",
        "-nlt",
        "PROMOTE_TO_MULTI",
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
    2 / 30
  );

  // Save normalized vector to the list of outputs
  const normalizedVectorFileSize = statSync(normalizedVectorPath).size;
  console.log("size", normalizedVectorFileSize);
  outputs.push({
    type: "FlatGeobuf",
    filename: `${jobId}.fgb`,
    remote: `${process.env.RESOURCES_REMOTE}/${baseKey}/${jobId}.fgb`,
    local: normalizedVectorPath,
    size: normalizedVectorFileSize,
    url: `${process.env.UPLOADS_BASE_URL}/${baseKey}/${jobId}.fgb`,
    isNormalizedOutput: true,
  });

  // Compute metadata useful for cartography and data handling
  const stats = await geostatsForVectorLayers(normalizedVectorPath);

  // Only convert to GeoJSON if the dataset is small. Otherwise we can convert
  // from the normalized fgb dynamically if someone wants to download it as
  // GeoJSON or shapefile.
  const underThreshold =
    normalizedVectorFileSize <= MVT_THRESHOLD ||
    (originalOutput.type === "GeoJSON" &&
      originalOutput.size <= MVT_THRESHOLD * 10);

  if (underThreshold) {
    const geojsonPath = pathJoin(workingDirectory, jobId + ".geojson.json");
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
      15 / 30
    );
    // Save GeoJSON to the list of outputs
    // The calling lambda will look through the list of outputs and choose
    // GeoJSON as the primary data source only if a PMTiles output is not found
    outputs.push({
      type: "GeoJSON",
      remote: `${process.env.RESOURCES_REMOTE}/${baseKey}/${jobId}.geojson.json`,
      local: geojsonPath,
      url: `${process.env.UPLOADS_BASE_URL}/${baseKey}/${jobId}.geojson.json`,
      size: statSync(geojsonPath).size,
      filename: `${jobId}.geojson.json`,
    });
  }

  // If under MVT_THRESHOLD, create vector tiles
  if (normalizedVectorFileSize >= MVT_THRESHOLD) {
    // For some reason tippecanoe often converts numeric columns from fgb
    // to mixed and stringifies the values. To avoid that, detect numeric
    // columns using fiona (fio info) and then use the -T command to
    // manually specify the types.
    const fioInfo = await logger.exec(
      ["fio", ["info", normalizedVectorPath]],
      "Problem detecting numeric properties using fiona.",
      1 / 30
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
    const mvtPath = pathJoin(workingDirectory, jobId + ".mbtiles");
    const pmtilesPath = pathJoin(workingDirectory, jobId + ".pmtiles");
    await updateProgress("running", "tiling");
    const geometryType = Array.isArray(stats)
      ? stats[0].geometry
      : (stats as any).geometry;
    await logger.exec(
      [
        "tippecanoe",
        [
          ...numericAttributes.map((a) => [`-T`, `${a.name}:${a.type}`]).flat(),
          "-n",
          `"${originalName}"`,
          "-zg",
          ...(/point/i.test(geometryType)
            ? [
                // prevent tippecanoe from dropping too many points
                // https://github.com/felt/tippecanoe?tab=readme-ov-file#dropping-a-fixed-fraction-of-features-by-zoom-level
                "-r",
                "1.5",
              ]
            : []),
          "--generate-ids",
          "--drop-densest-as-needed",
          "-l",
          `${(Array.isArray(stats) ? stats[0] : stats).layer}`,
          "-o",
          mvtPath,
          normalizedVectorPath,
        ],
      ],
      "Tippecanoe failed",
      12 / 30
    );
    // TODO: at some point a newer tippecanoe can be used to save directly to
    // pmtiles
    await logger.exec(
      [`pmtiles`, ["convert", mvtPath, pmtilesPath]],
      "PMTiles conversion failed",
      3 / 30
    );
    outputs.push({
      type: "PMTiles",
      remote: `${process.env.TILES_REMOTE}/${baseKey}/${jobId}.pmtiles`,
      local: pmtilesPath,
      size: statSync(pmtilesPath).size,
      url: `${process.env.TILES_BASE_URL}/${baseKey}/${jobId}.pmtiles`,
      filename: `${jobId}.pmtiles`,
    });
  }

  return stats;
}
