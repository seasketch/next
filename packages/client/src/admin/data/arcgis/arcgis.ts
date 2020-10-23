import { Layer, LngLatBoundsLike } from "mapbox-gl";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { Symbol } from "arcgis-rest-api";
import { ImageList } from "@seasketch/mapbox-gl-esri-sources";
import { styleForFeatureLayer } from "@seasketch/mapbox-gl-esri-sources";
import { v4 as uuid } from "uuid";
import { fetchFeatureLayerData } from "@seasketch/mapbox-gl-esri-sources/dist/src/ArcGISVectorSource";
import bboxPolygon from "@turf/bbox-polygon";
import area from "@turf/area";
import bbox from "@turf/bbox";
import geobuf from "geobuf";
import Pbf from "pbf";
import { TableOfContentsNode } from "../../../dataLayers/tableOfContents/TableOfContents";

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
  generatedId: string;
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
  generatedId: string;
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
          mapServerData.generatedId = uuid();
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
                    const generatedId = uuid();
                    const { layers, imageList } = await styleForFeatureLayer(
                      location + "/" + lyr.id,
                      generatedId
                    );
                    return {
                      ...lyr,
                      generatedId,
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
  geometryPrecision: 4 | 5 | 6;
  ignoreByteLimit: boolean;
  mapboxLayers?: any[];
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

export function useFeatureLayerSizeData(
  url: string,
  settings?: VectorSublayerSettings
) {
  const [data, setData] = useState<{
    geoJsonBytes: number;
    geobufBytes: number;
    areaKm: number;
  }>();
  const [loading, setLoading] = useState<boolean>();
  const [error, setError] = useState<Error>();

  function updateStats() {
    if (url) {
      setLoading(true);
      fetchFeatureLayerData(
        url,
        "*",
        (e) => {
          setLoading(false);
          setError(e);
        },
        settings?.geometryPrecision || 6
      ).then((featureCollection) => {
        const geoJsonBytes = byteLength(JSON.stringify(featureCollection));
        const box = bboxPolygon(bbox(featureCollection));
        const sqMeters = area(box);
        const areaKm = sqMeters / 1000000;
        const buffer = geobuf.encode(featureCollection, new Pbf());
        setData({
          geoJsonBytes,
          geobufBytes: buffer.length,
          areaKm,
        });
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }

  useEffect(() => {
    setData(undefined);
    setError(undefined);
    updateStats();
  }, [settings?.geometryPrecision, url]);
  return {
    data,
    loading,
    error,
  };
}

// https://stackoverflow.com/a/23329386/299467
function byteLength(str: string) {
  // returns the byte length of an utf8 string
  var s = str.length;
  for (var i = str.length - 1; i >= 0; i--) {
    var code = str.charCodeAt(i);
    if (code > 0x7f && code <= 0x7ff) s++;
    else if (code > 0x7ff && code <= 0xffff) s += 2;
    if (code >= 0xdc00 && code <= 0xdfff) i--; //trail surrogate
  }
  return s;
}

export function treeDataFromLayerList(layers: LayerInfo[]) {
  let data: TableOfContentsNode[] = [];
  let nodesBySublayer: { [id: string]: TableOfContentsNode } = {
    root: {
      id: "root",
      title: "Layers",
      expanded: true,
      type: "folder",
      children: [],
    },
  };
  const root = nodesBySublayer["root"];
  data.push(root);
  if (layers.length) {
    for (const layer of layers) {
      const node: TableOfContentsNode = {
        id: layer.generatedId,
        title: layer.name,
        expanded: false,
        type: layer.type === "Group Layer" ? "folder" : "layer",
      };
      nodesBySublayer[layer.id] = node;
      if (layer.parentLayer && layer.parentLayer.id !== -1) {
        const parent = nodesBySublayer[layer.parentLayer.id];
        if (!parent) {
          throw new Error(`Could not find parent node for ${layer.name}`);
        }
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(node);
      } else {
        root.children!.push(node);
      }
    }
  } else {
    data = [];
  }
  return data;
}
