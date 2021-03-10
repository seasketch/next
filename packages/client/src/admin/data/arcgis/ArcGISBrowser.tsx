import React, { useCallback, useEffect, useRef, useState } from "react";
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
import MapboxMap from "../../../components/MapboxMap";
import OutgoingLinkIcon from "../../../components/OutgoingLinkIcon";
import ArcGISServiceMetadata from "./ArcGISServiceMetadata";
import SegmentControl from "../../../components/SegmentControl";
import SettingsIcon from "../../../components/SettingsIcon";
import DynamicMapServerSettingsForm from "./DynamicMapServerSettingsForm";
import { FeatureLayerSettings } from "./FeatureLayerSettings";
import {
  MapContext,
  useMapContext,
  ClientDataLayer,
  ClientDataSource,
  ClientSprite,
  ClientBasemap,
} from "../../../dataLayers/MapContextManager";
import TableOfContents, {
  ClientTableOfContentsItem,
} from "../../../dataLayers/tableOfContents/TableOfContents";
import Button from "../../../components/Button";
import ImportVectorLayersModal from "./ImportVectorLayersModal";
import ExcludeLayerToggle, {
  ExcludeAddIcon,
  ExcludeIcon,
} from "./ExcludeLayerToggle";
import {
  DataSourceTypes,
  RenderUnderType,
  useGetBasemapsQuery,
} from "../../../generated/graphql";
import bytes from "bytes";
import { useParams } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";

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
  const mapContext = useMapContext(undefined, bytes("200mb"));
  const [treeData, setTreeData] = useState<ClientTableOfContentsItem[]>([]);
  const [serviceSettings, setServiceSettings] = useArcGISServiceSettings(
    selectedMapServer
  );
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation("admin");
  const basemapsData = useGetBasemapsQuery({
    variables: {
      slug,
    },
  });
  const [modalOpen, setModalOpen] = useState(false);
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

  useEffect(() => {
    if (basemapsData.data && mapContext.manager) {
      mapContext.manager.setBasemaps(
        basemapsData.data.projectBySlug!.basemaps! as ClientBasemap[]
      );
    }
  }, [basemapsData.data, mapContext.manager]);

  // Update sources and layers whenever settings change
  useEffect(() => {
    if (serviceSettings && serviceData && mapContext.manager) {
      setTreeData(
        updateDisabledState(
          serviceSettings?.sourceType || "arcgis-dynamic-mapservice",
          treeData,
          serviceData.layerInfo
        )
      );
      const sources: ClientDataSource[] = [];
      const layers: ClientDataLayer[] = [];
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
            sublayer: layer.id.toString(),
            dataSourceId: serviceData.mapServerInfo.generatedId,
            renderUnder: serviceSettings.renderUnder || RenderUnderType.Labels,
            zIndex: layer.id,
          });
        } else if (layer.type !== "Raster Layer") {
          const vectorSettings = serviceSettings.vectorSublayerSettings.find(
            (v) => v.sublayer === layer.id
          );
          layers.push(vectorLayerFromSettings(layer, vectorSettings));
        }
      }
      mapContext.manager.reset(sources, layers);
    }
  }, [serviceData, serviceSettings, mapContext.manager]);

  // useEffect(() => {
  //   if (
  //     serviceData &&
  //     mapContext.manager &&
  //     serviceSettings &&
  //     serviceSettings.sourceType === "arcgis-dynamic-mapservice"
  //   ) {
  //     mapContext.manager.updateArcGISDynamicMapServiceSource(
  //       dynamicServiceSourceFromSettings(serviceData, serviceSettings)
  //     );
  //   }
  // }, [
  //   serviceSettings?.enableHighDpi,
  //   serviceSettings?.imageFormat,
  //   serviceSettings?.renderUnder,
  // ]);

  useEffect(() => {
    if (serviceData && mapContext.manager && map) {
      const data = treeDataFromLayerList(serviceData.layerInfo);
      setTreeData(
        updateDisabledState(
          serviceSettings?.sourceType || "arcgis-dynamic-mapservice",
          data,
          serviceData.layerInfo
        )
      );
      // Collect visible layers *only* if they are under toggled groups/folders
      const collectIds = (ids: string[], node: ClientTableOfContentsItem) => {
        const layerInfo = serviceData.layerInfo.find(
          (lyr) => lyr.generatedId === node.id
        );
        if (layerInfo?.defaultVisibility === true || node === data[0]) {
          if (node.children) {
            for (const child of node.children) {
              collectIds(ids, child);
            }
          } else {
            if (!node.isFolder) {
              if (layerInfo?.defaultVisibility === true) {
                ids.push(node.id.toString());
              }
            }
          }
        } else {
          // Don't descend into un-toggled folders
        }
        return ids;
      };
      const collectedVisibleLayers = collectIds([], data[0]);
      setTimeout(() => {
        mapContext.manager!.setVisibleLayers(collectedVisibleLayers);
      }, 50);
    }
  }, [serviceData, mapContext.manager]);

  const featureLayerSettingsRef = useRef(null);
  const allFeatureLayerIds = (mapServerInfo.data?.layerInfo || [])
    .filter((l) => l.type === "Feature Layer")
    .map((l) => l.generatedId);
  const allLayerIds = (mapServerInfo.data?.layerInfo || [])
    .filter((l) => l.type !== "Group Layer")
    .map((l) => l.generatedId);

  const settingsButton = (path: HTMLElement[]) => {
    for (const el of path.slice(0, 3)) {
      if (
        el.tagName === "BUTTON" &&
        el.getAttribute("data-type") === "settings"
      ) {
        return true;
      }
    }
    return false;
  };

  const colorPicker = (path: HTMLElement[]) => {
    for (const el of path.slice(0, 5)) {
      try {
        if (el.className.indexOf("colorpicker-body") !== -1) {
          return true;
        }
      } catch (e) {
        return false;
      }
    }
    return false;
  };

  const handleDocumentClick = useCallback(
    (e) => {
      if (
        selectedFeatureLayer &&
        e.path.indexOf(featureLayerSettingsRef.current) === -1 &&
        e.target.tagName !== "INPUT" &&
        !settingsButton(e.path) &&
        !colorPicker(e.path)
      ) {
        setSelectedFeatureLayer(undefined);
      }
    },
    [selectedFeatureLayer]
  );

  const columnContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (columnContainer.current) {
      columnContainer.current.scrollLeft = 10000;
    }
  }, [selectedFeatureLayer, selectedMapServer, columns]);

  useEffect(() => {
    if (selectedFeatureLayer) {
      document.addEventListener("click", handleDocumentClick);
    }

    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [selectedFeatureLayer]);

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
        <MapContext.Provider value={mapContext}>
          <div className="flex flex-col h-full">
            <MapboxMap
              onLoad={(map) => {
                setMap(map);
              }}
            />
            <div className="bg-white text-lg p-2 text-primary-500 border-b">
              {server.location.baseUrl}
              <span className="ml-4 italic text-gray-500">
                <Trans ns="admin">ArcGIS Version</Trans> {server.version}
              </span>
            </div>
            <div
              ref={columnContainer}
              className="flex flex-2 h-1/2 max-w-full overflow-x-scroll"
            >
              {columns.map((props, i) => (
                <ArcGISBrowserColumn
                  key={props.url}
                  leading={
                    (selectedMapServer && i === columns.length - 1) ||
                    (!selectedMapServer && i === columns.length - 2)
                  }
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
                  className="p-2 overflow-y-scroll bg-white max-w-full md:w-128 lg:w-144 flex-grow-0 flex-shrink-0"
                >
                  <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      {serviceData.mapServerInfo.documentInfo.Title ||
                        serviceData.mapServerInfo.mapName}
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={serviceData.mapServerInfo.url}
                      >
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
                        <Trans ns="admin">
                          Image sources display data as full-screen images,
                          typical of how most web mapping portals work. Each
                          time the user pans or zooms the map a new image will
                          be requested and displayed with the requested layers.
                        </Trans>
                      </p>
                    )}

                    {serviceSettings.sourceType === "arcgis-vector-source" && (
                      <p className="text-sm text-gray-600">
                        <Trans ns="admin">
                          When using vector sources, SeaSketch loads actual
                          geometry data and uses the user's browser to render
                          it. This can result in a much faster, sharper, and
                          more interactive map but takes a little more work to
                          configure. Each layer can be styled and configured
                          independently
                        </Trans>
                        {
                          // eslint-disable-next-line
                          `(click `
                        }
                        <SettingsIcon className="w-4 h-4 inline-block" />
                        ).
                      </p>
                    )}
                    <div className="mt-4 mb-4 relative">
                      <Button
                        className="absolute right-0 z-10"
                        label={
                          serviceSettings.excludedSublayers.length ===
                          serviceSettings.vectorSublayerSettings.length ? (
                            <ExcludeAddIcon className="w-4 h-4 text-gray-800" />
                          ) : (
                            <ExcludeIcon className="w-4 h-4 text-gray-800" />
                          )
                        }
                        title={t("Exclude all from import")}
                        small
                        onClick={() => {
                          const layerIds =
                            serviceSettings.sourceType ===
                            "arcgis-dynamic-mapservice"
                              ? allLayerIds
                              : allFeatureLayerIds;
                          if (
                            serviceSettings.excludedSublayers.length ===
                            layerIds.length
                          ) {
                            serviceSettings.excludedSublayers = [];
                          } else {
                            serviceSettings.excludedSublayers = layerIds;
                          }
                          setServiceSettings({ ...serviceSettings });
                        }}
                      />
                      <TableOfContents
                        nodes={treeData}
                        onChange={(data) => setTreeData(data)}
                        disabledMessage="(raster only)"
                        extraClassName={(node) =>
                          serviceSettings.excludedSublayers.indexOf(
                            node.id as string
                          ) !== -1
                            ? "line-through disabled"
                            : ""
                        }
                        extraButtons={(node) => {
                          let buttons = [];
                          if (!node.isFolder && !node.disabled) {
                            if (
                              serviceSettings.sourceType ===
                              "arcgis-vector-source"
                            ) {
                              buttons.push(
                                <button
                                  data-type="settings"
                                  className={`cursor-pointer rounded block border mr-2 focus:outline-none focus:shadow-outline-blue p-0.5 ${
                                    selectedFeatureLayer?.generatedId ===
                                    node.id
                                      ? "shadow-outline-blue"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    setSelectedFeatureLayer(
                                      serviceData.layerInfo.find(
                                        (l) => l.generatedId === node.id
                                      )
                                    )
                                  }
                                >
                                  <SettingsIcon className="w-4 h-4 text-primary-500 hover:text-primary-600" />
                                </button>
                              );
                            }

                            buttons.push(
                              <ExcludeLayerToggle
                                excluded={
                                  serviceSettings.excludedSublayers.indexOf(
                                    node.id.toString()
                                  ) !== -1
                                }
                                onClick={() => {
                                  let excluded = [
                                    ...serviceSettings.excludedSublayers,
                                  ];
                                  if (
                                    serviceSettings.excludedSublayers.indexOf(
                                      node.id.toString()
                                    ) !== -1
                                  ) {
                                    // already excluded
                                    excluded = excluded.filter(
                                      (id) => id !== node.id
                                    );
                                  } else {
                                    excluded.push(node.id.toString());
                                  }
                                  mapContext.manager?.hideLayers([
                                    node.id.toString(),
                                  ]);
                                  setServiceSettings({
                                    ...serviceSettings,
                                    excludedSublayers: excluded,
                                  });
                                }}
                              />
                            );
                          }
                          return buttons;
                        }}
                      />
                    </div>
                    {serviceSettings.sourceType ===
                      "arcgis-dynamic-mapservice" && (
                      <DynamicMapServerSettingsForm
                        settings={serviceSettings}
                        mapServerInfo={serviceData.mapServerInfo}
                        layerInfo={serviceData.layerInfo}
                        serviceRoot={serviceData.mapServerInfo.url}
                        updateSettings={setServiceSettings}
                      />
                    )}
                    {serviceSettings.sourceType === "arcgis-vector-source" && (
                      <div>
                        <div className="mt-6 mb-5 bg-gray-100 rounded py-2 px-4 pb-3">
                          <h3 className="font-medium">{t("Import Layers")}</h3>
                          <p className="text-sm text-gray-600 mt-1 mb-2">
                            <Trans ns={["admin"]}>
                              Before importing vector sources, SeaSketch will
                              these vector sources for compatability and file
                              size issues.
                            </Trans>
                          </p>
                          <Button
                            primary={true}
                            disabled={
                              allFeatureLayerIds.length -
                                serviceSettings.excludedSublayers.length ===
                              0
                            }
                            onClick={() => setModalOpen(true)}
                            label={
                              serviceSettings.excludedSublayers.length === 0 ? (
                                <Trans
                                  ns="admin"
                                  count={
                                    allFeatureLayerIds.length -
                                    serviceSettings.excludedSublayers.length
                                  }
                                >
                                  Import all{" "}
                                  {allFeatureLayerIds.length -
                                    serviceSettings.excludedSublayers
                                      .length}{" "}
                                  layers
                                </Trans>
                              ) : (
                                <Trans
                                  ns="admin"
                                  count={
                                    allFeatureLayerIds.length -
                                    serviceSettings.excludedSublayers.length
                                  }
                                >
                                  Import{" "}
                                  {allFeatureLayerIds.length -
                                    serviceSettings.excludedSublayers
                                      .length}{" "}
                                  layers
                                </Trans>
                              )
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {selectedFeatureLayer && serviceSettings && (
                <div ref={featureLayerSettingsRef}>
                  <FeatureLayerSettings
                    service={mapServerInfo.data!.mapServerInfo}
                    layer={selectedFeatureLayer}
                    settings={serviceSettings}
                    updateSettings={(settings) => {
                      setServiceSettings({ ...settings });
                      // const layerSettings = settings.vectorSublayerSettings.find(
                      //   (s) => s.sublayer === selectedFeatureLayer.id
                      // );
                      // const source = vectorSourceFromSettings(
                      //   selectedFeatureLayer,
                      //   layerSettings
                      // );
                      // if (
                      //   source.type === DataSourceTypes.ArcgisDynamicMapserver
                      // ) {
                      //   mapContext.manager!.updateArcGISDynamicMapServiceSource(
                      //     source
                      //   );
                      // }
                      // mapContext.manager!.updateLayer(
                      //   vectorLayerFromSettings(
                      //     selectedFeatureLayer,
                      //     layerSettings
                      //   )
                      // );
                    }}
                  />
                </div>
              )}
            </div>
            <ImportVectorLayersModal
              serviceRoot={serviceData?.mapServerInfo.url}
              layers={mapServerInfo.data?.layerInfo.filter(
                (l) =>
                  l.type !== "Raster Layer" &&
                  serviceSettings?.excludedSublayers.indexOf(l.generatedId) ===
                    -1
              )}
              settings={serviceSettings}
              open={modalOpen}
              onRequestClose={() => setModalOpen(false)}
              mapServerInfo={mapServerInfo.data?.mapServerInfo!}
            />
          </div>
        </MapContext.Provider>
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
): ClientDataSource {
  return {
    id: serviceData.mapServerInfo.generatedId,
    type: DataSourceTypes.ArcgisDynamicMapserver,
    url: serviceData.mapServerInfo.url,
    useDevicePixelRatio: serviceSettings.enableHighDpi,
    queryParameters: {
      format: serviceSettings.imageFormat,
      transparent: "true",
    },
    // interactivitySettings: [],
    supportsDynamicLayers: serviceData.mapServerInfo.supportsDynamicLayers,
  };
}

function vectorSourceFromSettings(
  layer: LayerInfo,
  settings?: VectorSublayerSettings
): ClientDataSource {
  return {
    id: layer.generatedId,
    type: DataSourceTypes.ArcgisVector,
    url: layer.url,
    // TODO: add imageSets back
    // imageSets: layer.imageList ? layer.imageList.toJSON() : [],
    bytesLimit: settings?.ignoreByteLimit ? undefined : 5000000,
    queryParameters: {
      outFields: settings?.outFields,
      geometryPrecision: settings?.geometryPrecision,
    },
    // interactivitySettings: [],
    supportsDynamicLayers: false,
  };
}

function vectorLayerFromSettings(
  layer: LayerInfo,
  settings?: VectorSublayerSettings
): ClientDataLayer {
  const imageSetJSON = layer.imageList ? layer.imageList.toJSON() : [];
  let sprites: ClientSprite[] = [];
  if (imageSetJSON.length) {
    for (const imageSet of imageSetJSON) {
      sprites.push({
        id: imageSet.id,
        spriteImages: imageSet.images.map((i: any) => ({
          height: i.height,
          width: i.width,
          dataUri: i.dataURI,
          pixelRatio: i.pixelRatio,
        })),
      });
    }
  }
  return {
    id: layer.generatedId,
    dataSourceId: layer.generatedId,
    renderUnder: settings?.renderUnder || RenderUnderType.Labels,
    mapboxGlStyles: settings?.mapboxLayers || layer.mapboxLayers,
    sprites: sprites.length ? sprites : undefined,
    zIndex: layer.id,
  };
}

function updateDisabledState(
  sourceType: "arcgis-dynamic-mapservice" | "arcgis-vector-source",
  treeData: ClientTableOfContentsItem[],
  layers: LayerInfo[]
) {
  const updateChildren = (node: ClientTableOfContentsItem) => {
    if (node.children) {
      for (const child of node.children) {
        updateChildren(child);
      }
    }
    if (!node.isFolder) {
      const layer = layers.find((l) => l.generatedId === node.id);
      if (
        sourceType === "arcgis-vector-source" &&
        layer?.type === "Raster Layer"
      ) {
        node.disabled = true;
      } else {
        node.disabled = false;
      }
    }
  };
  if (treeData.length) {
    updateChildren(treeData[0]);
  }
  return [...treeData];
}
