"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLayerIdentifiers = getLayerIdentifiers;
exports.convertToGeoTiff = convertToGeoTiff;
async function getLayerIdentifiers(path, logger) {
    const ids = [];
    const data = await logger.exec(["gdalinfo", ["-json", path]], "Problem getting layer identifiers");
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
async function convertToGeoTiff(layerId, outputPath, logger) {
    await logger.exec(["gdal_translate", ["-co", "COMPRESS=DEFLATE", layerId, outputPath]], "Problem converting to GeoTIFF");
    return outputPath;
}
//# sourceMappingURL=netcdf.js.map