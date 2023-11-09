import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ArcGISSearchPage from "./ArcGISSearchPage";
import {
  CatalogItem,
  NormalizedArcGISServerLocation,
  generateStableId,
  useCatalogItemDetails,
  useCatalogItems,
  useImportArcGISService,
} from "./arcgis";
import { AnyLayer, LngLatBounds, LngLatBoundsLike, Map } from "mapbox-gl";
import { SearchIcon } from "@heroicons/react/outline";
import Skeleton from "../../../components/Skeleton";
import { ArrowLeftIcon, ExternalLinkIcon } from "@radix-ui/react-icons";
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
import Legend, { LegendItem } from "../../../dataLayers/Legend";
import { compileLegendFromGLStyleLayers } from "../../../dataLayers/legends/compileLegend";
import Switch from "../../../components/Switch";
import { Trans, useTranslation } from "react-i18next";
import useDialog from "../../../components/useDialog";
import { isFeatureLayerSource } from "@seasketch/mapbox-gl-esri-sources/dist/src/ArcGISFeatureLayerSource";
import {
  ArcgisFeatureLayerFetchStrategy,
  ArcgisImportItemInput,
  ArcgisImportSourceInput,
  ArcgisSourceType,
  useImportArcGisServiceMutation,
} from "../../../generated/graphql";
import { useGlobalErrorHandler } from "../../../components/GlobalErrorHandler";

const requestManager = new ArcGISRESTServiceRequestManager();

export default function ArcGISCartModal({
  onRequestClose,
  region,
  importedArcGISServices,
  projectId,
}: {
  onRequestClose: () => void;
  region?: Feature<any>;
  importedArcGISServices: string[];
  projectId: number;
}) {
  const { t } = useTranslation("admin:data");
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
  const { catalogInfo, error, loading } = useCatalogItems(
    location?.servicesRoot
      ? selectedFolder
        ? location.servicesRoot + "/" + selectedFolder.name
        : location.servicesRoot
      : "",
    requestManager
  );

  const onError = useGlobalErrorHandler();
  const [importMutation, importState] = useImportArcGisServiceMutation({
    onError,
  });

  const [sourceLoading, setSourceLoading] = useState(false);

  const [tableOfContentsItems, setTableOfContentsItems] = useState<
    (FolderTableOfContentsItem | DataTableOfContentsItem)[]
  >([]);

  const legendItems = useMemo<LegendItem[]>(() => {
    const items: LegendItem[] = [];
    for (const item of tableOfContentsItems) {
      if (item.type === "folder") {
        continue;
      }
      if (item.type === "data" && item.glStyle) {
        items.push({
          type: "GLStyleLegendItem",
          id: item.id.toString(),
          label: item.label,
          legend: compileLegendFromGLStyleLayers(item.glStyle.layers, "vector"),
        });
      } else if (item.type === "data" && item.legend) {
        items.push({
          type: "CustomGLSourceSymbolLegend",
          label: item.label,
          supportsDynamicRendering: {
            layerOpacity: true,
            layerOrder: true,
            layerVisibility: true,
          },
          symbols: item.legend,
          id: item.id.toString(),
        });
      }
    }
    return items;
  }, [tableOfContentsItems]);

  const [hiddenLayers, setHiddenLayers] = useState<string[]>([]);

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
  }, [mapDiv]);

  const [customSources, setCustomSources] = useState<CustomGLSource<any>[]>([]);

  useEffect(() => {
    if (map && customSources.length) {
      let timeout: any = null;
      const updateIsLoading = () => {
        let isLoading = false;
        for (const source of customSources) {
          isLoading = source.loading || isLoading;
        }
        setSourceLoading(isLoading);
        if (isLoading) {
          if (timeout) {
            clearTimeout(timeout);
          }
          timeout = setTimeout(updateIsLoading, 2000);
        }
      };
      map.on("data", updateIsLoading);
      map.on("dataloading", updateIsLoading);

      return () => {
        map.off("data", updateIsLoading);
        map.off("dataloading", updateIsLoading);
        if (timeout) {
          clearTimeout(timeout);
        }
      };
    }
  }, [customSources, map, setSourceLoading]);

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

  const [useFeatureLayers, setUseFeatureLayers] = useState(false);

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
    setHiddenLayers([]);
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
            setHiddenLayers(
              tableOfContentsItems
                .filter(
                  (item) =>
                    item.type === "data" && item.defaultVisibility === false
                )
                .map((item) => item.id)
            );
            if (bounds && bounds[0]) {
              map.fitBounds(bounds, { padding: 10, animate: false });
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
      } else if (type === "MapServer" || type === "FeatureServer") {
        const featureLayers =
          type === "FeatureServer"
            ? catalogItemDetailsQuery.data.metadata?.layers
            : catalogItemDetailsQuery.data.layers.layers.filter((lyr: any) => {
                return (
                  lyr.type === "Feature Layer" &&
                  /geojson/i.test(lyr.supportedQueryFormats)
                );
              });
        if (type === "FeatureServer" || useFeatureLayers) {
          const sources: ArcGISFeatureLayerSource[] = [];
          for (const layer of featureLayers.reverse()) {
            const featureLayerSource = new ArcGISFeatureLayerSource(
              requestManager,
              {
                url: selection.url + "/" + layer.id,
                fetchStrategy: "auto",
              }
            );
            sources.push(featureLayerSource);
            featureLayerSource.getComputedMetadata().then((data) => {
              const { bounds, tableOfContentsItems } = data;
              setTableOfContentsItems((prev) => [
                ...prev,
                ...tableOfContentsItems,
              ]);
              setHiddenLayers((prev) => {
                return [
                  ...prev,
                  ...tableOfContentsItems
                    .filter(
                      (item) =>
                        item.type === "data" && item.defaultVisibility === false
                    )
                    .map((item) => item.id),
                ];
              });
              if (bounds && bounds[0]) {
                map.fitBounds(bounds, { padding: 10, animate: false });
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
        } else {
          const dynamicSource = new ArcGISDynamicMapService(requestManager, {
            url: selection.url,
            supportHighDpiDisplays: true,
            tileSize: 512,
            useTiles: false,
          });
          dynamicSource.getComputedMetadata().then((data) => {
            const { bounds, tableOfContentsItems } = data;
            setTableOfContentsItems(tableOfContentsItems);
            setHiddenLayers(
              tableOfContentsItems
                .filter(
                  (item) =>
                    item.type === "data" && item.defaultVisibility === false
                )
                .map((item) => item.id)
            );
            if (bounds && bounds[0]) {
              map.fitBounds(bounds, {
                padding: 10,
                animate: true,
                duration: 100,
              });
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
        }
      }
      return;
    }
  }, [catalogItemDetailsQuery.data, map, useFeatureLayers]);

  useEffect(() => {
    for (const source of customSources) {
      const visibleLayers: string[] = [];
      for (const item of tableOfContentsItems) {
        if (item.type === "data" && !hiddenLayers.includes(item.id)) {
          visibleLayers.push(item.id);
        }
      }
      source.updateLayers(
        visibleLayers.map((id) => ({
          id: id.toString(),
          opacity: 1,
        }))
      );
    }
  }, [hiddenLayers, customSources, tableOfContentsItems]);

  const { loadingMessage } = useDialog();

  const onAddService = useCallback(async () => {
    const { hideLoadingMessage, updateLoadingMessage } = loadingMessage(
      t(`Evaluating services (1 / ${customSources.length})...`)
    );
    const layers = catalogItemDetailsQuery.data?.metadata.layers || [];
    console.log("on add service", layers);
    if (layers.length && customSources.length) {
      const items: ArcgisImportItemInput[] = [];
      const sources: ArcgisImportSourceInput[] = [];
      if (customSources[0].type === "ArcGISTiledMapService") {
        items.push({
          title: selection?.name,
          isFolder: false,
          id: 1,
          sourceId: 1,
        });
        sources.push({
          id: 1,
          type: ArcgisSourceType.ArcgisRasterTiles,
          url: customSources[0].url,
        });
      } else {
        for (const layer of layers) {
          if (
            Array.isArray(layer.subLayerIds) &&
            layer.subLayerIds.length > 0
          ) {
            // FOLDER
            items.push({
              id: layer.id,
              isFolder: true,
              title: layer.name,
              ...("parentLayerId" in layer && layer.parentLayerId > -1
                ? { parentId: layer.parentLayerId }
                : {}),
              stableId: generateStableId(),
            });
          } else if (
            catalogItemDetailsQuery.data?.type === "FeatureServer" ||
            useFeatureLayers
          ) {
            // add layers as individual feature layers
            const source = customSources.find(
              (s) => s.url === selection?.url + "/" + layer.id
            );
            if (!source) {
              console.warn("cant find source", selection?.url + "/" + layer.id);
              continue;
              // throw new Error("Source not found");
            }

            items.push({
              id: layer.id,
              isFolder: false,
              title: layer.name,
              sourceId: layer.id,
              ...("parentLayerId" in layer && layer.parentLayerId > -1
                ? { parentId: layer.parentLayerId }
                : {}),
              stableId: generateStableId(),
            });

            const fetchStrategy = await (
              source as ArcGISFeatureLayerSource
            ).getFetchStrategy();

            sources.push({
              id: layer.id,
              type: ArcgisSourceType.ArcgisVector,
              url: selection?.url + "/" + layer.id,
              fetchStrategy:
                fetchStrategy === "auto"
                  ? ArcgisFeatureLayerFetchStrategy.Auto
                  : fetchStrategy === "tiled"
                  ? ArcgisFeatureLayerFetchStrategy.Tiled
                  : ArcgisFeatureLayerFetchStrategy.Raw,
            });
          } else {
            // Dynamic Map Service
            items.push({
              id: layer.id,
              isFolder: false,
              title: layer.name,
              sourceId: 1,
              ...("parentLayerId" in layer && layer.parentLayerId > -1
                ? { parentId: layer.parentLayerId }
                : {}),
              sublayerId: layer.id,
              stableId: generateStableId(),
            });
          }
        }
      }
      if (
        catalogItemDetailsQuery.data?.type === "MapServer" &&
        !useFeatureLayers
      ) {
        sources.push({
          id: 1,
          type: ArcgisSourceType.ArcgisDynamicMapserver,
          url: selection?.url,
        });
      }
      console.log({ items, sources });
      // eslint-disable-next-line i18next/no-literal-string
      updateLoadingMessage(`Adding ${items.length} layers to project...`);
      await importMutation({
        variables: {
          projectId,
          items,
          sources,
        },
      });
      hideLoadingMessage();
    }
  }, [
    customSources,
    useFeatureLayers,
    selection,
    catalogItemDetailsQuery.data,
    t,
    loadingMessage,
    projectId,
    importMutation,
  ]);

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
                    <div className="p-4 italic">
                      {t("No map services in this folder")}
                    </div>
                  )}
                  {items.length === 0 && !loading && !selectedFolder && (
                    <div className="p-4 italic">
                      {t("No map services found")}
                    </div>
                  )}
                  {items.map((item) => (
                    <button
                      key={item.url}
                      onClick={(e) => {
                        if (
                          selection?.url === item.url &&
                          (e.target as HTMLElement).tagName === "IMG"
                        ) {
                          window.open(item.url, "_blank");
                        } else {
                          if (item.type === "Folder") {
                            setSelection(null);
                            setSelectedFolder(item);
                          } else {
                            setSelection(item);
                          }
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

                        {selection?.url === item.url ? (
                          <a
                            className="text-sm underline"
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {item.type}
                            <ExternalLinkIcon className="inline ml-1" />
                          </a>
                        ) : (
                          <span className="text-sm">{item.type}</span>
                        )}
                      </div>
                      {item.type === "Folder" ? (
                        <div
                          style={{ width: 200 / 3, height: 133 / 3 }}
                          className="flex items-center justify-center"
                        >
                          <FolderIcon className="w-10 h-10 text-primary-500" />
                        </div>
                      ) : (
                        <div className="relative group">
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
              {map && legendItems.length > 0 && (
                <Legend
                  loading={sourceLoading}
                  backdropBlur
                  className="absolute left-96 top-0 z-50 mt-2 ml-2"
                  items={legendItems}
                  hiddenItems={hiddenLayers}
                  onHiddenItemsChange={(id, visible) => {
                    setHiddenLayers((prev) => {
                      if (visible) {
                        return [...prev, id];
                      } else {
                        return prev.filter((i) => i !== id);
                      }
                    });
                  }}
                  opacity={{}}
                  zOrder={{}}
                  map={map}
                  maxHeight={600}
                />
              )}
              {useFeatureLayers &&
                legendItems.length === 0 &&
                sourceLoading === false && (
                  <div className="absolute left-96 top-0 z-50 mt-2 ml-2 bg-white rounded p-2 text-sm shadow bg-opacity-90 w-64">
                    <h3 className="flex-1 text-left flex items-center w-full border-b pb-2">
                      {t("Legend")}
                    </h3>
                    <p className="mt-2">
                      {t(
                        "No vector layers found. Disable vector request preference to see raster layers."
                      )}
                    </p>
                  </div>
                )}
              <div ref={setMapDiv} className={`bg-gray-50 flex-1`}></div>
            </div>
            <div className="border-t border-gray-800 border-opacity-20 flex w-full bg-gray-200 p-4 rounded-b-md items-end justify-end gap-2 space-x-5">
              <div
                className={`${
                  catalogItemDetailsQuery.data?.type === "MapServer"
                    ? "opacity-100"
                    : "opacity-0"
                } h-full flex items-center justify-start space-x-2 text-sm flex-1`}
              >
                <div>
                  <h5>
                    <Trans ns="admin:data">
                      Display vectors instead of requesting images from
                      MapService
                    </Trans>
                  </h5>
                  <p className="text-gray-500">
                    <Trans ns="admin:data">
                      Best option for smaller datasets, can cause problems for
                      largest ones.
                    </Trans>
                  </p>
                </div>
                <Switch
                  isToggled={useFeatureLayers}
                  onClick={(val) => setUseFeatureLayers(val)}
                />
              </div>
              <div className="flex items-center space-x-1 h-full">
                <Button label={t("Done")} onClick={onRequestClose} />
                <Button
                  onClick={onAddService}
                  primary
                  label={t("Add service to project")}
                />
              </div>
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
