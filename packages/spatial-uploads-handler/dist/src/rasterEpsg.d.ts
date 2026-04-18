/**
 * Minimal OSR surface used for EPSG authority reads (implemented by gdal-async
 * SpatialReference).
 */
export interface GdalSpatialReferenceLike {
    clone: () => GdalSpatialReferenceLike;
    getAuthorityName: (key: string | null) => string;
    getAuthorityCode: (key: string | null) => string;
    autoIdentifyEPSG: () => void;
    morphFromESRI: () => void;
}
/**
 * Read EPSG:nnnn from OSR authority nodes (root, PROJCS, GEOGCS).
 * Caller should run `autoIdentifyEPSG()` (and optionally `morphFromESRI()`)
 * on the same SpatialReference first.
 */
export declare function readEpsgAuthorityFromSrs(srs: GdalSpatialReferenceLike): number | null;
/**
 * Resolve EPSG from a GDAL SpatialReference without mutating the input:
 * 1) autoIdentifyEPSG + authority scan (OGC / GeoTIFF-native SRS)
 * 2) morphFromESRI + autoIdentifyEPSG + scan (ESRI WKT and similar)
 */
export declare function resolveEpsgFromSpatialReference(srs: GdalSpatialReferenceLike): number | null;
/** Parse root `id` from `gdalsrsinfo -o PROJJSON` output. */
export declare function epsgFromProjJsonText(text: string): number | null;
/** First standalone `EPSG:nnnn` line from `gdalsrsinfo -e` output. */
export declare function parseEpsgFromGdalsrsinfoSearchStdout(stdout: string): number | null;
/**
 * Best-effort EPSG for a raster path: OSR (in-process), then the same GDAL
 * utilities the Lambda image ships with (`gdalsrsinfo`), which use PROJ's full
 * CRS database and identification paths.
 */
export declare function resolveRasterEpsg(path: string, srs: GdalSpatialReferenceLike | null): Promise<number | null>;
//# sourceMappingURL=rasterEpsg.d.ts.map