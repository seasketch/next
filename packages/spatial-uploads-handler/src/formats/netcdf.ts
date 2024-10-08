import gdal from "gdal-async";
import { Logger } from "../logger";

export async function getLayerIdentifiers(path: string, logger: Logger) {
  const ids: string[] = [];
  const data = await logger.exec(
    ["gdalinfo", ["-json", path]],
    "Problem getting layer identifiers"
  );
  const info = JSON.parse(data);
  const metadata = info.metadata || {};
  const subdatasets = metadata["SUBDATASETS"] || {};
  for (const key in subdatasets) {
    if (/_NAME$/.test(key)) {
      ids.push(subdatasets[key]);
    }
  }
  console.log("ids", ids);
  return ids;
}

export async function convertToGeoTiff(
  layerId: string,
  outputPath: string,
  logger: Logger
) {
  await logger.exec(
    ["gdal_translate", ["-co", "COMPRESS=DEFLATE", layerId, outputPath]],
    "Problem converting to GeoTIFF"
  );
  return outputPath;
}
