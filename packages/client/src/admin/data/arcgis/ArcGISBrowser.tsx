import React, { useEffect, useRef, useState } from "react";
import {
  CatalogItem,
  extentToLatLngBounds,
  NormalizedArcGISServerLocation,
  useArcGISServiceSettings,
  useMapServerInfo,
  LayerInfo,
  treeDataFromLayerList,
  MapServerCatalogInfo,
  ArcGISServiceSettings,
  VectorSublayerSettings,
} from "./arcgis";
import { Map } from "mapbox-gl";
import ArcGISSearchPage from "./ArcGISSearchPage";
import {
  ArcGISBrowserColumn,
  ArcGISBrowserColumnProps,
} from "./ArcGISBrowserColumn";
import Spinner from "../../../components/Spinner";
import OverlayMap from "./OverlayMap";
import OutgoingLinkIcon from "../../../components/OutgoingLinkIcon";
import ArcGISServiceMetadata from "./ArcGISServiceMetadata";
import SegmentControl from "../../../components/SegmentControl";
import SettingsIcon from "../../../components/SettingsIcon";
import DynamicMapServerSettingsForm from "./DynamicMapServerSettingsForm";
import VectorFeatureLayerSettingsForm from "./VectorFeatureLayerSettingsForm";
import { FeatureLayerSettings } from "./FeatureLayerSettings";
import {
  LayerManagerContext,
  useLayerManager,
  SeaSketchSource,
  SeaSketchLayer,
} from "../../../dataLayers/LayerManager";
import TableOfContents, {
  TableOfContentsNode,
} from "../../../dataLayers/tableOfContents/TableOfContents";

export default function ArcGISBrowser() {
  const [server, setServer] = useState<{
    location: NormalizedArcGISServerLocation;
    version: string;
  }>();
  const [columns, setColumns] = useState<ArcGISBrowserColumnProps[]>([]);
  const [map, setMap] = useState<Map | null>(null);
  const [selectedMapServer, setSelectedMapServer] = useState<string>();
  const mapServerInfo = useMapServerInfo(selectedMapServer);
  const [selectedFeatureLayer, setSelectedFeatureLayer] = useState<LayerInfo>();
  const serviceColumnRef = useRef<HTMLDivElement>(null);
  const layerManager = useLayerManager();
  const [treeData, setTreeData] = useState<TableOfContentsNode[]>([]);
  const [serviceSettings, setServiceSettings] = useArcGISServiceSettings(
    selectedMapServer
  );
  const serviceData = mapServerInfo.data;

  // Update map extent when showing new services
  useEffect(() => {
    if (serviceData && map) {
      const extent =
        serviceData.mapServerInfo.fullExtent ||
        serviceData.mapServerInfo.initialExtent;
      if (extent) {
        const bounds = extentToLatLngBounds(extent);
        if (bounds) {
          map.fitBounds(bounds, { duration: 0, padding: 40 });
        }
      }
    }
  }, [serviceData, map]);

  // Update sources and layers whenever settings change
  useEffect(() => {
    if (serviceSettings && serviceData && layerManager.manager) {
      const sources: SeaSketchSource[] = [];
      const layers: SeaSketchLayer[] = [];
      if (serviceSettings.sourceType === "arcgis-dynamic-mapservice") {
        sources.push(
          dynamicServiceSourceFromSettings(serviceData, serviceSettings)
        );
      } else if (serviceSettings.sourceType === "arcgis-vector-source") {
        for (const layer of serviceData.layerInfo) {
          const settings = serviceSettings.vectorSublayerSettings.find(
            (s) => s.sublayer === layer.id
          );
          sources.push(vectorSourceFromSettings(layer, settings!));
        }
      }

      for (const layer of serviceData.layerInfo) {
        if (serviceSettings.sourceType === "arcgis-dynamic-mapservice") {
          layers.push({
            id: layer.generatedId,
            sublayerId: layer.id.toString(),
            sourceId: serviceData.mapServerInfo.generatedId,
            renderUnder: serviceSettings.renderUnder || "labels",
          });
        } else {
          const vectorSettings = serviceSettings.vectorSublayerSettings.find(
            (v) => v.sublayer === layer.id
          );
          layers.push(vectorLayerFromSettings(layer, vectorSettings));
        }
      }
      layerManager.manager.reset(sources, layers);
    }
  }, [serviceData, serviceSettings?.sourceType]);

  useEffect(() => {
    if (
      serviceData &&
      layerManager.manager &&
      serviceSettings &&
      serviceSettings.sourceType === "arcgis-dynamic-mapservice"
    ) {
      layerManager.manager.updateSource(
        dynamicServiceSourceFromSettings(serviceData, serviceSettings)
      );
    }
  }, [
    serviceSettings?.enableHighDpi,
    serviceSettings?.imageFormat,
    serviceSettings?.renderUnder,
  ]);

  useEffect(() => {
    if (serviceData && layerManager.manager) {
      const data = treeDataFromLayerList(serviceData.layerInfo);
      setTreeData(data);
      // Collect visible layers *only* if they are under toggled groups/folders
      const collectIds = (ids: string[], node: TableOfContentsNode) => {
        const layerInfo = serviceData.layerInfo.find(
          (lyr) => lyr.generatedId === node.id
        );
        if (layerInfo?.defaultVisibility === true || node === data[0]) {
          if (node.children) {
            for (const child of node.children) {
              collectIds(ids, child);
            }
          } else {
            if (node.type === "layer") {
              if (layerInfo?.defaultVisibility === true) {
                ids.push(node.id);
              }
            }
          }
        } else {
          // Don't descend into un-toggled folders
        }
        return ids;
      };
      const collectedVisibleLayers = collectIds([], data[0]);
      layerManager.manager.setVisibleLayers(collectedVisibleLayers);
    }
  }, [serviceData, layerManager.manager]);

  // Add new catalog column or service column on selection
  const onCatalogItemSelection = (
    item: CatalogItem,
    column: ArcGISBrowserColumnProps
  ) => {
    if (item.type === "Folder") {
      const index = columns.indexOf(column);
      setColumns([...columns.slice(0, index + 1), item]);
      setSelectedMapServer(undefined);
      setSelectedFeatureLayer(undefined);
    } else if (item.type === "MapServer") {
      setSelectedMapServer(item.url);
      setSelectedFeatureLayer(undefined);
    } else {
      throw new Error("Unsupported type " + item.type);
    }
  };

  if (!server) {
    return (
      <ArcGISSearchPage
        onResult={(e) => {
          setServer(e);
          setColumns([
            {
              name: "Root",
              type: "Root",
              url: e.location.servicesRoot,
            },
          ]);
        }}
      />
    );
  } else {
    return (
      <>
        <LayerManagerContext.Provider value={layerManager}>
          <div className="flex flex-col h-full">
            <OverlayMap
              onLoad={(map) => {
                setMap(map);
                layerManager.manager!.setMap(map);
              }}
            />
            <div className="bg-white text-lg p-2 text-primary-500 border-b">
              {server.location.baseUrl}
              <span className="ml-4 italic text-gray-500">
                ArcGIS Version {server.version}
              </span>
            </div>
            <div className="flex flex-2 h-1/2 max-w-full overflow-x-scroll">
              {columns.map((props) => (
                <ArcGISBrowserColumn
                  key={props.url}
                  {...props}
                  onSelection={(item) => onCatalogItemSelection(item, props)}
                />
              ))}
              {selectedMapServer && mapServerInfo.loading && (
                <div className="flex-1 flex justify-center items-center">
                  <Spinner svgClassName="h-8 w-8" />
                </div>
              )}
              {selectedMapServer && serviceData && serviceSettings && (
                <div
                  ref={serviceColumnRef}
                  className="p-2 overflow-y-scroll bg-white max-w-2xl w-1/2 shadow"
                  style={{ minWidth: 320 }}
                >
                  <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      {serviceData.mapServerInfo.documentInfo.Title ||
                        serviceData.mapServerInfo.mapName}
                      <a target="_blank" href={serviceData.mapServerInfo.url}>
                        <OutgoingLinkIcon />
                      </a>
                    </h3>
                  </div>
                  <ArcGISServiceMetadata
                    serviceInfo={serviceData.mapServerInfo}
                  />
                  <div className="mt-10 px-6">
                    <div className="mx-auto mb-4 max-w-md">
                      <SegmentControl
                        segments={["Image Source", "Vector Sources"]}
                        value={
                          serviceSettings.sourceType ===
                          "arcgis-dynamic-mapservice"
                            ? "Image Source"
                            : "Vector Sources"
                        }
                        onClick={(segment) =>
                          setServiceSettings({
                            ...serviceSettings,
                            sourceType:
                              segment === "Image Source"
                                ? "arcgis-dynamic-mapservice"
                                : "arcgis-vector-source",
                          })
                        }
                      />
                    </div>
                    {serviceSettings.sourceType ===
                      "arcgis-dynamic-mapservice" && (
                      <p className="text-sm text-gray-600">
                        Image sources display data as full-screen images,
                        typical of how most web mapping portals work. Each time
                        the user pans or zooms the map a new image will be
                        requested and displayed with the requested layers.
                      </p>
                    )}

                    {serviceSettings.sourceType === "arcgis-vector-source" && (
                      <p className="text-sm text-gray-600">
                        When using vector sources, SeaSketch loads actual
                        geometry data and uses the user's browser to render it.
                        This can result in a much faster, sharper, and more
                        interactive map but takes a little more work to
                        configure. Each layer can be styled and configured
                        independently (click{" "}
                        <SettingsIcon className="w-4 h-4 inline-block" />
                        ).
                      </p>
                    )}
                    <TableOfContents
                      nodes={treeData}
                      onChange={(data) => setTreeData(data)}
                      extraButtons={
                        serviceSettings.sourceType === "arcgis-vector-source"
                          ? (node) =>
                              node.type === "layer"
                                ? [
                                    <button
                                      className="cursor-pointer rounded block border mr-2 focus:outline-none focus:shadow-outline-blue p-0.5"
                                      onClick={() =>
                                        setSelectedFeatureLayer(
                                          serviceData.layerInfo.find(
                                            (l) => l.generatedId === node.id
                                          )
                                        )
                                      }
                                    >
                                      <SettingsIcon className="w-4 h-4 text-primary-500 hover:text-primary-600" />
                                    </button>,
                                  ]
                                : []
                          : undefined
                      }
                    />
                    {serviceSettings.sourceType ===
                      "arcgis-dynamic-mapservice" && (
                      <DynamicMapServerSettingsForm
                        settings={serviceSettings}
                        updateSettings={setServiceSettings}
                      />
                    )}
                    {serviceSettings.sourceType === "arcgis-vector-source" && (
                      <VectorFeatureLayerSettingsForm
                        settings={serviceSettings}
                        updateSettings={setServiceSettings}
                      />
                    )}
                  </div>
                </div>
              )}
              {selectedFeatureLayer && serviceSettings && (
                <FeatureLayerSettings
                  layer={selectedFeatureLayer}
                  settings={serviceSettings}
                  updateSettings={(settings) => {
                    setServiceSettings(settings);
                    const layerSettings = settings.vectorSublayerSettings.find(
                      (s) => s.sublayer === selectedFeatureLayer.id
                    );
                    const source = vectorSourceFromSettings(
                      selectedFeatureLayer,
                      layerSettings
                    );
                    layerManager.manager!.updateSource(source);
                    layerManager.manager!.updateLayer(
                      vectorLayerFromSettings(
                        selectedFeatureLayer,
                        layerSettings
                      )
                    );
                  }}
                />
              )}
            </div>
          </div>
        </LayerManagerContext.Provider>
      </>
    );
  }
}

function dynamicServiceSourceFromSettings(
  serviceData: {
    mapServerInfo: MapServerCatalogInfo;
    layerInfo: LayerInfo[];
  },
  serviceSettings: ArcGISServiceSettings
): SeaSketchSource {
  return {
    id: serviceData.mapServerInfo.generatedId,
    type: "ArcGISDynamicMapService",
    url: serviceData.mapServerInfo.url,
    options: {
      supportsDynamicLayers: serviceData.mapServerInfo.supportsDynamicLayers,
      useDevicePixelRatio: serviceSettings.enableHighDpi,
      queryParameters: {
        format: serviceSettings.imageFormat,
        transparent: "true",
      },
    },
  };
}

function vectorSourceFromSettings(
  layer: LayerInfo,
  settings?: VectorSublayerSettings
): SeaSketchSource {
  return {
    id: layer.generatedId,
    type: "ArcGISVectorSource",
    url: layer.url,
    imageSets: layer.imageList ? layer.imageList.toJSON() : [],
    options: {
      bytesLimit: settings?.ignoreByteLimit ? undefined : 5000000,
      outFields: "*",
      geometryPrecision: settings?.geometryPrecision,
    },
  };
}

function vectorLayerFromSettings(
  layer: LayerInfo,
  settings?: VectorSublayerSettings
): SeaSketchLayer {
  return {
    id: layer.generatedId,
    sourceId: layer.generatedId,
    renderUnder: settings?.renderUnder || "labels",
    mapboxLayers: settings?.mapboxLayers || layer.mapboxLayers,
  };
}
