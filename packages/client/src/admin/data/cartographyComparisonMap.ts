import type {
  AnyLayer,
  AnySourceData,
  Map as MapboxMap,
  Style,
} from "mapbox-gl";
import cloneDeep from "lodash.clonedeep";
import {
  BasemapDetailsFragment,
  BasemapType,
  DataLayer,
  DataSourceTypes,
  FullAdminSourceFragment,
} from "../../generated/graphql";
import { fetchGlStyle } from "../../useMapboxStyle";
import { idForLayer } from "../../dataLayers/MapContextManager";

export async function loadBaseStyleForBasemap(
  basemap?: BasemapDetailsFragment | null
): Promise<Style> {
  const url =
    basemap?.url ||
    // eslint-disable-next-line i18next/no-literal-string -- Mapbox style URL fallback
    "mapbox://styles/underbluewaters/cklb3vusx2dvs17pay6jp5q7e";
  if (basemap?.type === BasemapType.RasterUrlTemplate) {
    let rasterUrl = basemap.url;
    if (
      rasterUrl.indexOf("services.arcgisonline.com") > -1 &&
      process.env.REACT_APP_ARCGIS_DEVELOPER_API_KEY
    ) {
      // eslint-disable-next-line i18next/no-literal-string -- API query param
      rasterUrl += `?token=${process.env.REACT_APP_ARCGIS_DEVELOPER_API_KEY}`;
    }
    return {
      version: 8,
      // eslint-disable-next-line i18next/no-literal-string
      glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
      // eslint-disable-next-line i18next/no-literal-string
      sprite: "mapbox://sprites/mapbox/streets-v11",
      sources: {
        raster: {
          type: "raster",
          tiles: [rasterUrl],
          tileSize: 256,
          ...(basemap.maxzoom ? { maxzoom: basemap.maxzoom } : {}),
        },
      },
      layers: [
        {
          id: "bg",
          type: "background",
          paint: {
            "background-color": "#efefef",
          },
        },
        {
          id: "raster-tiles",
          type: "raster",
          source: "raster",
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    };
  }
  try {
    return await fetchGlStyle(url);
  } catch {
    return await fetchGlStyle(
      // eslint-disable-next-line i18next/no-literal-string -- Mapbox style URL fallback
      "mapbox://styles/underbluewaters/cklb5eho20sb817qhmzltsrpf"
    );
  }
}

export function buildMapboxSourceForDataSource(
  source: FullAdminSourceFragment
): AnySourceData {
  switch (source.type) {
    case DataSourceTypes.Vector:
      return {
        type: "vector",
        attribution: source.attribution || "",
        tiles: source.tiles as string[],
        ...(source.bounds
          ? {
              bounds: source.bounds.map((b) =>
                parseFloat((b as unknown as string).toString())
              ),
            }
          : {}),
        ...(source.minzoom !== undefined
          ? {
              minzoom: parseInt(source.minzoom?.toString() || "0", 10),
            }
          : {}),
        ...(source.maxzoom !== undefined
          ? {
              maxzoom: parseInt(source.maxzoom?.toString() || "0", 10),
            }
          : {}),
      };
    case DataSourceTypes.SeasketchMvt: {
      let url = source.url!;
      if (!/\.json$/.test(url)) {
        url += ".json";
      }
      return {
        type: "vector",
        url,
        attribution: source.attribution || "",
      };
    }
    case DataSourceTypes.SeasketchVector:
    case DataSourceTypes.Geojson:
      return {
        type: "geojson",
        data: source.url!,
        attribution: source.attribution || "",
      };
    case DataSourceTypes.SeasketchRaster:
      if (source.url) {
        let url = source.url!;
        if (!/\.json$/.test(url)) {
          url += ".json";
        }
        return {
          type: "raster",
          url,
          attribution: source.attribution || "",
        };
      }
      throw new Error("SeasketchRaster source needs url");
    default:
      throw new Error(`Unsupported source type for cartography preview`);
  }
}

export function buildOverlayLayers(
  mapboxGlStyles: unknown[],
  dataLayer: Pick<
    DataLayer,
    "id" | "sourceLayer" | "sublayer" | "dataSourceId"
  >,
  source: FullAdminSourceFragment,
  overlaySourceKey: string
): AnyLayer[] {
  const staticLayers = Array.isArray(mapboxGlStyles) ? mapboxGlStyles : [];
  const shouldHaveSourceLayer =
    source.type === DataSourceTypes.SeasketchMvt ||
    source.type === DataSourceTypes.Vector;
  return staticLayers.map((lyr, i) => {
    const fragment =
      lyr !== null &&
      typeof lyr === "object" &&
      !Array.isArray(lyr)
        ? (lyr as Record<string, unknown>)
        : {};
    return {
      ...fragment,
      source: overlaySourceKey,
      id: idForLayer(dataLayer, i),
      ...(shouldHaveSourceLayer
        ? {
            "source-layer": dataLayer.sourceLayer as string,
          }
        : {}),
    } as AnyLayer;
  });
}

export function augmentStyleWithOverlay(
  base: Style,
  overlaySourceKey: string,
  source: FullAdminSourceFragment,
  dataLayer: Pick<
    DataLayer,
    "id" | "sourceLayer" | "sublayer" | "dataSourceId"
  >,
  mapboxGlStyles: unknown[]
): Style {
  const style = cloneDeep(base);
  style.sources = {
    ...(style.sources || {}),
    [overlaySourceKey]: buildMapboxSourceForDataSource(source),
  };
  const overlayLayers = buildOverlayLayers(
    mapboxGlStyles,
    dataLayer,
    source,
    overlaySourceKey
  );
  style.layers = [...(style.layers || []), ...overlayLayers];
  return style;
}

/** Remove SeaSketch overlay layers + source created for cartography preview */
function removeDataLayerOverlayFromMap(
  map: MapboxMap,
  dataLayerId: number,
  overlaySourceKey: string
): void {
  // eslint-disable-next-line i18next/no-literal-string -- Mapbox layer id prefix
  const prefix = `seasketch/${dataLayerId}/`;
  const style = map.getStyle();
  const ids =
    style.layers
      ?.map((l) => l.id)
      .filter(
        (id): id is string =>
          typeof id === "string" && id.startsWith(prefix)
      ) ?? [];
  for (const id of [...ids].reverse()) {
    try {
      if (map.getLayer(id)) {
        map.removeLayer(id);
      }
    } catch {
      // ignore
    }
  }
  try {
    if (map.getSource(overlaySourceKey)) {
      map.removeSource(overlaySourceKey);
    }
  } catch {
    // ignore
  }
}

/**
 * Swap overlay GL layers without replacing the basemap style (avoids full map reload).
 */
export function replaceOverlayOnMap(
  map: MapboxMap,
  overlaySourceKey: string,
  source: FullAdminSourceFragment,
  dataLayer: Pick<
    DataLayer,
    "id" | "sourceLayer" | "sublayer" | "dataSourceId"
  >,
  mapboxGlStyles: unknown[]
): void {
  removeDataLayerOverlayFromMap(map, dataLayer.id, overlaySourceKey);
  const layers = Array.isArray(mapboxGlStyles) ? mapboxGlStyles : [];
  if (layers.length === 0) {
    return;
  }
  map.addSource(overlaySourceKey, buildMapboxSourceForDataSource(source));
  const built = buildOverlayLayers(
    layers,
    dataLayer,
    source,
    overlaySourceKey
  );
  for (const layer of built) {
    map.addLayer(layer);
  }
}

export function tocOrSourceBounds(
  tocBounds?: (number | null)[] | null,
  sourceBounds?: (number | null)[] | null
): [number, number, number, number] | null {
  const raw = tocBounds?.length === 4 ? tocBounds : sourceBounds;
  if (!raw || raw.length < 4) {
    return null;
  }
  const nums = raw.map((x) => Number(x));
  if (nums.some((n) => Number.isNaN(n))) {
    return null;
  }
  const [minx, miny, maxx, maxy] = nums;
  if (minx === 180 && miny === 90 && maxx === -180 && maxy === -90) {
    return null;
  }
  return [minx, miny, maxx, maxy];
}
