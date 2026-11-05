/* eslint-disable i18next/no-literal-string */
import { Style } from "mapbox-gl";
import { buildS57Style } from "@seasketch/s57";

export type EncArchiveSource = { id: string; url: string; maxzoom?: number };

/**
 * The per-scale archives listed in `enc_basemaps.settings.sources` (schema
 * version 2). Returns an empty list for older charts or malformed settings.
 */
export function encArchiveSources(settings: unknown): EncArchiveSource[] {
  if (typeof settings !== "object" || settings === null) return [];
  if (!("sources" in settings)) return [];
  const sources = (settings as { sources: unknown }).sources;
  if (!Array.isArray(sources)) return [];
  const result: EncArchiveSource[] = [];
  for (const source of sources) {
    if (typeof source !== "object" || source === null) continue;
    if (!("id" in source) || !("url" in source)) continue;
    const { id, url } = source as { id: unknown; url: unknown };
    if (typeof id !== "string" || !/^[a-z0-9_-]+$/i.test(id)) continue;
    if (typeof url !== "string" || url.length === 0) continue;
    const maxzoom =
      "maxzoom" in source &&
      typeof (source as { maxzoom: unknown }).maxzoom === "number"
        ? (source as { maxzoom: number }).maxzoom
        : undefined;
    result.push({ id, url, maxzoom });
  }
  return result;
}

/**
 * Chart style for an ENC basemap. Charts split by scale list one archive per
 * scale in their settings; older charts have a single archive at `url`.
 * `tileJson` maps an archive URL to its pmtiles-server TileJSON
 * (`…/{uuid}.json`). The drawing rules, sprite, and glyphs live in
 * `@seasketch/s57` and are served from `/s57/`. Not for navigation.
 */
export function buildEncStyle(
  basemap: { url: string; encBasemap?: { settings?: unknown } | null },
  tileJson: (url: string) => string
): Style {
  // Mapbox's sprite loader requires a URL with a scheme.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const toJson = (url: string) =>
    tileJson(url.endsWith(".json") ? url : `${url}.json`);
  const archives = encArchiveSources(basemap.encBasemap?.settings);
  const source =
    archives.length > 0
      ? archives.map((archive) => ({
          id: archive.id,
          source: toJson(archive.url),
        }))
      : toJson(basemap.url);
  return buildS57Style(source, {
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
