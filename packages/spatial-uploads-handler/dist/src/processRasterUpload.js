"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processRasterUpload = processRasterUpload;
const geostats_types_1 = require("@seasketch/geostats-types");
const path_1 = require("path");
const fs_1 = require("fs");
const rasterInfoForBands_1 = require("./rasterInfoForBands");
const gdal_async_1 = __importDefault(require("gdal-async"));
const bbox_1 = __importDefault(require("@turf/bbox"));
const netcdf_1 = require("./formats/netcdf");
async function processRasterUpload(options) {
    const { logger, outputs, updateProgress, baseKey, workingDirectory, jobId, originalName, } = options;
    await updateProgress("running", "validating");
    let path = options.path;
    const originalPath = options.path;
    const { ext, isCorrectProjection } = await validateInput(path, logger);
    if (ext === ".nc") {
        const layerIdentifiers = await (0, netcdf_1.getLayerIdentifiers)(path, logger);
        if (layerIdentifiers.length > 0) {
            path = await (0, netcdf_1.convertToGeoTiff)(layerIdentifiers[0], (0, path_1.join)(workingDirectory, jobId + ".tif"), logger);
        }
        else {
            throw new Error("No layers found in NetCDF file");
        }
    }
    await updateProgress("running", "analyzing");
    // Get raster stats
    const stats = await (0, rasterInfoForBands_1.rasterInfoForBands)(path);
    const size = (0, fs_1.statSync)(path).size;
    // Reproject files > 2MB in case blocksize is too small
    if (!isCorrectProjection || size > 2000000) {
        await updateProgress("running", "reprojecting");
        // use rio warp to reproject tif
        const warpedPath = (0, path_1.join)(workingDirectory, jobId + ".warped.tif");
        await logger.exec([
            "gdalwarp",
            [
                "-r",
                stats.presentation === geostats_types_1.SuggestedRasterPresentation.rgb
                    ? "cubic"
                    : "mode",
                "-t_srs",
                "EPSG:3857",
                "-co",
                "COMPRESS=DEFLATE",
                path,
                warpedPath,
            ],
        ], "Problem reprojecting raster", 2 / 30);
        path = warpedPath;
    }
    // Add original file to outputs
    outputs.push({
        type: ext === ".tif" || ext === ".tiff"
            ? "GeoTIFF"
            : ext === ".nc"
                ? "NetCDF"
                : "PNG",
        remote: `${process.env.RESOURCES_REMOTE}/${baseKey}/${jobId}${ext}`,
        local: path,
        size: (0, fs_1.statSync)(path).size,
        url: `${process.env.UPLOADS_BASE_URL}/${baseKey}/${jobId}${ext}`,
        filename: `${originalName}${ext}`,
        isOriginal: true,
        isNormalizedOutput: path === originalPath,
    });
    // Add transformed file to outputs, if different from original
    if (path !== originalPath) {
        const inputExt = (0, path_1.parse)(path).ext;
        outputs.push({
            type: inputExt === ".tif" || inputExt === ".tiff" ? "GeoTIFF" : "PNG",
            remote: `${process.env.RESOURCES_REMOTE}/${baseKey}/${jobId}${inputExt}`,
            local: path,
            size: (0, fs_1.statSync)(path).size,
            url: `${process.env.UPLOADS_BASE_URL}/${baseKey}/${jobId}${inputExt}`,
            filename: `${jobId}${inputExt}`,
            isNormalizedOutput: true,
        });
    }
    // Assign bounds from rio bounds command output
    const info = await logger.exec(["gdalinfo", ["-json", path]], "Problem running gdalinfo on raster", 2 / 30);
    const bounds = (0, bbox_1.default)(JSON.parse(info)["wgs84Extent"]);
    for (const band of stats.bands) {
        band.bounds = bounds;
    }
    if (stats.presentation === geostats_types_1.SuggestedRasterPresentation.categorical ||
        stats.presentation === geostats_types_1.SuggestedRasterPresentation.continuous) {
        await updateProgress("running", "encoding");
        path = await encodeValuesToRGB(path, logger, workingDirectory, stats.bands[0].noDataValue, stats.bands[0].base, stats.bands[0].interval, jobId);
    }
    await updateProgress("running", "tiling");
    const pmtilesPath = await createPMTiles(path, logger, workingDirectory, jobId, originalName, stats.presentation);
    outputs.push({
        type: "PMTiles",
        remote: `${process.env.TILES_REMOTE}/${baseKey}/${jobId}.pmtiles`,
        local: pmtilesPath,
        size: (0, fs_1.statSync)(pmtilesPath).size,
        url: `${process.env.TILES_BASE_URL}/${baseKey}/${jobId}.pmtiles`,
        filename: `${jobId}.pmtiles`,
    });
    return stats;
}
async function validateInput(path, logger) {
    let { ext } = (0, path_1.parse)(path);
    // Use rasterio to see if it is a supported file format
    const isTif = ext === ".tif" || ext === ".tiff";
    if (!isTif && ext !== ".nc") {
        throw new Error("Only GeoTIFF and NetCDF files are supported");
    }
    const ds = await gdal_async_1.default.openAsync(path);
    if (ds.driver.description !== "GTiff" && ds.driver.description !== "netCDF") {
        throw new Error(`Unrecognized raster driver "${ds.driver.description}"`);
    }
    const isCorrectProjection = ds.srs &&
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
async function createPMTiles(path, logger, workingDirectory, jobId, layerName, presentation) {
    const mbtilesPath = (0, path_1.join)(workingDirectory, jobId + ".mbtiles");
    await logger.exec([
        "gdal_translate",
        [
            "-of",
            "mbtiles",
            "-co",
            "BLOCKSIZE=512",
            "-co",
            "RESAMPLING=CUBIC",
            "-co",
            `NAME=${layerName}`,
            // `-co`,
            // `TILE_FORMAT=webp`,
            // `-co`,
            // `QUALITY=100`,
            path,
            mbtilesPath,
        ],
    ], "Problem converting raster to mbtiles", 8 / 30);
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
    const ds = await gdal_async_1.default.openAsync(mbtilesPath);
    const maxzoom = parseInt((await ds.getMetadataAsync()).maxzoom);
    let overviews = [];
    if (maxzoom) {
        let zoom = maxzoom - 1;
        while (zoom > 0) {
            overviews.push(2 ** (maxzoom - zoom));
            zoom--;
        }
    }
    // Skip building overviews if already at level 0
    if (overviews.length > 1) {
        await logger.exec([
            "gdaladdo",
            [
                "-r",
                // presentation === SuggestedRasterPresentation.rgb
                "cubic",
                // : "nearest",
                mbtilesPath,
                ...overviews.map((o) => o.toString()),
            ],
        ], "Problem adding overviews to mbtiles", 4 / 30);
    }
    // Convert to pmtiles
    const pmtilesPath = (0, path_1.join)(workingDirectory, jobId + ".pmtiles");
    await logger.exec([`pmtiles`, ["convert", mbtilesPath, pmtilesPath]], "PMTiles conversion failed", 4 / 30);
    return pmtilesPath;
}
async function encodeValuesToRGB(path, logger, workingDirectory, noDataValue, base, interval, jobId) {
    const rel = (p) => (0, path_1.join)(workingDirectory, p);
    const operations = {
        "temp_r.tif": `
      floor(
        (
          (
            ( A - ${base} ) * ${1 / interval}
          ) + 32768.0
        ) / 65536
      )
    `,
        "temp_g.tif": `
      floor(
        (
          (
            (
              (A - ${base}) * ${1 / interval}
            ) + 32768.0
          ) % 65536
        ) / 256
      )
    `,
        "temp_b.tif": `
      floor(
        (
          (A - ${base}) * ${1 / interval}
          + 32768.0
        ) % 256
      )
    `,
    };
    if (noDataValue !== null && !isNaN(noDataValue)) {
        operations["temp_a.tif"] = `255*(A!=${noDataValue})`;
    }
    for (const [output, formula] of Object.entries(operations)) {
        await logger.exec([
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
        ], `Problem creating ${output}`);
    }
    // Step 2: Merge Bands into a Single RGB TIFF
    const vrtInputs = [rel("temp_r.tif"), rel("temp_g.tif"), rel("temp_b.tif")];
    if (noDataValue !== null) {
        vrtInputs.push(rel("temp_a.tif"));
    }
    const vrtFname = rel(noDataValue === null ? "temp_rgb.vrt" : "temp_rgba.vrt");
    await logger.exec(["gdalbuildvrt", ["-separate", vrtFname, ...vrtInputs]], "Problem building VRT");
    const encodedFname = rel(noDataValue === null ? "output_encoded_rgb.tif" : "output_encoded_rgba.tif");
    await logger.exec(["gdal_translate", ["-co", "COMPRESS=DEFLATE", vrtFname, encodedFname]], "Problem converting VRT to RGB TIFF");
    return encodedFname;
}
//# sourceMappingURL=processRasterUpload.js.map