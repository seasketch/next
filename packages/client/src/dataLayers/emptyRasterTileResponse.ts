/**
 * Sparse raster archives answer missing PNG/JPEG/WebP tiles with HTTP 204
 * and an empty body (`packages/pmtiles-server` tilesBackend). mapbox-gl
 * treats 204 as success and decodes the body with `createImageBitmap`.
 * A zero-byte blob rejects, and mapbox wraps that rejection in a new Error
 * whose text depends on the browser. The tile is left errored, so parent
 * tiles still cover the gap, but the map `error` event paints a false red
 * X on the layer (#953, #1040).
 *
 * mapbox already suppresses tile errors whose `status` is 404 and uses the
 * same parent-tile fallback. Rewriting an image-tile 204 into a 404 takes
 * that path, so the decode never runs and the layer list stays quiet.
 * Vector 204s are left alone: an empty protobuf is a valid empty tile.
 *
 * The wrapper reads `response.status` on every fetch and returns the same
 * Response for anything other than 204. The extension check runs only for
 * those 204s.
 */

const IMAGE_TILE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "avif"]);

type MinimalResponse = {
  status: number;
  url: string;
};

export function imageTileExtension(url: string): string | undefined {
  let end = url.indexOf("?");
  const hash = url.indexOf("#");
  if (hash !== -1 && (end === -1 || hash < end)) end = hash;
  const path = end === -1 ? url : url.slice(0, end);
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  if (dot === -1 || dot <= slash) return undefined;
  return path.slice(dot + 1).toLowerCase();
}

/** 404 when this 204 is an empty image tile; otherwise leave the response. */
export function emptyImageTileMissStatus(
  response: MinimalResponse
): 404 | undefined {
  if (response.status !== 204) return undefined;
  const extension = imageTileExtension(response.url);
  if (!extension || !IMAGE_TILE_EXTENSIONS.has(extension)) return undefined;
  return 404;
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<MinimalResponse>;

/**
 * Install once on the page fetch mapbox-gl uses for raster tiles. Safe to
 * call again. No-ops when `fetch` is missing (unit tests that never install
 * against the real global).
 */
export function installEmptyRasterTileResponseGuard(
  scope: { fetch?: FetchLike } = globalThis as { fetch?: FetchLike }
): void {
  const native = scope.fetch;
  if (!native || (native as { emptyRasterTileGuard?: boolean }).emptyRasterTileGuard) {
    return;
  }

  const guarded: FetchLike = (input, init) => {
    return native.call(scope, input, init).then((response) => {
      if (emptyImageTileMissStatus(response) !== 404) return response;
      return new Response(null, { status: 404, statusText: "Not Found" });
    });
  };
  (guarded as { emptyRasterTileGuard?: boolean }).emptyRasterTileGuard = true;
  scope.fetch = guarded;
}
