import {
  fetchCapabilities,
  getNamedLayers,
  getSupportedWebMercatorCrs,
  WMSServiceMetadata,
} from "@seasketch/mapbox-gl-wms-source";
import { DataSourceDetailsFragment } from "../../generated/graphql";

/** Persisted on data_sources.wms_settings — keep small (no capabilities tree). */
export interface ClientWmsSettings {
  version?: "1.1.1" | "1.3.0";
  crs?: string;
  imageFormat?: string;
  requestMode?: "tiled" | "dynamic";
  tileSize?: number;
  transparent?: boolean;
  infoFormat?: string;
  getMapUrl?: string;
  getFeatureInfoUrl?: string;
  getLegendGraphicUrl?: string;
  capabilitiesUrl?: string;
  serviceTitle?: string;
  vendorParams?: Record<string, string | number | boolean>;
  /** Default WMS style name per imported layer (layer name → style name). */
  layerStyles?: Record<string, string>;
}

const PERSISTED_WMS_SETTING_KEYS: (keyof ClientWmsSettings)[] = [
  "version",
  "crs",
  "imageFormat",
  "requestMode",
  "tileSize",
  "transparent",
  "infoFormat",
  "getMapUrl",
  "getFeatureInfoUrl",
  "getLegendGraphicUrl",
  "capabilitiesUrl",
  "serviceTitle",
  "vendorParams",
  "layerStyles",
];

/** Strip anything not meant for DB storage (e.g. legacy capabilitiesMetadata blobs). */
export function pickWmsSettingsForPersist(
  settings: Partial<ClientWmsSettings>
): ClientWmsSettings {
  const out: ClientWmsSettings = {};
  for (const key of PERSISTED_WMS_SETTING_KEYS) {
    const value = settings[key];
    if (value === undefined || value === null) {
      continue;
    }
    if (key === "layerStyles" && typeof value === "object") {
      const styles: Record<string, string> = {};
      for (const [layerName, styleName] of Object.entries(
        value as Record<string, unknown>
      )) {
        if (typeof styleName === "string" && styleName.length) {
          styles[layerName] = styleName;
        }
      }
      if (Object.keys(styles).length) {
        out.layerStyles = styles;
      }
      continue;
    }
    if (key === "vendorParams" && typeof value === "object") {
      const params: Record<string, string | number | boolean> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (
          typeof v === "string" ||
          typeof v === "number" ||
          typeof v === "boolean"
        ) {
          params[k] = v;
        }
      }
      if (Object.keys(params).length) {
        out.vendorParams = params;
      }
      continue;
    }
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

const metadataCache: {
  [url: string]: Promise<WMSServiceMetadata>;
} = {};

export function parseWmsSettings(
  source: Pick<DataSourceDetailsFragment, "wmsSettings">
): ClientWmsSettings {
  const raw = source.wmsSettings;
  if (!raw || typeof raw !== "object") {
    return { requestMode: "dynamic", crs: "EPSG:3857", transparent: true };
  }
  return pickWmsSettingsForPersist(raw as ClientWmsSettings);
}

/** Build the small JSON blob stored on import — not the full capabilities document. */
export function buildImportWmsSettings(
  metadata: WMSServiceMetadata,
  options: {
    requestMode: "tiled" | "dynamic";
    layerNames: string[];
  }
): ClientWmsSettings {
  const crs =
    getSupportedWebMercatorCrs(metadata.layers[0]) || "EPSG:3857";
  const imageFormat = metadata.getMap.formats.includes("image/png")
    ? "image/png"
    : metadata.getMap.formats[0];
  const infoFormat =
    metadata.getFeatureInfo?.formats.find((f) => f.includes("json")) ||
    metadata.getFeatureInfo?.formats[0];

  const layerStyles: Record<string, string> = {};
  const named = getNamedLayers(metadata.layers);
  for (const name of options.layerNames) {
    const layer = named.find((l) => l.name === name);
    const styleName = layer?.styles[0]?.name;
    if (styleName) {
      layerStyles[name] = styleName;
    }
  }

  return pickWmsSettingsForPersist({
    version: metadata.version,
    crs,
    imageFormat,
    requestMode: options.requestMode,
    tileSize: 256,
    transparent: true,
    infoFormat,
    getMapUrl: metadata.getMap.url,
    getFeatureInfoUrl: metadata.getFeatureInfo?.url,
    getLegendGraphicUrl: metadata.getLegendGraphic?.url,
    capabilitiesUrl: metadata.serviceUrl,
    serviceTitle: metadata.title,
    ...(Object.keys(layerStyles).length ? { layerStyles } : {}),
  });
}

/** Minimal metadata stub from persisted settings (enough for GetFeatureInfo URLs). */
export function metadataStubFromWmsSettings(
  settings: ClientWmsSettings,
  sourceUrl: string
): WMSServiceMetadata {
  const serviceUrl = settings.capabilitiesUrl || sourceUrl;
  const getMapUrl = settings.getMapUrl || serviceUrl;
  return {
    version: settings.version || "1.3.0",
    serviceUrl,
    title: settings.serviceTitle,
    getMap: {
      url: getMapUrl,
      formats: settings.imageFormat ? [settings.imageFormat] : ["image/png"],
    },
    getFeatureInfo: settings.getFeatureInfoUrl
      ? {
          url: settings.getFeatureInfoUrl,
          formats: settings.infoFormat
            ? [settings.infoFormat]
            : ["application/json"],
        }
      : undefined,
    getLegendGraphic: settings.getLegendGraphicUrl
      ? {
          url: settings.getLegendGraphicUrl,
          formats: ["image/png"],
        }
      : undefined,
    layers: [],
  };
}

/** Fetch capabilities on demand; cached in-memory per service URL. */
export async function resolveWmsMetadata(
  source: Pick<DataSourceDetailsFragment, "url" | "wmsSettings">
): Promise<WMSServiceMetadata | undefined> {
  const settings = parseWmsSettings(source);
  const url = settings.capabilitiesUrl || source.url;
  if (!url) {
    return undefined;
  }
  const cacheKey = `${url}|${settings.version || ""}`;
  if (!metadataCache[cacheKey]) {
    metadataCache[cacheKey] = fetchCapabilities(url, {
      version: settings.version,
      serviceUrl: url,
    }).then((result) => result.metadata);
  }
  try {
    return await metadataCache[cacheKey];
  } catch (e) {
    delete metadataCache[cacheKey];
    console.warn("Failed to fetch WMS capabilities", e);
    return metadataStubFromWmsSettings(settings, source.url || url);
  }
}
