export type SupportedSpatialFormat =
  | "geojson"
  | "shapefileZip"
  | "geotiff"
  | "netcdf"
  | "flatgeobuf"
  | "delimited";

export const SUPPORTED_SPATIAL_FORMATS: {
  id: SupportedSpatialFormat;
  label: string;
  extensions: string;
  tag: string;
}[] = [
  {
    id: "geojson",
    label: "GeoJSON",
    extensions: ".geojson, .json",
    tag: "JSON",
  },
  {
    id: "shapefileZip",
    label: "Shapefile (zipped)",
    extensions: ".zip",
    tag: "ZIP",
  },
  {
    id: "geotiff",
    label: "GeoTiff",
    extensions: ".tif, .tiff",
    tag: "TIFF",
  },
  {
    id: "netcdf",
    label: "NetCDF",
    extensions: ".nc, .nc4",
    tag: "NC",
  },
  {
    id: "flatgeobuf",
    label: "FlatGeobuf",
    extensions: ".fgb",
    tag: "FGB",
  },
  {
    id: "delimited",
    label: "CSV / Delimited Text",
    extensions: ".csv, .tsv, .txt",
    tag: "CSV",
  },
];

export const SPATIAL_FILE_ACCEPT =
  ".zip,.json,.geojson,.fgb,.tif,.tiff,.nc,.nc4,.csv,.tsv,.txt";

export const DATA_TABLE_FILE_ACCEPT = ".csv,.tsv,.txt";

export function fileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0) return "";
  return fileName.slice(dotIndex).toLowerCase();
}

export function detectSupportedFormat(
  fileName: string | null
): SupportedSpatialFormat | null {
  if (!fileName) return null;
  const ext = fileExtension(fileName);
  switch (ext) {
    case ".geojson":
    case ".json":
      return "geojson";
    case ".zip":
      return "shapefileZip";
    case ".tif":
    case ".tiff":
      return "geotiff";
    case ".nc":
    case ".nc4":
      return "netcdf";
    case ".fgb":
      return "flatgeobuf";
    case ".csv":
    case ".tsv":
    case ".txt":
      return "delimited";
    default:
      return null;
  }
}

/** CSV/TSV/TXT files require column-mapping configuration before spatial upload. */
export function isDelimitedSpatialFile(fileName: string): boolean {
  const ext = fileExtension(fileName);
  return ext === ".csv" || ext === ".tsv" || ext === ".txt";
}

export function isDataTableFileName(fileName: string): boolean {
  return isDelimitedSpatialFile(fileName);
}

export type UnsupportedSpatialFile = {
  kind:
    | "docx"
    | "xlsx"
    | "pdf"
    | "dbf"
    | "shapeIndex"
    | "cpg"
    | "prj"
    | "shp"
    | "xml"
    | "png"
    | "jpg";
  descriptionKind: "shapefilePart" | "unsupportedRaster" | "unsupported";
  isPartOfShapefile: boolean;
};

/**
 * Classifies files that look like a common non-spatial upload, or null when
 * the name should proceed through spatial upload.
 */
export function describeUnsupportedSpatialFile(
  fileName: string
): UnsupportedSpatialFile | null {
  const ext = fileExtension(fileName);
  switch (ext) {
    case ".docx":
      return {
        kind: "docx",
        descriptionKind: "unsupported",
        isPartOfShapefile: false,
      };
    case ".xlsx":
      return {
        kind: "xlsx",
        descriptionKind: "unsupported",
        isPartOfShapefile: false,
      };
    case ".pdf":
      return {
        kind: "pdf",
        descriptionKind: "unsupported",
        isPartOfShapefile: false,
      };
    case ".dbf":
      return {
        kind: "dbf",
        descriptionKind: "shapefilePart",
        isPartOfShapefile: true,
      };
    case ".shx":
    case ".sbn":
    case ".sbx":
      return {
        kind: "shapeIndex",
        descriptionKind: "shapefilePart",
        isPartOfShapefile: true,
      };
    case ".cpg":
      return {
        kind: "cpg",
        descriptionKind: "shapefilePart",
        isPartOfShapefile: true,
      };
    case ".prj":
      return {
        kind: "prj",
        descriptionKind: "shapefilePart",
        isPartOfShapefile: true,
      };
    case ".shp":
      return {
        kind: "shp",
        descriptionKind: "shapefilePart",
        isPartOfShapefile: true,
      };
    case ".xml":
      return {
        kind: "xml",
        descriptionKind: "unsupported",
        isPartOfShapefile: false,
      };
    case ".png":
      return {
        kind: "png",
        descriptionKind: "unsupportedRaster",
        isPartOfShapefile: false,
      };
    case ".jpg":
    case ".jpeg":
      return {
        kind: "jpg",
        descriptionKind: "unsupportedRaster",
        isPartOfShapefile: false,
      };
    default:
      return null;
  }
}

export type DataTableDropResult =
  | { ok: true; file: File }
  | { ok: false; reason: "empty" | "multiple" | "unsupported" };

export function pickDataTableDrop(files: File[]): DataTableDropResult {
  if (files.length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (files.length > 1) {
    return { ok: false, reason: "multiple" };
  }
  const file = files[0];
  if (!isDataTableFileName(file.name)) {
    return { ok: false, reason: "unsupported" };
  }
  return { ok: true, file };
}

export function spatialReplaceAllowsMultiple(fileCount: number): boolean {
  return fileCount <= 1;
}
