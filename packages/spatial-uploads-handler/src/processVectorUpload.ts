import {
  GeostatsLayer,
  GeostatsMetadata,
  RasterInfo,
} from "@seasketch/geostats-types";
import {
  MVT_THRESHOLD,
  ProgressUpdater,
  ResponseOutput,
  SupportedTypes,
} from "./handleUpload";
import { parse as parsePath, join as pathJoin } from "path";
import { readFileSync, statSync } from "fs";
import { geostatsForVectorLayers } from "./geostatsForVectorLayer";
import { Logger } from "./logger";
import { defaultMarkdownParser } from "prosemirror-markdown";
import { metadataToProseMirror } from "@seasketch/metadata-parser";

export default function fromMarkdown(md: string) {
  return defaultMarkdownParser.parse(md)?.toJSON();
}

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
  const isRar = ext === ".rar";
  let metadata: GeostatsMetadata | null = null;

  // Step 1) Unzip if necessary, and assume it is a shapefile
  if (isZip || isRar) {
    await updateProgress("running", "unzipping");
    // // Unzip the file
    if (isZip) {
      await logger.exec(
        ["unzip", ["-o", workingFilePath, "-d", workingDirectory]],
        "Problem unzipping file",
        1 / 30
      );
    } else {
      await logger.exec(
        ["unrar", ["x", "-op" + workingDirectory, workingFilePath]],
        "Problem extracting .rar file",
        1 / 30
      );
    }

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

    // Make sure there is also a .prj projection file
    const projFile = await logger.exec(
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
          "*.prj",
        ],
      ],
      "Problem finding projection file (.prj) in zip archive",
      1 / 30
    );

    if (!projFile) {
      throw new Error("No projection file found (.prj) in zip archive");
    }
    if (!shapefile) {
      if (isZip) {
        throw new Error("No shape-file (.shp) found in zip archive");
      } else if (isRar) {
        throw new Error("No shape-file (.shp) found in rar archive");
      } else {
        throw new Error("No shape-file (.shp) found in archive");
      }
    }

    // Consider that there may be multiple shapefiles in the zip archive
    // and choose the first one
    workingFilePath = shapefile.split("\n")[0].trim();
    const { ext } = parsePath(workingFilePath);
    // Look for a matching file with a .xml extension
    const xmlPaths = await logger.exec(
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
          "*.xml",
        ],
      ],
      "Problem finding metadata files in zip archive",
      1 / 30
    );
    try {
      if (xmlPaths) {
        const paths = xmlPaths.trim().split("\n");
        for (const xmlPath of paths) {
          try {
            const data = readFileSync(xmlPath.trim(), "utf8");
            const parsedMetadata = await metadataToProseMirror(data);
            if (parsedMetadata && Object.keys(parsedMetadata).length > 0) {
              metadata = parsedMetadata;
              outputs.push({
                type: "XMLMetadata",
                filename: xmlPath.split("/").pop()!,
                remote: `${
                  process.env.RESOURCES_REMOTE
                }/${baseKey}/${jobId}/${xmlPath.split("/").pop()!}`,
                local: xmlPath,
                size: statSync(xmlPath).size,
                url: `${
                  process.env.UPLOADS_BASE_URL
                }/${baseKey}/${jobId}/${xmlPath.split("/").pop()!}`,
              });
              break;
            }
          } catch (e) {
            console.error("Problem parsing xml metadata");
            console.error(e);
          }
        }
      }
    } catch (e) {
      // no metadata files
    }
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

  let isCorrectProjection = false;
  if (/World Geodetic System 1984/.test(ogrInfo)) {
    isCorrectProjection = true;
  }

  // Save original file to the list of outputs, with its determined type
  const originalOutput = {
    type,
    filename: jobId + ext,
    remote: `${process.env.RESOURCES_REMOTE}/${baseKey}/${jobId}${ext}`,
    local: originalFilePath,
    size: statSync(originalFilePath).size,
    url: `${process.env.UPLOADS_BASE_URL}/${baseKey}/${jobId}${ext}`,
    isOriginal: true,
    isNormalizedOutput: isCorrectProjection && type === "FlatGeobuf",
  };
  outputs.push(originalOutput);

  let normalizedVectorPath = workingFilePath;
  let normalizedVectorFileSize = statSync(workingFilePath).size;
  if (!isCorrectProjection || type !== "FlatGeobuf") {
    // Convert vector to a normalized FlatGeobuf file for long-term archiving
    // and for tiling.
    normalizedVectorPath = pathJoin(workingDirectory, jobId + ".fgb");
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
    normalizedVectorFileSize = statSync(normalizedVectorPath).size;
    outputs.push({
      type: "FlatGeobuf",
      filename: `${jobId}.fgb`,
      remote: `${process.env.RESOURCES_REMOTE}/${baseKey}/${jobId}.fgb`,
      local: normalizedVectorPath,
      size: normalizedVectorFileSize,
      url: `${process.env.UPLOADS_BASE_URL}/${baseKey}/${jobId}.fgb`,
      isNormalizedOutput: true,
    });
  }

  // Compute metadata useful for cartography and data handling
  const stats = await geostatsForVectorLayers(normalizedVectorPath);

  if (metadata) {
    stats[0].metadata = metadata;
  }
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
                "1",
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
