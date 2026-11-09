/**
 * Tippecanoe 2.49 keeps one feature per layer in a tile when features carry
 * `tippecanoe.minzoom`. The same file with that field removed keeps every
 * polygon and line. The zoom is passed as `--minimum-zoom` on one invocation
 * per distinct value instead.
 */
export function releaseMinZoom(feature: { tippecanoe?: { minzoom?: number } }): number {
  const zoom = feature.tippecanoe?.minzoom;
  if (feature.tippecanoe) delete feature.tippecanoe.minzoom;
  if (typeof zoom !== "number" || !Number.isFinite(zoom) || zoom <= 0) return 0;
  return Math.floor(zoom);
}
