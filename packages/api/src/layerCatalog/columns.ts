/**
 * Draft layer spreadsheet columns.
 *
 * To add, rename, reorder, or remove a column, edit `catalogColumns`.
 * A column that only reformats data already on `CatalogLayer` is that one
 * entry. A column that needs data the query does not load also needs a field
 * on `CatalogLayer` and the matching select in `pgStore.ts`.
 */

export type CatalogOutput = {
  type: string;
  url: string;
  isOriginal: boolean;
  originalFilename: string | null;
  epsg: number | null;
};

export type CatalogLayer = {
  title: string;
  folder: string;
  stableId: string;
  accessType: string;
  accessGroupNames: string[];
  sourceType: string | null;
  sublayerType: string | null;
  sublayer: string | null;
  sourceUrl: string | null;
  sourceLayer: string | null;
  createdAt: Date | string | null;
  authorName: string | null;
  authorEmail: string | null;
  geostats: unknown;
  attribution: string | null;
  enableDownload: boolean;
  hasMetadata: boolean;
  uploadedSourceFilename: string | null;
  outputs: CatalogOutput[];
  styleUrl: string;
  geostatsUrl: string;
  metadataUrl: string;
};

export type CatalogColumn = {
  header: string;
  value: (layer: CatalogLayer) => string;
};

const SEASKETCH_TYPES = new Set([
  "seasketch-mvt",
  "seasketch-raster",
  "seasketch-vector",
]);

const ARCGIS_TYPES = new Set([
  "arcgis-dynamic-mapserver",
  "arcgis-vector",
  "arcgis-raster-tiles",
  "arcgis-dynamic-mapserver-vector-sublayer",
  "arcgis-dynamic-mapserver-raster-sublayer",
]);

const RASTER_SOURCE_TYPES = new Set([
  "seasketch-raster",
  "arcgis-raster-tiles",
  "arcgis-dynamic-mapserver-raster-sublayer",
  "raster",
  "raster-dem",
  "image",
]);

const UPLOADED_FILE_TYPE_LABELS: Record<string, string> = {
  ZippedShapefile: "Shapefile",
  GeoJSON: "GeoJSON",
  FlatGeobuf: "FlatGeobuf",
  CSV: "CSV",
  GeoTIFF: "GeoTIFF",
  NetCDF: "NetCDF",
  PNG: "PNG",
};

export const catalogColumns: CatalogColumn[] = [
  { header: "Layer name", value: (layer) => layer.title },
  { header: "Folder", value: (layer) => layer.folder },
  { header: "Stable ID", value: (layer) => layer.stableId },
  { header: "Access type", value: (layer) => layer.accessType || "public" },
  {
    header: "Access groups",
    value: (layer) =>
      layer.accessType === "group" ? layer.accessGroupNames.join(", ") : "",
  },
  { header: "Where hosted", value: (layer) => whereHosted(layer) },
  { header: "Service host", value: (layer) => serviceHost(layer) },
  { header: "Source type", value: (layer) => sourceTypeLabel(layer) },
  { header: "Service URL", value: (layer) => serviceUrl(layer) },
  { header: "Sublayer", value: (layer) => sublayerId(layer) },
  { header: "Added at", value: (layer) => addedAt(layer.createdAt) },
  {
    header: "Added by",
    value: (layer) => formatAddedBy(layer.authorName, layer.authorEmail),
  },
  { header: "Spatial type", value: (layer) => spatialType(layer) },
  { header: "Feature count", value: (layer) => featureCount(layer) },
  { header: "Raster type", value: (layer) => rasterType(layer) },
  { header: "Source CRS", value: (layer) => sourceCrs(layer) },
  { header: "Uploaded file type", value: (layer) => uploadedFileType(layer) },
  { header: "Uploaded file", value: (layer) => uploadedFileName(layer) },
  { header: "Uploaded file URL", value: (layer) => uploadedFileUrl(layer) },
  { header: "Tile service URL", value: (layer) => tileServiceUrl(layer) },
  { header: "Normalized file", value: (layer) => normalizedFile(layer).label },
  {
    header: "Normalized file URL",
    value: (layer) => normalizedFile(layer).url,
  },
  { header: "Style URL", value: (layer) => layer.styleUrl },
  { header: "Geostats URL", value: (layer) => layer.geostatsUrl },
  {
    header: "Has metadata",
    value: (layer) => (layer.hasMetadata ? "true" : "false"),
  },
  { header: "Metadata URL", value: (layer) => layer.metadataUrl },
  { header: "Metadata file URL", value: (layer) => metadataFileUrl(layer) },
  {
    header: "Downloadable",
    value: (layer) => (layer.enableDownload ? "Yes" : "No"),
  },
  { header: "Attribution", value: (layer) => layer.attribution?.trim() || "" },
];

export function catalogRecords(
  layers: CatalogLayer[]
): Record<string, string>[] {
  return layers.map((layer) => {
    const record: Record<string, string> = {};
    for (const column of catalogColumns) {
      record[column.header] = column.value(layer);
    }
    return record;
  });
}

export function catalogCsv(layers: CatalogLayer[]): string {
  const header = catalogColumns.map((column) => csvCell(column.header)).join(",");
  const lines = catalogRecords(layers).map((record) =>
    catalogColumns.map((column) => csvCell(record[column.header])).join(",")
  );
  return `\uFEFF${[header, ...lines].join("\r\n")}\r\n`;
}

export function layerResourceUrl(
  origin: string,
  slug: string,
  stableId: string,
  resource: "style" | "geostats" | "metadata"
): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/layers/${encodeURIComponent(slug)}/${encodeURIComponent(
    stableId
  )}/${resource}`;
}

export function whereHosted(layer: Pick<CatalogLayer, "sourceType" | "sourceUrl">): string {
  const sourceType = layer.sourceType;
  if (!sourceType) {
    return "";
  }
  if (SEASKETCH_TYPES.has(sourceType)) {
    return "SeaSketch";
  }
  if (ARCGIS_TYPES.has(sourceType)) {
    const host = hostname(layer.sourceUrl);
    if (host && isArcGisOnlineHost(host)) {
      return "ArcGIS Online";
    }
    return "ArcGIS Enterprise";
  }
  return "Other";
}

export function serviceHost(layer: Pick<CatalogLayer, "sourceType" | "sourceUrl">): string {
  if (!layer.sourceType || SEASKETCH_TYPES.has(layer.sourceType)) {
    return "";
  }
  return hostname(layer.sourceUrl) || "";
}

export function sourceTypeLabel(
  layer: Pick<CatalogLayer, "sourceType" | "sublayerType">
): string {
  const type = layer.sourceType;
  if (!type) {
    return "";
  }
  switch (type) {
    case "arcgis-dynamic-mapserver":
      if (layer.sublayerType === "vector") {
        return "ArcGIS Mapserver Sublayer (vector)";
      }
      if (layer.sublayerType === "raster") {
        return "ArcGIS Mapserver Sublayer (raster)";
      }
      return "ArcGIS Dynamic Mapserver";
    case "arcgis-dynamic-mapserver-vector-sublayer":
      return "ArcGIS Dynamic Mapserver Vector Sublayer";
    case "arcgis-dynamic-mapserver-raster-sublayer":
      return "ArcGIS Dynamic Mapserver Raster";
    case "arcgis-vector":
      return "Vector data hosted on ArcGIS Server";
    case "arcgis-raster-tiles":
      return "Raster tiles hosted on ArcGIS Server";
    case "geojson":
      return "Remote GeoJSON";
    case "image":
      return "Remote Image";
    case "raster":
      return "Remote Raster Tiles";
    case "vector":
      return "Remote Vector Tiles";
    case "raster-dem":
      return "Remote Raster DEM Tiles";
    case "seasketch-mvt":
      return "Vector Tiles hosted on SeaSketch";
    case "seasketch-raster":
      return "Raster Tiles hosted on SeaSketch";
    case "seasketch-vector":
      return "GeoJSON hosted on SeaSketch";
    case "video":
      return "Remote Video";
    case "inaturalist":
      return "iNaturalist Map Service";
    default:
      return type;
  }
}

export function serviceUrl(
  layer: Pick<CatalogLayer, "sourceType" | "sourceUrl" | "sublayer">
): string {
  if (!layer.sourceUrl || !layer.sourceType || SEASKETCH_TYPES.has(layer.sourceType)) {
    return "";
  }
  return appendSublayer(layer.sourceUrl, layer.sublayer);
}

export function spatialType(
  layer: Pick<CatalogLayer, "geostats" | "sourceLayer" | "sourceType" | "sublayerType">
): string {
  if (rasterInfo(layer.geostats)) {
    return "Raster";
  }
  const geometry = vectorGeometry(layer.geostats, layer.sourceLayer);
  if (geometry === "Point" || geometry === "MultiPoint") {
    return "Point";
  }
  if (geometry === "LineString" || geometry === "MultiLineString") {
    return "Line";
  }
  if (geometry === "Polygon" || geometry === "MultiPolygon") {
    return "Polygon";
  }
  if (
    layer.sublayerType === "raster" ||
    (layer.sourceType != null && RASTER_SOURCE_TYPES.has(layer.sourceType))
  ) {
    return "Raster";
  }
  return "";
}

export function featureCount(
  layer: Pick<CatalogLayer, "geostats" | "sourceLayer" | "sourceType" | "sublayerType">
): string {
  if (spatialType(layer) === "Raster") {
    return "";
  }
  const count = vectorCount(layer.geostats, layer.sourceLayer);
  if (count == null) {
    return "";
  }
  return String(count);
}

export function rasterType(
  layer: Pick<CatalogLayer, "geostats" | "sourceLayer" | "sourceType" | "sublayerType">
): string {
  if (spatialType(layer) !== "Raster") {
    return "";
  }
  const info = rasterInfo(layer.geostats);
  if (!info) {
    return "";
  }
  const bandLabel =
    info.bands.length === 1 ? "Single band" : `${info.bands.length} bands`;
  const presentation = rasterPresentationLabel(info.presentation, info.bands.length);
  if (!presentation) {
    return bandLabel;
  }
  return `${bandLabel}, ${presentation}`;
}

export function formatAddedBy(
  name: string | null | undefined,
  email: string | null | undefined
): string {
  const trimmedName = name?.trim() || "";
  const trimmedEmail = email?.trim() || "";
  if (trimmedName && trimmedEmail) {
    return `${trimmedName} <${trimmedEmail}>`;
  }
  if (trimmedEmail) {
    return trimmedEmail;
  }
  if (trimmedName) {
    return trimmedName;
  }
  return "Unknown";
}

export function addedAt(value: Date | string | null | undefined): string {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function sublayerId(layer: CatalogLayer): string {
  if (!layer.sublayer || SEASKETCH_TYPES.has(layer.sourceType || "")) {
    return "";
  }
  return layer.sublayer;
}

function sourceCrs(layer: CatalogLayer): string {
  const original = originalOutput(layer);
  if (!original || original.epsg == null || !Number.isFinite(original.epsg) || original.epsg <= 0) {
    return "";
  }
  return `EPSG:${original.epsg}`;
}

function uploadedFileType(layer: CatalogLayer): string {
  const original = originalOutput(layer);
  if (original) {
    return UPLOADED_FILE_TYPE_LABELS[original.type] || original.type;
  }
  if (layer.sourceType === "seasketch-vector" && layer.sourceUrl) {
    return "GeoJSON";
  }
  return "";
}

function uploadedFileName(layer: CatalogLayer): string {
  const original = originalOutput(layer);
  if (original?.originalFilename) {
    return original.originalFilename;
  }
  if (original || (layer.sourceType === "seasketch-vector" && layer.sourceUrl)) {
    return layer.uploadedSourceFilename || "";
  }
  return "";
}

function uploadedFileUrl(layer: CatalogLayer): string {
  const original = originalOutput(layer);
  if (original?.url) {
    return original.url;
  }
  if (layer.sourceType === "seasketch-vector" && layer.sourceUrl) {
    return layer.sourceUrl;
  }
  return "";
}

function tileServiceUrl(layer: CatalogLayer): string {
  if (
    (layer.sourceType === "seasketch-mvt" || layer.sourceType === "seasketch-raster") &&
    layer.sourceUrl
  ) {
    if (layer.sourceUrl.endsWith(".json")) {
      return layer.sourceUrl;
    }
    return `${layer.sourceUrl}.json`;
  }
  return "";
}

function normalizedFile(layer: CatalogLayer): { label: string; url: string } {
  const candidates = layer.outputs.filter(
    (output) =>
      !output.isOriginal &&
      (output.type === "FlatGeobuf" || output.type === "GeoTIFF") &&
      output.url
  );
  if (candidates.length === 0) {
    return { label: "", url: "" };
  }
  const prefer = spatialType(layer) === "Raster" ? "GeoTIFF" : "FlatGeobuf";
  const match = candidates.find((output) => output.type === prefer) || candidates[0];
  return {
    label: match.type === "GeoTIFF" ? "GeoTIFF" : "FlatGeobuf",
    url: match.url,
  };
}

function metadataFileUrl(layer: CatalogLayer): string {
  const xml = layer.outputs.find((output) => output.type === "XMLMetadata" && output.url);
  return xml?.url || "";
}

function originalOutput(layer: CatalogLayer): CatalogOutput | undefined {
  return layer.outputs.find((output) => output.isOriginal && output.url);
}

function appendSublayer(url: string, sublayer: string | null): string {
  if (!sublayer) {
    return url;
  }
  const suffix = `/${sublayer}`;
  if (url.endsWith(suffix)) {
    return url;
  }
  return `${url.replace(/\/$/, "")}${suffix}`;
}

function hostname(url: string | null): string | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isArcGisOnlineHost(host: string): boolean {
  return host === "arcgis.com" || host.endsWith(".arcgis.com");
}

type RasterDetails = {
  bands: unknown[];
  presentation: unknown;
};

function rasterInfo(geostats: unknown): RasterDetails | null {
  if (!isRecord(geostats) || !Array.isArray(geostats.bands)) {
    return null;
  }
  return { bands: geostats.bands, presentation: geostats.presentation };
}

function rasterPresentationLabel(presentation: unknown, bandCount: number): string {
  const name =
    presentation === 0 || presentation === "categorical"
      ? "categorical"
      : presentation === 1 || presentation === "continuous"
        ? "continuous"
        : presentation === 2 || presentation === "rgb"
          ? "rgb"
          : "";
  if (name === "categorical") {
    return "categorical";
  }
  if (name === "continuous") {
    return "data values";
  }
  if (name === "rgb") {
    return bandCount === 3 ? "RGB" : "RGBA";
  }
  return "";
}

function vectorLayer(geostats: unknown, sourceLayer: string | null): Record<string, unknown> | null {
  if (!isRecord(geostats) || Array.isArray(geostats.bands)) {
    return null;
  }
  const layers = geostats.layers;
  if (Array.isArray(layers)) {
    if (sourceLayer) {
      const match = layers.find(
        (layer) => isRecord(layer) && layer.layer === sourceLayer
      );
      if (isRecord(match)) {
        return match;
      }
    }
    const first = layers[0];
    return isRecord(first) ? first : null;
  }
  if (typeof geostats.geometry === "string") {
    return geostats;
  }
  return null;
}

function vectorGeometry(geostats: unknown, sourceLayer: string | null): string | null {
  const layer = vectorLayer(geostats, sourceLayer);
  const geometry = layer?.geometry;
  return typeof geometry === "string" ? geometry : null;
}

function vectorCount(geostats: unknown, sourceLayer: string | null): number | null {
  const layer = vectorLayer(geostats, sourceLayer);
  const count = layer?.count;
  if (typeof count === "number" && Number.isFinite(count)) {
    return count;
  }
  if (typeof count === "string" && count.trim() && Number.isFinite(Number(count))) {
    return Number(count);
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
