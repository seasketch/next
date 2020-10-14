import React, { ReactNode, useEffect, useRef, useState } from "react";
import {
  CatalogItem,
  extentToLatLngBounds,
  NormalizedArcGISServerLocation,
  useArcGISServiceSettings,
  useMapServerInfo,
  useVisibleLayersSettings,
  ArcGISServiceSettings,
  LayerInfo,
  MapServerCatalogInfo,
} from "./arcgis";
import { Map } from "mapbox-gl";
import OverlayManager, { OverlayConfig } from "./OverlayManager";
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
import { ArcGISLayerTree } from "./ArcGISLayerTree";
import { ArcGISVectorSourceOptions } from "@seasketch/mapbox-gl-esri-sources";
import DynamicMapServerSettingsForm from "./DynamicMapServerSettingsForm";
import VectorFeatureLayerSettingsForm from "./VectorFeatureLayerSettingsForm";
import { FeatureLayerSettings } from "./FeatureLayerSettings";

export default function ArcGISBrowser() {
  const [server, setServer] = useState<{
    location: NormalizedArcGISServerLocation;
    version: string;
  }>();
  const [columns, setColumns] = useState<ArcGISBrowserColumnProps[]>([]);
  const [map, setMap] = useState<Map | null>(null);
  const [overlayManager, setOverlayManager] = useState<OverlayManager>();
  const [selectedMapServer, setSelectedMapServer] = useState<string>();
  const mapServerInfo = useMapServerInfo(selectedMapServer);
  const [selectedFeatureLayer, setSelectedFeatureLayer] = useState<LayerInfo>();
  const serviceColumnRef = useRef<HTMLDivElement>(null);

  const [visibleLayers, updateVisibleLayers] = useVisibleLayersSettings(
    selectedMapServer
  );
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

  // Update overlays when any settings or state changes
  useEffect(() => {
    if (serviceData && overlayManager && serviceSettings) {
      const overlays = calculateOverlays(
        serviceData.mapServerInfo,
        serviceData.layerInfo,
        serviceSettings,
        visibleLayers
      );
      overlayManager.updateOverlays(overlays);
      console.log("updateOverlays", overlays);
    } else {
      if (overlayManager) {
        overlayManager.updateOverlays([]);
      }
    }
  }, [overlayManager, serviceData, visibleLayers, serviceSettings]);

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
        <div className="flex flex-col h-full">
          <OverlayMap
            onLoad={(map, manager) => {
              setMap(map);
              setOverlayManager(manager);
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
                      Image sources display data as full-screen images, typical
                      of how most web mapping portals work. Each time the user
                      pans or zooms the map a new image will be requested and
                      displayed with the requested layers.
                    </p>
                  )}

                  {serviceSettings.sourceType === "arcgis-vector-source" && (
                    <p className="text-sm text-gray-600">
                      When using vector sources, SeaSketch loads actual geometry
                      data and uses the user's browser to render it. This can
                      result in a much faster, sharper, and more interactive map
                      but takes a little more work to configure. Each layer can
                      be styled and configured independently (click{" "}
                      <SettingsIcon className="w-4 h-4 inline-block" />
                      ).
                    </p>
                  )}

                  <ArcGISLayerTree
                    onVectorSettingsClick={(featureLayerInfo) => {
                      setSelectedFeatureLayer(featureLayerInfo);
                    }}
                    vectorMode={
                      serviceSettings.sourceType === "arcgis-vector-source"
                    }
                    mapServiceInfo={serviceData.mapServerInfo}
                    layers={serviceData.layerInfo}
                    onVisibleLayersChanged={(layerIds) =>
                      updateVisibleLayers(layerIds)
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
                updateSettings={setServiceSettings}
              />
            )}
          </div>
        </div>
      </>
    );
  }
}

const calculateOverlays = (
  mapServiceInfo: MapServerCatalogInfo,
  layerInfo: LayerInfo[],
  settings: ArcGISServiceSettings,
  visibleLayers?: number[]
): OverlayConfig => {
  const overlays: OverlayConfig = [];
  console.log("settings", settings);
  if (settings.sourceType === "arcgis-dynamic-mapservice") {
    overlays.push({
      id: mapServiceInfo.url,
      type: "ArcGISDynamicMapService",
      url: mapServiceInfo.url,
      options: {
        supportsDynamicLayers: mapServiceInfo.supportsDynamicLayers,
        useDevicePixelRatio: settings.enableHighDpi,
        layers: visibleLayers
          ? visibleLayers.map((lyr) => ({ sublayer: lyr }))
          : undefined,
        queryParameters: {
          format: settings.imageFormat,
          transparent: "true",
        },
      },
    });
  } else if (settings.sourceType === "arcgis-vector-source") {
    for (const sublayerId of visibleLayers || []) {
      if (settings.excludedSublayers.indexOf(sublayerId) === -1) {
        const info = layerInfo.find((l) => l.id === sublayerId);
        const layerSettings = settings.vectorSublayerSettings.find(
          (s) => s.sublayer === sublayerId
        );
        if (info && info.type === "Feature Layer") {
          overlays.push({
            id: info.generatedSourceId,
            type: "ArcGISVectorSource",
            url: `${mapServiceInfo.url}/${sublayerId}`,
            imageList: info.imageList,
            layers: info.mapboxLayers,
            options: {
              supportsPagination:
                info.advancedQueryCapabilities.supportsPagination,
              bytesLimit: layerSettings?.ignoreByteLimit ? undefined : 5000000,
              geometryPrecision: layerSettings?.geometryPrecision || 6,
            } as ArcGISVectorSourceOptions,
          });
        }
      }
    }
  } else {
    throw new Error("Unknown source type");
  }
  return overlays;
};
