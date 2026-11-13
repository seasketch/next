import type { SupportedTypes } from "../uploadPipelineShared";

/**
 * ogrinfo labels the GeoParquet driver `Parquet`. Match that line rather than
 * the word anywhere in the summary, so a layer attribute named "parquet"
 * cannot change the detected format.
 */
export function vectorTypeFromOgrInfo(ogrInfo: string): SupportedTypes | null {
  if (/GeoJSON/.test(ogrInfo)) {
    return "GeoJSON";
  }
  if (/FlatGeobuf/.test(ogrInfo)) {
    return "FlatGeobuf";
  }
  if (/ESRI Shapefile/.test(ogrInfo)) {
    return "ZippedShapefile";
  }
  if (/driver `Parquet'/.test(ogrInfo)) {
    return "GeoParquet";
  }
  return null;
}

export function ogrInfoHasNoGeometry(ogrInfo: string): boolean {
  return /Geometry:\s*None\b/.test(ogrInfo);
}

/**
 * True when ogrinfo printed no spatial reference. A GeoParquet `crs: null`
 * lands here even when an Arrow schema extension mentions WGS 84.
 */
export function ogrInfoSrsUnknown(ogrInfo: string): boolean {
  return /Layer SRS(?: WKT)?:\s*\(unknown\)/.test(ogrInfo);
}

/**
 * Parse the layer extent from `ogrinfo -al -so`. Returns null when the
 * summary has no extent line.
 */
export function ogrInfoExtent(
  ogrInfo: string,
): [number, number, number, number] | null {
  const match = ogrInfo.match(
    /Extent(?:\s*\([^)]*\))?:\s*\(([-0-9.eE+]+),\s*([-0-9.eE+]+)\)\s*-\s*\(([-0-9.eE+]+),\s*([-0-9.eE+]+)\)/,
  );
  if (!match) {
    return null;
  }
  const extent = match.slice(1, 5).map(Number) as [
    number,
    number,
    number,
    number,
  ];
  if (extent.some((value) => Number.isNaN(value))) {
    return null;
  }
  return extent;
}

export function extentLooksGeographic(
  extent: [number, number, number, number],
): boolean {
  const [minX, minY, maxX, maxY] = extent;
  return minX >= -180 && maxX <= 180 && minY >= -90 && maxY <= 90;
}

export type GeoParquetSrsDecision =
  | { assumeWgs84: false }
  | { assumeWgs84: true }
  | { error: string };

/**
 * GeoParquet with an explicit CRS is reprojected by the normal `-t_srs`
 * conversion. Files that omit a CRS are imported as WGS 84 only when the
 * extent is longitude/latitude; projected coordinates without a CRS are
 * rejected instead of being tagged as degrees.
 */
export function geoparquetSrsDecision(
  ogrInfo: string,
  alreadyWgs84: boolean,
): GeoParquetSrsDecision {
  if (alreadyWgs84 || !ogrInfoSrsUnknown(ogrInfo)) {
    return { assumeWgs84: false };
  }
  const extent = ogrInfoExtent(ogrInfo);
  if (extent && extentLooksGeographic(extent)) {
    return { assumeWgs84: true };
  }
  return {
    error:
      "This GeoParquet file does not declare a coordinate reference system, and its coordinates are not longitude and latitude. Export it as WGS 84 (EPSG:4326) and upload it again.",
  };
}
