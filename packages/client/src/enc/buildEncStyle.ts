/* eslint-disable i18next/no-literal-string */
import { Style } from "mapbox-gl";
import { buildS57Style } from "@seasketch/s57";

/**
 * Chart style for an ENC PMTiles archive. `tileJsonUrl` is the pmtiles-server
 * TileJSON (`…/{uuid}.json`). The drawing rules, sprite, and glyphs live in
 * `@seasketch/s57` and are served from `/s57/`. Not for navigation.
 */
export function buildEncStyle(tileJsonUrl: string): Style {
  // Mapbox's sprite loader requires a URL with a scheme.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return buildS57Style(tileJsonUrl, {
    sprite: `${origin}/s57/sprite`,
  }) as unknown as Style;
}

export function isEncBasemapType(type: string | null | undefined): boolean {
  return type === "ENC";
}

export function encBounds(
  basemap: { encBasemap?: { bounds?: Array<number | null> | null } | null }
): [number, number, number, number] | null {
  const bounds = basemap.encBasemap?.bounds;
  if (!bounds || bounds.length !== 4) return null;
  const numbers = bounds.map((value) =>
    typeof value === "number" ? value : Number(value)
  );
  if (numbers.some((value) => !Number.isFinite(value))) return null;
  return [numbers[0], numbers[1], numbers[2], numbers[3]];
}
