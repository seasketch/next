/* eslint-disable */
import { Layer } from "mapbox-gl";
import { useContext, useEffect, useState } from "react";
import { Symbol } from "arcgis-rest-api";
import {
  ArcGISRESTServiceRequestManager,
  ImageList,
  styleForFeatureLayer,
  MapServiceMetadata,
  FeatureServerMetadata,
  LayersMetadata,
} from "@seasketch/mapbox-gl-esri-sources";
import { v4 as uuid } from "uuid";
import bboxPolygon from "@turf/bbox-polygon";
import area from "@turf/area";
import bbox from "@turf/bbox";
import { FeatureCollection } from "geojson";
import {
  useCreateTableOfContentsItemMutation,
  useCreateArcGisDynamicDataSourceMutation,
  useCreateSeaSketchVectorSourceMutation,
  DataSourceImportTypes,
  useCreateDataLayerMutation,
  DraftTableOfContentsDocument,
  RenderUnderType,
  useCreateArcGisImageSourceMutation,
  useGetOrCreateSpriteMutation,
  useAddImageToSpriteMutation,
  GetOrCreateSpriteMutation,
  Exact,
  AddImageToSpriteMutation,
  DataSourceTypes,
  useUpdateInteractivitySettingsMutation,
  DataSourceDetailsFragment,
} from "../../../generated/graphql";
// import nanoid from "nanoid";
import { customAlphabet } from "nanoid";
import { default as axios } from "axios";
import { MapContext } from "../../../dataLayers/MapContextManager";
import { MutationFunctionOptions } from "@apollo/client";
// import { ArcGISVectorSourceCacheEvent } from "../../../dataLayers/ArcGISVectorSourceCache";
const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";

const nanoId = customAlphabet(alphabet, 9);

export function generateStableId() {
  return nanoId();
}

let worker: any;
if (process.env.NODE_ENV === "test") {
  worker = { gzippedSize: () => 0 };
} else {
  import("../../../workers/index").then((mod) => {
    worker = new mod.default();
  });
}

export interface NormalizedArcGISServerLocation {
  baseUrl: string;
  servicesRoot: string;
  location: string;
}

export function normalizeArcGISServerUrl(
  url: string
): NormalizedArcGISServerLocation {
  if (!/http[s]?:\/\//.test(url)) {
    url = "https://" + url;
  }
  if (/arcgis\/rest\/services/i.test(url)) {
    const parts = url.split(/\/arcgis\/rest\/services/i);
    const baseUrl = parts[0];
    const servicesRoot = baseUrl + "/arcgis/rest/services";
    const location = parts[1].replace(/\/$/, "") || "/";
    return { baseUrl, servicesRoot, location };
  } else if (/arcgis\/rest/i.test(url)) {
    const parts = url.split("/arcgis/rest");
    const baseUrl = parts[0];
    const servicesRoot = baseUrl + "/arcgis/rest/services";
    const location = "/";
    return { baseUrl, servicesRoot, location };
  } else if (/arcgis/i.test(url)) {
    const parts = url.split("/arcgis");
    const baseUrl = parts[0];
    const servicesRoot = baseUrl + "/arcgis/rest/services";
    const location = "/";
    return { baseUrl, servicesRoot, location };
  } else if (/arcgis/i.test(url)) {
    return {
      baseUrl: "",
      servicesRoot: "",
      location: "",
    };
  } else if (/rest\/services/i.test(url)) {
    const parts = url.split(/\/rest\/services/i);
    const baseUrl = parts[0];
    const servicesRoot = baseUrl + "/rest/services";
    const location = parts[1].replace(/\/$/, "") || "/";
    return { baseUrl, servicesRoot, location };
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
  documentInfo?: {
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
  tileInfo?: {
    rows: number;
    dpi: number;
    cols: number;
    format: string;
    lods: {
      level: number;
      resolution: number;
      scale: number;
    }[];
  };
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
  description?: string;
  copyrightText?: string;
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
  fields: {
    name: string;
    type:
      | "esriFieldTypeOID"
      | "esriFieldTypeDouble"
      | "esriFieldTypeSmallInteger"
      | "esriFieldTypeString"
      | "esriFieldTypeDate"
      | "esriFieldTypeGeometry"
      | "esriFieldTypeInteger";
    alias: string;
  }[];
}

export const esriFieldTypesToTileJSONTypes = {
  esriFieldTypeOID: "Number",
  esriFieldTypeDouble: "Number",
  esriFieldTypeSmallInteger: "Number",
  esriFieldTypeString: "String",
  esriFieldTypeDate: "String",
  esriFieldTypeGeometry: "String",
  esriFieldTypeInteger: "Number",
};

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
              const layerInfo: LayerInfo[] = await Promise.all(
                layerData.layers.map(async (lyr: LayerInfo) => {
                  const generatedId = uuid();
                  if (lyr.type === "Feature Layer" && lyr.drawingInfo) {
                    let { layers, imageList } = await styleForFeatureLayer(
                      location,
                      lyr.id,
                      generatedId,
                      lyr
                    );
                    imageList = await imageList;
                    return {
                      ...lyr,
                      generatedId,
                      mapboxLayers: layers,
                      imageList,
                      url: `${location}/${lyr.id}`,
                    };
                  } else {
                    return {
                      ...lyr,
                      generatedId,
                      url: `${location}/${lyr.id}`,
                    };
                  }
                })
              );
              const d = {
                mapServerInfo: mapServerData,
                layerInfo,
              };
              // if (
              //   mapServerData.type === "FeatureServer" ||
              //   mapServerData.type === "MapServer"
              // ) {
              //   for (const info of d.layerInfo) {
              //     if (info.type === "Feature Layer") {
              //       // add style information
              //       info.mapboxGlStyleLayers = await styleForFeatureLayer();
              //     }
              //   }
              // }
              setData(d);
              setLoading(false);
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

export interface MapServerCatalogItemDetails {
  type: "MapServer";
  tiled: boolean;
  metadata: MapServiceMetadata;
  layers: LayersMetadata;
}

export interface FeatureServerCatalogItemDetails {
  type: "FeatureServer";
  metadata: FeatureServerMetadata;
}

export function useCatalogItemDetails(
  requestManager: ArcGISRESTServiceRequestManager,
  url?: string
) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [data, setData] = useState<
    MapServerCatalogItemDetails | FeatureServerCatalogItemDetails | null
  >();

  useEffect(() => {
    setLoading(true);
    setError(undefined);
    setData(null);
    const AC = new AbortController();
    if (url && /MapServer/.test(url)) {
      requestManager
        .getMapServiceMetadata(url, { signal: AC.signal })
        .then((data) => {
          if (!AC.signal.aborted) {
            setError(undefined);
            setLoading(false);
            setData({
              type: "MapServer",
              tiled: !!data.serviceMetadata.singleFusedMapCache,
              metadata: data.serviceMetadata,
              layers: data.layers,
            });
          }
        })
        .catch((e) => {
          if (e.cancelled) {
            // do nothing
          } else {
            setError(e.message);
          }
        });
      return () => AC.abort();
    } else if (url && /FeatureServer/.test(url)) {
      requestManager
        .getFeatureServerMetadata(url, { signal: AC.signal })
        .then((data) => {
          if (!AC.signal.aborted) {
            setError(undefined);
            setLoading(false);
            setData({
              type: "FeatureServer",
              metadata: data.serviceMetadata,
            });
          }
        })
        .catch((e) => {
          if (e.cancelled) {
            // do nothing
          } else {
            setError(e.message);
          }
        });
      return () => AC.abort();
    }
  }, [url]);

  return { data, loading, error };
}

export function metersToDegrees(x: number, y: number): [number, number] {
  var lon = (x * 180) / 20037508.34;
  var lat =
    (Math.atan(Math.exp((y * Math.PI) / 20037508.34)) * 360) / Math.PI - 90;
  return [lon, lat];
}

export function extentToLatLngBounds(
  extent: Extent
): [[number, number], [number, number]] | void {
  if (extent) {
    const wkid = normalizeSpatialReference(extent.spatialReference);
    if (wkid === 4326) {
      return [
        [extent.xmin, extent.ymin],
        [extent.xmax, extent.ymax],
      ];
    } else if (wkid === 3857 || wkid === 102100) {
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

export function useCatalogItems(
  location: string,
  requestManager: ArcGISRESTServiceRequestManager
) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [catalogInfo, setCatalogInfo] = useState<CatalogItem[]>();

  useEffect(() => {
    setCatalogInfo([]);
    setLoading(true);
    setError(undefined);
    if (!location) {
      return;
    }
    let abortController = new AbortController();
    requestManager
      .getCatalogItems(location, { signal: abortController.signal })
      .then((data) => {
        if (!abortController.signal.aborted) {
          setError(undefined);
          setLoading(false);
        }
        const info = [
          ...(data.folders || []).map((name: string) => ({
            name,
            type: "Folder",
          })),
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
            name = item.name.split("/").slice(-1)[0];
          }
          return {
            name,
            url,
            type: item.type as
              | "Folder"
              | "GPServer"
              | "MapServer"
              | "FeatureServer"
              | "GeometryServer"
              | "GeocodeServer",
          };
        });
        setCatalogInfo(info);
      })
      .catch((e) => {
        if ("cancelled" in e) {
          // do nothing
        } else {
          setError(e.message);
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

export interface ArcGISServiceSettings {
  sourceType: "arcgis-dynamic-mapservice" | "arcgis-vector-source";
  enableHighDpi: boolean;
  imageFormat: MapServerImageFormat;
  renderUnder: RenderUnderType;
  excludedSublayers: string[];
  vectorSublayerSettings: VectorSublayerSettings[];
  // preferInstantLayers: boolean;
}

export type VectorImportType = "geojson" | "dynamic";

export interface VectorSublayerSettings {
  sublayer: number;
  renderUnder: RenderUnderType;
  outFields: string;
  importType: VectorImportType;
  geometryPrecision: 4 | 5 | 6;
  ignoreByteLimit: boolean;
  mapboxLayers?: any[];
  uploadedGeoJSON?: FeatureCollection;
  // tileSource: string;
  // tileJobId: string;
}

const defaultServiceSettings: ArcGISServiceSettings = {
  sourceType: "arcgis-dynamic-mapservice",
  enableHighDpi: true,
  imageFormat: "PNG",
  renderUnder: RenderUnderType.Labels,
  excludedSublayers: [],
  vectorSublayerSettings: [],
  // preferInstantLayers: true,
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
    let s: ArcGISServiceSettings | undefined;
    if (location) {
      s = settingsCache[location] || defaultServiceSettings;
    } else {
      s = undefined;
    }
    if (s && location && /FeatureServer/.test(location)) {
      s.sourceType = "arcgis-vector-source";
    }
    setSettings(s);
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

const featureLayerSizeDataCache: {
  [key: string]: FeatureLayerSizeInfo;
} = {};

const makeFeatureLayerSizeDataCacheKey = (
  url: string,
  settings?: VectorSublayerSettings
) =>
  url +
  "-" +
  (settings?.geometryPrecision || 6) +
  "-" +
  (settings?.outFields || "*");

interface FeatureLayerSizeInfo {
  geoJsonBytes: number;
  gzipBytes: number;
  areaKm: number;
  objects: number;
  attributes: number;
  warnings: VectorImportWarning[];
}

function syncLayerData(
  featureCollection: any,
  layerSettings?: VectorSublayerSettings
) {
  const str = JSON.stringify(featureCollection);
  const geoJsonBytes = byteLength(str);
  const box = bboxPolygon(bbox(featureCollection));
  const sqMeters = area(box);
  const areaKm = sqMeters / 1000000;

  const warnings = calculateWarnings(
    featureCollection.features.length,
    geoJsonBytes,
    layerSettings
  );

  return {
    geoJsonBytes,
    areaKm,
    objects: featureCollection.features.length,
    attributes: Object.keys(
      (featureCollection.features[0] || { properties: {} }).properties
    ).length,
    warnings,
  };
}

function calculateWarnings(
  numFeatures: number,
  geoJsonBytes: number,
  layerSettings?: VectorSublayerSettings
) {
  const warnings: VectorImportWarning[] = [];
  const numRequests = Math.ceil(numFeatures / 1000);
  if (numRequests > 1) {
    warnings.push({
      type: "arcgis",
      level: "warning",
      /* eslint-disable-next-line */
      message: `This dataset will require ${numRequests} requests to load due to the number of features.`,
    });
  }
  if (geoJsonBytes > 5_000_000) {
    warnings.push({
      type: "arcgis",
      level: "warning",
      /* eslint-disable-next-line */
      message: `Dynamic vector sources are not recommended for large layers. Consider importing a copy into SeaSketch or using an Image Source.`,
    });
  }
  if (geoJsonBytes > 30_000_000) {
    warnings.push({
      type: "geojson",
      level: "warning",
      /* eslint-disable-next-line */
      message:
        "Consider importing very large datasets individually to avoid a long import process.",
    });
  } else if (geoJsonBytes > 5_000_000) {
    warnings.push({
      type: "geojson",
      level: geoJsonBytes > 10_000_000 ? "warning" : "info",
      /* eslint-disable-next-line */
      message:
        "This dataset could take a long time to download depending on connection speed. You should consider adding it to a tileset after import.",
    });
  }
  return warnings;
}

interface VectorImportWarning {
  type: "arcgis" | "geojson";
  message: string;
  level: "error" | "warning" | "info";
}

// https://stackoverflow.com/a/23329386/299467
export function byteLength(str: string) {
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

// export function treeDataFromLayerList(layers: LayerInfo[]) {
//   let data: OverlayFragment[] = [];
//   let nodesBySublayer: { [id: string]: OverlayFragment } = {
//     root: {
//       id: 0,
//       title: "Layers",
//       isFolder: true,
//       children: [],
//       isClickOffOnly: false,
//       showRadioChildren: false,
//       stableId: "root",
//       sortIndex: 0,
//       hideChildren: false,
//     },
//   };
//   const root = nodesBySublayer["root"];
//   data.push(root);
//   if (layers.length) {
//     for (const layer of layers) {
//       const node: ClientTableOfContentsItem = {
//         id: layer.generatedId,
//         title: layer.name,
//         expanded: false,
//         isFolder: layer.type === "Group Layer",
//         isClickOffOnly: false,
//         showRadioChildren: false,
//         stableId: layer.generatedId,
//         dataLayerId:
//           layer.type !== "Group Layer" ? layer.generatedId : undefined,
//         sortIndex: layer.id,
//         hideChildren: false,
//       };
//       nodesBySublayer[layer.id.toString()] = node;
//       if (layer.parentLayer && layer.parentLayer.id !== -1) {
//         const parent = nodesBySublayer[layer.parentLayer.id];
//         if (!parent) {
//           throw new Error(`Could not find parent node for ${layer.name}`);
//         }
//         if (!parent.children) {
//           parent.children = [];
//         }
//         parent.children.push(node);
//       } else {
//         root.children!.push(node);
//       }
//     }
//   } else {
//     data = [];
//   }
//   return data;
// }

interface ImportArcGISServiceState {
  inProgress: boolean;
  statusMessage?: string;
  error?: Error;
  abortController?: AbortController;
  parentStableIds?: { [sublayer: number]: string };
  /* 0.0 - 1.0. Used to render a progress bar */
  progress?: number;
}

export function useImportArcGISService(
  serviceRoot?: string
): [
  (
    layerInfo: LayerInfo[],
    mapServerInfo: MapServerCatalogInfo,
    projectId: number,
    settings: ArcGISServiceSettings,
    importType: "vector" | "image",
    totalBytesForUpload?: number
  ) => Promise<ImportArcGISServiceState | undefined>,
  ImportArcGISServiceState
] {
  // const [mutate, mutationState] = useCreateFolderMutation();
  const [createTableOfContentsItem, createTableOfContentsItemState] =
    useCreateTableOfContentsItemMutation({
      refetchQueries: [DraftTableOfContentsDocument.loc!.source.body],
    });
  const [createDynamicSource, dynamicSourceState] =
    useCreateArcGisDynamicDataSourceMutation();
  const [createSeaSketchVectorSource, seasketchVectorSourceState] =
    useCreateSeaSketchVectorSourceMutation();
  const [createDataLayer, createDataLayerState] = useCreateDataLayerMutation();
  const [createArcGISImageSource, createArcGISImageSourceState] =
    useCreateArcGisImageSourceMutation();
  const [updateInteractivitySettings, updateInteractivitySettingsState] =
    useUpdateInteractivitySettingsMutation();
  const [createSprite, createSpriteState] = useGetOrCreateSpriteMutation();
  const [addImageToSprite] = useAddImageToSpriteMutation();
  const mapContext = useContext(MapContext);
  // importService: (
  //   layerInfo: LayerInfo[],
  //   mapServerInfo: MapServerCatalogInfo,
  //   projectId: number,
  //   settings: ArcGISServiceSettings,
  //   importType: "vector" | "image",
  //   totalBytesForUpload?: number
  // ) => Promise<void>;
  const [state, setState] = useState<ImportArcGISServiceState>({
    inProgress: false,
  });
  useEffect(() => {
    setState((prev) => {
      return {
        ...prev,
        inProgress: false,
        error: undefined,
        parentStableIds: undefined,
      };
    });
  }, [serviceRoot]);
  const importService = async (
    layerInfo: LayerInfo[],
    mapServerInfo: MapServerCatalogInfo,
    projectId: number,
    settings: ArcGISServiceSettings,
    importType: "vector" | "image",
    totalBytesForUpload?: number
  ) => {
    try {
      let totalBytesUploaded = 0;
      let imageSourceId: number | undefined;
      let progress = 0.0;
      let totalProgressCredits =
        (totalBytesForUpload || 0) +
        layerInfo.filter((l) => {
          return (
            l.type != "Group Layer" &&
            !!settings.vectorSublayerSettings.find(
              (s) => s.sublayer === l.id
            ) &&
            settings.excludedSublayers.indexOf(l.generatedId) === -1
          );
        }).length *
          1000;
      if (importType === "image") {
        totalProgressCredits =
          layerInfo.filter((l) => {
            return (
              l.type != "Group Layer" &&
              settings.excludedSublayers.indexOf(l.generatedId) === -1
            );
          }).length * 1000;
      }

      const stableIds: { [sublayer: number]: string } = {};
      const saved: { [sublayer: number]: boolean } = {};
      const saveItem = async (
        layer: LayerInfo,
        mapServerInfo: MapServerCatalogInfo,
        containerFolderId?: string
      ) => {
        try {
          if (state.abortController && state.abortController.signal.aborted) {
            return;
          }
          if (saved[layer.id]) {
            return stableIds[layer.id];
          } else {
            let parentStableId: string | undefined = undefined;
            if (layer.parentLayer && layer.parentLayer.id !== -1) {
              parentStableId = await saveItem(
                layerInfo.find((l) => l.id === layer.parentLayer!.id)!,
                mapServerInfo
              );
            } else {
              parentStableId = containerFolderId;
            }
            const id = nanoId();
            let bounds: number[] | undefined;
            if (layer.type === "Group Layer") {
              setState((prev) => {
                return {
                  ...prev,
                  statusMessage: `Saving folder "${layer.name}"`,
                };
              });
              await createTableOfContentsItem({
                variables: {
                  projectId,
                  title: layer.name,
                  stableId: id,
                  parentStableId: parentStableId || undefined,
                  isFolder: true,
                },
              });
            } else {
              const layerSettings = settings.vectorSublayerSettings.find(
                (s) => s.sublayer === layer.id
              );
              let sourceId: number;
              let dataLayerId: number;
              if (importType === "vector") {
                const isDynamic =
                  layerSettings && layerSettings.importType == "dynamic";
                if (!isDynamic) {
                  throw new Error("Only dynamic layers are supported");
                } else {
                  // source is simpler. just provide options
                  setState((prev) => {
                    return {
                      ...prev,
                      statusMessage: `Creating source for "${layer.name}"`,
                    };
                  });
                  let queryParameters = {
                    geometryPrecision: layerSettings?.geometryPrecision || 6,
                    outFields: layerSettings?.outFields || "*",
                  };
                  const latLngBounds = extentToLatLngBounds(layer.extent);
                  bounds = latLngBounds
                    ? [
                        latLngBounds[0][0],
                        latLngBounds[0][1],
                        latLngBounds[1][0],
                        latLngBounds[1][1],
                      ]
                    : undefined;

                  const sourceResponse = await createDynamicSource({
                    variables: {
                      projectId,
                      url: layer.url,
                      attribution:
                        contentOrFalse(layer.copyrightText) ||
                        contentOrFalse(mapServerInfo.copyrightText) ||
                        contentOrFalse(mapServerInfo.documentInfo?.Author) ||
                        null,
                      bounds: bounds,
                      queryParameters: queryParameters,
                    },
                  });

                  sourceId =
                    sourceResponse.data!.createDataSource!.dataSource!.id;
                  progress += 1000;
                }

                // remove source and id from gl-style layers (generated at runtime)
                let glStyles =
                  layerSettings?.mapboxLayers || layer.mapboxLayers || [];
                for (const style of glStyles) {
                  delete style.id;
                  delete style.source;
                }

                let idReplacements: { [oldId: string]: string } = {};
                if (
                  !isDynamic &&
                  layer.imageList &&
                  (await layer.imageList.toJSON()).length > 0
                ) {
                  // upload any sprites if needed
                  setState((prev) => {
                    return {
                      ...prev,
                      statusMessage: `Creating sprites for "${layer.name}".`,
                    };
                  });
                  idReplacements = await getOrCreateSpritesFromImageSet(
                    layer.imageList,
                    projectId,
                    createSprite,
                    addImageToSprite
                  );
                }

                glStyles = replaceSpriteIds(glStyles, idReplacements);
                // Create the layer
                const dataLayerData = await createDataLayer({
                  variables: {
                    projectId,
                    dataSourceId: sourceId!,
                    mapboxGlStyles: !isDynamic ? glStyles : null,
                    // @ts-ignore
                    renderUnder: layerSettings?.renderUnder?.toUpperCase(),
                    // sublayer: isDynamic ? layer.id.toString() : undefined,
                  },
                });
                dataLayerId =
                  dataLayerData.data!.createDataLayer!.dataLayer!.id;
                const interactivitySettingsId =
                  dataLayerData.data?.createDataLayer?.dataLayer
                    ?.interactivitySettings?.id;
                if (interactivitySettingsId) {
                  await updateInteractivitySettings({
                    variables: {
                      id: interactivitySettingsId,
                      shortTemplate: `${layer.name}`,
                      longTemplate: `
<b>${layer.name}</b>
<table>
${layer.fields
  .map(
    (field) => `<tr>
  <td>${field.name}</td>
  <td>{{${field.name}}}</td>
</tr>`
  )
  .join("\n")}
</table>
                    `,
                    },
                  });
                }
              } else {
                // create dataLayers for the current sublayer
                const dataLayerData = await createDataLayer({
                  variables: {
                    projectId,
                    dataSourceId: imageSourceId!,
                    sublayer: layer.id.toString(),
                    // @ts-ignore
                    renderUnder: layerSettings?.renderUnder?.toUpperCase(),
                    // sublayer: isDynamic ? layer.id.toString() : undefined,
                  },
                });
                dataLayerId =
                  dataLayerData.data!.createDataLayer!.dataLayer!.id;
                const interactivitySettingsId =
                  dataLayerData.data?.createDataLayer?.dataLayer
                    ?.interactivitySettings?.id;
                if (interactivitySettingsId) {
                  await updateInteractivitySettings({
                    variables: {
                      id: interactivitySettingsId,
                      shortTemplate: `${layer.name}`,
                      longTemplate: `
<b>${layer.name}</b>
<table>
${layer.fields
  .map(
    (field) => `<tr>
  <td>${field.name}</td>
  <td>{{${field.name}}}</td>
</tr>`
  )
  .join("\n")}
</table>
                      `,
                    },
                  });
                }
              }

              // Create the table of contents item
              await createTableOfContentsItem({
                variables: {
                  title: layer.name,
                  stableId: id,
                  projectId,
                  parentStableId:
                    layer.parentLayer && layer.parentLayer.id !== -1
                      ? stableIds[layer.parentLayer.id]
                      : parentStableId,
                  isFolder: false,
                  dataLayerId: dataLayerId,
                  bounds,
                  metadata: generateMetadataForLayer(
                    mapServerInfo,
                    layer,
                    !layerSettings || layerSettings.importType === "geojson"
                  ),
                },
              });
            }
            stableIds[layer.id] = id;
            saved[layer.id] = true;
            return id;
          }
        } catch (e) {
          console.error(e);
          throw e;
        }
      };

      setState((prev) => {
        return {
          ...prev,
          inProgress: true,
          abortController: new AbortController(),
          progress: progress / totalProgressCredits,
        };
      });

      // Loop through each layer, adding each and any parent folders

      const dataLayers = layerInfo.filter((l) => l.type !== "Group Layer");
      let error: Error;

      if (importType === "image") {
        setState((prev) => {
          return {
            ...prev,
            statusMessage: `Creating source record ${
              mapServerInfo.mapName ? `"${mapServerInfo.mapName}"` : ""
            }`,
          };
        });
        const latLngBounds = extentToLatLngBounds(mapServerInfo.fullExtent);
        try {
          const sourceResponse = await createArcGISImageSource({
            variables: {
              projectId,
              url: mapServerInfo.url,
              attribution:
                contentOrFalse(mapServerInfo.copyrightText) ||
                contentOrFalse(mapServerInfo.documentInfo?.Author) ||
                null,
              bounds: latLngBounds
                ? [
                    latLngBounds[0][0],
                    latLngBounds[0][1],
                    latLngBounds[1][0],
                    latLngBounds[1][1],
                  ]
                : null,
              enableHighDPI: settings.enableHighDpi,
              supportsDynamicLayers: mapServerInfo.supportsDynamicLayers,
            },
          });
          imageSourceId = sourceResponse.data!.createDataSource!.dataSource!.id;
        } catch (e) {
          throw new Error(`Problem saving source. ${e.message}`);
        }
      }

      const layers = dataLayers.filter(
        (l) => settings.excludedSublayers.indexOf(l.generatedId) === -1
      );
      let folderStableId: string | undefined;
      // If vector import, create containing folder first
      if (layers.length > 1) {
        const folderName =
          mapServerInfo.documentInfo?.Title ||
          mapServerInfo.documentInfo?.Subject ||
          mapServerInfo.serviceDescription ||
          "New Import";
        setState((prev) => {
          return {
            ...prev,
            progress: 0,
            statusMessage: `Creating folder "${folderName}"`,
          };
        });
        folderStableId = nanoId();
        await createTableOfContentsItem({
          variables: {
            title: folderName,
            stableId: folderStableId,
            projectId,
            isFolder: true,
          },
        });
      }

      for (const layer of layers) {
        // check first if item has any children
        if (state.abortController && state.abortController.signal.aborted) {
          return;
        }
        progress += 1000;
        setState((prev) => {
          return {
            ...prev,
            progress: progress / totalProgressCredits,
            statusMessage: `Saving layer ${layer.name}`,
          };
        });
        try {
          await saveItem(layer, mapServerInfo, folderStableId);
        } catch (e) {
          error = e;
          break;
        }
      }
      if (error!) {
        setState((prev) => {
          return {
            ...prev,
            error,
            inProgress: false,
            // parentStableIds: stableIds,
          };
        });
        throw error;
      } else {
        setState((prev) => {
          return {
            ...prev,
            inProgress: false,
            parentStableIds: stableIds,
          };
        });
        return state;
      }
    } catch (e) {
      setState((prev) => {
        return {
          ...prev,
          error: e,
          inProgress: false,
          parentStableIds: undefined,
        };
      });
      throw e;
    }
  };
  return [importService, state];
}

export async function createImageBlobFromDataURI(
  width: number,
  height: number,
  dataURI: string
): Promise<Blob> {
  return new Promise((resolve) => {
    fetch(dataURI)
      .then((res) => res.blob())
      .then((blob) => resolve(blob));
  });
}

export function replaceSpriteIds(
  glStyles: any[],
  idReplacements: { [oldId: string]: string }
) {
  let stringified = JSON.stringify(glStyles);
  for (const oldId in idReplacements) {
    stringified = stringified.replaceAll(
      oldId,
      `seasketch://sprites/${idReplacements[oldId]}`
    );
  }
  return JSON.parse(stringified);
}

export async function getOrCreateSpritesFromImageSet(
  imageList: ImageList,
  projectId: number,
  createSprite: (
    options?:
      | MutationFunctionOptions<
          GetOrCreateSpriteMutation,
          Exact<{
            height: number;
            width: number;
            pixelRatio: number;
            projectId: number;
            smallestImage: any;
          }>
        >
      | undefined
  ) => Promise<any>,
  addImageToSprite: (
    options?:
      | MutationFunctionOptions<
          AddImageToSpriteMutation,
          Exact<{
            spriteId: number;
            width: number;
            height: number;
            pixelRatio: number;
            image: any;
          }>
        >
      | undefined
  ) => Promise<any>
): Promise<{ [oldId: string]: string }> {
  const replacementIds: { [oldId: string]: string } = {};
  const imageSetJSON = await imageList.toJSON();
  if (imageSetJSON.length) {
    for (const imageSet of imageSetJSON) {
      const dpi1Image = imageSet.images.find((i) => i.pixelRatio === 1);
      if (!dpi1Image) {
        throw new Error("Sprite does not contain any images with dpi=1");
      }
      const blob = await createImageBlobFromDataURI(
        dpi1Image.width,
        dpi1Image.height,
        dpi1Image.dataURI
      );
      const result = await createSprite({
        variables: {
          height: dpi1Image.height,
          width: dpi1Image.width,
          pixelRatio: dpi1Image.pixelRatio,
          projectId: projectId,
          smallestImage: blob,
        },
      });
      if (!result.data?.getOrCreateSprite) {
        throw new Error("Failed to create initial sprite");
      }
      replacementIds[imageSet.id.toString()] =
        result.data.getOrCreateSprite.id.toString();
      let sprite = result.data.getOrCreateSprite;
      await Promise.all(
        imageSet.images
          .filter((i) => i.pixelRatio !== 1)
          .map(async (image) => {
            if (
              !sprite.spriteImages.find(
                (i: { pixelRatio: number }) => i.pixelRatio === image.pixelRatio
              )
            ) {
              const blob = await createImageBlobFromDataURI(
                image.width,
                image.height,
                image.dataURI
              );
              try {
                let r = await addImageToSprite({
                  variables: {
                    spriteId: sprite.id,
                    width: image.width,
                    height: image.height,
                    pixelRatio: image.pixelRatio,
                    image: blob,
                  },
                });
                if (!r.data?.addImageToSprite) {
                  throw new Error("Failed to add image to sprite");
                }
                sprite = r.data.addImageToSprite;
              } catch (e) {
                throw new Error("Problem creating sprite. " + e.message);
              }
            }
          })
      );
    }
  }
  return replacementIds;
}

export async function identifyLayers(
  position: [number, number],
  source: DataSourceDetailsFragment,
  sublayers: string[],
  mapBounds: [number, number, number, number],
  width: number,
  height: number,
  dpi: number,
  abortController?: AbortController
): Promise<
  { sourceId: number; sublayer: string; attributes: { [key: string]: any } }[]
> {
  if (source.type === DataSourceTypes.ArcgisDynamicMapserver) {
    const response = await fetch(
      `${source.url}/identify?f=json&tolerance=${4}&mapExtent=${mapBounds.join(
        ","
      )}&imageDisplay=${width},${height},${dpi}&geometryType=esriGeometryPoint&geometry={x:${
        position[0]
      }, y: ${
        position[1]
      }}&sr=4326&returnGeometry=false&layers=all:${sublayers.join(",")}`,
      {
        signal: abortController?.signal,
      }
    );
    const data: any = await response.json();
    if (data.results) {
      return data.results.map((record: any) => {
        return {
          sourceId: source.id,
          sublayer: record.layerId,
          attributes: record.attributes,
        };
      });
    } else {
      console.warn("Unrecognized response from identify");
      return [];
    }
  } else {
    throw new Error("Not supported");
  }
}

export function generateMetadataForLayer(
  mapServerInfo: MapServerCatalogInfo,
  layer: LayerInfo,
  hostedOnSeaSketch: boolean
) {
  const attribution =
    contentOrFalse(layer.copyrightText) ||
    contentOrFalse(mapServerInfo.copyrightText) ||
    contentOrFalse(mapServerInfo.documentInfo?.Author);
  const description = pickDescription(mapServerInfo, layer);
  let keywords =
    mapServerInfo.documentInfo?.Keywords &&
    mapServerInfo.documentInfo?.Keywords.length
      ? mapServerInfo.documentInfo?.Keywords.split(",")
      : [];
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: layer.name }],
      },
      ...(description
        ? [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: description,
                },
              ],
            },
          ]
        : []),
      ...(attribution
        ? [
            { type: "paragraph" },
            {
              type: "heading",
              attrs: { level: 3 },
              content: [{ type: "text", text: "Attribution" }],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: attribution,
                },
              ],
            },
          ]
        : []),
      ...(keywords && keywords.length
        ? [
            { type: "paragraph" },
            {
              type: "heading",
              attrs: { level: 3 },
              content: [
                {
                  type: "text",
                  text: "Keywords",
                },
              ],
            },
            {
              type: "bullet_list",
              marks: [],
              attrs: {},
              content: keywords.map((word) => ({
                type: "list_item",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: word }],
                  },
                ],
              })),
            },
          ]
        : []),
      { type: "paragraph" },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [
          {
            type: "text",
            text: hostedOnSeaSketch ? "Original Source" : "Source Server",
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            marks: [
              {
                type: "link",
                attrs: {
                  href: layer.url,
                  title: "ArcGIS Server",
                },
              },
            ],
            text: layer.url,
          },
        ],
      },
    ],
  };
}

function pickDescription(info: MapServerCatalogInfo, layer?: LayerInfo) {
  return (
    contentOrFalse(layer?.description) ||
    contentOrFalse(info.description) ||
    contentOrFalse(info.documentInfo?.Subject) ||
    contentOrFalse(info.documentInfo?.Comments)
  );
}

function contentOrFalse(str?: string) {
  if (str && str.length > 0) {
    return str;
  } else {
    return false;
  }
}

const dynamicArcGISStyles: {
  [sourceId: string]: Promise<{
    imageList: ImageList;
    layers: mapboxgl.Layer[];
  }>;
} = {};
/**
 * Returns a promise that resolves to gl style information from mapbox-gl-esri-sources.
 * Will first reference an internal cache unless skipCache is true.
 * @param url URL to a feature layer. Should end in MapServer/\d+
 * @param sourceId Valid gl styles must reference a data source. Provide the ID of the geojson source that will be used
 */
export async function getDynamicArcGISStyle(
  url: string,
  sourceId: string,
  skipCache = false
) {
  const layers: Layer[] = [];
  // @ts-ignore
  if (dynamicArcGISStyles[sourceId] && !skipCache) {
    // already working
    return dynamicArcGISStyles[sourceId];
  } else {
    dynamicArcGISStyles[sourceId] = styleForFeatureLayer(
      url.split(/\/\d+$/)[0],
      parseInt(url.split(/\/\d+$/)[1]),
      sourceId
    );
  }
  return dynamicArcGISStyles[sourceId];
}
