/* eslint-disable i18next/no-literal-string */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ArcGISSearchPage from "./ArcGISSearchPage";
import {
  CatalogItem,
  NormalizedArcGISServerLocation,
  extentToLatLngBounds,
  useCatalogItems,
  useMapServerInfo,
} from "./arcgis";
import { LngLatBounds, LngLatBoundsLike, Map } from "mapbox-gl";
import { SearchIcon } from "@heroicons/react/outline";
import Skeleton from "../../../components/Skeleton";
import { ArrowLeftIcon, MinusIcon, PlusIcon } from "@radix-ui/react-icons";
import { FolderIcon } from "@heroicons/react/solid";
import Spinner from "../../../components/Spinner";
import { TiledMapService } from "mapbox-gl-esri-sources";
import FeatureService from "mapbox-gl-arcgis-featureserver";
import Button from "../../../components/Button";
import {
  ArcGISDynamicMapService,
  ArcGISVectorSource,
  styleForFeatureLayer,
} from "@seasketch/mapbox-gl-esri-sources";
import { Feature } from "geojson";
import bbox from "@turf/bbox";

export default function ArcGISCartModal({
  onRequestClose,
  region,
}: {
  onRequestClose: () => void;
  region?: Feature<any>;
}) {
  let mapBounds: LngLatBoundsLike | undefined = undefined;
  if (region) {
    const box = region
      ? (bbox(region) as [number, number, number, number])
      : undefined;
    if (box) {
      mapBounds = new LngLatBounds([box[0], box[1]], [box[2], box[3]]);
    }
  }
  const [location, setLocation] =
    useState<NormalizedArcGISServerLocation | null>(null);
  const [mapDiv, setMapDiv] = useState<HTMLDivElement | null>(null);
  const [selection, setSelection] = useState<CatalogItem | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<CatalogItem | null>(
    null
  );
  const [map, setMap] = useState<Map | null>(null);
  const [showLayerList, setShowLayerList] = useState(false);
  const [dynamicMapService, setDynamicMapService] =
    useState<null | ArcGISDynamicMapService>(null);

  // const mapServerInfo = useMapServerInfo(location?.baseUrl);
  const { catalogInfo, error, loading } = useCatalogItems(
    location?.servicesRoot
      ? selectedFolder
        ? location.servicesRoot + "/" + selectedFolder.name
        : location.servicesRoot
      : ""
  );

  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);

  useEffect(() => {
    if (mapDiv) {
      // initialize mapbox map
      const m = new Map({
        container: mapDiv,
        style: "mapbox://styles/mapbox/streets-v11",
        // bounds: mapBounds,
        center: [-74.5, 40],
        zoom: 9,
      });
      m.fitBounds(mapBounds as LngLatBounds, { padding: 10, animate: false });

      m.on("load", () => {
        // m.fitBounds(mapBounds as LngLatBounds, { padding: 10, animate: false });
        m.resize();
        setMap(m);
        m.on("dataloading", (e) => {
          setMapIsLoadingData(true);
          setTimeout(() => {
            for (const id in m.getStyle().sources || {}) {
              if (!m.isSourceLoaded(id)) {
                setMapIsLoadingData(true);
                return;
              }
            }
            setMapIsLoadingData(false);
          }, 1000);
        });
        m.on("data", (e) => {
          for (const id in m.getStyle().sources || {}) {
            if (!m.isSourceLoaded(id)) {
              setMapIsLoadingData(true);
              return;
            }
          }
          setMapIsLoadingData(false);
        });
      });
    }
  }, [mapDiv]);

  const mapServerInfo = useMapServerInfo(selection?.url);

  const [search, setSearch] = useState("");

  const items = (catalogInfo || []).filter(
    (i) =>
      (i.type === "MapServer" ||
        i.type === "FeatureServer" ||
        i.type === "Folder") &&
      (search.length === 0 ||
        i.name.toLowerCase().includes(search.toLowerCase()))
  );

  const [mapIsLoadingData, setMapIsLoadingData] = useState(false);

  useEffect(() => {
    if (mapServerInfo.data && map && selection) {
      const bounds = extentToLatLngBounds(
        mapServerInfo.data.mapServerInfo.fullExtent
      ) as LngLatBoundsLike | undefined;
      if (bounds) {
        map.fitBounds(bounds, { padding: 10 });
      }
      if (selection.type === "MapServer") {
        const layersToSelect = mapServerInfo.data.layerInfo
          .filter((l) => l.defaultVisibility && l.type !== "Group Layer")
          .map((l) => l.id.toString());
        setSelectedLayerIds(layersToSelect);
        if (mapServerInfo.data.mapServerInfo.tileInfo?.rows) {
          const levels = mapServerInfo.data.mapServerInfo.tileInfo.lods.map(
            (lod) => lod.level
          );
          const minzoom = Math.min(...levels);
          const maxzoom = Math.max(...levels);
          const sourceId = `${selection.name}-raster-source`;
          map.addSource(sourceId, {
            type: "raster",
            tiles: [selection.url + "/tile/{z}/{y}/{x}"],
            tileSize:
              mapServerInfo.data.mapServerInfo.tileInfo.rows /
              window.devicePixelRatio,
            minzoom: Math.max(minzoom, 1),
            maxzoom,
            // ...(bounds ? { bounds } : {}),
          });
          const layerId = `${selection.name}-tiled-layer`;
          map.addLayer({
            id: layerId,
            type: "raster",
            source: sourceId,
          });
          return () => {
            map.removeLayer(layerId);
            map.removeSource(sourceId);
          };
        } else {
          const useTiles = false;
          const sourceId = `${selection.name}-raster-source`;
          const source = new ArcGISDynamicMapService(
            map,
            sourceId,
            selection.url,
            {
              supportsDynamicLayers:
                mapServerInfo.data.mapServerInfo.supportsDynamicLayers,
              useDevicePixelRatio: true,
              layers: layersToSelect.map((l) => ({
                sublayer: parseInt(l),
                opacity: 1,
              })),
              useTiles,
            }
          );
          const layerId = `${selection.name}-dynamic-layer`;

          map.addLayer({
            id: layerId,
            type: "raster",
            source: sourceId,
            paint: {
              "raster-fade-duration": useTiles ? 100 : 0,
            },
          });
          setDynamicMapService(source);
          return () => {
            setDynamicMapService(null);
            map.removeLayer(layerId);
            map.removeSource(sourceId);
          };
        }
      } else if (selection.type === "FeatureServer") {
        const featureLayers = mapServerInfo.data.layerInfo.filter(
          (l) => l.type === "Feature Layer"
        );
        const sources: { [sourceId: string]: FeatureService } = {};
        // @ts-ignore
        window.map = map;
        for (const layer of featureLayers) {
          if (layer.defaultVisibility === false) {
            continue;
          }
          const sourceId = `${selection.name}-${layer.id}`;
          const source = new FeatureService(sourceId, map, {
            url: layer.url,
            precision: 6,
            simplifyFactor: 0.3,
            setAttributionFromService: false,
            minZoom: 0,
          });

          // const source = new ArcGISVectorSource(map, sourceId, layer.url, {
          //   supportsPagination: true,
          //   bytesLimit: 10000000, // 10 mb
          // });
          sources[sourceId] = source;
          const imageList = layer.imageList;
          if (layer.mapboxLayers) {
            if (imageList) {
              imageList.addToMap(map);
            }
            for (const glLayer of [...layer.mapboxLayers].reverse()) {
              console.log("adding layer", glLayer, sourceId);
              // @ts-ignore
              map.addLayer({
                ...glLayer,
                source: sourceId,
              });
            }
          }
        }
        return () => {
          const layers = map.getStyle().layers || [];
          for (const sourceId in sources) {
            for (const layer of layers) {
              // @ts-ignore
              console.log("removing", layer.source, sourceId);
              // @ts-ignore
              if (layer.source === sourceId) {
                map.removeLayer(layer.id);
              }
            }
            // source.destroy();
            sources[sourceId].destroySource();
          }
        };
      }
    }
  }, [mapServerInfo.data, map]);

  useEffect(() => {
    if (selectedLayerIds && map && dynamicMapService) {
      dynamicMapService.updateLayers(
        selectedLayerIds.sort().map((l) => ({
          sublayer: parseInt(l),
          opacity: 1,
        }))
      );
      if (selectedLayerIds.length === 0) {
        map.removeLayer("dynamic-layer");
      } else if (!map.getLayer("dynamic-layer")) {
        map.addLayer({
          id: "dynamic-layer",
          type: "raster",
          source: "dynamic",
        });
      }
      // }
    }
  }, [selectedLayerIds, map, dynamicMapService]);

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onRequestClose}
      ></div>
      <div className="z-50 pointer-events-none absolute bg-transparent left-0 top-0 w-screen h-screen flex items-center justify-center">
        {!location && (
          <div className="bg-gray-200 w-3/4 h-3/4 pointer-events-auto shadow-lg rounded-lg flex items-center justify-center">
            <ArcGISSearchPage
              onResult={(result) => {
                setLocation(result.location);
              }}
            />
          </div>
        )}
        {location && (
          <div className="bg-white w-3/4 h-3/4 pointer-events-auto shadow-lg rounded-lg flex flex-col items-center justify-center">
            <div className="flex flex-col w-full bg-gray-100 rounded-t-md p-4 font-semibold shadow z-10">
              {location.servicesRoot}
            </div>
            <div className="flex-1 bg-green-200 w-full flex overflow-hidden relative">
              <div className="bg-white border-r w-96 flex flex-col">
                <div className="p-2 border-b bg-gray-100 relative">
                  <div className="h-full w-14 flex items-center justify-center absolute left-0 top-0">
                    <SearchIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                  </div>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    type="text"
                    className="rounded-md border-gray-200 input w-full focus:ring-gray-600 pl-10"
                  />
                </div>
                {selectedFolder && (
                  <div className="p-2 bg-gray-100 text-primary-500 border-b border-gray-300 shadow-sm">
                    <button
                      onClick={() => {
                        setSelection(null);
                        setSelectedFolder(null);
                      }}
                    >
                      <ArrowLeftIcon className="w-4 h-4 inline-block -mt-0.5 mr-2" />
                      {selectedFolder.name}
                    </button>
                  </div>
                )}
                <div className="overflow-y-auto w-full flex-1">
                  {items.length === 0 && loading && (
                    <>
                      <LoadingSkeleton />
                      <LoadingSkeleton />
                      <LoadingSkeleton />
                      <LoadingSkeleton />
                      <LoadingSkeleton />
                      <LoadingSkeleton />
                      <LoadingSkeleton />
                      <LoadingSkeleton />
                      <LoadingSkeleton />
                      <LoadingSkeleton />
                      <LoadingSkeleton />
                      <LoadingSkeleton />
                      <LoadingSkeleton />
                      <LoadingSkeleton />
                      <LoadingSkeleton />
                      <LoadingSkeleton />
                    </>
                  )}
                  {items.length === 0 && !loading && selectedFolder && (
                    <div className="p-4">No map services in this folder</div>
                  )}
                  {items.map((item) => (
                    <button
                      key={item.url}
                      onClick={(e) => {
                        if (item.type === "Folder") {
                          setSelection(null);
                          setSelectedFolder(item);
                        } else {
                          setSelection(item);
                        }
                      }}
                      className={`border-b p-2 px-4 flex overflow-hidden w-full text-left ${
                        selection?.url === item.url
                          ? "bg-blue-600 text-white"
                          : ""
                      }`}
                    >
                      <div className="flex-1 overflow-hidden">
                        <h2 className="truncate">{item.name}</h2>
                        <p className="text-sm">{item.type}</p>
                      </div>
                      {item.type === "Folder" ? (
                        <div
                          style={{ width: 200 / 3, height: 133 / 3 }}
                          className="flex items-center justify-center"
                        >
                          <FolderIcon className="w-10 h-10 text-primary-500" />
                        </div>
                      ) : (
                        <div className="relative">
                          <img
                            src={`${item.url}/info/thumbnail`}
                            width={200 / 3}
                            height={133 / 3}
                            loading="lazy"
                            alt="thumbnail map"
                            className="bg-gray-100 flex-none"
                          />
                          {selection &&
                            selection === item &&
                            mapServerInfo.loading && (
                              <div className="absolute w-full h-full flex items-center justify-center z-50 bg-blue-700 bg-opacity-20 top-0 left-0">
                                <Spinner />
                              </div>
                            )}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              {map &&
                mapServerInfo.data?.layerInfo &&
                // @ts-ignore
                !mapServerInfo.data.mapServerInfo.tileInfo?.format &&
                (showLayerList ? (
                  <div className="w-60 max-h-96 overflow-x-hidden overflow-y-scroll absolute bg-white shadow rounded left-96 ml-4 top-4 z-50 px-2 pr-8 text-sm pb-2">
                    <div className="flex items-center py-1 px-1">
                      <button
                        className="border inline-block"
                        onClick={() => setShowLayerList(false)}
                      >
                        <MinusIcon className="w-4 h-4 text-gray-400" />
                      </button>

                      <button
                        className="underline text-sm text-primary-500 ml-2"
                        onClick={() => {
                          if (
                            selectedLayerIds.length > 0 ||
                            !mapServerInfo?.data?.layerInfo
                          ) {
                            setSelectedLayerIds([]);
                          } else {
                            setSelectedLayerIds(
                              mapServerInfo.data.layerInfo
                                .filter((l) => l.type !== "Group Layer")
                                .map((l) => l.id.toString())
                                .sort()
                            );
                          }
                        }}
                      >
                        toggle layers
                      </button>
                      {mapIsLoadingData ? (
                        <Spinner className="ml-2" />
                      ) : (
                        <div> </div>
                      )}
                    </div>
                    {mapServerInfo.data.layerInfo
                      .filter((l) => l.type !== "Group Layer")
                      .map((layer) => (
                        <div className="w-full truncate px-1 py-1">
                          <label>
                            <input
                              className="rounded mr-2"
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLayerIds([
                                    ...(selectedLayerIds || []),
                                    e.target.value,
                                  ]);
                                } else {
                                  setSelectedLayerIds(
                                    (selectedLayerIds || []).filter(
                                      (id) => id !== e.target.value
                                    )
                                  );
                                }
                              }}
                              checked={
                                selectedLayerIds &&
                                selectedLayerIds.includes(layer.id.toString())
                              }
                              type="checkbox"
                              name="checkbox"
                              value={layer.id.toString()}
                            />
                            {layer.name}
                          </label>
                        </div>
                      ))}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowLayerList(true)}
                    className="absolute bg-white shadow rounded-full left-96 ml-4 top-4 z-50 px-4 pr-8 flex items-center"
                  >
                    <PlusIcon className="w-4 h-4 text-gray-400 mr-1 -ml-2" />
                    {
                      mapServerInfo.data.layerInfo.filter(
                        (l) => l.type !== "Group Layer"
                      ).length
                    }{" "}
                    layers
                    {mapIsLoadingData ? (
                      <Spinner className="absolute right-1 top-0.5" />
                    ) : (
                      <div> </div>
                    )}
                  </button>
                ))}
              <div ref={setMapDiv} className={`bg-gray-50 flex-1`}></div>
            </div>
            <div className="border-t border-gray-800 border-opacity-20 flex w-full bg-gray-200 p-4 rounded-b-md items-end justify-end gap-2">
              <Button label="Done" onClick={onRequestClose} />
              <Button disabled primary label="Add service to project" />
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

function LoadingSkeleton() {
  return (
    <div className={`border-b p-2 flex overflow-hidden w-full text-left`}>
      <div className="flex-1 overflow-hidden">
        <Skeleton className="h-4 w-2/3 block mt-1" />
        <br />
        <Skeleton className="h-4 w-1/4 block" />
      </div>
      <Skeleton className="w-16 h-12" />
    </div>
  );
}
