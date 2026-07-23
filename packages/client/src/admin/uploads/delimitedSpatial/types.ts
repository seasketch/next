/**
 * Processing instructions for delimited text (CSV/TSV/TXT) spatial uploads.
 *
 * This shape mirrors `DelimitedUploadProcessingOptions` defined in the
 * `spatial-uploads-handler` package, which is the source of truth consumed
 * server-side. It is duplicated here (rather than imported) because that
 * package pulls in Node/GDAL-only dependencies that should not be bundled
 * into the client. Keep both definitions in sync when making changes.
 */
export type DelimitedUploadProcessingOptions = {
  kind: "delimited";
  geometryMode: "point_xy" | "wkt";
  xField?: string;
  yField?: string;
  geometryField?: string;
  crs: string;
  delimiter: "," | "\t" | ";" | "|";
  hasHeaderRow: boolean;
};

export type DelimitedGeometryConfidence = "high" | "medium" | "low";

export type DelimitedColumnPreview = {
  name: string;
  sampleValues: string[];
};

export type DetectDelimitedGeometryResult = {
  delimiter: DelimitedUploadProcessingOptions["delimiter"];
  hasHeaderRow: boolean;
  headers: string[];
  rows: string[][];
  columns: DelimitedColumnPreview[];
  geometryMode: "point_xy" | "wkt" | null;
  xField?: string;
  yField?: string;
  geometryField?: string;
  crs: string;
  confidence: DelimitedGeometryConfidence;
  /** When set, the file cannot be uploaded until the issue is resolved. */
  error?: string | null;
  /** Human-readable reasons the result has medium/low confidence. */
  warnings: string[];
};
