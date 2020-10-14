import { Layer, LngLatBoundsLike } from "mapbox-gl";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { Symbol } from "arcgis-rest-api";
import { ImageList } from "@seasketch/mapbox-gl-esri-sources/dist/src/ImageList";
import { styleForFeatureLayer } from "@seasketch/mapbox-gl-esri-sources";
import { v4 as uuid } from "uuid";

export interface NormalizedArcGISServerLocation {
  baseUrl: string;
  servicesRoot: string;
  location: string;
}

export function normalizeArcGISServerUrl(
  url: string
): NormalizedArcGISServerLocation {
  if (/arcgis\/rest\/services/.test(url)) {
    const parts = url.split("/arcgis/rest/services");
    const baseUrl = parts[0];
    const servicesRoot = baseUrl + "/arcgis/rest/services";
    const location = parts[1].replace(/\/$/, "") || "/";
    return { baseUrl, servicesRoot, location };
  } else if (/arcgis\/rest/.test(url)) {
    const parts = url.split("/arcgis/rest");
    const baseUrl = parts[0];
    const servicesRoot = baseUrl + "/arcgis/rest/services";
    const location = "/";
    return { baseUrl, servicesRoot, location };
  } else if (/arcgis/.test(url)) {
    const parts = url.split("/arcgis");
    const baseUrl = parts[0];
    const servicesRoot = baseUrl + "/arcgis/rest/services";
    const location = "/";
    return { baseUrl, servicesRoot, location };
  } else if (/arcgis/.test(url)) {
    return {
      baseUrl: "",
      servicesRoot: "",
      location: "",
    };
  } else {
    const baseUrl = url.replace(/\/$/, "");
    const servicesRoot = baseUrl + "/arcgis/rest/services";
    return {
      baseUrl,
      location: "/",
      servicesRoot,
    };
  }
}

export interface SpatialReference {
  /** Code for projection at the time of publishing. */
  wkid: number | string;
  /** References the most up-to-date code for this projection in the current version of arcgis. For example, wkid might be 102100, but wkid would be 3857. https://support.esri.com/en/technical-article/000013950#:~:text=At%20ArcGIS%20version%2010%2C%20the,changed%20from%20102100%20to%203857.&text=For%20ArcGIS%20version%2010.1%20and,with%20the%20same%20spatial%20reference. */
  latestWkid?: number | string;
}

export function normalizeSpatialReference(sr: SpatialReference) {
  const wkid = sr.latestWkid || sr.wkid;
  if (typeof wkid === "string") {
    if (/WGS\s*84/.test(wkid)) {
      return 4326;
    } else {
      return -1;
    }
  } else {
    return wkid || -1;
  }
}

export interface MapServerCatalogInfo {
  url: string;
  currentVersion: number;
  serviceDescription: string;
  description: string;
  mapName: string;
  copyrightText: string;
  supportsDynamicLayers: boolean;
  layers: SummaryLayerInfo[];
  spatialReference: SpatialReference;
  singleFusedMapCache: false;
  initialExtent: Extent;
  fullExtent: Extent;
  minScale: number;
  maxScale: number;
  /** comma-delimited */
  supportedImageFormatTypes: string;
  documentInfo: {
    Title: string;
    Author: string;
    Comments: string;
    Subject: string;
    Category: string;
    AntialiasingMode: string;
    TextAntialiasingMode: string;
    /** comma-delimited */
    Keywords: string;
  };
  /** comma-delimited */
  capabilities: string;
  /** comma-delimited */
  supportedQueryFormats: string;
  supportsDatumTransformation: boolean;
  maxRecordCount: number;
  maxImageHeight: number;
  maxImageWidth: number;
}

export interface Extent {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  spatialReference: SpatialReference;
}

export interface SummaryLayerInfo {
  id: number;
  name: string;
  parentLayerId: number;
  defaultVisibility: number;
  subLayerIds: number;
  minScale: number;
  maxScale: number;
}

export interface LayerInfo {
  id: number;
  url: string;
  type: "Feature Layer" | "Raster Layer" | "Group Layer";
  geometryType:
    | "esriGeometryPoint"
    | "esriGeometryLine"
    | "esriGeometryPolyline"
    | "esriGeometryPolygon"
    | "esriGeometryMultipoint";
  defaultVisibility: boolean;
  parentLayer?: { id: number };
  extent: Extent;
  drawingInfo: {
    renderer: Symbol;
    scaleSymbols: boolean;
    transparency: number;
    labelingInfo: any;
  };
  name: string;
  advancedQueryCapabilities: {
    supportsPagination: boolean;
  };
  mapboxLayers: Layer[];
  imageList: ImageList;
  generatedSourceId: string;
}

const mapServerInfoCache: {
  [url: string]: {
    mapServerInfo: MapServerCatalogInfo;
    layerInfo: LayerInfo[];
  };
} = {};

export function useMapServerInfo(location: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [data, setData] = useState<{
    mapServerInfo: MapServerCatalogInfo;
    layerInfo: LayerInfo[];
  }>();

  useEffect(() => {
    setLoading(false);
    setError(undefined);
    setData(undefined);
    if (!location) {
      return;
    }
    const cache = mapServerInfoCache[location];
    if (mapServerInfoCache[location]) {
      setData({
        mapServerInfo: cache.mapServerInfo,
        layerInfo: cache.layerInfo,
      });
      setError(undefined);
      setLoading(false);
    } else {
      let abortController = new AbortController();
      setLoading(true);
      fetch(location + "?f=json", {
        signal: abortController.signal,
        // cache: "force-cache",
      })
        .then(async (r) => {
          const mapServerData = await r.json();
          mapServerData.url = location;
          if (!abortController.signal.aborted) {
            fetch(`${location}/layers?f=json`, {
              signal: abortController.signal,
              // cache: "force-cache",
            }).then(async (r) => {
              const layerData = await r.json();
              setError(undefined);
              setLoading(false);
              const layerInfo: LayerInfo[] = await Promise.all(
                layerData.layers.map(async (lyr: LayerInfo) => {
                  if (lyr.type === "Feature Layer") {
                    const generatedSourceId = uuid();
                    const { layers, imageList } = await styleForFeatureLayer(
                      location + "/" + lyr.id,
                      generatedSourceId
                    );
                    return {
                      ...lyr,
                      generatedSourceId,
                      mapboxLayers: layers,
                      imageList,
                      url: `${location}/${lyr.id}`,
                    };
                  } else {
                    return lyr;
                  }
                })
              );
              const d = {
                mapServerInfo: mapServerData,
                layerInfo,
              };
              setData(d);
              mapServerInfoCache[location] = d;
            });
          }
        })
        .catch((e) => setError(e));
      return () => abortController.abort();
    }
  }, [location]);

  return {
    loading,
    error,
    data,
  };
}

export function metersToDegrees(x: number, y: number): [number, number] {
  var lon = (x * 180) / 20037508.34;
  var lat =
    (Math.atan(Math.exp((y * Math.PI) / 20037508.34)) * 360) / Math.PI - 90;
  return [lon, lat];
}

export function extentToLatLngBounds(extent: Extent): LngLatBoundsLike | void {
  if (extent) {
    const wkid = normalizeSpatialReference(extent.spatialReference);
    if (wkid === 4326) {
      return [
        [extent.xmin, extent.ymin],
        [extent.xmax, extent.ymax],
      ];
    } else if (wkid === 3857) {
      return [
        metersToDegrees(extent.xmin, extent.ymin),
        metersToDegrees(extent.xmax, extent.ymax),
      ];
    }
  }
}

export type MapServerImageFormat =
  | "PNG"
  | "PNG8"
  | "PNG32"
  | "GIF"
  | "JPG"
  | "PNG24";

// export interface ArcGISVectorSublayerDetails {
//   [sublayerId: number]: ArcGISVectorSublayerDetail;
// }

// export interface ArcGISVectorSublayerDetail {
//   data?: {
//     /** in bytes */
//     estimatedSize: number;
//     numberOfFeatures: number;
//     supportsPagination: boolean;
//   };
//   loading: boolean;
//   error?: string;
// }

// export function useArcGISVectorSublayerDetails(
//   layers: LayerInfo[],
//   baseServiceLocation: string
// ) {
//   const [data, setData] = useState<ArcGISVectorSublayerDetails>();

//   useEffect(() => {
//     const abortController = new AbortController();
//     (async () => {
//       for (const layer of layers.filter((l) => l.type === "Feature Layer")) {
//         if (!abortController.signal.aborted) {
//           setData((prev) => {
//             prev = prev || {};
//             prev[layer.id] = {
//               loading: true,
//             };
//             return { ...prev };
//           });
//           try {
//             const sublayerData = await fetchVectorSublayerDetails(
//               baseServiceLocation,
//               layer
//             );
//             if (!abortController.signal.aborted) {
//               setData((prev) => {
//                 prev![layer.id].data = {
//                   ...sublayerData,
//                 };
//                 prev![layer.id].loading = false;
//                 return { ...prev };
//               });
//             }
//           } catch (e) {
//             setData((prev) => {
//               prev = prev || {};
//               prev[layer.id] = {
//                 loading: true,
//               };
//               return { ...prev };
//             });
//           }
//         }
//       }
//     })();
//     return () => {
//       setData({});
//       abortController.abort();
//     };
//   }, [layers, baseServiceLocation]);
//   return data;
// }

// async function fetchVectorSublayerDetails(
//   baseServiceLocation: string,
//   layer: LayerInfo
// ): Promise<{
//   estimatedSize: number;
//   numberOfFeatures: number;
//   supportsPagination: boolean;
// }> {
//   const data = {
//     supportsPagination: layer.advancedQueryCapabilities.supportsPagination,
//     numberOfFeatures: 0,
//     estimatedSize: 0,
//   };
//   const location = `${baseServiceLocation}/${layer.id}`;
//   // Get count
//   const response = await fetch(
//     `${location}/query?f=json&where=1>0&returnCountOnly=true`,
//     {
//       cache: "force-cache",
//     }
//   );
//   if (!response.ok) {
//     throw new Error("Invalid return data");
//   } else {
//     const json = await response.json();
//     data.numberOfFeatures = json.count as number;
//   }
//   // Get size
//   let query = `${location}/query?f=geojson&where=1>0&geometryPrecision=6`;
//   if (layer.advancedQueryCapabilities.supportsPagination) {
//     query = query + "&resultRecordCount=10&resultOffset=0&outFields=*";
//   }
//   const geomResponse = await fetch(query, { cache: "force-cache" });
//   if (!response.ok) {
//     throw new Error("Problem fetching sample of geometry");
//   }
//   const jsonData = await geomResponse.json();
//   const size = new TextEncoder().encode(JSON.stringify(jsonData)).length;
//   data.estimatedSize =
//     data.numberOfFeatures <= 10
//       ? size
//       : (size / jsonData.features.length) * data.numberOfFeatures;

//   return data;
// }

export interface CatalogItem {
  name: string;
  type:
    | "Folder"
    | "GPServer"
    | "MapServer"
    | "FeatureServer"
    | "GeometryServer"
    | "GeocodeServer";
  url: string;
}

export function useCatalogItems(location: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [catalogInfo, setCatalogInfo] = useState<CatalogItem[]>();

  useEffect(() => {
    let abortController = new AbortController();
    fetch(location + "?f=json", {
      signal: abortController.signal,
      // cache: "force-cache",
    }).then(async (r) => {
      const data = await r.json();
      if (!abortController.signal.aborted) {
        setError(undefined);
        setLoading(false);
        const info = [
          ...data.folders.map((name: string) => ({ name, type: "Folder" })),
          ...data.services,
        ].map((item) => {
          const baseLocation =
            location.split("rest/services")[0] + "rest/services";
          let url = baseLocation + "/" + item.name;
          if (item.type !== "Folder") {
            url += "/" + item.type;
          }
          let name = item.name;
          if (/\//.test(item.name)) {
            name = item.name.split("/").slice(-1);
          }
          return {
            name,
            url,
            type: item.type,
          };
        });
        setCatalogInfo(info);
      }
    });
    return () => abortController.abort();
  }, [location]);

  return {
    loading: loading,
    error: error,
    catalogInfo: catalogInfo,
  };
}

type RenderUnderBasemapLayers = "labels" | "land" | "none";

export interface ArcGISServiceSettings {
  sourceType: "arcgis-dynamic-mapservice" | "arcgis-vector-source";
  enableHighDpi: boolean;
  imageFormat: MapServerImageFormat;
  renderUnder: RenderUnderBasemapLayers;
  excludedSublayers: number[];
  vectorSublayerSettings: VectorSublayerSettings[];
  preferInstantLayers: boolean;
}

export interface VectorSublayerSettings {
  sublayer: number;
  renderUnder: RenderUnderBasemapLayers;
  instantLayers: boolean;
  geobufSource?: string;
  geometryPrecision: 4 | 5 | 6 | 7;
  ignoreByteLimit: boolean;
  // tileSource: string;
  // tileJobId: string;
}

const defaultServiceSettings: ArcGISServiceSettings = {
  sourceType: "arcgis-dynamic-mapservice",
  enableHighDpi: true,
  imageFormat: "PNG",
  renderUnder: "labels",
  excludedSublayers: [],
  vectorSublayerSettings: [],
  preferInstantLayers: true,
};

const settingsCache: { [location: string]: ArcGISServiceSettings } = {};

export function useArcGISServiceSettings(
  location: string | undefined
): [
  ArcGISServiceSettings | undefined,
  (settings: ArcGISServiceSettings) => void
] {
  // eventually, init from localstorage too
  const [settings, setSettings] = useState<ArcGISServiceSettings>();
  useEffect(() => {
    if (location) {
      setSettings(settingsCache[location] || defaultServiceSettings);
    } else {
      setSettings(undefined);
    }
  }, [location]);
  function updateSettings(settings: ArcGISServiceSettings) {
    setSettings(settings);
    if (location) {
      settingsCache[location] = settings;
    }
  }
  return [settings, updateSettings];
}

const visibleLayersCache: { [location: string]: number[] } = {};

export function useVisibleLayersSettings(
  location?: string
): [number[] | undefined, (layers: number[]) => void] {
  const [visibleLayers, setVisibleLayers] = useState<number[]>();
  useEffect(() => {
    if (location) {
      setVisibleLayers(visibleLayersCache[location] || undefined);
    } else {
      setVisibleLayers(undefined);
    }
  }, [location]);
  return [
    visibleLayers,
    (layers: number[]) => {
      setVisibleLayers(layers);
      if (location) {
        visibleLayersCache[location] = layers;
      }
    },
  ];
}
