import { Logger } from "../logger";
import type { DelimitedUploadProcessingOptions } from "../spatialUploadsHandlerTypes";
/**
 * Converts a delimited text file (CSV/TSV/TXT) to GeoJSON using GDAL's CSV
 * driver, based on the column mapping and CRS chosen by the user (or
 * auto-detected client-side). The resulting file feeds into the same
 * normalize-to-FlatGeobuf/tiling pipeline used for other vector formats.
 *
 * See https://gdal.org/en/stable/drivers/vector/csv.html for open option
 * reference.
 */
export declare function convertDelimitedToGeoJSON(logger: Logger, inputPath: string, outputPath: string, options: DelimitedUploadProcessingOptions): Promise<void>;
//# sourceMappingURL=delimited.d.ts.map