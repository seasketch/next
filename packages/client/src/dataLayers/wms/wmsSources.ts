import {
  WMSDynamicSource,
  WMSTiledSource,
} from "@seasketch/mapbox-gl-wms-source";
import { DataSourceDetailsFragment } from "../../generated/graphql";
import { parseWmsSettings } from "./wmsSettings";

export function createWmsSource(
  source: DataSourceDetailsFragment,
  sourceId: string
): WMSDynamicSource | WMSTiledSource {
  const settings = parseWmsSettings(source);
  const common = {
    url: source.url!,
    sourceId,
    supportHighDpiDisplays: source.useDevicePixelRatio || false,
    version: settings.version,
    crs: settings.crs,
    format: settings.imageFormat,
    transparent: settings.transparent,
    tileSize: source.tileSize || settings.tileSize || 256,
    vendorParams: {
      ...(settings.vendorParams || {}),
      ...normalizeQueryParameters(source.queryParameters),
    },
    attributionOverride:
      (source.attribution || "").trim().length > 0
        ? source.attribution!
        : undefined,
  };
  if (settings.requestMode === "tiled") {
    return new WMSTiledSource(common);
  }
  return new WMSDynamicSource(common);
}

function normalizeQueryParameters(
  queryParameters: unknown
): Record<string, string | number | boolean> {
  if (!queryParameters || typeof queryParameters !== "object") {
    return {};
  }
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(
    queryParameters as Record<string, unknown>
  )) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
    }
  }
  return out;
}
