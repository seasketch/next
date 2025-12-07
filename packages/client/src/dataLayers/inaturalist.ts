/* eslint-disable i18next/no-literal-string */
import { AnyLayer, AnySourceData } from "mapbox-gl";

export type InaturalistLayerType =
  | "grid+points"
  | "points"
  | "grid"
  | "heatmap"
  | "heatmap+points";

export interface InaturalistQueryParams {
  projectId: string | null;
  taxonIds: number[];
  d1: string | null;
  d2: string | null;
  verifiable: boolean;
  color: string | null;
  type: InaturalistLayerType;
  zoomCutoff: number;
  showCallToAction?: boolean;
}

export const DEFAULT_ZOOM_CUTOFF = 9;
export const MIN_ZOOM_CUTOFF = 3;
export const MAX_ZOOM_CUTOFF = 13;
export const RASTER_SOURCE_MAX_ZOOM = 18;
export const RASTER_LAYER_MAX_ZOOM = 20;

const INAT_BASE_URL = "https://api.inaturalist.org/v1";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function normalizeInaturalistParams(
  raw: Partial<InaturalistQueryParams> | null | undefined
): InaturalistQueryParams {
  const type: InaturalistLayerType =
    (raw?.type as InaturalistLayerType | undefined) || "grid+points";
  const zoomCutoff = clamp(
    raw?.zoomCutoff ?? DEFAULT_ZOOM_CUTOFF,
    MIN_ZOOM_CUTOFF,
    MAX_ZOOM_CUTOFF
  );

  return {
    projectId:
      raw?.projectId === null || raw?.projectId === undefined
        ? null
        : String(raw.projectId),
    taxonIds: Array.isArray(raw?.taxonIds)
      ? raw!.taxonIds.map((id: any) => Number(id)).filter((id) => !isNaN(id))
      : [],
    d1: raw?.d1 ?? null,
    d2: raw?.d2 ?? null,
    verifiable: raw?.verifiable !== false,
    color:
      raw?.color && typeof raw.color === "string"
        ? raw.color.replace("#", "")
        : null,
    type,
    zoomCutoff,
    showCallToAction: raw?.showCallToAction ?? false,
  };
}

export function buildInaturalistTileUrl(
  rawParams: Partial<InaturalistQueryParams>,
  layerType: "grid" | "points" | "heatmap"
): string {
  const queryString = buildInaturalistQueryString(rawParams);
  return `${INAT_BASE_URL}/${layerType}/{z}/{x}/{y}.png${queryString}`;
}

type BuildIdsOptions = {
  sourceIdBase: string;
  layerIdBase?: string;
  attribution?: string | null;
  opacity?: number;
};

type BuildIdsResult = {
  sources: Record<string, AnySourceData>;
  layers: AnyLayer[];
};

export function buildInaturalistSources(
  rawParams: Partial<InaturalistQueryParams>,
  options: BuildIdsOptions
): Record<string, AnySourceData> {
  return buildInaturalistSourcesAndLayers(rawParams, options).sources;
}

export function buildInaturalistLayers(
  rawParams: Partial<InaturalistQueryParams>,
  options: BuildIdsOptions
): AnyLayer[] {
  return buildInaturalistSourcesAndLayers(rawParams, options).layers;
}

export function buildInaturalistQueryString(
  rawParams: Partial<InaturalistQueryParams>
): string {
  const params = normalizeInaturalistParams(rawParams);
  const queryParts: string[] = [];

  if (params.projectId) {
    queryParts.push(`project_id=${encodeURIComponent(params.projectId)}`);
  }

  if (params.taxonIds.length > 0) {
    queryParts.push(`taxon_id=${params.taxonIds.join(",")}`);
  }

  if (params.d1) {
    queryParts.push(`d1=${encodeURIComponent(params.d1)}`);
  }

  if (params.d2) {
    queryParts.push(`d2=${encodeURIComponent(params.d2)}`);
  }

  if (params.verifiable) {
    queryParts.push("verifiable=true");
  }

  if (params.color) {
    queryParts.push(`color=${encodeURIComponent(params.color)}`);
  }

  const queryString = queryParts.length ? `?${queryParts.join("&")}` : "";
  return queryString;
}

export function buildInaturalistSourcesAndLayers(
  rawParams: Partial<InaturalistQueryParams>,
  options: BuildIdsOptions
): BuildIdsResult {
  const params = normalizeInaturalistParams(rawParams);
  const sources: Record<string, AnySourceData> = {};
  const layers: AnyLayer[] = [];
  const opacity = typeof options.opacity === "number" ? options.opacity : 1;
  const layerIdBase = options.layerIdBase || options.sourceIdBase;

  const addRaster = (
    key: string,
    layerId: string,
    layerType: "grid" | "points" | "heatmap",
    minzoom: number,
    maxzoom: number
  ) => {
    sources[key] = {
      type: "raster",
      tiles: [buildInaturalistTileUrl(params, layerType)],
      tileSize: 256,
      maxzoom: RASTER_SOURCE_MAX_ZOOM,
      ...(options.attribution ? { attribution: options.attribution } : {}),
    };
    layers.push({
      id: layerId,
      type: "raster",
      source: key,
      minzoom,
      maxzoom,
      paint: {
        "raster-opacity": opacity,
      },
    });
  };

  const sourceBase = options.sourceIdBase;
  const layerBase = `inaturalist-${layerIdBase}`;

  if (params.type === "grid+points") {
    addRaster(sourceBase, `${layerBase}-grid`, "grid", 0, params.zoomCutoff);
    addRaster(
      `${sourceBase}-points`,
      `${layerBase}-points`,
      "points",
      params.zoomCutoff,
      RASTER_LAYER_MAX_ZOOM
    );
  } else if (params.type === "heatmap+points") {
    addRaster(
      `${sourceBase}-heatmap`,
      `${layerBase}-heatmap`,
      "heatmap",
      0,
      params.zoomCutoff
    );
    addRaster(
      `${sourceBase}-points`,
      `${layerBase}-points`,
      "points",
      params.zoomCutoff,
      RASTER_LAYER_MAX_ZOOM
    );
  } else if (params.type === "grid") {
    addRaster(
      sourceBase,
      `${layerBase}-grid`,
      "grid",
      0,
      RASTER_LAYER_MAX_ZOOM
    );
  } else if (params.type === "heatmap") {
    addRaster(
      sourceBase,
      `${layerBase}-heatmap`,
      "heatmap",
      0,
      RASTER_LAYER_MAX_ZOOM
    );
  } else {
    addRaster(
      sourceBase,
      `${layerBase}-points`,
      "points",
      0,
      RASTER_LAYER_MAX_ZOOM
    );
  }

  return { sources, layers };
}
