"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readEpsgAuthorityFromSrs = readEpsgAuthorityFromSrs;
exports.resolveEpsgFromSpatialReference = resolveEpsgFromSpatialReference;
exports.epsgFromProjJsonText = epsgFromProjJsonText;
exports.parseEpsgFromGdalsrsinfoSearchStdout = parseEpsgFromGdalsrsinfoSearchStdout;
exports.parseEpsgCodeString = parseEpsgCodeString;
exports.epsgFromGdalinfoMetadataJson = epsgFromGdalinfoMetadataJson;
exports.resolveRasterEpsg = resolveRasterEpsg;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
/**
 * Read EPSG:nnnn from OSR authority nodes (root, PROJCS, GEOGCS).
 * Caller should run `autoIdentifyEPSG()` (and optionally `morphFromESRI()`)
 * on the same SpatialReference first.
 */
function readEpsgAuthorityFromSrs(srs) {
    const candidateKeys = [null, "PROJCS", "GEOGCS"];
    for (const key of candidateKeys) {
        const auth = srs.getAuthorityName(key);
        const code = srs.getAuthorityCode(key);
        if (!auth || code == null || String(code).trim() === "") {
            continue;
        }
        if (auth.toUpperCase() !== "EPSG") {
            continue;
        }
        const n = parseInt(String(code), 10);
        if (Number.isFinite(n)) {
            return n;
        }
    }
    return null;
}
function tryResolveEpsgAfterPrepare(srs, prepare) {
    const c = srs.clone();
    prepare(c);
    return readEpsgAuthorityFromSrs(c);
}
/**
 * Resolve EPSG from a GDAL SpatialReference without mutating the input:
 * 1) autoIdentifyEPSG + authority scan (OGC / GeoTIFF-native SRS)
 * 2) morphFromESRI + autoIdentifyEPSG + scan (ESRI WKT and similar)
 */
function resolveEpsgFromSpatialReference(srs) {
    const ogc = tryResolveEpsgAfterPrepare(srs, (c) => {
        try {
            c.autoIdentifyEPSG();
        }
        catch {
            // GDAL throws when it cannot identify the CRS.
        }
    });
    if (ogc != null) {
        return ogc;
    }
    return tryResolveEpsgAfterPrepare(srs, (c) => {
        try {
            c.morphFromESRI();
        }
        catch {
            // Not ESRI WKT; ignore.
        }
        try {
            c.autoIdentifyEPSG();
        }
        catch {
            // Same as above.
        }
    });
}
/** Parse root `id` from `gdalsrsinfo -o PROJJSON` output. */
function epsgFromProjJsonText(text) {
    var _a, _b;
    try {
        const j = JSON.parse(text);
        const auth = (_a = j.id) === null || _a === void 0 ? void 0 : _a.authority;
        const code = (_b = j.id) === null || _b === void 0 ? void 0 : _b.code;
        if (!auth || code == null) {
            return null;
        }
        if (String(auth).toUpperCase() !== "EPSG") {
            return null;
        }
        const n = typeof code === "number" ? code : parseInt(String(code), 10);
        return Number.isFinite(n) ? n : null;
    }
    catch {
        return null;
    }
}
/** First standalone `EPSG:nnnn` line from `gdalsrsinfo -e` output. */
function parseEpsgFromGdalsrsinfoSearchStdout(stdout) {
    for (const line of stdout.split(/\r?\n/)) {
        const m = line.trim().match(/^EPSG:(\d+)\s*$/i);
        if (m) {
            return parseInt(m[1], 10);
        }
    }
    return null;
}
/** Parse `EPSG:4326` / `epsg:4326` style strings; rejects non-positive codes. */
function parseEpsgCodeString(value) {
    if (typeof value !== "string") {
        return null;
    }
    const m = value.trim().match(/^EPSG:(\d+)\s*$/i);
    if (!m) {
        return null;
    }
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) && n > 0 ? n : null;
}
/**
 * CF / ACDD NetCDF (and GeoTIFF derivatives) often declare EPSG in metadata
 * even when GDAL builds an "unknown" geographic CRS that PROJ cannot match
 * (e.g. NOAA CRW uses inverse_flattening 298.2572 vs WGS 84's 298.257223563).
 *
 * Prefer explicit CRS authority keys, then any metadata value shaped like
 * `EPSG:nnnn`.
 */
function epsgFromGdalinfoMetadataJson(text) {
    let info;
    try {
        info = JSON.parse(text);
    }
    catch {
        return null;
    }
    const preferredKeys = /(epsg_code|geospatial_bounds_crs)$/i;
    let preferred = null;
    let any = null;
    const visit = (node) => {
        if (node == null || typeof node !== "object") {
            return;
        }
        if (Array.isArray(node)) {
            for (const item of node) {
                visit(item);
            }
            return;
        }
        for (const [key, value] of Object.entries(node)) {
            const fromValue = parseEpsgCodeString(value);
            if (fromValue != null) {
                if (preferredKeys.test(key) && preferred == null) {
                    preferred = fromValue;
                }
                else if (any == null) {
                    any = fromValue;
                }
            }
            visit(value);
        }
    };
    visit(info.metadata);
    return preferred !== null && preferred !== void 0 ? preferred : any;
}
/**
 * Best-effort EPSG for a raster path: OSR (in-process), then the same GDAL
 * utilities the Lambda image ships with (`gdalsrsinfo` / `gdalinfo`), which use
 * PROJ's full CRS database and identification paths. Finally, CF/ACDD metadata
 * keys such as `crs#epsg_code` when the WKT is an unrecognized geographic CRS.
 */
async function resolveRasterEpsg(path, srs) {
    if (srs) {
        const fromSrs = resolveEpsgFromSpatialReference(srs);
        if (fromSrs != null) {
            return fromSrs;
        }
    }
    try {
        const { stdout } = await execFileAsync("gdalsrsinfo", ["-o", "PROJJSON", path], {
            maxBuffer: 10 * 1024 * 1024,
            env: process.env,
        });
        const fromJson = epsgFromProjJsonText(stdout);
        if (fromJson != null) {
            return fromJson;
        }
    }
    catch {
        // Missing binary, non-zero exit, or invalid JSON.
    }
    try {
        const { stdout } = await execFileAsync("gdalsrsinfo", ["-e", path], {
            maxBuffer: 10 * 1024 * 1024,
            env: process.env,
        });
        const fromSearch = parseEpsgFromGdalsrsinfoSearchStdout(stdout);
        if (fromSearch != null) {
            return fromSearch;
        }
    }
    catch {
        // Same as above.
    }
    try {
        const { stdout } = await execFileAsync("gdalinfo", ["-json", path], {
            maxBuffer: 10 * 1024 * 1024,
            env: process.env,
        });
        const fromMeta = epsgFromGdalinfoMetadataJson(stdout);
        if (fromMeta != null) {
            return fromMeta;
        }
    }
    catch {
        // Same as above.
    }
    return null;
}
//# sourceMappingURL=rasterEpsg.js.map