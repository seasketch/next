/**
 * ArcGIS REST service types that should expose an ESRI REST URL in metadata.
 * SeaSketch-hosted uploads and generic XYZ/raster tile sources are excluded.
 */
const ARCGIS_WEB_SERVICE_TYPES = new Set([
  "ARCGIS_VECTOR",
  "ARCGIS_DYNAMIC_MAPSERVER",
  "ARCGIS_DYNAMIC_MAPSERVER_VECTOR_SUBLAYER",
  "ARCGIS_DYNAMIC_MAPSERVER_RASTER_SUBLAYER",
  "ARCGIS_RASTER_TILES",
]);

export function isArcGisWebServiceType(
  type: string | null | undefined
): boolean {
  if (!type) {
    return false;
  }
  return ARCGIS_WEB_SERVICE_TYPES.has(type);
}

/**
 * Build the public ArcGIS REST URL for a layer, including the sublayer id when
 * the source URL is a MapServer/FeatureServer root rather than a layer endpoint.
 */
export function getEsriRestUrl(params: {
  type?: string | null;
  url?: string | null;
  sublayer?: string | null;
}): string | null {
  const { type, url, sublayer } = params;
  if (!isArcGisWebServiceType(type) || !url) {
    return null;
  }

  const trimmed = url.replace(/\/+$/, "");
  if (sublayer == null || sublayer === "") {
    return trimmed;
  }

  if (trimmed.endsWith(`/${sublayer}`)) {
    return trimmed;
  }

  return `${trimmed}/${sublayer}`;
}

export function esriRestUrlFromMetadataItem(item: unknown): string | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const dataLayer =
    "dataLayer" in item && item.dataLayer && typeof item.dataLayer === "object"
      ? item.dataLayer
      : null;
  const dataSource =
    dataLayer &&
    "dataSource" in dataLayer &&
    dataLayer.dataSource &&
    typeof dataLayer.dataSource === "object"
      ? dataLayer.dataSource
      : null;
  return getEsriRestUrl({
    type:
      dataSource && "type" in dataSource && typeof dataSource.type === "string"
        ? dataSource.type
        : null,
    url:
      dataSource && "url" in dataSource && typeof dataSource.url === "string"
        ? dataSource.url
        : null,
    sublayer:
      dataLayer &&
      "sublayer" in dataLayer &&
      typeof dataLayer.sublayer === "string"
        ? dataLayer.sublayer
        : null,
  });
}
