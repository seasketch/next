/**
 * Paths TilesBackend should present as PMTiles (TileJSON / ZXY / preview)
 * instead of raw R2 objects. Keep gateway + tilesBackend in lockstep.
 */

const TILE_EXT = "(?:mvt|pbf|png|webp|jpg|jpeg|mrt)";
const ARCHIVE_NAME = "[0-9a-zA-Z/!\\-_.*'()]+";

/** Public library / fixture archives (no published UUID). */
const PUBLIC_ARCHIVE_STEM = "(?:dataLibrary|raster-array)/[0-9a-zA-Z/!\\-_'*()]+";

export const TILE_ZXY_ROUTE = new RegExp(
  `^(?:${ARCHIVE_NAME})/\\d+/\\d+/\\d+\\.${TILE_EXT}$`,
  "i",
);

export const PUBLISHED_TILEJSON_OR_PREVIEW = new RegExp(
  `^(?:projects/)?[^/]+/public/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?:$|\\.json$)`,
  "i",
);

export const PUBLIC_TILEJSON_ROUTE = new RegExp(
  `^/(${PUBLIC_ARCHIVE_STEM})\\.json$`,
  "i",
);

export const PUBLIC_PREVIEW_ROUTE = new RegExp(
  `^/(${PUBLIC_ARCHIVE_STEM})/?$`,
  "i",
);

/**
 * True when the tiles host should invoke TilesBackend for this R2 key.
 * Raw objects (`.fgb`, `.tif`, `.pmtiles` downloads) stay on ObjectBackend.
 */
export function isTilePresentationKey(key: string): boolean {
  return (
    TILE_ZXY_ROUTE.test(key) ||
    PUBLISHED_TILEJSON_OR_PREVIEW.test(key) ||
    PUBLIC_TILEJSON_ROUTE.test(`/${key}`) ||
    PUBLIC_PREVIEW_ROUTE.test(`/${key}`)
  );
}
