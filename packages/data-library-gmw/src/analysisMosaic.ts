import { mkdirSync, statSync } from "fs";
import { dirname } from "path";
import { gdalInfo, gdalWarpMosaic } from "../../raster-array/src/gdal";

/** Source GMW cells are WGS 84 geographic. Analysis stays in that CRS. */
export const ANALYSIS_SRS = "EPSG:4326";

export function isGeographicWgs84(info: {
  projection: string | null;
  geoTransform: number[] | null;
}): boolean {
  const wkt = info.projection ?? "";
  if (/Pseudo-Mercator|Mercator_1SP|EPSG[:"]\s*3857/i.test(wkt)) {
    return false;
  }
  const originX = info.geoTransform?.[0];
  if (originX !== undefined && Math.abs(originX) > 360) {
    return false;
  }
  return /GEOGCRS|GEOGCS/i.test(wkt);
}

/**
 * Same-CRS mosaic: no `-t_srs`. `SKIP_NOSOURCE` keeps empty ocean sparse.
 * A VRT + translate of the tropical envelope densifies nodata tiles.
 */
export function geographicWarpArgs(nodata: number): string[] {
  return [
    "-overwrite",
    "-r",
    "near",
    "-of",
    "GTiff",
    "-co",
    "TILED=YES",
    "-co",
    "COMPRESS=DEFLATE",
    "-co",
    "PREDICTOR=2",
    "-co",
    "SPARSE_OK=YES",
    "-co",
    "BIGTIFF=YES",
    "-co",
    "INTERLEAVE=PIXEL",
    "-co",
    "NUM_THREADS=ALL_CPUS",
    "-wo",
    "SKIP_NOSOURCE=YES",
    "-wo",
    "NUM_THREADS=ALL_CPUS",
    "-srcnodata",
    String(nodata),
    "-dstnodata",
    String(nodata),
  ];
}

/**
 * Mosaic 1° GMW cells into one sparse GeoTIFF without reprojection.
 * Cells already share a 3711 px/° WGS 84 grid.
 */
export async function mosaicGeographic(
  sources: string[],
  mosaicPath: string,
  nodata = 0,
): Promise<{ elapsedMs: number; bytes: number }> {
  if (sources.length === 0) {
    throw new Error("mosaicGeographic needs at least one source");
  }
  mkdirSync(dirname(mosaicPath), { recursive: true });
  const started = Date.now();
  console.error(
    `Mosaicing ${sources.length} GMW cells in ${ANALYSIS_SRS} (no warp to 3857)…\n  ${mosaicPath}`,
  );
  await gdalWarpMosaic(sources, mosaicPath, geographicWarpArgs(nodata));
  const info = await gdalInfo(mosaicPath);
  if (!isGeographicWgs84(info)) {
    throw new Error(
      `Analysis mosaic is not ${ANALYSIS_SRS}: ${mosaicPath}`,
    );
  }
  const elapsedMs = Date.now() - started;
  const bytes = statSync(mosaicPath).size;
  console.error(
    `Mosaic ${(bytes / 1e9).toFixed(2)} GB ${ANALYSIS_SRS} in ${(elapsedMs / 60000).toFixed(1)} min`,
  );
  return { elapsedMs, bytes };
}
