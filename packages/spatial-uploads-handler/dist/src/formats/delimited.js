"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertDelimitedToGeoJSON = convertDelimitedToGeoJSON;
const SEPARATOR_BY_DELIMITER = {
    ",": "COMMA",
    "\t": "TAB",
    ";": "SEMICOLON",
    "|": "PIPE",
};
/**
 * Converts a delimited text file (CSV/TSV/TXT) to GeoJSON using GDAL's CSV
 * driver, based on the column mapping and CRS chosen by the user (or
 * auto-detected client-side). The resulting file feeds into the same
 * normalize-to-FlatGeobuf/tiling pipeline used for other vector formats.
 *
 * See https://gdal.org/en/stable/drivers/vector/csv.html for open option
 * reference.
 */
async function convertDelimitedToGeoJSON(logger, inputPath, outputPath, options) {
    if (options.crs && options.crs !== "EPSG:4326") {
        throw new Error("Only WGS 84 (EPSG:4326) decimal degree coordinates are supported for delimited uploads.");
    }
    const openOptions = [
        "-oo",
        `SEPARATOR=${SEPARATOR_BY_DELIMITER[options.delimiter]}`,
        "-oo",
        `HEADERS=${options.hasHeaderRow ? "YES" : "NO"}`,
        // Geometry columns are already represented as the output geometry; don't
        // duplicate them as regular attributes.
        "-oo",
        "KEEP_GEOM_COLUMNS=NO",
    ];
    if (options.geometryMode === "wkt") {
        if (!options.geometryField) {
            throw new Error("processingOptions.geometryField is required when geometryMode is 'wkt'");
        }
        openOptions.push("-oo", `GEOM_POSSIBLE_NAMES=${options.geometryField}`);
    }
    else {
        if (!options.xField || !options.yField) {
            throw new Error("processingOptions.xField and yField are required when geometryMode is 'point_xy'");
        }
        openOptions.push("-oo", `X_POSSIBLE_NAMES=${options.xField}`, "-oo", `Y_POSSIBLE_NAMES=${options.yField}`);
    }
    await logger.exec([
        "ogr2ogr",
        [
            "-f",
            "GeoJSON",
            "-s_srs",
            "EPSG:4326",
            "-t_srs",
            "EPSG:4326",
            "-skipfailures",
            ...openOptions,
            outputPath,
            inputPath,
        ],
    ], "Problem converting delimited text file to spatial data. Double check the selected columns and coordinate reference system.", 2 / 30);
}
//# sourceMappingURL=delimited.js.map