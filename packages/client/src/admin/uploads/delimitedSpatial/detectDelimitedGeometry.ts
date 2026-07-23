/* eslint-disable i18next/no-literal-string */
import Papa from "papaparse";
import {
  DelimitedColumnPreview,
  DelimitedUploadProcessingOptions,
  DetectDelimitedGeometryResult,
} from "./types";

const SAMPLE_ROW_LIMIT = 100;
export const DELIMITED_SAMPLE_BYTES = 200_000;
const CANDIDATE_DELIMITERS: DelimitedUploadProcessingOptions["delimiter"][] = [
  ",",
  "\t",
  ";",
  "|",
];

// Header synonyms borrowed from how ArcGIS Online and Mapbox Studio detect
// CSV coordinate columns (see plan doc for sources).
const LAT_HEADER_SYNONYMS = new Set([
  "latitude",
  "lat",
  "y",
  "ycenter",
  "pointy",
  "latdd",
  "latdecdeg",
  "latitude83",
]);
const LON_HEADER_SYNONYMS = new Set([
  "longitude",
  "lon",
  "long",
  "lng",
  "x",
  "xcenter",
  "pointx",
  "londd",
  "longdecdeg",
  "longitude83",
]);
const WKT_HEADER_NAMES = new Set([
  "wkt",
  "geom",
  "geometry",
  "thegeom",
  "shape",
]);
const WKT_VALUE_PATTERN =
  /^(SRID=\d+;)?\s*(POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|GEOMETRYCOLLECTION)\s*\(/i;

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isNumeric(value: string): boolean {
  if (value.trim() === "") return false;
  return Number.isFinite(Number(value));
}

const WGS84_ERROR =
  "Coordinates must be in WGS 84 (EPSG:4326) decimal degrees. This file appears to use a different coordinate system or column mapping.";

/** Returns an error message when sample rows are not valid WGS 84 lon/lat. */
export function validateWgs84PointColumns(
  headers: string[],
  dataRows: string[][],
  xField: string,
  yField: string
): string | null {
  const xIndex = headers.indexOf(xField);
  const yIndex = headers.indexOf(yField);
  if (xIndex < 0 || yIndex < 0) return null;
  const sample = dataRows.slice(0, 50);
  if (!sample.length) return null;
  const validRows = sample.filter((r) => {
    const x = Number(r[xIndex]);
    const y = Number(r[yIndex]);
    return (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      Math.abs(x) <= 180 &&
      Math.abs(y) <= 90
    );
  });
  const validRatio = validRows.length / sample.length;
  if (validRatio < 0.9) {
    return WGS84_ERROR;
  }
  return null;
}

function wgs84ValidRatio(
  dataRows: string[][],
  xIndex: number,
  yIndex: number
): number {
  const sample = dataRows.slice(0, 50);
  if (!sample.length) return 0;
  const validRows = sample.filter((r) => {
    const x = Number(r[xIndex]);
    const y = Number(r[yIndex]);
    return (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      Math.abs(x) <= 180 &&
      Math.abs(y) <= 90
    );
  });
  return validRows.length / sample.length;
}

/** Picks the delimiter that produces the most consistent column count across sample rows. */
function detectDelimiter(sampleText: string): {
  delimiter: DelimitedUploadProcessingOptions["delimiter"];
  rows: string[][];
} {
  let best: {
    delimiter: DelimitedUploadProcessingOptions["delimiter"];
    rows: string[][];
    score: number;
  } | null = null;

  for (const delimiter of CANDIDATE_DELIMITERS) {
    const result = Papa.parse<string[]>(sampleText, {
      delimiter,
      skipEmptyLines: true,
      preview: SAMPLE_ROW_LIMIT,
    });
    const rows = result.data;
    if (rows.length < 2) continue;
    const columnCount = rows[0].length;
    if (columnCount < 2) continue;
    const consistentRows = rows.filter((r) => r.length === columnCount).length;
    const consistency = consistentRows / rows.length;
    // Prefer delimiters that extract more columns with high row-to-row
    // consistency, and penalize parse errors.
    const score = columnCount * consistency - result.errors.length * 0.5;
    if (!best || score > best.score) {
      best = { delimiter, rows, score };
    }
  }

  if (!best) {
    const result = Papa.parse<string[]>(sampleText, {
      skipEmptyLines: true,
      preview: SAMPLE_ROW_LIMIT,
    });
    return { delimiter: ",", rows: result.data };
  }

  return { delimiter: best.delimiter, rows: best.rows };
}

/**
 * Compares the first row against the rest of the sample to decide whether it
 * is a header row. For columns that are consistently numeric in the data
 * rows, a non-numeric value in the first row is a strong signal that it's a
 * header label rather than data (a first row that is itself numeric in those
 * columns means the file likely has no header at all).
 */
function looksLikeHeaderRow(rows: string[][]): boolean {
  if (rows.length < 2) return true;
  const [first, ...rest] = rows;
  let numericColumnCount = 0;
  let numericColumnWithNonNumericHeader = 0;
  first.forEach((cell, i) => {
    const restValues = rest
      .map((r) => r[i] ?? "")
      .filter((v) => v.trim() !== "");
    if (!restValues.length) return;
    const numericRatio =
      restValues.filter(isNumeric).length / restValues.length;
    if (numericRatio >= 0.8) {
      numericColumnCount++;
      if (!isNumeric(cell)) numericColumnWithNonNumericHeader++;
    }
  });
  if (numericColumnCount === 0) {
    // No reliably numeric columns to compare against; fall back to a simple
    // check for any non-numeric cell in the first row.
    return first.some(
      (cell) => cell.trim() !== "" && Number.isNaN(Number(cell))
    );
  }
  return numericColumnWithNonNumericHeader > 0;
}

/**
 * Inspects a sample of delimited text (CSV/TSV/etc.) and attempts to detect
 * the delimiter, header row, and a geometry column or coordinate column pair.
 *
 * Detection proceeds in priority order: WKT geometry column, then header-name
 * based lat/lon columns (the approach used by ArcGIS Online and Mapbox
 * Studio), then a numeric-range heuristic fallback for unrecognized headers.
 * Confidence is downgraded whenever the result relied on heuristics or
 * sampled coordinates fall outside valid WGS 84 ranges, signaling that the
 * upload UI should ask the user to confirm or correct the mapping.
 */
export function detectDelimitedGeometry(
  sampleText: string
): DetectDelimitedGeometryResult {
  const { delimiter, rows: allRows } = detectDelimiter(sampleText);
  const warnings: string[] = [];

  if (allRows.length < 2) {
    return {
      delimiter,
      hasHeaderRow: true,
      headers: allRows[0] || [],
      rows: [],
      columns: [],
      geometryMode: null,
      crs: "EPSG:4326",
      confidence: "low",
      error: "Could not parse enough rows to detect columns.",
      warnings: [],
    };
  }

  const hasHeaderRow = looksLikeHeaderRow(allRows);
  // Match GDAL's CSV driver naming for headerless files (HEADERS=NO) so that
  // the field names selected here line up with what ogr2ogr will produce.
  const headers = hasHeaderRow
    ? allRows[0]
    : allRows[0].map((_, i) => `field_${i + 1}`);
  const dataRows = hasHeaderRow ? allRows.slice(1) : allRows;

  const columns: DelimitedColumnPreview[] = headers.map((name, i) => ({
    name,
    sampleValues: dataRows.slice(0, 10).map((r) => r[i] ?? ""),
  }));

  const base = {
    delimiter,
    hasHeaderRow,
    headers,
    rows: dataRows.slice(0, 10),
    columns,
  };

  // --- 1. WKT geometry column ---
  let geometryField: string | undefined;
  for (let i = 0; i < headers.length; i++) {
    if (!WKT_HEADER_NAMES.has(normalizeHeader(headers[i]))) continue;
    const values = dataRows.slice(0, 20).map((r) => r[i] ?? "");
    const matches = values.filter((v) => WKT_VALUE_PATTERN.test(v)).length;
    if (
      values.length > 0 &&
      matches >= Math.min(3, values.length) &&
      matches / values.length >= 0.8
    ) {
      geometryField = headers[i];
      break;
    }
  }

  if (geometryField) {
    return {
      ...base,
      geometryMode: "wkt",
      geometryField,
      crs: "EPSG:4326",
      confidence: "high",
      warnings,
    };
  }

  // --- 2. Header-name based lat/lon detection ---
  let xField: string | undefined;
  let yField: string | undefined;
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (!xField && LON_HEADER_SYNONYMS.has(normalized)) xField = header;
    if (!yField && LAT_HEADER_SYNONYMS.has(normalized)) yField = header;
  }

  if (xField && yField) {
    const xIndex = headers.indexOf(xField);
    const yIndex = headers.indexOf(yField);
    const validRatio = wgs84ValidRatio(dataRows, xIndex, yIndex);
    if (validRatio < 0.9) {
      return {
        ...base,
        geometryMode: "point_xy",
        xField,
        yField,
        crs: "EPSG:4326",
        confidence: "low",
        error: WGS84_ERROR,
        warnings: [],
      };
    }
    return {
      ...base,
      geometryMode: "point_xy",
      xField,
      yField,
      crs: "EPSG:4326",
      confidence: "high",
      warnings,
    };
  }

  // --- 3. Numeric-range heuristic fallback ---
  const numericColumnIndices = headers
    .map((_, i) => i)
    .filter((i) => {
      const sample = dataRows.slice(0, 100).map((r) => r[i] ?? "");
      const numeric = sample.filter(isNumeric);
      return sample.length > 0 && numeric.length / sample.length >= 0.9;
    });

  const inRangeRatio = (i: number, max: number) => {
    const sample = dataRows.slice(0, 100).map((r) => Number(r[i]));
    const inRange = sample.filter(
      (v) => Number.isFinite(v) && Math.abs(v) <= max
    );
    return sample.length ? inRange.length / sample.length : 0;
  };

  // Coordinates are almost always fractional, while incidental numeric
  // columns (row IDs, counts, etc.) tend to be whole numbers. Prefer
  // candidates with decimal values when any are available.
  const decimalRatio = (i: number) => {
    const sample = dataRows
      .slice(0, 100)
      .map((r) => r[i] ?? "")
      .filter((v) => v.trim() !== "");
    if (!sample.length) return 0;
    return sample.filter((v) => v.includes(".")).length / sample.length;
  };
  const preferDecimalValues = (indices: number[]) => {
    const withDecimals = indices.filter((i) => decimalRatio(i) >= 0.5);
    return withDecimals.length ? withDecimals : indices;
  };

  const latCandidateIndices = preferDecimalValues(
    numericColumnIndices.filter((i) => inRangeRatio(i, 90) >= 0.85)
  );
  const lonCandidateIndices = preferDecimalValues(
    numericColumnIndices.filter((i) => inRangeRatio(i, 180) >= 0.85)
  );

  // Prefer a lat candidate that isn't also the only lon candidate, so a
  // single ambiguous column isn't used for both axes.
  const latIndex = latCandidateIndices.find(
    (i) => lonCandidateIndices.length > 1 || lonCandidateIndices[0] !== i
  );
  const lonIndex = lonCandidateIndices.find((i) => i !== latIndex);

  if (latIndex !== undefined && lonIndex !== undefined) {
    warnings.push(
      "Coordinate columns were guessed from numeric value ranges because no recognized header names (e.g. latitude/longitude) were found. Please confirm the mapping."
    );
    return {
      ...base,
      geometryMode: "point_xy",
      xField: headers[lonIndex],
      yField: headers[latIndex],
      crs: "EPSG:4326",
      confidence: "low",
      warnings,
    };
  }

  warnings.push(
    "Could not automatically detect coordinate or geometry columns. Please select them manually."
  );
  return {
    ...base,
    geometryMode: null,
    crs: "EPSG:4326",
    confidence: "low",
    warnings,
  };
}

export function processingOptionsFromDetectionResult(
  result: DetectDelimitedGeometryResult
): DelimitedUploadProcessingOptions | null {
  if (!result.geometryMode || result.error) return null;
  return {
    kind: "delimited",
    geometryMode: result.geometryMode,
    xField: result.xField,
    yField: result.yField,
    geometryField: result.geometryField,
    crs: result.crs,
    delimiter: result.delimiter,
    hasHeaderRow: result.hasHeaderRow,
  };
}
