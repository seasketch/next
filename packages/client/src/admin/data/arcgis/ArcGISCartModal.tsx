/* eslint-disable i18next/no-literal-string */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ArcGISSearchPage from "./ArcGISSearchPage";
import {
  CatalogItem,
  NormalizedArcGISServerLocation,
  useCatalogItemDetails,
  useCatalogItems,
} from "./arcgis";
import { AnyLayer, LngLatBounds, LngLatBoundsLike, Map } from "mapbox-gl";
import { SearchIcon } from "@heroicons/react/outline";
import Skeleton from "../../../components/Skeleton";
import { ArrowLeftIcon } from "@radix-ui/react-icons";
import { FolderIcon } from "@heroicons/react/solid";
import Spinner from "../../../components/Spinner";
import Button from "../../../components/Button";
import {
  ArcGISDynamicMapService,
  ArcGISRESTServiceRequestManager,
  CustomGLSource,
  ArcGISTiledMapService,
  DataTableOfContentsItem,
  FolderTableOfContentsItem,
  ArcGISFeatureLayerSource,
} from "@seasketch/mapbox-gl-esri-sources";
import { Feature } from "geojson";
import bbox from "@turf/bbox";
import ArcGISCartLegend from "./ArcGISCartLegend";

const requestManager = new ArcGISRESTServiceRequestManager();

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
  const { catalogInfo, error, loading } = useCatalogItems(
    location?.servicesRoot
      ? selectedFolder
        ? location.servicesRoot + "/" + selectedFolder.name
        : location.servicesRoot
      : "",
    requestManager
  );

  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);

  const [tableOfContentsItems, setTableOfContentsItems] = useState<
    (FolderTableOfContentsItem | DataTableOfContentsItem)[]
  >([]);

  const [visibleLayers, setVisibleLayers] = useState<string[]>([]);

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
      // const legend = new LegendControl();
      // m.addControl(legend, "bottom-left");
      m.fitBounds(mapBounds as LngLatBounds, { padding: 10, animate: false });

      m.on("load", () => {
        // m.fitBounds(mapBounds as LngLatBounds, { padding: 10, animate: false });
        m.resize();
        setMap(m);
      });
    }
  }, [mapDiv, setSourceLoading]);
  const [customSources, setCustomSources] = useState<CustomGLSource<any>[]>([]);

  useEffect(() => {
    if (map) {
      const dataLoadingHandler = () => {
        let anyLoading = false;
        if (customSources.length > 0) {
          for (const source of customSources) {
            if (source.loading) {
              anyLoading = true;
              break;
            }
          }
        }
        if (anyLoading) {
          setSourceLoading(true);
          setTimeout(() => {
            dataLoadingHandler();
          }, 200);
        } else {
          setSourceLoading(false);
        }
      };
      map.on("dataloading", dataLoadingHandler);
      map.on("data", dataLoadingHandler);
      map.on("moveend", dataLoadingHandler);

      return () => {
        map.off("dataloading", dataLoadingHandler);
        map.off("data", dataLoadingHandler);
        map.off("moveend", dataLoadingHandler);
      };
    }
  }, [map, setSourceLoading, customSources]);

  const catalogItemDetailsQuery = useCatalogItemDetails(
    requestManager,
    selection?.type === "FeatureServer" || selection?.type === "MapServer"
      ? selection.url
      : undefined
  );

  const [search, setSearch] = useState("");

  const items = (catalogInfo || []).filter(
    (i) =>
      (i.type === "MapServer" ||
        i.type === "FeatureServer" ||
        i.type === "Folder") &&
      (search.length === 0 ||
        i.name.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    setSourceLoading(false);
    setTableOfContentsItems([]);
    setVisibleLayers([]);
    if (catalogItemDetailsQuery.data && map && selection) {
      const { type } = catalogItemDetailsQuery.data;
      setSourceLoading(true);
      if (type === "MapServer" && catalogItemDetailsQuery.data.tiled) {
        const tileSource = new ArcGISTiledMapService(requestManager, {
          url: selection.url,
          supportHighDpiDisplays: true,
        });
        tileSource
          .getComputedMetadata()
          .then(({ bounds, tableOfContentsItems }) => {
            setTableOfContentsItems(tableOfContentsItems);
            setVisibleLayers(
              tableOfContentsItems
                .filter(
                  (item) =>
                    item.type === "data" && item.defaultVisibility === true
                )
                .map((item) => item.id)
            );
            if (bounds && bounds[0]) {
              map.fitBounds(bounds, { padding: 10 });
            }
          });
        setCustomSources([tileSource]);
        tileSource.addToMap(map).then(() => {
          tileSource.getGLStyleLayers().then(({ layers }) => {
            for (const layer of layers) {
              map.addLayer(layer);
            }
          });
        });
        return () => {
          setCustomSources([]);
          tileSource.destroy();
        };
      } else if (type === "MapServer") {
        const dynamicSource = new ArcGISDynamicMapService(requestManager, {
          url: selection.url,
          supportHighDpiDisplays: true,
          tileSize: 512,
          useTiles: false,
        });
        dynamicSource.getComputedMetadata().then((data) => {
          const { bounds, tableOfContentsItems } = data;
          setTableOfContentsItems(tableOfContentsItems);
          setVisibleLayers(
            tableOfContentsItems
              .filter(
                (item) =>
                  item.type === "data" && item.defaultVisibility === true
              )
              .map((item) => item.id)
          );
          if (bounds && bounds[0]) {
            map.fitBounds(bounds, { padding: 10 });
          }
        });
        setCustomSources([dynamicSource]);
        dynamicSource.addToMap(map).then(() => {
          dynamicSource.getGLStyleLayers().then(({ layers }) => {
            for (const layer of layers) {
              map.addLayer(layer);
            }
          });
        });
        return () => {
          setCustomSources([]);
          dynamicSource.destroy();
        };
      } else if (type === "FeatureServer") {
        const sources: ArcGISFeatureLayerSource[] = [];
        for (const layer of [
          ...catalogItemDetailsQuery.data.metadata?.layers,
        ].reverse()) {
          const featureLayerSource = new ArcGISFeatureLayerSource(
            requestManager,
            {
              url: selection.url + "/" + layer.id,
              fetchStrategy: "raw",
            }
          );
          sources.push(featureLayerSource);
          featureLayerSource.getComputedMetadata().then((data) => {
            const { bounds, tableOfContentsItems } = data;
            setTableOfContentsItems((prev) => [
              ...prev,
              ...tableOfContentsItems,
            ]);
            setVisibleLayers((prev) => {
              return [
                ...prev,
                ...tableOfContentsItems
                  .filter(
                    (item) =>
                      item.type === "data" && item.defaultVisibility === true
                  )
                  .map((item) => item.id),
              ];
            });
            if (bounds && bounds[0]) {
              map.fitBounds(bounds, { padding: 10 });
            }
          });
          featureLayerSource.addToMap(map).then(() => {
            featureLayerSource
              .getGLStyleLayers()
              .then(({ layers, imageList }) => {
                if (imageList) {
                  imageList.addToMap(map);
                }
                for (const layer of layers) {
                  map.addLayer(layer as AnyLayer);
                }
              });
          });
        }

        setCustomSources(sources);
        return () => {
          setCustomSources([]);
          for (const source of sources) {
            source.destroy();
          }
        };
      }
      return;
      // } else if (selection.type === "FeatureServer") {
      //   const featureLayers = mapServerInfo.data.layerInfo.filter(
      //     (l) => l.type === "Feature Layer"
      //   );
      //   const sources: { [sourceId: string]: FeatureService } = {};
      //   // @ts-ignore
      //   window.map = map;
      //   for (const layer of featureLayers) {
      //     if (layer.defaultVisibility === false) {
      //       continue;
      //     }
      //     const sourceId = `${selection.name}-${layer.id}`;
      //     const source = new FeatureService(sourceId, map, {
      //       url: layer.url,
      //       precision: 6,
      //       simplifyFactor: 0.3,
      //       setAttributionFromService: false,
      //       minZoom: 0,
      //     });

      //     // const source = new ArcGISVectorSource(map, sourceId, layer.url, {
      //     //   supportsPagination: true,
      //     //   bytesLimit: 10000000, // 10 mb
      //     // });
      //     sources[sourceId] = source;
      //     const imageList = layer.imageList;
      //     if (layer.mapboxLayers) {
      //       if (imageList) {
      //         imageList.addToMap(map);
      //       }
      //       for (const glLayer of [...layer.mapboxLayers].reverse()) {
      //         console.log("adding layer", glLayer, sourceId);
      //         // @ts-ignore
      //         map.addLayer({
      //           ...glLayer,
      //           source: sourceId,
      //         });
      //       }
      //     }
      //   }
      //   return () => {
      //     const layers = map.getStyle().layers || [];
      //     for (const sourceId in sources) {
      //       for (const layer of layers) {
      //         // @ts-ignore
      //         console.log("removing", layer.source, sourceId);
      //         // @ts-ignore
      //         if (layer.source === sourceId) {
      //           map.removeLayer(layer.id);
      //         }
      //       }
      //       // source.destroy();
      //       sources[sourceId].destroySource();
      //     }
      //   };
      // }
    }
  }, [catalogItemDetailsQuery.data, map]);

  useEffect(() => {
    if (customSources.length === 1) {
      const source = customSources[0];
      source.updateLayers(
        visibleLayers.map((id) => ({
          id: id.toString(),
          opacity: 1,
        }))
      );
    }
  }, [visibleLayers, customSources]);

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
              requestManager={requestManager}
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
                        console.log("onclick", item);
                        if (item.type === "Folder") {
                          setSelection(null);
                          setSelectedFolder(item);
                        } else {
                          console.log("setting selection", item);
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
                            className="bg-gray-100 flex-none rounded-sm"
                          />
                          {selection &&
                            selection === item &&
                            catalogItemDetailsQuery.loading && (
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
              {map && (
                <ArcGISCartLegend
                  map={map}
                  loading={sourceLoading}
                  items={tableOfContentsItems}
                  className="absolute left-96 bg-white top-0 z-50 mt-2 ml-2"
                  visibleLayerIds={visibleLayers}
                  toggleLayer={(id) => {
                    setVisibleLayers((prev) => {
                      if (prev.includes(id)) {
                        return prev.filter((i) => i !== id);
                      } else {
                        return [...prev, id];
                      }
                    });
                  }}
                />
              )}
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
